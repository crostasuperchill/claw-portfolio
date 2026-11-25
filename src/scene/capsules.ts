import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import type { CapsuleOptions } from '../contracts';
import { makeToy } from './toys';

const TAU = Math.PI * 2;
const _white = new THREE.Color('#ffffff');
const _spinQuat = new THREE.Quaternion();
const _spinEuler = new THREE.Euler();
const _spinMat = new THREE.Matrix4();
const _instMat = new THREE.Matrix4();

/** Deterministic 0..1 hash so every filler capsule keeps its own tilt. */
function hash01(n: number) {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453123;
  return s - Math.floor(s);
}

/**
 * Explosive jewel-toned candy gashapon palette sampled from reference/target.png:
 * electric royal-cyan, hot candy pink, sunny amber yellow, rich grape violet,
 * juicy emerald green, coral-crimson, bright aqua-mint.
 */
export const CAPSULE_PALETTE = [
  '#149cf8', // vivid electric cyan-blue
  '#f43292', // hot candy pink
  '#f8c214', // sunny golden yellow
  '#8c42f2', // rich grape violet
  '#14c45c', // juicy emerald green
  '#f43854', // vibrant coral rose
  '#18ccb8', // rich aqua-mint
] as const;

function plasticTint(input: THREE.ColorRepresentation): THREE.Color {
  const c = new THREE.Color(input);
  const hsl = { h: 0, s: 0, l: 0 };
  c.getHSL(hsl);
  if (hsl.l < 0.1 || hsl.s < 0.05) {
    return new THREE.Color('#f43292');
  }
  // Full juicy jewel saturation + richer mid-lightness (0.42..0.52) so capsules never look chalky!
  c.setHSL(hsl.h, THREE.MathUtils.clamp(hsl.s * 0.96 + 0.14, 0.82, 1.0), THREE.MathUtils.clamp(hsl.l, 0.42, 0.52));
  return c;
}

const PRIZE_COLORS = [...CAPSULE_PALETTE];

/* ---------- geometry caches ---------- */

const lowerCache = new Map<number, THREE.BufferGeometry>();
const upperCache = new Map<number, THREE.BufferGeometry>();
const ringCache = new Map<number, THREE.BufferGeometry>();

function halfLower(r: number) {
  let g = lowerCache.get(r);
  if (!g) {
    g = new THREE.SphereGeometry(r, 24, 14, 0, TAU, Math.PI / 2, Math.PI / 2);
    lowerCache.set(r, g);
  }
  return g;
}

function halfUpper(r: number) {
  let g = upperCache.get(r);
  if (!g) {
    g = new THREE.SphereGeometry(r * 0.999, 24, 14, 0, TAU, 0, Math.PI / 2);
    upperCache.set(r, g);
  }
  return g;
}

/**
 * Colored lower half of a gashapon capsule: rich translucent jewel-candy acrylic
 * with crisp clearcoat gloss and minimal milky washout.
 */
function shellMaterial() {
  const m = new THREE.MeshPhysicalMaterial({
    color: '#ffffff',
    roughness: 0.07,
    metalness: 0.02,
    envMapIntensity: 1.35,
    transparent: true,
    opacity: 0.9,
    clearcoat: 0.9,
    clearcoatRoughness: 0.07,
    side: THREE.FrontSide,
    depthWrite: true,
  });

  m.onBeforeCompile = (shader) => {
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <normal_fragment_maps>',
      `#include <normal_fragment_maps>
       float shellFresnel = pow(1.0 - saturate(abs(dot(normal, normalize(vViewPosition)))), 2.8);
       diffuseColor.rgb = mix(diffuseColor.rgb, vec3(1.0), shellFresnel * 0.14);
       diffuseColor.a = clamp(diffuseColor.a + shellFresnel * 0.08, 0.0, 1.0);`
    );
  };
  m.customProgramCacheKey = () => 'capsule-shell-fresnel-v3';
  return m;
}

let sharedGlassMat: THREE.MeshStandardMaterial | null = null;
/**
 * Crystal-clear glossy acrylic dome with bright studio softbox speculars.
 */
function glassMaterial() {
  if (sharedGlassMat) return sharedGlassMat;
  const m = new THREE.MeshStandardMaterial({
    color: '#ffffff',
    roughness: 0.05,
    metalness: 0.02,
    transparent: true,
    opacity: 0.14,
    depthWrite: false,
    side: THREE.DoubleSide,
    envMapIntensity: 1.35,
  });

  m.onBeforeCompile = (shader) => {
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <normal_fragment_maps>',
      `#include <normal_fragment_maps>
       float glassFresnel = pow(1.0 - saturate(abs(dot(normal, normalize(vViewPosition)))), 1.65);
       diffuseColor.a = mix(opacity * 1.1, 0.54, glassFresnel);`
    );
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <opaque_fragment>',
      `vec3 glassHiA = normalize(vec3(-0.36, 0.62, 0.70));
       vec3 glassHiB = normalize(vec3(0.52, -0.24, 0.82));
       float glassSpecA = pow(saturate(dot(normal, glassHiA)), 64.0);
       float glassSpecB = pow(saturate(dot(normal, glassHiB)), 140.0);
       float glassSpec = clamp(glassSpecA * 1.1 + glassSpecB * 0.75, 0.0, 0.98);
       diffuseColor.rgb = mix(diffuseColor.rgb, vec3(1.0), glassSpec);
       diffuseColor.a = max(diffuseColor.a, glassSpec * 0.92);
       #include <opaque_fragment>`
    );
  };
  m.forceSinglePass = true;
  m.customProgramCacheKey = () => 'capsule-glass-std-fresnel-v6';
  sharedGlassMat = m;
  return m;
}

function ringGeometry(r: number) {
  let g = ringCache.get(r);
  if (g) return g;

  const torus = new THREE.TorusGeometry(r * 0.994, r * 0.024, 6, 32);
  torus.rotateX(Math.PI / 2);
  torus.scale(1, 0.55, 1);

  const ang = 0.58;
  const tab = new RoundedBoxGeometry(r * 0.14, r * 0.05, r * 0.13, 1, r * 0.02);
  tab.rotateY(-ang);
  tab.translate(Math.cos(ang) * r, 0, Math.sin(ang) * r);

  g = mergeGeometries([torus.toNonIndexed(), tab], false) ?? torus;
  ringCache.set(r, g);
  return g;
}

let sharedRingMat: THREE.MeshStandardMaterial | null = null;
function ringMaterial() {
  if (sharedRingMat) return sharedRingMat;
  sharedRingMat = new THREE.MeshStandardMaterial({
    color: '#eef5ff',
    roughness: 0.16,
    metalness: 0.04,
    transparent: true,
    opacity: 0.66,
    envMapIntensity: 1.15,
  });
  return sharedRingMat;
}

function prizeGeometry(r: number) {
  const parts: THREE.BufferGeometry[] = [];
  const add = (
    geo: THREE.BufferGeometry,
    sx: number,
    sy: number,
    sz: number,
    x: number,
    y: number,
    z: number
  ) => {
    const m = new THREE.Matrix4().compose(
      new THREE.Vector3(x, y, z),
      new THREE.Quaternion(),
      new THREE.Vector3(sx, sy, sz)
    );
    geo.applyMatrix4(m);
    parts.push(geo);
  };
  add(new THREE.SphereGeometry(r * 0.19, 12, 9), 1, 1.04, 0.9, 0, -r * 0.13, 0);
  add(new THREE.SphereGeometry(r * 0.155, 12, 9), 1, 0.98, 0.95, 0, r * 0.19, 0);
  add(new THREE.SphereGeometry(r * 0.058, 7, 6), 1, 1, 1, -r * 0.12, r * 0.315, -r * 0.012);
  add(new THREE.SphereGeometry(r * 0.058, 7, 6), 1, 1, 1, r * 0.12, r * 0.315, -r * 0.012);
  add(new THREE.SphereGeometry(r * 0.062, 8, 6), 1.22, 0.82, 0.62, 0, r * 0.155, r * 0.132);
  add(new THREE.SphereGeometry(r * 0.07, 8, 6), 1.1, 0.9, 1, -r * 0.105, -r * 0.4, r * 0.055);
  add(new THREE.SphereGeometry(r * 0.07, 8, 6), 1.1, 0.9, 1, r * 0.105, -r * 0.4, r * 0.055);
  return mergeGeometries(parts, false)!;
}

function prizeMaterial() {
  return new THREE.MeshStandardMaterial({
    color: '#ffffff',
    roughness: 0.24,
    metalness: 0.02,
    envMapIntensity: 1.0,
  });
}

/* ------------------------------------------------------------------ */

/** Instanced filler capsules: 4 draw calls total. */
export class CapsuleField {
  readonly group = new THREE.Group();
  private lower: THREE.InstancedMesh;
  private upper: THREE.InstancedMesh;
  private ring: THREE.InstancedMesh;
  private inner: THREE.InstancedMesh;

  constructor(count: number, radius: number) {
    const r = radius;

    this.lower = new THREE.InstancedMesh(halfLower(r), shellMaterial(), count);
    this.upper = new THREE.InstancedMesh(halfUpper(r), glassMaterial(), count);
    this.ring = new THREE.InstancedMesh(ringGeometry(r), ringMaterial(), count);
    this.inner = new THREE.InstancedMesh(prizeGeometry(r), prizeMaterial(), count);

    this.lower.castShadow = true;
    this.lower.receiveShadow = true;

    this.group.add(this.lower, this.upper, this.ring, this.inner);

    const zero = new THREE.Matrix4().makeScale(0, 0, 0);
    for (let i = 0; i < count; i++) {
      this.lower.setMatrixAt(i, zero);
      this.upper.setMatrixAt(i, zero);
      this.ring.setMatrixAt(i, zero);
      this.inner.setMatrixAt(i, zero);
    }
    this.commit();
  }

  setColor(index: number, color: string) {
    const shell = plasticTint(color);
    shell.offsetHSL(
      (hash01(index * 7.31 + 3.1) - 0.5) * 0.03,
      0.04,
      (hash01(index * 9.17 + 1.7) - 0.5) * 0.05
    );
    this.lower.setColorAt(index, shell);

    // Clear dome picks up a subtle jewel tint from the candy half.
    this.upper.setColorAt(index, shell.clone().lerp(_white, 0.55));

    // Vibrant mini-toy silhouette inside the capsule.
    const prize = new THREE.Color(PRIZE_COLORS[(index + 2) % PRIZE_COLORS.length])
      .lerp(_white, 0.14);
    this.inner.setColorAt(index, prize);

    if (this.lower.instanceColor) this.lower.instanceColor.needsUpdate = true;
    if (this.upper.instanceColor) this.upper.instanceColor.needsUpdate = true;
    if (this.inner.instanceColor) this.inner.instanceColor.needsUpdate = true;
  }

  setMatrix(index: number, m: THREE.Matrix4) {
    const flip = hash01(index + 0.83) > 0.9 ? Math.PI : 0;
    const tilt = (hash01(index * 1.73 + 4.2) - 0.5) * 0.95;
    const yaw = hash01(index * 2.41 + 9.7) * TAU;
    const roll = (hash01(index * 3.17 + 2.9) - 0.5) * 0.72;
    _spinEuler.set(flip + tilt, yaw, roll, 'YXZ');
    _spinQuat.setFromEuler(_spinEuler);
    _spinMat.makeRotationFromQuaternion(_spinQuat);
    _instMat.copy(m).multiply(_spinMat);

    this.lower.setMatrixAt(index, _instMat);
    this.upper.setMatrixAt(index, _instMat);
    this.ring.setMatrixAt(index, _instMat);
    this.inner.setMatrixAt(index, _instMat);
  }

  hide(index: number) {
    const zero = new THREE.Matrix4().makeScale(0, 0, 0);
    this.setMatrix(index, zero);
    this.commit();
  }

  commit() {
    this.lower.instanceMatrix.needsUpdate = true;
    this.upper.instanceMatrix.needsUpdate = true;
    this.ring.instanceMatrix.needsUpdate = true;
    this.inner.instanceMatrix.needsUpdate = true;
  }
}

/**
 * Hero portfolio prize: sits bare and proud directly on top of the gashapon
 * capsule sea — matching reference/target.png (no obscuring outer shell or
 * white equator ring cutting through the Tamagotchis, Game Boys, and Floppies).
 */
export function makeCapsule(opts: CapsuleOptions): THREE.Group {
  const { project } = opts;
  const g = new THREE.Group();

  const toy = makeToy(project?.toy ?? 'charm', project?.color ?? '#ffd0e0');
  // Prominent hero scale sitting proud above the capsule equator so all 6 gadgets pop cleanly.
  toy.scale.setScalar(1.42);
  toy.position.y = 0.015;
  toy.rotation.x = -0.05;
  toy.userData.noMerge = true;
  g.add(toy);

  g.userData.projectId = project?.id ?? null;
  return g;
}
