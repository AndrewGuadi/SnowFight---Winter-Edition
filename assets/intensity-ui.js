/* SnowFight contest-intensity: audiovisual cues from authoritative combat events.
 * Keeps input limited to Move + Throw. No new external assets or dependencies.
 */
(()=>{
 'use strict';
 const toast=document.createElement('div');
 toast.id='snow-intensity-toast';toast.className='snow-intensity-toast';toast.hidden=true;
 toast.setAttribute('role','status');toast.setAttribute('aria-live','polite');toast.setAttribute('aria-atomic','true');
 document.body.appendChild(toast);
 let lastEvent=0,lastKey='',serial=0,lastMode=null,lastHolder=null,wasOvertime=false,finalWarning=false;
 const motionReduced=()=>window.matchMedia?.('(prefers-reduced-motion: reduce)').matches||STATE.lowEffects===true;
 function announce(label,kind='cool',key=label){
   const now=performance.now();
   if(key===lastKey && now-lastEvent<1800)return;
   if(now-lastEvent<420 && kind!=='urgent')return;
   lastKey=key;lastEvent=now;
   toast.textContent=label;toast.dataset.kind=kind;
   toast.hidden=false;toast.classList.remove('show');
   // A fresh style/layout pass replays the short motion, without perpetual timers.
   void toast.offsetWidth;
   if(!motionReduced())toast.classList.add('show');
   const current=++serial;
   setTimeout(()=>{if(current===serial){toast.hidden=true;toast.classList.remove('show')}},1450);
 }
 function chime(low=false){
   if(Audio.muted)return;
   Audio.playTone(low?270:860,low?'triangle':'sine',0.13,0.12,low?85:320);
 }
 socket.on('init',data=>{
   lastMode=data.match?.gameMode||'brawl';
   lastHolder=null;wasOvertime=false;finalWarning=false;
   toast.hidden=true;serial++;
 });
 socket.on('disconnect',()=>{toast.hidden=true;serial++;lastHolder=null;wasOvertime=false});
 socket.on('effect',e=>{
   if(e.type==='snow_clash'){
      SNOW_PROJECTILES.markImpact(e.x,e.y,performance.now());
      createParticles(e.x,e.y,'#f8fcff',22,'blocked');
      createParticles(e.x,e.y,'#a5dafa',7,'flake');
      if((e.owners||[]).includes(STATE.id)){
        addPopup(e.x,e.y-38,'SNOWBALL CLASH!','#5ea8d9');
        announce('❄ SNOWBALL CLASH!','cool','clash-'+Math.floor(performance.now()/600));
      }
      const me=STATE.players[STATE.id];
      if(me && Math.hypot(me.x-e.x,me.y-e.y)<550)chime(true);
   }
   if(e.type==='close_call'&&e.id===STATE.id){
      createParticles(e.x,e.y,'#fff5b7',8,'flake');
      addPopup(e.x,e.y-42,'CLOSE CALL!','#ffcf5e');
      announce('⚡ NICE DODGE!','warm','dodge');
      chime(false);
      if(!motionReduced())CONFIG.screenShake=Math.max(CONFIG.screenShake||0,2);
   }
   if(e.type==='pow_last_stand'){
      if(e.team===STATE.team){
        announce('🚨 LAST KID FREE — BREAK YOUR TEAM OUT!','urgent','last-'+e.team);
        chime(true);
      }else announce('⚡ ONLY ONE OPPONENT STILL FREE!','warm','enemy-last-'+e.team);
   }
   if(e.type==='pow_gate_rush'){
      if(e.team===STATE.team){
        announce('🔓 ONE SECOND — KEEP RESCUING!','urgent','gate-'+e.team);
        chime(false);
      }else announce('⚠ ENEMY FORT GATE IS OPENING!','urgent','enemy-gate-'+e.team);
   }
   if(e.type==='pow_breakout_wave'){
      createParticles(e.x,e.y,'#d9f7ff',26,'release');
      if(e.team===STATE.team){
        announce('🌨 BREAKOUT SNOW WAVE!','urgent','wave-'+e.team);
        addPopup(e.x,e.y-40,'SHOTS BLOCKED: '+e.cleared,'#b2ecff');
      }
   }
   if(e.type==='pow_release'&&e.team===STATE.team){
      announce('🎉 TEAM BREAKOUT!','urgent','breakout-'+e.team);
   }
 });
 socket.on('state',s=>{
   const m=s.match;if(!m)return;
   if(m.gameMode!=='pow'){
      if(m.overtime&&!wasOvertime){wasOvertime=true;announce('⚡ SUDDEN DEATH — NEXT FREEZE WINS!','urgent','overtime');chime(true)}
      if(!m.overtime&&!finalWarning&&m.timeLeft!==null&&m.timeLeft<=10&&m.timeLeft>0){
        finalWarning=true;announce('⏱ FINAL TEN SECONDS!','urgent','final-ten');chime(false);
      }
   }else if(m.pow?.flag){
      const holder=m.pow.flag.holder;
      if(holder&&holder!==lastHolder){
        announce(holder===STATE.team?'🚩 YOUR TEAM TAKES THE FLAG!':'🚩 THE OTHER TEAM TAKES THE FLAG!',holder===STATE.team?'cool':'warm','flag-'+holder);
      }
      lastHolder=holder;
   }
 });
 // Expose only simple presentation state for browser smoke checks.
 window.SNOW_INTENSITY={get label(){return toast.textContent},get visible(){return !toast.hidden}};
})();
