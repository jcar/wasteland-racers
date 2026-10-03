import { CHAPTERS, EVENTS, chapterEvents, type StoryEvent } from '../data/story';
import type { SaveData } from './SaveManager';

/**
 * Season 2 progress: which chapters and events are open, what's next, and
 * paying out a finished event. Pure functions on the save, like Economy.
 */
export interface EventOutcome {
  /** 1-3 stars. Every finish gets at least one. */
  stars: number;
  /** Counts toward opening the next things (won the race, escaped, beat the boss...). */
  won: boolean;
}

export interface EventPayout {
  scrap: number;
  chrome: number;
  guzzoline: number;
  /** A car given as a prize (bosses hand over their ride). */
  car?: string;
  firstWin: boolean;
  /** Celebrations: 'chapter:2', 'boss:1', 'finale'. */
  unlocked: string[];
}

/** Season 2 opens once you've beaten the Thunder Dome. */
export const season2Open = (s: Pick<SaveData, 'best'>) => s.best['dome-1'] === 1;

export const eventWon = (s: Pick<SaveData, 'story'>, id: string) => !!s.story[id]?.won;

export function chapterOpen(s: Pick<SaveData, 'best' | 'story'>, n: number): boolean {
  if (n === 1) return season2Open(s);
  const boss = chapterEvents(n - 1).find((e) => e.mode === 'boss');
  return !!boss && eventWon(s, boss.id);
}

/** Bosses wait until the rest of their chapter is won. */
export function eventOpen(s: Pick<SaveData, 'best' | 'story'>, ev: StoryEvent): boolean {
  if (!chapterOpen(s, ev.chapter)) return false;
  if (ev.mode !== 'boss') return true;
  return chapterEvents(ev.chapter).every((e) => e.mode === 'boss' || eventWon(s, e.id));
}

/** The next thing to do: the first open event you haven't won. */
export function nextEvent(s: Pick<SaveData, 'best' | 'story'>): StoryEvent | undefined {
  return EVENTS.find((e) => eventOpen(s, e) && !eventWon(s, e.id));
}

/** The highest chapter that's open. */
export function currentChapter(s: Pick<SaveData, 'best' | 'story'>): number {
  return [...CHAPTERS].reverse().find((c) => chapterOpen(s, c.n))?.n ?? 0;
}

export const storyComplete = (s: Pick<SaveData, 'story'>) => EVENTS.every((e) => eventWon(s, e.id));

/**
 * Pay out a finished event. The first win pays the full prize (chrome,
 * guzzoline, maybe a car); replays pay scrap, plus a little chrome for three
 * stars. Every finish pays something.
 */
export function recordEvent(s: SaveData, ev: StoryEvent, outcome: EventOutcome): EventPayout {
  const stars = Math.max(1, Math.min(3, outcome.stars));
  const before = s.story[ev.id];
  const firstWin = outcome.won && !before?.won;
  const bossesBefore = CHAPTERS.filter((c) => chapterOpen(s, c.n)).length;
  const bossReadyBefore = chapterEvents(ev.chapter).filter((e) => e.mode === 'boss').map((e) => eventOpen(s, e));
  const out: EventPayout = {
    scrap: Math.round(ev.reward.scrap * (0.4 + 0.2 * stars)),
    chrome: firstWin ? ev.reward.chrome : stars === 3 ? 1 : 0,
    guzzoline: firstWin ? ev.reward.guzzoline : Math.round(ev.reward.guzzoline / 4),
    firstWin,
    unlocked: [],
  };
  if (firstWin && ev.reward.car && !s.ownedCars.includes(ev.reward.car)) {
    out.car = ev.reward.car;
    s.ownedCars.push(ev.reward.car);
  }
  s.scrap += out.scrap;
  s.totalScrap += out.scrap;
  s.chrome += out.chrome;
  s.totalChrome += out.chrome;
  s.guzzoline += out.guzzoline;
  s.story[ev.id] = { won: !!before?.won || outcome.won, stars: Math.max(before?.stars ?? 0, stars) };

  if (firstWin) {
    const bossNowReady = chapterEvents(ev.chapter).filter((e) => e.mode === 'boss').some((e, i) => !bossReadyBefore[i] && eventOpen(s, e));
    if (bossNowReady) out.unlocked.push(`boss:${ev.chapter}`);
    const chaptersNow = CHAPTERS.filter((c) => chapterOpen(s, c.n)).length;
    if (chaptersNow > bossesBefore) out.unlocked.push(`chapter:${chaptersNow}`);
    if (storyComplete(s)) out.unlocked.push('finale');
  }
  return out;
}
