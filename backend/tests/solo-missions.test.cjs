const {test,afterEach}=require('node:test');const assert=require('node:assert/strict');
const {MISSIONS,AGGRESSION,missionProgress}=require('../missions');
const {createMatch,ServerPlayer,tickMatch,fireSnowball,matches}=require('../server');
afterEach(()=>matches.clear());
function scene(id){const m=createMatch('single',1,1);m.mission=id;m.aggression=MISSIONS[id].aggression;m.obstacles=[];m.emit=()=>{};m.emitVolatile=()=>{};for(const [id,team,x]of[['a','blue',200],['b','red',2800]]){let p=new ServerPlayer(id,team,false);p.x=x;p.y=1000;m.players[id]=p;}return m;}
test('beacon mission ends with a win when 5 hill points are banked',()=>{const m=scene('beacon');m.players.a.x=1500;for(let i=0;i<300;i++)tickMatch(m);assert.equal(m.ended,true);assert.equal(m.winner,'blue');assert.equal(missionProgress(m).completed,true);});
test('snow fight mission ends on its target, not on an unrelated hill lead',()=>{const m=scene('snowfight');m.hill.blue=50;tickMatch(m);assert.equal(m.ended,false);m.score.blue=3;tickMatch(m);assert.equal(m.winner,'blue');assert.equal(m.ended,true);});
test('incomplete mission loses at the buzzer even with a smaller hill lead',()=>{const m=scene('beacon');m.hill.blue=2;m.timerTicks=5399;m.timerStarted=true;tickMatch(m);assert.equal(m.ended,true);assert.equal(m.winner,'red');assert.equal(m.overtime,false);});
test('a draw in squad is a retry, a winning round completes it',()=>{const m=scene('squad');m.timerTicks=5399;m.timerStarted=true;tickMatch(m);assert.equal(m.winner,'red');const n=scene('squad');n.hill.blue=10;n.timerTicks=5399;n.timerStarted=true;tickMatch(n);assert.equal(n.winner,'blue');});
test('aggression changes firing recovery and relaxed disables ability pressure',()=>{for(const id of Object.keys(AGGRESSION)){const m=scene('beacon');m.aggression=id;const p=m.players.a;p.isBot=true;fireSnowball(p,m);assert.equal(p.nextAttackTick,m.tick+45+AGGRESSION[id].pause);}assert.equal(AGGRESSION.chill.abilities,false);assert.ok(AGGRESSION.chill.chase<AGGRESSION.relentless.chase);});
test('relaxed, balanced and relentless produce distinct sustained firing rates',()=>{
 const counts=[];
 for(const aggression of ['chill','balanced','relentless']){
  const m=createMatch('single',1,1);m.aggression=aggression;m.obstacles=[];m.emit=()=>{};m.emitVolatile=()=>{};
  const bot=new ServerPlayer('bot','blue',true),target=new ServerPlayer('target','red',false);bot.x=500;bot.y=500;target.x=700;target.y=500;m.players={bot,target};
  for(let i=0;i<1200;i++){target.guardTicks=120;tickMatch(m);}
  counts.push(bot.stats.throws);
 }
 assert.ok(counts[0]<counts[1]&&counts[1]<counts[2],`firing counts ${counts}`);
});
