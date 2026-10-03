import * as THREE from 'three';
import { game, type Scene } from '../Game';
import { CARS, DECALS, GADGETS, MAX_LEVEL, ORNAMENTS, PAINTS, SCRAP_LEVELS, UPGRADE_STATS, carById, type Gadget, type UpgradeStat } from '../data/cars';
import { DRIVERS, driverById } from '../data/characters';
import { buildCar, type CarLook } from '../art/carBuilder';
import { toon } from '../art/materials';
import { playMusic } from '../audio/music';
import { sfx } from '../audio/sfx';
import { speak } from '../audio/voice';
import { artHtml, assetUrl } from '../systems/assets';
import { buyCar, buyGadget, buyOrnament, buyPaint, buyUpgrade, carPrice, raceGadget, upgradeCost, type Price } from '../systems/Economy';
import { state } from '../systems/GameState';
import { Nav, confetti, html, shake } from '../ui/nav';
import { TitleScene } from './TitleScene';
import { TrackSelectScene } from './TrackSelectScene';
import { ValhallaScene } from './ValhallaScene';

type Tab = 'upgrades' | 'cars' | 'paint' | 'gadgets' | 'driver';
const TABS: { id: Tab; label: string; icon: string; emoji: string }[] = [
  { id: 'upgrades', label: 'Fix Up', icon: 'icon-engine', emoji: '🔧' },
  { id: 'cars', label: 'Cars', icon: '', emoji: '🚙' },
  { id: 'paint', label: 'Paint', icon: '', emoji: '🎨' },
  { id: 'gadgets', label: 'Weapons', icon: 'icon-thunder', emoji: '⚡' },
  { id: 'driver', label: 'Driver', icon: '', emoji: '🙂' },
];

const price = (p: Price) =>
  `<span class="price">${p.currency === 'chrome' ? artHtml('icon-chrome', '💎', 'coin') : artHtml('icon-scrap', '🔩', 'coin')} ${p.amount}</span>`;

/** The hub: spend scrap on upgrades, cars, paint and gadgets, then RACE! */
export class GarageScene implements Scene {
  view: { scene: THREE.Scene; camera: THREE.PerspectiveCamera };
  private tab: Tab = 'upgrades';
  private nav!: Nav;
  private el!: HTMLElement;
  private turntable = new THREE.Group();
  private car?: THREE.Group;
  private popT = 1;
  private preview?: Partial<CarLook> & { car?: string };

  constructor() {
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 100);
    this.view = { scene, camera };
  }

  enter() {
    const { scene } = this.view;
    scene.add(new THREE.HemisphereLight('#fff4e0', '#6b4a36', 2));
    const sun = new THREE.DirectionalLight('#ffffff', 2.5);
    sun.position.set(4, 8, 5);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    scene.add(sun);
    const plate = new THREE.Mesh(new THREE.CylinderGeometry(3.6, 3.8, 0.35, 40), toon('#5d6068'));
    plate.position.y = -0.18;
    plate.receiveShadow = true;
    const ring = new THREE.Mesh(new THREE.TorusGeometry(3.7, 0.12, 8, 48), toon('#f28c28'));
    ring.rotation.x = Math.PI / 2;
    this.turntable.add(plate, ring);
    scene.add(this.turntable);
    this.rebuildCar(false);

    const bg = assetUrl('garage-bg');
    if (bg) game.root.style.backgroundImage = `url(${bg})`;
    this.el = html(`<div class="screen garage">
      <div class="left">
        <div><div class="wallet"><span class="scrap outlined"></span><span class="scrap chrome-count outlined"></span></div><div class="carname outlined"></div></div>
        <div class="left-actions">
          <button class="btn teal book-btn" data-nav data-id="book">📖 Valhalla Book</button>
          <button class="btn green race-btn" data-nav data-id="race">🏁 RACE!</button>
        </div>
      </div>
      <div class="right">
        <div class="tabs"></div>
        <div class="panel shop"></div>
      </div>
      <div class="hint passthrough"><span class="keycap">←↑↓→</span> choose · <span class="keycap">SPACE</span> pick · <span class="keycap">ESC</span> title screen</div>
    </div>`);
    game.ui.appendChild(this.el);
    this.nav = new Nav(this.el);
    this.nav.onFocus = (el) => this.onFocus(el);
    this.el.querySelector<HTMLElement>('[data-id="race"]')!.onclick = () => {
      sfx.confirm();
      game.go(new TrackSelectScene());
    };
    this.el.querySelector<HTMLElement>('[data-id="book"]')!.onclick = () => {
      sfx.confirm();
      game.go(new ValhallaScene());
    };
    this.render();
    this.nav.refocus('[data-id="race"]');
    playMusic('music-garage');
    speak('garage-hello', { priority: 1, cooldown: 300 });
  }

  // ------------------------------------------------------------------ car preview

  private look(): CarLook {
    const s = state.data;
    const p = this.preview ?? {};
    const car = carById(p.car ?? s.car);
    // Previewing a legend you don't own yet shows it in its own colors.
    const paintId = p.car && p.car !== s.car && car.paint && !s.ownedCars.includes(car.id) ? car.paint : s.paint;
    return {
      body: car.body,
      paint: p.paint ?? PAINTS.find((x) => x.id === paintId)?.color ?? PAINTS[0].color,
      decal: 'decal' in p ? p.decal : DECALS.find((d) => d.id === s.decal)?.image || undefined,
      upgrades: s.upgrades,
      head: p.head ?? driverById(s.driver).head,
      ornament: 'ornament' in p ? p.ornament : s.ornament,
    };
  }

  private rebuildCar(pop = true) {
    if (this.car) this.turntable.remove(this.car);
    const model = buildCar(this.look());
    // Fit big rigs (Gigahorse, Big Foot) on the turntable.
    const size = new THREE.Box3().setFromObject(model.root).getSize(new THREE.Vector3());
    const fit = Math.min(1, 5.2 / Math.max(size.x, size.z), 3.6 / size.y);
    model.root.userData.fit = fit;
    this.car = model.root;
    this.car.scale.setScalar(fit);
    this.turntable.add(this.car);
    this.popT = pop ? 0 : 1;
  }

  private setPreview(p: GarageScene['preview']) {
    const key = JSON.stringify(p ?? null);
    if (key === JSON.stringify(this.preview ?? null)) return;
    this.preview = p;
    this.rebuildCar(false);
  }

  private onFocus(el: HTMLElement) {
    const id = el.dataset.id ?? '';
    const [kind, value] = id.split(':');
    if (kind === 'car') this.setPreview({ car: value });
    else if (kind === 'paint') this.setPreview({ paint: PAINTS.find((p) => p.id === value)!.color });
    else if (kind === 'decal') this.setPreview({ decal: DECALS.find((d) => d.id === value)!.image || undefined });
    else if (kind === 'driver') this.setPreview({ head: driverById(value).head });
    else if (kind === 'orn') this.setPreview({ ornament: value });
    else this.setPreview(undefined);
  }

  // ------------------------------------------------------------------ menus

  private render() {
    const s = state.data;
    this.el.querySelector('.scrap')!.innerHTML = `${artHtml('icon-scrap', '🔩')} ${s.scrap}`;
    this.el.querySelector('.chrome-count')!.innerHTML = `${artHtml('icon-chrome', '💎')} ${s.chrome}`;
    this.el.querySelector('.carname')!.textContent = carById(s.car).name;

    const tabs = this.el.querySelector('.tabs')!;
    tabs.innerHTML = '';
    for (const t of TABS) {
      const b = html(`<button class="btn ${t.id === this.tab ? 'active' : ''}" data-nav data-id="tab:${t.id}">${artHtml(t.icon, t.emoji)}${t.label}</button>`);
      b.onclick = () => {
        this.tab = t.id;
        sfx.select();
        this.render();
        this.nav.refocus(`[data-id="tab:${t.id}"]`);
      };
      tabs.appendChild(b);
    }

    const shop = this.el.querySelector('.shop')!;
    shop.innerHTML = '';
    const add = (markup: string, onClick: (el: HTMLElement) => void, parent: Element = shop) => {
      const el = html(markup);
      el.onclick = () => onClick(el);
      parent.appendChild(el);
      return el;
    };

    if (this.tab === 'upgrades') {
      for (const st of UPGRADE_STATS) {
        const lvl = s.upgrades[st.id];
        const cost = upgradeCost(lvl);
        const pips = Array.from({ length: MAX_LEVEL }, (_, i) => `<i class="${i < lvl ? 'on' : ''} ${i >= SCRAP_LEVELS ? 'chrome' : ''}"></i>`).join('');
        const row = html(`<div class="row"><div class="icon">${artHtml(st.icon, st.emoji)}</div><div class="name">${st.name}<div class="pips">${pips}</div></div></div>`);
        add(
          `<button class="btn ${cost === undefined ? 'gray' : cost.amount > s[cost.currency] ? 'cant' : cost.currency === 'chrome' ? 'chrome' : 'green'}" data-nav data-id="up:${st.id}">${cost === undefined ? 'FULL!' : price(cost)}</button>`,
          (el) => this.buyUpgrade(st.id, el),
          row,
        );
        shop.appendChild(row);
      }
    } else if (this.tab === 'cars') {
      for (const [title, list] of [['Garage', CARS.filter((c) => !c.lore)], ['Wasteland Legends', CARS.filter((c) => c.lore)]] as const) {
        shop.appendChild(html(`<h3>${title}</h3>`));
        const grid = html(`<div class="grid"></div>`);
        shop.appendChild(grid);
        for (const c of list) {
          const owned = s.ownedCars.includes(c.id);
          const cost = carPrice(c.id);
          const label = s.car === c.id ? 'DRIVING' : owned ? 'DRIVE' : price(cost);
          add(
            `<button class="btn card ${owned ? 'teal' : cost.amount > s[cost.currency] ? 'cant' : c.lore ? 'chrome' : ''}" data-nav data-id="car:${c.id}">${artHtml(c.card ?? '', c.emoji, 'wide')}${c.name}<span class="price">${label}</span></button>`,
            (el) => this.buyCar(c.id, el),
            grid,
          );
        }
      }
    } else if (this.tab === 'paint') {
      const grid = html(`<div class="grid" style="grid-template-columns:repeat(auto-fill,minmax(70px,1fr))"></div>`);
      shop.appendChild(grid);
      for (const p of PAINTS) {
        const locked = p.unlock && !s.rewards.includes(p.unlock);
        const forSale = p.chrome && !s.ownedPaints.includes(p.id);
        add(
          `<button class="btn card ${s.paint === p.id ? 'teal' : ''}" style="min-height:0" data-nav data-id="paint:${p.id}"><div class="swatch" style="background:${locked ? '#777' : p.color}"></div>${locked ? '🔒' : forSale ? price({ amount: p.chrome!, currency: 'chrome' }) : ''}</button>`,
          (el) => {
            const r = buyPaint(s, p.id);
            if (r === 'locked') return this.nope(el, 'decal-locked');
            if (r === 'broke') return this.nope(el, 'not-enough-chrome');
            if (r === 'ok') { sfx.buy(); speak('shiny', { priority: 2 }); confetti(game.ui, 40); }
            this.saved(r === 'ok' ? undefined : 'paint', `paint:${p.id}`);
          },
          grid,
        );
      }
      shop.appendChild(html(`<h3 style="margin-top:8px">Stickers</h3>`));
      const decals = html(`<div class="grid" style="grid-template-columns:repeat(auto-fill,minmax(90px,1fr))"></div>`);
      shop.appendChild(decals);
      for (const d of DECALS) {
        const locked = d.unlock && !s.rewards.includes(d.unlock);
        add(
          `<button class="btn card ${s.decal === d.id ? 'teal' : locked ? 'locked' : ''}" style="min-height:0" data-nav data-id="decal:${d.id}">${locked ? '<span class="emoji">🔒</span>' : d.image ? artHtml(d.image, d.emoji) : '<span class="emoji">⬜</span>'}</button>`,
          (el) => {
            if (locked) return this.nope(el, 'decal-locked');
            s.decal = d.id;
            this.saved('paint', `decal:${d.id}`);
          },
          decals,
        );
      }
      shop.appendChild(html(`<h3 style="margin-top:8px">Hood Ornaments</h3>`));
      const orns = html(`<div class="grid" style="grid-template-columns:repeat(auto-fill,minmax(90px,1fr))"></div>`);
      shop.appendChild(orns);
      for (const o of ORNAMENTS) {
        const owned = s.ownedOrnaments.includes(o.id);
        add(
          `<button class="btn card ${s.ornament === o.id ? 'teal' : owned ? '' : o.chrome > s.chrome ? 'cant' : 'chrome'}" style="min-height:0" data-nav data-id="orn:${o.id}"><span class="emoji">${o.emoji}</span>${owned ? '' : price({ amount: o.chrome, currency: 'chrome' })}</button>`,
          (el) => {
            const r = buyOrnament(s, o.id);
            if (r === 'broke') return this.nope(el, 'not-enough-chrome');
            if (r === 'ok') { sfx.buy(); speak('ornament', { priority: 2 }); confetti(game.ui, 30); } else sfx.confirm();
            this.saved(undefined, `orn:${o.id}`);
          },
          orns,
        );
      }
    } else if (this.tab === 'gadgets') {
      const car = carById(s.car);
      const sections: [string, Gadget[]][] = [
        ['Special Move', GADGETS.filter((g) => g.car === car.id)],
        ['Gadgets', GADGETS.filter((g) => !g.car && !g.lore)],
        ['War Boy Weapons', GADGETS.filter((g) => !g.car && g.lore)],
        ['Legends’ Specials', GADGETS.filter((g) => g.car && g.car !== car.id)],
      ];
      const using = raceGadget(s);
      for (const [title, list] of sections) {
        if (!list.length) continue;
        shop.appendChild(html(`<h3>${title}</h3>`));
        const grid = html(`<div class="grid"></div>`);
        shop.appendChild(grid);
        for (const g of list) {
          const otherCar = g.car && g.car !== car.id ? carById(g.car) : undefined;
          const owned = s.ownedGadgets.includes(g.id) || g.car === car.id;
          const label = otherCar ? `Drive the ${otherCar.name}` : using === g.id ? 'USING' : owned ? 'USE' : price({ amount: g.price, currency: 'scrap' });
          add(
            `<button class="btn card ${otherCar ? 'locked' : owned ? 'teal' : g.price > s.scrap ? 'cant' : ''}" data-nav data-id="gadget:${g.id}">${artHtml(g.icon, g.emoji)}${g.name}<span class="price">${label}</span></button>`,
            (el) => {
              if (otherCar) return this.nope(el, 'card-locked');
              if (g.car === car.id) { s.gadget = g.id; sfx.confirm(); return this.saved(undefined, `gadget:${g.id}`); }
              const r = buyGadget(s, g.id);
              if (r === 'broke') return this.nope(el, 'not-enough');
              if (r === 'ok') {
                sfx.buy();
                speak('new-gadget', { priority: 2 });
                confetti(game.ui, 30);
              } else sfx.confirm();
              this.saved(undefined, `gadget:${g.id}`);
            },
            grid,
          );
        }
      }
    } else if (this.tab === 'driver') {
      const grid = html(`<div class="grid"></div>`);
      shop.appendChild(grid);
      for (const d of DRIVERS) {
        add(
          `<button class="btn card ${s.driver === d.id ? 'teal' : ''}" data-nav data-id="driver:${d.id}">${artHtml(d.portrait, d.emoji)}${d.name}</button>`,
          () => {
            s.driver = d.id;
            sfx.confirm();
            this.saved(undefined, `driver:${d.id}`);
          },
          grid,
        );
      }
    }
  }

  /** Save, redraw the menu and the car, keeping focus where it was. */
  private saved(voice: string | undefined, focus: string) {
    state.persist();
    if (voice) {
      sfx.confirm();
      speak(voice, { priority: 1, cooldown: 8 });
    }
    this.preview = undefined;
    this.render();
    this.rebuildCar();
    this.nav.refocus(`[data-id="${focus}"]`);
  }

  private nope(el: HTMLElement, voice: string) {
    sfx.nope();
    shake(el);
    speak(voice, { priority: 1, cooldown: 4 });
  }

  private buyUpgrade(stat: UpgradeStat, el: HTMLElement) {
    const chrome = upgradeCost(state.data.upgrades[stat])?.currency === 'chrome';
    const r = buyUpgrade(state.data, stat);
    if (r === 'broke') return this.nope(el, chrome ? 'not-enough-chrome' : 'not-enough');
    if (r === 'maxed') return speak('maxed', { priority: 1, cooldown: 4 });
    sfx.buy();
    sfx.wrench();
    speak(chrome ? 'chrome-upgrade' : UPGRADE_STATS.find((s) => s.id === stat)!.voice, { priority: 2 });
    confetti(game.ui, 30);
    this.saved(undefined, `up:${stat}`);
  }

  private buyCar(id: string, el: HTMLElement) {
    const lore = carById(id).lore;
    const r = buyCar(state.data, id);
    if (r === 'broke') return this.nope(el, lore ? 'not-enough-chrome' : 'not-enough');
    if (r === 'ok') {
      sfx.buy();
      speak(lore ? 'new-lore-car' : 'new-car', { priority: 2 });
      confetti(game.ui, 80);
    } else sfx.confirm();
    this.saved(undefined, `car:${id}`);
  }

  // ------------------------------------------------------------------ loop

  update(dt: number) {
    const cam = this.view.camera;
    const w = game.width, h = game.height;
    cam.aspect = w / h;
    // Push the car into the left half of the screen, next to the shop.
    cam.setViewOffset(w, h, w * 0.23, -h * 0.02, w, h);
    cam.position.set(9, 6, 11);
    cam.lookAt(0, 0.9, 0);
    cam.updateProjectionMatrix();

    this.turntable.rotation.y += dt * 0.5;
    if (this.car && this.popT < 1) {
      this.popT = Math.min(1, this.popT + dt * 2.5);
      const t = this.popT;
      const s = 1 + Math.sin(t * Math.PI) * 0.25 * (1 - t);
      this.car.scale.setScalar(s * (this.car.userData.fit ?? 1));
      this.car.position.y = Math.sin(t * Math.PI) * 0.8;
    }
    if (game.controls.back()) return game.go(new TitleScene());
    this.nav.update(game.controls);
  }

  exit() {
    this.view.camera.clearViewOffset();
  }
}
