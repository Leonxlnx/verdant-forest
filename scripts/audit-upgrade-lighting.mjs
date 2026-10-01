import fs from 'node:fs';
import assert from 'node:assert/strict';
import * as THREE from 'three';
const moduleRoot=new URL('../artifacts/'+(process.env.LIGHTING_QA_MODULES||'qa-modules')+'/',import.meta.url);
const {FOREST_LIGHTING:light,FOREST_EXTENT:extent}=await import(new URL('config.mjs',moduleRoot));
const {volumeFragment,compositeFragment,occlusionFragment}=await import(new URL('volumetrics.mjs',moduleRoot));
const smooth=(lo,hi,x)=>{const t=Math.max(0,Math.min(1,(x-lo)/(hi-lo)));return t*t*(3-2*t);};
const transmission=(d,density,lo,hi)=>Math.exp(-((d*density)**2))*(1-smooth(lo,hi,d));
assert.equal(extent.cameraFar,460);assert.ok(extent.treeFar>light.hazeEnd);
assert.ok(extent.vegetation-extent.exploration>light.hazeEnd);
assert.ok(extent.terrain/2-extent.exploration>light.hazeEnd);
assert.ok(Math.abs(extent.terrain/extent.terrainSegments-700/728)<1e-12);
assert.ok(Number.isInteger((extent.terrain-700)/2/(700/728)));
assert.ok(light.sunIntensity>4.1);assert.ok(light.hemisphereIntensity>1.4);
assert.ok(light.fogDensity<.0048);assert.ok(light.volumeStrength<.60);
assert.ok(light.saturation>1&&light.saturation<1.15);
assert.ok(compositeFragment.includes(`smoothstep(${light.hazeStart}.,${light.hazeEnd}.`));
assert.ok(compositeFragment.includes(light.sunDirection.map(n=>n.toFixed(1)).join(',')));
assert.ok(volumeFragment.includes(`min(length(ray),${light.volumeDistance}.)`));
assert.ok(occlusionFragment.includes(`${extent.cameraFar}.`));
const visibility=[50,100,180,240,300,340,400,435].map(distance=>({distance,oldTransmission:transmission(distance,.0048,120,240),newTransmission:transmission(distance,light.fogDensity,light.hazeStart,light.hazeEnd)}));
const report={lighting:light,extent,visibility,terrainSpacingPreserved:true,limits:'Optical transmission is analytic material-fog plus horizon blend; scattering and occlusion remain view dependent. Runtime appearance is reviewed separately.'};
if(process.argv.includes('--scene')){
 THREE.TextureLoader.prototype.load=()=>new THREE.Texture();
 const {createVegetation}=await import(new URL('vegetation.mjs',moduleRoot));
 const {heightAt,rng,trailDistance}=await import(new URL('math.mjs',moduleRoot));
 const expected=[],r=rng(716126),outer=rng(170491);
 for(const [x,z,s,v]of[[-6.5,5,1.15,0],[8,-3,1.16,1],[-11,-17,1.25,2],[15,-22,1.0,4],[-4,-35,1.1,5],[19,16,.98,0]])expected.push({x,z,s,v,rot:r()*6.28});
 for(let i=0;i<1700;i++){const x=(r()-.5)*246,z=(r()-.5)*246;if(trailDistance(x,z)<2.3||expected.some(p=>Math.hypot(p.x-x,p.z-z)<5.3))continue;expected.push({x,z,s:.7+r()*.45,v:Math.floor(r()*8),rot:r()*6.28});}
 for(let i=0;i<3200;i++){const x=(r()-.5)*440,z=(r()-.5)*440;if(Math.abs(x)<122&&Math.abs(z)<122)continue;if(expected.some(p=>(p.x-x)**2+(p.z-z)**2<5.5**2))continue;expected.push({x,z,s:.67+r()*.54,v:Math.floor(r()*8),rot:r()*6.28});}
 for(let i=0;i<4500;i++){const x=(outer()-.5)*680,z=(outer()-.5)*680;if(Math.abs(x)<220&&Math.abs(z)<220)continue;if(expected.some(p=>(p.x-x)**2+(p.z-z)**2<5.5**2))continue;expected.push({x,z,s:.67+outer()*.54,v:Math.floor(outer()*8),rot:outer()*6.28});}
 const scene=new THREE.Scene(),vegetation=await createVegetation(scene,false);
 for(let i=0;i<expected.length;i++)for(const key of ['x','z','s','v','rot'])assert.equal(vegetation.treePositions[i][key],expected[i][key],`original tree ${i} ${key}`);
 const geometries=new Set(),horizon=[];
 for(const pool of vegetation.horizonTrees.pools){const g=pool.mesh.geometry;if(geometries.has(g))continue;geometries.add(g);const p=g.attributes.position;assert.ok(p.array.every(Number.isFinite));assert.ok(g.index.array.every(i=>i<p.count));assert.ok(g.boundingSphere&&Number.isFinite(g.boundingSphere.radius));const sphere=g.boundingSphere;for(let i=0;i<p.count;i++){const envelope=Math.min(1,p.getY(i)*.05)*Math.hypot(1.36*.14,.068)+(g.name.includes('leaves')?.014:0);assert.ok(Math.hypot(p.getX(i)-sphere.center.x,p.getY(i)-sphere.center.y,p.getZ(i)-sphere.center.z)+envelope<sphere.radius+1e-5,'horizon wind escapes culling sphere');}horizon.push({name:g.name,source:g.userData.horizonSourceTriangles,triangles:g.index.count/3});}
 const before=horizon.reduce((n,g)=>n+g.source,0),after=horizon.reduce((n,g)=>n+g.triangles,0);assert.ok(after<before*.6);
 const camera=new THREE.PerspectiveCamera(58,1.6,.06,extent.cameraFar),frustum=new THREE.Frustum(),matrix=new THREE.Matrix4(),views=[];
 scene.updateMatrixWorld(true);
 for(let i=0;i<48;i++){
  const angle=i*.52,x=Math.sin(i*.67)*68,z=Math.cos(i*.83)*68;camera.position.set(x,heightAt(x,z)+(i%6===0?18:2),z);camera.lookAt(x+Math.sin(angle)*20,camera.position.y+(i%6===0?-10:1),z-Math.cos(angle)*20);camera.updateMatrixWorld();vegetation.update(camera,1);matrix.multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse);frustum.setFromProjectionMatrix(matrix);let triangles=0,draws=0;
  scene.traverseVisible(m=>{if(!(m instanceof THREE.Mesh)||!frustum.intersectsObject(m))return;triangles+=(m.geometry.index?.count??m.geometry.attributes.position.count)/3*(m.userData.compact?m.geometry.instanceCount:m.count??1);draws++;});views.push({i,triangles,draws});
 }
 report.scene={originalTrees:expected.length,totalTrees:vegetation.treePositions.length,originalLayoutPreserved:true,horizonGeometryTrianglesBefore:before,horizonGeometryTrianglesAfter:after,horizonGeometryRatio:after/before,horizonWindBoundsPassed:true,horizon,views,maxTriangles:Math.max(...views.map(v=>v.triangles)),maxDraws:Math.max(...views.map(v=>v.draws))};
 // Same 48 camera positions previously peaked at 34.79m vegetation triangles.
 // The new far geometry should keep a 1.77x farther scene within that budget.
 assert.ok(report.scene.maxTriangles<34790542*1.15,'extended forest exceeds 15% triangle allowance');
}
fs.mkdirSync('artifacts',{recursive:true});fs.writeFileSync(process.argv.includes('--scene')?'artifacts/upgrade-lighting-audit.json':'artifacts/upgrade-lighting-constants-audit.json',JSON.stringify(report,null,2));
console.log(JSON.stringify({...report,scene:report.scene?{...report.scene,horizon:undefined,views:undefined}:undefined}));
