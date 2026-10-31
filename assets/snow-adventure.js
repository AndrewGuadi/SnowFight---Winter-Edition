/* Snow Day Adventures — standalone browser platformer vertical slice.
 * Original Canvas art, no backend dependency, no effect on authoritative PvP.
 */
(()=>{'use strict';
 let root,canvas,c,run=false,frame=0,last=0,accumulator=0,keys=new Set(),touch={left:false,right:false,jump:false,throw:false},jumpQueued=0;
 const W=960,H=540,GROUND=420,STAGE=3100;
 let p,items,snowman,baddies,shots,enemyShots,bursts,blockedShots,notice,noticeUntil,camera,timer,started,won,failed;
 const Combat=window.SnowAdventureCombat;
 if(!Combat)throw Error('Load adventure-combat.js before Snow Day Adventures');
 function cue(text){notice=text;noticeUntil=frame+80}
 function puff(x,y,color='#f1fbff'){
  for(let i=0;i<7&&bursts.length<56;i++){const a=i*Math.PI*2/7;bursts.push({x,y,vx:Math.cos(a)*2,vy:Math.sin(a)*2,life:26,color})}
 }
 function make(){
  root=document.createElement('div');root.id='snow-adventure';root.hidden=true;root.style.cssText='display:none;position:fixed;inset:0;z-index:99;background:#cdeaf7;display:grid;place-items:center;overflow:hidden';
  root.innerHTML='<div style="position:absolute;top:8px;left:12px;z-index:2;font:900 16px system-ui;color:#174e6c" id="adv-hud"></div>'+
   '<button id="adv-close" style="position:absolute;right:12px;top:12px;z-index:5;background:#153e55;color:white;border:0;border-radius:12px;padding:10px 15px;font-weight:bold">EXIT</button>'+
   '<canvas id="adv-canvas" width="960" height="540" style="width:100%;height:100%;object-fit:contain;touch-action:none"></canvas>'+
   '<div style="position:absolute;bottom:25px;left:16px;z-index:3;display:flex;gap:9px"><button data-touch="left">◀</button><button data-touch="right">▶</button></div>'+
   '<div style="position:absolute;bottom:25px;right:16px;z-index:3;display:flex;gap:9px"><button data-touch="jump">JUMP</button><button data-touch="throw">THROW</button></div>';
  document.body.appendChild(root);canvas=root.querySelector('canvas');c=canvas.getContext('2d');
  root.querySelector('#adv-close').onclick=stop;
  for(const b of root.querySelectorAll('[data-touch]')){b.style.cssText='padding:14px;background:#f6f9ffdb;border:2px solid #fff;border-radius:15px;min-width:68px;font-weight:900;color:#285675;touch-action:none';const id=b.dataset.touch;
   b.addEventListener('pointerdown',e=>{e.preventDefault();b.setPointerCapture(e.pointerId);touch[id]=true;if(id==='jump')jumpQueued=7});
   for(const event of ['pointerup','pointercancel','lostpointercapture'])b.addEventListener(event,()=>touch[id]=false);
  }
  window.addEventListener('keydown',e=>{if(!run)return;keys.add(e.key.toLowerCase());if([' ','arrowup','w'].includes(e.key.toLowerCase())){jumpQueued=7;e.preventDefault()}if(e.key==='Escape')stop()});
  window.addEventListener('keyup',e=>keys.delete(e.key.toLowerCase()));
  window.addEventListener('blur',()=>{keys.clear();for(const k in touch)touch[k]=false});
 }
 function reset(){
  p={x:80,y:GROUND-50,w:33,h:50,vx:0,vy:0,grounded:false,coyote:0,checkpoint:80,balls:2,
      facing:1,hearts:3,invuln:0,hitFreeze:0};
  items=[{x:540,y:270},{x:1430,y:260},{x:2480,y:315}];snowman={x:2910,hp:3};
  baddies=[
   {x:1080,v:.8,min:1030,max:1250,stun:0,cooldown:65},
   {x:2230,v:-.9,min:2110,max:2360,stun:0,cooldown:85},
   {x:2680,v:.9,min:2590,max:2760,stun:0,cooldown:75},
   {x:2810,v:-.6,min:2760,max:2880,stun:0,cooldown:100},
   {x:3020,v:-.8,min:2950,max:3060,stun:0,cooldown:120}
  ];
  shots=[];enemyShots=[];bursts=[];notice='';noticeUntil=0;blockedShots=0;
  camera=0;timer=120;started=performance.now();won=false;failed=false;frame=0;last=performance.now();accumulator=0;
}
 function platform(x){if(x>=720&&x<960)return 390;if(x>=1180&&x<1330)return 360;if(x>=1900&&x<2140)return 330;return GROUND}
 function simulate(dt){
  if(won||failed)return;
  const input=Number(keys.has('arrowright')||keys.has('d')||touch.right)-Number(keys.has('arrowleft')||keys.has('a')||touch.left);
  const dx=p.hitFreeze>0?0:input;
  if(dx)p.facing=dx>0?1:-1;
  p.vx+=dx*0.75;p.vx*=p.x>1620&&p.x<1920?0.985:0.82;p.vx=Math.max(-6,Math.min(6,p.vx));
  if(jumpQueued>0)jumpQueued--;if(p.grounded)p.coyote=6;else p.coyote=Math.max(0,p.coyote-1);
  if(jumpQueued&&p.coyote){p.vy=-12.7;p.grounded=false;p.coyote=0;jumpQueued=0}
  p.vy=Math.min(13,p.vy+0.55);p.x=Math.max(0,Math.min(STAGE-40,p.x+p.vx));p.y+=p.vy;
  const ground=platform(p.x);
  if(p.y+p.h>=ground&&p.vy>=0){p.y=ground-p.h;p.vy=0;p.grounded=true}else p.grounded=false;
  if(p.y>H+100){p.x=p.checkpoint;p.y=220;p.vx=p.vy=0}
  if(p.x>970&&p.checkpoint<970)p.checkpoint=970;if(p.x>2050&&p.checkpoint<2050)p.checkpoint=2050;
  const itemCount=items.length;items=items.filter(it=>Math.hypot(p.x-it.x,p.y+25-it.y)>51);
  if(items.length<itemCount){cue('✨ ACCESSORY FOUND!');puff(p.x,p.y,'#ffe3a0')}
  if((touch.throw||keys.has('f'))&&p.balls>0&&frame%17===0){
    shots.push({x:p.x+(p.facing>0?25:-8),y:p.y+17,v:12*p.facing,dead:false});p.balls--;
  }
  if(frame%55===0)p.balls=Math.min(3,p.balls+1);
  for(const ball of shots){
    if(ball.dead)continue;ball.x+=ball.v;
    if(ball.x>STAGE||ball.x<0){ball.dead=true;continue}
    for(const bot of baddies){
      if(ball.dead||Math.abs(ball.x-bot.x)>22||Math.abs(ball.y-(GROUND-49))>38)continue;
      if(Combat.hitEnemy(bot,ball)){cue('❄ COUNTERSHOT!');puff(bot.x,GROUND-50,'#ccf5ff')}
      ball.dead=true;
    }
  }
  for(const bot of baddies){
    if(bot.stun>0){bot.stun--;continue}
    bot.x+=bot.v;
    if(bot.x<bot.min||bot.x>bot.max){bot.v*=-1;bot.x=Math.max(bot.min,Math.min(bot.max,bot.x))}
    if(Math.abs(p.x-bot.x)<520 && --bot.cooldown<=0){
      if(enemyShots.length<Combat.MAX_SHOTS)enemyShots.push(Combat.launch(bot,p,GROUND));
      bot.cooldown=115+(Math.floor(bot.x)%35);
    }
    if(p.x>2650&&items.length===0&&frame%240===0&&Math.abs(bot.x-snowman.x)<75)snowman.hp--;
  }
  const blocked=Combat.intercept(shots,enemyShots);
  if(blocked){blockedShots+=blocked;cue('🛡 MID-AIR BLOCK!');puff(p.x+30,p.y+15,'#b7ebff')}
  const hits=Combat.step(enemyShots,p,GROUND);
  if(hits){cue(p.hearts?'💥 SNOWBALLED! KEEP MOVING!':'💥 OUT OF HEARTS!');puff(p.x,p.y+12,'#ffe0d1');if(!p.hearts)failed=true}
  shots=shots.filter(b=>!b.dead);enemyShots=enemyShots.filter(b=>!b.dead);
  for(const b of bursts){b.x+=b.vx;b.y+=b.vy;b.vy+=.06;b.life--}
  bursts=bursts.filter(b=>b.life>0);
  if(p.x>2650&&items.length===0){
    if(snowman.hp<=0)failed=true;
    if(p.x>2880&&(performance.now()-started)>20000&&!failed)won=true;
  }
  if(performance.now()-started>=120000){failed=true}
  timer=Math.max(0,120-Math.floor((performance.now()-started)/1000));
 }
 function rounded(x,y,w,h,color,r=12){c.fillStyle=color;c.beginPath();c.roundRect(x,y,w,h,r);c.fill()}
 function draw(){
  c.clearRect(0,0,W,H);const sky=c.createLinearGradient(0,0,0,H);sky.addColorStop(0,'#8dd0f1');sky.addColorStop(1,'#effaff');c.fillStyle=sky;c.fillRect(0,0,W,H);
  camera+=(Math.max(0,Math.min(STAGE-W,p.x-330))-camera)*0.12;
  // Background parallax, pillowy snow banks, and tall postcard houses.
  for(let i=0;i<18;i++){const x=i*240-camera*0.45;rounded(x,220,148,250,i%2?'#a8d2e8':'#e5c5c7',10);
   c.fillStyle='#d9eefa';c.beginPath();c.moveTo(x-10,223);c.lineTo(x+75,138);c.lineTo(x+158,223);c.fill();rounded(x+47,290,43,70,'#658faa',4)}
  c.save();c.translate(-camera,0);
  rounded(0,GROUND,STAGE,H-GROUND,'#d9f2f7',0);
  for(let x=0;x<STAGE;x+=48){let y=platform(x);rounded(x,y,50,H-y,'#f8fcff',2);c.fillStyle='#d0edf5';c.fillRect(x,y+9,50,5)}
  // Snowbank hazards and ice travel.
  rounded(1620,GROUND-7,300,13,'#81d6f2',7);
  for(const it of items){c.fillStyle='#ffd97e';c.beginPath();c.arc(it.x,it.y,19,0,Math.PI*2);c.fill();c.fillStyle='#ad5b4a';c.fillText('★',it.x-9,it.y+8)}
  // Mr. Frosty waiting at the finish.
  c.fillStyle='#fff';for(const [x,y,r] of [[snowman.x,GROUND-35,38],[snowman.x,GROUND-92,27]]){c.beginPath();c.arc(x,y,r,0,7);c.fill()}
  c.fillStyle='#ef7749';c.beginPath();c.moveTo(snowman.x,GROUND-92);c.lineTo(snowman.x+26,GROUND-86);c.lineTo(snowman.x,GROUND-82);c.fill();
  for(const b of baddies){
   rounded(b.x-16,GROUND-54,32,46,b.stun>0?'#9bd7ee':'#db7e86');
   c.fillStyle='#fff';c.beginPath();c.arc(b.x,GROUND-59,17,0,7);c.fill();
   if(b.stun>0){c.fillStyle='#328bb9';c.font='900 16px system-ui';c.fillText('✦',b.x-7,GROUND-75)}
   else if(b.cooldown<16&&Math.abs(p.x-b.x)<520){c.strokeStyle='#f29c55';c.lineWidth=4;c.beginPath();c.arc(b.x,GROUND-59,25,0,7);c.stroke()}
  }
  const outfit=window.SNOW_GUEST?.get()||{skin:'#DEAC82',jacket:'#367FB6',hat:'#DB4E51'};
  rounded(p.x,p.y+18,32,31,outfit.jacket,10);
  c.fillStyle=outfit.skin;c.beginPath();c.arc(p.x+16,p.y+16,16,0,7);c.fill();
  if(p.invuln>0){c.strokeStyle='#9be6fa';c.lineWidth=3;c.beginPath();c.ellipse(p.x+16,p.y+18,26,37,0,0,7);c.stroke()}
  rounded(p.x+2,p.y-3,28,15,outfit.hat,7);rounded(p.x+9,p.y-12,14,12,'#fff',8);
  for(const b of shots){c.fillStyle='#fff';c.beginPath();c.arc(b.x,b.y,7,0,7);c.fill()}
  for(const b of enemyShots){c.fillStyle='#ffe0dc';c.strokeStyle='#bd5360';c.lineWidth=2;c.beginPath();c.arc(b.x,b.y,8,0,7);c.fill();c.stroke()}
  for(const b of bursts){c.globalAlpha=Math.max(0,b.life/26);c.fillStyle=b.color;c.beginPath();c.arc(b.x,b.y,4,0,7);c.fill()}
  c.globalAlpha=1;c.restore();
  root.querySelector('#adv-hud').textContent='🛷 SAVE MR. FROSTY · ♥ '+p.hearts+'/3 · ACCESSORIES '+(3-items.length)+'/3 · '+timer+'s · SNOWMAN '+snowman.hp+'/3';
  if(frame<noticeUntil&&notice){c.textAlign='center';c.font='900 24px system-ui';c.fillStyle='#174e6c';c.fillText(notice,480,115);c.textAlign='left'}

  if(won||failed){rounded(180,160,600,180,'#153e55e8',24);c.textAlign='center';c.fillStyle='#fff';c.font='900 34px system-ui';c.fillText(won?'❄ MR. FROSTY IS SAVED!':'☃ SNOW DAY DO-OVER!',480,238);c.font='bold 18px system-ui';c.fillText('Press ENTER to try again · EXIT to return to the modes',480,275);c.textAlign='left'}
 }
 function loop(now){if(!run)return;const dt=Math.min(50,Math.max(0,now-last));last=now;accumulator+=dt;
  let steps=0;while(accumulator>=1000/60&&steps<4){frame++;simulate(1000/60);accumulator-=1000/60;steps++}
  draw();requestAnimationFrame(loop)}
 function start(){if(!root)make();reset();root.hidden=false;root.style.display='grid';run=true;requestAnimationFrame(loop)}
 function stop(){run=false;if(root){root.hidden=true;root.style.display='none'}keys.clear()}
 window.addEventListener('keydown',e=>{if(run&&(won||failed)&&e.key==='Enter')reset()});
 window.SnowAdventure={start,stop,inspect:()=>p?{x:p.x,y:p.y,grounded:p.grounded,itemsRemaining:items.length,hearts:p.hearts,invuln:p.invuln,enemyShots:enemyShots.length,blockedShots,enemyStuns:baddies.filter(b=>b.stun>0).length,notice,won,failed,active:run}:null};
})();
