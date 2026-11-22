import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import {
  PALETTE,
  anodized,
  brushedMetal,
  chrome,
  clearAcrylic,
  glow,
  matte,
  microRoughness,
  plastic,
  rubber,
  smokedAcrylic,
} from './materials';
import { decalMesh } from './decals';
import type { UvRect } from '../contracts';

/* ------------------------------------------------------------------ */
/* textures                                                            */
/* ------------------------------------------------------------------ */

let marqueeTex: THREE.Texture | null = null;

function marqueeTexture() {
  if (marqueeTex) return marqueeTex;
  const c = document.createElement('canvas');
  c.width = 1024;
  c.height = 320;
  const g = c.getContext('2d')!;

  // lit acrylic: gradient + diffuser ribs, not a flat fill
  const grad = g.createLinearGradient(0, 0, 0, 320);
  grad.addColorStop(0, '#3357ff');
  grad.addColorStop(0.55, '#2440ef');
  grad.addColorStop(1, '#16249c');
  g.fillStyle = grad;
  g.fillRect(0, 0, 1024, 320);

  const hot = g.createRadialGradient(512, 128, 30, 512, 128, 430);
  hot.addColorStop(0, 'rgba(255,255,255,0.18)');
  hot.addColorStop(0.55, 'rgba(255,255,255,0.06)');
  hot.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = hot;
  g.fillRect(0, 0, 1024, 320);

  for (let x = 0; x < 1024; x += 6) {
    g.fillStyle = 'rgba(255,255,255,0.035)';
    g.fillRect(x, 0, 1, 320);
  }

  const vig = g.createLinearGradient(0, 0, 0, 320);
  vig.addColorStop(0, 'rgba(0,0,0,0.20)');
  vig.addColorStop(0.22, 'rgba(0,0,0,0)');
  vig.addColorStop(0.8, 'rgba(0,0,0,0)');
  vig.addColorStop(1, 'rgba(0,0,0,0.26)');
  g.fillStyle = vig;
  g.fillRect(0, 0, 1024, 320);

  g.strokeStyle = 'rgba(255,255,255,0.16)';
  g.lineWidth = 3;
  g.strokeRect(16, 14, 992, 292);

  g.fillStyle = '#ffffff';
  g.font = '800 132px Inter, Helvetica, Arial, sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText('DAVIDE', 512, 118);

  g.fillStyle = '#ffc21a';
  g.font = '700 46px Inter, Helvetica, Arial, sans-serif';
  g.letterSpacing = '14px';
  g.fillText('PRIZE CATCHER', 512, 216);

  g.fillStyle = 'rgba(255,255,255,.6)';
  g.font = '600 34px "Hiragino Sans", Inter, sans-serif';
  g.fillText('けんびき', 512, 278);

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  marqueeTex = tex;
  return tex;
}

function haloTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d')!;
  const rg = g.createRadialGradient(128, 128, 8, 128, 128, 126);
  rg.addColorStop(0, 'rgba(255,255,255,0.10)');
  rg.addColorStop(0.3, 'rgba(255,255,255,0.06)');
  rg.addColorStop(0.46, 'rgba(255,255,255,0.34)');
  rg.addColorStop(0.62, 'rgba(255,255,255,0.16)');
  rg.addColorStop(0.82, 'rgba(255,255,255,0.03)');
  rg.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = rg;
  g.fillRect(0, 0, 256, 256);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function spillTexture() {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 128;
  const g = c.getContext('2d')!;
  const lg = g.createLinearGradient(0, 0, 0, 128);
  lg.addColorStop(0, 'rgba(255,255,255,0.55)');
  lg.addColorStop(0.5, 'rgba(255,255,255,0.16)');
  lg.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = lg;
  g.fillRect(0, 0, 256, 128);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** soft specular band for glass / smoked acrylic */
function streakTexture() {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 32;
  const g = c.getContext('2d')!;
  const lg = g.createLinearGradient(0, 0, 256, 0);
  lg.addColorStop(0, 'rgba(255,255,255,0)');
  lg.addColorStop(0.42, 'rgba(255,255,255,0.75)');
  lg.addColorStop(0.58, 'rgba(255,255,255,0.55)');
  lg.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = lg;
  g.fillRect(0, 0, 256, 32);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** irregular smudge / scuff mask */
function scuffTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d')!;
  let s = 0x51f0c;
  const rnd = () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
  for (let i = 0; i < 34; i++) {
    const x = 20 + rnd() * 88;
    const y = 30 + rnd() * 68;
    const rx = 2 + rnd() * 14;
    const ry = 1 + rnd() * 5;
    g.fillStyle = `rgba(255,255,255,${0.05 + rnd() * 0.14})`;
    g.beginPath();
    g.ellipse(x, y, rx, ry, (rnd() - 0.5) * 1.2, 0, Math.PI * 2);
    g.fill();
  }
  for (let i = 0; i < 10; i++) {
    g.strokeStyle = `rgba(255,255,255,${0.1 + rnd() * 0.2})`;
    g.lineWidth = 0.8 + rnd() * 1.2;
    const x = 15 + rnd() * 80;
    const y = 40 + rnd() * 55;
    g.beginPath();
    g.moveTo(x, y);
    g.lineTo(x + 10 + rnd() * 30, y + (rnd() - 0.5) * 4);
    g.stroke();
  }
  // keep it edge-soft
  const vg = g.createRadialGradient(64, 64, 20, 64, 64, 64);
  vg.addColorStop(0, 'rgba(0,0,0,0)');
  vg.addColorStop(1, 'rgba(0,0,0,1)');
  g.globalCompositeOperation = 'destination-out';
  g.fillStyle = vg;
  g.fillRect(0, 0, 128, 128);
  g.globalCompositeOperation = 'source-over';
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function torxTexture() {
  const s = 128;
  const c = document.createElement('canvas');
  c.width = c.height = s;
  const g = c.getContext('2d')!;
  const rg = g.createRadialGradient(s * 0.36, s * 0.32, 2, s * 0.5, s * 0.5, s * 0.5);
  rg.addColorStop(0, '#f0f2f4');
  rg.addColorStop(0.55, '#c2c6ca');
  rg.addColorStop(1, '#7d8288');
  g.fillStyle = rg;
  g.beginPath();
  g.arc(s / 2, s / 2, s / 2 - 1, 0, Math.PI * 2);
  g.fill();

  g.strokeStyle = 'rgba(0,0,0,0.35)';
  g.lineWidth = 3;
  g.beginPath();
  g.arc(s / 2, s / 2, s / 2 - 5, 0, Math.PI * 2);
  g.stroke();

  // six-lobe torx recess
  g.fillStyle = '#262421';
  g.beginPath();
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2 - Math.PI / 2;
    const r = i % 2 === 0 ? s * 0.2 : s * 0.105;
    const x = s / 2 + Math.cos(a) * r;
    const y = s / 2 + Math.sin(a) * r;
    if (i === 0) g.moveTo(x, y);
    else g.lineTo(x, y);
  }
  g.closePath();
  g.fill();

  g.strokeStyle = 'rgba(255,255,255,0.35)';
  g.lineWidth = 2;
  g.beginPath();
  g.arc(s / 2, s / 2, s * 0.26, 0, Math.PI * 2);
  g.stroke();

  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

function innerShadowTexture() {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 128;
  const g = c.getContext('2d')!;
  const lg = g.createLinearGradient(0, 0, 0, 128);
  lg.addColorStop(0, 'rgba(0,0,0,0.92)');
  lg.addColorStop(0.42, 'rgba(0,0,0,0.6)');
  lg.addColorStop(0.8, 'rgba(0,0,0,0.28)');
  lg.addColorStop(1, 'rgba(0,0,0,0.12)');
  g.fillStyle = lg;
  g.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** soft gradient used as fake contact shadow / grime along joints */
function fadeTexture(dark = 0.55) {
  const c = document.createElement('canvas');
  c.width = 32;
  c.height = 128;
  const g = c.getContext('2d')!;
  const lg = g.createLinearGradient(0, 0, 0, 128);
  lg.addColorStop(0, `rgba(0,0,0,${dark})`);
  lg.addColorStop(0.3, `rgba(0,0,0,${dark * 0.45})`);
  lg.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = lg;
  g.fillRect(0, 0, 32, 128);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/* ------------------------------------------------------------------ */
/* geometry helpers                                                    */
/* ------------------------------------------------------------------ */

type Face = 'front' | 'back' | 'left' | 'right' | 'top' | 'bottom';

type ScrewSpec = { x: number; y: number; z: number; face: Face; s?: number };

function faceEuler(face: Face) {
  switch (face) {
    case 'back':
      return new THREE.Euler(0, Math.PI, 0);
    case 'left':
      return new THREE.Euler(0, -Math.PI / 2, 0);
    case 'right':
      return new THREE.Euler(0, Math.PI / 2, 0);
    case 'top':
      return new THREE.Euler(-Math.PI / 2, 0, 0);
    case 'bottom':
      return new THREE.Euler(Math.PI / 2, 0, 0);
    default:
      return new THREE.Euler(0, 0, 0);
  }
}

function buildScrews(parent: THREE.Object3D, specs: ScrewSpec[]) {
  if (!specs.length) return;
  const geo = new THREE.CylinderGeometry(0.0067, 0.0073, 0.0026, 12);
  geo.rotateX(Math.PI / 2);
  const mat = new THREE.MeshPhysicalMaterial({
    map: torxTexture(),
    metalness: 0.95,
    roughness: 0.4,
    envMapIntensity: 1.35,
  });
  const inst = new THREE.InstancedMesh(geo, mat, specs.length);
  const m = new THREE.Matrix4();
  const p = new THREE.Vector3();
  const q = new THREE.Quaternion();
  const sc = new THREE.Vector3();
  specs.forEach((sp, i) => {
    q.setFromEuler(faceEuler(sp.face));
    const k = sp.s ?? 1;
    sc.set(k, k, k);
    m.compose(p.set(sp.x, sp.y, sp.z), q, sc);
    inst.setMatrixAt(i, m);
  });
  inst.instanceMatrix.needsUpdate = true;
  parent.add(inst);

  // a thin stainless washer under every head: reads as a real fastener
  const wgeo = new THREE.CylinderGeometry(0.0102, 0.0104, 0.0011, 16);
  wgeo.rotateX(Math.PI / 2);
  const wmat = brushedMetal();
  const washers = new THREE.InstancedMesh(wgeo, wmat, specs.length);
  specs.forEach((sp, i) => {
    q.setFromEuler(faceEuler(sp.face));
    const k = (sp.s ?? 1) * 0.98;
    sc.set(k, k, k);
    m.compose(p.set(sp.x, sp.y, sp.z), q, sc);
    washers.setMatrixAt(i, m);
  });
  washers.instanceMatrix.needsUpdate = true;
  parent.add(washers);
}

type Batch = {
  box: (w: number, h: number, d: number, x: number, y: number, z: number, ry?: number) => void;
  cyl: (r: number, h: number, x: number, y: number, z: number, axis?: 'x' | 'y' | 'z', seg?: number) => void;
  raw: (geo: THREE.BufferGeometry) => void;
  finish: (mat: THREE.Material, parent: THREE.Object3D, castShadow?: boolean) => THREE.Mesh | null;
};

function makeBatch(): Batch {
  const geos: THREE.BufferGeometry[] = [];
  return {
    box(w, h, d, x, y, z, ry = 0) {
      const g = new THREE.BoxGeometry(w, h, d);
      if (ry) g.rotateY(ry);
      g.translate(x, y, z);
      geos.push(g);
    },
    cyl(r, h, x, y, z, axis = 'y', seg = 10) {
      const g = new THREE.CylinderGeometry(r, r, h, seg);
      if (axis === 'x') g.rotateZ(Math.PI / 2);
      else if (axis === 'z') g.rotateX(Math.PI / 2);
      g.translate(x, y, z);
      geos.push(g);
    },
    raw(g) {
      geos.push(g);
    },
    finish(mat, parent, castShadow = true) {
      if (!geos.length) return null;
      const merged = mergeGeometries(geos, false);
      geos.forEach((g) => g.dispose());
      geos.length = 0;
      if (!merged) return null;
      const mesh = new THREE.Mesh(merged, mat);
      mesh.castShadow = castShadow;
      mesh.receiveShadow = true;
      parent.add(mesh);
      return mesh;
    },
  };
}

/* ------------------------------------------------------------------ */
/* public glass material (kept for the cabinet API)                    */
/* ------------------------------------------------------------------ */

export function glassMaterial() {
  const cheap =
    new URLSearchParams(location.search).has('notrans') ||
    (typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches);
  return new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    metalness: 0,
    transmission: cheap ? 0 : 1,
    opacity: cheap ? 0.1 : 1,
    thickness: 0.012,
    ior: 1.46,
    roughness: cheap ? 0.015 : 0.03,
    transparent: true,
    side: THREE.DoubleSide,
    envMapIntensity: cheap ? 2.8 : 1.2,
    specularIntensity: 1,
    reflectivity: 1,
  });
}

/* ------------------------------------------------------------------ */
/* cabinet                                                             */
/* ------------------------------------------------------------------ */

export function buildCabinet(atlas: THREE.Texture, rects: Record<string, UvRect>) {
  const root = new THREE.Group();

  /* ---------------- materials: not one uniform plastic ---------------- */

  const shell = plastic('#f3ecdf', {
    roughness: 0.35,
    clearcoatRoughness: 0.2,
    roughnessMap: microRoughness(),
    envMapIntensity: 1.05,
  });
  const shellDeck = plastic('#f7f1e6', {
    roughness: 0.23,
    clearcoatRoughness: 0.07,
    roughnessMap: microRoughness(),
    envMapIntensity: 1.2,
  });
  const pinkFront = plastic(PALETTE.pink, {
    roughness: 0.29,
    clearcoatRoughness: 0.1,
    roughnessMap: microRoughness(),
  });
  const pinkSide = plastic(PALETTE.pink, {
    roughness: 0.38,
    clearcoatRoughness: 0.24,
    roughnessMap: microRoughness(),
  });
  const blueGloss = plastic(PALETTE.blue, {
    roughness: 0.18,
    clearcoatRoughness: 0.04,
    roughnessMap: microRoughness(),
  });
  const blueSatin = plastic(PALETTE.blue, {
    roughness: 0.42,
    clearcoatRoughness: 0.32,
    roughnessMap: microRoughness(),
  });
  const chamberPaint = plastic('#f2ebdc', {
    roughness: 0.52,
    clearcoatRoughness: 0.4,
    roughnessMap: microRoughness(),
  });
  const dark = matte('#1d1b18');
  const joint = matte('#17130f');
  const jointSoft = matte('#2b2521');
  const brush = brushedMetal();
  const rub = rubber();
  const smoke = smokedAcrylic();
  const clear = clearAcrylic();
  const glass = glassMaterial();

  /* ---------------- detail batches ---------------- */

  const jointB = makeBatch();
  const rubberB = makeBatch();
  const brushB = makeBatch();
  const chromeB = makeBatch();
  const darkB = makeBatch();
  const screwSpecs: ScrewSpec[] = [];
  const screw = (x: number, y: number, z: number, face: Face, s = 1) =>
    screwSpecs.push({ x, y, z, face, s });

  /* ---------------- plinth / base / feet ---------------- */

  const plinth = new THREE.Mesh(new RoundedBoxGeometry(1.02, 0.585, 0.78, 5, 0.042), shell);
  plinth.position.y = 0.3275; // bottom 0.035 -> shadow gap + visible feet
  plinth.castShadow = true;
  plinth.receiveShadow = true;
  root.add(plinth);

  // recessed under-frame: keeps the belly dark without faking a solid plinth
  const base = new THREE.Mesh(new RoundedBoxGeometry(0.88, 0.012, 0.64, 2, 0.006), dark);
  base.position.y = 0.0295;
  root.add(base);

  for (const [x, z] of [
    [-0.45, 0.325],
    [0.45, 0.325],
    [-0.45, -0.325],
    [0.45, -0.325],
  ]) {
    const pad = new THREE.CylinderGeometry(0.034, 0.04, 0.024, 20);
    pad.translate(x, 0.012, z);
    rubberB.raw(pad);
    const ring = new THREE.TorusGeometry(0.036, 0.0048, 6, 20);
    ring.rotateX(Math.PI / 2);
    ring.translate(x, 0.019, z);
    rubberB.raw(ring);
    // visible levelling foot: brushed collar + a sliver of thread
    brushB.cyl(0.027, 0.016, x, 0.033, z, 'y', 16);
    brushB.cyl(0.019, 0.006, x, 0.026, z, 'y', 12);
  }

  /* ---------------- lower front panel ---------------- */

  const panel = new THREE.Mesh(new RoundedBoxGeometry(0.9, 0.46, 0.012, 2, 0.004), pinkFront);
  panel.position.set(0, 0.37, 0.387);
  panel.receiveShadow = true;
  root.add(panel);

  // panel-in-shell reveal: 2 mm dark joints around the pink laminate
  jointB.box(0.906, 0.004, 0.005, 0, 0.1425, 0.3935);
  jointB.box(0.004, 0.256, 0.005, -0.4505, 0.2715, 0.3935);
  jointB.box(0.004, 0.256, 0.005, 0.4505, 0.2715, 0.3935);
  // shadow line under the protruding console
  jointB.box(0.93, 0.0045, 0.006, 0, 0.3985, 0.3938);

  // screws in the laminate corners
  screw(-0.437, 0.383, 0.3945, 'front', 0.9);
  screw(0.437, 0.383, 0.3945, 'front', 0.9);
  screw(-0.437, 0.158, 0.3945, 'front', 0.9);
  screw(0.437, 0.158, 0.3945, 'front', 0.9);

  // soft contact shadows: the console overhangs, so the laminate darkens under it
  const fade = fadeTexture(0.62);
  const softShadow = (w: number, h: number, x: number, y: number, z: number, opacity: number, flip = 0) => {
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(w, h),
      new THREE.MeshBasicMaterial({
        map: fade,
        color: '#000000',
        transparent: true,
        opacity,
        depthWrite: false,
      })
    );
    m.position.set(x, y, z);
    m.rotation.z = flip;
    m.renderOrder = 1;
    root.add(m);
    return m;
  };
  softShadow(0.94, 0.075, 0, 0.3625, 0.3942, 0.62);
  softShadow(0.9, 0.05, 0, 0.171, 0.3943, 0.42, Math.PI);

  /* ---------------- prize door ---------------- */

  const doorX = -0.27;
  const doorY = 0.315;
  const doorOut = 0.3;
  const doorH = 0.17;
  const barS = 0.038;
  const barH = 0.026;
  const innerSpan = doorOut - barS * 2;
  const apW = innerSpan - 0.004;
  const apH = doorH - barH * 2 - 0.004;
  const apTop = doorY + apH / 2;
  const apBottom = doorY - apH / 2;

  const cavityMat = new THREE.MeshStandardMaterial({
    color: '#1b1510',
    roughness: 0.82,
    metalness: 0,
    side: THREE.DoubleSide,
  });

  // real recess: back panel + floor + ceiling + side cheeks, 15 mm behind the flap
  const cavity = new THREE.Mesh(
    new THREE.PlaneGeometry(doorOut - 0.02, doorH - 0.02),
    new THREE.MeshBasicMaterial({ color: '#080706' })
  );
  cavity.position.set(doorX, doorY, 0.3938);
  root.add(cavity);

  const shadow = new THREE.Mesh(
    new THREE.PlaneGeometry(doorOut - 0.02, doorH - 0.02),
    new THREE.MeshBasicMaterial({
      map: innerShadowTexture(),
      transparent: true,
      depthWrite: false,
    })
  );
  shadow.position.set(doorX, doorY, 0.3941);
  root.add(shadow);

  const floor = new THREE.Mesh(new THREE.PlaneGeometry(apW, 0.0165), cavityMat);
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(doorX, apBottom + 0.001, 0.4007);
  root.add(floor);
  const ceiling = new THREE.Mesh(new THREE.PlaneGeometry(apW, 0.0165), cavityMat);
  ceiling.rotation.x = Math.PI / 2;
  ceiling.position.set(doorX, apTop - 0.001, 0.4007);
  root.add(ceiling);
  for (const s of [-1, 1]) {
    const cheek = new THREE.Mesh(new THREE.PlaneGeometry(0.0165, apH), cavityMat);
    cheek.rotation.y = s * (Math.PI / 2);
    cheek.position.set(doorX + s * (apW / 2 - 0.001), doorY, 0.4007);
    root.add(cheek);
  }

  const innerWarm = new THREE.Mesh(
    new THREE.PlaneGeometry(0.16, 0.06),
    new THREE.MeshBasicMaterial({
      color: '#ffc98f',
      transparent: true,
      opacity: 0.4,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    })
  );
  innerWarm.position.set(doorX, doorY - 0.033, 0.3955);
  root.add(innerWarm);

  // warm strip light in the throat of the chute
  const chuteLED = new THREE.Mesh(
    new THREE.BoxGeometry(0.17, 0.004, 0.004),
    glow('#ffc78a', 1.3)
  );
  chuteLED.position.set(doorX, apBottom + 0.007, 0.3975);
  root.add(chuteLED);

  // blue outer bezel, mitred bars
  const barMat = blueGloss;
  const leftBar = new THREE.Mesh(new RoundedBoxGeometry(barS, doorH, 0.016, 2, 0.004), barMat);
  leftBar.position.set(doorX - (doorOut / 2 - barS / 2), doorY, 0.4005);
  root.add(leftBar);
  const rightBar = leftBar.clone();
  rightBar.position.x = doorX + (doorOut / 2 - barS / 2);
  root.add(rightBar);
  const topBar = new THREE.Mesh(new RoundedBoxGeometry(innerSpan, barH, 0.016, 2, 0.004), barMat);
  topBar.position.set(doorX, doorY + (doorH / 2 - barH / 2), 0.4005);
  root.add(topBar);
  const bottomBar = topBar.clone();
  bottomBar.position.y = doorY - (doorH / 2 - barH / 2);
  root.add(bottomBar);
  for (const m of [leftBar, rightBar, topBar, bottomBar]) {
    m.castShadow = true;
    m.receiveShadow = true;
  }

  // dark reveal around the bezel against the laminate
  jointB.box(0.004, doorH + 0.006, 0.006, doorX - doorOut / 2, doorY, 0.3975);
  jointB.box(0.004, doorH + 0.006, 0.006, doorX + doorOut / 2, doorY, 0.3975);
  jointB.box(doorOut + 0.006, 0.004, 0.006, doorX, doorY + doorH / 2, 0.3975);
  jointB.box(doorOut + 0.006, 0.004, 0.006, doorX, doorY - doorH / 2, 0.3975);

  // brushed inner bezel around the aperture
  brushB.box(0.007, apH, 0.006, doorX - apW / 2, doorY, 0.408);
  brushB.box(0.007, apH, 0.006, doorX + apW / 2, doorY, 0.408);
  brushB.box(apW, 0.007, 0.006, doorX, doorY + apH / 2, 0.408);
  brushB.box(apW, 0.007, 0.006, doorX, doorY - apH / 2, 0.408);

  // smoked flap, top-hinged, with a polished acrylic edge
  const flapGroup = new THREE.Group();
  flapGroup.position.set(doorX, doorY - 0.002, 0.4105);
  flapGroup.rotation.x = -0.06;
  root.add(flapGroup);

  const flapW = apW - 0.008;
  const flapH = apH - 0.006;
  const flap = new THREE.Mesh(new RoundedBoxGeometry(flapW, flapH, 0.003, 2, 0.002), smoke);
  flap.renderOrder = 2;
  flapGroup.add(flap);

  const polishedEdge = plastic('#dfe7f0', { roughness: 0.08, clearcoatRoughness: 0.03 });
  for (const y of [-flapH / 2 + 0.0018, flapH / 2 - 0.0018]) {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(flapW - 0.003, 0.0036, 0.0042), polishedEdge);
    bar.position.set(0, y, 0.0008);
    flapGroup.add(bar);
  }
  for (const x of [-flapW / 2 + 0.0018, flapW / 2 - 0.0018]) {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(0.0036, flapH - 0.003, 0.0042), polishedEdge);
    bar.position.set(x, 0, 0.0008);
    flapGroup.add(bar);
  }

  // specular band on the acrylic
  const flapStreak = new THREE.Mesh(
    new THREE.PlaneGeometry(0.18, 0.03),
    new THREE.MeshBasicMaterial({
      map: streakTexture(),
      transparent: true,
      opacity: 0.3,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    })
  );
  flapStreak.position.set(doorX - 0.01, doorY + 0.026, 0.4142);
  flapStreak.rotation.z = 0.24;
  flapStreak.renderOrder = 3;
  root.add(flapStreak);

  // hinge rod + knuckle plates
  chromeB.cyl(0.0038, apW + 0.004, doorX, apTop + 0.007, 0.4115, 'x', 10);
  for (const s of [-1, 1]) {
    brushB.box(0.028, 0.013, 0.008, doorX + s * 0.07, apTop + 0.007, 0.4108);
  }

  // pull handle standing off the flap
  chromeB.cyl(0.0042, 0.13, doorX, apBottom + 0.018, 0.418, 'x', 10);
  for (const s of [-1, 1]) {
    chromeB.cyl(0.0032, 0.009, doorX + s * 0.055, apBottom + 0.018, 0.4145, 'z', 8);
  }

  // chrome sill at the mouth of the chute
  chromeB.cyl(0.0038, apW - 0.01, doorX, apBottom + 0.002, 0.4085, 'x', 10);
  brushB.box(0.03, 0.012, 0.006, doorX, apBottom - 0.008, 0.4085);

  // prize aperture screws
  for (const sx of [-1, 1]) {
    for (const sy of [-1, 1]) {
      screw(
        doorX + sx * (doorOut / 2 - 0.017),
        doorY + sy * (doorH / 2 - 0.014),
        0.4093,
        'front',
        0.85
      );
    }
  }

  /* ---------------- riser between console and glass ---------------- */

  const riser = new THREE.Mesh(new RoundedBoxGeometry(0.995, 0.116, 0.02, 2, 0.006), shell);
  riser.position.set(0, 0.657, 0.383);
  riser.receiveShadow = true;
  riser.castShadow = true;
  root.add(riser);

  jointB.box(0.99, 0.0045, 0.005, 0, 0.6005, 0.3938);
  jointB.box(0.99, 0.0045, 0.005, 0, 0.714, 0.3938);
  jointB.box(0.004, 0.116, 0.005, -0.4925, 0.657, 0.3938);
  jointB.box(0.004, 0.116, 0.005, 0.4925, 0.657, 0.3938);
  softShadow(0.94, 0.055, 0, 0.692, 0.3942, 0.5);

  // service lock on the riser
  brushB.box(0.062, 0.03, 0.005, 0.36, 0.66, 0.3945);
  chromeB.cyl(0.0115, 0.009, 0.36, 0.66, 0.3975, 'z', 16);
  jointB.box(0.0035, 0.013, 0.003, 0.36, 0.66, 0.4025);
  screw(-0.455, 0.678, 0.3945, 'front', 0.8);
  screw(0.455, 0.678, 0.3945, 'front', 0.8);

  /* ---------------- console / deck ---------------- */

  const consoleBody = new THREE.Mesh(new RoundedBoxGeometry(0.99, 0.2, 0.3, 3, 0.03), shell);
  consoleBody.position.set(0, 0.5, 0.45);
  consoleBody.castShadow = true;
  root.add(consoleBody);

  const consoleFace = new THREE.Mesh(new RoundedBoxGeometry(0.9, 0.16, 0.012, 2, 0.004), pinkFront);
  consoleFace.position.set(0, 0.505, 0.597);
  consoleFace.receiveShadow = true;
  root.add(consoleFace);
  jointB.box(0.906, 0.004, 0.005, 0, 0.588, 0.6035);
  jointB.box(0.906, 0.004, 0.005, 0, 0.422, 0.6035);
  jointB.box(0.004, 0.17, 0.005, -0.4505, 0.505, 0.6035);
  jointB.box(0.004, 0.17, 0.005, 0.4505, 0.505, 0.6035);
  screw(-0.405, 0.57, 0.6045, 'front', 0.8);
  screw(0.405, 0.57, 0.6045, 'front', 0.8);
  screw(-0.405, 0.44, 0.6045, 'front', 0.8);
  screw(0.405, 0.44, 0.6045, 'front', 0.8);

  const deck = new THREE.Group();
  deck.position.set(0, 0.585, 0.47);
  deck.rotation.x = -0.14;
  root.add(deck);

  const deckPanel = new THREE.Mesh(new RoundedBoxGeometry(1.0, 0.08, 0.34, 3, 0.035), shellDeck);
  deckPanel.castShadow = true;
  deckPanel.receiveShadow = true;
  deck.add(deckPanel);

  const deckTrim = new THREE.Mesh(new RoundedBoxGeometry(1.02, 0.03, 0.36, 3, 0.014), blueSatin);
  deckTrim.position.y = -0.04;
  deck.add(deckTrim);

  // anodised control plate under the hardware
  const plate = new THREE.Mesh(new THREE.BoxGeometry(0.71, 0.004, 0.2), anodized());
  plate.position.set(-0.015, 0.0415, 0.015);
  plate.receiveShadow = true;
  deck.add(plate);

  const deckScrews: ScrewSpec[] = [];
  for (const [x, z] of [
    [-0.35, -0.085],
    [0.32, -0.085],
    [-0.35, 0.115],
    [0.32, 0.115],
  ]) {
    deckScrews.push({ x, y: 0.0445, z, face: 'top', s: 0.85 });
  }
  for (const [x, z] of [
    [-0.345, -0.045],
    [-0.255, -0.045],
    [-0.345, 0.105],
    [-0.255, 0.105],
  ]) {
    deckScrews.push({ x, y: 0.0445, z, face: 'top', s: 0.7 });
  }

  // joystick
  const joyBase = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.055, 0.02, 24), dark);
  joyBase.position.set(-0.3, 0.05, 0.03);
  deck.add(joyBase);
  const boot = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.032, 0.026, 16), rub);
  boot.position.set(-0.3, 0.068, 0.03);
  deck.add(boot);
  const joyRod = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.01, 0.075, 12), chrome());
  joyRod.position.set(-0.3, 0.095, 0.03);
  deck.add(joyRod);
  const joyBall = new THREE.Mesh(
    new THREE.SphereGeometry(0.026, 24, 16),
    plastic(PALETTE.red, { roughness: 0.12 })
  );
  joyBall.position.set(-0.3, 0.135, 0.03);
  joyBall.castShadow = true;
  deck.add(joyBall);
  const joyCollar = new THREE.Mesh(new THREE.TorusGeometry(0.026, 0.003, 6, 20), brush);
  joyCollar.rotation.x = Math.PI / 2;
  joyCollar.position.set(-0.3, 0.053, 0.03);
  deck.add(joyCollar);

  // button
  const btn = new THREE.Mesh(new THREE.CylinderGeometry(0.056, 0.06, 0.032, 32), glow(PALETTE.yellow, 0.35));
  btn.position.set(0.22, 0.062, 0.02);
  btn.castShadow = true;
  deck.add(btn);
  const btnRing = new THREE.Mesh(new THREE.TorusGeometry(0.064, 0.007, 10, 32), chrome());
  btnRing.rotation.x = Math.PI / 2;
  btnRing.position.set(0.22, 0.05, 0.02);
  deck.add(btnRing);
  const btnBase = new THREE.Mesh(
    new THREE.CylinderGeometry(0.07, 0.072, 0.014, 28),
    plastic(PALETTE.yellow, { roughness: 0.35 })
  );
  btnBase.position.set(0.22, 0.044, 0.02);
  deck.add(btnBase);

  const hitMat = new THREE.MeshBasicMaterial({ visible: false });
  const buttonHit = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.16, 0.2), hitMat);
  buttonHit.position.set(0.22, 0.06, 0.02);
  deck.add(buttonHit);

  /* ---------------- play chamber ---------------- */

  const chamberBack = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 0.66), chamberPaint);
  chamberBack.position.set(0, 0.98, -0.375);
  chamberBack.receiveShadow = true;
  root.add(chamberBack);

  const liner = new THREE.Mesh(new RoundedBoxGeometry(0.94, 0.6, 0.014, 2, 0.006), chamberPaint);
  liner.position.set(0, 0.98, -0.366);
  liner.receiveShadow = true;
  root.add(liner);
  jointB.box(0.004, 0.6, 0.005, -0.4725, 0.98, -0.3575);
  jointB.box(0.004, 0.6, 0.005, 0.4725, 0.98, -0.3575);
  jointB.box(0.944, 0.004, 0.005, 0, 1.2825, -0.3575);
  jointB.box(0.944, 0.004, 0.005, 0, 0.6775, -0.3575);
  screw(-0.447, 1.252, -0.356, 'front', 0.8);
  screw(0.447, 1.252, -0.356, 'front', 0.8);
  screw(-0.447, 0.708, -0.356, 'front', 0.8);
  screw(0.447, 0.708, -0.356, 'front', 0.8);

  const sideL = new THREE.Mesh(new RoundedBoxGeometry(0.05, 0.7, 0.78, 3, 0.02), pinkSide);
  sideL.position.set(-0.485, 0.99, 0);
  sideL.castShadow = true;
  root.add(sideL);
  const sideR = sideL.clone();
  sideR.position.x = 0.485;
  root.add(sideR);

  const topCap = new THREE.Mesh(new RoundedBoxGeometry(1.06, 0.06, 0.82, 3, 0.02), blueSatin);
  topCap.position.y = 1.355;
  topCap.castShadow = true;
  root.add(topCap);
  // brushed edge under the cap
  brushB.box(1.0, 0.006, 0.012, 0, 1.3245, 0.407);

  const chamberFloor = new THREE.Mesh(new RoundedBoxGeometry(0.99, 0.03, 0.7, 3, 0.012), shell);
  chamberFloor.position.y = 0.705;
  chamberFloor.receiveShadow = true;
  root.add(chamberFloor);

  // horizontal joint where base meets display body
  for (const x of [-0.4975, 0.4975]) {
    const belt = new THREE.Mesh(new RoundedBoxGeometry(0.03, 0.022, 0.78, 2, 0.006), shell);
    belt.position.set(x, 0.628, 0);
    belt.castShadow = true;
    belt.receiveShadow = true;
    root.add(belt);
  }
  jointB.box(0.004, 0.006, 0.762, -0.5095, 0.626, 0);
  jointB.box(0.004, 0.006, 0.762, 0.5095, 0.626, 0);

  /* ---------------- side service panels + vents ---------------- */

  for (const side of [-1, 1] as const) {
    const x = side * 0.5125;
    const face: Face = side > 0 ? 'right' : 'left';
    // flush outline of the removable access panel
    jointB.box(0.003, 0.0045, 0.525, x, 0.455, -0.01);
    jointB.box(0.003, 0.0045, 0.525, x, 0.165, -0.01);
    jointB.box(0.003, 0.294, 0.0045, x, 0.31, -0.2725);
    jointB.box(0.003, 0.294, 0.0045, x, 0.31, 0.2525);

    // compressed rubber seal just outside the seam
    rubberB.box(0.002, 0.006, 0.545, x + side * 0.0012, 0.463, -0.01);
    rubberB.box(0.002, 0.006, 0.545, x + side * 0.0012, 0.157, -0.01);
    rubberB.box(0.002, 0.31, 0.006, x + side * 0.0012, 0.31, -0.281);
    rubberB.box(0.002, 0.31, 0.006, x + side * 0.0012, 0.31, 0.261);

    // piano hinge on the rear edge
    brushB.box(0.005, 0.3, 0.012, x + side * 0.002, 0.31, -0.2735);
    for (const hy of [0.22, 0.31, 0.4]) {
      brushB.cyl(0.0065, 0.055, x + side * 0.006, hy, -0.2785, 'y', 12);
    }

    // flush pull + finger slot
    brushB.box(0.004, 0.036, 0.07, x + side * 0.0015, 0.425, 0.18);
    jointB.box(0.0025, 0.009, 0.042, x + side * 0.0042, 0.425, 0.18);

    // key lock near the front edge
    brushB.box(0.004, 0.052, 0.052, x + side * 0.0015, 0.202, 0.213);
    chromeB.cyl(0.013, 0.008, x + side * 0.006, 0.202, 0.213, 'x', 18);
    jointB.box(0.0025, 0.016, 0.004, x + side * 0.0105, 0.202, 0.213);

    // cooling vents with a brushed surround
    darkB.box(0.0025, 0.09, 0.125, x + side * 0.0006, 0.085, -0.16);
    brushB.box(0.002, 0.005, 0.135, x + side * 0.0018, 0.034, -0.16);
    brushB.box(0.002, 0.005, 0.135, x + side * 0.0018, 0.136, -0.16);
    brushB.box(0.002, 0.107, 0.005, x + side * 0.0018, 0.085, -0.2275);
    brushB.box(0.002, 0.107, 0.005, x + side * 0.0018, 0.085, -0.0925);
    for (let i = 0; i < 5; i++) {
      darkB.box(0.0025, 0.0045, 0.105, x + side * 0.0012, 0.058 + i * 0.015, -0.16);
    }

    screw(x + side * 0.0012, 0.433, -0.244, face, 0.85);
    screw(x + side * 0.0012, 0.433, 0.224, face, 0.85);
    screw(x + side * 0.0012, 0.19, -0.244, face, 0.85);
    screw(x + side * 0.0012, 0.19, 0.224, face, 0.85);
  }

  /* ---------------- corner angles (brushed) ---------------- */

  function cornerAngle(cx: number, cz: number, h: number, y: number) {
    // ix/iz point inward; sx/sz point outward (surface normals)
    const ix = cx < 0 ? 1 : -1;
    const iz = cz < 0 ? 1 : -1;
    const sx = -ix;
    const sz = -iz;
    const xFace: Face = cx > 0 ? 'right' : 'left';
    const zFace: Face = cz > 0 ? 'front' : 'back';
    // front/back leg, standing 2.5 mm proud of the panel
    brushB.box(0.034, h, 0.005, cx + ix * 0.017, y, cz + sz * 0.0025);
    // side leg
    brushB.box(0.005, h, 0.034, cx + sx * 0.0025, y, cz + iz * 0.017);
    // rolled corner
    brushB.cyl(0.0055, h, cx + sx * 0.0022, y, cz + sz * 0.0022, 'y', 10);
    screw(cx + ix * 0.017, y + h * 0.27, cz + sz * 0.0058, zFace, 0.85);
    screw(cx + ix * 0.017, y - h * 0.27, cz + sz * 0.0058, zFace, 0.85);
    screw(cx + sx * 0.0058, y, cz + iz * 0.018, xFace, 0.8);
  }

  for (const x of [-0.51, 0.51]) {
    for (const z of [0.39, -0.39]) {
      cornerAngle(x, z, 0.1, 0.1);
    }
  }
  // roof corner caps
  for (const x of [-0.528, 0.528]) {
    for (const z of [0.408, -0.408]) {
      cornerAngle(x, z, 0.052, 1.355);
    }
  }
  // cap retaining screws on the top face rail
  for (const x of [-0.36, 0.36]) {
    screw(x, 1.353, 0.4116, 'front', 0.9);
  }

  /* ---------------- glass + frame + gaskets ---------------- */

  const glassFront = new THREE.Mesh(new THREE.PlaneGeometry(0.93, 0.62), glass);
  glassFront.position.set(0, 1.03, 0.392);
  root.add(glassFront);

  // studio reflections: a broad band + a narrow one, both soft-edged
  const reflMap = streakTexture();
  for (const [w, h, x, y, op, ro] of [
    [0.86, 0.2, -0.03, 1.13, 0.2, 0.42],
    [0.42, 0.055, -0.24, 0.9, 0.14, 0.42],
  ]) {
    const r = new THREE.Mesh(
      new THREE.PlaneGeometry(w, h),
      new THREE.MeshBasicMaterial({
        map: reflMap,
        transparent: true,
        opacity: op,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    );
    r.position.set(x, y, 0.3975);
    r.rotation.z = ro;
    r.renderOrder = 3;
    root.add(r);
  }

  const frameMat = blueGloss;
  const railH = new RoundedBoxGeometry(1.0, 0.028, 0.05, 2, 0.006);
  const railV = new RoundedBoxGeometry(0.03, 0.62, 0.05, 2, 0.006);
  const railTop = new THREE.Mesh(railH, frameMat);
  railTop.position.set(0, 1.33, 0.395);
  railTop.castShadow = true;
  root.add(railTop);
  const railBottom = new THREE.Mesh(railH, frameMat);
  railBottom.position.set(0, 0.724, 0.395);
  railBottom.castShadow = true;
  root.add(railBottom);
  for (const x of [-0.49, 0.49]) {
    const r = new THREE.Mesh(railV, frameMat);
    r.position.set(x, 1.03, 0.395);
    r.castShadow = true;
    root.add(r);
  }

  // rubber gasket between glass and frame
  rubberB.box(0.928, 0.011, 0.012, 0, 1.3095, 0.401);
  rubberB.box(0.928, 0.011, 0.012, 0, 0.7445, 0.401);
  rubberB.box(0.011, 0.556, 0.012, -0.4685, 1.027, 0.401);
  rubberB.box(0.011, 0.556, 0.012, 0.4685, 1.027, 0.401);

  // rubber edge between side glass and front frame
  for (const x of [-0.5145, 0.5145]) {
    rubberB.box(0.011, 0.664, 0.012, x, 0.99, 0.3925);
    rubberB.box(0.011, 0.664, 0.012, x, 0.99, -0.3925);
  }
  // and around the side glass panes
  for (const side of [-1, 1] as const) {
    const x = side * 0.5135;
    rubberB.box(0.006, 0.008, 0.752, x, 0.6635, 0);
    rubberB.box(0.006, 0.008, 0.752, x, 1.3165, 0);
    rubberB.box(0.006, 0.662, 0.008, x, 0.99, 0.3765);
    rubberB.box(0.006, 0.662, 0.008, x, 0.99, -0.3765);
  }

  // brushed corner gussets on the glass frame
  for (const sx of [-1, 1]) {
    for (const sy of [-1, 1]) {
      const px = sx * 0.487;
      const py = 1.027 + sy * 0.291;
      brushB.box(0.046, 0.046, 0.004, px, py, 0.421);
      screw(px, py + sy * 0.012, 0.4245, 'front', 0.7);
    }
  }
  screw(-0.33, 0.724, 0.4215, 'front', 0.8);
  screw(0.33, 0.724, 0.4215, 'front', 0.8);
  screw(-0.33, 1.33, 0.4215, 'front', 0.8);
  screw(0.33, 1.33, 0.4215, 'front', 0.8);
  screw(-0.49, 0.9, 0.4215, 'front', 0.75);
  screw(0.49, 0.9, 0.4215, 'front', 0.75);
  screw(-0.49, 1.16, 0.4215, 'front', 0.75);
  screw(0.49, 1.16, 0.4215, 'front', 0.75);

  // front door lock on the bottom rail
  brushB.box(0.058, 0.023, 0.005, 0.2, 0.724, 0.422);
  chromeB.cyl(0.0122, 0.008, 0.2, 0.724, 0.4245, 'z', 16);
  jointB.box(0.0035, 0.014, 0.003, 0.2, 0.724, 0.429);

  // hinges on the left rail
  for (const y of [0.875, 1.185]) {
    brushB.box(0.006, 0.072, 0.026, -0.5068, y, 0.409);
    chromeB.cyl(0.0058, 0.062, -0.5125, y, 0.4145, 'y', 10);
    screw(-0.5105, y + 0.022, 0.412, 'left', 0.65);
    screw(-0.5105, y - 0.022, 0.412, 'left', 0.65);
  }

  /* ---------------- LED channels inside ---------------- */

  const ledMat = glow('#fff3d6', 2.2);
  for (const x of [-0.45, 0.45]) {
    darkB.box(0.016, 0.58, 0.012, x, 1.0, 0.331);
    const led = new THREE.Mesh(new THREE.CapsuleGeometry(0.007, 0.556, 4, 8), ledMat);
    led.position.set(x, 1.0, 0.339);
    root.add(led);
    for (const y of [0.77, 1.0, 1.23]) {
      brushB.box(0.024, 0.012, 0.01, x, y, 0.3375);
    }
    const glowSprite = new THREE.Mesh(
      new THREE.PlaneGeometry(0.12, 0.7),
      new THREE.MeshBasicMaterial({
        color: '#fff3d6',
        transparent: true,
        opacity: 0.16,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    );
    glowSprite.position.set(x * 0.97, 1.0, 0.348);
    root.add(glowSprite);
  }

  /* ---------------- marquee / lightbox ---------------- */

  const marquee = new THREE.Mesh(new RoundedBoxGeometry(1.02, 0.32, 0.12, 3, 0.03), blueSatin);
  marquee.position.set(0, 1.53, 0.26);
  marquee.castShadow = true;
  root.add(marquee);

  const mtex = marqueeTexture();
  const face = new THREE.Mesh(
    new THREE.PlaneGeometry(0.93, 0.29),
    new THREE.MeshPhysicalMaterial({
      map: mtex,
      emissive: new THREE.Color('#ffffff'),
      emissiveMap: mtex,
      emissiveIntensity: 0.8,
      roughness: 0.32,
      clearcoat: 0.7,
      clearcoatRoughness: 0.06,
    })
  );
  face.position.set(0, 1.53, 0.3215);
  root.add(face);

  // bezel bars: print sits behind a real frame, not glued on the box
  for (const y of [1.385, 1.675]) {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.012, 0.012), blueGloss);
    bar.position.set(0, y, 0.325);
    root.add(bar);
  }
  for (const x of [-0.4745, 0.4745]) {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.29, 0.012), blueGloss);
    bar.position.set(x, 1.53, 0.325);
    root.add(bar);
  }

  // clear acrylic face + edge-lit strips
  const acrylic = new THREE.Mesh(new RoundedBoxGeometry(0.948, 0.292, 0.006, 2, 0.002), clear);
  acrylic.position.set(0, 1.53, 0.3275);
  acrylic.renderOrder = 3;
  root.add(acrylic);
  for (const y of [1.3875, 1.6725]) {
    const edge = new THREE.Mesh(
      new THREE.BoxGeometry(0.9, 0.0045, 0.004),
      glow('#e7f0ff', 1.7)
    );
    edge.position.set(0, y, 0.33);
    root.add(edge);
  }
  for (const x of [-0.4695, 0.4695]) {
    const edge = new THREE.Mesh(
      new THREE.BoxGeometry(0.0045, 0.282, 0.004),
      glow('#dfeaff', 1.15)
    );
    edge.position.set(x, 1.53, 0.33);
    root.add(edge);
  }

  // emissive halo that spills past the housing
  const halo = new THREE.Mesh(
    new THREE.PlaneGeometry(1.34, 0.58),
    new THREE.MeshBasicMaterial({
      map: haloTexture(),
      color: '#bcd1ff',
      transparent: true,
      opacity: 0.9,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    })
  );
  halo.position.set(0, 1.53, 0.3242);
  halo.renderOrder = 4;
  root.add(halo);

  // light spill on the roof cap
  const spill = new THREE.Mesh(
    new THREE.PlaneGeometry(1.0, 0.24),
    new THREE.MeshBasicMaterial({
      map: spillTexture(),
      color: '#cfe0ff',
      transparent: true,
      opacity: 0.3,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    })
  );
  spill.rotation.x = -Math.PI / 2;
  spill.position.set(0, 1.3868, 0.3);
  spill.renderOrder = 4;
  root.add(spill);

  // dark reveal where the lightbox meets the roof
  jointB.box(0.98, 0.006, 0.006, 0, 1.3845, 0.3225);
  jointB.box(0.98, 0.004, 0.006, 0, 1.6905, 0.3225);

  // brushed corner tabs + screws on the sign
  for (const sx of [-1, 1]) {
    for (const sy of [-1, 1]) {
      brushB.box(0.044, 0.044, 0.004, sx * 0.459, 1.53 + sy * 0.125, 0.328);
      screw(sx * 0.459, 1.53 + sy * 0.125, 0.3312, 'front', 0.7);
    }
  }
  // side mount screws into the housing
  for (const sx of [-1, 1]) {
    for (const sy of [-1, 1]) {
      screw(sx * 0.5125, 1.53 + sy * 0.1, 0.26, sx > 0 ? 'right' : 'left', 0.8);
    }
  }

  // crown cap
  const crown = new THREE.Mesh(new RoundedBoxGeometry(0.99, 0.02, 0.105, 2, 0.006), blueSatin);
  crown.position.set(0, 1.705, 0.26);
  crown.castShadow = true;
  root.add(crown);

  /* ---------------- decals ---------------- */

  const front = 0.3948;
  const decalSpecs: [string, number, number, number, number, number, number, number, number][] = [
    // label, w, h, x, y, z, rotY, rotZ, opacity
    ['うけとりぐち', 0.095, 0.034, 0.03, 0.302, front, 0, -0.012, 0.95],
    ['FRAGILE', 0.11, 0.042, 0.22, 0.355, front, 0, 0.014, 0.95],
    ['CAUTION', 0.095, 0.038, 0.35, 0.185, front, 0, -0.02, 0.93],
    ['MADE IN JAPAN', 0.1, 0.034, 0.11, 0.17, front, 0, 0.018, 0.9],
    ['ゲット', 0.13, 0.052, -0.12, 0.48, 0.6048, 0, -0.008, 0.96],
    ['あそびかた', 0.1, 0.04, 0.385, 0.47, 0.6048, 0, 0.01, 0.95],
    ['HANDLE WITH CARE', 0.24, 0.085, 0.5128, 0.445, -0.12, Math.PI / 2, 0.016, 0.92],
    ['けんびき', 0.16, 0.065, -0.5128, 0.36, 0.12, -Math.PI / 2, -0.014, 0.94],
  ];
  for (const [label, w, h, x, y, z, rotY, rotZ, opacity] of decalSpecs) {
    const rect = rects[label];
    if (!rect) continue;
    const d = decalMesh(atlas, rect, w, h, { opacity });
    d.position.set(x, y, z);
    d.rotation.set(0, rotY, rotZ);
    root.add(d);
  }

  // a few real scuffs, not stickers: worn edges where hands and shoes land
  const scuffMat = new THREE.MeshBasicMaterial({
    map: scuffTexture(),
    color: '#5a4c40',
    transparent: true,
    opacity: 0.32,
    depthWrite: false,
  });
  for (const [w, h, x, y, z, ry] of [
    [0.16, 0.09, -0.42, 0.195, 0.3943, 0],
    [0.1, 0.06, 0.31, 0.155, 0.3943, 0],
    [0.14, 0.1, 0.5129, 0.11, -0.05, Math.PI / 2],
  ]) {
    const s = new THREE.Mesh(new THREE.PlaneGeometry(w, h), scuffMat);
    s.position.set(x, y, z);
    s.rotation.y = ry;
    s.renderOrder = 1;
    root.add(s);
  }

  /* ---------------- finish detail batches ---------------- */

  rubberB.finish(rub, root, false);
  jointB.finish(joint, root, false);
  brushB.finish(brush, root, true);
  chromeB.finish(chrome(), root, true);
  darkB.finish(matte('#0d0b09'), root, false);
  buildScrews(root, screwSpecs);
  buildScrews(deck, deckScrews);

  /* ---------------- button animation ---------------- */

  let press = 0;
  let enabled = true;
  const btnBaseY = btn.position.y;

  function pressButton() {
    press = 1;
  }
  function setButtonEnabled(on: boolean) {
    enabled = on;
    (btn.material as THREE.MeshStandardMaterial).emissiveIntensity = on ? 0.35 : 0.05;
  }
  function update(dt: number) {
    if (press > 0) {
      press = Math.max(0, press - dt * 4.5);
      btn.position.y = btnBaseY - 0.008 * Math.sin(press * Math.PI);
    }
    const pulse = enabled ? 0.3 + Math.sin(performance.now() * 0.003) * 0.12 : 0.05;
    (btn.material as THREE.MeshStandardMaterial).emissiveIntensity = pulse;
  }

  return { root, glass, buttonHit, pressButton, setButtonEnabled, update };
}
