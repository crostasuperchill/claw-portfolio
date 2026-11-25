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
  t.anisotropy = 4;
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

/* ---------- vector mascots ---------- */

function drawUfo(g: CanvasRenderingContext2D, x: number, y: number, s = 1, beam = false) {
  g.save();
  g.translate(x, y);
  g.scale(s, s);
  g.lineJoin = 'round';

  if (beam) {
    const beamGrad = g.createLinearGradient(0, 22, 0, 118);
    beamGrad.addColorStop(0, 'rgba(90, 215, 255, 0.85)');
    beamGrad.addColorStop(0.5, 'rgba(255, 196, 65, 0.6)');
    beamGrad.addColorStop(1, 'rgba(255, 130, 190, 0)');
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

/* ------------------------------------------------------------------ */
/* printed panels (matching reference layout)                          */
/* ------------------------------------------------------------------ */

export function marqueeTexture() {
  const c = canvas(1280, 384);
  const g = c.getContext('2d')!;

  const bg = g.createLinearGradient(0, 0, 1280, 384);
  bg.addColorStop(0, '#f5a9d0');
  bg.addColorStop(0.28, '#bdeaff');
  bg.addColorStop(0.68, '#7ad5fb');
  bg.addColorStop(1, '#58bdf0');
  g.fillStyle = bg;
  g.fillRect(0, 0, 1280, 384);

  const hot = g.createRadialGradient(640, 192, 40, 640, 192, 540);
  hot.addColorStop(0, 'rgba(255,255,255,0.72)');
  hot.addColorStop(0.55, 'rgba(255,255,255,0.2)');
  hot.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = hot;
  g.fillRect(0, 0, 1280, 384);

  g.strokeStyle = 'rgba(255,255,255,0.9)';
  g.lineWidth = 6;
  roundRect(g, 16, 16, 1248, 352, 24);
  g.stroke();

  drawSparkle(g, 60, 330, 14, 'rgba(255,255,255,0.9)');
  drawSparkle(g, 1220, 326, 15, 'rgba(255,255,255,0.9)');
  drawSparkle(g, 290, 54, 12, 'rgba(255,255,255,0.8)');
  drawSparkle(g, 950, 58, 12, 'rgba(255,255,255,0.8)');

  const headline = 'UFO PORTFOLIO';
  const size = fitFont(g, headline, 1020, 126, 900, ROUND);
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.lineJoin = 'round';
  g.font = `900 ${size}px ${ROUND}`;

  g.fillStyle = 'rgba(185, 24, 98, 0.5)';
  g.fillText(headline, 644, 212);

  g.strokeStyle = '#ff63a8';
  g.lineWidth = 32;
  g.strokeText(headline, 640, 202);
  g.strokeStyle = '#e03985';
  g.lineWidth = 20;
  g.strokeText(headline, 640, 202);
  g.fillStyle = '#ffffff';
  g.fillText(headline, 640, 202);

  drawUfo(g, 92, 68, 0.9, false);

  g.save();
  g.translate(152, 316);
  g.rotate(-0.08);
  g.shadowColor = 'rgba(80, 18, 52, 0.28)';
  g.shadowBlur = 8;
  g.shadowOffsetY = 4;
  g.fillStyle = '#e86ea4';
  roundRect(g, -118, -26, 236, 52, 26);
  g.fill();
  g.shadowColor = 'transparent';
  g.strokeStyle = '#ffffff';
  g.lineWidth = 5;
  roundRect(g, -115, -23, 230, 46, 23);
  g.stroke();
  g.fillStyle = '#ffffff';
  g.font = `900 28px ${JP}`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText('たんけんちゅう', 0, 2);
  g.restore();

  g.save();
  g.translate(1110, 62);
  g.rotate(0.14);
  g.shadowColor = 'rgba(60, 20, 90, 0.25)';
  g.shadowBlur = 8;
  g.shadowOffsetY = 4;
  g.fillStyle = '#ffffff';
  roundRect(g, -124, -26, 248, 52, 26);
  g.fill();
  g.shadowColor = 'transparent';
  g.strokeStyle = '#8b63e6';
  g.lineWidth = 5;
  roundRect(g, -120, -22, 240, 44, 22);
  g.stroke();
  g.fillStyle = '#8b63e6';
  g.font = `900 28px ${JP}`;
  g.fillText('ポートフォリオ', 0, 2);
  g.restore();

  drawCat(g, 1138, 304, 0.88, false);

  return texture(c);
}

export function headerTexture() {
  const c = canvas(1600, 200);
  const g = c.getContext('2d')!;

  const bg = g.createLinearGradient(0, 0, 0, 200);
  bg.addColorStop(0, '#449bf0');
  bg.addColorStop(0.5, '#2b7ed8');
  bg.addColorStop(1, '#1d65bd');
  g.fillStyle = bg;
  g.fillRect(0, 0, 1600, 200);

  g.save();
  g.globalAlpha = 0.08;
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

  g.fillStyle = '#d8f3ff';
  g.fillRect(0, 0, 1600, 6);
  g.fillStyle = '#aee2ff';
  g.fillRect(0, 194, 1600, 6);

  const badges: [number, number, number, string, string][] = [
    [106, 108, 42, '#73c7ff', '#275ca8'],
    [186, 86, 36, '#ff8dbe', '#b8326e'],
  ];
  for (const [x, y, r, fill, rim] of badges) {
    g.save();
    g.fillStyle = fill;
    g.beginPath();
    g.arc(x, y, r, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = '#ffffff';
    g.lineWidth = 4;
    g.stroke();
    g.fillStyle = rim;
    g.beginPath();
    g.arc(x - r * 0.28, y - r * 0.08, r * 0.1, 0, Math.PI * 2);
    g.arc(x + r * 0.28, y - r * 0.08, r * 0.1, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = rim;
    g.lineWidth = 3;
    g.beginPath();
    g.arc(x, y + r * 0.05, r * 0.22, 0.15 * Math.PI, 0.85 * Math.PI);
    g.stroke();
    g.restore();
  }

  const word = 'クレーンゲーム';
  const size = fitFont(g, word, 920, 140, 900);
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.lineJoin = 'round';
  g.font = `900 ${size}px ${JP}`;
  g.fillStyle = 'rgba(12, 34, 88, 0.45)';
  g.fillText(word, 804, 112);
  g.strokeStyle = '#ffffff';
  g.lineWidth = 20;
  g.strokeText(word, 800, 104);
  g.fillStyle = '#ff6aa8';
  g.fillText(word, 800, 104);

  g.save();
  g.translate(1425, 100);
  g.rotate(0.05);
  g.shadowColor = 'rgba(10, 25, 70, 0.35)';
  g.shadowBlur = 8;
  g.shadowOffsetY = 4;
  g.fillStyle = '#ffd228';
  roundRect(g, -124, -56, 248, 112, 8);
  g.fill();
  g.shadowColor = 'transparent';
  g.strokeStyle = '#1a1620';
  g.lineWidth = 6;
  roundRect(g, -120, -52, 240, 104, 6);
  g.stroke();
  g.fillStyle = '#1a1620';
  g.textAlign = 'left';
  g.font = `900 32px ${ROUND}`;
  g.fillText('WARNING', -66, -16);
  g.font = `700 12px ${ROUND}`;
  g.fillText('CAUTION: MOVING PARTS', -100, 14);
  g.fillText('KEEP HANDS CLEAR', -100, 32);
  g.beginPath();
  g.moveTo(-88, -34);
  g.lineTo(-73, -8);
  g.lineTo(-103, -8);
  g.closePath();
  g.fill();
  g.fillStyle = '#ffd228';
  g.font = `900 18px ${ROUND}`;
  g.textAlign = 'center';
  g.fillText('!', -88, -14);
  g.restore();

  return texture(c);
}

export function bodyTexture() {
  const c = canvas(1024, 512);
  const g = c.getContext('2d')!;

  const bg = g.createLinearGradient(0, 0, 0, 512);
  bg.addColorStop(0, '#ffffff');
  bg.addColorStop(0.75, '#fcf9fb');
  bg.addColorStop(1, '#f7f1f5');
  g.fillStyle = bg;
  roundRect(g, 4, 4, 1016, 504, 24);
  g.fill();

  g.strokeStyle = 'rgba(229, 109, 166, 0.35)';
  g.lineWidth = 4;
  roundRect(g, 10, 10, 1004, 492, 20);
  g.stroke();

  // Bottom-left: UFO + beam + クレーンゲーム / ポートフォリオ (sits cleanly below deck lip)
  g.save();
  g.translate(106, 336);
  g.fillStyle = '#73d4ff';
  g.beginPath();
  g.arc(0, 18, 70, 0, Math.PI * 2);
  g.fill();
  g.strokeStyle = '#ffd228';
  g.lineWidth = 8;
  g.stroke();
  drawUfo(g, 0, -14, 0.8, true);
  g.restore();

  // lavender star sticker above logo (unclipped below deck lip)
  g.save();
  g.translate(232, 232);
  g.fillStyle = '#ffffff';
  g.strokeStyle = '#d9458c';
  g.lineWidth = 4;
  roundRect(g, -40, -32, 80, 64, 16);
  g.fill();
  g.stroke();
  g.fillStyle = '#c89eff';
  g.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
    const rr = i % 2 === 0 ? 21 : 10.5;
    const px = Math.cos(a) * rr;
    const py = Math.sin(a) * rr;
    if (i === 0) g.moveTo(px, py);
    else g.lineTo(px, py);
  }
  g.closePath();
  g.fill();
  g.restore();

  g.textAlign = 'left';
  g.textBaseline = 'middle';
  g.lineJoin = 'round';
  const lines = ['クレーンゲーム', 'ポートフォリオ'];
  lines.forEach((word, i) => {
    const size = i === 0 ? 60 : 54;
    g.font = `900 ${size}px ${JP}`;
    const y = 348 + i * 68;
    const x = 148;
    g.fillStyle = 'rgba(53, 148, 232, 0.45)';
    g.fillText(word, x + 4, y + 5);
    g.strokeStyle = '#ffffff';
    g.lineWidth = 12;
    g.strokeText(word, x, y);
    g.fillStyle = '#e85193';
    g.fillText(word, x, y);
  });

  // Bottom-right cluster: pink cat, yellow/blue UFO round seal, red/white WARNING
  drawCat(g, 712, 294, 0.82, true);

  g.save();
  g.translate(888, 250);
  g.fillStyle = '#ffd228';
  g.beginPath();
  g.arc(0, 0, 56, 0, Math.PI * 2);
  g.fill();
  g.strokeStyle = '#ffffff';
  g.lineWidth = 5;
  g.stroke();
  g.fillStyle = '#73c7ff';
  g.beginPath();
  g.arc(0, 0, 39, 0, Math.PI * 2);
  g.fill();
  drawUfo(g, 0, -2, 0.42, false);
  g.fillStyle = '#3a2266';
  g.font = `900 11px ${ROUND}`;
  g.textAlign = 'center';
  g.fillText('UFO CATCHER', 0, -44);
  g.fillText('PORTFOLIO', 0, 46);
  g.restore();

  g.save();
  g.translate(854, 412);
  g.rotate(-0.07);
  g.shadowColor = 'rgba(40, 10, 20, 0.2)';
  g.shadowBlur = 8;
  g.shadowOffsetY = 4;
  g.fillStyle = '#ffffff';
  roundRect(g, -110, -48, 220, 96, 10);
  g.fill();
  g.shadowColor = 'transparent';
  g.strokeStyle = '#e8262b';
  g.lineWidth = 6;
  roundRect(g, -106, -44, 212, 88, 8);
  g.stroke();
  g.fillStyle = '#e8262b';
  roundRect(g, -94, -35, 188, 32, 4);
  g.fill();
  g.fillStyle = '#ffffff';
  g.font = `900 20px ${ROUND}`;
  g.textAlign = 'center';
  g.fillText('▲ WARNING', 0, -18);
  g.fillStyle = '#2b1e24';
  g.font = `700 11px ${ROUND}`;
  g.fillText('DO NOT TILT OR SHAKE', 0, 12);
  g.fillText('INSERT COIN TO PLAY', 0, 29);
  g.restore();

  return texture(c);
}

export function deckTexture() {
  const c = canvas(1024, 341);
  const g = c.getContext('2d')!;

  const bg = g.createLinearGradient(0, 0, 0, 341);
  bg.addColorStop(0, '#5bb5f7');
  bg.addColorStop(0.5, '#3b95e6');
  bg.addColorStop(1, '#297bc9');
  g.fillStyle = bg;
  g.fillRect(0, 0, 1024, 341);

  const sheen = g.createRadialGradient(380, 90, 20, 380, 90, 520);
  sheen.addColorStop(0, 'rgba(255,255,255,0.22)');
  sheen.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = sheen;
  g.fillRect(0, 0, 1024, 341);

  g.strokeStyle = 'rgba(255,255,255,0.75)';
  g.lineWidth = 4;
  roundRect(g, 14, 14, 996, 313, 22);
  g.stroke();

  const arrow = (x: number, y: number, dir: 'left' | 'right' | 'up' | 'down') => {
    g.save();
    g.translate(x, y);
    if (dir === 'left') g.rotate(Math.PI / 2);
    if (dir === 'right') g.rotate(-Math.PI / 2);
    if (dir === 'down') g.rotate(Math.PI);
    g.shadowColor = 'rgba(15, 40, 90, 0.28)';
    g.shadowBlur = 5;
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
    g.fillStyle = '#f26aa6';
    g.fill();
    g.restore();
  };

  arrow(74, 191, 'left');
  arrow(310, 191, 'right');
  arrow(192, 282, 'down');
  arrow(192, 72, 'up');

  g.fillStyle = 'rgba(15, 45, 105, 0.35)';
  g.font = `900 38px ${ROUND}`;
  g.textAlign = 'center';
  g.fillText('PLAY / スタート', 756, 302);
  g.fillStyle = '#ffffff';
  g.fillText('PLAY / スタート', 753, 298);

  g.save();
  g.translate(66, 56);
  g.rotate(-0.1);
  g.fillStyle = '#ffd228';
  g.beginPath();
  g.arc(0, 0, 26, 0, Math.PI * 2);
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

  g.save();
  g.translate(925, 56);
  g.rotate(0.06);
  g.fillStyle = '#ffd228';
  roundRect(g, -76, -28, 152, 56, 7);
  g.fill();
  g.strokeStyle = '#1a1620';
  g.lineWidth = 4;
  roundRect(g, -73, -25, 146, 50, 5);
  g.stroke();
  g.fillStyle = '#1a1620';
  g.font = `900 20px ${ROUND}`;
  g.fillText('WARNING', 0, -2);
  g.font = `700 10px ${JP}`;
  g.fillText('CAUTION / 注意', 0, 15);
  g.restore();

  return texture(c);
}

function sideDecalTexture() {
  const c = canvas(128, 460);
  const g = c.getContext('2d')!;
  const chars = 'ポートフォリオ';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.lineJoin = 'round';
  g.font = `900 48px ${JP}`;
  for (let i = 0; i < chars.length; i++) {
    const y = 52 + i * 58;
    g.strokeStyle = '#ffffff';
    g.lineWidth = 10;
    g.strokeText(chars[i], 64, y);
    g.fillStyle = '#e24c91';
    g.fillText(chars[i], 64, y);
  }
  return texture(c);
}

function chamberBackTexture() {
  const c = canvas(512, 512);
  const g = c.getContext('2d')!;
  const bg = g.createLinearGradient(0, 0, 0, 512);
  bg.addColorStop(0, '#eefaff');
  bg.addColorStop(0.45, '#bfe9ff');
  bg.addColorStop(1, '#84c9f7');
  g.fillStyle = bg;
  g.fillRect(0, 0, 512, 512);

  const band = g.createLinearGradient(0, 0, 512, 0);
  band.addColorStop(0, 'rgba(255,255,255,0)');
  band.addColorStop(0.5, 'rgba(255,255,255,0.55)');
  band.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = band;
  g.fillRect(0, 0, 512, 512);

  g.fillStyle = 'rgba(255,255,255,0.6)';
  for (const [x, y, s] of [
    [95, 380, 1],
    [410, 320, 0.85],
    [256, 440, 1.15],
  ]) {
    for (const [dx, dy, r] of [
      [-36, 6, 26],
      [-8, -8, 34],
      [26, 2, 28],
      [50, 10, 20],
    ]) {
      g.beginPath();
      g.ellipse(x + dx * s, y + dy * s, r * s, r * 0.62 * s, 0, 0, Math.PI * 2);
      g.fill();
    }
  }

  return texture(c);
}

function streakTexture() {
  const c = canvas(128, 16);
  const g = c.getContext('2d')!;
  const lg = g.createLinearGradient(0, 0, 128, 0);
  lg.addColorStop(0, 'rgba(255,255,255,0)');
  lg.addColorStop(0.45, 'rgba(255,255,255,0.65)');
  lg.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = lg;
  g.fillRect(0, 0, 128, 16);
  return texture(c);
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

  const pink = candy(CAB.pink);
  const pinkDeep = candy(CAB.pinkDeep, { roughness: 0.24 });
  const pinkInk = candy(CAB.pinkInk, { roughness: 0.26 });
  const azure = candy(CAB.azure, { roughness: 0.18 });
  const azureMid = candy(CAB.azureMid, { roughness: 0.22 });
  const azureDeep = candy(CAB.azureDeep, { roughness: 0.26 });
  const azurePale = candy(CAB.azurePale, { roughness: 0.36 });
  const porcelain = candy(CAB.white, { roughness: 0.26 });
  const rub = rubber();
  const chromeMat = chrome();
  const glass = glassMaterial();
  const ink = matte(CAB.ink);

  /* ---------------- feet + lower body ---------------- */

  for (const [x, z] of [
    [-0.42, 0.29],
    [0.42, 0.29],
    [-0.42, -0.29],
    [0.42, -0.29],
  ]) {
    add(root, new THREE.CylinderGeometry(0.048, 0.054, 0.032, 16), rub, x, 0.016, z, true, false);
    add(root, new THREE.CylinderGeometry(0.044, 0.046, 0.012, 16), chromeMat, x, 0.036, z, false, false);
  }

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

  add(root, rbox(1.0, 0.145, 0.17, 0.028), pink, 0, 0.657, 0.322, false, false);

  const deck = new THREE.Group();
  deck.position.set(0, 0.585, 0.45);
  deck.rotation.x = 0.14;
  root.add(deck);

  add(deck, rbox(1.0, 0.074, 0.35, 0.03), azure, 0, 0, 0, true, false);
  add(deck, rbox(1.036, 0.036, 0.376, 0.014), pinkDeep, 0, -0.042, 0, true, false);
  add(deck, rbox(1.044, 0.012, 0.384, 0.005), pinkInk, 0, -0.064, 0, false, false);

  const deckPrint = add(
    deck,
    new THREE.PlaneGeometry(0.965, 0.325),
    printed(deckTexture(), { roughness: 0.28 }),
    0,
    0.0385,
    0,
    false,
    false
  );
  deckPrint.rotation.x = -Math.PI / 2;

  const joyX = -0.3;
  const joyZ = 0.02;
  add(deck, new THREE.CylinderGeometry(0.056, 0.06, 0.01, 24), ink, joyX, 0.042, joyZ, false, false);
  add(deck, new THREE.CylinderGeometry(0.032, 0.038, 0.018, 18), rub, joyX, 0.052, joyZ, false, false);

  const stick = new THREE.Group();
  stick.position.set(joyX, 0.058, joyZ);
  stick.userData.noMerge = true;
  deck.add(stick);

  const rodMat = new THREE.MeshStandardMaterial({
    color: '#eef3f8',
    metalness: 0.78,
    roughness: 0.16,
    envMapIntensity: 1.4,
  });
  const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.007, 0.009, 0.088, 12), rodMat);
  rod.position.y = 0.044;
  stick.add(rod);

  const ballMat = candy(CAB.red, { roughness: 0.09, metalness: 0.04, envMapIntensity: 1.35 });
  const ball = new THREE.Mesh(new THREE.SphereGeometry(0.032, 22, 16), ballMat);
  ball.position.y = 0.104;
  stick.add(ball);

  const btnX = 0.235;
  const btnZ = -0.01;
  add(deck, new THREE.CylinderGeometry(0.08, 0.084, 0.018, 28), ink, btnX, 0.047, btnZ, false, false);
  add(deck, new THREE.TorusGeometry(0.07, 0.006, 6, 28), chromeMat, btnX, 0.058, btnZ, false, false).rotation.x =
    Math.PI / 2;
  const btnGlowRing = add(
    deck,
    new THREE.TorusGeometry(0.06, 0.004, 6, 28),
    glow('#fff5b8', 1.15),
    btnX,
    0.064,
    btnZ,
    false,
    false
  );
  btnGlowRing.rotation.x = Math.PI / 2;

  const capMat = new THREE.MeshStandardMaterial({
    color: CAB.yellow,
    emissive: new THREE.Color('#ffd026'),
    emissiveIntensity: 0.6,
    roughness: 0.14,
    metalness: 0.02,
    envMapIntensity: 1.25,
  });
  const capGroup = new THREE.Group();
  capGroup.position.set(btnX, 0.066, btnZ);
  capGroup.userData.noMerge = true;
  deck.add(capGroup);

  const capSide = new THREE.Mesh(new THREE.CylinderGeometry(0.056, 0.06, 0.022, 26), capMat);
  capSide.position.y = 0.011;
  capGroup.add(capSide);
  const capTop = new THREE.Mesh(new THREE.SphereGeometry(0.056, 22, 12), capMat);
  capTop.scale.set(1, 0.34, 1);
  capTop.position.y = 0.022;
  capGroup.add(capTop);

  const buttonHit = new THREE.Mesh(
    new THREE.BoxGeometry(0.22, 0.16, 0.22),
    new THREE.MeshBasicMaterial({ visible: false })
  );
  buttonHit.position.set(btnX, 0.09, btnZ);
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

  add(
    root,
    new THREE.PlaneGeometry(0.96, 0.62),
    new THREE.MeshBasicMaterial({ map: chamberBackTexture(), toneMapped: false }),
    0,
    0.99,
    -0.372
  );

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

  for (const sx of [-1, 1]) {
    add(
      root,
      new THREE.CylinderGeometry(0.008, 0.008, 0.58, 10),
      new THREE.MeshBasicMaterial({ color: '#f2fbff', toneMapped: false }),
      sx * 0.428,
      1.025,
      0.32
    );
  }

  const glassFront = add(root, new THREE.PlaneGeometry(0.88, 0.57), glass, 0, 1.025, 0.401);
  glassFront.renderOrder = 3;

  const streak = streakTexture();
  const reflection = add(
    root,
    new THREE.PlaneGeometry(0.75, 0.14),
    new THREE.MeshBasicMaterial({
      map: streak,
      transparent: true,
      opacity: 0.055,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
    -0.06,
    1.15,
    0.405
  );
  reflection.rotation.z = 0.45;
  reflection.renderOrder = 4;

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

  add(root, rbox(1.09, 0.34, 0.175, 0.035), pinkDeep, 0, 1.602, 0.295, true, false);
  add(root, rbox(1.05, 0.305, 0.18, 0.028), pink, 0, 1.602, 0.302);
  add(root, rbox(1.1, 0.024, 0.184, 0.008), pinkInk, 0, 1.78, 0.295);

  const marqueeTex = marqueeTexture();
  add(
    root,
    new THREE.PlaneGeometry(0.99, 0.29),
    backlit(marqueeTex, 0.08),
    0,
    1.602,
    0.3945
  );

  add(root, rbox(1.026, 0.024, 0.014, 0.006), pinkDeep, 0, 1.75, 0.3935);
  add(root, rbox(1.026, 0.022, 0.014, 0.006), pinkDeep, 0, 1.454, 0.3935);
  add(root, rbox(0.024, 0.318, 0.014, 0.006), pinkDeep, -0.502, 1.602, 0.3935);
  add(root, rbox(0.024, 0.318, 0.014, 0.006), pinkDeep, 0.502, 1.602, 0.3935);

  // vertical ポートフォリオ sticker on the front of the right blue pillar
  const sideTex = sideDecalTexture();
  const frontPillarDecal = add(
    root,
    new THREE.PlaneGeometry(0.068, 0.32),
    new THREE.MeshBasicMaterial({ map: sideTex, transparent: true, depthWrite: false }),
    0.488,
    1.03,
    frameZ + 0.0445
  );
  frontPillarDecal.renderOrder = 4;

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
    capMat.emissiveIntensity = on ? 0.6 : 0.1;
    (btnGlowRing.material as THREE.MeshStandardMaterial).emissiveIntensity = on ? 1.15 : 0.15;
  }

  function update(dt: number) {
    if (press > 0) {
      press = Math.max(0, press - dt * 4.5);
      capGroup.position.y = capBaseY - 0.01 * Math.sin((1 - press) * Math.PI);
    }
    const pulse = enabled ? 0.56 + Math.sin(performance.now() * 0.0032) * 0.12 : 0.1;
    capMat.emissiveIntensity = pulse;
  }

  return { root, glass, buttonHit, pressButton, setButtonEnabled, update, stick, capGroup };
}
