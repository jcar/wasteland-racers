/**
 * The five wastelands. Each one has its own look, props and music, and three
 * tracks (the Thunder Dome has one). The last track of a world has a rival.
 */
export interface WorldDef {
  id: string;
  name: string;
  /** Image key for the world card (Gemini backdrop). */
  card: string;
  ground: string;
  road: string;
  /** Flat colors used before textures load, and for the placeholder art. */
  groundColor: string;
  roadColor: string;
  wallColors: [string, string];
  sky: string;
  props: string[];
  music: string;
  /** Sticker you earn for winning the world's last race. */
  reward?: string;
  emoji: string;
}

export const WORLDS: WorldDef[] = [
  {
    id: 'dunes', name: 'Dusty Dunes', card: 'world-dunes', emoji: '🏜️',
    ground: 'ground-dunes', road: 'road-dirt',
    groundColor: '#e8a458', roadColor: '#c9a47a', wallColors: ['#e8452c', '#fff4dc'], sky: '#f7c77e',
    props: ['prop-cactus', 'prop-rock', 'prop-skull', 'prop-cactus', 'prop-flag'],
    music: 'music-dunes', reward: 'shark',
  },
  {
    id: 'junkyard', name: 'Junkyard Canyon', card: 'world-junkyard', emoji: '🔩',
    ground: 'ground-junk', road: 'road-junk',
    groundColor: '#a85a3c', roadColor: '#7d7a78', wallColors: ['#f4c430', '#2b2b2b'], sky: '#e59a6a',
    props: ['prop-tires', 'prop-junkcar', 'prop-barrel', 'prop-tires', 'prop-sign'],
    music: 'music-junkyard', reward: 'checker',
  },
  {
    id: 'swamp', name: 'Goo Swamp', card: 'world-swamp', emoji: '🍄',
    ground: 'ground-swamp', road: 'road-swamp',
    groundColor: '#556b2f', roadColor: '#8b6b45', wallColors: ['#9be15d', '#6a3fb5'], sky: '#6b7f4a',
    props: ['prop-mushroom', 'prop-deadtree', 'prop-mushroom', 'prop-barrel'],
    music: 'music-swamp', reward: 'skull',
  },
  {
    id: 'volcano', name: 'Volcano Highway', card: 'world-volcano', emoji: '🌋',
    ground: 'ground-volcano', road: 'road-volcano',
    groundColor: '#3a3036', roadColor: '#55504f', wallColors: ['#ff7a1a', '#ffd23f'], sky: '#4a2c2a',
    props: ['prop-lavarock', 'prop-rock', 'prop-lavarock', 'prop-flag'],
    music: 'music-volcano', reward: 'gold',
  },
  {
    id: 'dome', name: 'Thunder Dome', card: 'world-dome', emoji: '🏟️',
    ground: 'ground-dome', road: 'road-dome',
    groundColor: '#7a808a', roadColor: '#8e9196', wallColors: ['#1fb5ad', '#f4c430'], sky: '#2d3142',
    props: ['prop-crowd', 'prop-flag', 'prop-crowd', 'prop-tires'],
    music: 'music-dome',
  },
];

export const worldById = (id: string) => WORLDS.find((w) => w.id === id)!;
