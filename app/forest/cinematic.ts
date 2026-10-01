import * as THREE from 'three';
import {heightAt} from './math';

type Point = [number,number,number];
type Shot = {name:string; duration:number; from:Point; to:Point; lookFrom:Point; lookTo:Point; fov:number};
// Heights are relative to the exact terrain triangles, shared by native export
// and the browser. Slow dollies preserve depth and avoid artificial camera shake.
export const FOREST_FILM_SHOTS:Shot[] = [
 {name:'woodland-trail',duration:8,from:[5.6,1.35,19],to:[4.7,1.65,13.5],lookFrom:[3.9,1.15,9.2],lookTo:[2.3,1.7,1.2],fov:54},
 {name:'flowers-and-ferns',duration:6,from:[7.8,1.12,14.1],to:[7.15,1.3,12.5],lookFrom:[6.5,.58,11.1],lookTo:[5.3,.76,8.7],fov:53},
 {name:'sunlit-grove',duration:6,from:[12,2.45,-12],to:[10.2,2.65,-14.3],lookFrom:[-5,4.8,-31],lookTo:[-6,5.2,-33],fov:53},
 {name:'moss-and-deadwood',duration:5,from:[10.4,1.35,-10.5],to:[9.15,1.55,-10.0],lookFrom:[5.9,.64,-7.2],lookTo:[5.5,.72,-7.0],fov:51},
 {name:'canopy-reveal',duration:5,from:[-15,24,25],to:[-11.5,27.2,18.5],lookFrom:[0,12,-8],lookTo:[-3,13,-19],fov:58},
];
export const FOREST_FILM_DURATION=FOREST_FILM_SHOTS.reduce((sum,shot)=>sum+shot.duration,0);
const eye=new THREE.Vector3(),target=new THREE.Vector3();
export function cinematicView(time:number,shotIndex?:number){
 const seconds=THREE.MathUtils.clamp(time,0,FOREST_FILM_DURATION-1e-6);
 let index=0,offset=0;
 while(index<FOREST_FILM_SHOTS.length-1 && seconds>=offset+FOREST_FILM_SHOTS[index].duration){offset+=FOREST_FILM_SHOTS[index++].duration;}
 if(shotIndex!==undefined){index=THREE.MathUtils.clamp(Math.floor(shotIndex),0,FOREST_FILM_SHOTS.length-1);offset=0;}
 const shot=FOREST_FILM_SHOTS[index],t=THREE.MathUtils.clamp((seconds-offset)/shot.duration,0,1);
 // Gentle acceleration with a substantial constant-speed middle.
 const u=t*t*(3-2*t);
 eye.fromArray(shot.from).lerp(new THREE.Vector3(...shot.to),u);
 target.fromArray(shot.lookFrom).lerp(new THREE.Vector3(...shot.lookTo),u);
 eye.y+=heightAt(eye.x,eye.z);target.y+=heightAt(target.x,target.z);
 return {name:shot.name,index,position:eye.toArray() as Point,target:target.toArray() as Point,fov:shot.fov,time:seconds};
}
export function applyCinematicCamera(camera:THREE.PerspectiveCamera,time:number,shotIndex?:number){
 const view=cinematicView(time,shotIndex);camera.position.fromArray(view.position);camera.lookAt(...view.target);
 if(camera.fov!==view.fov){camera.fov=view.fov;camera.updateProjectionMatrix();}
 camera.updateMatrixWorld();return view;
}
