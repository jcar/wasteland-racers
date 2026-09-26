import dialogue from '../data/dialogue.json';
import { assetUrl } from '../systems/assets';
import { isMuted } from './sfx';
import { duckMusic } from './music';

export const LINES: Record<string, { speaker: string; text: string }> = dialogue;

/** Pitch for the browser's built-in voice, used when no generated voice file exists. */
const PITCH: Record<string, number> = { announcer: 0.9, rex: 1.5, muffler: 0.7, bertha: 1.2, warlord: 0.5 };

let current: HTMLAudioElement | undefined;
let currentPriority = 0;
let voiceOn = true;
const lastSaid = new Map<string, number>();

export const setVoiceOn = (on: boolean) => {
  voiceOn = on;
  if (!on) stopVoice();
};

export const lineText = (id: string) => LINES[id]?.text ?? id;

export function stopVoice() {
  current?.pause();
  current = undefined;
  duckMusic(false);
  try {
    speechSynthesis.cancel();
  } catch {
    /* not supported */
  }
}

function busy() {
  if (current && !current.paused && !current.ended) return true;
  try {
    return speechSynthesis.speaking;
  } catch {
    return false;
  }
}

/**
 * Say a line out loud. Chatter (priority 0) is skipped if something is
 * already playing or the same line was said recently; important lines
 * (priority 2) interrupt.
 */
export function speak(id: string, opts: { priority?: number; cooldown?: number } = {}) {
  const priority = opts.priority ?? 1;
  if (!voiceOn || isMuted()) return;
  const now = performance.now();
  if (opts.cooldown && now - (lastSaid.get(id) ?? -1e9) < opts.cooldown * 1000) return;
  if (busy() && priority <= currentPriority && priority < 2) return;
  stopVoice();
  lastSaid.set(id, now);
  currentPriority = priority;
  const url = assetUrl(`vo-${id}`);
  if (url) {
    const el = new Audio(url);
    el.volume = 1;
    el.onended = () => duckMusic(false);
    current = el;
    duckMusic(true);
    void el.play().catch(() => duckMusic(false));
    return;
  }
  try {
    const u = new SpeechSynthesisUtterance(lineText(id));
    u.pitch = PITCH[LINES[id]?.speaker ?? 'announcer'] ?? 1;
    u.rate = 1.05;
    speechSynthesis.speak(u);
  } catch {
    /* no speech support: the words are on screen anyway */
  }
}
