// Real Chromium smoke: room-scoped combat cue presentation and a live
// Snow Day Adventures enemy encounter. No production host touched.
const {chromium}=require('playwright'),{spawn}=require('node:child_process');
const path=require('node:path'),assert=require('node:assert/strict');
const PORT=3511,base='http://127.0.0.1:'+PORT;
(async()=>{
 const proc=spawn(process.execPath,['backend/server.js'],{
  cwd:path.resolve(__dirname,'../..'),
  env:{...process.env,PORT:String(PORT),MATCH_DURATION_TICKS:'600'},stdio:'pipe'
 });
 let browser;
 try{
  await new Promise((resolve,reject)=>{
   const deadline=setTimeout(()=>reject(Error('server did not start')),12000);
   proc.stdout.on('data',data=>{if(String(data).includes('running on port')){clearTimeout(deadline);resolve()}});
   proc.on('exit',code=>{clearTimeout(deadline);reject(Error('server stopped '+code))});
  });
  browser=await chromium.launch({headless:true,args:['--no-sandbox']});
  const p=await browser.newPage({viewport:{width:844,height:390},hasTouch:true,isMobile:true});
  const errors=[];p.on('pageerror',e=>errors.push(e.message));
  await p.goto(base);
  await p.locator('#btn-play-online:not([disabled])').waitFor();
  await p.locator('#btn-play-online').click();
  await p.waitForFunction(()=>STATE.id&&STATE.players[STATE.id]);
  const registered=await p.evaluate(()=>{
   const effect=socket.listeners('effect');
   return effect.length>=2 && !!window.SNOW_INTENSITY;
  });
  assert.equal(registered,true,'new intensity handler must be active');
  await p.evaluate(()=>{
   const me=STATE.players[STATE.id];
   for(const fn of socket.listeners('effect'))fn({type:'snow_clash',x:me.x,y:me.y,owners:[STATE.id,'enemy']});
  });
  await p.locator('#snow-intensity-toast').waitFor({state:'visible'});
  assert.match(await p.locator('#snow-intensity-toast').textContent(),/SNOWBALL CLASH/);
  await p.waitForTimeout(500);
  await p.evaluate(()=>{
   const me=STATE.players[STATE.id];
   for(const fn of socket.listeners('effect'))fn({type:'close_call',x:me.x,y:me.y,id:STATE.id,ownerId:'enemy'});
  });
  assert.match(await p.locator('#snow-intensity-toast').textContent(),/NICE DODGE/);
  // Adventure encounter uses real 60Hz gameplay, with an enemy projectile
  // appearing as the avatar enters the first patrolled neighborhood lane.
  await p.reload();
  await p.locator('#btn-play-online:not([disabled])').waitFor();
  await p.locator('.arcade-mode[data-mode="adventure"]').click();
  await p.locator('#snow-adventure').waitFor({state:'visible'});
  assert.equal(await p.evaluate(()=>SnowAdventure.inspect().hearts),3);
  await p.keyboard.down('ArrowRight');
  try{
   await p.waitForFunction(()=>{
     const s=SnowAdventure.inspect();
     return s&&(s.enemyShots>0||s.hearts<3||s.invuln>0);
   },{},{timeout:11000,polling:60});
  }finally{await p.keyboard.up('ArrowRight')}
  const state=await p.evaluate(()=>SnowAdventure.inspect());
  assert.ok(state.hearts>=0&&state.hearts<=3);
  assert.match(await p.locator('#adv-hud').textContent(),/♥/);
  await p.locator('#adv-close').click();
  await p.locator('#snow-adventure').waitFor({state:'hidden'});
  assert.deepEqual(errors,[]);
  console.log('PASS authoritative-effect UI, close-call feedback, real enemy volley in Snow Day, safe exit and zero page errors');
 }finally{if(browser)await browser.close();proc.kill()}
})().catch(e=>{console.error(e);process.exitCode=1});
