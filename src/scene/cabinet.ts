import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { CAB, backlit, candy, chrome, glow, matte, plastic, printed, rubber } from './materials';
import { decalMesh } from './decals';
import { REF } from './dims';
import type { UvRect } from '../contracts';

/* ------------------------------------------------------------------ */
/* fonts + canvas helpers                                              */
/* ------------------------------------------------------------------ */

const JP = '"Hiragino Sans", "Hiragino Kaku Gothic ProN", "Noto Sans JP", "Yu Gothic", sans-serif';
const ROUND = '"Arial Rounded MT Bold", "Arial Black", Inter, Helvetica, sans-serif';

function canvas(w: number, h: number) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

/* Custom Japanese / rounded web fonts may finish loading after the first
 * paint. Keep every printed canvas' repaint closure so we can redraw it once
 * the font set settles — otherwise the marquee and stickers stay blurry or
 * fall back to a system face. */
const fontRepaints = new Set<() => void>();
let fontsSettled = false;

function settleFonts() {
  fontsSettled = true;
  for (const repaint of fontRepaints) repaint();
}

if (typeof document !== 'undefined' && document.fonts) {
  document.fonts.ready.then(settleFonts).catch(() => undefined);
  document.fonts.addEventListener?.('loadingdone', settleFonts);
}

function texture(c: HTMLCanvasElement, repaint?: () => void) {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 16;
  t.generateMipmaps = true;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.magFilter = THREE.LinearFilter;
  if (repaint) {
    fontRepaints.add(() => {
      repaint();
      t.needsUpdate = true;
    });
    if (fontsSettled) {
      repaint();
      t.needsUpdate = true;
    }
  }
  return t;
}

/** Logical-size canvas painted at 2x for razor sharp Retina/DPR3 text. */
function printedTexture(lw: number, lh: number, draw: (g: CanvasRenderingContext2D) => void) {
  const c = canvas(lw * 2, lh * 2);
  const g = c.getContext('2d')!;
  const paint = () => {
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, c.width, c.height);
    g.globalAlpha = 1;
    g.shadowColor = 'transparent';
    g.shadowBlur = 0;
    g.shadowOffsetX = 0;
    g.shadowOffsetY = 0;
    g.scale(2, 2);
    g.save();
    draw(g);
    g.restore();
  };
  paint();
  return texture(c, paint);
}

function roundRect(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  g.beginPath();
  g.roundRect(x, y, w, h, Math.min(r, w / 2, h / 2));
}

function fitFont(
  g: CanvasRenderingContext2D,
  text: string,
  maxW: number,
  size: number,
  weight: number,
  family = JP
) {
  let s = size;
  g.font = `${weight} ${s}px ${family}`;
  while (s > 8 && g.measureText(text).width > maxW) {
    s -= 2;
    g.font = `${weight} ${s}px ${family}`;
  }
  return s;
}

/* ---------- vector mascots ---------- */

function drawUfo(g: CanvasRenderingContext2D, x: number, y: number, s = 1, beam = false) {
  g.save();
  g.translate(x, y);
  g.scale(s, s);
  g.lineJoin = 'round';

  if (beam) {
    const beamGrad = g.createLinearGradient(0, 22, 0, 120);
    beamGrad.addColorStop(0, 'rgba(145, 250, 255, 0.98)');
    beamGrad.addColorStop(0.28, 'rgba(255, 248, 130, 0.94)');
    beamGrad.addColorStop(0.55, 'rgba(255, 140, 200, 0.82)');
    beamGrad.addColorStop(0.78, 'rgba(160, 140, 255, 0.62)');
    beamGrad.addColorStop(1, 'rgba(125, 245, 255, 0)');
    g.fillStyle = beamGrad;
    g.beginPath();
    g.moveTo(-22, 22);
    g.lineTo(22, 22);
    g.lineTo(64, 120);
    g.lineTo(-64, 120);
    g.closePath();
    g.fill();
  }

  g.fillStyle = '#dff8ff';
  g.strokeStyle = '#6ec8ea';
  g.lineWidth = 4;
  g.beginPath();
  g.ellipse(0, 2, 34, 30, 0, Math.PI, Math.PI * 2);
  g.fill();
  g.stroke();

  g.fillStyle = '#7be081';
  g.beginPath();
  g.ellipse(0, -4, 13, 15, 0, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = '#1e2a22';
  for (const sx of [-1, 1]) {
    g.beginPath();
    g.ellipse(sx * 4.6, -6, 2.6, 4, 0, 0, Math.PI * 2);
    g.fill();
  }
  g.strokeStyle = '#7be081';
  g.lineWidth = 2.4;
  for (const sx of [-1, 1]) {
    g.beginPath();
    g.moveTo(sx * 6, -17);
    g.lineTo(sx * 10, -25);
    g.stroke();
    g.fillStyle = '#ffd21e';
    g.beginPath();
    g.arc(sx * 10, -26, 2.6, 0, Math.PI * 2);
    g.fill();
  }

  g.fillStyle = '#a372ff';
  g.strokeStyle = '#6538cc';
  g.lineWidth = 5;
  g.beginPath();
  g.ellipse(0, 16, 62, 19, 0, 0, Math.PI * 2);
  g.fill();
  g.stroke();
  g.fillStyle = '#c8a5ff';
  g.beginPath();
  g.ellipse(0, 10, 46, 10, 0, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = '#8252eb';
  g.beginPath();
  g.ellipse(0, 25, 36, 8, 0, 0, Math.PI * 2);
  g.fill();

  const lights = ['#ffd21e', '#ff7fb2', '#7bf4ff', '#ffd21e', '#9bffb5'];
  lights.forEach((col, i) => {
    g.fillStyle = col;
    g.beginPath();
    g.arc(-36 + i * 18, 27, 4.2, 0, Math.PI * 2);
    g.fill();
  });

  g.restore();
}

function drawCat(g: CanvasRenderingContext2D, x: number, y: number, s = 1, pinkCoat = false) {
  g.save();
  g.translate(x, y);
  g.scale(s, s);
  g.lineJoin = 'round';

  const coat = pinkCoat ? '#ff99c2' : '#fffdfd';
  const stroke = pinkCoat ? '#d9458c' : '#e592b6';

  g.fillStyle = coat;
  g.strokeStyle = stroke;
  g.lineWidth = 4;
  for (const sx of [-1, 1]) {
    g.beginPath();
    g.moveTo(sx * 36, -18);
    g.lineTo(sx * 28, -58);
    g.lineTo(sx * 6, -35);
    g.closePath();
    g.fill();
    g.stroke();
  }
  g.fillStyle = pinkCoat ? '#ffd4e6' : '#ffb8d0';
  for (const sx of [-1, 1]) {
    g.beginPath();
    g.moveTo(sx * 30, -24);
    g.lineTo(sx * 25, -47);
    g.lineTo(sx * 13, -34);
    g.closePath();
    g.fill();
  }

  g.fillStyle = coat;
  g.strokeStyle = stroke;
  g.lineWidth = 4;
  g.beginPath();
  g.ellipse(0, 0, 46, 40, 0, 0, Math.PI * 2);
  g.fill();
  g.stroke();

  g.fillStyle = 'rgba(255, 130, 175, 0.55)';
  for (const sx of [-1, 1]) {
    g.beginPath();
    g.ellipse(sx * 28, 9, 8.5, 5, 0, 0, Math.PI * 2);
    g.fill();
  }

  g.fillStyle = '#231a22';
  for (const sx of [-1, 1]) {
    g.beginPath();
    g.ellipse(sx * 15, -4, 4.5, 6.4, 0, 0, Math.PI * 2);
    g.fill();
  }
  g.fillStyle = '#ffffff';
  for (const sx of [-1, 1]) {
    g.beginPath();
    g.arc(sx * 15 - 1.5, -6, 1.8, 0, Math.PI * 2);
    g.fill();
  }
  // soft white muzzle oval around the nose / mouth
  const muzzle = g.createRadialGradient(0, 12, 2, 0, 12, 18);
  muzzle.addColorStop(0, '#ffffff');
  muzzle.addColorStop(1, pinkCoat ? '#ffeaf3' : '#fff6fa');
  g.fillStyle = muzzle;
  g.beginPath();
  g.ellipse(0, 12, 17, 11, 0, 0, Math.PI * 2);
  g.fill();
  g.strokeStyle = pinkCoat ? 'rgba(217, 69, 140, 0.28)' : 'rgba(229, 146, 182, 0.35)';
  g.lineWidth = 1.4;
  g.stroke();

  // two tiny whiskers per cheek
  g.strokeStyle = pinkCoat ? 'rgba(255, 255, 255, 0.96)' : 'rgba(190, 110, 145, 0.6)';
  g.lineWidth = 2.2;
  g.lineCap = 'round';
  for (const sx of [-1, 1]) {
    g.beginPath();
    g.moveTo(sx * 22, 13);
    g.quadraticCurveTo(sx * 34, 9, sx * 43, 6);
    g.stroke();
    g.beginPath();
    g.moveTo(sx * 22, 19);
    g.quadraticCurveTo(sx * 35, 21, sx * 43, 24);
    g.stroke();
  }

  g.fillStyle = '#ee6f9e';
  g.beginPath();
  g.moveTo(0, 9);
  g.lineTo(-5, 3);
  g.lineTo(5, 3);
  g.closePath();
  g.fill();

  g.strokeStyle = '#6c384b';
  g.lineWidth = 2.6;
  g.beginPath();
  g.arc(-5, 11, 5.5, 0.05 * Math.PI, 0.95 * Math.PI);
  g.stroke();
  g.beginPath();
  g.arc(5, 11, 5.5, 0.05 * Math.PI, 0.95 * Math.PI);
  g.stroke();

  g.restore();
}

function drawSparkle(g: CanvasRenderingContext2D, x: number, y: number, r: number, color: string) {
  g.save();
  g.translate(x, y);
  g.fillStyle = color;
  g.beginPath();
  g.moveTo(0, -r);
  g.quadraticCurveTo(r * 0.18, -r * 0.18, r, 0);
  g.quadraticCurveTo(r * 0.18, r * 0.18, 0, r);
  g.quadraticCurveTo(-r * 0.18, r * 0.18, -r, 0);
  g.quadraticCurveTo(-r * 0.18, -r * 0.18, 0, -r);
  g.fill();
  g.restore();
}

/** round kawaii face sticker used on the blue header band */
function drawKawaiiFace(
  g: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  fill: string,
  rim: string
) {
  g.save();
  g.translate(x, y);
  g.shadowColor = 'rgba(18, 28, 66, 0.32)';
  g.shadowBlur = r * 0.32;
  g.shadowOffsetY = r * 0.12;
  g.fillStyle = '#fffdfd';
  g.beginPath();
  g.arc(0, 0, r, 0, Math.PI * 2);
  g.fill();
  g.shadowColor = 'transparent';

  g.fillStyle = fill;
  g.strokeStyle = rim;
  g.lineWidth = Math.max(2.4, r * 0.1);
  g.beginPath();
  g.arc(0, 0, r * 0.82, 0, Math.PI * 2);
  g.fill();
  g.stroke();

  g.fillStyle = 'rgba(255, 255, 255, 0.45)';
  for (const sx of [-1, 1]) {
    g.beginPath();
    g.ellipse(sx * r * 0.47, r * 0.16, r * 0.15, r * 0.09, 0, 0, Math.PI * 2);
    g.fill();
  }

  g.fillStyle = '#20182a';
  for (const sx of [-1, 1]) {
    g.beginPath();
    g.ellipse(sx * r * 0.3, -r * 0.08, r * 0.085, r * 0.13, 0, 0, Math.PI * 2);
    g.fill();
  }
  g.strokeStyle = '#20182a';
  g.lineWidth = Math.max(2, r * 0.075);
  g.lineCap = 'round';
  g.beginPath();
  g.arc(0, r * 0.12, r * 0.26, 0.18 * Math.PI, 0.82 * Math.PI);
  g.stroke();
  g.restore();
}

/** tiny green/red burger mascot sticker in the header cluster */
function drawTinyBurger(g: CanvasRenderingContext2D, x: number, y: number, r: number) {
  g.save();
  g.translate(x, y);
  g.rotate(-0.09);
  g.shadowColor = 'rgba(18, 28, 66, 0.28)';
  g.shadowBlur = r * 0.3;
  g.shadowOffsetY = r * 0.1;
  g.fillStyle = '#fffdfd';
  roundRect(g, -r * 1.2, -r * 1.0, r * 2.4, r * 2.0, r * 0.34);
  g.fill();
  g.shadowColor = 'transparent';

  g.fillStyle = '#6bd47c';
  g.beginPath();
  g.ellipse(0, -r * 0.22, r * 0.96, r * 0.64, 0, Math.PI, 0);
  g.fill();
  g.fillStyle = '#ffd6a0';
  g.fillRect(-r * 0.96, -r * 0.08, r * 1.92, r * 0.22);
  g.fillStyle = '#ef4b4b';
  roundRect(g, -r * 0.88, r * 0.12, r * 1.76, r * 0.38, r * 0.16);
  g.fill();
  g.fillStyle = '#ffd228';
  roundRect(g, -r * 0.9, r * 0.48, r * 1.8, r * 0.24, r * 0.08);
  g.fill();

  g.fillStyle = '#fff8dc';
  for (const [sx, sy] of [
    [-0.36, -0.5],
    [0.02, -0.62],
    [0.4, -0.46],
  ]) {
    g.beginPath();
    g.ellipse(sx * r, sy * r, r * 0.07, r * 0.045, 0, 0, Math.PI * 2);
    g.fill();
  }
  g.restore();
}

/* ------------------------------------------------------------------ */
/* printed panels (matching reference layout)                          */
/* ------------------------------------------------------------------ */

export function marqueeTexture() {
  return printedTexture(1280, 384, (g) => {
    const bg = g.createLinearGradient(0, 0, 1280, 384);
    bg.addColorStop(0, '#bfe8fb');
    bg.addColorStop(0.16, '#e6f8ff');
    bg.addColorStop(0.4, '#fff3fa');
    bg.addColorStop(0.68, '#ffe8f6');
    bg.addColorStop(1, '#d7f2ff');
    g.fillStyle = bg;
    g.fillRect(0, 0, 1280, 384);

    // clean warm pastel-pink-white inner panel with cyan-white neon edges
    const inner = g.createRadialGradient(640, 180, 40, 640, 192, 660);
    inner.addColorStop(0, '#fff6fc');
    inner.addColorStop(0.5, '#ffeaf7');
    inner.addColorStop(0.82, '#e4f7ff');
    inner.addColorStop(1, '#c2ecfc');
    g.fillStyle = inner;
    roundRect(g, 22, 22, 1236, 340, 28);
    g.fill();

    // soft magenta glow towards both side ears
    const sideGlow = g.createLinearGradient(0, 0, 1280, 0);
    sideGlow.addColorStop(0, 'rgba(244, 120, 190, 0.5)');
    sideGlow.addColorStop(0.22, 'rgba(255, 200, 235, 0.14)');
    sideGlow.addColorStop(0.5, 'rgba(255,255,255,0)');
    sideGlow.addColorStop(0.78, 'rgba(255, 200, 235, 0.14)');
    sideGlow.addColorStop(1, 'rgba(244, 120, 190, 0.5)');
    g.fillStyle = sideGlow;
    g.fillRect(0, 0, 1280, 384);

    const hot = g.createRadialGradient(640, 192, 30, 640, 192, 520);
    hot.addColorStop(0, 'rgba(255,255,255,0.6)');
    hot.addColorStop(0.55, 'rgba(255,255,255,0.12)');
    hot.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = hot;
    g.fillRect(0, 0, 1280, 384);

    // thick cyan neon tube border (wide outer glow + white-hot core)
    g.save();
    g.shadowColor = 'rgba(96, 232, 255, 1)';
    g.shadowBlur = 44;
    g.strokeStyle = '#7fe6ff';
    g.lineWidth = 22;
    roundRect(g, 20, 20, 1240, 344, 28);
    g.stroke();
    g.shadowBlur = 24;
    g.strokeStyle = '#c8f9ff';
    g.lineWidth = 14;
    roundRect(g, 20, 20, 1240, 344, 28);
    g.stroke();
    g.shadowBlur = 10;
    g.strokeStyle = 'rgba(255,255,255,0.99)';
    g.lineWidth = 6;
    roundRect(g, 20, 20, 1240, 344, 28);
    g.stroke();
    g.restore();

    g.strokeStyle = 'rgba(255,255,255,0.35)';
    g.lineWidth = 2;
    roundRect(g, 34, 34, 1212, 316, 22);
    g.stroke();

    drawSparkle(g, 68, 330, 14, 'rgba(255,255,255,0.9)');
    drawSparkle(g, 1214, 326, 15, 'rgba(255,255,255,0.9)');
    drawSparkle(g, 300, 52, 12, 'rgba(255,255,255,0.8)');
    drawSparkle(g, 950, 56, 12, 'rgba(255,255,255,0.8)');

    const headline = 'UFO PORTFOLIO';
    const size = fitFont(g, headline, 1010, 132, 900, ROUND);
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.lineJoin = 'round';
    g.font = `900 ${size}px ${ROUND}`;

    // soft magenta halo
    g.save();
    g.shadowColor = 'rgba(232, 51, 143, 0.9)';
    g.shadowBlur = 40;
    g.fillStyle = 'rgba(255, 100, 180, 0.75)';
    g.fillText(headline, 640, 201);
    g.restore();

    // thick magenta + hot pink outline with a pale inner line
    g.strokeStyle = '#e8338f';
    g.lineWidth = 42;
    g.strokeText(headline, 640, 201);
    g.strokeStyle = '#ff63a8';
    g.lineWidth = 27;
    g.strokeText(headline, 640, 201);
    g.strokeStyle = '#ffd7ec';
    g.lineWidth = 9;
    g.strokeText(headline, 640, 201);
    g.fillStyle = '#ffffff';
    g.fillText(headline, 640, 201);

    // top-left purple UFO saucer with green alien
    drawUfo(g, 112, 66, 0.82, false);

    // bottom-left green/pink kana pill
    g.save();
    g.translate(176, 318);
    g.rotate(-0.09);
    g.shadowColor = 'rgba(80, 18, 52, 0.3)';
    g.shadowBlur = 10;
    g.shadowOffsetY = 5;
    g.fillStyle = '#ff8fc4';
    roundRect(g, -124, -28, 248, 56, 28);
    g.fill();
    g.shadowColor = 'transparent';
    g.strokeStyle = '#43c46e';
    g.lineWidth = 9;
    roundRect(g, -124, -28, 248, 56, 28);
    g.stroke();
    g.strokeStyle = '#ffffff';
    g.lineWidth = 4;
    roundRect(g, -115, -19, 230, 38, 19);
    g.stroke();
    g.fillStyle = '#ffffff';
    g.font = `900 30px ${JP}`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText('たんけんちゅう', 0, 2);
    g.restore();

    // bottom-right pink kitty head
    drawCat(g, 1146, 304, 0.92, true);

    return;
  });
}

export function headerTexture() {
  return printedTexture(1600, 200, (g) => {
    const bg = g.createLinearGradient(0, 0, 0, 200);
    bg.addColorStop(0, '#135ca3');
    bg.addColorStop(0.45, '#1f79bd');
    bg.addColorStop(1, '#2b8dca');
    g.fillStyle = bg;
    g.fillRect(0, 0, 1600, 200);

    g.save();
    g.globalAlpha = 0.09;
    g.fillStyle = '#ffffff';
    for (let i = -200; i < 1600; i += 88) {
      g.beginPath();
      g.moveTo(i, 0);
      g.lineTo(i + 36, 0);
      g.lineTo(i - 100, 200);
      g.lineTo(i - 136, 200);
      g.fill();
    }
    g.restore();

    // glossy top + shadow bottom edges of the blue band
    const sheen = g.createLinearGradient(0, 0, 0, 60);
    sheen.addColorStop(0, 'rgba(255,255,255,0.18)');
    sheen.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = sheen;
    g.fillRect(0, 0, 1600, 62);
    g.fillStyle = 'rgba(216,243,255,0.55)';
    g.fillRect(0, 0, 1600, 5);
    g.fillStyle = '#1a4f86';
    g.fillRect(0, 192, 1600, 8);

    // left cluster: blue face, pink face, tiny burger mascot
    drawKawaiiFace(g, 100, 106, 42, '#8fd4ff', '#2c69b6');
    drawKawaiiFace(g, 182, 72, 34, '#ff9fcb', '#b83a76');
    drawTinyBurger(g, 191, 144, 26);

    // centre katakana with dark-blue + white double outline
    const word = 'クレーンゲーム';
    const size = fitFont(g, word, 900, 134, 900);
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.lineJoin = 'round';
    g.font = `900 ${size}px ${JP}`;

    g.fillStyle = 'rgba(8, 28, 70, 0.5)';
    g.fillText(word, 806, 110);
    g.strokeStyle = '#123772';
    g.lineWidth = 30;
    g.strokeText(word, 800, 102);
    g.strokeStyle = '#ffffff';
    g.lineWidth = 17;
    g.strokeText(word, 800, 102);
    g.fillStyle = '#e8338f';
    g.fillText(word, 800, 102);

    // right tilted yellow/black WARNING sticker (3 subtext lines)
    g.save();
    g.translate(1424, 98);
    g.rotate(-0.08);
    g.shadowColor = 'rgba(10, 25, 70, 0.38)';
    g.shadowBlur = 9;
    g.shadowOffsetY = 4;
    g.fillStyle = '#ffd228';
    roundRect(g, -126, -58, 252, 116, 8);
    g.fill();
    g.shadowColor = 'transparent';
    g.strokeStyle = '#1a1620';
    g.lineWidth = 6;
    roundRect(g, -122, -54, 244, 108, 6);
    g.stroke();
    g.fillStyle = '#1a1620';
    g.textAlign = 'left';
    g.font = `900 31px ${ROUND}`;
    g.fillText('WARNING', -62, -20);
    g.font = `700 11.5px ${ROUND}`;
    g.fillText('CAUTION: MOVING PARTS', -100, 10);
    g.fillText('KEEP HANDS CLEAR', -100, 27);
    g.fillText('INSERT COIN TO PLAY', -100, 44);
    g.beginPath();
    g.moveTo(-90, -36);
    g.lineTo(-74, -8);
    g.lineTo(-106, -8);
    g.closePath();
    g.fill();
    g.fillStyle = '#ffd228';
    g.font = `900 19px ${ROUND}`;
    g.textAlign = 'center';
    g.fillText('!', -90, -14);
    g.restore();
  });
}

export function bodyTexture() {
  return printedTexture(1024, 512, (g) => {
    const bg = g.createLinearGradient(0, 0, 0, 512);
    bg.addColorStop(0, '#ffffff');
    bg.addColorStop(0.72, '#fcf9fb');
    bg.addColorStop(1, '#f3f4f7');
    g.fillStyle = bg;
    roundRect(g, 4, 4, 1016, 504, 24);
    g.fill();

    g.strokeStyle = 'rgba(229, 109, 166, 0.35)';
    g.lineWidth = 4;
    roundRect(g, 10, 10, 1004, 492, 20);
    g.stroke();

    // Bottom-left: striped cyan/yellow sun disc, purple UFO + rainbow beam
    g.save();
    const sunX = 116;
    const sunY = 340;
    const sunR = 104;
    g.shadowColor = 'rgba(80, 30, 70, 0.18)';
    g.shadowBlur = 14;
    g.shadowOffsetY = 5;
    g.fillStyle = '#fffdfd';
    g.beginPath();
    g.arc(sunX, sunY, sunR + 9, 0, Math.PI * 2);
    g.fill();
    g.shadowColor = 'transparent';
    for (let i = 0; i < 24; i++) {
      const a0 = (i / 24) * Math.PI * 2;
      const a1 = ((i + 1) / 24) * Math.PI * 2;
      g.fillStyle = i % 2 === 0 ? '#73d4ff' : '#ffd228';
      g.beginPath();
      g.moveTo(sunX, sunY);
      g.arc(sunX, sunY, sunR, a0, a1);
      g.closePath();
      g.fill();
    }
    g.fillStyle = '#bdeeff';
    g.beginPath();
    g.arc(sunX, sunY, sunR * 0.62, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = '#ffffff';
    g.lineWidth = 6;
    g.stroke();
    drawUfo(g, sunX, sunY - 22, 1.04, true);
    g.restore();

    // small pink flower sticker in a white square
    g.save();
    g.translate(252, 220);
    g.rotate(-0.06);
    g.shadowColor = 'rgba(80, 25, 60, 0.18)';
    g.shadowBlur = 11;
    g.shadowOffsetY = 5;
    g.fillStyle = '#ffffff';
    g.strokeStyle = '#e46aa6';
    g.lineWidth = 5;
    roundRect(g, -52, -43, 104, 86, 20);
    g.fill();
    g.stroke();
    g.shadowColor = 'transparent';
    g.fillStyle = '#ff9fcf';
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      g.beginPath();
      g.ellipse(Math.cos(a) * 19, Math.sin(a) * 19, 14, 10, a, 0, Math.PI * 2);
      g.fill();
    }
    g.fillStyle = '#ffe36b';
    g.beginPath();
    g.arc(0, 0, 11, 0, Math.PI * 2);
    g.fill();
    g.restore();

    // bold 2-line katakana with white + blue double outline
    g.textAlign = 'left';
    g.textBaseline = 'middle';
    g.lineJoin = 'round';
    const lines = ['クレーンゲーム', 'ポートフォリオ'];
    lines.forEach((word, i) => {
      const size = i === 0 ? 70 : 64;
      g.font = `900 ${size}px ${JP}`;
      const y = 334 + i * 86;
      const x = 196;
      g.fillStyle = 'rgba(53, 148, 232, 0.4)';
      g.fillText(word, x + 5, y + 7);
      g.strokeStyle = '#2268b8';
      g.lineWidth = 20;
      g.strokeText(word, x, y);
      g.strokeStyle = '#ffffff';
      g.lineWidth = 12;
      g.strokeText(word, x, y);
      g.fillStyle = '#e8338f';
      g.fillText(word, x, y);
    });

    // Bottom-right cluster: pink cat, yellow/blue UFO round seal, red/white WARNING
    drawCat(g, 742, 304, 0.96, true);

    g.save();
    g.translate(904, 240);
    g.shadowColor = 'rgba(40, 30, 70, 0.2)';
    g.shadowBlur = 12;
    g.shadowOffsetY = 5;
    g.fillStyle = '#ffd228';
    g.beginPath();
    g.arc(0, 0, 72, 0, Math.PI * 2);
    g.fill();
    g.shadowColor = 'transparent';
    g.strokeStyle = '#ffffff';
    g.lineWidth = 6;
    g.stroke();
    g.fillStyle = '#5bb8f2';
    g.beginPath();
    g.arc(0, 0, 50, 0, Math.PI * 2);
    g.fill();
    drawUfo(g, 0, -2, 0.56, false);
    g.fillStyle = '#3a2266';
    g.font = `900 14px ${ROUND}`;
    g.textAlign = 'center';
    g.fillText('UFO CATCHER', 0, -56);
    g.fillText('PORTFOLIO', 0, 59);
    g.restore();

    g.save();
    g.translate(868, 440);
    g.rotate(-0.07);
    g.shadowColor = 'rgba(40, 10, 20, 0.22)';
    g.shadowBlur = 10;
    g.shadowOffsetY = 4;
    g.fillStyle = '#ffffff';
    roundRect(g, -126, -56, 252, 112, 11);
    g.fill();
    g.shadowColor = 'transparent';
    g.strokeStyle = '#e8262b';
    g.lineWidth = 7;
    roundRect(g, -121, -51, 242, 102, 9);
    g.stroke();
    g.fillStyle = '#e8262b';
    roundRect(g, -110, -42, 220, 38, 5);
    g.fill();
    g.fillStyle = '#ffffff';
    g.font = `900 23px ${ROUND}`;
    g.textAlign = 'center';
    g.fillText('▲ WARNING', 0, -19);
    g.fillStyle = '#2b1e24';
    g.font = `700 12px ${ROUND}`;
    g.fillText('DO NOT TILT OR SHAKE', 0, 17);
    g.fillText('INSERT COIN TO PLAY', 0, 38);
    g.restore();
  });
}

export function deckTexture() {
  return printedTexture(1024, 341, (g) => {
    const bg = g.createLinearGradient(0, 0, 0, 341);
    bg.addColorStop(0, '#8ad4ff');
    bg.addColorStop(0.45, '#68bff2');
    bg.addColorStop(1, '#48a3e3');
    g.fillStyle = bg;
    g.fillRect(0, 0, 1024, 341);

    const sheen = g.createRadialGradient(380, 70, 20, 380, 70, 520);
    sheen.addColorStop(0, 'rgba(255,255,255,0.32)');
    sheen.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = sheen;
    g.fillRect(0, 0, 1024, 341);

    g.strokeStyle = 'rgba(255,255,255,0.8)';
    g.lineWidth = 4;
    roundRect(g, 14, 14, 996, 313, 22);
    g.stroke();

    // three pink arrows: left, right, down (front of joystick)
    const arrow = (x: number, y: number, dir: 'left' | 'right' | 'up' | 'down') => {
      g.save();
      g.translate(x, y);
      g.scale(1.3, 1.3);
      if (dir === 'left') g.rotate(-Math.PI / 2);
      if (dir === 'right') g.rotate(Math.PI / 2);
      if (dir === 'down') g.rotate(Math.PI);
      g.shadowColor = 'rgba(15, 40, 90, 0.3)';
      g.shadowBlur = 6;
      g.shadowOffsetY = 3;
      g.beginPath();
      g.moveTo(0, -30);
      g.lineTo(24, -6);
      g.lineTo(10, -6);
      g.lineTo(10, 24);
      g.lineTo(-10, 24);
      g.lineTo(-10, -6);
      g.lineTo(-24, -6);
      g.closePath();
      g.strokeStyle = '#ffffff';
      g.lineWidth = 8;
      g.lineJoin = 'round';
      g.stroke();
      g.shadowColor = 'transparent';
      g.fillStyle = '#f04db0';
      g.fill();
      g.restore();
    };

    arrow(68, 190, 'left');
    arrow(316, 190, 'right');
    arrow(194, 298, 'down');

    // PLAY / スタート directly below the yellow button on the right
    g.fillStyle = 'rgba(12, 40, 96, 0.45)';
    g.font = `900 32px ${ROUND}`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText('PLAY / スタート', 762, 292);
    g.fillStyle = '#ffffff';
    g.fillText('PLAY / スタート', 760, 289);

    // yellow smiley top-left of the deck
    g.save();
    g.translate(70, 132);
    g.rotate(-0.1);
    g.fillStyle = '#ffd228';
    g.beginPath();
    g.arc(0, 0, 24, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = '#ffffff';
    g.lineWidth = 4;
    g.stroke();
    g.fillStyle = '#1a1620';
    g.beginPath();
    g.arc(-9, -5, 3.2, 0, Math.PI * 2);
    g.arc(9, -5, 3.2, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = '#1a1620';
    g.lineWidth = 3.2;
    g.lineCap = 'round';
    g.beginPath();
    g.arc(0, 2, 12, 0.15 * Math.PI, 0.85 * Math.PI);
    g.stroke();
    g.restore();

    // small round purple/pink badge on the top-right of the deck behind the button
    g.save();
    g.translate(982, 150);
    g.fillStyle = '#c79bff';
    g.beginPath();
    g.arc(0, 0, 22, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = '#ff8fc8';
    g.lineWidth = 4;
    g.stroke();
    g.fillStyle = '#3a2266';
    g.beginPath();
    g.arc(-6, -3, 2.6, 0, Math.PI * 2);
    g.arc(6, -3, 2.6, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = '#3a2266';
    g.lineWidth = 2.6;
    g.lineCap = 'round';
    g.beginPath();
    g.arc(0, 3, 8, 0.15 * Math.PI, 0.85 * Math.PI);
    g.stroke();
    g.restore();
  });
}

function sideDecalTexture() {
  return printedTexture(128, 460, (g) => {
    const chars = 'ポートフォリオ';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.lineJoin = 'round';
    g.font = `900 48px ${JP}`;
    for (let i = 0; i < chars.length; i++) {
      const y = 52 + i * 58;
      g.fillStyle = 'rgba(120, 20, 70, 0.35)';
      g.fillText(chars[i], 67, y + 3);
      g.strokeStyle = '#ffffff';
      g.lineWidth = 11;
      g.strokeText(chars[i], 64, y);
      g.fillStyle = '#e8338f';
      g.fillText(chars[i], 64, y);
    }
  });
}

/** purple/white ポートフォリオ pill that sits proud of the marquee bezel */
function cornerStickerTexture() {
  return printedTexture(512, 112, (g) => {
    g.save();
    g.translate(256, 56);
    g.shadowColor = 'rgba(50, 18, 80, 0.3)';
    g.shadowBlur = 12;
    g.shadowOffsetY = 5;
    g.fillStyle = '#ffffff';
    roundRect(g, -246, -46, 492, 92, 46);
    g.fill();
    g.shadowColor = 'transparent';
    g.strokeStyle = '#8b63e6';
    g.lineWidth = 12;
    roundRect(g, -238, -38, 476, 76, 38);
    g.stroke();
    g.fillStyle = '#8b63e6';
    g.font = `900 52px ${JP}`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText('ポートフォリオ', 0, 2);
    g.restore();
  });
}

/** crisp yellow/black WARNING plate mounted on the frame above the button */
function warningPlateTexture() {
  return printedTexture(512, 200, (g) => {
    g.save();
    g.translate(256, 100);
    g.fillStyle = '#ffd228';
    roundRect(g, -246, -88, 492, 176, 12);
    g.fill();
    g.strokeStyle = '#1a1620';
    g.lineWidth = 12;
    roundRect(g, -238, -80, 476, 160, 9);
    g.stroke();

    g.fillStyle = '#1a1620';
    g.beginPath();
    g.moveTo(-164, -62);
    g.lineTo(-128, 2);
    g.lineTo(-200, 2);
    g.closePath();
    g.fill();
    g.fillStyle = '#ffd228';
    g.font = `900 44px ${ROUND}`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText('!', -164, -16);

    g.fillStyle = '#1a1620';
    g.textAlign = 'left';
    g.font = `900 60px ${ROUND}`;
    g.fillText('WARNING', -106, -34);
    g.font = `700 20px ${ROUND}`;
    g.fillText('CAUTION / 注意', -108, 14);
    g.fillText('MOVING PARTS', -108, 42);
    g.restore();
  });
}

/** cool grey-lavender chamber back wall with architectural depth + ghost reflections */
function chamberBackTexture() {
  return printedTexture(512, 512, (g) => {
    const bg = g.createLinearGradient(0, 0, 0, 512);
    bg.addColorStop(0, '#848a9e');
    bg.addColorStop(0.45, '#7c8296');
    bg.addColorStop(1, '#6d7389');
    g.fillStyle = bg;
    g.fillRect(0, 0, 512, 512);

    // side frame pillars
    g.fillStyle = 'rgba(56, 62, 84, 0.55)';
    g.fillRect(0, 0, 34, 512);
    g.fillRect(478, 0, 34, 512);
    g.fillStyle = 'rgba(214, 224, 242, 0.22)';
    g.fillRect(34, 0, 6, 512);
    g.fillRect(472, 0, 6, 512);
    g.fillStyle = 'rgba(40, 44, 64, 0.28)';
    g.fillRect(34, 0, 2, 512);
    g.fillRect(476, 0, 2, 512);

    // upper structural beam + soft reflection line
    g.fillStyle = 'rgba(56, 62, 84, 0.4)';
    g.fillRect(34, 34, 444, 20);
    const beam = g.createLinearGradient(0, 54, 0, 150);
    beam.addColorStop(0, 'rgba(236, 246, 255, 0.42)');
    beam.addColorStop(0.5, 'rgba(222, 236, 252, 0.16)');
    beam.addColorStop(1, 'rgba(255, 255, 255, 0)');
    g.fillStyle = beam;
    g.fillRect(34, 54, 444, 96);

    // soft vertical light columns behind the neon tubes
    for (const [cx, cw, alpha] of [
      [86, 46, 0.16],
      [166, 34, 0.09],
      [256, 42, 0.08],
      [348, 34, 0.09],
      [428, 46, 0.16],
    ]) {
      const col = g.createLinearGradient(cx - cw / 2, 0, cx + cw / 2, 0);
      col.addColorStop(0, 'rgba(226, 240, 255, 0)');
      col.addColorStop(0.5, `rgba(226, 240, 255, ${alpha})`);
      col.addColorStop(1, 'rgba(226, 240, 255, 0)');
      g.fillStyle = col;
      g.fillRect(cx - cw / 2, 40, cw, 472);
    }

    // subtle vertical lighting falloff
    const fall = g.createLinearGradient(0, 0, 0, 512);
    fall.addColorStop(0, 'rgba(255,255,255,0.09)');
    fall.addColorStop(0.5, 'rgba(255,255,255,0)');
    fall.addColorStop(1, 'rgba(34, 38, 58, 0.28)');
    g.fillStyle = fall;
    g.fillRect(0, 0, 512, 512);

    // ghost reflection of the claw hanging from the top
    g.save();
    g.globalAlpha = 0.11;
    g.strokeStyle = '#eef3ff';
    g.lineWidth = 3;
    g.lineCap = 'round';
    g.beginPath();
    g.moveTo(256, 40);
    g.lineTo(256, 108);
    g.stroke();
    g.lineWidth = 4;
    g.beginPath();
    g.moveTo(256, 108);
    g.lineTo(232, 156);
    g.lineTo(218, 208);
    g.stroke();
    g.beginPath();
    g.moveTo(256, 108);
    g.lineTo(280, 156);
    g.lineTo(294, 208);
    g.stroke();
    g.beginPath();
    g.moveTo(256, 108);
    g.lineTo(256, 160);
    g.lineTo(252, 212);
    g.stroke();
    g.restore();

    // faint ghostly capsule reflections near the floor
    g.save();
    g.globalAlpha = 0.08;
    g.fillStyle = '#e5ebf8';
    for (const [x, y, s] of [
      [110, 400, 1.0],
      [398, 350, 0.8],
      [232, 452, 1.15],
      [316, 430, 0.9],
    ]) {
      for (const [dx, dy, r] of [
        [-34, 6, 25],
        [-6, -8, 33],
        [28, 2, 27],
        [52, 11, 18],
      ]) {
        g.beginPath();
        g.ellipse(x + dx * s, y + dy * s, r * s, r * 0.62 * s, 0, 0, Math.PI * 2);
        g.fill();
      }
    }
    g.restore();

    // very soft cyan bloom at both inner edges (neon tubes sit in front)
    const edge = g.createLinearGradient(0, 0, 70, 0);
    edge.addColorStop(0, 'rgba(200, 248, 255, 0.28)');
    edge.addColorStop(1, 'rgba(200, 248, 255, 0)');
    g.fillStyle = edge;
    g.fillRect(34, 54, 70, 458);
    g.save();
    g.translate(512, 0);
    g.scale(-1, 1);
    g.fillStyle = edge;
    g.fillRect(34, 54, 70, 458);
    g.restore();
  });
}

function streakTexture() {
  return printedTexture(256, 32, (g) => {
    const lg = g.createLinearGradient(0, 0, 256, 0);
    lg.addColorStop(0, 'rgba(255,255,255,0)');
    lg.addColorStop(0.42, 'rgba(255,255,255,0.72)');
    lg.addColorStop(0.62, 'rgba(255,255,255,0.34)');
    lg.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = lg;
    g.fillRect(0, 0, 256, 32);
  });
}

/* ------------------------------------------------------------------ */
/* materials & geometry helpers                                        */
/* ------------------------------------------------------------------ */

export function glassMaterial() {
  return new THREE.MeshStandardMaterial({
    color: '#eef8ff',
    metalness: 0.05,
    roughness: 0.05,
    transparent: true,
    opacity: 0.06,
    side: THREE.DoubleSide,
    depthWrite: false,
    envMapIntensity: 1.3,
  }) as unknown as THREE.MeshPhysicalMaterial;
}

const rbox = (w: number, h: number, d: number, r = 0.01) =>
  new RoundedBoxGeometry(
    w,
    h,
    d,
    2,
    Math.max(0.0015, Math.min(r, w / 2 - 0.001, h / 2 - 0.001, d / 2 - 0.001))
  );

function add(
  parent: THREE.Object3D,
  geo: THREE.BufferGeometry,
  mat: THREE.Material,
  x = 0,
  y = 0,
  z = 0,
  cast = false,
  receive = false
) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.castShadow = cast;
  m.receiveShadow = receive;
  parent.add(m);
  return m;
}

function label(
  parent: THREE.Object3D,
  atlas: THREE.Texture,
  rects: Record<string, UvRect>,
  name: string,
  w: number,
  h: number,
  x: number,
  y: number,
  z: number,
  rotY = 0,
  rotZ = 0
) {
  const rect = rects[name];
  if (!rect) return null;
  const aspect = rect.w / rect.h;
  let dw = w;
  let dh = h;
  if (Math.abs(w / h - aspect) / aspect > 0.01) {
    if (w / h > aspect) dw = h * aspect;
    else dh = w / aspect;
  }
  const m = decalMesh(atlas, rect, dw, dh, { opacity: 0.98, gloss: true });
  m.position.set(x, y, z);
  m.rotation.set(0, rotY, rotZ);
  parent.add(m);
  return m;
}

/* ------------------------------------------------------------------ */
/* cabinet                                                             */
/* ------------------------------------------------------------------ */

export function buildCabinet(atlas: THREE.Texture, rects: Record<string, UvRect>) {
  const root = new THREE.Group();

  const pink = candy(REF.framePink);
  const pinkDeep = candy(REF.framePinkShade, { roughness: 0.24 });
  const pinkInk = candy(CAB.pinkInk, { roughness: 0.26 });
  const azure = candy(REF.sidePostBlue, { roughness: 0.18 });
  const azureMid = candy('#49a9e8', { roughness: 0.22 });
  const azureDeep = candy(REF.bandBlue, { roughness: 0.26 });
  const azurePale = candy(REF.glassTint, { roughness: 0.36 });
  const deckBlue = candy(REF.panelBlue, { roughness: 0.16 });
  const porcelain = candy(REF.bottomWhite, { roughness: 0.26 });
  const rub = rubber();
  const chromeMat = chrome();
  const glass = glassMaterial();
  const ink = matte(REF.ink);

  /* ---------------- feet + lower body ---------------- */

  for (const [x, z] of [
    [-0.42, 0.28],
    [0.42, 0.28],
    [-0.42, -0.28],
    [0.42, -0.28],
  ]) {
    add(root, new THREE.CylinderGeometry(0.066, 0.072, 0.036, 20), rub, x, 0.018, z, true, false);
    add(root, new THREE.CylinderGeometry(0.058, 0.062, 0.01, 20), ink, x, 0.004, z, false, false);
  }

  // dark under-chassis plate closes the bright gap between the feet
  add(root, rbox(0.96, 0.018, 0.72, 0.008), ink, 0, 0.032, 0, false, false);

  add(root, rbox(1.02, 0.56, 0.78, 0.048), pink, 0, 0.322, 0, true, false);
  add(root, rbox(1.036, 0.048, 0.794, 0.018), pinkDeep, 0, 0.072, 0, false, false);

  add(root, rbox(0.92, 0.45, 0.02, 0.024), porcelain, 0, 0.365, 0.386, false, false);
  add(
    root,
    new THREE.PlaneGeometry(0.9, 0.435),
    printed(bodyTexture(), { roughness: 0.3 }),
    0,
    0.365,
    0.3975,
    false,
    false
  );

  add(root, rbox(0.95, 0.026, 0.018, 0.008), pinkDeep, 0, 0.594, 0.394, false, false);
  add(root, rbox(0.95, 0.026, 0.018, 0.008), pinkDeep, 0, 0.136, 0.394, false, false);
  add(root, rbox(0.026, 0.48, 0.018, 0.008), pinkDeep, -0.468, 0.365, 0.394, false, false);
  add(root, rbox(0.026, 0.48, 0.018, 0.008), pinkDeep, 0.468, 0.365, 0.394, false, false);

  /* ---------------- riser + control deck ---------------- */

  add(root, rbox(1.0, 0.024, 0.04, 0.008), pink, 0, 0.718, 0.388, false, false);

  const deck = new THREE.Group();
  deck.position.set(0, 0.585, 0.45);
  deck.rotation.x = 0.21;
  root.add(deck);

  add(deck, rbox(1.0, 0.068, 0.39, 0.028), deckBlue, 0, 0, 0, true, false);
  add(deck, rbox(1.036, 0.036, 0.376, 0.014), pinkDeep, 0, -0.042, 0, true, false);
  add(deck, rbox(1.044, 0.012, 0.384, 0.005), pinkInk, 0, -0.064, 0, false, false);

  const deckPrint = add(
    deck,
    new THREE.PlaneGeometry(0.965, 0.365),
    printed(deckTexture(), { roughness: 0.28 }),
    0,
    0.035,
    0,
    false,
    false
  );
  deckPrint.rotation.x = -Math.PI / 2;

  const joyX = -0.27;
  const joyZ = 0.02;
  // flat, sleek black dust washer under the shaft
  add(deck, new THREE.CylinderGeometry(0.066, 0.068, 0.007, 28), ink, joyX, 0.039, joyZ, false, false);

  const stick = new THREE.Group();
  stick.position.set(joyX, 0.044, joyZ);
  stick.userData.noMerge = true;
  deck.add(stick);

  const rodMat = new THREE.MeshStandardMaterial({
    color: '#eef3f8',
    metalness: 0.78,
    roughness: 0.16,
    envMapIntensity: 1.4,
  });
  const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.007, 0.009, 0.09, 12), rodMat);
  rod.position.y = 0.046;
  stick.add(rod);

  const ballMat = candy('#d6151f', { roughness: 0.08, metalness: 0.04, envMapIntensity: 1.45 });
  const ball = new THREE.Mesh(new THREE.SphereGeometry(0.037, 24, 18), ballMat);
  ball.position.y = 0.105;
  stick.add(ball);
  const ballHighlight = new THREE.Mesh(
    new THREE.SphereGeometry(0.011, 10, 8),
    new THREE.MeshBasicMaterial({ color: '#fff4f4', transparent: true, opacity: 0.62 })
  );
  ballHighlight.position.set(-0.012, 0.127, 0.03);
  ballHighlight.scale.set(1, 0.72, 0.55);
  ballHighlight.userData.noMerge = true;
  stick.add(ballHighlight);

  const btnX = 0.255;
  const btnZ = -0.01;
  // low, sleek matte-black bezel ring around the illuminated yellow dome
  add(deck, new THREE.CylinderGeometry(0.092, 0.098, 0.015, 32), ink, btnX, 0.0415, btnZ, false, false);
  add(deck, new THREE.TorusGeometry(0.088, 0.012, 8, 36), ink, btnX, 0.05, btnZ, false, false).rotation.x =
    Math.PI / 2;
  add(deck, new THREE.TorusGeometry(0.078, 0.0045, 6, 32), chromeMat, btnX, 0.054, btnZ, false, false).rotation.x =
    Math.PI / 2;
  const btnGlowRing = add(
    deck,
    new THREE.TorusGeometry(0.072, 0.0045, 6, 32),
    glow('#fff5b8', 1.15),
    btnX,
    0.054,
    btnZ,
    false,
    false
  );
  btnGlowRing.rotation.x = Math.PI / 2;

  const capMat = new THREE.MeshStandardMaterial({
    color: '#ffe055',
    emissive: new THREE.Color('#ffd230'),
    emissiveIntensity: 0.95,
    roughness: 0.12,
    metalness: 0.02,
    envMapIntensity: 1.3,
  });
  const capGroup = new THREE.Group();
  capGroup.position.set(btnX, 0.046, btnZ);
  capGroup.userData.noMerge = true;
  deck.add(capGroup);

  const capSide = new THREE.Mesh(new THREE.CylinderGeometry(0.068, 0.072, 0.02, 32), capMat);
  capSide.position.y = 0.008;
  capGroup.add(capSide);
  const capTop = new THREE.Mesh(new THREE.SphereGeometry(0.07, 24, 14), capMat);
  capTop.scale.set(1, 0.32, 1);
  capTop.position.y = 0.018;
  capGroup.add(capTop);

  // bright illuminated-plastic highlight core on top of the dome
  const capHot = new THREE.Mesh(
    new THREE.SphereGeometry(0.034, 18, 10),
    new THREE.MeshBasicMaterial({ color: '#fffbe0', transparent: true, opacity: 0.62, toneMapped: false })
  );
  capHot.scale.set(1, 0.24, 0.82);
  capHot.position.set(-0.012, 0.0405, 0.012);
  capHot.userData.noMerge = true;
  capGroup.add(capHot);

  const buttonHit = new THREE.Mesh(
    new THREE.BoxGeometry(0.26, 0.18, 0.26),
    new THREE.MeshBasicMaterial({ visible: false })
  );
  buttonHit.position.set(btnX, 0.085, btnZ);
  deck.add(buttonHit);

  /* ---------------- play chamber ---------------- */

  add(root, rbox(0.99, 0.028, 0.74, 0.012), azureMid, 0, 0.706, 0, false, true);

  add(root, new THREE.PlaneGeometry(0.2, 0.2), new THREE.MeshBasicMaterial({ color: '#142644' }), -0.31, 0.721, 0).rotation.x =
    -Math.PI / 2;
  for (const [w, d, x, z] of [
    [0.218, 0.009, -0.31, 0.1045],
    [0.218, 0.009, -0.31, -0.1045],
    [0.009, 0.2, -0.4145, 0],
    [0.009, 0.2, -0.2055, 0],
  ]) {
    add(root, rbox(w, 0.005, d, 0.002), chromeMat, x, 0.723, z);
  }

  // clear acrylic prize chute box: four glossy transparent divider walls with
  // bright white top edges and chrome corner trim
  const acrylic = new THREE.MeshStandardMaterial({
    color: '#dff4ff',
    metalness: 0.02,
    roughness: 0.045,
    transparent: true,
    opacity: 0.24,
    side: THREE.DoubleSide,
    depthWrite: false,
    envMapIntensity: 1.55,
  });
  const acrylicEdge = new THREE.MeshBasicMaterial({ color: '#f4fdff', toneMapped: false });
  const chuteCx = -0.31;
  const chuteCz = 0;
  const chuteHalf = 0.11;
  const chuteH = 0.19;
  const chuteBase = 0.723;
  const chuteTop = chuteBase + chuteH;
  const chuteCY = chuteBase + chuteH / 2;

  const chuteWalls: [number, number, number, number, number][] = [
    // width, height, x, z, rotY
    [chuteHalf * 2, chuteH, chuteCx, chuteCz - chuteHalf, 0],
    [chuteHalf * 2, chuteH, chuteCx, chuteCz + chuteHalf, 0],
    [chuteHalf * 2, chuteH, chuteCx - chuteHalf, chuteCz, Math.PI / 2],
    [chuteHalf * 2, chuteH, chuteCx + chuteHalf, chuteCz, Math.PI / 2],
  ];
  for (const [w, h, x, z, rotY] of chuteWalls) {
    const wall = add(root, new THREE.PlaneGeometry(w, h), acrylic, x, chuteCY, z);
    wall.rotation.y = rotY;
    wall.renderOrder = 3;
  }

  // top edge highlights
  for (const [w, d, x, z] of [
    [chuteHalf * 2 + 0.006, 0.008, chuteCx, chuteCz - chuteHalf],
    [chuteHalf * 2 + 0.006, 0.008, chuteCx, chuteCz + chuteHalf],
    [0.008, chuteHalf * 2 + 0.006, chuteCx - chuteHalf, chuteCz],
    [0.008, chuteHalf * 2 + 0.006, chuteCx + chuteHalf, chuteCz],
  ]) {
    add(root, rbox(w, 0.007, d, 0.002), acrylicEdge, x, chuteTop, z);
  }
  // chrome corner posts
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      add(
        root,
        rbox(0.008, chuteH + 0.006, 0.008, 0.002),
        chromeMat,
        chuteCx + sx * chuteHalf,
        chuteCY,
        chuteCz + sz * chuteHalf,
        false,
        false
      );
    }
  }

  // cool grey-lavender slate back wall with architectural depth
  add(
    root,
    new THREE.PlaneGeometry(0.96, 0.62),
    new THREE.MeshBasicMaterial({ map: chamberBackTexture(), toneMapped: false }),
    0,
    0.99,
    -0.372
  );

  // metallic gantry rail across the top of the chamber
  add(root, rbox(0.9, 0.024, 0.052, 0.008), chromeMat, 0, 1.276, 0.14, true, false);
  add(root, rbox(0.92, 0.012, 0.062, 0.004), matte('#8e95a8'), 0, 1.262, 0.14, false, false);
  add(root, rbox(0.055, 0.034, 0.06, 0.008), chromeMat, -0.43, 1.276, 0.14, false, false);
  add(root, rbox(0.055, 0.034, 0.06, 0.008), chromeMat, 0.43, 1.276, 0.14, false, false);

  add(root, rbox(0.99, 0.018, 0.74, 0.006), azurePale, 0, 1.326, 0);
  add(root, new THREE.PlaneGeometry(0.94, 0.7), new THREE.MeshBasicMaterial({ color: '#e2f6ff' }), 0, 1.316, 0).rotation.x =
    Math.PI / 2;

  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      add(root, rbox(0.076, 0.64, 0.07, 0.02), azure, sx * 0.495, 1.025, sz * 0.35, true, false);
    }
    add(root, rbox(0.076, 0.048, 0.78, 0.014), azureDeep, sx * 0.495, 0.738, 0);
    add(root, rbox(0.076, 0.048, 0.78, 0.014), azureDeep, sx * 0.495, 1.312, 0);
    const sidePane = add(root, new THREE.PlaneGeometry(0.68, 0.575), glass, sx * 0.501, 1.025, 0);
    sidePane.rotation.y = sx * (Math.PI / 2);
    sidePane.renderOrder = 3;
  }

  // Front window frame: bright blue vertical pillars + pink inner glass trim matching photo
  const frameZ = 0.394;
  add(root, rbox(0.92, 0.048, 0.08, 0.018), pink, 0, 1.322, frameZ, true, false);
  add(root, rbox(0.92, 0.048, 0.08, 0.018), pink, 0, 0.734, frameZ);
  add(root, rbox(0.068, 0.64, 0.086, 0.02), azure, -0.486, 1.028, frameZ, true, false);
  add(root, rbox(0.068, 0.64, 0.086, 0.02), azure, 0.486, 1.028, frameZ, true, false);
  add(root, rbox(0.024, 0.57, 0.08, 0.008), pink, -0.444, 1.028, frameZ + 0.002);
  add(root, rbox(0.024, 0.57, 0.08, 0.008), pink, 0.444, 1.028, frameZ + 0.002);

  // vertical cyan/white neon tubes inside the window with soft glow planes
  const neonTubeMat = new THREE.MeshBasicMaterial({ color: '#b7f2f8', toneMapped: false });
  const neonCoreMat = new THREE.MeshBasicMaterial({ color: '#ffffff', toneMapped: false });
  const neonGlowMat = new THREE.MeshBasicMaterial({
    color: '#7fe4f2',
    transparent: true,
    opacity: 0.38,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const neonHaloMat = new THREE.MeshBasicMaterial({
    color: '#dffcff',
    transparent: true,
    opacity: 0.55,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  for (const sx of [-1, 1]) {
    const glow = add(root, new THREE.PlaneGeometry(0.15, 0.6), neonGlowMat, sx * 0.414, 1.025, 0.314);
    glow.renderOrder = 2;
    const halo = add(root, new THREE.PlaneGeometry(0.05, 0.6), neonHaloMat, sx * 0.414, 1.025, 0.318);
    halo.renderOrder = 2;
    add(root, new THREE.CylinderGeometry(0.011, 0.011, 0.58, 12), neonTubeMat, sx * 0.414, 1.025, 0.33);
    add(root, new THREE.CylinderGeometry(0.005, 0.005, 0.58, 8), neonCoreMat, sx * 0.414, 1.025, 0.334);
  }

  // horizontal neon glow just under the blue header
  const topGlow = add(root, new THREE.PlaneGeometry(0.9, 0.085), neonGlowMat, 0, 1.297, 0.31);
  topGlow.renderOrder = 2;
  const topTube = add(root, new THREE.CylinderGeometry(0.007, 0.007, 0.88, 10), neonTubeMat, 0, 1.299, 0.322);
  topTube.rotation.z = Math.PI / 2;
  const topCore = add(root, new THREE.CylinderGeometry(0.0034, 0.0034, 0.88, 8), neonCoreMat, 0, 1.299, 0.326);
  topCore.rotation.z = Math.PI / 2;

  const glassFront = add(root, new THREE.PlaneGeometry(0.88, 0.57), glass, 0, 1.025, 0.401);
  glassFront.renderOrder = 3;

  // soft diagonal white glass reflection streaks
  const streak = streakTexture();
  const streakMat = new THREE.MeshBasicMaterial({
    map: streak,
    transparent: true,
    opacity: 0.06,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const reflection = add(root, new THREE.PlaneGeometry(0.75, 0.14), streakMat, -0.06, 1.15, 0.405);
  reflection.rotation.z = 0.45;
  reflection.renderOrder = 4;

  const reflection2 = add(root, new THREE.PlaneGeometry(0.34, 0.075), streakMat, 0.25, 1.24, 0.406);
  reflection2.rotation.z = 0.42;
  reflection2.renderOrder = 4;

  const reflection3 = add(root, new THREE.PlaneGeometry(0.2, 0.05), streakMat, -0.31, 0.83, 0.406);
  reflection3.rotation.z = 0.5;
  reflection3.renderOrder = 4;

  // yellow WARNING plate mounted on the lower frame above the button
  const warnPlate = add(
    root,
    new THREE.PlaneGeometry(0.15, 0.0586),
    new THREE.MeshBasicMaterial({
      map: warningPlateTexture(),
      transparent: true,
      depthWrite: false,
      toneMapped: false,
    }),
    0.3,
    0.728,
    0.4365
  );
  warnPlate.rotation.z = -0.03;
  warnPlate.renderOrder = 5;

  /* ---------------- blue header band ---------------- */

  add(root, rbox(1.045, 0.12, 0.11, 0.02), azureDeep, 0, 1.397, 0.345, true, false);
  add(
    root,
    new THREE.PlaneGeometry(1.02, 0.108),
    new THREE.MeshBasicMaterial({ map: headerTexture(), toneMapped: false }),
    0,
    1.397,
    0.4015
  );
  add(root, rbox(1.048, 0.01, 0.114, 0.004), azurePale, 0, 1.34, 0.345);

  /* ---------------- marquee (UFO PORTFOLIO) ---------------- */

  add(root, rbox(1.04, 0.34, 0.175, 0.035), pinkDeep, 0, 1.602, 0.295, true, false);
  add(root, rbox(1.0, 0.305, 0.18, 0.028), pink, 0, 1.602, 0.302);
  add(root, rbox(1.05, 0.024, 0.184, 0.008), pinkInk, 0, 1.78, 0.295);

  // rounded pink vertical side ears/caps framing the marquee
  for (const sx of [-1, 1]) {
    add(root, rbox(0.064, 0.34, 0.205, 0.032), pinkDeep, sx * 0.518, 1.598, 0.282, true, false);
    add(root, rbox(0.046, 0.30, 0.19, 0.024), pink, sx * 0.518, 1.598, 0.29);
    add(root, rbox(0.04, 0.026, 0.15, 0.01), pinkInk, sx * 0.518, 1.79, 0.28);
  }
  add(root, rbox(1.06, 0.05, 0.194, 0.02), pink, 0, 1.79, 0.288, true, false);
  add(root, rbox(1.08, 0.018, 0.02, 0.008), pinkInk, 0, 1.806, 0.382);

  const marqueeTex = marqueeTexture();
  add(
    root,
    new THREE.PlaneGeometry(0.95, 0.29),
    backlit(marqueeTex, 0.18),
    0,
    1.602,
    0.3945
  );

  add(root, rbox(0.98, 0.024, 0.014, 0.006), pinkDeep, 0, 1.75, 0.3935);
  add(root, rbox(0.98, 0.022, 0.014, 0.006), pinkDeep, 0, 1.454, 0.3935);
  add(root, rbox(0.024, 0.318, 0.014, 0.006), pinkDeep, -0.478, 1.602, 0.3935);
  add(root, rbox(0.024, 0.318, 0.014, 0.006), pinkDeep, 0.478, 1.602, 0.3935);

  // dimensional cyan neon tubes around the marquee opening
  const marqueeNeon = new THREE.MeshBasicMaterial({ color: '#dffcff', toneMapped: false });
  const marqueeGlow = new THREE.MeshBasicMaterial({
    color: '#b7f2f8',
    transparent: true,
    opacity: 0.3,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  for (const [w, h, x, y] of [
    [0.91, 0.012, 0, 1.737],
    [0.91, 0.012, 0, 1.467],
    [0.012, 0.27, -0.454, 1.602],
    [0.012, 0.27, 0.454, 1.602],
  ] as const) {
    add(root, new THREE.PlaneGeometry(w, h), marqueeGlow, x, y, 0.4015).renderOrder = 4;
    add(root, new THREE.CylinderGeometry(0.0045, 0.0045, w > h ? w : h, 8), marqueeNeon, x, y, 0.404).rotation.z =
      w > h ? Math.PI / 2 : 0;
  }

  // ポートフォリオ sticker fully inside the top-right bezel
  const cornerSticker = add(
    root,
    new THREE.PlaneGeometry(0.25, 0.048),
    new THREE.MeshBasicMaterial({
      map: cornerStickerTexture(),
      transparent: true,
      depthWrite: false,
    }),
    0.385,
    1.748,
    0.412
  );
  cornerSticker.rotation.z = 0.12;
  cornerSticker.renderOrder = 5;

  // vertical ポートフォリオ sticker on the front of the right blue pillar
  const sideTex = sideDecalTexture();
  const frontPillarDecal = add(
    root,
    new THREE.PlaneGeometry(0.068, 0.335),
    new THREE.MeshBasicMaterial({ map: sideTex, transparent: true, depthWrite: false }),
    0.488,
    1.03,
    frameZ + 0.0445
  );
  frontPillarDecal.renderOrder = 4;

  // partial colourful sticker decals on the left blue pillar's outer edge
  label(root, atlas, rects, 'ゲット', 0.056, 0.056, -0.486, 1.19, frameZ + 0.0445, 0, 0.13);
  label(root, atlas, rects, 'プライズ', 0.088, 0.05, -0.486, 0.9, frameZ + 0.0445, 0, -0.08);
  label(root, atlas, rects, 'たんけんちゅう', 0.1, 0.034, -0.53, 1.05, 0.1, -Math.PI / 2, 0.05);

  // side decals from atlas (lightweight)
  label(root, atlas, rects, 'HANDLE WITH CARE', 0.15, 0.052, -0.512, 0.34, 0.05, -Math.PI / 2, 0.01);
  label(root, atlas, rects, 'PRIZE', 0.09, 0.032, 0.512, 0.27, -0.08, Math.PI / 2, -0.015);
  label(root, atlas, rects, 'WARNING', 0.12, 0.042, 0.512, 0.5, -0.16, Math.PI / 2, 0.01);

  /* ---------------- button behaviour ---------------- */

  let press = 0;
  let enabled = true;
  const capBaseY = capGroup.position.y;

  function pressButton() {
    press = 1;
  }

  function setButtonEnabled(on: boolean) {
    enabled = on;
    capMat.emissiveIntensity = on ? 0.92 : 0.1;
    (btnGlowRing.material as THREE.MeshStandardMaterial).emissiveIntensity = on ? 1.15 : 0.15;
  }

  function update(dt: number) {
    if (press > 0) {
      press = Math.max(0, press - dt * 4.5);
      capGroup.position.y = capBaseY - 0.01 * Math.sin((1 - press) * Math.PI);
    }
    const pulse = enabled ? 0.95 + Math.sin(performance.now() * 0.0032) * 0.07 : 0.1;
    capMat.emissiveIntensity = pulse;
  }

  return { root, glass, buttonHit, pressButton, setButtonEnabled, update, stick, capGroup };
}
