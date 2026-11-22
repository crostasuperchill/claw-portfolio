export type Phase = 'idle' | 'drop' | 'close' | 'lift' | 'carry' | 'release' | 'return';

export const ORDER = ['drop', 'close', 'lift', 'carry', 'release', 'return'] as const;

export const DURATION = {
  drop: 1.0,
  close: 0.55,
  lift: 0.8,
  carry: 0.9,
  release: 0.35,
  return: 1.0,
};

export function nextPhase(p: Phase): Phase {
  if (p === 'idle') return 'idle';
  const i = ORDER.indexOf(p as (typeof ORDER)[number]);
  return i === ORDER.length - 1 ? 'idle' : ORDER[i + 1];
}

export class Cycle {
  phase: Phase = 'idle';
  t = 0;

  start(): Phase {
    if (this.phase === 'idle') {
      this.phase = 'drop';
      this.t = 0;
    }
    return this.phase;
  }

  get k(): number {
    if (this.phase === 'idle') return 0;
    return Math.min(1, this.t / DURATION[this.phase as keyof typeof DURATION]);
  }

  tick(dt: number): Phase {
    if (this.phase === 'idle') return this.phase;
    const dur = DURATION[this.phase as keyof typeof DURATION];
    this.t += dt;
    if (this.t > dur + 2) {
      this.phase = 'idle';
      this.t = 0;
      return this.phase;
    }
    if (this.t >= dur) {
      this.phase = nextPhase(this.phase);
      this.t = 0;
    }
    return this.phase;
  }

  reset() {
    this.phase = 'idle';
    this.t = 0;
  }
}
