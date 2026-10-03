import { describe, expect, it } from 'vitest';
import { LORE_RIVALS, RIVALS } from '../src/data/characters';
import { TRACKS } from '../src/data/tracks';
import { WORLDS } from '../src/data/worlds';
import { TrackGeometry } from '../src/race/trackGeometry';

describe.each(TRACKS.map((t) => [t.id, t] as const))('track %s', (_id, t) => {
  const g = new TrackGeometry(t);

  it('belongs to a real world and rival', () => {
    expect(WORLDS.map((w) => w.id)).toContain(t.world);
    if (t.rival) expect([...RIVALS, ...LORE_RIVALS].map((r) => r.id)).toContain(t.rival);
  });

  it('has corners wide enough for little drivers', () => {
    const tightest = Math.min(...g.samples.map((p) => 1 / Math.abs(p.k)));
    expect(tightest).toBeGreaterThan(12);
  });

  it('never runs into itself', () => {
    const S = g.samples;
    for (let i = 0; i < S.length; i += 2)
      for (let j = i + 2; j < S.length; j += 2) {
        if (Math.min(j - i, S.length - (j - i)) < t.width * 3) continue;
        expect(Math.hypot(S[i].x - S[j].x, S[i].z - S[j].z)).toBeGreaterThan(t.width + 6);
      }
  });

  it('is mostly flat road, with hills and jumps only where they are placed', () => {
    const planned = [...(t.hills ?? []), ...(t.jumps ?? [])].reduce((sum, f) => sum + f.len, 0);
    const raised = g.samples.filter((p) => p.h > 0.05).length / g.samples.length;
    expect(raised).toBeLessThanOrEqual(planned + 0.02);
    expect(g.heightAt(0)).toBeLessThan(0.5); // the start line is on flat ground
  });

  it('knows where its jump ramps are', () => {
    for (const j of t.jumps ?? []) expect(g.onJump((j.at + j.len / 2) * g.length)).toBe(true);
    for (const h of t.hills ?? []) expect(g.onJump(h.at * g.length)).toBe(false);
  });

  it('places everything on the lap', () => {
    const fracs = [...(t.pickups ?? []), ...(t.boosts ?? []).map((b) => b.at), ...(t.bolts ?? []).map((b) => b.at), ...(t.goo ?? []).map((b) => b.at)];
    for (const f of fracs) expect(f).toBeGreaterThanOrEqual(0), expect(f).toBeLessThan(1);
  });

  it('finds positions on the track', () => {
    const p = g.pointAt(123, 3);
    const found = g.locate(p.x, p.z);
    expect(found.s).toBeCloseTo(123, 0);
    expect(found.lateral).toBeCloseTo(3, 0);
  });
});
