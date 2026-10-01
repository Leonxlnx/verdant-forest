import {spawn} from 'node:child_process';
const server=spawn('bash',['scripts/sites-env.sh','--','node','node_modules/vite/bin/vite.js','--config','scripts/capture-vite.config.mjs'],{stdio:'inherit'});
try{
 for(let i=0;i<120;i++){
  try{const r=await fetch('http://127.0.0.1:5173/');if(r.ok)break;}catch{}
  await new Promise(r=>setTimeout(r,1000));
  if(i===119)throw new Error('Local preview not ready after 120 seconds');
 }
 const task=spawn(process.execPath,['scripts/capture-browser.mjs',...process.argv.slice(2)],{stdio:'inherit'});
 const code=await new Promise(r=>task.once('exit',r));process.exitCode=code;
}finally{server.kill('SIGTERM');}
