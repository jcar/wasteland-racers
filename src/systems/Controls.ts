/**
 * Every input in the game goes through here: arrows, Space, Enter, Esc.
 * WASD work too, for grown-ups who like them.
 */
const ALIASES: Record<string, string> = {
  ArrowLeft: 'left', KeyA: 'left',
  ArrowRight: 'right', KeyD: 'right',
  ArrowUp: 'up', KeyW: 'up',
  ArrowDown: 'down', KeyS: 'down',
  Space: 'space', Enter: 'enter', NumpadEnter: 'enter', Escape: 'esc',
  KeyM: 'm', KeyV: 'v', KeyR: 'r', KeyG: 'g',
};

export class Controls {
  private down = new Set<string>();
  private pressed = new Set<string>();
  /** Called on the very first key or click, so audio can start (browsers require it). */
  onFirstInput?: () => void;

  constructor() {
    const first = () => {
      this.onFirstInput?.();
      this.onFirstInput = undefined;
    };
    window.addEventListener('keydown', (e) => {
      const k = ALIASES[e.code];
      if (!k) return;
      e.preventDefault();
      first();
      if (!e.repeat) this.pressed.add(k);
      this.down.add(k);
    });
    window.addEventListener('keyup', (e) => {
      const k = ALIASES[e.code];
      if (k) this.down.delete(k);
    });
    window.addEventListener('pointerdown', first);
    window.addEventListener('blur', () => this.down.clear());
  }

  held(k: string) {
    return this.down.has(k);
  }
  /** True once per key press. */
  just(...keys: string[]) {
    let hit = false;
    for (const k of keys) if (this.pressed.delete(k)) hit = true;
    return hit;
  }
  /** Call at the end of every frame: presses nobody asked about are dropped. */
  endFrame() {
    this.pressed.clear();
  }

  get steer() {
    return (this.held('right') ? 1 : 0) - (this.held('left') ? 1 : 0);
  }
  confirm() { return this.just('space', 'enter'); }
  back() { return this.just('esc'); }
}
