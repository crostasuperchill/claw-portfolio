export type Phase = 'idle' | 'drop' | 'close' | 'lift' | 'carry' | 'release' | 'return';

export const ORDER = ['drop', 'close', 'lift', 'carry', 'release', 'return'] as const;

/**
 * Durate delle fasi (secondi). Ciclo snello e scattante (~4.0 s, ben sotto i 6 s):
 * 0.98 + 0.62 + 0.82 + 0.70 + 0.24 + 0.64 = 4.00 s.
 */
export const DURATION = {
  drop: 0.98,
  close: 0.62,
  lift: 0.82,
  carry: 0.7,
  release: 0.24,
  return: 0.64,
};

/** Pausa in fondo alla discesa prima che le chele inizino a chiudersi (s). */
export const CLOSE_PAUSE = 0.11;
/** Durata della chiusura vera e propria dopo la pausa (s). */
export const CLOSE_STROKE = 0.34;

const clamp01 = (t: number) => (t < 0 ? 0 : t > 1 ? 1 : t);

/** smoothstep: parte e finisce con derivata zero. */
export const smoothstep = (t: number) => {
  const x = clamp01(t);
  return x * x * (3 - 2 * x);
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

  /**
   * Progresso della fase, gia' sagomato.
   * - drop: breve engage meccanico (4%), poi discesa decisa che atterra morbida.
   * - close: breve pausa di assestamento, poi chiusura rapida con snap cubico.
   * - lift: 2.5% di presa carico, poi risalita fluida con peso.
   * - carry/release/return: lineari.
   */
  get k(): number {
    if (this.phase === 'idle') return 0;
    const dur = DURATION[this.phase as keyof typeof DURATION];
    const u = clamp01(this.t / dur);
    switch (this.phase) {
      case 'drop': {
        const hold = 0.04;
        const r = clamp01((u - hold) / (1 - hold));
        return 1 - Math.pow(1 - r, 1.55);
      }
      case 'lift': {
        const hold = 0.025;
        const r = clamp01((u - hold) / (1 - hold));
        return smoothstep(r);
      }
      case 'close': {
        const pause = CLOSE_PAUSE / dur;
        const stroke = CLOSE_STROKE / dur;
        const r = clamp01((u - pause) / stroke);
        return 1 - Math.pow(1 - r, 3);
      }
      default:
        return u;
    }
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
