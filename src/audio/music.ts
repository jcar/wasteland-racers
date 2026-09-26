import { assetUrl } from '../systems/assets';
import { audio, isMuted, noise, tone } from './sfx';

/**
 * Background music. Plays the generated track when there is one, otherwise
 * a little synthesized rock loop so there's always something driving.
 */
let el: HTMLAudioElement | undefined;
let playing = '';
let timer: number | undefined;
let bus: GainNode | undefined;
let ducked = false;
const VOLUME = 0.45;

function volume() {
  return isMuted() ? 0 : VOLUME * (ducked ? 0.35 : 1);
}

export function duckMusic(on: boolean) {
  ducked = on;
  if (el) el.volume = volume();
  const a = audio();
  if (bus && a) bus.gain.setTargetAtTime(volume() * 0.6, a.ctx.currentTime, 0.1);
}

export function refreshMusicVolume() {
  duckMusic(ducked);
}

export function playMusic(id: string, loop = true) {
  if (playing === id) return;
  stopMusic();
  playing = id;
  const url = assetUrl(id);
  if (url) {
    el = new Audio(url);
    el.loop = loop;
    el.volume = volume();
    void el.play().catch(() => {
      /* autoplay blocked until the first key press; Controls retries */
    });
    return;
  }
  if (loop) playGeneratedRock(id.length * 7);
}

/** Try again after the first key press, since browsers block audio until then. */
export function resumeMusic() {
  if (el && el.paused) void el.play().catch(() => {});
}

export function stopMusic() {
  playing = '';
  if (el) {
    const old = el;
    const fade = setInterval(() => {
      old.volume = Math.max(0, old.volume - 0.08);
      if (old.volume <= 0) {
        old.pause();
        clearInterval(fade);
      }
    }, 40);
  }
  el = undefined;
  if (timer !== undefined) clearInterval(timer);
  timer = undefined;
  if (bus) {
    const b = bus;
    setTimeout(() => b.disconnect(), 300);
  }
  bus = undefined;
}

const RIFFS = [
  [0, 0, 12, 0, 10, 0, 7, 5],
  [0, 3, 5, 0, 7, 5, 3, 0],
  [0, 0, 7, 7, 5, 5, 3, 5],
];

function playGeneratedRock(seed: number) {
  const a = audio();
  if (!a) return;
  bus = a.ctx.createGain();
  bus.gain.value = volume() * 0.6;
  bus.connect(a.out);
  const riff = RIFFS[seed % RIFFS.length];
  const root = 40 + (seed % 5);
  const eighth = 60 / 140 / 2;
  let step = 0;
  const b = bus;
  const tick = () => {
    if (bus !== b) return;
    const i = step % 8;
    const bar = Math.floor(step / 8) % 4;
    const shift = bar === 3 ? 5 : 0;
    tone(root + riff[i] + shift, 0, eighth * 0.9, 'square', 0.07, b);
    if (i % 4 === 0) {
      tone(28, 0, 0.18, 'sine', 0.35, b);
      noise(0.08, 'lowpass', 200, 60, 0.3, 0, b);
    }
    if (i % 4 === 2) noise(0.14, 'bandpass', 1800, 900, 0.25, 0, b);
    noise(0.03, 'highpass', 7000, 9000, 0.05, 0, b);
    step++;
  };
  tick();
  timer = window.setInterval(tick, eighth * 1000);
}
