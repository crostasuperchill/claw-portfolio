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

  function show(p: Project, isNew: boolean) {
    color.style.background = p.color;
    kicker.textContent = isNew ? 'new prize unlocked' : 'already in your collection';
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
    el.classList.add('open');
    el.setAttribute('aria-hidden', 'false');
    el.dataset.prize = p.id;
    open = true;
  }

  function hide() {
    el.classList.remove('open');
    el.setAttribute('aria-hidden', 'true');
    open = false;
    opts.onClose();
  }

  close.addEventListener('click', hide);
  next.addEventListener('click', hide);

  return {
    show,
    hide,
    get isOpen() {
      return open;
    },
  };
}
