import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import type { CapsuleOptions } from '../contracts';
import { PROJECTS } from '../game/roster';
import { makeToy } from './toys';

const TAU = Math.PI * 2;
const _camLocal = new THREE.Vector3();

/**
 * Saturated kawaii pastel capsule palette matching the UFO catcher reference photo.
 */
export const CAPSULE_PALETTE = [
  '#46b3ff', // sky blue — MagicWall
  '#ff69a8', // candy pink — Jollycat
  '#ffd133', // sunny yellow — ZORA
  '#9d74ff', // pastel lilac — Oracle
  '#4ee0b0', // mint green — Polaroids
  '#ff9364', // peach coral — Say hi
] as const;

function plasticTint(input: THREE.ColorRepresentation): THREE.Color {
  const c = new THREE.Color(input);
  const hsl = { h: 0, s: 0, l: 0 };
  c.getHSL(hsl);
  if (hsl.l < 0.1 || hsl.s < 0.05) {
    return c.setHSL(0.045, 0.84, 0.6);
  }
  const s = THREE.MathUtils.clamp(hsl.s * 0.9 + 0.42, 0.78, 0.96);
  const l = THREE.MathUtils.clamp(0.58 + (hsl.l - 0.5) * 0.05, 0.54, 0.65);
  return c.setHSL(hsl.h, s, l);
}

const PRIZE_COLORS = [...CAPSULE_PALETTE];

/* ---------- geometry caches ---------- */

const lowerCache = new Map<number, THREE.BufferGeometry>();
const upperCache = new Map<number, THREE.BufferGeometry>();
const ringCache = new Map<number, THREE.BufferGeometry>();
const labelGeoCache = new Map<number, THREE.BufferGeometry>();

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

function shellMaterial() {
  return new THREE.MeshStandardMaterial({
    color: '#ffffff',
    roughness: 0.22,
    metalness: 0.02,
    envMapIntensity: 1.0,
    side: THREE.DoubleSide,
    shadowSide: THREE.FrontSide,
  });
}

let sharedGlassMat: THREE.MeshStandardMaterial | null = null;
function glassMaterial() {
  if (sharedGlassMat) return sharedGlassMat;
  const m = new THREE.MeshStandardMaterial({
    color: '#eaf7ff',
    roughness: 0.04,
    metalness: 0.04,
    transparent: true,
    opacity: 0.16,
    depthWrite: false,
    side: THREE.DoubleSide,
    envMapIntensity: 2.1,
  });

  m.onBeforeCompile = (shader) => {
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <normal_fragment_maps>',
      `#include <normal_fragment_maps>
       float glassFresnel = pow(1.0 - saturate(abs(dot(normal, normalize(vViewPosition)))), 0.9);
       diffuseColor.a = mix(opacity * 1.25, opacity * 4.4, glassFresnel);`
    );
  };
  m.forceSinglePass = true;
  m.customProgramCacheKey = () => 'capsule-glass-std-fresnel-v1';
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
/* label                                                               */
/* ------------------------------------------------------------------ */

function bandColor(hex: string): THREE.Color {
  const c = new THREE.Color(hex);
  const hsl = { h: 0, s: 0, l: 0 };
  c.getHSL(hsl);
  if (hsl.l < 0.1 || hsl.s < 0.06) {
    return c.setHSL(0.04, 0.8, 0.54);
  }
  const s = THREE.MathUtils.clamp(hsl.s * 0.96 + 0.1, 0.68, 1);
  const l = THREE.MathUtils.clamp(hsl.l, 0.34, 0.48);
  return c.setHSL(hsl.h, s, l);
}

function labelTexture(title: string, color: string) {
  const W = 384;
  const H = 136;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const g = c.getContext('2d')!;
  const band = bandColor(color);
  const top = band.clone().offsetHSL(0, -0.02, 0.04);
  const bottom = band.clone().offsetHSL(0, 0.02, -0.04);

  const grad = g.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, `#${top.getHexString()}`);
  grad.addColorStop(1, `#${bottom.getHexString()}`);
  g.fillStyle = grad;
  g.fillRect(0, 0, W, H);

  g.strokeStyle = 'rgba(0,0,0,0.14)';
  g.lineWidth = 2;
  g.beginPath();
  g.roundRect(7, 7, W - 14, H - 14, 8);
  g.stroke();

  const label = title.toUpperCase();
  const areaTop = 6;
  const areaH = 96;
  const maxW = W - 34;
  let size = 90;
  let sx = 1;
  const nameFont = (px: number) =>
    `900 ${px}px "HelveticaNeue-CondensedBlack", "Helvetica Neue Condensed Black", "Arial Narrow", "Helvetica Neue", Arial, sans-serif`;
  for (;;) {
    g.font = nameFont(size);
    const widest = g.measureText(label).width;
    sx = Math.min(1, maxW / widest);
    if (sx >= 0.76 || size <= 24) break;
    size -= 2;
  }

  g.save();
  g.translate(W / 2, areaTop + areaH / 2);
  g.scale(sx, 1);
  g.fillStyle = '#ffffff';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.lineJoin = 'round';
  g.strokeStyle = 'rgba(0,0,0,0.28)';
  g.lineWidth = Math.max(2, size * 0.04);
  g.strokeText(label, 0, 0);
  g.fillText(label, 0, 0);
  g.restore();

  g.fillStyle = 'rgba(255,255,255,0.82)';
  g.textAlign = 'center';
  g.font = '800 9px "Helvetica Neue", Arial, sans-serif';
  g.fillText('DAVIDE.FYI  ·  PRIZE', W / 2, 124);

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

const LABEL_PHI = TAU / 3;
const LABEL_THETA_START = Math.PI / 2 + 0.02;
const LABEL_THETA = 0.7;

function labelGeometry(r: number) {
  let g = labelGeoCache.get(r);
  if (!g) {
    g = new THREE.SphereGeometry(
      r * 1.006,
      20,
      10,
      Math.PI / 2 - LABEL_PHI / 2,
      LABEL_PHI,
      LABEL_THETA_START,
      LABEL_THETA
    );
    labelGeoCache.set(r, g);
  }
  return g;
}

function labelMaterial(tex: THREE.Texture) {
  return new THREE.MeshStandardMaterial({
    map: tex,
    roughness: 0.45,
    metalness: 0,
    envMapIntensity: 0.65,
    side: THREE.FrontSide,
    transparent: true,
    opacity: 1,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
  });
}

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
    this.lower.setColorAt(index, shell);
    this.inner.setColorAt(index, new THREE.Color(PRIZE_COLORS[index % PRIZE_COLORS.length]));
    if (this.lower.instanceColor) this.lower.instanceColor.needsUpdate = true;
    if (this.inner.instanceColor) this.inner.instanceColor.needsUpdate = true;
  }

  setMatrix(index: number, m: THREE.Matrix4) {
    this.lower.setMatrixAt(index, m);
    this.upper.setMatrixAt(index, m);
    this.ring.setMatrixAt(index, m);
    this.inner.setMatrixAt(index, m);
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

/** Hero prize capsule with miniature toy + project label. */
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
  (lower.material as THREE.MeshStandardMaterial).color.copy(base);
  lower.castShadow = true;
  lower.receiveShadow = true;
  g.add(lower);

  const upper = new THREE.Mesh(halfUpper(r), glassMaterial());
  g.add(upper);

  const ring = new THREE.Mesh(ringGeometry(r), ringMaterial());
  g.add(ring);

  const toy = makeToy(project?.toy ?? 'charm', project?.color ?? '#ffd0e0');
  toy.scale.setScalar(0.9);
  toy.position.y = 0.004;
  g.add(toy);

  if (project) {
    const tex = labelTexture(project.title, project.color);
    const mat = labelMaterial(tex);
    const geo = labelGeometry(r);
    const label = new THREE.Mesh(geo, mat);
    label.userData.noMerge = true;
    label.onBeforeRender = (_renderer, _scene, camera) => {
      const capsule = label.parent;
      if (!capsule) return;
      _camLocal.copy(camera.position);
      capsule.worldToLocal(_camLocal);
      label.rotation.y = Math.atan2(_camLocal.x, _camLocal.z);
      label.updateMatrix();
      label.matrixWorld.multiplyMatrices(capsule.matrixWorld, label.matrix);
    };
    g.add(label);
  }

  g.userData.projectId = project?.id ?? null;
  return g;
}
