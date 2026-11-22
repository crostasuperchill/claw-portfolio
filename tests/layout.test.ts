import { describe, expect, it } from 'vitest';
import { spawnLayout } from '../src/game/layout';

const opts = {
  seed: 20261122,
  count: 28,
  width: 0.86,
  depth: 0.56,
  radius: 0.055,
  floorY: 0.66,
  exclude: { x: -0.31, z: 0, w: 0.24, d: 0.24 },
};

describe('spawnLayout', () => {
  it('is deterministic', () => {
    expect(spawnLayout(opts)).toEqual(spawnLayout(opts));
  });

  it('stays inside the playfield', () => {
    for (const s of spawnLayout(opts)) {
      expect(Math.abs(s.x)).toBeLessThanOrEqual(0.86 / 2 - 0.055 + 1e-9);
      expect(Math.abs(s.z)).toBeLessThanOrEqual(0.56 / 2 - 0.055 + 1e-9);
      expect(s.y).toBeGreaterThanOrEqual(0.66 + 0.055 - 1e-9);
    }
  });

  it('never spawns inside the chute', () => {
    for (const s of spawnLayout(opts)) {
      const inChute = Math.abs(s.x + 0.31) < 0.12 && Math.abs(s.z) < 0.12;
      expect(inChute).toBe(false);
    }
  });

  it('does not spawn overlapping capsules on the same layer', () => {
    const sp = spawnLayout(opts);
    for (let i = 0; i < sp.length; i++) {
      for (let j = i + 1; j < sp.length; j++) {
        if (Math.abs(sp[i].y - sp[j].y) > 1e-6) continue;
        expect(Math.hypot(sp[i].x - sp[j].x, sp[i].z - sp[j].z)).toBeGreaterThanOrEqual(1.8 * 0.055);
      }
    }
  });
});
