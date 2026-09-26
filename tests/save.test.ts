import { describe, expect, it } from 'vitest';
import { SaveManager, freshSave, migrate, SAVE_KEY } from '../src/systems/SaveManager';

class MemoryStorage {
  data = new Map<string, string>();
  getItem(k: string) { return this.data.get(k) ?? null; }
  setItem(k: string, v: string) { this.data.set(k, v); }
  removeItem(k: string) { this.data.delete(k); }
}

describe('save', () => {
  it('round-trips through storage', () => {
    const store = new MemoryStorage();
    const sm = new SaveManager(store);
    const s = freshSave();
    s.scrap = 123;
    s.totalScrap = 200;
    s.ownedCars.push('hopper');
    s.car = 'hopper';
    s.best['dunes-1'] = 1;
    sm.save(s);
    expect(sm.load()).toEqual(s);
  });

  it('survives garbage and missing fields', () => {
    expect(migrate(null)).toEqual(freshSave());
    expect(migrate('nope')).toEqual(freshSave());
    const store = new MemoryStorage();
    store.setItem(SAVE_KEY, '{not json');
    expect(new SaveManager(store).load()).toEqual(freshSave());
  });

  it('keeps progress and repairs bad values', () => {
    const m = migrate({ scrap: 50.7, upgrades: { engine: 9, tires: -2 }, car: 'rig', ownedCars: ['hopper'], best: { 'dunes-1': 1, x: 99 }, settings: { steerHelp: 'wild' } });
    expect(m.scrap).toBe(50);
    expect(m.upgrades).toEqual({ engine: 4, tires: 0, armor: 0, gadget: 0 });
    expect(m.car).toBe('buggy'); // not owned, so back to the buggy
    expect(m.ownedCars).toEqual(['buggy', 'hopper']);
    expect(m.best).toEqual({ 'dunes-1': 1 });
    expect(m.settings.steerHelp).toBe('strong');
  });
});
