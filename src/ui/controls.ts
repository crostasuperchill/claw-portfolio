import * as THREE from 'three';

export type Controls = { dispose(): void };

/**
 * Input arcade, due sole affordance reali:
 * - LEVETTA: la trascini (o trascini nella fascia del deck) e il claw si sposta
 * - BOTTONE: lo premi e il braccio scende, con corsa visibile anche quando la
 *   macchina è occupata (il feedback arriva prima della logica)
 * Hit test in spazio schermo, niente raycast: non dipende dal merge della
 * geometria né dalla forma esatta del modello.
 */
export function createControls(opts: {
  canvas: HTMLCanvasElement;
  camera: THREE.Camera;
  stickCenter: () => { x: number; y: number };
  buttonCenter: () => { x: number; y: number };
  canDrop: () => boolean;
  onStick: (x: number, y: number) => void;
  onPress: () => void;
  onDrop: () => void;
  onFirstGesture?: () => void;
  onDragStart?: () => void;
}) {
  const STICK_R = 105;
  const BUTTON_R = 90;
  let dragId: number | null = null;
  let active = false;
  let startX = 0;
  let startY = 0;

  function local(e: PointerEvent) {
    const r = opts.canvas.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top, w: r.width, h: r.height };
  }

  const dist = (a: { x: number; y: number }, b: { x: number; y: number }) =>
    Math.hypot(a.x - b.x, a.y - b.y);

  function emit(x: number, y: number) {
    let dx = x - startX;
    let dy = y - startY;
    const len = Math.hypot(dx, dy);
    if (len > STICK_R) {
      dx = (dx / len) * STICK_R;
      dy = (dy / len) * STICK_R;
    }
    opts.onStick(dx / STICK_R, -dy / STICK_R);
  }

  function down(e: PointerEvent) {
    opts.onFirstGesture?.();
    const p = local(e);

    if (dist(p, opts.buttonCenter()) < BUTTON_R) {
      // corsa del bottone sempre; la logica decide se il braccio scende
      opts.onPress();
      if (opts.canDrop()) opts.onDrop();
      return;
    }

    const stick = opts.stickCenter();
    const nearStick = dist(p, stick) < STICK_R * 1.5;
    // fascia del deck: una banda attorno alla riga dei comandi
    const onDeck = Math.abs(p.y - stick.y) < 150;
    if (!nearStick && !onDeck) return;

    active = true;
    dragId = e.pointerId;
    startX = p.x;
    startY = p.y;
    try {
      opts.canvas.setPointerCapture(e.pointerId);
    } catch {
      /* puntatori sintetici nei test */
    }
    opts.onDragStart?.();
    emit(p.x, p.y);
  }

  function move(e: PointerEvent) {
    if (!active || dragId !== e.pointerId) return;
    const p = local(e);
    emit(p.x, p.y);
  }

  function up(e: PointerEvent) {
    if (dragId !== e.pointerId) return;
    dragId = null;
    active = false;
    opts.onStick(0, 0);
  }

  const keys = new Set<string>();
  function key(e: KeyboardEvent) {
    if (e.key === ' ' || e.key === 'Enter') {
      opts.onPress();
      if (opts.canDrop()) opts.onDrop();
      e.preventDefault();
      return;
    }
    if (!e.key.startsWith('Arrow')) return;
    keys.add(e.key);
    e.preventDefault();
    opts.onStick(
      (keys.has('ArrowRight') ? 1 : 0) - (keys.has('ArrowLeft') ? 1 : 0),
      (keys.has('ArrowUp') ? 1 : 0) - (keys.has('ArrowDown') ? 1 : 0)
    );
  }

  function keyUp(e: KeyboardEvent) {
    if (!e.key.startsWith('Arrow')) return;
    keys.delete(e.key);
    opts.onStick(
      (keys.has('ArrowRight') ? 1 : 0) - (keys.has('ArrowLeft') ? 1 : 0),
      (keys.has('ArrowUp') ? 1 : 0) - (keys.has('ArrowDown') ? 1 : 0)
    );
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
