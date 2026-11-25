import * as THREE from 'three';
import { D, REF } from './dims';

/* ---------- cached lightweight procedural helpers ---------- */

let grainTex: THREE.Texture | null = null;
let peelTex: THREE.DataTexture | null = null;
let brushTex: THREE.Texture | null = null;

/** GPU max anisotropy, shared by the studio renderer (see studio.ts). */
let maxAniso = 8;

export function setMaxAnisotropy(n: number) {
  maxAniso = Math.max(1, Math.min(16, Math.floor(n) || 1));
  for (const t of [grainTex, peelTex, brushTex]) {
    if (t && t.anisotropy !== maxAniso) {
      t.anisotropy = maxAniso;
      t.needsUpdate = true;
    }
  }
  return maxAniso;
}

/** Keep printed / backlit art crisp at grazing angles. */
function sharpenTexture<T extends THREE.Texture | null | undefined>(tex: T): T {
  if (tex && tex.anisotropy !== maxAniso) {
    tex.anisotropy = maxAniso;
    tex.needsUpdate = true;
  }
  return tex;
}

function rand(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

export function microRoughness() {
  if (grainTex) return grainTex;
  const size = 128;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d')!;
  const rnd = rand(0x51ace);
  g.fillStyle = '#e6e6e6';
  g.fillRect(0, 0, size, size);
  for (let i = 0; i < 600; i++) {
    const v = 210 + Math.floor(rnd() * 44);
    g.fillStyle = `rgba(${v},${v},${v},0.16)`;
    g.fillRect(rnd() * size, rnd() * size, 2, 2);
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(2, 2);
  grainTex = t;
  return t;
}

export function orangePeelNormal(size = 64) {
  if (peelTex) return peelTex;
  const data = new Uint8Array(size * size * 4);
  for (let i = 0; i < size * size; i++) {
    const o = i * 4;
    data[o] = 128;
    data[o + 1] = 128;
    data[o + 2] = 255;
    data[o + 3] = 255;
  }
  const t = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  t.needsUpdate = true;
  peelTex = t;
  return t;
}

export function brushedRoughness() {
  if (brushTex) return brushTex;
  const w = 256;
  const h = 64;
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const g = c.getContext('2d')!;
  const rnd = rand(0xb2a5);
  g.fillStyle = '#d0d0d0';
  g.fillRect(0, 0, w, h);
  for (let i = 0; i < 180; i++) {
    const y = rnd() * h;
    const v = 175 + Math.floor(rnd() * 70);
    g.strokeStyle = `rgba(${v},${v},${v},0.22)`;
    g.lineWidth = 1;
    g.beginPath();
    g.moveTo(0, y);
    g.lineTo(w, y);
    g.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  brushTex = t;
  return t;
}

/* ---------- materials: glossy candy-coated arcade vinyl/plastic ---------- */

export const plastic = (color: string, opts: Partial<THREE.MeshPhysicalMaterialParameters> = {}) =>
  new THREE.MeshPhysicalMaterial({
    color,
    metalness: 0.02,
    roughness: 0.22,
    clearcoat: 0.55,
    clearcoatRoughness: 0.14,
    envMapIntensity: 0.85,
    ...opts,
  });

/** bright mirror-silver chrome that gleams under studio lighting */
export const chrome = () =>
  new THREE.MeshStandardMaterial({
    color: REF.chrome,
    metalness: 0.9,
    roughness: 0.12,
    envMapIntensity: 1.5,
  });

/** satin brushed aluminium */
export const brushedMetal = () =>
  new THREE.MeshStandardMaterial({
    color: '#d4dce6',
    metalness: 0.7,
    roughness: 0.28,
    envMapIntensity: 1.15,
  });

/** dark anodised aluminium */
export const anodized = (color = '#2b3038') =>
  new THREE.MeshStandardMaterial({
    color,
    metalness: 0.55,
    roughness: 0.35,
    envMapIntensity: 0.85,
  });

/** matte rubber: feet, gaskets */
export const rubber = () =>
  new THREE.MeshStandardMaterial({
    color: '#19171c',
    roughness: 0.86,
    metalness: 0.02,
    envMapIntensity: 0.35,
  });

export const smokedAcrylic = () =>
  new THREE.MeshStandardMaterial({
    color: '#2a3038',
    metalness: 0,
    roughness: 0.1,
    transparent: true,
    opacity: 0.4,
    side: THREE.DoubleSide,
    envMapIntensity: 0.9,
    depthWrite: false,
  });

export const clearAcrylic = () =>
  new THREE.MeshStandardMaterial({
    color: '#eef6ff',
    metalness: 0,
    roughness: 0.05,
    transparent: true,
    opacity: 0.07,
    side: THREE.DoubleSide,
    envMapIntensity: 1.0,
    depthWrite: false,
  });

export const glassFake = (opts: Partial<THREE.MeshStandardMaterialParameters> = {}) =>
  new THREE.MeshStandardMaterial({
    color: '#eef9ff',
    metalness: 0.02,
    roughness: 0.04,
    transparent: true,
    opacity: 0.06,
    side: THREE.DoubleSide,
    depthWrite: false,
    envMapIntensity: 1.15,
    ...opts,
  });

export const matte = (color: string) =>
  new THREE.MeshStandardMaterial({
    color,
    roughness: 0.88,
    metalness: 0,
    envMapIntensity: 0.25,
  });

export const glow = (color: string, intensity = 1.15) =>
  new THREE.MeshStandardMaterial({
    color,
    emissive: new THREE.Color(color),
    emissiveIntensity: intensity,
    roughness: 0.28,
    metalness: 0,
    envMapIntensity: 0.35,
  });

/* ---------- vivid candy palette sampled from reference/target.png ---------- */

export const CAB = {
  pink: REF.framePink,
  pinkDeep: REF.framePinkShade,
  pinkInk: '#e02888',
  pinkPale: '#ffd6ec',
  azure: REF.sidePostBlue,
  azureMid: REF.panelBlue,
  azureDeep: REF.bandBlue,
  azurePale: '#cceeff',
  white: REF.bottomWhite,
  yellow: REF.buttonYellow,
  red: REF.knobRed,
  ink: REF.ink,
} as const;

export const candy = (color: string, opts: Partial<THREE.MeshPhysicalMaterialParameters> = {}) =>
  plastic(color, {
    roughness: 0.2,
    metalness: 0.02,
    clearcoat: 0.62,
    clearcoatRoughness: 0.12,
    envMapIntensity: 0.95,
    ...opts,
  });

export const printed = (map: THREE.Texture, opts: Partial<THREE.MeshStandardMaterialParameters> = {}) =>
  new THREE.MeshStandardMaterial({
    map: sharpenTexture(map),
    roughness: 0.32,
    metalness: 0,
    envMapIntensity: 0.55,
    ...opts,
  });

export const backlit = (map: THREE.Texture, intensity = 0.42) =>
  printed(map, {
    emissive: new THREE.Color('#ffffff'),
    emissiveMap: sharpenTexture(map),
    emissiveIntensity: intensity,
    roughness: 0.22,
    envMapIntensity: 0.45,
  });

export const PALETTE = D.colors;
