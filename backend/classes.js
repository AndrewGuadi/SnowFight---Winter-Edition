// Server-owned tuning. A class is selected at join, never trusted from input packets.
const CLASSES = Object.freeze({
    classic: { name:'Classic', radius:14, speed:1, gather:45, ballScale:1, shotSpeed:1, cooldown:0 },
    glacier: { name:'Glacier', radius:20, speed:0.8, gather:60, ballScale:1.65, shotSpeed:0.9, cooldown:480 },
    snowbug: { name:'Snowbug', radius:16, speed:0.95, gather:65, ballScale:0.7, shotSpeed:0.95, cooldown:420 },
    frostweaver: { name:'Frostweaver', radius:13, speed:1.08, gather:50, ballScale:0.75, shotSpeed:1.4, cooldown:720 }
});
function classId(value) { return typeof value === 'string' && Object.hasOwn(CLASSES,value) ? value : 'classic'; }
function shotPattern(id, charge, cannon=false) {
    const c=CLASSES[classId(id)], power=Math.max(0,Math.min(60,charge));
    if(cannon) return [{angle:0,speed:24,radius:13,kind:'cannon'}];
    const spread=0.23-power*0.002;
    return (id==='snowbug'?[-spread,0,spread]:[0]).map(angle=>({angle,speed:(12+power/5)*c.shotSpeed,radius:(6+power/20)*c.ballScale,kind:id==='frostweaver'?'needle':id==='glacier'?'heavy':'snow'}));
}
function canBuild(x,y,world,solids,players) {
    const radius=38;
    return x>=radius && x<=world.worldWidth-radius && y>=radius && y<=world.worldHeight-radius &&
        !solids.some(o=>Math.hypot(x-o.x,y-o.y)<radius+o.radius+8) &&
        !Object.values(players).some(p=>Math.hypot(x-p.x,y-p.y)<radius+p.radius+8);
}
module.exports={CLASSES,classId,shotPattern,canBuild};
