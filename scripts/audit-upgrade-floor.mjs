import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import * as THREE from 'three';

// Exercise real production geometry/placement in a CPU scene. The representative
// trunk layout stresses oversized flares; it is not a browser FPS measurement.
const output='artifacts/upgrade-floor-modules';fs.mkdirSync(output,{recursive:true});
for(const file of fs.readdirSync('app/forest')){
 if(!/\.(ts|js)$/.test(file))continue;
 let js=ts.transpileModule(fs.readFileSync(`app/forest/${file}`,'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText;
 js=js.replace(/from '(\.\/[^']+)'/g,(_,p)=>`from '${p.replace(/\.(ts|js)$/,'')}.mjs'`);
 fs.writeFileSync(`${output}/${file.replace(/\.(ts|js)$/,'.mjs')}`,js);
}
const flowers=await import(`../${output}/wildflowers.mjs`);
const floor=await import(`../${output}/floor-detail.mjs`);
const {heightAt}=await import(`../${output}/math.mjs`);
const data={scope:'Production geometry and placements with deterministic representative trunk/rock fixtures; browser visual review performed by parent.',geometry:[],scenes:{}};

function checkGeometry(g,label){
 const p=g.attributes.position,index=g.index,count=(index?.count??p.count)/3;
 assert(index,`${label}: indexed geometry`);
 for(const [name,a] of Object.entries(g.attributes))assert(Array.from(a.array).every(Number.isFinite),`${label}: ${name} finite`);
 assert(count>0&&count<1500,`${label}: per-plant budget ${count}`);
 const a=new THREE.Vector3(),b=new THREE.Vector3(),c=new THREE.Vector3();let degenerate=0;
 for(let i=0;i<count;i++){
  const ids=[0,1,2].map(j=>index?index.getX(i*3+j):i*3+j);assert(ids.every(id=>id>=0&&id<p.count));
  a.fromBufferAttribute(p,ids[0]);b.fromBufferAttribute(p,ids[1]);c.fromBufferAttribute(p,ids[2]);
  if(b.sub(a).cross(c.sub(a)).lengthSq()<1e-20)degenerate++;
 }
 assert.equal(degenerate,0,`${label}: zero-area faces`);
 assert(g.boundingSphere&&Number.isFinite(g.boundingSphere.radius));
 data.geometry.push({label,triangles:count,vertices:p.count,height:g.boundingBox.max.y-g.boundingBox.min.y});
}
for(const kind of flowers.FLOWER_KINDS)for(const detail of ['high','low'])for(const seed of [1,875])checkGeometry(flowers.createFlowerGeometry(kind,seed,detail),`${kind}-${detail}-${seed}`);
for(const kind of floor.FLOOR_DETAIL_KINDS)checkGeometry(floor.createFloorDetailGeometry(kind,617),kind);
console.log('flower-geometry PASS');

for(const coarse of [false,true]){
 const scene=new THREE.Scene(),trees=[];
 for(let x=-90;x<=90;x+=12)for(let z=-90;z<=90;z+=13)trees.push({x:x+Math.sin(z)*2,z,s:1,radius:1.23});
 const rock=new THREE.InstancedMesh(new THREE.IcosahedronGeometry(),new THREE.MeshStandardMaterial(),1);
 rock.userData.footprints=[{x:5,z:9,r:2},{x:-5,z:1,r:1.4},{x:14,z:-13,r:2.2}];
 const blocked=flowers.createFloorExclusion(trees,[rock]);
 const floral=flowers.createWildflowers(scene,trees,[rock],coarse),detail=floor.createFloorDetail(scene,trees,[rock],coarse);
 const matrix=new THREE.Matrix4(),root=new THREE.Vector3();let instances=0,maxGroundError=0;
 for(const mesh of scene.children){
  assert(mesh.isInstancedMesh);instances+=mesh.count;
  for(let i=0;i<mesh.count;i++){
   mesh.getMatrixAt(i,matrix);root.setFromMatrixPosition(matrix);
   assert(!blocked(root.x,root.z),`${mesh.name} intersects fixture surface`);
   maxGroundError=Math.max(maxGroundError,Math.abs(root.y-heightAt(root.x,root.z)+.008));
  }
 }
 assert(maxGroundError<.00003,`root height mismatch ${maxGroundError}`);
 const camera=new THREE.PerspectiveCamera(58,16/9,.06,500);let maxTriangles=0,maxDraws=0;
 for(const [x,z] of [[5.55,20],[-5.5,6],[9.2,-9.3],[-25,-18],[75,75]]){
  camera.position.set(x,heightAt(x,z)+1.72,z);camera.lookAt(x-2,camera.position.y+.15,z-13);camera.updateMatrixWorld();
  floral.update(camera);detail.update(camera);scene.updateMatrixWorld(true);
  const frustum=new THREE.Frustum().setFromProjectionMatrix(new THREE.Matrix4().multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse));
  let triangles=0,draws=0;
  for(const mesh of scene.children)if(mesh.visible&&frustum.intersectsObject(mesh)){triangles+=(mesh.geometry.index?.count??mesh.geometry.attributes.position.count)/3*mesh.count;draws++;}
  maxTriangles=Math.max(maxTriangles,triangles);maxDraws=Math.max(maxDraws,draws);
 }
 assert(maxTriangles<2300000,`visible accent triangle budget exceeded ${maxTriangles}`);
 assert(maxDraws<180,`visible accent draw budget exceeded ${maxDraws}`);
 camera.position.set(900,900,900);floral.update(camera);detail.update(camera);assert(scene.children.every(m=>!m.visible),'far batches should cull');
 data.scenes[coarse?'touch':'desktop']={...floral.stats,...detail.stats,instances,batches:scene.children.length,maxGroundError,sampledMaxTriangles:maxTriangles,sampledMaxDraws:maxDraws};
}
console.log('floor-placement PASS');console.log('detail-budget PASS');
fs.mkdirSync('artifacts',{recursive:true});fs.writeFileSync('artifacts/upgrade-floor-audit.json',JSON.stringify(data,null,2));
console.log(JSON.stringify(data.scenes));
