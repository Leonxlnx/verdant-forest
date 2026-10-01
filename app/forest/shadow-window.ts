import * as THREE from 'three';
import {FOREST_LIGHTING} from './config';
const direction=new THREE.Vector3(...FOREST_LIGHTING.sunDirection);
const right=new THREE.Vector3().crossVectors(new THREE.Vector3(0,1,0),direction).normalize();
const up=new THREE.Vector3().crossVectors(direction,right).normalize();
/** Keep the sun's texel grid fixed in world space when its window follows
 * exploration, avoiding a shift in every fine branch shadow at each recenter. */
export function placeShadowWindow(sun:THREE.DirectionalLight,position:THREE.Vector3){
 const target=new THREE.Vector3(position.x,0,position.z-3),texel=(sun.shadow.camera.right-sun.shadow.camera.left)/sun.shadow.mapSize.x;
 const x=target.dot(right),y=target.dot(up);
 target.addScaledVector(right,Math.round(x/texel)*texel-x).addScaledVector(up,Math.round(y/texel)*texel-y);
 sun.target.position.copy(target);sun.position.copy(target).add(direction);
}
