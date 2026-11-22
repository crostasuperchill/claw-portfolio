export const GRAB_REACH = 0.1025;
export const GRAB_THRESHOLD = 0.35;

export function grabScore(dx: number, dz: number, reach = GRAB_REACH): number {
  const d = Math.hypot(dx, dz);
  return Math.max(0, Math.min(1, 1 - d / reach));
}

export function shouldGrab(dx: number, dz: number): boolean {
  return grabScore(dx, dz) >= GRAB_THRESHOLD;
}
