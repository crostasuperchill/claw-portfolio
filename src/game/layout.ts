import { mulberry32, shuffle } from './rng';

export type Spot = { x: number; y: number; z: number };
export type Rect = { x: number; z: number; w: number; d: number };

export function spawnLayout(opts: {
  seed: number;
  count: number;
  width: number;
  depth: number;
  radius: number;
  floorY: number;
  exclude?: Rect;
}): Spot[] {
  const { seed, count, width, depth, radius, floorY, exclude } = opts;
  const rnd = mulberry32(seed);
  const step = radius * 2.3;
  const cols = Math.max(1, Math.floor(width / step));
  const rows = Math.max(1, Math.floor(depth / step));
  const inside = (x: number, z: number) =>
    !exclude ||
    !(Math.abs(x - exclude.x) < exclude.w / 2 && Math.abs(z - exclude.z) < exclude.d / 2);

  const cells: { x: number; z: number }[] = [];
  for (let i = 0; i < cols; i++) {
    for (let j = 0; j < rows; j++) {
      const x = -width / 2 + (i + 0.5) * (width / cols) + (rnd() - 0.5) * radius * 0.2;
      const z = -depth / 2 + (j + 0.5) * (depth / rows) + (rnd() - 0.5) * radius * 0.2;
      if (inside(x, z)) cells.push({ x, z });
    }
  }
  shuffle(cells, rnd);

  const spots: Spot[] = [];
  for (let k = 0; k < count; k++) {
    const c = cells[k % cells.length];
    const layer = Math.floor(k / cells.length);
    const x = c.x + (rnd() - 0.5) * radius * 0.2;
    const z = c.z + (rnd() - 0.5) * radius * 0.2;
    spots.push({
      x: Math.max(-width / 2 + radius, Math.min(width / 2 - radius, x)),
      y: floorY + radius + layer * radius * 2.05 + 0.004,
      z: Math.max(-depth / 2 + radius, Math.min(depth / 2 - radius, z)),
    });
  }
  return spots;
}
