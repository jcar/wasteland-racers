import { CARS, GADGETS, MAX_LEVEL, carById, type UpgradeStat } from '../data/cars';
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
/** Cost to go from level i to level i+1. */
export const UPGRADE_COST = [50, 90, 140, 200];

export interface CarStats {
  maxSpeed: number;
  accel: number;
  grip: number;
  turn: number;
  mass: number;
  /** Seconds spent spinning after goo or a boing. */
  spinTime: number;
  maxCharges: number;
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
  };
}

const DIFFICULTY_SPEED: Record<Difficulty, number> = { chill: -1.2, normal: 0, tough: 1.8 };

/** Top speed of an ordinary AI car on this track. Later tracks are faster. */
export function aiSpeed(trackId: string, difficulty: Difficulty): number {
  return 18.5 + trackIndex(trackId) * 1.15 + DIFFICULTY_SPEED[difficulty];
}

export const upgradeCost = (level: number): number | undefined => (level < MAX_LEVEL ? UPGRADE_COST[level] : undefined);

export type BuyResult = 'ok' | 'owned' | 'maxed' | 'broke' | 'locked';

export function buyUpgrade(save: SaveData, stat: UpgradeStat): BuyResult {
  const cost = upgradeCost(save.upgrades[stat]);
  if (cost === undefined) return 'maxed';
  if (save.scrap < cost) return 'broke';
  save.scrap -= cost;
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
  if (save.scrap < car.price) return 'broke';
  save.scrap -= car.price;
  save.ownedCars.push(id);
  save.car = id;
  if (!save.ownedGadgets.includes(car.gadget)) {
    save.ownedGadgets.push(car.gadget);
    save.gadget = car.gadget;
  }
  return 'ok';
}

export function buyGadget(save: SaveData, id: string): BuyResult {
  const g = GADGETS.find((x) => x.id === id);
  if (!g) return 'locked';
  if (save.ownedGadgets.includes(id)) {
    save.gadget = id;
    return 'owned';
  }
  if (save.scrap < g.price) return 'broke';
  save.scrap -= g.price;
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
    unlocked: [],
  };
  out.total = out.placeReward + out.boltReward + out.bonus;
  save.scrap += out.total;
  save.totalScrap += out.total;
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
      if (next) out.unlocked.push(`world:${trackById(next).world}`);
      else out.unlocked.push('champion');
    } else if (next) {
      out.unlocked.push(`track:${next}`);
    }
    save.pendingCelebrations.push(...out.unlocked);
  }
  return out;
}
