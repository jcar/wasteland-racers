import type { BodyKind } from './cars';

export type HeadKind = 'kid' | 'dog' | 'robot' | 'lizard' | 'max' | 'furiosa' | 'warboy' | 'doof' | 'toast' | 'joe' | 'dementus' | 'rictus';

/** Drivers the player can pick. Looks only: they all drive the same. */
export interface DriverDef {
  id: string;
  name: string;
  portrait: string;
  emoji: string;
  /** Colors for the little 3D head in the car. */
  head: { skin: string; hat: string; kind: HeadKind };
}

export const DRIVERS: DriverDef[] = [
  { id: 'kid', name: 'Goggles Kid', portrait: 'driver-kid', emoji: '🧒', head: { skin: '#f1c29a', hat: '#7a4a2a', kind: 'kid' } },
  { id: 'dog', name: 'Sprocket', portrait: 'driver-dog', emoji: '🐶', head: { skin: '#d9a04a', hat: '#d2442c', kind: 'dog' } },
  { id: 'robot', name: 'Bolt', portrait: 'driver-robot', emoji: '🤖', head: { skin: '#9aa7b0', hat: '#1fb5ad', kind: 'robot' } },
  { id: 'lizard', name: 'Lizzy', portrait: 'driver-lizard', emoji: '🦎', head: { skin: '#6cc24a', hat: '#f5c518', kind: 'lizard' } },
  // Wasteland legends.
  { id: 'max', name: 'Max', portrait: 'driver-max', emoji: '🧔', head: { skin: '#e2b48c', hat: '#3a2a1e', kind: 'max' } },
  { id: 'furiosa', name: 'Furiosa', portrait: 'driver-furiosa', emoji: '🦾', head: { skin: '#e8c0a0', hat: '#1c1c1c', kind: 'furiosa' } },
  { id: 'nux', name: 'Nux', portrait: 'driver-nux', emoji: '💀', head: { skin: '#f4f1ea', hat: '#1c1c1c', kind: 'warboy' } },
  { id: 'warpup', name: 'War Pup', portrait: 'driver-warpup', emoji: '👦', head: { skin: '#f4f1ea', hat: '#5a3a1e', kind: 'warboy' } },
  { id: 'doofwarrior', name: 'Doof Warrior', portrait: 'driver-doof', emoji: '🎸', head: { skin: '#d22b2b', hat: '#1c1c1c', kind: 'doof' } },
  { id: 'toast', name: 'Toast', portrait: 'driver-toast', emoji: '🧕', head: { skin: '#d9a77e', hat: '#2b1d14', kind: 'toast' } },
];
export const driverById = (id: string) => DRIVERS.find((d) => d.id === id) ?? DRIVERS[0];

/** Opponents. Rivals are the boss of a world; the rest fill out the grid. */
export interface Racer {
  id: string;
  name: string;
  portrait: string;
  emoji: string;
  color: string;
  body: BodyKind;
  head: DriverDef['head'];
  /** Added to the track's AI speed. */
  skill: number;
  rival?: boolean;
}

export const RIVALS: Racer[] = [
  { id: 'rex', name: 'Rusty Rex', portrait: 'rival-rex', emoji: '🦖', color: '#f28c28', body: 'hopper', head: { skin: '#7bcf3c', hat: '#f28c28', kind: 'lizard' }, skill: 0.8, rival: true },
  { id: 'muffler', name: 'Captain Muffler', portrait: 'rival-muffler', emoji: '🏴‍☠️', color: '#34343c', body: 'truck', head: { skin: '#f1c29a', hat: '#34343c', kind: 'kid' }, skill: 0.9, rival: true },
  { id: 'bertha', name: 'Big Bertha', portrait: 'rival-bertha', emoji: '🔧', color: '#7bcf3c', body: 'monster', head: { skin: '#e0ac7e', hat: '#8a55d8', kind: 'kid' }, skill: 1, rival: true },
  { id: 'warlord', name: 'The Warlord', portrait: 'rival-warlord', emoji: '📯', color: '#9aa7b0', body: 'rig', head: { skin: '#e8b890', hat: '#c0c8d0', kind: 'robot' }, skill: 1.1, rival: true },
];

export const EXTRAS: Racer[] = [
  { id: 'dusty', name: 'Dusty', portrait: '', emoji: '🌵', color: '#3a86e0', body: 'buggy', head: { skin: '#f1c29a', hat: '#3a86e0', kind: 'kid' }, skill: 0 },
  { id: 'nutsy', name: 'Nutsy', portrait: '', emoji: '🐿️', color: '#8a55d8', body: 'hopper', head: { skin: '#b07040', hat: '#8a55d8', kind: 'dog' }, skill: -0.4 },
  { id: 'sparky', name: 'Sparky', portrait: '', emoji: '⚡', color: '#f5c518', body: 'buggy', head: { skin: '#9aa7b0', hat: '#f5c518', kind: 'robot' }, skill: -0.2 },
  { id: 'rattles', name: 'Rattles', portrait: '', emoji: '🐍', color: '#ff6fa8', body: 'truck', head: { skin: '#6cc24a', hat: '#ff6fa8', kind: 'lizard' }, skill: 0.2 },
];

/** Fury Road rivals (lap races in the Fury Road world). Bosses come later. */
export const LORE_RIVALS: Racer[] = [
  { id: 'slit', name: 'Slit', portrait: 'char-slit', emoji: '😬', color: '#4a4a4a', body: 'buzzard', head: { skin: '#f4f1ea', hat: '#1c1c1c', kind: 'warboy' }, skill: 1, rival: true },
  { id: 'rictus', name: 'Rictus', portrait: 'char-rictus', emoji: '💪', color: '#7a3b1e', body: 'bigfoot', head: { skin: '#e8b890', hat: '#3a2a1e', kind: 'rictus' }, skill: 1.2, rival: true },
];

/** War Boys who fill out the grid on the Fury Road. */
export const WAR_BOYS: Racer[] = [
  { id: 'morsov', name: 'Morsov', portrait: 'driver-warpup', emoji: '💀', color: '#8a3a1a', body: 'buzzard', head: { skin: '#f4f1ea', hat: '#1c1c1c', kind: 'warboy' }, skill: 0.2 },
  { id: 'ace', name: 'Ace', portrait: 'driver-nux', emoji: '☠️', color: '#2b2b2b', body: 'nuxcar', head: { skin: '#f4f1ea', hat: '#1c1c1c', kind: 'warboy' }, skill: 0.4 },
  { id: 'corpus', name: 'Lancer', portrait: 'driver-warpup', emoji: '🧨', color: '#6b6b3a', body: 'interceptor', head: { skin: '#f4f1ea', hat: '#1c1c1c', kind: 'warboy' }, skill: 0 },
];

export const rivalById = (id: string) => [...RIVALS, ...LORE_RIVALS].find((r) => r.id === id);
