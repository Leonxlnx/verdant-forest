/** Portable local capture launcher: Node + Vite, no Bash/cloud wrapper required. */
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
process.chdir(root);
const args=process.argv.slice(2);
let server,task;
try{
 if(!args.includes('--help')&&!args.includes('--source-only')){
  const {createServer}=await import('vite');
  server=await createServer({configFile:path.join(root,'scripts/capture-vite.config.mjs')});
  await server.listen();
 }
 task=spawn(process.execPath,['scripts/capture-browser.mjs',...args],{cwd:root,stdio:'inherit'});
 for(const signal of ['SIGINT','SIGTERM'])process.once(signal,()=>task.kill(signal));
 process.exitCode=await new Promise((resolve,reject)=>{task.once('error',reject);task.once('exit',(code,signal)=>resolve(code??(signal?130:1)));});
}finally{await server?.close();}
