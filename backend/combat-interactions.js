// SnowFight contest-intensity interactions.
// The authoritative server, not the renderer, decides snowball clashes and near misses.
// Reuses the existing swept-circle collision helper; no new input buttons or dependencies.
const {segmentHit}=require('./gameplay');
const CLASH_HEIGHT=20, CLOSE_CALL_MARGIN=34, CLOSE_CALL_COOLDOWN=100;

// Earliest existing player/cover collision this tick. A late snowball clash
// must not erase an earlier valid freeze or cover hit.
function firstWorldImpact(match, ball) {
    const x1=ball.x+ball.vx, y1=ball.y+ball.vy;
    let first=Infinity;
    for(const o of [...match.obstacles,...match.structures]){
        if(o.hp!==undefined && o.hp<=0)continue;
        const t=segmentHit(ball.x,ball.y,x1,y1,o.x,o.y,o.radius+ball.radius);
        if(t!==null && t<first)first=t;
    }
    const owner=match.players[ball.ownerId];
    const bonus=(match.mode==='single'&&owner&&!owner.isBot)?6:0;
    for(const p of Object.values(match.players)){
        if(p.id===ball.ownerId||p.team===ball.team||p.isFrozen||p.captured||p.invulnerableUntil>match.tick)continue;
        const t=segmentHit(ball.x,ball.y,x1,y1,p.x,p.y,p.radius+ball.radius+bonus);
        if(t!==null && t<first)first=t;
    }
    return first;
}

// Swept relative motion: both projectiles move in this tick, so their visual
// positions at individual snapshots are not used for collision decisions.
function clashTime(a,b) {
    if(!a.active||!b.active||a.team===b.team)return null;
    const x0=a.x-b.x,y0=a.y-b.y;
    const x1=x0+a.vx-b.vx,y1=y0+a.vy-b.vy;
    const t=segmentHit(x0,y0,x1,y1,0,0,a.radius+b.radius);
    if(t===null)return null;
    const za=a.z+a.vz*t,zb=b.z+b.vz*t;
    if(za<=0||zb<=0||Math.abs(za-zb)>CLASH_HEIGHT)return null;
    return t;
}
function resolveSnowballClashes(match) {
    if(!match||match.ended||match.snowballs.length<2)return 0;
    const shots=match.snowballs;
    const candidates=[];
    // Most frames have far fewer active shots than players. Distance broadphase
    // eliminates the expensive swept test for nearly every pair.
    for(let i=0;i<shots.length;i++){
        const a=shots[i];
        if(!a.active||a.z+a.vz<=0)continue;
        for(let j=i+1;j<shots.length;j++){
            const b=shots[j];
            if(!b.active||a.team===b.team||b.z+b.vz<=0)continue;
            if(Math.abs(a.x-b.x)>Math.abs(a.vx-b.vx)+a.radius+b.radius)continue;
            if(Math.abs(a.y-b.y)>Math.abs(a.vy-b.vy)+a.radius+b.radius)continue;
            const t=clashTime(a,b);
            if(t!==null)candidates.push({a,b,t});
        }
    }
    candidates.sort((a,b)=>a.t-b.t);
    const impactCache=new Map();
    const earlier=(ball,t)=>{
        if(!impactCache.has(ball))impactCache.set(ball,firstWorldImpact(match,ball));
        return impactCache.get(ball)<t-1e-7;
    };
    let clashes=0;
    for(const {a,b,t} of candidates){
        if(!a.active||!b.active||earlier(a,t)||earlier(b,t))continue;
        a.active=false;b.active=false;
        const x=(a.x+a.vx*t+b.x+b.vx*t)/2;
        const y=(a.y+a.vy*t+b.y+b.vy*t)/2;
        match.emit('effect',{type:'snow_clash',x,y,owners:[a.ownerId,b.ownerId]});
        clashes++;
    }
    return clashes;
}

// Only a projectile that flies *past* a player without touching their hit
// circle counts as a close call. No client-side hit/position guesses.
function sweptCloseCall(x0,y0,x1,y1,px,py,hitRadius,margin=CLOSE_CALL_MARGIN){
    const dx=x1-x0,dy=y1-y0;
    const len=dx*dx+dy*dy;
    if(len<1e-8)return false;
    const t=((px-x0)*dx+(py-y0)*dy)/len;
    if(t<0||t>1)return false;
    const d=Math.hypot(x0+dx*t-px,y0+dy*t-py);
    return d>hitRadius+2 && d<=hitRadius+margin;
}
function signalCloseCalls(match,ball,x0,y0) {
    if(!ball.active||match.ended)return 0;
    const owner=match.players[ball.ownerId];
    const bonus=(match.mode==='single'&&owner&&!owner.isBot)?6:0;
    let count=0;
    for(const p of Object.values(match.players)){
        if(p.isBot||p.team===ball.team||p.id===ball.ownerId||p.isFrozen||p.captured||p.invulnerableUntil>match.tick)continue;
        if((p.nextCloseCallTick||0)>match.tick)continue;
        if(!sweptCloseCall(x0,y0,ball.x,ball.y,p.x,p.y,p.radius+ball.radius+bonus))continue;
        p.nextCloseCallTick=match.tick+CLOSE_CALL_COOLDOWN;
        match.emit('effect',{type:'close_call',x:p.x,y:p.y,id:p.id,ownerId:ball.ownerId});
        count++;
    }
    return count;
}
module.exports={clashTime,firstWorldImpact,resolveSnowballClashes,sweptCloseCall,signalCloseCalls};
