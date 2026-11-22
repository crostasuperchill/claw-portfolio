import * as THREE from 'three';

export type Controls = { dispose(): void };

export function createControls(opts: {
  canvas: HTMLCanvasElement;
  camera: THREE.Camera;
  hitTarget: THREE.Object3D;
  canDrop: () => boolean;
  metersPerPixel: () => number;
  onAim: (dx: number, dz: number) => void;
  onDrop: () => void;
  onFirstGesture?: () => void;
  onDragStart?: () => void;
}) {
  const raycaster = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  let dragId: number | null = null;
  let lastX = 0;
  let lastY = 0;

  function overButton(e: PointerEvent) {
    const r = opts.canvas.getBoundingClientRect();
    ndc.set(
      ((e.clientX - r.left) / r.width) * 2 - 1,
      -((e.clientY - r.top) / r.height) * 2 + 1
    );
    raycaster.setFromCamera(ndc, opts.camera);
    return raycaster.intersectObject(opts.hitTarget, true).length > 0;
  }

  function down(e: PointerEvent) {
    opts.onFirstGesture?.();
    if (opts.canDrop() && overButton(e)) {
      opts.onDrop();
      return;
    }
    dragId = e.pointerId;
    lastX = e.clientX;
    lastY = e.clientY;
    try {
      opts.canvas.setPointerCapture(e.pointerId);
    } catch {
      /* pointer sintetici */
    }
    opts.onDragStart?.();
  }

  function move(e: PointerEvent) {
    if (dragId !== e.pointerId) return;
    const mpp = opts.metersPerPixel();
    const dx = e.clientX - lastX;
    const dy = e.clientY - lastY;
    lastX = e.clientX;
    lastY = e.clientY;
    opts.onAim(dx * mpp, dy * mpp * 0.75);
  }

  function up(e: PointerEvent) {
    if (dragId !== e.pointerId) return;
    dragId = null;
  }

  function key(e: KeyboardEvent) {
    const step = 0.035;
    if (e.key === 'ArrowLeft') opts.onAim(-step, 0);
    else if (e.key === 'ArrowRight') opts.onAim(step, 0);
    else if (e.key === 'ArrowUp') opts.onAim(0, -step);
    else if (e.key === 'ArrowDown') opts.onAim(0, step);
    else if (e.key === ' ') {
      if (opts.canDrop()) opts.onDrop();
      e.preventDefault();
    }
  }

  opts.canvas.addEventListener('pointerdown', down);
  opts.canvas.addEventListener('pointermove', move);
  opts.canvas.addEventListener('pointerup', up);
  opts.canvas.addEventListener('pointercancel', up);
  addEventListener('keydown', key);

  return {
    dispose() {
      opts.canvas.removeEventListener('pointerdown', down);
      opts.canvas.removeEventListener('pointermove', move);
      opts.canvas.removeEventListener('pointerup', up);
      opts.canvas.removeEventListener('pointercancel', up);
      removeEventListener('keydown', key);
    },
  };
}
