/**
 * Cars you can buy. Upgrades carry over when you switch cars, so buying a
 * new one never feels like losing anything.
 */
export type BodyKind = 'buggy' | 'hopper' | 'truck' | 'monster' | 'rig';

export interface CarDef {
  id: string;
  name: string;
  price: number;
  body: BodyKind;
  /** Top speed before upgrades. */
  speed: number;
  accel: number;
  /** How quickly sideways sliding stops (higher = grippier). */
  grip: number;
  /** Turning speed in radians per second. */
  turn: number;
  /** Heavier cars push lighter ones around. */
  mass: number;
  /** Gadget that comes free with the car. */
  gadget: string;
  emoji: string;
}

export const CARS: CarDef[] = [
  { id: 'buggy', name: 'Rusty Buggy', price: 0, body: 'buggy', speed: 20, accel: 13, grip: 7, turn: 2.6, mass: 1, gadget: 'boost', emoji: '🚙' },
  { id: 'hopper', name: 'Dune Hopper', price: 200, body: 'hopper', speed: 22, accel: 14, grip: 7.4, turn: 2.7, mass: 1.1, gadget: 'goo', emoji: '🏎️' },
  { id: 'spike', name: 'Spike Truck', price: 450, body: 'truck', speed: 24, accel: 14.5, grip: 7.8, turn: 2.6, mass: 1.35, gadget: 'boing', emoji: '🛻' },
  { id: 'monster', name: 'Monster Truck', price: 800, body: 'monster', speed: 26, accel: 15.5, grip: 8, turn: 2.55, mass: 1.7, gadget: 'boost', emoji: '🚚' },
  { id: 'rig', name: 'War Rig', price: 1300, body: 'rig', speed: 28, accel: 16.5, grip: 8.4, turn: 2.5, mass: 2.1, gadget: 'boing', emoji: '🚛' },
];

export const carById = (id: string) => CARS.find((c) => c.id === id) ?? CARS[0];

export type UpgradeStat = 'engine' | 'tires' | 'armor' | 'gadget';
export const UPGRADE_STATS: { id: UpgradeStat; name: string; icon: string; emoji: string; voice: string }[] = [
  { id: 'engine', name: 'Engine', icon: 'icon-engine', emoji: '⚙️', voice: 'upgrade-engine' },
  { id: 'tires', name: 'Tires', icon: 'icon-tires', emoji: '🛞', voice: 'upgrade-tires' },
  { id: 'armor', name: 'Armor', icon: 'icon-armor', emoji: '🛡️', voice: 'upgrade-armor' },
  { id: 'gadget', name: 'Gadget', icon: 'icon-gadget', emoji: '⚡', voice: 'upgrade-gadget' },
];
export const MAX_LEVEL = 4;

export interface Gadget {
  id: string;
  name: string;
  price: number;
  icon: string;
  emoji: string;
}

export const GADGETS: Gadget[] = [
  { id: 'boost', name: 'Rocket Boost', price: 0, icon: 'icon-boost', emoji: '🚀' },
  { id: 'goo', name: 'Goo Slick', price: 80, icon: 'icon-goo', emoji: '🟢' },
  { id: 'boing', name: 'Boing Bumper', price: 120, icon: 'icon-boing', emoji: '🥊' },
];
export const gadgetById = (id: string) => GADGETS.find((g) => g.id === id) ?? GADGETS[0];

export const PAINTS: { id: string; name: string; color: string; unlock?: string }[] = [
  { id: 'red', name: 'Rust Red', color: '#d2442c' },
  { id: 'orange', name: 'Sunny Orange', color: '#f28c28' },
  { id: 'yellow', name: 'Desert Yellow', color: '#f5c518' },
  { id: 'lime', name: 'Lime', color: '#7bcf3c' },
  { id: 'teal', name: 'Turquoise', color: '#1fb5ad' },
  { id: 'blue', name: 'Sky Blue', color: '#3a86e0' },
  { id: 'purple', name: 'Grape', color: '#8a55d8' },
  { id: 'pink', name: 'Bubblegum', color: '#ff6fa8' },
  { id: 'black', name: 'Midnight', color: '#34343c' },
  { id: 'gold', name: 'Champion Gold', color: '#ffc93c', unlock: 'gold' },
];

export const DECALS: { id: string; name: string; image: string; emoji: string; unlock?: string }[] = [
  { id: 'none', name: 'None', image: '', emoji: '⬜' },
  { id: 'flames', name: 'Flames', image: 'decal-flames', emoji: '🔥' },
  { id: 'lightning', name: 'Lightning', image: 'decal-lightning', emoji: '⚡' },
  { id: 'star', name: 'Star', image: 'decal-star', emoji: '⭐' },
  { id: 'shark', name: 'Shark Teeth', image: 'decal-shark', emoji: '🦈', unlock: 'shark' },
  { id: 'checker', name: 'Checkers', image: 'decal-checker', emoji: '🏁', unlock: 'checker' },
  { id: 'skull', name: 'Silly Skull', image: 'decal-skull', emoji: '💀', unlock: 'skull' },
];
