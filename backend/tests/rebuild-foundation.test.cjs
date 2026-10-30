const {test, afterEach} = require('node:test');
const assert = require('node:assert/strict');
const {PALETTES,DEFAULT_APPEARANCE,sanitizeAppearance} = require('../cosmetics');
const {hillSlot,steerBot} = require('../bot-steering');
const {ServerPlayer,createMatch,tickMatch,matches} = require('../server');

afterEach(()=>matches.clear());

test('guest cosmetics are sanitized against a fixed palette',()=>{
    assert.deepEqual(sanitizeAppearance(null),DEFAULT_APPEARANCE);
    assert.deepEqual(sanitizeAppearance({skin:'red',jacket:'url(javascript:evil)',hat:'#000000'}),DEFAULT_APPEARANCE);
    assert.deepEqual(sanitizeAppearance({skin:PALETTES.skin[3],jacket:PALETTES.jacket[4],hat:PALETTES.hat[2]}),
      {skin:PALETTES.skin[3],jacket:PALETTES.jacket[4],hat:PALETTES.hat[2]});
});

test('bot hill goals are stable and spread across distinct coordinates',()=>{
    const slots = Array.from({length:30},(_,i)=>hillSlot({id:'bot-match-'+(i+1),team:'blue'},1500,1000));
    assert.equal(new Set(slots.map(p=>p.x.toFixed(2)+','+p.y.toFixed(2))).size,30);
    assert.ok(slots.every(p=>Math.hypot(p.x-1500,p.y-1000)<260));
});

test('steering separates two bots on the same point without NaN',()=>{
    const a={id:'bot-match-1',team:'blue',x:100,y:100,radius:14},b={id:'bot-match-2',team:'blue',x:100,y:100,radius:14};
    const match={players:{a,b},obstacles:[],structures:[]};
    const direction=steerBot(a,match,100,100,1,true);
    assert.ok(Number.isFinite(direction.moveX) && Number.isFinite(direction.moveY));
    assert.ok(Math.hypot(direction.moveX,direction.moveY)>0);
});

test('classic auto-reload is opt-in; legacy manual pack semantics remain',()=>{
    const match=createMatch('single',1,1);
    match.obstacles=[]; match.emit=()=>{}; match.emitVolatile=()=>{};
    const modern=new ServerPlayer('modern','blue',false,'classic');
    const legacy=new ServerPlayer('legacy','red',false,'classic');
    modern.x=600;modern.y=400;legacy.x=2400;legacy.y=1600;
    modern.autoReload=true;
    modern.hasBall=false;legacy.hasBall=false;
    match.players={modern,legacy};
    for(let i=0;i<46;i++)tickMatch(match);
    assert.equal(modern.hasBall,true);
    assert.equal(legacy.hasBall,false);
    assert.equal(modern.inputs.gather,false);
});

test('center-seeking bots no longer all steer toward the same point',()=>{
    const match=createMatch('single',5,5);
    match.obstacles=[];match.emit=()=>{};match.emitVolatile=()=>{};
    const enemy=new ServerPlayer('enemy','red',false);enemy.x=2800;enemy.y=1900;
    match.players.enemy=enemy;
    for(let i=0;i<6;i++){
       const bot=new ServerPlayer('bot-test-'+(i+1),'blue',true);
       bot.x=90;bot.y=300+i*2;
       match.players[bot.id]=bot;
    }
    tickMatch(match);
    const vectors=Object.values(match.players).filter(p=>p.isBot).map(p=>p.inputs.moveX.toFixed(3)+','+p.inputs.moveY.toFixed(3));
    assert.ok(new Set(vectors).size>2,JSON.stringify(vectors));
});
