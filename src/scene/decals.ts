import * as THREE from 'three';
import type { UvRect } from '../contracts';

const LABELS = [
  'ゲット',
  'プライズ',
  'あそびかた',
  'ガチャ',
  'うけとりぐち',
  'でぐち',
  'けんびき',
  'おしらせ',
  'だいすき',
  'カプセル',
  'PRIZE',
  'CAUTION',
  'HANDLE WITH CARE',
  'MADE IN JAPAN',
  'NO STEP',
  'FRAGILE',
];

function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

export function buildDecalAtlas(size = 2048) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const g = canvas.getContext('2d')!;
  const cols = 4;
  const cell = size / cols;
  const rects: Record<string, UvRect> = {};

  LABELS.forEach((label, i) => {
    const cx = (i % cols) * cell + cell / 2;
    const cy = Math.floor(i / cols) * cell + cell / 2;
    const w = cell * 0.78;
    const h = cell * (i % 3 === 0 ? 0.3 : 0.2);
    g.save();
    g.translate(cx, cy);
    g.rotate((((i * 37) % 11) - 5) * 0.012);
    g.fillStyle = ['#2B4BFF', '#FF3D7F', '#111111', '#FFFFFF'][i % 4];
    if (i % 3 === 0) {
      g.beginPath();
      g.roundRect(-w / 2, -h / 2, w, h, h / 2);
      g.fill();
    } else {
      g.fillRect(-w / 2, -h / 2, w, h);
      g.strokeStyle = 'rgba(0,0,0,.28)';
      g.lineWidth = 3;
      g.strokeRect(-w / 2, -h / 2, w, h);
    }
    g.fillStyle = i % 4 === 1 || (i % 3 === 0 && i % 4 !== 3) ? '#fff' : '#111';
    g.font = `800 ${Math.round(h * 0.52)}px "Hiragino Sans", Inter, sans-serif`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(label, 0, 1, w * 0.9);
    g.restore();

    // light wear: small chips on the edges + a couple of hairline scratches.
    // Destination-out only inside this cell, so neighbouring labels are safe.
    const rnd = rng(0x9e37 + i * 7919);
    g.save();
    g.globalCompositeOperation = 'destination-out';
    for (let k = 0; k < 18; k++) {
      const edge = Math.floor(rnd() * 4);
      const t = rnd();
      let px = cx;
      let py = cy;
      if (edge === 0) {
        px = cx - w / 2 + t * w;
        py = cy - h / 2 + 1;
      } else if (edge === 1) {
        px = cx - w / 2 + t * w;
        py = cy + h / 2 - 1;
      } else if (edge === 2) {
        px = cx - w / 2 + 1;
        py = cy - h / 2 + t * h;
      } else {
        px = cx + w / 2 - 1;
        py = cy - h / 2 + t * h;
      }
      g.beginPath();
      g.ellipse(
        px,
        py,
        1.5 + rnd() * 7,
        0.8 + rnd() * 3.4,
        rnd() * Math.PI,
        0,
        Math.PI * 2
      );
      g.fill();
    }
    // scuffed patch inside the print
    g.beginPath();
    g.ellipse(cx + (rnd() - 0.5) * w * 0.5, cy + (rnd() - 0.5) * h * 0.6, w * 0.08, h * 0.16, rnd(), 0, Math.PI * 2);
    g.fillStyle = 'rgba(0,0,0,0.6)';
    g.fill();
    g.strokeStyle = 'rgba(0,0,0,.55)';
    g.lineWidth = 1.2;
    for (let k = 0; k < 3; k++) {
      const x0 = cx - w / 2 + rnd() * w * 0.7;
      const y0 = cy - h / 2 + rnd() * h;
      g.beginPath();
      g.moveTo(x0, y0);
      g.lineTo(x0 + w * 0.12 + rnd() * w * 0.18, y0 + (rnd() - 0.5) * 3);
      g.stroke();
    }
    g.restore();

    rects[label] = {
      x: (cx - w / 2) / size,
      y: 1 - (cy + h / 2) / size,
      w: w / size,
      h: h / size,
    };
  });

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
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
    opacity: opts.opacity ?? 0.97,
    depthWrite: false,
    roughness: opts.gloss ? 0.24 : 0.48,
    clearcoat: opts.gloss ? 0.9 : 0.28,
    clearcoatRoughness: opts.gloss ? 0.08 : 0.4,
    side: THREE.DoubleSide,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.renderOrder = 2;
  return mesh;
}
