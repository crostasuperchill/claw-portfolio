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

  g.fillStyle = '#e2e2e2';
  g.fillRect(0, 0, size, size);

  // soft patches: slightly glossier / duller areas from mould flow
  for (let i = 0; i < 34; i++) {
    const x = rnd() * size;
    const y = rnd() * size;
    const r = 40 + rnd() * 140;
    const v = rnd() > 0.5 ? 255 : 186;
    const grad = g.createRadialGradient(x, y, 0, x, y, r);
    grad.addColorStop(0, `rgba(${v},${v},${v},0.18)`);
    grad.addColorStop(0.7, `rgba(${v},${v},${v},0.06)`);
    grad.addColorStop(1, 'rgba(226,226,226,0)');
    g.fillStyle = grad;
    g.beginPath();
    g.arc(x, y, r, 0, Math.PI * 2);
    g.fill();
  }

  // faint wipe marks: somebody dusted this machine with a dry cloth
  for (let i = 0; i < 26; i++) {
    const y = rnd() * size;
    const len = 60 + rnd() * 320;
    const x = rnd() * size;
    g.strokeStyle = rnd() > 0.5 ? 'rgba(255,255,255,0.12)' : 'rgba(150,150,150,0.09)';
    g.lineWidth = 2 + rnd() * 9;
    g.beginPath();
    g.moveTo(x, y);
    g.quadraticCurveTo(x + len * 0.5, y + (rnd() - 0.5) * 26, x + len, y + (rnd() - 0.5) * 8);
    g.stroke();
  }

  // fine mould grain
  for (let i = 0; i < 12000; i++) {
    const v = 196 + Math.floor(rnd() * 58);
    g.fillStyle = `rgba(${v},${v},${v},0.16)`;
    g.fillRect(rnd() * size, rnd() * size, 1.4, 1.4);
  }

  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(2.2, 2.2);
  t.anisotropy = 4;
  grainTex = t;
  return t;
}

/* ---------- procedurale: normal map "buccia d'arancia" ---------- */
/* Lo spessore di vernice di uno stampo a iniezione non è mai perfetto:      */
/* una perturbazione periodica e morbidissima delle normali rende i riflessi */
/* del clearcoat irregolari, che è il segnale visivo principale del "vero".  */

let peelTex: THREE.DataTexture | null = null;

export function orangePeelNormal(size = 256) {
  if (peelTex) return peelTex;

  const tau = Math.PI * 2;
  const waves: Array<{ fx: number; fy: number; a: number; px: number; py: number }> = [];
  let s = 0x7f4a7c15;
  const rnd = () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
  for (let i = 0; i < 9; i++) {
    const fx = 2 + Math.floor(rnd() * 13);
    const fy = 2 + Math.floor(rnd() * 13);
    waves.push({ fx, fy, a: 0.35 / (1 + i * 0.4), px: rnd() * tau, py: rnd() * tau });
  }

  const height = new Float32Array(size * size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = x / size;
      const v = y / size;
      let h = 0;
      for (const w of waves) {
        h += w.a * Math.sin(tau * (w.fx * u + w.px / tau)) * Math.cos(tau * (w.fy * v + w.py / tau));
      }
      height[y * size + x] = h;
    }
  }

  const data = new Uint8Array(size * size * 4);
  const k = size * 0.55;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const xm = (x - 1 + size) % size;
      const xp = (x + 1) % size;
      const ym = (y - 1 + size) % size;
      const yp = (y + 1) % size;
      const dx = (height[y * size + xp] - height[y * size + xm]) * k;
      const dy = (height[yp * size + x] - height[ym * size + x]) * k;
      const nx = -dx;
      const ny = -dy;
      const nz = 1;
      const len = Math.hypot(nx, ny, nz);
      const i = (y * size + x) * 4;
      data[i] = Math.round(((nx / len) * 0.5 + 0.5) * 255);
      data[i + 1] = Math.round(((ny / len) * 0.5 + 0.5) * 255);
      data[i + 2] = Math.round(((nz / len) * 0.5 + 0.5) * 255);
      data[i + 3] = 255;
    }
  }

  const t = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(1.6, 1.6);
  t.magFilter = THREE.LinearFilter;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.generateMipmaps = true;
  t.needsUpdate = true;
  peelTex = t;
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

/**
 * Plastica stampata a iniezione: clearcoat vero (lacca sopra il colore),
 * roughness e normali leggermente irregolari. Il clearcoat è lo strato che
 * riflette l'ambiente, quindi la sua rugosità/media perturbazione è quello che
 * distingue una foto da un render pastello.
 */
export const plastic = (color: string, opts: Partial<THREE.MeshPhysicalMaterialParameters> = {}) =>
  new THREE.MeshPhysicalMaterial({
    color,
    metalness: 0,
    roughness: 0.24,
    roughnessMap: microRoughness(),
    clearcoat: 1,
    clearcoatRoughness: 0.055,
    clearcoatNormalMap: orangePeelNormal(),
    clearcoatNormalScale: new THREE.Vector2(0.05, 0.05),
    envMapIntensity: 1.15,
    ...opts,
  });

/** cromo lucido: l'ambiente deve leggersi nella riflessione, non nel colore */
export const chrome = () =>
  new THREE.MeshPhysicalMaterial({
    color: '#eef2f6',
    metalness: 1,
    roughness: 0.07,
    envMapIntensity: 1.85,
  });

/** satin / brushed stainless: corner angles, lock plates, rails */
export const brushedMetal = () =>
  new THREE.MeshPhysicalMaterial({
    color: '#b7bcc1',
    metalness: 1,
    roughness: 0.42,
    roughnessMap: brushedRoughness(),
    envMapIntensity: 1.9,
    anisotropy: 0.85,
    anisotropyRotation: 0,
  });

/** dark anodised aluminium: control plate */
export const anodized = (color = '#303134') =>
  new THREE.MeshPhysicalMaterial({
    color,
    metalness: 0.86,
    roughness: 0.32,
    roughnessMap: brushedRoughness(),
    clearcoat: 0.35,
    clearcoatRoughness: 0.3,
    envMapIntensity: 1.2,
    anisotropy: 0.5,
  });

/** matte, slightly oily rubber: feet, gaskets, edge trim */
export const rubber = () =>
  new THREE.MeshStandardMaterial({
    color: '#141110',
    roughness: 0.88,
    metalness: 0,
    roughnessMap: microRoughness(),
    normalMap: orangePeelNormal(),
    normalScale: new THREE.Vector2(0.6, 0.6),
    envMapIntensity: 0.55,
  });

/** smoked acrylic prize flap */
export const smokedAcrylic = () =>
  new THREE.MeshPhysicalMaterial({
    color: '#2a3038',
    metalness: 0,
    roughness: 0.035,
    clearcoat: 1,
    clearcoatRoughness: 0.02,
    transparent: true,
    opacity: 0.46,
    ior: 1.49,
    side: THREE.DoubleSide,
    envMapIntensity: 1.9,
    depthWrite: false,
  });

/** clear acrylic window in front of the marquee print */
export const clearAcrylic = () =>
  new THREE.MeshPhysicalMaterial({
    color: '#eaf1ff',
    metalness: 0,
    roughness: 0.025,
    clearcoat: 1,
    clearcoatRoughness: 0.015,
    transparent: true,
    opacity: 0.12,
    ior: 1.49,
    side: THREE.DoubleSide,
    envMapIntensity: 2.0,
    depthWrite: false,
  });

/**
 * vetro "finto": nessuna trasmissione (che sfocherebbe la teca), solo velo
 * quasi invisibile + riflessi dell'ambiente. Quello che serve a far leggere
 * il pannello come vetro senza perdere le capsule dietro.
 */
export const glassFake = (opts: Partial<THREE.MeshPhysicalMaterialParameters> = {}) =>
  new THREE.MeshPhysicalMaterial({
    color: '#f3f7ff',
    metalness: 0,
    roughness: 0.028,
    clearcoat: 1,
    clearcoatRoughness: 0.018,
    transparent: true,
    opacity: 0.06,
    ior: 1.5,
    side: THREE.DoubleSide,
    depthWrite: false,
    envMapIntensity: 2.2,
    ...opts,
  });

export const matte = (color: string) =>
  new THREE.MeshStandardMaterial({
    color,
    roughness: 0.92,
    metalness: 0,
    roughnessMap: microRoughness(),
    envMapIntensity: 0.4,
  });

export const glow = (color: string, intensity = 1.6) =>
  new THREE.MeshStandardMaterial({
    color,
    emissive: new THREE.Color(color),
    emissiveIntensity: intensity,
    roughness: 0.38,
    metalness: 0,
    envMapIntensity: 0.35,
  });

/* ---------- candy palette: UFO catcher ---------- */
/* the machine reads as glossy moulded plastic in five flat mouldings,
   not as one tinted steel box: baby pink structure, azure play area,
   porcelain white belly, canary yellow controls, near-black rubber.   */

export const CAB = {
  pink: '#f2a7c3',
  pinkDeep: '#dd7ba6',
  pinkInk: '#d94f8b',
  pinkPale: '#ffd9e8',
  azure: '#3f8fe0',
  azureMid: '#5aa9e6',
  azureDeep: '#2f78c6',
  azurePale: '#c9ebff',
  white: '#fbf8f5',
  yellow: '#ffd21e',
  red: '#e8262b',
  ink: '#17141a',
} as const;

/** glossy injection-moulded shell: soft clearcoat, no metal */
export const candy = (color: string, opts: Partial<THREE.MeshPhysicalMaterialParameters> = {}) =>
  plastic(color, {
    roughness: 0.2,
    clearcoat: 1,
    clearcoatRoughness: 0.06,
    envMapIntensity: 1.3,
    ...opts,
  });

/** printed vinyl / silkscreen panel: texture is the whole look */
export const printed = (map: THREE.Texture, opts: Partial<THREE.MeshPhysicalMaterialParameters> = {}) =>
  new THREE.MeshPhysicalMaterial({
    map,
    roughness: 0.4,
    metalness: 0,
    roughnessMap: microRoughness(),
    clearcoat: 0.55,
    clearcoatRoughness: 0.15,
    clearcoatNormalMap: orangePeelNormal(),
    clearcoatNormalScale: new THREE.Vector2(0.035, 0.035),
    envMapIntensity: 0.9,
    ...opts,
  });

/** back-lit marquee print: map doubles as emissive so it glows */
export const backlit = (map: THREE.Texture, intensity = 0.42) =>
  printed(map, {
    emissive: new THREE.Color('#ffffff'),
    emissiveMap: map,
    emissiveIntensity: intensity,
    roughness: 0.34,
    clearcoat: 0.8,
    clearcoatRoughness: 0.06,
    envMapIntensity: 0.7,
  });

export const PALETTE = D.colors;
