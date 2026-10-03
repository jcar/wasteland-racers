import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { trackById } from '../src/data/tracks';
import { CarBody } from '../src/race/CarBody';
import type { Effects } from '../src/race/effects';
import { TrackGeometry } from '../src/race/trackGeometry';
import { Weapons, type Arena, type Fighter } from '../src/race/weapons';
import { carStats } from '../src/systems/Economy';
import { freshSave } from '../src/systems/SaveManager';

const geo = new TrackGeometry(trackById('fury-1'));
const DT = 1 / 60;
const idle = { steer: 0, gas: 0, brake: false };

/** Effects draw sprites, which need a browser; these tests only care about the rules. */
const noEffects = new Proxy({}, { get: () => () => {} }) as unknown as Effects;

function fighter(s: number, lateral: number, gadget = 'boost', isPlayer = false): Fighter {
  const body = new CarBody(carStats(freshSave()), gadget);
  body.place(geo, s, lateral);
  return { body, gadget, isPlayer, cooldown: 0 };
}

function arena(fighters: Fighter[]): Arena & { hurts: string[] } {
  const hurts: string[] = [];
  return {
    fighters,
    player: fighters[0],
    scene: new THREE.Scene(),
    effects: noEffects,
    geo,
    hurts,
    near: () => false,
    progress: (f) => f.body.progress(geo),
    shake: () => {},
    hurt(target, _by, damage, spin) {
      hurts.push(`${target.body.id}:${target.body.hit(damage, spin)}`);
    },
  };
}

function run(w: Weapons, fighters: Fighter[], seconds: number) {
  for (let t = 0; t < seconds; t += DT) {
    for (const f of fighters) f.body.step(DT, idle, geo, 0, 99);
    w.update(DT);
  }
}

describe('wrecks', () => {
  it('three hits wreck a car, which respawns on the road with a shield', () => {
    const f = fighter(100, 0);
    expect(f.body.hp).toBe(3);
    for (let i = 0; i < 2; i++) {
      expect(f.body.hit(1, 0.5)).toBe('hit');
      for (let t = 0; t < 1; t += DT) f.body.step(DT, idle, geo, 0, 99); // wait out the hit grace period
    }
    expect(f.body.hit(1, 0.5)).toBe('wreck');
    expect(f.body.wrecked).toBeGreaterThan(0);
    for (let t = 0; t < 2; t += DT) f.body.step(DT, idle, geo, 0, 99);
    expect(f.body.wrecked).toBe(0);
    expect(f.body.hp).toBe(3);
    expect(f.body.shield).toBeGreaterThan(0);
    expect(Math.abs(f.body.pos.lateral)).toBeLessThan(geo.halfWidth);
    // Shielded: can't be hurt.
    expect(f.body.hit(5, 1)).toBe('none');
  });

  it('armor adds hit points', () => {
    const s = freshSave();
    s.upgrades.armor = 6;
    expect(carStats(s).maxHp).toBe(6);
  });

  it('one ram can only hurt once in a moment', () => {
    const f = fighter(100, 0);
    expect(f.body.hit(1, 0.5)).toBe('hit');
    expect(f.body.hit(1, 0.5)).toBe('none');
  });
});

describe('weapons', () => {
  it('a thunder stick flies ahead and hits the car in front', () => {
    const me = fighter(100, 0, 'thunder', true), them = fighter(125, 0);
    me.body.charges = 1;
    const a = arena([me, them]);
    const w = new Weapons(a);
    expect(w.fire(me)).toBe(true);
    expect(me.body.charges).toBe(0);
    run(w, [me, them], 1.5);
    expect(a.hurts).toContain(`${them.body.id}:hit`);
  });

  it('caltrops hurt whoever drives over them, but not the car that dropped them', () => {
    const me = fighter(100, 0, 'caltrops', true), them = fighter(90, 0, 'boost');
    me.body.charges = 1;
    const a = arena([me, them]);
    const w = new Weapons(a);
    w.fire(me);
    for (let t = 0; t < 3; t += DT) {
      them.body.step(DT, { steer: 0, gas: 1, brake: false }, geo, 2, 99);
      w.update(DT);
    }
    expect(a.hurts).toEqual([`${them.body.id}:hit`]);
  });

  it('stomp shoves away and hurts everyone close by', () => {
    const me = fighter(100, 0, 'stomp', true), near = fighter(106, 0), far = fighter(160, 0);
    me.body.charges = 1;
    const a = arena([me, near, far]);
    new Weapons(a).fire(me);
    expect(a.hurts).toEqual([`${near.body.id}:hit`]);
  });

  it('a harpoon needs something to hit, and keeps its charge otherwise', () => {
    const me = fighter(100, 0, 'harpoon', true), them = fighter(300, 0);
    me.body.charges = 1;
    const w = new Weapons(arena([me, them]));
    expect(w.fire(me)).toBe(false);
    expect(me.body.charges).toBe(1);
  });

  it('chrome star power wrecks what it rams and cannot be hurt', () => {
    const me = fighter(100, 0, 'witness', true), them = fighter(102, 0);
    me.body.charges = 1;
    const a = arena([me, them]);
    const w = new Weapons(a);
    w.fire(me);
    expect(me.body.star).toBeGreaterThan(0);
    expect(me.body.hit(9, 1)).toBe('none');
    w.contact(me, them);
    expect(a.hurts).toEqual([`${them.body.id}:hit`]);
  });

  it('blower and Double V8 boost harder than a normal rocket boost', () => {
    for (const g of ['blower', 'doublev8']) {
      const me = fighter(100, 0, g, true);
      me.body.charges = 1;
      new Weapons(arena([me])).fire(me);
      expect(me.body.boostPower).toBeGreaterThan(1.45);
    }
  });
});
