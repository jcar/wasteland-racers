import type { ArenaDef } from '../data/arenas';
import type { TrackPos } from './trackGeometry';

/**
 * What a car drives on. The same car physics runs on race loops, roads,
 * walled arenas and the open Wasteland map; each ground decides where the
 * walls are, how high the ground is, and where steer help points.
 */
export interface Contact {
  /** Direction into the wall (the car is pushed the other way). */
  nx: number;
  nz: number;
  /** How far the car is inside the wall. */
  over: number;
  /** Direction along the wall, used to turn the car back onto its way (optional). */
  ax?: number;
  az?: number;
}

export interface Ground {
  locate(x: number, z: number, hint: number): TrackPos;
  contain(x: number, z: number, pos: TrackPos, radius: number): Contact | undefined;
  /** Where steer help should aim, if anywhere. */
  assistTarget(pos: TrackPos, speed: number, x: number, z: number): { x: number; z: number } | undefined;
  /** Somewhere safe to put a stuck or wrecked car. */
  safeSpot(pos: TrackPos, ahead: number, keepLateral: boolean, x: number, z: number, heading: number): { x: number; z: number; h: number; heading: number };
  /** Lap length for lap counting; 0 when there are no laps. */
  readonly lapLength: number;
  /** Whether the ground has a "forward" (so facing backwards means wrong way). */
  readonly directional: boolean;
}

export interface Obstacle {
  x: number;
  z: number;
  r: number;
}

/** Bounce off round obstacles: returns the deepest overlap. */
function obstacleContact(x: number, z: number, radius: number, obstacles: Obstacle[]): Contact | undefined {
  let best: Contact | undefined;
  for (const o of obstacles) {
    const dx = o.x - x, dz = o.z - z, d = Math.hypot(dx, dz);
    const over = o.r + radius - d;
    if (over > 0 && d > 0 && (!best || over > best.over)) best = { nx: dx / d, nz: dz / d, over };
  }
  return best;
}

const flatPos = (h = 0): TrackPos => ({ i: 0, s: 0, lateral: 0, tx: 1, tz: 0, h });

/** A flat walled arena (circle or rectangle) with round obstacles. */
export class ArenaGround implements Ground {
  readonly lapLength = 0;
  readonly directional = false;
  readonly def: ArenaDef;
  readonly obstacles: Obstacle[];
  /** Where steer help aims (set by the event, e.g. the nearest fuel can). */
  aim?: (x: number, z: number) => { x: number; z: number } | undefined;

  constructor(def: ArenaDef) {
    this.def = def;
    this.obstacles = def.obstacles;
  }

  /** Half-size of the playable area. */
  get halfW() {
    return this.def.shape === 'circle' ? this.def.radius! : this.def.w! / 2;
  }
  get halfH() {
    return this.def.shape === 'circle' ? this.def.radius! : this.def.h! / 2;
  }

  locate() {
    return flatPos();
  }

  contain(x: number, z: number, _pos: TrackPos, radius: number): Contact | undefined {
    const hit = obstacleContact(x, z, radius, this.obstacles);
    if (hit) return hit;
    if (this.def.shape === 'circle') {
      const d = Math.hypot(x, z), over = d - (this.def.radius! - radius);
      if (over > 0 && d > 0) return { nx: x / d, nz: z / d, over };
      return undefined;
    }
    const ox = Math.abs(x) - (this.halfW - radius), oz = Math.abs(z) - (this.halfH - radius);
    if (ox > 0 && ox >= oz) return { nx: Math.sign(x), nz: 0, over: ox };
    if (oz > 0) return { nx: 0, nz: Math.sign(z), over: oz };
    return undefined;
  }

  assistTarget(_pos: TrackPos, _speed: number, x: number, z: number) {
    return this.aim?.(x, z);
  }

  /** Nudge toward the middle until clear of obstacles. */
  safeSpot(_pos: TrackPos, _ahead: number, _keep: boolean, x: number, z: number, heading: number) {
    let px = x * 0.8, pz = z * 0.8;
    for (let i = 0; i < 20 && obstacleContact(px, pz, 2, this.obstacles); i++) {
      px *= 0.85;
      pz *= 0.85;
      if (Math.hypot(px, pz) < 3) px += 8;
    }
    return { x: px, z: pz, h: 0, heading };
  }

  /** A random clear spot (for spawning cans and cars). */
  randomSpot(rand = Math.random, margin = 6): { x: number; z: number } {
    for (let i = 0; i < 50; i++) {
      const x = (rand() * 2 - 1) * (this.halfW - margin), z = (rand() * 2 - 1) * (this.halfH - margin);
      if (this.def.shape === 'circle' && Math.hypot(x, z) > this.def.radius! - margin) continue;
      if (!obstacleContact(x, z, 3, this.obstacles)) return { x, z };
    }
    return { x: 0, z: this.halfH * 0.5 };
  }
}

/** Smooth rolling dunes: a few sine waves, cheap and repeatable. */
export function duneHeight(x: number, z: number): number {
  return (
    Math.sin(x * 0.011 + 1.3) * Math.cos(z * 0.009 - 0.4) * 2.6 +
    Math.sin(x * 0.023 - z * 0.017 + 2.1) * 1.2 +
    Math.cos(z * 0.031 + x * 0.006) * 0.6
  );
}

/** The open Wasteland: rolling dunes, a square edge, and rocks and buildings to drive around. */
export class TerrainGround implements Ground {
  readonly lapLength = 0;
  readonly directional = false;
  readonly half: number;
  readonly obstacles: Obstacle[];
  /** Flattened areas (roads, landmark yards) as circles: inside them the ground is level. */
  readonly flats: { x: number; z: number; r: number }[];
  /** Big jump ramps: drive up `angle` for `len`, rising to `h`, then fly. */
  readonly ramps: { x: number; z: number; angle: number; len: number; w: number; h: number }[] = [];
  aim?: (x: number, z: number) => { x: number; z: number } | undefined;

  constructor(half: number, obstacles: Obstacle[], flats: { x: number; z: number; r: number }[] = []) {
    this.half = half;
    this.obstacles = obstacles;
    this.flats = flats;
  }

  heightAt(x: number, z: number): number {
    let h = duneHeight(x, z) + 2.5;
    // Level ground near landmarks and markers, fading out smoothly.
    for (const f of this.flats) {
      const d = Math.hypot(x - f.x, z - f.z);
      if (d < f.r * 1.6) h *= Math.min(1, Math.max(0, (d - f.r) / (f.r * 0.6)));
    }
    return h + this.rampHeight(x, z);
  }

  /** Extra height from any jump ramp at this spot. */
  rampHeight(x: number, z: number): number {
    for (const r of this.ramps) {
      const dx = x - r.x, dz = z - r.z;
      const u = dx * Math.cos(r.angle) + dz * Math.sin(r.angle);
      const v = -dx * Math.sin(r.angle) + dz * Math.cos(r.angle);
      if (u >= 0 && u < r.len && Math.abs(v) < r.w / 2) return r.h * (u / r.len) ** 2;
    }
    return 0;
  }

  locate(x: number, z: number) {
    return flatPos(this.heightAt(x, z));
  }

  contain(x: number, z: number, _pos: TrackPos, radius: number): Contact | undefined {
    const hit = obstacleContact(x, z, radius, this.obstacles);
    if (hit) return hit;
    const lim = this.half - radius;
    const ox = Math.abs(x) - lim, oz = Math.abs(z) - lim;
    if (ox > 0 && ox >= oz) return { nx: Math.sign(x), nz: 0, over: ox };
    if (oz > 0) return { nx: 0, nz: Math.sign(z), over: oz };
    return undefined;
  }

  assistTarget(_pos: TrackPos, _speed: number, x: number, z: number) {
    return this.aim?.(x, z);
  }

  safeSpot(_pos: TrackPos, _ahead: number, _keep: boolean, x: number, z: number, heading: number) {
    let px = x, pz = z;
    for (let i = 0; i < 30 && obstacleContact(px, pz, 3, this.obstacles); i++) {
      px += Math.cos(heading + Math.PI) * 4;
      pz += Math.sin(heading + Math.PI) * 4;
    }
    return { x: px, z: pz, h: this.heightAt(px, pz), heading };
  }
}
