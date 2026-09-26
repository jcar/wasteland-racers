import type { BodyKind } from './cars';

/** Drivers the player can pick. Looks only: they all drive the same. */
export interface DriverDef {
  id: string;
  name: string;
  portrait: string;
  emoji: string;
  /** Colors for the little 3D head in the car. */
  head: { skin: string; hat: string; kind: 'kid' | 'dog' | 'robot' | 'lizard' };
}

export const DRIVERS: DriverDef[] = [
  { id: 'kid', name: 'Goggles Kid', portrait: 'driver-kid', emoji: '🧒', head: { skin: '#f1c29a', hat: '#7a4a2a', kind: 'kid' } },
  { id: 'dog', name: 'Sprocket', portrait: 'driver-dog', emoji: '🐶', head: { skin: '#d9a04a', hat: '#d2442c', kind: 'dog' } },
  { id: 'robot', name: 'Bolt', portrait: 'driver-robot', emoji: '🤖', head: { skin: '#9aa7b0', hat: '#1fb5ad', kind: 'robot' } },
  { id: 'lizard', name: 'Lizzy', portrait: 'driver-lizard', emoji: '🦎', head: { skin: '#6cc24a', hat: '#f5c518', kind: 'lizard' } },
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

export const rivalById = (id: string) => RIVALS.find((r) => r.id === id);
