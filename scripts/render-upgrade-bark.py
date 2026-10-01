"""Render actual material shader hooks on an isolated cylinder for bark review.
These are material review renders, not browser screenshots or the forest itself.
Source /workspace/daybreak-render-runtime/env.sh first in this session.
"""
import json,os,sys
from pathlib import Path
import numpy as np
from PIL import Image,ImageDraw
import moderngl
D=Path('artifacts/upgrade-bark');M=json.loads((D/'manifest.json').read_text())
ctx=moderngl.create_standalone_context(backend='egl',require=330)
W,H=640,960
root_mode='--roots' in sys.argv
suffix='-roots' if root_mode else ''
fbo=ctx.simple_framebuffer((W,H),components=4);fbo.use();ctx.enable(moderngl.DEPTH_TEST)
vb=ctx.buffer((D/'cylinder.bin').read_bytes());ib=ctx.buffer((D/'indices.bin').read_bytes())
for index,url in enumerate(['bark-color.jpg','bark-normal.jpg']):
 im=Image.open('public/textures/'+url).convert('RGB').transpose(Image.Transpose.FLIP_TOP_BOTTOM)
 t=ctx.texture(im.size,3,im.tobytes(),internal_format=0x8C41 if index==0 else 0x8051);t.build_mipmaps();t.repeat_x=t.repeat_y=True;t.anisotropy=8;t.use(index)
def look(eye,target):
 e=np.array(eye,dtype=float);f=np.array(target)-e;f/=np.linalg.norm(f);s=np.cross(f,[0,1,0]);s/=np.linalg.norm(s);u=np.cross(s,f);m=np.eye(4);m[:3,:3]=[s,u,-f];m[:3,3]=-m[:3,:3]@e;return m
def uniform(p,k,v):
 if k in p:p[k].value=v
def matrix(p,k,v):
 if k in p:p[k].write(np.asarray(v,dtype='f4').T.tobytes())
images=[]
for name,offset,label in [('before',0,'Before: fixed rows'),('after',0,'After: continuous bark fields'),('after',22,'After: a different tree'),('oak',0,'Oak retained'),('beech',0,'Beech retained')]:
 p=ctx.program(vertex_shader=(D/f'{name}.vert').read_text(),fragment_shader=(D/f'{name}.frag').read_text());vao=ctx.vertex_array(p,[(vb,'3f 3f 2f','position','normal','uv')],ib,skip_errors=True)
 m=M['cases'][name];model=np.eye(4);model[0,3]=offset;eye=[offset+.48,1.4,2.9] if root_mode else [offset+.48,2.85,1.64];target=[offset,1.5,0] if root_mode else [offset,2.55,0];view=look(eye,target);mv=view@model
 f=1/np.tan(np.radians(49)/2);n,far=.01,100;projection=np.array([[f/(W/H),0,0,0],[0,f,0,0],[0,0,(far+n)/(n-far),2*far*n/(n-far)],[0,0,-1,0]])
 matrix(p,'modelMatrix',model);matrix(p,'modelViewMatrix',mv);matrix(p,'projectionMatrix',projection);matrix(p,'viewMatrix',view);matrix(p,'normalMatrix',np.linalg.inv(mv[:3,:3]).T)
 uv=np.diag([3.,6./1.8,1.]);matrix(p,'mapTransform',uv);matrix(p,'normalMapTransform',uv)
 uniform(p,'map',0);uniform(p,'normalMap',1);uniform(p,'diffuse',tuple(m['color']));uniform(p,'normalScale',tuple(m['normalScale']));uniform(p,'opacity',1.);uniform(p,'roughness',m['roughness']);uniform(p,'metalness',0.);uniform(p,'emissive',(0.,0.,0.));uniform(p,'cameraPosition',tuple(eye));uniform(p,'isOrthographic',False);uniform(p,'uForestTime',0.);uniform(p,'uForestWind',0.)
 sun=np.array([-2.,3.,4.]);sun/=np.linalg.norm(sun);uniform(p,'directionalLights[0].direction',tuple(view[:3,:3]@sun));uniform(p,'directionalLights[0].color',(2.85,2.54,2.17));uniform(p,'hemisphereLights[0].direction',tuple(view[:3,:3]@np.array([0.,1.,0.])));uniform(p,'hemisphereLights[0].skyColor',(.62,.71,.78));uniform(p,'hemisphereLights[0].groundColor',(.14,.16,.11));uniform(p,'ambientLightColor',(0.,0.,0.))
 fbo.clear(.12,.145,.13,1.,depth=1);vao.render();ctx.finish();im=Image.frombytes('RGBA',(W,H),fbo.read(components=4)).transpose(Image.Transpose.FLIP_TOP_BOTTOM).convert('RGB');ImageDraw.Draw(im).text((18,18),label,fill='white');out=D/f'{name}-{offset}{suffix}.jpg';im.save(out,quality=94);images.append(im);print(out,flush=True)
sheet=Image.new('RGB',(W*3,H));
for i,im in enumerate(images[:3]):sheet.paste(im,(i*W,0))
sheet.save(D/f'comparison{suffix}.jpg',quality=94)
print('native bark material review rendered with '+ctx.info['GL_RENDERER'])
