import { game } from '../Game';
import { refreshMusicVolume } from '../audio/music';
import { sfx } from '../audio/sfx';
import { state } from '../systems/GameState';
import type { Settings } from '../systems/SaveManager';
import { Nav, html } from './nav';

type Choice = { key: keyof Settings; label: string; options: [string, string | boolean][] };

const CHOICES: Choice[] = [
  { key: 'steerHelp', label: 'Steer help', options: [['Strong', 'strong'], ['Medium', 'medium'], ['Off', 'off']] },
  { key: 'autoGas', label: 'Auto gas', options: [['On', true], ['Off', false]] },
  { key: 'difficulty', label: 'Other racers', options: [['Chill', 'chill'], ['Normal', 'normal'], ['Tough', 'tough']] },
  { key: 'muted', label: 'Sound', options: [['On', false], ['Off', true]] },
  { key: 'voice', label: 'Voice', options: [['On', true], ['Off', false]] },
];

/**
 * The grown-ups panel. Returns an updater to call each frame while it's
 * open; it calls onClose when Done (or Esc) is pressed.
 */
export function openSettings(onClose: () => void): { update(): void } {
  const back = html(`<div class="modal-back"><div class="modal panel"><h2 class="outlined">Grown-ups</h2></div></div>`);
  const modal = back.firstElementChild as HTMLElement;
  const nav = new Nav(modal);
  const render = () => {
    modal.querySelectorAll('.setting, .done').forEach((e) => e.remove());
    for (const c of CHOICES) {
      const row = html(`<div class="setting"><span>${c.label}</span><div class="opts"></div></div>`);
      for (const [label, value] of c.options) {
        const on = state.data.settings[c.key] === value;
        const b = html(`<button class="btn ${on ? 'on' : 'gray'}" data-nav data-id="${c.key}-${String(value)}">${label}</button>`);
        b.onclick = () => {
          (state.data.settings as unknown as Record<string, unknown>)[c.key] = value;
          state.persist();
          refreshMusicVolume();
          sfx.confirm();
          render();
          nav.refocus(`[data-id="${c.key}-${String(value)}"]`);
        };
        row.lastElementChild!.appendChild(b);
      }
      modal.appendChild(row);
    }
    const done = html(`<button class="btn green done" data-nav>Done</button>`);
    done.onclick = close;
    modal.appendChild(done);
  };
  const close = () => {
    back.remove();
    onClose();
  };
  render();
  game.ui.appendChild(back);
  nav.refocus('.done');
  return {
    update() {
      if (game.controls.back()) return close();
      nav.update(game.controls);
    },
  };
}
