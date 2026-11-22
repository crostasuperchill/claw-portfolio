import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import type { CapsuleOptions } from '../contracts';
import { PROJECTS } from '../game/roster';
import { makeToy } from './toys';

const TAU = Math.PI * 2;

/**
 * Palette delle calotte, come nella foto UFO catcher:
 * rosa, azzurro, menta, giallo, lilla, pesca.
 * Pastelli *saturi*: la plastica stampata è corposa, non slavata.
 * Esportata perché main.ts / altri layer possano riusarla.
 */
export const CAPSULE_PALETTE = [
  '#3aa6e8', // azzurro — MagicWall
  '#f04d95', // rosa — Jollycat
  '#f0b41a', // giallo — ZORA
  '#8a5fe6', // lilla — Oracle
  '#43cfa0', // menta — Polaroids
  '#ff7e45', // pesca — Say hi
] as const;

/**
 * Pastello saturo da tinta progetto.
 * Mantiene la tinta, ma chiude saturazione e luminosità nella forbice
 * della plastica gachapon: niente blu notte, niente pastello slavato.
 */
function plasticTint(input: THREE.ColorRepresentation): THREE.Color {
  const c = new THREE.Color(input);
  const hsl = { h: 0, s: 0, l: 0 };
  c.getHSL(hsl);
  // progetto nero/grigio -> pesca, così resta nella palette della foto
  if (hsl.l < 0.1 || hsl.s < 0.05) {
    return c.setHSL(0.045, 0.82, 0.56);
  }
  const s = THREE.MathUtils.clamp(hsl.s * 0.92 + 0.42, 0.78, 0.96);
  const l = THREE.MathUtils.clamp(0.56 + (hsl.l - 0.5) * 0.05, 0.52, 0.62);
  return c.setHSL(hsl.h, s, l);
}

const PRIZE_COLORS = [...CAPSULE_PALETTE];

const halfLower = (r: number) =>
  new THREE.SphereGeometry(r, 36, 22, 0, TAU, Math.PI / 2, Math.PI / 2);
const halfUpper = (r: number) =>
  new THREE.SphereGeometry(r * 0.999, 36, 22, 0, TAU, 0, Math.PI / 2);

/** plastica pastello opaca, con un velo di clearcoat (non uno specchio) */
function shellMaterial() {
  return new THREE.MeshPhysicalMaterial({
    color: '#ffffff',
    roughness: 0.37,
    metalness: 0,
    clearcoat: 0.38,
    clearcoatRoughness: 0.22,
    envMapIntensity: 0.9,
    ior: 1.46,
  });
}

/**
 * Calotta superiore in plastica TRASPARENTE.
 *
 * Niente transmission: main.ts la azzera comunque per tenere nitida la teca,
 * e la trasmissione di three sfoca quello che sta dietro. Il trucco è
 * trasparenza bassa + riflessi d'ambiente forti + clearcoat: la sfera legge
 * come guscio sottile e lucido, e il premio resta perfettamente a fuoco.
 * L'alpha è modulato in Fresnel: limpido al centro (il giocattolo resta
 * nitido), corposo e riflettente sul bordo, dove si vede lo spessore della
 * plastica. DoubleSide aggiunge la parete interna e il riflesso di taglio:
 * spessore da vera calotta stampata, non da bolla di sapone.
 */
function glassMaterial() {
  const m = new THREE.MeshPhysicalMaterial({
    color: '#e8f6ff',
    roughness: 0.02,
    metalness: 0,
    transmission: 0,
    transparent: true,
    opacity: 0.12,
    depthWrite: false,
    side: THREE.DoubleSide,
    clearcoat: 1,
    clearcoatRoughness: 0.018,
    envMapIntensity: 2.3,
    ior: 1.49,
    specularIntensity: 1.4,
  });

  m.onBeforeCompile = (shader) => {
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <normal_fragment_maps>',
      `#include <normal_fragment_maps>
       float glassFresnel = pow(1.0 - saturate(abs(dot(normal, normalize(vViewPosition)))), 0.85);
       // centro limpido ma non invisibile, bordo spesso e lucido
       diffuseColor.a = mix(opacity * 1.35, opacity * 5.0, glassFresnel);`
    );
  };
  // DoubleSide senza il secondo pass: una sola draw call per calotta
  m.forceSinglePass = true;
  m.customProgramCacheKey = () => 'capsule-glass-fresnel-v4';
  return m;
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

/**
 * Anello di giunzione bianco, sottile, con la linguetta di apertura.
 * Anello + linguetta sono un'unica geometria: le capsule riempitive restano
 * a 4 draw call (lower, upper, ring, prize) e i premi non aggiungono mesh.
 */
function ringGeometry(r: number) {
  // toro schiacciato: fascia stampata, non un tubo da idraulico
  const torus = new THREE.TorusGeometry(r * 0.994, r * 0.03, 9, 56);
  torus.rotateX(Math.PI / 2);
  torus.scale(1, 0.55, 1);

  // linguetta sul fianco, dove si pinza per aprire la capsula
  const ang = 0.58;
  const tab = new RoundedBoxGeometry(r * 0.16, r * 0.06, r * 0.15, 2, r * 0.02);
  tab.rotateY(-ang);
  tab.translate(Math.cos(ang) * r, 0, Math.sin(ang) * r);

  const merged = mergeGeometries([torus.toNonIndexed(), tab], false);
  return merged ?? torus;
}

function ringMaterial() {
  return new THREE.MeshPhysicalMaterial({
    color: '#fffdfa',
    roughness: 0.28,
    metalness: 0,
    clearcoat: 0.6,
    clearcoatRoughness: 0.14,
    bumpMap: ringBumpTexture(),
    bumpScale: 0.0004,
    envMapIntensity: 1.15,
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
    roughness: 0.38,
    metalness: 0,
    clearcoat: 0.45,
    clearcoatRoughness: 0.2,
    envMapIntensity: 1.1,
  });
}

/* ------------------------------------------------------------------ */
/* etichetta                                                           */
/* ------------------------------------------------------------------ */

/** colore della banda: tinta progetto, scurita quanto basta al testo bianco */
function bandColor(hex: string): THREE.Color {
  const c = new THREE.Color(hex);
  const hsl = { h: 0, s: 0, l: 0 };
  c.getHSL(hsl);
  if (hsl.l < 0.1 || hsl.s < 0.06) {
    // "Say hi" è nero: banda pesca, coerente con la calotta
    return c.setHSL(0.04, 0.78, 0.52);
  }
  const s = THREE.MathUtils.clamp(hsl.s * 0.96 + 0.1, 0.68, 1);
  const l = THREE.MathUtils.clamp(hsl.l, 0.32, 0.47);
  return c.setHSL(hsl.h, s, l);
}

function labelTexture(title: string, color: string) {
  const W = 512;
  const H = 182;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const g = c.getContext('2d')!;
  const band = bandColor(color);
  const top = band.clone().offsetHSL(0, -0.03, 0.045);
  const bottom = band.clone().offsetHSL(0, 0.02, -0.045);

  // banda colorata piena, con una leggera incurvatura di stampa
  const grad = g.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, `#${top.getHexString()}`);
  grad.addColorStop(1, `#${bottom.getHexString()}`);
  g.fillStyle = grad;
  g.fillRect(0, 0, W, H);

  // grana carta, quasi invisibile da lontano ma toglie il plastificato piatto
  const rnd = mulberryLike(0x1abe11);
  g.fillStyle = 'rgba(255,255,255,0.05)';
  for (let i = 0; i < 900; i++) g.fillRect(rnd() * W, rnd() * H, 1, 1);
  g.fillStyle = 'rgba(0,0,0,0.045)';
  for (let i = 0; i < 600; i++) g.fillRect(rnd() * W, rnd() * H, 1, 1);

  // filo di taglio: scuro, così non fa una seconda ghiera bianca
  g.strokeStyle = 'rgba(0,0,0,0.13)';
  g.lineWidth = 2;
  g.beginPath();
  g.roundRect(9, 9, W - 18, H - 18, 9);
  g.stroke();

  // nome progetto: bianco, grande, una riga sola che si adatta alla banda
  const lines = [title.toUpperCase()];
  const areaTop = 8;
  const areaH = 128;
  const maxW = W - 44;
  let size = 120;
  let sx = 1;
  const nameFont = (px: number) =>
    `900 ${px}px "HelveticaNeue-CondensedBlack", "Helvetica Neue Condensed Black", "Arial Narrow", "Helvetica Neue", Arial, sans-serif`;
  for (;;) {
    g.font = nameFont(size);
    const widest = Math.max(...lines.map((l) => g.measureText(l).width));
    sx = Math.min(1, maxW / widest);
    if (sx >= 0.76 || size <= 30) break;
    size -= 2;
  }
  const lineH = size * 1.01;
  const total = lineH * lines.length;
  const firstY = areaTop + (areaH - total) / 2 + lineH / 2;

  g.save();
  g.beginPath();
  g.rect(16, areaTop - 4, W - 32, areaH + 8);
  g.clip();
  g.fillStyle = '#ffffff';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.lineJoin = 'round';
  g.strokeStyle = 'rgba(0,0,0,0.3)';
  g.lineWidth = Math.max(2, size * 0.035);
  g.shadowColor = 'rgba(0,0,0,0.22)';
  g.shadowBlur = 5;
  g.shadowOffsetY = 2;
  lines.forEach((line, i) => {
    g.save();
    g.translate(W / 2, firstY + i * lineH);
    g.scale(sx, 1);
    g.strokeText(line, 0, 0);
    g.fillText(line, 0, 0);
    g.restore();
  });
  g.restore();

  // riga di servizio in basso, fuori dalla zona più visibile
  g.fillStyle = 'rgba(255,255,255,0.78)';
  g.textAlign = 'center';
  g.letterSpacing = '2.4px';
  g.font = '800 10px "Helvetica Neue", Arial, sans-serif';
  g.fillText('DAVIDE.FYI  ·  PRIZE', W / 2, 168);
  g.letterSpacing = '0px';

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

/** PRNG deterministico: la grana della carta non cambia a ogni reload */
function mulberryLike(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Etichetta adesiva sulla calotta inferiore (solo lì: la cupola trasparente
 * resta libera, così il premio si vede).
 * Un pannello largo ~120°, montato su un pivot che ruota solo attorno all'asse
 * verticale della capsula per guardare la camera: il nome resta sempre di
 * fronte, anche dopo che la fisica ha fatto rotolare la capsula.
 * Alto ~40°, quindi non invade la cupola.
 */
const LABEL_PHI = TAU / 3;
const LABEL_THETA_START = Math.PI / 2 + 0.02;
const LABEL_THETA = 0.7;

function labelGeometry(r: number) {
  return new THREE.SphereGeometry(
    r * 1.006,
    40,
    20,
    Math.PI / 2 - LABEL_PHI / 2,
    LABEL_PHI,
    LABEL_THETA_START,
    LABEL_THETA
  );
}

function labelMaterial(tex: THREE.Texture) {
  return new THREE.MeshPhysicalMaterial({
    map: tex,
    roughness: 0.58,
    metalness: 0,
    clearcoat: 0.14,
    clearcoatRoughness: 0.42,
    envMapIntensity: 0.65,
    side: THREE.FrontSide,
    // transparent (opacity 1) fa saltare il mergeStatic dei premi:
    // l'etichetta deve restare una mesh viva per girarsi verso la camera.
    transparent: true,
    opacity: 1,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
  });
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
    // anello sempre bianco: niente instanceColor, resta una sola draw call
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

/** Capsula premio, con giocattolo e etichetta del progetto. */
export function makeCapsule(opts: CapsuleOptions): THREE.Group {
  const { project, radius, tint } = opts;
  const g = new THREE.Group();
  // calotta premio: palette della foto, una tinta per progetto (fallback sulla tinta progetto)
  const paletteIndex = project ? PROJECTS.findIndex((p) => p.id === project.id) : -1;
  const base =
    tint !== undefined
      ? plasticTint(tint)
      : paletteIndex >= 0
        ? new THREE.Color(CAPSULE_PALETTE[paletteIndex % CAPSULE_PALETTE.length])
        : plasticTint(project?.color ?? '#f0b6cd');
  const r = radius;

  const lower = new THREE.Mesh(halfLower(r), shellMaterial());
  (lower.material as THREE.MeshPhysicalMaterial).color.copy(base);
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
    // niente merge: questo pannello deve poter ruotare da solo verso la camera
    label.userData.noMerge = true;
    label.onBeforeRender = (_renderer, _scene, camera) => {
      const capsule = label.parent;
      if (!capsule) return;
      const local = capsule.worldToLocal(camera.position.clone());
      label.rotation.y = Math.atan2(local.x, local.z);
      label.updateMatrixWorld(true);
    };
    g.add(label);
  }

  g.userData.projectId = project?.id ?? null;
  return g;
}
