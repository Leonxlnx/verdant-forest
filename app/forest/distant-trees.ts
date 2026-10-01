import * as THREE from 'three';

export type FarTreeCell = {
  center: THREE.Vector3;
  /** Pass tree cells only. Mesh[] also accepts the existing vegetation Cell type. */
  meshes: readonly THREE.Mesh[];
};
export type FarTreePoolOptions = {
  poolSize?: 60 | 80 | 160;
  nearDistance?: number;
  farDistance?: number;
  /** Fourth geometry tier is reserved for the distant landscape silhouette. */
  lodLevel?: 2 | 3;
  /** Extra world-unit margin for shader displacement, beyond exact static bounds. */
  boundsPadding?: number;
};
type Chunk = { cell: number; offset: number; count: number; bounds: THREE.Box3 };
export type FarTreePool = {
  mesh: THREE.InstancedMesh;
  /** Immutable source snapshot; matrices remain in the original coordinate space. */
  sourceMatrices: Float32Array;
  sourceColors: Float32Array | null;
  sourceCount: number;
  /** Conservative bound of every source instance, including inactive cells. */
  bounds: THREE.Box3;
  chunks: readonly Chunk[];
};
export type FarTreeUpdate = {
  visiblePools: number;
  activeInstances: number;
  changedPools: number;
  copiedInstances: number;
};

/**
 * Snapshot static, identity-transform tree meshes before their counts are changed.
 * Add the returned identity Group in the same coordinate space as the source
 * meshes and cell centers. Camera positions use that same space (world space in
 * the current forest). Source geometry/material objects are shared, never cloned
 * or disposed. Source visibility and matrices are never mutated.
 */
export function createFarTreePools(cells: readonly FarTreeCell[], options: FarTreePoolOptions = {}) {
  const poolSize = options.poolSize ?? 80;
  const nearDistance = options.nearDistance ?? 108;
  const farDistance = options.farDistance ?? 250;
  const padding = options.boundsPadding ?? 0;
  if ((poolSize !== 60 && poolSize !== 80 && poolSize !== 160) || !Number.isFinite(nearDistance)
    || !Number.isFinite(farDistance) || nearDistance < 0 || farDistance <= nearDistance
    || !Number.isFinite(padding) || padding < 0) throw new Error('Invalid far-tree pool options');
  const group = new THREE.Group();
  group.name = 'far-tree-pools';
  const centers = cells.map(cell => {
    if (![cell.center.x, cell.center.y, cell.center.z].every(Number.isFinite)) throw new Error('Non-finite tree cell center');
    return cell.center.clone();
  });
  const identity = new THREE.Matrix4();
  const materialIds = new Map<THREE.Material | THREE.Material[], number>();
  const seenMeshes = new Set<THREE.InstancedMesh>();
  type Source = { cell: number; mesh: THREE.InstancedMesh; count: number };
  type Pending = { geometry: THREE.BufferGeometry; material: THREE.Material | THREE.Material[]; sources: Source[]; layers: number; renderOrder: number };
  const pending = new Map<string, Pending>();
  for (let cell = 0; cell < cells.length; cell++) {
    const center = centers[cell];
    const tile = `${Math.floor(center.x / poolSize)},${Math.floor(center.z / poolSize)}`;
    for (const source of cells[cell].meshes) {
      if (!(source instanceof THREE.InstancedMesh)) throw new Error('Far-tree input must contain InstancedMesh objects');
      if (seenMeshes.has(source)) throw new Error('A source tree mesh occurs in more than one cell');
      seenMeshes.add(source);
      const sourceTransform = source.matrixAutoUpdate ? new THREE.Matrix4().compose(source.position, source.quaternion, source.scale) : source.matrix;
      if (!sourceTransform.equals(identity)) throw new Error('Far-tree source meshes must have identity local transforms');
      const geometry = source.userData.lods?.[options.lodLevel ?? 2];
      if (!(geometry instanceof THREE.BufferGeometry)) throw new Error('A source tree mesh is missing low LOD geometry');
      if (!(source.instanceMatrix.array instanceof Float32Array)) throw new Error('Tree matrices must use Float32 storage');
      if (!Number.isInteger(source.count) || source.count < 0 || source.count > source.instanceMatrix.count) throw new Error('Invalid source instance count');
      if (source.count === 0) continue;
      if (!materialIds.has(source.material)) materialIds.set(source.material, materialIds.size);
      const key = `${tile}|${geometry.id}|${materialIds.get(source.material)}|${source.layers.mask}|${source.renderOrder}`;
      let item = pending.get(key);
      if (!item) {
        item = { geometry, material: source.material, sources: [], layers: source.layers.mask, renderOrder: source.renderOrder };
        pending.set(key, item);
      }
      item.sources.push({ cell, mesh: source, count: source.count });
    }
  }
  const pools: FarTreePool[] = [];
  const cellPools = cells.map(() => new Set<number>());
  const matrix = new THREE.Matrix4();
  const box = new THREE.Box3();
  for (const item of pending.values()) {
    const sourceCount = item.sources.reduce((sum, source) => sum + source.count, 0);
    const sourceMatrices = new Float32Array(sourceCount * 16);
    const hasColors = item.sources.some(source => source.mesh.instanceColor !== null);
    const sourceColors = hasColors ? new Float32Array(sourceCount * 3).fill(1) : null;
    const chunks: Chunk[] = [];
    // Compute on a clone if needed, avoiding mutation of the shared geometry.
    const geometryBounds = item.geometry.boundingBox?.clone() ?? new THREE.Box3().setFromBufferAttribute(item.geometry.getAttribute('position') as THREE.BufferAttribute);
    if (geometryBounds.isEmpty() || ![...geometryBounds.min.toArray(), ...geometryBounds.max.toArray()].every(Number.isFinite)) throw new Error('Low tree geometry has invalid bounds');
    let offset = 0;
    const fullBounds = new THREE.Box3();
    for (const source of item.sources) {
      const values = source.mesh.instanceMatrix.array as Float32Array;
      const snapshot = values.subarray(0, source.count * 16);
      if (!snapshot.every(Number.isFinite)) throw new Error('Non-finite source tree matrix');
      sourceMatrices.set(snapshot, offset * 16);
      if (sourceColors && source.mesh.instanceColor) {
        const colors = source.mesh.instanceColor;
        if (colors.count < source.count) throw new Error('Source tree colors are shorter than its instance count');
        for (let i = 0; i < source.count; i++) {
          sourceColors[(offset + i) * 3] = colors.getX(i);
          sourceColors[(offset + i) * 3 + 1] = colors.getY(i);
          sourceColors[(offset + i) * 3 + 2] = colors.getZ(i);
        }
      }
      const bounds = new THREE.Box3();
      for (let i = 0; i < source.count; i++) {
        matrix.fromArray(sourceMatrices, (offset + i) * 16);
        bounds.union(box.copy(geometryBounds).applyMatrix4(matrix));
      }
      if (padding) bounds.expandByScalar(padding);
      fullBounds.union(bounds);
      chunks.push({ cell: source.cell, offset, count: source.count, bounds });
      cellPools[source.cell].add(pools.length);
      offset += source.count;
    }
    const mesh = new THREE.InstancedMesh(item.geometry, item.material, sourceCount);
    mesh.name = `far-tree-pool-${pools.length}`;
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    if (sourceColors) mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(sourceCount * 3), 3).setUsage(THREE.DynamicDrawUsage);
    mesh.count = 0;
    mesh.visible = false;
    mesh.castShadow = false;
    mesh.receiveShadow = true;
    mesh.layers.mask = item.layers;
    mesh.renderOrder = item.renderOrder;
    mesh.userData.kind = 'tree';
    mesh.userData.dynamicInstances = true;
    mesh.userData.farPool = true;
    mesh.userData.lodLevel = options.lodLevel ?? 2;
    mesh.boundingBox = new THREE.Box3();
    mesh.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 0);
    group.add(mesh);
    pools.push({ mesh, sourceMatrices, sourceColors, sourceCount, bounds: fullBounds, chunks });
  }
  const selected = new Uint8Array(cells.length).fill(255);
  const dirty = new Uint8Array(pools.length);
  const eye = new THREE.Vector3();
  const nearSquared = nearDistance * nearDistance;
  const farSquared = farDistance * farDistance;
  let visiblePools = 0;
  let activeInstances = 0;
  let disposed = false;
  function update(camera: THREE.Camera | THREE.Vector3): FarTreeUpdate {
    if (disposed) throw new Error('Far-tree pools have been disposed');
    if (camera instanceof THREE.Vector3) eye.copy(camera);
    else camera.getWorldPosition(eye);
    if (!Number.isFinite(eye.x) || !Number.isFinite(eye.z)) throw new Error('Non-finite camera position');
    dirty.fill(0);
    for (let i = 0; i < centers.length; i++) {
      const dx = eye.x - centers[i].x, dz = eye.z - centers[i].z;
      const distanceSquared = dx * dx + dz * dz;
      const include = distanceSquared >= nearSquared && distanceSquared < farSquared ? 1 : 0;
      if (include === selected[i]) continue;
      selected[i] = include;
      for (const index of cellPools[i]) dirty[index] = 1;
    }
    let changedPools = 0, copiedInstances = 0;
    for (let index = 0; index < pools.length; index++) {
      if (!dirty[index]) continue;
      changedPools++;
      const pool = pools[index], mesh = pool.mesh;
      activeInstances -= mesh.count;
      if (mesh.visible) visiblePools--;
      let count = 0;
      mesh.boundingBox!.makeEmpty();
      for (const chunk of pool.chunks) {
        if (!selected[chunk.cell]) continue;
        (mesh.instanceMatrix.array as Float32Array).set(pool.sourceMatrices.subarray(chunk.offset * 16, (chunk.offset + chunk.count) * 16), count * 16);
        if (pool.sourceColors) (mesh.instanceColor!.array as Float32Array).set(pool.sourceColors.subarray(chunk.offset * 3, (chunk.offset + chunk.count) * 3), count * 3);
        mesh.boundingBox!.union(chunk.bounds);
        count += chunk.count;
      }
      mesh.count = count;
      mesh.visible = count > 0;
      if (count) {
        mesh.boundingBox!.getBoundingSphere(mesh.boundingSphere!);
        mesh.instanceMatrix.clearUpdateRanges();
        mesh.instanceMatrix.addUpdateRange(0, count * 16);
        mesh.instanceMatrix.needsUpdate = true;
        if (mesh.instanceColor) {
          mesh.instanceColor.clearUpdateRanges();
          mesh.instanceColor.addUpdateRange(0, count * 3);
          mesh.instanceColor.needsUpdate = true;
        }
        visiblePools++;
      } else mesh.boundingSphere!.set(eye, 0);
      activeInstances += count;
      copiedInstances += count;
    }
    return { visiblePools, activeInstances, changedPools, copiedInstances };
  }
  function dispose() {
    if (disposed) return;
    disposed = true;
    group.removeFromParent();
    for (const pool of pools) pool.mesh.dispose();
    group.clear();
  }
  return { group, pools, meshes: pools.map(pool => pool.mesh), poolSize, nearDistance, farDistance, update, dispose };
}

/**
 * Actual 3D horizon geometry, never a camera-facing card. At 150+ metres most
 * twig tubes are subpixel: vertex clustering removes their collapsed triangles
 * while preserving the tree's trunks and branching silhouette. Leaves keep a
 * stable subset at their exact attachment points with conserved projected area.
 */
export function createHorizonGeometry(source:THREE.BufferGeometry,leaves:boolean){
 const result=new THREE.BufferGeometry();result.name=source.name+'-horizon';
 const position=source.getAttribute('position');
 const attributes=Object.entries(source.attributes).filter(([,a])=>a.itemSize<=4);
 const values=new Map(attributes.map(([name])=>[name,[] as number[]]));
 const index:number[]=[];
 // Accessors decode normalized integers and Float16 botanical UV attributes.
 const componentValue=(a:THREE.BufferAttribute|THREE.InterleavedBufferAttribute,i:number,j:number)=>j===0?a.getX(i):j===1?a.getY(i):j===2?a.getZ(i):a.getW(i);
 if(leaves){
  const bases=source.userData.leafBaseIndices as Uint32Array|undefined;
  if(!bases||!source.index)throw new Error('Horizon leaves require the real low-LOD leaf topology');
  const retained:number[]=[];
  for(let leaf=0;leaf<bases.length;leaf++){
   if(leaf%3!==0)continue;
   const base=bases[leaf],next=leaf+1<bases.length?bases[leaf+1]:position.count;
   if(next-base!==4)throw new Error('Horizon leaf geometry expects four-vertex low leaves');
   const first=values.get('position')!.length/3;retained.push(first);
   for(let vertex=base;vertex<next;vertex++)for(const [name,a]of attributes){
    const out=values.get(name)!;
    for(let component=0;component<a.itemSize;component++){
     let value=componentValue(a,vertex,component);
     if(name==='position')value=componentValue(position,base,component)+(value-componentValue(position,base,component))*1.69;
     out.push(value);
    }
   }
   index.push(first,first+1,first+3,first,first+3,first+2);
  }
  result.userData.leafBaseIndices=new Uint32Array(retained);
 }else{
  const voxel=.16,lookup=new Map<string,number>(),map=new Uint32Array(position.count),counts:number[]=[];
  for(let vertex=0;vertex<position.count;vertex++){
   const key=`${Math.round(position.getX(vertex)/voxel)},${Math.round(position.getY(vertex)/voxel)},${Math.round(position.getZ(vertex)/voxel)}`;
   let target=lookup.get(key);
   if(target===undefined){target=counts.length;lookup.set(key,target);counts.push(0);for(const [name,a]of attributes)for(let j=0;j<a.itemSize;j++)values.get(name)!.push(0);}
   map[vertex]=target;counts[target]++;
   for(const [name,a]of attributes)for(let j=0;j<a.itemSize;j++)values.get(name)![target*a.itemSize+j]+=componentValue(a,vertex,j);
  }
  for(const [name,a]of attributes){const out=values.get(name)!;for(let v=0;v<counts.length;v++)for(let j=0;j<a.itemSize;j++)out[v*a.itemSize+j]/=counts[v];}
  const sourceIndex=source.getIndex();if(!sourceIndex)throw new Error('Horizon wood requires indexed geometry');
  const unique=new Set<string>();
  for(let i=0;i<sourceIndex.count;i+=3){
   const a=map[sourceIndex.getX(i)],b=map[sourceIndex.getX(i+1)],c=map[sourceIndex.getX(i+2)];
   if(a===b||a===c||b===c)continue;
   const key=[a,b,c].sort((x,y)=>x-y).join(',');if(unique.has(key))continue;unique.add(key);index.push(a,b,c);
  }
 }
 for(const [name,a]of attributes)result.setAttribute(name,new THREE.Float32BufferAttribute(values.get(name)!,a.itemSize));
 result.setIndex(index);result.computeVertexNormals();result.computeBoundingBox();result.computeBoundingSphere();
 result.boundingSphere!.radius+=leaves?.4:.24;
 result.userData.horizonSourceTriangles=(source.index?.count??position.count)/3;
 result.userData.horizonTriangles=index.length/3;
 return result;
}
