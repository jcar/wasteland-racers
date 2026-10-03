import { gadgetById } from '../data/cars';
import { artHtml } from '../systems/assets';
import { html } from './nav';

/** The minimap picture and how to turn world positions into it. */
export interface MiniMap {
  svg: string;
  toSvg: (x: number, z: number) => [number, number];
}

export interface HudRacer {
  id: string;
  name: string;
  portrait: string;
  emoji: string;
  color: string;
  isPlayer: boolean;
}

const ORDINAL = ['1st', '2nd', '3rd', '4th', '5th', '6th'];
export const ordinal = (n: number) => ORDINAL[n - 1] ?? `${n}th`;

/** Everything drawn on top of the race: places, lap, minimap, gadget. */
export class Hud {
  readonly el: HTMLElement;
  private order: HTMLElement;
  private lap: HTMLElement;
  private gadget: HTMLElement;
  private bolts: HTMLElement;
  private banner: HTMLElement;
  private callout: HTMLElement;
  private tip: HTMLElement;
  private dots = new Map<string, SVGCircleElement>();
  private toSvg: (x: number, z: number) => [number, number];
  private hp: HTMLElement;
  private bar: HTMLElement;
  private svg: SVGSVGElement;
  private last = { order: '', lap: '', charges: -1, bolts: -1, hp: '', bar: '' };
  private bannerTimer = 0;
  private racers: HudRacer[] = [];

  constructor(map: MiniMap, racers: HudRacer[], gadget: string) {
    this.toSvg = map.toSvg;
    const g = gadgetById(gadget);
    this.el = html(`
      <div class="hud">
        <div class="order"></div>
        <div class="lap outlined"></div>
        <div class="bossbar"><span class="label"></span><div class="track"><i></i></div></div>
        <svg class="minimap" viewBox="0 0 190 190">${map.svg}</svg>
        <div class="hp"></div>
        <div class="gadget empty">${artHtml(g.icon, g.emoji)}<div class="count">0</div><div class="key">SPACE</div></div>
        <div class="bolts scrap outlined">${artHtml('icon-scrap', '🔩')}<span class="n">0</span></div>
        <div class="banner outlined"></div>
        <div class="callout"></div>
        <div class="tip"></div>
      </div>`);
    this.order = this.el.querySelector('.order')!;
    this.lap = this.el.querySelector('.lap')!;
    this.gadget = this.el.querySelector('.gadget')!;
    this.hp = this.el.querySelector('.hp')!;
    this.bolts = this.el.querySelector('.bolts .n')!;
    this.banner = this.el.querySelector('.banner')!;
    this.callout = this.el.querySelector('.callout')!;
    this.tip = this.el.querySelector('.tip')!;
    this.tip.style.display = 'none';
    this.bar = this.el.querySelector('.bossbar')!;
    this.bar.style.display = 'none';
    this.svg = this.el.querySelector('svg')!;
    // Player dot last so it's drawn on top.
    for (const r of [...racers].sort((a, b) => Number(a.isPlayer) - Number(b.isPlayer))) this.addRacer(r);
  }

  /** Add a car to the minimap (and the race order), e.g. raiders joining an escort. */
  addRacer(r: HudRacer) {
    if (this.dots.has(r.id)) return;
    this.racers.push(r);
    const c = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    c.setAttribute('r', r.isPlayer ? '8' : '6');
    c.setAttribute('fill', r.color);
    c.setAttribute('stroke', r.isPlayer ? '#fff' : '#222');
    c.setAttribute('stroke-width', r.isPlayer ? '3' : '2');
    // Keep the player's dot on top.
    const player = this.racers.find((x) => x.isPlayer && x.id !== r.id);
    const playerDot = player && this.dots.get(player.id);
    if (playerDot && !r.isPlayer) this.svg.insertBefore(c, playerDot);
    else this.svg.appendChild(c);
    this.dots.set(r.id, c);
  }

  removeRacer(id: string) {
    this.dots.get(id)?.remove();
    this.dots.delete(id);
    this.racers = this.racers.filter((r) => r.id !== id);
  }

  /** Hide the race-order list (modes without places). */
  showOrder(on: boolean) {
    this.order.style.display = on ? '' : 'none';
  }

  /** Top-right status text, for modes that don't count laps. */
  setStatus(text: string) {
    if (text !== this.last.lap) this.lap.innerHTML = this.last.lap = text;
  }

  /** A big bar across the top: a boss's health or the War Rig's armor. Pass undefined to hide. */
  setBar(label: string | undefined, frac = 0, color = '#e8322a') {
    const key = `${label}|${frac.toFixed(3)}|${color}`;
    if (key === this.last.bar) return;
    this.last.bar = key;
    this.bar.style.display = label ? '' : 'none';
    if (!label) return;
    this.bar.querySelector('.label')!.textContent = label;
    const fill = this.bar.querySelector('i')!;
    fill.style.width = `${Math.max(0, Math.min(1, frac)) * 100}%`;
    fill.style.background = color;
  }

  setOrder(ids: string[]) {
    const key = ids.join();
    if (key === this.last.order) return;
    this.last.order = key;
    this.order.innerHTML = '';
    ids.forEach((id, i) => {
      const r = this.racers.find((x) => x.id === id);
      if (!r) return;
      this.order.appendChild(
        html(`<div class="racer ${r.isPlayer ? 'me' : ''}"><span>${i + 1}</span><div class="face" style="border:3px solid ${r.color}">${artHtml(r.portrait, r.emoji)}</div></div>`),
      );
    });
  }

  setLap(lap: number, laps: number) {
    const text = `Lap ${Math.max(1, Math.min(laps, lap + 1))}/${laps}`;
    if (text !== this.last.lap) this.lap.textContent = this.last.lap = text;
  }

  setDot(id: string, x: number, z: number) {
    const [sx, sy] = this.toSvg(x, z);
    const c = this.dots.get(id);
    c?.setAttribute('cx', sx.toFixed(1));
    c?.setAttribute('cy', sy.toFixed(1));
  }

  setGadget(charges: number) {
    if (charges === this.last.charges) return;
    this.last.charges = charges;
    this.gadget.querySelector('.count')!.textContent = String(charges);
    this.gadget.classList.toggle('ready', charges > 0);
    this.gadget.classList.toggle('empty', charges === 0);
  }

  /** Hits left before a wreck. Silver while the respawn shield or star power is on. */
  setHp(hp: number, max: number, safe: boolean) {
    const key = `${hp}/${max}/${safe}`;
    if (key === this.last.hp) return;
    this.last.hp = key;
    this.hp.classList.toggle('shield', safe);
    this.hp.innerHTML = Array.from({ length: max }, (_, i) => `<i class="${i < hp ? 'on' : ''}"></i>`).join('');
  }

  setBolts(n: number) {
    if (n === this.last.bolts) return;
    this.last.bolts = n;
    this.bolts.textContent = String(n);
  }

  /** Big words in the middle of the screen. seconds = 0 keeps them up. */
  show(text: string, seconds = 1.2, small = false) {
    this.banner.textContent = text;
    this.banner.classList.toggle('small', small);
    this.banner.classList.remove('pop');
    void this.banner.offsetWidth;
    this.banner.classList.add('pop');
    this.banner.style.display = '';
    this.bannerTimer = seconds;
  }

  say(portrait: string, emoji: string, text: string) {
    this.callout.innerHTML = `<div class="face">${artHtml(portrait, emoji)}</div><div class="bubble">${text}</div>`;
    this.callout.style.display = '';
  }
  hideCallout() {
    this.callout.style.display = 'none';
  }

  setTip(text: string) {
    this.tip.innerHTML = text;
    this.tip.style.display = text ? '' : 'none';
  }

  update(dt: number) {
    if (this.bannerTimer > 0) {
      this.bannerTimer -= dt;
      if (this.bannerTimer <= 0) this.banner.style.display = 'none';
    }
  }
}
