import type { TrackDef } from '../data/tracks';
import type { Contact, Ground } from './ground';

/**
 * The shape of a track as numbers: the smoothed centerline sampled every
 * SPACING units, plus height and lookups. No Three.js here, so it runs in
 * tests and drives the physics; the meshes are built from it separately.
 */
export const SPACING = 1;

export interface Sample {
  x: number;
  z: number;
  /** Unit tangent (direction of travel). */
  tx: number;
  tz: number;
  /** Distance from the start line. */
  s: number;
  h: number;
  /** Turn per unit length (1 / radius). Signed: + turns right. */
  k: number;
}

export interface TrackPos {
  i: number;
  s: number;
  /** Signed distance from the centerline. + is to the left of travel. */
  lateral: number;
  tx: number;
  tz: number;
  h: number;
}

/** Centripetal Catmull-Rom point between p1 and p2 (never loops or overshoots). */
function catmull(p0: number[], p1: number[], p2: number[], p3: number[], t: number): [number, number] {
  const knot = (a: number[], b: number[]) => Math.max(1e-4, Math.sqrt(Math.hypot(b[0] - a[0], b[1] - a[1])));
  const t0 = 0, t1 = t0 + knot(p0, p1), t2 = t1 + knot(p1, p2), t3 = t2 + knot(p2, p3);
  const u = t1 + (t2 - t1) * t;
  const lerp = (a: number[], b: number[], ta: number, tb: number) => {
    const w = (u - ta) / (tb - ta);
    return [a[0] + (b[0] - a[0]) * w, a[1] + (b[1] - a[1]) * w];
  };
  const a1 = lerp(p0, p1, t0, t1), a2 = lerp(p1, p2, t1, t2), a3 = lerp(p2, p3, t2, t3);
  const b1 = lerp(a1, a2, t0, t2), b2 = lerp(a2, a3, t1, t3);
  const c = lerp(b1, b2, t1, t2);
  return [c[0], c[1]];
}

export class TrackGeometry implements Ground {
  readonly samples: Sample[] = [];
  readonly length: number;
  readonly halfWidth: number;
  readonly def: TrackDef;
  /** A road from start to finish rather than a loop. */
  readonly open: boolean;
  readonly directional = true;

  constructor(def: TrackDef) {
    this.def = def;
    this.halfWidth = def.width / 2;
    this.open = !!def.open;
    // 1. Dense points along the smoothed curve.
    const P = def.points;
    const n = P.length;
    const dense: [number, number][] = [];
    if (this.open) {
      // Roads: imaginary points past each end keep the curve straight there.
      const first = [2 * P[0][0] - P[1][0], 2 * P[0][1] - P[1][1]];
      const last = [2 * P[n - 1][0] - P[n - 2][0], 2 * P[n - 1][1] - P[n - 2][1]];
      const at = (i: number) => (i < 0 ? first : i >= n ? last : P[i]);
      for (let i = 0; i < n - 1; i++) for (let j = 0; j < 60; j++) dense.push(catmull(at(i - 1), at(i), at(i + 1), at(i + 2), j / 60));
      dense.push([P[n - 1][0], P[n - 1][1]]);
    } else {
      for (let i = 0; i < n; i++) {
        const p0 = P[(i - 1 + n) % n], p1 = P[i], p2 = P[(i + 1) % n], p3 = P[(i + 2) % n];
        for (let j = 0; j < 60; j++) dense.push(catmull(p0, p1, p2, p3, j / 60));
      }
      dense.push(dense[0]);
    }
    const cum = [0];
    for (let i = 1; i < dense.length; i++) cum.push(cum[i - 1] + Math.hypot(dense[i][0] - dense[i - 1][0], dense[i][1] - dense[i - 1][1]));
    const total = cum[cum.length - 1];

    // 2. Resample evenly by distance. Roads keep a sample at both ends.
    const steps = Math.round(total / SPACING);
    this.length = steps * SPACING;
    const count = this.open ? steps + 1 : steps;
    let seg = 0;
    const pts: [number, number][] = [];
    for (let i = 0; i < count; i++) {
      const d = Math.min(total, (i / steps) * total);
      while (seg < cum.length - 2 && cum[seg + 1] < d) seg++;
      const w = (d - cum[seg]) / (cum[seg + 1] - cum[seg] || 1);
      pts.push([dense[seg][0] + (dense[seg + 1][0] - dense[seg][0]) * w, dense[seg][1] + (dense[seg + 1][1] - dense[seg][1]) * w]);
    }

    // 3. Tangents, curvature and height.
    for (let i = 0; i < count; i++) {
      const a = pts[this.idx(i - 1, count)], b = pts[this.idx(i + 1, count)];
      const dx = b[0] - a[0], dz = b[1] - a[1];
      const len = Math.hypot(dx, dz) || 1;
      this.samples.push({ x: pts[i][0], z: pts[i][1], tx: dx / len, tz: dz / len, s: i * SPACING, h: 0, k: 0 });
    }
    for (let i = 0; i < count; i++) {
      const a = this.samples[this.idx(i - 2, count)], b = this.samples[this.idx(i + 2, count)];
      let da = Math.atan2(b.tz, b.tx) - Math.atan2(a.tz, a.tx);
      da = Math.atan2(Math.sin(da), Math.cos(da));
      this.samples[i].k = da / (4 * SPACING);
      this.samples[i].h = this.heightAt(i * SPACING);
    }
  }

  /** Sample index: loops wrap around, roads stop at the ends. */
  private idx(i: number, n = this.samples.length) {
    return this.open ? Math.max(0, Math.min(n - 1, i)) : ((i % n) + n) % n;
  }

  /** Distance along the track: loops wrap around, roads stay between start and finish. */
  wrap(s: number) {
    return this.open ? Math.max(0, Math.min(this.length, s)) : ((s % this.length) + this.length) % this.length;
  }

  /** Road height at a distance along the lap. */
  heightAt(s: number): number {
    const f = this.wrap(s) / this.length;
    let h = 0;
    // How far past `start` we are, as a fraction of the lap (wraps past the start line).
    const since = (start: number) => f - start - Math.floor(f - start);
    for (const hill of this.def.hills ?? []) {
      const u = since(hill.at - hill.len / 2) / hill.len;
      if (u < 1) h += hill.h * 0.5 * (1 - Math.cos(u * Math.PI * 2));
    }
    for (const j of this.def.jumps ?? []) {
      const u = since(j.at) / j.len;
      if (u < 1) h += j.h * u * u; // rises steeper and steeper, then drops off: that's the jump
    }
    return h;
  }

  /** True on (or just past the end of) a jump ramp, as opposed to a hill. */
  onJump(s: number): boolean {
    const f = this.wrap(s) / this.length;
    return (this.def.jumps ?? []).some((j) => {
      const d = f - j.at - Math.floor(f - j.at);
      return d < j.len + 4 / this.length;
    });
  }

  /** Interpolated point on the centerline, pushed sideways by `lateral`. */
  pointAt(s: number, lateral = 0): { x: number; z: number; tx: number; tz: number; h: number } {
    const w = this.wrap(s) / SPACING;
    const i = Math.floor(w);
    const a = this.samples[this.idx(i)], b = this.samples[this.idx(i + 1)];
    const t = w - i;
    const tx = a.tx + (b.tx - a.tx) * t, tz = a.tz + (b.tz - a.tz) * t;
    const tl = Math.hypot(tx, tz) || 1;
    const x = a.x + (b.x - a.x) * t, z = a.z + (b.z - a.z) * t;
    // Left of travel is (tz, -tx).
    return { x: x + (tz / tl) * lateral, z: z - (tx / tl) * lateral, tx: tx / tl, tz: tz / tl, h: this.heightAt(s) };
  }

  /**
   * Where a point is relative to the track. Pass the last index as `hint` to
   * search only nearby (cars never move far in one frame); -1 searches all.
   */
  locate(x: number, z: number, hint = -1): TrackPos {
    const S = this.samples, n = S.length;
    let best = 0, bestD = Infinity;
    const scan = (i: number) => {
      const j = this.idx(i, n);
      const p = S[j];
      const d = (p.x - x) ** 2 + (p.z - z) ** 2;
      if (d < bestD) { bestD = d; best = j; }
    };
    if (hint < 0) for (let i = 0; i < n; i++) scan(i);
    else for (let i = hint - 30; i <= hint + 30; i++) scan(i);
    // Project onto the segment toward whichever neighbor is closer.
    const p = S[best];
    const along = (x - p.x) * p.tx + (z - p.z) * p.tz;
    const s = this.wrap(p.s + along);
    const q = this.pointAt(s);
    const lateral = (x - q.x) * q.tz - (z - q.z) * q.tx;
    return { i: best, s, lateral, tx: q.tx, tz: q.tz, h: q.h };
  }

  /** The sharpest turn in the next `dist` units (for AI braking). */
  maxCurveAhead(s: number, dist: number): number {
    let k = 0;
    const start = Math.floor(this.wrap(s) / SPACING);
    for (let i = 0; i < dist / SPACING; i += 2) k = Math.max(k, Math.abs(this.samples[this.idx(start + i)].k));
    return k;
  }

  // ------------------------------------------------------------------ Ground

  get lapLength() {
    return this.open ? 0 : this.length;
  }

  /** Rubber walls along both edges, and end walls on a road. */
  contain(_x: number, _z: number, pos: TrackPos, radius: number): Contact | undefined {
    const over = Math.abs(pos.lateral) - (this.halfWidth - radius);
    if (over > 0) {
      const side = Math.sign(pos.lateral);
      return { nx: pos.tz * side, nz: -pos.tx * side, over, ax: pos.tx, az: pos.tz };
    }
    if (this.open && pos.s < 1) return { nx: -pos.tx, nz: -pos.tz, over: 1 - pos.s, ax: pos.tx, az: pos.tz };
    if (this.open && pos.s > this.length - 1) return { nx: pos.tx, nz: pos.tz, over: pos.s - (this.length - 1), ax: pos.tx, az: pos.tz };
    return undefined;
  }

  /** Steer help aims a little way down the road, drifting toward the middle. */
  assistTarget(pos: TrackPos, speed: number) {
    return this.pointAt(pos.s + 8 + speed * 0.35, pos.lateral * 0.7);
  }

  /** Back on the road a little ahead, near where you were. */
  safeSpot(pos: TrackPos, ahead: number, keepLateral: boolean) {
    const p = this.pointAt(Math.min(this.open ? this.length - 2 : Infinity, pos.s + ahead), keepLateral ? Math.max(-2, Math.min(2, pos.lateral)) : 0);
    return { x: p.x, z: p.z, h: p.h, heading: Math.atan2(p.tz, p.tx) };
  }
}
