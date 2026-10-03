import type { SaveData } from '../systems/SaveManager';
import { CARS } from './cars';
import { RIVALS } from './characters';
import { TRACKS, tracksInWorld } from './tracks';
import { THEMES, WORLDS } from './worlds';

/**
 * The Valhalla Book: a card for every character, car and place. Locked
 * cards show as a silhouette with a hint, so there's always something to
 * chase. Unlocks are worked out from the save, so nothing extra to store.
 */
export interface Card {
  id: string;
  section: 'Characters' | 'Cars' | 'Places';
  name: string;
  art: string;
  emoji: string;
  blurb: string;
  /** Voice line played when the card is opened. */
  line?: string;
  /** How to get it, shown while it's locked. */
  hint: string;
  unlocked: (s: SaveData) => boolean;
}

const owns = (id: string) => (s: SaveData) => s.ownedCars.includes(id);
const won = (track: string) => (s: SaveData) => s.best[track] === 1;
const beat = (event: string) => (s: SaveData) => !!s.story?.[event]?.won;
const lastTrack = (world: string) => tracksInWorld(world).at(-1)!.id;

const LORE_CHARACTERS: Card[] = [
  { id: 'max', section: 'Characters', name: 'Max', art: 'driver-max', emoji: '🧔', line: 'card-max', blurb: 'A quiet road warrior who never stops driving. His car: the Interceptor.', hint: 'Get the Interceptor, or pick Max as your driver.', unlocked: (s) => owns('interceptor')(s) || s.driver === 'max' },
  { id: 'furiosa', section: 'Characters', name: 'Furiosa', art: 'driver-furiosa', emoji: '🦾', line: 'card-furiosa', blurb: 'The bravest driver in the Wasteland. She drives the War Rig.', hint: 'Own the War Rig.', unlocked: owns('rig') },
  { id: 'nux', section: 'Characters', name: 'Nux', art: 'driver-nux', emoji: '💀', line: 'card-nux', blurb: 'A wild young War Boy who sprays his teeth chrome and shouts "Witness me!"', hint: 'Get the Nux Car, or pick Nux as your driver.', unlocked: (s) => owns('nuxcar')(s) || s.driver === 'nux' },
  { id: 'warpup', section: 'Characters', name: 'War Pup', art: 'driver-warpup', emoji: '👦', line: 'card-warpup', blurb: 'A little War Boy in training. Dreams of driving a War Rig one day.', hint: 'Win the Citadel Circuit.', unlocked: (s) => won('fury-1')(s) || s.driver === 'warpup' },
  { id: 'doof', section: 'Characters', name: 'The Doof Warrior', art: 'driver-doof', emoji: '🎸', line: 'card-doof', blurb: 'He plays a fire-breathing guitar on the front of the Doof Wagon.', hint: 'Get the Doof Wagon.', unlocked: owns('doof') },
  { id: 'toast', section: 'Characters', name: 'Toast', art: 'driver-toast', emoji: '🧕', line: 'card-toast', blurb: 'Toast the Knowing. Clever, quick, and always one step ahead.', hint: 'Win the whole Fury Road.', unlocked: (s) => s.rewards.includes('v8') || s.driver === 'toast' },
  { id: 'slit', section: 'Characters', name: 'Slit', art: 'char-slit', emoji: '😬', line: 'card-slit', blurb: 'A grumpy War Boy lancer. Loves his harpoon.', hint: 'Beat Slit in Gas Town Gauntlet.', unlocked: won('fury-2') },
  { id: 'rictus', section: 'Characters', name: 'Rictus', art: 'char-rictus', emoji: '💪', line: 'card-rictus', blurb: "Immortan Joe's giant son. Drives Big Foot and loves to stomp.", hint: 'Beat Rictus in Bullet Farm Blitz, or in his ring.', unlocked: (s) => won('fury-3')(s) || beat('c1-boss')(s) },
  { id: 'bulletfarmer', section: 'Characters', name: 'The Bullet Farmer', art: 'char-bulletfarmer', emoji: '🕶️', line: 'card-bulletfarmer', blurb: 'Boss of the Bullet Farm. Rides the armored Peacemaker.', hint: 'Get the Peacemaker.', unlocked: owns('peacemaker') },
  { id: 'peopleeater', section: 'Characters', name: 'The People Eater', art: 'char-peopleeater', emoji: '🧮', line: 'card-peopleeater', blurb: 'The greedy boss of Gas Town. Counts every drop of guzzoline.', hint: 'Beat the People Eater in Gas Town.', unlocked: (s) => s.totalChrome >= 40 || beat('c2-boss')(s) },
  { id: 'dementus', section: 'Characters', name: 'Dementus', art: 'char-dementus', emoji: '🧸', line: 'card-dementus', blurb: 'A showy biker warlord with a cape, a chariot, and a little teddy bear.', hint: "Get Dementus's Chariot.", unlocked: owns('chariot') },
  { id: 'joe', section: 'Characters', name: 'Immortan Joe', art: 'char-joe', emoji: '😷', line: 'card-joe', blurb: 'The masked ruler of the Citadel. Drives the mighty Gigahorse.', hint: 'Get the Gigahorse.', unlocked: owns('gigahorse') },
];

const SEASON1_RIVALS: Card[] = RIVALS.map((r) => {
  const track = TRACKS.find((t) => t.rival === r.id)!;
  return { id: r.id, section: 'Characters' as const, name: r.name, art: r.portrait, emoji: r.emoji, line: `${r.id}-intro`, blurb: `Rival of ${WORLDS.find((w) => w.id === track.world)!.name}.`, hint: `Beat ${r.name} in ${track.name}.`, unlocked: won(track.id) };
});

const CAR_CARDS: Card[] = CARS.map((c) => ({
  id: `car-${c.id}`, section: 'Cars' as const, name: c.name, art: c.card ?? '', emoji: c.emoji,
  blurb: c.lore ? 'A Wasteland legend, with its own special move.' : 'A trusty garage car.',
  hint: c.chrome ? `Buy it for ${c.chrome} chrome.` : `Buy it for ${c.price} scrap.`,
  unlocked: owns(c.id),
}));

const PLACE_CARDS: Card[] = WORLDS.map((w) => ({
  id: `place-${w.id}`, section: 'Places' as const, name: w.name, art: w.card, emoji: w.emoji,
  blurb: `${tracksInWorld(w.id).length} races to win here.`,
  hint: `Win every race in ${w.name}.`,
  unlocked: won(lastTrack(w.id)),
}));

/** Story locations, found by playing the chapters. */
const STORY_PLACES: Card[] = [
  ['gastown', 'c2-race'], ['bulletfarm', 'c3-race'], ['saltflats', 'c4-escort'], ['bog', 'c4-bog'], ['canyon', 'c4-chase'],
].map(([id, ev]) => {
  const t = THEMES.find((w) => w.id === id)!;
  return { id: `place-${id}`, section: 'Places' as const, name: t.name, art: t.card, emoji: t.emoji, blurb: 'A place on the Wasteland map.', hint: 'Keep going through the story.', unlocked: beat(ev) };
});

export const CARDS: Card[] = [...LORE_CHARACTERS, ...SEASON1_RIVALS, ...CAR_CARDS, ...PLACE_CARDS, ...STORY_PLACES];
