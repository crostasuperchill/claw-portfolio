import type { Project } from '../game/roster';

export function createPrizeCard(opts: { onClose: () => void }) {
  const el = document.getElementById('card') as HTMLElement;
  const color = document.getElementById('card-color') as HTMLElement;
  const kicker = document.getElementById('card-kicker') as HTMLElement;
  const title = document.getElementById('card-title') as HTMLElement;
  const line = document.getElementById('card-line') as HTMLElement;
  const blurb = document.getElementById('card-blurb') as HTMLElement;
  const tags = document.getElementById('card-tags') as HTMLElement;
  const cta = document.getElementById('card-cta') as HTMLAnchorElement;
  const close = document.getElementById('card-close') as HTMLButtonElement;
  const next = document.getElementById('card-next') as HTMLButtonElement;

  let open = false;
  let enterTimer = 0;
  let closeTimer = 0;

  const calm = () =>
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function show(p: Project, isNew: boolean) {
    window.clearTimeout(closeTimer);
    window.clearTimeout(enterTimer);

    color.style.backgroundColor = p.color;
    el.style.setProperty('--accent', p.color);
    el.dataset.fresh = isNew ? '1' : '0';

    kicker.textContent = isNew ? 'New prize unlocked' : 'Already in your collection';
    title.textContent = p.title;
    line.textContent = p.line;
    blurb.textContent = p.blurb;
    tags.replaceChildren(
      ...p.tags.map((t) => {
        const s = document.createElement('span');
        s.textContent = t;
        return s;
      })
    );
    cta.href = p.url;
    cta.textContent = p.cta;
    cta.setAttribute('aria-label', `${p.cta} — opens in a new tab`);

    el.dataset.prize = p.id;
    el.style.removeProperty('--drag');
    el.style.removeProperty('--drag-o');
    el.style.transform = '';
    el.style.opacity = '';
    el.classList.remove('closing', 'dragging', 'settling', 'open', 'entering');

    // restart the spring + stagger even if the card was already on screen
    void el.offsetWidth;

    el.classList.add('open');
    if (!calm()) {
      el.classList.add('entering');
      enterTimer = window.setTimeout(() => el.classList.remove('entering'), 900);
    }

    el.setAttribute('aria-hidden', 'false');
    document.documentElement.classList.add('card-open');
    open = true;
  }

  function hide() {
    if (!open) return;
    open = false;

    window.clearTimeout(enterTimer);
    el.classList.remove('open', 'entering', 'dragging', 'settling');
    el.style.removeProperty('--drag');
    el.style.removeProperty('--drag-o');
    el.style.transform = '';
    el.style.opacity = '';
    el.classList.add('closing');
    el.setAttribute('aria-hidden', 'true');
    document.documentElement.classList.remove('card-open');

    const active = document.activeElement as HTMLElement | null;
    if (active && el.contains(active)) active.blur();

    closeTimer = window.setTimeout(() => el.classList.remove('closing'), 420);
    opts.onClose();
  }

  /* swipe down to dismiss ------------------------------------------- */

  let dragging = false;
  let startY = 0;
  let dragY = 0;
  let lastY = 0;
  let lastT = 0;
  let velocity = 0;

  el.addEventListener('pointerdown', (e) => {
    if (!open || calm()) return;
    if ((e.target as HTMLElement).closest('a, button')) return;
    dragging = true;
    startY = e.clientY;
    dragY = 0;
    lastY = e.clientY;
    lastT = performance.now();
    velocity = 0;
    el.classList.remove('entering', 'settling');
    el.classList.add('dragging');
    try {
      el.setPointerCapture(e.pointerId);
    } catch {
      /* pointers without capture still drag */
    }
  });

  el.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    dragY = Math.max(0, e.clientY - startY);
    const now = performance.now();
    const dt = Math.max(1, now - lastT);
    velocity = (e.clientY - lastY) / dt;
    lastY = e.clientY;
    lastT = now;
    el.style.setProperty('--drag', `${dragY.toFixed(1)}px`);
    el.style.setProperty('--drag-o', `${Math.max(0.35, 1 - dragY / 640).toFixed(3)}`);
  });

  function endDrag() {
    if (!dragging) return;
    dragging = false;
    el.classList.remove('dragging');

    const fling = velocity > 0.85;
    if (dragY > 120 || (fling && dragY > 28)) {
      el.style.removeProperty('--drag');
      el.style.removeProperty('--drag-o');
      el.style.transform = '';
      el.style.opacity = '';
      hide();
      return;
    }

    if (dragY > 0) {
      el.classList.add('settling');
      el.style.transform = 'translate3d(0, 0, 0)';
      el.style.opacity = '1';
      window.setTimeout(() => {
        el.classList.remove('settling');
        el.style.transform = '';
        el.style.opacity = '';
        el.style.removeProperty('--drag');
        el.style.removeProperty('--drag-o');
      }, 520);
    } else {
      el.style.removeProperty('--drag');
      el.style.removeProperty('--drag-o');
    }
  }

  el.addEventListener('pointerup', endDrag);
  el.addEventListener('pointercancel', endDrag);

  /* dismissal ------------------------------------------------------- */

  close.addEventListener('click', hide);
  next.addEventListener('click', hide);

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && open) hide();
  });

  return {
    show,
    hide,
    get isOpen() {
      return open;
    },
  };
}
