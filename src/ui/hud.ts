import { PROJECTS } from '../game/roster';

/**
 * L'HUD è ora nascosto via CSS: il cabinet è l'intera interfaccia.
 * Gli elementi restano nel DOM e questo modulo continua a funzionare
 * (senza crash se in futuro venissero rimossi del tutto).
 */
export function createHud() {
  const dots = document.getElementById('hud-dots');
  const count = document.getElementById('hud-count');

  if (dots) {
    dots.replaceChildren(
      ...PROJECTS.map((p) => {
        const i = document.createElement('i');
        i.style.setProperty('--c', p.color);
        i.setAttribute('aria-hidden', 'true');
        return i;
      })
    );
    dots.setAttribute('role', 'img');
    dots.setAttribute('aria-label', 'Prize collection');
  }

  const num = document.createElement('b');
  const total = document.createElement('span');
  total.className = 'hud-total';
  if (count) {
    count.replaceChildren(num, total);
    count.setAttribute('role', 'status');
    count.setAttribute('aria-live', 'polite');
  }

  let prev = -1;

  function set(collected: Set<string>) {
    if (dots) {
      const children = [...dots.children] as HTMLElement[];
      PROJECTS.forEach((p, i) => {
        children[i]?.classList.toggle('on', collected.has(p.id));
      });
      dots.classList.toggle('full', collected.size === PROJECTS.length);
    }

    num.textContent = `${collected.size}`;
    total.textContent = `/${PROJECTS.length}`;

    if (!count) return;
    count.setAttribute(
      'aria-label',
      `${collected.size} of ${PROJECTS.length} prizes collected`
    );

    if (prev >= 0 && collected.size !== prev) {
      count.classList.remove('bump');
      void count.offsetWidth;
      count.classList.add('bump');
    }
    prev = collected.size;
  }

  return { set };
}
