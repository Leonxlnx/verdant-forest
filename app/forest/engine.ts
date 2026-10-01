import * as THREE from 'three';
import {FOREST_LIGHTING as light,FOREST_EXTENT} from './config';
import {createGround,createRocks,createDeadwood,createLitter,createMushrooms} from './surfaces';
import {createVegetation} from './vegetation';
import {createControls} from './controls';
import {addSky,addParticles} from './atmosphere';
import {clockUniform,windUniform,qualityUniform,materialsReady,configureTextures} from './materials';
import {createVolumetrics} from './volumetrics';
import {createForestDetails} from './details';
import {compactGeometryAttributes} from './geometry-memory';
import {placeShadowWindow} from './shadow-window';
import {createWildflowers} from './wildflowers';
import {createFloorDetail} from './floor-detail';
import {applyCinematicCamera,FOREST_FILM_DURATION} from './cinematic';

export async function createForest(host:HTMLDivElement,onReady:()=>void,signal?:AbortSignal){
 signal?.throwIfAborted();
 const coarse=matchMedia('(pointer:coarse)').matches;configureTextures(coarse);
 const reduced=matchMedia('(prefers-reduced-motion: reduce)');
 const query=new URLSearchParams(location.search),capture=query.has('capture'),cinematic=query.has('cinematic');
 const renderer=new THREE.WebGLRenderer({antialias:false,powerPreference:'high-performance',alpha:false});
 const basePixelRatio=Math.min(devicePixelRatio,coarse?1.3:1.5);
 renderer.setPixelRatio(basePixelRatio);
 renderer.setSize(host.clientWidth,host.clientHeight);
 renderer.outputColorSpace=THREE.SRGBColorSpace;
 renderer.toneMapping=THREE.ACESFilmicToneMapping;
 renderer.toneMappingExposure=light.exposure;
 renderer.info.autoReset=false;
 renderer.shadowMap.enabled=true;
 renderer.shadowMap.type=THREE.PCFSoftShadowMap;
 renderer.shadowMap.autoUpdate=false;
 const canvas=renderer.domElement;
 canvas.dataset.status='building';host.appendChild(canvas);
 const scene=new THREE.Scene();
 scene.background=new THREE.Color(light.fogColor);
 scene.fog=new THREE.FogExp2(light.fogColor,light.fogDensity);
 const camera=new THREE.PerspectiveCamera(58,host.clientWidth/host.clientHeight,.06,FOREST_EXTENT.cameraFar);
 const controls=createControls(camera,canvas,host);clockUniform.value=0;windUniform.value=reduced.matches?0:1;qualityUniform.value=1;
 if(capture||cinematic){host.parentElement?.classList.add('cinematic','exploring');applyCinematicCamera(camera,0);}
 let disposed=false,lost=false,raf=0,previous=0,elapsed=0,frames=0,frameTime=0,quality=1,lastLOD=0,lastShadow=0;
 let post:ReturnType<typeof createVolumetrics>|undefined;
 let observer:ResizeObserver|undefined;
 let alert:HTMLDivElement|undefined;
 const sun=new THREE.DirectionalLight(light.sunColor,light.sunIntensity);
 sun.target.position.set(0,0,-3);sun.position.copy(sun.target.position).add(new THREE.Vector3(...light.sunDirection));sun.castShadow=true;
 sun.shadow.mapSize.set(coarse?2048:4096,coarse?2048:4096);
 Object.assign(sun.shadow.camera,{left:-light.shadowHalfExtent,right:light.shadowHalfExtent,top:light.shadowHalfExtent,bottom:-light.shadowHalfExtent,near:light.shadowNear,far:light.shadowFar});
 sun.shadow.bias=-.00012;sun.shadow.normalBias=.025;sun.shadow.camera.updateProjectionMatrix();
 const contextLost=(e:Event)=>{
  e.preventDefault();lost=true;canvas.dataset.status='context-lost';
  if(alert)return;
  alert=document.createElement('div');alert.className='loading';alert.setAttribute('role','status');
  alert.textContent='Graphics interrupted. Restoring the forest…';host.appendChild(alert);
 };
 const contextRestored=()=>{
  if(disposed)return;lost=false;previous=0;renderer.shadowMap.needsUpdate=true;
  post?.resize();canvas.dataset.status='ready';alert?.remove();alert=undefined;
 };
 canvas.addEventListener('webglcontextlost',contextLost);
 canvas.addEventListener('webglcontextrestored',contextRestored);
 const resetFrameTiming=()=>{previous=0;frames=0;frameTime=0;};
 document.addEventListener('visibilitychange',resetFrameTiming);
 function cleanup(){
  if(disposed)return;disposed=true;cancelAnimationFrame(raf);
  observer?.disconnect();controls.dispose();post?.dispose();alert?.remove();
  canvas.removeEventListener('webglcontextlost',contextLost);
  canvas.removeEventListener('webglcontextrestored',contextRestored);
  document.removeEventListener('visibilitychange',resetFrameTiming);
  signal?.removeEventListener('abort',cleanup);
  if(capture)delete (window as unknown as Record<string,unknown>).__forestCapture;
  const geometries=new Set<THREE.BufferGeometry>(),materials=new Set<THREE.Material>(),textures=new Set<THREE.Texture>();
  scene.traverse(object=>{
   if(!(object instanceof THREE.Mesh||object instanceof THREE.Points))return;
   if(object instanceof THREE.InstancedMesh)object.dispose();
   geometries.add(object.geometry);for(const lod of object.userData.lods||[])geometries.add(lod);
   const ms=Array.isArray(object.material)?[...object.material]:[object.material];if(object instanceof THREE.Mesh&&object.customDepthMaterial)ms.push(object.customDepthMaterial);
   for(const m of ms){materials.add(m);for(const v of Object.values(m))if(v instanceof THREE.Texture)textures.add(v);}
  });
  geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());textures.forEach(t=>t.dispose());
  sun.shadow.map?.dispose();renderer.dispose();renderer.forceContextLoss();canvas.remove();
 }
 signal?.addEventListener('abort',cleanup,{once:true});
 try{
  const sky=addSky(scene);sky.position.copy(camera.position);
  scene.add(new THREE.HemisphereLight(light.skyColor,light.groundColor,light.hemisphereIntensity),sun,sun.target);
  createGround(scene);const rocks=createRocks(scene);createLitter(scene);createMushrooms(scene);
  const vegetation=await createVegetation(scene,coarse,signal);
  signal?.throwIfAborted();
  createDeadwood(scene,vegetation.bark);
  const details=createForestDetails(scene,vegetation.treePositions,rocks,vegetation.bark,coarse,vegetation.treeSurfaces);
  const flowers=createWildflowers(scene,vegetation.treePositions,rocks,coarse);
  const floorDetail=createFloorDetail(scene,vegetation.treePositions,rocks,coarse);
  const particles=addParticles(scene,sun);particles.update(0,camera);
  compactGeometryAttributes(scene);
  post=createVolumetrics(renderer,camera,sun,coarse);
  await materialsReady();signal?.throwIfAborted();
  const resize=()=>{
   const w=host.clientWidth,h=host.clientHeight;if(!w||!h||disposed)return;
   camera.aspect=w/h;camera.updateProjectionMatrix();renderer.setSize(w,h);post?.resize();
  };
  observer=new ResizeObserver(resize);observer.observe(host);
  renderer.debug.onShaderError=(gl,program,vertexShader,fragmentShader)=>{
   // Preserve the driver diagnostics: a generic exception hid the original
   // WebGL-only failure and made reports from real devices impossible to locate.
   const logs=[
    ['Program',gl.getProgramInfoLog(program)],
    ['Vertex',gl.getShaderInfoLog(vertexShader)],
    ['Fragment',gl.getShaderInfoLog(fragmentShader)],
   ].filter(([,log])=>log?.trim()).map(([stage,log])=>`${stage}: ${log!.trim()}`);
   console.error('Forest shader compilation failed',{
    logs,vertexSource:gl.getShaderSource(vertexShader),fragmentSource:gl.getShaderSource(fragmentShader),
   });
   throw new Error(['A forest graphics shader could not compile.',...logs].join('\n'));
  };
  const shadowCenter=new THREE.Vector3(camera.position.x,0,camera.position.z);
  placeShadowWindow(sun,camera.position);
  renderer.shadowMap.needsUpdate=true;
  const updateDetail=()=>{vegetation.update(camera,quality);details.update(camera);flowers.update(camera);floorDetail.update(camera);};
  updateDetail();
  // Three 0.180 compileAsync retains material-property polling timers that
  // can outlive disposal or context restoration during startup. Starting
  // compilation synchronously keeps abort and resource teardown atomic.
  post.compile(scene);signal?.throwIfAborted();
  post.render(scene,0);canvas.dataset.status='ready';onReady();
  canvas.dataset.objects=JSON.stringify({...vegetation.stats,...details.stats,...flowers.stats,...floorDetail.stats});
  if(capture){
   // Capture mode freezes RAF. Every frame uses the real renderer and exact
   // animation time, independent of the speed of the machine doing capture.
   let captureShadowTime=-Infinity,capturePreviousTime=-1,captureShot=-1;
   const captureShadowCenter=new THREE.Vector3(Infinity,0,Infinity);
   (window as unknown as Record<string,unknown>).__forestCapture={
    render(time:number,shot?:number){
     if(!Number.isFinite(time)||time<0||time>FOREST_FILM_DURATION)throw new Error('Capture time must be between 0 and 30 seconds');
     const view=applyCinematicCamera(camera,time,shot);clockUniform.value=time;qualityUniform.value=1;
     sky.position.copy(camera.position);particles.update(time,camera);updateDetail();
     const changedShot=view.index!==captureShot||time<capturePreviousTime;
     const movedWindow=Math.hypot(camera.position.x-captureShadowCenter.x,camera.position.z-captureShadowCenter.z)>10;
     if(changedShot||movedWindow){placeShadowWindow(sun,camera.position);captureShadowCenter.copy(camera.position);}
     // Use the same eight-Hz moving-foliage shadow cadence as exploration.
     // Re-rendering a 4096px shadow map for every recorded frame added work
     // absent from the live scene and changed its temporal appearance.
     renderer.shadowMap.needsUpdate=changedShot||movedWindow||time-captureShadowTime>=(coarse?.24:.125);
     if(renderer.shadowMap.needsUpdate)captureShadowTime=time;
     captureShot=view.index;capturePreviousTime=time;
     renderer.info.reset();post!.render(scene,time);
     return {...view,triangles:renderer.info.render.triangles,draws:renderer.info.render.calls};
    },
    info(){return {duration:FOREST_FILM_DURATION,width:canvas.width,height:canvas.height,objects:JSON.parse(canvas.dataset.objects!)};},
   };
   return cleanup;
  }
  let cinematicStart:number|undefined;
  function animate(now:number){
   if(disposed)return;raf=requestAnimationFrame(animate);
   const rawDt=previous?(now-previous)/1000:.016;previous=now;
   if(document.hidden||lost){frames=0;frameTime=0;return;}
   const dt=Math.min(rawDt,.055);elapsed+=dt;
   clockUniform.value=elapsed;qualityUniform.value=quality;windUniform.value=reduced.matches?0:1;
   if(cinematic){cinematicStart??=now;applyCinematicCamera(camera,((now-cinematicStart)/1000)%FOREST_FILM_DURATION);}
   else controls.update(dt,elapsed);
   sky.position.copy(camera.position);particles.update(reduced.matches?0:elapsed,camera);
   if(elapsed-lastLOD>.3){updateDetail();lastLOD=elapsed;}
   if(Math.hypot(camera.position.x-shadowCenter.x,camera.position.z-shadowCenter.z)>10){
    shadowCenter.copy(camera.position);placeShadowWindow(sun,camera.position);renderer.shadowMap.needsUpdate=true;
   }
   if(!reduced.matches&&elapsed-lastShadow>(coarse?.24:.125)/quality){renderer.shadowMap.needsUpdate=true;lastShadow=elapsed;}
   renderer.info.reset();post!.render(scene,reduced.matches?0:elapsed);
   frameTime+=rawDt;frames++;
   if(frames>=90||frameTime>3){
    const fps=frames/frameTime;
    canvas.dataset.fps=fps.toFixed(1);canvas.dataset.triangles=String(renderer.info.render.triangles);
    canvas.dataset.draws=String(renderer.info.render.calls);
    canvas.dataset.position=camera.position.toArray().map(n=>n.toFixed(2)).join(',');
    if(fps<27&&quality>.64){quality=Math.max(.64,quality-.12);renderer.setPixelRatio(basePixelRatio*quality);post!.resize();}
    frames=0;frameTime=0;
   }
  }
  raf=requestAnimationFrame(animate);
  return cleanup;
 }catch(error){cleanup();throw error;}
}
