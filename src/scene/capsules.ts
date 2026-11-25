import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import type { CapsuleOptions } from '../contracts';
import { PROJECTS } from '../game/roster';
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
 * Bright translucent gashapon pastels sampled from the capsule pile in
 * reference/target.png: candy pink, apple mint, sunny yellow, sky cyan,
 * lavender and coral rose.
 */
export const CAPSULE_PALETTE = [
  '#6ec4ff', // sky cyan-blue — MagicWall
  '#ff8cc6', // candy pink — Jollycat
  '#ffe268', // sunny pastel yellow — ZORA
  '#be94ff', // lavender-lilac — Oracle
  '#6ee294', // apple / mint green — Polaroids
  '#ff6e8a', // coral rose — Say hi
] as const;

function plasticTint(input: THREE.ColorRepresentation): THREE.Color {
  const c = new THREE.Color(input);
  const hsl = { h: 0, s: 0, l: 0 };
  c.getHSL(hsl);
  if (hsl.l < 0.1 || hsl.s < 0.05) {
    return new THREE.Color('#ff8cc6');
  }
  // Lift the hue toward a bright candy pastel without muddying it.
  c.setHSL(hsl.h, THREE.MathUtils.clamp(hsl.s * 0.86 + 0.18, 0.7, 0.95), 0.64);
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
 * Colored half of a gashapon capsule: semi-translucent glossy candy plastic.
 * FrontSide + transparency keeps the toy inside readable, and a Fresnel rim
 * mixes in a frosted white highlight so the shell reads like tinted acrylic
 * rather than an opaque clay bowl.
 */
function shellMaterial() {
  const m = new THREE.MeshPhysicalMaterial({
    color: '#ffffff',
    roughness: 0.12,
    metalness: 0.0,
    envMapIntensity: 1.0,
    transparent: true,
    opacity: 0.78,
    clearcoat: 0.6,
    clearcoatRoughness: 0.12,
    side: THREE.FrontSide,
    depthWrite: true,
  });

  m.onBeforeCompile = (shader) => {
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <normal_fragment_maps>',
      `#include <normal_fragment_maps>
       float shellFresnel = pow(1.0 - saturate(abs(dot(normal, normalize(vViewPosition)))), 2.1);
       diffuseColor.rgb = mix(diffuseColor.rgb, vec3(1.0), shellFresnel * 0.38);
       diffuseColor.a = clamp(diffuseColor.a + shellFresnel * 0.14, 0.0, 1.0);`
    );
  };
  m.customProgramCacheKey = () => 'capsule-shell-fresnel-v1';
  return m;
}

let sharedGlassMat: THREE.MeshStandardMaterial | null = null;
/**
 * Clear acrylic dome. A smooth Fresnel rim plus two painted specular
 * highlights give the illustrated "shiny gashapon ball" read while staying a
 * single cheap standard material.
 */
function glassMaterial() {
  if (sharedGlassMat) return sharedGlassMat;
  const m = new THREE.MeshStandardMaterial({
    color: '#ffffff',
    roughness: 0.07,
    metalness: 0.02,
    transparent: true,
    opacity: 0.1,
    depthWrite: false,
    side: THREE.DoubleSide,
    envMapIntensity: 1.0,
  });

  m.onBeforeCompile = (shader) => {
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <normal_fragment_maps>',
      `#include <normal_fragment_maps>
       float glassFresnel = pow(1.0 - saturate(abs(dot(normal, normalize(vViewPosition)))), 1.45);
       diffuseColor.a = mix(opacity * 1.2, 0.6, glassFresnel);`
    );
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <opaque_fragment>',
      `vec3 glassHiA = normalize(vec3(-0.36, 0.58, 0.73));
       vec3 glassHiB = normalize(vec3(0.54, -0.26, 0.80));
       float glassSpecA = pow(saturate(dot(normal, glassHiA)), 72.0);
       float glassSpecB = pow(saturate(dot(normal, glassHiB)), 160.0);
       float glassSpec = clamp(glassSpecA * 1.0 + glassSpecB * 0.7, 0.0, 0.95);
       diffuseColor.rgb = mix(diffuseColor.rgb, vec3(1.0), glassSpec);
       diffuseColor.a = max(diffuseColor.a, glassSpec * 0.9);
       #include <opaque_fragment>`
    );
  };
  m.forceSinglePass = true;
  m.customProgramCacheKey = () => 'capsule-glass-std-fresnel-v4';
  sharedGlassMat = m;
  return m;
}

function ringGeometry(r: number) {
  let g = ringCache.get(r);
  if (g) return g;

  const torus = new THREE.TorusGeometry(r * 0.994, r * 0.032, 6, 32);
  torus.rotateX(Math.PI / 2);
  torus.scale(1, 0.55, 1);

  const ang = 0.58;
  const tab = new RoundedBoxGeometry(r * 0.16, r * 0.06, r * 0.15, 1, r * 0.02);
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
    color: '#fffdfa',
    roughness: 0.22,
    metalness: 0.02,
    envMapIntensity: 1.0,
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
    roughness: 0.28,
    metalness: 0.02,
    envMapIntensity: 0.95,
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
    // gentle per-capsule hue / lightness drift so the pile never looks cloned
    shell.offsetHSL(
      (hash01(index * 7.31 + 3.1) - 0.5) * 0.035,
      0,
      (hash01(index * 9.17 + 1.7) - 0.5) * 0.05
    );
    this.lower.setColorAt(index, shell);

    // clear dome picks up a soft pastel tint from the candy half
    this.upper.setColorAt(index, shell.clone().lerp(_white, 0.7));

    // pastel prize silhouette floating inside the clear dome
    const prize = new THREE.Color(PRIZE_COLORS[(index + 2) % PRIZE_COLORS.length])
      .lerp(_white, 0.3)
      .offsetHSL(0, -0.06, 0.02);
    this.inner.setColorAt(index, prize);

    if (this.lower.instanceColor) this.lower.instanceColor.needsUpdate = true;
    if (this.upper.instanceColor) this.upper.instanceColor.needsUpdate = true;
    if (this.inner.instanceColor) this.inner.instanceColor.needsUpdate = true;
  }

  /**
   * Place a filler capsule. The clear dome stays mostly upright so the toys
   * inside are readable; only ~8% are flipped to show their candy half on top,
   * like the dense gashapon sea in reference/target.png.
   */
  setMatrix(index: number, m: THREE.Matrix4) {
    const flip = hash01(index + 0.83) > 0.92 ? Math.PI : 0;
    const tilt = (hash01(index * 1.73 + 4.2) - 0.5) * 0.9;
    const yaw = hash01(index * 2.41 + 9.7) * TAU;
    const roll = (hash01(index * 3.17 + 2.9) - 0.5) * 0.7;
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

/** Hero prize capsule: clean translucent gashapon shell with the toy inside. */
export function makeCapsule(opts: CapsuleOptions): THREE.Group {
  const { project, radius, tint } = opts;
  const g = new THREE.Group();
  const paletteIndex = project ? PROJECTS.findIndex((p) => p.id === project.id) : -1;
  const base =
    tint !== undefined
      ? plasticTint(tint)
      : paletteIndex >= 0
        ? new THREE.Color(CAPSULE_PALETTE[paletteIndex % CAPSULE_PALETTE.length])
        : plasticTint(project?.color ?? '#ff88bc');
  const r = radius;

  const lower = new THREE.Mesh(halfLower(r), shellMaterial());
  const lowerMat = lower.material as THREE.MeshPhysicalMaterial;
  lowerMat.color.copy(base);
  // Hero shells are nearly clear so the prize toy reads boldly through them.
  lowerMat.opacity = 0.28;
  lowerMat.depthWrite = false;
  lower.renderOrder = 2;
  lower.castShadow = true;
  lower.receiveShadow = true;
  g.add(lower);

  const upper = new THREE.Mesh(halfUpper(r), glassMaterial());
  upper.renderOrder = 2;
  g.add(upper);

  const ring = new THREE.Mesh(ringGeometry(r), ringMaterial());
  g.add(ring);

  const toy = makeToy(project?.toy ?? 'charm', project?.color ?? '#ffd0e0');
  toy.scale.setScalar(1.32);
  toy.position.y = 0.012;
  toy.rotation.x = -0.08;
  toy.userData.noMerge = true;
  g.add(toy);

  g.userData.projectId = project?.id ?? null;
  return g;
}
