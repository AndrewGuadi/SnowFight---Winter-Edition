const test = require('node:test');
const assert = require('node:assert/strict');
require('../../assets/animation.js');
const {AnimationStateMachine,EffectPool,ProjectileVisualizer}=globalThis.SnowAnimation;

test('animation state precedence covers locomotion, aim, both throws, hit and recovery',()=>{
  const a=new AnimationStateMachine();
  const at=(sample,t)=>a.update({isFrozen:false,chargeLevel:0,speed:0,ended:false,team:'blue',...sample},t).state;
  assert.equal(at({},0),'idle');
  assert.equal(at({speed:1},10),'walking');
  assert.equal(at({speed:4},20),'running');
  assert.equal(at({chargeLevel:2},30),'aiming');
  a.triggerThrow(2,40);assert.equal(at({},40),'throw');assert.equal(a.throwKind,'quick');
  a.triggerThrow(40,300);assert.equal(at({},300),'throw');assert.equal(a.throwKind,'charged');
  a.triggerHit(700);assert.equal(at({speed:4},700),'hit');
  assert.equal(at({isFrozen:true},800),'hit');
  assert.equal(at({isFrozen:true},1100),'frozen');
  assert.equal(at({isFrozen:false},1200),'recovery');
  assert.equal(at({},1750),'idle');
  assert.equal(at({ended:true,winner:'blue'},1700),'victory');
  assert.equal(at({ended:true,winner:'red'},1701),'idle');
});

test('effect pool is bounded, expires and low quality reduces burst density',()=>{
  const fx=new EffectPool(40);fx.burst(0,0,'#fff',500,'player');
  assert.equal(fx.items.length,40);fx.update(16);assert.ok(fx.activeCount<=40);
  fx.update(1000);assert.equal(fx.activeCount,0);
  fx.lowQuality=true;fx.burst(0,0,'#fff',20,'player');fx.update(1);
  assert.ok(fx.activeCount<=10); // Nine flakes plus one ring.
});

test('projectile tracking differentiates ground miss from marked impact without mutating simulation data',()=>{
  const fx=new EffectPool(30),tracker=new ProjectileVisualizer(fx);
  const ball={x:10,y:10,z:4,ownerId:'p',team:'blue',kind:undefined};
  const before=JSON.stringify(ball);tracker.sync([ball],0);tracker.sync([],34);
  assert.ok(fx.items.some(p=>p.active));assert.equal(JSON.stringify(ball),before);
  fx.clear();
  tracker.markImpact(10,10,100);tracker.sync([ball],100);tracker.sync([],134);
  assert.equal(fx.items.some(p=>p.active),false);
});
