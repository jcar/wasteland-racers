import type { TrackDef } from './tracks';

/**
 * Tracks and roads used by Season 2 story events. Roads (`open: true`) run
 * from a start line to a finish line: chases and escorts happen on them.
 * `at` positions on a road are fractions of the way from start to finish.
 */
export const STORY_TRACKS: TrackDef[] = [
  // ---------------------------------------------------------------- roads
  {
    id: 'road-citadel', name: 'Citadel Road', world: 'wasteland', laps: 1, width: 16, open: true, event: true,
    points: [[0, 0], [150, -30], [300, 20], [450, -40], [600, 10], [750, -60], [900, 0], [1050, 40], [1200, 0]],
    jumps: [{ at: 0.33, len: 0.012, h: 2.4 }, { at: 0.7, len: 0.012, h: 2.4 }],
    boosts: [{ at: 0.1, lane: 0 }, { at: 0.5, lane: 0.4 }, { at: 0.85, lane: -0.4 }],
    pickups: [0.06, 0.22, 0.42, 0.6, 0.78],
    bolts: [{ at: 0.15, lane: 0, count: 6 }, { at: 0.55, lane: 0.5, count: 6 }, { at: 0.9, lane: 0, count: 6 }],
  },
  {
    id: 'road-gastown', name: 'Guzzoline Highway', world: 'gastown', laps: 1, width: 18, open: true, event: true,
    points: [[0, 0], [140, 40], [280, -20], [420, 50], [560, -30], [700, 30], [840, -40], [980, 20], [1120, -30], [1260, 0]],
    jumps: [{ at: 0.45, len: 0.012, h: 2 }],
    boosts: [{ at: 0.2, lane: 0 }, { at: 0.65, lane: 0 }],
    pickups: [0.05, 0.18, 0.32, 0.5, 0.68, 0.84],
    bolts: [{ at: 0.25, lane: 0.5, count: 6 }, { at: 0.75, lane: -0.5, count: 6 }],
  },
  {
    id: 'road-bulletfarm', name: 'Mine Road', world: 'bulletfarm', laps: 1, width: 15, open: true, event: true,
    points: [[0, 0], [120, -60], [260, -20], [380, 60], [520, 20], [640, -50], [780, -10], [900, 70], [1040, 20], [1160, -40]],
    jumps: [{ at: 0.28, len: 0.012, h: 2.4 }, { at: 0.62, len: 0.012, h: 2.4 }],
    boosts: [{ at: 0.12, lane: 0 }, { at: 0.48, lane: -0.4 }, { at: 0.82, lane: 0.4 }],
    pickups: [0.06, 0.2, 0.4, 0.55, 0.72, 0.88],
    bolts: [{ at: 0.35, lane: 0, count: 6 }, { at: 0.78, lane: 0.5, count: 6 }],
  },
  {
    id: 'road-fury', name: 'The Fury Road', world: 'saltflats', laps: 1, width: 20, open: true, event: true,
    points: [[0, 0], [200, -40], [400, 30], [600, -50], [800, 20], [1000, -30], [1200, 40], [1400, -20], [1600, 50], [1800, -10], [2000, 30], [2200, 0]],
    jumps: [{ at: 0.5, len: 0.008, h: 2 }],
    boosts: [{ at: 0.15, lane: 0 }, { at: 0.4, lane: 0.4 }, { at: 0.7, lane: -0.4 }],
    pickups: [0.04, 0.12, 0.22, 0.32, 0.44, 0.56, 0.66, 0.78, 0.9],
    bolts: [{ at: 0.2, lane: 0.5, count: 6 }, { at: 0.6, lane: 0, count: 6 }, { at: 0.85, lane: -0.5, count: 6 }],
  },
  {
    id: 'road-canyon', name: 'Canyon Pass', world: 'canyon', laps: 1, width: 15, open: true, event: true,
    points: [[0, 0], [110, 50], [220, -10], [330, 60], [440, 0], [550, -60], [660, 0], [770, 70], [880, 10], [990, -50], [1100, 0]],
    jumps: [{ at: 0.4, len: 0.012, h: 2.6 }, { at: 0.75, len: 0.012, h: 2.6 }],
    boosts: [{ at: 0.1, lane: 0 }, { at: 0.55, lane: 0 }, { at: 0.9, lane: 0 }],
    pickups: [0.06, 0.2, 0.34, 0.5, 0.66, 0.82],
    bolts: [{ at: 0.3, lane: 0, count: 6 }, { at: 0.62, lane: 0.5, count: 6 }],
  },
  {
    id: 'road-horde', name: "Dementus's Trail", world: 'wasteland', laps: 1, width: 17, open: true, event: true,
    points: [[0, 0], [180, 30], [360, -40], [540, 30], [720, -30], [900, 40], [1080, -20], [1260, 30], [1440, 0]],
    jumps: [{ at: 0.3, len: 0.01, h: 2.4 }, { at: 0.66, len: 0.01, h: 2.4 }],
    boosts: [{ at: 0.12, lane: 0 }, { at: 0.5, lane: 0 }, { at: 0.84, lane: 0 }],
    pickups: [0.05, 0.18, 0.32, 0.46, 0.6, 0.74, 0.88],
    bolts: [{ at: 0.22, lane: 0, count: 6 }, { at: 0.58, lane: -0.5, count: 6 }],
  },
  {
    id: 'road-gigahorse', name: 'The Last Stretch', world: 'saltflats', laps: 1, width: 20, open: true, event: true,
    points: [[0, 0], [220, 40], [440, -30], [660, 40], [880, -40], [1100, 30], [1320, -30], [1540, 40], [1760, -20], [1980, 10]],
    boosts: [{ at: 0.2, lane: 0 }, { at: 0.5, lane: 0 }, { at: 0.8, lane: 0 }],
    pickups: [0.04, 0.12, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9],
    bolts: [{ at: 0.25, lane: 0, count: 6 }, { at: 0.65, lane: 0, count: 6 }],
  },

  // ---------------------------------------------------------------- loops
  {
    id: 'doof-loop', name: 'Doof Run', world: 'gastown', laps: 3, width: 16, event: true,
    points: [[0, -60], [100, -55], [160, -10], [130, 45], [40, 60], [-40, 40], [-110, 60], [-170, 10], [-120, -50]],
    boosts: [{ at: 0.05, lane: 0 }, { at: 0.18, lane: 0.4 }, { at: 0.3, lane: -0.4 }, { at: 0.45, lane: 0 }, { at: 0.6, lane: 0.4 }, { at: 0.75, lane: -0.4 }, { at: 0.9, lane: 0 }],
    pickups: [0.24, 0.66],
    bolts: [{ at: 0.1, lane: 0, count: 5 }, { at: 0.52, lane: 0.5, count: 5 }],
  },
  {
    id: 'refinery', name: 'Refinery Rumble', world: 'gastown', laps: 3, width: 15, event: true,
    points: [[0, -80], [90, -70], [134, -30], [120, 11], [138, 58], [90, 100], [0, 80], [-80, 100], [-138, 50], [-119, 0], [-133, -45], [-90, -80]],
    jumps: [{ at: 0.35, len: 0.02, h: 2.2 }],
    boosts: [{ at: 0.05, lane: 0 }, { at: 0.55, lane: 0 }],
    pickups: [0.2, 0.48, 0.8],
    bolts: [{ at: 0.12, lane: 0.5, count: 5 }, { at: 0.65, lane: 0, count: 5 }],
  },
  {
    id: 'storm-loop', name: 'Into the Storm', world: 'saltflats', laps: 3, width: 17, event: true,
    points: [[0, -90], [140, -70], [200, 0], [140, 70], [0, 90], [-140, 70], [-200, 0], [-140, -70]],
    jumps: [{ at: 0.6, len: 0.02, h: 2 }],
    boosts: [{ at: 0.1, lane: 0 }, { at: 0.35, lane: 0 }, { at: 0.85, lane: 0 }],
    pickups: [0.22, 0.5, 0.75],
    bolts: [{ at: 0.15, lane: 0, count: 5 }, { at: 0.42, lane: -0.5, count: 5 }, { at: 0.92, lane: 0.5, count: 5 }],
  },
  {
    id: 'bog-loop', name: 'The Bog', world: 'bog', laps: 3, width: 15, event: true,
    points: [[0, -70], [90, -90], [170, -40], [140, 30], [148, 80], [90, 110], [0, 70], [-90, 110], [-161, 59], [-130, 0], [-141, -50], [-90, -80]],
    goo: [{ at: 0.2, lane: 0.4, len: 0.04 }, { at: 0.5, lane: -0.4, len: 0.04 }, { at: 0.8, lane: 0.3, len: 0.04 }],
    boosts: [{ at: 0.05, lane: 0 }, { at: 0.65, lane: 0 }],
    pickups: [0.12, 0.38, 0.62, 0.9],
    bolts: [{ at: 0.3, lane: 0, count: 5 }, { at: 0.72, lane: -0.5, count: 5 }],
  },
  {
    id: 'plains-loop', name: 'Wasteland Rally', world: 'wasteland', laps: 3, width: 16, event: true,
    points: [[0, -80], [150, -90], [230, -20], [180, 60], [60, 80], [-60, 60], [-180, 90], [-240, 10], [-160, -70]],
    jumps: [{ at: 0.25, len: 0.02, h: 2.4 }, { at: 0.7, len: 0.02, h: 2.4 }],
    hills: [{ at: 0.5, len: 0.05, h: 2.5 }],
    boosts: [{ at: 0.05, lane: 0 }, { at: 0.4, lane: 0.4 }, { at: 0.85, lane: -0.4 }],
    pickups: [0.15, 0.45, 0.78],
    bolts: [{ at: 0.1, lane: 0, count: 5 }, { at: 0.6, lane: 0.5, count: 5 }],
  },
  {
    id: 'chariot-loop', name: "Dementus's Circle", world: 'wasteland', laps: 99, width: 18, event: true,
    points: [[0, -100], [160, -90], [240, 0], [160, 90], [0, 100], [-160, 90], [-240, 0], [-160, -90]],
    boosts: [{ at: 0.1, lane: 0 }, { at: 0.35, lane: 0 }, { at: 0.6, lane: 0 }, { at: 0.85, lane: 0 }],
    pickups: [0.05, 0.3, 0.55, 0.8],
  },
];
