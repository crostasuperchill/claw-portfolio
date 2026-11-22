import { describe, expect, it } from 'vitest';
import { Cycle, DURATION, nextPhase } from '../src/game/machine';

describe('cycle', () => {
  it('follows the right order', () => {
    expect(nextPhase('drop')).toBe('close');
    expect(nextPhase('release')).toBe('return');
    expect(nextPhase('return')).toBe('idle');
  });

  it('returns to idle in under 6 seconds', () => {
    const c = new Cycle();
    let t = 0;
    c.start();
    while (c.phase !== 'idle' && t < 10) {
      c.tick(1 / 60);
      t += 1 / 60;
    }
    expect(c.phase).toBe('idle');
    expect(t).toBeLessThan(6);
  });

  it('does not restart while already running', () => {
    const c = new Cycle();
    c.start();
    c.tick(0.1);
    expect(c.start()).toBe('drop');
    expect(Object.values(DURATION).every((d) => d > 0)).toBe(true);
  });
});
