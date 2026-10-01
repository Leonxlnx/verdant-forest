import * as THREE from 'three';
import {rng} from './math';
import {FOREST_LIGHTING as lighting,FOREST_EXTENT} from './config';
export const skyRadianceGLSL=`vec3 forestSky(vec3 direction,vec3 top,vec3 bottom,vec3 sun){vec3 d=normalize(direction);float h=pow(max(0.,d.y),.6);vec3 c=mix(bottom,top,h);float glow=pow(max(0.,dot(d,sun)),20.);c+=vec3(.65,.50,.25)*glow*.7;c+=vec3(2.,1.8,1.3)*smoothstep(.9994,.9998,dot(d,sun));return c;}`;
export function addSky(scene:THREE.Scene) {
 const sky=new THREE.Mesh(new THREE.SphereGeometry(FOREST_EXTENT.cameraFar*.98,32,16),new THREE.ShaderMaterial({side:THREE.BackSide,depthWrite:false,uniforms:{top:{value:new THREE.Color(lighting.skyTop)},bottom:{value:new THREE.Color(lighting.skyBottom)},sun:{value:new THREE.Vector3(...lighting.sunDirection).normalize()}},vertexShader:`varying vec3 vDir; void main(){vDir=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,fragmentShader:`uniform vec3 top;uniform vec3 bottom;uniform vec3 sun;varying vec3 vDir;${skyRadianceGLSL} void main(){gl_FragColor=vec4(forestSky(vDir,top,bottom,sun),1.);#include <tonemapping_fragment>\n#include <colorspace_fragment>}`.replace(';#include',';\n#include')}));sky.renderOrder=-1;sky.frustumCulled=false;scene.add(sky);return sky;
}
export function addParticles(scene:THREE.Scene,sun:THREE.DirectionalLight){
 const n=600,r=rng(218),positions=new Float32Array(n*3),seeds=new Float32Array(n);
 for(let i=0;i<n;i++){positions[i*3]=(r()-.5)*110;positions[i*3+1]=.5+r()*16;positions[i*3+2]=(r()-.5)*110;seeds[i]=r();}
 const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.BufferAttribute(positions,3));geometry.setAttribute('seed',new THREE.BufferAttribute(seeds,1));
 const uniforms={time:{value:0},eye:{value:new THREE.Vector3()},tShadow:{value:null as THREE.Texture|null},sunMatrix:{value:sun.shadow.matrix},hasShadow:{value:false}};
 const material=new THREE.ShaderMaterial({transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,uniforms,
 vertexShader:`
 #include <packing>
 uniform float time;uniform vec3 eye;uniform sampler2D tShadow;uniform mat4 sunMatrix;uniform bool hasShadow;
 attribute float seed;varying float vAlpha;
 void main(){
  vec3 p=position;
  p.xz+=floor((eye.xz-p.xz)/110.+.5)*110.;
  p.x+=sin(time*.24+seed*50.)*.7;p.y+=sin(time*.38+seed*90.)*.35;p.z+=cos(time*.22+seed*34.)*.55;
  vec4 mv=modelViewMatrix*vec4(p,1.);
  vec4 projected=sunMatrix*vec4(p,1.);vec3 shadowUv=projected.xyz/projected.w;
  float lit=.2;
  if(hasShadow&&all(greaterThan(shadowUv,vec3(0.)))&&all(lessThan(shadowUv,vec3(1.)))){
   float depth=unpackRGBAToDepth(texture2D(tShadow,shadowUv.xy));lit=smoothstep(shadowUv.z-.0006,shadowUv.z-.0002,depth);
  }
  float edge=1.-smoothstep(34.,49.,distance(p.xz,eye.xz));
  float shimmer=.5+.5*pow(sin(seed*17.+time*.4)*.5+.5,4.);
  vAlpha=(.018+lit*.34)*edge*shimmer;
  gl_PointSize=clamp(24./max(1.,-mv.z),.8,2.5);gl_Position=projectionMatrix*mv;
 }`,
 fragmentShader:`varying float vAlpha;void main(){float d=length(gl_PointCoord-.5)*2.;float a=(1.-smoothstep(.05,1.,d))*vAlpha;gl_FragColor=vec4(.83,.73,.48,a);}`});
 const points=new THREE.Points(geometry,material);points.frustumCulled=false;
 points.onBeforeRender=()=>{uniforms.tShadow.value=sun.shadow.map?.texture||null;uniforms.hasShadow.value=!!sun.shadow.map;};
 scene.add(points);
 return {update(t:number,camera:THREE.Camera){uniforms.time.value=t;uniforms.eye.value.copy(camera.position);},points};
}
