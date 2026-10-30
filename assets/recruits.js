/* Procedural character art: lightweight canvas shapes, no texture downloads. */
window.SNOW_RECRUITS = {
 glacier:{name:'Glacier',role:'HEAVY / HOLD THE LINE',ability:'ICE GUARD',detail:'Oversized snowballs. A two-second guard absorbs one hit.',trade:'80% run speed · 1.0s pack · 8s guard cooldown',accent:'#65daf1'},
 snowbug:{name:'Snowbug',role:'ARTILLERY / BREAK THE LINE',ability:'CANNON',detail:'Three-ball volleys. Charge to tighten the spread. Fire a heavy cannon shot with your ability.',trade:'95% run speed · 1.08s pack · 7s cannon cooldown',accent:'#ffc877'},
 frostweaver:{name:'Frostweaver',role:'MARKSMAN / SHAPE THE FIELD',ability:'IGLOO',detail:'Long arms launch fast, precise snowballs. Build an igloo ahead to block incoming fire.',trade:'108% run speed · 0.83s pack · 12s igloo cooldown',accent:'#b5a1ff'},
 classic:{name:'Classic',role:'ORIGINAL / ALL-ROUNDER',ability:'CLASSIC',detail:'The original snowball fighter, unchanged. Dash, pack, charge and throw.',trade:'100% run speed · 0.75s pack · no special ability',accent:'#a9d4e2'}
};
window.drawSnowRecruit = function(c,p,time=0) {
 const id=p.classId, team=p.team==='red'?'#ec7471':'#248bb6', dark=p.team==='red'?'#863d58':'#1b4666';
 const move=Math.sin(p.walkCycle||0), aim=p.facingAngle||0, recoil=p.recoil||0;
 const ellipse=(x,y,rx,ry,color)=>{c.fillStyle=color;c.beginPath();c.ellipse(x,y,rx,ry,0,0,Math.PI*2);c.fill()};
 const line=(points,color,width)=>{c.strokeStyle=color;c.lineWidth=width;c.lineCap='round';c.lineJoin='round';c.beginPath();points.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.stroke()};
 c.save();
 ellipse(0,12,id==='glacier'?26:21,7,'#14384e25');
 if(id==='classic') {
   // Original childhood winter kid, from above and slightly behind.
   // The outlined team ring is independent of cosmetic jacket/hat colors.
   const skin=p.skinColor||'#DEAC82', jacket=p.jacketColor||team, hat=p.hatColor||'#DB4E51';
   ellipse(-8,10+move*3,6,7,'#34475A');ellipse(8,10-move*3,6,7,'#34475A');
   ellipse(-16,-7+move,7,13,jacket);ellipse(16,-7-move,7,13,jacket);
   ellipse(-18,0+move,5,6,'#F5E7D6');ellipse(18,0-move,5,6,'#F5E7D6');
   ellipse(0,-6,16,21,jacket);
   c.strokeStyle=team;c.lineWidth=3;c.beginPath();c.ellipse(0,-7,24,27,0,0,Math.PI*2);c.stroke();
   ellipse(0,-25,11,12,skin);
   ellipse(0,-34,13,10,hat);ellipse(0,-40,10,6,hat);ellipse(0,-46,5,5,'#F7F2F0');
   c.fillStyle='#F5E4D4';c.fillRect(-11,-32,22,3);
   if(p.hasBall)ellipse(19+Math.cos(aim)*4,-5+Math.sin(aim)*4,6+(p.chargeLevel||0)/40,6+(p.chargeLevel||0)/40,'#fff');
 } else if(id==='glacier') {
   ellipse(-12,10+move*3,9,6,dark);ellipse(12,10-move*3,9,6,dark);
   ellipse(-24,-9+move*2,10,15,'#a5d3e4');ellipse(24,-9-move*2,10,15,'#d6f5fb');
   ellipse(0,-8,23,24,'#a9d8e7');ellipse(-3,-11,19,21,'#e9fcff');
   c.fillStyle=team;c.fillRect(-18,-8,36,9);c.fillStyle='#c4f5ff';c.fillRect(-9,-6,18,4);
   ellipse(0,-31,16,15,'#f3ffff');
   line([[-13,-38],[-19,-47],[-19,-34]],'#8fc7dc',5);line([[13,-38],[19,-47],[19,-34]],'#8fc7dc',5);
   c.fillStyle=dark;c.fillRect(-10,-34,20,6);c.fillStyle='#a8faff';c.fillRect(-8,-33,5,2);c.fillRect(3,-33,5,2);
   if(p.hasBall) ellipse(25+Math.cos(aim)*5,-7+Math.sin(aim)*5,11+(p.chargeLevel||0)/30,11+(p.chargeLevel||0)/30,'#fff');
 } else if(id==='snowbug') {
   for(let i=0;i<3;i++) {const y=-13+i*11;line([[-12,y],[-25,y+move*3],[-29,y+7]],dark,4);line([[12,y],[25,y-move*3],[29,y+7]],dark,4)}
   ellipse(0,-6,19,23,'#8cbcd0');ellipse(-4,-9,15,20,'#f0fbff');
   line([[0,-27],[0,13]],team,4);
   ellipse(0,-28,13,9,dark);ellipse(-6,-29,3,3,'#ffdc82');ellipse(6,-29,3,3,'#ffdc82');
   line([[-8,-34],[-15,-43]],dark,2);line([[8,-34],[15,-43]],dark,2);
   ellipse(-15,-43,3,3,'#ffdc82');ellipse(15,-43,3,3,'#ffdc82');
   c.save();c.translate(0,-7);c.rotate(aim);c.translate(-recoil*5,0);
   c.fillStyle=dark;c.beginPath();c.roundRect(1,-8,31,16,4);c.fill();c.fillStyle=team;c.fillRect(9,-9,12,18);
   ellipse(32,0,5,9,'#a5d8e9');ellipse(33,0,3,6,p.hasBall?'#efffff':'#183b52');c.restore();
 } else {
   line([[-7,0],[-10,13+move*4]],dark,5);line([[7,0],[10,13-move*4]],dark,5);
   const reach=26+(p.chargeLevel||0)/12;
   line([[-8,-21],[-25,-10],[-reach,-3+move*2]],'#719bb4',5);
   line([[8,-21],[22+Math.cos(aim)*5,-13],[reach+Math.cos(aim)*8,-5+Math.sin(aim)*12]],'#c6eefa',5);
   ellipse(0,-10,11,19,'#f1fcff');
   c.fillStyle=team;c.beginPath();c.moveTo(-11,-22);c.lineTo(13,-22);c.lineTo(20+move*3,7);c.lineTo(4,2);c.closePath();c.fill();
   ellipse(0,-32,11,12,'#e2f7ff');
   line([[-6,-40],[-11,-49],[-17,-47]],'#a4cae0',3);line([[6,-40],[11,-49],[17,-47]],'#a4cae0',3);
   c.fillStyle=dark;c.fillRect(-9,-34,18,5);ellipse(-4,-32,2,1,'#d5c4ff');ellipse(4,-32,2,1,'#d5c4ff');
   if(p.hasBall) ellipse(reach+Math.cos(aim)*8,-5+Math.sin(aim)*12,5,5,'#fff');
 }
 if(p.guardTicks>0) {c.strokeStyle='#66e7ff';c.lineWidth=3;c.beginPath();c.ellipse(0,-12,36,44,0,0,Math.PI*2);c.stroke();}
 if(p.isFrozen) {c.fillStyle='#b9edff88';c.strokeStyle='#fff';c.lineWidth=2;c.beginPath();c.roundRect(-30,-52,60,70,10);c.fill();c.stroke();}
 if(p.flashTimer>0) {c.strokeStyle='#fff';c.lineWidth=2;c.beginPath();c.arc(0,-14,32,0,Math.PI*2);c.stroke();}
 c.restore();
};
window.drawIgloo = function(c,o,x,y) {
 c.save();c.translate(x,y);
 c.fillStyle='#14384e22';c.beginPath();c.ellipse(0,15,43,17,0,0,Math.PI*2);c.fill();
 c.fillStyle='#b0d9e7';c.beginPath();c.arc(0,0,38,Math.PI,0);c.lineTo(38,13);c.quadraticCurveTo(0,28,-38,13);c.closePath();c.fill();
 c.strokeStyle='#ecfbff';c.lineWidth=2;
 for(const yy of [-24,-10,4]) {const xx=Math.sqrt(38*38-yy*yy);c.beginPath();c.moveTo(-xx,yy);c.lineTo(xx,yy);c.stroke();}
 for(const xx of [-19,0,19]) {c.beginPath();c.moveTo(xx,-Math.sqrt(38*38-xx*xx));c.lineTo(xx,13);c.stroke();}
 c.fillStyle=o.team==='red'?'#cd777f':'#398caf';c.fillRect(-37,8,74,5);
 c.fillStyle='#23506b';c.beginPath();c.arc(0,10,12,Math.PI,0);c.lineTo(12,22);c.lineTo(-12,22);c.closePath();c.fill();
 // The dark doorway is decoration: the whole igloo is solid cover.
 c.fillStyle='#153e55';c.fillRect(-18,-48,36,4);c.fillStyle='#8decff';c.fillRect(-18,-48,36*o.hp/3,4);
 if(o.hp<3) {c.strokeStyle='#4e8299';c.lineWidth=2;c.beginPath();c.moveTo(17,-30);c.lineTo(10,-15);c.lineTo(19,-8);c.lineTo(12,6);c.stroke();}
 c.restore();
};
