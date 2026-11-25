import * as THREE from 'three';
import { D } from './dims';

/* ---------- cached lightweight procedural helpers ---------- */

let grainTex: THREE.Texture | null = null;
let peelTex: THREE.DataTexture | null = null;
let brushTex: THREE.Texture | null = null;

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

/* ---------- materials (fast MeshStandardMaterial for crisp 60+ fps) ---------- */

export const plastic = (color: string, opts: Partial<THREE.MeshStandardMaterialParameters> = {}) =>
  new THREE.MeshStandardMaterial({
    color,
    metalness: 0.02,
    roughness: 0.24,
    envMapIntensity: 1.0,
    ...opts,
  });

/** bright silver chrome that stays gleaming under studio lighting */
export const chrome = () =>
  new THREE.MeshStandardMaterial({
    color: '#eef3f8',
    metalness: 0.78,
    roughness: 0.18,
    envMapIntensity: 1.45,
  });

/** satin brushed aluminium */
export const brushedMetal = () =>
  new THREE.MeshStandardMaterial({
    color: '#ccd3dc',
    metalness: 0.65,
    roughness: 0.34,
    envMapIntensity: 1.25,
  });

/** dark anodised aluminium */
export const anodized = (color = '#30343b') =>
  new THREE.MeshStandardMaterial({
    color,
    metalness: 0.55,
    roughness: 0.38,
    envMapIntensity: 1.0,
  });

/** matte rubber: feet, gaskets */
export const rubber = () =>
  new THREE.MeshStandardMaterial({
    color: '#1b181c',
    roughness: 0.88,
    metalness: 0,
    envMapIntensity: 0.4,
  });

export const smokedAcrylic = () =>
  new THREE.MeshStandardMaterial({
    color: '#2a3038',
    metalness: 0,
    roughness: 0.08,
    transparent: true,
    opacity: 0.42,
    side: THREE.DoubleSide,
    envMapIntensity: 1.3,
    depthWrite: false,
  });

export const clearAcrylic = () =>
  new THREE.MeshStandardMaterial({
    color: '#eef6ff',
    metalness: 0,
    roughness: 0.06,
    transparent: true,
    opacity: 0.07,
    side: THREE.DoubleSide,
    envMapIntensity: 1.3,
    depthWrite: false,
  });

export const glassFake = (opts: Partial<THREE.MeshStandardMaterialParameters> = {}) =>
  new THREE.MeshStandardMaterial({
    color: '#f4f9ff',
    metalness: 0.05,
    roughness: 0.05,
    transparent: true,
    opacity: 0.06,
    side: THREE.DoubleSide,
    depthWrite: false,
    envMapIntensity: 1.4,
    ...opts,
  });

export const matte = (color: string) =>
  new THREE.MeshStandardMaterial({
    color,
    roughness: 0.88,
    metalness: 0,
    envMapIntensity: 0.35,
  });

export const glow = (color: string, intensity = 1.0) =>
  new THREE.MeshStandardMaterial({
    color,
    emissive: new THREE.Color(color),
    emissiveIntensity: intensity,
    roughness: 0.3,
    metalness: 0,
    envMapIntensity: 0.4,
  });

/* ---------- candy palette: bright kawaii arcade cabinet ---------- */

export const CAB = {
  pink: '#f59ec6',
  pinkDeep: '#e56da6',
  pinkInk: '#d9458c',
  pinkPale: '#ffdcf0',
  azure: '#3594e8',
  azureMid: '#5cb5f7',
  azureDeep: '#2275cc',
  azurePale: '#d6f0ff',
  white: '#fcf9f7',
  yellow: '#ffd228',
  red: '#ec2934',
  ink: '#1a1620',
} as const;

export const candy = (color: string, opts: Partial<THREE.MeshStandardMaterialParameters> = {}) =>
  plastic(color, {
    roughness: 0.2,
    metalness: 0.02,
    envMapIntensity: 1.05,
    ...opts,
  });

export const printed = (map: THREE.Texture, opts: Partial<THREE.MeshStandardMaterialParameters> = {}) =>
  new THREE.MeshStandardMaterial({
    map,
    roughness: 0.36,
    metalness: 0,
    envMapIntensity: 0.75,
    ...opts,
  });

export const backlit = (map: THREE.Texture, intensity = 0.28) =>
  printed(map, {
    emissive: new THREE.Color('#ffffff'),
    emissiveMap: map,
    emissiveIntensity: intensity,
    roughness: 0.26,
    envMapIntensity: 0.55,
  });

export const PALETTE = D.colors;
