// Isolated bark-material review. This exports actual Three shader hooks and
// synthetic inspection geometry; it never changes the production scene.
import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
import assert from 'node:assert/strict';
import ts from 'typescript';
import * as THREE from 'three';
const out='artifacts/upgrade-bark';fs.mkdirSync(out,{recursive:true});
const current=fs.readFileSync('app/forest/materials.ts','utf8');
const original=execFileSync('git',['show','144e1dc:app/forest/materials.ts'],{encoding:'utf8'});
for(const [name,source] of [['before',original],['after',current]]){
 const js=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText;
 fs.writeFileSync(`${out}/${name}.mjs`,js);
}
const before=await import(`../${out}/before.mjs`),after=await import(`../${out}/after.mjs`);
const texture=new THREE.Texture();
function shaderOf(material){const shader={uniforms:{},vertexShader:THREE.ShaderLib.standard.vertexShader,fragmentShader:THREE.ShaderLib.standard.fragmentShader};material.onBeforeCompile(shader,{});return shader;}
const oldShader=shaderOf(before.treeBarkMaterial('birch',texture,texture));
const newShader=shaderOf(after.treeBarkMaterial('birch',texture,texture));
assert.match(oldShader.fragmentShader,/row=floor\(vBarkPosition.y\*7.3\)/,'baseline must reproduce the reported row generator');
assert.doesNotMatch(newShader.fragmentShader,/row=floor|rowSeed|markSeed|atan\(vBarkPosition/,'new bark must not keep a row or angular dash generator');
assert.match(newShader.vertexShader,/barkOrigin=instanceMatrix\*barkOrigin/,'material variation must vary per instance');
for(const species of ['oak','beech']){
 const a=before.treeBarkMaterial(species,texture,texture),b=after.treeBarkMaterial(species,texture,texture);
 assert.equal(a.color.getHex(),b.color.getHex());assert.deepEqual(a.normalScale.toArray(),b.normalScale.toArray());assert.equal(a.roughness,b.roughness);
 // Color/normal behavior is preserved, rather than just matching parameter names.
 const originalColor=shaderOf(a).fragmentShader.slice(shaderOf(a).fragmentShader.indexOf('float flake='),shaderOf(a).fragmentShader.indexOf('#include <alphamap_fragment>'));
 assert.ok(shaderOf(b).fragmentShader.includes(originalColor),`${species} albedo is unchanged`);
 assert.doesNotMatch(shaderOf(b).fragmentShader,/float birchHash|barkRelief/);
}
function includes(s){return s.replace(/^[ \t]*#include +<([\w\d_]+)>/gm,(_,k)=>includes(THREE.ShaderChunk[k]));}
function unroll(s){return s.replace(/#pragma unroll_loop_start\s+for\s*\(\s*int i = (\d+);\s*i < (\d+);\s*i\s*\+\+\s*\)\s*\{([\s\S]+?)\}\s*#pragma unroll_loop_end/g,(_,a,b,body)=>Array.from({length:Number(b)-Number(a)},(_,j)=>body.replace(/\[\s*i\s*\]/g,'[ '+(Number(a)+j)+' ]').replace(/UNROLLED_LOOP_INDEX/g,String(Number(a)+j))).join(''));}
function expand(s){return unroll(includes(s).replace(/NUM_[A-Z_]+/g,k=>['NUM_DIR_LIGHTS','NUM_HEMI_LIGHTS'].includes(k)?'1':'0').replace(/UNION_CLIPPING_PLANES/g,'0'));}
const defs='#define USE_MAP\n#define MAP_UV uv\n#define USE_NORMALMAP\n#define USE_NORMALMAP_TANGENTSPACE\n#define NORMALMAP_UV uv';
const vp=`#version 330\n#define attribute in\n#define varying out\n#define texture2D texture\n${defs}\nuniform mat4 modelMatrix;uniform mat4 modelViewMatrix;uniform mat4 projectionMatrix;uniform mat4 viewMatrix;uniform mat3 normalMatrix;uniform vec3 cameraPosition;uniform bool isOrthographic;attribute vec3 position;attribute vec3 normal;attribute vec2 uv;\n`;
const fp=`#version 330\n#define varying in\n#define texture2D texture\n#define textureCube texture\nout vec4 pc_fragColor;\n#define gl_FragColor pc_fragColor\n${defs}\nuniform mat4 viewMatrix;uniform vec3 cameraPosition;uniform bool isOrthographic;${THREE.ShaderChunk.colorspace_pars_fragment}\nvec4 linearToOutputTexel(vec4 c){return sRGBTransferOETF(vec4(clamp((c.rgb*(2.51*c.rgb+.03))/(c.rgb*(2.43*c.rgb+.59)+.14),0.,1.),c.a));}\nfloat luminance(vec3 rgb){return dot(rgb,vec3(.2126,.7152,.0722));}\n`;
const manifest={cases:{}};
for(const [name,factory,species] of [['before',before,'birch'],['after',after,'birch'],['oak',after,'oak'],['beech',after,'beech']]){
 const material=factory.treeBarkMaterial(species,texture,texture),shader=shaderOf(material);
 fs.writeFileSync(`${out}/${name}.vert`,(vp+expand(shader.vertexShader)).replace(/\b(highp|mediump|lowp)\b/g,''));
 fs.writeFileSync(`${out}/${name}.frag`,(fp+expand(shader.fragmentShader)).replace(/\b(highp|mediump|lowp)\b/g,''));
 manifest.cases[name]={color:material.color.toArray(),roughness:material.roughness,normalScale:material.normalScale.toArray()};
}
const geo=new THREE.CylinderGeometry(.25,.32,6,80,40,true);geo.translate(0,3,0);
const interleaved=[];for(let i=0;i<geo.attributes.position.count;i++)interleaved.push(...Array.from(geo.attributes.position.array.slice(i*3,i*3+3)),...Array.from(geo.attributes.normal.array.slice(i*3,i*3+3)),...Array.from(geo.attributes.uv.array.slice(i*2,i*2+2)));
fs.writeFileSync(`${out}/cylinder.bin`,Buffer.from(new Float32Array(interleaved).buffer));fs.writeFileSync(`${out}/indices.bin`,Buffer.from(new Uint32Array(geo.index.array).buffer));
fs.writeFileSync(`${out}/manifest.json`,JSON.stringify(manifest,null,2));
console.log('bark structure audit passed: old row defect reproduced; oak/beech color and normal behavior preserved; per-tree variation present');
