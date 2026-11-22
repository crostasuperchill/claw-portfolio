import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { CapsuleOptions } from '../contracts';
import { makeToy } from './toys';

const TAU = Math.PI * 2;

/** Pastello saturo: alza la luminosità senza slavare la tinta. */
function plasticTint(input: THREE.ColorRepresentation): THREE.Color {
  const c = new THREE.Color(input);
  const hsl = { h: 0, s: 0, l: 0 };
  c.getHSL(hsl);
  if (hsl.l < 0.1) {
    // nero/bruciato: resta plastica glossy scura, non grigio slavato
    return c.setHSL(hsl.h, Math.min(1, hsl.s + 0.08), 0.2);
  }
  const s = THREE.MathUtils.clamp(hsl.s * 1.22 + 0.12, 0.52, 1);
  const l = THREE.MathUtils.clamp(0.46 + hsl.l * 0.24, 0.54, 0.68);
  return c.setHSL(hsl.h, s, l);
}

const PRIZE_COLORS = ['#ffb703', '#4cc9f0', '#f72585', '#06d6a0', '#ffd166', '#b5179e'];

const halfLower = (r: number) =>
  new THREE.SphereGeometry(r, 32, 20, 0, TAU, Math.PI / 2, Math.PI / 2);
const halfUpper = (r: number) =>
  new THREE.SphereGeometry(r * 0.998, 32, 20, 0, TAU, 0, Math.PI / 2);

/** plastica pastello glossy della calotta inferiore */
function shellMaterial() {
  return new THREE.MeshPhysicalMaterial({
    color: '#ffffff',
    roughness: 0.13,
    metalness: 0,
    clearcoat: 1,
    clearcoatRoughness: 0.025,
    envMapIntensity: 1.3,
    ior: 1.46,
  });
}

/**
 * Calotta superiore: guscio sottile, non lattiginoso.
 * Niente DoubleSide (raddoppiava riflessi e rifrazione -> effetto latte),
 * thickness minima e trasmissione alta lasciano vedere il premio.
 */
function glassMaterial() {
  const cheap =
    typeof location !== 'undefined' &&
    (new URLSearchParams(location.search).has('notrans') ||
      (typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches));
  return new THREE.MeshPhysicalMaterial({
    color: '#ffffff',
    roughness: 0.028,
    metalness: 0,
    transmission: cheap ? 0 : 0.92,
    opacity: cheap ? 0.3 : 1,
    thickness: 0.001,
    ior: 1.47,
    side: THREE.FrontSide,
    clearcoat: 1,
    clearcoatRoughness: 0.02,
    envMapIntensity: 1.75,
    specularIntensity: 1,
    transparent: true,
    depthWrite: false,
  });
}

let ringBump: THREE.CanvasTexture | null = null;
function ringBumpTexture() {
  if (ringBump) return ringBump;
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 16;
  const g = c.getContext('2d')!;
  g.fillStyle = '#808080';
  g.fillRect(0, 0, 128, 16);
  for (let i = 0; i < 64; i++) {
    g.fillStyle = i % 2 ? '#d8d8d8' : '#3c3c3c';
    g.fillRect(i * 2, 0, 2, 16);
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = THREE.RepeatWrapping;
  t.repeat.x = 3;
  t.anisotropy = 4;
  ringBump = t;
  return t;
}

/** anello di giunzione sottile, leggermente rigato */
function ringGeometry(r: number) {
  const geo = new THREE.TorusGeometry(r * 0.994, r * 0.019, 8, 48);
  geo.rotateX(Math.PI / 2);
  return geo;
}

function ringMaterial(color?: THREE.Color) {
  return new THREE.MeshPhysicalMaterial({
    color: color ?? '#ffffff',
    roughness: 0.2,
    metalness: 0,
    clearcoat: 1,
    clearcoatRoughness: 0.05,
    bumpMap: ringBumpTexture(),
    bumpScale: 0.0005,
    envMapIntensity: 1.2,
  });
}

/** piccolo orsetto premio, silhouette leggibile dietro il guscio trasparente */
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
  add(new THREE.SphereGeometry(r * 0.19, 16, 12), 1, 1.04, 0.9, 0, -r * 0.13, 0);
  add(new THREE.SphereGeometry(r * 0.155, 16, 12), 1, 0.98, 0.95, 0, r * 0.19, 0);
  add(new THREE.SphereGeometry(r * 0.058, 10, 8), 1, 1, 1, -r * 0.12, r * 0.315, -r * 0.012);
  add(new THREE.SphereGeometry(r * 0.058, 10, 8), 1, 1, 1, r * 0.12, r * 0.315, -r * 0.012);
  add(new THREE.SphereGeometry(r * 0.062, 10, 8), 1.22, 0.82, 0.62, 0, r * 0.155, r * 0.132);
  add(new THREE.SphereGeometry(r * 0.07, 10, 8), 1.1, 0.9, 1, -r * 0.105, -r * 0.4, r * 0.055);
  add(new THREE.SphereGeometry(r * 0.07, 10, 8), 1.1, 0.9, 1, r * 0.105, -r * 0.4, r * 0.055);
  return mergeGeometries(parts, false)!;
}

function prizeMaterial() {
  return new THREE.MeshPhysicalMaterial({
    color: '#ffffff',
    roughness: 0.27,
    metalness: 0,
    clearcoat: 0.7,
    clearcoatRoughness: 0.14,
    envMapIntensity: 1.1,
  });
}

function labelTexture(title: string, color: string) {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 236;
  const g = c.getContext('2d')!;
  g.fillStyle = '#fbf6ea';
  g.fillRect(0, 0, 512, 236);
  g.strokeStyle = '#e4d9c2';
  g.lineWidth = 8;
  g.strokeRect(5, 5, 502, 226);

  g.fillStyle = color;
  g.fillRect(18, 18, 476, 66);
  g.fillStyle = 'rgba(255,255,255,0.88)';
  g.font = '800 20px "Helvetica Neue", Arial, sans-serif';
  g.textAlign = 'left';
  g.textBaseline = 'middle';
  g.fillText('DAVIDE.FYI  ·  PRIZE', 36, 52);

  const t = title.toUpperCase();
  let size = 72;
  g.font = `800 ${size}px "Helvetica Neue", Arial, sans-serif`;
  while (g.measureText(t).width > 452 && size > 24) {
    size -= 2;
    g.font = `800 ${size}px "Helvetica Neue", Arial, sans-serif`;
  }
  g.fillStyle = '#241f18';
  g.textAlign = 'center';
  g.fillText(t, 256, 146, 456);

  g.fillStyle = color;
  g.beginPath();
  g.arc(42, 202, 9, 0, TAU);
  g.fill();
  g.fillStyle = '#8b8170';
  g.font = '700 18px "Helvetica Neue", Arial, sans-serif';
  g.textAlign = 'left';
  g.fillText('COLLECTIBLE CAPSULE', 62, 208);
  g.fillStyle = '#b8ad97';
  g.textAlign = 'right';
  g.fillText('No. 01', 494, 208);

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

/**
 * Adesivo curvo sulla calotta inferiore.
 * Centrato verso la camera di default (+x, +z) così il titolo si legge.
 */
function labelGeometry(r: number) {
  return new THREE.SphereGeometry(
    r * 1.004,
    40,
    20,
    Math.PI / 2 + 0.45 - 0.575,
    1.15,
    Math.PI / 2 + 0.16,
    0.44
  );
}

/** Capsule "riempitive" tutte in 4 draw call. */
export class CapsuleField {
  readonly group = new THREE.Group();
  private lower: THREE.InstancedMesh;
  private upper: THREE.InstancedMesh;
  private ring: THREE.InstancedMesh;
  private inner: THREE.InstancedMesh;
  private count: number;

  constructor(count: number, radius: number) {
    this.count = count;
    const r = radius;

    this.lower = new THREE.InstancedMesh(halfLower(r), shellMaterial(), count);
    this.upper = new THREE.InstancedMesh(halfUpper(r), glassMaterial(), count);
    this.ring = new THREE.InstancedMesh(ringGeometry(r), ringMaterial(), count);
    this.inner = new THREE.InstancedMesh(
      prizeGeometry(r),
      prizeMaterial(),
      count
    );

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
    this.ring.setColorAt(index, shell.clone().offsetHSL(0, 0, -0.05));
    this.inner.setColorAt(index, new THREE.Color(PRIZE_COLORS[index % PRIZE_COLORS.length]));
    if (this.lower.instanceColor) this.lower.instanceColor.needsUpdate = true;
    if (this.ring.instanceColor) this.ring.instanceColor.needsUpdate = true;
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

/** Capsula premio, con giocattolo e etichetta del progetto. */
export function makeCapsule(opts: CapsuleOptions): THREE.Group {
  const { project, radius, tint } = opts;
  const g = new THREE.Group();
  const base = plasticTint(tint ?? project?.color ?? '#f0b6cd');
  const r = radius;

  const lower = new THREE.Mesh(
    halfLower(r),
    new THREE.MeshPhysicalMaterial({
      color: base,
      roughness: 0.13,
      metalness: 0,
      clearcoat: 1,
      clearcoatRoughness: 0.025,
      envMapIntensity: 1.3,
      ior: 1.46,
    })
  );
  lower.castShadow = true;
  lower.receiveShadow = true;
  g.add(lower);

  const upper = new THREE.Mesh(halfUpper(r), glassMaterial());
  g.add(upper);

  const ringColor = base.clone().offsetHSL(0, 0, -0.045);
  const ring = new THREE.Mesh(ringGeometry(r), ringMaterial(ringColor));
  g.add(ring);

  const toy = makeToy(project?.toy ?? 'charm', project?.color ?? '#ffd0e0');
  toy.scale.setScalar(0.94);
  toy.position.y = 0.014;
  g.add(toy);

  if (project) {
    const labelMat = new THREE.MeshPhysicalMaterial({
      map: labelTexture(project.title, project.color),
      roughness: 0.36,
      metalness: 0,
      clearcoat: 0.65,
      clearcoatRoughness: 0.15,
      side: THREE.FrontSide,
    });
    const geo = labelGeometry(r);
    const front = new THREE.Mesh(geo, labelMat);
    g.add(front);
    // seconda etichetta sul lato opposto: si vede anche dopo un mezzo giro
    const back = new THREE.Mesh(geo, labelMat);
    back.rotation.y = Math.PI;
    g.add(back);
  }

  g.userData.projectId = project?.id ?? null;
  return g;
}
