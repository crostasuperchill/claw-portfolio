import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import type { Toy } from '../game/roster';
import { chrome, glow, plastic } from './materials';

/**
 * Hero prizes sitting prominently on top of the gashapon capsule sea.
 * Every printed face/label sits with clear Z separation + polygonOffset so
 * there is zero z-fighting at any angle or distance.
 */

function canvasTex(w: number, h: number, draw: (g: CanvasRenderingContext2D) => void) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d')!);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 16;
  return t;
}

function screenMat(map: THREE.Texture, intensity = 0.32) {
  return new THREE.MeshStandardMaterial({
    map,
    emissive: new THREE.Color('#ffffff'),
    emissiveMap: map,
    emissiveIntensity: intensity,
    roughness: 0.14,
    metalness: 0,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
  });
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
/* vibrant palette                                                     */
/* ------------------------------------------------------------------ */

const P = {
  pink: '#ff82c0',
  pinkDeep: '#ee3288',
  pinkPale: '#ffd2e7',
  azure: '#1fa4ff',
  azureDeep: '#1265cc',
  mint: '#5ee8b6',
  yellow: '#ffd228',
  yellowDeep: '#eb9e14',
  lilac: '#b492ff',
  cream: '#fffdf7',
  ink: '#221c2c',
  plum: '#443050',
  screen: '#b8f2d0',
} as const;

/* ------------------------------------------------------------------ */
/* textures                                                            */
/* ------------------------------------------------------------------ */

function pocketScreen() {
  return canvasTex(256, 208, (g) => {
    g.scale(2, 2);
    const W = 128;
    const H = 104;
    const px = (x: number, y: number, w: number, h: number, c: string) => {
      g.fillStyle = c;
      g.fillRect(x, y, w, h);
    };

    const bg = g.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, '#d8eca8');
    bg.addColorStop(1, '#b6d288');
    g.fillStyle = bg;
    g.fillRect(0, 0, W, H);

    g.fillStyle = '#334834';
    roundRect(g, 7, 7, W - 14, H - 14, 11);
    g.fill();
    g.fillStyle = '#cbe29b';
    roundRect(g, 12, 12, W - 24, H - 24, 8);
    g.fill();

    g.fillStyle = 'rgba(34,76,48,0.1)';
    for (let y = 12; y < H - 12; y += 4) g.fillRect(12, y, W - 24, 1);
    for (let x = 12; x < W - 12; x += 4) g.fillRect(x, 12, 1, H - 24);

    const ink = '#1c382a';
    const light = '#f2ffec';

    px(42, 24, 10, 12, ink);
    px(76, 24, 10, 12, ink);
    px(45, 27, 5, 7, '#7ad88a');
    px(78, 27, 5, 7, '#7ad88a');

    px(46, 29, 36, 7, ink);
    px(40, 34, 48, 28, ink);
    px(46, 40, 36, 17, light);

    px(52, 43, 6, 9, ink);
    px(70, 43, 6, 9, ink);
    px(53, 44, 2, 3, '#ffffff');
    px(71, 44, 2, 3, '#ffffff');

    px(57, 52, 3, 3, ink);
    px(68, 52, 3, 3, ink);
    px(60, 54, 8, 3, ink);

    px(45, 49, 6, 4, '#ff78aa');
    px(77, 49, 6, 4, '#ff78aa');

    px(48, 62, 10, 5, ink);
    px(70, 62, 10, 5, ink);
    px(88, 56, 4, 4, ink);
    px(92, 52, 4, 9, ink);
    px(88, 60, 4, 4, ink);

    px(96, 19, 4, 4, '#e6396e');
    px(104, 19, 4, 4, '#e6396e');
    px(95, 23, 14, 4, '#e6396e');
    px(98, 27, 8, 3, '#e6396e');
    px(101, 30, 3, 3, '#e6396e');
  });
}

function handheldScreen() {
  return canvasTex(512, 352, (g) => {
    g.scale(2, 2);
    const W = 256;
    const H = 176;
    const px = (x: number, y: number, w: number, h: number, c: string) => {
      g.fillStyle = c;
      g.fillRect(x, y, w, h);
    };

    const sky = g.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, '#c2d69c');
    sky.addColorStop(0.6, '#a5bc82');
    sky.addColorStop(1, '#87a06c');
    g.fillStyle = sky;
    g.fillRect(0, 0, W, H);

    const ink = '#243218';
    const mid = '#566d34';
    const pale = '#e0efae';
    const accent = '#9bbc0f';

    px(28, 26, 26, 6, pale);
    px(34, 20, 14, 6, pale);
    px(190, 38, 30, 6, pale);
    px(198, 32, 14, 6, pale);

    for (let i = 0; i < 6; i++) px(218 + i * 4, 18, 3, 3, accent);
    px(226, 10, 12, 12, accent);
    px(222, 14, 20, 4, accent);

    px(0, 138, W, 4, mid);
    px(0, 128, 56, 10, mid);
    px(40, 120, 44, 8, mid);
    px(150, 126, 60, 12, mid);
    px(196, 116, 60, 10, mid);
    px(0, 142, W, 34, '#6e8452');
    for (let x = 0; x < W; x += 16) px(x, 150 + ((x / 16) % 2) * 6, 8, 3, '#5d7344');

    px(74, 144, 52, 5, ink);
    px(82, 84, 12, 14, ink);
    px(112, 84, 12, 14, ink);
    px(85, 87, 6, 8, accent);
    px(115, 87, 6, 8, accent);

    px(84, 94, 38, 30, ink);
    px(88, 90, 30, 6, ink);
    px(90, 100, 26, 16, pale);
    px(94, 103, 5, 7, ink);
    px(107, 103, 5, 7, ink);
    px(102, 112, 4, 3, ink);

    px(88, 122, 30, 22, ink);
    px(84, 132, 8, 12, ink);
    px(118, 124, 8, 6, ink);
    px(124, 116, 5, 12, ink);
    px(96, 128, 4, 8, pale);
    px(106, 128, 4, 8, pale);
    px(92, 140, 10, 4, ink);
    px(106, 140, 10, 4, ink);

    const heart = (x: number, y: number, s: number) => {
      px(x + s, y, 2 * s, s, '#b82842');
      px(x + 4 * s, y, 2 * s, s, '#b82842');
      px(x, y + s, 7 * s, 2 * s, '#b82842');
      px(x + s, y + 3 * s, 5 * s, s, '#b82842');
      px(x + 2 * s, y + 4 * s, 3 * s, s, '#b82842');
      px(x + 3 * s, y + 5 * s, s, s, '#b82842');
      px(x + s, y + s, 2 * s, s, '#e26a7e');
    };
    heart(168, 62, 6);

    g.fillStyle = 'rgba(24,36,14,0.06)';
    for (let y = 0; y < H; y += 3) g.fillRect(0, y, W, 1);
  });
}

/**
 * Clean, bold `3D Art` (mint) / `Front-end` (yellow) sticker matching reference/target.png.
 */
function floppyLabel(title: string, accent: string) {
  return canvasTex(512, 420, (g) => {
    g.scale(2, 2);
    const W = 256;
    const H = 210;

    g.fillStyle = accent;
    roundRect(g, 2, 2, W - 4, H - 4, 10);
    g.fill();

    // subtle paper sheen
    const sheen = g.createLinearGradient(0, 0, 0, H);
    sheen.addColorStop(0, 'rgba(255,255,255,0.28)');
    sheen.addColorStop(0.5, 'rgba(255,255,255,0.02)');
    sheen.addColorStop(1, 'rgba(0,0,0,0.08)');
    g.fillStyle = sheen;
    roundRect(g, 2, 2, W - 4, H - 4, 10);
    g.fill();

    // top pale rule lines like a classic floppy label
    g.fillStyle = 'rgba(255,255,255,0.36)';
    g.fillRect(14, 16, W - 28, 16);
    g.fillStyle = 'rgba(30,45,35,0.22)';
    g.fillRect(14, 44, W - 28, 3);
    g.fillRect(14, 62, W - 28, 3);

    // bold title in the lower half (mirrors reference)
    let size = 62;
    const maxW = W - 26;
    for (;;) {
      g.font = `900 ${size}px "Arial Rounded MT Bold", "Helvetica Neue", Arial, sans-serif`;
      if (g.measureText(title).width <= maxW || size <= 24) break;
      size -= 2;
    }
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.lineJoin = 'round';
    g.fillStyle = '#1f2c24';
    g.fillText(title, W / 2, 134);

    // bottom crisp rule
    g.fillStyle = 'rgba(30,45,35,0.22)';
    g.fillRect(24, 182, W - 48, 3);
  });
}

function pocketLogo(accent: string, ink: string) {
  return canvasTex(256, 48, (g) => {
    g.scale(2, 2);
    const W = 128;
    const H = 24;
    g.clearRect(0, 0, W, H);
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.font = '900 12px "HelveticaNeue-CondensedBlack", "Arial Narrow", "Helvetica Neue", Arial, sans-serif';
    g.fillStyle = ink;
    g.fillText('POCKET', 43, 12);
    g.fillStyle = accent;
    g.fillText('PET', 83, 12);
    g.fillStyle = P.yellow;
    const sx = 105;
    const sy = 12;
    g.beginPath();
    g.moveTo(sx, sy - 6);
    g.lineTo(sx + 2, sy - 1);
    g.lineTo(sx + 7, sy);
    g.lineTo(sx + 2, sy + 1);
    g.lineTo(sx, sy + 6);
    g.lineTo(sx - 2, sy + 1);
    g.lineTo(sx - 7, sy);
    g.lineTo(sx - 2, sy - 1);
    g.closePath();
    g.fill();
  });
}

function consoleLogo() {
  return canvasTex(256, 40, (g) => {
    g.scale(2, 2);
    const W = 128;
    const H = 20;
    g.clearRect(0, 0, W, H);
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.font = '800 10px "Helvetica Neue", Arial, sans-serif';
    g.fillStyle = 'rgba(46,54,46,0.75)';
    g.fillText('P I X E L   B O Y', W / 2, 10);
  });
}

/* ------------------------------------------------------------------ */
/* shapes                                                              */
/* ------------------------------------------------------------------ */

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

export const TOY_TOP: Record<Toy, number> = {
  pocketpet: 0.059,
  handheld: 0.056,
  floppy: 0.048,
  charm: 0.056,
  cartridge: 0.049,
  ball: 0.041,
};

const gloss = (c: string, opts: Partial<THREE.MeshPhysicalMaterialParameters> = {}) =>
  plastic(c, {
    roughness: 0.14,
    metalness: 0.02,
    clearcoat: 0.72,
    clearcoatRoughness: 0.1,
    envMapIntensity: 1.25,
    ...opts,
  });

/* ------------------------------------------------------------------ */
/* Tamagotchi egg                                                      */
/* ------------------------------------------------------------------ */

function buildPet(
  shell: string,
  buttonColors: string[],
  logoAccent: string,
  logoInk: string,
  bezelColor: string = P.plum
) {
  const g = new THREE.Group();
  const R = 0.036;
  const H = 0.094;
  const pts: THREE.Vector2[] = [];
  for (let i = 0; i <= 18; i++) {
    const t = i / 18;
    const r = R * Math.pow(Math.sin(Math.PI * t), 0.58) * (1 - 0.1 * t);
    pts.push(new THREE.Vector2(Math.max(r, 0.0005), (t - 0.5) * H));
  }
  const body = new THREE.Mesh(new THREE.LatheGeometry(pts, 24), gloss(shell, { roughness: 0.1 }));
  body.scale.z = 0.74;
  body.castShadow = true;
  g.add(body);

  const facePlate = new THREE.Mesh(
    new RoundedBoxGeometry(0.044, 0.042, 0.008, 2, 0.014),
    gloss(P.cream, { roughness: 0.16 })
  );
  facePlate.position.set(0, 0.008, 0.0225);
  g.add(facePlate);

  const beadGeo = new THREE.SphereGeometry(0.0027, 7, 5);
  const beadMat = gloss('#fff8ec', { roughness: 0.22 });
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    const bead = new THREE.Mesh(beadGeo, beadMat);
    bead.scale.z = 0.6;
    bead.position.set(Math.cos(a) * 0.0196, 0.008 + Math.sin(a) * 0.0165, 0.0276);
    g.add(bead);
  }

  const bezel = new THREE.Mesh(
    new RoundedBoxGeometry(0.037, 0.031, 0.005, 2, 0.009),
    gloss(bezelColor, { roughness: 0.18 })
  );
  bezel.position.set(0, 0.008, 0.0265);
  g.add(bezel);

  // Clear 1.4mm proud of bezel front (0.0290) + polygonOffset: zero z-fighting.
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.031, 0.025), screenMat(pocketScreen(), 0.36));
  screen.position.set(0, 0.008, 0.0304);
  g.add(screen);

  const logo = new THREE.Mesh(
    new THREE.PlaneGeometry(0.03, 0.0057),
    new THREE.MeshStandardMaterial({
      map: pocketLogo(logoAccent, logoInk),
      transparent: true,
      roughness: 0.35,
      metalness: 0,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
    })
  );
  logo.position.set(0, 0.025, 0.0312);
  g.add(logo);

  const btnGeo = new THREE.SphereGeometry(0.0052, 10, 8);
  for (let i = 0; i < 3; i++) {
    const b = new THREE.Mesh(btnGeo, gloss(buttonColors[i] ?? P.yellow, { roughness: 0.14 }));
    b.scale.set(1, 1, 0.58);
    b.position.set(-0.0135 + i * 0.0135, -0.027, 0.0215);
    g.add(b);
  }

  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.0026, 0.0026, 0.008, 8), chrome());
  neck.position.set(0, 0.049, 0);
  g.add(neck);
  const loop = new THREE.Mesh(new THREE.TorusGeometry(0.006, 0.0017, 6, 12), chrome());
  loop.position.set(0, 0.0485, 0);
  g.add(loop);

  return g;
}

/* ------------------------------------------------------------------ */
/* Game Boy style handhelds                                            */
/* ------------------------------------------------------------------ */

function buildConsole(wide: boolean, shell: string, aColor: string, bColor: string) {
  const g = new THREE.Group();
  const bw = wide ? 0.096 : 0.066;
  const bh = wide ? 0.064 : 0.088;

  const body = new THREE.Mesh(
    new RoundedBoxGeometry(bw, bh, 0.018, 2, 0.013),
    gloss(shell, { roughness: 0.18 })
  );
  body.castShadow = true;
  g.add(body);

  const bezelW = wide ? 0.06 : 0.052;
  const bezelH = wide ? 0.04 : 0.042;
  const screenY = wide ? 0.011 : 0.018;
  const bezel = new THREE.Mesh(
    new RoundedBoxGeometry(bezelW, bezelH, 0.006, 2, 0.006),
    gloss('#353b36', { roughness: 0.2 })
  );
  bezel.position.set(0, screenY, 0.0098);
  g.add(bezel);

  // Clear 1.4mm proud of bezel front (0.0128) + polygonOffset: zero z-fighting.
  const screenW = wide ? 0.05 : 0.042;
  const screenH = wide ? 0.032 : 0.034;
  const screen = new THREE.Mesh(
    new THREE.PlaneGeometry(screenW, screenH),
    screenMat(handheldScreen(), 0.28)
  );
  screen.position.set(0, screenY, 0.0142);
  g.add(screen);

  const logo = new THREE.Mesh(
    new THREE.PlaneGeometry(wide ? 0.03 : 0.024, 0.0047),
    new THREE.MeshStandardMaterial({
      map: consoleLogo(),
      transparent: true,
      roughness: 0.4,
      metalness: 0,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
    })
  );
  logo.position.set(0, wide ? -0.012 : bh / 2 - 0.013, 0.0108);
  g.add(logo);

  const led = new THREE.Mesh(new THREE.SphereGeometry(0.0024, 6, 5), glow('#48ff90', 1.7));
  led.position.set(-bw / 2 + 0.009, bh / 2 - 0.012, 0.0098);
  g.add(led);

  const dpadMat = gloss(wide ? '#262a30' : '#3c4039', { roughness: 0.2 });
  const dcx = wide ? -0.033 : -0.019;
  const dcy = wide ? -0.015 : -0.03;
  const dh = new THREE.Mesh(
    new RoundedBoxGeometry(wide ? 0.024 : 0.022, 0.0085, 0.005, 2, 0.003),
    dpadMat
  );
  dh.position.set(dcx, dcy, 0.0108);
  g.add(dh);
  const dv = new THREE.Mesh(
    new RoundedBoxGeometry(0.0085, wide ? 0.024 : 0.022, 0.005, 2, 0.003),
    dpadMat
  );
  dv.position.set(dcx, dcy, 0.0108);
  g.add(dv);

  const btnGeo = new THREE.CylinderGeometry(wide ? 0.0068 : 0.0074, wide ? 0.0068 : 0.0074, 0.005, 12);
  const ba = new THREE.Mesh(btnGeo, gloss(aColor, { roughness: 0.14 }));
  ba.rotation.x = Math.PI / 2;
  ba.position.set(wide ? 0.026 : 0.012, wide ? -0.013 : -0.023, 0.0124);
  g.add(ba);
  const bb = new THREE.Mesh(btnGeo, gloss(bColor, { roughness: 0.14 }));
  bb.rotation.x = Math.PI / 2;
  bb.position.set(wide ? 0.038 : 0.026, wide ? -0.023 : -0.033, 0.0124);
  g.add(bb);

  const startGeo = new RoundedBoxGeometry(wide ? 0.012 : 0.013, 0.0055, 0.004, 1, 0.002);
  const startColors = ['#ffd228', '#22a6ff'];
  for (let i = 0; i < 2; i++) {
    const s = new THREE.Mesh(startGeo, wide ? gloss(startColors[i], { roughness: 0.18 }) : dpadMat);
    if (wide) s.position.set(-0.016 + i * 0.014, -0.028, 0.0115);
    else s.position.set(-0.006 + i * 0.015, -0.0385, 0.0108);
    g.add(s);
  }

  if (!wide) {
    const slotMat = gloss('#555d4c', { roughness: 0.35 });
    for (let i = 0; i < 3; i++) {
      const slot = new THREE.Mesh(
        new RoundedBoxGeometry(0.006, 0.0024, 0.0018, 1, 0.0008),
        slotMat
      );
      slot.position.set(0.02, -0.033 + i * 0.0042, 0.01);
      g.add(slot);
    }
  }

  const shGeo = new RoundedBoxGeometry(wide ? 0.02 : 0.018, 0.006, 0.012, 1, 0.0025);
  const shMat = gloss(wide ? '#cfd6de' : '#a7b098', { roughness: 0.18 });
  for (let i = 0; i < 2; i++) {
    const sh = new THREE.Mesh(shGeo, shMat);
    sh.position.set(wide ? -0.038 + i * 0.076 : -0.023 + i * 0.046, bh / 2 - 0.001, -0.001);
    g.add(sh);
  }

  return g;
}

/* ------------------------------------------------------------------ */
/* 3.5" floppy disks — raised sticker plate, zero z-fighting           */
/* ------------------------------------------------------------------ */

function buildFloppy(
  bodyColor: string,
  backingColor: string,
  labelAccent: string,
  labelTitle: string,
  shutterColor: string | null
) {
  const g = new THREE.Group();
  const w = 0.086;

  const backing = new THREE.Mesh(
    extrude(floppyShape(w + 0.005, 0.014), 0.003, 0.0006),
    gloss(backingColor, { roughness: 0.24 })
  );
  backing.position.z = -0.0036;
  g.add(backing);

  // Extrude total thickness = 0.007 + 2 * 0.001 = 0.009 -> front face sits at z = +0.0045.
  const body = new THREE.Mesh(
    extrude(floppyShape(w, 0.014), 0.007, 0.001),
    gloss(bodyColor, { roughness: 0.14 })
  );
  body.castShadow = true;
  g.add(body);

  // Raised physical sticker card + printed plane clearly proud of body front (z = 0.0059) -> ZERO z-fighting!
  const labelPlate = new THREE.Mesh(
    new RoundedBoxGeometry(0.066, 0.056, 0.0016, 1, 0.0006),
    gloss(labelAccent, { roughness: 0.32, clearcoat: 0.25 })
  );
  labelPlate.position.set(0, -0.013, 0.0052);
  g.add(labelPlate);

  const labelMat = new THREE.MeshStandardMaterial({
    map: floppyLabel(labelTitle, labelAccent),
    roughness: 0.28,
    metalness: 0,
    envMapIntensity: 0.6,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
  });
  const label = new THREE.Mesh(new THREE.PlaneGeometry(0.064, 0.054), labelMat);
  label.position.set(0, -0.013, 0.0063);
  g.add(label);

  const shutterMat = shutterColor ? gloss(shutterColor, { roughness: 0.16 }) : chrome();

  // Shutter sits proud at z = 0.0052 (front face at 0.0064).
  const shutter = new THREE.Mesh(
    new RoundedBoxGeometry(0.036, 0.02, 0.0024, 1, 0.001),
    shutterMat
  );
  shutter.position.set(0.009, 0.032, 0.0052);
  g.add(shutter);

  // Slot recessed box clearly proud of shutter front (z = 0.0068) -> ZERO z-fighting!
  const slot = new THREE.Mesh(
    new RoundedBoxGeometry(0.011, 0.013, 0.001, 1, 0.0003),
    gloss('#2a3038', { roughness: 0.3 })
  );
  slot.position.set(0.018, 0.032, 0.0065);
  g.add(slot);

  const rail = new THREE.Mesh(new RoundedBoxGeometry(0.006, 0.02, 0.003, 1, 0.0008), shutterMat);
  rail.position.set(-0.012, 0.032, 0.0054);
  g.add(rail);

  const notch = new THREE.Mesh(
    new RoundedBoxGeometry(0.007, 0.007, 0.004, 1, 0.0008),
    gloss(P.plum, { roughness: 0.28 })
  );
  notch.position.set(-0.036, 0.035, 0.0026);
  g.add(notch);

  return g;
}

/* ------------------------------------------------------------------ */
/* public entry                                                        */
/* ------------------------------------------------------------------ */

export function makeToy(kind: Toy, color: string): THREE.Group {
  const g = new THREE.Group();

  if (kind === 'pocketpet') {
    // pastel bubblegum-pink Tamagotchi (left-front of reference pile)
    g.add(buildPet('#f898cc', [P.yellow, P.pinkDeep, P.mint], '#ef368c', P.ink, '#5a3868'));
  } else if (kind === 'cartridge') {
    // glossy vibrant crimson-red Tamagotchi with golden buttons (center-front of reference pile)
    g.add(buildPet('#e81c28', [P.yellow, P.yellow, P.yellow], '#ffd838', '#ffe455', '#52222c'));
  } else if (kind === 'handheld') {
    // sleek silver horizontal GBA (center-top of reference pile)
    g.add(buildConsole(true, '#e4eaf2', '#e82630', '#1e6ae8'));
  } else if (kind === 'ball') {
    // classic vertical grey-mint Game Boy with hot-magenta buttons (far-right of reference pile)
    g.add(buildConsole(false, '#c4ccd2', '#e82e8a', '#e82e8a'));
  } else if (kind === 'floppy') {
    // vivid royal-blue floppy with sunny yellow `Front-end` label & chrome shutter
    g.add(buildFloppy('#2888f0', '#165eb8', '#ffd838', 'Front-end', null));
  } else {
    // vibrant candy-pink floppy with mint `3D Art` label & crisp white-pink shutter
    g.add(buildFloppy('#f87ec0', '#d4589c', '#98f0c8', '3D Art', '#fdf2fa'));
  }

  g.userData.tint = color;
  return g;
}
