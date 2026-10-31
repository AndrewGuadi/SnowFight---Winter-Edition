const {test}=require('node:test');
const assert=require('node:assert/strict');
const {clashTime,resolveSnowballClashes,sweptCloseCall,signalCloseCalls}=require('../combat-interactions');
function ball(team,x,y,vx,vy,extra={}){return {team,ownerId:team+'-owner',x,y,vx,vy,z:14,vz:3.1,radius:7,active:true,...extra}}
function room(shots,opts={}){const events=[];return {snowballs:shots,players:{},obstacles:[],structures:[],tick:100,mode:'multi',ended:false,events,emit:(n,p)=>events.push({name:n,data:p}),...opts}}
test('head-on snowballs clash once before hitting anyone',()=>{
 const a=ball('blue',100,100,14,0),b=ball('red',125,100,-14,0);
 const m=room([a,b]);assert.equal(resolveSnowballClashes(m),1);
 assert.equal(a.active,false);assert.equal(b.active,false);
 assert.equal(m.events.length,1);assert.equal(m.events[0].data.type,'snow_clash');
 assert.ok(m.events[0].data.x>100&&m.events[0].data.x<125);
 assert.equal(resolveSnowballClashes(m),0);
});
test('team snowballs and shots at different heights do not cancel each other',()=>{
 const a=ball('blue',100,100,14,0),b=ball('blue',125,100,-14,0);
 assert.equal(resolveSnowballClashes(room([a,b])),0);
 b.team='red';b.z=80;
 assert.equal(clashTime(a,b),null);
 assert.equal(resolveSnowballClashes(room([a,b])),0);
});
test('a world obstacle intercepts the snowball before the midair clash',()=>{
 const a=ball('blue',100,100,14,0),b=ball('red',125,100,-14,0);
 const m=room([a,b],{obstacles:[{x:105,y:100,radius:1}]});
 assert.equal(resolveSnowballClashes(m),0);assert.equal(a.active,true);assert.equal(b.active,true);
});
test('an earlier opponent hit is never overridden by later midair collision',()=>{
 const a=ball('blue',100,100,14,0),b=ball('red',125,100,-14,0);
 const target={id:'target',team:'red',x:105,y:100,radius:1};
 const m=room([a,b],{players:{target}});
 assert.equal(resolveSnowballClashes(m),0);assert.equal(a.active,true);
});
test('close call requires passing near but outside the actual hit radius',()=>{
 assert.equal(sweptCloseCall(0,0,20,0,10,28,16),true);
 assert.equal(sweptCloseCall(0,0,20,0,10,13,16),false);
 assert.equal(sweptCloseCall(0,0,20,0,40,28,16),false);
 assert.equal(sweptCloseCall(0,0,20,0,10,80,16),false);
});
test('server near-miss feedback is capped and never changes score',()=>{
 const p={id:'player',team:'red',x:110,y:128,radius:14,isBot:false},a=ball('blue',90,100,20,0);
 a.x=110; // final projectile position, start at x=90
 const m=room([a],{players:{player:p},score:{blue:3,red:5}});
 assert.equal(signalCloseCalls(m,a,90,100),1);
 assert.equal(signalCloseCalls(m,a,90,100),0);
 assert.deepEqual(m.score,{blue:3,red:5});
 assert.equal(m.events[0].data.id,'player');
});
