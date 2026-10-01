import * as THREE from 'three';
import {FOREST_LIGHTING as light,FOREST_EXTENT} from './config';
import {skyRadianceGLSL} from './atmosphere';
import {FullScreenQuad} from 'three/addons/postprocessing/Pass.js';
const vertexShader=`varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`;
// World-space single scattering. Rays stop at the actual scene depth; sun
// visibility comes from the same canopy shadow map as the forest floor.
export const volumeFragment=`
#include <packing>
varying vec2 vUv;
uniform sampler2D tDepth;uniform sampler2D tShadow;
uniform mat4 invProjection;uniform mat4 cameraWorld;uniform mat4 sunMatrix;
uniform vec3 eye;uniform vec3 sunDirection;uniform vec2 resolution;
uniform float time;uniform float strength;
float hash(vec3 p){p=fract(p*.3183099+.1);p*=17.;return fract(p.x*p.y*p.z*(p.x+p.y+p.z));}
float noise3(vec3 x){vec3 p=floor(x),f=fract(x);f=f*f*(3.-2.*f);return mix(mix(mix(hash(p),hash(p+vec3(1,0,0)),f.x),mix(hash(p+vec3(0,1,0)),hash(p+vec3(1,1,0)),f.x),f.y),mix(mix(hash(p+vec3(0,0,1)),hash(p+vec3(1,0,1)),f.x),mix(hash(p+vec3(0,1,1)),hash(p+vec3(1,1,1)),f.x),f.y),f.z);}
float visibility(vec3 p){vec4 sp=sunMatrix*vec4(p,1.);vec3 uv=sp.xyz/sp.w;if(any(lessThan(uv,vec3(0.)))||any(greaterThan(uv,vec3(1.))))return .35;float d=unpackRGBAToDepth(texture2D(tShadow,uv.xy));return smoothstep(uv.z-.0008,uv.z-.0003,d);}
void main(){float depth=texture2D(tDepth,vUv).r;vec4 view=invProjection*vec4(vUv*2.-1.,depth*2.-1.,1.);view/=view.w;vec3 world=(cameraWorld*view).xyz;vec3 ray=world-eye;float distance=min(length(ray),${light.volumeDistance}.);ray=normalize(ray);float stepLength=distance/40.;float jitter=fract(sin(dot(gl_FragCoord.xy,vec2(12.9898,78.233)))*43758.5453);float trans=1.;vec3 scatter=vec3(0.);float forward=pow(max(dot(ray,sunDirection),0.),5.);float phase=.48+forward*1.75;
for(int i=0;i<40;i++){vec3 p=eye+ray*(float(i)+jitter)*stepLength;float n=noise3(p*.065+vec3(time*.004,0.,0.));float heightDensity=exp(-max(p.y-1.,0.)*.062);float density=(.002+n*.006)*heightDensity*strength;float light=visibility(p);float absorption=exp(-density*stepLength);vec3 lightColor=mix(vec3(.13,.21,.23),vec3(.94,.82,.56)*phase,light);scatter+=trans*(1.-absorption)*lightColor;trans*=absorption;}
gl_FragColor=vec4(scatter,trans);}
`;
// Small-scale screen-space occlusion supplies the contact shading that a
// forest-wide directional shadow map cannot resolve. Reconstruct normals
// from the least-discontinuous depth neighbours, then sample a world radius.
export const occlusionFragment=`
varying vec2 vUv;
uniform sampler2D tDepth;uniform mat4 invProjection;uniform mat4 projection;
uniform vec2 resolution;uniform float radius;
vec3 viewPosition(vec2 uv){float d=texture2D(tDepth,uv).r;vec4 p=invProjection*vec4(uv*2.-1.,d*2.-1.,1.);return p.xyz/p.w;}
void main(){
float depth=texture2D(tDepth,vUv).r;
if(depth>.99999){gl_FragColor=vec4(1.,1.,0.,1.);return;}
vec3 p=viewPosition(vUv);vec2 texel=1./resolution;
vec3 l=p-viewPosition(vUv-vec2(texel.x,0.)),r=viewPosition(vUv+vec2(texel.x,0.))-p;
vec3 b=p-viewPosition(vUv-vec2(0.,texel.y)),t=viewPosition(vUv+vec2(0.,texel.y))-p;
vec3 n=normalize(cross(abs(l.z)<abs(r.z)?l:r,abs(b.z)<abs(t.z)?b:t));
float pixelRadius=clamp(radius*projection[1][1]*resolution.y/max(-p.z,1.)*.5,2.,80.);
float rotation=fract(sin(dot(gl_FragCoord.xy,vec2(12.9898,78.233)))*43758.5453)*6.283185;
float occlusion=0.;float weights=0.;
for(int i=0;i<16;i++){
float fraction=(float(i)+.5)/16.;float angle=float(i)*2.399963+rotation;
vec2 uv=vUv+vec2(cos(angle),sin(angle))*sqrt(fraction)*pixelRadius*texel;
vec3 q=viewPosition(clamp(uv,texel,1.-texel));vec3 delta=q-p;
float distance=length(delta);float weight=1.-smoothstep(radius*.15,radius*1.25,distance);
float obscured=max(dot(n,delta/max(distance,.001))-.10,0.);
occlusion+=obscured*weight;weights+=1.;
}
float ao=clamp(1.-occlusion/max(weights,1.)*3.1,.36,1.);
float linearDepth=clamp(-p.z/${FOREST_EXTENT.cameraFar}.,0.,.99999);
gl_FragColor=vec4(ao,floor(linearDepth*255.)/255.,fract(linearDepth*255.),1.);
}`;
export const compositeFragment=`varying vec2 vUv;uniform sampler2D tScene;uniform sampler2D tVolume;uniform sampler2D tOcclusion;uniform sampler2D tDepth;uniform mat4 invProjection;uniform mat4 cameraWorld;uniform vec2 texel;uniform vec2 volumeTexel;
${skyRadianceGLSL}
float viewDepth(vec2 uv){vec4 p=invProjection*vec4(uv*2.-1.,texture2D(tDepth,uv).r*2.-1.,1.);return -p.z/p.w;}
void main(){vec3 c=texture2D(tScene,vUv).rgb;
vec4 p=invProjection*vec4(vUv*2.-1.,texture2D(tDepth,vUv).r*2.-1.,1.);float depth=-p.z/p.w;
// Distant extinction joins geometry to the same directional sky radiance.
// The veil begins beyond the detailed grove and reaches opacity before clipping.
vec3 ray=(cameraWorld*vec4(p.xyz/p.w,0.)).xyz;
vec3 horizon=forestSky(ray,vec3(${new THREE.Color(light.skyTop).toArray().join(',')}),vec3(${new THREE.Color(light.skyBottom).toArray().join(',')}),normalize(vec3(${light.sunDirection.map(n=>n.toFixed(1)).join(',')})));
c=mix(c,horizon,smoothstep(${light.hazeStart}.,${light.hazeEnd}.,length(ray)));
// Bilateral volume upsampling keeps mist from spilling across nearby leaves.
vec2 grid=vUv/volumeTexel-.5,base=(floor(grid)+.5)*volumeTexel,part=fract(grid);
vec4 v=vec4(0.);float volumeWeight=0.;
for(int x=0;x<2;x++)for(int y=0;y<2;y++){
 vec2 uv=base+vec2(float(x),float(y))*volumeTexel;
 float bilinear=(x==0?1.-part.x:part.x)*(y==0?1.-part.y:part.y);
 float weight=bilinear*exp(-abs(viewDepth(uv)-depth)*.85);
 v+=texture2D(tVolume,uv)*weight;volumeWeight+=weight;
}
v=volumeWeight>.00001?v/volumeWeight:texture2D(tVolume,vUv);
float ao=0.,total=0.;
for(int x=-1;x<=1;x++)for(int y=-1;y<=1;y++){
vec3 sampleAo=texture2D(tOcclusion,vUv+vec2(float(x),float(y))*texel*2.).rgb;
float weight=exp(-abs((sampleAo.y+sampleAo.z/255.)*${FOREST_EXTENT.cameraFar}.-depth)*5.)/(1.+float(x*x+y*y));
ao+=sampleAo.x*weight;total+=weight;
}
ao=total>.00001?ao/total:1.;
c=c*mix(.44,1.,ao)*v.a+v.rgb;
// A restrained pre-tonemap grade keeps the forest green, while separating
// cool shaded foliage from the warm direct-light highlights.
float luminance=dot(c,vec3(.2126,.7152,.0722));
c=mix(vec3(luminance),c,${light.saturation});
c*=mix(vec3(.94,.995,1.025),vec3(1.018,1.,.97),smoothstep(.10,.85,luminance));
float vignette=1.-.10*pow(length((vUv-.5)*vec2(1.05,.85)),1.8);gl_FragColor=vec4(max(c,vec3(0.))*vignette,1.);
#include <tonemapping_fragment>
#include <colorspace_fragment>
}`;
export function createVolumetrics(renderer:THREE.WebGLRenderer,camera:THREE.PerspectiveCamera,sun:THREE.DirectionalLight,coarse:boolean){
 const targetType=renderer.extensions.has('EXT_color_buffer_float')?THREE.HalfFloatType:THREE.UnsignedByteType;
 const sceneTarget=new THREE.WebGLRenderTarget(1,1,{type:targetType,minFilter:THREE.LinearFilter,magFilter:THREE.LinearFilter,depthBuffer:true});sceneTarget.samples=Math.min(renderer.capabilities.maxSamples,coarse?2:4);sceneTarget.depthTexture=new THREE.DepthTexture(1,1,THREE.UnsignedIntType);
 const volumeTarget=new THREE.WebGLRenderTarget(1,1,{type:targetType,minFilter:THREE.LinearFilter,magFilter:THREE.LinearFilter,depthBuffer:false});
 const occlusionTarget=new THREE.WebGLRenderTarget(1,1,{type:THREE.UnsignedByteType,minFilter:THREE.NearestFilter,magFilter:THREE.NearestFilter,depthBuffer:false});
 const uniforms={tDepth:{value:sceneTarget.depthTexture},tShadow:{value:null as THREE.Texture|null},invProjection:{value:camera.projectionMatrixInverse},cameraWorld:{value:camera.matrixWorld},sunMatrix:{value:sun.shadow.matrix},eye:{value:camera.position},sunDirection:{value:new THREE.Vector3(...light.sunDirection).normalize()},resolution:{value:new THREE.Vector2()},time:{value:0},strength:{value:light.volumeStrength}};
 const volumeMaterial=new THREE.ShaderMaterial({uniforms,vertexShader,fragmentShader:volumeFragment,depthTest:false,depthWrite:false});const volumeQuad=new FullScreenQuad(volumeMaterial);
 const occlusionMaterial=new THREE.ShaderMaterial({uniforms:{tDepth:{value:sceneTarget.depthTexture},invProjection:{value:camera.projectionMatrixInverse},projection:{value:camera.projectionMatrix},resolution:{value:new THREE.Vector2()},radius:{value:.85}},vertexShader,fragmentShader:occlusionFragment,depthTest:false,depthWrite:false});const occlusionQuad=new FullScreenQuad(occlusionMaterial);
 const compositeMaterial=new THREE.ShaderMaterial({uniforms:{tScene:{value:sceneTarget.texture},tVolume:{value:volumeTarget.texture},tOcclusion:{value:occlusionTarget.texture},tDepth:{value:sceneTarget.depthTexture},invProjection:{value:camera.projectionMatrixInverse},cameraWorld:{value:camera.matrixWorld},texel:{value:new THREE.Vector2()},volumeTexel:{value:new THREE.Vector2()}},vertexShader,fragmentShader:compositeFragment,depthTest:false,depthWrite:false});const compositeQuad=new FullScreenQuad(compositeMaterial);
 function resize(){const s=renderer.getDrawingBufferSize(new THREE.Vector2());sceneTarget.setSize(s.x,s.y);const ratio=coarse?.34:.5;volumeTarget.setSize(Math.ceil(s.x*ratio),Math.ceil(s.y*ratio));uniforms.resolution.value.set(s.x*ratio,s.y*ratio);occlusionTarget.setSize(Math.ceil(s.x*.5),Math.ceil(s.y*.5));occlusionMaterial.uniforms.resolution.value.set(s.x,s.y);compositeMaterial.uniforms.texel.value.set(1/s.x,1/s.y);compositeMaterial.uniforms.volumeTexel.value.set(1/volumeTarget.width,1/volumeTarget.height);}
 resize();
 return {resize,compile(scene:THREE.Scene){const previous=renderer.getRenderTarget();try{renderer.setRenderTarget(sceneTarget);renderer.compile(scene,camera);}finally{renderer.setRenderTarget(previous);}},render(scene:THREE.Scene,time:number){uniforms.time.value=time;renderer.setRenderTarget(sceneTarget);renderer.render(scene,camera);uniforms.tShadow.value=sun.shadow.map?.texture||null;renderer.setRenderTarget(volumeTarget);volumeQuad.render(renderer);renderer.setRenderTarget(occlusionTarget);occlusionQuad.render(renderer);renderer.setRenderTarget(null);compositeQuad.render(renderer);},dispose(){sceneTarget.depthTexture?.dispose();sceneTarget.dispose();volumeTarget.dispose();occlusionTarget.dispose();volumeMaterial.dispose();occlusionMaterial.dispose();compositeMaterial.dispose();volumeQuad.dispose();occlusionQuad.dispose();compositeQuad.dispose();}};
}
