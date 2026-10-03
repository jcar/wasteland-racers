import { describe, expect, it } from 'vitest';
import { arenaById, ARENAS } from '../src/data/arenas';
import { CHAPTERS, EVENTS, bossEvent, chapterEvents, eventById } from '../src/data/story';
import { trackById } from '../src/data/tracks';
import dialogue from '../src/data/dialogue.json';
import { ArenaGround, TerrainGround } from '../src/race/ground';
import { freshSave, migrate } from '../src/systems/SaveManager';
import { chapterOpen, currentChapter, eventOpen, nextEvent, recordEvent, season2Open, storyComplete } from '../src/systems/Story';

const LINES = dialogue as Record<string, unknown>;

function season2Save() {
  const s = freshSave();
  s.best['dome-1'] = 1;
  return s;
}

describe('story data', () => {
  it('every event points at a real track or arena, and has its voice line', () => {
    for (const e of EVENTS) {
      if (e.track) expect(trackById(e.track), e.id).toBeTruthy();
      if (e.arena) expect(arenaById(e.arena), e.id).toBeTruthy();
      if (e.mode === 'chase' || e.mode === 'escort') expect(trackById(e.track!).open, e.id).toBe(true);
      expect(LINES[e.intro], e.intro).toBeTruthy();
      if (e.boss) for (const k of ['intro', 'hurt', 'down']) expect(LINES[`boss-${e.boss}-${k}`]).toBeTruthy();
    }
  });

  it('every chapter has a boss and comic lines', () => {
    for (const c of CHAPTERS) {
      expect(bossEvent(c.n)).toBeTruthy();
      for (const p of c.panels) expect(LINES[p.line], p.line).toBeTruthy();
    }
  });
});

describe('story progress', () => {
  it('opens after the Thunder Dome', () => {
    const s = freshSave();
    expect(season2Open(s)).toBe(false);
    expect(currentChapter(s)).toBe(0);
    expect(nextEvent(s)).toBeUndefined();
    s.best['dome-1'] = 1;
    expect(currentChapter(s)).toBe(1);
    expect(nextEvent(s)?.id).toBe('c1-race');
  });

  it('a boss waits for the rest of its chapter, and beating it opens the next chapter and gives its car', () => {
    const s = season2Save();
    const boss = bossEvent(1);
    expect(eventOpen(s, boss)).toBe(false);
    const others = chapterEvents(1).filter((e) => e.mode !== 'boss');
    others.forEach((e, i) => {
      const pay = recordEvent(s, e, { stars: 2, won: true });
      if (i === others.length - 1) expect(pay.unlocked).toContain('boss:1');
    });
    expect(eventOpen(s, boss)).toBe(true);
    expect(chapterOpen(s, 2)).toBe(false);
    const pay = recordEvent(s, boss, { stars: 3, won: true });
    expect(pay.car).toBe('bigfoot');
    expect(s.ownedCars).toContain('bigfoot');
    expect(pay.unlocked).toContain('chapter:2');
    expect(chapterOpen(s, 2)).toBe(true);
  });

  it('losing still pays, but only winning counts', () => {
    const s = season2Save();
    const ev = eventById('c1-arena');
    const pay = recordEvent(s, ev, { stars: 1, won: false });
    expect(pay.scrap).toBeGreaterThan(0);
    expect(pay.chrome).toBe(0);
    expect(s.story[ev.id].won).toBe(false);
    expect(recordEvent(s, ev, { stars: 3, won: true }).chrome).toBe(ev.reward.chrome);
    // Replays pay less, but three stars still earns a chrome.
    expect(recordEvent(s, ev, { stars: 3, won: true }).chrome).toBe(1);
  });

  it('winning everything finishes the story with the finale', () => {
    const s = season2Save();
    let last;
    for (const e of EVENTS) {
      expect(eventOpen(s, e), e.id).toBe(true);
      last = recordEvent(s, e, { stars: 3, won: true });
    }
    expect(storyComplete(s)).toBe(true);
    expect(last!.unlocked).toContain('finale');
    expect(nextEvent(s)).toBeUndefined();
  });

  it('story progress survives a save round trip', () => {
    const s = season2Save();
    recordEvent(s, eventById('c1-race'), { stars: 2, won: true });
    s.comicsSeen.push(1);
    s.collected.push('g3');
    const m = migrate(JSON.parse(JSON.stringify(s)));
    expect(m.story).toEqual(s.story);
    expect(m.comicsSeen).toEqual([1]);
    expect(m.collected).toEqual(['g3']);
  });
});

describe('grounds', () => {
  it('arenas keep cars inside and bounce them off obstacles', () => {
    for (const def of ARENAS) {
      const a = new ArenaGround(def);
      const edge = a.contain(a.halfW + 5, 0, a.locate(), 1.25);
      expect(edge?.nx, def.id).toBeGreaterThan(0);
      const o = def.obstacles[0];
      expect(a.contain(o.x, o.z + o.r * 0.5, a.locate(), 1.25), def.id).toBeTruthy();
      const spot = a.randomSpot();
      expect(a.contain(spot.x, spot.z, a.locate(), 1.25), def.id).toBeUndefined();
    }
  });

  it('the Wasteland has an edge and is flat around landmarks', () => {
    const t = new TerrainGround(800, [{ x: 0, z: 0, r: 10 }], [{ x: 100, z: 100, r: 20 }]);
    expect(t.contain(805, 0, t.locate(805, 0), 1.25)?.nx).toBe(1);
    expect(t.contain(0, 5, t.locate(0, 5), 1.25)).toBeTruthy();
    expect(t.heightAt(100, 100)).toBe(0);
  });
});
