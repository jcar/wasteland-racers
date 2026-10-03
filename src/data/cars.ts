/**
 * Cars you can buy. Upgrades carry over when you switch cars, so buying a
 * new one never feels like losing anything.
 *
 * Season 1 cars cost scrap. The Wasteland legends (Fury Road cars) cost
 * chrome, which you earn by winning races, and each brings its own special
 * move on Space.
 */
export type BodyKind =
  | 'buggy' | 'hopper' | 'truck' | 'monster' | 'rig'
  | 'interceptor' | 'nuxcar' | 'buzzard' | 'bigfoot' | 'doof' | 'peacemaker' | 'chariot' | 'gigahorse';

export interface CarDef {
  id: string;
  name: string;
  /** Scrap price (Season 1 cars). */
  price: number;
  /** Chrome price (Wasteland legends). */
  chrome?: number;
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
  /** Gadget or special move that comes free with the car. */
  gadget: string;
  emoji: string;
  /** Card art (Gemini) shown in the shop and the Valhalla Book. */
  card?: string;
  /** Default paint for legends, so they look right out of the box. */
  paint?: string;
  lore?: boolean;
}

export const CARS: CarDef[] = [
  { id: 'buggy', name: 'Rusty Buggy', price: 0, body: 'buggy', speed: 20, accel: 13, grip: 7, turn: 2.6, mass: 1, gadget: 'boost', emoji: '🚙' },
  { id: 'hopper', name: 'Dune Hopper', price: 200, body: 'hopper', speed: 22, accel: 14, grip: 7.4, turn: 2.7, mass: 1.1, gadget: 'goo', emoji: '🏎️' },
  { id: 'spike', name: 'Spike Truck', price: 450, body: 'truck', speed: 24, accel: 14.5, grip: 7.8, turn: 2.6, mass: 1.35, gadget: 'boing', emoji: '🛻' },
  { id: 'monster', name: 'Monster Truck', price: 800, body: 'monster', speed: 26, accel: 15.5, grip: 8, turn: 2.55, mass: 1.7, gadget: 'boost', emoji: '🚚' },
  { id: 'rig', name: 'War Rig', price: 1300, body: 'rig', speed: 28, accel: 16.5, grip: 8.4, turn: 2.5, mass: 2.1, gadget: 'thunder', emoji: '🚛', card: 'car-rig' },
  // Wasteland legends.
  { id: 'buzzard', name: 'Buzzard', price: 0, chrome: 6, body: 'buzzard', speed: 28, accel: 17, grip: 8.2, turn: 2.65, mass: 1.6, gadget: 'spikes', emoji: '🦔', card: 'car-buzzard', paint: 'rust', lore: true },
  { id: 'nuxcar', name: 'Nux Car', price: 0, chrome: 8, body: 'nuxcar', speed: 29, accel: 18, grip: 8.4, turn: 2.7, mass: 1.4, gadget: 'witness', emoji: '💀', card: 'car-nuxcar', paint: 'black', lore: true },
  { id: 'interceptor', name: 'The Interceptor', price: 0, chrome: 10, body: 'interceptor', speed: 30, accel: 18, grip: 8.6, turn: 2.65, mass: 1.5, gadget: 'blower', emoji: '🖤', card: 'car-interceptor', paint: 'black', lore: true },
  { id: 'bigfoot', name: 'Big Foot', price: 0, chrome: 12, body: 'bigfoot', speed: 29, accel: 17, grip: 8.4, turn: 2.5, mass: 2.4, gadget: 'stomp', emoji: '🦶', card: 'car-bigfoot', paint: 'rust', lore: true },
  { id: 'doof', name: 'Doof Wagon', price: 0, chrome: 14, body: 'doof', speed: 28, accel: 17, grip: 8.2, turn: 2.45, mass: 2.3, gadget: 'flameguitar', emoji: '🎸', card: 'car-doof', paint: 'black', lore: true },
  { id: 'peacemaker', name: 'The Peacemaker', price: 0, chrome: 16, body: 'peacemaker', speed: 29, accel: 17, grip: 8.4, turn: 2.45, mass: 2.6, gadget: 'thundershot', emoji: '🛡️', card: 'car-peacemaker', paint: 'olive', lore: true },
  { id: 'chariot', name: "Dementus's Chariot", price: 0, chrome: 20, body: 'chariot', speed: 31, accel: 19, grip: 8.8, turn: 2.7, mass: 1.8, gadget: 'bikes', emoji: '🏍️', card: 'car-chariot', paint: 'red', lore: true },
  { id: 'gigahorse', name: 'The Gigahorse', price: 0, chrome: 25, body: 'gigahorse', speed: 31, accel: 19, grip: 8.6, turn: 2.5, mass: 2.8, gadget: 'doublev8', emoji: '🐎', card: 'car-gigahorse', paint: 'black', lore: true },
];

export const carById = (id: string) => CARS.find((c) => c.id === id) ?? CARS[0];

export type UpgradeStat = 'engine' | 'tires' | 'armor' | 'gadget';
export const UPGRADE_STATS: { id: UpgradeStat; name: string; icon: string; emoji: string; voice: string }[] = [
  { id: 'engine', name: 'Engine', icon: 'icon-engine', emoji: '⚙️', voice: 'upgrade-engine' },
  { id: 'tires', name: 'Tires', icon: 'icon-tires', emoji: '🛞', voice: 'upgrade-tires' },
  { id: 'armor', name: 'Armor', icon: 'icon-armor', emoji: '🛡️', voice: 'upgrade-armor' },
  { id: 'gadget', name: 'Gadget', icon: 'icon-gadget', emoji: '⚡', voice: 'upgrade-gadget' },
];
/** Levels 1-4 cost scrap; 5-6 are chrome upgrades. */
export const SCRAP_LEVELS = 4;
export const MAX_LEVEL = 6;

export interface Gadget {
  id: string;
  name: string;
  /** Scrap price. */
  price: number;
  icon: string;
  emoji: string;
  /** A special move that only works on this car. */
  car?: string;
  /** Lore weapons hurt (count toward wrecking a car); Season 1 gadgets don't. */
  lore?: boolean;
}

export const GADGETS: Gadget[] = [
  { id: 'boost', name: 'Rocket Boost', price: 0, icon: 'icon-boost', emoji: '🚀' },
  { id: 'goo', name: 'Goo Slick', price: 80, icon: 'icon-goo', emoji: '🟢' },
  { id: 'boing', name: 'Boing Bumper', price: 120, icon: 'icon-boing', emoji: '🥊' },
  // Lore weapons, for any car.
  { id: 'thunder', name: 'Thunder Sticks', price: 300, icon: 'icon-thunder', emoji: '🧨', lore: true },
  { id: 'caltrops', name: 'Caltrops', price: 250, icon: 'icon-caltrops', emoji: '📌', lore: true },
  { id: 'harpoon', name: 'Harpoon', price: 350, icon: 'icon-harpoon', emoji: '🔱', lore: true },
  { id: 'flame', name: 'Flamethrower', price: 400, icon: 'icon-flame', emoji: '🔥', lore: true },
  // Specials: free with their car, and only work on it.
  { id: 'spikes', name: 'Spike Ram', price: 0, icon: 'icon-spikes', emoji: '🦔', car: 'buzzard', lore: true },
  { id: 'witness', name: 'Witness Me!', price: 0, icon: 'icon-witness', emoji: '✨', car: 'nuxcar', lore: true },
  { id: 'blower', name: 'The Blower', price: 0, icon: 'icon-blower', emoji: '💨', car: 'interceptor', lore: true },
  { id: 'stomp', name: 'Stomp', price: 0, icon: 'icon-stomp', emoji: '💥', car: 'bigfoot', lore: true },
  { id: 'flameguitar', name: 'Flame Guitar', price: 0, icon: 'icon-flame', emoji: '🎸', car: 'doof', lore: true },
  { id: 'thundershot', name: 'Thunder Shot', price: 0, icon: 'icon-thundershot', emoji: '💣', car: 'peacemaker', lore: true },
  { id: 'bikes', name: 'Bike Swarm', price: 0, icon: 'icon-bikes', emoji: '🏍️', car: 'chariot', lore: true },
  { id: 'doublev8', name: 'Double V8', price: 0, icon: 'icon-doublev8', emoji: '🔥', car: 'gigahorse', lore: true },
];
export const gadgetById = (id: string) => GADGETS.find((g) => g.id === id) ?? GADGETS[0];

export const PAINTS: { id: string; name: string; color: string; unlock?: string; chrome?: number }[] = [
  { id: 'red', name: 'Rust Red', color: '#d2442c' },
  { id: 'orange', name: 'Sunny Orange', color: '#f28c28' },
  { id: 'yellow', name: 'Desert Yellow', color: '#f5c518' },
  { id: 'lime', name: 'Lime', color: '#7bcf3c' },
  { id: 'teal', name: 'Turquoise', color: '#1fb5ad' },
  { id: 'blue', name: 'Sky Blue', color: '#3a86e0' },
  { id: 'purple', name: 'Grape', color: '#8a55d8' },
  { id: 'pink', name: 'Bubblegum', color: '#ff6fa8' },
  { id: 'black', name: 'Midnight', color: '#34343c' },
  { id: 'rust', name: 'Wasteland Rust', color: '#9c4a22' },
  { id: 'olive', name: 'War Olive', color: '#6b6b3a' },
  { id: 'gold', name: 'Champion Gold', color: '#ffc93c', unlock: 'gold' },
  { id: 'chrome', name: 'Shiny Chrome', color: '#d8dee6', chrome: 5 },
];

export const DECALS: { id: string; name: string; image: string; emoji: string; unlock?: string }[] = [
  { id: 'none', name: 'None', image: '', emoji: '⬜' },
  { id: 'flames', name: 'Flames', image: 'decal-flames', emoji: '🔥' },
  { id: 'lightning', name: 'Lightning', image: 'decal-lightning', emoji: '⚡' },
  { id: 'star', name: 'Star', image: 'decal-star', emoji: '⭐' },
  { id: 'shark', name: 'Shark Teeth', image: 'decal-shark', emoji: '🦈', unlock: 'shark' },
  { id: 'checker', name: 'Checkers', image: 'decal-checker', emoji: '🏁', unlock: 'checker' },
  { id: 'skull', name: 'Silly Skull', image: 'decal-skull', emoji: '💀', unlock: 'skull' },
  { id: 'v8', name: 'War Boy V8', image: 'decal-v8', emoji: '☠️', unlock: 'v8' },
];

/** Things to bolt on the front of the hood, bought with chrome. */
export const ORNAMENTS: { id: string; name: string; emoji: string; chrome: number }[] = [
  { id: 'none', name: 'None', emoji: '⬜', chrome: 0 },
  { id: 'skull', name: "Immortan's Skull", emoji: '💀', chrome: 4 },
  { id: 'wheel', name: 'V8 Wheel Shrine', emoji: '🛞', chrome: 3 },
  { id: 'teddy', name: "Dementus's Teddy", emoji: '🧸', chrome: 3 },
  { id: 'horns', name: 'Bull Horns', emoji: '🐂', chrome: 3 },
];
