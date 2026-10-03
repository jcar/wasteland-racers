import { game, type Scene } from '../Game';
import { DECALS } from '../data/cars';
import { rivalById } from '../data/characters';
import { TRACK_ORDER, trackById, trackIndex } from '../data/tracks';
import { worldById } from '../data/worlds';
import { playMusic, stopMusic } from '../audio/music';
import { sfx } from '../audio/sfx';
import { speak, stopVoice } from '../audio/voice';
import { artHtml, assetUrl } from '../systems/assets';
import { isTrackUnlocked, recordResult, type RaceOutcome } from '../systems/Economy';
import { state } from '../systems/GameState';
import { ordinal, type HudRacer } from '../ui/hud';
import { Nav, confetti, html } from '../ui/nav';
import { GarageScene } from './GarageScene';
import { RaceScene } from './RaceScene';
import { season2Open } from '../systems/Story';
import { wastelandHub } from './WastelandScene';

export interface RaceResult {
  trackId: string;
  order: HudRacer[];
  place: number;
  bolts: number;
  /** Cars the player wrecked. */
  wrecks?: number;
}

const HEADLINE = ['YOU WIN!', '2nd PLACE!', '3rd PLACE!', 'FINISHED!', 'FINISHED!'];
const VOICE = ['win', 'place2', 'place3', 'place4', 'place4'];

/** After the race: who won, how much scrap you earned, and what's new. */
export class PodiumScene implements Scene {
  private result: RaceResult;
  private outcome!: RaceOutcome;
  private nav!: Nav;
  private t = 0;
  private steps: { at: number; run: () => void }[] = [];
  private el!: HTMLElement;

  constructor(result: RaceResult) {
    this.result = result;
  }

  enter() {
    const r = this.result;
    this.outcome = recordResult(state.data, r.trackId, r.place, r.bolts);
    state.data.pendingCelebrations = [];
    state.persist();

    const bg = assetUrl('podium-bg');
    this.el = html(`<div class="screen shade" style="${bg ? `background-image:url(${bg})` : 'background:#3b2a20'}">
      <h1 class="outlined pop" style="font-size:clamp(40px,11vh,100px);margin-top:2vh">${HEADLINE[r.place - 1]}</h1>
      <div class="results"></div>
      <div class="payout"></div>
      <div class="celebrate"></div>
      <div class="actions"></div>
    </div>`);
    game.ui.appendChild(this.el);
    this.nav = new Nav(this.el);

    const results = this.el.querySelector('.results')!;
    r.order.forEach((racer, i) => {
      const row = html(`<div class="result panel ${racer.isPlayer ? 'me' : ''}" style="padding:6px 14px;opacity:0">
        <span class="place">${['🥇', '🥈', '🥉'][i] ?? ordinal(i + 1)}</span>
        <div class="face" style="border:4px solid ${racer.color}">${artHtml(racer.portrait, racer.emoji)}</div>
        <span>${racer.isPlayer ? 'You!' : racer.name}</span></div>`);
      results.appendChild(row);
      this.steps.push({ at: 0.4 + (r.order.length - i) * 0.25, run: () => { row.style.opacity = '1'; row.classList.add('pop'); sfx.select(); } });
    });

    const o = this.outcome;
    this.steps.push({
      at: 1.8,
      run: () => {
        const pay = this.el.querySelector('.payout')!;
        pay.innerHTML = `
          <span>${['🥇', '🥈', '🥉'][r.place - 1] ?? '🏁'} +${o.placeReward}</span>
          ${o.boltReward ? `<span>🔩 +${o.boltReward}</span>` : ''}
          ${o.bonus ? `<span>⭐ +${o.bonus}</span>` : ''}
          <span class="scrap outlined">= ${artHtml('icon-scrap', '🔩')}<b>0</b></span>
          ${o.chrome ? `<span class="scrap outlined">+ ${artHtml('icon-chrome', '💎')}${o.chrome}</span>` : ''}
          ${r.wrecks ? `<span>💥 ${r.wrecks} wrecked</span>` : ''}`;
        pay.classList.add('pop');
        this.countUp(pay.querySelector('b')!, o.total);
        if (o.chrome) setTimeout(() => speak('shiny', { priority: 1 }), 1400);
      },
    });
    speak(VOICE[r.place - 1], { priority: 2 });
    if (r.place <= 3) {
      sfx.cheer();
      confetti(game.ui, r.place === 1 ? 120 : 50);
    }
    playMusic('music-podium', false);

    // New things, one at a time.
    let at = 4.2;
    for (const c of o.unlocked) {
      const [kind, id] = c.split(':');
      this.steps.push({ at, run: () => this.celebrate(kind, id) });
      at += 3;
    }
    this.steps.push({ at: Math.min(at, 2.6), run: () => this.showActions() });
  }

  private countUp(el: Element, total: number) {
    const start = performance.now();
    const tick = () => {
      const k = Math.min(1, (performance.now() - start) / 1200);
      el.textContent = String(Math.round(total * k));
      if (Math.floor(total * k) % 7 === 0) sfx.bolt();
      if (k < 1 && el.isConnected) requestAnimationFrame(tick);
    };
    tick();
  }

  private celebrate(kind: string, id: string) {
    const box = this.el.querySelector('.celebrate')!;
    let content = '';
    if (kind === 'track') {
      const t = trackById(id);
      content = `${artHtml(worldById(t.world).card, '🏁')}<span>New track: ${t.name}!</span>`;
      speak('new-track', { priority: 2 });
    } else if (kind === 'world') {
      const w = worldById(id);
      content = `${artHtml(w.card, w.emoji)}<span>New wasteland: ${w.name}!</span>`;
      speak('new-world', { priority: 2 });
    } else if (kind === 'rival') {
      const rival = rivalById(id)!;
      content = `${artHtml(rival.portrait, rival.emoji)}<span>You beat ${rival.name}!</span>`;
      speak(`${id}-lose`, { priority: 2 });
    } else if (kind === 'reward') {
      const decal = DECALS.find((d) => d.unlock === id);
      content = decal ? `${artHtml(decal.image, decal.emoji)}<span>New sticker: ${decal.name}!</span>` : `<span class="emoji">🏆</span><span>Champion Gold paint!</span>`;
    } else if (kind === 'champion') {
      content = `${artHtml('icon-trophy', '🏆')}<span>CHAMPION! The Wasteland is open!</span>`;
      speak('champion', { priority: 2 });
      confetti(game.ui, 200);
    }
    box.innerHTML = content;
    box.classList.remove('pop');
    void (box as HTMLElement).offsetWidth;
    box.classList.add('pop');
    sfx.fanfare();
  }

  private showActions() {
    const actions = this.el.querySelector('.actions')!;
    const next = TRACK_ORDER[trackIndex(this.result.trackId) + 1];
    const canNext = next && isTrackUnlocked(state.data, next) && this.result.place === 1;
    actions.innerHTML = `
      ${season2Open(state.data) ? '<button class="btn chrome" data-nav data-a="map">🗺️ Wasteland</button>' : ''}
      <button class="btn" data-nav data-a="garage">🔧 Garage</button>
      <button class="btn teal" data-nav data-a="again">🔁 Race Again</button>
      ${canNext ? `<button class="btn green" data-nav data-a="next">➡️ Next Race</button>` : ''}`;
    actions.querySelectorAll<HTMLElement>('[data-a]').forEach((b) => {
      b.onclick = () => {
        sfx.confirm();
        const a = b.dataset.a;
        if (a === 'garage') game.go(new GarageScene());
        else if (a === 'map') game.go(wastelandHub());
        else if (a === 'again') game.go(new RaceScene(this.result.trackId));
        else if (a === 'next') game.go(new RaceScene(next));
      };
    });
    // Just beat the Thunder Dome? Point straight at the new Wasteland.
    this.nav.refocus(this.outcome.unlocked.includes('champion') ? '[data-a="map"]' : '[data-a="garage"]');
  }

  update(dt: number) {
    this.t += dt;
    while (this.steps.length) {
      const i = this.steps.findIndex((s) => s.at <= this.t);
      if (i < 0) break;
      this.steps.splice(i, 1)[0].run();
    }
    this.nav.update(game.controls);
  }

  exit() {
    stopVoice();
    stopMusic();
  }
}
