// Optional Playwright smoke test for the SnowFight guest-first foundation.
// Run locally: node backend/tests/foundation-browser.cjs (Playwright + Chromium required).
const {chromium}=require('playwright');
const {spawn}=require('node:child_process');
const assert=require('node:assert/strict');
const path=require('node:path');
const PORT=3483;
(async()=>{
  const server=spawn('node',['backend/server.js'],{
    cwd:path.join(__dirname,'../..'),env:{...process.env,PORT:String(PORT),MATCH_DURATION_TICKS:'180'},stdio:'pipe'
  });
  try {
    await new Promise((resolve,reject)=>{
      const timeout=setTimeout(()=>reject(new Error('server did not start')),10000);
      server.stdout.on('data',data=>{if(String(data).includes('running on port')){clearTimeout(timeout);resolve();}});
      server.on('exit',code=>{clearTimeout(timeout);reject(new Error('server exited '+code));});
    });
    const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_EXECUTABLE||undefined,args:['--no-sandbox']});
    try {
      const page=await browser.newPage({viewport:{width:844,height:390},isMobile:true,hasTouch:true});
      const errors=[];page.on('pageerror',e=>errors.push(e.message));
      await page.goto('http://localhost:'+PORT);
      await page.locator('#btn-play-online:not([disabled])').waitFor();
      assert.equal(await page.locator('#foundation-kid').isVisible(),true);
      await page.locator('#foundation-kid').click();
      await page.locator('#foundation-kid-panel').waitFor({state:'visible'});
      await page.locator('#foundation-skin button').last().click();
      await page.locator('#foundation-jacket button').last().click();
      await page.locator('#foundation-hat button').last().click();
      let first=await page.evaluate(()=>SNOW_GUEST.get());
      assert.deepEqual(first,{skin:'#75442F',jacket:'#DB9D36',hat:'#313C4F'});
      await page.locator('#foundation-save').click();
      await page.locator('#btn-play-quick').click();
      await page.waitForFunction(()=>STATE.id && STATE.players[STATE.id]?.autoReload===true);
      const player=await page.evaluate(()=>STATE.players[STATE.id]);
      assert.equal(player.skinColor,first.skin);
      assert.equal(player.jacketColor,first.jacket);
      assert.equal(player.hatColor,first.hat);
      assert.equal(await page.locator('#btn-gather').isVisible(),false);
      const mode=await page.evaluate(()=>STATE.mode);
      assert.equal(mode,'single');
      await page.reload();
      await page.locator('#btn-play-online:not([disabled])').waitFor();
      assert.deepEqual(await page.evaluate(()=>SNOW_GUEST.get()),first);
      assert.deepEqual(errors,[]);
      console.log('PASS guest customization, server sync, auto-pack, legacy menu compatibility and persistence');
      await page.close();
      const a=await browser.newPage(),b=await browser.newPage();
      await a.goto('http://localhost:'+PORT);await b.goto('http://localhost:'+PORT);
      await Promise.all([a,b].map(p=>p.locator('#btn-play-online:not([disabled])').waitFor()));
      await a.locator('#btn-play-online').click();await b.locator('#btn-play-online').click();
      await Promise.all([a,b].map(p=>p.waitForFunction(()=>STATE.id && STATE.mode==='multi')));
      const ida=await a.evaluate(()=>STATE.id),idb=await b.evaluate(()=>STATE.id);
      await Promise.all([a,b].map(p=>p.waitForFunction(()=>Object.keys(STATE.players).length>=2)));
      assert.notEqual(ida,idb);
      assert.equal(await a.evaluate(()=>Object.values(STATE.players).filter(p=>p.autoReload).length),2);
      console.log('PASS two independent online clients share match and receive streamlined appearance');
      await a.close();await b.close();
    }finally{await browser.close();}
  }finally{server.kill();}
})().catch(e=>{console.error(e);process.exitCode=1;});
