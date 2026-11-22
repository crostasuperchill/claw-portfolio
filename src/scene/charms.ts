import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

/**
 * Hanging category charms for the inside of the cabinet.
 *
 * Each charm is a small laminated acrylic medallion: a white acrylic rim,
 * a printed pastel face with a bold pictogram, a thin drop chain (wire +
 * torus links every 4 cm), and a white project tag hanging underneath.
 * Four of them mark WEB DEV / FRONT-END / UX/UI / 3D ART.
 */

export type CharmLabel = {
  /** Text printed on the white tag, e.g. "WEB DEV". */
  text: string;
  /** Badge print colour, e.g. "#ff8fb8". */
  color: string;
};

export type CharmsOptions = {
  /** One charm per entry; 4 looks best. */
  labels: CharmLabel[];
  /** Y of the top edge the chains hang from, e.g. 1.30. */
  topY: number;
  /** Z of the hanging plane (behind the claw, in front of the back wall), e.g. -0.18. */
  z: number;
  /** Half of the horizontal span the charms are distributed across, e.g. 0.35. */
  halfWidth: number;
};

/** Return shape: add `group` to the scene, call `update` once per frame. */
export type Charms = {
  group: THREE.Group;
  update(t: number): void;
};

const TAU = Math.PI * 2;
const FONT = '"Helvetica Neue", Inter, Helvetica, Arial, sans-serif';
const DEG = Math.PI / 180;
const LINK_STEP = 0.04; // one torus link every 4 cm of chain

/* ------------------------------------------------------------------ */
/* canvas helpers                                                      */
/* ------------------------------------------------------------------ */

function canvasTex(w: number, h: number, draw: (g: CanvasRenderingContext2D) => void) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const g = c.getContext('2d')!;
  draw(g);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

function roundRect(
  g: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  g.beginPath();
  g.roundRect(x, y, w, h, r);
}

/* ------------------------------------------------------------------ */
/* printed face                                                        */
/* ------------------------------------------------------------------ */

function faceTexture(label: CharmLabel, index: number, ink: string) {
  const W = 304;
  const H = 380;
  return canvasTex(W, H, (g) => {
    const base = new THREE.Color(label.color);
    const top = base.clone().offsetHSL(0, 0.015, 0.05).getStyle();
    const bottom = base.clone().offsetHSL(0, -0.02, -0.08).getStyle();

    const grad = g.createLinearGradient(0, 0, W * 0.55, H);
    grad.addColorStop(0, top);
    grad.addColorStop(1, bottom);
    g.fillStyle = grad;
    g.fillRect(0, 0, W, H);

    // printed acrylic: very sparse dot grid, reads as ink on plastic
    g.globalAlpha = 0.1;
    g.fillStyle = '#ffffff';
    for (let y = 22; y < H - 20; y += 26) {
      const off = (Math.round(y / 26) % 2) * 13;
      for (let x = off + 12; x < W - 10; x += 26) {
        g.beginPath();
        g.arc(x, y, 1.6, 0, TAU);
        g.fill();
      }
    }
    g.globalAlpha = 1;

    // soft diagonal laminate gloss
    const gloss = g.createLinearGradient(0, 0, W, H);
    gloss.addColorStop(0, 'rgba(255,255,255,0.34)');
    gloss.addColorStop(0.3, 'rgba(255,255,255,0.05)');
    gloss.addColorStop(0.62, 'rgba(255,255,255,0)');
    gloss.addColorStop(0.84, 'rgba(255,255,255,0.12)');
    gloss.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gloss;
    g.fillRect(0, 0, W, H);

    g.strokeStyle = ink;
    g.fillStyle = ink;
    g.lineWidth = 17;
    g.lineCap = 'round';
    g.lineJoin = 'round';

    const icon = index % 4;
    if (icon === 0) {
      // </> web dev
      g.beginPath();
      g.moveTo(112, 102);
      g.lineTo(58, 178);
      g.lineTo(112, 254);
      g.stroke();
      g.beginPath();
      g.moveTo(192, 102);
      g.lineTo(246, 178);
      g.lineTo(192, 254);
      g.stroke();
      g.beginPath();
      g.moveTo(170, 88);
      g.lineTo(134, 268);
      g.stroke();
    } else if (icon === 1) {
      // browser window
      g.lineWidth = 12;
      roundRect(g, 52, 92, 200, 176, 22);
      g.stroke();
      g.beginPath();
      g.moveTo(52, 136);
      g.lineTo(252, 136);
      g.stroke();
      for (let i = 0; i < 3; i++) {
        g.beginPath();
        g.arc(74 + i * 18, 114, 4.6, 0, TAU);
        g.fill();
      }
      g.globalAlpha = 0.92;
      roundRect(g, 72, 158, 74, 92, 10);
      g.fill();
      g.globalAlpha = 0.48;
      roundRect(g, 160, 158, 74, 40, 9);
      g.fill();
      roundRect(g, 160, 210, 74, 40, 9);
      g.fill();
      g.globalAlpha = 1;
    } else if (icon === 2) {
      // UX wireframe + big cursor
      g.lineWidth = 11;
      roundRect(g, 50, 86, 204, 188, 20);
      g.stroke();
      g.globalAlpha = 0.9;
      roundRect(g, 68, 104, 74, 58, 9);
      g.fill();
      g.globalAlpha = 0.4;
      roundRect(g, 156, 108, 82, 9, 4);
      g.fill();
      roundRect(g, 156, 126, 62, 9, 4);
      g.fill();
      roundRect(g, 68, 178, 170, 9, 4);
      g.fill();
      roundRect(g, 68, 198, 132, 9, 4);
      g.fill();
      g.globalAlpha = 1;
      g.beginPath();
      g.moveTo(150, 164);
      g.lineTo(214, 194);
      g.lineTo(186, 201);
      g.lineTo(204, 234);
      g.lineTo(186, 242);
      g.lineTo(168, 209);
      g.lineTo(150, 228);
      g.closePath();
      g.fill();
    } else {
      // isometric cube
      const cx = W / 2;
      const cy = 176;
      const r = 96;
      const topFace = [
        [cx, cy - r * 0.58],
        [cx + r * 0.88, cy - r * 0.29],
        [cx, cy],
        [cx - r * 0.88, cy - r * 0.29],
      ];
      const leftFace = [
        [cx - r * 0.88, cy - r * 0.29],
        [cx, cy],
        [cx, cy + r * 0.64],
        [cx - r * 0.88, cy + r * 0.32],
      ];
      const rightFace = [
        [cx, cy],
        [cx + r * 0.88, cy - r * 0.29],
        [cx + r * 0.88, cy + r * 0.32],
        [cx, cy + r * 0.64],
      ];
      const poly = (pts: number[][], alpha: number) => {
        g.globalAlpha = alpha;
        g.beginPath();
        pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
        g.closePath();
        g.fill();
      };
      poly(topFace, 1);
      poly(leftFace, 0.55);
      poly(rightFace, 0.3);
      g.globalAlpha = 1;
      g.lineWidth = 7;
      g.beginPath();
      g.moveTo(cx, cy);
      g.lineTo(cx, cy + r * 0.64);
      g.moveTo(cx, cy);
      g.lineTo(cx - r * 0.88, cy - r * 0.29);
      g.moveTo(cx, cy);
      g.lineTo(cx + r * 0.88, cy - r * 0.29);
      g.stroke();
    }

    // printed white keyline inside the laminate
    g.globalAlpha = 0.5;
    g.strokeStyle = '#ffffff';
    g.lineWidth = 3;
    roundRect(g, 9, 9, W - 18, H - 18, 18);
    g.stroke();
    g.globalAlpha = 1;

    // small category chip, just a printed dot row (no micro-text)
    g.fillStyle = ink;
    g.globalAlpha = 0.55;
    for (let i = 0; i < 3; i++) {
      g.beginPath();
      g.arc(W / 2 - 12 + i * 12, H - 34, 3, 0, TAU);
      g.fill();
    }
    g.globalAlpha = 1;
  });
}

function tagTexture(text: string, color: string) {
  const W = 512;
  const H = 184;
  return canvasTex(W, H, (g) => {
    g.fillStyle = '#fffdf7';
    roundRect(g, 2, 2, W - 4, H - 4, 24);
    g.fill();

    g.strokeStyle = '#e5dac6';
    g.lineWidth = 5;
    roundRect(g, 8, 8, W - 16, H - 16, 19);
    g.stroke();

    // punched hole + coloured edge tab
    g.fillStyle = color;
    roundRect(g, 18, 26, 9, H - 52, 4);
    g.fill();
    g.fillStyle = '#f1e8d7';
    g.beginPath();
    g.arc(48, 38, 7, 0, TAU);
    g.fill();
    g.strokeStyle = '#c8bca6';
    g.lineWidth = 2.5;
    g.beginPath();
    g.arc(48, 38, 7, 0, TAU);
    g.stroke();

    const label = text.toUpperCase();
    let size = 92;
    g.font = `800 ${size}px ${FONT}`;
    while (g.measureText(label).width > 398 && size > 34) {
      size -= 2;
      g.font = `800 ${size}px ${FONT}`;
    }
    g.fillStyle = '#211d18';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(label, 284, H / 2 + 2);

    g.globalAlpha = 0.4;
    g.strokeStyle = '#cfc4b0';
    g.lineWidth = 2;
    g.beginPath();
    g.moveTo(70, H - 22);
    g.lineTo(W - 34, H - 22);
    g.stroke();
    g.globalAlpha = 1;
  });
}

/* ------------------------------------------------------------------ */
/* geometry helpers                                                    */
/* ------------------------------------------------------------------ */

/** Thin wire drop, with little torus chain links every 4 cm. */
function chainGeometry(length: number, linkStep = LINK_STEP) {
  const parts: THREE.BufferGeometry[] = [];
  const wire = new THREE.CylinderGeometry(0.00115, 0.00115, length, 7, 1);
  wire.translate(0, -length / 2, 0);
  parts.push(wire);

  const link = () => new THREE.TorusGeometry(0.0034, 0.00085, 5, 14);
  for (let y = -0.018; y > -length + 0.004; y -= linkStep) {
    const r = link();
    r.translate(0, y, 0);
    parts.push(r);
  }
  // top hook, sits right under the cabinet ceiling
  const hook = new THREE.TorusGeometry(0.0044, 0.00115, 6, 16);
  hook.translate(0, 0, 0);
  parts.push(hook);

  return mergeGeometries(parts, false)!;
}

/* ------------------------------------------------------------------ */
/* public API                                                          */
/* ------------------------------------------------------------------ */

/**
 * Build the row of charms hanging inside the cabinet.
 *
 * Usage:
 *   const charms = buildCharms({
 *     labels: [
 *       { text: 'WEB DEV', color: '#ff8fb8' },
 *       { text: 'FRONT-END', color: '#8ecbff' },
 *       { text: 'UX/UI', color: '#8fe3c4' },
 *       { text: '3D ART', color: '#c9b1ff' },
 *     ],
 *     topY: 1.30,
 *     z: -0.18,
 *     halfWidth: 0.35,
 *   });
 *   scene.add(charms.group);
 *   // per frame:
 *   charms.update(now / 1000);
 */
export function buildCharms(opts: CharmsOptions): Charms {
  const { labels, topY, z, halfWidth } = opts;
  const group = new THREE.Group();
  group.name = 'charms';

  const whiteMat = new THREE.MeshPhysicalMaterial({
    color: '#f9f4e8',
    roughness: 0.16,
    metalness: 0,
    clearcoat: 1,
    clearcoatRoughness: 0.03,
    envMapIntensity: 1.5,
    ior: 1.46,
  });
  const chromeMat = new THREE.MeshPhysicalMaterial({
    color: '#dfe4ea',
    metalness: 1,
    roughness: 0.15,
    envMapIntensity: 1.9,
  });

  const pivots: THREE.Group[] = [];
  const n = Math.max(1, labels.length);
  /** one ink for the whole row, so all four icons share the same print colour */
  const rowLum =
    labels.reduce((sum, l) => {
      const c = new THREE.Color(l.color);
      return sum + 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b;
    }, 0) / n;
  const rowInk = rowLum > 0.56 ? '#2b2233' : '#fffdf7';
  /**
   * Slot pattern in -1..1. With four charms the two middle ones step aside
   * for the claw, which parks at x=0.
   */
  const slots =
    n === 4
      ? [-1, -0.36, 0.36, 1]
      : n === 3
        ? [-0.96, 0, 0.96]
        : n === 2
          ? [-0.62, 0.62]
          : Array.from({ length: n }, (_, i) => -1 + (2 * i) / Math.max(1, n - 1));

  /** deterministic, slightly uneven hand-hung rhythm */
  const jitter = [-0.006, 0.005, -0.004, 0.007, 0.003, -0.005];
  const chainLens = [0.086, 0.094, 0.088, 0.092, 0.09, 0.088];

  labels.forEach((label, i) => {
    const pivot = new THREE.Group();
    const x = halfWidth * (slots[i] ?? 0) + (jitter[i % jitter.length] ?? 0);
    pivot.position.set(x, topY, z);
    const tilt = (i % 2 ? -1 : 1) * (0.009 + (i % 3) * 0.0045);
    pivot.rotation.z = tilt;
    pivot.userData.tilt = tilt;
    pivot.userData.phase = i * 1.37;
    pivot.userData.cycleOffset = i * 2.31;
    group.add(pivot);
    pivots.push(pivot);

    const chainLen = chainLens[i % chainLens.length] ?? 0.086;
    const discW = 0.076;
    const discH = 0.092;
    const rimW = discW + 0.012;
    const rimH = discH + 0.012;
    const badgeY = -chainLen - 0.008 - rimH / 2;
    const badgeTop = badgeY + rimH / 2;
    const badgeBottom = badgeY - rimH / 2;

    const tagW = 0.096;
    const tagH = 0.034;
    const tagY = badgeBottom - 0.007 - tagH / 2;
    const tagTop = tagY + tagH / 2;

    // ---- chain, jump rings and eyelets: one chrome draw call ----
    const chromeParts: THREE.BufferGeometry[] = [chainGeometry(chainLen)];
    const ring = (r: number, y: number) => {
      const t = new THREE.TorusGeometry(r, 0.00105, 5, 14);
      t.translate(0, y, 0);
      return t;
    };
    chromeParts.push(ring(0.0038, -chainLen - 0.001));
    chromeParts.push(ring(0.0034, badgeTop - 0.0015));
    chromeParts.push(ring(0.0032, badgeBottom - 0.0015));
    chromeParts.push(ring(0.0038, (badgeBottom + tagTop) / 2));
    chromeParts.push(ring(0.0032, tagTop + 0.0015));
    const chrome = new THREE.Mesh(mergeGeometries(chromeParts, false)!, chromeMat);
    chrome.castShadow = false;
    pivot.add(chrome);

    // ---- white acrylic rim + white tag backing: one draw call ----
    const rimGeo = new RoundedBoxGeometry(rimW, rimH, 0.009, 4, 0.013);
    rimGeo.translate(0, badgeY, 0);
    const tagGeo = new RoundedBoxGeometry(tagW, tagH, 0.0044, 3, 0.006);
    tagGeo.translate(0, tagY, 0);
    const white = new THREE.Mesh(mergeGeometries([rimGeo, tagGeo], false)!, whiteMat);
    white.castShadow = true;
    white.receiveShadow = true;
    pivot.add(white);

    // ---- printed pastel face ----
    const face = new THREE.Mesh(
      new THREE.PlaneGeometry(discW, discH),
      new THREE.MeshPhysicalMaterial({
        map: faceTexture(label, i, rowInk),
        roughness: 0.24,
        metalness: 0,
        clearcoat: 1,
        clearcoatRoughness: 0.045,
        envMapIntensity: 1.35,
        ior: 1.46,
      })
    );
    face.position.set(0, badgeY, 0.0047);
    face.castShadow = false;
    pivot.add(face);

    // ---- printed project tag ----
    const tag = new THREE.Mesh(
      new THREE.PlaneGeometry(tagW - 0.004, tagH - 0.004),
      new THREE.MeshPhysicalMaterial({
        map: tagTexture(label.text, label.color),
        roughness: 0.3,
        metalness: 0,
        clearcoat: 0.9,
        clearcoatRoughness: 0.06,
        envMapIntensity: 1.1,
      })
    );
    tag.position.set(0, tagY, 0.0024);
    pivot.add(tag);
  });

  /**
   * Light damped pendulum: each charm gets a slow 1.5° swing that decays
   * over a 10 s cycle and restarts from zero, so it never snaps.
   */
  const AMP = 1.5 * DEG;
  const CYCLE = 10;
  const update = (t: number) => {
    for (const p of pivots) {
      const phase = p.userData.phase as number;
      const u = (t + (p.userData.cycleOffset as number)) % CYCLE;
      const env = Math.exp(-0.34 * u) * Math.min(1, u * 3.2);
      const sway =
        AMP * (0.82 * Math.sin(u * 3.05 + phase) + 0.18 * Math.sin(u * 4.7 + phase * 2.1)) * env;
      p.rotation.z = (p.userData.tilt as number) + sway;
      p.rotation.x = AMP * 0.22 * Math.sin(u * 2.1 + phase * 1.63) * env;
    }
  };

  return { group, update };
}
