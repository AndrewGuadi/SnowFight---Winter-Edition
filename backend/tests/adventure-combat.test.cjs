const {test}=require('node:test'),assert=require('node:assert/strict');
const c=require('../../assets/adventure-combat');
function player(){return {x:100,y:360,w:33,h:50,vx:0,vy:0,hearts:3,invuln:0,hitFreeze:0,grounded:true}}
test('enemy snowballs aim toward nearby player, obey finite speed and lifetime',()=>{
 const p=player();const s=c.launch({x:400},p,420);
 assert.ok(s.vx<0&&Number.isFinite(s.vy));assert.ok(s.ttl>60);
});
test('enemy hit removes exactly one heart and creates recovery window',()=>{
 const p=player(),s={x:114,y:379,vx:0,vy:0,ttl:25,dead:false};
 assert.equal(c.step([s],p),1);assert.equal(p.hearts,2);assert.ok(p.invuln>0);
 const extra={x:114,y:379,vx:0,vy:0,ttl:25,dead:false};
 assert.equal(c.step([extra],p),0);assert.equal(p.hearts,2);
 assert.ok(p.vy<0,'snowball knockback must lift the character');
});
test('jumping above a snowball avoids the hit',()=>{
 const p=player();p.y=200;
 const s={x:114,y:392,vx:0,vy:0,ttl:25,dead:false};
 assert.equal(c.step([s],p),0);assert.equal(p.hearts,3);
});
test('a player snowball blocks an enemy snowball',()=>{
 const a=[{x:200,y:300,v:12}],b=[{x:206,y:300,vx:-6,vy:0,ttl:20}];
 assert.equal(c.intercept(a,b),1);assert.equal(a[0].dead,true);assert.equal(b[0].dead,true);
 assert.equal(c.intercept(a,b),0);
});
test('a hit enemy is stunned and cannot be repeatedly chained in one volley',()=>{
 const bot={x:300,stun:0},shot={v:12};
 assert.equal(c.hitEnemy(bot,shot),true);assert.equal(bot.stun,c.ENEMY_STUN);
 assert.equal(c.hitEnemy(bot,shot),false);
});
