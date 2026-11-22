import { describe, expect, it } from 'vitest';
import { PROJECTS } from '../src/game/roster';

describe('roster', () => {
  it('has 6 projects with unique ids', () => {
    expect(PROJECTS).toHaveLength(6);
    expect(new Set(PROJECTS.map((p) => p.id)).size).toBe(6);
  });
  it('every project has a valid url and a real blurb', () => {
    for (const p of PROJECTS) {
      expect(p.url).toMatch(/^(https:|mailto:)/);
      expect(p.blurb.length).toBeGreaterThan(20);
      expect(p.tags.length).toBeGreaterThan(0);
    }
  });
});
