import type { Controls } from '../systems/Controls';
import { sfx } from '../audio/sfx';

/**
 * Arrow-key menus. Anything with a data-nav attribute can be focused; the
 * arrows jump to the nearest one in that direction and Space/Enter clicks
 * it. The mouse works too.
 */
export class Nav {
  focused?: HTMLElement;
  onFocus?: (el: HTMLElement) => void;
  private root: HTMLElement;

  constructor(root: HTMLElement) {
    this.root = root;
    root.addEventListener('pointerover', (e) => {
      const el = (e.target as HTMLElement).closest<HTMLElement>('[data-nav]');
      if (el && el !== this.focused && root.contains(el)) this.focus(el, false);
    });
  }

  private items() {
    return [...this.root.querySelectorAll<HTMLElement>('[data-nav]')].filter((el) => el.offsetParent !== null);
  }

  focus(el: HTMLElement | null | undefined, sound = true) {
    if (!el) return;
    this.focused?.classList.remove('focused');
    this.focused = el;
    el.classList.add('focused');
    el.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    if (sound) sfx.select();
    this.onFocus?.(el);
  }

  /** Put focus back on something sensible after the menu was rebuilt. */
  refocus(selector?: string) {
    const items = this.items();
    const want = (selector && this.root.querySelector<HTMLElement>(selector)) || items.find((i) => i === this.focused) || items[0];
    this.focused = undefined;
    this.focus(want, false);
  }

  update(c: Controls) {
    const dirs: [string, number, number][] = [['left', -1, 0], ['right', 1, 0], ['up', 0, -1], ['down', 0, 1]];
    for (const [key, dx, dy] of dirs) if (c.just(key)) this.move(dx, dy);
    if (c.confirm() && this.focused) this.focused.click();
  }

  private move(dx: number, dy: number) {
    const items = this.items();
    if (!this.focused || !items.includes(this.focused)) return this.focus(items[0]);
    const a = this.focused.getBoundingClientRect();
    const ax = a.left + a.width / 2, ay = a.top + a.height / 2;
    let best: HTMLElement | undefined, bestScore = Infinity;
    for (const el of items) {
      if (el === this.focused) continue;
      const b = el.getBoundingClientRect();
      const bx = b.left + b.width / 2, by = b.top + b.height / 2;
      const along = (bx - ax) * dx + (by - ay) * dy;
      if (along <= 4) continue;
      const across = Math.abs((bx - ax) * dy) + Math.abs((by - ay) * dx);
      const score = along + across * 2.5;
      if (score < bestScore) { bestScore = score; best = el; }
    }
    if (best) this.focus(best);
  }
}

/** Build DOM from an HTML string. */
export function html<T extends HTMLElement = HTMLElement>(markup: string): T {
  const t = document.createElement('template');
  t.innerHTML = markup.trim();
  return t.content.firstElementChild as T;
}

export function shake(el: Element) {
  el.classList.remove('shake');
  void (el as HTMLElement).offsetWidth;
  el.classList.add('shake');
}

export function confetti(parent: HTMLElement, count = 60) {
  const colors = ['#f28c28', '#ffc93c', '#1fb5ad', '#7bcf3c', '#e8322a', '#8a55d8'];
  for (let i = 0; i < count; i++) {
    const c = document.createElement('div');
    c.className = 'confetti';
    c.style.left = `${Math.random() * 100}%`;
    c.style.background = colors[i % colors.length];
    c.style.animationDuration = `${1.6 + Math.random() * 1.6}s`;
    c.style.animationDelay = `${Math.random() * 0.5}s`;
    parent.appendChild(c);
    setTimeout(() => c.remove(), 4000);
  }
}
