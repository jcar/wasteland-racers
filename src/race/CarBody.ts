import type { CarStats } from '../systems/Economy';
import type { Ground } from './ground';
import type { TrackGeometry, TrackPos } from './trackGeometry';

/**
 * Arcade car physics on the ground plane, the same for the player and the
 * AI. Built to be forgiving: rubbery walls, gentle steering help, and a tow
 * drone that puts you back on the road when you get stuck.
 *
 * It drives on any `Ground`: race loops, roads, arenas or the Wasteland map.
 */
export interface DriveInput {
  /** -1 = left, +1 = right. */
  steer: number;
  /** 0..1 */
  gas: number;
  brake: boolean;
}

export type CarEvent = 'wall' | 'takeoff' | 'land' | 'tow' | 'lap' | 'finish' | 'spin' | 'boostpad' | 'hit' | 'wreck' | 'respawn';

const RADIUS = 1.25;
const GRAVITY = 30;
const WALL_BOUNCE = 0.35;
const TOW_TIME = 1.4;
const WRECK_TIME = 1.8;
const SHIELD_TIME = 2.2;
const BOOST_POWER = 1.45;

export class CarBody {
  x = 0;
  z = 0;
  y = 0;
  vy = 0;
  heading = 0;
  vx = 0;
  vz = 0;
  airborne = false;
  /** Seconds in the air so far (or of the last jump, once landed). */
  airTime = 0;
  /** Seconds of spin-out left. */
  spin = 0;
  spinDir = 1;
  /** Seconds of boost left. */
  boost = 0;
  /** Seconds the boing bumper stays out. */
  boing = 0;
  /** How much faster than top speed a boost goes (specials push it higher). */
  boostPower = BOOST_POWER;
  /** Hits left before wrecking (lore weapons only). */
  hp: number;
  /** Seconds left of tumbling after a wreck. */
  wrecked = 0;
  /** Seconds of not being hurt after respawning. */
  shield = 0;
  /** Seconds of chrome star power: can't be hurt, and ramming wrecks others. */
  star = 0;
  /** Seconds of spiked ramming (contact hurts others). */
  ram = 0;
  /** Short grace period after a hit, so one ram can't hit three times in three frames. */
  private recentHit = 0;
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
    this.hp = stats.maxHp;
  }

  /** Can't be hurt right now (respawn shield, star power, or busy being towed/wrecked). */
  get safe() {
    return this.shield > 0 || this.star > 0 || this.towing > 0 || this.wrecked > 0;
  }

  /**
   * A hit from a lore weapon: lose hit points and spin, or wreck at zero.
   * Returns what happened so the race can play the right effects.
   */
  hit(damage: number, spinTime: number): 'none' | 'hit' | 'wreck' {
    if (this.safe || this.recentHit > 0) return 'none';
    this.recentHit = 0.8;
    this.hp -= damage;
    if (this.hp <= 0) {
      this.wreck();
      return 'wreck';
    }
    this.startSpin(spinTime);
    this.events.push('hit');
    return 'hit';
  }

  wreck() {
    if (this.wrecked > 0 || this.towing > 0) return;
    this.wrecked = WRECK_TIME;
    this.spin = 0;
    this.boost = this.boing = this.ram = 0;
    this.vy = 9;
    this.airborne = true;
    this.events.push('wreck');
  }

  get speed() {
    return Math.hypot(this.vx, this.vz);
  }
  /** Speed along the way the car is pointing. */
  get forwardSpeed() {
    return this.vx * Math.cos(this.heading) + this.vz * Math.sin(this.heading);
  }
  /** Distance raced so far, used for positions. */
  progress(ground: Ground) {
    return this.lap * ground.lapLength + this.pos.s;
  }

  place(track: TrackGeometry, s: number, lateral: number) {
    const p = track.pointAt(s, lateral);
    this.x = p.x;
    this.z = p.z;
    this.y = p.h;
    this.heading = Math.atan2(p.tz, p.tx);
    this.vx = this.vz = this.vy = 0;
    this.pos = track.locate(this.x, this.z);
    this.prevS = undefined;
  }

  /** Put the car at a spot on any ground (arenas, the Wasteland). */
  placeAt(ground: Ground, x: number, z: number, heading: number) {
    this.x = x;
    this.z = z;
    this.heading = heading;
    this.vx = this.vz = this.vy = 0;
    this.pos = ground.locate(x, z, -1);
    this.y = this.pos.h;
    this.prevS = undefined;
  }

  startSpin(time: number) {
    if (this.towing > 0 || this.wrecked > 0 || this.star > 0 || this.shield > 0) return;
    this.spin = Math.max(this.spin, time);
    this.spinDir = Math.random() < 0.5 ? -1 : 1;
    this.events.push('spin');
  }

  step(dt: number, input: DriveInput, track: Ground, assist: number, laps: number) {
    if (this.towing > 0) return this.stepTow(dt, track);
    if (this.shield > 0) this.shield -= dt;
    if (this.star > 0) this.star -= dt;
    if (this.ram > 0) this.ram -= dt;
    if (this.recentHit > 0) this.recentHit -= dt;
    if (this.wrecked > 0) return this.stepWreck(dt, track, laps);
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
    const top = st.maxSpeed * (this.boost > 0 ? this.boostPower : 1) * (this.slowed ? 0.55 : 1);
    if (!this.airborne) {
      if (gas > 0 && fwd < top) fwd += st.accel * (this.boost > 0 ? 2.5 : 1) * gas * dt * (1 - Math.max(0, fwd) / (top * 1.05));
      else if (fwd > top) fwd += (top - fwd) * Math.min(1, 2.5 * dt);
      if (gas === 0) fwd *= 1 - 0.5 * dt;
      if (input.brake) fwd -= Math.sign(fwd) * Math.min(Math.abs(fwd), 28 * dt);
      side *= Math.exp(-st.grip * dt);
    }
    if (this.boost > 0) {
      this.boost -= dt;
      if (this.boost <= 0) this.boostPower = BOOST_POWER;
    }
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
  private applyAssist(dt: number, track: Ground, strength: number) {
    const ahead = track.assistTarget(this.pos, Math.abs(this.forwardSpeed), this.x, this.z);
    if (!ahead) return;
    const want = Math.atan2(ahead.z - this.z, ahead.x - this.x);
    let diff = want - this.heading;
    diff = Math.atan2(Math.sin(diff), Math.cos(diff));
    // Facing the wrong way is fixed faster.
    const rate = strength * (Math.abs(diff) > 1.6 ? 2 : 1);
    this.heading += Math.max(-rate * dt, Math.min(rate * dt, diff));
  }

  private collideWalls(track: Ground) {
    this.pos = track.locate(this.x, this.z, this.pos.i);
    // Two passes, so a car squeezed between a wall and an obstacle still gets out.
    for (let pass = 0; pass < 2; pass++) {
      const c = track.contain(this.x, this.z, this.pos, RADIUS);
      if (!c) return;
      this.x -= c.nx * c.over;
      this.z -= c.nz * c.over;
      const vn = this.vx * c.nx + this.vz * c.nz;
      if (vn > 0) {
        this.vx -= (1 + WALL_BOUNCE) * vn * c.nx;
        this.vz -= (1 + WALL_BOUNCE) * vn * c.nz;
        this.vx *= 0.92;
        this.vz *= 0.92;
        // Soft rubber walls: turn the car back along the road a bit.
        if (c.ax !== undefined && c.az !== undefined) {
          let diff = Math.atan2(c.az, c.ax) - this.heading;
          diff = Math.atan2(Math.sin(diff), Math.cos(diff));
          if (Math.abs(diff) < 2) this.heading += diff * 0.35;
        }
        if (vn > 4) {
          this.lastHit = vn;
          this.events.push('wall');
        }
      }
      this.pos = track.locate(this.x, this.z, this.pos.i);
    }
  }

  private updateHeight(dt: number) {
    const ground = this.pos.h;
    if (this.airborne) {
      this.airTime += dt;
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
      this.airTime = 0;
      this.vy = Math.min(this.vy, 12);
      this.y += this.vy * dt;
      this.events.push('takeoff');
      return;
    }
    this.vy = groundVy;
    this.y = ground;
  }

  private updateLap(track: Ground, laps: number) {
    const L = track.lapLength;
    if (!L) return;
    const prev = this.prevS;
    const s = this.pos.s;
    if (prev !== undefined) {
      if (s - prev < -L / 2) {
        this.lap++;
        this.events.push('lap');
        if (this.lap >= laps && !this.finished) {
          this.finished = true;
          this.events.push('finish');
        }
      } else if (s - prev > L / 2) this.lap--;
    }
    this.prevS = s;
  }
  private prevS: number | undefined;

  private checkStuck(dt: number, gas: number, track: Ground) {
    const fwd = this.forwardSpeed;
    const facing = Math.cos(this.heading) * this.pos.tx + Math.sin(this.heading) * this.pos.tz;
    this.stuck = gas > 0 && Math.abs(fwd) < 2.5 && this.spin <= 0 ? this.stuck + dt : 0;
    this.wrongWay = track.directional && facing < -0.3 && this.spin <= 0 ? this.wrongWay + dt : 0;
    if (this.stuck > 2 || this.wrongWay > 2.5) this.startTow(track);
  }

  /** Tumbling after a wreck, then back on the road with a shield. */
  private stepWreck(dt: number, track: Ground, laps: number) {
    this.wrecked -= dt;
    this.vx *= 1 - 2 * dt;
    this.vz *= 1 - 2 * dt;
    this.x += this.vx * dt;
    this.z += this.vz * dt;
    this.collideWalls(track);
    this.updateHeight(dt);
    this.updateLap(track, laps);
    if (this.wrecked > 0) return;
    this.wrecked = 0;
    const p = track.safeSpot(this.pos, 0, true, this.x, this.z, this.heading);
    this.x = p.x;
    this.z = p.z;
    this.y = p.h;
    this.vy = 0;
    this.airborne = false;
    this.heading = p.heading;
    this.vx = Math.cos(p.heading) * 6;
    this.vz = Math.sin(p.heading) * 6;
    this.hp = this.stats.maxHp;
    this.shield = SHIELD_TIME;
    this.pos = track.locate(this.x, this.z, this.pos.i);
    this.events.push('respawn');
  }

  startTow(track: Ground) {
    this.stuck = this.wrongWay = 0;
    this.towing = TOW_TIME;
    this.spin = 0;
    this.airborne = false;
    const p = track.safeSpot(this.pos, 4, false, this.x, this.z, this.heading);
    this.towFrom = { x: this.x, z: this.z, h: this.y };
    this.towTo = { x: p.x, z: p.z, h: p.h, heading: p.heading };
    this.events.push('tow');
  }

  private stepTow(dt: number, track: Ground) {
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
  if (d >= RADIUS * 2 || d === 0 || a.towing > 0 || b.towing > 0 || a.wrecked > 0 || b.wrecked > 0 || Math.abs(a.y - b.y) > 2) return 0;
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
