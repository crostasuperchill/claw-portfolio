import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import type { Toy } from '../game/roster';
import { chrome, glow, plastic } from './materials';

/**
 * Capsule prizes. Everything is designed to stay legible at 7 cm: one bold
 * silhouette, two or three saturated pastel colours, a single big graphic.
 * No detail is smaller than 2 mm, because below that it turns to mush in
 * the glass capsule.
 */

/** Canvas helper: sRGB texture from a 2D drawing pass. */
function canvasTex(w: number, h: number, draw: (g: CanvasRenderingContext2D) => void) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d')!);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

function screenMat(map: THREE.Texture, intensity = 1.15) {
  return new THREE.MeshStandardMaterial({
    map,
    emissive: new THREE.Color('#ffffff'),
    emissiveMap: map,
    emissiveIntensity: intensity,
    roughness: 0.14,
    metalness: 0,
  });
}

function printMat(map: THREE.Texture) {
  return new THREE.MeshStandardMaterial({ map, roughness: 0.55, metalness: 0 });
}

function fitFont(
  g: CanvasRenderingContext2D,
  text: string,
  max: number,
  start: number,
  weight = 800
) {
  let size = start;
  g.font = `${weight} ${size}px "Helvetica Neue", Inter, Arial, sans-serif`;
  while (g.measureText(text).width > max && size > 20) {
    size -= 1;
    g.font = `${weight} ${size}px "Helvetica Neue", Inter, Arial, sans-serif`;
  }
  return size;
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
/* palette                                                             */
/* ------------------------------------------------------------------ */

const P = {
  pink: '#ff8fbe',
  pinkDeep: '#ec4f8d',
  pinkPale: '#ffd0e2',
  azure: '#5ab4ff',
  azureDeep: '#2f78c6',
  mint: '#8fe8c8',
  yellow: '#ffc933',
  yellowDeep: '#eda92e',
  lilac: '#bda6ff',
  lilacDeep: '#8c6fe0',
  cream: '#fffaf0',
  ink: '#2b2433',
  plum: '#563b5c',
  screen: '#c6f7dc',
} as const;

/* ------------------------------------------------------------------ */
/* textures                                                            */
/* ------------------------------------------------------------------ */

/** Tamagotchi LCD: a big pixel face, readable through the dome. */
function pocketScreen() {
  return canvasTex(160, 130, (g) => {
    g.fillStyle = P.screen;
    g.fillRect(0, 0, 160, 130);
    const px = (x: number, y: number, w: number, h: number, c: string) => {
      g.fillStyle = c;
      g.fillRect(x, y, w, h);
    };
    const ink = '#204034';
    // ears + head
    px(32, 20, 96, 86, ink);
    px(22, 4, 30, 30, ink);
    px(108, 4, 30, 30, ink);
    px(40, 28, 80, 70, '#f8fff9');
    // big eyes
    px(52, 42, 22, 27, ink);
    px(86, 42, 22, 27, ink);
    // wide smile
    px(60, 78, 40, 10, ink);
    px(52, 72, 8, 8, ink);
    px(100, 72, 8, 8, ink);
    // blush
    px(40, 64, 10, 8, '#ff8fae');
    px(110, 64, 10, 8, '#ff8fae');
  });
}

/** Handheld screen: bold sunset landscape, no tiny HUD text. */
function handheldScreen() {
  return canvasTex(320, 220, (g) => {
    const sky = g.createLinearGradient(0, 0, 0, 220);
    sky.addColorStop(0, '#4fb3ff');
    sky.addColorStop(0.58, '#a9dcff');
    sky.addColorStop(1, '#ffd3e6');
    g.fillStyle = sky;
    g.fillRect(0, 0, 320, 220);

    // sun
    g.fillStyle = '#ffe15c';
    g.beginPath();
    g.arc(246, 62, 42, 0, Math.PI * 2);
    g.fill();

    // cloud
    g.fillStyle = 'rgba(255,255,255,0.94)';
    roundRect(g, 34, 58, 92, 24, 12);
    g.fill();
    roundRect(g, 54, 42, 52, 28, 14);
    g.fill();

    const mountain = (color: string, pts: number[][]) => {
      g.fillStyle = color;
      g.beginPath();
      g.moveTo(0, 220);
      pts.forEach(([x, y]) => g.lineTo(x, y));
      g.lineTo(320, 220);
      g.closePath();
      g.fill();
    };
    mountain('#7a5cff', [
      [0, 164],
      [66, 88],
      [126, 152],
      [192, 80],
      [260, 148],
      [320, 108],
    ]);
    mountain('#3f7ee8', [
      [0, 190],
      [86, 136],
      [152, 180],
      [232, 126],
      [320, 174],
    ]);
    mountain('#79d8b0', [
      [0, 208],
      [66, 180],
      [146, 204],
      [232, 178],
      [320, 202],
    ]);

    // big pink heart, the only HUD
    g.fillStyle = '#ff4f7d';
    const hx = 46;
    const hy = 178;
    g.beginPath();
    g.arc(hx - 10, hy, 11, 0, Math.PI * 2);
    g.arc(hx + 10, hy, 11, 0, Math.PI * 2);
    g.fill();
    g.beginPath();
    g.moveTo(hx - 20, hy + 2);
    g.lineTo(hx, hy + 26);
    g.lineTo(hx + 20, hy + 2);
    g.closePath();
    g.fill();
  });
}

/** Floppy label: strong header + fat bars, readable as a label at 40 px. */
function floppyLabel(accent: string) {
  return canvasTex(320, 300, (g) => {
    g.fillStyle = '#fffdf4';
    g.fillRect(0, 0, 320, 300);
    g.strokeStyle = '#ded4c0';
    g.lineWidth = 8;
    g.strokeRect(6, 6, 308, 288);

    g.fillStyle = accent;
    g.fillRect(12, 12, 296, 62);
    g.fillStyle = '#ffffff';
    g.font = '800 30px "Helvetica Neue", Arial, sans-serif';
    g.textAlign = 'left';
    g.textBaseline = 'middle';
    g.fillText('FLOPPY', 28, 44);
    g.font = '800 22px "Helvetica Neue", Arial, sans-serif';
    g.textAlign = 'right';
    g.fillText('HD', 294, 44);

    g.fillStyle = '#8d8574';
    for (let i = 0; i < 3; i++) g.fillRect(30, 100 + i * 26, 260, 8);

    g.fillStyle = '#4f493d';
    g.font = '800 26px "Helvetica Neue", Arial, sans-serif';
    g.textAlign = 'left';
    g.fillText('1.44 MB', 30, 200);

    g.fillStyle = accent;
    g.beginPath();
    g.arc(256, 208, 30, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#ffffff';
    g.font = '800 30px "Helvetica Neue", Arial, sans-serif';
    g.textAlign = 'center';
    g.fillText('D', 256, 212);

    // chunky print block, no sub-2 mm barcode
    g.fillStyle = accent;
    for (let i = 0; i < 5; i++) g.fillRect(30 + i * 28, 246, 16, 34);
    g.fillStyle = '#2a2620';
    for (let i = 0; i < 4; i++) g.fillRect(58 + i * 28, 246, 8, 34);
  });
}

/** Cartridge label: huge ZORA wordmark, white data band, no lens-like circle. */
function cartLabel() {
  return canvasTex(320, 300, (g) => {
    const grad = g.createLinearGradient(0, 0, 320, 300);
    grad.addColorStop(0, '#ff7a3d');
    grad.addColorStop(0.6, '#ff3d6e');
    grad.addColorStop(1, '#c81f56');
    g.fillStyle = grad;
    g.fillRect(0, 0, 320, 300);

    g.fillStyle = 'rgba(255,255,255,0.18)';
    g.fillRect(0, 0, 320, 12);

    g.fillStyle = '#fffdf4';
    g.font = '800 76px "Helvetica Neue", Arial, sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText('ZORA', 160, 68);

    g.fillStyle = 'rgba(255,255,255,0.72)';
    g.fillRect(30, 112, 260, 4);

    // white data band with the cartridge format
    g.fillStyle = '#fffdf4';
    roundRect(g, 30, 130, 260, 96, 12);
    g.fill();
    g.fillStyle = '#c81f56';
    g.font = '800 42px "Helvetica Neue", Arial, sans-serif';
    g.fillText('8-BIT', 160, 162);
    g.fillStyle = '#3a2330';
    g.font = '800 24px "Helvetica Neue", Arial, sans-serif';
    g.fillText('CARTRIDGE', 160, 202);

    // gold contact squares
    g.fillStyle = '#ffd166';
    for (let i = 0; i < 4; i++) g.fillRect(52 + i * 58, 252, 42, 16);
    g.fillStyle = '#fffdf4';
    g.font = '800 20px "Helvetica Neue", Arial, sans-serif';
    g.fillText('ZORA.CO', 160, 286);

    g.strokeStyle = 'rgba(255,255,255,0.55)';
    g.lineWidth = 5;
    g.strokeRect(10, 10, 300, 280);
  });
}

/** Gold edge connector, chunky contacts (3 mm pitch). */
function cartEdge() {
  return canvasTex(160, 40, (g) => {
    g.fillStyle = '#20362b';
    g.fillRect(0, 0, 160, 40);
    g.fillStyle = '#e0b95d';
    for (let i = 0; i < 10; i++) g.fillRect(6 + i * 15.4, 8, 8, 24);
  });
}

/** White sticker on the folder cover, with a big pink heart + HI. */
function folderSticker() {
  return canvasTex(256, 104, (g) => {
    g.fillStyle = '#fffdf7';
    roundRect(g, 2, 2, 252, 100, 18);
    g.fill();
    g.strokeStyle = P.pink;
    g.lineWidth = 5;
    roundRect(g, 7, 7, 242, 90, 14);
    g.stroke();

    g.fillStyle = P.pinkDeep;
    const hx = 56;
    const hy = 46;
    g.beginPath();
    g.arc(hx - 12, hy, 13, 0, Math.PI * 2);
    g.arc(hx + 12, hy, 13, 0, Math.PI * 2);
    g.fill();
    g.beginPath();
    g.moveTo(hx - 24, hy + 2);
    g.lineTo(hx, hy + 32);
    g.lineTo(hx + 24, hy + 2);
    g.closePath();
    g.fill();

    g.fillStyle = P.ink;
    g.font = '800 54px "Helvetica Neue", Arial, sans-serif';
    g.textAlign = 'left';
    g.textBaseline = 'middle';
    g.fillText('HI', 94, 50);
    g.fillStyle = P.azureDeep;
    g.font = '800 22px "Helvetica Neue", Arial, sans-serif';
    g.fillText('DAVIDE.FYI', 152, 54);
  });
}

/** Magic-ball face: white disc, big wink + smile. */
function ballFace() {
  return canvasTex(256, 256, (g) => {
    g.clearRect(0, 0, 256, 256);
    g.fillStyle = '#fffdf7';
    g.beginPath();
    g.arc(128, 128, 118, 0, Math.PI * 2);
    g.fill();

    g.strokeStyle = '#e5dcc8';
    g.lineWidth = 7;
    g.beginPath();
    g.arc(128, 128, 112, 0, Math.PI * 2);
    g.stroke();

    const ink = '#3a2c4a';
    g.fillStyle = ink;
    // two big eyes
    g.beginPath();
    g.arc(92, 112, 18, 0, Math.PI * 2);
    g.fill();
    g.beginPath();
    g.arc(164, 112, 18, 0, Math.PI * 2);
    g.fill();
    // big smile
    g.lineWidth = 16;
    g.lineCap = 'round';
    g.beginPath();
    g.arc(128, 138, 52, 0.14 * Math.PI, 0.86 * Math.PI);
    g.stroke();
  });
}

/* ------------------------------------------------------------------ */
/* shapes                                                              */
/* ------------------------------------------------------------------ */

/** Rounded folder outline with a tab on the top-left. */
function folderShape(w: number, h: number, tabW: number, tabH: number, r: number) {
  const tr = Math.min(0.006, tabH * 0.45, tabW * 0.3);
  const s = new THREE.Shape();
  s.moveTo(-w / 2 + r, -h / 2);
  s.lineTo(w / 2 - r, -h / 2);
  s.quadraticCurveTo(w / 2, -h / 2, w / 2, -h / 2 + r);
  s.lineTo(w / 2, h / 2 - r);
  s.quadraticCurveTo(w / 2, h / 2, w / 2 - r, h / 2);
  s.lineTo(-w / 2 + tabW, h / 2);
  s.lineTo(-w / 2 + tabW, h / 2 + tabH - tr);
  s.quadraticCurveTo(-w / 2 + tabW, h / 2 + tabH, -w / 2 + tabW - tr, h / 2 + tabH);
  s.lineTo(-w / 2 + tr, h / 2 + tabH);
  s.quadraticCurveTo(-w / 2, h / 2 + tabH, -w / 2, h / 2 + tabH - tr);
  s.lineTo(-w / 2, -h / 2 + r);
  s.quadraticCurveTo(-w / 2, -h / 2, -w / 2 + r, -h / 2);
  s.closePath();
  return s;
}

/** 3.5" floppy outline: clipped top-right corner. */
function floppyShape(w: number, clip: number) {
  const s = new THREE.Shape();
  s.moveTo(-w / 2, w / 2);
  s.lineTo(w / 2 - clip, w / 2);
  s.lineTo(w / 2, w / 2 - clip);
  s.lineTo(w / 2, -w / 2);
  s.lineTo(-w / 2, -w / 2);
  s.closePath();
  return s;
}

/** Cartridge outline with chamfered top corners. */
function cartridgeShape(w: number, h: number, chamfer: number) {
  const s = new THREE.Shape();
  s.moveTo(-w / 2, -h / 2);
  s.lineTo(w / 2, -h / 2);
  s.lineTo(w / 2, h / 2 - chamfer);
  s.lineTo(w / 2 - chamfer, h / 2);
  s.lineTo(-w / 2 + chamfer, h / 2);
  s.lineTo(-w / 2, h / 2 - chamfer);
  s.closePath();
  return s;
}

function extrude(shape: THREE.Shape, depth: number, bevel = 0.0012) {
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: true,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelSegments: 2,
    curveSegments: 10,
  });
  geo.center();
  return geo;
}

/** Curved decal patch on a sphere, centred on +Z. */
function spherePatch(r: number, span = 0.9) {
  return new THREE.SphereGeometry(
    r,
    28,
    20,
    Math.PI / 2 - span / 2,
    span,
    Math.PI / 2 - span / 2,
    span
  );
}

/* ------------------------------------------------------------------ */
/* public: max top offset per toy (metres, above the toy origin)       */
/* ------------------------------------------------------------------ */

/**
 * Max Y extent of each toy above its own origin. Capsule placement can use
 * this to guarantee the prize stays inside the shell: all values are <= 0.06.
 * Kept in sync with the geometry below (verified with Box3).
 */
export const TOY_TOP: Record<Toy, number> = {
  pocketpet: 0.059,
  handheld: 0.056,
  floppy: 0.048,
  charm: 0.056,
  cartridge: 0.049,
  ball: 0.041,
};

/* ------------------------------------------------------------------ */
/* toys                                                                */
/* ------------------------------------------------------------------ */

/** Prize miniature, sized to fit through the capsule mouth (6–8 cm). */
export function makeToy(kind: Toy, color: string): THREE.Group {
  const g = new THREE.Group();
  const gloss = (c: string, opts: Partial<THREE.MeshPhysicalMaterialParameters> = {}) =>
    plastic(c, {
      roughness: 0.14,
      clearcoat: 1,
      clearcoatRoughness: 0.035,
      envMapIntensity: 1.4,
      ior: 1.46,
      ...opts,
    });

  if (kind === 'pocketpet') {
    // pink egg, big white faceplate, mint LCD with a bold pixel smile
    const R = 0.036;
    const H = 0.1;
    const pts: THREE.Vector2[] = [];
    for (let i = 0; i <= 26; i++) {
      const t = i / 26;
      const r = R * Math.pow(Math.sin(Math.PI * t), 0.58) * (1 - 0.1 * t);
      pts.push(new THREE.Vector2(Math.max(r, 0.0005), (t - 0.5) * H));
    }
    const body = new THREE.Mesh(new THREE.LatheGeometry(pts, 40), gloss(P.pink));
    body.scale.z = 0.72; // flattened front, so the faceplate can sit flush
    body.castShadow = true;
    g.add(body);

    const facePlate = new THREE.Mesh(
      new RoundedBoxGeometry(0.044, 0.042, 0.008, 3, 0.014),
      gloss(P.cream, { roughness: 0.18 })
    );
    facePlate.position.set(0, 0.009, 0.023);
    g.add(facePlate);

    const bezel = new THREE.Mesh(
      new RoundedBoxGeometry(0.038, 0.032, 0.005, 3, 0.009),
      gloss(P.plum, { roughness: 0.2 })
    );
    bezel.position.set(0, 0.009, 0.027);
    g.add(bezel);

    const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.032, 0.026), screenMat(pocketScreen(), 1.35));
    screen.position.set(0, 0.009, 0.0302);
    g.add(screen);

    const buttonColors = [P.pinkDeep, P.mint, P.yellow];
    for (let i = 0; i < 3; i++) {
      const b = new THREE.Mesh(new THREE.SphereGeometry(0.0052, 12, 10), gloss(buttonColors[i], { roughness: 0.16 }));
      b.scale.set(1, 1, 0.55);
      b.position.set(-0.014 + i * 0.014, -0.027, 0.0215);
      g.add(b);
    }

    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.0026, 0.0026, 0.008, 10), chrome());
    neck.position.set(0, 0.0515, 0);
    g.add(neck);
    const loop = new THREE.Mesh(new THREE.TorusGeometry(0.006, 0.0017, 8, 18), chrome());
    loop.position.set(0, 0.0505, 0);
    g.add(loop);
  } else if (kind === 'handheld') {
    // chunky pastel handheld: large sunny screen, fat D-pad and A/B buttons
    const body = new THREE.Mesh(
      new RoundedBoxGeometry(0.072, 0.104, 0.018, 4, 0.013),
      gloss(P.azure)
    );
    body.castShadow = true;
    g.add(body);

    const bezel = new THREE.Mesh(
      new RoundedBoxGeometry(0.058, 0.046, 0.006, 3, 0.006),
      gloss('#28324a', { roughness: 0.2 })
    );
    bezel.position.set(0, 0.02, 0.0098);
    g.add(bezel);

    const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.05, 0.038), screenMat(handheldScreen(), 1.18));
    screen.position.set(0, 0.02, 0.0132);
    g.add(screen);

    const led = new THREE.Mesh(new THREE.SphereGeometry(0.0024, 8, 6), glow('#55ff9a', 2.6));
    led.position.set(-0.027, 0.045, 0.0094);
    g.add(led);

    const dpadMat = gloss(P.plum, { roughness: 0.22 });
    const dh = new THREE.Mesh(new RoundedBoxGeometry(0.026, 0.009, 0.005, 2, 0.003), dpadMat);
    dh.position.set(-0.021, -0.032, 0.0102);
    g.add(dh);
    const dv = new THREE.Mesh(new RoundedBoxGeometry(0.009, 0.026, 0.005, 2, 0.003), dpadMat);
    dv.position.set(-0.021, -0.032, 0.0102);
    g.add(dv);

    const ba = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.005, 18), gloss(P.pinkDeep));
    ba.rotation.x = Math.PI / 2;
    ba.position.set(0.013, -0.026, 0.012);
    g.add(ba);
    const bb = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.005, 18), gloss(P.yellow));
    bb.rotation.x = Math.PI / 2;
    bb.position.set(0.031, -0.037, 0.012);
    g.add(bb);

    for (let i = 0; i < 2; i++) {
      const s = new THREE.Mesh(new RoundedBoxGeometry(0.014, 0.0055, 0.004, 2, 0.002), dpadMat);
      s.position.set(-0.007 + i * 0.017, -0.0455, 0.0102);
      g.add(s);
    }

    for (let i = 0; i < 2; i++) {
      const sh = new THREE.Mesh(
        new RoundedBoxGeometry(0.018, 0.006, 0.012, 2, 0.0025),
        gloss('#6db4f2', { roughness: 0.18 })
      );
      sh.position.set(-0.023 + i * 0.046, 0.053, -0.001);
      g.add(sh);
    }
  } else if (kind === 'floppy') {
    // azure 3.5" floppy: clipped corner, chrome shutter, fat printed label
    const w = 0.088;
    const backing = new THREE.Mesh(
      extrude(floppyShape(w + 0.006, 0.014), 0.003, 0.0006),
      gloss('#23619e', { roughness: 0.28 })
    );
    backing.position.z = -0.0032;
    g.add(backing);

    const body = new THREE.Mesh(
      extrude(floppyShape(w, 0.014), 0.007, 0.001),
      gloss('#3f9bf0', { roughness: 0.15 })
    );
    body.castShadow = true;
    g.add(body);

    const label = new THREE.Mesh(new THREE.PlaneGeometry(0.066, 0.052), printMat(floppyLabel(P.azureDeep)));
    label.position.set(-0.002, -0.01, 0.0046);
    g.add(label);

    const shutter = new THREE.Mesh(new RoundedBoxGeometry(0.03, 0.022, 0.002, 2, 0.0014), chrome());
    shutter.position.set(0.015, 0.03, 0.0044);
    g.add(shutter);

    const slot = new THREE.Mesh(new THREE.PlaneGeometry(0.014, 0.005), gloss(P.plum, { roughness: 0.3 }));
    slot.position.set(0.018, 0.033, 0.0055);
    g.add(slot);

    // write-protect notch, cut into the top-left edge
    const notch = new THREE.Mesh(new RoundedBoxGeometry(0.008, 0.008, 0.004, 2, 0.001), gloss(P.plum, { roughness: 0.3 }));
    notch.position.set(-0.038, 0.036, 0.002);
    g.add(notch);
  } else if (kind === 'charm') {
    // pink folder, white sheets clearly peeking out under a rounded tab
    const back = new THREE.Mesh(
      extrude(folderShape(0.074, 0.084, 0.03, 0.018, 0.006), 0.0044, 0.0008),
      gloss(P.pink)
    );
    back.castShadow = true;
    g.add(back);

    // two loose sheets, the top one offset and slightly rotated
    const sheet = new THREE.Mesh(
      new RoundedBoxGeometry(0.048, 0.07, 0.0018, 2, 0.003),
      gloss(P.cream, { roughness: 0.5 })
    );
    sheet.position.set(0.012, 0.011, 0.0046);
    g.add(sheet);

    const sheet2 = new THREE.Mesh(
      new RoundedBoxGeometry(0.046, 0.064, 0.0016, 2, 0.003),
      gloss(P.cream, { roughness: 0.55 })
    );
    sheet2.position.set(0.004, 0.009, 0.0039);
    sheet2.rotation.z = -0.03;
    g.add(sheet2);

    // two bold printed lines on the visible strip of paper
    for (let i = 0; i < 2; i++) {
      const line = new THREE.Mesh(
        new THREE.PlaneGeometry(0.032 - i * 0.008, 0.004),
        gloss('#cfc3ad', { roughness: 0.6 })
      );
      line.position.set(0.014, 0.039 - i * 0.008, 0.0057);
      g.add(line);
    }

    // folded spine along the left edge
    const spine = new THREE.Mesh(
      new RoundedBoxGeometry(0.005, 0.082, 0.004, 2, 0.0018),
      gloss(P.pinkDeep, { roughness: 0.3 })
    );
    spine.position.set(-0.0355, -0.008, 0.0044);
    g.add(spine);

    // little white index label on the tab
    const tabLabel = new THREE.Mesh(
      new RoundedBoxGeometry(0.018, 0.0075, 0.0012, 2, 0.0015),
      gloss(P.cream, { roughness: 0.5 })
    );
    tabLabel.position.set(-0.022, 0.044, 0.0029);
    g.add(tabLabel);
    const tabInk = new THREE.Mesh(new THREE.PlaneGeometry(0.012, 0.0022), gloss(P.pinkDeep, { roughness: 0.5 }));
    tabInk.position.set(-0.022, 0.044, 0.0036);
    g.add(tabInk);

    const cover = new THREE.Mesh(
      new RoundedBoxGeometry(0.066, 0.062, 0.0046, 3, 0.005),
      gloss(P.pinkDeep)
    );
    cover.position.set(0, -0.018, 0.006);
    g.add(cover);

    const sticker = new THREE.Mesh(new THREE.PlaneGeometry(0.042, 0.017), printMat(folderSticker()));
    sticker.position.set(-0.004, -0.02, 0.0084);
    g.add(sticker);

    const eyelet = new THREE.Mesh(new THREE.TorusGeometry(0.0044, 0.0013, 6, 16), chrome());
    eyelet.position.set(-0.021, 0.048, 0);
    g.add(eyelet);
  } else if (kind === 'cartridge') {
    // yellow ZORA cartridge, magenta label, gold edge
    const backing = new THREE.Mesh(
      extrude(cartridgeShape(0.084, 0.096, 0.012), 0.003, 0.0006),
      gloss('#c98112', { roughness: 0.28 })
    );
    backing.position.z = -0.0065;
    g.add(backing);

    const body = new THREE.Mesh(
      extrude(cartridgeShape(0.078, 0.09, 0.011), 0.014, 0.0014),
      gloss(P.yellow, { roughness: 0.15 })
    );
    body.castShadow = true;
    g.add(body);

    for (let i = 0; i < 3; i++) {
      const grip = new THREE.Mesh(
        new RoundedBoxGeometry(0.036, 0.004, 0.002, 2, 0.0015),
        gloss(P.yellowDeep, { roughness: 0.22 })
      );
      grip.position.set(0, 0.036 - i * 0.0064, 0.0092);
      g.add(grip);
    }

    const label = new THREE.Mesh(new THREE.PlaneGeometry(0.062, 0.058), printMat(cartLabel()));
    label.position.set(0, 0.002, 0.0098);
    g.add(label);

    const edge = new THREE.Mesh(new THREE.PlaneGeometry(0.058, 0.011), printMat(cartEdge()));
    edge.position.set(0, -0.0385, 0.0092);
    g.add(edge);

    const notch = new THREE.Mesh(new RoundedBoxGeometry(0.01, 0.007, 0.002, 2, 0.001), gloss(P.yellowDeep, { roughness: 0.3 }));
    notch.position.set(0.028, 0.04, 0.0092);
    g.add(notch);
  } else {
    // Oracle: glossy lilac magic ball with a big smiley face
    const r = 0.0405;
    const ball = new THREE.Mesh(
      new THREE.SphereGeometry(r, 40, 28),
      gloss('#a487ff', { roughness: 0.17, clearcoatRoughness: 0.05, envMapIntensity: 1.2 })
    );
    ball.castShadow = true;
    g.add(ball);

    const face = new THREE.Mesh(
      spherePatch(r * 1.004, 1.15),
      new THREE.MeshStandardMaterial({
        map: ballFace(),
        transparent: true,
        roughness: 0.28,
        metalness: 0,
        depthWrite: false,
      })
    );
    g.add(face);
  }

  // project tint stays available for future palette variants
  g.userData.tint = color;
  return g;
}
