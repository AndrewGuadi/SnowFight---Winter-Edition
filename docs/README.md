The Architecture
Server (Node.js + Socket.io): Runs on Render.com (Free Tier). It holds the "Truth" (positions, health, score).

Client (Your HTML file): Hosted on Vercel (Free). It sends keystrokes to the server and draws what the server sends back.

Step 1: Create the Server Project
Create a folder on your computer called snowbrawl-server. Open your terminal in that folder and run:

Bash

npm init -y
npm install express socket.io
Create a file named server.js. I have extracted the exact logic from your index.html and adapted it for the server below.

File: server.js

JavaScript

const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http, {
    cors: { origin: "*" } // Allow connections from anywhere (Vercel)
});

// --- CONFIGURATION (Copied from your Client) ---
const CONFIG = {
    worldWidth: 3000, // Fixed size for multiplayer (approx "Huge")
    worldHeight: 2000,
    friction: 0.92,
    acceleration: 0.8,
    maxSpeed: 4.5,
    ballSpeedBase: 9,
    chargeTime: 60,
};

// --- GAME STATE ---
let players = {};
let snowballs = [];
let obstacles = [];
let frameCount = 0;

// Generate Map Obstacles Once
for(let i=0; i<40; i++) {
    obstacles.push({
        x: Math.random() * CONFIG.worldWidth,
        y: Math.random() * CONFIG.worldHeight,
        radius: Math.random() > 0.5 ? 30 : 20, // Tree vs Rock size
        health: 100 // Simplified for server
    });
}

// --- CLASSES (Logic Only - No Drawing) ---
class ServerPlayer {
    constructor(id, team) {
        this.id = id;
        this.x = team === 'blue' ? 200 : CONFIG.worldWidth - 200;
        this.y = Math.random() * CONFIG.worldHeight;
        this.radius = 14;
        this.team = team;
        this.vx = 0; 
        this.vy = 0;
        this.inputs = { moveX: 0, moveY: 0, throw: false, dash: false };
        this.health = 100;
        this.isFrozen = false;
        this.hasBall = true;
        this.chargeLevel = 0;
        this.streak = 0;
    }

    update() {
        if (this.isFrozen) return; // Simplified thaw logic for brevity

        // Movement Physics (Exact match to your client)
        let ax = this.inputs.moveX * CONFIG.acceleration;
        let ay = this.inputs.moveY * CONFIG.acceleration;

        this.vx += ax;
        this.vy += ay;
        this.vx *= CONFIG.friction;
        this.vy *= CONFIG.friction;

        // Speed Cap
        const speed = Math.hypot(this.vx, this.vy);
        if (speed > CONFIG.maxSpeed) {
            this.vx = (this.vx / speed) * CONFIG.maxSpeed;
            this.vy = (this.vy / speed) * CONFIG.maxSpeed;
        }

        this.x += this.vx;
        this.y += this.vy;

        // Boundaries
        if (this.x < 0) this.x = 0;
        if (this.x > CONFIG.worldWidth) this.x = CONFIG.worldWidth;
        if (this.y < 0) this.y = 0;
        if (this.y > CONFIG.worldHeight) this.y = CONFIG.worldHeight;
    }
}

class ServerSnowball {
    constructor(x, y, angle, speed, ownerId, team) {
        this.x = x;
        this.y = y;
        this.vx = Math.cos(angle) * speed;
        this.vy = Math.sin(angle) * speed;
        this.z = 14; 
        this.vz = 2;
        this.ownerId = ownerId;
        this.team = team;
        this.active = true;
    }

    update() {
        this.x += this.vx;
        this.y += this.vy;
        this.z += this.vz;
        this.vz -= 0.15; // Gravity

        if (this.z < 0) this.active = false; // Hit ground
    }
}

// --- NETWORK HANDLERS ---
io.on('connection', (socket) => {
    console.log('Player connected:', socket.id);
    
    // Auto-balance teams
    const blues = Object.values(players).filter(p => p.team === 'blue').length;
    const reds = Object.values(players).filter(p => p.team === 'red').length;
    const team = blues <= reds ? 'blue' : 'red';

    players[socket.id] = new ServerPlayer(socket.id, team);

    // Initial State Send
    socket.emit('init', { id: socket.id, width: CONFIG.worldWidth, height: CONFIG.worldHeight, obstacles: obstacles });

    socket.on('input', (data) => {
        if(players[socket.id]) {
            players[socket.id].inputs = data;
            
            // Handle Throwing immediately on input to feel responsive
            if (data.throwStart && players[socket.id].hasBall) {
                // Start charge
                players[socket.id].chargeLevel = 0;
            }
            if (data.throwRelease && players[socket.id].hasBall) {
                const p = players[socket.id];
                // Simple angle calc based on movement or mouse angle sent from client
                const angle = data.angle || Math.atan2(p.vy, p.vx); 
                const speed = CONFIG.ballSpeedBase + (p.chargeLevel > 30 ? 5 : 0); // Simplified
                
                snowballs.push(new ServerSnowball(p.x, p.y, angle, speed, p.id, p.team));
                p.hasBall = false;
                p.chargeLevel = 0;
                
                // Reload after 2 seconds
                setTimeout(() => { if(players[socket.id]) players[socket.id].hasBall = true; }, 2000);
            }
        }
    });

    socket.on('disconnect', () => {
        delete players[socket.id];
    });
});

// --- SERVER GAME LOOP (60 FPS) ---
setInterval(() => {
    frameCount++;

    // Update Players
    for (let id in players) {
        const p = players[id];
        if (p.inputs.throw) p.chargeLevel++; // Charging logic
        p.update();
    }

    // Update Snowballs & Collision
    snowballs.forEach(ball => {
        ball.update();
        // Check collision with players
        for (let id in players) {
            let p = players[id];
            if (p.team !== ball.team && !p.isFrozen && Math.hypot(ball.x - p.x, ball.y - p.y) < 20) {
                p.isFrozen = true;
                ball.active = false;
                // Emit hit event so clients play sound/particles
                io.emit('hit', { x: p.x, y: p.y, id: p.id }); 
            }
        }
    });

    // Cleanup Dead Snowballs
    snowballs = snowballs.filter(b => b.active);

    // Send State to Clients (Volatile = drop packet if lagging, good for games)
    io.volatile.emit('state', {
        players: players,
        snowballs: snowballs
    });

}, 1000 / 60);

const PORT = process.env.PORT || 3000;
http.listen(PORT, () => {
    console.log(`Snowbrawl Server running on port ${PORT}`);
});
Step 2: Modify the Client (index.html)
You need to edit your existing index.html. You are removing the "Physics" and adding "Networking".

1. Add the Socket.io Script Add this to your <head>:

HTML

<script src="https://cdn.socket.io/4.5.4/socket.io.min.js"></script>
2. Change STATE and Player We are no longer calculating physics locally. We are just smoothing what the server tells us.

Replace your gameLoop and Player logic with this concept:

JavaScript

// At the top of your script
const socket = io('http://localhost:3000'); // CHANGE THIS URL AFTER DEPLOYING

// Connect inputs to Server
function gameLoop() {
    requestAnimationFrame(gameLoop);
    
    // 1. Send Inputs to Server
    socket.emit('input', {
        moveX: STATE.inputs.moveX,
        moveY: STATE.inputs.moveY,
        angle: Math.atan2(STATE.inputs.moveY, STATE.inputs.moveX), // Send aiming angle
        throw: STATE.inputs.throw,
        dash: STATE.inputs.dash
    });

    // 2. Draw Everything (using the data from server, not local)
    ctx.clearRect(0, 0, CONFIG.viewportWidth, CONFIG.viewportHeight);
    
    // Loop through server players and draw them
    // (We use a variable 'serverState' that we update via socket)
    if(serverState) {
        for(let id in serverState.players) {
            let p = serverState.players[id];
            drawPlayer(p.x, p.y, p.team, p.isFrozen); // Use your existing draw logic
        }
    }
}

let serverState = null;
socket.on('state', (state) => {
    serverState = state;
});

// Handle "Events" for Juice (Particles/Audio)
socket.on('hit', (data) => {
    Audio.sfx.hit();
    createParticles(data.x, data.y, '#FFF', 20);
});
Step 3: Deployment (The "Lowest Cost" Route)
This will cost you $0.

1. Deploy the Backend (Render.com)
Push your server.js folder to GitHub.

Go to Render.com -> New -> Web Service.

Connect your GitHub repo.

Runtime: Node. Build Command: npm install. Start Command: node server.js.

Important: Click "Create Web Service" (Select Free Tier).

Render will give you a URL (e.g., snowbrawl.onrender.com).

2. Connect the Client
Go back to your index.html. Change the socket line:

JavaScript

// const socket = io('http://localhost:3000'); // OLD
const socket = io('https://snowbrawl.onrender.com'); // NEW
3. Deploy the Frontend (Vercel)
Go to Vercel.com.

Drag and drop your index.html file (or connect GitHub).

It will give you a live URL (e.g., snowbrawl.vercel.app).

Key Changes to Watch Out For
Map Logic: In the server.js, I hardcoded obstacles. You should remove the random obstacle generation from your index.html and instead receive the obstacle list from the server (socket.on('init', ...)).

Lag: On the free tier, the server might sleep if no one plays for 15 mins. It takes 30 seconds to wake up.

Drawing: Your current Player.draw function relies on this variables like walkCycle. Since the server is just sending X/Y positions, you need to update your draw function to calculate walkCycle based on serverPlayer.vx and serverPlayer.vy.

Would you like me to rewrite your Player.draw function specifically to work with the raw data coming from the server? (This preserves your animations).
