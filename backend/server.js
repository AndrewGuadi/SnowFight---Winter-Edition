const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http, {
    cors: { origin: "*" },
    pingInterval: 2000,
    pingTimeout: 5000
});

// --- GAME CONSTANTS ---
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

// --- SERVER STATE ---
const gameState = {
    players: {},
    snowballs: [],
    obstacles: []
};

// --- GENERATE MAP ---
// Generate a mix of trees, rocks, and snowmen
for (let i = 0; i < 60; i++) {
    const type = Math.random();
    gameState.obstacles.push({
        x: Math.random() * CONFIG.worldWidth,
        y: Math.random() * CONFIG.worldHeight,
        radius: type > 0.6 ? 30 : 20, // 30=Tree, 20=Rock/Snowman
        type: type > 0.6 ? 'tree' : (type > 0.3 ? 'rock' : 'snowman')
    });
}

// --- PLAYER CLASS ---
class ServerPlayer {
    constructor(id, team) {
        this.id = id;
        this.team = team;
        this.radius = 14;
        
        // Cosmetics (Synced so everyone sees the same)
        this.skinColor = ['#ffdbac', '#f1c27d', '#e0ac69', '#8d5524', '#c68642'][Math.floor(Math.random()*5)];
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

    update() {
        if (this.isFrozen) return;

        // 1. Handle Dash
        if (this.dashCooldownTimer > 0) this.dashCooldownTimer--;
        
        if (this.inputs.dash && this.dashCooldownTimer === 0 && (this.inputs.moveX !== 0 || this.inputs.moveY !== 0)) {
            this.dashTimer = CONFIG.dashDuration;
            this.dashCooldownTimer = CONFIG.dashCooldown;
            const angle = Math.atan2(this.inputs.moveY, this.inputs.moveX);
            this.vx = Math.cos(angle) * CONFIG.dashSpeed;
            this.vy = Math.sin(angle) * CONFIG.dashSpeed;
            // Notify clients to play sound/effect
            io.emit('effect', { type: 'dash', x: this.x, y: this.y, id: this.id });
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
                    io.emit('effect', { type: 'reload', x: this.x, y: this.y, id: this.id });
                }
            } else {
                this.gatherProgress = 0;
            }

            this.vx += this.inputs.moveX * accel;
            this.vy += this.inputs.moveY * accel;
            this.vx *= CONFIG.friction;
            this.vy *= CONFIG.friction;

            // Cap Speed
            const speed = Math.hypot(this.vx, this.vy);
            if (speed > CONFIG.maxSpeed) {
                this.vx = (this.vx / speed) * CONFIG.maxSpeed;
                this.vy = (this.vy / speed) * CONFIG.maxSpeed;
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
        gameState.obstacles.forEach(obs => {
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

// --- SNOWBALL CLASS ---
class ServerSnowball {
    constructor(x, y, angle, speed, ownerId, team, charge) {
        this.x = x;
        this.y = y;
        this.vx = Math.cos(angle) * speed;
        this.vy = Math.sin(angle) * speed;
        this.z = 14;
        this.vz = 2; 
        this.ownerId = ownerId;
        this.team = team;
        this.active = true;
        this.radius = 6 + (charge / 20);
    }

    update() {
        this.x += this.vx;
        this.y += this.vy;
        this.z += this.vz;
        this.vz -= 0.15; // Gravity

        if (this.z < 0) this.active = false; // Hit ground
        
        if (this.x < 0 || this.x > CONFIG.worldWidth || this.y < 0 || this.y > CONFIG.worldHeight) {
            this.active = false;
        }
    }
}

// --- CONNECTION HANDLING ---
io.on('connection', (socket) => {
    console.log('Player joined:', socket.id);

    // Auto Balance
    const playersArr = Object.values(gameState.players);
    const blues = playersArr.filter(p => p.team === 'blue').length;
    const reds = playersArr.filter(p => p.team === 'red').length;
    const team = blues <= reds ? 'blue' : 'red';

    // Create Player
    gameState.players[socket.id] = new ServerPlayer(socket.id, team);

    // Send Init Data
    socket.emit('init', {
        id: socket.id,
        width: CONFIG.worldWidth,
        height: CONFIG.worldHeight,
        obstacles: gameState.obstacles
    });

    // Handle Input
    socket.on('input', (data) => {
        const p = gameState.players[socket.id];
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
            gameState.snowballs.push(new ServerSnowball(
                p.x, p.y, data.angle, speed, p.id, p.team, p.chargeLevel
            ));
            
            p.hasBall = false;
            p.chargeLevel = 0;
            io.emit('effect', { type: 'throw', x: p.x, y: p.y });
        }
    });

    socket.on('disconnect', () => {
        delete gameState.players[socket.id];
    });
});

// --- SERVER LOOP (60 TPS) ---
setInterval(() => {
    // 1. Update Players
    for (const id in gameState.players) {
        const p = gameState.players[id];
        if (p.chargeLevel > 0 && p.chargeLevel < 60) p.chargeLevel++;
        p.update();
    }

    // 2. Update Snowballs
    gameState.snowballs.forEach(ball => {
        ball.update();

        // Check Collisions
        for (const id in gameState.players) {
            const p = gameState.players[id];
            if (ball.ownerId === p.id || ball.team === p.team || p.isFrozen) continue;

            const dist = Math.hypot(ball.x - p.x, ball.y - p.y);
            if (dist < p.radius + ball.radius) {
                ball.active = false;
                p.isFrozen = true;
                io.emit('hit', { x: p.x, y: p.y, id: p.id });
                
                // Auto-thaw after 5 seconds
                setTimeout(() => {
                    if (gameState.players[id]) gameState.players[id].isFrozen = false;
                }, 5000);
            }
        }

        gameState.obstacles.forEach(obs => {
            if (ball.active && Math.hypot(ball.x - obs.x, ball.y - obs.y) < obs.radius + ball.radius) {
                ball.active = false;
                io.emit('effect', { type: 'obs_hit', x: ball.x, y: ball.y });
            }
        });
    });

    gameState.snowballs = gameState.snowballs.filter(b => b.active);

    // 3. Broadcast State
    io.volatile.emit('state', {
        players: gameState.players,
        snowballs: gameState.snowballs
    });

}, 1000 / 60);

const PORT = process.env.PORT || 3000;
http.listen(PORT, () => {
    console.log(`Snowbrawl Server running on port ${PORT}`);
});
