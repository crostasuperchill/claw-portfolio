import * as THREE from 'three';
import type { UvRect } from '../contracts';

/* ------------------------------------------------------------------ */
/* sticker atlas                                                       */
/* ------------------------------------------------------------------ */

const JP = '"Hiragino Sans", "Hiragino Kaku Gothic ProN", "Noto Sans JP", "Yu Gothic", sans-serif';
const LATIN = '"Arial Rounded MT Bold", "Arial Black", "Helvetica Neue", Inter, Helvetica, sans-serif';
const MONO = '"SF Mono", "Roboto Mono", Menlo, "Courier New", monospace';

type Style = 'pill' | 'plate' | 'warning' | 'badge' | 'plain' | 'smiley';

type StickerSpec = {
  label: string;
  text: string;
  style: Style;
  bg?: string;
  fg?: string;
  border?: string;
  sub?: string;
  rot?: number;
  vinyl?: boolean;
  code?: string;
};

const PINK = '#f59ec6';
const PINK_DEEP = '#e56da6';
const PINK_INK = '#d9458c';
const AZURE = '#3594e8';
const AZURE_LIGHT = '#5cb5f7';
const YELLOW = '#ffd228';
const WHITE = '#fffaf8';
const INK = '#1a1620';
const RED = '#ec2934';

const STICKERS: StickerSpec[] = [
  { label: 'クレーンゲーム', text: 'クレーンゲーム', style: 'pill', bg: PINK, fg: WHITE, border: WHITE, rot: -0.03 },
  { label: 'ポートフォリオ', text: 'ポートフォリオ', style: 'pill', bg: WHITE, fg: PINK_INK, border: PINK, rot: 0.02 },
  { label: 'たんけんちゅう', text: 'たんけんちゅう', style: 'pill', bg: PINK, fg: WHITE, border: WHITE, rot: -0.07 },
  { label: 'でんしゅつこ', text: 'でんしゅつこ', style: 'pill', bg: '#ffd9e8', fg: PINK_INK, border: WHITE, rot: 0.04 },
  { label: 'ゲット', text: 'ゲット', style: 'badge', bg: PINK, fg: WHITE, border: WHITE },
  { label: 'プライズ', text: 'プライズ', style: 'badge', bg: AZURE, fg: WHITE, border: WHITE },
  { label: 'だいすき', text: 'だいすき', style: 'badge', bg: '#ffd9e8', fg: PINK_INK, border: WHITE },
  { label: 'あそびかた', text: 'あそびかた', style: 'plate', bg: WHITE, fg: INK, border: AZURE_LIGHT, rot: -0.02, code: 'HOW TO PLAY' },
  { label: 'ガチャ', text: 'ガチャ', style: 'plate', bg: WHITE, fg: PINK_INK, border: PINK, rot: 0.03 },
  { label: 'うけとりぐち', text: 'うけとりぐち', style: 'plate', bg: WHITE, fg: INK, border: PINK_DEEP, rot: -0.02, code: 'PRIZE OUT' },
  { label: 'でぐち', text: 'でぐち', style: 'plate', bg: WHITE, fg: INK, border: PINK_DEEP, code: 'EXIT' },
  { label: 'けんびき', text: 'けんびき', style: 'plain', fg: PINK_INK },
  { label: 'おしらせ', text: 'おしらせ', style: 'plate', bg: WHITE, fg: INK, border: AZURE, code: 'NOTICE' },
  { label: 'カプセル', text: 'カプセル', style: 'plate', bg: WHITE, fg: INK, border: AZURE_LIGHT, code: 'CAPSULE' },
  { label: 'PRIZE', text: 'PRIZE', style: 'plate', bg: WHITE, fg: PINK_INK, border: PINK, code: 'PRIZE' },
  { label: 'CAUTION', text: 'CAUTION', style: 'warning', bg: YELLOW, fg: INK, border: INK, sub: 'KEEP HANDS CLEAR / 手を近づけない' },
  { label: 'HANDLE WITH CARE', text: 'HANDLE WITH CARE', style: 'plate', bg: WHITE, fg: INK, border: PINK_DEEP, code: 'FRAGILE' },
  { label: 'MADE IN JAPAN', text: 'MADE IN JAPAN', style: 'plate', bg: WHITE, fg: INK, border: AZURE_LIGHT, code: 'UFO-1024' },
  { label: 'NO STEP', text: 'NO STEP', style: 'warning', bg: WHITE, fg: RED, border: RED, sub: '足をのせないでください' },
  { label: 'FRAGILE', text: 'FRAGILE', style: 'warning', bg: YELLOW, fg: INK, border: INK, sub: 'FRAGILE / われもの注意' },
  { label: 'WARNING', text: 'WARNING', style: 'warning', bg: YELLOW, fg: INK, border: INK, sub: 'CAUTION: MOVING PARTS / 可動部注意' },
  { label: 'SMILE', text: '', style: 'smiley', bg: YELLOW, fg: INK, border: INK },
  { label: 'PLAY / スタート', text: 'PLAY / スタート', style: 'plate', bg: WHITE, fg: PINK_INK, border: PINK, code: 'START' },
  { label: 'スタート', text: 'スタート', style: 'badge', bg: YELLOW, fg: INK, border: WHITE },
  { label: 'INSERT COIN', text: 'INSERT COIN', style: 'plate', bg: WHITE, fg: INK, border: AZURE, code: 'コイン' },
  { label: '1 PLAY / ¥100', text: '1 PLAY / ¥100', style: 'plate', bg: WHITE, fg: PINK_INK, border: PINK_DEEP, code: '1回' },
  { label: 'SERVICE', text: 'SERVICE', style: 'plate', bg: WHITE, fg: RED, border: RED, code: '保守' },
  { label: 'PUSH', text: 'PUSH', style: 'pill', bg: YELLOW, fg: INK, border: INK, rot: 0 },
  { label: 'COIN RETURN', text: 'COIN RETURN', style: 'plate', bg: WHITE, fg: INK, border: AZURE_LIGHT, code: '返却' },
];

/* Re-paint the atlas once custom Japanese/rounded fonts settle, keeping the
 * exact same layout so the published UV rects stay valid. */
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

let measureCtx: CanvasRenderingContext2D | null = null;

function measure() {
  if (!measureCtx) {
    const c = document.createElement('canvas');
    c.width = 8;
    c.height = 8;
    measureCtx = c.getContext('2d')!;
  }
  return measureCtx;
}

function setFont(g: CanvasRenderingContext2D, weight: number, size: number, family = JP) {
  g.font = `${weight} ${Math.max(6, size)}px ${family}`;
}

function tracking(g: CanvasRenderingContext2D, px: number) {
  (g as unknown as { letterSpacing?: string }).letterSpacing = `${px}px`;
}

function textWidth(text: string, weight: number, size: number, family = JP) {
  const g = measure();
  setFont(g, weight, size, family);
  return g.measureText(text).width;
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
  setFont(g, weight, s, family);
  while (s > 7 && g.measureText(text).width > maxW) {
    s -= Math.max(1, s * 0.035);
    setFont(g, weight, s, family);
  }
  return s;
}

function roundRect(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  g.beginPath();
  g.roundRect(x, y, w, h, Math.max(0, Math.min(r, w / 2, h / 2)));
}

function vinylShadow(g: CanvasRenderingContext2D, h: number) {
  g.shadowColor = 'rgba(38, 12, 30, 0.24)';
  g.shadowBlur = h * 0.07;
  g.shadowOffsetX = 0;
  g.shadowOffsetY = h * 0.04;
}

function clearShadow(g: CanvasRenderingContext2D) {
  g.shadowColor = 'transparent';
  g.shadowBlur = 0;
  g.shadowOffsetY = 0;
}

function drawSmiley(g: CanvasRenderingContext2D, r: number) {
  g.fillStyle = YELLOW;
  g.beginPath();
  g.arc(0, 0, r, 0, Math.PI * 2);
  g.fill();
  g.strokeStyle = INK;
  g.lineWidth = Math.max(3, r * 0.09);
  g.stroke();
  g.fillStyle = INK;
  for (const s of [-1, 1]) {
    g.beginPath();
    g.ellipse(s * r * 0.33, -r * 0.18, r * 0.085, r * 0.12, 0, 0, Math.PI * 2);
    g.fill();
  }
  g.strokeStyle = INK;
  g.lineWidth = Math.max(3, r * 0.09);
  g.lineCap = 'round';
  g.beginPath();
  g.arc(0, r * 0.04, r * 0.42, 0.18 * Math.PI, 0.82 * Math.PI);
  g.stroke();
}

function drawSticker(g: CanvasRenderingContext2D, spec: StickerSpec, w: number, h: number) {
  const vinyl = spec.vinyl !== false;
  g.save();
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.lineJoin = 'round';

  if (spec.style === 'warning') {
    const radius = h * 0.05;
    if (vinyl) vinylShadow(g, h);
    g.fillStyle = spec.bg ?? YELLOW;
    roundRect(g, -w / 2, -h / 2, w, h, radius);
    g.fill();
    clearShadow(g);

    g.strokeStyle = spec.border ?? INK;
    g.lineWidth = h * 0.035;
    roundRect(g, -w / 2 + h * 0.035, -h / 2 + h * 0.035, w - h * 0.07, h - h * 0.07, radius * 0.8);
    g.stroke();

    const tx = -w / 2 + h * 0.42;
    g.fillStyle = spec.fg ?? INK;
    g.beginPath();
    g.moveTo(tx, -h * 0.19);
    g.lineTo(tx + h * 0.2, h * 0.15);
    g.lineTo(tx - h * 0.2, h * 0.15);
    g.closePath();
    g.fill();
    g.fillStyle = spec.bg ?? YELLOW;
    g.font = `900 ${h * 0.2}px ${LATIN}`;
    g.fillText('!', tx, h * 0.055);

    const x0 = -w / 2 + h * 0.74;
    const maxW = w - h * 0.95;
    const size = fitFont(g, spec.text, maxW, h * 0.31, 900, LATIN);
    tracking(g, size * 0.015);
    g.textAlign = 'left';
    g.fillStyle = spec.fg ?? INK;
    setFont(g, 900, size, LATIN);
    g.fillText(spec.text, x0, -h * 0.115);
    tracking(g, 0);

    if (spec.sub) {
      const ssize = fitFont(g, spec.sub, maxW, h * 0.105, 700, JP);
      setFont(g, 700, ssize, JP);
      g.fillText(spec.sub, x0, h * 0.165);
    }

    g.restore();
    return;
  }

  if (spec.style === 'badge') {
    const r = Math.min(w, h) * 0.46;
    if (vinyl) vinylShadow(g, h);
    g.fillStyle = spec.bg ?? PINK;
    g.beginPath();
    g.arc(0, 0, r, 0, Math.PI * 2);
    g.fill();
    clearShadow(g);
    g.strokeStyle = spec.border ?? WHITE;
    g.lineWidth = h * 0.045;
    g.beginPath();
    g.arc(0, 0, r - h * 0.03, 0, Math.PI * 2);
    g.stroke();

    const size = fitFont(g, spec.text, r * 1.34, r * 0.46, 900, JP);
    g.fillStyle = spec.fg ?? WHITE;
    setFont(g, 900, size, JP);
    g.fillText(spec.text, 0, h * 0.01);
    g.restore();
    return;
  }

  if (spec.style === 'smiley') {
    if (vinyl) vinylShadow(g, h);
    drawSmiley(g, Math.min(w, h) * 0.46);
    g.restore();
    return;
  }

  if (spec.style === 'plain') {
    const size = fitFont(g, spec.text, w * 0.98, h * 0.62, 900, JP);
    setFont(g, 900, size, JP);
    g.strokeStyle = 'rgba(255,255,255,0.96)';
    g.lineWidth = h * 0.13;
    g.strokeText(spec.text, 0, 0);
    g.fillStyle = spec.fg ?? PINK_INK;
    g.fillText(spec.text, 0, 0);
    g.restore();
    return;
  }

  const round = spec.style === 'pill' ? h * 0.5 : h * 0.12;
  if (vinyl) vinylShadow(g, h);
  g.fillStyle = spec.bg ?? WHITE;
  roundRect(g, -w / 2, -h / 2, w, h, round);
  g.fill();
  clearShadow(g);

  g.strokeStyle = spec.border ?? (spec.style === 'pill' ? WHITE : PINK);
  g.lineWidth = h * (spec.style === 'pill' ? 0.055 : 0.03);
  roundRect(g, -w / 2 + h * 0.035, -h / 2 + h * 0.035, w - h * 0.07, h - h * 0.07, round * 0.94);
  g.stroke();

  if (spec.style === 'pill') {
    const size = fitFont(g, spec.text, w - h * 0.34, h * 0.5, 900, JP);
    g.fillStyle = spec.fg ?? INK;
    setFont(g, 900, size, JP);
    g.fillText(spec.text, 0, h * 0.015);
    g.restore();
    return;
  }

  const accent = spec.border ?? PINK;
  g.fillStyle = accent;
  roundRect(g, -w / 2 + h * 0.13, -h * 0.25, h * 0.075, h * 0.5, h * 0.035);
  g.fill();

  const textX = -w / 2 + h * 0.3;
  const codeW = w > h * 3.1 ? h * 0.78 : 0;
  const size = fitFont(g, spec.text, w - (textX + w / 2) - codeW - h * 0.18, h * 0.44, 800, JP);
  setFont(g, 800, size, JP);
  g.textAlign = 'left';
  g.fillStyle = spec.fg ?? INK;
  g.fillText(spec.text, textX, h * 0.015);

  if (codeW) {
    g.textAlign = 'right';
    g.globalAlpha = 0.45;
    g.fillStyle = spec.fg ?? INK;
    setFont(g, 700, h * 0.115, MONO);
    g.fillText(spec.code ?? 'UFO-1024', w / 2 - h * 0.14, -h * 0.26);
    g.globalAlpha = 1;
  }
  g.restore();
}

type Metrics = { w: number; h: number };

function metricsFor(spec: StickerSpec, S: number): Metrics {
  if (spec.style === 'badge') return { w: 290 * S, h: 290 * S };
  if (spec.style === 'smiley') return { w: 270 * S, h: 270 * S };
  if (spec.style === 'warning') return { w: 640 * S, h: 232 * S };

  const h = (spec.style === 'plate' ? 124 : spec.style === 'pill' ? 108 : 152) * S;
  const size = (spec.style === 'plate' ? 0.44 : spec.style === 'pill' ? 0.5 : 0.56) * h;
  const tw = textWidth(spec.text, spec.style === 'plain' ? 900 : 800, size, JP);
  const w =
    spec.style === 'plate'
      ? Math.max(300 * S, tw + h * 1.1)
      : spec.style === 'pill'
        ? Math.max(250 * S, tw + h * 0.95)
        : Math.max(300 * S, tw + h * 0.5);
  return { w, h };
}

function packStickers(items: StickerSpec[], S: number, size: number) {
  const PAD = Math.round(30 * S);
  const GAP = Math.round(20 * S);
  const cells: { spec: StickerSpec; x: number; y: number; w: number; h: number }[] = [];
  const ordered = [...items].sort((a, b) => metricsFor(b, S).h - metricsFor(a, S).h);
  let x = PAD;
  let y = PAD;
  let rowH = 0;
  for (const spec of ordered) {
    const m = metricsFor(spec, S);
    if (x + m.w + PAD > size) {
      x = PAD;
      y += rowH + GAP;
      rowH = 0;
    }
    cells.push({ spec, x, y, w: m.w, h: m.h });
    x += m.w + GAP;
    rowH = Math.max(rowH, m.h);
  }
  return { cells, bottom: y + rowH + PAD };
}

export function buildDecalAtlas(size = 2048) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const g = canvas.getContext('2d')!;

  let S = (1.42 * size) / 2048;
  let packed = packStickers(STICKERS, S, size);
  for (let i = 0; i < 10 && packed.bottom > size; i++) {
    S *= 0.94;
    packed = packStickers(STICKERS, S, size);
  }

  const rects: Record<string, UvRect> = {};
  const RAD = 30 * S;

  const paint = () => {
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, size, size);
    g.imageSmoothingQuality = 'high';
    for (const cell of packed.cells) {
      const { spec, w, h } = cell;
      const rot = spec.rot ?? 0;
      const cx = cell.x + cell.w / 2;
      const cy = cell.y + cell.h / 2;
      g.save();
      g.translate(cx, cy);
      g.rotate(rot);
      drawSticker(g, spec, w, h);
      g.restore();
    }
  };
  paint();

  for (const cell of packed.cells) {
    const { spec, w, h } = cell;
    const rot = spec.rot ?? 0;
    const cx = cell.x + cell.w / 2;
    const cy = cell.y + cell.h / 2;

    const c = Math.abs(Math.cos(rot));
    const s = Math.abs(Math.sin(rot));
    const bw = w * c + h * s;
    const bh = w * s + h * c;
    const rectW = Math.max(8, cell.w - RAD * 1.2);
    const rectH = Math.max(8, cell.h - RAD * 1.2);
    const footprintW = Math.min(rectW, bw);
    const footprintH = Math.min(rectH, bh);
    rects[spec.label] = {
      x: (cx - footprintW / 2) / size,
      y: 1 - (cy + footprintH / 2) / size,
      w: footprintW / size,
      h: footprintH / size,
    };
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 16;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.generateMipmaps = true;

  const repaint = () => {
    paint();
    tex.needsUpdate = true;
  };
  if (fontsSettled) repaint();
  else fontRepaints.add(repaint);

  return { texture: tex, rects };
}

export type DecalOptions = {
  opacity?: number;
  tint?: THREE.ColorRepresentation;
  gloss?: boolean;
};

const decalMatCache = new Map<string, THREE.MeshStandardMaterial>();

export function decalMesh(
  atlas: THREE.Texture,
  rect: UvRect,
  w: number,
  h: number,
  opts: DecalOptions = {}
) {
  const geo = new THREE.PlaneGeometry(w, h);
  const uv = geo.attributes.uv as THREE.BufferAttribute;
  for (let i = 0; i < uv.count; i++) {
    uv.setXY(i, rect.x + uv.getX(i) * rect.w, rect.y + uv.getY(i) * rect.h);
  }
  uv.needsUpdate = true;

  const opacity = opts.opacity ?? 0.98;
  const tint = new THREE.Color(opts.tint ?? '#ffffff').getHexString();
  const gloss = opts.gloss ? 1 : 0;
  const key = `${atlas.uuid}:${opacity}:${tint}:${gloss}`;

  let mat = decalMatCache.get(key);
  if (!mat) {
    mat = new THREE.MeshStandardMaterial({
      map: atlas,
      color: `#${tint}`,
      transparent: true,
      opacity,
      depthWrite: false,
      roughness: gloss ? 0.25 : 0.45,
      metalness: 0,
      side: THREE.DoubleSide,
      polygonOffset: true,
      polygonOffsetFactor: -4,
      polygonOffsetUnits: -4,
    });
    decalMatCache.set(key, mat);
  }

  const mesh = new THREE.Mesh(geo, mat);
  mesh.renderOrder = 2;
  return mesh;
}
