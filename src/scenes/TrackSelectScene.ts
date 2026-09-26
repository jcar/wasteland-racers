import { game, type Scene } from '../Game';
import { tracksInWorld, trackById } from '../data/tracks';
import { WORLDS } from '../data/worlds';
import { sfx } from '../audio/sfx';
import { speak } from '../audio/voice';
import { artHtml, assetUrl } from '../systems/assets';
import { isTrackUnlocked, isWorldUnlocked, suggestedTrack } from '../systems/Economy';
import { state } from '../systems/GameState';
import { TrackGeometry } from '../race/trackGeometry';
import { trackSvg } from '../race/trackMesh';
import { Nav, html, shake } from '../ui/nav';
import { GarageScene } from './GarageScene';
import { RaceScene } from './RaceScene';

const MEDAL = ['🥇', '🥈', '🥉', '🏁'];

/** Pick a wasteland, then a track. Locked ones show a padlock. */
export class TrackSelectScene implements Scene {
  private nav!: Nav;
  private el!: HTMLElement;
  private world = trackById(suggestedTrack(state.data)).world;

  enter() {
    const bg = assetUrl('map-bg');
    this.el = html(`<div class="screen shade" style="${bg ? `background-image:url(${bg})` : 'background:#6b4a36'}">
      <h1 class="outlined" style="font-size:clamp(34px,5vw,64px);margin-top:2vh">Pick a Race!</h1>
      <div class="worlds"></div>
      <div class="tracks"></div>
      <div class="hint passthrough"><span class="keycap">SPACE</span> race · <span class="keycap">ESC</span> back to the garage</div>
    </div>`);
    game.ui.appendChild(this.el);
    this.nav = new Nav(this.el);
    this.render();
    this.nav.refocus(`[data-id="track:${suggestedTrack(state.data)}"]`);
    speak('track-select', { priority: 1, cooldown: 60 });
  }

  private render() {
    const worlds = this.el.querySelector('.worlds')!;
    worlds.innerHTML = '';
    for (const w of WORLDS) {
      const open = isWorldUnlocked(state.data, w.id);
      const img = assetUrl(w.card);
      const b = html(`<button class="btn world ${open ? '' : 'locked'} ${w.id === this.world ? 'teal' : ''}" data-nav data-id="world:${w.id}">
        ${img ? `<img src="${img}" alt="">` : `<div class="ph emoji">${w.emoji}</div>`}
        <div class="label">${open ? w.name : '🔒 ' + w.name}</div></button>`);
      b.onclick = () => {
        if (!open) {
          sfx.nope();
          shake(b);
          return speak('locked', { priority: 1, cooldown: 4 });
        }
        this.world = w.id;
        sfx.select();
        this.render();
        this.nav.refocus(`[data-id="track:${tracksInWorld(w.id)[0].id}"]`);
      };
      worlds.appendChild(b);
    }

    const tracks = this.el.querySelector('.tracks')!;
    tracks.innerHTML = '';
    for (const t of tracksInWorld(this.world)) {
      const open = isTrackUnlocked(state.data, t.id);
      const best = state.data.best[t.id];
      const { svg } = trackSvg(new TrackGeometry(t), 200, 9);
      const b = html(`<button class="btn trackcard ${open ? 'green' : 'locked'}" data-nav data-id="track:${t.id}">
        <svg viewBox="0 0 200 154" preserveAspectRatio="xMidYMid meet"><g transform="translate(0,-23)">${svg}</g></svg>
        <span>${t.name}</span>
        <span class="medal emoji">${best ? MEDAL[best - 1] : t.rival ? '⭐' : ''}</span>
        ${open ? '' : `<div class="lock">${artHtml('icon-lock', '🔒')}</div>`}</button>`);
      b.onclick = () => {
        if (!open) {
          sfx.nope();
          shake(b);
          return speak('locked', { priority: 1, cooldown: 4 });
        }
        sfx.confirm();
        game.go(new RaceScene(t.id));
      };
      tracks.appendChild(b);
    }
  }

  update() {
    if (game.controls.back()) return game.go(new GarageScene());
    this.nav.update(game.controls);
  }

  exit() {}
}
