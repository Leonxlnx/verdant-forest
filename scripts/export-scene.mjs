import fs from 'node:fs';
import path from 'node:path';
import * as THREE from 'three';
// A scene-data audit, not browser control: use the actual application geometry,
// placement and material values with an inert texture loader for file export.
THREE.TextureLoader.prototype.load=function(url){const t=new THREE.Texture();t.userData.path=url;return t;};
const {compactGeometryAttributes}=await import('../artifacts/qa-modules/geometry-memory.mjs');
const {createVegetation}=await import('../artifacts/qa-modules/vegetation.mjs');
const {createGround,createRocks,createDeadwood,createLitter,createMushrooms}=await import('../artifacts/qa-modules/surfaces.mjs');
const {createForestDetails}=await import('../artifacts/qa-modules/details.mjs');
const {createWildflowers}=await import('../artifacts/qa-modules/wildflowers.mjs');
const {createFloorDetail}=await import('../artifacts/qa-modules/floor-detail.mjs');
const {cinematicView,FOREST_FILM_DURATION}=await import('../artifacts/qa-modules/cinematic.mjs');
const {viewpoints}=await import('../artifacts/qa-modules/controls.mjs');
const {heightAt}=await import('../artifacts/qa-modules/math.mjs');
const {FOREST_LIGHTING,FOREST_EXTENT}=await import('../artifacts/qa-modules/config.mjs');
const {addSky,addParticles}=await import('../artifacts/qa-modules/atmosphere.mjs');
const sky=addSky(new THREE.Scene());
const skyInfo={vertexShader:sky.material.vertexShader,fragmentShader:sky.material.fragmentShader,top:sky.material.uniforms.top.value.toArray(),bottom:sky.material.uniforms.bottom.value.toArray(),sun:sky.material.uniforms.sun.value.toArray()};
const particle=addParticles(new THREE.Scene(),new THREE.DirectionalLight()).points;
const particleInfo={position:Array.from(particle.geometry.attributes.position.array),seed:Array.from(particle.geometry.attributes.seed.array),vertexShader:particle.material.vertexShader,fragmentShader:particle.material.fragmentShader};
const scene=new THREE.Scene();
createGround(scene);const rocks=createRocks(scene);createLitter(scene);createMushrooms(scene);
const v=await createVegetation(scene,false);createDeadwood(scene,v.bark);const details=createForestDetails(scene,v.treePositions,rocks,v.bark,false,v.treeSurfaces);
const flowers=createWildflowers(scene,v.treePositions,rocks,false),floorDetail=createFloorDetail(scene,v.treePositions,rocks,false);
scene.updateMatrixWorld(true);compactGeometryAttributes(scene);
const dir=process.env.FOREST_QA_DIR||'artifacts/scene-data';fs.mkdirSync(dir,{recursive:true});
const geometries=new Map(),materials=new Map(),geoData={},matData={},objects=[],objectMap=new Map();
function binary(name,array){fs.writeFileSync(path.join(dir,name),Buffer.from(array.buffer,array.byteOffset,array.byteLength));return name;}
function compactMatrices(g){
 const placement=g.attributes.forestPlacement,scale=g.attributes.forestScale;
 const matrices=new Float32Array(placement.count*16),dummy=new THREE.Object3D();
 for(let i=0;i<placement.count;i++){
  dummy.position.set(placement.getX(i),placement.getY(i),placement.getZ(i));dummy.rotation.set(0,placement.getW(i),0);dummy.scale.fromBufferAttribute(scale,i);dummy.updateMatrix();matrices.set(dummy.matrix.elements,i*16);
 }
 return matrices;
}
function floatAttribute(attribute){
 if(attribute.array instanceof Float32Array)return attribute.array;
 const values=new Float32Array(attribute.count*attribute.itemSize);
 const getters=[attribute.getX,attribute.getY,attribute.getZ,attribute.getW].map(fn=>fn.bind(attribute));
 for(let i=0;i<attribute.count;i++)for(let component=0;component<attribute.itemSize;component++)values[i*attribute.itemSize+component]=getters[component](i);
 return values;
}
function geoID(g){const identity=g.attributes.forestPlacement?g.attributes.position:g;if(geometries.has(identity))return geometries.get(identity);const id='g'+geometries.size;geometries.set(identity,id);const attrs={};for(const k of ['position','normal','uv','color']){const a=g.getAttribute(k);if(a)attrs[k]={file:binary(id+'-'+k+'.bin',floatAttribute(a)),size:a.itemSize,count:a.count};}geoData[id]={attributes:attrs,index:g.index?{file:binary(id+'-index.bin',new Uint32Array(g.index.array)),count:g.index.count}:null};return id;}
function matID(m){if(materials.has(m.uuid))return materials.get(m.uuid);const id='m'+materials.size;materials.set(m.uuid,id);matData[id]={color:m.color?.toArray(),vertexColors:!!m.vertexColors,roughness:m.roughness,side:m.side,map:m.map?.userData.path,normalMap:m.normalMap?.userData.path,normalScale:m.normalScale?.toArray(),repeat:m.map?.repeat.toArray(),cacheKey:m.customProgramCacheKey?.(),moss:m.customProgramCacheKey?.().includes('forest-moss'),wind:m.customProgramCacheKey?.().includes('forest-wind')};return id;}
scene.traverse(o=>{
 if(!(o instanceof THREE.Mesh))return;
 const id='o'+objects.length;objectMap.set(o.uuid,id);
 const d={id,geometry:geoID(o.geometry),material:matID(o.material),matrix:o.matrixWorld.toArray(),castShadow:o.castShadow,kind:o.userData.kind??''};
 if(o instanceof THREE.InstancedMesh){
  const capacity=o.userData.dynamicInstances?o.instanceMatrix.count:o.count;
  d.dynamicInstances=!!o.userData.dynamicInstances;
  d.instances={file:binary(id+'-instances.bin',o.instanceMatrix.array.slice(0,capacity*16)),count:capacity};
  if(o.instanceColor)d.colors={file:binary(id+'-colors.bin',o.instanceColor.array.slice(0,capacity*3))};
 }else if(o.userData.compact){
  const p=o.geometry.attributes.forestPlacement,scale=o.geometry.attributes.forestScale,rank=o.geometry.attributes.forestRank;
  d.compact=true;d.compactData={count:p.count,placement:binary(id+'-roots.bin',p.array),scale:binary(id+'-scales.bin',scale.array),rank:binary(id+'-ranks.bin',floatAttribute(rank))};

 }
 if(o.userData.lods)d.lods=o.userData.lods.map(geoID);objects.push(d);
});
const views={};
const cameraViews={...viewpoints};
if(process.env.FOREST_QA_WIND_PHASES==='1'){for(const name of ['canopy','deadwood'])for(let i=0;i<6;i++)cameraViews[`phase_${name}_${i}`]={...viewpoints[name],time:i*1.2};}
if(process.env.FOREST_QA_MOTION==='1'){
 for(const key of Object.keys(cameraViews))delete cameraViews[key];
 const {trailAt}=await import('../artifacts/qa-modules/math.mjs');
 const frames=Number(process.env.FOREST_QA_FRAMES||360);
 for(let i=0;i<frames;i++){
  const t=i/30,z=20-t*2.1,x=trailAt(z)-.55;
  const angle=Math.sin(t*.22)*.24;
  cameraViews[`motion_${String(i).padStart(4,'0')}`]={position:[x,1.72,z],target:[trailAt(z-8)+Math.sin(angle)*6,1.66,z-8],time:t,motion:true};
 }
}

if(process.env.FOREST_QA_SURVEY==='1'){
 for(const x of [-88,-44,0,44,88])for(const z of [-88,-44,0,44,88]){
  for(let angle=0;angle<2;angle++){
   let px=x,pz=z;
   for(const tree of v.treePositions)if(Math.hypot(tree.x-px,tree.z-pz)<1.6){px+=2.1;pz+=.8;}
   const yaw=(angle?1.17:3.67)+(x+z)*.003;
   cameraViews[`survey_${x}_${z}_${angle}`]={position:[px,2.1,pz],target:[px+Math.sin(yaw)*18,4,pz+Math.cos(yaw)*18]};
  }
 }
 for(const [name,x,z,tx,tz] of [['east',94,0,215,0],['west',-94,0,-215,0],['north',0,-94,0,-215],['south',0,94,0,215],['northeast',94,-94,205,-205],['southwest',-94,94,-205,205]]){
  cameraViews[`edge_${name}_high`]={position:[x,42,z],target:[tx,4,tz]};
 }
 const contactTrees=v.treePositions.filter(t=>Math.abs(t.x)<90&&Math.abs(t.z)<90).sort((a,b)=>(b.sink||0)-(a.sink||0)).slice(0,3);
 contactTrees.forEach((tree,i)=>{cameraViews[`tree_contact_${i}`]={position:[tree.x+3.4,.5,tree.z+1.5],target:[tree.x,.3,tree.z]};});
 cameraViews.root_detail={position:[-4.4,.46,5.4],target:[-6.2,.14,5]};
 cameraViews.moss_detail={position:[-2.1,1.1,6.2],target:[-3.7,.58,7]};
 cameraViews.log_end={position:[8.5,.85,-9.8],target:[7.5,.65,-9.4]};
 for(let i=0;i<8;i++){
  const a=i*Math.PI/4;
  cameraViews[`moss_orbit_${i}`]={position:[-3.7+Math.cos(a)*2.2,1.1,7+Math.sin(a)*2.2],target:[-3.7,.68,7]};
 }

}
scene.traverse(object=>{if(!object.userData.inspection)return;const data=object.userData.inspection,p=new THREE.Vector3(...data.point),n=new THREE.Vector3(...data.normal),eye=p.clone().addScaledVector(n,.4).add(new THREE.Vector3(0,.12,0)),target=p.clone().addScaledVector(n,.04);eye.y-=heightAt(eye.x,eye.z);target.y-=heightAt(target.x,target.z);cameraViews.fungus_detail={position:eye.toArray(),target:target.toArray()};});
if(process.env.FOREST_QA_STATIONARY==='1'){
 const starts={...cameraViews};for(const key of Object.keys(cameraViews))delete cameraViews[key];
 const frames=Number(process.env.FOREST_QA_FRAMES||180),names=['entrance','ferns','canopy','deadwood'];
 for(let sequence=0;sequence<names.length;sequence++)for(let frame=0;frame<frames;frame++){
  const i=sequence*frames+frame;cameraViews[`wind_${String(i).padStart(4,'0')}`]={...starts[names[sequence]],time:i/30,motion:true,sequence:names[sequence]};
 }
 cameraViews.fungus_detail=starts.fungus_detail;
}
if(process.env.FOREST_QA_FILM==='1'){
 for(const name of Object.keys(cameraViews))delete cameraViews[name];
 const fps=Number(process.env.FOREST_QA_FPS||30),frames=Number(process.env.FOREST_QA_FRAMES||FOREST_FILM_DURATION*fps);
 for(let frame=0;frame<frames;frame++){
  const view=cinematicView(frame/fps);
  cameraViews[`film_${String(frame).padStart(4,'0')}`]={...view,absolute:true,motion:true,sequence:view.name};
 }
}
for(const [k,vp]of Object.entries(cameraViews)){
 const c=new THREE.PerspectiveCamera(vp.fov||58,process.env.FOREST_QA_FILM==='1'?16/9:16/10,.06,FOREST_EXTENT.cameraFar);c.position.set(...vp.position);if(!vp.absolute)c.position.y+=heightAt(vp.position[0],vp.position[2]);
 const t=new THREE.Vector3(...vp.target);if(!vp.absolute)t.y+=heightAt(vp.target[0],vp.target[2]);c.lookAt(t);c.updateMatrixWorld();
 if(!vp.motion||Number(k.split('_')[1])%9===0){v.update(c,1);details.update(c);flowers.update(c);floorDetail.update(c);}scene.updateMatrixWorld(true);
 const frustum=new THREE.Frustum().setFromProjectionMatrix(new THREE.Matrix4().multiplyMatrices(c.projectionMatrix,c.matrixWorldInverse));
 const draws={},shadowDraws={};
 scene.traverseVisible(o=>{
  if(!(o instanceof THREE.Mesh))return;
  const id=objectMap.get(o.uuid),count=o.userData.compact?o.geometry.instanceCount:o instanceof THREE.InstancedMesh?o.count:1;
  if(!count)return;
  const record={geometry:geoID(o.geometry),count};
  if(o.userData.kind==='fern'||o.userData.kind==='shrub'||o.userData.dynamicInstances){
   record.instances=binary(`${k}-${id}-matrices.bin`,o.instanceMatrix.array.slice(0,count*16));
   if(o.instanceColor)record.colors=binary(`${k}-${id}-colors.bin`,o.instanceColor.array.slice(0,count*3));
  }
  if(frustum.intersectsObject(o))draws[id]=record;
  if(o.castShadow)shadowDraws[id]=record;
 });
 views[k]={time:vp.time||0,motion:!!vp.motion,sequence:vp.sequence||null,position:c.position.toArray(),projection:c.projectionMatrix.toArray(),view:c.matrixWorldInverse.toArray(),draws,shadowDraws};
}
fs.writeFileSync(path.join(dir,'scene.json'),JSON.stringify({source:JSON.parse(fs.readFileSync('artifacts/qa-modules/source-manifest.json','utf8')),geometries:geoData,materials:matData,objects,views,lighting:{...FOREST_LIGHTING,sun:new THREE.Color(FOREST_LIGHTING.sunColor).multiplyScalar(FOREST_LIGHTING.sunIntensity).toArray(),hemisphereSky:new THREE.Color(FOREST_LIGHTING.skyColor).multiplyScalar(FOREST_LIGHTING.hemisphereIntensity).toArray(),hemisphereGround:new THREE.Color(FOREST_LIGHTING.groundColor).multiplyScalar(FOREST_LIGHTING.hemisphereIntensity).toArray(),fog:new THREE.Color(FOREST_LIGHTING.fogColor).toArray()},sky:skyInfo,particles:particleInfo,stats:{...v.stats,...details.stats,...flowers.stats,...floorDetail.stats}}));console.log(JSON.stringify({objects:objects.length,geometries:geometries.size,materials:materials.size,...v.stats}));
