import * as THREE from 'three';
import {heightAt, rng, noise, trailAt, trailDistance} from './math';
import {insideDeadwood} from './surfaces';
import {windMaterial, windDepthMaterial} from './materials';

export type FloorTree = {x:number; z:number; s:number; radius?:number};
export type FloorPlacement = {x:number; z:number; yaw:number; scale:number; tone:number};
export type FlowerKind = 'bluebell'|'campion'|'buttercup'|'wood-anemone';
export const FLOWER_KINDS:FlowerKind[] = ['bluebell','campion','buttercup','wood-anemone'];
const UP = new THREE.Vector3(0,1,0), TAU = Math.PI*2;
const V = (x=0,y=0,z=0)=>new THREE.Vector3(x,y,z);

/** Small indexed botanical surfaces. Petals have a raised centre, curled edges
 * and a rounded outline, so their silhouette survives a moving camera. */
export class FloorGeometryBuilder {
 positions:number[]=[]; colors:number[]=[]; uvs:number[]=[]; indices:number[]=[];
 vertex(p:THREE.Vector3,c:THREE.Color,u=0,v=0){const index=this.positions.length/3;this.positions.push(p.x,p.y,p.z);this.colors.push(c.r,c.g,c.b);this.uvs.push(u,v);return index;}
 tri(a:number,b:number,c:number){this.indices.push(a,b,c);}
 finish(kind:string){
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(this.positions,3));
  geometry.setAttribute('color',new THREE.Float32BufferAttribute(this.colors,3));
  geometry.setAttribute('uv',new THREE.Float32BufferAttribute(this.uvs,2));
  geometry.setIndex(this.indices);geometry.computeVertexNormals();geometry.computeBoundingBox();geometry.computeBoundingSphere();
  geometry.userData={botanicalType:kind,triangles:this.indices.length/3,units:'metres'};
  return geometry;
 }
}
const STEM=new THREE.Color('#426226'),LEAF=new THREE.Color('#4c7c2e');
function naturalFlowerColor(hex:string){
 const color=new THREE.Color(hex),hsl={h:0,s:0,l:0};color.getHSL(hsl);
 return color.setHSL(hsl.h,hsl.s*.70,hsl.l);
}

export function addFloorStem(b:FloorGeometryBuilder,points:THREE.Vector3[],radius:number,color=STEM,sides=4){
 const rows:number[][]=[];let previous=V(1,0,0);
 for(let i=0;i<points.length;i++){
  const tangent=points[Math.min(i+1,points.length-1)].clone().sub(points[Math.max(0,i-1)]).normalize();
  const side=previous.clone().addScaledVector(tangent,-previous.dot(tangent)).normalize();
  if(side.lengthSq()<1e-8)side.crossVectors(tangent,UP).normalize();
  const other=new THREE.Vector3().crossVectors(tangent,side).normalize();previous=side;
  const t=i/(points.length-1),width=radius*(1-.72*t),row:number[]=[];
  for(let j=0;j<sides;j++){const a=j/sides*TAU;row.push(b.vertex(points[i].clone().addScaledVector(side,Math.cos(a)*width).addScaledVector(other,Math.sin(a)*width),color,j/sides,t));}
  rows.push(row);
 }
 for(let i=0;i<rows.length-1;i++)for(let j=0;j<sides;j++){const k=(j+1)%sides;b.tri(rows[i][j],rows[i+1][j],rows[i][k]);b.tri(rows[i][k],rows[i+1][j],rows[i+1][k]);}
}

export function addFloorLeaf(b:FloorGeometryBuilder,base:THREE.Vector3,angle:number,length:number,width:number,color=LEAF,curl=.18,sections=5){
 const axis=V(Math.cos(angle),.16,Math.sin(angle)),side=V(-Math.sin(angle),0,Math.cos(angle)),rows:number[][]=[];
 for(let i=0;i<=sections;i++){
  const t=i/sections,w=Math.pow(Math.sin(Math.PI*t),.72)*width*.5,center=base.clone().addScaledVector(axis,length*t);center.y+=length*curl*Math.sin(t*Math.PI*.9);
  const c=color.clone().multiplyScalar(.8+t*.26),row:number[]=[];
  if(i===0||i===sections)row.push(b.vertex(center,c,.5,t));
  else for(const j of [-1,0,1]){const p=center.clone().addScaledVector(side,j*w);p.y+=j===0?w*.14:-w*.16;row.push(b.vertex(p,c,(j+1)/2,t));}
  rows.push(row);
 }
 for(let i=0;i<sections;i++){
  const a=rows[i],c=rows[i+1];
  if(a.length===1){b.tri(a[0],c[0],c[1]);b.tri(a[0],c[1],c[2]);}
  else if(c.length===1){b.tri(a[0],c[0],a[1]);b.tri(a[1],c[0],a[2]);}
  else for(let j=0;j<2;j++){b.tri(a[j],c[j],a[j+1]);b.tri(a[j+1],c[j],c[j+1]);}
 }
}

function petal(b:FloorGeometryBuilder,center:THREE.Vector3,angle:number,length:number,width:number,color:THREE.Color,cupping:number,cleft=false,segments=4){
 const axis=V(Math.cos(angle),0,Math.sin(angle)),side=V(-Math.sin(angle),0,Math.cos(angle));
 const low=segments<4,sides=low?8:cleft?16:12,rings=low?1:2,rows:number[][]=[];
 // Rounded spoon-shaped lamina, built radially around its cupped middle.
 // A shallow sinus between the two pink lobes replaces the old deep V cut.
 const point=(x:number,z:number)=>{
  const p=center.clone().addScaledVector(axis,x*length).addScaledVector(side,z*width);
  p.y+=length*(cupping*x*x+z*z*.37-.055*Math.sin(x*Math.PI));return p;
 };
 const middle=b.vertex(point(.50,0),color.clone().multiplyScalar(.88),.5,.5);
 for(let ring=1;ring<=rings;ring++){
  const f=ring/rings,row:number[]=[];
  for(let i=0;i<sides;i++){
   const a=i/sides*TAU,cos=Math.cos(a),sin=Math.sin(a);
   const notch=cleft?.095*Math.pow(Math.max(0,cos),16):0;
   const x=.5+(.49*cos-notch)*f,z=.5*sin*(.73+.27*(cos+1)*.5)*f;
   row.push(b.vertex(point(x,z),color.clone().multiplyScalar(.84+x*.16),z+.5,x));
  }rows.push(row);
 }
 for(let i=0;i<sides;i++){const j=(i+1)%sides;b.tri(middle,rows[0][j],rows[0][i]);}
 for(let ring=0;ring<rows.length-1;ring++)for(let i=0;i<sides;i++){const j=(i+1)%sides;b.tri(rows[ring][i],rows[ring][j],rows[ring+1][i]);b.tri(rows[ring][j],rows[ring+1][j],rows[ring+1][i]);}
}

function flowerCenter(b:FloorGeometryBuilder,p:THREE.Vector3,radius:number,color:THREE.Color){
 const top=b.vertex(p.clone().add(V(0,radius*.45,0)),color,.5,.5),row=[];
 for(let i=0;i<9;i++){const a=i/9*TAU;row.push(b.vertex(p.clone().add(V(Math.cos(a)*radius,0,Math.sin(a)*radius)),color,(Math.cos(a)+1)*.5,(Math.sin(a)+1)*.5));}
 for(let i=0;i<9;i++)b.tri(top,row[i],row[(i+1)%9]);
}

function bell(b:FloorGeometryBuilder,center:THREE.Vector3,color:THREE.Color,angle:number,scale:number,low=false){
 const sides=low?6:16,segments=low?3:5,rows:number[][]=[],axis=V(Math.cos(angle)*.26,-1,Math.sin(angle)*.26).normalize(),side=V(-Math.sin(angle),0,Math.cos(angle)),other=new THREE.Vector3().crossVectors(axis,side).normalize();
 for(let i=0;i<=segments;i++){
  const t=i/segments,radius=(.0036+Math.sin(t*Math.PI*.55)*.0088+Math.pow(t,7)*.0015)*scale,row:number[]=[];
  for(let j=0;j<sides;j++){
   const a=j/sides*TAU,lobe=i===segments?(low?.0015:Math.cos(a*6)*.0022)*scale:0;
   const rim=radius+(i===segments?Math.max(0,Math.cos(a*6))*.0012*scale:0);
   const p=center.clone().addScaledVector(axis,t*.058*scale+lobe).addScaledVector(side,Math.cos(a)*rim).addScaledVector(other,Math.sin(a)*rim);
   row.push(b.vertex(p,color.clone().multiplyScalar(.82+t*.19),j/sides,t));
  }rows.push(row);
 }
 for(let i=0;i<segments;i++)for(let j=0;j<sides;j++){const k=(j+1)%sides;b.tri(rows[i][j],rows[i+1][j],rows[i][k]);b.tri(rows[i][k],rows[i+1][j],rows[i+1][k]);}
}

export function createFlowerGeometry(kind:FlowerKind,seed=1,detail:'high'|'low'='high'){
 const r=rng(seed),b=new FloorGeometryBuilder(),phase=r()*TAU;
 const low=detail==='low';
 if(kind==='bluebell'){
  const h=.59+r()*.16,bend=.12+r()*.06,curve=(t:number)=>V(Math.cos(phase)*bend*t*t,h*(t-.09*t*t),Math.sin(phase)*bend*t*t);
  addFloorStem(b,Array.from({length:9},(_,i)=>curve(i/8)),.006);
  for(let i=0;i<4;i++)addFloorLeaf(b,V(0,.012,0),phase+i*2.13,.22+r()*.13,.019+r()*.018,LEAF,.4,low?3:6);
  for(let i=0;i<6;i++){
   const t=.40+i*.098,stem=curve(t),a=phase+(i%2?.43:-.43),end=stem.clone().add(V(Math.cos(a)*(.04+r()*.025),.004,Math.sin(a)*.06));
   addFloorStem(b,[stem,stem.clone().lerp(end,.55).add(V(0,.018,0)),end],.0023);
   bell(b,end,naturalFlowerColor(i%3?'#8170be':'#7086bd'),a,.82+r()*.22,low);
  }
 }else{
  const pink=kind==='campion',gold=kind==='buttercup',stems=pink?3:gold?3:2;
  const petalColor=naturalFlowerColor(pink?'#df729f':gold?'#e6bd4a':'#eae2e6');
  const h=pink?.72:gold?.46:.38;
  for(let i=0;i<stems;i++){
   const a=phase+i*TAU/stems,hp=h*(.7+r()*.36),lean=.08+r()*.06;
   const end=V(Math.cos(a)*lean,hp,Math.sin(a)*lean),mid=end.clone().multiplyScalar(.48);mid.x*=.66;mid.z*=.66;
   addFloorStem(b,[V(),mid,end],pink?.0045:.0034);
   for(let j=0;j<2;j++){const t=.21+j*.24;addFloorLeaf(b,end.clone().multiplyScalar(t),a+j*Math.PI,.085+r()*.065,pink?.036:.046,LEAF,.24,low?3:5);}
   const count=pink?5:gold?5:6,rad=pink?.027:gold?.025:.028;
   for(let p=0;p<count;p++)petal(b,end,a+p/count*TAU,rad,rad*.99,petalColor,pink?.19:gold?.35:.22,pink,low?2:4);
   flowerCenter(b,end.clone().add(V(0,.003,0)),pink?.007:.011,new THREE.Color(pink?'#f3c5d7':gold?'#b58d16':'#d6b64f'));
  }
  for(let i=0;i<3;i++)addFloorLeaf(b,V(0,.012,0),phase+i*2.2,.14+r()*.055,.04,LEAF,.4,low?3:5);
 }
 const geometry=b.finish(kind);geometry.boundingSphere!.radius+=.16;return geometry;
}

/** Shared, spatially indexed root exclusion. This matches measured trunk
 * flares and rock footprints instead of dropping flowers through solid wood. */
export function createFloorExclusion(trees:FloorTree[],rocks:THREE.InstancedMesh[]){
 const cells=new Map<string,Array<{x:number;z:number;r:number}>>(),size=6;
 const add=(p:{x:number;z:number;r:number})=>{const key=`${Math.floor(p.x/size)},${Math.floor(p.z/size)}`;if(!cells.has(key))cells.set(key,[]);cells.get(key)!.push(p);};
 trees.forEach(t=>add({x:t.x,z:t.z,r:(t.radius??t.s*.72)+.1}));
 rocks.forEach(rock=>(rock.userData.footprints||[]).forEach((p:{x:number;z:number;r:number})=>add({x:p.x,z:p.z,r:p.r+.08})));
 return (x:number,z:number)=>{
  const cx=Math.floor(x/size),cz=Math.floor(z/size);
  for(let dz=-1;dz<=1;dz++)for(let dx=-1;dx<=1;dx++)for(const p of cells.get(`${cx+dx},${cz+dz}`)||[])if((p.x-x)**2+(p.z-z)**2<p.r*p.r)return true;
  return insideDeadwood(x,z);
 };
}

export function placeFloorBatch(scene:THREE.Scene,geometry:THREE.BufferGeometry,material:THREE.Material,plants:FloorPlacement[],kind:string,castShadow=false){
 const mesh=new THREE.InstancedMesh(geometry,material,plants.length),dummy=new THREE.Object3D(),tone=new THREE.Color();
 for(let i=0;i<plants.length;i++){
  const p=plants[i];dummy.position.set(p.x,heightAt(p.x,p.z)-.008,p.z);
  if(kind==='floor-curled-litter'||kind==='floor-pebbles'){
   const sx=(heightAt(p.x+.12,p.z)-heightAt(p.x-.12,p.z))/.24,sz=(heightAt(p.x,p.z+.12)-heightAt(p.x,p.z-.12))/.24;
   dummy.quaternion.setFromUnitVectors(UP,V(-sx,1,-sz).normalize());dummy.rotateY(p.yaw);
  }else dummy.rotation.set(0,p.yaw,0);
  dummy.scale.setScalar(p.scale);dummy.updateMatrix();mesh.setMatrixAt(i,dummy.matrix);mesh.setColorAt(i,tone.setRGB(p.tone,p.tone,p.tone));
 }
 mesh.name=kind;mesh.userData.kind=kind;mesh.receiveShadow=true;mesh.castShadow=castShadow;
 mesh.computeBoundingSphere();scene.add(mesh);return mesh;
}

export function createWildflowers(scene:THREE.Scene,trees:FloorTree[],rocks:THREE.InstancedMesh[],coarse=false){
 const r=rng(493837),blocked=createFloorExclusion(trees,rocks),material=windMaterial('shrub',{roughness:.71}),depth=windDepthMaterial('shrub');
 const geometry=FLOWER_KINDS.map((kind,i)=>createFlowerGeometry(kind,475+i*913));
 const lowGeometry=FLOWER_KINDS.map((kind,i)=>createFlowerGeometry(kind,475+i*913,'low'));
 for(let i=0;i<geometry.length;i++){const sphere=geometry[i].boundingSphere!.clone().union(lowGeometry[i].boundingSphere!);geometry[i].boundingSphere=sphere.clone();lowGeometry[i].boundingSphere=sphere.clone();}
 const cells=new Map<string,{kind:number;plants:FloorPlacement[];cx:number;cz:number}>();
 let drifts=0;
 const addDrift=(x:number,z:number,kind:number,radius:number,count:number)=>{
  let accepted=0;
  for(let i=0;i<count;i++){
   const angle=r()*TAU,spread=Math.sqrt(r())*radius,px=x+Math.cos(angle)*spread,pz=z+Math.sin(angle)*spread*.64;
   if(trailDistance(px,pz)<.58||blocked(px,pz)||noise(px*1.3+41,pz*1.3)<.22)continue;
   const cx=Math.floor(px/18),cz=Math.floor(pz/18),key=`${cx},${cz},${kind}`;
   if(!cells.has(key))cells.set(key,{kind,plants:[],cx,cz});
   cells.get(key)!.plants.push({x:px,z:pz,yaw:r()*TAU,scale:.82+r()*.55,tone:.88+r()*.2});accepted++;
  }if(accepted)drifts++;
 };
 // Long, coherent patches follow the trail. One dominant species per patch
 // makes the color read as colonies of plants, rather than random confetti.
 for(let i=0;i<100;i++){
  const z=-116+i*2.35+(r()-.5)*2.5,side=i%2?1:-1,x=trailAt(z)+side*(1.4+r()*4.2),kind=i%11<5?0:i%11<8?1:i%11<10?2:3;
  addDrift(x,z,kind,1.4+r()*1.65,Math.floor((coarse?34:64)*(1+r()*.35)));
 }
 // Hand-composed opening accents sit beside the first dolly path, clear of
 // the viewer's feet. Tall pink stems rise above the grass; bluebells sit low.
 for(const [x,z,kind,rad] of [[7.4,15,1,1.9],[2.7,11,0,2.4],[4.8,4,2,1.9],[-4.2,2.1,0,1.7],[-3.1,3.5,3,1.3],[7.6,-9.5,2,1.8],[-1.4,-2,0,2.5],[-4.2,-11,1,2.3],[1.9,-21,3,2.1],[-7,-31,0,2.8]])addDrift(x,z,kind,rad,coarse?80:135);
 for(let i=0;i<62;i++){
  const a=r()*TAU,d=18+Math.sqrt(r())*95,x=Math.cos(a)*d,z=Math.sin(a)*d;
  addDrift(x,z,i%4,1.7+r()*1.7,coarse?21:40);
 }
 const batches:Array<{mesh:THREE.InstancedMesh;center:THREE.Vector3;radius:number}>=[];let count=0;
 for(const cell of cells.values()){
  const mesh=placeFloorBatch(scene,geometry[cell.kind],material,cell.plants,`woodland-${FLOWER_KINDS[cell.kind]}`,true);mesh.customDepthMaterial=depth;mesh.userData.lods=[geometry[cell.kind],lowGeometry[cell.kind]];
  batches.push({mesh,center:mesh.boundingSphere!.center.clone(),radius:mesh.boundingSphere!.radius});count+=cell.plants.length;
 }
 return {stats:{wildflowers:count,flowerDrifts:drifts,flowerFamilies:FLOWER_KINDS.length},update(camera:THREE.Camera){
  for(const b of batches){const distance=camera.position.distanceTo(b.center);b.mesh.visible=distance<b.radius+(coarse?44:66);b.mesh.castShadow=distance<b.radius+23;b.mesh.geometry=b.mesh.userData.lods[distance>b.radius+(coarse?0:3)?1:0];}
 }};
}
