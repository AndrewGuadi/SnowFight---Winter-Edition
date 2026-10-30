// Lightweight, deterministic steering; server physics/collision remain authoritative.
// No external navmesh or new tick loop. Call from the existing 60Hz bot update.
function botIndex(id) {
    const match = String(id).match(/-(\d+)$/);
    if (match) return Math.max(0, Number(match[1]) - 1);
    let hash = 0;
    for (const char of String(id)) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
    return hash;
}
function hillSlot(bot, centerX, centerY) {
    const n = botIndex(bot.id);
    const angle = (n % 12) * Math.PI / 6 + (bot.team === 'red' ? Math.PI / 12 : 0);
    const radius = 82 + (Math.floor(n / 12) % 3) * 56;
    return {x: centerX + Math.cos(angle) * radius, y: centerY + Math.sin(angle) * radius};
}
function normalize(x, y) {
    const d = Math.hypot(x, y);
    return d > 1e-6 ? {x:x/d, y:y/d} : {x:0, y:0};
}
function steerBot(bot, match, goalX, goalY, intensity=1, hold=false) {
    const toGoal = normalize(goalX-bot.x, goalY-bot.y);
    let x = hold ? 0 : toGoal.x, y = hold ? 0 : toGoal.y;
    const personalSpace = (bot.radius || 14) + 47;
    // Small personal-space steering prevents target and center convergence.
    for (const other of Object.values(match.players)) {
        if (other.id === bot.id || other.team !== bot.team || other.isFrozen) continue;
        let dx=bot.x-other.x, dy=bot.y-other.y;
        let d=Math.hypot(dx,dy);
        if (d >= personalSpace) continue;
        if (d < 1e-5) {
            const a = botIndex(bot.id) * 2.399963 + 0.5;
            dx = Math.cos(a); dy = Math.sin(a); d = 1;
        }
        const push = (personalSpace - d) / personalSpace;
        x += (dx/d) * push * (hold ? 2.4 : 1.75);
        y += (dy/d) * push * (hold ? 2.4 : 1.75);
    }
    // Avoid close solid obstacles. Deliberately bounded; this is not full A*.
    for (const obstacle of [...match.obstacles, ...match.structures]) {
        const dx = bot.x-obstacle.x, dy=bot.y-obstacle.y;
        const d = Math.hypot(dx,dy);
        const range = (bot.radius || 14) + obstacle.radius + 52;
        if (d > 1e-5 && d < range) {
            const push = (range-d)/range;
            x += (dx/d) * push * 1.5;
            y += (dy/d) * push * 1.5;
        }
    }
    const result=normalize(x,y);
    return {moveX:result.x*Math.max(0,Math.min(1,intensity)), moveY:result.y*Math.max(0,Math.min(1,intensity))};
}
module.exports = {botIndex,hillSlot,steerBot};
