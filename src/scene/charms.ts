import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

/**
 * Hanging kawaii acrylic charms inside the cabinet.
 *
 * Each charm has a single-strand silver beaded ball-chain hooked over the
 * rail, a thin translucent frosted acrylic rim die-cut around the gadget
 * silhouette, a cute pastel printed face (Tamagotchi, retro handheld, CRT
 * monitor), and a crisp white label tag hanging underneath.
 */

export type CharmLabel = {
  /** Text printed on the white tag, e.g. "Web Dev". */
  text: string;
  /** Accent colour used by the little tag underline / print. */
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
/* roles + palette                                                     */
/* ------------------------------------------------------------------ */

type Role = 'web' | 'ux' | 'front' | 'other';

/** Body colours sampled from reference/target.png. */
const BODY: Record<Role, string> = {
  web: '#f49ac8',
  ux: '#6fd6d2',
  front: '#5a7de8',
  other: '#d3a6f0',
};

const ICON: Record<Role, number> = { web: 0, ux: 2, front: 1, other: 3 };

function detectRole(text: string): Role {
  const k = text.toLowerCase().replace(/[^a-z0-9]/g, '');
  if (k.includes('front')) return 'front';
  if (k.includes('ux') || k.includes('ui')) return 'ux';
  if (k.includes('web') || k.includes('dev')) return 'web';
  return 'other';
}

/* ------------------------------------------------------------------ */
/* canvas helpers                                                      */
/* ------------------------------------------------------------------ */

function canvasTex(scale: number, w: number, h: number, draw: (g: CanvasRenderingContext2D) => void) {
  const c = document.createElement('canvas');
  c.width = Math.round(w * scale);
  c.height = Math.round(h * scale);
  const g = c.getContext('2d')!;
  g.scale(scale, scale);
  draw(g);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 16;
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

function ellipse(g: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number) {
  g.beginPath();
  g.ellipse(x, y, rx, ry, 0, 0, TAU);
}

/* ------------------------------------------------------------------ */
/* printed face                                                        */
/* ------------------------------------------------------------------ */

/**
 * Printed face texture. Logical canvas is 256 x 312, rendered at 2x
 * (512 x 624) for crisp acrylic print under the studio lights.
 */
function faceTexture(label: CharmLabel, role: Role) {
  return canvasTex(2, 256, 312, (g) => {
    const W = 256;
    const H = 312;
    const base = new THREE.Color(BODY[role]);
    const top = base.clone().offsetHSL(0, 0.03, 0.1).getStyle();
    const bottom = base.clone().offsetHSL(0, -0.03, -0.09).getStyle();

    const grad = g.createLinearGradient(0, 0, W * 0.45, H);
    grad.addColorStop(0, top);
    grad.addColorStop(1, bottom);
    g.fillStyle = grad;
    g.fillRect(0, 0, W, H);

    // glossy acrylic inner keyline
    g.strokeStyle = 'rgba(255,255,255,0.7)';
    g.lineWidth = 6;
    roundRect(g, 11, 11, W - 22, H - 22, 24);
    g.stroke();

    const icon = ICON[role];

    if (icon === 0) {
      /* ---------------- Tamagotchi / pocket pet ---------------- */
      const cx = W / 2;
      const cy = 150;

      // soft shell shading
      const shell = g.createRadialGradient(cx - 34, cy - 74, 8, cx, cy, 150);
      shell.addColorStop(0, 'rgba(255,255,255,0.55)');
      shell.addColorStop(0.55, 'rgba(255,255,255,0.06)');
      shell.addColorStop(1, 'rgba(120,40,90,0.12)');
      g.fillStyle = shell;
      g.fillRect(0, 0, W, H);

      // white scalloped bezel
      g.fillStyle = '#fff8fc';
      for (let i = 0; i < 22; i++) {
        const a = (i / 22) * TAU;
        g.beginPath();
        g.arc(cx + Math.cos(a) * 63, 133 + Math.sin(a) * 73, 11.5, 0, TAU);
        g.fill();
      }
      ellipse(g, cx, 133, 64, 74);
      g.fill();

      // pink inner ring
      g.strokeStyle = '#f3a6cc';
      g.lineWidth = 3;
      ellipse(g, cx, 133, 55, 65);
      g.stroke();

      // mint LCD
      g.fillStyle = '#b9f5d8';
      g.strokeStyle = '#5a4a66';
      g.lineWidth = 3.5;
      roundRect(g, 72, 98, 112, 74, 12);
      g.fill();
      g.stroke();

      // pixel buddy (cute blob + smile)
      g.fillStyle = '#254238';
      g.fillRect(104, 118, 12, 14);
      g.fillRect(140, 118, 12, 14);
      g.fillRect(110, 142, 36, 8);
      g.fillStyle = '#ff70a6';
      g.fillRect(88, 128, 10, 8);
      g.fillRect(158, 128, 10, 8);
      g.fillStyle = '#7fe0b0';
      g.fillRect(112, 108, 32, 5);

      // 3 little buttons on the shell
      const btnCols = ['#ff5a96', '#ffe066', '#67c3ff'];
      for (let i = 0; i < 3; i++) {
        g.fillStyle = '#ffffff';
        g.beginPath();
        g.arc(cx - 36 + i * 36, 236, 12, 0, TAU);
        g.fill();
        g.fillStyle = btnCols[i];
        g.beginPath();
        g.arc(cx - 36 + i * 36, 236, 5.5, 0, TAU);
        g.fill();
      }
    } else if (icon === 1) {
      /* ---------------- Retro CRT / Front-end ---------------- */
      // monitor shell
      g.fillStyle = '#4a66d2';
      g.strokeStyle = 'rgba(255,255,255,0.85)';
      g.lineWidth = 5;
      roundRect(g, 26, 32, 204, 172, 20);
      g.fill();
      g.stroke();

      // shell highlight
      const sheen = g.createLinearGradient(0, 32, 0, 204);
      sheen.addColorStop(0, 'rgba(255,255,255,0.32)');
      sheen.addColorStop(0.5, 'rgba(255,255,255,0.02)');
      sheen.addColorStop(1, 'rgba(20,20,80,0.12)');
      g.fillStyle = sheen;
      roundRect(g, 26, 32, 204, 172, 20);
      g.fill();

      // magenta screen
      g.fillStyle = '#ff7fc2';
      roundRect(g, 42, 46, 172, 124, 10);
      g.fill();

      // browser window
      g.fillStyle = '#fff6fb';
      roundRect(g, 52, 56, 152, 104, 7);
      g.fill();

      // chrome bar + dots
      g.fillStyle = '#2b2f55';
      roundRect(g, 52, 56, 152, 20, 7);
      g.fill();
      const dots = ['#ff6b8b', '#ffe066', '#7fe0b0'];
      for (let i = 0; i < 3; i++) {
        g.fillStyle = dots[i];
        g.beginPath();
        g.arc(64 + i * 14, 66, 4.5, 0, TAU);
        g.fill();
      }

      // code blocks
      g.fillStyle = '#ff9ecb';
      roundRect(g, 62, 84, 54, 30, 6);
      g.fill();
      g.fillStyle = '#75d4ff';
      roundRect(g, 62, 120, 84, 10, 5);
      g.fill();
      g.fillStyle = '#c9b8ff';
      roundRect(g, 62, 136, 62, 10, 5);
      g.fill();
      g.fillStyle = '#7fe0b0';
      roundRect(g, 126, 84, 68, 46, 8);
      g.fill();
      g.fillStyle = '#2b2f55';
      roundRect(g, 126, 138, 48, 8, 4);
      g.fill();

      // stand + dark keyboard
      g.fillStyle = '#232848';
      roundRect(g, 108, 204, 40, 22, 5);
      g.fill();
      roundRect(g, 62, 224, 132, 28, 9);
      g.fill();
      g.fillStyle = '#4a5080';
      for (let row = 0; row < 2; row++) {
        for (let i = 0; i < 7; i++) {
          roundRect(g, 72 + i * 17, 231 + row * 9, 11, 5, 2);
          g.fill();
        }
      }
    } else if (icon === 2) {
      /* ---------------- Mint handheld / UX/UI ---------------- */
      // device body
      g.fillStyle = '#55c4bf';
      g.strokeStyle = 'rgba(255,255,255,0.9)';
      g.lineWidth = 5;
      roundRect(g, 34, 34, 188, 240, 26);
      g.fill();
      g.stroke();

      // body sheen
      const sheen = g.createLinearGradient(34, 34, 222, 274);
      sheen.addColorStop(0, 'rgba(255,255,255,0.35)');
      sheen.addColorStop(0.55, 'rgba(255,255,255,0.02)');
      sheen.addColorStop(1, 'rgba(20,90,90,0.14)');
      g.fillStyle = sheen;
      roundRect(g, 34, 34, 188, 240, 26);
      g.fill();

      // speaker slots
      g.fillStyle = '#2c4a52';
      roundRect(g, 102, 48, 52, 5, 2.5);
      g.fill();
      for (let i = 0; i < 3; i++) {
        roundRect(g, 106 + i * 16, 58, 10, 4, 2);
        g.fill();
      }

      // screen housing
      g.fillStyle = '#26394a';
      roundRect(g, 48, 72, 160, 108, 12);
      g.fill();

      // orange screen
      g.fillStyle = '#ff925c';
      roundRect(g, 58, 82, 140, 84, 8);
      g.fill();
      g.fillStyle = '#fff1de';
      roundRect(g, 66, 90, 124, 68, 5);
      g.fill();

      // tiny header + wireframe content
      g.fillStyle = '#26394a';
      roundRect(g, 66, 90, 124, 15, 5);
      g.fill();
      g.fillStyle = '#ff925c';
      roundRect(g, 74, 114, 52, 22, 5);
      g.fill();
      g.fillStyle = '#6fd6d2';
      roundRect(g, 132, 114, 48, 22, 5);
      g.fill();
      g.fillStyle = '#26394a';
      roundRect(g, 74, 142, 74, 7, 3.5);
      g.fill();
      g.fillStyle = '#b8c2cc';
      roundRect(g, 132, 142, 42, 7, 3.5);
      g.fill();

      // D-pad + buttons
      g.fillStyle = '#27454f';
      roundRect(g, 66, 196, 62, 16, 6);
      g.fill();
      roundRect(g, 89, 184, 16, 40, 6);
      g.fill();

      const btn = ['#ff8fc0', '#ffe066', '#8ab8ff'];
      for (let i = 0; i < 3; i++) {
        g.fillStyle = btn[i];
        g.beginPath();
        g.arc(150 + (i % 2) * 28, 196 + Math.floor(i / 2) * 26, 11, 0, TAU);
        g.fill();
      }

      // bottom status pill
      g.fillStyle = '#ffffff';
      roundRect(g, 76, 246, 104, 14, 7);
      g.fill();
    } else {
      /* ---------------- 3D Art isometric glossy cube ---------------- */
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

    // top-left laminate highlight
    const gloss = g.createLinearGradient(0, 0, W, H);
    gloss.addColorStop(0, 'rgba(255,255,255,0.36)');
    gloss.addColorStop(0.35, 'rgba(255,255,255,0.04)');
    gloss.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gloss;
    g.fillRect(0, 0, W, H);
  });
}

/** Crisp white pill tag: logical 256 x 96, rendered at 2x (512 x 192). */
function tagTexture(text: string, _accent: string) {
  return canvasTex(2, 256, 96, (g) => {
    const W = 256;
    const H = 96;

    g.fillStyle = '#ffffff';
    roundRect(g, 2, 2, W - 4, H - 4, 20);
    g.fill();

    g.strokeStyle = '#c4cbd8';
    g.lineWidth = 3;
    roundRect(g, 5, 5, W - 10, H - 10, 17);
    g.stroke();

    let size = 54;
    g.font = `800 ${size}px ${FONT}`;
    while (g.measureText(text).width > W - 26 && size > 18) {
      size -= 2;
      g.font = `800 ${size}px ${FONT}`;
    }
    g.fillStyle = '#232836';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(text, W / 2, H / 2 + 1);
  });
}

/* ------------------------------------------------------------------ */
/* geometry helpers                                                    */
/* ------------------------------------------------------------------ */

function rodBetween(a: THREE.Vector3, b: THREE.Vector3, radius: number) {
  const dir = b.clone().sub(a);
  const len = dir.length();
  const geo = new THREE.CylinderGeometry(radius, radius, len, 5, 1);
  geo.translate(0, -len / 2, 0);
  const q = new THREE.Quaternion().setFromUnitVectors(
    new THREE.Vector3(0, -1, 0),
    dir.normalize()
  );
  geo.applyQuaternion(q);
  geo.translate(a.x, a.y, a.z);
  return geo;
}

/**
 * Single-strand silver beaded ball-chain: fine beads, a small loop over the
 * top rail, and a jump-ring at the bottom, like the neat chains in
 * reference/target.png.
 */
function chainGeometry(length: number) {
  const parts: THREE.BufferGeometry[] = [];
  const top = new THREE.Vector3(0, 0, 0);
  const bottom = new THREE.Vector3(0, -length, 0);

  // slim core wire so the chain reads continuous between beads
  parts.push(rodBetween(top, bottom, 0.0006));

  const beadR = 0.0022;
  const spacing = 0.0065;
  const beads = Math.max(2, Math.round(length / spacing));
  for (let i = 1; i < beads; i++) {
    const p = top.clone().lerp(bottom, i / beads);
    const bead = new THREE.SphereGeometry(beadR, 6, 5);
    bead.translate(p.x, p.y, p.z);
    parts.push(bead);
  }

  // small clasp ring hooked over the rail
  const railLoop = new THREE.TorusGeometry(0.0038, 0.0009, 5, 14);
  parts.push(railLoop);

  return parts;
}

function roundedRectShape(w: number, h: number, r: number) {
  const s = new THREE.Shape();
  const x = -w / 2;
  const y = -h / 2;
  const rr = Math.min(r, w / 2, h / 2);
  s.moveTo(x + rr, y);
  s.lineTo(x + w - rr, y);
  s.quadraticCurveTo(x + w, y, x + w, y + rr);
  s.lineTo(x + w, y + h - rr);
  s.quadraticCurveTo(x + w, y + h, x + w - rr, y + h);
  s.lineTo(x + rr, y + h);
  s.quadraticCurveTo(x, y + h, x, y + h - rr);
  s.lineTo(x, y + rr);
  s.quadraticCurveTo(x, y, x + rr, y);
  return s;
}

function ellipseShape(rx: number, ry: number) {
  const s = new THREE.Shape();
  s.absellipse(0, 0, rx, ry, 0, TAU, false, 0);
  return s;
}

/** Extruded die-cut acrylic plate, centred on z = 0. */
function acrylicPlate(shape: THREE.Shape, depth: number) {
  const g = new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: true,
    bevelSize: 0.0016,
    bevelThickness: 0.0012,
    bevelSegments: 2,
    curveSegments: 40,
    steps: 1,
  });
  g.translate(0, 0, -depth / 2);
  return g.index ? g.toNonIndexed() : g;
}

/* ------------------------------------------------------------------ */
/* placement                                                           */
/* ------------------------------------------------------------------ */

type Placement = { xn: number; chain: number };

/**
 * Positions are expressed as fractions of `halfWidth` and match the
 * reference: the three charms sit to the right of the claw, with the
 * UX/UI one hanging on a longer chain in the middle.
 */
function placementsFor(labels: CharmLabel[]): Placement[] {
  const n = labels.length;
  const roles = labels.map((l) => detectRole(l.text));

  if (n === 3) {
    const map: Record<Role, Placement> = {
      web: { xn: 0.04, chain: 0.046 },
      ux: { xn: 0.44, chain: 0.088 },
      front: { xn: 0.84, chain: 0.05 },
      other: { xn: 0.62, chain: 0.07 },
    };
    return roles.map((r) => map[r]);
  }

  if (n === 4) {
    const map: Record<Role, Placement> = {
      web: { xn: 0.13, chain: 0.068 },
      ux: { xn: 0.43, chain: 0.135 },
      other: { xn: 0.68, chain: 0.1 },
      front: { xn: 0.96, chain: 0.072 },
    };
    return roles.map((r) => map[r]);
  }

  const chains = [0.068, 0.135, 0.092, 0.104];
  if (n === 1) return [{ xn: 0.3, chain: 0.068 }];
  if (n === 2) {
    return [
      { xn: -0.15, chain: 0.068 },
      { xn: 0.55, chain: 0.11 },
    ];
  }
  return labels.map((_, i) => ({
    xn: -0.6 + (1.6 * i) / (n - 1),
    chain: chains[i % chains.length],
  }));
}

/* ------------------------------------------------------------------ */
/* public API                                                          */
/* ------------------------------------------------------------------ */

export function buildCharms(opts: CharmsOptions): Charms {
  const { labels, topY, z, halfWidth } = opts;
  const group = new THREE.Group();
  group.name = 'charms';

  const rimMat = new THREE.MeshPhysicalMaterial({
    color: '#eef6ff',
    roughness: 0.25,
    metalness: 0,
    transparent: true,
    opacity: 0.52,
    clearcoat: 0.35,
    clearcoatRoughness: 0.25,
    envMapIntensity: 1.0,
    depthWrite: false,
  });
  const tagMat = new THREE.MeshPhysicalMaterial({
    color: '#ffffff',
    roughness: 0.16,
    metalness: 0.02,
    clearcoat: 0.55,
    clearcoatRoughness: 0.2,
    envMapIntensity: 1.1,
  });
  const chromeMat = new THREE.MeshStandardMaterial({
    color: '#e8eef5',
    metalness: 0.82,
    roughness: 0.2,
    envMapIntensity: 1.5,
  });

  const roles = labels.map((l) => detectRole(l.text));
  const placements = placementsFor(labels);
  const pivots: THREE.Group[] = [];

  const tagW = 0.108;
  const tagH = 0.034;
  const tagPlaneGeo = new THREE.PlaneGeometry(tagW - 0.005, tagH - 0.005);
  const tagGeo = new RoundedBoxGeometry(tagW, tagH, 0.0044, 2, 0.008);
  const tagGeoNI = tagGeo.index ? tagGeo.toNonIndexed() : tagGeo;

  labels.forEach((label, i) => {
    const role = roles[i];
    const icon = ICON[role];
    const placement = placements[i];

    const pivot = new THREE.Group();
    const jitter = ((i % 2 ? 1 : -1) * (0.003 + i * 0.0012));
    pivot.position.set(halfWidth * placement.xn + jitter, topY, z);
    const tilt = (i % 2 ? -1 : 1) * (0.012 + (i % 3) * 0.005);
    pivot.rotation.z = tilt;
    pivot.userData.tilt = tilt;
    pivot.userData.phase = i * 1.37;
    group.add(pivot);
    pivots.push(pivot);

    // die-cut silhouette: egg for the Tamagotchi, rounded plate otherwise
    const badgeW = icon === 0 ? 0.074 : 0.08;
    const badgeH = icon === 0 ? 0.106 : 0.096;
    const rimW = badgeW + 0.006;
    const rimH = badgeH + 0.006;

    const chainLen = placement.chain;
    const badgeY = -chainLen - 0.008 - rimH / 2;
    const badgeTop = badgeY + rimH / 2;
    const badgeBottom = badgeY - rimH / 2;
    const tagY = badgeBottom - 0.007 - tagH / 2;
    const tagTop = tagY + tagH / 2;

    // silver hardware
    const chromeParts = chainGeometry(chainLen);
    const ring = (r: number, y: number) => {
      const t = new THREE.TorusGeometry(r, 0.0011, 5, 12);
      t.translate(0, y, 0);
      return t;
    };
    chromeParts.push(ring(0.0038, -chainLen - 0.001));
    chromeParts.push(ring(0.0034, badgeTop - 0.0015));
    chromeParts.push(ring(0.0032, badgeBottom - 0.0015));
    chromeParts.push(ring(0.0038, (badgeBottom + tagTop) / 2));
    chromeParts.push(ring(0.0032, tagTop + 0.0015));
    // mix of indexed primitives + non-indexed RoundedBoxGeometry: normalise
    const chromeFlat = chromeParts.map((p) => (p.index ? p.toNonIndexed() : p));
    const chrome = new THREE.Mesh(mergeGeometries(chromeFlat, false)!, chromeMat);
    pivot.add(chrome);

    // white acrylic rim + crisp pill tag
    const rimShape =
      icon === 0 ? ellipseShape(rimW / 2, rimH / 2) : roundedRectShape(rimW, rimH, 0.014);
    const rimGeo = acrylicPlate(rimShape, 0.006);
    rimGeo.translate(0, badgeY, 0);
    const rim = new THREE.Mesh(rimGeo, rimMat);
    pivot.add(rim);

    // crisp opaque white pill tag below the acrylic badge
    const tagBox = tagGeoNI.clone();
    tagBox.translate(0, tagY, 0);
    const tagPlate = new THREE.Mesh(tagBox, tagMat);
    pivot.add(tagPlate);

    // printed face
    let faceGeo: THREE.BufferGeometry;
    if (icon === 0) {
      faceGeo = new THREE.CircleGeometry(0.5, 64);
      faceGeo.scale(badgeW, badgeH, 1);
    } else {
      faceGeo = new THREE.PlaneGeometry(badgeW, badgeH);
    }
    const face = new THREE.Mesh(
      faceGeo,
      new THREE.MeshStandardMaterial({
        map: faceTexture(label, role),
        roughness: 0.22,
        metalness: 0,
        envMapIntensity: 0.9,
      })
    );
    face.position.set(0, badgeY, 0.0052);
    pivot.add(face);

    const tag = new THREE.Mesh(
      tagPlaneGeo,
      new THREE.MeshStandardMaterial({
        map: tagTexture(label.text, label.color),
        roughness: 0.3,
        metalness: 0,
        envMapIntensity: 0.7,
      })
    );
    tag.position.set(0, tagY, 0.0028);
    pivot.add(tag);
  });

  // Gentle, continuous breeze sway (~1.5°) — never decays to a dead stop.
  const AMP = 1.5 * DEG;
  const update = (t: number) => {
    for (const p of pivots) {
      const phase = p.userData.phase as number;
      const sway =
        AMP *
        (0.78 * Math.sin(t * 0.55 + phase) + 0.22 * Math.sin(t * 0.91 + phase * 1.7));
      p.rotation.z = (p.userData.tilt as number) + sway;
      p.rotation.x = AMP * 0.25 * Math.sin(t * 0.47 + phase * 1.31);
    }
  };

  return { group, update };
}
