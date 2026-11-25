import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

/**
 * Hanging kawaii acrylic charms inside the cabinet.
 *
 * Each charm has a silver beaded ball-chain, glossy white acrylic rim,
 * cute pastel printed face (Tamagotchi, retro monitor, UI window, 3D cube),
 * and a crisp white label tag hanging underneath.
 */

export type CharmLabel = {
  /** Text printed on the white tag, e.g. "Web Dev". */
  text: string;
  /** Badge print colour, e.g. "#ff8fb8". */
  color: string;
};

export type CharmsOptions = {
  labels: CharmLabel[];
  topY: number;
  z: number;
  halfWidth: number;
};

export type Charms = {
  group: THREE.Group;
  update(t: number): void;
};

const TAU = Math.PI * 2;
const FONT = '"Arial Rounded MT Bold", "Helvetica Neue", Inter, Arial, sans-serif';
const DEG = Math.PI / 180;

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
  t.anisotropy = 4;
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
  g.roundRect(x, y, w, h, Math.min(r, w / 2, h / 2));
}

/* ------------------------------------------------------------------ */
/* printed face                                                        */
/* ------------------------------------------------------------------ */

function faceTexture(label: CharmLabel, index: number) {
  const W = 256;
  const H = 312;
  return canvasTex(W, H, (g) => {
    const base = new THREE.Color(label.color);
    const top = base.clone().offsetHSL(0, 0.02, 0.08).getStyle();
    const bottom = base.clone().offsetHSL(0, -0.02, -0.06).getStyle();

    const grad = g.createLinearGradient(0, 0, W * 0.4, H);
    grad.addColorStop(0, top);
    grad.addColorStop(1, bottom);
    g.fillStyle = grad;
    g.fillRect(0, 0, W, H);

    // glossy acrylic inner keyline
    g.strokeStyle = 'rgba(255,255,255,0.65)';
    g.lineWidth = 6;
    roundRect(g, 10, 10, W - 20, H - 20, 22);
    g.stroke();

    const icon = index % 4;
    if (icon === 0) {
      // Pastel Tamagotchi / pocket pet
      g.fillStyle = '#ffa8cf';
      g.strokeStyle = '#ffffff';
      g.lineWidth = 7;
      g.beginPath();
      g.ellipse(W / 2, H / 2 + 8, 86, 102, 0, 0, TAU);
      g.fill();
      g.stroke();

      // white faceplate
      g.fillStyle = '#fff9fc';
      roundRect(g, W / 2 - 54, H / 2 - 46, 108, 88, 22);
      g.fill();

      // mint LCD
      g.fillStyle = '#b9f5d8';
      g.strokeStyle = '#6c587a';
      g.lineWidth = 4;
      roundRect(g, W / 2 - 42, H / 2 - 34, 84, 62, 12);
      g.fill();
      g.stroke();

      // pixel buddy
      g.fillStyle = '#254238';
      g.fillRect(W / 2 - 18, H / 2 - 16, 10, 12);
      g.fillRect(W / 2 + 8, H / 2 - 16, 10, 12);
      g.fillRect(W / 2 - 12, H / 2 + 4, 24, 7);
      g.fillStyle = '#ff70a6';
      g.fillRect(W / 2 - 26, H / 2 - 2, 8, 6);
      g.fillRect(W / 2 + 18, H / 2 - 2, 8, 6);

      // 3 little buttons
      const btnCols = ['#ff5a96', '#ffe066', '#67c3ff'];
      for (let i = 0; i < 3; i++) {
        g.fillStyle = btnCols[i];
        g.beginPath();
        g.arc(W / 2 - 28 + i * 28, H / 2 + 66, 9, 0, TAU);
        g.fill();
      }
    } else if (icon === 1) {
      // Cute retro CRT monitor / Front-end browser
      g.fillStyle = '#3b6fe0';
      g.strokeStyle = '#ffffff';
      g.lineWidth = 7;
      roundRect(g, 32, 48, 192, 152, 22);
      g.fill();
      g.stroke();

      // screen
      g.fillStyle = '#ff9ecb';
      roundRect(g, 50, 66, 156, 104, 12);
      g.fill();

      // browser top bar + code blocks
      g.fillStyle = '#3d2c66';
      roundRect(g, 58, 74, 140, 26, 7);
      g.fill();
      g.fillStyle = '#7de6ff';
      roundRect(g, 58, 108, 62, 52, 8);
      g.fill();
      g.fillStyle = '#ffe56b';
      roundRect(g, 128, 108, 70, 22, 7);
      g.fill();
      g.fillStyle = '#ffffff';
      roundRect(g, 128, 138, 70, 22, 7);
      g.fill();

      // monitor stand
      g.fillStyle = '#ffffff';
      roundRect(g, 92, 206, 72, 26, 8);
      g.fill();
      roundRect(g, 66, 228, 124, 18, 9);
      g.fill();
    } else if (icon === 2) {
      // UX/UI handheld / wireframe card
      g.fillStyle = '#7ee4d0';
      g.strokeStyle = '#ffffff';
      g.lineWidth = 7;
      roundRect(g, 46, 36, 164, 232, 26);
      g.fill();
      g.stroke();

      // screen card
      g.fillStyle = '#25394a';
      roundRect(g, 66, 56, 124, 112, 14);
      g.fill();

      g.fillStyle = '#ff925c';
      roundRect(g, 78, 70, 100, 34, 8);
      g.fill();

      g.fillStyle = '#ffffff';
      roundRect(g, 78, 114, 58, 40, 8);
      g.fill();
      g.fillStyle = '#75d4ff';
      roundRect(g, 144, 114, 34, 40, 8);
      g.fill();

      // cute UI controls below screen
      g.fillStyle = '#25394a';
      roundRect(g, 70, 186, 54, 16, 8);
      g.fill();
      g.beginPath();
      g.arc(164, 194, 14, 0, TAU);
      g.fill();
      g.fillStyle = '#ffffff';
      roundRect(g, 76, 220, 104, 22, 11);
      g.fill();
    } else {
      // 3D Art isometric glossy cube
      const cx = W / 2;
      const cy = H / 2 + 4;
      const r = 82;
      const poly = (pts: number[][], fill: string) => {
        g.fillStyle = fill;
        g.beginPath();
        pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
        g.closePath();
        g.fill();
      };
      poly(
        [
          [cx, cy - r * 0.72],
          [cx + r * 0.88, cy - r * 0.3],
          [cx, cy + r * 0.12],
          [cx - r * 0.88, cy - r * 0.3],
        ],
        '#ffffff'
      );
      poly(
        [
          [cx - r * 0.88, cy - r * 0.3],
          [cx, cy + r * 0.12],
          [cx, cy + r * 0.88],
          [cx - r * 0.88, cy + r * 0.44],
        ],
        '#ffe57f'
      );
      poly(
        [
          [cx, cy + r * 0.12],
          [cx + r * 0.88, cy - r * 0.3],
          [cx + r * 0.88, cy + r * 0.44],
          [cx, cy + r * 0.88],
        ],
        '#7bd7ff'
      );
      g.strokeStyle = '#362d54';
      g.lineWidth = 6;
      g.lineJoin = 'round';
      g.beginPath();
      g.moveTo(cx, cy - r * 0.72);
      g.lineTo(cx + r * 0.88, cy - r * 0.3);
      g.lineTo(cx + r * 0.88, cy + r * 0.44);
      g.lineTo(cx, cy + r * 0.88);
      g.lineTo(cx - r * 0.88, cy + r * 0.44);
      g.lineTo(cx - r * 0.88, cy - r * 0.3);
      g.closePath();
      g.moveTo(cx, cy + r * 0.12);
      g.lineTo(cx, cy + r * 0.88);
      g.moveTo(cx, cy + r * 0.12);
      g.lineTo(cx - r * 0.88, cy - r * 0.3);
      g.moveTo(cx, cy + r * 0.12);
      g.lineTo(cx + r * 0.88, cy - r * 0.3);
      g.stroke();
    }

    // crisp top-left laminate highlight
    const gloss = g.createLinearGradient(0, 0, W, H);
    gloss.addColorStop(0, 'rgba(255,255,255,0.38)');
    gloss.addColorStop(0.35, 'rgba(255,255,255,0.04)');
    gloss.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gloss;
    g.fillRect(0, 0, W, H);
  });
}

function tagTexture(text: string, color: string) {
  const W = 384;
  const H = 144;
  return canvasTex(W, H, (g) => {
    g.fillStyle = '#ffffff';
    roundRect(g, 2, 2, W - 4, H - 4, 24);
    g.fill();

    g.strokeStyle = '#c4cbd8';
    g.lineWidth = 6;
    roundRect(g, 7, 7, W - 14, H - 14, 20);
    g.stroke();

    // subtle pastel bottom bar accent
    g.fillStyle = color;
    roundRect(g, 26, H - 22, W - 52, 8, 4);
    g.fill();

    let size = 76;
    g.font = `800 ${size}px ${FONT}`;
    while (g.measureText(text).width > W - 48 && size > 28) {
      size -= 2;
      g.font = `800 ${size}px ${FONT}`;
    }
    g.fillStyle = '#232836';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(text, W / 2, H / 2 - 4);
  });
}

/* ------------------------------------------------------------------ */
/* geometry helpers                                                    */
/* ------------------------------------------------------------------ */

/** Silver beaded ball-chain, just like real acrylic keychains. */
function chainGeometry(length: number) {
  const parts: THREE.BufferGeometry[] = [];
  const wire = new THREE.CylinderGeometry(0.001, 0.001, length, 5, 1);
  wire.translate(0, -length / 2, 0);
  parts.push(wire);

  const step = 0.011;
  for (let y = -0.008; y > -length + 0.002; y -= step) {
    const bead = new THREE.SphereGeometry(0.0024, 6, 5);
    bead.translate(0, y, 0);
    parts.push(bead);
  }
  const hook = new THREE.TorusGeometry(0.0042, 0.0011, 5, 10);
  parts.push(hook);

  return mergeGeometries(parts, false)!;
}

/* ------------------------------------------------------------------ */
/* public API                                                          */
/* ------------------------------------------------------------------ */

export function buildCharms(opts: CharmsOptions): Charms {
  const { labels, topY, z, halfWidth } = opts;
  const group = new THREE.Group();
  group.name = 'charms';

  const whiteMat = new THREE.MeshStandardMaterial({
    color: '#ffffff',
    roughness: 0.2,
    metalness: 0.02,
    envMapIntensity: 1.0,
  });
  const chromeMat = new THREE.MeshStandardMaterial({
    color: '#e8eef5',
    metalness: 0.78,
    roughness: 0.18,
    envMapIntensity: 1.4,
  });

  const pivots: THREE.Group[] = [];
  const n = Math.max(1, labels.length);
  // Park inner two charms clear of the center claw while framing both sides cleanly
  const slots =
    n === 4
      ? [-1, -0.5, 0.5, 1]
      : n === 3
        ? [-0.92, 0.22, 0.96]
        : n === 2
          ? [-0.65, 0.65]
          : Array.from({ length: n }, (_, i) => -1 + (2 * i) / Math.max(1, n - 1));

  // Staggered heights matching the reference photo
  const chainLens = [0.068, 0.122, 0.074, 0.112];
  const jitter = [-0.004, 0.004, -0.003, 0.005];

  const discW = 0.078;
  const discH = 0.095;
  const rimW = discW + 0.012;
  const rimH = discH + 0.012;
  const tagW = 0.104;
  const tagH = 0.036;

  const facePlaneGeo = new THREE.PlaneGeometry(discW, discH);
  const tagPlaneGeo = new THREE.PlaneGeometry(tagW - 0.004, tagH - 0.004);

  labels.forEach((label, i) => {
    const pivot = new THREE.Group();
    const x = halfWidth * (slots[i] ?? 0) + (jitter[i % jitter.length] ?? 0);
    pivot.position.set(x, topY, z);
    const tilt = (i % 2 ? -1 : 1) * (0.012 + (i % 3) * 0.005);
    pivot.rotation.z = tilt;
    pivot.userData.tilt = tilt;
    pivot.userData.phase = i * 1.37;
    pivot.userData.cycleOffset = i * 2.31;
    group.add(pivot);
    pivots.push(pivot);

    const chainLen = chainLens[i % chainLens.length] ?? 0.085;
    const badgeY = -chainLen - 0.008 - rimH / 2;
    const badgeTop = badgeY + rimH / 2;
    const badgeBottom = badgeY - rimH / 2;
    const tagY = badgeBottom - 0.007 - tagH / 2;
    const tagTop = tagY + tagH / 2;

    const chromeParts: THREE.BufferGeometry[] = [chainGeometry(chainLen)];
    const ring = (r: number, y: number) => {
      const t = new THREE.TorusGeometry(r, 0.0011, 5, 10);
      t.translate(0, y, 0);
      return t;
    };
    chromeParts.push(ring(0.0038, -chainLen - 0.001));
    chromeParts.push(ring(0.0034, badgeTop - 0.0015));
    chromeParts.push(ring(0.0032, badgeBottom - 0.0015));
    chromeParts.push(ring(0.0038, (badgeBottom + tagTop) / 2));
    chromeParts.push(ring(0.0032, tagTop + 0.0015));
    const chrome = new THREE.Mesh(mergeGeometries(chromeParts, false)!, chromeMat);
    pivot.add(chrome);

    const rimGeo = new RoundedBoxGeometry(rimW, rimH, 0.008, 2, 0.013);
    rimGeo.translate(0, badgeY, 0);
    const tagGeo = new RoundedBoxGeometry(tagW, tagH, 0.0044, 2, 0.006);
    tagGeo.translate(0, tagY, 0);
    const white = new THREE.Mesh(mergeGeometries([rimGeo, tagGeo], false)!, whiteMat);
    pivot.add(white);

    const face = new THREE.Mesh(
      facePlaneGeo,
      new THREE.MeshStandardMaterial({
        map: faceTexture(label, i),
        roughness: 0.22,
        metalness: 0,
        envMapIntensity: 0.9,
      })
    );
    face.position.set(0, badgeY, 0.0044);
    pivot.add(face);

    const tag = new THREE.Mesh(
      tagPlaneGeo,
      new THREE.MeshStandardMaterial({
        map: tagTexture(label.text, label.color),
        roughness: 0.32,
        metalness: 0,
        envMapIntensity: 0.7,
      })
    );
    tag.position.set(0, tagY, 0.0024);
    pivot.add(tag);
  });

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
