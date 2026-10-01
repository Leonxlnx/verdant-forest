/** Actual production WebGL canvas capture, stepped independently of machine speed.
 * FOREST_BROWSER_EXECUTABLE=/path/to/chrome FOREST_PLAYWRIGHT_MODULE=/path/to/playwright/index.mjs
 * FOREST_SOFTWARE_WEBGL=1 node scripts/capture-start.mjs --output /path/to/frames --fps 24 --frames 720
 * Interrupted captures can continue with the same arguments plus --resume.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
const args=Object.fromEntries(process.argv.slice(2).reduce((all,arg,index,list)=>arg.startsWith('--')?[...all,[arg.slice(2),list[index+1]?.startsWith('--')?true:list[index+1]??true]]:all,[]));
const width=Number(args.width||1280),height=Number(args.height||720),fps=Number(args.fps||24),frames=Number(args.frames||fps*30),start=Number(args.start||0);
async function fingerprint(){
 const names=(await fs.readdir('app/forest')).filter(f=>/\.(ts|js)$/.test(f)).sort();
 const files=Object.fromEntries(await Promise.all(names.map(async f=>[f,createHash('sha256').update(await fs.readFile(path.join('app/forest',f))).digest('hex')])));
 return {files,sha256:createHash('sha256').update(JSON.stringify(files)).digest('hex')};
}
const source=await fingerprint();
const output=path.resolve(args.output||'artifacts/browser-capture');await fs.mkdir(output,{recursive:true});
const url=new URL(args.url||'http://127.0.0.1:5173');url.searchParams.set('capture','1');
const manifestPath=path.join(output,'capture-source.json');
const manifest={source,width,height,fps,url:url.href};
try{
 const existing=JSON.parse(await fs.readFile(manifestPath,'utf8'));
 if(existing.source.sha256!==source.sha256||existing.width!==width||existing.height!==height||existing.fps!==fps)throw new Error('Capture directory has a different source hash, resolution or FPS. Use a new directory.');
}catch(error){if(error.code!=='ENOENT')throw error;await fs.writeFile(manifestPath,JSON.stringify(manifest,null,2));}
const requested=args.times?String(args.times).split(',').map(t=>Math.round(Number(t)*fps)):Array.from({length:frames},(_,i)=>start+i);
const prior=new Map();
if(args.resume){
 for(const name of (await fs.readdir(output)).filter(n=>/^timings-.*\.jsonl$/.test(n))){
  for(const line of (await fs.readFile(path.join(output,name),'utf8')).split('\n').filter(Boolean)){try{const item=JSON.parse(line);prior.set(item.frame,item);}catch{}}
 }
}
const pending=[];
for(const frame of requested){
 let valid=false;
 if(args.resume&&prior.has(frame))try{const bytes=await fs.readFile(path.join(output,`frame-${String(frame).padStart(4,'0')}.png`));valid=createHash('sha256').update(bytes).digest('hex')===prior.get(frame).sha256;}catch{}
 if(!valid)pending.push(frame);
}
const logPath=path.join(output,`timings-${start}.jsonl`),reportPath=path.join(output,`capture-report-${start}.json`);
if(!args.resume)await fs.writeFile(logPath,'');
const timings=requested.filter(frame=>prior.has(frame)&&!pending.includes(frame)).map(frame=>prior.get(frame));
const first=Date.now(),consoleErrors=[];let info;
async function checkpoint(status,error){
 const report={source:'actual-browser-WebGL-fixed-step-capture',sourceHash:source.sha256,sourceHashes:source.files,url:url.href,info,width,height,fps,frames:timings.length,expectedFrames:requested.length,start,duration:args.times?null:requested.length/fps,wallSeconds:(Date.now()-first)/1000,consoleErrors,status,error,timings:[...timings].sort((a,b)=>a.frame-b.frame)};
 const temporary=reportPath+'.tmp';await fs.writeFile(temporary,JSON.stringify(report,null,2));await fs.rename(temporary,reportPath);
 return report;
}
if(!pending.length){await checkpoint('complete');console.log('All requested frames already verified.');process.exit(0);}
const {chromium}=await import(process.env.FOREST_PLAYWRIGHT_MODULE||'playwright');
console.log(JSON.stringify({stage:'browser-start',width,height,fps,frames:pending.length,resumed:timings.length,sourceHash:source.sha256}));
const browser=await chromium.launch({headless:true,executablePath:process.env.FOREST_BROWSER_EXECUTABLE||undefined,args:process.env.FOREST_BROWSER_ARGS?JSON.parse(process.env.FOREST_BROWSER_ARGS):process.env.FOREST_SOFTWARE_WEBGL==='1'?['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']:[]});
const page=await browser.newPage({viewport:{width,height},deviceScaleFactor:1});
page.on('pageerror',error=>consoleErrors.push(error.message));page.on('console',message=>{if(message.type()==='error')consoleErrors.push(message.text());});
try{
 await page.goto(url.href,{waitUntil:'domcontentloaded',timeout:120000});
 await page.waitForFunction(()=>{if(document.body.dataset.error)throw new Error(document.body.dataset.error);return document.querySelector('canvas')?.dataset.status==='ready'&&typeof window.__forestCapture?.render==='function';},undefined,{timeout:180000});
 info=await page.evaluate(()=>window.__forestCapture.info());
 console.log(JSON.stringify({stage:'scene-ready',info}));
 await checkpoint('capturing');
 // A resumed segment restores the original shot's shadow anchor and last eight-Hz
 // shadow phase before continuing. At24fps each shadow interval is exactly3frames.
 if(args.resume&&pending[0]>start&&fps===24&&!args.times){
  const durations=await page.evaluate(async()=>{const m=await import('/app/forest/cinematic.ts');return m.FOREST_FILM_SHOTS.map(shot=>shot.duration);});
  const time=pending[0]/fps;let anchor=0;for(const d of durations){if(time<anchor+d)break;anchor+=d;}
  const previousShadow=anchor+Math.max(0,Math.floor(((pending[0]-1)/fps-anchor)*8))/8;
  await page.evaluate(t=>window.__forestCapture.render(t),anchor);
  if(previousShadow>anchor)await page.evaluate(t=>window.__forestCapture.render(t),previousShadow);
 }
 for(const frame of pending){
  const began=Date.now();
  const result=await page.evaluate(({time,shot})=>{
   const state=window.__forestCapture.render(time,shot),canvas=document.querySelector('canvas');
   return {state,data:canvas.toDataURL('image/png').split(',')[1],width:canvas.width,height:canvas.height};
  },{time:frame/fps,shot:args.shot===undefined?undefined:Number(args.shot)});
  const bytes=Buffer.from(result.data,'base64'),destination=path.join(output,`frame-${String(frame).padStart(4,'0')}.png`);
  await fs.writeFile(destination+'.tmp',bytes);await fs.rename(destination+'.tmp',destination);
  const timing={frame,time:frame/fps,ms:Date.now()-began,sha256:createHash('sha256').update(bytes).digest('hex'),width:result.width,height:result.height,state:result.state};
  timings.push(timing);await fs.appendFile(logPath,JSON.stringify(timing)+'\n');
  if(args.times||timings.length%12===0||timings.length===1)console.log(JSON.stringify({frame,seconds:frame/fps,ms:timing.ms,triangles:result.state.triangles,draws:result.state.draws,complete:timings.length,total:requested.length}));
  if(consoleErrors.length)throw new Error('Browser errors: '+consoleErrors.join('\n'));
  if(timings.length%60===0){if((await fingerprint()).sha256!==source.sha256)throw new Error('Scene source changed during capture; preserved existing frames for review.');await checkpoint('capturing');}
 }
 if((await fingerprint()).sha256!==source.sha256)throw new Error('Scene source changed during capture; preserved frames belong to recorded source hash.');
 const report=await checkpoint('complete');console.log(JSON.stringify({...report,timings:undefined,sourceHashes:undefined}));
}catch(error){await checkpoint('interrupted',String(error));throw error;}
finally{await browser.close();}
