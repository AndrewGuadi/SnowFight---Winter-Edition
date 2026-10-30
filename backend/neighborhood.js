// Mirrored cover: open approaches to the fort, with matching flank cover.
// Per-match jitter is mirrored as well, so no team gets a fixed advantage.
function makeNeighborhood(random = Math.random) {
    const cover=[];
    const rows=[
        [570,420,'tree'],[570,1580,'tree'],
        [840,680,'snowbank'],[840,1320,'snowbank'],
        [1110,420,'tree'],[1110,1580,'tree'],
        [1190,780,'snowbank'],[1190,1220,'snowbank'],
        [1340,620,'snowman'],[1340,1380,'snowman']
    ];
    for (const [x,y,type] of rows) {
        const jitter=(random()-.5)*24, yy=Math.max(80,Math.min(1920,y+jitter));
        const radius=type==='tree'?30:type==='snowbank'?34:20;
        cover.push({x,y:yy,radius,type},{x:3000-x,y:yy,radius,type});
    }
    return cover;
}
const PARENT = Object.freeze({x:1500,y:650,radius:32});
module.exports={makeNeighborhood,PARENT};
