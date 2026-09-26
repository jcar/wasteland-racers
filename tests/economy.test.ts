import { describe, expect, it } from 'vitest';
import { CARS, UPGRADE_STATS } from '../src/data/cars';
import { TRACKS, TRACK_ORDER } from '../src/data/tracks';
import { WORLDS } from '../src/data/worlds';
import { freshSave, type SaveData } from '../src/systems/SaveManager';
import { aiSpeed, buyCar, buyUpgrade, carStats, isTrackUnlocked, recordResult, upgradeCost, PLACE_REWARD } from '../src/systems/Economy';

/** Spend like a kid who always wants to go faster: cheapest speed gain first. */
function shopForSpeed(s: SaveData) {
  for (;;) {
    const options: { cost: number; gain: number; buy: () => void }[] = [];
    const c = upgradeCost(s.upgrades.engine);
    if (c !== undefined) options.push({ cost: c, gain: 2, buy: () => buyUpgrade(s, 'engine') });
    for (const car of CARS) if (!s.ownedCars.includes(car.id)) {
      const gain = car.speed - CARS.find((x) => x.id === s.car)!.speed;
      if (gain > 0) options.push({ cost: car.price, gain, buy: () => buyCar(s, car.id) });
    }
    const affordable = options.filter((o) => o.cost <= s.scrap).sort((a, b) => a.cost / a.gain - b.cost / b.gain);
    if (!affordable.length) return;
    affordable[0].buy();
  }
}

describe('economy', () => {
  it('every place earns something', () => {
    for (let p = 1; p <= 4; p++) {
      const s = freshSave();
      expect(recordResult(s, 'dunes-1', p, 0).total).toBeGreaterThan(0);
      expect(s.scrap).toBe(PLACE_REWARD[p - 1] + (p === 1 ? 50 : 0));
    }
  });

  it('winning opens the next track, losing never locks anything', () => {
    const s = freshSave();
    expect(isTrackUnlocked(s, TRACK_ORDER[1])).toBe(false);
    recordResult(s, TRACK_ORDER[0], 3, 0);
    expect(isTrackUnlocked(s, TRACK_ORDER[1])).toBe(false);
    recordResult(s, TRACK_ORDER[0], 1, 0);
    expect(isTrackUnlocked(s, TRACK_ORDER[1])).toBe(true);
    recordResult(s, TRACK_ORDER[0], 4, 0);
    expect(isTrackUnlocked(s, TRACK_ORDER[1])).toBe(true);
    expect(s.best[TRACK_ORDER[0]]).toBe(1);
  });

  it('you can win every track in order, and each world gives a reward', () => {
    const s = freshSave();
    for (const id of TRACK_ORDER) {
      expect(isTrackUnlocked(s, id)).toBe(true);
      recordResult(s, id, 1, 0);
    }
    expect(s.rewards.sort()).toEqual(WORLDS.filter((w) => w.reward).map((w) => w.reward!).sort());
    expect(s.pendingCelebrations).toContain('champion');
  });

  it('a kid who always comes last can still afford a car fast enough for every track', () => {
    const s = freshSave();
    let races = 0;
    for (const t of TRACKS) {
      let here = 0;
      // Rubber-banding lets a car slightly slower than the pack still win.
      while (carStats(s).maxSpeed < aiSpeed(t.id, 'normal') - 0.5) {
        recordResult(s, t.id, 4, 0);
        shopForSpeed(s);
        here++;
        races++;
        expect(here, `stuck grinding on ${t.id}`).toBeLessThanOrEqual(5);
      }
      recordResult(s, t.id, 1, 0);
      shopForSpeed(s);
    }
    expect(races).toBeLessThan(40);
  });

  it('upgrades cost scrap and stop at the top', () => {
    const s = freshSave();
    expect(buyUpgrade(s, 'engine')).toBe('broke');
    s.scrap = 10_000;
    for (const st of UPGRADE_STATS) for (let i = 0; i < 4; i++) expect(buyUpgrade(s, st.id)).toBe('ok');
    expect(buyUpgrade(s, 'engine')).toBe('maxed');
    expect(carStats(s).maxSpeed).toBe(28);
  });

  it('buying a car gives you its gadget', () => {
    const s = freshSave();
    s.scrap = 1000;
    expect(buyCar(s, 'hopper')).toBe('ok');
    expect(s.ownedGadgets).toContain('goo');
    expect(s.gadget).toBe('goo');
    expect(buyCar(s, 'buggy')).toBe('owned');
    expect(s.car).toBe('buggy');
  });
});
