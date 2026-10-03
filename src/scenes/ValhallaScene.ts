import { game, type Scene } from '../Game';
import { CARDS, type Card } from '../data/cards';
import { sfx } from '../audio/sfx';
import { lineText, speak } from '../audio/voice';
import { artHtml, assetUrl } from '../systems/assets';
import { state } from '../systems/GameState';
import { Nav, html } from '../ui/nav';
import { GarageScene } from './GarageScene';

/**
 * The Valhalla Book: a card album of every character, car and place.
 * Opening a new card plays its voice line; Space plays it again.
 */
export class ValhallaScene implements Scene {
  private nav!: Nav;
  private el!: HTMLElement;

  enter() {
    const s = state.data;
    const bg = assetUrl('valhalla-bg');
    const got = CARDS.filter((c) => c.unlocked(s)).length;
    this.el = html(`<div class="screen shade valhalla" style="${bg ? `background-image:url(${bg})` : 'background:#3b2a20'}">
      <h1 class="outlined" style="font-size:clamp(30px,5vw,60px);margin-top:2vh">Valhalla Book <small class="count">${got} / ${CARDS.length}</small></h1>
      <div class="book">
        <div class="pages"></div>
        <div class="detail panel"></div>
      </div>
      <div class="hint passthrough"><span class="keycap">←↑↓→</span> look · <span class="keycap">SPACE</span> listen · <span class="keycap">ESC</span> back to the garage</div>
    </div>`);
    const pages = this.el.querySelector('.pages')!;
    for (const section of ['Characters', 'Cars', 'Places'] as const) {
      pages.appendChild(html(`<h3>${section}</h3>`));
      const grid = html(`<div class="cards"></div>`);
      for (const c of CARDS.filter((x) => x.section === section)) {
        const open = c.unlocked(s);
        const isNew = open && !s.cardsSeen.includes(c.id);
        const b = html(`<button class="btn vcard ${open ? '' : 'locked'}" data-nav data-id="${c.id}">
          ${artHtml(c.art, c.emoji)}<span>${open ? c.name : '???'}</span>${isNew ? '<b class="new">NEW</b>' : ''}</button>`);
        b.onclick = () => this.play(c);
        grid.appendChild(b);
      }
      pages.appendChild(grid);
    }
    game.ui.appendChild(this.el);
    this.nav = new Nav(this.el);
    this.nav.onFocus = (el) => this.show(CARDS.find((c) => c.id === el.dataset.id)!);
    this.nav.refocus();
    speak('valhalla', { priority: 1, cooldown: 120 });
  }

  private show(c: Card) {
    const s = state.data;
    const open = c.unlocked(s);
    const detail = this.el.querySelector('.detail')!;
    detail.innerHTML = open
      ? `<div class="big-art">${artHtml(c.art, c.emoji)}</div><h2 class="outlined">${c.name}</h2><p>${c.blurb}</p>${c.line ? `<p class="quote">“${lineText(c.line)}”</p>` : ''}`
      : `<div class="big-art locked">${artHtml(c.art, c.emoji)}</div><h2 class="outlined">???</h2><p>🔒 ${c.hint}</p>`;
    // A card seen for the first time introduces itself.
    if (open && !s.cardsSeen.includes(c.id)) {
      s.cardsSeen.push(c.id);
      state.persist();
      this.el.querySelector(`[data-id="${c.id}"] .new`)?.remove();
      sfx.fanfare();
      if (c.line) speak(c.line, { priority: 2 });
    }
  }

  private play(c: Card) {
    if (!c.unlocked(state.data)) {
      sfx.nope();
      return speak('card-locked', { priority: 1, cooldown: 3 });
    }
    sfx.select();
    if (c.line) speak(c.line, { priority: 2 });
  }

  update() {
    if (game.controls.back()) return game.go(new GarageScene());
    this.nav.update(game.controls);
  }

  exit() {}
}
