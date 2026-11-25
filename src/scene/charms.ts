import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

/**
 * Hanging kawaii acrylic charms inside the cabinet.
 *
 * Each charm has a bright silver beaded ball-chain hooked over the rear rail,
 * a die-cut frosted acrylic rim, vibrant printed face (Tamagotchi, tilted mint
 * handheld, royal-blue CRT monitor), crisp white label tag, and a real 2-axis
 * damped pendulum physics simulation that collides with the claw mechanism so
 * the arm physically pushes charms aside instead of clipping through them.
 */

export type CharmLabel = {
  text: string;
  color: string;
};

export type CharmsOptions = {
  labels: CharmLabel[];
  topY: number;
  z: number;
  halfWidth: number;
};

export type CharmObstacle = {
  x: number;
  y: number;
  z: number;
  r: number;
};

export type Charms = {
  group: THREE.Group;
  update(t: number, dt?: number, obstacles?: CharmObstacle[]): void;
};

const TAU = Math.PI * 2;
const FONT = '"Arial Rounded MT Bold", "Helvetica Neue", Inter, Arial, sans-serif';
const DEG = Math.PI / 180;

/* ------------------------------------------------------------------ */
/* roles + vivid palette                                               */
/* ------------------------------------------------------------------ */

type Role = 'web' | 'ux' | 'front' | 'other';

const BODY: Record<Role, string> = {
  web: '#f886c4',
  ux: '#4cd8d0',
  front: '#4468ec',
  other: '#c88ef6',
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

function faceTexture(label: CharmLabel, role: Role) {
  return canvasTex(2, 256, 312, (g) => {
    const W = 256;
    const H = 312;
    const base = new THREE.Color(BODY[role]);
    const top = base.clone().offsetHSL(0, 0.05, 0.09).getStyle();
    const bottom = base.clone().offsetHSL(0, 0.02, -0.09).getStyle();

    const grad = g.createLinearGradient(0, 0, W * 0.45, H);
    grad.addColorStop(0, top);
    grad.addColorStop(1, bottom);
    g.fillStyle = grad;
    g.fillRect(0, 0, W, H);

    g.strokeStyle = 'rgba(255,255,255,0.78)';
    g.lineWidth = 6;
    roundRect(g, 11, 11, W - 22, H - 22, 24);
    g.stroke();

    const icon = ICON[role];

    if (icon === 0) {
      /* ---------------- Tamagotchi / Web Dev ---------------- */
      const cx = W / 2;
      const cy = 150;

      const shell = g.createRadialGradient(cx - 34, cy - 74, 8, cx, cy, 150);
      shell.addColorStop(0, 'rgba(255,255,255,0.52)');
      shell.addColorStop(0.55, 'rgba(255,255,255,0.05)');
      shell.addColorStop(1, 'rgba(140,24,84,0.16)');
      g.fillStyle = shell;
      g.fillRect(0, 0, W, H);

      g.fillStyle = '#fff8fc';
      for (let i = 0; i < 22; i++) {
        const a = (i / 22) * TAU;
        g.beginPath();
        g.arc(cx + Math.cos(a) * 63, 133 + Math.sin(a) * 73, 11.5, 0, TAU);
        g.fill();
      }
      ellipse(g, cx, 133, 64, 74);
      g.fill();

      g.strokeStyle = '#f282be';
      g.lineWidth = 3.5;
      ellipse(g, cx, 133, 55, 65);
      g.stroke();

      g.fillStyle = '#aaf2ce';
      g.strokeStyle = '#4e3c5c';
      g.lineWidth = 4;
      roundRect(g, 72, 98, 112, 74, 12);
      g.fill();
      g.stroke();

      g.fillStyle = '#1d3a30';
      g.fillRect(104, 118, 12, 14);
      g.fillRect(140, 118, 12, 14);
      g.fillRect(110, 142, 36, 8);
      g.fillStyle = '#ff5c9e';
      g.fillRect(88, 128, 10, 8);
      g.fillRect(158, 128, 10, 8);
      g.fillStyle = '#62d99e';
      g.fillRect(112, 108, 32, 5);

      const btnCols = ['#ff3d8c', '#ffd628', '#38b2ff'];
      for (let i = 0; i < 3; i++) {
        g.fillStyle = '#ffffff';
        g.beginPath();
        g.arc(cx - 36 + i * 36, 236, 12, 0, TAU);
        g.fill();
        g.fillStyle = btnCols[i];
        g.beginPath();
        g.arc(cx - 36 + i * 36, 236, 6, 0, TAU);
        g.fill();
      }
    } else if (icon === 1) {
      /* ---------------- Retro CRT / Front-end ---------------- */
      g.fillStyle = '#3856d6';
      g.strokeStyle = 'rgba(255,255,255,0.9)';
      g.lineWidth = 5;
      roundRect(g, 26, 32, 204, 172, 20);
      g.fill();
      g.stroke();

      const sheen = g.createLinearGradient(0, 32, 0, 204);
      sheen.addColorStop(0, 'rgba(255,255,255,0.34)');
      sheen.addColorStop(0.5, 'rgba(255,255,255,0.02)');
      sheen.addColorStop(1, 'rgba(16,18,74,0.16)');
      g.fillStyle = sheen;
      roundRect(g, 26, 32, 204, 172, 20);
      g.fill();

      g.fillStyle = '#ff5cb4';
      roundRect(g, 42, 46, 172, 124, 10);
      g.fill();

      g.fillStyle = '#fff5fb';
      roundRect(g, 52, 56, 152, 104, 7);
      g.fill();

      g.fillStyle = '#242850';
      roundRect(g, 52, 56, 152, 20, 7);
      g.fill();
      const dots = ['#ff4d7a', '#ffd628', '#52e09c'];
      for (let i = 0; i < 3; i++) {
        g.fillStyle = dots[i];
        g.beginPath();
        g.arc(64 + i * 14, 66, 4.5, 0, TAU);
        g.fill();
      }

      g.fillStyle = '#ff72b8';
      roundRect(g, 62, 84, 54, 30, 6);
      g.fill();
      g.fillStyle = '#40c2ff';
      roundRect(g, 62, 120, 84, 10, 5);
      g.fill();
      g.fillStyle = '#b49cff';
      roundRect(g, 62, 136, 62, 10, 5);
      g.fill();
      g.fillStyle = '#52e09c';
      roundRect(g, 126, 84, 68, 46, 8);
      g.fill();
      g.fillStyle = '#242850';
      roundRect(g, 126, 138, 48, 8, 4);
      g.fill();

      g.fillStyle = '#1e2444';
      roundRect(g, 108, 204, 40, 22, 5);
      g.fill();
      roundRect(g, 62, 224, 132, 28, 9);
      g.fill();
      g.fillStyle = '#4e5688';
      for (let row = 0; row < 2; row++) {
        for (let i = 0; i < 7; i++) {
          roundRect(g, 72 + i * 17, 231 + row * 9, 11, 5, 2);
          g.fill();
        }
      }
    } else if (icon === 2) {
      /* ---------------- Mint handheld / UX/UI ---------------- */
      g.fillStyle = '#3cc8c2';
      g.strokeStyle = 'rgba(255,255,255,0.92)';
      g.lineWidth = 5;
      roundRect(g, 34, 34, 188, 240, 26);
      g.fill();
      g.stroke();

      const sheen = g.createLinearGradient(34, 34, 222, 274);
      sheen.addColorStop(0, 'rgba(255,255,255,0.36)');
      sheen.addColorStop(0.55, 'rgba(255,255,255,0.02)');
      sheen.addColorStop(1, 'rgba(14,82,84,0.16)');
      g.fillStyle = sheen;
      roundRect(g, 34, 34, 188, 240, 26);
      g.fill();

      g.fillStyle = '#224048';
      roundRect(g, 102, 48, 52, 5, 2.5);
      g.fill();
      for (let i = 0; i < 3; i++) {
        roundRect(g, 106 + i * 16, 58, 10, 4, 2);
        g.fill();
      }

      g.fillStyle = '#203242';
      roundRect(g, 48, 72, 160, 108, 12);
      g.fill();

      g.fillStyle = '#ff7d40';
      roundRect(g, 58, 82, 140, 84, 8);
      g.fill();
      g.fillStyle = '#fff0d8';
      roundRect(g, 66, 90, 124, 68, 5);
      g.fill();

      g.fillStyle = '#203242';
      roundRect(g, 66, 90, 124, 15, 5);
      g.fill();
      g.fillStyle = '#ff7d40';
      roundRect(g, 74, 114, 52, 22, 5);
      g.fill();
      g.fillStyle = '#4ad2cc';
      roundRect(g, 132, 114, 48, 22, 5);
      g.fill();
      g.fillStyle = '#203242';
      roundRect(g, 74, 142, 74, 7, 3.5);
      g.fill();
      g.fillStyle = '#a4b2be';
      roundRect(g, 132, 142, 42, 7, 3.5);
      g.fill();

      g.fillStyle = '#1e3c46';
      roundRect(g, 66, 196, 62, 16, 6);
      g.fill();
      roundRect(g, 89, 184, 16, 40, 6);
      g.fill();

      const btn = ['#ff68ae', '#ffd628', '#5aa2ff'];
      for (let i = 0; i < 3; i++) {
        g.fillStyle = btn[i];
        g.beginPath();
        g.arc(150 + (i % 2) * 28, 196 + Math.floor(i / 2) * 26, 11, 0, TAU);
        g.fill();
      }

      g.fillStyle = '#ffffff';
      roundRect(g, 76, 246, 104, 14, 7);
      g.fill();
    } else {
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
      poly([[cx, cy - r * 0.72], [cx + r * 0.88, cy - r * 0.3], [cx, cy + r * 0.12], [cx - r * 0.88, cy - r * 0.3]], '#ffffff');
      poly([[cx - r * 0.88, cy - r * 0.3], [cx, cy + r * 0.12], [cx, cy + r * 0.88], [cx - r * 0.88, cy + r * 0.44]], '#ffe052');
      poly([[cx, cy + r * 0.12], [cx + r * 0.88, cy - r * 0.3], [cx + r * 0.88, cy + r * 0.44], [cx, cy + r * 0.88]], '#4cc8ff');
      g.strokeStyle = '#30244e';
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

    const gloss = g.createLinearGradient(0, 0, W, H);
    gloss.addColorStop(0, 'rgba(255,255,255,0.34)');
    gloss.addColorStop(0.35, 'rgba(255,255,255,0.04)');
    gloss.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gloss;
    g.fillRect(0, 0, W, H);
  });
}

/** Crisp frosted white pill tag matching reference/target.png. */
function tagTexture(text: string, _accent: string) {
  return canvasTex(2, 256, 92, (g) => {
    const W = 256;
    const H = 92;

    g.fillStyle = '#f8fafe';
    roundRect(g, 3, 3, W - 6, H - 6, 20);
    g.fill();

    g.strokeStyle = 'rgba(130, 146, 174, 0.45)';
    g.lineWidth = 3;
    roundRect(g, 4.5, 4.5, W - 9, H - 9, 18);
    g.stroke();

    let size = 50;
    g.font = `800 ${size}px ${FONT}`;
    while (g.measureText(text).width > W - 28 && size > 18) {
      size -= 2;
      g.font = `800 ${size}px ${FONT}`;
    }
    g.fillStyle = '#202636';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(text, W / 2, H / 2 + 1);
  });
}

/* ------------------------------------------------------------------ */
/* geometry helpers                                                    */
/* ------------------------------------------------------------------ */

/**
 * Bright, legible silver beaded ball-chain loop like reference/target.png.
 * Two slim beaded strands converge from a top loop down to the jump-ring so
 * the chain reads clearly at normal viewing distance.
 */
function chainGeometry(length: number) {
  const parts: THREE.BufferGeometry[] = [];
  const beadR = 0.0032;
  const spacing = 0.0072;
  const beads = Math.max(4, Math.round(length / spacing));

  // Two gently arched loop strands (front/back slight spread) like a real ball-chain keychain
  for (const side of [-1, 1]) {
    for (let i = 0; i <= beads; i++) {
      const u = i / beads;
      const spread = Math.sin(Math.PI * u) * 0.0085 * side;
      const y = -u * length;
      const bead = new THREE.SphereGeometry(beadR, 7, 6);
      bead.translate(spread, y, 0);
      parts.push(bead);
    }
  }

  // Top clasp ring hooked over the gantry bar
  const railLoop = new THREE.TorusGeometry(0.0055, 0.0014, 6, 14);
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

type Placement = { xn: number; chain: number; restTilt: number };

function placementsFor(labels: CharmLabel[]): Placement[] {
  const n = labels.length;
  const roles = labels.map((l) => detectRole(l.text));

  if (n === 3) {
    // Mirrors reference/target.png: Web Dev left, UX/UI hanging lower and tilted clockwise in middle, Front-end right.
    const map: Record<Role, Placement> = {
      web: { xn: 0.02, chain: 0.105, restTilt: 0.015 },
      ux: { xn: 0.44, chain: 0.145, restTilt: -0.16 },
      front: { xn: 0.86, chain: 0.102, restTilt: -0.01 },
      other: { xn: 0.62, chain: 0.135, restTilt: 0.02 },
    };
    return roles.map((r) => map[r]);
  }

  if (n === 4) {
    const map: Record<Role, Placement> = {
      web: { xn: 0.13, chain: 0.068, restTilt: 0.02 },
      ux: { xn: 0.43, chain: 0.135, restTilt: -0.15 },
      other: { xn: 0.68, chain: 0.1, restTilt: 0.03 },
      front: { xn: 0.96, chain: 0.072, restTilt: -0.02 },
    };
    return roles.map((r) => map[r]);
  }

  const chains = [0.068, 0.125, 0.088, 0.104];
  if (n === 1) return [{ xn: 0.3, chain: 0.068, restTilt: 0 }];
  if (n === 2) {
    return [
      { xn: -0.15, chain: 0.068, restTilt: 0.02 },
      { xn: 0.55, chain: 0.11, restTilt: -0.06 },
    ];
  }
  return labels.map((_, i) => ({
    xn: -0.6 + (1.6 * i) / (n - 1),
    chain: chains[i % chains.length],
    restTilt: (i % 2 ? -1 : 1) * 0.03,
  }));
}

/* ------------------------------------------------------------------ */
/* pendulum simulation state                                           */
/* ------------------------------------------------------------------ */

type CharmBody = {
  pivot: THREE.Group;
  px: number;
  py: number;
  pz: number;
  restTilt: number;
  phase: number;
  rotX: number;
  rotZ: number;
  velX: number;
  velZ: number;
  /** Local vertical offsets + bounding radii of sample spheres along the hanging charm. */
  samples: { y: number; r: number }[];
};

const _v = new THREE.Vector3();
const _euler = new THREE.Euler(0, 0, 0, 'XYZ');

/* ------------------------------------------------------------------ */
/* public API                                                          */
/* ------------------------------------------------------------------ */

export function buildCharms(opts: CharmsOptions): Charms {
  const { labels, topY, z, halfWidth } = opts;
  const group = new THREE.Group();
  group.name = 'charms';

  const rimMat = new THREE.MeshPhysicalMaterial({
    color: '#eef7ff',
    roughness: 0.18,
    metalness: 0,
    transparent: true,
    opacity: 0.58,
    clearcoat: 0.55,
    clearcoatRoughness: 0.15,
    envMapIntensity: 1.25,
    depthWrite: false,
  });
  const tagMat = new THREE.MeshPhysicalMaterial({
    color: '#ffffff',
    roughness: 0.14,
    metalness: 0.02,
    clearcoat: 0.6,
    clearcoatRoughness: 0.16,
    envMapIntensity: 1.2,
  });
  const chromeMat = new THREE.MeshStandardMaterial({
    color: '#f2f6fc',
    metalness: 0.9,
    roughness: 0.14,
    envMapIntensity: 1.65,
  });

  const roles = labels.map((l) => detectRole(l.text));
  const placements = placementsFor(labels);
  const bodies: CharmBody[] = [];

  const tagW = 0.106;
  const tagH = 0.032;
  const tagPlaneGeo = new THREE.PlaneGeometry(tagW - 0.005, tagH - 0.005);
  const tagGeo = new RoundedBoxGeometry(tagW, tagH, 0.0044, 2, 0.008);
  const tagGeoNI = tagGeo.index ? tagGeo.toNonIndexed() : tagGeo;

  labels.forEach((label, i) => {
    const role = roles[i];
    const icon = ICON[role];
    const placement = placements[i];

    const pivot = new THREE.Group();
    const px = halfWidth * placement.xn;
    const py = topY;
    const pz = z;
    pivot.position.set(px, py, pz);
    pivot.rotation.z = placement.restTilt;
    group.add(pivot);

    const badgeW = icon === 0 ? 0.076 : 0.082;
    const badgeH = icon === 0 ? 0.106 : 0.098;
    const rimW = badgeW + 0.008;
    const rimH = badgeH + 0.008;

    const chainLen = placement.chain;
    const badgeY = -chainLen - 0.008 - rimH / 2;
    const badgeTop = badgeY + rimH / 2;
    const badgeBottom = badgeY - rimH / 2;
    const tagY = badgeBottom - 0.007 - tagH / 2;
    const tagTop = tagY + tagH / 2;

    // Gleaming silver ball-chain + jump rings
    const chromeParts = chainGeometry(chainLen);
    const ring = (r: number, y: number) => {
      const t = new THREE.TorusGeometry(r, 0.0013, 6, 14);
      t.translate(0, y, 0);
      return t;
    };
    chromeParts.push(ring(0.0044, -chainLen - 0.001));
    chromeParts.push(ring(0.0038, badgeTop - 0.0015));
    chromeParts.push(ring(0.0036, badgeBottom - 0.0015));
    chromeParts.push(ring(0.004, (badgeBottom + tagTop) / 2));
    chromeParts.push(ring(0.0036, tagTop + 0.0015));
    const chromeFlat = chromeParts.map((p) => (p.index ? p.toNonIndexed() : p));
    const chromeMesh = new THREE.Mesh(mergeGeometries(chromeFlat, false)!, chromeMat);
    pivot.add(chromeMesh);

    const rimShape =
      icon === 0 ? ellipseShape(rimW / 2, rimH / 2) : roundedRectShape(rimW, rimH, 0.014);
    const rimGeo = acrylicPlate(rimShape, 0.006);
    rimGeo.translate(0, badgeY, 0);
    const rim = new THREE.Mesh(rimGeo, rimMat);
    pivot.add(rim);

    const tagBox = tagGeoNI.clone();
    tagBox.translate(0, tagY, 0);
    const tagPlate = new THREE.Mesh(tagBox, tagMat);
    pivot.add(tagPlate);

    let faceGeo: THREE.BufferGeometry;
    if (icon === 0) {
      faceGeo = new THREE.CircleGeometry(0.5, 64);
      faceGeo.scale(badgeW, badgeH, 1);
    } else {
      faceGeo = new THREE.PlaneGeometry(badgeW, badgeH);
    }
    const faceMat = new THREE.MeshStandardMaterial({
      map: faceTexture(label, role),
      roughness: 0.2,
      metalness: 0,
      envMapIntensity: 0.9,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
    });
    const face = new THREE.Mesh(faceGeo, faceMat);
    face.position.set(0, badgeY, 0.0056);
    pivot.add(face);

    // Back face so when the charm swings away from the claw it doesn't disappear from behind
    const faceBack = new THREE.Mesh(faceGeo, faceMat);
    faceBack.position.set(0, badgeY, -0.0056);
    faceBack.rotation.y = Math.PI;
    pivot.add(faceBack);

    const tag = new THREE.Mesh(
      tagPlaneGeo,
      new THREE.MeshStandardMaterial({
        map: tagTexture(label.text, label.color),
        roughness: 0.26,
        metalness: 0,
        envMapIntensity: 0.7,
        polygonOffset: true,
        polygonOffsetFactor: -2,
        polygonOffsetUnits: -2,
      })
    );
    tag.position.set(0, tagY, 0.0036);
    pivot.add(tag);

    bodies.push({
      pivot,
      px,
      py,
      pz,
      restTilt: placement.restTilt,
      phase: i * 1.43,
      rotX: 0,
      rotZ: placement.restTilt,
      velX: 0,
      velZ: 0,
      samples: [
        { y: -chainLen * 0.65, r: 0.016 },
        { y: badgeY, r: Math.max(badgeW, badgeH) * 0.52 },
        { y: tagY, r: tagW * 0.44 },
      ],
    });
  });

  // Real damped 2-axis pendulum simulation + collision against claw obstacles.
  const BREEZE_AMP = 1.4 * DEG;
  const OMEGA = 6.4;
  const ZETA = 0.26;
  const MAX_ANG = 68 * DEG;

  const update = (t: number, dt = 1 / 60, obstacles: CharmObstacle[] = []) => {
    const step = Math.min(0.04, Math.max(0.001, dt));
    const subSteps = Math.max(1, Math.ceil(step * 120));
    const h = step / subSteps;

    for (const b of bodies) {
      const targetZ =
        b.restTilt +
        BREEZE_AMP * (0.78 * Math.sin(t * 0.62 + b.phase) + 0.22 * Math.sin(t * 1.03 + b.phase * 1.7));
      const targetX = BREEZE_AMP * 0.3 * Math.sin(t * 0.51 + b.phase * 1.31);

      for (let s = 0; s < subSteps; s++) {
        // Gravity + chain spring restoring torque
        const accZ = OMEGA * OMEGA * (targetZ - b.rotZ) - 2 * ZETA * OMEGA * b.velZ;
        const accX = OMEGA * OMEGA * (targetX - b.rotX) - 2 * ZETA * OMEGA * b.velX;
        b.velZ += accZ * h;
        b.velX += accX * h;
        b.rotZ += b.velZ * h;
        b.rotX += b.velX * h;

        // Resolve sphere collisions against every part of the claw mechanism
        if (obstacles.length) {
          _euler.set(b.rotX, 0, b.rotZ, 'XYZ');
          for (const sample of b.samples) {
            _v.set(0, sample.y, 0).applyEuler(_euler);
            const sx = b.px + _v.x;
            const sy = b.py + _v.y;
            const sz = b.pz + _v.z;
            const armLen = Math.max(0.04, Math.abs(sample.y));

            for (const obs of obstacles) {
              const dx = sx - obs.x;
              const dy = sy - obs.y;
              const dz = sz - obs.z;
              const minDist = sample.r + obs.r;
              const distSq = dx * dx + dy * dy + dz * dz;
              if (distSq < minDist * minDist) {
                const dist = Math.sqrt(Math.max(1e-8, distSq));
                const pen = minDist - dist;
                // Push direction away from the claw; if nearly concentric, bias away in -Z/+X
                let nx = dist > 1e-4 ? dx / dist : 0.4;
                let nz = dist > 1e-4 ? dz / dist : -0.9;
                const horiz = Math.hypot(nx, nz);
                if (horiz < 0.25) {
                  nx = sx >= obs.x ? 0.7 : -0.7;
                  nz = sz <= obs.z ? -0.7 : 0.7;
                }
                // Positive rotZ swings bottom (-Y) toward +X; negative rotX swings bottom (-Y) toward +Z
                const dRotZ = (nx * pen) / armLen;
                const dRotX = (-nz * pen) / armLen;
                b.rotZ += dRotZ * 0.92;
                b.rotX += dRotX * 0.92;
                b.velZ += (dRotZ / h) * 0.22;
                b.velX += (dRotX / h) * 0.22;
              }
            }
          }
        }

        // Clamp angular swing so chains never flip upside-down or hit the back glass
        b.rotZ = THREE.MathUtils.clamp(b.rotZ, -MAX_ANG, MAX_ANG);
        b.rotX = THREE.MathUtils.clamp(b.rotX, -MAX_ANG * 0.85, MAX_ANG * 0.85);
        b.velZ = THREE.MathUtils.clamp(b.velZ, -8, 8);
        b.velX = THREE.MathUtils.clamp(b.velX, -8, 8);
      }

      b.pivot.rotation.z = b.rotZ;
      b.pivot.rotation.x = b.rotX;
    }
  };

  return { group, update };
}
