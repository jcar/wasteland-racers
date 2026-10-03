/**
 * Every race track. A track is a closed loop through `points` (x, z), smoothed
 * into a curve. Everything else is placed by `at`, a fraction of the way
 * around the lap (0 = start line, 0.5 = halfway).
 *
 * To add a track: add it here, add its id to its world's list below, and run
 * `npm test` (it checks the loop doesn't cross itself and the corners aren't
 * too tight).
 */
export interface TrackDef {
  id: string;
  name: string;
  world: string;
  laps: number;
  width: number;
  points: [number, number][];
  /** Smooth bumps in the road. */
  hills?: { at: number; len: number; h: number }[];
  /** A ramp up that ends in a drop, so cars fly for a moment. */
  jumps?: { at: number; len: number; h: number }[];
  /** Arrow pads that give a quick boost. lane: -1 left edge, 0 middle, 1 right edge. */
  boosts?: { at: number; lane: number }[];
  /** Rows of gadget crates across the road. */
  pickups?: number[];
  /** Lines of bolts (extra scrap). */
  bolts?: { at: number; lane: number; count: number }[];
  /** Goo puddles that slow you down. */
  goo?: { at: number; lane: number; len: number }[];
  rival?: string;
}

export const TRACKS: TrackDef[] = [
  // ---------------------------------------------------------------- Dusty Dunes
  {
    id: 'dunes-1', name: 'Sandy Loop', world: 'dunes', laps: 3, width: 16,
    points: [[0, -34], [70, -28], [92, 0], [70, 28], [0, 34], [-70, 28], [-92, 0], [-70, -28]],
    hills: [{ at: 0.62, len: 0.08, h: 1.5 }],
    boosts: [{ at: 0.1, lane: 0 }, { at: 0.6, lane: 0 }],
    pickups: [0.28, 0.78],
    bolts: [{ at: 0.18, lane: -0.5, count: 5 }, { at: 0.45, lane: 0.5, count: 5 }, { at: 0.9, lane: 0, count: 5 }],
  },
  {
    id: 'dunes-2', name: 'Cactus Curves', world: 'dunes', laps: 3, width: 15,
    points: [[-20, -48], [40, -38], [95, -45], [120, -10], [100, 30], [55, 38], [24, 22], [-10, 38], [-55, 42], [-95, 15], [-80, -40]],
    hills: [{ at: 0.2, len: 0.06, h: 1.8 }, { at: 0.72, len: 0.06, h: 1.8 }],
    jumps: [{ at: 0.42, len: 0.025, h: 1.6 }],
    boosts: [{ at: 0.05, lane: -0.4 }, { at: 0.55, lane: 0.4 }],
    pickups: [0.3, 0.85],
    bolts: [{ at: 0.12, lane: 0.5, count: 5 }, { at: 0.6, lane: -0.5, count: 5 }, { at: 0.93, lane: 0, count: 4 }],
  },
  {
    id: 'dunes-3', name: "Rex's Ramp Run", world: 'dunes', laps: 3, width: 15, rival: 'rex',
    points: [[0, -62], [70, -55], [105, -20], [95, 25], [55, 35], [35, 70], [-10, 85], [-65, 72], [-100, 32], [-108, -15], [-90, -55]],
    jumps: [{ at: 0.1, len: 0.025, h: 2 }, { at: 0.6, len: 0.025, h: 2 }],
    hills: [{ at: 0.35, len: 0.06, h: 2 }],
    boosts: [{ at: 0.03, lane: 0 }, { at: 0.5, lane: -0.5 }, { at: 0.8, lane: 0.5 }],
    pickups: [0.22, 0.7],
    bolts: [{ at: 0.3, lane: 0, count: 5 }, { at: 0.75, lane: -0.5, count: 5 }, { at: 0.92, lane: 0.5, count: 5 }],
  },

  // ---------------------------------------------------------------- Junkyard Canyon
  {
    id: 'junk-1', name: 'Tire Town', world: 'junkyard', laps: 3, width: 15,
    points: [[-30, -45], [10, -25], [50, -50], [100, -40], [110, 10], [80, 45], [20, 40], [-20, 55], [-80, 45], [-110, 5], [-95, -40]],
    hills: [{ at: 0.5, len: 0.08, h: 2 }],
    jumps: [{ at: 0.8, len: 0.025, h: 1.8 }],
    boosts: [{ at: 0.12, lane: 0.3 }, { at: 0.6, lane: -0.3 }],
    pickups: [0.25, 0.7],
    bolts: [{ at: 0.18, lane: -0.5, count: 5 }, { at: 0.42, lane: 0.5, count: 5 }, { at: 0.9, lane: 0, count: 5 }],
  },
  {
    id: 'junk-2', name: 'Crusher Canyon', world: 'junkyard', laps: 3, width: 14,
    points: [[-40, -65], [0, -42], [40, -65], [100, -60], [115, -21], [97, 11], [106, 44], [80, 75], [20, 60], [-30, 80], [-90, 70], [-115, 20], [-95, -15], [-89, -53]],
    jumps: [{ at: 0.3, len: 0.02, h: 2 }],
    hills: [{ at: 0.65, len: 0.06, h: 2.5 }],
    boosts: [{ at: 0.05, lane: 0 }, { at: 0.47, lane: 0.5 }, { at: 0.83, lane: -0.5 }],
    pickups: [0.2, 0.55, 0.88],
    bolts: [{ at: 0.1, lane: 0.5, count: 5 }, { at: 0.38, lane: -0.5, count: 5 }, { at: 0.72, lane: 0, count: 5 }],
  },
  {
    id: 'junk-3', name: "Muffler's Maze", world: 'junkyard', laps: 3, width: 14, rival: 'muffler',
    points: [[-40, -78], [20, -60], [60, -80], [115, -65], [116, -21], [80, 0], [77, 31], [100, 54], [97, 85], [40, 95], [0, 72], [-40, 95], [-100, 85], [-120, 36], [-104, 1], [-119, -30], [-110, -70]],
    jumps: [{ at: 0.14, len: 0.02, h: 2 }, { at: 0.62, len: 0.02, h: 2 }],
    hills: [{ at: 0.4, len: 0.05, h: 2.2 }, { at: 0.85, len: 0.05, h: 2.2 }],
    boosts: [{ at: 0.04, lane: 0 }, { at: 0.33, lane: -0.4 }, { at: 0.72, lane: 0.4 }],
    pickups: [0.22, 0.5, 0.8],
    bolts: [{ at: 0.1, lane: -0.5, count: 5 }, { at: 0.45, lane: 0.5, count: 5 }, { at: 0.68, lane: 0, count: 5 }, { at: 0.93, lane: 0, count: 5 }],
  },

  // ---------------------------------------------------------------- Goo Swamp
  {
    id: 'swamp-1', name: 'Mushroom Marsh', world: 'swamp', laps: 3, width: 15,
    points: [[-40, -55], [20, -40], [80, -55], [115, -20], [100, 25], [60, 50], [0, 35], [-50, 55], [-105, 35], [-120, -5], [-100, -45]],
    goo: [{ at: 0.3, lane: -0.5, len: 0.04 }, { at: 0.75, lane: 0.5, len: 0.04 }],
    hills: [{ at: 0.55, len: 0.07, h: 2 }],
    boosts: [{ at: 0.1, lane: 0 }, { at: 0.62, lane: -0.4 }],
    pickups: [0.2, 0.68],
    bolts: [{ at: 0.15, lane: 0.5, count: 5 }, { at: 0.45, lane: -0.5, count: 5 }, { at: 0.88, lane: 0, count: 5 }],
  },
  {
    id: 'swamp-2', name: 'Bubble Bog', world: 'swamp', laps: 3, width: 14,
    points: [[-60, -70], [0, -55], [45, -75], [110, -60], [123, -11], [95, 21], [97, 57], [60, 85], [10, 60], [-35, 85], [-95, 70], [-125, 20], [-110, -50]],
    goo: [{ at: 0.18, lane: 0.4, len: 0.04 }, { at: 0.5, lane: -0.4, len: 0.05 }, { at: 0.82, lane: 0.3, len: 0.04 }],
    jumps: [{ at: 0.35, len: 0.02, h: 2 }],
    hills: [{ at: 0.65, len: 0.05, h: 2.2 }],
    boosts: [{ at: 0.06, lane: 0 }, { at: 0.42, lane: 0.4 }, { at: 0.72, lane: -0.4 }],
    pickups: [0.25, 0.58, 0.9],
    bolts: [{ at: 0.12, lane: -0.5, count: 5 }, { at: 0.45, lane: 0.5, count: 5 }, { at: 0.77, lane: 0, count: 5 }],
  },
  {
    id: 'swamp-3', name: "Bertha's Bayou", world: 'swamp', laps: 3, width: 14, rival: 'bertha',
    points: [[-50, -80], [0, -60], [50, -85], [115, -70], [131, -26], [113, 7], [128, 45], [100, 90], [40, 80], [12, 65], [-20, 80], [-80, 95], [-127, 55], [-112, 10], [-135, -25], [-120, -65]],
    goo: [{ at: 0.12, lane: -0.4, len: 0.035 }, { at: 0.4, lane: 0.4, len: 0.035 }, { at: 0.66, lane: -0.3, len: 0.035 }, { at: 0.9, lane: 0.3, len: 0.035 }],
    jumps: [{ at: 0.25, len: 0.02, h: 2.2 }, { at: 0.75, len: 0.02, h: 2.2 }],
    boosts: [{ at: 0.04, lane: 0 }, { at: 0.5, lane: 0 }, { at: 0.82, lane: -0.4 }],
    pickups: [0.2, 0.46, 0.7, 0.95],
    bolts: [{ at: 0.08, lane: 0.5, count: 5 }, { at: 0.33, lane: -0.5, count: 5 }, { at: 0.58, lane: 0, count: 5 }, { at: 0.86, lane: 0, count: 5 }],
  },

  // ---------------------------------------------------------------- Volcano Highway
  {
    id: 'volcano-1', name: 'Lava Loop', world: 'volcano', laps: 3, width: 14,
    points: [[-40, -62], [30, -48], [100, -60], [130, -15], [110, 35], [60, 55], [0, 40], [-60, 62], [-120, 40], [-135, -5], [-110, -50]],
    jumps: [{ at: 0.2, len: 0.025, h: 2.4 }, { at: 0.7, len: 0.025, h: 2.4 }],
    hills: [{ at: 0.45, len: 0.07, h: 3 }],
    boosts: [{ at: 0.05, lane: 0 }, { at: 0.35, lane: 0.4 }, { at: 0.6, lane: -0.4 }, { at: 0.85, lane: 0 }],
    pickups: [0.28, 0.78],
    bolts: [{ at: 0.12, lane: -0.5, count: 5 }, { at: 0.52, lane: 0.5, count: 5 }, { at: 0.92, lane: 0, count: 5 }],
  },
  {
    id: 'volcano-2', name: 'Smoky Switchbacks', world: 'volcano', laps: 3, width: 13,
    points: [[-60, -85], [0, -65], [60, -85], [120, -75], [129, -35], [115, -7], [126, 26], [106, 57], [61, 57], [30, 90], [-30, 95], [-70, 60], [-120, 66], [-145, 25], [-124, -13], [-134, -44], [-120, -70]],
    jumps: [{ at: 0.15, len: 0.02, h: 2.4 }, { at: 0.55, len: 0.02, h: 2.4 }],
    hills: [{ at: 0.35, len: 0.05, h: 3 }, { at: 0.8, len: 0.05, h: 3 }],
    boosts: [{ at: 0.04, lane: 0 }, { at: 0.25, lane: -0.4 }, { at: 0.47, lane: 0.4 }, { at: 0.7, lane: 0 }, { at: 0.9, lane: 0 }],
    pickups: [0.2, 0.5, 0.78],
    bolts: [{ at: 0.1, lane: 0.5, count: 5 }, { at: 0.4, lane: -0.5, count: 5 }, { at: 0.62, lane: 0, count: 5 }, { at: 0.85, lane: 0.5, count: 5 }],
  },
  {
    id: 'volcano-3', name: "Warlord's Highway", world: 'volcano', laps: 3, width: 13, rival: 'warlord',
    points: [[-60, -95], [0, -75], [60, -100], [130, -85], [144, -43], [131, -12], [150, 25], [127, 75], [70, 70], [40, 100], [-20, 105], [-60, 72], [-110, 95], [-147, 59], [-132, 15], [-160, -30], [-130, -80]],
    jumps: [{ at: 0.1, len: 0.02, h: 2.6 }, { at: 0.42, len: 0.02, h: 2.6 }, { at: 0.72, len: 0.02, h: 2.6 }],
    hills: [{ at: 0.28, len: 0.05, h: 3.2 }, { at: 0.88, len: 0.05, h: 3.2 }],
    boosts: [{ at: 0.03, lane: 0 }, { at: 0.2, lane: 0.4 }, { at: 0.5, lane: -0.4 }, { at: 0.64, lane: 0 }, { at: 0.95, lane: 0 }],
    pickups: [0.16, 0.36, 0.58, 0.82],
    bolts: [{ at: 0.07, lane: -0.5, count: 5 }, { at: 0.32, lane: 0.5, count: 5 }, { at: 0.55, lane: 0, count: 5 }, { at: 0.78, lane: -0.5, count: 5 }],
  },

  // ---------------------------------------------------------------- Thunder Dome
  {
    id: 'dome-1', name: 'Thunder Dome', world: 'dome', laps: 4, width: 15,
    points: [[-40, -70], [0, -50], [40, -70], [110, -60], [135, -15], [110, 25], [111, 62], [70, 85], [0, 70], [-70, 85], [-110, 62], [-110, 25], [-135, -15], [-110, -60]],
    jumps: [{ at: 0.22, len: 0.02, h: 2.4 }, { at: 0.72, len: 0.02, h: 2.4 }],
    hills: [{ at: 0.47, len: 0.05, h: 2.5 }, { at: 0.97, len: 0.03, h: 1.2 }],
    goo: [{ at: 0.35, lane: 0.4, len: 0.03 }, { at: 0.85, lane: -0.4, len: 0.03 }],
    boosts: [{ at: 0.05, lane: 0 }, { at: 0.3, lane: -0.4 }, { at: 0.55, lane: 0 }, { at: 0.8, lane: 0.4 }],
    pickups: [0.15, 0.4, 0.62, 0.9],
    bolts: [{ at: 0.1, lane: 0.5, count: 5 }, { at: 0.34, lane: -0.5, count: 5 }, { at: 0.6, lane: 0, count: 5 }, { at: 0.86, lane: 0.5, count: 5 }],
  },

  // ---------------------------------------------------------------- Fury Road
  {
    id: 'fury-1', name: 'Citadel Circuit', world: 'fury', laps: 3, width: 15,
    points: [[0, -70], [120, -60], [150, -10], [120, 40], [60, 55], [0, 40], [-60, 55], [-120, 40], [-150, -10], [-120, -60]],
    jumps: [{ at: 0.3, len: 0.02, h: 2.4 }],
    hills: [{ at: 0.72, len: 0.05, h: 2.5 }],
    boosts: [{ at: 0.05, lane: 0 }, { at: 0.45, lane: -0.4 }, { at: 0.85, lane: 0.4 }],
    pickups: [0.18, 0.55, 0.8],
    bolts: [{ at: 0.1, lane: -0.5, count: 5 }, { at: 0.4, lane: 0, count: 5 }, { at: 0.65, lane: 0.5, count: 5 }, { at: 0.92, lane: 0, count: 5 }],
  },
  {
    id: 'fury-2', name: 'Gas Town Gauntlet', world: 'fury', laps: 3, width: 14, rival: 'slit',
    points: [[-40, -80], [30, -60], [100, -85], [150, -50], [140, 0], [119, 27], [125, 61], [100, 100], [20, 85], [-30, 110], [-100, 95], [-144, 50], [-127, 2], [-147, -35], [-130, -70]],
    jumps: [{ at: 0.22, len: 0.02, h: 2.4 }, { at: 0.66, len: 0.02, h: 2.4 }],
    hills: [{ at: 0.45, len: 0.05, h: 2.6 }],
    goo: [{ at: 0.82, lane: 0.4, len: 0.03 }],
    boosts: [{ at: 0.04, lane: 0 }, { at: 0.35, lane: 0.4 }, { at: 0.58, lane: -0.4 }, { at: 0.9, lane: 0 }],
    pickups: [0.15, 0.4, 0.62, 0.88],
    bolts: [{ at: 0.08, lane: 0.5, count: 5 }, { at: 0.3, lane: 0, count: 5 }, { at: 0.52, lane: -0.5, count: 5 }, { at: 0.75, lane: 0, count: 5 }],
  },
  {
    id: 'fury-3', name: 'Bullet Farm Blitz', world: 'fury', laps: 3, width: 14, rival: 'rictus',
    points: [[-50, -100], [50, -80], [150, -95], [180, -50], [155, -9], [180, 40], [150, 95], [70, 85], [20, 115], [-50, 110], [-90, 70], [-150, 95], [-187, 50], [-162, 0], [-186, -45], [-150, -90]],
    jumps: [{ at: 0.12, len: 0.02, h: 2.6 }, { at: 0.47, len: 0.02, h: 2.6 }, { at: 0.8, len: 0.02, h: 2.6 }],
    hills: [{ at: 0.3, len: 0.05, h: 3 }, { at: 0.64, len: 0.05, h: 3 }],
    boosts: [{ at: 0.03, lane: 0 }, { at: 0.22, lane: -0.4 }, { at: 0.55, lane: 0.4 }, { at: 0.72, lane: 0 }, { at: 0.93, lane: 0 }],
    pickups: [0.17, 0.38, 0.6, 0.85],
    bolts: [{ at: 0.07, lane: 0, count: 5 }, { at: 0.33, lane: 0.5, count: 5 }, { at: 0.5, lane: 0, count: 5 }, { at: 0.76, lane: -0.5, count: 5 }],
  },
];

/** The order tracks unlock in. Winning one opens the next. */
export const TRACK_ORDER = TRACKS.map((t) => t.id);

export const trackById = (id: string) => TRACKS.find((t) => t.id === id)!;
export const trackIndex = (id: string) => TRACK_ORDER.indexOf(id);
export const tracksInWorld = (world: string) => TRACKS.filter((t) => t.world === world);
