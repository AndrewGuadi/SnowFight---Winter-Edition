// SnowFight Modes — additive arcade game-mode controls (no external dependencies).
(() => {
 'use strict';
 const front=document.getElementById('front-door');if(!front)return;
 MENU.gameMode='brawl';
 const chooser=document.createElement('section');chooser.id='arcade-mode-picker';chooser.className='arcade-mode-picker';
 chooser.innerHTML='<h2>CHOOSE YOUR SNOW DAY</h2><div class="arcade-mode-grid">'+
  '<button class="arcade-mode selected" data-mode="brawl"><b>❄ NEIGHBORHOOD BRAWL</b><span>Live snowball battles, friends & teams</span></button>'+
  '<button class="arcade-mode" data-mode="pow"><b>🚩 SNOWFORT RESCUE</b><span>Get tagged, break teammates out of jail, hold the flag</span></button>'+
  '<button class="arcade-mode" data-mode="adventure"><b>🛷 SNOW DAY ADVENTURES</b><span>Save Mr. Frosty — a silly side-scrolling mission</span></button></div>';
 front.prepend(chooser);
 const modeButtons=[...chooser.querySelectorAll('.arcade-mode')];
 function choose(mode){
  MENU.gameMode=mode;
  for(const b of modeButtons)b.classList.toggle('selected',b.dataset.mode===mode);
  const isAdventure=mode==='adventure',isPow=mode==='pow';
  const online=front.querySelector('#btn-play-online'),practice=front.querySelector('#btn-play-quick');
  if(online){online.hidden=isAdventure;online.textContent=isPow?'🚩 PLAY SNOWFORT':'❄ PLAY ONLINE'}
  if(practice){practice.hidden=isPow||isAdventure}
  const friends=front.querySelector('#foundation-friends');
  if(friends)friends.hidden=isAdventure;
  if(isAdventure)launchAdventure();
 }
 modeButtons.forEach(b=>b.addEventListener('click',()=>choose(b.dataset.mode)));
 // POW mode is selected before joinGame, which now transmits gameMode.
 const status=document.createElement('div');status.id='pow-mode-hud';status.className='pow-mode-hud';status.hidden=true;
 status.innerHTML='<div class="pow-hud-title">🚩 SNOWFORT RESCUE</div><div id="pow-prison-count">BLUE 0 POW · RED 0 POW</div>'+
 '<div id="pow-flag">FLAG NEUTRAL</div><div id="pow-rescue-progress">GET TO YOUR TEAM GATE TO RESCUE</div>'+
 '<button type="button" id="pow-interact" aria-label="Hold to rescue teammates">HOLD TO RESCUE</button>';
 document.body.appendChild(status);
 const action=status.querySelector('#pow-interact');
 function stop(){STATE.inputs.interact=false}
 action.addEventListener('pointerdown',e=>{e.preventDefault();action.setPointerCapture?.(e.pointerId);STATE.inputs.interact=true});
 for(const name of ['pointerup','pointercancel','lostpointercapture'])action.addEventListener(name,stop);
 window.addEventListener('blur',stop);
 document.addEventListener('visibilitychange',()=>{if(document.hidden)stop()});
 window.addEventListener('keydown',e=>{if(e.key.toLowerCase()==='r'&&STATE.id&&MENU.gameMode==='pow')STATE.inputs.interact=true});
 window.addEventListener('keyup',e=>{if(e.key.toLowerCase()==='r')stop()});
 socket.on('init',data=>{MENU.gameMode=data.match?.gameMode||'brawl';status.hidden=MENU.gameMode!=='pow'});
 socket.on('disconnect',()=>{status.hidden=true;stop()});
 socket.on('state',state=>{
  if(state.match?.gameMode!=='pow'||!state.match.pow){status.hidden=true;return}
  status.hidden=false;
  const p=state.match.pow;
  status.querySelector('#pow-prison-count').textContent='BLUE '+p.captured.blue+' POW · RED '+p.captured.red+' POW';
  status.querySelector('#pow-flag').textContent='🚩 '+(p.flag.holder ? p.flag.holder.toUpperCase()+' HOLDS THE FLAG':'CONTEST THE CENTER')+
    (p.flag.buffs?.[STATE.team]?.kind?' · '+p.flag.buffs[STATE.team].kind:'');
  const team=STATE.team||'blue';
  status.querySelector('#pow-rescue-progress').textContent=
    (p.captured[team]?'GATE '+Math.round(100*p.rescue[team]/120)+'% · HOLD R AT YOUR FORT':'NO TEAMMATES CAPTURED');
  action.disabled=!p.captured[team]||!!STATE.players[STATE.id]?.captured;
 });
 // Canvas decoration uses the exact map coordinates supplied by server snapshots.
 const overlay=document.createElement('canvas');overlay.id='pow-minimap';overlay.width=300;overlay.height=145;
 overlay.style.cssText='position:absolute;right:12px;bottom:95px;width:170px;height:82px;pointer-events:none;z-index:39;border:2px solid #fff9;border-radius:12px;box-shadow:0 6px 18px #153e5588';
 overlay.hidden=true;document.body.appendChild(overlay);
 socket.on('state',state=>{
  const pow=state.match?.pow;overlay.hidden=!pow;if(!pow)return;
  const c=overlay.getContext('2d');c.clearRect(0,0,300,145);c.fillStyle='#cbe9f4';c.fillRect(0,0,300,145);
  const point=(x,y)=>[x/10,y/2000*145];
  for(const team of ['blue','red']){
   c.fillStyle=team==='blue'?'#438db9':'#dd7877';
   const j=pow.map.jails[team],p=point(j.x,j.y);c.fillRect(p[0]-12,p[1]-8,24,16);
   const pad=point(pow.map.pads[team].x,pow.map.pads[team].y);
   c.strokeStyle='#fff';c.lineWidth=2;c.strokeRect(pad[0]-4,pad[1]-4,8,8);
  }
  c.fillStyle='#f9c94e';c.beginPath();c.arc(150,72,12,0,Math.PI*2);c.fill();
  for(const p of Object.values(state.players||{})){
   const [x,y]=point(p.x,p.y);c.fillStyle=p.captured?'#586775':p.team==='blue'?'#247ba9':'#ce5757';
   c.beginPath();c.arc(x,y,p.id===STATE.id?4:2.8,0,Math.PI*2);c.fill();
  }
 });
 function launchAdventure(){
  if(window.SnowAdventure?.start)window.SnowAdventure.start();
 }
})();
