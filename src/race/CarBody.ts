import type { CarStats } from '../systems/Economy';
import type { TrackGeometry, TrackPos } from './trackGeometry';

/**
 * Arcade car physics on the ground plane, the same for the player and the
 * AI. Built to be forgiving: rubbery walls, gentle steering help, and a tow
 * drone that puts you back on the road when you get stuck.
 */
export interface DriveInput {
  /** -1 = left, +1 = right. */
  steer: number;
  /** 0..1 */
  gas: number;
  brake: boolean;
}

export type CarEvent = 'wall' | 'land' | 'tow' | 'lap' | 'finish' | 'spin' | 'boostpad';

const RADIUS = 1.25;
const GRAVITY = 30;
const WALL_BOUNCE = 0.35;
const TOW_TIME = 1.4;

export class CarBody {
  x = 0;
  z = 0;
  y = 0;
  vy = 0;
  heading = 0;
  vx = 0;
  vz = 0;
  airborne = false;
  /** Seconds of spin-out left. */
  spin = 0;
  spinDir = 1;
  /** Seconds of boost left. */
  boost = 0;
  /** Seconds the boing bumper stays out. */
  boing = 0;
  /** Slowed by goo this frame. */
  slowed = false;
  towing = 0;
  private towFrom = { x: 0, z: 0, h: 0 };
  private towTo = { x: 0, z: 0, h: 0, heading: 0 };
  private stuck = 0;
  private wrongWay = 0;
  pos: TrackPos = { i: 0, s: 0, lateral: 0, tx: 1, tz: 0, h: 0 };
  lap = -1;
  finished = false;
  finishTime = 0;
  charges = 0;
  bolts = 0;
  events: CarEvent[] = [];
  /** Impact speed of the last wall hit, for sounds. */
  lastHit = 0;

  stats: CarStats;
  readonly id: string;

  constructor(stats: CarStats, id: string) {
    this.stats = stats;
    this.id = id;
  }

  get speed() {
    return Math.hypot(this.vx, this.vz);
  }
  /** Speed along the way the car is pointing. */
  get forwardSpeed() {
    return this.vx * Math.cos(this.heading) + this.vz * Math.sin(this.heading);
  }
  /** Distance raced so far, used for positions. */
  progress(track: TrackGeometry) {
    return this.lap * track.length + this.pos.s;
  }

  place(track: TrackGeometry, s: number, lateral: number) {
    const p = track.pointAt(s, lateral);
    this.x = p.x;
    this.z = p.z;
    this.y = p.h;
    this.heading = Math.atan2(p.tz, p.tx);
    this.vx = this.vz = this.vy = 0;
    this.pos = track.locate(this.x, this.z);
  }

  startSpin(time: number) {
    if (this.towing > 0) return;
    this.spin = Math.max(this.spin, time);
    this.spinDir = Math.random() < 0.5 ? -1 : 1;
    this.events.push('spin');
  }

  step(dt: number, input: DriveInput, track: TrackGeometry, assist: number, laps: number) {
    if (this.towing > 0) return this.stepTow(dt, track);
    const st = this.stats;
    const fx = Math.cos(this.heading), fz = Math.sin(this.heading);
    // Left of travel is (fz, -fx); we keep the sideways part as "side".
    let fwd = this.vx * fx + this.vz * fz;
    let side = this.vx * fz - this.vz * fx;

    let steer = input.steer, gas = input.gas;
    if (this.spin > 0) {
      this.spin -= dt;
      this.heading += this.spinDir * 11 * dt;
      steer = 0;
      gas = 0;
      fwd *= 1 - 1.6 * dt;
    }

    // Steering: a little even when slow, so you can always turn away from a wall.
    if (!this.airborne && this.spin <= 0) {
      const turnScale = Math.min(1, Math.max(0.4, Math.abs(fwd) / 8)) * Math.sign(fwd || 1);
      this.heading += steer * st.turn * turnScale * dt;
      if (steer === 0 && assist > 0) this.applyAssist(dt, track, assist);
    }

    // Engine.
    const top = st.maxSpeed * (this.boost > 0 ? 1.45 : 1) * (this.slowed ? 0.55 : 1);
    if (!this.airborne) {
      if (gas > 0 && fwd < top) fwd += st.accel * (this.boost > 0 ? 2.5 : 1) * gas * dt * (1 - Math.max(0, fwd) / (top * 1.05));
      else if (fwd > top) fwd += (top - fwd) * Math.min(1, 2.5 * dt);
      if (gas === 0) fwd *= 1 - 0.5 * dt;
      if (input.brake) fwd -= Math.sign(fwd) * Math.min(Math.abs(fwd), 28 * dt);
      side *= Math.exp(-st.grip * dt);
    }
    if (this.boost > 0) this.boost -= dt;
    if (this.boing > 0) this.boing -= dt;

    const nfx = Math.cos(this.heading), nfz = Math.sin(this.heading);
    this.vx = nfx * fwd + nfz * side;
    this.vz = nfz * fwd - nfx * side;
    this.x += this.vx * dt;
    this.z += this.vz * dt;

    this.collideWalls(track);
    this.updateHeight(dt);
    this.updateLap(track, laps);
    this.checkStuck(dt, gas, track);
  }

  /** Gently point the car down the road when nobody is steering. */
  private applyAssist(dt: number, track: TrackGeometry, strength: number) {
    const ahead = track.pointAt(this.pos.s + 8 + Math.abs(this.forwardSpeed) * 0.35, this.pos.lateral * 0.7);
    const want = Math.atan2(ahead.z - this.z, ahead.x - this.x);
    let diff = want - this.heading;
    diff = Math.atan2(Math.sin(diff), Math.cos(diff));
    // Facing the wrong way is fixed faster.
    const rate = strength * (Math.abs(diff) > 1.6 ? 2 : 1);
    this.heading += Math.max(-rate * dt, Math.min(rate * dt, diff));
  }

  private collideWalls(track: TrackGeometry) {
    this.pos = track.locate(this.x, this.z, this.pos.i);
    const limit = track.halfWidth - RADIUS;
    const over = Math.abs(this.pos.lateral) - limit;
    if (over <= 0) return;
    const side = Math.sign(this.pos.lateral);
    // Left normal of the road.
    const nx = this.pos.tz * side, nz = -this.pos.tx * side;
    this.x -= nx * over;
    this.z -= nz * over;
    const vn = this.vx * nx + this.vz * nz;
    if (vn > 0) {
      this.vx -= (1 + WALL_BOUNCE) * vn * nx;
      this.vz -= (1 + WALL_BOUNCE) * vn * nz;
      this.vx *= 0.92;
      this.vz *= 0.92;
      // Soft rubber walls: turn the car back along the road a bit.
      const along = Math.atan2(this.pos.tz, this.pos.tx);
      let diff = along - this.heading;
      diff = Math.atan2(Math.sin(diff), Math.cos(diff));
      if (Math.abs(diff) < 2) this.heading += diff * 0.35;
      if (vn > 4) {
        this.lastHit = vn;
        this.events.push('wall');
      }
    }
    this.pos = track.locate(this.x, this.z, this.pos.i);
  }

  private updateHeight(dt: number) {
    const ground = this.pos.h;
    if (this.airborne) {
      this.vy -= GRAVITY * dt;
      this.y += this.vy * dt;
      if (this.y <= ground) {
        this.y = ground;
        this.vy = 0;
        this.airborne = false;
        this.events.push('land');
      }
      return;
    }
    // On the ground: follow it, and take off if it drops away faster than gravity.
    const groundVy = (ground - this.y) / Math.max(dt, 1e-3);
    if (groundVy < this.vy - GRAVITY * dt * 1.5 && this.vy > 2) {
      this.airborne = true;
      this.vy = Math.min(this.vy, 12);
      this.y += this.vy * dt;
      return;
    }
    this.vy = groundVy;
    this.y = ground;
  }

  private updateLap(track: TrackGeometry, laps: number) {
    const prev = this.prevS;
    const s = this.pos.s;
    if (prev !== undefined) {
      if (s - prev < -track.length / 2) {
        this.lap++;
        this.events.push('lap');
        if (this.lap >= laps && !this.finished) {
          this.finished = true;
          this.events.push('finish');
        }
      } else if (s - prev > track.length / 2) this.lap--;
    }
    this.prevS = s;
  }
  private prevS: number | undefined;

  private checkStuck(dt: number, gas: number, track: TrackGeometry) {
    const fwd = this.forwardSpeed;
    const facing = Math.cos(this.heading) * this.pos.tx + Math.sin(this.heading) * this.pos.tz;
    this.stuck = gas > 0 && Math.abs(fwd) < 2.5 && this.spin <= 0 ? this.stuck + dt : 0;
    this.wrongWay = facing < -0.3 && this.spin <= 0 ? this.wrongWay + dt : 0;
    if (this.stuck > 2 || this.wrongWay > 2.5) this.startTow(track);
  }

  startTow(track: TrackGeometry) {
    this.stuck = this.wrongWay = 0;
    this.towing = TOW_TIME;
    this.spin = 0;
    this.airborne = false;
    const s = this.pos.s + 4;
    const p = track.pointAt(s, 0);
    this.towFrom = { x: this.x, z: this.z, h: this.y };
    this.towTo = { x: p.x, z: p.z, h: p.h, heading: Math.atan2(p.tz, p.tx) };
    this.events.push('tow');
  }

  private stepTow(dt: number, track: TrackGeometry) {
    this.towing -= dt;
    const t = 1 - Math.max(0, this.towing) / TOW_TIME;
    const ease = t * t * (3 - 2 * t);
    this.x = this.towFrom.x + (this.towTo.x - this.towFrom.x) * ease;
    this.z = this.towFrom.z + (this.towTo.z - this.towFrom.z) * ease;
    const lift = Math.sin(t * Math.PI) * 5;
    this.y = this.towFrom.h + (this.towTo.h - this.towFrom.h) * ease + lift;
    let diff = this.towTo.heading - this.heading;
    diff = Math.atan2(Math.sin(diff), Math.cos(diff));
    this.heading += diff * Math.min(1, dt * 5);
    this.vx = this.vz = this.vy = 0;
    this.pos = track.locate(this.x, this.z, this.pos.i);
    this.prevS = this.pos.s;
    if (this.towing <= 0) {
      this.towing = 0;
      this.heading = this.towTo.heading;
      this.y = this.towTo.h;
      this.vx = Math.cos(this.heading) * 6;
      this.vz = Math.sin(this.heading) * 6;
    }
  }
}

/** Bump two cars apart. Heavier cars shove lighter ones. Returns impact speed. */
export function collideCars(a: CarBody, b: CarBody): number {
  const dx = b.x - a.x, dz = b.z - a.z;
  const d = Math.hypot(dx, dz);
  if (d >= RADIUS * 2 || d === 0 || a.towing > 0 || b.towing > 0 || Math.abs(a.y - b.y) > 2) return 0;
  const nx = dx / d, nz = dz / d;
  const ma = a.stats.mass, mb = b.stats.mass;
  const overlap = RADIUS * 2 - d;
  a.x -= nx * overlap * (mb / (ma + mb));
  a.z -= nz * overlap * (mb / (ma + mb));
  b.x += nx * overlap * (ma / (ma + mb));
  b.z += nz * overlap * (ma / (ma + mb));
  const rel = (a.vx - b.vx) * nx + (a.vz - b.vz) * nz;
  if (rel <= 0) return 0;
  const j = (1.4 * rel) / (1 / ma + 1 / mb);
  a.vx -= (j / ma) * nx;
  a.vz -= (j / ma) * nz;
  b.vx += (j / mb) * nx;
  b.vz += (j / mb) * nz;
  return rel;
}
