import type { CarBody, DriveInput } from './CarBody';
import type { TrackGeometry } from './trackGeometry';

/**
 * Drives a car around the track: follows its own lane, slows for sharp
 * corners, and rubber-bands so the pack stays near the player. That keeps
 * races exciting, and a win is always within reach.
 */
export class AIDriver {
  private t = Math.random() * 100;
  /** Which part of the road to hold: -1 left edge .. 1 right edge. Modes can steer this. */
  lane: number;
  gadgetCooldown = 4 + Math.random() * 4;

  constructor(
    private readonly car: CarBody,
    /** Top speed before rubber-banding. */
    public baseSpeed: number,
    lane: number,
  ) {
    this.lane = lane;
  }

  think(dt: number, track: TrackGeometry, playerProgress: number | undefined): DriveInput {
    const car = this.car;
    this.t += dt;
    const hw = track.halfWidth - 2.5;
    const lane = Math.max(-hw, Math.min(hw, this.lane * hw + Math.sin(this.t * 0.35) * 2));
    const speed = Math.max(0, car.forwardSpeed);
    const target = track.pointAt(car.pos.s + 7 + speed * 0.45, lane);
    let diff = Math.atan2(target.z - car.z, target.x - car.x) - car.heading;
    diff = Math.atan2(Math.sin(diff), Math.cos(diff));
    const steer = Math.max(-1, Math.min(1, diff * 2.2));

    // Rubber band: ease off when well ahead of the player, push when behind.
    let rubber = 1;
    if (playerProgress !== undefined) {
      const gap = car.progress(track) - playerProgress;
      rubber = gap > 0 ? 1 - 0.14 * Math.min(1, gap / 60) : 1 + 0.1 * Math.min(1, -gap / 80);
    }
    // Brake for sharp corners ahead.
    const k = track.maxCurveAhead(car.pos.s, 12 + speed * 0.8);
    const cornerSpeed = k > 0 ? Math.sqrt(26 / k) : Infinity;
    const want = Math.min(this.baseSpeed * rubber, cornerSpeed);
    car.stats.maxSpeed = this.baseSpeed * rubber;
    return { steer, gas: speed < want ? 1 : 0, brake: speed > want + 4 };
  }
}
