import { PROJECTS } from '../game/roster';

export function createHud() {
  const dots = document.getElementById('hud-dots') as HTMLElement;
  const count = document.getElementById('hud-count') as HTMLElement;

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

  const num = document.createElement('b');
  const total = document.createElement('span');
  total.className = 'hud-total';
  count.replaceChildren(num, total);
  count.setAttribute('role', 'status');
  count.setAttribute('aria-live', 'polite');

  let prev = -1;

  function set(collected: Set<string>) {
    const children = [...dots.children] as HTMLElement[];
    PROJECTS.forEach((p, i) => {
      children[i]?.classList.toggle('on', collected.has(p.id));
    });
    num.textContent = `${collected.size}`;
    total.textContent = `/${PROJECTS.length}`;
    dots.classList.toggle('full', collected.size === PROJECTS.length);
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
