import * as THREE from 'three';
export const clockUniform = {value:0};
export const windUniform = {value:1};
export const qualityUniform = {value:1};
const textureCache = new Map<string, THREE.Texture>();
const pendingTextures: Promise<void>[] = [];
let compactTextures=false;
export function configureTextures(coarse:boolean){compactTextures=coarse;}
export function texture(url:string,color=false,repeat=1) {
 if(compactTextures)url=url.replace('/textures/','/textures/mobile/');
 const key=`${url}|${color}|${repeat}`;
 const cached=textureCache.get(key);if(cached)return cached;
 let resolveLoad!:()=>void, rejectLoad!:(error:Error)=>void;
 const ready=new Promise<void>((resolve,reject)=>{resolveLoad=resolve;rejectLoad=reject;});
 // Attach immediately so a fast network failure cannot become unhandled before
 // scene construction reaches the shared loading barrier.
 ready.catch(()=>{});pendingTextures.push(ready);
 const t=new THREE.TextureLoader().load(url,()=>resolveLoad(),undefined,()=>rejectLoad(new Error(`Could not load forest material: ${url}`)));
 t.colorSpace=color?THREE.SRGBColorSpace:THREE.NoColorSpace;t.wrapS=t.wrapT=THREE.RepeatWrapping;t.repeat.set(repeat,repeat);t.anisotropy=8;textureCache.set(key,t);return t;
}
export function materialsReady(){return Promise.all(pendingTextures);}
export function windMaterial(kind:'grass'|'fern'|'leaf'|'shrub', extra:THREE.MeshStandardMaterialParameters={}, compact=false) {
 const m=new THREE.MeshStandardMaterial({vertexColors:true,roughness:kind==='leaf'?.76:.87,metalness:0,side:THREE.DoubleSide,...extra});
 m.userData.compact=compact;
 m.onBeforeCompile = (s) => {
  s.uniforms.uForestTime=clockUniform;s.uniforms.uForestWind=windUniform;s.uniforms.uForestQuality=qualityUniform;
  s.vertexShader='uniform float uForestTime; uniform float uForestWind; uniform float uForestQuality; varying vec3 vForestWorld; varying float vForestHeight; varying vec2 vBotanicalUv; varying float vBotanicalTone;\n'+s.vertexShader;
  if(compact){
   s.vertexShader='attribute vec4 forestPlacement;attribute vec3 forestScale;attribute float forestRank;\n'+s.vertexShader;
   s.vertexShader=s.vertexShader.replace('#include <beginnormal_vertex>',`#include <beginnormal_vertex>
    float forestCos=cos(forestPlacement.w),forestSin=sin(forestPlacement.w);
    objectNormal/=forestScale;
    objectNormal.xz=mat2(forestCos,-forestSin,forestSin,forestCos)*objectNormal.xz;
   `);
  }
  s.vertexShader=s.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
    vec4 forestRoot = vec4(0.,0.,0.,1.);
    ${compact?'forestRoot.xyz=forestPlacement.xyz;':''}
    #ifdef USE_INSTANCING
      forestRoot = instanceMatrix * forestRoot;
    #endif
    forestRoot = modelMatrix * forestRoot;
    float phase=forestRoot.x*.37+forestRoot.z*.22;
    float wave=sin(uForestTime*1.25+phase)+.36*sin(uForestTime*2.17+phase*1.47);
    float bend=${kind==='leaf'?'min(1.0,position.y*.05)':kind==='grass'?'pow(max(position.y,0.),1.4)':kind==='fern'?'max(position.y,0.)*.38':'max(position.y,0.)*.24'};
    transformed.x += wave*bend*${kind==='leaf'?'.14':'.13'}*uForestWind;
    transformed.z += cos(uForestTime*.93+phase)*bend*.068*uForestWind;
    ${kind==='leaf'?`float flutter=sin(uForestTime*4.3+position.x*13.+position.z*17.)*.012*uv.y*uForestWind;
    transformed.y+=flutter;transformed.x+=flutter*.45;`:''}
    ${compact?`float groundDistance=distance(forestRoot.xz,cameraPosition.xz);
    float cover=groundDistance<22.?1.:groundDistance<36.?mix(1.,.55,(groundDistance-22.)/14.):groundDistance<51.?mix(.55,.22,(groundDistance-36.)/15.):groundDistance<70.?mix(.22,.10,(groundDistance-51.)/19.):mix(.10,0.,clamp((groundDistance-70.)/18.,0.,1.));
    cover*=mix(.74,1.,clamp((uForestQuality-.64)/.36,0.,1.));
    float emergence=(1.-smoothstep(cover-.028,cover+.028,forestRank))*smoothstep(0.,.02,cover);
    transformed*=forestScale*emergence;
    transformed.xz=mat2(forestCos,-forestSin,forestSin,forestCos)*transformed.xz;
    transformed+=forestPlacement.xyz;`:''}
    vForestHeight=position.y; vBotanicalUv=uv;vBotanicalTone=fract(sin(dot(forestRoot.xz,vec2(12.9898,78.233)))*43758.5453);
  `);
  s.vertexShader=s.vertexShader.replace('#include <worldpos_vertex>',`#include <worldpos_vertex>
    vec4 fw = vec4(transformed,1.);
    #ifdef USE_INSTANCING
      fw = instanceMatrix * fw;
    #endif
    vForestWorld=(modelMatrix*fw).xyz;
  `);
  s.fragmentShader='varying vec3 vForestWorld; varying float vForestHeight; varying vec2 vBotanicalUv; varying float vBotanicalTone;\n'+s.fragmentShader;
  s.fragmentShader=s.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
    float midrib=exp(-pow((vBotanicalUv.x-.5)*88.,2.));
    float vein=pow(.5+.5*cos((vBotanicalUv.y*16.-abs(vBotanicalUv.x-.5)*5.)*6.28318),16.);
    float textureVariation=sin(vBotanicalUv.x*143.+sin(vBotanicalUv.y*91.)*2.)*sin(vBotanicalUv.y*177.);
    diffuseColor.rgb*=(.90+textureVariation*.035+midrib*.18+vein*.065)*mix(.89,1.10,vBotanicalTone);
  `);
  if(kind!=='grass')s.fragmentShader=s.fragmentShader.replace('#include <normal_fragment_maps>',`#include <normal_fragment_maps>
    // Raised veins stay below a tenth of a millimetre. Screen derivatives
    // perturb the real curved surface only at inspection distance.
    float detailFade=1.-smoothstep(2.5,6.,length(vViewPosition));
    float veinHeight=(midrib*.7+vein*.18+textureVariation*.035)*${kind==='fern'?'.000035':'.00009'}*detailFade;
    vec3 surfaceX=dFdx(-vViewPosition),surfaceY=dFdy(-vViewPosition);
    vec3 ridgeX=cross(surfaceY,normal),ridgeY=cross(normal,surfaceX);
    float ridgeDet=dot(surfaceX,ridgeX)*faceDirection;
    vec3 ridgeGradient=sign(ridgeDet)*(dFdx(veinHeight)*ridgeX+dFdy(veinHeight)*ridgeY);
    normal=normalize(max(abs(ridgeDet),1.e-12)*normal-ridgeGradient);
  `);
  s.fragmentShader=s.fragmentShader.replace('#include <lights_fragment_end>',`#include <lights_fragment_end>
    reflectedLight.indirectDiffuse += diffuseColor.rgb * ${kind==='grass'?'.055':'.065'};
    #if NUM_DIR_LIGHTS > 0
    float forestBacklight=pow(max(dot(-geometryViewDir,directLight.direction),0.),3.);
    float forestTransmission=max(-dot(normal,directLight.direction),0.)*.45+forestBacklight*.55;
    reflectedLight.directDiffuse+=diffuseColor.rgb*directLight.color*forestTransmission*${kind==='grass'?'.085':'.12'};
    #endif
  `);
 };
 m.customProgramCacheKey=()=>`forest-wind-${kind}-v5${compact?'-compact':''}`;
 return m;
}
export function windDepthMaterial(kind:'fern'|'leaf'|'shrub'){
 const source=windMaterial(kind);
 const depth=new THREE.MeshDepthMaterial({depthPacking:THREE.RGBADepthPacking,side:THREE.DoubleSide});
 depth.onBeforeCompile=(shader,renderer)=>source.onBeforeCompile(shader,renderer);
 depth.customProgramCacheKey=()=>`forest-wind-shadow-${kind}-v1`;
 return depth;
}
export function groundMaterial(map:THREE.Texture,normalMap:THREE.Texture){
 const m=new THREE.MeshStandardMaterial({map,normalMap,normalScale:new THREE.Vector2(.65,.65),vertexColors:true,roughness:.98});
 m.onBeforeCompile=s=>{
  s.vertexShader='varying vec3 vGroundPosition;\n'+s.vertexShader;
  s.vertexShader=s.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvGroundPosition=(modelMatrix*vec4(position,1.)).xyz;');
  s.fragmentShader=`varying vec3 vGroundPosition;
 float groundCoverHash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
 float groundCoverNoise(vec2 p){
  vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
  return mix(mix(groundCoverHash(i),groundCoverHash(i+vec2(1.,0.)),f.x),mix(groundCoverHash(i+vec2(0.,1.)),groundCoverHash(i+vec2(1.,1.)),f.x),f.y);
 }
 `+s.fragmentShader;
  s.fragmentShader=s.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
   // True view distance includes the camera's altitude. A canopy view must
   // retain the color of low vegetation even directly underneath the camera.
   float distant=smoothstep(12.,48.,distance(cameraPosition,vGroundPosition));
   float trail=abs(vGroundPosition.x-sin(vGroundPosition.z*.09)*3.6-sin(vGroundPosition.z*.027)*4.);
   vec2 coverUV=vGroundPosition.xz;
   float broadCover=groundCoverNoise(coverUV*.14);
   float mediumCover=groundCoverNoise(coverUV*.57+vec2(broadCover*1.6,21.4));
   float fineCover=groundCoverNoise(coverUV*3.1+vec2(7.3,19.1));
   float coverPatch=clamp(broadCover*.5+mediumCover*.35+fineCover*.15,0.,1.);
   vec3 lowCover=mix(vec3(.019,.038,.009),vec3(.060,.099,.028),coverPatch);
   float litterLuma=dot(diffuseColor.rgb,vec3(.2126,.7152,.0722));
   lowCover*=.88+clamp(litterLuma*5.,0.,1.)*.2;
   // Preserve both the close photographic litter and the narrow brown trail.
   // Beyond detailed vegetation range, the ground represents its average cover.
   float coverBlend=(1.-pow(1.-distant,1.5))*.985*smoothstep(.35,1.2,trail);
   diffuseColor.rgb=mix(diffuseColor.rgb,lowCover,coverBlend);
  `);
 };
 m.customProgramCacheKey=()=>`forest-ground-v3`;return m;
}
export function mossRockMaterial() {
 const m=new THREE.MeshStandardMaterial({color:'#c1c5b3',map:texture('/textures/rock-color.jpg',true),normalMap:texture('/textures/rock-normal.jpg'),roughness:.96,vertexColors:true});
 m.onBeforeCompile = s => {
 s.vertexShader='varying vec3 vMossPos; varying vec3 vMossNormal; varying vec3 vMossAxisX; varying vec3 vMossAxisY; varying vec3 vMossAxisZ;\n'+s.vertexShader;
 s.vertexShader=s.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
 vMossPos=position;vMossNormal=normal;
 mat3 mossBasis=mat3(1.);
 #ifdef USE_INSTANCING
 mossBasis=mat3(instanceMatrix);
 #endif
 vMossAxisX=normalize(normalMatrix*mossBasis[0]);
 vMossAxisY=normalize(normalMatrix*mossBasis[1]);
 vMossAxisZ=normalize(normalMatrix*mossBasis[2]);
 `);
 s.fragmentShader=`varying vec3 vMossPos;varying vec3 vMossNormal;varying vec3 vMossAxisX;varying vec3 vMossAxisY;varying vec3 vMossAxisZ;
 float mh(vec3 p){return fract(sin(dot(p,vec3(12.9898,78.233,24.11)))*43758.5453);}
 float mn(vec3 p){vec3 i=floor(p);vec3 f=fract(p);f=f*f*(3.-2.*f);return mix(mix(mix(mh(i),mh(i+vec3(1,0,0)),f.x),mix(mh(i+vec3(0,1,0)),mh(i+vec3(1,1,0)),f.x),f.y),mix(mix(mh(i+vec3(0,0,1)),mh(i+vec3(1,0,1)),f.x),mix(mh(i+vec3(0,1,1)),mh(i+vec3(1,1,1)),f.x),f.y),f.z);}
 vec3 mossWeights(){vec3 w=pow(abs(normalize(vMossNormal)),vec3(4.));return w/max(dot(w,vec3(1.)),.001);}
 `+s.fragmentShader;
 s.fragmentShader=s.fragmentShader.replace('#include <map_fragment>',`
 vec3 rockWeights=mossWeights();
 vec3 rockColor=texture2D(map,vMossPos.yz*.56).rgb*rockWeights.x+texture2D(map,vMossPos.xz*.56).rgb*rockWeights.y+texture2D(map,vMossPos.xy*.56).rgb*rockWeights.z;
 diffuseColor.rgb*=rockColor;
 `);
 s.fragmentShader=s.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
 float coarse=mn(vMossPos*5.)*.65+mn(vMossPos*14.)*.35;
 float fine=mn(vMossPos*165.);
 float moss=smoothstep(.38,.78,vMossNormal.y*.65+coarse*.45);
 diffuseColor.rgb*=mix(vec3(.8,.85,.79),vec3(.38,.55,.19),moss*.67)*(.86+fine*.2);
 `);
 s.fragmentShader=s.fragmentShader.replace('#include <normal_fragment_maps>',`
 vec3 nw=mossWeights(),ns=sign(vMossNormal);
 vec3 nx=texture2D(normalMap,vMossPos.yz*.56).xyz*2.-1.;
 vec3 ny=texture2D(normalMap,vMossPos.xz*.56).xyz*2.-1.;
 vec3 nz=texture2D(normalMap,vMossPos.xy*.56).xyz*2.-1.;
 nx.xy*=.72;ny.xy*=.72;nz.xy*=.72;
 vec3 localN=normalize(vec3(nx.z*ns.x,nx.x,nx.y)*nw.x+vec3(ny.x,ny.z*ns.y,ny.y)*nw.y+vec3(nz.x,nz.y,nz.z*ns.z)*nw.z);
 normal=normalize(vMossAxisX*localN.x+vMossAxisY*localN.y+vMossAxisZ*localN.z);
 `);
 };
 m.customProgramCacheKey=()=>`forest-moss-v2`;return m;
}
export function deadwoodMaterial(bark:THREE.MeshStandardMaterial){
 const m=bark.clone();
 m.onBeforeCompile=s=>{
 s.vertexShader='varying vec3 vLogLocal; varying vec3 vLogNormal;\n'+s.vertexShader;
 s.vertexShader=s.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvLogLocal=position;vLogNormal=normal;');
 s.fragmentShader=`varying vec3 vLogLocal;varying vec3 vLogNormal;
 float lh(vec3 p){return fract(sin(dot(p,vec3(127.1,311.7,74.7)))*43758.5453);}
 float ln(vec3 p){vec3 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(mix(lh(i),lh(i+vec3(1,0,0)),f.x),mix(lh(i+vec3(0,1,0)),lh(i+vec3(1,1,0)),f.x),f.y),mix(mix(lh(i+vec3(0,0,1)),lh(i+vec3(1,0,1)),f.x),mix(lh(i+vec3(0,1,1)),lh(i+vec3(1,1,1)),f.x),f.y),f.z);}
 `+s.fragmentShader;
 s.fragmentShader=s.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
 float patches=ln(vLogLocal*6.)*.7+ln(vLogLocal*18.)*.3;
 float moss=smoothstep(.32,.63,vLogNormal.y*.52+patches*.68);
 vec3 mossColor=mix(vec3(.04,.075,.014),vec3(.16,.23,.046),patches);
 diffuseColor.rgb=mix(diffuseColor.rgb,mossColor,moss*.9);
 `);
 };
 m.customProgramCacheKey=()=>`forest-log-v2`;return m;
}
function applyTreeWind(shader:Parameters<THREE.Material['onBeforeCompile']>[0]){
 shader.uniforms.uForestTime=clockUniform;shader.uniforms.uForestWind=windUniform;
 shader.vertexShader='uniform float uForestTime;uniform float uForestWind;\n'+shader.vertexShader;
 shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
 vec4 treeRoot=vec4(0.,0.,0.,1.);
 #ifdef USE_INSTANCING
 treeRoot=instanceMatrix*treeRoot;
 #endif
 treeRoot=modelMatrix*treeRoot;
 float treePhase=treeRoot.x*.37+treeRoot.z*.22;
 float treeWave=sin(uForestTime*1.25+treePhase)+.36*sin(uForestTime*2.17+treePhase*1.47);
 float treeBend=min(1.,position.y*.05);
 transformed.x+=treeWave*treeBend*.14*uForestWind;
 transformed.z+=cos(uForestTime*.93+treePhase)*treeBend*.068*uForestWind;
 `);
}
export function treeAttachedMaterial(){
 const material=new THREE.MeshStandardMaterial({vertexColors:true,roughness:.95,side:THREE.DoubleSide});
 material.onBeforeCompile=shader=>applyTreeWind(shader);
 material.customProgramCacheKey=()=> 'forest-tree-attached-v1';
 return material;
}
export function treeDepthMaterial(){
 const depth=new THREE.MeshDepthMaterial({depthPacking:THREE.RGBADepthPacking});
 depth.onBeforeCompile=shader=>applyTreeWind(shader);
 depth.customProgramCacheKey=()=>`forest-wood-shadow-v1`;return depth;
}
export function treeBarkMaterial(species:string,map:THREE.Texture,normalMap:THREE.Texture){
 const m=new THREE.MeshStandardMaterial({map,normalMap,normalScale:new THREE.Vector2(species==='oak'?.65:species==='birch'?.16:.27,species==='oak'?.65:species==='birch'?.16:.27),color:species==='oak'?'#c6b298':species==='beech'?'#cfcec2':'#e3dac5',roughness:.94});
 m.onBeforeCompile=s=>{
 applyTreeWind(s);
 s.vertexShader='varying vec3 vBarkPosition; varying vec3 vBarkVariation;\n'+s.vertexShader;
 s.vertexShader=s.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
 vBarkPosition=position;
 vec4 barkOrigin=vec4(0.,0.,0.,1.);
 #ifdef USE_INSTANCING
 barkOrigin=instanceMatrix*barkOrigin;
 #endif
 barkOrigin=modelMatrix*barkOrigin;
 // The same geometry can occur in many trees. The material must not repeat
 // its pale fields and scars at precisely the same heights on each one.
 vBarkVariation=vec3(barkOrigin.x*.71,barkOrigin.z*.37,barkOrigin.x*.23+barkOrigin.z*.51);
 `);
 s.fragmentShader=`varying vec3 vBarkPosition; varying vec3 vBarkVariation;
 ${species==='birch'?`
 float birchHash(vec3 p){return fract(sin(dot(p,vec3(127.1,311.7,74.7)))*43758.5453);}
 float birchNoise(vec3 p){
  vec3 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
  return mix(mix(mix(birchHash(i),birchHash(i+vec3(1.,0.,0.)),f.x),mix(birchHash(i+vec3(0.,1.,0.)),birchHash(i+vec3(1.,1.,0.)),f.x),f.y),mix(mix(birchHash(i+vec3(0.,0.,1.)),birchHash(i+vec3(1.,0.,1.)),f.x),mix(birchHash(i+vec3(0.,1.,1.)),birchHash(i+vec3(1.,1.,1.)),f.x),f.y),f.z);
 }
 `:''}
 `+s.fragmentShader;
 s.fragmentShader=s.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
 float flake=sin(vBarkPosition.y*14.+sin(vBarkPosition.x*10.)*3.)*sin(vBarkPosition.z*8.3);
 ${species==='birch'?`
 vec3 barkP=vBarkPosition+vBarkVariation;
 // Continuous fields replace the old fixed-height rows and angular cells.
 // Every lenticel has a different length, position and broken edge, while
 // the world-space noise avoids a cylindrical UV seam on branches.
 float ageField=birchNoise(barkP*vec3(1.7,.36,1.7));
 float stainField=birchNoise(barkP*vec3(4.8,1.6,4.8)+13.7);
 float paperField=birchNoise(barkP*vec3(5.2,13.,5.2)+31.4);
 float barkFineVisibility=1.-smoothstep(3.,13.,length(vViewPosition));
 float fineGrain=mix(.5,birchNoise(barkP*vec3(90.,25.,90.)),barkFineVisibility);
 float warpedHeight=barkP.y+(stainField-.5)*.07;
 float lenticelField=birchNoise(vec3(barkP.x*19.,warpedHeight*112.,barkP.z*19.));
 float lenticelGate=smoothstep(.31,.69,stainField);
 float lenticel=smoothstep(.70,.86,lenticelField)*lenticelGate*mix(.22,1.,barkFineVisibility);
 float oldScar=birchNoise(vec3(barkP.x*8.5,warpedHeight*31.,barkP.z*8.5)+71.9);
 float tornBark=smoothstep(.76,.9,oldScar)*smoothstep(.42,.68,ageField);
 float peelEdge=(1.-smoothstep(.022,.065,abs(paperField-.51)))*smoothstep(.48,.74,stainField);
 vec3 paleBark=mix(vec3(.26,.265,.235),vec3(.54,.515,.445),smoothstep(.22,.77,ageField));
 paleBark=mix(paleBark,paleBark*vec3(.75,.73,.69),smoothstep(.57,.8,stainField)*.50);
 paleBark*=.90+stainField*.16+(fineGrain-.5)*.055;
 paleBark=mix(paleBark,vec3(.34,.29,.215),peelEdge*.20);
 paleBark=mix(paleBark,vec3(.135,.114,.083),lenticel*.42+tornBark*.46);
 // A little photographic microstructure remains in the smooth upper bark.
 // Close to the roots, rough brown bark emerges along an irregular edge.
 float sourceLuma=dot(diffuseColor.rgb,vec3(.2126,.7152,.0722));
 paleBark*=mix(.9,1.09,smoothstep(.015,.22,sourceLuma));
 float baseWeathering=1.-smoothstep(.12,2.1+stainField*1.5,vBarkPosition.y+(ageField-.5)*1.4);
 diffuseColor.rgb=mix(paleBark,diffuseColor.rgb*.94,baseWeathering*.87);
 ` : species==='beech'?`float luma=dot(diffuseColor.rgb,vec3(.3,.59,.11));diffuseColor.rgb=mix(diffuseColor.rgb,vec3(luma*1.15,luma*1.17,luma*1.13),.75);`:''}
 float moss=(1.-smoothstep(.1,3.3,vBarkPosition.y))*(.25+.30*sin(vBarkPosition.x*5.+vBarkPosition.z*7.)+.17*flake);
 diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.055,.085,.019),clamp(moss,0.,.8));
 `);
 if(species==='birch')s.fragmentShader=s.fragmentShader.replace('#include <normal_fragment_maps>',`#include <normal_fragment_maps>
 // Sub-millimetre paper edges catch grazing light without turning the trunk
 // into a rocky surface. Fade the relief before it becomes subpixel shimmer.
 float barkDetailFade=1.-smoothstep(3.,12.,length(vViewPosition));
 float barkRelief=(peelEdge*.00036+fineGrain*.00015-lenticel*.0002-tornBark*.00032)*barkDetailFade;
 vec3 barkDx=dFdx(-vViewPosition),barkDy=dFdy(-vViewPosition);
 vec3 barkRx=cross(barkDy,normal),barkRy=cross(normal,barkDx);
 float barkDet=dot(barkDx,barkRx)*faceDirection;
 vec3 barkGradient=sign(barkDet)*(dFdx(barkRelief)*barkRx+dFdy(barkRelief)*barkRy);
 normal=normalize(max(abs(barkDet),1.e-12)*normal-barkGradient);
 `);
 };
 m.customProgramCacheKey=()=>`forest-tree-bark-${species}-v5`;return m;
}
