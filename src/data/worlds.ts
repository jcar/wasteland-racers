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
  {
    id: 'fury', name: 'Fury Road', card: 'world-fury', emoji: '🔥',
    ground: 'ground-fury', road: 'road-fury',
    groundColor: '#d9894a', roadColor: '#b9773f', wallColors: ['#9c4a22', '#d8dee6'], sky: '#e7b37a',
    props: ['prop-warboys', 'prop-skullpole', 'prop-guzzoline', 'prop-wreck', 'prop-citadel', 'prop-rock'],
    music: 'music-fury', reward: 'v8',
  },
];

/**
 * Season 2 story locations. They dress story tracks, roads and arenas,
 * but aren't race worlds of their own (no track list or Valhalla card).
 */
export const THEMES: WorldDef[] = [
  {
    id: 'wasteland', name: 'The Wasteland', card: 'world-fury', emoji: '🏜️',
    ground: 'ground-wasteland', road: 'road-fury',
    groundColor: '#d99a5a', roadColor: '#b9773f', wallColors: ['#9c4a22', '#d8dee6'], sky: '#e7b37a',
    props: ['prop-rock', 'prop-wreck', 'prop-canyonrock', 'prop-skullpole', 'prop-guzzoline'],
    music: 'music-chase',
  },
  {
    id: 'gastown', name: 'Gas Town', card: 'comic-c2-1', emoji: '⛽',
    ground: 'ground-refinery', road: 'road-junk',
    groundColor: '#5a4a40', roadColor: '#6d6662', wallColors: ['#ff7a1a', '#2b2b2b'], sky: '#3a2a24',
    props: ['prop-refinery', 'prop-firepipe', 'prop-guzzoline', 'prop-warboys', 'prop-barrel'],
    music: 'music-junkyard',
  },
  {
    id: 'bulletfarm', name: 'The Bullet Farm', card: 'comic-c3-1', emoji: '⛏️',
    ground: 'ground-mine', road: 'road-dirt',
    groundColor: '#6b4a32', roadColor: '#8a6a4a', wallColors: ['#c9a227', '#2b2b2b'], sky: '#2a1d16',
    props: ['prop-searchlight', 'prop-minecart', 'prop-wreck', 'prop-rock', 'prop-guzzoline'],
    music: 'music-volcano',
  },
  {
    id: 'saltflats', name: 'The Salt Flats', card: 'comic-c4-1', emoji: '🧂',
    ground: 'ground-salt', road: 'road-fury',
    groundColor: '#e8e2d6', roadColor: '#c9a07a', wallColors: ['#9c4a22', '#f4f1ea'], sky: '#f0d8b0',
    props: ['prop-saltrock', 'prop-wreck', 'prop-skullpole', 'prop-vuvalini'],
    music: 'music-fury',
  },
  {
    id: 'bog', name: 'The Bog', card: 'comic-c4-3', emoji: '🐦‍⬛',
    ground: 'ground-swamp', road: 'road-swamp',
    groundColor: '#3a4a3a', roadColor: '#6b5a45', wallColors: ['#5a6a5a', '#1c1c1c'], sky: '#1c2a2a',
    props: ['prop-crow', 'prop-deadtree', 'prop-crow', 'prop-wreck'],
    music: 'music-swamp',
  },
  {
    id: 'canyon', name: 'Canyon Pass', card: 'world-fury', emoji: '🪨',
    ground: 'ground-canyon', road: 'road-fury',
    groundColor: '#b5562e', roadColor: '#b9773f', wallColors: ['#7a3b1e', '#d8dee6'], sky: '#e59a6a',
    props: ['prop-canyonrock', 'prop-canyonrock', 'prop-rock', 'prop-wreck'],
    music: 'music-chase',
  },
];

export const worldById = (id: string) => WORLDS.find((w) => w.id === id) ?? THEMES.find((w) => w.id === id)!;
