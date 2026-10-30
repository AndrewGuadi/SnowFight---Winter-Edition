const {test}=require('node:test');const assert=require('node:assert/strict');
const {ServerPlayer,createMatch,tickMatch,matches}=require('../server');
test('a direct hill takeover starts a fresh second for the new team',()=>{
 const m=createMatch('multi',1,1);m.obstacles=[];m.emit=()=>{};m.emitVolatile=()=>{};
 for(const [id,team,x] of [['a','blue',1500],['b','red',2500]]) {const p=new ServerPlayer(id,team,false);p.x=x;p.y=1000;m.players[id]=p;}
 for(let i=0;i<59;i++)tickMatch(m);m.players.a.x=500;m.players.b.x=1500;tickMatch(m);
 assert.equal(m.hill.red,0);assert.equal(m.hillSecondTicks,1);for(let i=0;i<59;i++)tickMatch(m);
 assert.equal(m.hill.red,1);matches.clear();
});
