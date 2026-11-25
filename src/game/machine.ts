export type Phase = 'idle' | 'drop' | 'close' | 'lift' | 'carry' | 'release' | 'return';

export const ORDER = ['drop', 'close', 'lift', 'carry', 'release', 'return'] as const;

/**
 * Durate delle fasi (secondi). Il ciclo completo resta sotto i 6 s:
 * 1.35 + 0.9 + 1.05 + 0.9 + 0.3 + 0.9 = 5.4 s.
 * La discesa e' la fase piu' lunga (il claw deve "pesare"); il ritorno e'
 * piu' rapido dell'andata.
 */
export const DURATION = {
  drop: 1.35,
  close: 0.9,
  lift: 1.05,
  carry: 0.9,
  release: 0.3,
  return: 0.9,
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
   * Progresso della fase, gia' sagomato.
   * - drop: 55 ms di "engage" meccanico, poi una rampa che decelera gia' in
   *   fondo (il chiamante applica easeInOut per l'atterraggio morbido).
   * - close: 200 ms di pausa, poi chiusura rapida con snap (ease-out cubica).
   * - lift: 30 ms di carico, poi rampa smoothstep: il peso e' reso dalla
   *   molla verticale del claw (hOff), non da un overshoot artificiale.
   * - carry/release/return: lineari.
   */
  get k(): number {
    if (this.phase === 'idle') return 0;
    const dur = DURATION[this.phase as keyof typeof DURATION];
    const u = clamp01(this.t / dur);
    switch (this.phase) {
      case 'drop': {
        const hold = 0.055;
        const r = clamp01((u - hold) / (1 - hold));
        return 1 - Math.pow(1 - r, 1.6);
      }
      case 'lift': {
        const hold = 0.03;
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
