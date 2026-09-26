import type { UpgradeStat } from '../data/cars';

export const SAVE_KEY = 'wasteland-racers-save';
export const SAVE_VERSION = 1;

export type SteerHelp = 'strong' | 'medium' | 'off';
export type Difficulty = 'chill' | 'normal' | 'tough';

export interface Settings {
  steerHelp: SteerHelp;
  autoGas: boolean;
  difficulty: Difficulty;
  muted: boolean;
  voice: boolean;
}

export interface SaveData {
  version: number;
  /** Scrap in your pocket right now. */
  scrap: number;
  /** All scrap ever earned. Never goes down (for bragging). */
  totalScrap: number;
  driver: string;
  car: string;
  ownedCars: string[];
  upgrades: Record<UpgradeStat, number>;
  paint: string;
  decal: string;
  gadget: string;
  ownedGadgets: string[];
  /** Best finishing place per track (1 = won). */
  best: Record<string, number>;
  /** Rewards earned by winning worlds: decal ids and 'gold'. */
  rewards: string[];
  /** Things to celebrate on the next screen that can show them. */
  pendingCelebrations: string[];
  /** Whether the driver-pick screen has been seen. */
  started: boolean;
  settings: Settings;
}

export function freshSave(): SaveData {
  return {
    version: SAVE_VERSION,
    scrap: 0,
    totalScrap: 0,
    driver: 'kid',
    car: 'buggy',
    ownedCars: ['buggy'],
    upgrades: { engine: 0, tires: 0, armor: 0, gadget: 0 },
    paint: 'red',
    decal: 'flames',
    gadget: 'boost',
    ownedGadgets: ['boost'],
    best: {},
    rewards: [],
    pendingCelebrations: [],
    started: false,
    settings: { steerHelp: 'strong', autoGas: false, difficulty: 'chill', muted: false, voice: true },
  };
}

type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

function defaultStorage(): StorageLike | undefined {
  try {
    return globalThis.localStorage;
  } catch {
    return undefined;
  }
}

const isStringArray = (v: unknown): v is string[] => Array.isArray(v) && v.every((x) => typeof x === 'string');
const nat = (v: unknown, max = Infinity) => (typeof v === 'number' && v >= 0 ? Math.min(max, Math.floor(v)) : 0);
const pick = <T extends string>(v: unknown, options: readonly T[], fallback: T): T =>
  options.includes(v as T) ? (v as T) : fallback;

/** Upgrade older saves and repair anything missing, keeping all progress we can. */
export function migrate(raw: unknown): SaveData {
  const base = freshSave();
  if (!raw || typeof raw !== 'object') return base;
  const r = raw as Record<string, unknown>;
  const up = (r.upgrades && typeof r.upgrades === 'object' ? r.upgrades : {}) as Record<string, unknown>;
  const st = (r.settings && typeof r.settings === 'object' ? r.settings : {}) as Record<string, unknown>;
  const best: Record<string, number> = {};
  if (r.best && typeof r.best === 'object')
    for (const [k, v] of Object.entries(r.best)) if (typeof v === 'number' && v >= 1 && v <= 4) best[k] = Math.floor(v);
  const ownedCars = isStringArray(r.ownedCars) ? [...new Set(['buggy', ...r.ownedCars])] : base.ownedCars;
  const ownedGadgets = isStringArray(r.ownedGadgets) ? [...new Set(['boost', ...r.ownedGadgets])] : base.ownedGadgets;
  const car = typeof r.car === 'string' && ownedCars.includes(r.car) ? r.car : 'buggy';
  const gadget = typeof r.gadget === 'string' && ownedGadgets.includes(r.gadget) ? r.gadget : 'boost';
  return {
    version: SAVE_VERSION,
    scrap: nat(r.scrap),
    totalScrap: Math.max(nat(r.totalScrap), nat(r.scrap)),
    driver: typeof r.driver === 'string' ? r.driver : base.driver,
    car,
    ownedCars,
    upgrades: { engine: nat(up.engine, 4), tires: nat(up.tires, 4), armor: nat(up.armor, 4), gadget: nat(up.gadget, 4) },
    paint: typeof r.paint === 'string' ? r.paint : base.paint,
    decal: typeof r.decal === 'string' ? r.decal : base.decal,
    gadget,
    ownedGadgets,
    best,
    rewards: isStringArray(r.rewards) ? [...new Set(r.rewards)] : [],
    pendingCelebrations: isStringArray(r.pendingCelebrations) ? r.pendingCelebrations : [],
    started: r.started === true,
    settings: {
      steerHelp: pick(st.steerHelp, ['strong', 'medium', 'off'] as const, base.settings.steerHelp),
      autoGas: st.autoGas === true,
      difficulty: pick(st.difficulty, ['chill', 'normal', 'tough'] as const, base.settings.difficulty),
      muted: st.muted === true,
      voice: st.voice !== false,
    },
  };
}

export class SaveManager {
  private storage: StorageLike | undefined;
  constructor(storage: StorageLike | undefined = defaultStorage()) {
    this.storage = storage;
  }

  load(): SaveData {
    try {
      const text = this.storage?.getItem(SAVE_KEY);
      return migrate(text ? JSON.parse(text) : undefined);
    } catch {
      return freshSave();
    }
  }

  save(data: SaveData) {
    try {
      this.storage?.setItem(SAVE_KEY, JSON.stringify(data));
    } catch {
      /* private mode or full: the game still plays, it just won't remember */
    }
  }

  reset(): SaveData {
    try {
      this.storage?.removeItem(SAVE_KEY);
    } catch {
      /* ignore */
    }
    return freshSave();
  }
}
