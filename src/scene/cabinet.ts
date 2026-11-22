import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { CAB, backlit, candy, chrome, glow, matte, plastic, printed, rubber } from './materials';
import { decalMesh } from './decals';
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

function texture(c: HTMLCanvasElement) {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
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

/* ---------- mascots (vector, so they stay crisp at any atlas size) ---------- */

function drawUfo(g: CanvasRenderingContext2D, x: number, y: number, s = 1, beam = false) {
  g.save();
  g.translate(x, y);
  g.scale(s, s);
  g.lineJoin = 'round';

  if (beam) {
    const beamGrad = g.createLinearGradient(0, 26, 0, 130);
    beamGrad.addColorStop(0, 'rgba(150,245,255,0.65)');
    beamGrad.addColorStop(1, 'rgba(150,245,255,0)');
    g.fillStyle = beamGrad;
    g.beginPath();
    g.moveTo(-20, 24);
    g.lineTo(20, 24);
    g.lineTo(56, 132);
    g.lineTo(-56, 132);
    g.closePath();
    g.fill();
  }

  // glass dome
  g.fillStyle = '#d9f8ff';
  g.strokeStyle = '#6fc9ea';
  g.lineWidth = 4;
  g.beginPath();
  g.ellipse(0, 2, 34, 30, 0, Math.PI, Math.PI * 2);
  g.fill();
  g.stroke();

  // alien pilot
  g.fillStyle = '#7ee081';
  g.beginPath();
  g.ellipse(0, -4, 13, 15, 0, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = '#1e2a22';
  for (const sx of [-1, 1]) {
    g.beginPath();
    g.ellipse(sx * 4.6, -6, 2.6, 4, 0, 0, Math.PI * 2);
    g.fill();
  }
  g.strokeStyle = '#7ee081';
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

  // saucer
  g.fillStyle = '#a97bff';
  g.strokeStyle = '#6b3fd4';
  g.lineWidth = 5;
  g.beginPath();
  g.ellipse(0, 16, 62, 19, 0, 0, Math.PI * 2);
  g.fill();
  g.stroke();
  g.fillStyle = '#c9a6ff';
  g.beginPath();
  g.ellipse(0, 10, 46, 10, 0, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = '#8a5cf0';
  g.beginPath();
  g.ellipse(0, 25, 36, 8, 0, 0, Math.PI * 2);
  g.fill();

  // running lights
  const lights = ['#ffd21e', '#ff7fb2', '#7bf4ff', '#ffd21e', '#9bffb5'];
  lights.forEach((col, i) => {
    g.fillStyle = col;
    g.beginPath();
    g.arc(-36 + i * 18, 27, 4.2, 0, Math.PI * 2);
    g.fill();
  });

  // highlight
  g.strokeStyle = 'rgba(255,255,255,0.85)';
  g.lineWidth = 3.4;
  g.beginPath();
  g.arc(-8, -8, 18, Math.PI * 1.08, Math.PI * 1.62);
  g.stroke();

  g.restore();
}

function drawCat(g: CanvasRenderingContext2D, x: number, y: number, s = 1) {
  g.save();
  g.translate(x, y);
  g.scale(s, s);
  g.lineJoin = 'round';

  // ears
  g.fillStyle = '#fbeef2';
  g.strokeStyle = '#e7a4bc';
  g.lineWidth = 3.4;
  for (const sx of [-1, 1]) {
    g.beginPath();
    g.moveTo(sx * 34, -22);
    g.lineTo(sx * 24, -58);
    g.lineTo(sx * 4, -36);
    g.closePath();
    g.fill();
    g.stroke();
  }
  g.fillStyle = '#ffb6cd';
  for (const sx of [-1, 1]) {
    g.beginPath();
    g.moveTo(sx * 29, -28);
    g.lineTo(sx * 24, -48);
    g.lineTo(sx * 12, -35);
    g.closePath();
    g.fill();
  }

  // head
  g.fillStyle = '#fffdfd';
  g.strokeStyle = '#e7a4bc';
  g.lineWidth = 3.6;
  g.beginPath();
  g.ellipse(0, 0, 46, 41, 0, 0, Math.PI * 2);
  g.fill();
  g.stroke();

  // blush
  g.fillStyle = 'rgba(255,150,185,0.55)';
  for (const sx of [-1, 1]) {
    g.beginPath();
    g.ellipse(sx * 29, 9, 8, 5, 0, 0, Math.PI * 2);
    g.fill();
  }

  // eyes + nose
  g.fillStyle = '#231a22';
  for (const sx of [-1, 1]) {
    g.beginPath();
    g.ellipse(sx * 15, -4, 4.4, 6.2, 0, 0, Math.PI * 2);
    g.fill();
  }
  g.fillStyle = '#ee7fa4';
  g.beginPath();
  g.moveTo(0, 9);
  g.lineTo(-5, 3);
  g.lineTo(5, 3);
  g.closePath();
  g.fill();

  // mouth
  g.strokeStyle = '#7a4155';
  g.lineWidth = 2.4;
  g.beginPath();
  g.arc(-5, 11, 6, 0.05 * Math.PI, 0.95 * Math.PI);
  g.stroke();
  g.beginPath();
  g.arc(5, 11, 6, 0.05 * Math.PI, 0.95 * Math.PI);
  g.stroke();

  // whiskers
  g.strokeStyle = 'rgba(120,70,90,0.45)';
  g.lineWidth = 2;
  for (const sx of [-1, 1]) {
    for (const k of [-1, 0, 1]) {
      g.beginPath();
      g.moveTo(sx * 20, 8 + k * 4);
      g.lineTo(sx * 45, 3 + k * 8);
      g.stroke();
    }
  }

  // collar
  g.strokeStyle = '#4d8fe0';
  g.lineWidth = 7;
  g.beginPath();
  g.arc(0, 30, 32, 0.16 * Math.PI, 0.84 * Math.PI);
  g.stroke();
  g.fillStyle = '#ffd21e';
  g.strokeStyle = '#c99e00';
  g.lineWidth = 2;
  g.beginPath();
  g.arc(0, 48, 7, 0, Math.PI * 2);
  g.fill();
  g.stroke();

  g.restore();
}

function drawStar(g: CanvasRenderingContext2D, x: number, y: number, r: number, fill: string) {
  g.save();
  g.translate(x, y);
  g.fillStyle = fill;
  g.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
    const rr = i % 2 === 0 ? r : r * 0.44;
    const px = Math.cos(a) * rr;
    const py = Math.sin(a) * rr;
    if (i === 0) g.moveTo(px, py);
    else g.lineTo(px, py);
  }
  g.closePath();
  g.fill();
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

/* ------------------------------------------------------------------ */
/* printed panels                                                      */
/* ------------------------------------------------------------------ */

export function marqueeTexture() {
  const c = canvas(1440, 420);
  const g = c.getContext('2d')!;

  const bg = g.createLinearGradient(0, 0, 0, 420);
  bg.addColorStop(0, '#dcf9ff');
  bg.addColorStop(0.36, '#9ce6fb');
  bg.addColorStop(0.72, '#63ccf4');
  bg.addColorStop(1, '#43b6e6');
  g.fillStyle = bg;
  g.fillRect(0, 0, 1440, 420);

  // diffuser glow
  const hot = g.createRadialGradient(720, 190, 30, 720, 190, 650);
  hot.addColorStop(0, 'rgba(255,255,255,0.75)');
  hot.addColorStop(0.5, 'rgba(255,255,255,0.22)');
  hot.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = hot;
  g.fillRect(0, 0, 1440, 420);

  // faint dot screen, like printed acrylic
  g.fillStyle = 'rgba(255,255,255,0.18)';
  for (let y = 18; y < 420; y += 16) {
    for (let x = 18 + ((y / 16) % 2) * 8; x < 1440; x += 16) {
      g.beginPath();
      g.arc(x, y, 1.3, 0, Math.PI * 2);
      g.fill();
    }
  }

  // frame
  g.strokeStyle = 'rgba(255,255,255,0.95)';
  g.lineWidth = 7;
  roundRect(g, 16, 16, 1408, 388, 26);
  g.stroke();
  g.strokeStyle = 'rgba(217,79,139,0.5)';
  g.lineWidth = 3;
  roundRect(g, 32, 32, 1376, 356, 20);
  g.stroke();

  // corner stars
  drawSparkle(g, 52, 52, 18, 'rgba(255,255,255,0.9)');
  drawSparkle(g, 1388, 52, 14, 'rgba(255,255,255,0.8)');
  drawSparkle(g, 1386, 372, 18, 'rgba(255,255,255,0.75)');

  // headline: chunky white bubble letters, hot-pink rim, deep-pink print shadow
  const headline = 'UFO PORTFOLIO';
  const size = fitFont(g, headline, 1010, 134, 900, ROUND);
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.lineJoin = 'round';
  g.font = `900 ${size}px ${ROUND}`;
  g.fillStyle = 'rgba(180,35,100,0.42)';
  g.fillText(headline, 728, 266);
  g.strokeStyle = '#ffffff';
  g.lineWidth = 34;
  g.strokeText(headline, 720, 254);
  g.strokeStyle = '#e2558f';
  g.lineWidth = 19;
  g.strokeText(headline, 720, 254);
  g.fillStyle = '#ffffff';
  g.fillText(headline, 720, 254);
  g.strokeStyle = 'rgba(216,240,255,0.65)';
  g.lineWidth = 5;
  g.strokeText(headline, 715, 246);

  // UFO mascot, top-left
  drawUfo(g, 98, 78, 1.02, false);

  // たんけんちゅう sticker
  g.save();
  g.translate(206, 168);
  g.rotate(-0.08);
  g.shadowColor = 'rgba(90,20,55,0.28)';
  g.shadowBlur = 10;
  g.shadowOffsetY = 6;
  g.fillStyle = '#dd7ba6';
  roundRect(g, -146, -31, 292, 62, 31);
  g.fill();
  g.shadowColor = 'transparent';
  g.strokeStyle = '#ffffff';
  g.lineWidth = 5;
  roundRect(g, -142, -27, 284, 54, 27);
  g.stroke();
  g.fillStyle = '#ffffff';
  g.font = `800 32px ${JP}`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText('たんけんちゅう', 0, 2);
  g.restore();

  // vertical ポートフォリオ, right edge
  const chars = 'ポートフォリオ';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.lineJoin = 'round';
  g.font = `900 36px ${JP}`;
  for (let i = 0; i < chars.length; i++) {
    const y = 56 + i * 44;
    g.strokeStyle = '#ffffff';
    g.lineWidth = 7;
    g.strokeText(chars[i], 1378, y);
    g.fillStyle = '#d94f8b';
    g.fillText(chars[i], 1378, y);
  }
  g.fillStyle = '#ffffff';
  for (const y of [30, 396]) {
    g.beginPath();
    g.arc(1378, y, 5, 0, Math.PI * 2);
    g.fill();
  }

  // cat mascot, bottom-right
  drawCat(g, 1248, 358, 0.92);

  const t = texture(c);
  return t;
}

export function headerTexture() {
  const c = canvas(2048, 248);
  const g = c.getContext('2d')!;

  const bg = g.createLinearGradient(0, 0, 0, 248);
  bg.addColorStop(0, '#4a9ae0');
  bg.addColorStop(0.45, '#2f7fce');
  bg.addColorStop(1, '#1f65b8');
  g.fillStyle = bg;
  g.fillRect(0, 0, 2048, 248);

  // soft diagonal sheen
  g.save();
  g.globalAlpha = 0.1;
  g.fillStyle = '#ffffff';
  for (let i = -240; i < 2048; i += 92) {
    g.beginPath();
    g.moveTo(i, 0);
    g.lineTo(i + 40, 0);
    g.lineTo(i - 120, 248);
    g.lineTo(i - 160, 248);
    g.fill();
  }
  g.restore();

  // light rails top / bottom
  g.fillStyle = '#eaf9ff';
  g.fillRect(0, 0, 2048, 7);
  g.fillStyle = 'rgba(255,255,255,0.5)';
  g.fillRect(0, 7, 2048, 3);
  g.fillStyle = '#bde6ff';
  g.fillRect(0, 241, 2048, 7);
  g.fillStyle = 'rgba(0,40,90,0.28)';
  g.fillRect(0, 234, 2048, 3);

  // left sticker cluster
  g.save();
  g.shadowColor = 'rgba(15,30,80,0.3)';
  g.shadowBlur = 8;
  g.shadowOffsetY = 4;
  const cluster: [number, number, number, string][] = [
    [128, 146, 44, '#ffe6f0'],
    [176, 112, 40, '#ffffff'],
    [214, 160, 38, '#ffe0a8'],
  ];
  for (const [x, y, r, col] of cluster) {
    g.fillStyle = col;
    g.beginPath();
    g.arc(x, y, r, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = '#ffffff';
    g.lineWidth = 5;
    g.stroke();
  }
  g.shadowColor = 'transparent';
  drawCat(g, 176, 112, 0.42);
  // strawberry
  g.fillStyle = '#e8262b';
  g.beginPath();
  g.ellipse(214, 170, 17, 20, 0, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = '#4fae4a';
  g.beginPath();
  g.moveTo(200, 156);
  g.lineTo(214, 145);
  g.lineTo(228, 156);
  g.closePath();
  g.fill();
  g.fillStyle = '#ffe8c8';
  for (const [sx, sy] of [
    [-6, 4],
    [5, 6],
    [-1, 12],
  ]) {
    g.beginPath();
    g.arc(214 + sx, 170 + sy, 1.8, 0, Math.PI * 2);
    g.fill();
  }
  g.restore();

  // クレーンゲーム: pink print with white keyline
  const word = 'クレーンゲーム';
  const size = fitFont(g, word, 1180, 172, 900);
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.lineJoin = 'round';
  g.font = `900 ${size}px ${JP}`;
  g.fillStyle = 'rgba(20,50,120,0.35)';
  g.fillText(word, 1040, 142);
  g.strokeStyle = '#ffffff';
  g.lineWidth = 22;
  g.strokeText(word, 1035, 132);
  g.fillStyle = '#ff8fbd';
  g.fillText(word, 1035, 132);
  g.strokeStyle = 'rgba(255,255,255,0.55)';
  g.lineWidth = 4;
  g.strokeText(word, 1032, 128);

  // warning sticker, right
  g.save();
  g.translate(1830, 122);
  g.rotate(0.045);
  g.shadowColor = 'rgba(10,25,70,0.35)';
  g.shadowBlur = 12;
  g.shadowOffsetY = 6;
  g.fillStyle = '#ffd21e';
  roundRect(g, -152, -66, 304, 132, 10);
  g.fill();
  g.shadowColor = 'transparent';
  g.strokeStyle = '#17141a';
  g.lineWidth = 8;
  roundRect(g, -148, -62, 296, 124, 8);
  g.stroke();
  g.fillStyle = '#17141a';
  g.textAlign = 'left';
  g.font = `900 46px ${ROUND}`;
  g.fillText('WARNING', -124, -14);
  g.font = `700 17px ${JP}`;
  g.fillText('注意 / 動く部品に手を近づけないでください', -124, 18);
  g.fillRect(-124, 30, 244, 2);
  g.font = `700 14px ${ROUND}`;
  g.fillText('KEEP HANDS CLEAR WHILE MACHINE IS RUNNING', -124, 49);
  // little hazard triangle
  g.beginPath();
  g.moveTo(112, -50);
  g.lineTo(136, -10);
  g.lineTo(88, -10);
  g.closePath();
  g.fill();
  g.fillStyle = '#ffd21e';
  g.font = `900 26px ${ROUND}`;
  g.textAlign = 'center';
  g.fillText('!', 112, -17);
  g.restore();

  drawSparkle(g, 620, 42, 12, 'rgba(255,255,255,0.65)');
  drawSparkle(g, 1520, 206, 10, 'rgba(255,255,255,0.5)');

  return texture(c);
}

export function bodyTexture() {
  const c = canvas(1024, 520);
  const g = c.getContext('2d')!;

  // porcelain panel with a faint warm blush at the bottom
  const bg = g.createLinearGradient(0, 0, 0, 520);
  bg.addColorStop(0, '#fffdfc');
  bg.addColorStop(0.65, '#fff7fa');
  bg.addColorStop(1, '#ffeef5');
  g.fillStyle = bg;
  roundRect(g, 4, 4, 1016, 512, 26);
  g.fill();
  g.strokeStyle = 'rgba(221,123,166,0.55)';
  g.lineWidth = 5;
  roundRect(g, 8, 8, 1008, 504, 22);
  g.stroke();
  g.strokeStyle = 'rgba(255,255,255,0.9)';
  g.lineWidth = 2;
  roundRect(g, 16, 16, 992, 488, 18);
  g.stroke();

  // big round UFO badge, top-left
  g.save();
  g.translate(96, 96);
  g.shadowColor = 'rgba(90,20,55,0.2)';
  g.shadowBlur = 10;
  g.shadowOffsetY = 5;
  g.fillStyle = '#ffe6a8';
  g.beginPath();
  g.arc(0, 0, 62, 0, Math.PI * 2);
  g.fill();
  g.shadowColor = 'transparent';
  const wedges = ['#ffd9e8', '#bfe4ff', '#fff3c4', '#e6d6ff'];
  wedges.forEach((col, i) => {
    g.fillStyle = col;
    g.beginPath();
    g.moveTo(0, 0);
    g.arc(0, 0, 56, (i / 4) * Math.PI * 2, ((i + 1) / 4) * Math.PI * 2);
    g.closePath();
    g.fill();
  });
  g.fillStyle = '#fffdfc';
  g.beginPath();
  g.arc(0, 0, 42, 0, Math.PI * 2);
  g.fill();
  drawUfo(g, 0, 2, 0.48, false);
  g.strokeStyle = '#dd7ba6';
  g.lineWidth = 5;
  g.beginPath();
  g.arc(0, 0, 60, 0, Math.PI * 2);
  g.stroke();
  g.restore();

  // pink logotype, two lines
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.lineJoin = 'round';
  const lines = ['クレーンゲーム', 'ポートフォリオ'];
  lines.forEach((word, i) => {
    const size = fitFont(g, word, 610, 86, 900);
    g.font = `900 ${size}px ${JP}`;
    const y = 148 + i * 110;
    g.fillStyle = 'rgba(90,169,230,0.45)';
    g.fillText(word, 494, y + 7);
    g.strokeStyle = '#ffffff';
    g.lineWidth = 13;
    g.strokeText(word, 490, y);
    g.fillStyle = '#e2558f';
    g.fillText(word, 490, y);
    g.strokeStyle = 'rgba(255,255,255,0.5)';
    g.lineWidth = 3;
    g.strokeText(word, 488, y - 2);
  });

  drawStar(g, 640, 300, 18, '#b28cff');

  // right: cat mascot
  drawCat(g, 852, 168, 1.02);

  // red/white warning, tucked between the prize door and the coin door
  g.save();
  g.translate(662, 414);
  g.rotate(0.06);
  g.scale(0.92, 0.92);
  g.shadowColor = 'rgba(60,10,20,0.22)';
  g.shadowBlur = 10;
  g.shadowOffsetY = 4;
  g.fillStyle = '#fffdfc';
  roundRect(g, -78, -48, 156, 96, 8);
  g.fill();
  g.shadowColor = 'transparent';
  g.strokeStyle = '#e8262b';
  g.lineWidth = 7;
  roundRect(g, -74, -44, 148, 88, 6);
  g.stroke();
  g.fillStyle = '#e8262b';
  g.font = `900 28px ${ROUND}`;
  g.textAlign = 'center';
  g.fillText('WARNING', 0, -5);
  g.fillStyle = '#3a2028';
  g.font = `700 12px ${ROUND}`;
  g.fillText('DO NOT TILT OR SHAKE', 0, 20);
  g.fillText('PRIZE 保證對象外', 0, 36);
  g.restore();

  // small print
  g.fillStyle = 'rgba(80,60,70,0.5)';
  g.font = `700 15px ${ROUND}`;
  g.textAlign = 'left';
  g.fillText('MADE IN JAPAN', 508, 492);
  g.textAlign = 'right';
  g.fillText('UFO-1024 / 100V', 990, 492);

  // decorative dots
  g.fillStyle = 'rgba(242,167,195,0.55)';
  for (let i = 0; i < 6; i++) {
    g.beginPath();
    g.arc(690 + i * 16, 86, 3.4, 0, Math.PI * 2);
    g.fill();
  }

  return texture(c);
}

export function deckTexture() {
  const c = canvas(1024, 341);
  const g = c.getContext('2d')!;

  const bg = g.createLinearGradient(0, 0, 0, 341);
  bg.addColorStop(0, '#5aa9e6');
  bg.addColorStop(0.5, '#3f8fe0');
  bg.addColorStop(1, '#2f78c6');
  g.fillStyle = bg;
  g.fillRect(0, 0, 1024, 341);

  // sheen
  const sheen = g.createRadialGradient(380, 80, 20, 380, 80, 520);
  sheen.addColorStop(0, 'rgba(255,255,255,0.22)');
  sheen.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = sheen;
  g.fillRect(0, 0, 1024, 341);

  // inset line
  g.strokeStyle = 'rgba(255,255,255,0.55)';
  g.lineWidth = 4;
  roundRect(g, 12, 12, 1000, 317, 20);
  g.stroke();
  g.strokeStyle = 'rgba(20,60,110,0.28)';
  g.lineWidth = 2;
  roundRect(g, 22, 22, 980, 297, 16);
  g.stroke();

  const arrow = (x: number, y: number, dir: 'left' | 'right' | 'up' | 'down') => {
    g.save();
    g.translate(x, y);
    if (dir === 'left') g.rotate(Math.PI / 2);
    if (dir === 'right') g.rotate(-Math.PI / 2);
    if (dir === 'up') g.rotate(0);
    if (dir === 'down') g.rotate(Math.PI);
    // pointing up in local space
    g.shadowColor = 'rgba(10,40,90,0.35)';
    g.shadowBlur = 6;
    g.shadowOffsetY = 4;
    g.fillStyle = '#ffffff';
    g.beginPath();
    g.moveTo(0, -34);
    g.lineTo(26, -8);
    g.lineTo(10, -8);
    g.lineTo(10, 28);
    g.lineTo(-10, 28);
    g.lineTo(-10, -8);
    g.lineTo(-26, -8);
    g.closePath();
    g.fill();
    g.restore();
  };

  // arrows around the joystick (joystick sits at 192, 191 on this print)
  arrow(78, 191, 'left');
  arrow(306, 191, 'right');
  arrow(192, 278, 'down');
  arrow(192, 68, 'up');

  // tiny machine name on the rear edge
  g.fillStyle = 'rgba(255,255,255,0.4)';
  g.font = `800 26px ${JP}`;
  g.textAlign = 'center';
  g.fillText('クレーンゲーム', 530, 52);

  // PLAY / スタート under the button
  g.fillStyle = 'rgba(20,50,110,0.35)';
  g.font = `900 40px ${ROUND}`;
  g.textAlign = 'center';
  g.fillText('PLAY / スタート', 756, 302);
  g.fillStyle = '#ffffff';
  g.fillText('PLAY / スタート', 753, 297);

  // smiley sticker near the left corner
  g.save();
  g.translate(58, 52);
  g.rotate(-0.12);
  drawSmileyDeck(g, 0, 0, 28);
  g.restore();

  // yellow warning on the right rear
  g.save();
  g.translate(940, 54);
  g.rotate(0.08);
  g.fillStyle = '#ffd21e';
  roundRect(g, -76, -30, 152, 60, 7);
  g.fill();
  g.strokeStyle = '#17141a';
  g.lineWidth = 5;
  roundRect(g, -73, -27, 146, 54, 5);
  g.stroke();
  g.fillStyle = '#17141a';
  g.font = `900 22px ${ROUND}`;
  g.fillText('WARNING', 0, -1);
  g.font = `700 10px ${JP}`;
  g.fillText('あぶない / CAUTION', 0, 16);
  g.restore();

  drawSparkle(g, 430, 60, 10, 'rgba(255,255,255,0.5)');
  drawSparkle(g, 900, 280, 8, 'rgba(255,255,255,0.4)');

  return texture(c);
}

function drawSmileyDeck(g: CanvasRenderingContext2D, x: number, y: number, r: number) {
  g.fillStyle = '#ffd21e';
  g.beginPath();
  g.arc(x, y, r, 0, Math.PI * 2);
  g.fill();
  g.strokeStyle = '#17141a';
  g.lineWidth = 3.4;
  g.stroke();
  g.fillStyle = '#17141a';
  for (const sx of [-1, 1]) {
    g.beginPath();
    g.ellipse(x + sx * r * 0.33, y - r * 0.18, r * 0.1, r * 0.14, 0, 0, Math.PI * 2);
    g.fill();
  }
  g.strokeStyle = '#17141a';
  g.lineWidth = 3.6;
  g.lineCap = 'round';
  g.beginPath();
  g.arc(x, y + r * 0.02, r * 0.44, 0.18 * Math.PI, 0.82 * Math.PI);
  g.stroke();
}

function sideDecalTexture() {
  const c = canvas(160, 420);
  const g = c.getContext('2d')!;
  const chars = 'ポートフォリオ';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.lineJoin = 'round';
  g.font = `900 34px ${JP}`;
  for (let i = 0; i < chars.length; i++) {
    const y = 52 + i * 48;
    g.strokeStyle = 'rgba(255,255,255,0.95)';
    g.lineWidth = 8;
    g.strokeText(chars[i], 80, y);
    g.fillStyle = '#d94f8b';
    g.fillText(chars[i], 80, y);
  }
  g.fillStyle = '#ffffff';
  for (const y of [18, 398]) {
    g.beginPath();
    g.arc(80, y, 4.5, 0, Math.PI * 2);
    g.fill();
  }
  drawSparkle(g, 80, 30, 10, 'rgba(255,255,255,0.85)');
  drawSparkle(g, 80, 388, 10, 'rgba(255,255,255,0.85)');
  return texture(c);
}

function chamberBackTexture() {
  const c = canvas(512, 512);
  const g = c.getContext('2d')!;
  const bg = g.createLinearGradient(0, 0, 0, 512);
  bg.addColorStop(0, '#dff5ff');
  bg.addColorStop(0.45, '#a6dbf8');
  bg.addColorStop(1, '#6fb9ea');
  g.fillStyle = bg;
  g.fillRect(0, 0, 512, 512);

  // soft wide light band, like the inside of a real lightbox
  const band = g.createLinearGradient(0, 0, 512, 0);
  band.addColorStop(0, 'rgba(255,255,255,0)');
  band.addColorStop(0.5, 'rgba(255,255,255,0.55)');
  band.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = band;
  g.fillRect(0, 0, 512, 512);

  // clouds
  g.fillStyle = 'rgba(255,255,255,0.55)';
  for (const [x, y, s] of [
    [90, 380, 1],
    [420, 330, 0.8],
    [260, 440, 1.2],
  ]) {
    for (const [dx, dy, r] of [
      [-38, 6, 26],
      [-8, -8, 34],
      [26, 2, 28],
      [50, 10, 20],
    ]) {
      g.beginPath();
      g.ellipse(x + dx * s, y + dy * s, r * s, (r * 0.62) * s, 0, 0, Math.PI * 2);
      g.fill();
    }
  }

  // faint brand watermark low on the wall
  g.fillStyle = 'rgba(255,255,255,0.52)';
  g.textAlign = 'center';
  g.font = `900 42px ${ROUND}`;
  g.fillText('UFO PORTFOLIO', 256, 486);
  g.font = `700 18px ${JP}`;
  g.fillText('たのしい クレーンゲーム', 256, 512 - 10);

  return texture(c);
}

function innerShadowTexture() {
  const c = canvas(256, 256);
  const g = c.getContext('2d')!;
  const lg = g.createLinearGradient(0, 0, 0, 256);
  lg.addColorStop(0, 'rgba(4,2,4,0.97)');
  lg.addColorStop(0.35, 'rgba(4,2,4,0.7)');
  lg.addColorStop(0.72, 'rgba(4,2,4,0.34)');
  lg.addColorStop(1, 'rgba(4,2,4,0.82)');
  g.fillStyle = lg;
  g.fillRect(0, 0, 256, 256);
  const rg = g.createRadialGradient(70, 60, 8, 70, 60, 160);
  rg.addColorStop(0, 'rgba(255,220,190,0.1)');
  rg.addColorStop(1, 'rgba(255,220,190,0)');
  g.fillStyle = rg;
  g.fillRect(0, 0, 256, 256);
  return texture(c);
}

function streakTexture() {
  const c = canvas(256, 32);
  const g = c.getContext('2d')!;
  const lg = g.createLinearGradient(0, 0, 256, 0);
  lg.addColorStop(0, 'rgba(255,255,255,0)');
  lg.addColorStop(0.36, 'rgba(255,255,255,0.85)');
  lg.addColorStop(0.58, 'rgba(255,255,255,0.5)');
  lg.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = lg;
  g.fillRect(0, 0, 256, 32);
  return texture(c);
}

/* ------------------------------------------------------------------ */
/* small hardware maps                                                 */
/* ------------------------------------------------------------------ */

let screwHead: THREE.Texture | null = null;

/** machined screw head with a cross recess (the whole point of a screw) */
function screwHeadTexture() {
  if (screwHead) return screwHead;
  const c = canvas(128, 128);
  const g = c.getContext('2d')!;
  const grad = g.createRadialGradient(48, 40, 3, 64, 64, 63);
  grad.addColorStop(0, '#ffffff');
  grad.addColorStop(0.5, '#cdd3da');
  grad.addColorStop(0.86, '#9aa1aa');
  grad.addColorStop(1, '#727984');
  g.fillStyle = grad;
  g.beginPath();
  g.arc(64, 64, 62, 0, Math.PI * 2);
  g.fill();

  // rolled edge
  g.strokeStyle = 'rgba(58,64,72,0.8)';
  g.lineWidth = 5;
  g.beginPath();
  g.arc(64, 64, 58, 0, Math.PI * 2);
  g.stroke();

  g.save();
  g.translate(64, 64);
  g.rotate(0.09);
  g.fillStyle = 'rgba(26,28,32,0.96)';
  roundRect(g, -43, -8, 86, 16, 6);
  g.fill();
  roundRect(g, -8, -43, 16, 86, 6);
  g.fill();
  // lit lip inside the recess
  g.fillStyle = 'rgba(255,255,255,0.45)';
  roundRect(g, -41, 4, 82, 3.5, 2);
  g.fill();
  roundRect(g, 4, -41, 3.5, 82, 2);
  g.fill();
  g.restore();

  screwHead = texture(c);
  screwHead.anisotropy = 8;
  return screwHead;
}

let perfMask: THREE.Texture | null = null;

/** perforated steel: dark holes in a brushed plate */
function perforationTexture() {
  if (perfMask) return perfMask;
  const c = canvas(256, 256);
  const g = c.getContext('2d')!;
  g.fillStyle = '#2b2e35';
  g.fillRect(0, 0, 256, 256);

  // brushed streaks
  for (let i = 0; i < 500; i++) {
    const y = Math.random() * 256;
    const v = 60 + Math.random() * 70;
    g.strokeStyle = `rgba(${v},${v + 4},${v + 10},0.18)`;
    g.beginPath();
    g.moveTo(0, y);
    g.lineTo(256, y + (Math.random() - 0.5) * 2);
    g.stroke();
  }

  for (let row = 0; row < 16; row++) {
    for (let col = 0; col < 16; col++) {
      const x = 8 + col * 16 + (row % 2) * 8;
      const y = 8 + row * 16;
      g.beginPath();
      g.arc(x, y, 4.6, 0, Math.PI * 2);
      g.fillStyle = '#05060a';
      g.fill();
      g.beginPath();
      g.arc(x, y + 1.4, 3.2, 0, Math.PI * 2);
      g.fillStyle = 'rgba(190,205,220,0.16)';
      g.fill();
    }
  }

  perfMask = texture(c);
  perfMask.wrapS = perfMask.wrapT = THREE.RepeatWrapping;
  perfMask.repeat.set(2, 2);
  perfMask.anisotropy = 8;
  return perfMask;
}

let keyholeFace: THREE.Texture | null = null;

/** brass key cylinder face with a real keyway */
function keyholeTexture() {
  if (keyholeFace) return keyholeFace;
  const c = canvas(128, 128);
  const g = c.getContext('2d')!;
  const grad = g.createRadialGradient(46, 40, 4, 64, 64, 62);
  grad.addColorStop(0, '#f6f3ea');
  grad.addColorStop(0.55, '#cdc5ae');
  grad.addColorStop(1, '#948b74');
  g.fillStyle = grad;
  g.beginPath();
  g.arc(64, 64, 62, 0, Math.PI * 2);
  g.fill();
  g.strokeStyle = 'rgba(70,62,48,0.65)';
  g.lineWidth = 4;
  g.beginPath();
  g.arc(64, 64, 57, 0, Math.PI * 2);
  g.stroke();

  g.fillStyle = '#17120c';
  g.beginPath();
  g.arc(64, 54, 12, 0, Math.PI * 2);
  g.fill();
  g.beginPath();
  g.moveTo(58, 62);
  g.lineTo(70, 62);
  g.lineTo(67, 92);
  g.lineTo(61, 92);
  g.closePath();
  g.fill();

  keyholeFace = texture(c);
  keyholeFace.anisotropy = 8;
  return keyholeFace;
}

let ledFace: THREE.Texture | null = null;

/** 3-digit seven-segment credit display behind smoked glass */
function ledDisplayTexture() {
  if (ledFace) return ledFace;
  const W = 320;
  const H = 128;
  const c = canvas(W, H);
  const g = c.getContext('2d')!;

  const bg = g.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, '#12090b');
  bg.addColorStop(0.6, '#070405');
  bg.addColorStop(1, '#0d0507');
  g.fillStyle = bg;
  g.fillRect(0, 0, W, H);

  // glass sheen
  const sheen = g.createLinearGradient(0, 0, W, H);
  sheen.addColorStop(0, 'rgba(255,255,255,0.10)');
  sheen.addColorStop(0.4, 'rgba(255,255,255,0.02)');
  sheen.addColorStop(1, 'rgba(255,255,255,0.06)');
  g.fillStyle = sheen;
  g.fillRect(0, 0, W, H);

  // micro label
  g.fillStyle = 'rgba(255,120,105,0.55)';
  g.font = '700 15px "SF Mono", Menlo, monospace';
  g.textAlign = 'left';
  g.fillText('CREDIT', 16, 24);
  g.textAlign = 'right';
  g.fillText('¥', W - 16, 24);

  const seg = (x: number, y: number, w: number, h: number, r: number, on: boolean) => {
    g.save();
    if (on) {
      g.shadowColor = 'rgba(255,42,20,0.85)';
      g.shadowBlur = 14;
    }
    g.fillStyle = on ? '#ff351d' : 'rgba(255,60,40,0.075)';
    roundRect(g, x, y, w, h, r);
    g.fill();
    g.restore();
  };

  const digit = (x: number, y: number, w: number, h: number) => {
    const t = Math.max(6, w * 0.16);
    const gap = t * 0.55;
    const half = (h - t * 1.6) / 2;
    // a top, b top-right, c bottom-right, d bottom, e bottom-left, f top-left, g middle
    seg(x + gap, y, w - gap * 2, t, t / 2, true);
    seg(x + w - t, y + gap, t, half - gap, t / 2, true);
    seg(x + w - t, y + half + gap, t, half - gap, t / 2, true);
    seg(x + gap, y + h - t, w - gap * 2, t, t / 2, true);
    seg(x, y + half + gap, t, half - gap, t / 2, true);
    seg(x, y + gap, t, half - gap, t / 2, true);
    seg(x + gap, y + half - t / 2, w - gap * 2, t, t / 2, false);
  };

  const dw = 62;
  const dh = 86;
  const gapD = 18;
  const total = dw * 3 + gapD * 2;
  let x = (W - total) / 2;
  for (let i = 0; i < 3; i++) {
    digit(x, 30, dw, dh);
    x += dw + gapD;
  }

  // scanlines
  g.globalAlpha = 0.16;
  g.fillStyle = '#000000';
  for (let y = 0; y < H; y += 3) g.fillRect(0, y, W, 1);
  g.globalAlpha = 1;

  ledFace = texture(c);
  ledFace.anisotropy = 8;
  return ledFace;
}

/** soft contact shadow used under overhangs */
let aoTex: THREE.Texture | null = null;
function aoTexture() {
  if (aoTex) return aoTex;
  const c = canvas(64, 64);
  const g = c.getContext('2d')!;
  const grad = g.createLinearGradient(0, 0, 0, 64);
  grad.addColorStop(0, 'rgba(24,10,18,0.55)');
  grad.addColorStop(0.55, 'rgba(24,10,18,0.18)');
  grad.addColorStop(1, 'rgba(24,10,18,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  aoTex = texture(c);
  return aoTex;
}

/* ------------------------------------------------------------------ */
/* materials                                                           */
/* ------------------------------------------------------------------ */

export function glassMaterial() {
  const cheap =
    new URLSearchParams(location.search).has('notrans') ||
    (typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches);
  return new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    metalness: 0,
    transmission: cheap ? 0 : 1,
    opacity: cheap ? 0.09 : 1,
    thickness: 0.012,
    ior: 1.46,
    roughness: cheap ? 0.015 : 0.03,
    transparent: true,
    side: THREE.DoubleSide,
    envMapIntensity: cheap ? 2.8 : 1.15,
    specularIntensity: 1,
    reflectivity: 1,
  });
}

/* ------------------------------------------------------------------ */
/* geometry helpers                                                    */
/* ------------------------------------------------------------------ */

const rbox = (w: number, h: number, d: number, r = 0.01) =>
  new RoundedBoxGeometry(w, h, d, 3, Math.max(0.0015, Math.min(r, w / 2 - 0.001, h / 2 - 0.001, d / 2 - 0.001)));

function add(
  parent: THREE.Object3D,
  geo: THREE.BufferGeometry,
  mat: THREE.Material,
  x = 0,
  y = 0,
  z = 0,
  cast = true
) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.castShadow = cast;
  m.receiveShadow = true;
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
  // never stretch the print: fit the quad to the atlas rect's real aspect
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

  /* ---------------- mouldings ---------------- */

  const pink = candy(CAB.pink, { roughness: 0.2 });
  const pinkDeep = candy(CAB.pinkDeep, { roughness: 0.24 });
  const pinkInk = candy(CAB.pinkInk, { roughness: 0.26 });
  const azure = candy(CAB.azure, { roughness: 0.16, clearcoatRoughness: 0.04 });
  const azureMid = candy(CAB.azureMid, { roughness: 0.22 });
  const azureDeep = candy(CAB.azureDeep, { roughness: 0.3 });
  const azurePale = candy(CAB.azurePale, { roughness: 0.44, clearcoat: 0.5, clearcoatRoughness: 0.3 });
  const porcelain = candy(CAB.white, { roughness: 0.3, clearcoatRoughness: 0.14 });
  const canary = candy(CAB.yellow, { roughness: 0.28 });
  const ink = matte(CAB.ink);
  const rub = rubber();
  const chromeMat = chrome();
  const glass = glassMaterial();

  /* ---------------- mechanical kit ---------------- */

  const seamMat = matte('#2a1a24');
  const steel = plastic('#e4e8ee', { metalness: 0.95, roughness: 0.24 });
  // satin metal that still reads bright on a vertical face: a pure metal
  // only mirrors the dark front of the HDRI and turns into a black hole
  const chromeSoft = plastic('#e9edf2', { metalness: 0.45, roughness: 0.24, clearcoat: 0.9, clearcoatRoughness: 0.1 });
  const brushed = plastic('#a9b1ba', { metalness: 0.55, roughness: 0.36, clearcoat: 0.55, clearcoatRoughness: 0.18 });
  const screwFace = plastic('#f4f7fa', { metalness: 0.35, roughness: 0.26, clearcoat: 0.9, clearcoatRoughness: 0.12, map: screwHeadTexture() });
  const darkPlate = plastic('#24262c', { metalness: 0.6, roughness: 0.42, clearcoat: 0.35 });
  const perfMat = plastic('#ffffff', { metalness: 0.5, roughness: 0.4, map: perforationTexture() });
  const keyFace = plastic('#fbf8ee', { metalness: 0.3, roughness: 0.32, clearcoat: 0.8, clearcoatRoughness: 0.15, map: keyholeTexture() });
  const ledGlass = printed(ledDisplayTexture(), {
    emissive: new THREE.Color('#ffffff'),
    emissiveMap: ledDisplayTexture(),
    emissiveIntensity: 1.05,
    roughness: 0.14,
    clearcoat: 1,
    clearcoatRoughness: 0.02,
    envMapIntensity: 1.5,
  });

  function gapH(parent: THREE.Object3D, w: number, h: number, x: number, y: number, z: number) {
    return add(parent, new THREE.BoxGeometry(w, h, 0.002), seamMat, x, y, z, false);
  }

  function gapV(parent: THREE.Object3D, h: number, w: number, x: number, y: number, z: number) {
    return add(parent, new THREE.BoxGeometry(w, h, 0.002), seamMat, x, y, z, false);
  }

  /** cross-head machine screw with a washer, facing out of a panel */
  function screwAt(
    parent: THREE.Object3D,
    x: number,
    y: number,
    z: number,
    r = 0.0072,
    face: 'front' | 'top' | 'left' | 'right' = 'front',
    spin = 0
  ) {
    const grp = new THREE.Group();
    grp.position.set(x, y, z);
    if (face === 'top') grp.rotation.x = -Math.PI / 2;
    else if (face === 'right') grp.rotation.y = Math.PI / 2;
    else if (face === 'left') grp.rotation.y = -Math.PI / 2;
    grp.rotateZ(spin);

    const head = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 0.9, r * 0.44, 14), chromeMat);
    head.rotation.x = Math.PI / 2;
    head.position.z = r * 0.12;

    const washer = new THREE.Mesh(new THREE.TorusGeometry(r * 1.1, r * 0.09, 4, 16), chromeMat);
    washer.position.z = r * 0.03;

    const cap = new THREE.Mesh(new THREE.CircleGeometry(r * 0.92, 14), screwFace);
    cap.position.z = r * 0.35;

    for (const m of [head, washer, cap]) {
      m.castShadow = false;
      m.receiveShadow = true;
      grp.add(m);
    }
    parent.add(grp);
    return grp;
  }

  /** drilled speaker / vent panel */
  function perfPanel(
    parent: THREE.Object3D,
    w: number,
    h: number,
    x: number,
    y: number,
    z: number,
    rotY = 0
  ) {
    const m = add(parent, new THREE.PlaneGeometry(w, h), perfMat, x, y, z, false);
    m.rotation.y = rotY;
    return m;
  }

  /* ---------------- feet + lower body ---------------- */

  for (const [x, z] of [
    [-0.425, 0.3],
    [0.425, 0.3],
    [-0.425, -0.3],
    [0.425, -0.3],
  ]) {
    // rubber pad, chrome ferrule, levelling nut, steel mounting plate
    add(root, new THREE.CylinderGeometry(0.047, 0.055, 0.022, 24), rub, x, 0.011, z);
    add(root, new THREE.CylinderGeometry(0.05, 0.05, 0.003, 24), rub, x, 0.0235, z, false);
    add(root, new THREE.CylinderGeometry(0.046, 0.048, 0.012, 24), chromeSoft, x, 0.031, z);
    add(root, new THREE.CylinderGeometry(0.024, 0.024, 0.01, 6), chromeSoft, x, 0.041, z);
    add(root, rbox(0.092, 0.007, 0.092, 0.003), brushed, x, 0.0475, z, false);
  }

  const plinth = add(root, rbox(1.02, 0.555, 0.78, 0.05), pink, 0, 0.3225, 0);
  plinth.receiveShadow = true;

  // deep-pink base rail + a white pinstripe
  add(root, rbox(1.04, 0.062, 0.795, 0.022), pinkDeep, 0, 0.076, 0);
  add(root, rbox(1.042, 0.012, 0.797, 0.005), porcelain, 0, 0.112, 0, false);

  // white belly panel
  add(root, rbox(0.9, 0.44, 0.02, 0.024), porcelain, 0, 0.375, 0.388);
  const bodyTex = bodyTexture();
  add(
    root,
    new THREE.PlaneGeometry(0.892, 0.432),
    printed(bodyTex, { transparent: true, depthWrite: true, roughness: 0.36, clearcoat: 0.5 }),
    0,
    0.375,
    0.3995,
    false
  );

  // chunky pink bezel proud of the print: the belly reads as an inset panel
  add(root, rbox(0.92, 0.024, 0.016, 0.006), pinkDeep, 0, 0.598, 0.3955, false);
  add(root, rbox(0.92, 0.024, 0.016, 0.006), pinkDeep, 0, 0.152, 0.3955, false);
  add(root, rbox(0.024, 0.47, 0.016, 0.006), pinkDeep, -0.457, 0.375, 0.3955, false);
  add(root, rbox(0.024, 0.47, 0.016, 0.006), pinkDeep, 0.457, 0.375, 0.3955, false);
  // shadow under the base rail
  gapH(root, 1.0, 0.004, 0, 0.0468, 0.4005);

  // shadow gaps where the belly moulding meets the plinth: this is what
  // breaks the shell into separate moulded panels instead of one blob
  gapH(root, 0.94, 0.006, 0, 0.5925, 0.4006);
  gapH(root, 0.94, 0.0055, 0, 0.1445, 0.3912);
  gapV(root, 0.452, 0.006, -0.4515, 0.375, 0.3912);
  gapV(root, 0.452, 0.006, 0.4515, 0.375, 0.3912);
  gapH(root, 1.01, 0.0045, 0, 0.1092, 0.4);

  // bezel is screwed down: fasteners sit on the pink rails, not on the art
  for (const sx of [-1, 1]) {
    for (const sy of [-1, 1]) {
      screwAt(root, sx * 0.457, 0.375 + sy * 0.095, 0.4046, 0.0055, 'front', sx * 0.4);
    }
    screwAt(root, sx * 0.3, 0.152, 0.4046, 0.0055, 'front', sx * 0.3);
  }

  /* ---------------- coin door + credit display ---------------- */

  const coinX = 0.3;
  const coinY = 0.3;
  const coinW = 0.17;
  const coinH = 0.155;

  // chrome backplate, brushed face, chrome retaining frame
  add(root, rbox(coinW, coinH, 0.007, 0.006), chromeSoft, coinX, coinY, 0.4025, false);
  add(root, rbox(coinW - 0.02, coinH - 0.02, 0.005, 0.004), brushed, coinX, coinY, 0.4064, false);
  const bez = 0.014;
  for (const seg of [
    [coinW, bez, 0, coinH / 2 - bez / 2],
    [coinW, bez, 0, -coinH / 2 + bez / 2],
    [bez, coinH - bez * 2, -coinW / 2 + bez / 2, 0],
    [bez, coinH - bez * 2, coinW / 2 - bez / 2, 0],
  ]) {
    add(root, rbox(seg[0], seg[1], 0.011, 0.004), chromeSoft, coinX + seg[2], coinY + seg[3], 0.4092, false);
  }

  // 3-digit red LED credit window
  add(root, rbox(0.09, 0.038, 0.006, 0.004), matte('#0a0709'), coinX - 0.028, 0.3385, 0.4098, false);
  add(root, new THREE.PlaneGeometry(0.082, 0.0328), ledGlass, coinX - 0.028, 0.3385, 0.4132, false);
  add(
    root,
    new THREE.PlaneGeometry(0.11, 0.05),
    new THREE.MeshBasicMaterial({
      color: '#ff3a22',
      transparent: true,
      opacity: 0.16,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
    coinX - 0.028,
    0.3385,
    0.4136,
    false
  ).renderOrder = 1;

  // coin entry: chrome block, vertical slot, insert-coin lamp
  add(root, rbox(0.028, 0.056, 0.009, 0.005), chromeSoft, coinX + 0.048, 0.336, 0.4105, false);
  add(root, new THREE.PlaneGeometry(0.005, 0.034), matte('#050407'), coinX + 0.048, 0.336, 0.4153, false);
  add(root, new THREE.PlaneGeometry(0.0016, 0.032), matte('#241018'), coinX + 0.048, 0.336, 0.4157, false);
  add(root, new THREE.CylinderGeometry(0.0042, 0.0042, 0.003, 12), glow('#6dffa8', 1.8), coinX + 0.048, 0.372, 0.415, false).rotation.x = Math.PI / 2;

  // key lock (cam lock on the coin door)
  add(root, new THREE.CylinderGeometry(0.016, 0.016, 0.008, 20), chromeSoft, coinX + 0.048, 0.283, 0.4102, false).rotation.x = Math.PI / 2;
  add(root, new THREE.CircleGeometry(0.013, 20), keyFace, coinX + 0.048, 0.283, 0.4148, false);

  // coin return button + its bezel
  add(root, new THREE.CylinderGeometry(0.0125, 0.0135, 0.008, 18), chromeSoft, coinX - 0.045, 0.253, 0.4095, false).rotation.x = Math.PI / 2;
  add(root, new THREE.CylinderGeometry(0.0085, 0.0095, 0.009, 16), plastic(CAB.red, { roughness: 0.4 }), coinX - 0.045, 0.253, 0.413, false).rotation.x = Math.PI / 2;

  // coin return cup below the door
  add(root, rbox(0.076, 0.038, 0.012, 0.007), chromeSoft, coinX, 0.199, 0.4018, false);
  add(root, rbox(0.058, 0.022, 0.004, 0.006), matte('#0a080b'), coinX, 0.199, 0.409, false);

  // coin door fixings
  for (const sx of [-1, 1]) {
    for (const sy of [-1, 1]) {
      screwAt(root, coinX + sx * 0.074, coinY + sy * 0.064, 0.4125, 0.0055, 'front', sx * 0.3);
    }
  }

  /* ---------------- louvred vents + side speakers ---------------- */

  for (const sx of [-1, 1]) {
    const vx = sx * 0.335;
    add(root, rbox(0.165, 0.05, 0.004, 0.005), brushed, vx, 0.076, 0.3975, false);
    add(root, rbox(0.148, 0.036, 0.003, 0.004), matte('#050406'), vx, 0.076, 0.3995, false);
    for (let i = 0; i < 4; i++) {
      add(root, rbox(0.138, 0.0042, 0.003, 0.0018), chromeSoft, vx, 0.076 + (i - 1.5) * 0.0082, 0.4008, false);
    }
  }

  for (const sx of [-1, 1]) {
    // perforated speaker grille on the side of the plinth
    const grp = new THREE.Group();
    grp.position.set(sx * 0.5105, 0.47, 0.015);
    grp.rotation.y = sx * (Math.PI / 2);
    root.add(grp);
    const disc = new THREE.Mesh(new THREE.CircleGeometry(0.062, 36), perfMat);
    disc.receiveShadow = true;
    grp.add(disc);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.0635, 0.0052, 6, 36), chromeSoft);
    grp.add(ring);
    for (let i = 0; i < 4; i++) {
      const a = Math.PI * 0.25 + i * (Math.PI / 2);
      screwAt(grp, Math.cos(a) * 0.0695, Math.sin(a) * 0.0695, 0.0038, 0.0042, 'front');
    }

    // rear-side air intake louvres
    for (let i = 0; i < 4; i++) {
      add(root, new THREE.BoxGeometry(0.004, 0.0055, 0.11), matte('#0a080b'), sx * 0.5105, 0.118 + i * 0.014, -0.16, false);
    }
    // panel screws on the flank
    screwAt(root, sx * 0.511, 0.56, 0.245, 0.0062, sx > 0 ? 'right' : 'left');
    screwAt(root, sx * 0.511, 0.16, 0.245, 0.0062, sx > 0 ? 'right' : 'left');
  }

  /* ---------------- prize door (bottom-left) ---------------- */

  const doorX = -0.265;
  const doorY = 0.263;
  const doorW = 0.27;
  const doorH = 0.152;

  // shallow shadow-box recess behind the opening: the belly panel is solid,
  // so the depth has to sit in front of the print (7 mm of real geometry)
  const recZ = 0.4006;
  add(root, new THREE.PlaneGeometry(doorW - 0.035, doorH - 0.035), new THREE.MeshBasicMaterial({ color: '#0b0609' }), doorX, doorY, recZ, false);
  const recMat = new THREE.MeshBasicMaterial({ color: '#120a10', side: THREE.DoubleSide });
  const recD = 0.012;
  for (const [w, h, x, y, rx] of [
    [doorW - 0.035, recD, doorX, doorY + (doorH - 0.035) / 2, -Math.PI / 2],
    [doorW - 0.035, recD, doorX, doorY - (doorH - 0.035) / 2, Math.PI / 2],
  ] as [number, number, number, number, number][]) {
    const wall = add(root, new THREE.PlaneGeometry(w, h), recMat, x, y, recZ + recD / 2, false);
    wall.rotation.x = rx;
  }
  for (const sx of [-1, 1]) {
    const wall = add(root, new THREE.PlaneGeometry(recD, doorH - 0.035), recMat, doorX + sx * (doorW - 0.035) / 2, doorY, recZ + recD / 2, false);
    wall.rotation.y = sx > 0 ? Math.PI / 2 : -Math.PI / 2;
  }
  add(
    root,
    new THREE.PlaneGeometry(doorW - 0.036, doorH - 0.036),
    new THREE.MeshBasicMaterial({ map: innerShadowTexture(), transparent: true, depthWrite: false, opacity: 0.94 }),
    doorX,
    doorY,
    recZ + 0.0015,
    false
  );

  // smoked flap, top-hinged a hair open
  const flap = add(
    root,
    new THREE.PlaneGeometry(doorW - 0.055, doorH - 0.06),
    new THREE.MeshPhysicalMaterial({
      color: '#241b28',
      roughness: 0.07,
      metalness: 0,
      transparent: true,
      opacity: 0.3,
      clearcoat: 1,
      clearcoatRoughness: 0.03,
      side: THREE.DoubleSide,
      envMapIntensity: 0.7,
      depthWrite: false,
    }),
    doorX,
    doorY - 0.004,
    0.4092,
    false
  );
  flap.rotation.x = -0.05;

  // chunky pink frame
  const bar = 0.024;
  add(root, rbox(bar, doorH + bar, 0.024, 0.008), pinkDeep, doorX - doorW / 2, doorY, 0.412);
  add(root, rbox(bar, doorH + bar, 0.024, 0.008), pinkDeep, doorX + doorW / 2, doorY, 0.412);
  add(root, rbox(doorW + bar, bar, 0.024, 0.008), pinkDeep, doorX, doorY + doorH / 2, 0.412);
  add(root, rbox(doorW + bar, bar, 0.024, 0.008), pinkDeep, doorX, doorY - doorH / 2, 0.412);

  // chrome retainer lip around the prize opening
  for (const [w, h, dx, dy] of [
    [doorW - 0.035, 0.007, 0, (doorH - 0.035) / 2],
    [doorW - 0.035, 0.007, 0, -(doorH - 0.035) / 2],
    [0.007, doorH - 0.035, -(doorW - 0.035) / 2, 0],
    [0.007, doorH - 0.035, (doorW - 0.035) / 2, 0],
  ]) {
    add(root, rbox(w, h, 0.007, 0.0025), chromeMat, doorX + dx, doorY + dy, 0.4245, false);
  }

  // two hinge leaves with knuckles and screws, proud of the frame
  for (const s of [-1, 1]) {
    const hx = doorX + s * 0.085;
    add(root, rbox(0.042, 0.018, 0.008, 0.003), chromeMat, hx, doorY + doorH / 2 + 0.012, 0.4295, false);
    add(root, rbox(0.036, 0.016, 0.008, 0.003), chromeMat, hx, doorY + doorH / 2 - 0.012, 0.4295, false);
    add(root, new THREE.CylinderGeometry(0.0068, 0.0068, 0.042, 12), chromeMat, hx, doorY + doorH / 2 + 0.002, 0.4362, false).rotation.z = Math.PI / 2;
    screwAt(root, hx, doorY + doorH / 2 + 0.012, 0.4342, 0.0046);
    screwAt(root, hx, doorY + doorH / 2 - 0.012, 0.4342, 0.0046);
  }

  // chrome pull handle on two standoffs, mounted on the bottom frame bar
  const handleY = doorY - doorH / 2 + 0.003;
  add(root, new THREE.CylinderGeometry(0.0048, 0.0048, 0.096, 12), chromeMat, doorX, handleY, 0.4358, false).rotation.z = Math.PI / 2;
  for (const s of [-1, 1]) {
    add(root, new THREE.CylinderGeometry(0.0058, 0.0058, 0.018, 10), chromeMat, doorX + s * 0.036, handleY, 0.4285, false).rotation.x = Math.PI / 2;
    add(root, new THREE.CylinderGeometry(0.0098, 0.0098, 0.002, 12), brushed, doorX + s * 0.036, handleY, 0.4298, false).rotation.x = Math.PI / 2;
  }

  // small cam lock in the door frame
  add(root, new THREE.CylinderGeometry(0.011, 0.011, 0.009, 16), brushed, doorX + doorW / 2, doorY - 0.03, 0.429, false).rotation.x = Math.PI / 2;
  add(root, new THREE.CircleGeometry(0.009, 16), keyFace, doorX + doorW / 2, doorY - 0.03, 0.4336, false);

  // faint bounce on the recess floor, kept inside the shadow box
  const doorGlow = add(
    root,
    new THREE.PlaneGeometry(doorW - 0.08, 0.016),
    new THREE.MeshBasicMaterial({
      color: '#c9a58f',
      transparent: true,
      opacity: 0.12,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
    doorX,
    doorY - doorH / 2 + 0.014,
    recZ + 0.0008,
    false
  );
  doorGlow.renderOrder = 1;

  /* ---------------- riser + console ---------------- */

  // the deck is the front-most moulding: keep the riser behind it, otherwise
  // it occludes the whole playfield print from the low game camera.
  add(root, rbox(1.0, 0.145, 0.17, 0.03), pink, 0, 0.657, 0.322);
  add(root, rbox(0.94, 0.022, 0.014, 0.008), pinkDeep, 0, 0.716, 0.402, false);

  const deck = new THREE.Group();
  deck.position.set(0, 0.585, 0.45);
  deck.rotation.x = 0.14;
  root.add(deck);

  add(deck, rbox(1.0, 0.074, 0.35, 0.03), azure, 0, 0, 0, true);
  add(deck, rbox(1.035, 0.036, 0.375, 0.014), pinkDeep, 0, -0.042, 0, true);
  add(deck, rbox(1.045, 0.012, 0.385, 0.005), pinkInk, 0, -0.064, 0, false);

  // deck is a screwed-down panel, not a single moulded lump
  gapH(deck, 0.99, 0.004, 0, -0.0243, 0.1888);
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) screwAt(deck, sx * 0.468, 0.0392, sz * 0.144, 0.0058, 'top', sx * 0.3);
    screwAt(deck, sx * 0.44, -0.042, 0.1895, 0.0054, 'front');
  }

  const deckPrint = add(
    deck,
    new THREE.PlaneGeometry(0.965, 0.325),
    printed(deckTexture(), { roughness: 0.34, clearcoat: 0.8, clearcoatRoughness: 0.08 }),
    0,
    0.0385,
    0,
    false
  );
  deckPrint.rotation.x = -Math.PI / 2;

  // joystick: fixed base + articulated stick (rod + ball), pivot at the deck
  const joyX = -0.3;
  const joyZ = 0.02;
  add(deck, rbox(0.138, 0.012, 0.138, 0.018), darkPlate, joyX, 0.0415, joyZ);
  add(deck, rbox(0.126, 0.006, 0.126, 0.012), ink, joyX, 0.0468, joyZ);
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) screwAt(deck, joyX + sx * 0.054, 0.0494, joyZ + sz * 0.054, 0.0046, 'top', sx * 0.2);
  }
  add(deck, new THREE.CylinderGeometry(0.056, 0.06, 0.02, 26), ink, joyX, 0.055, joyZ);
  add(deck, new THREE.CylinderGeometry(0.032, 0.04, 0.03, 20), rub, joyX, 0.073, joyZ);
  // moulded ribs + clamp on the rubber gaiter
  add(deck, new THREE.TorusGeometry(0.0375, 0.0032, 6, 26), rub, joyX, 0.0675, joyZ).rotation.x = Math.PI / 2;
  add(deck, new THREE.TorusGeometry(0.0345, 0.0028, 6, 26), rub, joyX, 0.0785, joyZ).rotation.x = Math.PI / 2;
  add(deck, new THREE.TorusGeometry(0.0405, 0.0036, 6, 28), chromeSoft, joyX, 0.0595, joyZ).rotation.x = Math.PI / 2;
  add(deck, new THREE.TorusGeometry(0.043, 0.0065, 8, 26), chromeMat, joyX, 0.069, joyZ).rotation.x = Math.PI / 2;
  add(deck, new THREE.TorusGeometry(0.054, 0.0045, 8, 26), pinkInk, joyX, 0.061, joyZ).rotation.x = Math.PI / 2;

  const stick = new THREE.Group();
  stick.position.set(joyX, 0.072, joyZ);
  stick.userData.noMerge = true; // si inclina con l'input
  deck.add(stick);

  const rodMat = new THREE.MeshPhysicalMaterial({
    color: '#e3e8ee',
    metalness: 1,
    roughness: 0.14,
    envMapIntensity: 1.8,
    transparent: true,
  });
  const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.0065, 0.0095, 0.082, 14), rodMat);
  rod.position.y = 0.041;
  rod.castShadow = true;
  stick.add(rod);

  const ballMat = candy(CAB.red, { roughness: 0.08, clearcoatRoughness: 0.03 });
  ballMat.transparent = true;
  const ball = new THREE.Mesh(new THREE.SphereGeometry(0.029, 30, 20), ballMat);
  ball.position.y = 0.1;
  ball.castShadow = true;
  stick.add(ball);

  // button: black ring + yellow illuminated cap, cap group animates on press
  const btnX = 0.235;
  const btnZ = -0.01;
  add(deck, new THREE.CylinderGeometry(0.082, 0.086, 0.02, 34), ink, btnX, 0.048, btnZ);
  add(deck, new THREE.TorusGeometry(0.0895, 0.0042, 6, 38), rub, btnX, 0.0408, btnZ).rotation.x = Math.PI / 2;
  add(deck, new THREE.TorusGeometry(0.072, 0.007, 8, 34), chromeMat, btnX, 0.058, btnZ).rotation.x = Math.PI / 2;
  add(deck, new THREE.TorusGeometry(0.066, 0.008, 8, 34), ink, btnX, 0.065, btnZ).rotation.x = Math.PI / 2;
  const btnGlowRing = add(deck, new THREE.TorusGeometry(0.061, 0.0035, 6, 36), glow('#fff0a8', 1.6), btnX, 0.066, btnZ);
  btnGlowRing.rotation.x = Math.PI / 2;

  // three fixings hold the button bezel to the deck
  for (const a of [Math.PI / 2, (Math.PI * 7) / 6, (Math.PI * 11) / 6]) {
    screwAt(deck, btnX + Math.cos(a) * 0.0975, 0.0398, btnZ + Math.sin(a) * 0.0975, 0.0046, 'top', a);
  }

  const capMat = new THREE.MeshPhysicalMaterial({
    color: CAB.yellow,
    emissive: new THREE.Color(CAB.yellow),
    emissiveIntensity: 0.9,
    roughness: 0.26,
    clearcoat: 1,
    clearcoatRoughness: 0.04,
    transparent: true,
  });
  const capGroup = new THREE.Group();
  capGroup.position.set(btnX, 0.07, btnZ);
  capGroup.userData.noMerge = true; // la corsa del bottone è animata
  deck.add(capGroup);
  const capSide = new THREE.Mesh(new THREE.CylinderGeometry(0.056, 0.061, 0.028, 34), capMat);
  capSide.position.y = 0.014;
  capSide.castShadow = true;
  capGroup.add(capSide);
  const capTop = new THREE.Mesh(new THREE.SphereGeometry(0.056, 30, 16), capMat);
  capTop.scale.set(1, 0.34, 1);
  capTop.position.y = 0.028;
  capGroup.add(capTop);

  const buttonHit = new THREE.Mesh(
    new THREE.BoxGeometry(0.22, 0.16, 0.22),
    new THREE.MeshBasicMaterial({ visible: false })
  );
  buttonHit.position.set(btnX, 0.09, btnZ);
  deck.add(buttonHit);

  // service switch tucked under the front lip, out of the player's sight
  const svcX = 0.055;
  add(deck, rbox(0.062, 0.012, 0.036, 0.005), darkPlate, svcX, -0.0785, 0.152, false);
  add(deck, new THREE.CylinderGeometry(0.0118, 0.0118, 0.004, 16), chromeMat, svcX, -0.0865, 0.152, false);
  add(deck, new THREE.CylinderGeometry(0.0085, 0.0095, 0.013, 16), plastic(CAB.red, { roughness: 0.42 }), svcX, -0.0925, 0.152, false);
  for (const sx of [-1, 1]) screwAt(deck, svcX + sx * 0.024, -0.0849, 0.152, 0.0036, 'top');

  // strip light under the front lip: it washes the prize door and coin door
  // the way a real cabinet's service lamp does (and keeps them out of the
  // deck's shadow)
  add(deck, rbox(0.72, 0.006, 0.008, 0.002), glow('#fff3e4', 2.4), 0, -0.0675, 0.19, false);
  add(deck, rbox(0.75, 0.008, 0.012, 0.003), darkPlate, 0, -0.0625, 0.187, false);
  const deckLamp = new THREE.PointLight('#fff3e6', 0.12, 1.2, 2);
  deckLamp.position.set(0, -0.16, 0.19);
  deck.add(deckLamp);

  /* ---------------- play chamber ---------------- */

  const floor = add(root, rbox(0.99, 0.028, 0.74, 0.014), azureMid, 0, 0.706, 0);
  floor.receiveShadow = true;

  // chute mouth in the floor
  add(root, new THREE.PlaneGeometry(0.2, 0.2), new THREE.MeshBasicMaterial({ color: '#14213a' }), -0.31, 0.7212, 0, false).rotation.x = -Math.PI / 2;
  for (const [w, d, x, z] of [
    [0.22, 0.014, -0.31, 0.107],
    [0.22, 0.014, -0.31, -0.107],
    [0.014, 0.2, -0.417, 0],
    [0.014, 0.2, -0.203, 0],
  ]) {
    add(root, new THREE.PlaneGeometry(w, d), new THREE.MeshBasicMaterial({ color: '#9bdcff' }), x, 0.7214, z, false).rotation.x = -Math.PI / 2;
  }
  // chrome lip around the drop hole
  for (const [w, d, x, z] of [
    [0.218, 0.008, -0.31, 0.1045],
    [0.218, 0.008, -0.31, -0.1045],
    [0.008, 0.2, -0.4145, 0],
    [0.008, 0.2, -0.2055, 0],
  ]) {
    add(root, rbox(w, 0.005, d, 0.002), chromeSoft, x, 0.7235, z, false);
  }

  // clean pale-blue back wall
  add(root, new THREE.PlaneGeometry(1.0, 0.65), new THREE.MeshBasicMaterial({ color: '#a9d8f7' }), 0, 0.985, -0.381, false);
  const backTex = chamberBackTexture();
  add(root, new THREE.PlaneGeometry(0.94, 0.6), printed(backTex, { roughness: 0.6, clearcoat: 0.2, envMapIntensity: 0.55 }), 0, 0.98, -0.372, false);

  // ceiling: pale blue so the chamber never reads hollow from below
  add(root, rbox(0.99, 0.018, 0.74, 0.006), azurePale, 0, 1.326, 0, false);
  add(root, new THREE.PlaneGeometry(0.94, 0.7), new THREE.MeshBasicMaterial({ color: '#d8f2ff' }), 0, 1.316, 0, false).rotation.x = Math.PI / 2;

  // azure corner posts + top/bottom side rails
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      add(root, rbox(0.078, 0.64, 0.07, 0.02), azure, sx * 0.495, 1.025, sz * 0.35);
    }
    add(root, rbox(0.078, 0.05, 0.78, 0.016), azureDeep, sx * 0.495, 0.738, 0);
    add(root, rbox(0.078, 0.05, 0.78, 0.016), azureDeep, sx * 0.495, 1.312, 0);
    // side glass
    const sidePane = add(root, new THREE.PlaneGeometry(0.68, 0.575), glass, sx * 0.5015, 1.025, 0, false);
    sidePane.rotation.y = sx * (Math.PI / 2);
    sidePane.renderOrder = 3;
  }

  // pink front frame: four chunky rounded bars
  const frameZ = 0.394;
  add(root, rbox(1.02, 0.055, 0.085, 0.02), pink, 0, 1.321, frameZ);
  add(root, rbox(1.02, 0.055, 0.085, 0.02), pink, 0, 0.735, frameZ);
  add(root, rbox(0.055, 0.64, 0.085, 0.02), pink, -0.4825, 1.028, frameZ);
  add(root, rbox(0.055, 0.64, 0.085, 0.02), pink, 0.4825, 1.028, frameZ);

  // black rubber glass retainer: the whole window is gasketed, not glued in
  for (const [w, h, x, y] of [
    [0.9, 0.016, 0, 1.2895],
    [0.9, 0.016, 0, 0.767],
    [0.016, 0.523, -0.4515, 1.028],
    [0.016, 0.523, 0.4515, 1.028],
  ]) {
    add(root, rbox(w, h, 0.014, 0.005), rub, x, y, 0.4295, false);
  }

  // white keyline just outside the rubber, printed on the frame face
  add(root, rbox(0.938, 0.005, 0.004, 0.002), porcelain, 0, 1.2995, 0.4372, false);
  add(root, rbox(0.938, 0.005, 0.004, 0.002), porcelain, 0, 0.7565, 0.4372, false);
  add(root, rbox(0.005, 0.538, 0.004, 0.002), porcelain, -0.462, 1.028, 0.4372, false);
  add(root, rbox(0.005, 0.538, 0.004, 0.002), porcelain, 0.462, 1.028, 0.4372, false);

  // chrome corner retainers with a screw each
  for (const sx of [-1, 1]) {
    for (const sy of [-1, 1]) {
      const cx = sx * 0.4935;
      const cy = 1.028 + sy * 0.3;
      add(root, rbox(0.038, 0.038, 0.005, 0.008), brushed, cx, cy, 0.4385, false);
      screwAt(root, cx, cy, 0.4415, 0.0062, 'front', sx * 0.5);
    }
  }

  // glass-door hinges on the left jamb
  for (const hy of [0.84, 1.215]) {
    add(root, new THREE.CylinderGeometry(0.0075, 0.0075, 0.075, 12), chromeMat, -0.5145, hy, 0.412, false);
    add(root, rbox(0.018, 0.058, 0.007, 0.003), chromeMat, -0.5055, hy, 0.4395, false);
    for (const dy of [-0.022, 0.022]) screwAt(root, -0.5055, hy + dy, 0.4435, 0.0042);
  }

  // key lock for the glass door, right jamb
  add(root, rbox(0.03, 0.052, 0.006, 0.005), chromeSoft, 0.4825, 0.948, 0.4378, false);
  add(root, new THREE.CylinderGeometry(0.0145, 0.0145, 0.009, 18), chromeSoft, 0.4825, 0.948, 0.4392, false).rotation.x = Math.PI / 2;
  add(root, new THREE.CircleGeometry(0.0118, 18), keyFace, 0.4825, 0.948, 0.4446, false);

  // glass front
  const glassFront = add(root, new THREE.PlaneGeometry(0.925, 0.575), glass, 0, 1.025, 0.401, false);
  glassFront.renderOrder = 3;

  // studio reflections, additive and soft-edged
  const streak = streakTexture();
  for (const [w, h, x, y, op, rz] of [
    [0.84, 0.17, -0.02, 1.14, 0.09, 0.42],
    [0.36, 0.05, -0.26, 0.9, 0.07, 0.42],
    [0.06, 0.5, 0.41, 1.06, 0.06, 0],
  ]) {
    const r = add(
      root,
      new THREE.PlaneGeometry(w, h),
      new THREE.MeshBasicMaterial({
        map: streak,
        transparent: true,
        opacity: op,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
      x,
      y,
      0.409,
      false
    );
    r.rotation.z = rz;
    r.renderOrder = 4;
  }

  // LED strip lights built into the front corner posts: extruded channel,
  // opal diffuser and a soft spill, instead of a floating glowing tube
  for (const sx of [-1, 1]) {
    add(root, rbox(0.022, 0.62, 0.022, 0.005), steel, sx * 0.448, 1.02, 0.301, false);
    const led = add(root, rbox(0.007, 0.596, 0.013, 0.0025), glow('#ffffff', 2.9), sx * 0.4385, 1.02, 0.301, false);
    led.renderOrder = 4;
    add(root, rbox(0.026, 0.024, 0.026, 0.006), darkPlate, sx * 0.448, 1.322, 0.301, false);
    add(root, rbox(0.026, 0.024, 0.026, 0.006), darkPlate, sx * 0.448, 0.734, 0.301, false);
    const spill = add(
      root,
      new THREE.PlaneGeometry(0.12, 0.62),
      new THREE.MeshBasicMaterial({
        color: '#e4f8ff',
        transparent: true,
        opacity: 0.2,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
      sx * 0.428,
      1.02,
      0.307,
      false
    );
    spill.renderOrder = 4;
  }

  // ceiling light bar in an aluminium housing
  add(root, rbox(0.9, 0.016, 0.03, 0.005), steel, 0, 1.301, -0.24, false);
  add(root, rbox(0.86, 0.006, 0.018, 0.002), glow('#f4fcff', 2.2), 0, 1.292, -0.24, false);

  /* ---------------- blue header band ---------------- */

  // baked contact shadows under the big overhangs: they are what makes the
  // marquee and the deck feel like separate masses sitting on the body
  const aoMat = new THREE.MeshBasicMaterial({ map: aoTexture(), transparent: true, depthWrite: false });
  add(root, new THREE.PlaneGeometry(1.02, 0.026), aoMat, 0, 1.4435, 0.4028, false).renderOrder = 2;
  add(root, new THREE.PlaneGeometry(0.98, 0.06), aoMat, 0, 0.554, 0.4018, false).renderOrder = 1;
  add(root, new THREE.PlaneGeometry(0.96, 0.026), aoMat, 0, 0.1345, 0.401, false).renderOrder = 1;

  add(root, rbox(1.045, 0.12, 0.11, 0.02), azureDeep, 0, 1.397, 0.345);
  add(
    root,
    new THREE.PlaneGeometry(1.022, 0.108),
    printed(headerTexture(), { roughness: 0.3, clearcoat: 0.7, clearcoatRoughness: 0.1 }),
    0,
    1.397,
    0.4015,
    false
  );
  add(root, rbox(1.05, 0.012, 0.115, 0.005), glow('#eaf9ff', 1.2), 0, 1.455, 0.345, false);
  add(root, rbox(1.05, 0.01, 0.115, 0.004), azurePale, 0, 1.34, 0.345, false);

  // shadow gap where the blue header housing lands on the glass frame
  gapH(root, 1.02, 0.0045, 0, 1.3495, 0.4378);

  // speaker bar hidden behind a perforated strip on the riser face
  add(root, rbox(0.66, 0.052, 0.012, 0.008), brushed, 0, 0.6995, 0.4065, false);
  add(root, rbox(0.636, 0.038, 0.004, 0.004), matte('#0a080b'), 0, 0.6995, 0.4125, false);
  perfPanel(root, 0.634, 0.036, 0, 0.6995, 0.4135);
  for (const sx of [-1, 1]) {
    for (const sy of [-1, 1]) screwAt(root, sx * 0.32, 0.6995 + sy * 0.019, 0.4138, 0.0042);
  }

  /* ---------------- marquee ---------------- */

  add(root, rbox(1.1, 0.345, 0.175, 0.035), pinkDeep, 0, 1.602, 0.295);
  add(root, rbox(1.05, 0.305, 0.18, 0.028), pink, 0, 1.602, 0.302);
  add(root, rbox(1.108, 0.026, 0.185, 0.008), pinkInk, 0, 1.784, 0.295);
  add(root, rbox(1.108, 0.02, 0.185, 0.007), pinkInk, 0, 1.432, 0.295);

  // black seal under the lightbox + chrome edge beads
  add(root, rbox(1.104, 0.01, 0.008, 0.003), matte('#231722'), 0, 1.4345, 0.3895, false);
  add(root, rbox(1.106, 0.006, 0.012, 0.0025), chromeSoft, 0, 1.7905, 0.3895, false);
  add(root, rbox(1.106, 0.005, 0.01, 0.002), chromeSoft, 0, 1.4285, 0.3895, false);

  const marqueeTex = marqueeTexture();
  add(
    root,
    new THREE.PlaneGeometry(0.99, 0.289),
    backlit(marqueeTex, 0.34),
    0,
    1.602,
    0.3945,
    false
  );

  // machined bezel holding the marquee print
  add(root, rbox(1.026, 0.024, 0.014, 0.006), pinkDeep, 0, 1.7505, 0.3935, false);
  add(root, rbox(1.026, 0.022, 0.014, 0.006), pinkDeep, 0, 1.4545, 0.3935, false);
  add(root, rbox(0.024, 0.318, 0.014, 0.006), pinkDeep, -0.5025, 1.602, 0.3935, false);
  add(root, rbox(0.024, 0.318, 0.014, 0.006), pinkDeep, 0.5025, 1.602, 0.3935, false);
  for (const sx of [-1, 1]) {
    for (const sy of [-1, 1]) screwAt(root, sx * 0.478, 1.602 + sy * 0.1485, 0.4022, 0.0054, 'front', sx * 0.4);
  }

  // thin acrylic sheet over the lightbox + two glare bands
  const acrylic = add(
    root,
    new THREE.PlaneGeometry(0.975, 0.283),
    new THREE.MeshPhysicalMaterial({
      color: '#eaf7ff',
      roughness: 0.04,
      metalness: 0,
      transparent: true,
      opacity: 0.08,
      clearcoat: 1,
      clearcoatRoughness: 0.02,
      side: THREE.DoubleSide,
      envMapIntensity: 1.4,
      depthWrite: false,
    }),
    0,
    1.602,
    0.397,
    false
  );
  acrylic.renderOrder = 3;
  for (const [w, h, x, y, op, rz] of [
    [0.72, 0.05, -0.08, 1.7, 0.16, 0.03],
    [0.4, 0.024, 0.2, 1.51, 0.1, -0.02],
  ]) {
    const r = add(
      root,
      new THREE.PlaneGeometry(w, h),
      new THREE.MeshBasicMaterial({
        map: streak,
        transparent: true,
        opacity: op,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
      x,
      y,
      0.399,
      false
    );
    r.rotation.z = rz;
    r.renderOrder = 4;
  }

  // vertical ポートフォリオ on the right flank of the marquee
  const sideTex = sideDecalTexture();
  const sideDecal = add(
    root,
    new THREE.PlaneGeometry(0.105, 0.265),
    new THREE.MeshPhysicalMaterial({
      map: sideTex,
      transparent: true,
      roughness: 0.4,
      clearcoat: 0.5,
      side: THREE.DoubleSide,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
    }),
    0.5525,
    1.602,
    0.302,
    false
  );
  sideDecal.rotation.y = Math.PI / 2;
  sideDecal.renderOrder = 3;

  // side caps on the marquee
  for (const sx of [-1, 1]) {
    add(root, rbox(0.028, 0.32, 0.185, 0.012), pinkDeep, sx * 0.546, 1.602, 0.295);
    for (const sy of [-1, 1]) screwAt(root, sx * 0.5605, 1.602 + sy * 0.118, 0.365, 0.0052, sx > 0 ? 'right' : 'left');
  }

  // roof vent: perforated grille in a brushed frame
  add(root, rbox(0.64, 0.006, 0.105, 0.006), brushed, 0, 1.7972, 0.3, false);
  add(root, rbox(0.61, 0.004, 0.08, 0.004), matte('#0a080b'), 0, 1.8002, 0.3, false);
  const roofVent = add(root, new THREE.PlaneGeometry(0.605, 0.076), perfMat, 0, 1.8028, 0.3, false);
  roofVent.rotation.x = -Math.PI / 2;
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) screwAt(root, sx * 0.307, 1.8035, 0.3 + sz * 0.039, 0.0046, 'top');
  }

  /* ---------------- decals from the atlas ---------------- */

  label(root, atlas, rects, 'うけとりぐち', 0.105, 0.034, -0.265, 0.372, 0.4012);
  label(root, atlas, rects, 'あそびかた', 0.11, 0.037, 0.33, 0.735, 0.4395);
  label(root, atlas, rects, 'NO STEP', 0.082, 0.03, 0, 0.075, 0.4042);
  label(root, atlas, rects, 'HANDLE WITH CARE', 0.15, 0.052, -0.5125, 0.34, 0.05, -Math.PI / 2, 0.01);
  label(root, atlas, rects, 'PRIZE', 0.09, 0.032, 0.5125, 0.27, -0.08, Math.PI / 2, -0.015);
  label(root, atlas, rects, 'WARNING', 0.12, 0.042, 0.5125, 0.5, -0.16, Math.PI / 2, 0.01);
  label(root, atlas, rects, 'ゲット', 0.078, 0.078, 0.355, 0.535, 0.4015);

  // hardware labels: coin door reads as a real coin entry, not a decal sheet
  label(root, atlas, rects, 'INSERT COIN', 0.062, 0.017, 0.272, 0.302, 0.4098);
  label(root, atlas, rects, '1 PLAY / ¥100', 0.066, 0.018, 0.272, 0.278, 0.4098);
  label(root, atlas, rects, 'PUSH', 0.026, 0.01, 0.29, 0.253, 0.4108);
  label(root, atlas, rects, 'SERVICE', 0.034, 0.01, 0.055, -0.0785, 0.1712);

  // small serial tag on the base rail, off to one side
  label(root, atlas, rects, 'MADE IN JAPAN', 0.07, 0.022, -0.33, 0.0455, 0.3982);

  /* ---------------- button behaviour ---------------- */

  let press = 0;
  let enabled = true;
  const capBaseY = capGroup.position.y;

  function pressButton() {
    press = 1;
  }

  function setButtonEnabled(on: boolean) {
    enabled = on;
    (capMat as THREE.MeshStandardMaterial).emissiveIntensity = on ? 0.9 : 0.12;
    (btnGlowRing.material as THREE.MeshStandardMaterial).emissiveIntensity = on ? 1.6 : 0.15;
  }

  function update(dt: number) {
    if (press > 0) {
      press = Math.max(0, press - dt * 4.5);
      capGroup.position.y = capBaseY - 0.01 * Math.sin((1 - press) * Math.PI);
    }
    const pulse = enabled ? 0.85 + Math.sin(performance.now() * 0.0032) * 0.18 : 0.12;
    (capMat as THREE.MeshStandardMaterial).emissiveIntensity = pulse;
  }

  return { root, glass, buttonHit, pressButton, setButtonEnabled, update, stick, capGroup };
}
