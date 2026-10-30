// Decorative layers use world coordinates. Only server obstacles block play.
window.drawNeighborhoodGround = function(ctx,cx,cy,now,reduced) {
 const r=(x,y,w,h,color)=>{ctx.fillStyle=color;ctx.fillRect(x-cx,y-cy,w,h)};
 // Snow field with street crossing and a small residential driveway.
 r(0,0,3000,2000,'#d9edf1');
 r(0,820,3000,360,'#cce3e8');
 r(0,830,3000,12,'#eaf8fb');r(0,1158,3000,12,'#eaf8fb');
 r(1390,205,220,525,'#b8d4db');
 for(let i=0;i<7;i++)r(1399,225+i*68,202,3,'#d2e8eb');
 // Home sits beyond the field; driveway is decorative and has no speed modifier.
 ctx.save();ctx.translate(1500-cx,190-cy);
 ctx.fillStyle='#477a8c';ctx.beginPath();ctx.roundRect(-180,-100,360,115,14);ctx.fill();
 ctx.fillStyle='#294f64';ctx.beginPath();ctx.moveTo(-200,-88);ctx.lineTo(0,-175);ctx.lineTo(200,-88);ctx.closePath();ctx.fill();
 ctx.fillStyle='#effcff';ctx.beginPath();ctx.moveTo(-182,-96);ctx.lineTo(0,-170);ctx.lineTo(182,-96);ctx.lineTo(154,-101);ctx.lineTo(0,-153);ctx.lineTo(-154,-101);ctx.fill();
 for(const x of [-115,85]){ctx.fillStyle='#ffd47d';ctx.fillRect(x,-65,40,32);ctx.strokeStyle='#e9fbff';ctx.lineWidth=3;ctx.strokeRect(x,-65,40,32);ctx.beginPath();ctx.moveTo(x+20,-65);ctx.lineTo(x+20,-33);ctx.stroke();}
 ctx.fillStyle='#264b60';ctx.fillRect(-49,-60,98,75);ctx.strokeStyle='#e8fbff';ctx.lineWidth=4;ctx.strokeRect(-49,-60,98,75);
 // A snow-covered garage, porch lanterns, wreath and chimney lend scale.
 ctx.strokeStyle='#83aebb';ctx.lineWidth=2;for(let i=0;i<4;i++){ctx.beginPath();ctx.moveTo(-44,-45+i*16);ctx.lineTo(44,-45+i*16);ctx.stroke();}
 ctx.fillStyle='#efd493';ctx.beginPath();ctx.arc(-61,-35,4,0,Math.PI*2);ctx.arc(61,-35,4,0,Math.PI*2);ctx.fill();
 ctx.strokeStyle='#477658';ctx.lineWidth=4;ctx.beginPath();ctx.arc(0,-81,10,0,Math.PI*2);ctx.stroke();ctx.fillStyle='#de7869';ctx.fillRect(-3,-73,6,4);
 ctx.fillStyle='#315166';ctx.fillRect(103,-150,25,40);ctx.fillStyle='#f6fdff';ctx.fillRect(99,-153,33,7);ctx.restore();
 // Fence posts remain visual scenery, away from the movement lanes.
 ctx.strokeStyle='#a1c9d3';ctx.lineWidth=4;for(const x of [920,1030,1140,1860,1970,2080]){ctx.beginPath();ctx.moveTo(x-cx,210-cy);ctx.lineTo(x-cx,300-cy);ctx.stroke();ctx.fillStyle='#fff';ctx.fillRect(x-cx-5,206-cy,10,6);}
 ctx.strokeStyle='#b7d7de';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(920-cx,250-cy);ctx.lineTo(1140-cx,250-cy);ctx.moveTo(1860-cx,250-cy);ctx.lineTo(2080-cx,250-cy);ctx.stroke();
 // Drift contours add texture without a per-frame random field or image assets.
 ctx.strokeStyle='#fff8';ctx.lineWidth=3;
 for(const [x,y] of [[240,350],[730,260],[2230,320],[2780,520],[350,1430],[760,1740],[2180,1640],[2750,1420]]){
  ctx.beginPath();ctx.ellipse(x-cx,y-cy,72,12,-.08,Math.PI*1.05,Math.PI*1.93);ctx.stroke();
 }
};
window.drawShovelingParent = function(ctx,cx,cy,tick,reacting,reduced) {
 const x=1500-cx,y=650-cy;ctx.save();ctx.translate(x,y);
 const swing=reduced?0:Math.sin(tick/22)*.25;
 ctx.fillStyle='#2d506833';ctx.beginPath();ctx.ellipse(0,13,24,8,0,0,Math.PI*2);ctx.fill();
 ctx.fillStyle='#263f57';ctx.beginPath();ctx.roundRect(-14,-28,28,36,10);ctx.fill();
 ctx.fillStyle='#cf7358';ctx.fillRect(-13,-13,26,7);
 ctx.fillStyle='#eac8a5';ctx.beginPath();ctx.arc(0,-36,11,0,Math.PI*2);ctx.fill();
 ctx.fillStyle='#d37c56';ctx.beginPath();ctx.arc(0,-42,11,Math.PI,0);ctx.fill();ctx.beginPath();ctx.arc(0,-48,3,0,Math.PI*2);ctx.fill();
 ctx.strokeStyle='#38576c';ctx.lineWidth=7;ctx.lineCap='round';ctx.beginPath();ctx.moveTo(-7,5);ctx.lineTo(-9,14);ctx.moveTo(7,5);ctx.lineTo(9,14);ctx.stroke();
 ctx.save();ctx.translate(11,-12);ctx.rotate(reacting?-.65:swing);ctx.strokeStyle='#87644c';ctx.lineWidth=4;ctx.beginPath();ctx.moveTo(-4,-10);ctx.lineTo(25,17);ctx.stroke();ctx.fillStyle='#f7c668';ctx.beginPath();ctx.roundRect(20,12,19,12,3);ctx.fill();ctx.restore();
 if(reacting){ctx.fillStyle='#fff';ctx.beginPath();ctx.roundRect(-29,-76,58,22,8);ctx.fill();ctx.fillStyle='#24435a';ctx.font='bold 11px sans-serif';ctx.textAlign='center';ctx.fillText('HEY!',0,-61);}
 ctx.restore();
};
