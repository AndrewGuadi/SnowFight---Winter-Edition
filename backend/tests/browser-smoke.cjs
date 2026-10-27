const {chromium}=require('playwright');
const path=require('node:path');
const os=require('node:os');
const assert=require('node:assert/strict');
const {spawn}=require('node:child_process');
(async()=>{
 const server=spawn('node',['backend/server.js'],{cwd:path.join(__dirname,'../..'),env:{...process.env,PORT:'3460',MATCH_DURATION_TICKS:'180'},stdio:'pipe'});
 await new Promise((resolve,reject)=>{server.stdout.on('data',d=>{if(String(d).includes('running'))resolve()});server.on('exit',reject)});
 const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_EXECUTABLE || undefined,args:['--no-sandbox']});
 try {
 const page=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true});const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:3460');await page.locator('#btn-play:not([disabled])').waitFor();
 await page.locator('#mode-multi').click();await page.locator('#btn-play').click();await page.locator('#start-screen').waitFor({state:'hidden'});
 const cdp=await page.context().newCDPSession(page);const bounds={};for(const id of ['joystick-zone','btn-throw','btn-gather','btn-dash'])bounds[id]=await page.locator('#'+id).boundingBox();
 const center=id=>({x:bounds[id].x+bounds[id].width/2,y:bounds[id].y+bounds[id].height/2});
 const j=center('joystick-zone'),a=center('btn-throw');
 await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{...j,id:1},{...a,id:2}]});
 await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:j.x+25,y:j.y,id:1},{x:a.x,y:a.y-40,id:2}]});
 await page.waitForTimeout(150);
 let state=await page.evaluate(()=>({move:STATE.inputs.moveX,angle:STATE.inputs.angle}));assert.ok(state.move>.5);assert.ok(state.angle < -1.4);
 await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
 await page.waitForTimeout(100); await page.waitForFunction(()=>STATE.players[STATE.id]?.stats.throws===1,{},{timeout:3000});
 const g=center('btn-gather');await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{...g,id:3}]});
 await page.waitForFunction(()=>STATE.players[STATE.id]?.hasBall);await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
 assert.equal(await page.evaluate(()=>STATE.inputs.gather),false);
 await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{...a,id:4}]});await page.waitForTimeout(100);
 await cdp.send('Input.dispatchTouchEvent',{type:'touchCancel',touchPoints:[]});await page.waitForTimeout(100);
 assert.equal(await page.evaluate(()=>STATE.players[STATE.id].chargeLevel),0);
 assert.equal(await page.evaluate(()=>STATE.players[STATE.id].stats.throws),1);
 await page.screenshot({path:path.join(os.tmpdir(),'snowfight-mobile-qa.png')});
 await page.setViewportSize({width:844,height:390});await page.waitForTimeout(400);await page.screenshot({path:path.join(os.tmpdir(),'snowfight-landscape-qa.png')});
 await page.evaluate(()=>{MENU.mode='single';joinGame()});
 await page.locator('#results-overlay').waitFor({state:'visible',timeout:7000});assert.match(await page.locator('#results-personal').innerText(),/0 freezes/);
 assert.equal(await page.evaluate(()=>career.rounds),1);await page.waitForTimeout(700);assert.equal(await page.evaluate(()=>career.rounds),1);
 await page.getByRole('button',{name:'REMATCH',exact:true}).click();await page.locator('#results-overlay').waitFor({state:'hidden'});await page.waitForFunction(()=>STATE.ended===false); assert.equal(await page.evaluate(()=>STATE.ended),false);
 assert.deepEqual(errors,[]);console.log('PASS: portrait/landscape render, simultaneous move+aim, release-to-throw, gather, cancellation, authoritative results, deduplicated progression, rematch; no JS errors');
 } finally {await browser.close();server.kill();}
})().catch(e=>{console.error(e);process.exitCode=1});
