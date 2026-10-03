import { CARS, GADGETS, MAX_LEVEL, ORNAMENTS, PAINTS, SCRAP_LEVELS, carById, type UpgradeStat } from '../data/cars';
import { TRACKS, TRACK_ORDER, trackById, trackIndex, tracksInWorld } from '../data/tracks';
import { WORLDS } from '../data/worlds';
import type { Difficulty, SaveData } from './SaveManager';

/**
 * Money, upgrades and unlocks. Pure functions on the save, so the balance
 * can be tested without running the game.
 */
export const PLACE_REWARD = [100, 70, 50, 40];
export const BOLT_VALUE = 3;
export const FIRST_WIN_BONUS = 50;
/** Scrap cost to go from level i to level i+1 (levels 1-4). */
export const UPGRADE_COST = [50, 90, 140, 200];
/** Chrome cost of levels 5 and 6. */
export const CHROME_UPGRADE_COST = [4, 6];
/** Chrome for 1st and 2nd place, plus a bonus the first time you win a track. */
export const CHROME_REWARD = [2, 1];
export const FIRST_WIN_CHROME = 3;

export interface CarStats {
  maxSpeed: number;
  accel: number;
  grip: number;
  turn: number;
  mass: number;
  /** Seconds spent spinning after goo or a boing. */
  spinTime: number;
  maxCharges: number;
  /** Hits from lore weapons before the car wrecks. */
  maxHp: number;
}

export function carStats(save: Pick<SaveData, 'car' | 'upgrades'>): CarStats {
  const c = carById(save.car);
  const u = save.upgrades;
  return {
    maxSpeed: c.speed + 2 * u.engine,
    accel: c.accel + 1.2 * u.engine,
    grip: c.grip + 0.9 * u.tires,
    turn: c.turn + 0.1 * u.tires,
    mass: c.mass + 0.15 * u.armor,
    spinTime: 1.2 * (1 - 0.13 * u.armor),
    maxCharges: 2 + u.gadget,
    maxHp: 3 + Math.floor(u.armor / 2),
  };
}

const DIFFICULTY_SPEED: Record<Difficulty, number> = { chill: -1.2, normal: 0, tough: 1.8 };

/** Top speed of an ordinary AI car on this track. Later tracks are faster. */
export function aiSpeed(trackId: string, difficulty: Difficulty): number {
  const i = trackIndex(trackId);
  const dome = TRACK_ORDER.indexOf('dome-1');
  // After the Thunder Dome the pack only gets a little faster: Fury Road's challenge is the War Boys' weapons.
  const step = i <= dome ? i * 1.15 : dome * 1.15 + (i - dome) * 0.6;
  return 18.5 + step + DIFFICULTY_SPEED[difficulty];
}

export type Currency = 'scrap' | 'chrome';
export interface Price { amount: number; currency: Currency }

/** What the next level costs: scrap for 1-4, chrome for 5-6. */
export function upgradeCost(level: number): Price | undefined {
  if (level >= MAX_LEVEL) return undefined;
  return level < SCRAP_LEVELS
    ? { amount: UPGRADE_COST[level], currency: 'scrap' }
    : { amount: CHROME_UPGRADE_COST[level - SCRAP_LEVELS], currency: 'chrome' };
}

export type BuyResult = 'ok' | 'owned' | 'maxed' | 'broke' | 'locked';

/** Take the price out of the save, if there's enough. */
function pay(save: SaveData, price: Price): boolean {
  if (save[price.currency] < price.amount) return false;
  save[price.currency] -= price.amount;
  return true;
}

export const carPrice = (id: string): Price => {
  const c = carById(id);
  return c.chrome ? { amount: c.chrome, currency: 'chrome' } : { amount: c.price, currency: 'scrap' };
};

export function buyUpgrade(save: SaveData, stat: UpgradeStat): BuyResult {
  const cost = upgradeCost(save.upgrades[stat]);
  if (cost === undefined) return 'maxed';
  if (!pay(save, cost)) return 'broke';
  save.upgrades[stat]++;
  return 'ok';
}

/** Buy a car, or switch to it if you already own it. */
export function buyCar(save: SaveData, id: string): BuyResult {
  const car = CARS.find((c) => c.id === id);
  if (!car) return 'locked';
  if (save.ownedCars.includes(id)) {
    save.car = id;
    return 'owned';
  }
  if (!pay(save, carPrice(id))) return 'broke';
  save.ownedCars.push(id);
  save.car = id;
  if (!save.ownedGadgets.includes(car.gadget)) {
    save.ownedGadgets.push(car.gadget);
    save.gadget = car.gadget;
  }
  // Legends come in their own colors.
  if (car.paint) save.paint = car.paint;
  return 'ok';
}

/** Can this gadget be used with the car you're driving? Specials only work on their car. */
export const gadgetFits = (gadgetId: string, carId: string) => {
  const g = GADGETS.find((x) => x.id === gadgetId);
  return !!g && (!g.car || g.car === carId);
};

/** The gadget to actually race with: the equipped one, or the car's own if that doesn't fit. */
export function raceGadget(save: Pick<SaveData, 'gadget' | 'car'>): string {
  return gadgetFits(save.gadget, save.car) ? save.gadget : carById(save.car).gadget;
}

export function buyPaint(save: SaveData, id: string): BuyResult {
  const p = PAINTS.find((x) => x.id === id);
  if (!p) return 'locked';
  if (p.unlock && !save.rewards.includes(p.unlock)) return 'locked';
  if (p.chrome && !save.ownedPaints.includes(id)) {
    if (!pay(save, { amount: p.chrome, currency: 'chrome' })) return 'broke';
    save.ownedPaints.push(id);
    save.paint = id;
    return 'ok';
  }
  save.paint = id;
  return 'owned';
}

export function buyOrnament(save: SaveData, id: string): BuyResult {
  const o = ORNAMENTS.find((x) => x.id === id);
  if (!o) return 'locked';
  if (save.ownedOrnaments.includes(id)) {
    save.ornament = id;
    return 'owned';
  }
  if (!pay(save, { amount: o.chrome, currency: 'chrome' })) return 'broke';
  save.ownedOrnaments.push(id);
  save.ornament = id;
  return 'ok';
}

export function buyGadget(save: SaveData, id: string): BuyResult {
  const g = GADGETS.find((x) => x.id === id);
  if (!g) return 'locked';
  if (save.ownedGadgets.includes(id)) {
    save.gadget = id;
    return 'owned';
  }
  if (g.car) return 'locked'; // specials come with their car
  if (!pay(save, { amount: g.price, currency: 'scrap' })) return 'broke';
  save.ownedGadgets.push(id);
  save.gadget = id;
  return 'ok';
}

export function isTrackUnlocked(save: Pick<SaveData, 'best'>, trackId: string): boolean {
  const i = trackIndex(trackId);
  return i === 0 || save.best[TRACK_ORDER[i - 1]] === 1;
}

export function isWorldUnlocked(save: Pick<SaveData, 'best'>, worldId: string): boolean {
  return isTrackUnlocked(save, tracksInWorld(worldId)[0].id);
}

/** The first unlocked track you haven't won yet, or the last one. */
export function suggestedTrack(save: Pick<SaveData, 'best'>): string {
  return TRACKS.find((t) => isTrackUnlocked(save, t.id) && save.best[t.id] !== 1)?.id ?? TRACK_ORDER[TRACK_ORDER.length - 1];
}

export interface RaceOutcome {
  place: number;
  placeReward: number;
  boltReward: number;
  bonus: number;
  total: number;
  chrome: number;
  /** Celebrations earned this race, in the order to show them. */
  unlocked: string[];
}

/**
 * Pay out a finished race and record it. Every place earns scrap; winning a
 * track for the first time opens the next one (and maybe a new world).
 */
export function recordResult(save: SaveData, trackId: string, place: number, bolts: number): RaceOutcome {
  const firstWin = place === 1 && save.best[trackId] !== 1;
  const out: RaceOutcome = {
    place,
    placeReward: PLACE_REWARD[Math.min(place, PLACE_REWARD.length) - 1],
    boltReward: bolts * BOLT_VALUE,
    bonus: firstWin ? FIRST_WIN_BONUS : 0,
    total: 0,
    chrome: (CHROME_REWARD[place - 1] ?? 0) + (firstWin ? FIRST_WIN_CHROME : 0),
    unlocked: [],
  };
  out.total = out.placeReward + out.boltReward + out.bonus;
  save.scrap += out.total;
  save.totalScrap += out.total;
  save.chrome += out.chrome;
  save.totalChrome += out.chrome;
  save.best[trackId] = Math.min(save.best[trackId] ?? 4, place, 4);

  if (firstWin) {
    const track = trackById(trackId);
    const worldTracks = tracksInWorld(track.world);
    const next = TRACK_ORDER[trackIndex(trackId) + 1];
    if (worldTracks[worldTracks.length - 1].id === trackId) {
      const world = WORLDS.find((w) => w.id === track.world)!;
      if (world.reward && !save.rewards.includes(world.reward)) {
        save.rewards.push(world.reward);
        out.unlocked.push(`reward:${world.reward}`);
      }
      if (track.rival) out.unlocked.push(`rival:${track.rival}`);
      if (track.world === 'dome') out.unlocked.push('champion');
      if (next) out.unlocked.push(`world:${trackById(next).world}`);
    } else if (next) {
      out.unlocked.push(`track:${next}`);
    }
    save.pendingCelebrations.push(...out.unlocked);
  }
  return out;
}
