const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http, {
    cors: { origin: "*" },
    pingInterval: 2000,
    pingTimeout: 5000
});

// --- GAME CONSTANTS (unchanged from the original server) ---
const CONFIG = {
    worldWidth: 3000, // Larger map for multiplayer
    worldHeight: 2000,
    friction: 0.92,
    acceleration: 0.8,
    maxSpeed: 4.5,
    dashSpeed: 12,
    dashDuration: 10,
    dashCooldown: 90,
    gatherTime: 45,
    ballSpeed: 12,
    snowballLife: 100
};

// --- MATCH SIZES ---
// Allowed (blue, red) pairs for both modes, plus 30v30 for single only.
const SHARED_SIZES = [[1, 1], [1, 5], [5, 5], [10, 10]];
const SINGLE_ONLY_SIZE = [30, 30];

function sizeAllowed(mode, blue, red) {
    if (!Number.isInteger(blue) || !Number.isInteger(red)) return false;
    if (SHARED_SIZES.some(([b, r]) => b === blue && r === red)) return true;
    if (mode === 'single' && blue === SINGLE_ONLY_SIZE[0] && red === SINGLE_ONLY_SIZE[1]) return true;
    return false;
}

// --- MATCH LENGTH ---
// 3 minutes at 60 TPS. Overridable via env for tests.
const MATCH_DURATION_TICKS = Number(process.env.MATCH_DURATION_TICKS) || 10800;

// --- BOT DIFFICULTY LEVELS (single-player only) ---
// Normal reproduces the original bot exactly. Easy/Hard tune aim noise,
// charge time, throw range, dash frequency, and top speed.
const DIFFICULTY = {
    easy:   { aimNoise: 0.5,  chargeAt: 40, throwRange: 450, dashProb: 0.002, speedMul: 0.85 },
    normal: { aimNoise: 0.2,  chargeAt: 25, throwRange: 550, dashProb: 0.005, speedMul: 1 },
    hard:   { aimNoise: 0.08, chargeAt: 15, throwRange: 650, dashProb: 0.01,  speedMul: 1.1 }
};
// Extra hit radius (px) for a human's throws in single-player: hitting
// bots is slightly more forgiving. Bot throws and all multiplayer
// throws use the original radius.
const SINGLE_HIT_BONUS = 6;

function difficultyValid(d) {
    return (d === 'easy' || d === 'normal' || d === 'hard') ? d : 'normal';
}
function difficultyOf(match) {
    return DIFFICULTY[match.difficulty] || DIFFICULTY.normal;
}

// --- MATCH MODEL ---
const matches = new Map(); // id -> match
let matchCounter = 0;
let botCounter = 0;

// Same 60-obstacle generator as the original server (per match now).
function makeObstacles() {
    const obstacles = [];
    for (let i = 0; i < 60; i++) {
        const type = Math.random();
        obstacles.push({
            x: Math.random() * CONFIG.worldWidth,
            y: Math.random() * CONFIG.worldHeight,
            radius: type > 0.6 ? 30 : 20, // 30=Tree, 20=Rock/Snowman
            type: type > 0.6 ? 'tree' : (type > 0.3 ? 'rock' : 'snowman')
        });
    }
    return obstacles;
}

function createMatch(mode, blueCap, redCap, difficulty) {
    const id = `match-${Date.now().toString(36)}-${++matchCounter}`;
    const match = {
        id,
        mode,
        blueCap,
        redCap,
        difficulty: difficulty || 'normal',
        // Timed-match state: the clock starts once at least 2 players are
        // present; at 3 minutes the match ends and a winner is declared
        // from the freeze score (most freezes inflicted; tie = draw).
        score: { blue: 0, red: 0 },
        timerStarted: false,
        timerTicks: 0,
        ended: false,
        winner: null,
        players: {},
        snowballs: [],
        obstacles: makeObstacles(),
        // All match traffic is scoped to the room — never the global io.
        emit(event, data) { io.to(id).emit(event, data); },
        emitVolatile(event, data) { io.to(id).volatile.emit(event, data); }
    };
    matches.set(id, match);
    return match;
}

function countTeam(match, team) {
    return Object.values(match.players).filter(p => p.team === team).length;
}

function hasHumans(match) {
    return Object.values(match.players).some(p => !p.isBot);
}

// Earliest-created multi match with the same caps and an open slot.
function findMultiMatch(blueCap, redCap) {
    for (const match of matches.values()) {
        if (match.mode !== 'multi') continue;
        if (match.ended) continue;
        if (match.blueCap !== blueCap || match.redCap !== redCap) continue;
        if (countTeam(match, 'blue') < blueCap || countTeam(match, 'red') < redCap) return match;
    }
    return null;
}

// --- PLAYER CLASS ---
class ServerPlayer {
    constructor(id, team, isBot) {
        this.id = id;
        this.team = team;
        this.isBot = !!isBot;
        this.radius = 14;

        // Cosmetics (Synced so everyone sees the same)
        this.skinColor = ['#ffdbac', '#f1c27d', '#e0ac69', '#8d5524', '#c68642'][Math.floor(Math.random() * 5)];
        this.hatType = Math.floor(Math.random() * 4);

        // Spawn Logic
        const margin = 200;
        this.x = team === 'blue' ? margin : CONFIG.worldWidth - margin;
        this.y = Math.random() * (CONFIG.worldHeight - 200) + 100;

        // Physics
        this.vx = 0;
        this.vy = 0;

        // Game State
        this.isFrozen = false;
        this.hasBall = true;
        this.chargeLevel = 0;
        this.gatherProgress = 0;

        // Ability Timers
        this.dashTimer = 0;
        this.dashCooldownTimer = 0;

        // Inputs
        this.inputs = { moveX: 0, moveY: 0, angle: 0, dash: false, gather: false };
    }

    update(match) {
        if (this.isFrozen) return;

        // 1. Handle Dash
        if (this.dashCooldownTimer > 0) this.dashCooldownTimer--;

        if (this.inputs.dash && this.dashCooldownTimer === 0 && (this.inputs.moveX !== 0 || this.inputs.moveY !== 0)) {
            this.dashTimer = CONFIG.dashDuration;
            this.dashCooldownTimer = CONFIG.dashCooldown;
            const angle = Math.atan2(this.inputs.moveY, this.inputs.moveX);
            this.vx = Math.cos(angle) * CONFIG.dashSpeed;
            this.vy = Math.sin(angle) * CONFIG.dashSpeed;
            // Notify clients to play sound/effect (match room only)
            match.emit('effect', { type: 'dash', x: this.x, y: this.y, id: this.id });
        }

        // 2. Handle Movement
        if (this.dashTimer > 0) {
            this.dashTimer--;
            // Dashing: No friction, high speed
        } else {
            // Normal Movement
            // If Gathering, move slower
            let accel = CONFIG.acceleration;
            if (this.inputs.gather && !this.hasBall) {
                accel *= 0.5;
                this.vx *= 0.8;
                this.vy *= 0.8;
                this.gatherProgress++;
                if (this.gatherProgress >= CONFIG.gatherTime) {
                    this.hasBall = true;
                    this.gatherProgress = 0;
                    match.emit('effect', { type: 'reload', x: this.x, y: this.y, id: this.id });
                }
            } else {
                this.gatherProgress = 0;
            }

            this.vx += this.inputs.moveX * accel;
            this.vy += this.inputs.moveY * accel;
            this.vx *= CONFIG.friction;
            this.vy *= CONFIG.friction;

            // Cap Speed (bots scale by difficulty; humans use CONFIG.maxSpeed).
            const speed = Math.hypot(this.vx, this.vy);
            const cap = this.isBot ? CONFIG.maxSpeed * difficultyOf(match).speedMul : CONFIG.maxSpeed;
            if (speed > cap) {
                this.vx = (this.vx / speed) * cap;
                this.vy = (this.vy / speed) * cap;
            }
        }

        this.x += this.vx;
        this.y += this.vy;

        // 3. World Bounds
        if (this.x < 0) this.x = 0;
        if (this.x > CONFIG.worldWidth) this.x = CONFIG.worldWidth;
        if (this.y < 0) this.y = 0;
        if (this.y > CONFIG.worldHeight) this.y = CONFIG.worldHeight;

        // 4. Obstacle Collision
        match.obstacles.forEach(obs => {
            const dx = this.x - obs.x;
            const dy = this.y - obs.y;
            const dist = Math.hypot(dx, dy);
            const minDist = this.radius + obs.radius;

            if (dist < minDist) {
                const angle = Math.atan2(dy, dx);
                const push = minDist - dist;
                this.x += Math.cos(angle) * push;
                this.y += Math.sin(angle) * push;
                this.vx *= 0.8;
                this.vy *= 0.8;
            }
        });
    }
}

// --- SNOWBALL CLASS (unchanged) ---
class ServerSnowball {
    constructor(x, y, angle, speed, ownerId, team, charge) {
        this.x = x;
        this.y = y;
        this.vx = Math.cos(angle) * speed;
        this.vy = Math.sin(angle) * speed;
        this.z = 14;
        this.vz = 3.1; // Higher lob than the original 2.0; paired with the
                       // stronger gravity below, the peak rises to ~36px
                       // (was ~28px) with the same ~0.55s flight time.
        this.ownerId = ownerId;
        this.team = team;
        this.active = true;
        this.radius = 6 + (charge / 20);
    }

    update() {
        this.x += this.vx;
        this.y += this.vy;
        this.z += this.vz;
        this.vz -= 0.22; // Gravity (was 0.15; raised to keep flight time flat)

        if (this.z < 0) this.active = false; // Hit ground

        if (this.x < 0 || this.x > CONFIG.worldWidth || this.y < 0 || this.y > CONFIG.worldHeight) {
            this.active = false;
        }
    }
}

// --- BOT AI ---
// Runs once per tick per bot, before player updates. Reuses the same physics
// and charge/release mechanics as human players. Behavior scales with the
// match's difficulty (normal reproduces the original bot exactly).
function computeBotInput(bot, match) {
    const diff = difficultyOf(match);
    if (bot.isFrozen) {
        bot.inputs.moveX = 0; bot.inputs.moveY = 0;
        bot.inputs.dash = false; bot.inputs.gather = false;
        bot.chargeLevel = 0;
        return;
    }

    // Nearest unfrozen enemy.
    let target = null, best = Infinity;
    for (const id in match.players) {
        const p = match.players[id];
        if (p.team === bot.team || p.isFrozen) continue;
        const d = Math.hypot(p.x - bot.x, p.y - bot.y);
        if (d < best) { best = d; target = p; }
    }
    if (!target) {
        bot.inputs.moveX = 0; bot.inputs.moveY = 0;
        bot.inputs.dash = false; bot.inputs.gather = false;
        return;
    }

    const dx = target.x - bot.x, dy = target.y - bot.y;
    const dist = Math.hypot(dx, dy) || 1;
    const nx = dx / dist, ny = dy / dist;

    if (!bot.hasBall) {
        // Gather (drift toward the enemy while gathering).
        bot.inputs.moveX = nx; bot.inputs.moveY = ny;
        bot.inputs.gather = true;
        bot.inputs.angle = Math.atan2(ny, nx);
        bot.inputs.dash = false;
        return;
    }

    bot.inputs.gather = false;
    bot.inputs.angle = Math.atan2(dy, dx) + (Math.random() - 0.5) * diff.aimNoise;
    if (dist <= diff.throwRange) {
        // In range: hold still and charge. Release is handled in tickMatch
        // once chargeLevel reaches the difficulty's chargeAt ticks.
        bot.inputs.moveX = 0; bot.inputs.moveY = 0;
        if (bot.chargeLevel === 0) bot.chargeLevel = 1;
        bot.inputs.dash = false;
    } else {
        // Out of range: chase, and cancel any partial charge.
        bot.inputs.moveX = nx; bot.inputs.moveY = ny;
        bot.chargeLevel = 0;
        bot.inputs.dash = Math.random() < diff.dashProb; // occasional dash while moving
    }
}

// --- MATCH END ---
// Info broadcast with every state packet (old clients ignore the extra
// field). timeLeft is null until the clock starts.
function matchStateInfo(match) {
    return {
        timeLeft: match.timerStarted
            ? Math.max(0, Math.ceil((MATCH_DURATION_TICKS - match.timerTicks) / 60))
            : null,
        score: match.score,
        ended: match.ended,
        winner: match.winner
    };
}

function broadcastState(match) {
    match.emitVolatile('state', {
        players: match.players,
        snowballs: match.snowballs,
        match: matchStateInfo(match)
    });
}

function endMatch(match) {
    match.ended = true;
    match.snowballs = [];
    match.winner = match.score.blue > match.score.red ? 'blue'
        : match.score.red > match.score.blue ? 'red' : 'draw';
    match.emit('matchEnd', { winner: match.winner, score: match.score });
}

// --- MATCH TICK ---
function tickMatch(match) {
    // Ended matches freeze: no more AI, movement, or snowballs — just
    // keep broadcasting state so clients hold the final scene.
    if (match.ended) {
        broadcastState(match);
        return;
    }

    // Match clock: starts once at least 2 players are present.
    if (!match.timerStarted && Object.keys(match.players).length >= 2) {
        match.timerStarted = true;
    }
    if (match.timerStarted) {
        match.timerTicks++;
        if (match.timerTicks >= MATCH_DURATION_TICKS) {
            endMatch(match);
            broadcastState(match);
            return;
        }
    }

    // 1. Bot AI + bot throw releases (charge reaches difficulty's chargeAt).
    for (const id in match.players) {
        const p = match.players[id];
        if (!p.isBot) continue;
        computeBotInput(p, match);
        if (p.hasBall && !p.isFrozen && p.chargeLevel >= difficultyOf(match).chargeAt) {
            const speed = CONFIG.ballSpeed + (p.chargeLevel / 5);
            match.snowballs.push(new ServerSnowball(
                p.x, p.y, p.inputs.angle, speed, p.id, p.team, p.chargeLevel
            ));
            p.hasBall = false;
            p.chargeLevel = 0;
            match.emit('effect', { type: 'throw', x: p.x, y: p.y });
        }
    }

    // 2. Charge increment + player updates (same as the original loop).
    for (const id in match.players) {
        const p = match.players[id];
        if (p.chargeLevel > 0 && p.chargeLevel < 60) p.chargeLevel++;
        p.update(match);
    }

    // 3. Update Snowballs
    match.snowballs.forEach(ball => {
        ball.update();

        // Check Collisions
        for (const id in match.players) {
            const p = match.players[id];
            if (ball.ownerId === p.id || ball.team === p.team || p.isFrozen) continue;

            const dist = Math.hypot(ball.x - p.x, ball.y - p.y);
            // Single-player: a human's throws get a slightly bigger hit
            // area (easier to hit bots). Bot throws and all multiplayer
            // throws use the original radius.
            const owner = match.players[ball.ownerId];
            const bonus = (match.mode === 'single' && owner && !owner.isBot) ? SINGLE_HIT_BONUS : 0;
            if (dist < p.radius + ball.radius + bonus) {
                ball.active = false;
                p.isFrozen = true;
                // Team score: freezes inflicted by this team.
                if (ball.team === 'blue' || ball.team === 'red') match.score[ball.team]++;
                match.emit('hit', { x: p.x, y: p.y, id: p.id });

                // Auto-thaw after 5 seconds (only if the match still exists).
                setTimeout(() => {
                    if (matches.get(match.id) === match && match.players[id]) {
                        match.players[id].isFrozen = false;
                    }
                }, 5000);
            }
        }

        match.obstacles.forEach(obs => {
            if (ball.active && Math.hypot(ball.x - obs.x, ball.y - obs.y) < obs.radius + ball.radius) {
                ball.active = false;
                match.emit('effect', { type: 'obs_hit', x: ball.x, y: ball.y });
            }
        });
    });

    match.snowballs = match.snowballs.filter(b => b.active);

    // 4. Broadcast State (match room only).
    broadcastState(match);
}

// --- SERVER LOOP (60 TPS, iterates all matches) ---
setInterval(() => {
    for (const match of matches.values()) tickMatch(match);
}, 1000 / 60);

// --- MATCH MEMBERSHIP HELPERS ---
function addBot(match, team) {
    const id = `bot-${match.id}-${++botCounter}`;
    match.players[id] = new ServerPlayer(id, team, true);
    return match.players[id];
}

function leaveMatch(socket) {
    const matchId = socket.data && socket.data.matchId;
    if (!matchId) return;
    const match = matches.get(matchId);
    socket.leave(matchId);
    socket.data.matchId = null;
    if (match) {
        delete match.players[socket.id];
        // No humans left: delete the whole match (bots go with it).
        if (!hasHumans(match)) matches.delete(matchId);
    }
}

// --- CONNECTION HANDLING ---
// NOTE: unlike the original server, connecting does NOT create a player.
// The client must send 'join' {mode, blue, red} first.
io.on('connection', (socket) => {
    console.log('Client connected:', socket.id);

    socket.on('join', (data) => {
        const mode = data && data.mode;
        const blue = Number(data && data.blue);
        const red = Number(data && data.red);
        // Bot difficulty: single-player only; anything else defaults to
        // normal (multiplayer has no bots, so it is ignored there).
        const difficulty = difficultyValid(data && data.difficulty);

        if ((mode !== 'single' && mode !== 'multi') || !sizeAllowed(mode, blue, red)) {
            socket.emit('joinError', { message: 'Invalid mode or match size.' });
            return;
        }

        // Re-joining: leave any previous match first.
        leaveMatch(socket);

        let match;
        if (mode === 'single') {
            // Human on blue; bots fill every remaining slot on both teams.
            match = createMatch('single', blue, red, difficulty);
            match.players[socket.id] = new ServerPlayer(socket.id, 'blue', false);
            for (let i = 0; i < blue - 1; i++) addBot(match, 'blue');
            for (let i = 0; i < red; i++) addBot(match, 'red');
        } else {
            // Multiplayer: humans only, never bots. Join the earliest match
            // with the same caps and an open slot; otherwise create one.
            match = findMultiMatch(blue, red);
            if (!match) {
                match = createMatch('multi', blue, red);
            }
            const blues = countTeam(match, 'blue');
            const reds = countTeam(match, 'red');
            let team;
            if (blues <= reds && blues < blue) team = 'blue';
            else if (reds < red) team = 'red';
            else {
                // Both teams full (should not happen via findMultiMatch):
                // start a fresh match rather than overfilling.
                match = createMatch('multi', blue, red);
                team = 'blue';
            }
            match.players[socket.id] = new ServerPlayer(socket.id, team, false);
        }

        socket.join(match.id);
        socket.data.matchId = match.id;
        console.log(`Player ${socket.id} joined ${match.id} (${mode} ${blue}v${red} ${match.difficulty})`);

        // Send Init Data (after join, not on connect).
        socket.emit('init', {
            id: socket.id,
            width: CONFIG.worldWidth,
            height: CONFIG.worldHeight,
            obstacles: match.obstacles,
            team: match.players[socket.id].team,
            match: { mode: match.mode, blueCap: match.blueCap, redCap: match.redCap, difficulty: match.difficulty }
        });
    });

    // Handle Input (scoped to the sender's match).
    socket.on('input', (data) => {
        const matchId = socket.data && socket.data.matchId;
        const match = matchId && matches.get(matchId);
        const p = match && match.players[socket.id];
        if (!p) return;

        p.inputs.moveX = data.moveX;
        p.inputs.moveY = data.moveY;
        p.inputs.dash = data.dash;
        p.inputs.gather = data.gather;
        p.inputs.angle = data.angle;

        // Charge
        if (data.throwStart && p.hasBall && !p.isFrozen) {
            p.chargeLevel = 1;
        }

        // Release Throw
        if (data.throwRelease && p.hasBall && !p.isFrozen) {
            const speed = CONFIG.ballSpeed + (p.chargeLevel / 5);
            match.snowballs.push(new ServerSnowball(
                p.x, p.y, data.angle, speed, p.id, p.team, p.chargeLevel
            ));

            p.hasBall = false;
            p.chargeLevel = 0;
            match.emit('effect', { type: 'throw', x: p.x, y: p.y });
        }
    });

    socket.on('disconnect', () => {
        leaveMatch(socket);
        console.log('Client disconnected:', socket.id);
    });
});

const PORT = process.env.PORT || 3000;
http.listen(PORT, () => {
    console.log(`Snowbrawl Server running on port ${PORT}`);
});
