export type Phase = 'idle' | 'drop' | 'close' | 'lift' | 'carry' | 'release' | 'return';

export const ORDER = ['drop', 'close', 'lift', 'carry', 'release', 'return'] as const;

/**
 * Durate delle fasi (secondi). Il ciclo completo resta sotto i 6 s:
 * 1.35 + 0.95 + 1.05 + 0.9 + 0.3 + 0.95 = 5.5 s.
 * La discesa e' la fase piu' lunga (il claw deve "pesare"); il ritorno e'
 * piu' rapido dell'andata (0.95 < 1.35).
 */
export const DURATION = {
  drop: 1.35,
  close: 0.95,
  lift: 1.05,
  carry: 0.9,
  release: 0.3,
  return: 0.95,
};

/** Pausa in fondo alla discesa prima che le chele inizino a chiudersi (s). */
export const CLOSE_PAUSE = 0.2;
/** Durata della chiusura vera e propria dopo la pausa (s). */
export const CLOSE_STROKE = 0.45;

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
   * Progresso della fase, gia' sagomato:
   * - drop/lift: piccolo "carico" iniziale (il motore stacca piano), poi rampa
   *   quasi lineare: l'easeInOut applicato dal chiamante fa il resto.
   * - close: 200 ms di pausa in fondo, chiusura in 350 ms, poi tenuta.
   * - carry/release/return: lineare.
   */
  get k(): number {
    if (this.phase === 'idle') return 0;
    const dur = DURATION[this.phase as keyof typeof DURATION];
    const u = clamp01(this.t / dur);
    switch (this.phase) {
      case 'drop': {
        const hold = 0.05;
        return clamp01((u - hold) / (1 - hold));
      }
      case 'lift': {
        const hold = 0.03;
        return clamp01((u - hold) / (1 - hold));
      }
      case 'close': {
        const pause = CLOSE_PAUSE / dur;
        const stroke = CLOSE_STROKE / dur;
        const r = clamp01((u - pause) / stroke);
        return r * r;
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
