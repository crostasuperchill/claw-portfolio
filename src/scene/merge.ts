import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

function signature(mat: THREE.Material) {
  const m = mat as unknown as {
    color?: THREE.Color;
    roughness?: number;
    metalness?: number;
    emissive?: THREE.Color;
    emissiveIntensity?: number;
    clearcoat?: number;
    map?: THREE.Texture;
    normalMap?: THREE.Texture;
  };
  return [
    mat.type,
    m.color?.getHexString?.() ?? '',
    m.roughness ?? '',
    m.metalness ?? '',
    m.emissive?.getHexString?.() ?? '',
    m.emissiveIntensity ?? '',
    m.clearcoat ?? '',
    mat.side,
    m.map?.uuid ?? '',
    m.normalMap?.uuid ?? '',
  ].join('|');
}

type Bucket = {
  mat: THREE.Material;
  geos: THREE.BufferGeometry[];
  meshes: THREE.Mesh[];
  cast: boolean;
  receive: boolean;
};

/**
 * Fonde le mesh statiche che condividono lo stesso *look* (non la stessa istanza
 * di materiale: gli agenti ne creano una per pezzo). Trasparenti, instanziate e
 * invisibili restano separate: fonderle romperebbe ordinamento, raycast o blending.
 *
 * Regola d'oro: una mesh viene rimossa SOLO se il merge del suo bucket è riuscito,
 * altrimenti sparisce dalla scena.
 */
export function mergeStatic(root: THREE.Object3D, opts: { skip?: (mesh: THREE.Mesh) => boolean } = {}) {
  root.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(root.matrixWorld).invert();
  const buckets = new Map<string, Bucket>();

  root.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (!(mesh as unknown as { isMesh?: boolean }).isMesh) return;
    if ((mesh as unknown as { isInstancedMesh?: boolean }).isInstancedMesh) return;
    if (Array.isArray(mesh.material)) return;
    if (opts.skip?.(mesh)) return;
    const mat = mesh.material as THREE.Material;
    if (!mat.visible || mat.transparent || mat.depthWrite === false) return;

    let geo = mesh.geometry.clone();
    if (!geo.attributes.uv) {
      const count = geo.attributes.position.count;
      geo.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(count * 2), 2));
    }
    if (!geo.attributes.normal) geo.computeVertexNormals();
    for (const name of Object.keys(geo.attributes)) {
      if (!['position', 'normal', 'uv'].includes(name)) geo.deleteAttribute(name);
    }
    geo.applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv, mesh.matrixWorld));
    // portiamo tutto a non-indexed: geometrie con e senza index non si fondono tra loro
    geo = geo.index ? geo.toNonIndexed() : geo;

    const key = signature(mat);
    const b = buckets.get(key) ?? { mat, geos: [], meshes: [], cast: false, receive: false };
    b.geos.push(geo);
    b.meshes.push(mesh);
    b.cast ||= mesh.castShadow;
    b.receive ||= mesh.receiveShadow;
    buckets.set(key, b);
  });

  for (const b of buckets.values()) {
    if (!b.geos.length) continue;
    const merged = b.geos.length === 1 ? b.geos[0] : mergeGeometries(b.geos, false);
    if (!merged) continue;
    const mesh = new THREE.Mesh(merged, b.mat);
    mesh.castShadow = b.cast;
    mesh.receiveShadow = b.receive;
    mesh.matrixAutoUpdate = false;
    root.add(mesh);
    for (const victim of b.meshes) {
      victim.removeFromParent();
      victim.geometry.dispose();
    }
  }
}
