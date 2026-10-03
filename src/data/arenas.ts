/**
 * Open arenas with a wall around the edge: Smash events and boss fights.
 * Obstacles are round (rock pillars, tire stacks, fuel drums) so cars bounce
 * off them cleanly.
 */
export interface ArenaDef {
  id: string;
  name: string;
  theme: string;
  /** Circle arenas use `radius`; rectangles use `w` × `h`. */
  shape: 'circle' | 'rect';
  radius?: number;
  w?: number;
  h?: number;
  obstacles: { x: number; z: number; r: number; kind: 'rock' | 'tires' | 'drums' | 'pillar' }[];
}

const ring = (n: number, dist: number, r: number, kind: ArenaDef['obstacles'][number]['kind'], turn = 0) =>
  Array.from({ length: n }, (_, i) => {
    const a = (i / n) * Math.PI * 2 + turn;
    return { x: Math.cos(a) * dist, z: Math.sin(a) * dist, r, kind };
  });

export const ARENAS: ArenaDef[] = [
  { id: 'pit-citadel', name: 'Citadel Pit', theme: 'wasteland', shape: 'circle', radius: 70, obstacles: [...ring(4, 35, 5, 'pillar', 0.4), { x: 0, z: 0, r: 6, kind: 'rock' }] },
  { id: 'pit-mine', name: 'Mine Pit', theme: 'bulletfarm', shape: 'rect', w: 170, h: 120, obstacles: [...ring(6, 38, 4, 'drums'), { x: -60, z: 30, r: 5, kind: 'rock' }, { x: 60, z: -30, r: 5, kind: 'rock' }] },
  { id: 'pit-gastown', name: 'Gas Town Square', theme: 'gastown', shape: 'circle', radius: 78, obstacles: [...ring(5, 40, 4.5, 'drums', 0.3), ...ring(3, 14, 3, 'pillar')] },
  // Rictus rams; bait him into the tire walls.
  { id: 'arena-bigfoot', name: "Rictus's Ring", theme: 'wasteland', shape: 'circle', radius: 68, obstacles: ring(6, 46, 5.5, 'tires', 0.5) },
  // Hide behind the rocks while the Peacemaker reloads.
  { id: 'arena-peacemaker', name: 'The Bullet Farm Yard', theme: 'bulletfarm', shape: 'rect', w: 180, h: 130, obstacles: [...ring(6, 42, 5, 'rock', 0.25), { x: 0, z: 0, r: 6, kind: 'pillar' }] },
];

export const arenaById = (id: string) => ARENAS.find((a) => a.id === id)!;
