import * as THREE from 'three';
import type { UvRect } from '../contracts';

/* ------------------------------------------------------------------ */
/* sticker atlas                                                       */
/*                                                                     */
/* Stickers are shelf-packed at their natural aspect ratio, so a label */
/* never gets squeezed onto its decal quad.  Every rect is the exact   */
/* visible footprint of the print (rotation included) plus the shadow  */
/* margin, which is why the type stays crisp instead of being scaled   */
/* by a maxWidth argument.                                             */
/* ------------------------------------------------------------------ */

const JP = '"Hiragino Sans", "Hiragino Kaku Gothic ProN", "Noto Sans JP", "Yu Gothic", "Meiryo", sans-serif';
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
  /** false for labels printed straight onto the panel (no vinyl drop shadow) */
  vinyl?: boolean;
  code?: string;
};

const PINK = '#f2a7c3';
const PINK_DEEP = '#dd7ba6';
const PINK_INK = '#d94f8b';
const AZURE = '#3f8fe0';
const AZURE_LIGHT = '#5aa9e6';
const YELLOW = '#ffd21e';
const WHITE = '#fffaf8';
const INK = '#17141a';
const RED = '#e8262b';

const STICKERS: StickerSpec[] = [
  // marquee / header badges
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
  // hardware plates: coin door, service, vents
  { label: 'INSERT COIN', text: 'INSERT COIN', style: 'plate', bg: WHITE, fg: INK, border: AZURE, code: 'コイン' },
  { label: '1 PLAY / ¥100', text: '1 PLAY / ¥100', style: 'plate', bg: WHITE, fg: PINK_INK, border: PINK_DEEP, code: '1回' },
  { label: 'SERVICE', text: 'SERVICE', style: 'plate', bg: WHITE, fg: RED, border: RED, code: '保守' },
  { label: 'PUSH', text: 'PUSH', style: 'pill', bg: YELLOW, fg: INK, border: INK, rot: 0 },
  { label: 'COIN RETURN', text: 'COIN RETURN', style: 'plate', bg: WHITE, fg: INK, border: AZURE_LIGHT, code: '返却' },
];

/* ------------------------------------------------------------------ */
/* measuring + typography helpers                                      */
/* ------------------------------------------------------------------ */

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
  g.shadowColor = 'rgba(38, 12, 30, 0.32)';
  g.shadowBlur = h * 0.09;
  g.shadowOffsetX = 0;
  g.shadowOffsetY = h * 0.055;
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

/* ------------------------------------------------------------------ */
/* one sticker, drawn centred on (0,0) with its own w x h box          */
/* ------------------------------------------------------------------ */

function drawSticker(g: CanvasRenderingContext2D, spec: StickerSpec, w: number, h: number) {
  const vinyl = spec.vinyl !== false;
  g.save();
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.lineJoin = 'round';
  g.imageSmoothingQuality = 'high';

  if (spec.style === 'warning') {
    const radius = h * 0.05;
    if (vinyl) vinylShadow(g, h);
    g.fillStyle = spec.bg ?? YELLOW;
    roundRect(g, -w / 2, -h / 2, w, h, radius);
    g.fill();
    clearShadow(g);

    // printed hazard stripes, very low contrast so the text stays king
    g.save();
    roundRect(g, -w / 2, -h / 2, w, h, radius);
    g.clip();
    if (spec.bg === YELLOW) {
      g.globalAlpha = 0.1;
      g.fillStyle = INK;
      for (let i = -h * 2; i < w; i += h * 0.36) {
        g.beginPath();
        g.moveTo(-w / 2 + i, h / 2);
        g.lineTo(-w / 2 + i + h * 0.17, h / 2);
        g.lineTo(-w / 2 + i + h * 0.17 + h, -h / 2);
        g.lineTo(-w / 2 + i + h, -h / 2);
        g.closePath();
        g.fill();
      }
      g.globalAlpha = 1;
    }
    g.restore();

    g.strokeStyle = spec.border ?? INK;
    g.lineWidth = h * 0.035;
    roundRect(g, -w / 2 + h * 0.035, -h / 2 + h * 0.035, w - h * 0.07, h - h * 0.07, radius * 0.8);
    g.stroke();

    // hazard triangle
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

    g.fillStyle = spec.fg ?? INK;
    g.globalAlpha = 0.35;
    g.fillRect(x0, h * 0.035, maxW * 0.55, h * 0.008);
    g.globalAlpha = 1;

    if (spec.sub) {
      const ssize = fitFont(g, spec.sub, maxW, h * 0.105, 700, JP);
      setFont(g, 700, ssize, JP);
      g.fillText(spec.sub, x0, h * 0.165);
    }

    // tiny inspection code, like a real safety label
    g.globalAlpha = 0.5;
    setFont(g, 700, h * 0.07, MONO);
    g.textAlign = 'right';
    g.fillText('S-04', w / 2 - h * 0.09, h * 0.34);
    g.globalAlpha = 1;
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
    // printed inner keyline
    g.strokeStyle = 'rgba(0,0,0,0.14)';
    g.lineWidth = h * 0.012;
    g.beginPath();
    g.arc(0, 0, r * 0.82, 0, Math.PI * 2);
    g.stroke();
    const size = fitFont(g, spec.text, r * 1.34, r * 0.46, 900, JP);
    g.fillStyle = spec.fg ?? WHITE;
    setFont(g, 900, size, JP);
    g.fillText(spec.text, 0, h * 0.01);
    // little star above the word
    g.fillStyle = spec.fg ?? WHITE;
    g.globalAlpha = 0.85;
    g.beginPath();
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
      const rr = i % 2 === 0 ? r * 0.13 : r * 0.055;
      const px = Math.cos(a) * rr;
      const py = Math.sin(a) * rr - r * 0.42;
      if (i === 0) g.moveTo(px, py);
      else g.lineTo(px, py);
    }
    g.closePath();
    g.fill();
    g.globalAlpha = 1;
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
    g.fillStyle = 'rgba(255,255,255,0.9)';
    g.fillRect(-w * 0.16, h * 0.33, w * 0.32, h * 0.035);
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

  // glossy vinyl top edge
  g.save();
  g.globalAlpha = 0.35;
  g.strokeStyle = 'rgba(255,255,255,0.9)';
  g.lineWidth = Math.max(1, h * 0.018);
  g.beginPath();
  g.moveTo(-w / 2 + h * 0.28, -h * 0.3);
  g.lineTo(w / 2 - h * 0.28, -h * 0.3);
  g.stroke();
  g.restore();

  if (spec.style === 'pill') {
    const size = fitFont(g, spec.text, w - h * 0.34, h * 0.5, 900, JP);
    g.fillStyle = spec.fg ?? INK;
    setFont(g, 900, size, JP);
    g.fillText(spec.text, 0, h * 0.015);
    g.restore();
    return;
  }

  // ---- plate: index bar, main word, micro code -------------------
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
    g.globalAlpha = 0.3;
    g.fillRect(w / 2 - h * 0.62, h * 0.2, h * 0.48, h * 0.02);
    g.globalAlpha = 1;
  }
  g.restore();
}

/* ------------------------------------------------------------------ */
/* layout                                                              */
/* ------------------------------------------------------------------ */

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
  // tall first, so the shelf rows waste as little sheet as possible
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
  g.imageSmoothingQuality = 'high';

  // grow the sheet until it just fits: more pixels per sticker means the
  // print stays sharp even when a 6 cm label is only 40 px on screen
  let S = 1.42;
  let packed = packStickers(STICKERS, S, size);
  for (let i = 0; i < 10 && packed.bottom > size; i++) {
    S *= 0.94;
    packed = packStickers(STICKERS, S, size);
  }

  const rects: Record<string, UvRect> = {};
  const RAD = 30 * S; // shadow + rotation margin kept outside the UV rect

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

    // scuffed vinyl corners: destination-out is confined to this cell
    const c = Math.abs(Math.cos(rot));
    const s = Math.abs(Math.sin(rot));
    const bw = w * c + h * s;
    const bh = w * s + h * c;
    const rnd = (() => {
      let seed = 0x9e37 + spec.label.length * 7919;
      return () => {
        seed = (seed * 1664525 + 1013904223) >>> 0;
        return seed / 4294967296;
      };
    })();
    g.save();
    g.translate(cx, cy);
    g.globalCompositeOperation = 'destination-out';
    for (let k = 0; k < 5; k++) {
      const edge = Math.floor(rnd() * 4);
      const t = rnd();
      let px = 0;
      let py = 0;
      if (edge === 0) {
        px = -bw / 2 + t * bw;
        py = -bh / 2 + 1;
      } else if (edge === 1) {
        px = -bw / 2 + t * bw;
        py = bh / 2 - 1;
      } else if (edge === 2) {
        px = -bw / 2 + 1;
        py = -bh / 2 + t * bh;
      } else {
        px = bw / 2 - 1;
        py = -bh / 2 + t * bh;
      }
      g.beginPath();
      g.ellipse(px, py, (1.2 + rnd() * 3.2) * S, (0.7 + rnd() * 1.6) * S, rnd() * Math.PI, 0, Math.PI * 2);
      g.fill();
    }
    g.restore();

    // exact UV window: footprint minus the transparent margin, so the
    // decal quad inherits the print's real aspect ratio
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

  if (packed.bottom > size) console.warn('[decals] atlas overflow', packed.bottom, size);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 16;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.generateMipmaps = true;
  return { texture: tex, rects };
}

export type DecalOptions = {
  /** overall ink opacity: 1 new, less for sun-faded stickers */
  opacity?: number;
  /** white point of the print */
  tint?: THREE.ColorRepresentation;
  /** matte vinyl (default) vs glossier label stock */
  gloss?: boolean;
};

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
  const mat = new THREE.MeshPhysicalMaterial({
    map: atlas,
    color: opts.tint ?? '#ffffff',
    transparent: true,
    opacity: opts.opacity ?? 0.98,
    depthWrite: false,
    roughness: opts.gloss ? 0.22 : 0.46,
    clearcoat: opts.gloss ? 0.95 : 0.3,
    clearcoatRoughness: opts.gloss ? 0.06 : 0.36,
    side: THREE.DoubleSide,
    polygonOffset: true,
    polygonOffsetFactor: -4,
    polygonOffsetUnits: -4,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.renderOrder = 2;
  return mesh;
}
