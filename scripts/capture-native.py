"""Current-source native OpenGL capture of exported Three meshes and custom shaders.
Not a browser recording and not an FPS benchmark. Meshes/material shaders, wind,
shadow windows and postprocessing are exported from the app; GLES shader sources
are compiled separately without native adaptation by compile-webgl-shaders.py.
"""
import os,json,sys,time
from pathlib import Path
import numpy as np
from PIL import Image
import moderngl
# Configure EGL externally (for example source /workspace/daybreak-render-runtime/env.sh).
options={'backend':'egl','require':330}
if os.environ.get('FOREST_LIBEGL'):options['libegl']=os.environ['FOREST_LIBEGL']
elif os.environ.get('DAYBREAK_EGL_ROOT'):options['libegl']=str(Path(os.environ['DAYBREAK_EGL_ROOT'])/'usr/lib/x86_64-linux-gnu/libEGL.so.1')
ctx=moderngl.create_standalone_context(**options)
print(ctx.info['GL_RENDERER'],flush=True)
D=Path(os.environ.get('FOREST_QA_DIR','artifacts/scene-data'));S=json.load(open(D/'scene.json'));
manifest=Path('artifacts/qa-modules/source-manifest.json')
if manifest.exists():
 prepared=json.loads(manifest.read_text()).get('sha256');exported=S.get('source',{}).get('sha256')
 print('source manifest: scene='+str(exported)+' shaders='+str(prepared),flush=True)
 if prepared!=exported:raise RuntimeError('Scene and shader snapshots differ: re-export the scene from current source before capture')

for key,env in [('exposure','FOREST_QA_EXPOSURE'),('volumeStrength','FOREST_QA_VOLUME')]:
 if os.environ.get(env):S['lighting'][key]=float(os.environ[env])
for key,env in [('sun','FOREST_QA_SUN'),('hemisphereSky','FOREST_QA_HEMI'),('hemisphereGround','FOREST_QA_HEMI')]:
 if os.environ.get(env):S['lighting'][key]=[v*float(os.environ[env]) for v in S['lighting'][key]]
SUN=np.array(S['lighting'].get('sunDirection',[-34,49,-39]),dtype=float)
SHADOW_HALF=S['lighting'].get('shadowHalfExtent',44)
SHADOW_NEAR=S['lighting'].get('shadowNear',1)
SHADOW_FAR=S['lighting'].get('shadowFar',135)
W,H=[int(n*float(os.environ.get('FOREST_QA_SCALE','1'))) for n in (int(os.environ.get('FOREST_CAPTURE_WIDTH','1440')),int(os.environ.get('FOREST_CAPTURE_HEIGHT','900')))]
shader_v='''#version 330
in vec3 in_pos;in vec3 in_normal;in vec2 in_uv;in vec3 in_color;
in vec4 i0;in vec4 i1;in vec4 i2;in vec4 i3;
uniform mat4 projection;uniform mat4 view;uniform mat4 model;uniform mat4 shadowMatrix;
out vec3 vWorld;out vec3 vNormal;out vec2 vUV;out vec3 vColor;out vec4 vShadow;
void main(){mat4 instance=mat4(i0,i1,i2,i3);mat4 m=model*instance;vec4 p=m*vec4(in_pos,1);vWorld=p.xyz;vNormal=normalize(mat3(transpose(inverse(m)))*in_normal);vUV=in_uv;vColor=in_color;vShadow=shadowMatrix*p;gl_Position=projection*view*p;}
'''
shader_f='''#version 330
in vec3 vWorld;in vec3 vNormal;in vec2 vUV;in vec3 vColor;in vec4 vShadow;
uniform vec3 color;uniform vec3 camera;uniform int useMap;uniform int useColor;uniform int moss;uniform int leaf;uniform sampler2D colorMap;uniform sampler2D normalMap;uniform int useNormal;uniform vec2 repeat;uniform sampler2D shadowMap;
out vec4 frag;
float hash(vec3 p){return fract(sin(dot(p,vec3(12.9898,78.233,24.11)))*43758.5453);}
float noise(vec3 p){vec3 i=floor(p);vec3 f=fract(p);f=f*f*(3.-2.*f);return mix(mix(mix(hash(i),hash(i+vec3(1,0,0)),f.x),mix(hash(i+vec3(0,1,0)),hash(i+vec3(1,1,0)),f.x),f.y),mix(mix(hash(i+vec3(0,0,1)),hash(i+vec3(1,0,1)),f.x),mix(hash(i+vec3(0,1,1)),hash(i+vec3(1,1,1)),f.x),f.y),f.z);}
vec3 aces(vec3 x){return clamp((x*(2.51*x+.03))/(x*(2.43*x+.59)+.14),0.,1.);}
void main(){vec3 n=normalize(vNormal);if(!gl_FrontFacing)n=-n;vec3 albedo=color;if(useColor==1)albedo*=vColor;if(useMap==1)albedo*=pow(texture(colorMap,vUV*repeat).rgb,vec3(2.2));
 if(useNormal==1){vec3 q1=dFdx(vWorld),q2=dFdy(vWorld);vec2 st1=dFdx(vUV),st2=dFdy(vUV);vec3 t=normalize(q1*st2.y-q2*st1.y);vec3 b=normalize(-q1*st2.x+q2*st1.x);vec3 nm=texture(normalMap,vUV*repeat).xyz*2.-1.;nm.xy*=.65;n=normalize(mat3(t,b,n)*nm);}
 if(moss==1){float co=noise(vWorld*5.)*.65+noise(vWorld*14.)*.35;float fi=noise(vWorld*165.);float mo=smoothstep(.19,.49,n.y+co*.62-.24);vec3 st=vec3(.30,.31,.28)*(.45+co*.9+fi*.24);vec3 gr=mix(vec3(.065,.093,.016),vec3(.19,.26,.037),co)*(.75+fi*.4);albedo*=mix(st*2.3,gr*2.,mo);}
 vec3 sun=normalize(vec3(-34.,49.,-39.));float ndl=max(dot(n,sun),0.);vec3 sp=vShadow.xyz/vShadow.w;float sha=1.;if(all(greaterThan(sp,vec3(0)))&&all(lessThan(sp,vec3(1)))){sha=0.;for(int i=-1;i<=1;i++)for(int j=-1;j<=1;j++){float dep=texture(shadowMap,sp.xy+vec2(i,j)/4096.).r;sha+=sp.z-.0006<dep?1.:0.;}sha/=9.;}
 vec3 hemi=mix(pow(vec3(.21,.20,.13),vec3(2.2)),pow(vec3(.77,.85,.91),vec3(2.2)),n.y*.5+.5)*1.25;vec3 c=albedo*(hemi*.31831+pow(vec3(1.,.945,.77),vec3(2.2))*3.35*.31831*ndl*sha);if(leaf==1)c+=albedo*.13;
 float dist=length(camera-vWorld),fog=1.-exp(-.0048*.0048*dist*dist);c=mix(c,pow(vec3(.514,.612,.596),vec3(2.2)),fog);frag=vec4(c,1.);}
'''
programs={}
for shader in Path('artifacts/shader-check').glob('*.vert'):
 programs[shader.stem]=ctx.program(vertex_shader=shader.read_text(),fragment_shader=shader.with_suffix('.frag').read_text().replace('return dot( v, UnpackFactors4 );','return v.r;'))
def material_program(m,compact=False):
 if compact:return programs['grass_compact']
 k=m.get('cacheKey','')
 if 'forest-tree-attached' in k:return programs['attached']
 for name in ['grass','fern','leaf','shrub']:
  if 'forest-wind-'+name in k:return programs[name]
 for name in ['oak','beech','birch']:
  if 'forest-tree-bark-'+name in k:return programs[name]
 if 'forest-log' in k:return programs['log']
 if 'forest-moss' in k:return programs['rock']
 if m.get('map','')=='/textures/ground-color.jpg':return programs['ground']
 if m.get('map','')=='/textures/bark-color.jpg':return programs['bark']
 if m.get('map','')=='/textures/endgrain.jpg':return programs['endgrain']
 return programs['vertex' if m['vertexColors'] else 'plain']
def setu(p,k,v):
 if k in p:p[k].value=v
shadowProg=ctx.program(vertex_shader='''#version 330
in vec3 in_pos;in vec4 i0;in vec4 i1;in vec4 i2;in vec4 i3;uniform mat4 projection;uniform mat4 view;uniform mat4 model;void main(){gl_Position=projection*view*model*mat4(i0,i1,i2,i3)*vec4(in_pos,1);}''',fragment_shader='''#version 330
void main(){}''')

def matrix(a):return np.array(a,dtype='f4').reshape(4,4).T.copy()
def write(p,k,a):p[k].write(np.asarray(a,dtype='f4').T.tobytes())
def look(eye,target):
 e=np.array(eye,dtype=float);f=np.array(target)-e;f/=np.linalg.norm(f);s=np.cross(f,[0,1,0]);s/=np.linalg.norm(s);u=np.cross(s,f);m=np.eye(4);m[:3,:3]=[s,u,-f];m[:3,3]=-m[:3,:3]@e;return m
geos={};textures={};white=ctx.texture((1,1),3,b'\xff\xff\xff');normalDefault=ctx.texture((1,1),3,b'\x80\x80\xff')
for k,g in S['geometries'].items():
 a=g['attributes'];p=np.fromfile(D/a['position']['file'],dtype='f4').reshape(-1,3);n=np.fromfile(D/a['normal']['file'],dtype='f4').reshape(-1,3);uv=np.fromfile(D/a['uv']['file'],dtype='f4').reshape(-1,2) if 'uv' in a else np.zeros((len(p),2));c=np.fromfile(D/a['color']['file'],dtype='f4').reshape(-1,3) if 'color' in a else np.ones_like(p)
 vb=ctx.buffer(np.concatenate([p,n,uv,c],axis=1).astype('f4').tobytes());ind=np.fromfile(D/g['index']['file'],dtype='u4') if g['index'] else np.arange(len(p),dtype='u4');ib=ctx.buffer(ind.tobytes());geos[k]=(vb,ib)
for k,m in S['materials'].items():
 for kind in ['map','normalMap']:
  url=m.get(kind)
  if url and url not in textures:
   im=Image.open('public'+url).convert('RGB').transpose(Image.Transpose.FLIP_TOP_BOTTOM);t=ctx.texture(im.size,3,im.tobytes(),internal_format=0x8C41 if kind=='map' else 0x8051);t.build_mipmaps();t.repeat_x=t.repeat_y=True;t.anisotropy=8;textures[url]=t
depthPrograms={}
for source in Path('artifacts/shader-depth').glob('*.vert'):
 depthPrograms[source.stem]=ctx.program(vertex_shader=source.read_text(),fragment_shader=source.with_suffix('.frag').read_text())
objects=[]
for o in S['objects']:
 vb,ib=geos[o['geometry']]
 if o.get('compact'):
  data=o['compactData'];arr=np.empty((data['count'],0),dtype='f4');inst=None;cb=None
  root=ctx.buffer((D/data['placement']).read_bytes());scale=ctx.buffer((D/data['scale']).read_bytes());rank=ctx.buffer((D/data['rank']).read_bytes())
  attrs=[(root,'4f /i','forestPlacement'),(scale,'3f /i','forestScale'),(rank,'1f /i','forestRank')]
 else:
  arr=np.fromfile(D/o['instances']['file'],dtype='f4').reshape(-1,16) if o.get('instances') else np.eye(4,dtype='f4').reshape(1,16)
  if not len(arr):continue
  inst=ctx.buffer(arr.tobytes());icolor=np.fromfile(D/o['colors']['file'],dtype='f4') if o.get('colors') else np.ones(len(arr)*3,dtype='f4');cb=ctx.buffer(icolor.tobytes())
  attrs=[(inst,'16f /i','instanceMatrix'),(cb,'3f /i','instanceColor')]
 m=S['materials'][o['material']];prog=material_program(m,o.get('compact',False));o['program']=prog
 key=m.get('cacheKey','');kind='wood' if 'forest-tree-bark-' in key or 'forest-tree-attached' in key else next((k for k in depthPrograms if 'forest-wind-'+k in key),None)
 sp=depthPrograms[kind] if kind else shadowProg;o['shadowProgram']=sp
 def create_vao(gid):
  lb,li=geos[gid];return ctx.vertex_array(prog,[(lb,'3f 3f 2f 3f','position','normal','uv','color'),*attrs],li,skip_errors=True)
 def create_shadow(gid):
  if o.get('compact'):return None
  lb,li=geos[gid]
  return ctx.vertex_array(sp,[(lb,'3f 3f 2f 12x','position','normal','uv'),(inst,'16f /i','instanceMatrix')],li,skip_errors=True) if kind else ctx.vertex_array(sp,[(lb,'3f 32x','in_pos'),(inst,'4f 4f 4f 4f /i','i0','i1','i2','i3')],li)
 o['colorBuffer']=cb;o['vaos']={};o['shadowVaos']={}
 for gid in dict.fromkeys([o['geometry'],*o.get('lods',[])]):o['vaos'][gid]=create_vao(gid);o['shadowVaos'][gid]=create_shadow(gid)
 objects.append((o,o['vaos'][o['geometry']],o['shadowVaos'][o['geometry']],inst,arr))
color=ctx.texture((W,H),4,dtype='f2');depth=ctx.depth_texture((W,H));fbo=ctx.framebuffer([color],depth);sdepth=ctx.depth_texture((4096,4096));sdepth.compare_func='';sfbo=ctx.framebuffer(depth_attachment=sdepth)
mscolor=ctx.renderbuffer((W,H),4,samples=4,dtype='f2');msdepth=ctx.depth_renderbuffer((W,H),samples=4);msfbo=ctx.framebuffer([mscolor],msdepth)
sproj=np.eye(4);sproj[0,0]=sproj[1,1]=1/SHADOW_HALF;sproj[2,2]=-2/(SHADOW_FAR-SHADOW_NEAR);sproj[2,3]=-(SHADOW_FAR+SHADOW_NEAR)/(SHADOW_FAR-SHADOW_NEAR)
sview=look(SUN+np.array([0,0,-3]),[0,0,-3]);bias=np.array([[.5,0,0,.5],[0,.5,0,.5],[0,0,.5,.5],[0,0,0,1]])
ctx.enable(moderngl.DEPTH_TEST);ctx.disable(moderngl.CULL_FACE)
for p in programs.values():
 setu(p,'map',0);setu(p,'normalMap',1);setu(p,'directionalShadowMap',2)
 # Three's packed-depth shader receives a depth texture converted in the shadow pass.
 if 'directionalShadowMatrix' in p:write(p,'directionalShadowMatrix',bias@sproj@sview)
 setu(p,'directionalLights[0].color',tuple(S['lighting']['sun']))
 setu(p,'hemisphereLights[0].skyColor',tuple(S['lighting']['hemisphereSky']));setu(p,'hemisphereLights[0].groundColor',tuple(S['lighting']['hemisphereGround']))
 setu(p,'ambientLightColor',(0.,0.,0.));setu(p,'opacity',1.);setu(p,'metalness',0.);setu(p,'emissive',(0.,0.,0.));setu(p,'fogColor',tuple(S['lighting']['fog']));setu(p,'fogDensity',S['lighting']['fogDensity']);setu(p,'receiveShadow',True);setu(p,'isOrthographic',False);setu(p,'uForestTime',0.);setu(p,'uForestWind',1.);setu(p,'uForestQuality',1.);setu(p,'directionalLightShadows[0].shadowMapSize',(4096.,4096.));setu(p,'directionalLightShadows[0].shadowBias',-.00012);setu(p,'directionalLightShadows[0].shadowNormalBias',.025);setu(p,'directionalLightShadows[0].shadowRadius',1.);setu(p,'directionalLightShadows[0].shadowIntensity',1.)

# Compile the production volume shader, replacing only packed WebGL shadow
# depth with the native OpenGL raw depth texture representation.
vsrc=Path('artifacts/qa-modules/volume.frag').read_text().replace('#include <packing>','float unpackRGBAToDepth(vec4 v){return v.r;}').replace('varying vec2 vUv;','in vec2 vUv;out vec4 frag;').replace('texture2D','texture').replace('gl_FragColor','frag')
fullv='#version 330\nin vec2 p;out vec2 vUv;void main(){vUv=p*.5+.5;gl_Position=vec4(p,0,1);}'
vp=ctx.program(vertex_shader=fullv,fragment_shader='#version 330\n'+vsrc)
quad=ctx.buffer(np.array([-1,-1,3,-1,-1,3],dtype='f4').tobytes());vvao=ctx.vertex_array(vp,[(quad,'2f','p')]);vtex=ctx.texture((W//2,H//2),4,dtype='f2');vtex.filter=(moderngl.LINEAR,moderngl.LINEAR);vfbo=ctx.framebuffer([vtex]);
vp['tDepth']=0;vp['tShadow']=2;vp['sunDirection']=tuple(SUN/np.linalg.norm(SUN));vp['time']=0.;vp['strength']=S['lighting']['volumeStrength'];write(vp,'sunMatrix',bias@sproj@sview)
cp=ctx.program(vertex_shader=fullv,fragment_shader=Path('artifacts/qa-modules/composite-native.frag').read_text())
cp['toneMappingExposure']=S['lighting']['exposure']
osrc=Path('artifacts/qa-modules/occlusion.frag').read_text().replace('varying vec2 vUv;','in vec2 vUv;out vec4 frag;').replace('texture2D','texture').replace('gl_FragColor','frag')
op=ctx.program(vertex_shader=fullv,fragment_shader='#version 330\n'+osrc);ovao=ctx.vertex_array(op,[(quad,'2f','p')]);otex=ctx.texture((W//2,H//2),4,dtype='f1');otex.filter=(moderngl.NEAREST,moderngl.NEAREST);ofbo=ctx.framebuffer([otex]);op['tDepth']=0;op['radius']=.85;op['resolution']=(W,H)
cvao=ctx.vertex_array(cp,[(quad,'2f','p')]);final=ctx.simple_framebuffer((W,H),components=4);cp['tScene']=0;cp['tVolume']=1;cp['tOcclusion']=2;cp['tDepth']=3;cp['texel']=(1/W,1/H);cp['volumeTexel']=(1/(W//2),1/(H//2))
skyVertex="#version 330\nin vec2 p;out vec3 vDir;uniform mat4 invProjection;uniform mat4 cameraWorld;void main(){vec4 v=invProjection*vec4(p,1.,1.);vDir=(cameraWorld*vec4(v.xyz/v.w,0.)).xyz;gl_Position=vec4(p,1.,1.);}"
skyFragment=S['sky']['fragmentShader'].replace('varying vec3 vDir;','in vec3 vDir;out vec4 frag;').replace('gl_FragColor','frag').replace('#include <tonemapping_fragment>','').replace('#include <colorspace_fragment>','')
skyProgram=ctx.program(vertex_shader=skyVertex,fragment_shader='#version 330\n'+skyFragment);skyVao=ctx.vertex_array(skyProgram,[(quad,'2f','p')]);skyProgram['top']=tuple(S['sky']['top']);skyProgram['bottom']=tuple(S['sky']['bottom']);skyProgram['sun']=tuple(S['sky']['sun'])
particleProgram=None
if S.get('particles'):
 particleProgram=ctx.program(vertex_shader=Path('artifacts/shader-extra/particles.vert').read_text().replace('return dot( v, UnpackFactors4 );','return v.r;'),fragment_shader=Path('artifacts/shader-extra/particles.frag').read_text())
 particleData=np.concatenate([np.asarray(S['particles']['position'],dtype='f4').reshape(-1,3),np.asarray(S['particles']['seed'],dtype='f4').reshape(-1,1)],axis=1)
 particleBuffer=ctx.buffer(particleData.tobytes());particleVao=ctx.vertex_array(particleProgram,[(particleBuffer,'3f 1f','position','seed')]);setu(particleProgram,'tShadow',2);setu(particleProgram,'hasShadow',True)
 ctx.enable(moderngl.PROGRAM_POINT_SIZE)
views=list(S['views']) if '--all' in sys.argv else [a for a in sys.argv[1:] if not a.startswith('--')] or ['entrance']
if os.environ.get('FOREST_CAPTURE_START'):views=views[int(os.environ['FOREST_CAPTURE_START']):]
if os.environ.get('FOREST_CAPTURE_LIMIT'):views=views[:int(os.environ['FOREST_CAPTURE_LIMIT'])]
shadow_center=None;shadow_time=-10
for name in views:
 start=time.time();v=S['views'][name]
 time_value=v.get('time',0)
 for p in programs.values():setu(p,'uForestTime',time_value)
 vp['time']=time_value
 # Match the production ten-metre shadow-window recenter and eight-Hz wind update.
 sx,sy,sz=v['position'];new_window=shadow_center is None or np.linalg.norm(np.array([sx,sz])-shadow_center)>10 or not v.get('motion')
 if new_window:
  shadow_center=np.array([sx,sz]);target=np.array([sx,0,sz-3],dtype=float);direction=SUN;right=np.cross([0,1,0],direction);right=right/np.linalg.norm(right);up=np.cross(direction,right);up=up/np.linalg.norm(up);texel=2*SHADOW_HALF/4096
  target+=(round(np.dot(target,right)/texel)*texel-np.dot(target,right))*right+(round(np.dot(target,up)/texel)*texel-np.dot(target,up))*up
  sview=look(target+direction,target)
 if new_window or time_value-shadow_time>=.125:
  shadow_time=time_value
  sfbo.use();sfbo.clear(depth=1);ctx.viewport=(0,0,4096,4096);write(shadowProg,'projection',sproj);write(shadowProg,'view',sview)
  for sp in depthPrograms.values():write(sp,'projectionMatrix',sproj);setu(sp,'uForestTime',time_value);setu(sp,'uForestWind',1.)
  for o,vao,sv,inst,arr in objects:
   record=v['shadowDraws'].get(o['id'])
   if not record:continue
   if record.get('instances'):inst.write((D/record['instances']).read_bytes());o['colorBuffer'].write((D/record['colors']).read_bytes()) if record.get('colors') else None
   sp=o['shadowProgram'];model=matrix(o['matrix'])
   if sp is shadowProg:write(sp,'model',model)
   else:
    if 'modelMatrix' in sp:write(sp,'modelMatrix',model)
    write(sp,'modelViewMatrix',sview@model)
   o['shadowVaos'][record['geometry']].render(instances=record['count'])
 write(vp,'sunMatrix',bias@sproj@sview)
 for p in programs.values():
  if 'directionalShadowMatrix' in p:write(p,'directionalShadowMatrix',bias@sproj@sview)
 msfbo.use();msfbo.clear(.33,.42,.43,1,depth=1);ctx.viewport=(0,0,W,H);view=matrix(v['view']);
 ctx.disable(moderngl.DEPTH_TEST);write(skyProgram,'invProjection',np.linalg.inv(matrix(v['projection'])));write(skyProgram,'cameraWorld',np.linalg.inv(view));skyVao.render();ctx.enable(moderngl.DEPTH_TEST)
 for p in programs.values():
  write(p,'projectionMatrix',matrix(v['projection']));write(p,'viewMatrix',view);setu(p,'cameraPosition',tuple(v['position']));setu(p,'directionalLights[0].direction',tuple(view[:3,:3]@(SUN/np.linalg.norm(SUN))));setu(p,'hemisphereLights[0].direction',tuple(view[:3,:3]@np.array([0,1,0.])))
 for o,vao,sv,inst,arr in objects:
  record=v['draws'].get(o['id'])
  if not record:continue
  if record.get('instances'):inst.write((D/record['instances']).read_bytes());o['colorBuffer'].write((D/record['colors']).read_bytes()) if record.get('colors') else None
  count=record['count'];vao=o['vaos'][record['geometry']]
  m=S['materials'][o['material']];prog=o['program'];model=matrix(o['matrix']);mv=view@model;write(prog,'modelMatrix',model);write(prog,'modelViewMatrix',mv);write(prog,'normalMatrix',np.linalg.inv(mv[:3,:3]).T);setu(prog,'diffuse',tuple(m['color'] or [1,1,1]));setu(prog,'roughness',m['roughness'] or .9);setu(prog,'normalScale',tuple(m.get('normalScale') or [.65,.65]));rep=m.get('repeat') or [1,1];uvm=np.array([[rep[0],0,0],[0,rep[1],0],[0,0,1]],dtype='f4')
  for uk in ['mapTransform','normalMapTransform']:
   if uk in prog:write(prog,uk,uvm)
  textures.get(m.get('map'),white).use(0);textures.get(m.get('normalMap'),normalDefault).use(1);sdepth.use(2);vao.render(instances=count)

 if particleProgram:
  setu(particleProgram,'time',time_value);setu(particleProgram,'eye',tuple(v['position']));write(particleProgram,'modelViewMatrix',view);write(particleProgram,'projectionMatrix',matrix(v['projection']));write(particleProgram,'sunMatrix',bias@sproj@sview);sdepth.use(2)
  ctx.enable(moderngl.BLEND);ctx.blend_func=(moderngl.SRC_ALPHA,moderngl.ONE);msfbo.depth_mask=False;particleVao.render(mode=moderngl.POINTS);msfbo.depth_mask=True;ctx.disable(moderngl.BLEND)
 ctx.copy_framebuffer(fbo,msfbo);ctx.disable(moderngl.DEPTH_TEST);ofbo.use();ctx.viewport=(0,0,W//2,H//2);depth.compare_func='';depth.use(0);write(op,'invProjection',np.linalg.inv(matrix(v['projection'])));write(op,'projection',matrix(v['projection']));ovao.render();vfbo.use();ctx.viewport=(0,0,W//2,H//2);depth.compare_func='';depth.use(0);sdepth.use(2);write(vp,'invProjection',np.linalg.inv(matrix(v['projection'])));write(vp,'cameraWorld',np.linalg.inv(matrix(v['view'])));vp['eye']=tuple(v['position']);vvao.render();final.use();ctx.viewport=(0,0,W,H);color.use(0);vtex.use(1);otex.use(2);depth.use(3);write(cp,'invProjection',np.linalg.inv(matrix(v['projection'])));write(cp,'cameraWorld',np.linalg.inv(matrix(v['view']))) if 'cameraWorld' in cp else None;cvao.render();ctx.enable(moderngl.DEPTH_TEST);ctx.finish();im=Image.frombytes('RGBA',(W,H),final.read(components=4)).transpose(Image.Transpose.FLIP_TOP_BOTTOM);out=Path(os.environ.get('FOREST_QA_OUTPUT','artifacts/motion-frames' if v.get('motion') else 'artifacts/material-views'));out.mkdir(exist_ok=True);im.save(out/(name+'.png'));print(name,round(time.time()-start,2),'seconds',flush=True)
