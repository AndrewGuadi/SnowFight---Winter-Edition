const express = require('express');
const path = require('path');
const { sanitizeInput, segmentHit } = require('./gameplay');
const { CLASSES, classId, shotPattern, canBuild } = require('./classes');
const {makeNeighborhood,PARENT} = require('./neighborhood');
const {MISSIONS,AGGRESSION,aggressionId,missionProgress}=require('./missions');
const { publicPlayer, publicSnowball } = require('./snapshot');
const app = express();
app.use('/assets', express.static(path.join(__dirname, '..', 'assets')));
app.get('/', (_req, res) => res.sendFile(path.join(__dirname, '..', 'index.html')));
app.get('/health', (_req, res) => res.json({ ok: true, simulationHz: 60, snapshotHz: 30 }));
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
// 90 seconds at 60 TPS: a quick brawl, not a slog. Overridable via env
// for tests.
const MATCH_DURATION_TICKS = Number(process.env.MATCH_DURATION_TICKS) || 5400;

// --- CENTER HILL (the one objective) ---
// A circle at the middle of the field. The team with strictly more
// alive, unfrozen players inside it holds the hill and banks 1 hill
// point per second of holding. Most hill points at the buzzer wins;
// on a hill tie the freeze score decides, then sudden-death overtime.
const HILL_RADIUS = 260;
const HILL_CENTER_X = CONFIG.worldWidth / 2;
const HILL_CENTER_Y = CONFIG.worldHeight / 2;

// --- SUDDEN-DEATH OVERTIME ---
// A tie at the buzzer does not end in a draw: overtime starts and the
// next freeze wins at once. Capped (then it is a draw), so a match can
// never run forever. Overridable via env for tests.
const OVERTIME_CAP_TICKS = Number(process.env.OVERTIME_CAP_TICKS) || 3600;

// --- BOT DIFFICULTY LEVELS (single-player only) ---
// Easy/Hard tune aim noise, charge time, throw range, dash frequency,
// and top speed. At every difficulty, bots out of throw range steer for
// the center hill (see computeBotInput) so the hill objective stays
// live in single-player. Normal is the friendly default (softened Oct 29,
// 2026, after playtesting found base bots too hard): slower wind-up,
// looser aim, shorter reach, and slightly slower than a human, so a new
// player can dodge, outrun, and outplay them. Hard keeps the original edge.
const DIFFICULTY = {
    easy:   { aimNoise: 0.9,  chargeAt: 50, throwRange: 370, dashProb: 0.001, speedMul: 0.72 },
    normal: { aimNoise: 0.5, chargeAt: 40, throwRange: 470, dashProb: 0.002, speedMul: 0.9 },
    hard:   { aimNoise: 0.08, chargeAt: 15, throwRange: 650, dashProb: 0.01,  speedMul: 1.1 }
};
// Extra hit radius (px) for a human's throws in single-player: hitting
// bots is slightly more forgiving. Bot throws and all multiplayer
// throws use the original radius.
const SINGLE_HIT_BONUS = 6;

function difficultyValid(d) {
    return (d === 'easy' || d === 'normal' || d === 'hard') ? d : 'normal';
}

// Private-room code for multiplayer: friends who enter the same code
// land in the same match. Normalized to 1-8 uppercase alphanumerics;
// anything else (empty, symbols-only) means "open match". Single-player
// ignores room codes entirely.
function sanitizeRoomCode(raw) {
    if (raw === null || raw === undefined) return null;
    const code = String(raw).toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);
    return code.length > 0 ? code : null;
}
function difficultyOf(match) {
    return DIFFICULTY[match.difficulty] || DIFFICULTY.normal;
}

// --- MATCH MODEL ---
const matches = new Map(); // id -> match
let matchCounter = 0;
let botCounter = 0;

function createMatch(mode, blueCap, redCap, difficulty, roomCode) {
    const id = `match-${Date.now().toString(36)}-${++matchCounter}`;
    const match = {
        id,
        mode,
        blueCap,
        redCap,
        difficulty: difficulty || 'normal',
        aggression: 'balanced',
        mission: null,
        // Private-room code (multiplayer only); null = open match that
        // any player with the same caps can join.
        roomCode: mode === 'multi' ? (sanitizeRoomCode(roomCode) || null) : null,
        // Timed-match state: the clock starts once at least 2 players are
        // present; at 90 seconds the match ends and a winner is declared
        // from the hill score first (most hill points banked), then the
        // freeze score. A full tie at the buzzer starts sudden-death
        // overtime instead: the next freeze wins, capped at
        // OVERTIME_CAP_TICKS (then it is a draw).
        score: { blue: 0, red: 0 },
        hill: { blue: 0, red: 0 },
        hillHolder: null,
        hillSecondTicks: 0,
        timerStarted: false,
        timerTicks: 0,
        overtime: false,
        overtimeTicks: 0,
        tick: 0,
        ended: false,
        winner: null,
        players: {},
        snowballs: [],
        structures: [],
        structureSerial: 0,
        classRoster: false,
        obstacles: makeNeighborhood(),
        parentReactionUntil: 0,
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
        if (match.roomCode) continue; // private rooms are found by code, not by chance
        if (match.blueCap !== blueCap || match.redCap !== redCap) continue;
        if (countTeam(match, 'blue') < blueCap || countTeam(match, 'red') < redCap) return match;
    }
    return null;
}

// A live private room is identified by its code. Its creator determines
// team sizes; joining clients inherit those settings. Ended rooms are
// excluded, so their codes can be used for a new match.
function findRoomMatch(roomCode) {
    for (const match of matches.values()) {
        if (match.mode !== 'multi') continue;
        if (match.ended) continue;
        if (match.roomCode !== roomCode) continue;
        return match;
    }
    return null;
}

function roomHasOpenSlot(match) {
    return countTeam(match, 'blue') < match.blueCap || countTeam(match, 'red') < match.redCap;
}

// --- PLAYER CLASS ---
class ServerPlayer {
    constructor(id, team, isBot, recruit = 'classic') {
        this.id = id;
        this.team = team;
        this.isBot = !!isBot;
        this.classId = classId(recruit);
        this.radius = CLASSES[this.classId].radius;
        this.abilityCooldown = 0;
        this.guardTicks = 0;

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
        this.freezeTicks = 0;
        this.stats = { throws: 0, freezes: 0, dashes: 0, rescues: 0 };
        this.lastInputAt = Date.now();
        this.lastInputSeq = 0;
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
        if (this.abilityCooldown > 0) this.abilityCooldown--;
        if (this.guardTicks > 0) this.guardTicks--;
        if (!this.isBot && Date.now() - this.lastInputAt > 500) {
            this.inputs.moveX = this.inputs.moveY = 0;
            this.inputs.dash = this.inputs.gather = false;
            this.chargeLevel = 0;
        }
        if (this.isFrozen) {
            this.inputs.dash = false;
            if (--this.freezeTicks <= 0) this.isFrozen = false;
            return;
        }

        // 1. Handle Dash
        if (this.dashCooldownTimer > 0) this.dashCooldownTimer--;

        if (this.inputs.dash && this.dashCooldownTimer === 0 && (this.inputs.moveX !== 0 || this.inputs.moveY !== 0)) {
            this.stats.dashes++;
            this.dashTimer = CONFIG.dashDuration;
            this.dashCooldownTimer = CONFIG.dashCooldown;
            const angle = Math.atan2(this.inputs.moveY, this.inputs.moveX);
            this.vx = Math.cos(angle) * CONFIG.dashSpeed * CLASSES[this.classId].speed;
            this.vy = Math.sin(angle) * CONFIG.dashSpeed * CLASSES[this.classId].speed;
            // Notify clients to play sound/effect (match room only)
            match.emit('effect', { type: 'dash', x: this.x, y: this.y, id: this.id });
        }

        this.inputs.dash = false; // consume an edge once, even between snapshots

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
                if (this.gatherProgress >= CLASSES[this.classId].gather) {
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
            const cap = CONFIG.maxSpeed * CLASSES[this.classId].speed * (this.isBot ? difficultyOf(match).speedMul : 1);
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
        [...match.obstacles, ...match.structures].forEach(obs => {
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

// All attacks and abilities use the same authoritative path for humans and bots.
function fireSnowball(p, match, cannon=false) {
    if (match.ended || p.isFrozen || !p.hasBall) return false;
    for (const shot of shotPattern(p.classId,p.chargeLevel,cannon)) {
        const ball=new ServerSnowball(p.x,p.y,p.inputs.angle+shot.angle,shot.speed,p.id,p.team,p.chargeLevel);
        ball.radius=shot.radius; ball.kind=shot.kind;
        match.snowballs.push(ball);
    }
    if(p.isBot) p.nextAttackTick=match.tick+CLASSES[p.classId].gather+AGGRESSION[match.aggression].pause;
    p.stats.throws++; p.hasBall=false; p.chargeLevel=0;
    match.emit('effect',{type:cannon?'cannon':'throw',x:p.x,y:p.y,id:p.id});
    return true;
}
function useAbility(p,match) {
    if (match.ended || p.isFrozen || p.abilityCooldown>0 || p.classId==='classic') return false;
    if (p.classId==='glacier') {
        p.guardTicks=120; // one absorbed hit, or expires after two seconds
    } else if (p.classId==='snowbug') {
        if (!fireSnowball(p,match,true)) return false;
    } else {
        const x=p.x+Math.cos(p.inputs.angle)*90, y=p.y+Math.sin(p.inputs.angle)*90;
        if (match.structures.length>=20 || match.structures.some(o=>o.ownerId===p.id) ||
            !canBuild(x,y,CONFIG,[...match.obstacles,...match.structures],match.players)) return false;
        match.structures.push({id:++match.structureSerial,ownerId:p.id,team:p.team,x,y,radius:38,hp:3,life:480,type:'igloo'});
    }
    p.abilityCooldown=CLASSES[p.classId].cooldown;
    match.emit('effect',{type:p.classId==='glacier'?'guard':p.classId==='frostweaver'?'build':'ability',x:p.x,y:p.y,id:p.id});
    return true;
}

// --- BOT AI ---
// Runs once per tick per bot, before player updates. Reuses the same physics
// and charge/release mechanics as human players. Behavior scales with the
// match's difficulty (see DIFFICULTY; hard is the sharpest).
function computeBotInput(bot, match) {
    const diff = difficultyOf(match);
    const temperament=AGGRESSION[match.aggression];
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

    if (temperament.abilities && match.classRoster && best < 550 && match.tick % 45 === 0) useAbility(bot,match);

    // Hill contest (single-player only; bots never exist in multiplayer):
    // during regulation, when the nearest enemy is out of throw range
    // and this bot's team has not banked a hill point yet, contest the
    // hill instead of chasing the enemy. Otherwise the 90-second hill
    // objective stays hollow in the default one-tap PLAY mode: a bot
    // that only chases the human never banks a hill point when the
    // human avoids the hill. Two qualifiers keep this from stalling
    // the game: it never applies in sudden-death overtime (where only
    // a freeze matters, and hill points do not bank), and once the team
    // is on the board the bot hunts normally again — it banks, then
    // closes in and fights, rather than parking on the hill forever
    // while an idle human stands far away. On the hill the bot holds
    // still instead of chasing, so it cannot dither on the hill edge
    // between steering in and chasing out. Once the enemy closes in,
    // normal combat behavior below resumes either way.
    if (!match.overtime && best > diff.throwRange && match.hill[bot.team] === 0) {
        const hx = HILL_CENTER_X - bot.x, hy = HILL_CENTER_Y - bot.y;
        const hdist = Math.hypot(hx, hy) || 1;
        if (hdist > HILL_RADIUS) {
            bot.inputs.moveX = hx / hdist;
            bot.inputs.moveY = hy / hdist;
        } else {
            bot.inputs.moveX = 0;
            bot.inputs.moveY = 0;
        }
        bot.inputs.gather = !bot.hasBall;
        bot.inputs.angle = Math.atan2(hy, hx);
        bot.inputs.dash = false;
        bot.chargeLevel = 0;
        return;
    }

    if (!bot.hasBall) {
        // Gather (drift toward the enemy while gathering).
        bot.inputs.moveX = nx*temperament.chase; bot.inputs.moveY = ny*temperament.chase;
        bot.inputs.gather = true;
        bot.inputs.angle = Math.atan2(ny, nx);
        bot.inputs.dash = false;
        return;
    }

    bot.inputs.gather = false;
    bot.inputs.angle = Math.atan2(dy, dx) + (Math.random() - 0.5) * diff.aimNoise;
    if (dist <= diff.throwRange * (bot.classId==='frostweaver'?1.25:bot.classId==='glacier'?0.85:1)) {
        // In range: hold still and charge. Release is handled in tickMatch
        // once chargeLevel reaches the difficulty's chargeAt ticks.
        bot.inputs.moveX = 0; bot.inputs.moveY = 0;
        if (bot.chargeLevel === 0 && match.tick >= (bot.nextAttackTick||0)) bot.chargeLevel = 1;
        bot.inputs.dash = false;
    } else {
        // Out of range: chase, and cancel any partial charge.
        bot.inputs.moveX = nx*temperament.chase; bot.inputs.moveY = ny*temperament.chase;
        bot.chargeLevel = 0;
        bot.inputs.dash = temperament.chase===1 && Math.random() < diff.dashProb; // occasional dash while moving
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
        hill: match.hill,
        hillHolder: match.hillHolder,
        overtime: match.overtime,
        ended: match.ended,
        winner: match.winner,
        mission: missionProgress(match),
        aggression: match.aggression
    };
}

function broadcastState(match) {
    const players = {};
    for (const id in match.players) players[id] = publicPlayer(match.players[id]);
    match.emitVolatile('state', {
        players,
        snowballs: match.snowballs.map(publicSnowball),
        structures: match.structures,
        tick: match.tick,
        serverTime: Date.now(),
        match: matchStateInfo(match)
    });
}

function endMatch(match, suddenDeath) {
    match.ended = true;
    match.snowballs = [];
    if (suddenDeath) {
        // Sudden death: the freeze that just landed decides it, whatever
        // the hill says.
        match.winner = match.score.blue > match.score.red ? 'blue'
            : match.score.red > match.score.blue ? 'red' : 'draw';
    } else {
        // Regulation / cap: most hill points wins; freeze score breaks
        // a hill tie; a full tie is a draw (or overtime, decided by the
        // caller at the buzzer).
        match.winner = match.hill.blue > match.hill.red ? 'blue'
            : match.hill.red > match.hill.blue ? 'red'
            : match.score.blue > match.score.red ? 'blue'
            : match.score.red > match.score.blue ? 'red' : 'draw';
    }
    if(match.mission) {const spec=MISSIONS[match.mission];if(spec.metric!=='win') match.winner=(spec.metric==='hill'?match.hill.blue:match.score.blue)>=spec.target?'blue':'red';else if(match.winner==='draw')match.winner='red';}
    match.emit('matchEnd', { winner: match.winner, score: match.score, hill: match.hill });
}

// --- MATCH TICK ---
function tickMatch(match) {
    match.tick++;
    // Ended matches freeze: no more AI, movement, or snowballs — just
    // keep broadcasting state so clients hold the final scene.
    if (match.ended) {
        if (match.tick % 30 === 0) broadcastState(match);
        return;
    }

    // Match clock: starts once at least 2 players are present.
    if (!match.timerStarted && Object.keys(match.players).length >= 2) {
        match.timerStarted = true;
    }
    if (match.timerStarted) {
        if (!match.overtime) {
            match.timerTicks++;
            if (match.timerTicks >= MATCH_DURATION_TICKS) {
                if(match.mission) {endMatch(match);broadcastState(match);return;}
                const hillTied = match.hill.blue === match.hill.red;
                const scoreTied = match.score.blue === match.score.red;
                if (hillTied && scoreTied) {
                    // Full tie at the buzzer: sudden death, not a draw.
                    // The tick continues below so play resumes at once.
                    match.overtime = true;
                    match.overtimeTicks = 0;
                } else {
                    endMatch(match);
                    broadcastState(match);
                    return;
                }
            }
        } else {
            match.overtimeTicks++;
            if (match.overtimeTicks >= OVERTIME_CAP_TICKS) {
                endMatch(match);
                broadcastState(match);
                return;
            }
        }
    }

    // Center-hill scoring (regulation only): the team with strictly more
    // alive, unfrozen players inside the hill banks a point per second.
    if (match.timerStarted && !match.overtime) {
        let blueIn = 0, redIn = 0;
        for (const id in match.players) {
            const p = match.players[id];
            if (p.isFrozen) continue;
            if (Math.hypot(p.x - HILL_CENTER_X, p.y - HILL_CENTER_Y) <= HILL_RADIUS) {
                if (p.team === 'blue') blueIn++;
                else redIn++;
            }
        }
        const holder = blueIn > redIn ? 'blue' : redIn > blueIn ? 'red' : null;
        if (holder !== match.hillHolder) match.hillSecondTicks = 0;
        match.hillHolder = holder;
        if (holder) {
            if (++match.hillSecondTicks >= 60) {
                match.hill[holder]++;
                match.hillSecondTicks = 0;
            }
        } else {
            match.hillSecondTicks = 0;
        }
    }

    match.structures = match.structures.filter(o => --o.life > 0 && o.hp > 0);

    // 1. Bot AI + bot throw releases (charge reaches difficulty's chargeAt).
    for (const id in match.players) {
        const p = match.players[id];
        if (!p.isBot) continue;
        computeBotInput(p, match);
        if (p.hasBall && !p.isFrozen && p.chargeLevel >= difficultyOf(match).chargeAt) {
            fireSnowball(p,match);
        }
    }

    // 2. Charge increment + player updates (same as the original loop).
    for (const id in match.players) {
        const p = match.players[id];
        if (p.chargeLevel > 0 && p.chargeLevel < 60) p.chargeLevel++;
        p.update(match);
    }

    // 2b. Teammate rescue: an unfrozen player touching a frozen teammate
    // thaws them at once (no waiting out the 5s freeze). This is the
    // teamplay hook: staying near a frozen teammate, or running to them,
    // brings them straight back into the fight. Score is untouched —
    // the freeze already counted when it landed.
    for (const id in match.players) {
        const r = match.players[id];
        if (r.isFrozen) continue;
        for (const oid in match.players) {
            const p = match.players[oid];
            if (p === r || p.team !== r.team || !p.isFrozen) continue;
            if (Math.hypot(p.x - r.x, p.y - r.y) < r.radius + p.radius) {
                p.isFrozen = false;
                p.freezeTicks = 0;
                p.chargeLevel = 0;
                r.stats.rescues++;
                match.emit('effect', { type: 'thaw', x: p.x, y: p.y, id: p.id, rescuerId: r.id });
                break;
            }
        }
    }

    // 3. Update Snowballs
    match.snowballs.forEach(ball => {
        const fromX = ball.x, fromY = ball.y;
        // A sudden-death freeze ends the match mid-tick: later balls in
        // this tick must not score or hit anyone afterwards.
        if (match.ended) return;
        ball.update();
        if (!ball.active) return;
        // Resolve the first impact along the flight segment, including cover.
        let impact = null, first = Infinity;
        for (const obs of [...match.obstacles,...match.structures]) {
            if (obs.hp !== undefined && obs.hp <= 0) continue;
            const t = segmentHit(fromX, fromY, ball.x, ball.y, obs.x, obs.y, obs.radius + ball.radius);
            if (t !== null && t < first) { first = t; impact = { obstacle: obs }; }
        }

        // Check Collisions
        for (const id in match.players) {
            const p = match.players[id];
            if (ball.ownerId === p.id || ball.team === p.team || p.isFrozen || match.ended) continue;

            const owner = match.players[ball.ownerId];
            const bonus = (match.mode === 'single' && owner && !owner.isBot) ? SINGLE_HIT_BONUS : 0;
            const t = segmentHit(fromX, fromY, ball.x, ball.y, p.x, p.y, p.radius + ball.radius + bonus);
            if (t !== null && t < first) { first = t; impact = { player: p }; }
        }
        // The parent is a nonblocking character: a nearby throw triggers a
        // room-scoped reaction but never changes collision, score or physics.
        const parentT=segmentHit(fromX,fromY,ball.x,ball.y,PARENT.x,PARENT.y,PARENT.radius+ball.radius);
        if(parentT!==null && parentT<=first && match.tick>=match.parentReactionUntil) {
            match.parentReactionUntil=match.tick+180;
            match.emit('effect',{type:'parent_react',x:PARENT.x,y:PARENT.y});
        }
        if (impact) {
            ball.active = false;
            if (impact.player) {
                const p = impact.player;
                if (p.guardTicks>0) {
                    p.guardTicks=0;
                    match.emit('effect',{type:'guard_hit',x:p.x,y:p.y,id:p.id});
                    return;
                }
                p.isFrozen = true;
                p.freezeTicks = 300;
                p.chargeLevel = 0;
                p.vx = p.vy = 0;
                p.inputs.dash = false;
                match.score[ball.team]++;
                const owner = match.players[ball.ownerId];
                if (owner) owner.stats.freezes++;
                match.emit('hit', { x: p.x, y: p.y, id: p.id, ownerId: ball.ownerId });
                // Sudden death: the first freeze in overtime wins at once
                // (the score just moved, so the sudden-death endMatch
                // names that team, whatever the hill says).
                if (match.overtime) endMatch(match, true);
            } else {
                if (impact.obstacle.hp !== undefined) {
                    impact.obstacle.hp--;
                    if (impact.obstacle.hp<=0) match.emit('effect',{type:'shatter',x:impact.obstacle.x,y:impact.obstacle.y});
                }
                match.emit('effect', { type: 'obs_hit', x: fromX + (ball.x-fromX)*first, y: fromY + (ball.y-fromY)*first });
            }
        }
    });

    match.structures = match.structures.filter(o=>o.hp>0);
    match.snowballs = match.snowballs.filter(b => b.active);

    if(match.mission && !match.ended) {const goal=missionProgress(match);if(goal.metric!=='win' && goal.progress>=goal.target)endMatch(match);}

    // 4. Broadcast State (match room only).
    if (match.tick % 2 === 0) broadcastState(match);
}

// --- SERVER LOOP (60 TPS, iterates all matches) ---


// --- MATCH MEMBERSHIP HELPERS ---
function addBot(match, team) {
    const id = `bot-${match.id}-${++botCounter}`;
    match.players[id] = new ServerPlayer(id, team, true, match.classRoster ? ['glacier','snowbug','frostweaver'][botCounter % 3] : 'classic');
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
        match.structures = match.structures.filter(o=>o.ownerId!==socket.id);
        // No humans left: delete the whole match (bots go with it).
        if (!hasHumans(match)) matches.delete(matchId);
    }
}

// --- CONNECTION HANDLING ---
// NOTE: unlike the original server, connecting does NOT create a player.
// The client must send 'join' {mode, blue, red} first (multiplayer may
// also send an optional 'room' code to share a private match).
io.on('connection', (socket) => {
    console.log('Client connected:', socket.id);

    socket.on('latency', (ack) => { if (typeof ack === 'function') ack(); });

    socket.on('join', (data) => {
        const mode = data && data.mode;
        let blue = Number(data && data.blue);
        let red = Number(data && data.red);
        // Bot difficulty: single-player only; anything else defaults to
        // normal (multiplayer has no bots, so it is ignored there).
        let difficulty = difficultyValid(data && data.difficulty);
        const missionId = mode==='single' && data && data.mission;
        if(missionId && !Object.hasOwn(MISSIONS,missionId)){socket.emit('joinError',{message:'Unknown mission.'});return;}
        const spec=missionId?MISSIONS[missionId]:null;
        if(spec){blue=spec.blue;red=spec.red;difficulty=spec.difficulty;}
        const recruit = classId(data && data.classId);
        // Private-room code: multiplayer only; ignored in single-player.
        const room = mode === 'multi' ? sanitizeRoomCode(data && data.room) : null;

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
            match.mission=spec?spec.id:null;
            match.aggression=spec?spec.aggression:aggressionId(data && data.aggression);
            match.classRoster = recruit !== 'classic';
            match.players[socket.id] = new ServerPlayer(socket.id, 'blue', false, recruit);
            for (let i = 0; i < blue - 1; i++) addBot(match, 'blue');
            for (let i = 0; i < red; i++) addBot(match, 'red');
        } else if (room) {
            // Private room: friends with the same code share one match.
            // A full room rejects late joiners rather than silently
            // splitting them into a second match under the same code.
            match = findRoomMatch(room);
            if (match && !roomHasOpenSlot(match)) {
                socket.emit('joinError', { message: 'Room is full — try another code.' });
                return;
            }
            if (!match) {
                match = createMatch('multi', blue, red, undefined, room);
            }
        } else {
            // Multiplayer: humans only, never bots. Join the earliest
            // OPEN match with the same caps and an open slot; otherwise
            // create one. Private rooms are never joined by chance.
            match = findMultiMatch(blue, red);
            if (!match) {
                match = createMatch('multi', blue, red);
            }
        }
        if (mode === 'multi') {
            // Shared team assignment for open and private matches alike:
            // fill the emptier side first, never overfill a team.
            const blues = countTeam(match, 'blue');
            const reds = countTeam(match, 'red');
            let team;
            if (blues <= reds && blues < match.blueCap) team = 'blue';
            else if (reds < match.redCap) team = 'red';
            else {
                // Both teams full (should not happen: open matches are
                // only picked with a slot, rooms reject when full):
                // start a fresh open match rather than overfilling.
                match = createMatch('multi', blue, red);
                team = 'blue';
            }
            match.players[socket.id] = new ServerPlayer(socket.id, team, false, recruit);
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
            classId: recruit,
            classes: CLASSES,
            match: { mode: match.mode, blueCap: match.blueCap, redCap: match.redCap, difficulty: match.difficulty, mission: missionProgress(match), aggression: match.aggression, roomCode: match.roomCode || null }
        });
    });

    // Handle Input (scoped to the sender's match).
    socket.on('input', (data) => {
        const matchId = socket.data && socket.data.matchId;
        const match = matchId && matches.get(matchId);
        const p = match && match.players[socket.id];
        if (!p || match.ended) return;
        data = sanitizeInput(data);
        if (!data) return;
        // Sequence zero keeps older clients compatible. Sequenced packets are
        // idempotent: a delayed duplicate must not overwrite newer controls.
        if (data.seq > 0 && data.seq <= p.lastInputSeq) return;
        p.lastInputAt = Date.now();
        if (data.seq > 0) p.lastInputSeq = data.seq;

        p.inputs.moveX = data.moveX;
        p.inputs.moveY = data.moveY;
        p.inputs.dash = p.inputs.dash || data.dash;
        p.inputs.gather = data.gather;
        p.inputs.angle = data.angle;

        if (data.cancelCharge) p.chargeLevel = 0;

        if (data.ability) {
            if (!useAbility(p,match)) socket.emit('abilityDenied',{reason:p.isFrozen?'Frozen':p.abilityCooldown>0?'Recharging':p.classId==='snowbug'?'Pack a snowball first':'Find open ground ahead'});
        }

        // Charge
        if (data.throwStart && p.hasBall && !p.isFrozen && !p.chargeLevel) {
            p.chargeLevel = 1;
        }

        // Release Throw
        if (data.throwRelease && p.hasBall && !p.isFrozen) {
            fireSnowball(p,match);
        }
    });

    socket.on('disconnect', () => {
        leaveMatch(socket);
        console.log('Client disconnected:', socket.id);
    });
});

if (require.main === module) {
    setInterval(() => { for (const match of matches.values()) tickMatch(match); },1000/60);
    const PORT = process.env.PORT || 3000;
    http.listen(PORT, () => console.log(`Snowbrawl Server running on port ${PORT}`));
}
module.exports = { ServerPlayer, ServerSnowball, createMatch, tickMatch, fireSnowball, useAbility, matches };





