import * as THREE from 'three';

export type Controls = { dispose(): void };

/**
 * Input arcade: il puntatore non muove il claw, muove solo la LEVETTA.
 * - trascini la levetta (entro il suo raggio) e il claw si sposta in quella direzione
 * - tocchi il bottone giallo e il braccio scende
 * - tastiera resta come fallback desktop
 */
export function createControls(opts: {
  canvas: HTMLCanvasElement;
  camera: THREE.Camera;
  hitTarget: THREE.Object3D;
  /** centro della levetta in pixel CSS, ricalcolato ad ogni gesture */
  stickCenter: () => { x: number; y: number };
  canDrop: () => boolean;
  onStick: (x: number, y: number) => void;
  onDrop: () => void;
  onFirstGesture?: () => void;
  onDragStart?: () => void;
}) {
  const raycaster = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  const STICK_RADIUS = 78;
  let dragId: number | null = null;
  let startX = 0;
  let startY = 0;
  let stickActive = false;

  function toNdc(e: PointerEvent) {
    const r = opts.canvas.getBoundingClientRect();
    ndc.set(
      ((e.clientX - r.left) / r.width) * 2 - 1,
      -((e.clientY - r.top) / r.height) * 2 + 1
    );
  }

  function overButton(e: PointerEvent) {
    toNdc(e);
    raycaster.setFromCamera(ndc, opts.camera);
    return raycaster.intersectObject(opts.hitTarget, true).length > 0;
  }

  function nearStick(e: PointerEvent) {
    const c = opts.stickCenter();
    const r = opts.canvas.getBoundingClientRect();
    const dx = e.clientX - (r.left + c.x);
    const dy = e.clientY - (r.top + c.y);
    return Math.hypot(dx, dy) < STICK_RADIUS * 1.35;
  }

  function emit(clientX: number, clientY: number) {
    const r = opts.canvas.getBoundingClientRect();
    const c = opts.stickCenter();
    let dx = clientX - (r.left + c.x);
    let dy = clientY - (r.top + c.y);
    const len = Math.hypot(dx, dy);
    if (len > STICK_RADIUS) {
      dx = (dx / len) * STICK_RADIUS;
      dy = (dy / len) * STICK_RADIUS;
    }
    opts.onStick(dx / STICK_RADIUS, -dy / STICK_RADIUS);
  }

  function down(e: PointerEvent) {
    opts.onFirstGesture?.();
    if (opts.canDrop() && overButton(e)) {
      opts.onDrop();
      return;
    }
    if (!nearStick(e)) return;
    stickActive = true;
    dragId = e.pointerId;
    startX = e.clientX;
    startY = e.clientY;
    try {
      opts.canvas.setPointerCapture(e.pointerId);
    } catch {
      /* pointer sintetici */
    }
    opts.onDragStart?.();
    emit(e.clientX, e.clientY);
  }

  function move(e: PointerEvent) {
    if (!stickActive || dragId !== e.pointerId) return;
    emit(e.clientX, e.clientY);
  }

  function up(e: PointerEvent) {
    if (dragId !== e.pointerId) return;
    dragId = null;
    stickActive = false;
    opts.onStick(0, 0);
  }

  function key(e: KeyboardEvent) {
    const step = 0.035;
    if (e.key === 'ArrowLeft') opts.onStick(-step * 8, 0);
    else if (e.key === 'ArrowRight') opts.onStick(step * 8, 0);
    else if (e.key === 'ArrowUp') opts.onStick(0, step * 8);
    else if (e.key === 'ArrowDown') opts.onStick(0, -step * 8);
    else if (e.key === ' ') {
      if (opts.canDrop()) opts.onDrop();
      e.preventDefault();
    }
  }

  function keyUp(e: KeyboardEvent) {
    if (e.key.startsWith('Arrow')) opts.onStick(0, 0);
  }

  opts.canvas.addEventListener('pointerdown', down);
  opts.canvas.addEventListener('pointermove', move);
  opts.canvas.addEventListener('pointerup', up);
  opts.canvas.addEventListener('pointercancel', up);
  addEventListener('keydown', key);
  addEventListener('keyup', keyUp);

  return {
    dispose() {
      opts.canvas.removeEventListener('pointerdown', down);
      opts.canvas.removeEventListener('pointermove', move);
      opts.canvas.removeEventListener('pointerup', up);
      opts.canvas.removeEventListener('pointercancel', up);
      removeEventListener('keydown', key);
      removeEventListener('keyup', keyUp);
    },
  };
}
