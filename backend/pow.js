// SnowFort Capture & Rescue — deterministic, server-authoritative rules.
// No sockets or rendering code here; a match owns all scores and timers.
const DURATION=14400, RESCUE=120, GATE=240, PROTECT=120, FLAG_CHARGE=1200, FLAG_RADIUS=210;
const JAIL={blue:{x:230,y:280},red:{x:2770,y:280}};
const PAD={blue:{x:380,y:280},red:{x:2620,y:280}};
const EXIT={blue:{x:480,y:390},red:{x:2520,y:390}};
const POWER=['snowballFrenzy','snowBoots','fortShield'];
function other(team){return team==='blue'?'red':'blue'}
function init(match){
 match.gameMode='pow';match.mission=null;
 // Mirrored central lanes; static geometry uses the existing authoritative collision path.
 match.obstacles=[
  ...[760,2240].flatMap(x=>[{x,y:610,radius:66,type:'snowbank'},{x,y:1390,radius:66,type:'snowbank'}]),
  ...[1080,1920].flatMap(x=>[{x,y:390,radius:44,type:'tree'},{x,y:1610,radius:44,type:'tree'}]),
  {x:1500,y:525,radius:52,type:'snowman'},{x:1500,y:1475,radius:52,type:'snowman'}
 ];match.pow={
  captures:{blue:0,red:0},rescues:{blue:0,red:0},control:{blue:0,red:0},
  prisoners:{blue:[],red:[]},rescue:{blue:0,red:0},rescuer:{blue:null,red:null},
  gate:{blue:0,red:0},meter:{blue:0,red:0},holder:null,rotation:{blue:0,red:0},
  buffs:{blue:null,red:null},phase:'waiting'
 };
 for(const p of Object.values(match.players))onJoin(match,p);
}
function onJoin(match,p){
 p.captured=false;p.invulnerableUntil=0;p.interact=false;
 p.x=p.team==='blue'?180:2820;p.y=680+Math.random()*520;p.vx=p.vy=0;
}
function captured(match,p){
 if(!p || p.captured || match.ended || p.invulnerableUntil>match.tick)return false;
 p.captured=true;p.hasBall=true;p.chargeLevel=0;p.inputs.moveX=p.inputs.moveY=0;p.vx=p.vy=0;
 const list=match.pow.prisoners[p.team];if(!list.includes(p.id))list.push(p.id);
 const count=list.length;p.x=JAIL[p.team].x+(count%3-1)*32;p.y=JAIL[p.team].y+Math.floor((count-1)/3)*40;
 return true;
}
function onHit(match,p,ball){
 if(!captured(match,p))return false;
 match.pow.captures[ball.team]++;match.score[ball.team]++;
 const owner=match.players[ball.ownerId];if(owner)owner.stats.freezes++;
 match.emit('effect',{type:'pow_capture',id:p.id,x:p.x,y:p.y,team:p.team});
 match.emit('hit',{id:p.id,ownerId:ball.ownerId,x:p.x,y:p.y});
 checkWin(match);return true;
}
function checkWin(match){
 if(!match.timerStarted||match.ended)return;
 for(const team of ['blue','red']){
  const members=Object.values(match.players).filter(p=>p.team===team && !p.isBot);
  if(members.length && members.every(p=>p.captured)){
   finish(match,other(team),'allCaptured');return;
  }
 }
}
function finish(match,winner,reason){
 if(match.ended)return;
 match.ended=true;match.winner=winner;match.snowballs=[];
 match.pow.phase='ended';
 match.emit('matchEnd',{winner,score:match.score,hill:match.hill,gameMode:'pow',reason,pow:publicState(match)});
}
function tick(match){
 const data=match.pow;if(!data||match.ended||!match.timerStarted)return;
 data.phase='active';
 for(const team of ['blue','red']){
  const list=data.prisoners[team];
  const eligible=Object.values(match.players).filter(p=>p.team===team&&!p.captured&&!p.isFrozen&&p.interact&&
    Math.hypot(p.x-PAD[team].x,p.y-PAD[team].y)<=75);
  if(list.length && data.gate[team]<=match.tick && eligible.length){
   const rescuer=eligible.sort((a,b)=>a.id.localeCompare(b.id))[0];
   if(data.rescuer[team]!==rescuer.id){data.rescuer[team]=rescuer.id;data.rescue[team]=0}
   if(++data.rescue[team]>=RESCUE){
    const released=[...list];list.length=0;
    released.forEach((id,i)=>{const p=match.players[id];if(!p)return;p.captured=false;p.x=EXIT[team].x+(i%3)*38;p.y=EXIT[team].y+Math.floor(i/3)*38;p.invulnerableUntil=match.tick+PROTECT;p.vx=p.vy=0});
    data.rescues[team]++;match.score[team]+=2;data.gate[team]=match.tick+GATE;
    match.emit('effect',{type:'pow_release',team,x:EXIT[team].x,y:EXIT[team].y,ids:released});
    data.rescue[team]=0;data.rescuer[team]=null;
   }
  }else{data.rescue[team]=0;data.rescuer[team]=null}
  const b=data.buffs[team];if(b&&b.until<=match.tick)data.buffs[team]=null;
 }
 let blue=0,red=0;
 for(const p of Object.values(match.players)){
  if(p.captured||p.isFrozen||p.invulnerableUntil>match.tick)continue;
  if(Math.hypot(p.x-1500,p.y-1000)>FLAG_RADIUS)continue;
  if(p.team==='blue')blue++;else red++;
 }
 const holder=blue>red?'blue':red>blue?'red':null;data.holder=holder;
 if(holder){
  if(match.tick%60===0){data.control[holder]++;match.score[holder]++}
  if(++data.meter[holder]>=FLAG_CHARGE){
   data.meter[holder]=0;const kind=POWER[data.rotation[holder]++%POWER.length];
   data.buffs[holder]={kind,until:match.tick+480};
   match.emit('effect',{type:'pow_buff',team:holder,kind,x:1500,y:1000});
  }
 }
 if(match.timerTicks>=DURATION){
  const a=match.score.blue,b=match.score.red;
  let winner=a>b?'blue':b>a?'red':null;
  if(!winner){const cb=data.prisoners.blue.length,cr=data.prisoners.red.length;
   winner=cb<cr?'blue':cr<cb?'red':data.captures.blue>data.captures.red?'blue':data.captures.red>data.captures.blue?'red':'draw'}
  finish(match,winner,'timer');
 }
}
function publicState(match){
 const p=match.pow;if(!p)return null;
 return {captured:{blue:p.prisoners.blue.length,red:p.prisoners.red.length},rescue:{blue:p.rescue.blue,red:p.rescue.red},
  gates:{blue:p.gate.blue>match.tick,red:p.gate.red>match.tick},flag:{holder:p.holder,meters:p.meter,buffs:p.buffs},
  map:{jails:JAIL,pads:PAD,exits:EXIT,flag:{x:1500,y:1000,radius:FLAG_RADIUS}},phase:p.phase};
}
function clampPrison(p){
 if(p.captured){p.x=Math.max(JAIL[p.team].x-65,Math.min(JAIL[p.team].x+65,p.x));p.y=Math.max(JAIL[p.team].y-60,Math.min(JAIL[p.team].y+60,p.y));return}
 // The POW fort is a protected room: untagged players cannot enter it.
 for(const team of ['blue','red']){
  const jail=JAIL[team],hx=90+(p.radius||14),hy=85+(p.radius||14);
  if(Math.abs(p.x-jail.x)>=hx||Math.abs(p.y-jail.y)>=hy)continue;
  const dx=p.x-jail.x,dy=p.y-jail.y;
  if((hx-Math.abs(dx))<(hy-Math.abs(dy)))p.x=jail.x+(dx<0?-hx:hx);
  else p.y=jail.y+(dy<0?-hy:hy);
  p.vx=p.vy=0;
 }
}
module.exports={DURATION,RESCUE,GATE,PROTECT,init,onJoin,onHit,tick,finish,publicState,clampPrison,checkWin};
