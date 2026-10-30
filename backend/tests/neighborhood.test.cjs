const {test}=require('node:test');const assert=require('node:assert/strict');
const {makeNeighborhood,PARENT}=require('../neighborhood');
const {createMatch,ServerPlayer,ServerSnowball,tickMatch,matches}=require('../server');
test('arena cover is symmetric and keeps the hill center and spawn lanes open',()=>{
 const a=makeNeighborhood(()=>0.5);assert.equal(a.length,20);
 for(const o of a){assert.ok(a.some(p=>p.x===3000-o.x&&p.y===o.y&&p.radius===o.radius&&p.type===o.type));assert.ok(Math.hypot(o.x-1500,o.y-1000)>250);assert.ok(o.x>250&&o.x<2750);}
});
test('parent reacts once to a nearby snowball without absorbing it or scoring',()=>{
 const m=createMatch('multi',1,1);m.obstacles=[];let events=[];m.emit=(e,d)=>events.push({e,d});m.emitVolatile=()=>{};
 const p=new ServerPlayer('human','blue',false);p.x=100;p.y=100;m.players[p.id]=p;
 m.snowballs.push(new ServerSnowball(PARENT.x-10,PARENT.y,0,12,'human','blue',0));tickMatch(m);
 assert.equal(events.filter(x=>x.d.type==='parent_react').length,1);assert.equal(m.snowballs.length,1);assert.deepEqual(m.score,{blue:0,red:0});
 m.snowballs.push(new ServerSnowball(PARENT.x-10,PARENT.y,0,12,'human','blue',0));tickMatch(m);
 assert.equal(events.filter(x=>x.d.type==='parent_react').length,1);matches.clear();
});
test('both teams have open routes into the hill for multiple layouts',()=>{
 for(let seed=0;seed<30;seed++) {
  let n=seed+1;const rand=()=>((n=n*16807%2147483647)/2147483647),obs=makeNeighborhood(rand);
  for(const startX of [200,2800]) {
   const step=50, start=[startX/step,20],queue=[start],seen=new Set([start.join(',')]);let found=false;
   while(queue.length){const [x,y]=queue.shift(),wx=x*step,wy=y*step;if(Math.hypot(wx-1500,wy-1000)<=200){found=true;break;}
    for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){const nx=x+dx,ny=y+dy,key=`${nx},${ny}`;if(nx<0||nx>60||ny<0||ny>40||seen.has(key)||obs.some(o=>Math.hypot(nx*step-o.x,ny*step-o.y)<o.radius+20))continue;seen.add(key);queue.push([nx,ny]);}
   }
   assert.equal(found,true,`seed ${seed}, spawn ${startX}`);
  }
 }
});
