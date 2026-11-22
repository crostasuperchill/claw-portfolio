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

export function decalMesh(atlas: THREE.Texture, rect: UvRect, w: number, h: number) {
  const geo = new THREE.PlaneGeometry(w, h);
  const uv = geo.attributes.uv as THREE.BufferAttribute;
  for (let i = 0; i < uv.count; i++) {
    uv.setXY(i, rect.x + uv.getX(i) * rect.w, rect.y + uv.getY(i) * rect.h);
  }
  uv.needsUpdate = true;
  const mat = new THREE.MeshPhysicalMaterial({
    map: atlas,
    transparent: true,
    depthWrite: false,
    roughness: 0.32,
    clearcoat: 0.8,
    polygonOffset: true,
    polygonOffsetFactor: -2,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.renderOrder = 2;
  return mesh;
}
