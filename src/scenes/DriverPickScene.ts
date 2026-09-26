import { game, type Scene } from '../Game';
import { DRIVERS } from '../data/characters';
import { sfx } from '../audio/sfx';
import { speak } from '../audio/voice';
import { artHtml, assetUrl } from '../systems/assets';
import { state } from '../systems/GameState';
import { Nav, html } from '../ui/nav';
import { GarageScene } from './GarageScene';

/** First time only: who's driving? */
export class DriverPickScene implements Scene {
  private nav!: Nav;

  enter() {
    const bg = assetUrl('garage-bg');
    const el = html(`<div class="screen shade" style="${bg ? `background-image:url(${bg})` : 'background:#3b2a20'}">
      <h1 class="outlined" style="font-size:clamp(34px,6vw,80px);margin-top:6vh">Who's Driving?</h1>
      <div class="drivers"></div>
    </div>`);
    const list = el.querySelector('.drivers')!;
    for (const d of DRIVERS) {
      const b = html(`<button class="btn driver" data-nav data-id="${d.id}">${artHtml(d.portrait, d.emoji)}${d.name}</button>`);
      b.onclick = () => {
        sfx.fanfare();
        state.data.driver = d.id;
        state.data.started = true;
        state.persist();
        game.go(new GarageScene());
      };
      list.appendChild(b);
    }
    game.ui.appendChild(el);
    this.nav = new Nav(el);
    this.nav.refocus();
    speak('pick-driver', { priority: 2 });
  }

  update() {
    this.nav.update(game.controls);
  }

  exit() {}
}
