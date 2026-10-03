/**
 * Art drawn in code. It's used until (or instead of) the Gemini-generated
 * images, so the game always has something to show.
 */
export function canvas(w: number, h: number, draw: (g: CanvasRenderingContext2D) => void): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d')!);
  return c;
}

function rng(seed: number) {
  return () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
}

/** Speckled ground or road in a flat color. */
export function speckle(color: string, seed = 1, spots = 900) {
  return () =>
    canvas(256, 256, (g) => {
      g.fillStyle = color;
      g.fillRect(0, 0, 256, 256);
      const r = rng(seed);
      for (let i = 0; i < spots; i++) {
        g.fillStyle = r() < 0.5 ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.08)';
        const s = 1 + r() * 4;
        g.fillRect(r() * 256, r() * 256, s, s);
      }
    });
}

/** Two-color stripes running along the road (for walls and kerbs). */
export function stripes(a: string, b: string) {
  return () =>
    canvas(64, 64, (g) => {
      g.fillStyle = a;
      g.fillRect(0, 0, 64, 64);
      g.fillStyle = b;
      g.fillRect(0, 32, 64, 32);
    });
}

export const checker = () =>
  canvas(128, 128, (g) => {
    for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) {
      g.fillStyle = (x + y) % 2 ? '#111' : '#fff';
      g.fillRect(x * 16, y * 16, 16, 16);
    }
  });

/** Yellow boost chevrons pointing along the road (+v). */
export const chevrons = () =>
  canvas(128, 128, (g) => {
    g.fillStyle = 'rgba(255,120,0,0.85)';
    g.fillRect(0, 0, 128, 128);
    g.strokeStyle = '#ffe14d';
    g.lineWidth = 16;
    g.lineJoin = 'round';
    for (const y of [20, 84]) {
      g.beginPath();
      g.moveTo(18, y + 34);
      g.lineTo(64, y);
      g.lineTo(110, y + 34);
      g.stroke();
    }
  });

/** Yellow and black hazard stripes for jump ramps. */
export const hazard = () =>
  canvas(128, 128, (g) => {
    g.fillStyle = '#ffcf1f';
    g.fillRect(0, 0, 128, 128);
    g.fillStyle = '#222';
    for (let i = -2; i < 4; i++) {
      g.beginPath();
      g.moveTo(i * 64, 128);
      g.lineTo(i * 64 + 32, 128);
      g.lineTo(i * 64 + 160, 0);
      g.lineTo(i * 64 + 128, 0);
      g.fill();
    }
  });

export const gooPuddle = () =>
  canvas(128, 128, (g) => {
    const grad = g.createRadialGradient(64, 64, 10, 64, 64, 62);
    grad.addColorStop(0, '#c6ff4d');
    grad.addColorStop(0.75, '#7bd11f');
    grad.addColorStop(1, 'rgba(90,170,20,0)');
    g.fillStyle = grad;
    g.beginPath();
    g.arc(64, 64, 62, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = 'rgba(255,255,255,0.55)';
    for (const [x, y, r] of [[45, 50, 8], [80, 70, 6], [60, 85, 5], [85, 42, 4]]) {
      g.beginPath();
      g.arc(x, y, r, 0, Math.PI * 2);
      g.fill();
    }
  });

/** Soft round particle. */
export const puff = () =>
  canvas(64, 64, (g) => {
    const grad = g.createRadialGradient(32, 32, 2, 32, 32, 30);
    grad.addColorStop(0, 'rgba(255,255,255,1)');
    grad.addColorStop(0.6, 'rgba(255,255,255,0.7)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, 64, 64);
  });

export const star = () =>
  canvas(64, 64, (g) => {
    g.fillStyle = '#fff';
    g.beginPath();
    for (let i = 0; i < 10; i++) {
      const r = i % 2 ? 12 : 30;
      const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
      g.lineTo(32 + Math.cos(a) * r, 32 + Math.sin(a) * r);
    }
    g.fill();
  });

/** An emoji drawn big, for icons, props and decals before real art exists. */
export function emojiArt(emoji: string, w = 128, h = 128) {
  return () =>
    canvas(w, h, (g) => {
      g.font = `${Math.min(w, h) * 0.8}px "Noto Color Emoji", "Apple Color Emoji", "Segoe UI Emoji", sans-serif`;
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillText(emoji, w / 2, h / 2 + h * 0.05);
    });
}

const PROP_EMOJI: Record<string, string> = {
  'prop-cactus': '🌵', 'prop-rock': '🪨', 'prop-skull': '🐮', 'prop-tires': '🛞', 'prop-junkcar': '🚗',
  'prop-barrel': '🛢️', 'prop-mushroom': '🍄', 'prop-deadtree': '🌳', 'prop-lavarock': '🌋', 'prop-crowd': '🙌',
  'prop-flag': '🚩', 'prop-sign': '➡️', 'prop-jump-sign': '⚠️',
};
export const propPlaceholder = (key: string) => emojiArt(PROP_EMOJI[key] ?? '🪨', 128, 128);
