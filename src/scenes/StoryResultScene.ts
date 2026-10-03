import { game, type Scene } from '../Game';
import { carById } from '../data/cars';
import { CHAPTERS, FINALE, type StoryEvent } from '../data/story';
import { playMusic, stopMusic } from '../audio/music';
import { sfx } from '../audio/sfx';
import { speak, stopVoice } from '../audio/voice';
import { artHtml, assetUrl } from '../systems/assets';
import { state } from '../systems/GameState';
import { recordEvent, type EventPayout } from '../systems/Story';
import { ordinal, type HudRacer } from '../ui/hud';
import { Nav, confetti, html } from '../ui/nav';
import { ComicScene } from './ComicScene';
import { startEvent } from './events';
import { WastelandScene } from './WastelandScene';

export interface StoryOutcome {
  stars: number;
  won: boolean;
  /** Lap races and smashes: finishing place and the field. */
  place?: number;
  order?: HudRacer[];
  /** Cars the player wrecked. */
  wrecks: number;
  /** A line of detail, e.g. "Rig armor 80%". */
  detail?: string;
}

const HEADLINE: Record<StoryEvent['mode'], [string, string]> = {
  race: ['YOU WIN!', 'FINISHED!'],
  chase: ['ESCAPED!', 'MADE IT!'],
  escort: ['RIG DELIVERED!', 'MADE IT!'],
  arena: ['SMASH CHAMPION!', 'GOOD SMASHING!'],
  boss: ['BOSS DEFEATED!', 'NICE TRY!'],
};

/** After a story event: stars, prizes, and what just opened up. */
export class StoryResultScene implements Scene {
  private event: StoryEvent;
  private outcome: StoryOutcome;
  private payout!: EventPayout;
  private nav!: Nav;
  private el!: HTMLElement;
  private t = 0;
  private steps: { at: number; run: () => void }[] = [];

  constructor(event: StoryEvent, outcome: StoryOutcome) {
    this.event = event;
    this.outcome = outcome;
  }

  enter() {
    const ev = this.event, o = this.outcome;
    this.payout = recordEvent(state.data, ev, o);
    state.persist();
    const bg = assetUrl(CHAPTERS[ev.chapter - 1].panels[0].image) ?? assetUrl('podium-bg');
    const [winText, okText] = HEADLINE[ev.mode];
    this.el = html(`<div class="screen shade" style="${bg ? `background-image:url(${bg})` : 'background:#3b2a20'}">
      <div class="big outlined" style="font-size:clamp(18px,3vh,28px);margin-top:2vh">${ev.name}</div>
      <h1 class="outlined pop" style="font-size:clamp(40px,10vh,96px)">${o.won ? winText : okText}</h1>
      <div class="stars"></div>
      <div class="results"></div>
      <div class="payout"></div>
      <div class="celebrate"></div>
      <div class="actions"></div>
    </div>`);
    game.ui.appendChild(this.el);
    this.nav = new Nav(this.el);

    const starsEl = this.el.querySelector('.stars')!;
    for (let i = 0; i < 3; i++) {
      const star = html(`<span class="star ${i < o.stars ? 'on' : ''}">★</span>`);
      starsEl.appendChild(star);
      this.steps.push({ at: 0.5 + i * 0.35, run: () => { star.classList.add('pop', 'shown'); if (i < o.stars) sfx.bolt(); } });
    }
    if (o.order && o.order.length > 1) {
      const results = this.el.querySelector('.results')!;
      o.order.forEach((r, i) => {
        results.appendChild(html(`<div class="result panel ${r.isPlayer ? 'me' : ''}" style="padding:4px 12px">
          <span class="place">${['🥇', '🥈', '🥉'][i] ?? ordinal(i + 1)}</span>
          <div class="face" style="border:4px solid ${r.color}">${artHtml(r.portrait, r.emoji)}</div><span>${r.isPlayer ? 'You!' : r.name}</span></div>`));
      });
    }
    const p = this.payout;
    this.steps.push({
      at: 1.8,
      run: () => {
        const pay = this.el.querySelector('.payout')!;
        pay.innerHTML = `
          <span class="scrap outlined">${artHtml('icon-scrap', '🔩')}+${p.scrap}</span>
          ${p.chrome ? `<span class="scrap outlined">${artHtml('icon-chrome', '💎')}+${p.chrome}</span>` : ''}
          ${p.guzzoline ? `<span class="scrap outlined">${artHtml('icon-guzzoline', '⛽')}+${p.guzzoline}</span>` : ''}
          ${o.wrecks ? `<span>💥 ${o.wrecks} wrecked</span>` : ''}
          ${o.detail ? `<span>${o.detail}</span>` : ''}`;
        pay.classList.add('pop');
        sfx.buy();
      },
    });

    // The voice line for how it went.
    const line = !o.won ? 'place4'
      : ev.mode === 'boss' ? `boss-${ev.boss}-down`
      : ev.mode === 'chase' ? 'chase-escaped'
      : ev.mode === 'escort' ? 'escort-done'
      : ev.mode === 'arena' ? 'arena-win'
      : 'win';
    speak(line, { priority: 2 });
    if (o.stars === 3) this.steps.push({ at: 3, run: () => speak('stars3', { priority: 1 }) });
    if (o.won) {
      sfx.cheer();
      confetti(game.ui, ev.mode === 'boss' ? 160 : 70);
    }
    playMusic('music-podium', false);

    let at = 3.6;
    if (p.car) {
      const car = carById(p.car);
      this.steps.push({ at, run: () => this.celebrate(`${artHtml(car.card ?? '', car.emoji)}<span>You won ${car.name}!</span>`, 'new-lore-car') });
      at += 3;
    }
    for (const u of p.unlocked) {
      const [kind, n] = u.split(':');
      if (kind === 'boss') this.steps.push({ at, run: () => this.celebrate(`${artHtml('mk-boss', '💀')}<span>The boss is ready!</span>`, 'boss-ready') });
      if (kind === 'chapter') {
        const ch = CHAPTERS[Number(n) - 1];
        this.steps.push({ at, run: () => this.celebrate(`${artHtml(ch.panels[0].image, '🗺️')}<span>Chapter ${ch.n}: ${ch.name}!</span>`, 'chapter-open') });
      }
      if (kind === 'finale') this.steps.push({ at, run: () => this.celebrate(`${artHtml('icon-trophy', '🏆')}<span>ROAD WARRIOR OF THE WASTELAND!</span>`, 'champion') });
      at += 3;
    }
    this.steps.push({ at: Math.min(at, 2.6), run: () => this.showActions() });
  }

  private celebrate(content: string, voice: string) {
    const box = this.el.querySelector('.celebrate')!;
    box.innerHTML = content;
    box.classList.remove('pop');
    void (box as HTMLElement).offsetWidth;
    box.classList.add('pop');
    sfx.fanfare();
    speak(voice, { priority: 2 });
  }

  private showActions() {
    const actions = this.el.querySelector('.actions')!;
    actions.innerHTML = `
      <button class="btn green" data-nav data-a="map">🗺️ Wasteland</button>
      <button class="btn teal" data-nav data-a="again">🔁 Try Again</button>`;
    actions.querySelectorAll<HTMLElement>('[data-a]').forEach((b) => {
      b.onclick = () => {
        sfx.confirm();
        if (b.dataset.a === 'again') return game.go(startEvent(this.event));
        // The very end: the finale comic, once.
        if (this.payout.unlocked.includes('finale') && !state.data.comicsSeen.includes(6)) return game.go(new ComicScene(FINALE, 6, 'music-finale', () => new WastelandScene()));
        game.go(new WastelandScene());
      };
    });
    this.nav.refocus('[data-a="map"]');
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
