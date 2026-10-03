import { game, type Scene } from '../Game';
import { playMusic } from '../audio/music';
import { sfx } from '../audio/sfx';
import { assetUrl } from '../systems/assets';
import { state } from '../systems/GameState';
import { html } from '../ui/nav';
import { openSettings } from '../ui/settings';
import { DriverPickScene } from './DriverPickScene';
import { GarageScene } from './GarageScene';
import { season2Open } from '../systems/Story';
import { wastelandHub } from './WastelandScene';

/** Press Space to start. Grown-up keys live here too. */
export class TitleScene implements Scene {
  private el!: HTMLElement;
  private settings?: { update(): void };
  private resetHeld = 0;

  enter() {
    const bg = assetUrl('title-bg');
    if (bg) game.root.style.backgroundImage = `url(${bg})`;
    this.el = html(`<div class="screen">
      <h1 class="logo outlined">Wasteland<small>RACERS</small></h1>
      <div style="flex:1"></div>
      <div class="big outlined pulse" style="font-size:clamp(26px,4vw,52px);margin-bottom:9vh">Press SPACE!</div>
      <div class="hint">Grown-ups: <span class="keycap">G</span> settings · <span class="keycap">M</span> sound <b class="snd"></b> · <span class="keycap">V</span> voice <b class="vox"></b> · hold <span class="keycap">R</span> 3s for a new game <b class="reset"></b></div>
    </div>`);
    game.ui.appendChild(this.el);
    this.el.onclick = () => this.start();
    this.refresh();
    playMusic('music-title');
  }

  private refresh() {
    const s = state.data.settings;
    this.el.querySelector('.snd')!.textContent = s.muted ? '(off)' : '(on)';
    this.el.querySelector('.vox')!.textContent = s.voice ? '(on)' : '(off)';
  }

  private start() {
    if (this.settings) return;
    sfx.confirm();
    if (season2Open(state.data)) return game.go(wastelandHub());
    game.go(state.data.started ? new GarageScene() : new DriverPickScene());
  }

  update(dt: number) {
    const c = game.controls;
    if (this.settings) return this.settings.update();
    if (c.confirm()) return this.start();
    if (c.just('g')) {
      this.settings = openSettings(() => {
        this.settings = undefined;
        this.refresh();
      });
    }
    if (c.just('m')) {
      state.data.settings.muted = !state.data.settings.muted;
      state.persist();
      playMusic('music-title');
      this.refresh();
    }
    if (c.just('v')) {
      state.data.settings.voice = !state.data.settings.voice;
      state.persist();
      this.refresh();
    }
    const reset = this.el.querySelector('.reset')!;
    if (c.held('r')) {
      this.resetHeld += dt;
      reset.textContent = this.resetHeld < 3 ? `${'●'.repeat(Math.ceil(this.resetHeld))}` : 'done!';
      if (this.resetHeld >= 3 && this.resetHeld - dt < 3) {
        state.reset();
        sfx.fanfare();
      }
    } else if (this.resetHeld) {
      this.resetHeld = 0;
      reset.textContent = '';
    }
  }

  exit() {}
}
