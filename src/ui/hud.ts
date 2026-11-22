import { PROJECTS } from '../game/roster';

export function createHud() {
  const dots = document.getElementById('hud-dots') as HTMLElement;
  const count = document.getElementById('hud-count') as HTMLElement;

  dots.replaceChildren(
    ...PROJECTS.map(() => {
      const i = document.createElement('i');
      return i;
    })
  );

  function set(collected: Set<string>) {
    const children = [...dots.children] as HTMLElement[];
    PROJECTS.forEach((p, i) => {
      children[i]?.classList.toggle('on', collected.has(p.id));
    });
    count.textContent = `${collected.size}/${PROJECTS.length}`;
  }

  return { set };
}
