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
