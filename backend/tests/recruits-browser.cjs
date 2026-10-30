const {chromium}=require('playwright');
const {spawn}=require('node:child_process');
const path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict');
(async()=>{
 const server=spawn('node',['backend/server.js'],{cwd:path.join(__dirname,'../..'),env:{...process.env,PORT:'3461'},stdio:'pipe'});
 await new Promise((resolve,reject)=>{server.stdout.on('data',d=>{if(String(d).includes('running'))resolve()});server.on('exit',reject)});
 const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_EXECUTABLE||undefined,args:['--no-sandbox']});
 try{
 const page=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true});const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:3461');await page.locator('#btn-play-quick:not([disabled])').waitFor();await page.locator('#front-door button[onclick="toggleCustom()"]').click();
 await page.screenshot({path:path.join(os.tmpdir(),'recruits-menu-mobile.png')});
 for(const id of ['glacier','snowbug','frostweaver']) {
   if(id!=='glacier'){await page.reload();await page.locator('#btn-play-quick:not([disabled])').waitFor();await page.locator('#front-door button[onclick="toggleCustom()"]').click();}
   await page.locator(`[data-recruit="${id}"]`).click();await page.locator('#mode-multi').click();await page.locator('#btn-play').click();
   await page.waitForFunction(id=>STATE.players[STATE.id]?.classId===id,id);
   assert.equal(await page.locator('#btn-ability').isVisible(),true);
   if(id==='frostweaver') await page.evaluate(()=>{const p=STATE.players[STATE.id];for(let a=0;a<Math.PI*2;a+=.1){const x=p.targetX+Math.cos(a)*90,y=p.targetY+Math.sin(a)*90;if(x>38&&x<STATE.worldWidth-38&&y>38&&y<STATE.worldHeight-38&&!STATE.obstacles.some(o=>Math.hypot(x-o.x,y-o.y)<o.radius+46)){STATE.inputs.angle=a;break;}}});
   await page.locator('#btn-ability').tap();
   await page.waitForFunction(()=>STATE.players[STATE.id].abilityCooldown>0,{}, {timeout:3000});
   if(id==='glacier')assert.ok(await page.evaluate(()=>STATE.players[STATE.id].guardTicks>0));
   if(id==='snowbug')assert.equal(await page.evaluate(()=>STATE.players[STATE.id].hasBall),false);
   if(id==='frostweaver')await page.waitForFunction(()=>STATE.structures.length===1);
   await page.waitForTimeout(200);await page.screenshot({path:path.join(os.tmpdir(),`recruit-${id}-mobile.png`)});
   await page.locator('#btn-ability').tap();assert.ok(await page.evaluate(()=>STATE.players[STATE.id].abilityCooldown>0));
 }
 await page.setViewportSize({width:844,height:390});await page.waitForTimeout(400);await page.screenshot({path:path.join(os.tmpdir(),'recruits-landscape.png')});
 assert.ok(await page.locator('#btn-ability').isVisible());
 const buttons=await page.locator('#btn-ability').boundingBox();assert.ok(buttons.x>=0 && buttons.x+buttons.width<=844 && buttons.y+buttons.height<=390);
 await page.setViewportSize({width:1280,height:800});await page.reload();await page.locator('#btn-play-quick:not([disabled])').waitFor();await page.locator('#front-door button[onclick="toggleCustom()"]').click();await page.screenshot({path:path.join(os.tmpdir(),'recruits-menu-desktop.png')});
 await page.locator('#mode-multi').click();await page.locator('#btn-play').click();await page.waitForFunction(()=>STATE.players[STATE.id]?.classId==='glacier');await page.keyboard.press('e');await page.waitForFunction(()=>STATE.players[STATE.id].guardTicks>0);
 await page.reload();await page.locator('#btn-play-quick:not([disabled])').waitFor();await page.locator('#front-door button[onclick="toggleCustom()"]').click();await page.locator('[data-recruit=classic]').click();await page.locator('#mode-multi').click();await page.locator('#btn-play').click();await page.waitForFunction(()=>STATE.players[STATE.id]?.classId==='classic');assert.equal(await page.locator('#btn-ability').isVisible(),false);
 assert.deepEqual(errors,[]);console.log('PASS three class selections, server-confirmed touch abilities, cooldowns, cover creation, responsive portraits and landscape, no JS errors');
 }finally{await browser.close();server.kill();}
})().catch(e=>{console.error(e);process.exitCode=1});

