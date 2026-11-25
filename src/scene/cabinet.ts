import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { backlit, candy, chrome, glow, matte, printed, rubber } from './materials';
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
    beamGrad.addColorStop(0, 'rgba(130, 252, 255, 0.98)');
    beamGrad.addColorStop(0.28, 'rgba(255, 245, 95, 0.96)');
    beamGrad.addColorStop(0.56, 'rgba(255, 112, 190, 0.88)');
    beamGrad.addColorStop(0.8, 'rgba(145, 125, 255, 0.68)');
    beamGrad.addColorStop(1, 'rgba(115, 245, 255, 0)');
    g.fillStyle = beamGrad;
    g.beginPath();
    g.moveTo(-22, 22);
    g.lineTo(22, 22);
    g.lineTo(64, 120);
    g.lineTo(-64, 120);
    g.closePath();
    g.fill();
  }

  g.fillStyle = '#dcf8ff';
  g.strokeStyle = '#52c0ec';
  g.lineWidth = 4;
  g.beginPath();
  g.ellipse(0, 2, 34, 30, 0, Math.PI, Math.PI * 2);
  g.fill();
  g.stroke();

  g.fillStyle = '#5de06a';
  g.beginPath();
  g.ellipse(0, -4, 13, 15, 0, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = '#18241c';
  for (const sx of [-1, 1]) {
    g.beginPath();
    g.ellipse(sx * 4.6, -6, 2.6, 4, 0, 0, Math.PI * 2);
    g.fill();
  }
  g.strokeStyle = '#5de06a';
  g.lineWidth = 2.4;
  for (const sx of [-1, 1]) {
    g.beginPath();
    g.moveTo(sx * 6, -17);
    g.lineTo(sx * 10, -25);
    g.stroke();
    g.fillStyle = '#ffd214';
    g.beginPath();
    g.arc(sx * 10, -26, 2.8, 0, Math.PI * 2);
    g.fill();
  }

  g.fillStyle = '#9b60ff';
  g.strokeStyle = '#5828c4';
  g.lineWidth = 5;
  g.beginPath();
  g.ellipse(0, 16, 62, 19, 0, 0, Math.PI * 2);
  g.fill();
  g.stroke();
  g.fillStyle = '#c49aff';
  g.beginPath();
  g.ellipse(0, 10, 46, 10, 0, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = '#763ee8';
  g.beginPath();
  g.ellipse(0, 25, 36, 8, 0, 0, Math.PI * 2);
  g.fill();

  const lights = ['#ffd214', '#ff5ea6', '#5cf2ff', '#ffd214', '#72ff9e'];
  lights.forEach((col, i) => {
    g.fillStyle = col;
    g.beginPath();
    g.arc(-36 + i * 18, 27, 4.4, 0, Math.PI * 2);
    g.fill();
  });

  g.restore();
}

function drawCat(g: CanvasRenderingContext2D, x: number, y: number, s = 1, pinkCoat = false) {
  g.save();
  g.translate(x, y);
  g.scale(s, s);
  g.lineJoin = 'round';

  const coat = pinkCoat ? '#ff8ec2' : '#fffdfd';
  const stroke = pinkCoat ? '#d63082' : '#e47aae';

  // White die-cut sticker halo
  g.save();
  g.shadowColor = 'rgba(60, 18, 48, 0.25)';
  g.shadowBlur = 10;
  g.shadowOffsetY = 4;
  g.fillStyle = '#ffffff';
  g.beginPath();
  g.ellipse(0, 0, 52, 46, 0, 0, Math.PI * 2);
  g.fill();
  g.restore();

  g.fillStyle = coat;
  g.strokeStyle = stroke;
  g.lineWidth = 4;
  for (const sx of [-1, 1]) {
    g.beginPath();
    g.moveTo(sx * 36, -18);
    g.lineTo(sx * 28, -56);
    g.lineTo(sx * 6, -34);
    g.closePath();
    g.fill();
    g.stroke();
  }
  g.fillStyle = pinkCoat ? '#ffd0e6' : '#ffb0cc';
  for (const sx of [-1, 1]) {
    g.beginPath();
    g.moveTo(sx * 30, -24);
    g.lineTo(sx * 25, -46);
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

  g.fillStyle = 'rgba(255, 108, 166, 0.62)';
  for (const sx of [-1, 1]) {
    g.beginPath();
    g.ellipse(sx * 28, 9, 8.8, 5.2, 0, 0, Math.PI * 2);
    g.fill();
  }

  g.fillStyle = '#201620';
  for (const sx of [-1, 1]) {
    g.beginPath();
    g.ellipse(sx * 15, -4, 4.6, 6.4, 0, 0, Math.PI * 2);
    g.fill();
  }
  g.fillStyle = '#ffffff';
  for (const sx of [-1, 1]) {
    g.beginPath();
    g.arc(sx * 15 - 1.5, -6, 1.9, 0, Math.PI * 2);
    g.fill();
  }

  const muzzle = g.createRadialGradient(0, 12, 2, 0, 12, 18);
  muzzle.addColorStop(0, '#ffffff');
  muzzle.addColorStop(1, pinkCoat ? '#ffe8f2' : '#fff5fa');
  g.fillStyle = muzzle;
  g.beginPath();
  g.ellipse(0, 12, 17, 11, 0, 0, Math.PI * 2);
  g.fill();

  g.strokeStyle = pinkCoat ? 'rgba(255, 255, 255, 0.96)' : 'rgba(180, 95, 138, 0.65)';
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

  g.fillStyle = '#ee508e';
  g.beginPath();
  g.moveTo(0, 9);
  g.lineTo(-5, 3);
  g.lineTo(5, 3);
  g.closePath();
  g.fill();

  g.strokeStyle = '#602c40';
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
  g.shadowColor = 'rgba(10, 22, 60, 0.36)';
  g.shadowBlur = r * 0.34;
  g.shadowOffsetY = r * 0.12;
  g.fillStyle = '#fffdfd';
  g.beginPath();
  g.arc(0, 0, r, 0, Math.PI * 2);
  g.fill();
  g.shadowColor = 'transparent';

  g.fillStyle = fill;
  g.strokeStyle = rim;
  g.lineWidth = Math.max(2.6, r * 0.11);
  g.beginPath();
  g.arc(0, 0, r * 0.83, 0, Math.PI * 2);
  g.fill();
  g.stroke();

  g.fillStyle = 'rgba(255, 255, 255, 0.5)';
  for (const sx of [-1, 1]) {
    g.beginPath();
    g.ellipse(sx * r * 0.47, r * 0.16, r * 0.15, r * 0.09, 0, 0, Math.PI * 2);
    g.fill();
  }

  g.fillStyle = '#1b1426';
  for (const sx of [-1, 1]) {
    g.beginPath();
    g.ellipse(sx * r * 0.3, -r * 0.08, r * 0.09, r * 0.135, 0, 0, Math.PI * 2);
    g.fill();
  }
  g.strokeStyle = '#1b1426';
  g.lineWidth = Math.max(2.2, r * 0.08);
  g.lineCap = 'round';
  g.beginPath();
  g.arc(0, r * 0.12, r * 0.27, 0.18 * Math.PI, 0.82 * Math.PI);
  g.stroke();
  g.restore();
}

function drawTinyBurger(g: CanvasRenderingContext2D, x: number, y: number, r: number) {
  g.save();
  g.translate(x, y);
  g.rotate(-0.09);
  g.shadowColor = 'rgba(10, 22, 60, 0.32)';
  g.shadowBlur = r * 0.3;
  g.shadowOffsetY = r * 0.1;
  g.fillStyle = '#fffdfd';
  roundRect(g, -r * 1.2, -r * 1.0, r * 2.4, r * 2.0, r * 0.36);
  g.fill();
  g.shadowColor = 'transparent';

  g.fillStyle = '#4ad664';
  g.beginPath();
  g.ellipse(0, -r * 0.22, r * 0.96, r * 0.64, 0, Math.PI, 0);
  g.fill();
  g.fillStyle = '#ffd296';
  g.fillRect(-r * 0.96, -r * 0.08, r * 1.92, r * 0.22);
  g.fillStyle = '#f03434';
  roundRect(g, -r * 0.88, r * 0.12, r * 1.76, r * 0.38, r * 0.16);
  g.fill();
  g.fillStyle = '#ffd01c';
  roundRect(g, -r * 0.9, r * 0.48, r * 1.8, r * 0.24, r * 0.08);
  g.fill();
  g.restore();
}

/* ------------------------------------------------------------------ */
/* printed panels (matching reference/target.png vibrancy & layout)    */
/* ------------------------------------------------------------------ */

export function marqueeTexture() {
  return printedTexture(1280, 384, (g) => {
    // Rich glowing neon sky-cyan backlit marquee matching reference/target.png!
    const bg = g.createLinearGradient(0, 0, 1280, 0);
    bg.addColorStop(0, '#f29ad0');
    bg.addColorStop(0.05, '#7de4ff');
    bg.addColorStop(0.24, '#9df0ff');
    bg.addColorStop(0.5, '#c6f8ff');
    bg.addColorStop(0.76, '#9df0ff');
    bg.addColorStop(0.95, '#7de4ff');
    bg.addColorStop(1, '#f29ad0');
    g.fillStyle = bg;
    g.fillRect(0, 0, 1280, 384);

    const inner = g.createRadialGradient(640, 192, 40, 640, 192, 620);
    inner.addColorStop(0, '#dffbff');
    inner.addColorStop(0.45, '#aaf2ff');
    inner.addColorStop(0.84, '#7de4ff');
    inner.addColorStop(1, '#66d8ff');
    g.fillStyle = inner;
    roundRect(g, 18, 18, 1244, 348, 30);
    g.fill();

    // Soft magenta-pink inner ambient bleed at left/right bezel edges
    const sideGlow = g.createLinearGradient(0, 0, 1280, 0);
    sideGlow.addColorStop(0, 'rgba(246, 118, 192, 0.48)');
    sideGlow.addColorStop(0.14, 'rgba(255, 190, 232, 0.14)');
    sideGlow.addColorStop(0.5, 'rgba(255,255,255,0)');
    sideGlow.addColorStop(0.86, 'rgba(255, 190, 232, 0.14)');
    sideGlow.addColorStop(1, 'rgba(246, 118, 192, 0.48)');
    g.fillStyle = sideGlow;
    g.fillRect(0, 0, 1280, 384);

    // Glowing cyan/white neon tube border
    g.save();
    g.shadowColor = 'rgba(72, 224, 255, 1)';
    g.shadowBlur = 42;
    g.strokeStyle = '#6ce2ff';
    g.lineWidth = 22;
    roundRect(g, 22, 22, 1236, 340, 28);
    g.stroke();
    g.shadowBlur = 20;
    g.strokeStyle = '#cffbff';
    g.lineWidth = 12;
    roundRect(g, 22, 22, 1236, 340, 28);
    g.stroke();
    g.shadowBlur = 8;
    g.strokeStyle = '#ffffff';
    g.lineWidth = 5;
    roundRect(g, 22, 22, 1236, 340, 28);
    g.stroke();
    g.restore();

    drawSparkle(g, 66, 326, 14, 'rgba(255,255,255,0.92)');
    drawSparkle(g, 1216, 324, 15, 'rgba(255,255,255,0.92)');
    drawSparkle(g, 310, 52, 12, 'rgba(255,255,255,0.85)');
    drawSparkle(g, 945, 56, 12, 'rgba(255,255,255,0.85)');

    // Bold chunky UFO PORTFOLIO headline with explosive hot-pink outline
    const headline = 'UFO PORTFOLIO';
    const size = fitFont(g, headline, 1040, 144, 900, ROUND);
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.lineJoin = 'round';
    g.font = `900 ${size}px ${ROUND}`;

    g.save();
    g.shadowColor = 'rgba(240, 37, 142, 0.92)';
    g.shadowBlur = 44;
    g.fillStyle = 'rgba(255, 72, 168, 0.85)';
    g.fillText(headline, 640, 198);
    g.restore();

    g.strokeStyle = '#e81c88';
    g.lineWidth = 46;
    g.strokeText(headline, 640, 198);
    g.strokeStyle = '#ff54a8';
    g.lineWidth = 28;
    g.strokeText(headline, 640, 198);
    g.strokeStyle = '#ffd2ea';
    g.lineWidth = 8;
    g.strokeText(headline, 640, 198);
    g.fillStyle = '#ffffff';
    g.fillText(headline, 640, 198);

    // Top-left purple UFO saucer with green alien
    drawUfo(g, 92, 62, 0.86, false);

    // Bottom-left tilted green/pink kana pill (tilted clockwise down-right like reference!)
    g.save();
    g.translate(148, 318);
    g.rotate(0.14);
    g.shadowColor = 'rgba(72, 14, 48, 0.34)';
    g.shadowBlur = 10;
    g.shadowOffsetY = 5;
    g.fillStyle = '#ff72b8';
    roundRect(g, -116, -26, 232, 52, 26);
    g.fill();
    g.shadowColor = 'transparent';
    g.strokeStyle = '#38c864';
    g.lineWidth = 9;
    roundRect(g, -116, -26, 232, 52, 26);
    g.stroke();
    g.strokeStyle = '#ffffff';
    g.lineWidth = 3.5;
    roundRect(g, -108, -18, 216, 36, 18);
    g.stroke();
    g.fillStyle = '#ffffff';
    g.font = `900 28px ${JP}`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText('がんばろう', 0, 2);
    g.restore();

    // Bottom-right cute kawaii pink/white kitty head
    drawCat(g, 1152, 300, 0.96, false);
  });
}

export function headerTexture() {
  return printedTexture(1600, 200, (g) => {
    // Rich deep royal cobalt-blue gradient matching reference/target.png!
    const bg = g.createLinearGradient(0, 0, 0, 200);
    bg.addColorStop(0, '#0a4a9e');
    bg.addColorStop(0.45, '#1163bd');
    bg.addColorStop(1, '#197ad6');
    g.fillStyle = bg;
    g.fillRect(0, 0, 1600, 200);

    // Clean glossy top highlight + deep navy bottom rim
    const sheen = g.createLinearGradient(0, 0, 0, 68);
    sheen.addColorStop(0, 'rgba(255,255,255,0.22)');
    sheen.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = sheen;
    g.fillRect(0, 0, 1600, 68);
    g.fillStyle = 'rgba(180,236,255,0.52)';
    g.fillRect(0, 0, 1600, 4);
    g.fillStyle = '#093878';
    g.fillRect(0, 192, 1600, 8);

    // Left mascot cluster: blue face, pink face, tiny burger
    drawKawaiiFace(g, 108, 104, 44, '#70ccff', '#1e58b0');
    drawKawaiiFace(g, 194, 72, 35, '#ff88c0', '#b82872');
    drawTinyBurger(g, 204, 146, 26);

    // Explosive hot-pink katakana with crisp white + deep navy outline
    const word = 'クレーンゲーム';
    const size = fitFont(g, word, 920, 140, 900);
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.lineJoin = 'round';
    g.font = `900 ${size}px ${JP}`;

    g.fillStyle = 'rgba(5, 18, 56, 0.56)';
    g.fillText(word, 806, 112);
    g.strokeStyle = '#0c2c68';
    g.lineWidth = 32;
    g.strokeText(word, 800, 103);
    g.strokeStyle = '#ffffff';
    g.lineWidth = 17;
    g.strokeText(word, 800, 103);
    g.fillStyle = '#f0248e';
    g.fillText(word, 800, 103);

    // Right yellow/black WARNING sticker tilted clockwise like reference!
    g.save();
    g.translate(1426, 100);
    g.rotate(0.085);
    g.shadowColor = 'rgba(6, 18, 56, 0.45)';
    g.shadowBlur = 10;
    g.shadowOffsetY = 5;
    g.fillStyle = '#ffd21e';
    roundRect(g, -128, -58, 256, 116, 8);
    g.fill();
    g.shadowColor = 'transparent';
    g.strokeStyle = '#14151a';
    g.lineWidth = 7;
    roundRect(g, -123, -53, 246, 106, 6);
    g.stroke();

    // Top black header bar inside WARNING sticker matching reference
    g.fillStyle = '#14151a';
    roundRect(g, -114, -44, 228, 38, 4);
    g.fill();

    g.fillStyle = '#ffd21e';
    g.beginPath();
    g.moveTo(-88, -38);
    g.lineTo(-74, -12);
    g.lineTo(-102, -12);
    g.closePath();
    g.fill();
    g.fillStyle = '#14151a';
    g.font = `900 18px ${ROUND}`;
    g.textAlign = 'center';
    g.fillText('!', -88, -19);

    g.fillStyle = '#ffd21e';
    g.textAlign = 'left';
    g.font = `900 30px ${ROUND}`;
    g.fillText('WARNING', -62, -24);

    g.fillStyle = '#14151a';
    g.textAlign = 'center';
    g.font = `800 12px ${ROUND}`;
    g.fillText('CAUTION: MOVING PARTS', 0, 12);
    g.fillText('KEEP HANDS CLEAR', 0, 28);
    g.fillText('PRESS PLAY TO START', 0, 44);
    g.restore();
  });
}

export function bodyTexture() {
  return printedTexture(1024, 512, (g) => {
    const bg = g.createLinearGradient(0, 0, 0, 512);
    bg.addColorStop(0, '#ffffff');
    bg.addColorStop(0.75, '#fcf9fc');
    bg.addColorStop(1, '#f2f3f8');
    g.fillStyle = bg;
    roundRect(g, 2, 2, 1020, 508, 22);
    g.fill();

    // Soft pink inner trim (clean, no harsh black outline)
    g.strokeStyle = 'rgba(232, 110, 174, 0.35)';
    g.lineWidth = 4;
    roundRect(g, 8, 8, 1008, 496, 18);
    g.stroke();

    // Bottom-left: striped electric cyan/yellow sun disc + purple UFO + rainbow beam
    g.save();
    const sunX = 114;
    const sunY = 306;
    const sunR = 90;
    g.shadowColor = 'rgba(72, 24, 68, 0.2)';
    g.shadowBlur = 14;
    g.shadowOffsetY = 5;
    g.fillStyle = '#ffffff';
    g.beginPath();
    g.arc(sunX, sunY, sunR + 9, 0, Math.PI * 2);
    g.fill();
    g.shadowColor = 'transparent';
    for (let i = 0; i < 24; i++) {
      const a0 = (i / 24) * Math.PI * 2;
      const a1 = ((i + 1) / 24) * Math.PI * 2;
      g.fillStyle = i % 2 === 0 ? '#3ec4ff' : '#ffd21c';
      g.beginPath();
      g.moveTo(sunX, sunY);
      g.arc(sunX, sunY, sunR, a0, a1);
      g.closePath();
      g.fill();
    }
    g.fillStyle = '#9be8ff';
    g.beginPath();
    g.arc(sunX, sunY, sunR * 0.62, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = '#ffffff';
    g.lineWidth = 6;
    g.stroke();
    drawUfo(g, sunX, sunY - 20, 0.98, true);
    g.restore();

    // Small pink sakura blossom sticker in a white rounded square
    g.save();
    g.translate(248, 224);
    g.scale(0.86, 0.86);
    g.rotate(-0.05);
    g.shadowColor = 'rgba(72, 20, 56, 0.2)';
    g.shadowBlur = 10;
    g.shadowOffsetY = 4;
    g.fillStyle = '#ffffff';
    g.strokeStyle = '#e868aa';
    g.lineWidth = 5;
    roundRect(g, -48, -40, 96, 80, 18);
    g.fill();
    g.stroke();
    g.shadowColor = 'transparent';
    g.fillStyle = '#ff88c4';
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      g.beginPath();
      g.ellipse(Math.cos(a) * 18, Math.sin(a) * 18, 13, 9.5, a, 0, Math.PI * 2);
      g.fill();
    }
    g.fillStyle = '#ffd838';
    g.beginPath();
    g.arc(0, 0, 10, 0, Math.PI * 2);
    g.fill();
    g.restore();

    // Bold 2-line katakana with vivid hot-pink fill + white & blue outline
    g.textAlign = 'left';
    g.textBaseline = 'middle';
    g.lineJoin = 'round';
    const lines = ['クレーンゲーム', 'ポートフォリオ'];
    lines.forEach((word, i) => {
      const size = i === 0 ? 72 : 66;
      g.font = `900 ${size}px ${JP}`;
      const y = 326 + i * 78;
      const x = 166;
      g.fillStyle = 'rgba(20, 96, 200, 0.42)';
      g.fillText(word, x + 5, y + 7);
      g.strokeStyle = '#1862c4';
      g.lineWidth = 22;
      g.strokeText(word, x, y);
      g.strokeStyle = '#ffffff';
      g.lineWidth = 12;
      g.strokeText(word, x, y);
      g.fillStyle = '#f0248e';
      g.fillText(word, x, y);
    });

    // Bottom-right cluster: cute pink cat, yellow/blue UFO round seal, red/white WARNING
    drawCat(g, 732, 336, 0.86, true);

    g.save();
    g.translate(894, 256);
    g.shadowColor = 'rgba(35, 22, 70, 0.24)';
    g.shadowBlur = 12;
    g.shadowOffsetY = 5;
    g.fillStyle = '#ffd21c';
    g.beginPath();
    g.arc(0, 0, 58, 0, Math.PI * 2);
    g.fill();
    g.shadowColor = 'transparent';
    g.strokeStyle = '#5c42b8';
    g.lineWidth = 4.5;
    g.stroke();
    g.fillStyle = '#38a8f4';
    g.beginPath();
    g.arc(0, 0, 39, 0, Math.PI * 2);
    g.fill();
    drawUfo(g, 0, -2, 0.44, false);
    g.fillStyle = '#2d1a5a';
    g.font = `900 10.5px ${ROUND}`;
    g.textAlign = 'center';
    g.fillText('UFO CATCHER', 0, -45);
    g.fillText('PORTFOLIO', 0, 47);
    g.restore();

    // Tilted red/white WARNING sticker (sloping down-right like reference!)
    g.save();
    g.translate(866, 424);
    g.rotate(0.08);
    g.shadowColor = 'rgba(40, 10, 20, 0.25)';
    g.shadowBlur = 10;
    g.shadowOffsetY = 5;
    g.fillStyle = '#ffffff';
    roundRect(g, -126, -58, 252, 116, 11);
    g.fill();
    g.shadowColor = 'transparent';
    g.strokeStyle = '#e81c28';
    g.lineWidth = 7;
    roundRect(g, -121, -53, 242, 106, 9);
    g.stroke();
    g.fillStyle = '#e81c28';
    roundRect(g, -110, -44, 220, 40, 5);
    g.fill();
    g.fillStyle = '#ffffff';
    g.font = `900 24px ${ROUND}`;
    g.textAlign = 'center';
    g.fillText('▲ WARNING', 0, -21);
    g.fillStyle = '#22181e';
    g.font = `800 12.5px ${ROUND}`;
    g.fillText('DO NOT TILT OR SHAKE', 0, 16);
    g.fillText('PRESS PLAY TO START', 0, 38);
    g.restore();
  });
}

/* Deck print layout constants — shared with 3D joystick & button coordinates
   so arrows, label, and golden glow align to the sub-pixel! */
const DECK_W = 0.965;
const DECK_D = 0.365;
const JOY_X = -0.27;
const JOY_Z = 0.02;
const BTN_X = 0.255;
const BTN_Z = -0.01;

export function deckTexture() {
  return printedTexture(1024, 341, (g) => {
    // Vivid glossy cerulean/sky-blue deck matching reference/target.png!
    const bg = g.createLinearGradient(0, 0, 0, 341);
    bg.addColorStop(0, '#36b8ff');
    bg.addColorStop(0.42, '#189ef0');
    bg.addColorStop(1, '#0d82d4');
    g.fillStyle = bg;
    g.fillRect(0, 0, 1024, 341);

    const sheen = g.createRadialGradient(340, 62, 20, 340, 62, 540);
    sheen.addColorStop(0, 'rgba(255,255,255,0.28)');
    sheen.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = sheen;
    g.fillRect(0, 0, 1024, 341);

    // Exact canvas pixel centers of the 3D joystick & yellow button
    const jx = ((JOY_X + DECK_W / 2) / DECK_W) * 1024; // 225.5
    const jy = ((JOY_Z + DECK_D / 2) / DECK_D) * 341; // 189.2
    const bx = ((BTN_X + DECK_W / 2) / DECK_W) * 1024; // 782.6
    const by = ((BTN_Z + DECK_D / 2) / DECK_D) * 341; // 161.2

    // Warm golden light halo around the PLAY button bezel (kept tight so PLAY / スタート stays crisp!)
    const btnHalo = g.createRadialGradient(bx, by, 56, bx, by, 132);
    btnHalo.addColorStop(0, 'rgba(255, 224, 72, 0.48)');
    btnHalo.addColorStop(0.55, 'rgba(255, 206, 48, 0.16)');
    btnHalo.addColorStop(1, 'rgba(255, 206, 48, 0)');
    g.fillStyle = btnHalo;
    g.fillRect(bx - 200, 0, 400, 341);

    // Crisp white inner pinstripe border around the blue deck
    g.strokeStyle = 'rgba(255,255,255,0.92)';
    g.lineWidth = 5;
    roundRect(g, 14, 14, 996, 313, 22);
    g.stroke();

    // Perfectly symmetric hot-pink arrows centered around (jx, jy)!
    const arrow = (x: number, y: number, dir: 'left' | 'right' | 'up' | 'down') => {
      g.save();
      g.translate(x, y);
      g.scale(1.22, 1.22);
      if (dir === 'left') g.rotate(-Math.PI / 2);
      if (dir === 'right') g.rotate(Math.PI / 2);
      if (dir === 'down') g.rotate(Math.PI);
      g.shadowColor = 'rgba(8, 32, 82, 0.36)';
      g.shadowBlur = 7;
      g.shadowOffsetY = 3;
      g.beginPath();
      g.moveTo(0, -28);
      g.lineTo(24, -4);
      g.lineTo(10, -4);
      g.lineTo(10, 22);
      g.lineTo(-10, 22);
      g.lineTo(-10, -4);
      g.lineTo(-24, -4);
      g.closePath();
      g.strokeStyle = '#ffffff';
      g.lineWidth = 8.5;
      g.lineJoin = 'round';
      g.stroke();
      g.shadowColor = 'transparent';
      g.fillStyle = '#f62998';
      g.fill();
      g.restore();
    };

    arrow(jx - 118, jy, 'left');
    arrow(jx + 118, jy, 'right');
    arrow(jx, jy + 98, 'down');

    // PLAY / スタート centered cleanly directly beneath the yellow button (bx)
    g.fillStyle = 'rgba(6, 30, 80, 0.45)';
    g.font = `900 32px ${ROUND}`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText('PLAY / スタート', bx + 2, 294);
    g.fillStyle = '#ffffff';
    g.fillText('PLAY / スタート', bx, 291);

    // Yellow smiley sticker cleanly in the visible back-left corner of the blue deck
    g.save();
    g.translate(86, 134);
    g.rotate(-0.08);
    g.shadowColor = 'rgba(8, 32, 82, 0.28)';
    g.shadowBlur = 6;
    g.shadowOffsetY = 3;
    g.fillStyle = '#ffd21c';
    g.beginPath();
    g.arc(0, 0, 25, 0, Math.PI * 2);
    g.fill();
    g.shadowColor = 'transparent';
    g.strokeStyle = '#181620';
    g.lineWidth = 3.5;
    g.stroke();
    g.fillStyle = '#181620';
    g.beginPath();
    g.arc(-8.5, -5, 3.2, 0, Math.PI * 2);
    g.arc(8.5, -5, 3.2, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = '#181620';
    g.lineWidth = 3.2;
    g.lineCap = 'round';
    g.beginPath();
    g.arc(0, 2, 12, 0.16 * Math.PI, 0.84 * Math.PI);
    g.stroke();
    g.restore();

    // Cute round purple/pink kawaii sticker cleanly in the visible back-right corner
    g.save();
    g.translate(944, 136);
    g.shadowColor = 'rgba(8, 32, 82, 0.28)';
    g.shadowBlur = 6;
    g.shadowOffsetY = 3;
    g.fillStyle = '#ffffff';
    g.beginPath();
    g.arc(0, 0, 26, 0, Math.PI * 2);
    g.fill();
    g.shadowColor = 'transparent';
    g.fillStyle = '#b47cff';
    g.beginPath();
    g.arc(0, 0, 21, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = '#ff68b4';
    g.lineWidth = 3.5;
    g.stroke();
    g.fillStyle = '#2d1854';
    g.beginPath();
    g.arc(-6, -3, 2.6, 0, Math.PI * 2);
    g.arc(6, -3, 2.6, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = '#2d1854';
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
    g.font = `900 50px ${JP}`;
    for (let i = 0; i < chars.length; i++) {
      const y = 52 + i * 58;
      g.fillStyle = 'rgba(80, 12, 58, 0.42)';
      g.fillText(chars[i], 67, y + 3);
      g.strokeStyle = '#ffffff';
      g.lineWidth = 12;
      g.strokeText(chars[i], 64, y);
      g.fillStyle = '#f0248e';
      g.fillText(chars[i], 64, y);
    }
  });
}

/** Colorful peeking rectangular stickers on the left blue pillar outer edge (matching reference). */
function leftEdgeStickersTexture() {
  return printedTexture(128, 460, (g) => {
    // Upper pink/purple peeking ticket sticker
    g.save();
    g.translate(16, 118);
    g.rotate(0.08);
    g.fillStyle = '#ffffff';
    roundRect(g, -28, -56, 62, 112, 8);
    g.fill();
    g.fillStyle = '#ff68b4';
    roundRect(g, -22, -50, 50, 100, 5);
    g.fill();
    g.fillStyle = '#38c0ff';
    g.fillRect(-16, -36, 36, 22);
    g.fillStyle = '#ffd21c';
    g.fillRect(-16, 0, 36, 32);
    g.restore();

    // Lower yellow/blue peeking comic sticker
    g.save();
    g.translate(14, 304);
    g.rotate(-0.07);
    g.fillStyle = '#ffffff';
    roundRect(g, -28, -44, 62, 88, 8);
    g.fill();
    g.fillStyle = '#ffd21c';
    roundRect(g, -22, -38, 50, 76, 5);
    g.fill();
    g.fillStyle = '#1888e8';
    g.fillRect(-16, -24, 34, 24);
    g.fillStyle = '#f0248e';
    g.fillRect(-16, 8, 34, 18);
    g.restore();
  });
}

/** Purple/white ポートフォリオ sticker sitting proud of the top-right marquee bezel. */
function cornerStickerTexture() {
  return printedTexture(512, 112, (g) => {
    g.save();
    g.translate(256, 56);
    g.shadowColor = 'rgba(42, 14, 78, 0.35)';
    g.shadowBlur = 12;
    g.shadowOffsetY = 5;
    g.fillStyle = '#ffffff';
    roundRect(g, -246, -46, 492, 92, 46);
    g.fill();
    g.shadowColor = 'transparent';
    g.strokeStyle = '#6c42d8';
    g.lineWidth = 13;
    roundRect(g, -238, -38, 476, 76, 38);
    g.stroke();
    g.fillStyle = '#6c42d8';
    g.font = `900 54px ${JP}`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText('ポートフォリオ', 0, 2);
    g.restore();
  });
}

/** Crisp yellow/black WARNING plate mounted on the blue lower sill above the button. */
function warningPlateTexture() {
  return printedTexture(512, 200, (g) => {
    g.save();
    g.translate(256, 100);
    g.fillStyle = '#ffd21c';
    roundRect(g, -246, -88, 492, 176, 12);
    g.fill();
    g.strokeStyle = '#14151a';
    g.lineWidth = 12;
    roundRect(g, -238, -80, 476, 160, 9);
    g.stroke();

    // Black header bar inside WARNING plate (matches reference!)
    g.fillStyle = '#14151a';
    roundRect(g, -222, -66, 444, 62, 6);
    g.fill();

    g.fillStyle = '#ffd21c';
    g.beginPath();
    g.moveTo(-162, -56);
    g.lineTo(-132, -12);
    g.lineTo(-192, -12);
    g.closePath();
    g.fill();
    g.fillStyle = '#14151a';
    g.font = `900 34px ${ROUND}`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText('!', -162, -26);

    g.fillStyle = '#ffd21c';
    g.textAlign = 'left';
    g.font = `900 54px ${ROUND}`;
    g.fillText('WARNING', -112, -33);

    g.fillStyle = '#14151a';
    g.textAlign = 'center';
    g.font = `800 22px ${ROUND}`;
    g.fillText('CAUTION / 可動部注意', 0, 24);
    g.fillText('KEEP HANDS CLEAR OF CLAW', 0, 54);
    g.restore();
  });
}

/**
 * Bright, clean cool silver-blue chamber back wall with soft studio reflections
 * and subtle architectural depth (no fake static ghost claw that confuses Z depth!).
 */
function chamberBackTexture() {
  return printedTexture(512, 512, (g) => {
    const bg = g.createLinearGradient(0, 0, 0, 512);
    bg.addColorStop(0, '#a8c4de');
    bg.addColorStop(0.26, '#7f98b4');
    bg.addColorStop(0.64, '#5c6f8a');
    bg.addColorStop(1, '#46556e');
    g.fillStyle = bg;
    g.fillRect(0, 0, 512, 512);

    // Side inner structural frame channels
    g.fillStyle = 'rgba(46, 60, 92, 0.36)';
    g.fillRect(0, 0, 28, 512);
    g.fillRect(484, 0, 28, 512);
    g.fillStyle = 'rgba(230, 246, 255, 0.38)';
    g.fillRect(28, 0, 6, 512);
    g.fillRect(478, 0, 6, 512);

    // Upper ceiling light wash
    const topWash = g.createLinearGradient(0, 0, 0, 150);
    topWash.addColorStop(0, 'rgba(230, 250, 255, 0.65)');
    topWash.addColorStop(0.45, 'rgba(205, 240, 255, 0.24)');
    topWash.addColorStop(1, 'rgba(255, 255, 255, 0)');
    g.fillStyle = topWash;
    g.fillRect(28, 0, 456, 150);

    // Soft glass panel reflection bands
    for (const [cx, cw, alpha] of [
      [88, 54, 0.2],
      [256, 68, 0.12],
      [424, 54, 0.2],
    ]) {
      const col = g.createLinearGradient(cx - cw / 2, 0, cx + cw / 2, 0);
      col.addColorStop(0, 'rgba(232, 248, 255, 0)');
      col.addColorStop(0.5, `rgba(232, 248, 255, ${alpha})`);
      col.addColorStop(1, 'rgba(232, 248, 255, 0)');
      g.fillStyle = col;
      g.fillRect(cx - cw / 2, 24, cw, 488);
    }

    // Subtle vertical LED glow bleed at both inner corners
    const edge = g.createLinearGradient(0, 0, 80, 0);
    edge.addColorStop(0, 'rgba(205, 252, 255, 0.45)');
    edge.addColorStop(1, 'rgba(205, 252, 255, 0)');
    g.fillStyle = edge;
    g.fillRect(28, 20, 80, 492);
    g.save();
    g.translate(512, 0);
    g.scale(-1, 1);
    g.fillStyle = edge;
    g.fillRect(28, 20, 80, 492);
    g.restore();

    // Deep floor horizon shadow for rich 3D depth contrast behind the capsule pile
    const floorShadow = g.createLinearGradient(0, 350, 0, 512);
    floorShadow.addColorStop(0, 'rgba(20, 30, 52, 0)');
    floorShadow.addColorStop(1, 'rgba(16, 24, 44, 0.56)');
    g.fillStyle = floorShadow;
    g.fillRect(0, 380, 512, 132);
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
    color: '#eef9ff',
    metalness: 0.05,
    roughness: 0.04,
    transparent: true,
    opacity: 0.055,
    side: THREE.DoubleSide,
    depthWrite: false,
    envMapIntensity: 1.4,
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
  const pinkDeep = candy(REF.framePinkShade, { roughness: 0.22 });
  const azure = candy(REF.sidePostBlue, { roughness: 0.14 });
  const azureMid = candy('#36465e', { roughness: 0.32 });
  const azureDeep = candy(REF.bandBlue, { roughness: 0.18 });
  const azurePale = candy(REF.glassTint, { roughness: 0.26 });
  const deckBlue = candy(REF.panelBlue, { roughness: 0.14 });
  const porcelain = candy(REF.bottomWhite, { roughness: 0.24 });
  const rub = rubber();
  const chromeMat = chrome();
  const glass = glassMaterial();
  const ink = matte(REF.ink);

  /* ---------------- feet + lower body ---------------- */

  for (const [x, z] of [
    [-0.41, 0.28],
    [0.41, 0.28],
    [-0.41, -0.28],
    [0.41, -0.28],
  ]) {
    add(root, new THREE.CylinderGeometry(0.068, 0.074, 0.036, 20), rub, x, 0.018, z, true, false);
    add(root, new THREE.CylinderGeometry(0.06, 0.064, 0.01, 20), ink, x, 0.004, z, false, false);
  }

  add(root, rbox(0.96, 0.018, 0.72, 0.008), ink, 0, 0.032, 0, false, false);

  add(root, rbox(1.03, 0.56, 0.78, 0.052), pink, 0, 0.322, 0, true, false);
  add(root, rbox(1.04, 0.044, 0.794, 0.018), pinkDeep, 0, 0.072, 0, false, false);

  add(root, rbox(0.92, 0.45, 0.02, 0.022), porcelain, 0, 0.355, 0.386, false, false);
  add(
    root,
    new THREE.PlaneGeometry(0.9, 0.435),
    printed(bodyTexture(), { roughness: 0.26 }),
    0,
    0.355,
    0.398,
    false,
    false
  );

  // Subtle pink recessed bezel trim framing the white front panel
  add(root, rbox(0.955, 0.024, 0.016, 0.008), pinkDeep, 0, 0.582, 0.393, false, false);
  add(root, rbox(0.955, 0.024, 0.016, 0.008), pinkDeep, 0, 0.128, 0.393, false, false);
  add(root, rbox(0.024, 0.478, 0.016, 0.008), pinkDeep, -0.468, 0.355, 0.393, false, false);
  add(root, rbox(0.024, 0.478, 0.016, 0.008), pinkDeep, 0.468, 0.355, 0.393, false, false);

  /* ---------------- control deck (blue inset + rounded pink bumper) ---------------- */

  const deck = new THREE.Group();
  deck.position.set(0, 0.586, 0.452);
  deck.rotation.x = 0.21;
  root.add(deck);

  // Vivid blue control panel top seated inside a smooth rounded baby-pink outer bumper bezel
  add(deck, rbox(0.99, 0.064, 0.386, 0.026), deckBlue, 0, 0.002, 0, true, false);
  add(deck, rbox(1.045, 0.048, 0.412, 0.024), pink, 0, -0.024, 0.008, true, false);
  add(deck, rbox(1.042, 0.018, 0.406, 0.009), pinkDeep, 0, -0.052, 0.006, false, false);

  const deckPrint = add(
    deck,
    new THREE.PlaneGeometry(DECK_W, DECK_D),
    printed(deckTexture(), { roughness: 0.48 }),
    0,
    0.0352,
    0,
    false,
    false
  );
  deckPrint.rotation.x = -Math.PI / 2;

  // Sleek tapered black dust washer under the joystick shaft
  add(deck, new THREE.CylinderGeometry(0.062, 0.068, 0.007, 32), ink, JOY_X, 0.039, JOY_Z, false, false);

  const stick = new THREE.Group();
  stick.position.set(JOY_X, 0.044, JOY_Z);
  stick.userData.noMerge = true;
  deck.add(stick);

  const rodMat = new THREE.MeshStandardMaterial({
    color: '#f2f6fc',
    metalness: 0.88,
    roughness: 0.12,
    envMapIntensity: 1.6,
  });
  const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.0075, 0.0095, 0.092, 14), rodMat);
  rod.position.y = 0.046;
  stick.add(rod);

  // Larger, ultra-glossy deep cherry-red ball matching reference/target.png!
  const ballMat = candy('#dc0e1a', {
    roughness: 0.05,
    metalness: 0.02,
    clearcoat: 1.0,
    clearcoatRoughness: 0.04,
    envMapIntensity: 1.65,
  });
  const ball = new THREE.Mesh(new THREE.SphereGeometry(0.043, 28, 20), ballMat);
  ball.position.y = 0.112;
  ball.castShadow = true;
  stick.add(ball);

  // Sleeker dark bezel + blazing luminous amber-gold arcade button
  add(deck, new THREE.CylinderGeometry(0.088, 0.094, 0.014, 32), ink, BTN_X, 0.041, BTN_Z, false, false);
  add(deck, new THREE.TorusGeometry(0.084, 0.009, 8, 36), ink, BTN_X, 0.049, BTN_Z, false, false).rotation.x =
    Math.PI / 2;
  add(deck, new THREE.TorusGeometry(0.077, 0.0038, 6, 32), chromeMat, BTN_X, 0.0525, BTN_Z, false, false).rotation.x =
    Math.PI / 2;
  const btnGlowRing = add(
    deck,
    new THREE.TorusGeometry(0.072, 0.005, 6, 32),
    glow('#fff4a8', 1.4),
    BTN_X,
    0.053,
    BTN_Z,
    false,
    false
  );
  btnGlowRing.rotation.x = Math.PI / 2;

  const capMat = new THREE.MeshPhysicalMaterial({
    color: '#ffd82e',
    emissive: new THREE.Color('#ffbe14'),
    emissiveIntensity: 1.15,
    roughness: 0.08,
    metalness: 0.0,
    clearcoat: 1.0,
    clearcoatRoughness: 0.06,
    envMapIntensity: 1.4,
  });
  const capGroup = new THREE.Group();
  capGroup.position.set(BTN_X, 0.046, BTN_Z);
  capGroup.userData.noMerge = true;
  deck.add(capGroup);

  const capSide = new THREE.Mesh(new THREE.CylinderGeometry(0.069, 0.073, 0.022, 32), capMat);
  capSide.position.y = 0.009;
  capGroup.add(capSide);
  const capTop = new THREE.Mesh(new THREE.SphereGeometry(0.071, 24, 14), capMat);
  capTop.scale.set(1, 0.34, 1);
  capTop.position.y = 0.02;
  capGroup.add(capTop);

  // Soft warm inner illuminated core on the dome
  const capHot = new THREE.Mesh(
    new THREE.SphereGeometry(0.042, 18, 10),
    new THREE.MeshBasicMaterial({ color: '#fffbe0', transparent: true, opacity: 0.68, toneMapped: false })
  );
  capHot.scale.set(1, 0.24, 0.86);
  capHot.position.set(0, 0.042, 0.004);
  capHot.userData.noMerge = true;
  capGroup.add(capHot);

  const buttonHit = new THREE.Mesh(
    new THREE.BoxGeometry(0.26, 0.18, 0.26),
    new THREE.MeshBasicMaterial({ visible: false })
  );
  buttonHit.position.set(BTN_X, 0.085, BTN_Z);
  deck.add(buttonHit);

  /* ---------------- play chamber ---------------- */

  add(root, rbox(0.99, 0.028, 0.74, 0.012), azureMid, 0, 0.706, 0, false, true);

  add(root, new THREE.PlaneGeometry(0.2, 0.2), new THREE.MeshBasicMaterial({ color: '#10203a' }), -0.31, 0.721, 0).rotation.x =
    -Math.PI / 2;
  for (const [w, d, x, z] of [
    [0.218, 0.009, -0.31, 0.1045],
    [0.218, 0.009, -0.31, -0.1045],
    [0.009, 0.2, -0.4145, 0],
    [0.009, 0.2, -0.2055, 0],
  ]) {
    add(root, rbox(w, 0.005, d, 0.002), chromeMat, x, 0.723, z);
  }

  // Sleek crystal-clear acrylic prize chute divider box (height 0.19 m matches physics!)
  const acrylic = new THREE.MeshPhysicalMaterial({
    color: '#e4f6ff',
    metalness: 0.02,
    roughness: 0.04,
    transparent: true,
    opacity: 0.14,
    clearcoat: 0.9,
    side: THREE.DoubleSide,
    depthWrite: false,
    envMapIntensity: 1.5,
  });
  const acrylicEdge = new THREE.MeshStandardMaterial({
    color: '#d4ecff',
    roughness: 0.12,
    metalness: 0.12,
    transparent: true,
    opacity: 0.42,
  });
  const chuteCx = -0.31;
  const chuteCz = 0;
  const chuteHalf = 0.108;
  const chuteH = 0.19;
  const chuteBase = 0.723;
  const chuteTop = chuteBase + chuteH;
  const chuteCY = chuteBase + chuteH / 2;

  const chuteWalls: [number, number, number, number, number][] = [
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

  // Subtle thin acrylic polished top rim (no heavy white wireframe cage)
  for (const [w, d, x, z] of [
    [chuteHalf * 2 + 0.004, 0.004, chuteCx, chuteCz - chuteHalf],
    [chuteHalf * 2 + 0.004, 0.004, chuteCx, chuteCz + chuteHalf],
    [0.004, chuteHalf * 2 + 0.004, chuteCx - chuteHalf, chuteCz],
    [0.004, chuteHalf * 2 + 0.004, chuteCx + chuteHalf, chuteCz],
  ]) {
    add(root, rbox(w, 0.004, d, 0.0015), acrylicEdge, x, chuteTop, z);
  }
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      add(
        root,
        rbox(0.0045, chuteH + 0.004, 0.0045, 0.0015),
        acrylicEdge,
        chuteCx + sx * chuteHalf,
        chuteCY,
        chuteCz + sz * chuteHalf
      );
    }
  }

  // Clean cool silver-blue chamber back wall
  add(
    root,
    new THREE.PlaneGeometry(0.96, 0.62),
    new THREE.MeshBasicMaterial({ map: chamberBackTexture(), toneMapped: false }),
    0,
    1.01,
    -0.372
  );

  // Metallic gantry rail across the top-rear for the hanging charms
  add(root, rbox(0.9, 0.018, 0.024, 0.006), chromeMat, 0, 1.288, -0.19, false, false);
  // Front-top structural rail visible at top of glass
  add(root, rbox(0.92, 0.018, 0.04, 0.006), chromeMat, 0, 1.304, 0.24, false, false);

  add(root, rbox(0.99, 0.018, 0.74, 0.006), azurePale, 0, 1.326, 0);
  add(root, new THREE.PlaneGeometry(0.94, 0.7), new THREE.MeshBasicMaterial({ color: '#dff5ff' }), 0, 1.316, 0).rotation.x =
    Math.PI / 2;

  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      add(root, rbox(0.074, 0.64, 0.072, 0.02), azure, sx * 0.492, 1.025, sz * 0.35, true, false);
    }
    add(root, rbox(0.074, 0.046, 0.78, 0.014), azureDeep, sx * 0.492, 0.732, 0);
    add(root, rbox(0.074, 0.046, 0.78, 0.014), azureDeep, sx * 0.492, 1.312, 0);
    const sidePane = add(root, new THREE.PlaneGeometry(0.68, 0.575), glass, sx * 0.498, 1.025, 0);
    sidePane.rotation.y = sx * (Math.PI / 2);
    sidePane.renderOrder = 3;
  }

  // Front window frame matching reference/target.png:
  // Vivid electric-blue side posts + vivid blue bottom sill + slim bright chrome inner trim (NO pink box!)
  const frameZ = 0.394;
  // Crisp electric-blue lower fascia band between glass sill and deck (holds WARNING plate cleanly above button)
  add(root, rbox(0.95, 0.072, 0.074, 0.012), azure, 0, 0.706, frameZ - 0.004, true, false);
  add(root, rbox(0.92, 0.024, 0.076, 0.01), azureDeep, 0, 1.33, frameZ, false, false);
  add(root, rbox(0.072, 0.65, 0.088, 0.02), azure, -0.484, 1.028, frameZ, true, false);
  add(root, rbox(0.072, 0.65, 0.088, 0.02), azure, 0.484, 1.028, frameZ, true, false);
  // Sleek slim silver-white inner glass channels
  add(root, rbox(0.014, 0.59, 0.068, 0.005), chromeMat, -0.445, 1.028, frameZ + 0.004);
  add(root, rbox(0.014, 0.59, 0.068, 0.005), chromeMat, 0.445, 1.028, frameZ + 0.004);
  add(root, rbox(0.9, 0.012, 0.068, 0.004), chromeMat, 0, 0.742, frameZ + 0.004);

  // Bright vertical cyan-white LED strips inside both front corners of the glass box
  const neonTubeMat = new THREE.MeshBasicMaterial({ color: '#c4f8ff', toneMapped: false });
  const neonCoreMat = new THREE.MeshBasicMaterial({ color: '#ffffff', toneMapped: false });
  const neonGlowMat = new THREE.MeshBasicMaterial({
    color: '#78e8ff',
    transparent: true,
    opacity: 0.44,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const neonHaloMat = new THREE.MeshBasicMaterial({
    color: '#e8feff',
    transparent: true,
    opacity: 0.65,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  for (const sx of [-1, 1]) {
    const gPlane = add(root, new THREE.PlaneGeometry(0.14, 0.59), neonGlowMat, sx * 0.422, 1.025, 0.325);
    gPlane.renderOrder = 2;
    const halo = add(root, new THREE.PlaneGeometry(0.048, 0.59), neonHaloMat, sx * 0.422, 1.025, 0.33);
    halo.renderOrder = 2;
    add(root, new THREE.CylinderGeometry(0.01, 0.01, 0.58, 12), neonTubeMat, sx * 0.422, 1.025, 0.34);
    add(root, new THREE.CylinderGeometry(0.005, 0.005, 0.58, 8), neonCoreMat, sx * 0.422, 1.025, 0.344);
  }

  // Top horizontal LED tube just under the blue header
  const topGlow = add(root, new THREE.PlaneGeometry(0.88, 0.075), neonGlowMat, 0, 1.308, 0.322);
  topGlow.renderOrder = 2;
  const topTube = add(root, new THREE.CylinderGeometry(0.007, 0.007, 0.86, 10), neonTubeMat, 0, 1.31, 0.334);
  topTube.rotation.z = Math.PI / 2;
  const topCore = add(root, new THREE.CylinderGeometry(0.0034, 0.0034, 0.86, 8), neonCoreMat, 0, 1.31, 0.338);
  topCore.rotation.z = Math.PI / 2;

  const glassFront = add(root, new THREE.PlaneGeometry(0.88, 0.58), glass, 0, 1.028, 0.402);
  glassFront.renderOrder = 3;

  // Soft diagonal white glass reflection streaks
  const streak = streakTexture();
  const streakMat = new THREE.MeshBasicMaterial({
    map: streak,
    transparent: true,
    opacity: 0.08,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const reflection = add(root, new THREE.PlaneGeometry(0.75, 0.14), streakMat, -0.06, 1.15, 0.406);
  reflection.rotation.z = 0.45;
  reflection.renderOrder = 4;

  const reflection2 = add(root, new THREE.PlaneGeometry(0.34, 0.075), streakMat, 0.25, 1.24, 0.407);
  reflection2.rotation.z = 0.42;
  reflection2.renderOrder = 4;

  // Yellow WARNING plate mounted cleanly on the vertical blue fascia right above the PLAY button
  const warnPlate = add(
    root,
    new THREE.PlaneGeometry(0.162, 0.058),
    new THREE.MeshBasicMaterial({
      map: warningPlateTexture(),
      transparent: true,
      depthWrite: false,
      toneMapped: false,
    }),
    0.308,
    0.708,
    0.431
  );
  warnPlate.rotation.z = 0.0;
  warnPlate.renderOrder = 5;

  /* ---------------- blue header band ---------------- */

  add(root, rbox(1.042, 0.122, 0.112, 0.02), azureDeep, 0, 1.398, 0.345, true, false);
  add(
    root,
    new THREE.PlaneGeometry(1.02, 0.11),
    new THREE.MeshBasicMaterial({ map: headerTexture(), toneMapped: false }),
    0,
    1.398,
    0.4025
  );
  add(root, rbox(1.044, 0.008, 0.114, 0.003), azurePale, 0, 1.339, 0.345);

  /* ---------------- marquee (UFO PORTFOLIO) — clean rounded pink ears ---------------- */

  add(root, rbox(1.03, 0.34, 0.18, 0.036), pink, 0, 1.608, 0.295, true, false);
  add(root, rbox(0.99, 0.305, 0.184, 0.028), pinkDeep, 0, 1.608, 0.302);

  // Clean smooth rounded pink vertical side ears/caps flush with the cabinet width (matching reference!)
  for (const sx of [-1, 1]) {
    add(root, rbox(0.052, 0.354, 0.198, 0.026), pink, sx * 0.494, 1.608, 0.288, true, false);
    add(root, rbox(0.032, 0.312, 0.188, 0.016), pinkDeep, sx * 0.488, 1.608, 0.294);
  }
  // Smooth rounded pink top cap matching reference silhouette
  add(root, rbox(1.016, 0.036, 0.19, 0.016), pink, 0, 1.775, 0.29, true, false);

  const marqueeTex = marqueeTexture();
  add(
    root,
    new THREE.PlaneGeometry(0.955, 0.292),
    backlit(marqueeTex, 0.45),
    0,
    1.608,
    0.3965
  );

  // Subtle pink inner bezel framing the glowing cyan marquee
  add(root, rbox(0.98, 0.02, 0.014, 0.006), pink, 0, 1.756, 0.395);
  add(root, rbox(0.98, 0.02, 0.014, 0.006), pink, 0, 1.46, 0.395);
  add(root, rbox(0.02, 0.316, 0.014, 0.006), pink, -0.478, 1.608, 0.395);
  add(root, rbox(0.02, 0.316, 0.014, 0.006), pink, 0.478, 1.608, 0.395);

  // Dimensional glowing cyan neon border tubes around the marquee opening
  const marqueeNeon = new THREE.MeshBasicMaterial({ color: '#e6feff', toneMapped: false });
  const marqueeGlow = new THREE.MeshBasicMaterial({
    color: '#7ef0ff',
    transparent: true,
    opacity: 0.36,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  for (const [w, h, x, y] of [
    [0.915, 0.014, 0, 1.741],
    [0.915, 0.014, 0, 1.475],
    [0.014, 0.27, -0.456, 1.608],
    [0.014, 0.27, 0.456, 1.608],
  ] as const) {
    add(root, new THREE.PlaneGeometry(w, h), marqueeGlow, x, y, 0.402).renderOrder = 4;
    add(root, new THREE.CylinderGeometry(0.0046, 0.0046, w > h ? w : h, 8), marqueeNeon, x, y, 0.405).rotation.z =
      w > h ? Math.PI / 2 : 0;
  }

  // Top-right ポートフォリオ sticker tilted CLOCKWISE matching reference/target.png!
  const cornerSticker = add(
    root,
    new THREE.PlaneGeometry(0.245, 0.052),
    new THREE.MeshBasicMaterial({
      map: cornerStickerTexture(),
      transparent: true,
      depthWrite: false,
      toneMapped: false,
    }),
    0.378,
    1.735,
    0.414
  );
  cornerSticker.rotation.z = -0.15;
  cornerSticker.renderOrder = 5;

  // Vertical ポートフォリオ sticker on the front of the right blue pillar
  const sideTex = sideDecalTexture();
  const frontPillarDecal = add(
    root,
    new THREE.PlaneGeometry(0.068, 0.34),
    new THREE.MeshBasicMaterial({ map: sideTex, transparent: true, depthWrite: false, toneMapped: false }),
    0.486,
    1.03,
    frameZ + 0.0455
  );
  frontPillarDecal.renderOrder = 4;

  // Colorful peeking rectangular stickers on the left blue pillar outer edge (matching reference!)
  const leftEdgeDecal = add(
    root,
    new THREE.PlaneGeometry(0.068, 0.36),
    new THREE.MeshBasicMaterial({
      map: leftEdgeStickersTexture(),
      transparent: true,
      depthWrite: false,
      toneMapped: false,
    }),
    -0.488,
    1.04,
    frameZ + 0.0455
  );
  leftEdgeDecal.renderOrder = 4;

  // Side decals from atlas
  label(root, atlas, rects, 'たんけんちゅう', 0.1, 0.034, -0.53, 1.05, 0.1, -Math.PI / 2, 0.05);
  label(root, atlas, rects, 'HANDLE WITH CARE', 0.15, 0.052, -0.517, 0.34, 0.05, -Math.PI / 2, 0.01);
  label(root, atlas, rects, 'PRIZE', 0.09, 0.032, 0.517, 0.27, -0.08, Math.PI / 2, -0.015);
  label(root, atlas, rects, 'WARNING', 0.12, 0.042, 0.517, 0.5, -0.16, Math.PI / 2, 0.01);

  /* ---------------- button behaviour ---------------- */

  let press = 0;
  let enabled = true;
  const capBaseY = capGroup.position.y;

  function pressButton() {
    press = 1;
  }

  function setButtonEnabled(on: boolean) {
    enabled = on;
    capMat.emissiveIntensity = on ? 1.15 : 0.12;
    (btnGlowRing.material as THREE.MeshStandardMaterial).emissiveIntensity = on ? 1.4 : 0.15;
  }

  function update(dt: number) {
    if (press > 0) {
      press = Math.max(0, press - dt * 5.0);
      capGroup.position.y = capBaseY - 0.011 * Math.sin((1 - press) * Math.PI);
    }
    const pulse = enabled ? 1.15 + Math.sin(performance.now() * 0.0036) * 0.1 : 0.12;
    capMat.emissiveIntensity = pulse;
  }

  return { root, glass, buttonHit, pressButton, setButtonEnabled, update, stick, capGroup };
}
