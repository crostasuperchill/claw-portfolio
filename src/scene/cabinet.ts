import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { CAB, backlit, candy, chrome, glow, matte, printed, rubber } from './materials';
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

  // right: cat mascot + blue badge
  drawCat(g, 852, 168, 1.02);

  g.save();
  g.translate(770, 372);
  g.fillStyle = '#5aa9e6';
  g.beginPath();
  g.arc(0, 0, 46, 0, Math.PI * 2);
  g.fill();
  g.strokeStyle = '#ffffff';
  g.lineWidth = 6;
  g.beginPath();
  g.arc(0, 0, 42, 0, Math.PI * 2);
  g.stroke();
  drawUfo(g, 0, 0, 0.34, false);
  g.restore();

  // red/white warning, bottom-right
  g.save();
  g.translate(930, 414);
  g.rotate(0.07);
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
  g.fillText('MADE IN JAPAN', 380, 492);
  g.textAlign = 'right';
  g.fillText('UFO-1024 / 220V', 990, 492);

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
  arrow(192, 104, 'up');

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
  lg.addColorStop(0, 'rgba(8,4,6,0.92)');
  lg.addColorStop(0.35, 'rgba(8,4,6,0.55)');
  lg.addColorStop(0.72, 'rgba(8,4,6,0.22)');
  lg.addColorStop(1, 'rgba(8,4,6,0.65)');
  g.fillStyle = lg;
  g.fillRect(0, 0, 256, 256);
  const rg = g.createRadialGradient(70, 60, 8, 70, 60, 160);
  rg.addColorStop(0, 'rgba(255,220,190,0.22)');
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
  const m = decalMesh(atlas, rect, w, h, { opacity: 0.98, gloss: true });
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

  /* ---------------- feet + lower body ---------------- */

  for (const [x, z] of [
    [-0.425, 0.3],
    [0.425, 0.3],
    [-0.425, -0.3],
    [0.425, -0.3],
  ]) {
    add(root, new THREE.CylinderGeometry(0.045, 0.052, 0.05, 22), rub, x, 0.025, z);
    add(root, new THREE.TorusGeometry(0.047, 0.005, 6, 22), chromeMat, x, 0.048, z).rotation.x = Math.PI / 2;
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

  // thin pink reveal around the belly panel
  add(root, rbox(0.916, 0.012, 0.012, 0.005), pinkDeep, 0, 0.598, 0.395, false);
  add(root, rbox(0.916, 0.012, 0.012, 0.005), pinkDeep, 0, 0.152, 0.395, false);
  add(root, rbox(0.012, 0.452, 0.012, 0.005), pinkDeep, -0.457, 0.375, 0.395, false);
  add(root, rbox(0.012, 0.452, 0.012, 0.005), pinkDeep, 0.457, 0.375, 0.395, false);

  /* ---------------- prize door (bottom-left) ---------------- */

  const doorX = -0.265;
  const doorY = 0.263;
  const doorW = 0.27;
  const doorH = 0.152;

  // recessed throat
  add(root, new THREE.PlaneGeometry(doorW - 0.035, doorH - 0.035), new THREE.MeshBasicMaterial({ color: '#160d14' }), doorX, doorY, 0.4015, false);
  add(
    root,
    new THREE.PlaneGeometry(doorW - 0.035, doorH - 0.035),
    new THREE.MeshBasicMaterial({ map: innerShadowTexture(), transparent: true, depthWrite: false, opacity: 0.95 }),
    doorX,
    doorY,
    0.4025,
    false
  );

  // smoked flap, top-hinged a hair open
  const flap = add(
    root,
    new THREE.PlaneGeometry(doorW - 0.055, doorH - 0.06),
    new THREE.MeshPhysicalMaterial({
      color: '#2c2130',
      roughness: 0.05,
      metalness: 0,
      transparent: true,
      opacity: 0.4,
      clearcoat: 1,
      clearcoatRoughness: 0.03,
      side: THREE.DoubleSide,
      envMapIntensity: 1.4,
      depthWrite: false,
    }),
    doorX,
    doorY - 0.004,
    0.4075,
    false
  );
  flap.rotation.x = -0.05;

  // chunky pink frame
  const bar = 0.024;
  add(root, rbox(bar, doorH + bar, 0.02, 0.008), pinkDeep, doorX - doorW / 2, doorY, 0.408);
  add(root, rbox(bar, doorH + bar, 0.02, 0.008), pinkDeep, doorX + doorW / 2, doorY, 0.408);
  add(root, rbox(doorW + bar, bar, 0.02, 0.008), pinkDeep, doorX, doorY + doorH / 2, 0.408);
  add(root, rbox(doorW + bar, bar, 0.02, 0.008), pinkDeep, doorX, doorY - doorH / 2, 0.408);

  // chrome pull + hinge pins
  add(root, new THREE.CylinderGeometry(0.004, 0.004, doorW - 0.06, 10), chromeMat, doorX, doorY - doorH / 2 + 0.028, 0.418, false).rotation.z = Math.PI / 2;
  for (const s of [-1, 1]) {
    add(root, new THREE.CylinderGeometry(0.0035, 0.0035, 0.012, 8), chromeMat, doorX + s * 0.07, doorY + doorH / 2 + 0.006, 0.413, false).rotation.z = Math.PI / 2;
  }

  // shadow cast into the throat
  const doorGlow = add(
    root,
    new THREE.PlaneGeometry(doorW - 0.06, 0.03),
    new THREE.MeshBasicMaterial({
      color: '#ffc78a',
      transparent: true,
      opacity: 0.35,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
    doorX,
    doorY - doorH / 2 + 0.024,
    0.406,
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
  add(deck, rbox(0.13, 0.022, 0.13, 0.03), ink, joyX, 0.045, joyZ);
  add(deck, new THREE.CylinderGeometry(0.056, 0.06, 0.02, 26), ink, joyX, 0.055, joyZ);
  add(deck, new THREE.CylinderGeometry(0.032, 0.04, 0.03, 20), rub, joyX, 0.073, joyZ);
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
  add(deck, new THREE.TorusGeometry(0.072, 0.007, 8, 34), chromeMat, btnX, 0.058, btnZ).rotation.x = Math.PI / 2;
  add(deck, new THREE.TorusGeometry(0.066, 0.008, 8, 34), ink, btnX, 0.065, btnZ).rotation.x = Math.PI / 2;
  const btnGlowRing = add(deck, new THREE.TorusGeometry(0.061, 0.0035, 6, 36), glow('#fff0a8', 1.6), btnX, 0.066, btnZ);
  btnGlowRing.rotation.x = Math.PI / 2;

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

  // inner white keyline + pale-blue gasket
  add(root, rbox(0.926, 0.014, 0.02, 0.005), porcelain, 0, 1.292, 0.4285, false);
  add(root, rbox(0.926, 0.014, 0.02, 0.005), porcelain, 0, 0.764, 0.4285, false);
  add(root, rbox(0.014, 0.546, 0.02, 0.005), porcelain, -0.456, 1.028, 0.4285, false);
  add(root, rbox(0.014, 0.546, 0.02, 0.005), porcelain, 0.456, 1.028, 0.4285, false);

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

  // cool LED tubes inside the chamber
  for (const sx of [-1, 1]) {
    const led = add(root, new THREE.CapsuleGeometry(0.0065, 0.52, 4, 10), glow('#eaf8ff', 2.1), sx * 0.438, 1.02, 0.29, false);
    led.renderOrder = 4;
    add(root, rbox(0.02, 0.6, 0.014, 0.005), azureDeep, sx * 0.438, 1.02, 0.28, false);
    const spill = add(
      root,
      new THREE.PlaneGeometry(0.10, 0.62),
      new THREE.MeshBasicMaterial({
        color: '#dff6ff',
        transparent: true,
        opacity: 0.22,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
      sx * 0.43,
      1.02,
      0.296,
      false
    );
    spill.renderOrder = 4;
  }

  // white light bar under the roof
  add(root, new THREE.CapsuleGeometry(0.008, 0.8, 4, 10), glow('#f2fbff', 1.6), 0, 1.292, -0.24, false).rotation.z = Math.PI / 2;

  /* ---------------- blue header band ---------------- */

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

  /* ---------------- marquee ---------------- */

  add(root, rbox(1.1, 0.345, 0.175, 0.035), pinkDeep, 0, 1.602, 0.295);
  add(root, rbox(1.05, 0.305, 0.18, 0.028), pink, 0, 1.602, 0.302);
  add(root, rbox(1.108, 0.026, 0.185, 0.008), pinkInk, 0, 1.784, 0.295);
  add(root, rbox(1.108, 0.02, 0.185, 0.007), pinkInk, 0, 1.432, 0.295);

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

  // thin acrylic sheet over the lightbox + two glare bands
  const acrylic = add(
    root,
    new THREE.PlaneGeometry(0.995, 0.293),
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
  }

  /* ---------------- decals from the atlas ---------------- */

  label(root, atlas, rects, 'うけとりぐち', 0.105, 0.034, -0.265, 0.372, 0.4015);
  label(root, atlas, rects, 'あそびかた', 0.11, 0.037, 0.33, 0.735, 0.4395);
  label(root, atlas, rects, 'NO STEP', 0.082, 0.03, 0.36, 0.074, 0.4095);
  label(root, atlas, rects, 'HANDLE WITH CARE', 0.15, 0.052, -0.5125, 0.34, 0.05, -Math.PI / 2, 0.01);
  label(root, atlas, rects, 'PRIZE', 0.09, 0.032, 0.5125, 0.27, -0.08, Math.PI / 2, -0.015);
  label(root, atlas, rects, 'WARNING', 0.12, 0.042, 0.5125, 0.5, -0.16, Math.PI / 2, 0.01);
  label(root, atlas, rects, 'ゲット', 0.078, 0.078, 0.355, 0.535, 0.4015);

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
