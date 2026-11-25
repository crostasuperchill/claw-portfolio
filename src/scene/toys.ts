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
  t.anisotropy = 16;
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
  return canvasTex(256, 208, (g) => {
    g.scale(2, 2);
    const W = 128;
    const H = 104;
    const px = (x: number, y: number, w: number, h: number, c: string) => {
      g.fillStyle = c;
      g.fillRect(x, y, w, h);
    };

    // soft sage LCD backdrop
    const bg = g.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, '#e0eec6');
    bg.addColorStop(1, '#c1d79c');
    g.fillStyle = bg;
    g.fillRect(0, 0, W, H);

    // recessed dark screen window + light active area
    g.fillStyle = '#3f5340';
    roundRect(g, 7, 7, W - 14, H - 14, 11);
    g.fill();
    g.fillStyle = '#d3e6ae';
    roundRect(g, 12, 12, W - 24, H - 24, 8);
    g.fill();

    // faint pixel grid
    g.fillStyle = 'rgba(44,92,64,0.09)';
    for (let y = 12; y < H - 12; y += 4) g.fillRect(12, y, W - 24, 1);
    for (let x = 12; x < W - 12; x += 4) g.fillRect(x, 12, 1, H - 24);

    const ink = '#204233';
    const light = '#f3fff1';

    // ears
    px(42, 24, 10, 12, ink);
    px(76, 24, 10, 12, ink);
    px(45, 27, 5, 7, '#8fd99a');
    px(78, 27, 5, 7, '#8fd99a');

    // head
    px(46, 29, 36, 7, ink);
    px(40, 34, 48, 28, ink);

    // face
    px(46, 40, 36, 17, light);

    // eyes + sparkles
    px(52, 43, 6, 9, ink);
    px(70, 43, 6, 9, ink);
    px(53, 44, 2, 3, '#ffffff');
    px(71, 44, 2, 3, '#ffffff');

    // smile
    px(57, 52, 3, 3, ink);
    px(68, 52, 3, 3, ink);
    px(60, 54, 8, 3, ink);

    // blush
    px(45, 49, 6, 4, '#ff9dbb');
    px(77, 49, 6, 4, '#ff9dbb');

    // paws + tail
    px(48, 62, 10, 5, ink);
    px(70, 62, 10, 5, ink);
    px(88, 56, 4, 4, ink);
    px(92, 52, 4, 9, ink);
    px(88, 60, 4, 4, ink);

    // little heart, top-right
    px(96, 19, 4, 4, '#e8557e');
    px(104, 19, 4, 4, '#e8557e');
    px(95, 23, 14, 4, '#e8557e');
    px(98, 27, 8, 3, '#e8557e');
    px(101, 30, 3, 3, '#e8557e');

    // sparkle, top-left
    px(20, 20, 3, 3, '#ffffff');
    px(18, 22, 7, 1, '#ffffff');
    px(21, 19, 1, 7, '#ffffff');

    // soft LCD scanlines
    g.fillStyle = 'rgba(255,255,255,0.05)';
    for (let y = 12; y < H - 12; y += 2) g.fillRect(12, y, W - 24, 1);
  });
}

/**
 * Classic 4-shade olive DMG screen with a chunky pixel cat and a heart.
 * Drawn at 2x (512x352) so the pixel blocks stay razor sharp on Retina.
 */
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
    sky.addColorStop(0, '#c2d1a4');
    sky.addColorStop(0.6, '#a9bb8e');
    sky.addColorStop(1, '#8fa37e');
    g.fillStyle = sky;
    g.fillRect(0, 0, W, H);

    const ink = '#2f3d22';
    const mid = '#61753f';
    const pale = '#dce9af';
    const accent = '#9bbc0f';

    // pixel clouds
    px(28, 26, 26, 6, pale);
    px(34, 20, 14, 6, pale);
    px(190, 38, 30, 6, pale);
    px(198, 32, 14, 6, pale);

    // pixel sun
    for (let i = 0; i < 6; i++) px(218 + i * 4, 18, 3, 3, accent);
    px(226, 10, 12, 12, accent);
    px(222, 14, 20, 4, accent);

    // rolling hills
    px(0, 138, W, 4, mid);
    px(0, 128, 56, 10, mid);
    px(40, 120, 44, 8, mid);
    px(150, 126, 60, 12, mid);
    px(196, 116, 60, 10, mid);
    px(0, 142, W, 34, '#7b8f60');
    for (let x = 0; x < W; x += 16) px(x, 150 + ((x / 16) % 2) * 6, 8, 3, '#6c8054');

    // ground shadow under the cat
    px(74, 144, 52, 5, ink);

    // ears
    px(82, 84, 12, 14, ink);
    px(112, 84, 12, 14, ink);
    px(85, 87, 6, 8, accent);
    px(115, 87, 6, 8, accent);

    // head
    px(84, 94, 38, 30, ink);
    px(88, 90, 30, 6, ink);

    // face
    px(90, 100, 26, 16, pale);

    // eyes + nose
    px(94, 103, 5, 7, ink);
    px(107, 103, 5, 7, ink);
    px(102, 112, 4, 3, ink);

    // body + tail
    px(88, 122, 30, 22, ink);
    px(84, 132, 8, 12, ink);
    px(118, 124, 8, 6, ink);
    px(124, 116, 5, 12, ink);
    px(96, 128, 4, 8, pale);
    px(106, 128, 4, 8, pale);

    // paws
    px(92, 140, 10, 4, ink);
    px(106, 140, 10, 4, ink);

    // big pixel heart
    const heart = (x: number, y: number, s: number) => {
      px(x + s, y, 2 * s, s, '#a8384c');
      px(x + 4 * s, y, 2 * s, s, '#a8384c');
      px(x, y + s, 7 * s, 2 * s, '#a8384c');
      px(x + s, y + 3 * s, 5 * s, s, '#a8384c');
      px(x + 2 * s, y + 4 * s, 3 * s, s, '#a8384c');
      px(x + 3 * s, y + 5 * s, s, s, '#a8384c');
      px(x + s, y + s, 2 * s, s, '#d06a7a');
    };
    heart(168, 62, 6);

    // tiny sparkles and signature dots
    px(160, 44, 4, 4, pale);
    px(160, 52, 4, 4, pale);
    px(164, 48, 4, 4, pale);
    px(224, 148, 3, 3, ink);
    px(228, 148, 8, 3, ink);

    // LCD scanlines
    g.fillStyle = 'rgba(28,40,18,0.06)';
    for (let y = 0; y < H; y += 3) g.fillRect(0, y, W, 1);
  });
}

/**
 * Bold pixel `3D Art` (mint) / `Front-end` (yellow) label for the floppy disks
 * in reference/target.png. 512x480 = 2x.
 */
function floppyLabel(title: string, accent: string) {
  return canvasTex(512, 480, (g) => {
    g.scale(2, 2);
    const W = 256;
    const H = 240;

    const base = g.createLinearGradient(0, 0, 0, H);
    base.addColorStop(0, accent);
    base.addColorStop(1, accent);
    g.fillStyle = base;
    g.fillRect(0, 0, W, H);

    const sheen = g.createLinearGradient(0, 0, 0, H);
    sheen.addColorStop(0, 'rgba(255,255,255,0.34)');
    sheen.addColorStop(0.42, 'rgba(255,255,255,0.03)');
    sheen.addColorStop(1, 'rgba(0,0,0,0.10)');
    g.fillStyle = sheen;
    g.fillRect(0, 0, W, H);

    // white printed border
    g.strokeStyle = 'rgba(255,255,255,0.9)';
    g.lineWidth = 5;
    roundRect(g, 6, 6, W - 12, H - 12, 6);
    g.stroke();

    // header strip
    g.fillStyle = 'rgba(255,255,255,0.32)';
    g.fillRect(9, 9, W - 18, 30);
    g.fillStyle = 'rgba(30,52,40,0.82)';
    g.font = '800 13px "Helvetica Neue", Arial, sans-serif';
    g.textAlign = 'left';
    g.textBaseline = 'middle';
    g.fillText('DAVIDE.FYI', 18, 24);
    g.textAlign = 'right';
    g.fillText('HD · 1.44 MB', W - 18, 24);

    // bold project title
    const label = title;
    let size = 74;
    const maxW = W - 32;
    for (;;) {
      g.font = `900 ${size}px "Helvetica Neue", Arial, sans-serif`;
      const widest = g.measureText(label).width;
      if (widest <= maxW || size <= 24) break;
      size -= 2;
    }
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.lineJoin = 'round';
    g.strokeStyle = 'rgba(255,255,255,0.9)';
    g.lineWidth = 7;
    g.strokeText(label, W / 2, 106);
    g.fillStyle = accent === '#ffe066' ? '#5b3a00' : '#21402c';
    g.fillText(label, W / 2, 106);

    // two tidy rule lines
    g.fillStyle = 'rgba(30,52,40,0.28)';
    g.fillRect(36, 152, W - 72, 4);
    g.fillRect(64, 164, W - 128, 3);

    // tiny folder glyph
    g.fillStyle = 'rgba(255,255,255,0.85)';
    roundRect(g, W / 2 - 34, 186, 68, 12, 3);
    g.fill();
    roundRect(g, W / 2 - 34, 186, 26, 6, 3);
    g.fill();
    g.fillStyle = 'rgba(30,52,40,0.55)';
    g.fillRect(W / 2 - 22, 200, 44, 4);
    g.fillRect(W / 2 - 14, 209, 28, 3);
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
    g.fillStyle = 'rgba(46,54,46,0.7)';
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

const gloss = (c: string, opts: Partial<THREE.MeshStandardMaterialParameters> = {}) =>
  plastic(c, {
    roughness: 0.18,
    metalness: 0.02,
    envMapIntensity: 1.15,
    ...opts,
  });

/* ------------------------------------------------------------------ */
/* Tamagotchi egg                                                      */
/* ------------------------------------------------------------------ */

/**
 * Pocket-pet egg. The shell colour is passed in so the same build serves the
 * pastel pink and the vibrant red Tamagotchi seen in reference/target.png.
 */
function buildPet(
  shell: string,
  buttonColors: string[],
  logoAccent: string,
  logoInk: string
) {
  const g = new THREE.Group();
  const R = 0.035;
  const H = 0.092;
  const pts: THREE.Vector2[] = [];
  for (let i = 0; i <= 18; i++) {
    const t = i / 18;
    const r = R * Math.pow(Math.sin(Math.PI * t), 0.58) * (1 - 0.1 * t);
    pts.push(new THREE.Vector2(Math.max(r, 0.0005), (t - 0.5) * H));
  }
  const body = new THREE.Mesh(new THREE.LatheGeometry(pts, 24), gloss(shell, { roughness: 0.13 }));
  body.scale.z = 0.72;
  body.castShadow = true;
  g.add(body);

  const facePlate = new THREE.Mesh(
    new RoundedBoxGeometry(0.043, 0.041, 0.008, 2, 0.014),
    gloss(P.cream, { roughness: 0.18 })
  );
  facePlate.position.set(0, 0.008, 0.0222);
  g.add(facePlate);

  // cute scalloped / notched inner frame around the LCD
  const beadGeo = new THREE.SphereGeometry(0.0027, 7, 5);
  const beadMat = gloss('#fff8ec', { roughness: 0.28 });
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    const bead = new THREE.Mesh(beadGeo, beadMat);
    bead.scale.z = 0.6;
    bead.position.set(Math.cos(a) * 0.0192, 0.008 + Math.sin(a) * 0.0162, 0.0274);
    g.add(bead);
  }

  const bezel = new THREE.Mesh(
    new RoundedBoxGeometry(0.037, 0.031, 0.005, 2, 0.009),
    gloss(P.plum, { roughness: 0.2 })
  );
  bezel.position.set(0, 0.008, 0.0262);
  g.add(bezel);

  const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.031, 0.025), screenMat(pocketScreen(), 0.42));
  screen.position.set(0, 0.008, 0.0291);
  g.add(screen);

  // tiny printed logo above the screen
  const logo = new THREE.Mesh(
    new THREE.PlaneGeometry(0.03, 0.0057),
    new THREE.MeshStandardMaterial({
      map: pocketLogo(logoAccent, logoInk),
      transparent: true,
      roughness: 0.45,
      metalness: 0,
    })
  );
  logo.position.set(0, 0.0246, 0.0302);
  g.add(logo);

  const btnGeo = new THREE.SphereGeometry(0.005, 10, 8);
  for (let i = 0; i < 3; i++) {
    const b = new THREE.Mesh(btnGeo, gloss(buttonColors[i] ?? P.yellow, { roughness: 0.16 }));
    b.scale.set(1, 1, 0.55);
    b.position.set(-0.013 + i * 0.013, -0.027, 0.0208);
    g.add(b);
  }

  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.0026, 0.0026, 0.008, 8), chrome());
  neck.position.set(0, 0.0485, 0);
  g.add(neck);
  const loop = new THREE.Mesh(new THREE.TorusGeometry(0.006, 0.0017, 6, 12), chrome());
  loop.position.set(0, 0.0475, 0);
  g.add(loop);

  return g;
}

/* ------------------------------------------------------------------ */
/* Game Boy style handhelds                                            */
/* ------------------------------------------------------------------ */

/**
 * `wide` builds the silver horizontal GBA (center-top of the reference pile);
 * otherwise the classic vertical grey-mint Game Boy (far right of the pile).
 */
function buildConsole(wide: boolean, shell: string, aColor: string, bColor: string) {
  const g = new THREE.Group();
  const bw = wide ? 0.094 : 0.064;
  const bh = wide ? 0.066 : 0.084;

  const body = new THREE.Mesh(
    new RoundedBoxGeometry(bw, bh, 0.018, 2, 0.013),
    gloss(shell, { roughness: 0.22 })
  );
  g.add(body);

  const bezelW = wide ? 0.06 : 0.052;
  const bezelH = wide ? 0.04 : 0.042;
  const screenY = wide ? 0.012 : 0.018;
  const bezel = new THREE.Mesh(
    new RoundedBoxGeometry(bezelW, bezelH, 0.006, 2, 0.006),
    gloss('#3b413a', { roughness: 0.24 })
  );
  bezel.position.set(0, screenY, 0.0098);
  g.add(bezel);

  const screenW = wide ? 0.05 : 0.042;
  const screenH = wide ? 0.032 : 0.034;
  const screen = new THREE.Mesh(
    new THREE.PlaneGeometry(screenW, screenH),
    screenMat(handheldScreen(), 0.3)
  );
  screen.position.set(0, screenY, 0.0132);
  g.add(screen);

  const logo = new THREE.Mesh(
    new THREE.PlaneGeometry(wide ? 0.03 : 0.024, 0.0047),
    new THREE.MeshStandardMaterial({
      map: consoleLogo(),
      transparent: true,
      roughness: 0.5,
      metalness: 0,
    })
  );
  logo.position.set(0, wide ? -0.011 : bh / 2 - 0.013, 0.0099);
  g.add(logo);

  const led = new THREE.Mesh(new THREE.SphereGeometry(0.0024, 6, 5), glow('#55ff9a', 1.6));
  led.position.set(-bw / 2 + 0.009, bh / 2 - 0.012, 0.0094);
  g.add(led);

  const dpadMat = gloss(wide ? '#2f3338' : '#4a4e45', { roughness: 0.22 });
  const dcx = wide ? -0.031 : -0.019;
  const dcy = wide ? -0.017 : -0.03;
  const dh = new THREE.Mesh(
    new RoundedBoxGeometry(wide ? 0.026 : 0.022, 0.009, 0.005, 2, 0.003),
    dpadMat
  );
  dh.position.set(dcx, dcy, 0.0102);
  g.add(dh);
  const dv = new THREE.Mesh(
    new RoundedBoxGeometry(0.009, wide ? 0.026 : 0.022, 0.005, 2, 0.003),
    dpadMat
  );
  dv.position.set(dcx, dcy, 0.0102);
  g.add(dv);

  const btnGeo = new THREE.CylinderGeometry(wide ? 0.0072 : 0.0075, wide ? 0.0072 : 0.0075, 0.005, 12);
  const ba = new THREE.Mesh(btnGeo, gloss(aColor, { roughness: 0.16 }));
  ba.rotation.x = Math.PI / 2;
  ba.position.set(wide ? 0.024 : 0.012, wide ? -0.015 : -0.023, 0.012);
  g.add(ba);
  const bb = new THREE.Mesh(btnGeo, gloss(bColor, { roughness: 0.16 }));
  bb.rotation.x = Math.PI / 2;
  bb.position.set(wide ? 0.037 : 0.026, wide ? -0.025 : -0.033, 0.012);
  g.add(bb);

  const startGeo = new RoundedBoxGeometry(wide ? 0.012 : 0.013, 0.0055, 0.004, 1, 0.002);
  const startColors = ['#ffd23f', '#52b8ff'];
  for (let i = 0; i < 2; i++) {
    const s = new THREE.Mesh(startGeo, wide ? gloss(startColors[i], { roughness: 0.2 }) : dpadMat);
    if (wide) s.position.set(-0.018 + i * 0.014, -0.0295, 0.0112);
    else s.position.set(-0.006 + i * 0.015, -0.0385, 0.0102);
    g.add(s);
  }

  if (!wide) {
    const slotMat = gloss('#59604f', { roughness: 0.4 });
    for (let i = 0; i < 3; i++) {
      const slot = new THREE.Mesh(
        new RoundedBoxGeometry(0.006, 0.0024, 0.0012, 1, 0.0012),
        slotMat
      );
      slot.position.set(0.02, -0.033 + i * 0.0042, 0.0093);
      g.add(slot);
    }
  }

  const shGeo = new RoundedBoxGeometry(wide ? 0.02 : 0.018, 0.006, 0.012, 1, 0.0025);
  const shMat = gloss(wide ? '#cfd6de' : '#a7b098', { roughness: 0.2 });
  for (let i = 0; i < 2; i++) {
    const sh = new THREE.Mesh(shGeo, shMat);
    sh.position.set(wide ? -0.038 + i * 0.076 : -0.023 + i * 0.046, bh / 2 - 0.001, -0.001);
    g.add(sh);
  }

  return g;
}

/* ------------------------------------------------------------------ */
/* 3.5" floppy disks                                                   */
/* ------------------------------------------------------------------ */

/**
 * Bold 3.5" floppy: bright blue with a `Front-end` label, or pastel pink with
 * a mint `3D Art` label — the two disks in reference/target.png.
 */
function buildFloppy(
  bodyColor: string,
  backingColor: string,
  labelAccent: string,
  labelTitle: string,
  shutterColor: string | null
) {
  const g = new THREE.Group();
  const w = 0.084;

  const backing = new THREE.Mesh(
    extrude(floppyShape(w + 0.006, 0.014), 0.003, 0.0006),
    gloss(backingColor, { roughness: 0.28 })
  );
  backing.position.z = -0.0032;
  g.add(backing);

  const body = new THREE.Mesh(
    extrude(floppyShape(w, 0.014), 0.007, 0.001),
    gloss(bodyColor, { roughness: 0.14 })
  );
  g.add(body);

  const labelMat = new THREE.MeshStandardMaterial({
    map: floppyLabel(labelTitle, labelAccent),
    roughness: 0.3,
    metalness: 0,
    envMapIntensity: 0.7,
  });
  const label = new THREE.Mesh(new THREE.PlaneGeometry(0.064, 0.06), labelMat);
  label.position.set(-0.001, -0.012, 0.0045);
  g.add(label);

  const shutterMat = shutterColor ? gloss(shutterColor, { roughness: 0.16 }) : chrome();

  // shutter with a rectangular cut-out
  const shutter = new THREE.Mesh(
    new RoundedBoxGeometry(0.035, 0.018, 0.0024, 1, 0.0014),
    shutterMat
  );
  shutter.position.set(0.01, 0.031, 0.0044);
  g.add(shutter);

  const slot = new THREE.Mesh(
    new THREE.PlaneGeometry(0.013, 0.012),
    gloss('#3a4048', { roughness: 0.34 })
  );
  slot.position.set(0.019, 0.031, 0.0057);
  g.add(slot);

  // raised shutter rail
  const rail = new THREE.Mesh(new RoundedBoxGeometry(0.006, 0.018, 0.003, 1, 0.001), shutterMat);
  rail.position.set(-0.011, 0.031, 0.0046);
  g.add(rail);

  const notch = new THREE.Mesh(
    new RoundedBoxGeometry(0.008, 0.008, 0.004, 1, 0.001),
    gloss(P.plum, { roughness: 0.3 })
  );
  notch.position.set(-0.036, 0.0345, 0.002);
  g.add(notch);

  return g;
}

/* ------------------------------------------------------------------ */
/* public entry                                                        */
/* ------------------------------------------------------------------ */

export function makeToy(kind: Toy, color: string): THREE.Group {
  const g = new THREE.Group();

  if (kind === 'pocketpet') {
    // pastel pink Tamagotchi (left of the reference pile)
    g.add(buildPet('#f59cc8', [P.yellow, P.pinkDeep, P.mint], '#ef4d91', P.ink));
  } else if (kind === 'cartridge') {
    // vibrant red Tamagotchi with a yellow logo and 3 yellow buttons
    g.add(buildPet('#e62e35', [P.yellow, P.yellow, P.yellow], '#ffd83d', '#ffe14d'));
  } else if (kind === 'handheld') {
    // silver / white horizontal GBA
    g.add(buildConsole(true, '#dfe5ec', '#e8353b', '#2f6fe0'));
  } else if (kind === 'ball') {
    // classic vertical grey-mint Game Boy with magenta buttons
    g.add(buildConsole(false, '#b8c2c8', '#e0468f', '#e0468f'));
  } else if (kind === 'floppy') {
    // bright blue floppy, yellow `Front-end` label, silver shutter
    g.add(buildFloppy('#3b92e6', '#2168b4', '#ffe066', 'Front-end', null));
  } else {
    // pastel pink floppy, mint `3D Art` label, pink-white shutter
    g.add(buildFloppy('#f496c6', '#c97aa6', '#a6ecc6', '3D Art', '#fdf3fa'));
  }

  g.userData.tint = color;
  return g;
}
