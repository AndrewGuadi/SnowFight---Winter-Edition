/* Snow Day Adventures combat helpers (pure and independently testable).
 * Snowballs are dodgeable, stuns are temporary, and short invulnerability
 * prevents an unfair instant triple-hit. No additional player buttons.
 */
(function(root,factory){
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root)root.SnowAdventureCombat=api;
})(typeof window==='object'?window:null,function(){
 const INVULNERABLE=72, ENEMY_STUN=90, MAX_SHOTS=22;
 function clamp(n,min,max){return Math.max(min,Math.min(max,n))}
 function launch(enemy,player,ground=420){
   const x=enemy.x,y=ground-59;
   const targetX=player.x+player.w/2,targetY=player.y+player.h/2;
   const dx=targetX-x;
   const vx=(dx>=0?1:-1)*5.5;
   const flight=Math.max(15,Math.abs(dx)/5.5);
   const vy=clamp((targetY-y)/flight,-2.7,2.7)-.45;
   return {x,y,vx,vy,ttl:108,dead:false};
 }
 function touches(shot,p,extra=7){
   return shot.x>=p.x-extra&&shot.x<=p.x+p.w+extra&&
     shot.y>=p.y-extra&&shot.y<=p.y+p.h+extra;
 }
 function step(shots,p,ground=420) {
   if(p.invuln>0)p.invuln--;
   if(p.hitFreeze>0)p.hitFreeze--;
   let hits=0;
   for(const s of shots){
     if(s.dead)continue;
     s.x+=s.vx;s.y+=s.vy;s.vy+=0.018;s.ttl--;
     if(s.ttl<=0||s.y>ground+16||s.x<0||s.x>3300){s.dead=true;continue}
     if(p.invuln>0||!touches(s,p))continue;
     s.dead=true;p.hearts=Math.max(0,p.hearts-1);p.invuln=INVULNERABLE;
     p.hitFreeze=10;p.vx=s.vx>=0?6.5:-6.5;p.vy=-6.4;p.grounded=false;hits++;
   }
   return hits;
 }
 function hitEnemy(enemy,shot){
   if(enemy.stun>0)return false;
   enemy.stun=ENEMY_STUN;
   enemy.x+=Math.sign(shot.v||1)*26;
   return true;
 }
 function intercept(playerShots,enemyShots){
   let blocked=0;
   for(const p of playerShots){
     if(p.dead)continue;
     for(const e of enemyShots){
       if(e.dead)continue;
       if(Math.hypot(p.x-e.x,p.y-e.y)<=16){
         p.dead=true;e.dead=true;blocked++;break;
       }
     }
   }
   return blocked;
 }
 return {INVULNERABLE,ENEMY_STUN,MAX_SHOTS,launch,touches,step,hitEnemy,intercept};
});
