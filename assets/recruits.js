/* Procedural character art: lightweight canvas shapes, no texture downloads. */
window.SNOW_RECRUITS = {
 glacier:{name:'Glacier',role:'HEAVY / HOLD THE LINE',ability:'ICE GUARD',detail:'Oversized snowballs. A two-second guard absorbs one hit.',trade:'80% run speed · 1.0s pack · 8s guard cooldown',accent:'#65daf1'},
 snowbug:{name:'Snowbug',role:'ARTILLERY / BREAK THE LINE',ability:'CANNON',detail:'Three-ball volleys. Charge to tighten the spread. Fire a heavy cannon shot with your ability.',trade:'95% run speed · 1.08s pack · 7s cannon cooldown',accent:'#ffc877'},
 frostweaver:{name:'Frostweaver',role:'MARKSMAN / SHAPE THE FIELD',ability:'IGLOO',detail:'Long arms launch fast, precise snowballs. Build an igloo ahead to block incoming fire.',trade:'108% run speed · 0.83s pack · 12s igloo cooldown',accent:'#b5a1ff'},
 classic:{name:'Classic',role:'ORIGINAL / ALL-ROUNDER',ability:'CLASSIC',detail:'The original snowball fighter, unchanged. Dash, pack, charge and throw.',trade:'100% run speed · 0.75s pack · no special ability',accent:'#a9d4e2'}
};
const SNOW_COLOR_CACHE = new Map();
function snowShade(hex, amount) {
 const key=hex+amount;if(SNOW_COLOR_CACHE.has(key))return SNOW_COLOR_CACHE.get(key);
 const n=parseInt(hex.slice(1),16), clamp=v=>Math.max(0,Math.min(255,v));
 const color='#'+[(n>>16)+amount,((n>>8)&255)+amount,(n&255)+amount].map(v=>clamp(v).toString(16).padStart(2,'0')).join('');
 SNOW_COLOR_CACHE.set(key,color);return color;
}
window.drawSnowRecruit = function(c,p,time=0) {
 const id=p.classId, team=p.team==='red'?'#ec7471':'#248bb6', dark=p.team==='red'?'#863d58':'#1b4666';
 const move=Math.sin(p.walkCycle||0), aim=p.facingAngle||0, recoil=p.recoil||0;
 const state=p.animState||'idle', stateTime=p.stateTime||0, reduced=!!p.reducedMotion;
 const ellipse=(x,y,rx,ry,color)=>{c.fillStyle=color;c.beginPath();c.ellipse(x,y,rx,ry,0,0,Math.PI*2);c.fill()};
 const line=(points,color,width)=>{c.strokeStyle=color;c.lineWidth=width;c.lineCap='round';c.lineJoin='round';c.beginPath();points.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.stroke()};
 c.save();
 ellipse(0,12,id==='glacier'?26:21,7,'#14384e25');
 if(id==='classic') {
   // Original layered winter kid: every palette combination reuses this geometry.
   const skin=p.skinColor||'#DEAC82', jacket=p.jacketColor||team, hat=p.hatColor||'#DB4E51';
   const jacketDark=snowShade(jacket,-34), hatDark=snowShade(hat,-28);
   const walking=state==='walking'||state==='running', running=state==='running';
   const step=walking?move:0, bounce=reduced?0:(running?Math.abs(move)*2.2:walking?Math.abs(move)*1.2:Math.sin(time/540)*.55);
   const hit=state==='hit'?Math.max(0,1-stateTime/340):0;
   const recovering=state==='recovery'?Math.max(0,1-stateTime/480):0;
   const throwing=state==='throw', throwDuration=p.throwKind==='charged'?340:240;
   const throwPhase=throwing?Math.min(1,stateTime/throwDuration):0;
   const throwSwing=throwing?Math.sin(throwPhase*Math.PI):0;
   const victory=state==='victory'?1:0, aimX=Math.cos(aim), aimY=Math.sin(aim);
   const faceX=aimX*1.8, faceY=aimY*1.3;
   c.save();
   // Team identity stays on the ground and never depends on cosmetic colors.
   c.strokeStyle='#f8fdff';c.lineWidth=5;c.beginPath();c.ellipse(0,8,24,13,0,0,Math.PI*2);c.stroke();
   c.strokeStyle=team;c.lineWidth=2.5;c.beginPath();c.ellipse(0,8,24,13,0,0,Math.PI*2);c.stroke();
   c.translate(0,-bounce+(victory&&!reduced?-Math.abs(Math.sin(stateTime/130))*5:0));
   c.rotate(hit*-.13+(recovering&&!reduced?Math.sin(stateTime*.075)*.09:0));
   c.scale(1+hit*.17,1-hit*.13);
   // Chunky boots and an exaggerated but economical step cycle.
   ellipse(-7-step*(running?6:4),10+step*2,6.5,7,'#263b4d');
   ellipse(7+step*(running?6:4),10-step*2,6.5,7,'#263b4d');
   ellipse(-8-step*3,8+step*2,5,2,'#91b5c4');ellipse(8+step*3,8-step*2,5,2,'#91b5c4');
   // Scarf and pom-pom lag behind movement for soft secondary motion.
   line([[-7,-20],[-13-aimX*5,-15-step*2],[-20-aimX*7,-12+step*3]],hatDark,6);
   line([[-7,-21],[-13-aimX*5,-16-step*2],[-20-aimX*7,-13+step*3]],hat,4);
   // Torso: dark side seams, bright center, zipper and a small snow highlight.
   c.fillStyle=jacketDark;c.beginPath();c.roundRect(-16,-23,32,36,12);c.fill();
   c.fillStyle=jacket;c.beginPath();c.roundRect(-13,-23,26,33,10);c.fill();
   c.fillStyle=snowShade(jacket,24);c.beginPath();c.roundRect(-9,-20,7,22,4);c.fill();
   line([[1,-19],[1,8]],jacketDark,2);ellipse(1,-8,1.8,1.8,'#f5d689');
   // Arms anticipate, release and follow through in the actual aim direction.
   let reach=13, handY=-4+aimY*5, handX=aimX*reach;
   if(state==='aiming'){reach=17+(p.chargeLevel||0)*.07;handX=aimX*reach;handY=-5+aimY*reach*.55;}
   if(throwing){reach=12+throwSwing*(p.throwKind==='charged'?25:19);handX=aimX*reach-aimX*(1-throwPhase)*8;handY=-6+aimY*reach*.65-throwSwing*3;}
   if(victory){handX=15;handY=-38;}
   const freeX=victory?-15:-13+step*2, freeY=victory?-38:-3-step*3;
   line([[-10,-15],[freeX,freeY]],jacketDark,8);line([[-10,-16],[freeX,freeY-1]],jacket,5);
   line([[10,-15],[handX,handY]],jacketDark,8);line([[10,-16],[handX,handY-1]],jacket,5);
   ellipse(freeX,freeY,5,5,'#f3e5d5');ellipse(handX,handY,5,5,'#f3e5d5');
   // Face and gaze remain readable while the upper body subtly follows aim.
   ellipse(faceX*.6,-29+faceY*.4,12,12.5,skin);
   ellipse(-10+faceX*.5,-28,2.5,3.5,skin);ellipse(10+faceX*.5,-28,2.5,3.5,skin);
   ellipse(-4+faceX,-29+faceY,1.35,state==='hit'?2.2:1.55,'#21384a');
   ellipse(4+faceX,-29+faceY,1.35,state==='hit'?2.2:1.55,'#21384a');
   if(state==='hit')ellipse(faceX,-23+faceY,2.3,2.7,'#733e3e');
   else {c.strokeStyle='#834f46';c.lineWidth=1.3;c.beginPath();c.arc(faceX,-25+faceY,4,0.2,Math.PI-.2);c.stroke();}
   // Knitted hat, contrasting brim and soft pom-pom.
   ellipse(0,-39,13,10,hatDark);ellipse(0,-41,12,9,hat);
   c.fillStyle=hat;c.beginPath();c.roundRect(-13,-38,26,7,3);c.fill();
   c.fillStyle='#f7f2f0';c.beginPath();c.roundRect(-13,-34,26,4,2);c.fill();
   const pomSwing=reduced?0:step*2-throwSwing*3;
   line([[0,-46],[pomSwing*.4,-49]],hatDark,3);ellipse(pomSwing,-51,5.2,5.2,'#f7f2f0');
   ellipse(-2+pomSwing,-53,2,1.6,'#fff');
   if(p.hasBall){
     const ballRadius=5.5+(p.chargeLevel||0)/35;
     ellipse(handX+aimX*4,handY-4+aimY*2,ballRadius+1.5,ballRadius+1.5,'#8fb7c9');
     ellipse(handX+aimX*4,handY-5+aimY*2,ballRadius,ballRadius,'#f8fdff');
     ellipse(handX+aimX*4-1.5,handY-7+aimY*2,1.8,1.8,'#fff');
   }
   if(state==='frozen'||p.isFrozen){
     ellipse(-9,-37,7,4,'#f8fdff');ellipse(8,-18,6,3,'#f8fdff');ellipse(-4,3,9,4,'#f8fdff');
   }
   if(state==='recovery'&&!reduced){ellipse(-19,-22,3,3,'#fff');ellipse(19,-8,2.5,2.5,'#fff');}
   c.restore();
 } else if(id==='glacier') {
   ellipse(-12,10+move*3,9,6,dark);ellipse(12,10-move*3,9,6,dark);
   ellipse(-24,-9+move*2,10,15,'#a5d3e4');ellipse(24,-9-move*2,10,15,'#d6f5fb');
   ellipse(0,-8,23,24,'#a9d8e7');ellipse(-3,-8,19,24,'#e9fcff');
   c.fillStyle=team;c.fillRect(-18,-8,36,9);c.fillStyle='#c4f5ff';c.fillRect(-14,-8,28,4);
   ellipse(0,-31,16,15,'#f3ffff');
   line([[-12,-38],[-18,-47],[-18,-34]],'#8fc7dc',5);line([[12,-38],[18,-47],[18,-34]],'#8fc7dc',5);
   c.fillStyle=dark;c.fillRect(-18,-34,36,6);c.fillStyle='#a9faff';c.fillRect(-10,-32,10,2);c.fillRect(3,-32,10,2);
   if(p.hasBall) ellipse(25+Math.cos(aim)*5,-7+Math.sin(aim)*5,11+(p.chargeLevel||0)/30,11+(p.chargeLevel||0)/30,'#fff');
 } else if(id==='snowbug') {
   for(let i=0;i<3;i++){const y=-13+i*11;line([[-8,y],[-25,y+move*3],[-29,y+7]],dark,5);line([[8,y],[25,y-move*3],[29,y+7]],dark,5)}
   ellipse(0,-6,19,23,'#8cbcd0');ellipse(0,-6,13,19,'#e9fcff');
   line([[0,-27],[0,11]],team,5);
   ellipse(0,-28,13,12,dark);ellipse(-5,-28,3,4,'#ffdc82');ellipse(5,-28,3,4,'#ffdc82');
   line([[-6,-36],[-12,-43],[-12,-33]],'#7eb6cc',4);line([[6,-36],[12,-43],[12,-33]],'#7eb6cc',4);
   c.save();c.translate(0,-7);c.rotate(aim);c.translate(-recoil*5,0);
   c.fillStyle=dark;c.beginPath();c.roundRect(-1,-8,33,16,4);c.fill();c.fillStyle=team;c.fillRect(-1,-8,33,16);c.fill();
   ellipse(32,0,7,9,dark);ellipse(32,0,4,6,p.hasBall?'#fff':'#16313f');c.restore();
 } else {
   line([[-8,-20],[-8,0],[-15,12+move*4]],'#688ba1',5);line([[8,-20],[8,0],[15,12-move*4]],'#688ba1',5);
   const reach=26+(p.chargeLevel||0)/12;
   line([[-8,-15],[-25,-10],[-reach,-3+move*3]],'#719bb4',5);
   line([[8,-15],[22+Math.cos(aim)*5,-13+Math.sin(aim)*3],[reach+Math.cos(aim)*8,-6+Math.sin(aim)*12]],'#c6eefa',5);
   ellipse(0,-10,14,21,'#e9fcff');
   c.fillStyle=team;c.beginPath();c.moveTo(-14,-18);c.lineTo(14,-18);c.lineTo(20+move*2,7);c.lineTo(-20+move*2,7);c.closePath();c.fill();
   ellipse(0,-32,11,10,'#e6fcff');
   line([[-8,-36],[-18,-43],[-18,-34]],'#7eb6cc',4);line([[8,-36],[18,-43],[18,-34]],'#7eb6cc',4);
   c.fillStyle=dark;c.fillRect(-12,-34,24,5);ellipse(-6,-31,2,2,'#c8b5ff');ellipse(6,-31,2,2,'#c8b5ff');
   if(p.hasBall) ellipse(reach+Math.cos(aim)*8,-6+Math.sin(aim)*12,5,5,'#fff');
 }
 if(p.guardTicks>0) {c.strokeStyle='#66e7ff';c.lineWidth=3;c.beginPath();c.ellipse(0,-12,36,44,0,0,Math.PI*2);c.stroke();}
 if(p.isFrozen) {
   c.fillStyle='#b9edff55';c.strokeStyle='#f8fdff';c.lineWidth=2;c.beginPath();c.roundRect(-28,-56,56,72,16);c.fill();c.stroke();
   c.fillStyle='#f8fdff';for(const [x,y,r] of [[-21,-42,5],[19,-30,4],[-17,4,4],[12,11,5]]){c.beginPath();c.arc(x,y,r,0,Math.PI*2);c.fill();}
 }
 if(p.flashTimer>0) {c.strokeStyle='#fff';c.lineWidth=2;c.beginPath();c.arc(0,-14,32,0,Math.PI*2);c.stroke();}
 c.restore();
};

window.drawIgloo = function(c,o,x,y) {
 c.save();c.translate(x,y);
 c.fillStyle='#14384e22';c.beginPath();c.ellipse(0,15,43,17,0,0,Math.PI*2);c.fill();
 c.fillStyle='#b0d9e7';c.beginPath();c.arc(0,0,38,Math.PI,0);c.lineTo(43,13);c.quadraticCurveTo(0,28,-43,13);c.closePath();c.fill();
 c.strokeStyle='#ecfbff';c.lineWidth=2;
 for(const yy of [-24,-12,0,12]) {const xx=Math.sqrt(38*38-yy*yy);c.beginPath();c.moveTo(-xx,yy);c.lineTo(xx,yy);c.stroke();}
 for(const xx of [-19,0,19]) {c.beginPath();c.moveTo(xx,-Math.sqrt(38*38-xx*xx));c.lineTo(xx,12);c.stroke();}
 c.fillStyle=o.team==='red'?'#cd777f':'#398caf';c.fillRect(-37,8,74,5);
 c.fillStyle='#23506b';c.beginPath();c.arc(0,12,12,Math.PI,0);c.lineTo(12,15);c.lineTo(-12,15);c.closePath();c.fill();
 // The dark doorway is decoration: the whole igloo is solid cover.
 c.fillStyle='#153e55';c.fillRect(-18,-48,36,4);
 c.fillStyle='#8decff';c.fillRect(-18,-48,36*o.hp/3,4);
 if(o.hp<3) {c.strokeStyle='#4e8299';c.lineWidth=1.5;c.beginPath();c.moveTo(17,-30);c.lineTo(11,-17);c.lineTo(20,-8);c.lineTo(12,4);c.stroke();}
 c.restore();
};
