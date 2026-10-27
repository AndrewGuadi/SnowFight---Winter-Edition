const {test,afterEach}=require('node:test');
const assert=require('node:assert/strict');
const {CLASSES,classId,shotPattern,canBuild}=require('../classes');
const {ServerPlayer,createMatch,tickMatch,fireSnowball,useAbility,matches}=require('../server');
afterEach(()=>matches.clear());
function arena(id='glacier') {
 const m=createMatch('multi',1,1);m.obstacles=[];
 const p=new ServerPlayer('a','blue',false,id);p.x=500;p.y=500;p.inputs.angle=0;m.players.a=p;
 return {m,p};
}
test('only recognized class identifiers are accepted',()=>{
 for(const id of [null,{},'__proto__','constructor','hacker']) assert.equal(classId(id),'classic');
 for(const id of Object.keys(CLASSES)) assert.equal(classId(id),id);
});
test('three classes have distinct weapons and charged spread narrows',()=>{
 assert.equal(shotPattern('snowbug',0).length,3);
 assert.ok(Math.abs(shotPattern('snowbug',60)[0].angle)<Math.abs(shotPattern('snowbug',0)[0].angle));
 assert.ok(shotPattern('glacier',0)[0].radius>shotPattern('classic',0)[0].radius);
 assert.ok(shotPattern('frostweaver',0)[0].speed>shotPattern('classic',0)[0].speed);
});
test('weapon consumes exactly one packed snowball per volley and cannot duplicate',()=>{
 const {m,p}=arena('snowbug');assert.equal(fireSnowball(p,m),true);assert.equal(m.snowballs.length,3);
 assert.equal(p.stats.throws,1);assert.equal(p.hasBall,false);assert.equal(fireSnowball(p,m),false);
 assert.equal(m.snowballs.length,3);
});
test('cannon uses ammunition, sets cooldown, and rejects frozen/ended requests',()=>{
 const {m,p}=arena('snowbug');p.hasBall=false;assert.equal(useAbility(p,m),false);assert.equal(p.abilityCooldown,0);
 p.hasBall=true;assert.equal(useAbility(p,m),true);assert.equal(m.snowballs[0].kind,'cannon');assert.equal(p.abilityCooldown,420);
 p.hasBall=true;assert.equal(useAbility(p,m),false);p.abilityCooldown=0;p.isFrozen=true;assert.equal(useAbility(p,m),false);
 p.isFrozen=false;m.ended=true;assert.equal(useAbility(p,m),false);assert.equal(fireSnowball(p,m),false);
});
test('glacier guard absorbs one hit without scoring, then overtime freeze wins',()=>{
 const {m,p}=arena();const enemy=new ServerPlayer('b','red',false);enemy.x=450;enemy.y=500;enemy.inputs.angle=0;m.players.b=enemy;m.overtime=true;
 useAbility(p,m);fireSnowball(enemy,m);for(let i=0;i<4;i++)tickMatch(m);
 assert.equal(p.guardTicks,0);assert.equal(p.isFrozen,false);assert.equal(m.score.red,0);assert.equal(m.ended,false);
 enemy.hasBall=true;fireSnowball(enemy,m);for(let i=0;i<4;i++)tickMatch(m);
 assert.equal(p.isFrozen,true);assert.equal(m.score.red,1);assert.equal(m.winner,'red');assert.equal(m.ended,true);
});
test('guard expires on tick clock and cannot be spammed',()=>{
 const {m,p}=arena();assert.equal(useAbility(p,m),true);assert.equal(useAbility(p,m),false);
 for(let i=0;i<120;i++)tickMatch(m);assert.equal(p.guardTicks,0);assert.equal(p.abilityCooldown,360);
});
test('igloo placement rejects edges, players and obstacles without spending cooldown',()=>{
 const {m,p}=arena('frostweaver');m.obstacles=[{x:590,y:500,radius:20}];assert.equal(useAbility(p,m),false);assert.equal(p.abilityCooldown,0);
 m.obstacles=[];p.x=2980;assert.equal(useAbility(p,m),false);p.x=500;
 m.players.b=new ServerPlayer('b','red',false);m.players.b.x=590;m.players.b.y=500;assert.equal(useAbility(p,m),false);
 delete m.players.b;assert.equal(useAbility(p,m),true);assert.equal(m.structures.length,1);assert.equal(m.structures[0].hp,3);
 p.abilityCooldown=0;assert.equal(useAbility(p,m),false,'one igloo per owner');
});
test('cover blocks projectiles, takes three hits, and cannot score for destruction',()=>{
 const {m,p}=arena('frostweaver');useAbility(p,m);const enemy=new ServerPlayer('b','red',false);enemy.x=680;enemy.y=500;enemy.inputs.angle=Math.PI;m.players.b=enemy;
 for(let hit=0;hit<3;hit++){enemy.hasBall=true;fireSnowball(enemy,m);for(let i=0;i<5;i++)tickMatch(m);}
 assert.equal(m.structures.length,0);assert.equal(p.isFrozen,false);assert.deepEqual(m.score,{blue:0,red:0});
});
test('igloos block walking, expire, freeze at match end and have a room cap',()=>{
 const {m,p}=arena('frostweaver');useAbility(p,m);p.x=560;p.y=500;tickMatch(m);
 assert.ok(p.x<=590-38-p.radius+.01);
 m.structures[0].life=2;tickMatch(m);assert.equal(m.structures.length,1);tickMatch(m);assert.equal(m.structures.length,0);
 p.abilityCooldown=0;p.x=500;useAbility(p,m);const life=m.structures[0].life;m.ended=true;tickMatch(m);assert.equal(m.structures[0].life,life);
 m.ended=false;p.abilityCooldown=0;m.structures=Array.from({length:20},(_,i)=>({ownerId:'other'+i}));assert.equal(useAbility(p,m),false);
});
test('classic physics retained and class movement/reload match tuning',()=>{
 for(const id of Object.keys(CLASSES)) {
  const {m,p}=arena(id);p.inputs.moveY=1;p.hasBall=false;p.inputs.gather=true;
  for(let i=0;i<CLASSES[id].gather-1;i++)p.update(m);
  assert.equal(p.hasBall,false,id);p.update(m);assert.equal(p.hasBall,true,id);
  p.inputs.gather=false;for(let i=0;i<50;i++)p.update(m);
  assert.ok(Math.abs(Math.hypot(p.vx,p.vy)-4.5*CLASSES[id].speed)<.01,id);
 }
});
