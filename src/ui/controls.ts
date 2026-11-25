import * as THREE from 'three';

export type Controls = { dispose(): void };

const clamp = (n: number, min: number, max: number) =>
  Math.min(max, Math.max(min, n));

/**
 * Input arcade, due sole affordance reali:
 * - LEVETTA: la trascini (o trascini nella fascia del deck) e il claw si sposta
 * - BOTTONE: lo premi e il braccio scende, con corsa visibile anche quando la
 *   macchina è occupata (il feedback arriva prima della logica)
 * Hit test in spazio schermo, niente raycast: non dipende dal merge della
 * geometria né dalla forma esatta del modello.
 *
 * Le aree sono proporzionali al viewport e mai più larghe di metà della
 * distanza reale tra levetta e bottone: con la camera stretta (fov 13) e il
 * cabinet full-bleed su iPhone 390×844 i due bersagli non si rubano i tocchi.
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
  let dragId: number | null = null;
  let active = false;
  let startX = 0;
  let startY = 0;
  let dragR = 100;

  function local(e: PointerEvent) {
    const r = opts.canvas.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top, w: r.width, h: r.height };
  }

  const dist = (a: { x: number; y: number }, b: { x: number; y: number }) =>
    Math.hypot(a.x - b.x, a.y - b.y);

  /**
   * Radii tarati sul lato corto: ~66px su iPhone, ~122px su desktop 1440×900.
   * Il clamp sulla distanza dei due centri evita zone sovrapposte.
   */
  function hitZones(w: number, h: number) {
    const k = clamp(Math.min(w || 1, h || 1) / 720, 0.66, 1.22);
    const stick = opts.stickCenter();
    const button = opts.buttonCenter();
    const gap = dist(stick, button);
    const stickLimit = gap > 0 ? gap * 0.46 : Infinity;
    const buttonLimit = gap > 0 ? gap * 0.44 : Infinity;
    return {
      stick,
      button,
      stickR: Math.min(100 * k, stickLimit),
      buttonR: Math.min(84 * k, buttonLimit),
      deckLift: Math.max(44, 78 * k),
    };
  }

  function emit(x: number, y: number) {
    let dx = x - startX;
    let dy = y - startY;
    const len = Math.hypot(dx, dy);
    if (len > dragR) {
      dx = (dx / len) * dragR;
      dy = (dy / len) * dragR;
    }
    opts.onStick(dx / dragR, -dy / dragR);
  }

  function down(e: PointerEvent) {
    opts.onFirstGesture?.();
    const p = local(e);
    const zones = hitZones(p.w, p.h);

    if (dist(p, zones.button) < zones.buttonR) {
      // corsa del bottone sempre; la logica decide se il braccio scende
      opts.onPress();
      if (opts.canDrop()) opts.onDrop();
      return;
    }

    const nearStick = dist(p, zones.stick) < zones.stickR;
    // fascia del deck: dalla levetta fino al bordo inferiore del viewport
    const onDeck = p.y >= zones.stick.y - zones.deckLift && p.y <= p.h;
    if (!nearStick && !onDeck) return;

    active = true;
    dragId = e.pointerId;
    startX = p.x;
    startY = p.y;
    dragR = zones.stickR;
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
