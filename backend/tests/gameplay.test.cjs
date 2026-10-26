const {test}=require('node:test');
const assert=require('node:assert/strict');
const {sanitizeInput,segmentHit}=require('../gameplay');
test('reject malformed controls before they reach physics',()=>{
 for(const input of [null,{},'bad',{moveX:NaN,moveY:0,angle:0},{moveX:0,moveY:Infinity,angle:0},{moveX:0,moveY:0,angle:'0'}]) assert.equal(sanitizeInput(input),null);
});
test('normalize diagonal movement and accept only boolean actions',()=>{
 const p=sanitizeInput({moveX:100,moveY:100,angle:8,dash:'yes',gather:true,cancelCharge:true});
 assert.ok(Math.abs(Math.hypot(p.moveX,p.moveY)-1)<1e-10); assert.equal(p.dash,false);assert.equal(p.gather,true);assert.equal(p.cancelCharge,true);
});
test('swept snowballs cannot tunnel through a small target',()=>{
 assert.equal(segmentHit(0,0,100,0,50,0,10),.4);
 assert.equal(segmentHit(0,0,100,0,50,11,10),null);
 assert.equal(segmentHit(0,0,0,0,0,0,10),0);
 assert.equal(segmentHit(0,0,0,0,30,0,10),null);
 assert.ok(segmentHit(0,0,100,0,20,0,5)<segmentHit(0,0,100,0,60,0,5));
});
