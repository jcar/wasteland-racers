import { WAR_BOYS, type Racer } from '../data/characters';
import { crewById } from '../data/crew';
import type { CarBody, DriveInput } from '../race/CarBody';
import type { Entry, EventScene } from '../race/EventScene';
import { foes } from '../race/weapons';
import { carStats, crewLevel } from '../systems/Economy';
import { state } from '../systems/GameState';

/**
 * Bits every Season 2 mode shares: filling the road with War Boys (or
 * Dementus's horde), steering toward a point in open ground, and stars.
 */

/** Dementus's biker horde, for chapter 5. */
const HORDE: Racer[] = [
  { id: 'biker', name: 'Horde Biker', portrait: 'char-dementus', emoji: '🏍️', color: '#b8281e', body: 'nuxcar', head: { skin: '#e2b48c', hat: '#3a2a1e', kind: 'dementus' }, skill: 0.2 },
  { id: 'octoboss', name: 'The Octoboss', portrait: 'char-dementus', emoji: '🐙', color: '#5a2a6a', body: 'buzzard', head: { skin: '#d9a77e', hat: '#1c1c1c', kind: 'max' }, skill: 0.5 },
];

/** `n` raiders with unique ids (War Boys, or the horde in chapter 5). */
export function raiders(n: number, chapter: number, prefix: string): Racer[] {
  const pool = chapter === 5 ? [...HORDE, WAR_BOYS[0]] : WAR_BOYS;
  return Array.from({ length: n }, (_, i) => {
    const r = pool[i % pool.length];
    return { ...r, id: `${prefix}${i}-${r.id}` };
  });
}

/** What weapon each kind of raider carries. */
export function raiderGadget(r: Racer): string {
  if (r.id.includes('morsov') || r.id.includes('corpus')) return 'thunder';
  if (r.id.includes('ace') || r.id.includes('octoboss')) return 'harpoon';
  return 'caltrops';
}

/** 3 stars for never being wrecked, 2 for once, 1 otherwise. */
export const starsForWrecks = (timesWrecked: number) => (timesWrecked === 0 ? 3 : timesWrecked === 1 ? 2 : 1);

/** Steer toward a point on open ground (arenas, the Wasteland). */
export function steerToward(b: CarBody, x: number, z: number, speedLimit = Infinity): DriveInput {
  let diff = Math.atan2(z - b.z, x - b.x) - b.heading;
  diff = Math.atan2(Math.sin(diff), Math.cos(diff));
  const fwd = b.forwardSpeed;
  const sharp = Math.abs(diff) > 1.2;
  return {
    steer: Math.max(-1, Math.min(1, diff * 2.5)),
    gas: fwd < speedLimit && !(sharp && fwd > 14) ? 1 : 0,
    brake: sharp && fwd > 18,
  };
}

/**
 * Bring the riding crew into an event, on the player's team. On a track they
 * keep pace beside you; in open ground they go after the nearest enemy.
 */
export function addCrew(core: EventScene, place: (e: Entry, i: number) => void) {
  const s = state.data;
  core.player.team = 'player';
  s.crewRiding.forEach((id, i) => {
    const c = crewById(id);
    const lvl = crewLevel(s, id);
    const stats = carStats({ car: c.body, upgrades: { engine: 0, tires: lvl, armor: lvl * 2, gadget: 0 } });
    stats.maxSpeed = core.player.body.stats.maxSpeed * (0.88 + 0.04 * lvl);
    stats.accel = Math.max(stats.accel, 16);
    const e = core.addRacer(
      { id: `crew-${id}`, name: c.name, portrait: c.portrait, emoji: c.emoji, color: c.color, isPlayer: false },
      { body: c.body, paint: c.color, upgrades: { engine: lvl + 1, tires: lvl + 1, armor: lvl + 1, gadget: 0 }, head: c.head },
      c.gadget,
      stats,
    );
    e.team = 'player';
    e.armed = true;
    e.body.charges = 1;
    e.cooldown = 3 + i * 2;
    place(e, i);
    const geo = core.mode.geo;
    if (geo) {
      const ai = core.driveOnTrack(e, stats.maxSpeed, i ? -0.55 : 0.55, false);
      e.brain = (dt) => ai.think(dt, geo, core.progress(core.player) + (i ? -5 : 5));
    } else e.brain = () => followOrFight(core, e, i);
  });
}

/** Open-ground crew AI: chase the nearest enemy, or tag along behind the player. */
function followOrFight(core: EventScene, e: Entry, i: number): DriveInput {
  const b = e.body, p = core.player.body;
  let target: Entry | undefined, best = 50;
  for (const o of core.fighters) {
    if (!foes(e, o) || o.body.wrecked > 0) continue;
    const d = Math.hypot(o.body.x - b.x, o.body.z - b.z);
    if (d < best) { best = d; target = o; }
  }
  if (target) return steerToward(b, target.body.x, target.body.z);
  const side = i ? -1 : 1;
  const fx = Math.cos(p.heading), fz = Math.sin(p.heading);
  const tx = p.x - fx * 7 + fz * 5 * side, tz = p.z - fz * 7 - fx * 5 * side;
  if (Math.hypot(tx - b.x, tz - b.z) < 5) return { steer: 0, gas: 0, brake: Math.abs(b.forwardSpeed) > 4 };
  return steerToward(b, tx, tz);
}
