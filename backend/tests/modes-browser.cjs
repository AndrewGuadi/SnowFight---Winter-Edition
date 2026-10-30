const {chromium}=require('playwright'),{spawn}=require('node:child_process');
const assert=require('node:assert/strict');const path=require('node:path');
const port=3498,base='http://127.0.0.1:'+port;
(async()=>{
 const proc=spawn(process.execPath,['backend/server.js'],{cwd:path.resolve(__dirname,'../..'),env:{...process.env,PORT:String(port),MATCH_DURATION_TICKS:'450'},stdio:'pipe'});
 let browser;
 try{
  await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('server start timeout')),10000);
    proc.stdout.on('data',x=>{if(String(x).includes('running on port')){clearTimeout(timer);resolve()}});
    proc.on('exit',c=>{clearTimeout(timer);reject(Error('server stopped '+c))});
  });
  browser=await chromium.launch({headless:true,args:['--no-sandbox']});
  const errors=[];
  const a=await browser.newPage(),b=await browser.newPage();
  for(const p of [a,b])p.on('pageerror',e=>errors.push(e.message));
  await Promise.all([a.goto(base),b.goto(base)]);
  await Promise.all([a,b].map(p=>p.locator('#btn-play-online:not([disabled])').waitFor()));
  for(const p of [a,b]){await p.locator('.arcade-mode[data-mode="pow"]').click();await p.locator('#btn-play-online').click()}
  await Promise.all([a,b].map(p=>p.waitForFunction(()=>STATE.id&&STATE.players[STATE.id]&&MENU.gameMode==='pow')));
  await Promise.all([a,b].map(p=>p.waitForFunction(()=>Object.keys(STATE.players).length===2)));
  assert.equal(await a.evaluate(()=>STATE.mode),'multi');
  assert.equal(await a.evaluate(()=>STATE.players[STATE.id].captured),false);
  assert.equal(await a.locator('#pow-mode-hud').isVisible(),true);
  assert.equal(await a.locator('#pow-minimap').isVisible(),true);
  await a.reload();await a.locator('#btn-play-online:not([disabled])').waitFor();
  await a.locator('.arcade-mode[data-mode="adventure"]').click();
  await a.locator('#snow-adventure').waitFor({state:'visible'});
  const active=await a.evaluate(()=>document.getElementById('snow-adventure').style.display==='grid');
  assert.equal(active,true);
  const before=await a.evaluate(()=>SnowAdventure.inspect());
  await a.keyboard.down('ArrowRight');await a.waitForTimeout(450);await a.keyboard.up('ArrowRight');
  const after=await a.evaluate(()=>SnowAdventure.inspect());
  assert.ok(after.x>before.x+10,'platformer must respond to movement');
  await a.keyboard.press('Space');await a.waitForTimeout(140);
  const airborne=await a.evaluate(()=>SnowAdventure.inspect());
  assert.ok(airborne.y<after.y,'space should jump');
  await a.locator('#adv-close').click();
  await a.locator('#snow-adventure').waitFor({state:'hidden'});
  assert.deepEqual(errors,[]);
  console.log('PASS SnowFort two-human mode routing, POW HUD and minimap, independent platformer start/exit, no JavaScript errors');
 }finally{if(browser)await browser.close();proc.kill()}
})().catch(e=>{console.error(e);process.exitCode=1});
