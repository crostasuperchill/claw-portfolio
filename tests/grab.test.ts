import { describe, expect, it } from 'vitest';
import { GRAB_THRESHOLD, grabScore, shouldGrab } from '../src/game/grab';

describe('grabScore', () => {
  it('is 1 at the centre and 0 out of reach', () => {
    expect(grabScore(0, 0)).toBe(1);
    expect(grabScore(0.2, 0)).toBe(0);
  });

  it('decreases with distance', () => {
    expect(grabScore(0.02, 0)).toBeGreaterThan(grabScore(0.05, 0));
    expect(grabScore(0.05, 0)).toBeGreaterThan(grabScore(0.09, 0));
  });

  it('threshold sits at 6.7 cm from the axis', () => {
    expect(shouldGrab(0, 0)).toBe(true);
    expect(shouldGrab(0.066, 0)).toBe(true);
    expect(shouldGrab(0.069, 0)).toBe(false);
  });

  it('uses euclidean distance, not per-axis', () => {
    expect(shouldGrab(0.04, 0.04)).toBe(true);
    expect(GRAB_THRESHOLD).toBe(0.35);
  });
});
