import * as THREE from 'three';
import {createTreeGeometry} from './trees.js';
import {createGrassGeometry} from './understory.js';
import {createFernGeometry,createShrubGeometry,createHerbGeometry} from './botanical-refinement.js';
import {heightAt,rng,noise,trailDistance} from './math';
import {windMaterial,windDepthMaterial,treeDepthMaterial,texture,treeBarkMaterial} from './materials';
import {insideDeadwood} from './surfaces';
import {createCompactGrass} from './compact-grass';
import type {TreeSurface} from './trunk-life';
import {packGeometries} from './geometry-memory';
import {FOREST_EXTENT} from './config';
import {createFarTreePools,createHorizonGeometry} from './distant-trees';
type Cell = {center:THREE.Vector3,meshes:THREE.Mesh[],kind:string,base:number[],individual?:{matrices:Float32Array,colors:Float32Array,count:number}};
export async function createVegetation(scene:THREE.Scene,coarse:boolean,signal?:AbortSignal){
 const cells:Cell[]=[],r=rng(716126),o=new THREE.Object3D();
 const trunkMap=texture('/textures/bark-color.jpg',true),trunkNormal=texture('/textures/bark-normal.jpg');
 const bark=new THREE.MeshStandardMaterial({color:'#b0a794',map:trunkMap,normalMap:trunkNormal,normalScale:new THREE.Vector2(.7,.7),roughness:.96});
 const barks=['oak','beech','oak','birch'].map(species=>treeBarkMaterial(species,trunkMap,trunkNormal));
 const leafMat=windMaterial('leaf'),woodDepth=treeDepthMaterial();
 const leafDepth=windDepthMaterial('leaf'),fernDepth=windDepthMaterial('fern'),shrubDepth=windDepthMaterial('shrub');
 type TreeAsset=ReturnType<typeof createTreeGeometry>;
 const variants:Array<TreeAsset&{medium:TreeAsset,low:TreeAsset}>=[];
 for(let i=0;i<8;i++){signal?.throwIfAborted();const species=['oak','beech','oak','birch'][i%4];const tree=createTreeGeometry(215+i*819,species,{leafScale:1.2});tree.wood.deleteAttribute('color');const medium=createTreeGeometry(215+i*819,species,{detail:'medium',leafScale:1.2}),low=createTreeGeometry(215+i*819,species,{detail:'low',leafScale:1.2});medium.wood.deleteAttribute('color');low.wood.deleteAttribute('color');packGeometries([tree.wood,tree.leaves,medium.wood,medium.leaves,low.wood,low.leaves]);variants.push({...tree,medium,low});await new Promise<void>(resolve=>setTimeout(resolve,0));}
 // A far LOD enlarges retained leaves to preserve the crown's coverage.
 // Use a union of all shapes, including wind, for every shared tree bound.
 for(const variant of variants)for(const part of ['wood','leaves'] as const){
  const shapes=[variant[part],variant.medium[part],variant.low[part]];
  const sphere=new THREE.Sphere();sphere.makeEmpty();
  for(const geometry of shapes){if(!geometry.boundingSphere)geometry.computeBoundingSphere();sphere.union(geometry.boundingSphere!);}
  sphere.radius+=part==='leaves'?.34:.22;
  for(const geometry of shapes)geometry.boundingSphere=sphere.clone();
 }
 const horizons=variants.map(variant=>({wood:createHorizonGeometry(variant.low.wood,false),leaves:createHorizonGeometry(variant.low.leaves,true)}));
 for(const horizon of horizons)packGeometries([horizon.wood,horizon.leaves]);
 const groundVertices=variants.map(variant=>{
  const p=variant.wood.attributes.position,points:THREE.Vector3[]=[];
  for(let i=0;i<p.count;i++)if(Math.abs(p.getY(i))<1e-7)points.push(new THREE.Vector3(p.getX(i),0,p.getZ(i)));
  return points;
 });
 const groundPoint=new THREE.Vector3();
 const treeSurfaces:TreeSurface[]=[];
 const instanceTone=new THREE.Color();
 const stoneFootprints=scene.children.flatMap(o=>o.userData.footprints||[]) as Array<{x:number,z:number,r:number}>;
 const positions:Array<{x:number,z:number,s:number,v:number,rot:number,radius?:number,sink?:number}>=[];
 // Dominant trunks establish a legible grove around a narrow animal trail.
 for(const [x,z,s,v] of [[-6.5,5,1.15,0],[8,-3,1.16,1],[-11,-17,1.25,2],[15,-22,1.0,4],[-4,-35,1.1,5],[19,16,.98,0]])positions.push({x,z,s,v,rot:r()*6.28});
 for(let i=0;i<1700;i++){const x=(r()-.5)*246,z=(r()-.5)*246;if(trailDistance(x,z)<2.3||positions.some(p=>Math.hypot(p.x-x,p.z-z)<5.3))continue;positions.push({x,z,s:.7+r()*.45,v:Math.floor(r()*8),rot:r()*6.28});}
 // A broad outer woodland keeps free-camera views enclosed near the
 // exploration boundary; it uses the same real branch-and-leaf LOD meshes.
 for(let i=0;i<3200;i++){
  const x=(r()-.5)*440,z=(r()-.5)*440;
  if(Math.abs(x)<122&&Math.abs(z)<122)continue;
  if(positions.some(p=>(p.x-x)**2+(p.z-z)**2<5.5**2))continue;
  positions.push({x,z,s:.67+r()*.54,v:Math.floor(r()*8),rot:r()*6.28});
 }
 // Independent seed preserves every existing tree and understory placement.
 // The extra woodland is only visible through the distant atmospheric veil.
 const outer=rng(170491);
 for(let i=0;i<4500;i++){
  const x=(outer()-.5)*680,z=(outer()-.5)*680;
  if(Math.abs(x)<220&&Math.abs(z)<220)continue;
  if(positions.some(p=>(p.x-x)**2+(p.z-z)**2<5.5**2))continue;
  positions.push({x,z,s:.67+outer()*.54,v:Math.floor(outer()*8),rot:outer()*6.28});
 }
 // A separate random stream adds only the far landscape. Existing trees,
 // undergrowth draws, trunk life and hero compositions stay deterministic.
 const landscape=rng(710283),landscapeGrid=new Map<string,typeof positions>();
 const landscapeKey=(x:number,z:number)=>`${Math.floor(x/6)},${Math.floor(z/6)}`;
 for(const p of positions){const key=landscapeKey(p.x,p.z);if(!landscapeGrid.has(key))landscapeGrid.set(key,[]);landscapeGrid.get(key)!.push(p);}
 for(let i=0;i<7800;i++){
  const x=(landscape()-.5)*FOREST_EXTENT.vegetation*2,z=(landscape()-.5)*FOREST_EXTENT.vegetation*2;
  if(Math.abs(x)<340&&Math.abs(z)<340)continue;
  const gx=Math.floor(x/6),gz=Math.floor(z/6);let crowded=false;
  for(let dz=-1;dz<=1;dz++)for(let dx=-1;dx<=1;dx++)for(const p of landscapeGrid.get(`${gx+dx},${gz+dz}`)||[])if((p.x-x)**2+(p.z-z)**2<6.2**2)crowded=true;
  if(crowded)continue;
  const p={x,z,s:.68+landscape()*.64,v:Math.floor(landscape()*8),rot:landscape()*6.28};positions.push(p);
  const key=landscapeKey(x,z);if(!landscapeGrid.has(key))landscapeGrid.set(key,[]);landscapeGrid.get(key)!.push(p);
 }
 const treeCells=Math.ceil(FOREST_EXTENT.vegetation/20);
 for(let cz=-treeCells;cz<treeCells;cz++)for(let cx=-treeCells;cx<treeCells;cx++){
  const meshes:THREE.InstancedMesh[]=[];
  for(let v=0;v<8;v++){
   const ps=positions.filter(p=>Math.floor(p.x/20)===cx&&Math.floor(p.z/20)===cz&&p.v===v);if(!ps.length)continue;
   for(const [geo,mat] of [[variants[v].wood,barks[v%4]],[variants[v].leaves,leafMat]] as [THREE.BufferGeometry,THREE.Material][]){const mesh=new THREE.InstancedMesh(geo,mat,ps.length);ps.forEach((p,i)=>{o.position.set(p.x,heightAt(p.x,p.z)-.05,p.z);const slopeX=(heightAt(p.x+1,p.z)-heightAt(p.x-1,p.z))*.5,slopeZ=(heightAt(p.x,p.z+1)-heightAt(p.x,p.z-1))*.5;o.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),new THREE.Vector3(-slopeX,1,-slopeZ).normalize());o.rotateY(p.rot);
    const hero=positions.indexOf(p)<6;
    const hash=(salt:number)=>THREE.MathUtils.euclideanModulo(Math.sin(p.x*12.9898+p.z*78.233+salt)*43758.5453,1);
    const widthX=hero?1:.86+hash(1)*.28,widthZ=hero?1:.86+hash(2)*.28,vertical=hero?1:.89+hash(3)*.22;
    o.scale.set(p.s*(.86+(p.v%3)*.12)*widthX,p.s*vertical,p.s*widthZ);o.updateMatrix();
    // Wide buttresses share the trunk transform. Sink their complete base
    // just below the actual terrain, including convex slopes between samples.
    if(p.sink===undefined){
     let gap=0;for(const base of groundVertices[v]){groundPoint.copy(base).applyMatrix4(o.matrix);gap=Math.max(gap,groundPoint.y-heightAt(groundPoint.x,groundPoint.z)+.012);}
     p.sink=gap;
    }
    o.position.y-=p.sink;o.updateMatrix();
    if(geo===variants[v].wood){const rows=geo.userData.trunkSurfaceRows as number[][],vertices=geo.attributes.position;let radius=0;for(const index of rows[0])radius=Math.max(radius,Math.hypot(vertices.getX(index)*o.scale.x,vertices.getZ(index)*o.scale.z));p.radius=radius+.045;}
    mesh.setMatrixAt(i,o.matrix);if(geo===variants[v].wood&&Math.hypot(p.x,p.z)<120)treeSurfaces.push({geometry:geo,matrix:o.matrix.clone(),center:new THREE.Vector3(p.x,0,p.z),seed:Math.floor((p.x+220)*7919+(p.z+220)*104729)});});mesh.userData.kind='tree';mesh.customDepthMaterial=geo===variants[v].leaves?leafDepth:woodDepth;mesh.userData.lods=geo===variants[v].wood?[geo,variants[v].medium.wood,variants[v].low.wood,horizons[v].wood]:[geo,variants[v].medium.leaves,variants[v].low.leaves,horizons[v].leaves];mesh.castShadow=mesh.receiveShadow=true;mesh.computeBoundingSphere();scene.add(mesh);meshes.push(mesh);}
  }
  if(meshes.length)cells.push({center:new THREE.Vector3(cx*20+10,0,cz*20+10),meshes,kind:'tree',base:meshes.map(m=>m.count)});
 }
 const treeCellSources=cells.filter(c=>c.kind==='tree');
 const distantTrees=createFarTreePools(treeCellSources,{poolSize:80,farDistance:FOREST_EXTENT.horizonLOD,boundsPadding:.6});scene.add(distantTrees.group);
 const horizonTrees=createFarTreePools(treeCellSources,{poolSize:160,nearDistance:FOREST_EXTENT.horizonLOD,farDistance:FOREST_EXTENT.treeFar,lodLevel:3,boundsPadding:.75});scene.add(horizonTrees.group);
 const grassMat=windMaterial('grass',{},true),fernMat=windMaterial('fern'),shrubMat=windMaterial('shrub'),herbMat=windMaterial('grass');
 const cellKey=(x:number,z:number)=>((x+1024)<<12)|(z+1024);
 const trunkGrid=new Map<number,typeof positions>();
 const stoneGrid=new Map<number,typeof stoneFootprints>();
 for(const p of stoneFootprints){const key=cellKey(Math.floor(p.x/4),Math.floor(p.z/4));if(!stoneGrid.has(key))stoneGrid.set(key,[]);stoneGrid.get(key)!.push(p);}
 for(const p of positions){const key=cellKey(Math.floor(p.x/4),Math.floor(p.z/4));if(!trunkGrid.has(key))trunkGrid.set(key,[]);trunkGrid.get(key)!.push(p);}
 function blocked(x:number,z:number){
  const gx=Math.floor(x/4),gz=Math.floor(z/4);
  for(let dz=-1;dz<=1;dz++)for(let dx=-1;dx<=1;dx++){
   const key=cellKey(gx+dx,gz+dz);
   for(const p of trunkGrid.get(key)||[])if((p.x-x)**2+(p.z-z)**2<(p.s*.64)**2)return true;
   for(const p of stoneGrid.get(key)||[])if((p.x-x)**2+(p.z-z)**2<(p.r*.85)**2)return true;
  }
  return insideDeadwood(x,z);
 }
 // Keep the deterministic random stream unchanged when removing plants
 // from the newly measured trunk flare; consume their growth draws first.
 function insideTrunkFlare(x:number,z:number){
  const gx=Math.floor(x/4),gz=Math.floor(z/4);
  for(let dz=-1;dz<=1;dz++)for(let dx=-1;dx<=1;dx++)for(const p of trunkGrid.get(cellKey(gx+dx,gz+dz))||[])if((p.x-x)**2+(p.z-z)**2<(p.radius??p.s*.64)**2)return true;
  return false;
 }
 const grasses=Array.from({length:4},(_,i)=>createGrassGeometry(478+i*137));
 const grassMedium=Array.from({length:4},(_,i)=>createGrassGeometry(478+i*137,'medium'));
 const grassLow=Array.from({length:4},(_,i)=>createGrassGeometry(478+i*137,'low'));
 const packed=(g:THREE.BufferGeometry)=>{packGeometries([g]);return g;};
 const ferns=Array.from({length:4},(_,i)=>packed(createFernGeometry(137+i*411)));
 const fernMedium=Array.from({length:4},(_,i)=>createFernGeometry(137+i*411,1,'medium'));
 const fernLow=Array.from({length:4},(_,i)=>createFernGeometry(137+i*411,1,'low'));
 const shrubs=Array.from({length:3},(_,i)=>createShrubGeometry(1478+i*97));
 const shrubLow=Array.from({length:3},(_,i)=>createShrubGeometry(1478+i*97,{detail:'low'}));
 const herbs=[createHerbGeometry(113,'sorrel'),createHerbGeometry(598,'flower'),createHerbGeometry(727,'ivy'),createHerbGeometry(824,'nettle'),createHerbGeometry(915,'ramsons')];
 packGeometries([...grasses,...grassMedium,...grassLow,...fernMedium,...fernLow,...shrubs,...shrubLow,...herbs]);
 // Three's CPU frustum tests cannot see vertex-shader wind. Include the
 // maximum displacement before deriving the shared instance bounds.
 for(const [shapes,factor] of [[[...ferns,...fernMedium,...fernLow],.38],[[...shrubs,...shrubLow],.24]] as [THREE.BufferGeometry[],number][]){
  for(const geo of shapes){geo.computeBoundingBox();geo.computeBoundingSphere();geo.boundingSphere!.radius+=Math.max(0,geo.boundingBox!.max.y)*factor*Math.hypot(1.36*.13,.068);}
 }
 for(const geo of herbs){geo.computeBoundingBox();geo.computeBoundingSphere();geo.boundingSphere!.radius+=Math.pow(Math.max(0,geo.boundingBox!.max.y),1.4)*Math.hypot(1.36*.13,.068);}
 const catalog=[{kind:'grass',geos:grasses,low:grassLow,medium:grassMedium,mat:grassMat,count:coarse?4200:9200,shadow:false},{kind:'fern',geos:ferns,low:fernLow,medium:fernMedium,mat:fernMat,count:coarse?110:165,shadow:true},{kind:'shrub',geos:shrubs,low:shrubLow,mat:shrubMat,count:coarse?15:21,shadow:true},{kind:'herb',geos:herbs,mat:herbMat,count:coarse?100:160,shadow:false}];
 let stats={trees:positions.length,grass:0,ferns:0,shrubs:0,herbs:0};
 for(let cz=-10;cz<=9;cz++){
  signal?.throwIfAborted();
  for(let cx=-10;cx<=9;cx++){
   const center=new THREE.Vector3(cx*20+10,0,cz*20+10);
   for(const item of catalog){
    const meshes:THREE.Mesh[]=[],amounts:number[]=[];
    // One deterministic botanical variant per patch, interleaved between patches.
    const outside=Math.abs(center.x)>120||Math.abs(center.z)>120;
    const capacity=Math.floor(item.count*(outside?.55:1));
    const variant=Math.abs(cx*31+cz*17)%item.geos.length;
    const geo=item.geos[variant],isGrass=item.kind==='grass';
    const mesh=isGrass?null:new THREE.InstancedMesh(geo,item.mat,capacity);
    const roots=isGrass?new Float32Array(capacity*4):null,sizes=isGrass?new Float32Array(capacity*3):null;
    let count=0;
    for(let i=0;i<capacity;i++){
     const x=cx*20+r()*20,z=cz*20+r()*20,d=trailDistance(x,z),n=noise(x*.19+11,z*.19);
     if(d<.34&&r()<.77)continue;
     if(item.kind==='fern'&&(d<.85||n<.23))continue;
     if(item.kind==='shrub'&&(d<1.8||n<.31))continue;
     if(blocked(x,z))continue;
     const y=heightAt(x,z)-.015;
     const pitch=(r()-.5)*.12,yaw=r()*6.28,roll=(r()-.5)*.12;
     let scale=item.kind==='grass'?(.44+n*.42+r()*.31):item.kind==='fern'?(.55+r()*.84):item.kind==='shrub'?(.6+r()*.8):(.8+r()*.8);
     if(d<.68)scale*=.28;
     const spread=isGrass?1.42:1,sx=scale*(.8+r()*.4)*spread,sz=scale*(.8+r()*.4)*spread;
     const red=.83+r()*.28,green=.85+r()*.22,blue=.8+r()*.3;
     if(insideTrunkFlare(x,z))continue;
     if(isGrass){
      const k=count*4,j=count*3;roots![k]=x;roots![k+1]=y;roots![k+2]=z;roots![k+3]=yaw;
      sizes![j]=sx;sizes![j+1]=scale;sizes![j+2]=sz;
     }else{
      o.position.set(x,y,z);o.rotation.set(pitch,yaw,roll);o.scale.set(sx,scale,sz);o.updateMatrix();
      mesh!.setMatrixAt(count,o.matrix);mesh!.setColorAt(count,instanceTone.setRGB(red,green,blue));
     }
     count++;
    }
    if(isGrass){
     // Ten-metre grass patches keep the finest curved blades near the camera
     // and reduce the overdraw needed for smooth per-clump density changes.
     const quantities=[0,0,0,0],quadrant=(i:number)=>(roots![i*4]>=center.x?1:0)+(roots![i*4+2]>=center.z?2:0);
     for(let i=0;i<count;i++)quantities[quadrant(i)]++;
     const patchRoots=quantities.map(n=>new Float32Array(n*4)),patchSizes=quantities.map(n=>new Float32Array(n*3)),offsets=[0,0,0,0];
     for(let i=0;i<count;i++){const q=quadrant(i),j=offsets[q]++;patchRoots[q].set(roots!.subarray(i*4,i*4+4),j*4);patchSizes[q].set(sizes!.subarray(i*3,i*3+3),j*3);}
     for(let q=0;q<4;q++){
      const compact=createCompactGrass(patchRoots[q],patchSizes[q],quantities[q],[geo,grassMedium[variant],grassLow[variant]],grassMat);
      const patchCenter=new THREE.Vector3(center.x+(q%2?5:-5),0,center.z+(q>1?5:-5));
      scene.add(compact);cells.push({center:patchCenter,meshes:[compact],kind:'grass',base:[quantities[q]]});
     }
     stats.grass+=count;continue;
    }
    if(!mesh)continue;
    mesh.count=count;mesh.userData.kind=item.kind;
    if('low' in item && item.low){
     mesh.userData.lods='medium' in item&&item.medium?[geo,item.medium[variant],item.low[variant]]:[geo,item.low[variant]];
    }
    let individual:Cell['individual'];
    if(item.kind==='fern'||item.kind==='shrub'){
     individual={matrices:new Float32Array(mesh.instanceMatrix.array.slice(0,count*16)),colors:new Float32Array(mesh.instanceColor!.array.slice(0,count*3)),count};
     for(let level=0;level<mesh.userData.lods.length;level++){
      const lodMesh=level===0?mesh:new THREE.InstancedMesh(mesh.userData.lods[level],item.mat,count);
      lodMesh.userData.kind=item.kind;lodMesh.userData.lodLevel=level;lodMesh.userData.lods=mesh.userData.lods;
      lodMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      if(level>0){lodMesh.instanceMatrix.array.set(individual.matrices);lodMesh.instanceColor=new THREE.InstancedBufferAttribute(individual.colors.slice(),3);}
      lodMesh.instanceColor!.setUsage(THREE.DynamicDrawUsage);
      lodMesh.customDepthMaterial=item.kind==='fern'?fernDepth:shrubDepth;
      lodMesh.castShadow=item.shadow;lodMesh.receiveShadow=true;lodMesh.computeBoundingSphere();scene.add(lodMesh);meshes.push(lodMesh);amounts.push(count);
     }

    }else{
     mesh.castShadow=item.shadow;mesh.receiveShadow=true;mesh.computeBoundingSphere();scene.add(mesh);meshes.push(mesh);amounts.push(count);
    }
    cells.push({center,meshes,kind:item.kind,base:amounts,individual});
    if(item.kind==='grass')stats.grass+=count;else if(item.kind==='fern')stats.ferns+=count;else if(item.kind==='shrub')stats.shrubs+=count;else stats.herbs+=count;
   }
  }
  await new Promise<void>(resolve=>setTimeout(resolve,0));
 }
 function grassDensity(d:number){return d<22?1:d<36?THREE.MathUtils.lerp(1,.55,(d-22)/14):d<51?THREE.MathUtils.lerp(.55,.22,(d-36)/15):d<70?THREE.MathUtils.lerp(.22,.10,(d-51)/19):THREE.MathUtils.lerp(.10,0,THREE.MathUtils.clamp((d-70)/18,0,1));}
 function update(camera:THREE.Camera,quality:number){
  const pos=camera.position;
  for(const c of cells){const d=Math.hypot(pos.x-c.center.x,pos.z-c.center.z);const max=c.kind==='tree'?FOREST_EXTENT.treeFar:c.kind==='grass'?88:c.kind==='fern'?67:c.kind==='shrub'?98:48;
   if(c.individual){
    const source=c.individual,counts=c.meshes.map(()=>0);
    for(const m of c.meshes){m.visible=d<max+14;m.castShadow=c.kind==='fern'?d<27:d<48;}
    if(d>=max+14)continue;
    for(let i=0;i<source.count;i++){
     const offset=i*16,ix=source.matrices[offset+12],iz=source.matrices[offset+14];
     const distance=Math.hypot(pos.x-ix,pos.z-iz);
     if(distance>max)continue;
     const density=c.kind==='fern'?(distance<24?1:distance<43?.42:.13)*(quality<.8?.72:1):1;
     if(((Math.imul(i+1,2654435761)>>>0)/4294967296)>density)continue;
     const level=c.kind==='fern'?(distance<(coarse?3.5:5.2)*quality?0:distance<(coarse?10:16)*quality?1:2):(distance<(coarse?8:13)*quality?0:1);
     const mesh=c.meshes[level] as THREE.InstancedMesh,slot=counts[level]++;
     mesh.instanceMatrix.array.set(source.matrices.subarray(offset,offset+16),slot*16);
     mesh.instanceColor!.array.set(source.colors.subarray(i*3,i*3+3),slot*3);
    }
    for(let level=0;level<c.meshes.length;level++){
     const m=c.meshes[level] as THREE.InstancedMesh;m.count=counts[level];m.instanceMatrix.needsUpdate=true;m.instanceColor!.needsUpdate=true;
    }
    continue;
   }
   for(let i=0;i<c.meshes.length;i++){
    const m=c.meshes[i];m.visible=c.kind==='tree'?d<distantTrees.nearDistance:d<max+(c.kind==='grass'?7.1:0);m.castShadow=c.kind==='tree'?d<90:false;
    if(c.kind==='tree'){const level=d<(coarse?17:24)*quality?0:d<(coarse?42:56)*quality?1:2;const g=m.userData.lods[level];if(m.geometry!==g)m.geometry=g;}
    if(c.kind==='grass'){
     m.geometry=m.userData.lods[d<9?0:d<23?1:2];
     (m.geometry as THREE.InstancedBufferGeometry).instanceCount=Math.min(c.base[i],Math.ceil(c.base[i]*(grassDensity(Math.max(0,d-7.5))*THREE.MathUtils.lerp(.74,1,THREE.MathUtils.clamp((quality-.64)/.36,0,1))+.029)));
    }
   }
  }
  distantTrees.update(camera);horizonTrees.update(camera);
 }
 return {update,stats,bark,treePositions:positions,treeSurfaces,distantTrees,horizonTrees};
}
