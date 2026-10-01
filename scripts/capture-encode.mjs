/** Cross-platform FFmpeg export; equivalent to capture-encode.sh. */
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import assert from 'node:assert/strict';
if(process.argv.includes('--help')){console.log('node scripts/capture-encode.mjs FRAMES_DIR OUTPUT.mp4 [FPS=24] [FRAMES=720]');process.exit(0);}
const [directory='artifacts/browser-capture',output='artifacts/forest-cinematic-30s.mp4',rate='24',count='720']=process.argv.slice(2);
const fps=Number(rate),frames=Number(count);
if(![fps,frames].every(n=>Number.isInteger(n)&&n>0))throw new Error('FPS and frame count must be positive integers.');
for(let i=0;i<frames;i++)if(!fs.existsSync(path.join(directory,`frame-${String(i).padStart(4,'0')}.png`)))throw new Error(`Missing frame ${i}`);
fs.mkdirSync(path.dirname(path.resolve(output)),{recursive:true});
function run(command,args){const result=spawnSync(command,args,{stdio:'inherit'});if(result.error)throw result.error;if(result.status!==0)throw new Error(`${command} failed (${result.status})`);}
// setparams tags the converted frames; it does not change their brightness.
run('ffmpeg',['-y','-framerate',String(fps),'-i',path.join(directory,'frame-%04d.png'),'-frames:v',String(frames),'-an','-vf','scale=in_range=full:out_range=tv:out_color_matrix=bt709,setparams=range=limited:color_primaries=bt709:color_trc=bt709:colorspace=bt709','-c:v','libx264','-preset','slow','-crf','18','-pix_fmt','yuv420p','-color_range','tv','-colorspace','bt709','-color_primaries','bt709','-color_trc','bt709','-movflags','+faststart',output]);
run('ffmpeg',['-v','error','-i',output,'-f','null','-']);
const probe=spawnSync('ffprobe',['-v','error','-count_frames','-select_streams','v:0','-show_entries','stream=width,height,r_frame_rate,avg_frame_rate,nb_read_frames,duration,color_range,color_space,color_transfer,color_primaries','-of','json',output],{encoding:'utf8'});
if(probe.error)throw probe.error;
assert.equal(probe.status,0,probe.stderr);
const result=JSON.parse(probe.stdout),stream=result.streams[0];
const firstPng=fs.readFileSync(path.join(directory,'frame-0000.png'));
for(const [key,value] of Object.entries({width:firstPng.readUInt32BE(16),height:firstPng.readUInt32BE(20),r_frame_rate:`${fps}/1`,avg_frame_rate:`${fps}/1`,nb_read_frames:String(frames),duration:(frames/fps).toFixed(6),color_range:'tv',color_space:'bt709',color_transfer:'bt709',color_primaries:'bt709'}))assert.equal(stream[key],value,`Export ${key}`);
console.log(JSON.stringify(result,null,2));
