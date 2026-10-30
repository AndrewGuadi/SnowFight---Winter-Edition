const {test}=require('node:test'),assert=require('node:assert/strict');
const POW=require('../pow');const {createMatch,ServerPlayer,tickMatch}=require('../server');
function setup(){let m=createMatch('multi',5,5,undefined,'TEST','pow');m.emit=()=>{};m.emitVolatile=()=>{};const a=new ServerPlayer('a','blue',false),b=new ServerPlayer('b','red',false),c=new ServerPlayer('c','blue',false);m.players={a,b,c};for(const p of Object.values(m.players))POW.onJoin(m,p);m.timerStarted=true;return m}
test('capture and rescue require 120 uninterrupted ticks',()=>{const m=setup();POW.onHit(m,m.players.a,{team:'red',ownerId:'b'});assert.equal(m.players.a.captured,true);const c=m.players.c;c.x=380;c.y=280;c.interact=true;for(let i=0;i<119;i++)POW.tick({...m,tick:++m.tick});assert.equal(m.players.a.captured,true);POW.tick({...m,tick:++m.tick});assert.equal(m.players.a.captured,false);assert.equal(m.pow.rescues.blue,1)});
test('capture all players yields single authoritative win',()=>{const m=setup();POW.onHit(m,m.players.a,{team:'red',ownerId:'b'});POW.onHit(m,m.players.c,{team:'red',ownerId:'b'});assert.equal(m.winner,'red');assert.equal(m.ended,true)});
test('legacy brawl rules are default',()=>{const m=createMatch('multi',1,1);assert.equal(m.gameMode,'brawl');assert.equal(m.pow,undefined)});

test('rescue pad progress resets on release and on leaving the pad',()=>{
 const m=setup();POW.onHit(m,m.players.a,{team:'red',ownerId:'b'});
 const c=m.players.c;c.x=380;c.y=280;c.interact=true;
 for(let i=0;i<119;i++){m.tick++;POW.tick(m)}
 assert.equal(m.pow.rescue.blue,119);
 c.interact=false;m.tick++;POW.tick(m);assert.equal(m.pow.rescue.blue,0);
 c.interact=true;for(let i=0;i<119;i++){m.tick++;POW.tick(m)}
 assert.equal(m.players.a.captured,true);
 c.x=1000;m.tick++;POW.tick(m);
 assert.equal(m.pow.rescue.blue,0);
});
test('jail cells are protected: captives stay inside, untagged outsiders stay outside',()=>{
 const m=setup(),a=m.players.a,b=m.players.b;
 a.captured=true;a.x=500;a.y=500;POW.clampPrison(a);
 assert.ok(Math.abs(a.x-230)<=65&&Math.abs(a.y-280)<=60);
 b.x=230;b.y=280;POW.clampPrison(b);
 assert.ok(Math.abs(b.x-230)>=90+b.radius || Math.abs(b.y-280)>=85+b.radius);
});
test('flag control grants server-side buff after 1200 uncontested ticks',()=>{
 const m=setup();m.players.a.x=1500;m.players.a.y=1000;
 m.players.c.x=100;m.players.c.y=100;m.players.b.x=2900;m.players.b.y=1500;
 for(let i=0;i<1199;i++){m.tick++;POW.tick(m)}
 assert.equal(m.pow.buffs.blue,null);
 m.tick++;POW.tick(m);
 assert.equal(m.pow.buffs.blue.kind,'snowballFrenzy');
 assert.ok(m.pow.control.blue>0);
});
test('POW timeout determines winner by points without Brawl overtime',()=>{
 const m=setup();m.score.blue=7;m.score.red=3;m.timerTicks=POW.DURATION;
 m.tick++;POW.tick(m);
 assert.equal(m.ended,true);assert.equal(m.winner,'blue');assert.equal(m.overtime,false);
});
