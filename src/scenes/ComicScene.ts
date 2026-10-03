import { game, type Scene } from '../Game';
import type { ComicPanel } from '../data/story';
import { playMusic, stopMusic } from '../audio/music';
import { sfx } from '../audio/sfx';
import { lineText, speak, stopVoice } from '../audio/voice';
import { artHtml, assetUrl } from '../systems/assets';
import { state } from '../systems/GameState';
import { html } from '../ui/nav';

/**
 * Comic panels that tell the story: each one slowly pans while a character
 * says their line. Space goes to the next panel; Esc skips to the end.
 */
export class ComicScene implements Scene {
  private panels: ComicPanel[];
  private id: number;
  private music: string;
  private next: () => Scene;
  private i = -1;
  private el!: HTMLElement;
  private t = 0;

  constructor(panels: ComicPanel[], id: number, music: string, next: () => Scene) {
    this.panels = panels;
    this.id = id;
    this.music = music;
    this.next = next;
  }

  enter() {
    this.el = html(`<div class="screen comic">
      <div class="panel-img"></div>
      <div class="caption"></div>
      <div class="dots">${this.panels.map(() => '<i></i>').join('')}</div>
      <div class="hint passthrough"><span class="keycap">SPACE</span> next · <span class="keycap">ESC</span> skip</div>
    </div>`);
    game.ui.appendChild(this.el);
    playMusic(this.music);
    this.show(0);
  }

  private show(i: number) {
    if (i >= this.panels.length) return this.done();
    this.i = i;
    this.t = 0;
    const p = this.panels[i];
    const img = this.el.querySelector<HTMLElement>('.panel-img')!;
    const url = assetUrl(p.image);
    img.style.backgroundImage = url ? `url(${url})` : '';
    img.classList.remove('pan', 'pan2');
    void img.offsetWidth;
    img.classList.add(i % 2 ? 'pan2' : 'pan');
    const cap = this.el.querySelector('.caption')!;
    cap.innerHTML = `<div class="face">${artHtml(p.portrait, '💬')}</div><div class="bubble">${lineText(p.line)}</div>`;
    cap.classList.remove('pop');
    void (cap as HTMLElement).offsetWidth;
    cap.classList.add('pop');
    this.el.querySelectorAll('.dots i').forEach((d, k) => d.classList.toggle('on', k <= i));
    sfx.whoosh();
    speak(p.line, { priority: 2 });
  }

  private done() {
    if (!state.data.comicsSeen.includes(this.id)) {
      state.data.comicsSeen.push(this.id);
      state.persist();
    }
    game.go(this.next());
  }

  update(dt: number) {
    this.t += dt;
    const c = game.controls;
    if (c.back()) return this.done();
    // A short pause so a held Space doesn't skip panels unseen.
    if (c.confirm() && this.t > 0.6) this.show(this.i + 1);
  }

  exit() {
    stopVoice();
    stopMusic();
  }
}
