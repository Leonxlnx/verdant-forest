import * as THREE from 'three';
import {mergeVertices} from 'three/addons/utils/BufferGeometryUtils.js';
import {rng,noise,trailAt,trailDistance} from './math';
import {windMaterial,windDepthMaterial} from './materials';
import {DEADWOOD_PLACEMENTS} from './surfaces';
import {FloorGeometryBuilder,addFloorStem,addFloorLeaf,createFloorExclusion,placeFloorBatch,type FloorTree,type FloorPlacement} from './wildflowers';

const TAU=Math.PI*2,V=(x=0,y=0,z=0)=>new THREE.Vector3(x,y,z);
export const FLOOR_DETAIL_KINDS=['sorrel','moss-star','curled-litter','seedheads','pebbles'] as const;
type Kind=typeof FLOOR_DETAIL_KINDS[number];

export function createFloorDetailGeometry(kind:Kind,seed=1){
 const r=rng(seed),b=new FloorGeometryBuilder();
 if(kind==='sorrel'){
  // Three heart-shaped leaflets per slender petiole, a folded midrib and a
  // real notch at the leaflet's outer tip instead of a clover-shaped card.
  for(let shoot=0;shoot<4;shoot++){
   const a=r()*TAU,h=.045+r()*.085,base=V((r()-.5)*.11,0,(r()-.5)*.11),top=base.clone().add(V(Math.cos(a)*.025,h,Math.sin(a)*.025));
   addFloorStem(b,[base,base.clone().lerp(top,.5),top],.0018,new THREE.Color('#719345'));
   for(let leaf=0;leaf<3;leaf++){
    const angle=a+leaf*TAU/3,axis=V(Math.cos(angle),0,Math.sin(angle)),side=V(-Math.sin(angle),0,Math.cos(angle)),length=.036+r()*.012;
    const root=b.vertex(top,new THREE.Color('#3c682c'),.5,0),mid=b.vertex(top.clone().addScaledVector(axis,length*.55).add(V(0,.006,0)),new THREE.Color('#608b35'),.5,.55);
    const outline=[[-.25,.26],[-.59,.60],[-.52,.96],[-.22,1.04],[0,.86],[.22,1.04],[.52,.96],[.59,.60],[.25,.26]];
    const ids=outline.map(([x,z])=>b.vertex(top.clone().addScaledVector(axis,z*length).addScaledVector(side,x*length).add(V(0,Math.abs(x)*-.008+z*.008,0)),new THREE.Color('#567f32'),x+.5,z));
    b.tri(root,ids[0],mid);for(let i=0;i<ids.length-1;i++)b.tri(mid,ids[i],ids[i+1]);b.tri(mid,ids[ids.length-1],root);
   }
  }
 }else if(kind==='moss-star'){
  for(let shoot=0;shoot<11;shoot++){
   const angle=r()*TAU,radius=Math.sqrt(r())*.067,base=V(Math.cos(angle)*radius,.003,Math.sin(angle)*radius),h=.018+r()*.03;
   const top=base.clone().add(V(0,h,0));addFloorStem(b,[base,top],.0012,new THREE.Color('#5c6f30'));
   for(let j=0;j<5;j++)addFloorLeaf(b,top.clone().add(V(0,-h*.3,0)),angle+j*TAU/5,.019+r()*.012,.005,new THREE.Color(j%2?'#658436':'#769743'),.5,3);
  }
 }else if(kind==='curled-litter'){
  for(let leaf=0;leaf<3;leaf++){
   const a=r()*TAU,base=V((r()-.5)*.12,.01,(r()-.5)*.12),length=.075+r()*.08,width=length*.43,axis=V(Math.cos(a),0,Math.sin(a)),side=V(-Math.sin(a),0,Math.cos(a)),rows:number[][]=[];
   for(let i=0;i<=7;i++){
    const t=i/7,w=Math.pow(Math.sin(t*Math.PI),.68)*width*.5*(i%2?.73:1.12),center=base.clone().addScaledVector(axis,length*t);center.y+=Math.pow(t,3)*length*.20;
    const row:number[]=[],color=new THREE.Color(leaf%2?'#94703c':'#b27b3d');
    if(i===0||i===7)row.push(b.vertex(center,color,.5,t));
    else for(const s of [-1,0,1]){const p=center.clone().addScaledVector(side,s*w);p.y+=s===0?.003:w*.34;row.push(b.vertex(p,color.clone().multiplyScalar(.72+r()*.25),(s+1)*.5,t));}
    rows.push(row);
   }
   for(let i=0;i<7;i++){const a=rows[i],c=rows[i+1];if(a.length===1){b.tri(a[0],c[0],c[1]);b.tri(a[0],c[1],c[2]);}else if(c.length===1){b.tri(a[0],c[0],a[1]);b.tri(a[1],c[0],a[2]);}else for(let j=0;j<2;j++){b.tri(a[j],c[j],a[j+1]);b.tri(a[j+1],c[j],c[j+1]);}}
   addFloorStem(b,[base.clone().addScaledVector(axis,-.025),base,base.clone().addScaledVector(axis,length*.55).add(V(0,.012,0))],.0017,new THREE.Color('#785735'));
  }
 }else if(kind==='seedheads'){
  for(let i=0;i<3;i++){
   const a=r()*TAU,h=.42+r()*.27,lean=.04+r()*.06,at=(t:number)=>V(Math.cos(a)*lean*t*t,h*t,Math.sin(a)*lean*t*t),stem=new THREE.Color('#887544');
   addFloorStem(b,Array.from({length:6},(_,j)=>at(j/5)),.0025,stem);
   for(let j=0;j<3;j++)addFloorLeaf(b,at(.15+j*.17),a+j*2.4,.13,.009,new THREE.Color('#73834d'),.6,4);
   for(let j=0;j<7;j++){
    const t=.72+j*.034,center=at(t),angle=a+j*2.38,reach=.033*(1-(t-.72)*2),end=center.clone().add(V(Math.cos(angle)*reach,.01,Math.sin(angle)*reach));
    addFloorStem(b,[center,end],.0014,stem,3);
    for(const sign of [-1,1])addFloorLeaf(b,end,angle+sign*.29,.025,.006,new THREE.Color('#9b8260'),.45,3);
   }
  }
 }else{
  const geometry=new THREE.IcosahedronGeometry(1,1),p=geometry.attributes.position,colors=[];
  for(let i=0;i<p.count;i++){const x=p.getX(i),y=p.getY(i),z=p.getZ(i),n=.84+noise(x*4+seed,z*3+y)*.24;p.setXYZ(i,x*n*.033,(y*n+.75)*.019,z*n*.026);const c=new THREE.Color('#8d8970').multiplyScalar(.77+noise(x*11,z*14)*.25);colors.push(c.r,c.g,c.b);}
  geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));geometry.setAttribute('uv',new THREE.Float32BufferAttribute(new Float32Array(p.count*2),2));geometry.deleteAttribute('normal');
  const smooth=mergeVertices(geometry,1e-7);smooth.computeVertexNormals();smooth.computeBoundingBox();smooth.computeBoundingSphere();smooth.userData={botanicalType:kind,triangles:smooth.index!.count/3,units:'metres'};geometry.dispose();return smooth;
 }
 const geometry=b.finish(kind);geometry.boundingSphere!.radius+=kind==='seedheads'?.14:.025;return geometry;
}

export function createFloorDetail(scene:THREE.Scene,trees:FloorTree[],rocks:THREE.InstancedMesh[],coarse=false){
 const r=rng(909127),blocked=createFloorExclusion(trees,rocks),cells=new Map<string,{kind:number;plants:FloorPlacement[]}>();
 const geometries=FLOOR_DETAIL_KINDS.map((kind,i)=>createFloorDetailGeometry(kind,782+i*193));
 const live=windMaterial('shrub',{roughness:.94}),depth=windDepthMaterial('shrub'),dry=new THREE.MeshStandardMaterial({vertexColors:true,roughness:.96,side:THREE.DoubleSide});
 const add=(x:number,z:number,kind:number,scale=1)=>{
  if(blocked(x,z))return;
  if(kind!==2&&kind!==4&&trailDistance(x,z)<.47)return;
  const key=`${Math.floor(x/12)},${Math.floor(z/12)},${kind}`;
  if(!cells.has(key))cells.set(key,{kind,plants:[]});
  cells.get(key)!.plants.push({x,z,yaw:r()*TAU,scale:scale*(.68+r()*.77),tone:.84+r()*.23});
 };
 // Tiny objects are concentrated where a person can see them: path margins,
 // leaf pockets, deadwood margins and rooted tree islands. No global blanket.
 for(let i=0;i<(coarse?7500:13500);i++){
  const z=(r()-.5)*226,side=r()<.5?-1:1,d=r(),x=trailAt(z)+side*(d<.23?r()*.58:.7+Math.pow(r(),1.8)*5.2);
  const band=noise(x*.73+91,z*.73),kind=d<.15?4:d<.38?2:band<.31?1:band<.67?0:3;
  if(kind===3&&r()<.60)continue;add(x,z,kind,kind===0?1.1:1);
 }
 // Low sorrel and velvet moss fringe the bare tread where the existing grass
 // is shortest. This close-up layer must remain visible instead of vanishing
 // underneath the tall, dense grass beyond the path margin.
 for(let i=0;i<(coarse?800:1450);i++){
  const z=(r()-.5)*207,side=r()<.5?-1:1,x=trailAt(z)+side*(.49+r()*.29);
  if(noise(z*.33+42,side*.76)>.23)add(x,z,i%3===0?1:0,.84);
 }
 for(const [x,z,length,,angle] of DEADWOOD_PLACEMENTS){
  const c=Math.cos(angle),s=Math.sin(angle);
  for(let i=0;i<(coarse?85:160);i++){
   const along=(r()-.5)*(length+.7),across=(r()<.5?-1:1)*(.48+r()*.8),px=x+along*c-across*s,pz=z-along*s-across*c;
   add(px,pz,i%5===0?2:i%3===0?0:1,1.14);
  }
 }
 for(const tree of trees){
  if(Math.hypot(tree.x,tree.z)>99)continue;
  const count=coarse?14:25;
  for(let i=0;i<count;i++){
   const a=r()*TAU,d=(tree.radius??tree.s*.75)+.12+r()*.93;
   add(tree.x+Math.cos(a)*d,tree.z+Math.sin(a)*d,i%4===0?2:i%3===0?1:0);
  }
 }
 const batches:Array<{mesh:THREE.InstancedMesh;center:THREE.Vector3;radius:number;kind:number}>=[];const amounts=[0,0,0,0,0];
 for(const cell of cells.values()){
  const living=cell.kind!==2&&cell.kind!==4,mesh=placeFloorBatch(scene,geometries[cell.kind],living?live:dry,cell.plants,`floor-${FLOOR_DETAIL_KINDS[cell.kind]}`,cell.kind===3);
  if(cell.kind===3)mesh.customDepthMaterial=depth;
  batches.push({mesh,center:mesh.boundingSphere!.center.clone(),radius:mesh.boundingSphere!.radius,kind:cell.kind});amounts[cell.kind]+=cell.plants.length;
 }
 return {stats:{sorrelPatches:amounts[0],mossRosettes:amounts[1],curledLeafPiles:amounts[2],seedheadClumps:amounts[3],smallPebbles:amounts[4]},update(camera:THREE.Camera){
  for(const b of batches){const distance=camera.position.distanceTo(b.center),range=b.kind===3?42:b.kind===0?27:20;b.mesh.visible=distance<b.radius+range*(coarse?.8:1);b.mesh.castShadow=b.kind===3&&distance<b.radius+18;}
 }};
}
