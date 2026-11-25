import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import type { Toy } from '../game/roster';
import { chrome, glow, plastic } from './materials';

/**
 * Capsule prizes. Everything is designed to stay legible at 7 cm: one bold
 * silhouette, saturated kawaii pastel colours, and a single big graphic.
 */

function canvasTex(w: number, h: number, draw: (g: CanvasRenderingContext2D) => void) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d')!);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

function screenMat(map: THREE.Texture, intensity = 0.45) {
  return new THREE.MeshStandardMaterial({
    map,
    emissive: new THREE.Color('#ffffff'),
    emissiveMap: map,
    emissiveIntensity: intensity,
    roughness: 0.16,
    metalness: 0,
  });
}

function printMat(map: THREE.Texture) {
  return new THREE.MeshStandardMaterial({ map, roughness: 0.48, metalness: 0 });
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
  pink: '#ff96c5',
  pinkDeep: '#ef4d91',
  pinkPale: '#ffd6e7',
  azure: '#52b8ff',
  azureDeep: '#2e7dd4',
  mint: '#88ebc7',
  yellow: '#ffd23f',
  yellowDeep: '#ebaa2b',
  lilac: '#bfa8ff',
  cream: '#fffdf7',
  ink: '#282233',
  plum: '#4c3857',
  screen: '#c2f7dc',
} as const;

/* ------------------------------------------------------------------ */
/* textures                                                            */
/* ------------------------------------------------------------------ */

function pocketScreen() {
  return canvasTex(128, 104, (g) => {
    g.fillStyle = P.screen;
    g.fillRect(0, 0, 128, 104);
    const px = (x: number, y: number, w: number, h: number, c: string) => {
      g.fillStyle = c;
      g.fillRect(x, y, w, h);
    };
    const ink = '#1e3e33';
    px(26, 16, 76, 68, ink);
    px(18, 4, 24, 24, ink);
    px(86, 4, 24, 24, ink);
    px(32, 22, 64, 56, '#f6fff8');
    px(42, 34, 17, 22, ink);
    px(69, 34, 17, 22, ink);
    px(48, 62, 32, 8, ink);
    px(42, 57, 6, 6, ink);
    px(80, 57, 6, 6, ink);
    px(32, 51, 8, 6, '#ff85ad');
    px(88, 51, 8, 6, '#ff85ad');
  });
}

function handheldScreen() {
  return canvasTex(256, 176, (g) => {
    const sky = g.createLinearGradient(0, 0, 0, 176);
    sky.addColorStop(0, '#4fb3ff');
    sky.addColorStop(0.58, '#a9dcff');
    sky.addColorStop(1, '#ffd3e6');
    g.fillStyle = sky;
    g.fillRect(0, 0, 256, 176);

    g.fillStyle = '#ffe15c';
    g.beginPath();
    g.arc(196, 50, 32, 0, Math.PI * 2);
    g.fill();

    g.fillStyle = 'rgba(255,255,255,0.95)';
    roundRect(g, 26, 46, 74, 20, 10);
    g.fill();
    roundRect(g, 42, 34, 42, 22, 11);
    g.fill();

    const mountain = (color: string, pts: number[][]) => {
      g.fillStyle = color;
      g.beginPath();
      g.moveTo(0, 176);
      pts.forEach(([x, y]) => g.lineTo(x, y));
      g.lineTo(256, 176);
      g.closePath();
      g.fill();
    };
    mountain('#7a5cff', [
      [0, 132],
      [54, 70],
      [102, 122],
      [154, 64],
      [208, 118],
      [256, 86],
    ]);
    mountain('#3f7ee8', [
      [0, 152],
      [70, 108],
      [122, 144],
      [186, 100],
      [256, 140],
    ]);
    mountain('#79d8b0', [
      [0, 166],
      [54, 144],
      [118, 164],
      [186, 142],
      [256, 162],
    ]);

    g.fillStyle = '#ff4f7d';
    const hx = 38;
    const hy = 142;
    g.beginPath();
    g.arc(hx - 8, hy, 9, 0, Math.PI * 2);
    g.arc(hx + 8, hy, 9, 0, Math.PI * 2);
    g.fill();
    g.beginPath();
    g.moveTo(hx - 16, hy + 2);
    g.lineTo(hx, hy + 20);
    g.lineTo(hx + 16, hy + 2);
    g.closePath();
    g.fill();
  });
}

function floppyLabel(accent: string) {
  return canvasTex(256, 240, (g) => {
    g.fillStyle = '#fffef8';
    g.fillRect(0, 0, 256, 240);
    g.strokeStyle = '#d8e0ea';
    g.lineWidth = 6;
    g.strokeRect(5, 5, 246, 230);

    g.fillStyle = accent;
    g.fillRect(10, 10, 236, 52);
    g.fillStyle = '#ffffff';
    g.font = '800 26px "Helvetica Neue", Arial, sans-serif';
    g.textAlign = 'left';
    g.textBaseline = 'middle';
    g.fillText('FLOPPY', 22, 36);
    g.font = '800 18px "Helvetica Neue", Arial, sans-serif';
    g.textAlign = 'right';
    g.fillText('HD', 234, 36);

    g.fillStyle = '#8d96a6';
    for (let i = 0; i < 3; i++) g.fillRect(24, 82 + i * 21, 208, 6);

    g.fillStyle = '#333b4d';
    g.font = '800 22px "Helvetica Neue", Arial, sans-serif';
    g.textAlign = 'left';
    g.fillText('1.44 MB', 24, 162);

    g.fillStyle = accent;
    g.beginPath();
    g.arc(206, 168, 24, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#ffffff';
    g.font = '800 24px "Helvetica Neue", Arial, sans-serif';
    g.textAlign = 'center';
    g.fillText('D', 206, 171);

    g.fillStyle = accent;
    for (let i = 0; i < 5; i++) g.fillRect(24 + i * 22, 196, 12, 26);
    g.fillStyle = '#2a2620';
    for (let i = 0; i < 4; i++) g.fillRect(46 + i * 22, 196, 6, 26);
  });
}

function cartLabel() {
  return canvasTex(256, 240, (g) => {
    const grad = g.createLinearGradient(0, 0, 256, 240);
    grad.addColorStop(0, '#ff7a3d');
    grad.addColorStop(0.6, '#ff3d6e');
    grad.addColorStop(1, '#c81f56');
    g.fillStyle = grad;
    g.fillRect(0, 0, 256, 240);

    g.fillStyle = '#fffdf4';
    g.font = '800 60px "Helvetica Neue", Arial, sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText('ZORA', 128, 54);

    g.fillStyle = 'rgba(255,255,255,0.75)';
    g.fillRect(24, 90, 208, 3);

    g.fillStyle = '#fffdf4';
    roundRect(g, 24, 104, 208, 76, 10);
    g.fill();
    g.fillStyle = '#c81f56';
    g.font = '800 34px "Helvetica Neue", Arial, sans-serif';
    g.fillText('8-BIT', 128, 130);
    g.fillStyle = '#3a2330';
    g.font = '800 20px "Helvetica Neue", Arial, sans-serif';
    g.fillText('CARTRIDGE', 128, 162);

    g.fillStyle = '#ffd166';
    for (let i = 0; i < 4; i++) g.fillRect(42 + i * 46, 202, 34, 12);
    g.fillStyle = '#fffdf4';
    g.font = '800 16px "Helvetica Neue", Arial, sans-serif';
    g.fillText('ZORA.CO', 128, 228);

    g.strokeStyle = 'rgba(255,255,255,0.6)';
    g.lineWidth = 4;
    g.strokeRect(8, 8, 240, 224);
  });
}

function cartEdge() {
  return canvasTex(128, 32, (g) => {
    g.fillStyle = '#20362b';
    g.fillRect(0, 0, 128, 32);
    g.fillStyle = '#e0b95d';
    for (let i = 0; i < 10; i++) g.fillRect(5 + i * 12.2, 6, 6, 20);
  });
}

function folderSticker() {
  return canvasTex(224, 92, (g) => {
    g.fillStyle = '#fffdf7';
    roundRect(g, 2, 2, 220, 88, 16);
    g.fill();
    g.strokeStyle = P.pink;
    g.lineWidth = 4;
    roundRect(g, 6, 6, 212, 80, 12);
    g.stroke();

    g.fillStyle = P.pinkDeep;
    const hx = 48;
    const hy = 40;
    g.beginPath();
    g.arc(hx - 10, hy, 11, 0, Math.PI * 2);
    g.arc(hx + 10, hy, 11, 0, Math.PI * 2);
    g.fill();
    g.beginPath();
    g.moveTo(hx - 20, hy + 2);
    g.lineTo(hx, hy + 28);
    g.lineTo(hx + 20, hy + 2);
    g.closePath();
    g.fill();

    g.fillStyle = P.ink;
    g.font = '800 46px "Helvetica Neue", Arial, sans-serif';
    g.textAlign = 'left';
    g.textBaseline = 'middle';
    g.fillText('HI', 82, 44);
    g.fillStyle = P.azureDeep;
    g.font = '800 18px "Helvetica Neue", Arial, sans-serif';
    g.fillText('DAVIDE.FYI', 132, 47);
  });
}

function ballFace() {
  return canvasTex(192, 192, (g) => {
    g.clearRect(0, 0, 192, 192);
    g.fillStyle = '#fffdf7';
    g.beginPath();
    g.arc(96, 96, 88, 0, Math.PI * 2);
    g.fill();

    g.strokeStyle = '#e5dcc8';
    g.lineWidth = 5;
    g.beginPath();
    g.arc(96, 96, 84, 0, Math.PI * 2);
    g.stroke();

    const ink = '#3a2c4a';
    g.fillStyle = ink;
    g.beginPath();
    g.arc(69, 84, 14, 0, Math.PI * 2);
    g.fill();
    g.beginPath();
    g.arc(123, 84, 14, 0, Math.PI * 2);
    g.fill();
    g.lineWidth = 12;
    g.lineCap = 'round';
    g.beginPath();
    g.arc(96, 104, 39, 0.14 * Math.PI, 0.86 * Math.PI);
    g.stroke();
  });
}

/* ------------------------------------------------------------------ */
/* shapes                                                              */
/* ------------------------------------------------------------------ */

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
    bevelSegments: 1,
    curveSegments: 6,
  });
  geo.center();
  return geo;
}

function spherePatch(r: number, span = 0.9) {
  return new THREE.SphereGeometry(
    r,
    18,
    14,
    Math.PI / 2 - span / 2,
    span,
    Math.PI / 2 - span / 2,
    span
  );
}

/* ------------------------------------------------------------------ */
/* public: max top offset per toy (metres, above the toy origin)       */
/* ------------------------------------------------------------------ */

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

export function makeToy(kind: Toy, color: string): THREE.Group {
  const g = new THREE.Group();
  const gloss = (c: string, opts: Partial<THREE.MeshStandardMaterialParameters> = {}) =>
    plastic(c, {
      roughness: 0.18,
      metalness: 0.02,
      envMapIntensity: 1.15,
      ...opts,
    });

  if (kind === 'pocketpet') {
    const R = 0.036;
    const H = 0.1;
    const pts: THREE.Vector2[] = [];
    for (let i = 0; i <= 18; i++) {
      const t = i / 18;
      const r = R * Math.pow(Math.sin(Math.PI * t), 0.58) * (1 - 0.1 * t);
      pts.push(new THREE.Vector2(Math.max(r, 0.0005), (t - 0.5) * H));
    }
    const body = new THREE.Mesh(new THREE.LatheGeometry(pts, 24), gloss(P.pink));
    body.scale.z = 0.72;
    g.add(body);

    const facePlate = new THREE.Mesh(
      new RoundedBoxGeometry(0.044, 0.042, 0.008, 2, 0.014),
      gloss(P.cream, { roughness: 0.2 })
    );
    facePlate.position.set(0, 0.009, 0.023);
    g.add(facePlate);

    const bezel = new THREE.Mesh(
      new RoundedBoxGeometry(0.038, 0.032, 0.005, 2, 0.009),
      gloss(P.plum, { roughness: 0.22 })
    );
    bezel.position.set(0, 0.009, 0.027);
    g.add(bezel);

    const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.032, 0.026), screenMat(pocketScreen(), 0.5));
    screen.position.set(0, 0.009, 0.0302);
    g.add(screen);

    const buttonColors = [P.pinkDeep, P.mint, P.yellow];
    const btnGeo = new THREE.SphereGeometry(0.0052, 10, 8);
    for (let i = 0; i < 3; i++) {
      const b = new THREE.Mesh(btnGeo, gloss(buttonColors[i], { roughness: 0.18 }));
      b.scale.set(1, 1, 0.55);
      b.position.set(-0.014 + i * 0.014, -0.027, 0.0215);
      g.add(b);
    }

    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.0026, 0.0026, 0.008, 8), chrome());
    neck.position.set(0, 0.0515, 0);
    g.add(neck);
    const loop = new THREE.Mesh(new THREE.TorusGeometry(0.006, 0.0017, 6, 12), chrome());
    loop.position.set(0, 0.0505, 0);
    g.add(loop);
  } else if (kind === 'handheld') {
    const body = new THREE.Mesh(
      new RoundedBoxGeometry(0.072, 0.104, 0.018, 2, 0.013),
      gloss(P.azure)
    );
    g.add(body);

    const bezel = new THREE.Mesh(
      new RoundedBoxGeometry(0.058, 0.046, 0.006, 2, 0.006),
      gloss('#28324a', { roughness: 0.22 })
    );
    bezel.position.set(0, 0.02, 0.0098);
    g.add(bezel);

    const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.05, 0.038), screenMat(handheldScreen(), 0.45));
    screen.position.set(0, 0.02, 0.0132);
    g.add(screen);

    const led = new THREE.Mesh(new THREE.SphereGeometry(0.0024, 6, 5), glow('#55ff9a', 1.6));
    led.position.set(-0.027, 0.045, 0.0094);
    g.add(led);

    const dpadMat = gloss(P.plum, { roughness: 0.24 });
    const dh = new THREE.Mesh(new RoundedBoxGeometry(0.026, 0.009, 0.005, 2, 0.003), dpadMat);
    dh.position.set(-0.021, -0.032, 0.0102);
    g.add(dh);
    const dv = new THREE.Mesh(new RoundedBoxGeometry(0.009, 0.026, 0.005, 2, 0.003), dpadMat);
    dv.position.set(-0.021, -0.032, 0.0102);
    g.add(dv);

    const btnGeo = new THREE.CylinderGeometry(0.008, 0.008, 0.005, 12);
    const ba = new THREE.Mesh(btnGeo, gloss(P.pinkDeep));
    ba.rotation.x = Math.PI / 2;
    ba.position.set(0.013, -0.026, 0.012);
    g.add(ba);
    const bb = new THREE.Mesh(btnGeo, gloss(P.yellow));
    bb.rotation.x = Math.PI / 2;
    bb.position.set(0.031, -0.037, 0.012);
    g.add(bb);

    const startGeo = new RoundedBoxGeometry(0.014, 0.0055, 0.004, 1, 0.002);
    for (let i = 0; i < 2; i++) {
      const s = new THREE.Mesh(startGeo, dpadMat);
      s.position.set(-0.007 + i * 0.017, -0.0455, 0.0102);
      g.add(s);
    }

    const shGeo = new RoundedBoxGeometry(0.018, 0.006, 0.012, 1, 0.0025);
    const shMat = gloss('#6db4f2', { roughness: 0.2 });
    for (let i = 0; i < 2; i++) {
      const sh = new THREE.Mesh(shGeo, shMat);
      sh.position.set(-0.023 + i * 0.046, 0.053, -0.001);
      g.add(sh);
    }
  } else if (kind === 'floppy') {
    const w = 0.088;
    const backing = new THREE.Mesh(
      extrude(floppyShape(w + 0.006, 0.014), 0.003, 0.0006),
      gloss('#23619e', { roughness: 0.28 })
    );
    backing.position.z = -0.0032;
    g.add(backing);

    const body = new THREE.Mesh(
      extrude(floppyShape(w, 0.014), 0.007, 0.001),
      gloss('#3f9bf0', { roughness: 0.18 })
    );
    g.add(body);

    const label = new THREE.Mesh(new THREE.PlaneGeometry(0.066, 0.052), printMat(floppyLabel(P.azureDeep)));
    label.position.set(-0.002, -0.01, 0.0046);
    g.add(label);

    const shutter = new THREE.Mesh(new RoundedBoxGeometry(0.03, 0.022, 0.002, 1, 0.0014), chrome());
    shutter.position.set(0.015, 0.03, 0.0044);
    g.add(shutter);

    const slot = new THREE.Mesh(new THREE.PlaneGeometry(0.014, 0.005), gloss(P.plum, { roughness: 0.3 }));
    slot.position.set(0.018, 0.033, 0.0055);
    g.add(slot);

    const notch = new THREE.Mesh(
      new RoundedBoxGeometry(0.008, 0.008, 0.004, 1, 0.001),
      gloss(P.plum, { roughness: 0.3 })
    );
    notch.position.set(-0.038, 0.036, 0.002);
    g.add(notch);
  } else if (kind === 'charm') {
    const back = new THREE.Mesh(
      extrude(folderShape(0.074, 0.084, 0.03, 0.018, 0.006), 0.0044, 0.0008),
      gloss(P.pink)
    );
    g.add(back);

    const sheet = new THREE.Mesh(
      new RoundedBoxGeometry(0.048, 0.07, 0.0018, 1, 0.003),
      gloss(P.cream, { roughness: 0.5 })
    );
    sheet.position.set(0.012, 0.011, 0.0046);
    g.add(sheet);

    const sheet2 = new THREE.Mesh(
      new RoundedBoxGeometry(0.046, 0.064, 0.0016, 1, 0.003),
      gloss(P.cream, { roughness: 0.55 })
    );
    sheet2.position.set(0.004, 0.009, 0.0039);
    sheet2.rotation.z = -0.03;
    g.add(sheet2);

    const lineMat = gloss('#cfc3ad', { roughness: 0.6 });
    for (let i = 0; i < 2; i++) {
      const line = new THREE.Mesh(new THREE.PlaneGeometry(0.032 - i * 0.008, 0.004), lineMat);
      line.position.set(0.014, 0.039 - i * 0.008, 0.0057);
      g.add(line);
    }

    const spine = new THREE.Mesh(
      new RoundedBoxGeometry(0.005, 0.082, 0.004, 1, 0.0018),
      gloss(P.pinkDeep, { roughness: 0.3 })
    );
    spine.position.set(-0.0355, -0.008, 0.0044);
    g.add(spine);

    const tabLabel = new THREE.Mesh(
      new RoundedBoxGeometry(0.018, 0.0075, 0.0012, 1, 0.0015),
      gloss(P.cream, { roughness: 0.5 })
    );
    tabLabel.position.set(-0.022, 0.044, 0.0029);
    g.add(tabLabel);
    const tabInk = new THREE.Mesh(
      new THREE.PlaneGeometry(0.012, 0.0022),
      gloss(P.pinkDeep, { roughness: 0.5 })
    );
    tabInk.position.set(-0.022, 0.044, 0.0036);
    g.add(tabInk);

    const cover = new THREE.Mesh(
      new RoundedBoxGeometry(0.066, 0.062, 0.0046, 2, 0.005),
      gloss(P.pinkDeep)
    );
    cover.position.set(0, -0.018, 0.006);
    g.add(cover);

    const sticker = new THREE.Mesh(new THREE.PlaneGeometry(0.042, 0.017), printMat(folderSticker()));
    sticker.position.set(-0.004, -0.02, 0.0084);
    g.add(sticker);

    const eyelet = new THREE.Mesh(new THREE.TorusGeometry(0.0044, 0.0013, 5, 10), chrome());
    eyelet.position.set(-0.021, 0.048, 0);
    g.add(eyelet);
  } else if (kind === 'cartridge') {
    const backing = new THREE.Mesh(
      extrude(cartridgeShape(0.084, 0.096, 0.012), 0.003, 0.0006),
      gloss('#c98112', { roughness: 0.28 })
    );
    backing.position.z = -0.0065;
    g.add(backing);

    const body = new THREE.Mesh(
      extrude(cartridgeShape(0.078, 0.09, 0.011), 0.014, 0.0014),
      gloss(P.yellow, { roughness: 0.18 })
    );
    g.add(body);

    const gripGeo = new RoundedBoxGeometry(0.036, 0.004, 0.002, 1, 0.0015);
    const gripMat = gloss(P.yellowDeep, { roughness: 0.24 });
    for (let i = 0; i < 3; i++) {
      const grip = new THREE.Mesh(gripGeo, gripMat);
      grip.position.set(0, 0.036 - i * 0.0064, 0.0092);
      g.add(grip);
    }

    const label = new THREE.Mesh(new THREE.PlaneGeometry(0.062, 0.058), printMat(cartLabel()));
    label.position.set(0, 0.002, 0.0098);
    g.add(label);

    const edge = new THREE.Mesh(new THREE.PlaneGeometry(0.058, 0.011), printMat(cartEdge()));
    edge.position.set(0, -0.0385, 0.0092);
    g.add(edge);

    const notch = new THREE.Mesh(
      new RoundedBoxGeometry(0.01, 0.007, 0.002, 1, 0.001),
      gloss(P.yellowDeep, { roughness: 0.3 })
    );
    notch.position.set(0.028, 0.04, 0.0092);
    g.add(notch);
  } else {
    const r = 0.0405;
    const ball = new THREE.Mesh(
      new THREE.SphereGeometry(r, 22, 16),
      gloss('#a487ff', { roughness: 0.2, envMapIntensity: 1.05 })
    );
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

  g.userData.tint = color;
  return g;
}
