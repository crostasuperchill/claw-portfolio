export const GRAB_REACH = 0.1025;
export const GRAB_THRESHOLD = 0.35;

export function grabScore(dx: number, dz: number, reach = GRAB_REACH): number {
  const d = Math.hypot(dx, dz);
  return Math.max(0, Math.min(1, 1 - d / reach));
}

export function shouldGrab(dx: number, dz: number): boolean {
  return grabScore(dx, dz) >= GRAB_THRESHOLD;
}

/**
 * Presa morbida.
 *
 * Il claw è cinematico e una volta chiuso "porta" la capsula. Un joint fixed
 * trasmetterebbe ogni movimento di scatto (e, se la capsula è incastrata tra le
 * altre, la strapperebbe con un impulso enorme). Invece di teletrasportare o
 * incollare rigidamente, physics.ts usa questi parametri per un servo smorzato:
 *
 *  - la rigidità sale da 0 a regime in GRAB_SOFT_RAMP secondi (150 ms), così
 *    l'aggancio è graduale e non c'è il colpo iniziale;
 *  - la capsula insegue il punto di presa con un ritardo elastico
 *    GRAB_FOLLOW_TAU e un'accelerazione massima limitata: se è incastrata
 *    tira piano invece di scattare, e quando si libera recupera senza frustare.
 */
export const GRAB_SOFT_RAMP = 0.15; // s
export const GRAB_FOLLOW_TAU = 0.08; // s
export const GRAB_ACCEL_TAU = 0.04; // s
export const GRAB_MAX_ACCEL = 15; // m/s² (oltre alla compensazione di gravità)
export const GRAB_MAX_SPEED = 1.5; // m/s di velocità di recupero
