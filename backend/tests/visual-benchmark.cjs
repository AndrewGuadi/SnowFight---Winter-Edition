// Repeatable local Chromium frame-time sampler; not a physical-device benchmark.
const {chromium}=require('playwright');
const {spawn}=require('node:child_process');
const path=require('node:path'),fs=require('node:fs'),os=require('node:os');
const PORT=3494,DURATION=Number(process.env.BENCHMARK_MS)||5000,OUT=process.env.EVIDENCE_DIR||os.tmpdir();
(async()=>{
 const server=spawn('node',['backend/server.js'],{cwd:path.join(__dirname,'../..'),env:{...process.env,PORT:String(PORT),MATCH_DURATION_TICKS:'999999'},stdio:'pipe'});
 try{
  await new Promise((resolve,reject)=>{const timeout=setTimeout(()=>reject(new Error('server start timeout')),10000);server.stdout.on('data',d=>{if(String(d).includes('running on port')){clearTimeout(timeout);resolve();}});server.on('exit',reject);});
  const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_EXECUTABLE||undefined,args:['--no-sandbox']});
  const results={date:new Date().toISOString(),label:process.env.BENCHMARK_LABEL||'candidate',browser:'Chromium '+browser.version(),node:process.version,viewport:{width:844,height:390},durationMs:DURATION,scenarios:[]};
  try{
   const page=await browser.newPage({viewport:{width:844,height:390}});
   await page.addInitScript(()=>{
    const raf=window.requestAnimationFrame.bind(window);window.__rafWork=[];
    window.requestAnimationFrame=callback=>raf(now=>{const start=performance.now();try{return callback(now);}finally{window.__rafWork.push(performance.now()-start);}});
   });
   await page.goto('http://127.0.0.1:'+PORT);await page.locator('#btn-play-quick:not([disabled])').waitFor();
   for(const size of [5,10,30]){
    await page.evaluate(size=>{selectSoloMission('');selectMode('single');selectSize(size,size);joinGame();},size);
    await page.waitForFunction(count=>Object.keys(STATE.players).length===count,size*2,{timeout:15000});
    await page.waitForTimeout(1500);
    const sample=await page.evaluate(duration=>new Promise(resolve=>{
     const frames=[];let previous=performance.now(),start=previous;
     function frame(now){frames.push(now-previous);previous=now;if(now-start<duration)requestAnimationFrame(frame);else{
      frames.shift();const sorted=[...frames].sort((a,b)=>a-b);const pct=p=>Math.round(sorted[Math.floor((sorted.length-1)*p)]*100)/100;
      const nav=performance.getEntriesByType('navigation')[0];
      const work=window.__rafWork.slice(-frames.length).sort((a,b)=>a-b),workPct=p=>Math.round(work[Math.floor((work.length-1)*p)]*100)/100;
      resolve({samples:frames.length,frameMs:{p50:pct(.5),p95:pct(.95),p99:pct(.99)},callbackMs:{p50:workPct(.5),p95:workPct(.95),p99:workPct(.99)},loadMs:nav?Math.round(nav.domContentLoadedEventEnd):null,heapBytes:performance.memory?performance.memory.usedJSHeapSize:null,players:Object.keys(STATE.players).length});
     }}requestAnimationFrame(frame);
    }),DURATION);
    sample.scenario=size+'v'+size+' solo bots';results.scenarios.push(sample);
    await page.screenshot({path:path.join(OUT,results.label+'-'+size+'v'+size+'.png')});
   }
   await page.close();
  }finally{await browser.close();}
  const file=path.join(OUT,results.label+'-benchmark.json');fs.writeFileSync(file,JSON.stringify(results,null,2));
  console.log(JSON.stringify(results,null,2));console.log('BENCHMARK JSON:',file);
 }finally{server.kill();}
})().catch(e=>{console.error(e);process.exitCode=1;});
