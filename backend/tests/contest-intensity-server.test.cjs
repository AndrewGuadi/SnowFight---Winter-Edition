const {test}=require('node:test');
const assert=require('node:assert/strict');
const {createMatch,ServerPlayer,ServerSnowball,tickMatch,matches}=require('../server');
const POW=require('../pow');

function harness(mode='brawl'){
 const m=createMatch('multi',5,5,undefined,'INTENSE',mode);
 const events=[];m.obstacles=[];m.emit=(name,data)=>events.push({name,data});m.emitVolatile=()=>{};
 return {m,events};
}
function addPlayer(m,id,team,x,y){
 const p=new ServerPlayer(id,team,false,'classic');p.x=x;p.y=y;
 m.players[id]=p;return p;
}
test('real server tick cancels a head-on projectile duel before either scores',()=>{
 const {m,events}=harness();
 addPlayer(m,'a','blue',200,500);addPlayer(m,'b','red',2800,1500);
 m.snowballs=[
   new ServerSnowball(1200,900,0,14,'a','blue',0),
   new ServerSnowball(1225,900,Math.PI,14,'b','red',0)
 ];
 tickMatch(m);
 assert.equal(m.snowballs.length,0);
 assert.equal(events.filter(e=>e.data.type==='snow_clash').length,1);
 assert.deepEqual(m.score,{blue:0,red:0});
 matches.clear();
});
test('earlier valid player impact takes priority over a later snowball clash',()=>{
 const {m,events}=harness();
 const a=addPlayer(m,'a','blue',200,500),b=addPlayer(m,'b','red',1210,900);
 m.snowballs=[
   new ServerSnowball(1200,900,0,14,'a','blue',0),
   new ServerSnowball(1230,900,Math.PI,14,'b','red',0)
 ];
 tickMatch(m);
 assert.equal(b.isFrozen,true,'player takes the earlier legitimate hit');
 assert.equal(m.score.blue,1);
 assert.equal(events.some(e=>e.data.type==='snow_clash'),false);
 matches.clear();
});
test('a safe near miss emits one dodge feedback event without changing score',()=>{
 const {m,events}=harness();
 addPlayer(m,'a','blue',200,500);
 const b=addPlayer(m,'b','red',1230,935);
 m.snowballs=[new ServerSnowball(1200,900,0,60,'a','blue',0)];
 tickMatch(m);
 assert.equal(events.filter(e=>e.data.type==='close_call'&&e.data.id==='b').length,1);
 assert.deepEqual(m.score,{blue:0,red:0});
 for(let i=0;i<5;i++)tickMatch(m);
 assert.equal(events.filter(e=>e.data.type==='close_call'&&e.data.id==='b').length,1);
 matches.clear();
});
test('POW last-free alert occurs once when one teammate remains uncaptured',()=>{
 const {m,events}=harness('pow');
 const a=addPlayer(m,'a','blue',700,700),b=addPlayer(m,'b','blue',1000,700),c=addPlayer(m,'c','red',2500,1400);
 for(const p of [a,b,c])POW.onJoin(m,p);
 m.timerStarted=true;
 assert.equal(POW.onHit(m,a,{ownerId:c.id,team:'red'}),true);
 const calls=events.filter(e=>e.data.type==='pow_last_stand');
 assert.equal(calls.length,1);
 assert.equal(calls[0].data.id,'b');
 assert.equal(m.ended,false);
 matches.clear();
});
test('POW gate-rush announcement occurs only at one second remaining',()=>{
 const {m,events}=harness('pow');
 const a=addPlayer(m,'a','blue',700,700),b=addPlayer(m,'b','blue',1000,700),c=addPlayer(m,'c','red',2500,1400);
 for(const p of [a,b,c])POW.onJoin(m,p);
 m.timerStarted=true;POW.onHit(m,a,{ownerId:'c',team:'red'});
 b.x=380;b.y=280;b.interact=true;
 for(let i=0;i<120;i++){m.tick++;POW.tick(m)}
 assert.equal(events.filter(e=>e.data.type==='pow_gate_rush').length,1);
 assert.equal(events.filter(e=>e.data.type==='pow_release').length,1);
 assert.equal(a.captured,false);
 matches.clear();
});
