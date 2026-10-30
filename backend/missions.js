const MISSIONS=Object.freeze({
 beacon:{id:'beacon',name:'1 · Light the beacon',brief:'Bank 5 hill points before 90 seconds. Move into the center circle and hold it.',blue:1,red:1,difficulty:'easy',aggression:'chill',metric:'hill',target:5},
 snowfight:{id:'snowfight',name:'2 · Win the snow fight',brief:'Your team must land 3 freezes before 90 seconds. Pack, aim, charge, and throw.',blue:1,red:1,difficulty:'easy',aggression:'balanced',metric:'freezes',target:3},
 squad:{id:'squad',name:'3 · Take the neighborhood',brief:'Win a 5v5 round. Hill points decide; freezes break a tie. A draw means retry.',blue:5,red:5,difficulty:'normal',aggression:'balanced',metric:'win',target:1}
});
const AGGRESSION=Object.freeze({chill:{pause:90,chase:.5,abilities:false},balanced:{pause:30,chase:1,abilities:true},relentless:{pause:0,chase:1,abilities:true}});
function aggressionId(x){return Object.hasOwn(AGGRESSION,x)?x:'balanced'}
function missionProgress(m){if(!m.mission)return null;const spec=MISSIONS[m.mission];return {...spec,progress:spec.metric==='hill'?m.hill.blue:spec.metric==='freezes'?m.score.blue:(m.ended&&m.winner==='blue'?1:0),completed:m.ended&&m.winner==='blue'};}
module.exports={MISSIONS,AGGRESSION,aggressionId,missionProgress};
