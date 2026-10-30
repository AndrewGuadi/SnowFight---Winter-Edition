// Chromium visual/interaction regression. Uses the real Node + Socket.IO server.
const {chromium}=require('playwright');
const {spawn}=require('node:child_process');
const assert=require('node:assert/strict');
const path=require('node:path'),os=require('node:os');
const PORT=3492,OUT=process.env.EVIDENCE_DIR||os.tmpdir();
(async()=>{
 const server=spawn('node',['backend/server.js'],{cwd:path.join(__dirname,'../..'),env:{...process.env,PORT:String(PORT),MATCH_DURATION_TICKS:'1200'},stdio:'pipe'});
 try{
  await new Promise((resolve,reject)=>{const timeout=setTimeout(()=>reject(new Error('server start timeout')),10000);server.stdout.on('data',d=>{if(String(d).includes('running on port')){clearTimeout(timeout);resolve();}});server.on('exit',reject);});
  const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_EXECUTABLE||undefined,args:['--no-sandbox']});
  try{
   const page=await browser.newPage({viewport:{width:844,height:390},isMobile:true,hasTouch:true});
   const errors=[];page.on('pageerror',e=>errors.push(e.message));
   await page.goto('http://127.0.0.1:'+PORT);
   await page.locator('#btn-play-quick:not([disabled])').waitFor();
   const manifest=await page.evaluate(async()=>{const href=document.querySelector('link[rel=manifest]').href;const r=await fetch(href);return {ok:r.ok,body:await r.json()};});
   assert.equal(manifest.ok,true);assert.equal(manifest.body.display,'standalone');assert.equal(manifest.body.orientation,'landscape');
   await page.locator('#foundation-kid').click();await page.locator('#foundation-jacket button').nth(2).click();await page.locator('#foundation-hat button').nth(3).click();
   const previewBox=await page.locator('#foundation-preview').boundingBox();assert.ok(Math.abs(previewBox.width/previewBox.height-260/180)<.05,'creator preview keeps its aspect ratio');
   await page.locator('#foundation-preview').screenshot({path:path.join(OUT,'after-kid-creator.png')});
   await page.locator('#foundation-save').click();await page.locator('#btn-play-quick').click();
   await page.waitForFunction(()=>STATE.players[STATE.id]?.autoReload===true);
   await page.waitForTimeout(400);
   assert.equal(await page.evaluate(()=>STATE.players[STATE.id].animState),'idle');
   // Every palette combination renders in every required state without separate sheets.
   const combinations=await page.evaluate(()=>{
    const canvas=document.createElement('canvas');canvas.width=120;canvas.height=120;const c=canvas.getContext('2d');
    const states=['idle','walking','running','aiming','throw','hit','frozen','recovery','victory'];let count=0;
    for(const skin of SNOW_GUEST.palette.skin)for(const jacket of SNOW_GUEST.palette.jacket)for(const hat of SNOW_GUEST.palette.hat)for(const animState of states){
     c.clearRect(0,0,120,120);c.save();c.translate(60,83);drawSnowRecruit(c,{classId:'classic',team:'blue',skinColor:skin,jacketColor:jacket,hatColor:hat,animState,stateTime:80,hasBall:true,chargeLevel:20,facingAngle:.4,walkCycle:1,throwKind:'charged'},900);c.restore();count++;
    }
    return count;
   });
   assert.equal(combinations,900);
   await page.evaluate(()=>{
    const sheet=document.createElement('canvas');sheet.id='animation-storyboard';sheet.width=480;sheet.height=480;
    sheet.style.cssText='position:fixed;inset:0;margin:auto;z-index:100;background:#dbeef3;border-radius:18px';
    const c=sheet.getContext('2d'),states=['idle','walking','running','aiming','throw','hit','frozen','recovery','victory'],look=SNOW_GUEST.get();
    states.forEach((animState,i)=>{const x=(i%3)*160,y=Math.floor(i/3)*160;c.save();c.translate(x+80,y+116);c.scale(1.65,1.65);drawSnowRecruit(c,{classId:'classic',team:'blue',skinColor:look.skin,jacketColor:look.jacket,hatColor:look.hat,animState,stateTime:100,hasBall:true,chargeLevel:30,facingAngle:.35,walkCycle:1.2,throwKind:'charged'},900);c.restore();c.fillStyle='#173b51';c.font='bold 13px sans-serif';c.textAlign='center';c.fillText(animState.toUpperCase(),x+80,y+148);});
    document.body.appendChild(sheet);
   });
   await page.locator('#animation-storyboard').screenshot({path:path.join(OUT,'animation-storyboard.png')});
   await page.evaluate(()=>document.getElementById('animation-storyboard').remove());
   // Actual touch input -> server movement and throw release.
   const joy=await page.locator('#joystick-zone').boundingBox(),throwBox=await page.locator('#btn-throw').boundingBox();
   const cdp=await page.context().newCDPSession(page);
   const j={x:joy.x+joy.width/2,y:joy.y+joy.height/2},a={x:throwBox.x+throwBox.width/2,y:throwBox.y+throwBox.height/2};
   await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{...j,id:1}]});
   await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:j.x+35,y:j.y,id:1}]});
   await page.waitForFunction(()=>['walking','running'].includes(STATE.players[STATE.id].animState));
   await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:j.x+35,y:j.y,id:1},{...a,id:2}]});
   await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:j.x+35,y:j.y,id:1},{x:a.x,y:a.y-35,id:2}]});
   await page.waitForTimeout(160);
   await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
   await page.waitForFunction(()=>STATE.players[STATE.id].stats.throws>=1);
   await page.waitForTimeout(80);await page.screenshot({path:path.join(OUT,'after-gameplay-mobile.png')});
   assert.equal(await page.evaluate(()=>STATE.inputs.moveX),0);
   // Fullscreen is a progressive enhancement; Chromium supports the standard path.
   await page.locator('#fullscreen-toggle').click();
   await page.waitForFunction(()=>!!document.fullscreenElement&&document.getElementById('fullscreen-toggle').textContent==='EXIT FULLSCREEN');
   assert.equal(await page.locator('#fullscreen-toggle').getAttribute('aria-pressed'),'true');
   await page.locator('#fullscreen-toggle').click();await page.waitForFunction(()=>!document.fullscreenElement&&document.getElementById('fullscreen-toggle').textContent==='ENTER FULLSCREEN');
   await page.locator('#effects-toggle').click();assert.equal(await page.evaluate(()=>STATE.lowEffects&&SNOW_EFFECTS.lowQuality),true);
   await page.setViewportSize({width:1024,height:600});await page.waitForTimeout(250);
   const sizing=await page.evaluate(()=>({w:canvas.width,h:canvas.height,cssW:innerWidth,cssH:innerHeight,dpr:Math.min(devicePixelRatio||1,1.5)}));
   assert.equal(sizing.w,Math.round(sizing.cssW*sizing.dpr));assert.equal(sizing.h,Math.round(sizing.cssH*sizing.dpr));
   await page.screenshot({path:path.join(OUT,'after-gameplay-tablet.png')});
   assert.ok(await page.evaluate(()=>SNOW_DEBUG.performance().samples>10));
   assert.deepEqual(errors,[]);
   const reduced=await browser.newPage({viewport:{width:844,height:390},reducedMotion:'reduce'});
   await reduced.goto('http://127.0.0.1:'+PORT);await reduced.locator('#btn-play-quick:not([disabled])').waitFor();await reduced.locator('#btn-play-quick').click();
   await reduced.waitForFunction(()=>STATE.players[STATE.id]?.reducedMotion===true);assert.equal(await reduced.evaluate(()=>CONFIG.screenShake),0);
   await reduced.close();
   console.log('PASS 900 customization/state renders, real touch move+throw, fullscreen enter/exit, FX tier, DPR resize, reduced motion, manifest and performance probes; no JS errors');
  }finally{await browser.close();}
 }finally{server.kill();}
})().catch(e=>{console.error(e);process.exitCode=1;});
