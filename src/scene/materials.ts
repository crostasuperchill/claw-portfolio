import * as THREE from 'three';
import { D } from './dims';

/* ---------- procedurale: micro-grana per le plastiche ---------- */
/* gives every moulded panel a slightly uneven clearcoat / roughness,
   so the shell does not read as one perfectly uniform material.      */

let grainTex: THREE.Texture | null = null;

function rand(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

export function microRoughness() {
  if (grainTex) return grainTex;
  const size = 512;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d')!;
  const rnd = rand(0x51ace);

  g.fillStyle = '#e4e4e4';
  g.fillRect(0, 0, size, size);

  // soft patches: slightly glossier / duller areas from mould flow
  for (let i = 0; i < 30; i++) {
    const x = rnd() * size;
    const y = rnd() * size;
    const r = 40 + rnd() * 130;
    const v = rnd() > 0.5 ? 255 : 196;
    const grad = g.createRadialGradient(x, y, 0, x, y, r);
    grad.addColorStop(0, `rgba(${v},${v},${v},0.16)`);
    grad.addColorStop(0.7, `rgba(${v},${v},${v},0.05)`);
    grad.addColorStop(1, 'rgba(228,228,228,0)');
    g.fillStyle = grad;
    g.beginPath();
    g.arc(x, y, r, 0, Math.PI * 2);
    g.fill();
  }

  // fine mould grain
  for (let i = 0; i < 14000; i++) {
    const v = 198 + Math.floor(rnd() * 57);
    g.fillStyle = `rgba(${v},${v},${v},0.32)`;
    g.fillRect(rnd() * size, rnd() * size, 1.2, 1.2);
  }

  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(2.2, 2.2);
  t.anisotropy = 4;
  grainTex = t;
  return t;
}

/* ---------- procedurale: metallo spazzolato ---------- */

let brushTex: THREE.Texture | null = null;

export function brushedRoughness() {
  if (brushTex) return brushTex;
  const w = 1024;
  const h = 256;
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const g = c.getContext('2d')!;
  const rnd = rand(0xb2a5);

  g.fillStyle = '#cccccc';
  g.fillRect(0, 0, w, h);

  // long horizontal scratches -> anisotropic highlights
  for (let i = 0; i < 2600; i++) {
    const y = rnd() * h;
    const v = 150 + Math.floor(rnd() * 105);
    g.strokeStyle = `rgba(${v},${v},${v},${0.08 + rnd() * 0.34})`;
    g.lineWidth = rnd() < 0.8 ? 1 : 1.8;
    const x0 = rnd() * w;
    const len = 30 + rnd() * 420;
    g.beginPath();
    g.moveTo(x0, y);
    g.lineTo(x0 + len, y + (rnd() - 0.5) * 0.8);
    g.stroke();
  }

  // sparse deeper brush marks
  for (let i = 0; i < 90; i++) {
    const y = rnd() * h;
    g.strokeStyle = `rgba(90,90,90,${0.06 + rnd() * 0.12})`;
    g.lineWidth = 2.2;
    g.beginPath();
    g.moveTo(0, y);
    g.lineTo(w, y + (rnd() - 0.5) * 2);
    g.stroke();
  }

  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(2.5, 1);
  t.anisotropy = 4;
  brushTex = t;
  return t;
}

/* ---------- materiali ---------- */

export const plastic = (color: string, opts: Partial<THREE.MeshPhysicalMaterialParameters> = {}) =>
  new THREE.MeshPhysicalMaterial({
    color,
    metalness: 0,
    roughness: 0.22,
    clearcoat: 1,
    clearcoatRoughness: 0.05,
    envMapIntensity: 1.1,
    ...opts,
  });

export const chrome = () =>
  new THREE.MeshPhysicalMaterial({
    color: '#dfe3e8',
    metalness: 1,
    roughness: 0.12,
    envMapIntensity: 1.4,
  });

/** satin / brushed stainless: corner angles, lock plates, rails */
export const brushedMetal = () =>
  new THREE.MeshPhysicalMaterial({
    color: '#b4b9be',
    metalness: 1,
    roughness: 0.52,
    roughnessMap: brushedRoughness(),
    envMapIntensity: 1.75,
    anisotropy: 0.85,
    anisotropyRotation: 0,
  });

/** dark anodised aluminium: control plate */
export const anodized = (color = '#303134') =>
  new THREE.MeshPhysicalMaterial({
    color,
    metalness: 0.86,
    roughness: 0.36,
    roughnessMap: brushedRoughness(),
    clearcoat: 0.45,
    clearcoatRoughness: 0.28,
    envMapIntensity: 1.15,
    anisotropy: 0.5,
  });

/** matte, slightly oily rubber: feet, gaskets, edge trim */
export const rubber = () =>
  new THREE.MeshStandardMaterial({
    color: '#131110',
    roughness: 0.94,
    metalness: 0,
    roughnessMap: microRoughness(),
  });

/** smoked acrylic prize flap */
export const smokedAcrylic = () =>
  new THREE.MeshPhysicalMaterial({
    color: '#2a3038',
    metalness: 0,
    roughness: 0.04,
    clearcoat: 1,
    clearcoatRoughness: 0.03,
    transparent: true,
    opacity: 0.42,
    ior: 1.49,
    side: THREE.DoubleSide,
    envMapIntensity: 1.6,
    depthWrite: false,
  });

/** clear acrylic window in front of the marquee print */
export const clearAcrylic = () =>
  new THREE.MeshPhysicalMaterial({
    color: '#eaf1ff',
    metalness: 0,
    roughness: 0.035,
    clearcoat: 1,
    clearcoatRoughness: 0.02,
    transparent: true,
    opacity: 0.16,
    ior: 1.49,
    side: THREE.DoubleSide,
    envMapIntensity: 1.5,
    depthWrite: false,
  });

export const matte = (color: string) =>
  new THREE.MeshStandardMaterial({ color, roughness: 0.9, metalness: 0 });

export const glow = (color: string, intensity = 1.4) =>
  new THREE.MeshStandardMaterial({
    color,
    emissive: new THREE.Color(color),
    emissiveIntensity: intensity,
    roughness: 0.4,
    metalness: 0,
  });

export const PALETTE = D.colors;
