/**
 * Synthesized sound effects. No files needed and they play instantly.
 * Loud and fun, but nothing harsh.
 */
let ctx: AudioContext | undefined;
let master: GainNode | undefined;
let muted = false;

export function audio(): { ctx: AudioContext; out: GainNode } | undefined {
  if (!ctx) {
    try {
      ctx = new AudioContext();
      master = ctx.createGain();
      master.gain.value = muted ? 0 : 0.5;
      master.connect(ctx.destination);
    } catch {
      return undefined;
    }
  }
  if (ctx.state === 'suspended') void ctx.resume();
  return { ctx, out: master! };
}

export function setMuted(m: boolean) {
  muted = m;
  if (master) master.gain.value = m ? 0 : 0.5;
}
export const isMuted = () => muted;

const midiHz = (n: number) => 440 * Math.pow(2, (n - 69) / 12);

export function tone(note: number, start: number, dur: number, type: OscillatorType = 'sine', vol = 0.25, dest?: AudioNode) {
  const a = audio();
  if (!a) return;
  const t = a.ctx.currentTime + start;
  const osc = a.ctx.createOscillator();
  const g = a.ctx.createGain();
  osc.type = type;
  osc.frequency.value = midiHz(note);
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(vol, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(g).connect(dest ?? a.out);
  osc.start(t);
  osc.stop(t + dur + 0.05);
}

let noiseBuf: AudioBuffer | undefined;
/** A burst of filtered noise: thuds, splats, whooshes and cheers. */
export function noise(dur: number, filter: BiquadFilterType, from: number, to: number, vol = 0.2, start = 0, dest?: AudioNode) {
  const a = audio();
  if (!a) return;
  if (!noiseBuf) {
    noiseBuf = a.ctx.createBuffer(1, a.ctx.sampleRate * 2, a.ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  const t = a.ctx.currentTime + start;
  const src = a.ctx.createBufferSource();
  src.buffer = noiseBuf;
  src.loop = true;
  const f = a.ctx.createBiquadFilter();
  f.type = filter;
  f.Q.value = filter === 'bandpass' ? 2 : 0.7;
  f.frequency.setValueAtTime(from, t);
  f.frequency.exponentialRampToValueAtTime(Math.max(20, to), t + dur);
  const g = a.ctx.createGain();
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(f).connect(g).connect(dest ?? a.out);
  src.start(t, Math.random());
  src.stop(t + dur + 0.05);
}

function sweep(from: number, to: number, dur: number, type: OscillatorType, vol: number, start = 0) {
  const a = audio();
  if (!a) return;
  const t = a.ctx.currentTime + start;
  const osc = a.ctx.createOscillator();
  const g = a.ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(from, t);
  osc.frequency.exponentialRampToValueAtTime(to, t + dur);
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(g).connect(a.out);
  osc.start(t);
  osc.stop(t + dur + 0.05);
}

const PENTA = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21, 24];
let chimeStep = 0;
let lastChime = 0;

export const sfx = {
  /** Bolt pickup. Pitch climbs when you grab several in a row. */
  bolt() {
    const now = performance.now();
    chimeStep = now - lastChime < 500 ? Math.min(chimeStep + 1, PENTA.length - 1) : 0;
    lastChime = now;
    const n = 76 + PENTA[chimeStep];
    tone(n, 0, 0.25, 'square', 0.06);
    tone(n + 12, 0.02, 0.2, 'triangle', 0.06);
  },
  crate() {
    tone(72, 0, 0.12, 'square', 0.08);
    tone(79, 0.07, 0.12, 'square', 0.08);
    tone(84, 0.14, 0.25, 'square', 0.08);
  },
  boing() {
    sweep(150, 700, 0.18, 'sine', 0.3);
    sweep(700, 300, 0.25, 'sine', 0.18, 0.18);
  },
  splat() {
    noise(0.35, 'lowpass', 1200, 150, 0.35);
    sweep(400, 90, 0.3, 'sine', 0.2);
  },
  boost() {
    noise(0.9, 'bandpass', 300, 2500, 0.3);
    sweep(80, 240, 0.8, 'sawtooth', 0.06);
  },
  wall(power = 1) {
    noise(0.18, 'lowpass', 500, 80, Math.min(0.4, 0.12 * power));
    sweep(120, 60, 0.15, 'sine', Math.min(0.3, 0.1 * power));
  },
  bump() {
    noise(0.15, 'lowpass', 900, 100, 0.3);
  },
  land() {
    noise(0.2, 'lowpass', 400, 60, 0.3);
  },
  spin() {
    for (let i = 0; i < 4; i++) sweep(600, 300, 0.12, 'triangle', 0.06, i * 0.12);
  },
  tow() {
    sweep(200, 900, 1.0, 'square', 0.04);
    noise(1.2, 'bandpass', 1800, 2200, 0.05);
  },
  beep() {
    tone(69, 0, 0.3, 'square', 0.12);
  },
  go() {
    tone(81, 0, 0.6, 'square', 0.14);
    tone(88, 0, 0.6, 'square', 0.06);
  },
  lap() {
    [72, 76, 79].forEach((n, i) => tone(n, i * 0.08, 0.25, 'square', 0.07));
  },
  cheer() {
    noise(2.2, 'bandpass', 900, 1400, 0.22);
    noise(1.8, 'bandpass', 2400, 1800, 0.08, 0.2);
  },
  fanfare() {
    [60, 64, 67, 72, 67, 72, 76, 79].forEach((n, i) => tone(n, i * 0.1, 0.35, 'square', 0.08));
    [72, 76, 79, 84].forEach((n) => tone(n, 0.85, 1.4, 'triangle', 0.08));
  },
  buy() {
    tone(84, 0, 0.1, 'square', 0.08);
    tone(91, 0.08, 0.4, 'square', 0.08);
    noise(0.3, 'highpass', 5000, 8000, 0.06, 0.05);
  },
  wrench() {
    noise(0.08, 'highpass', 3000, 5000, 0.2);
    noise(0.08, 'highpass', 3500, 5000, 0.2, 0.12);
    tone(96, 0.05, 0.2, 'triangle', 0.06);
  },
  nope() {
    tone(55, 0, 0.18, 'square', 0.08);
    tone(52, 0.15, 0.25, 'square', 0.08);
  },
  select() {
    tone(84, 0, 0.07, 'square', 0.05);
  },
  confirm() {
    tone(79, 0, 0.08, 'square', 0.07);
    tone(86, 0.06, 0.12, 'square', 0.07);
  },
};
