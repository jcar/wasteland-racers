/**
 * Season 2's story: five chapters across the Wasteland. Each chapter opens
 * with comic panels, has a few events you drive to on the map, and ends
 * with a boss. Beating a boss opens the next chapter (and gives you the
 * boss's car).
 */
export type EventMode = 'race' | 'chase' | 'escort' | 'arena' | 'boss';
export type BossId = 'rictus' | 'peopleeater' | 'bulletfarmer' | 'joe' | 'dementus';
export type Variant = 'night' | 'sandstorm' | 'doof' | 'firejets' | 'crows';

export interface StoryEvent {
  id: string;
  chapter: number;
  name: string;
  mode: EventMode;
  /** Race and road events. */
  track?: string;
  /** Arena and arena-boss events. */
  arena?: string;
  boss?: BossId;
  variants?: Variant[];
  /** Voice line and portrait for the intro card. */
  intro: string;
  introBy: string;
  /** Where the marker stands on the Wasteland map. */
  at: [number, number];
  reward: { scrap: number; chrome: number; guzzoline: number; car?: string };
}

export interface ComicPanel {
  image: string;
  line: string;
  portrait: string;
}

export interface Chapter {
  n: number;
  name: string;
  /** Where the camera/arrow points when the chapter opens. */
  home: [number, number];
  panels: ComicPanel[];
}

export const CHAPTERS: Chapter[] = [
  {
    n: 1, name: 'The Citadel', home: [0, -420],
    panels: [
      { image: 'comic-c1-1', line: 'comic-c1-1', portrait: 'char-joe' },
      { image: 'comic-c1-2', line: 'comic-c1-2', portrait: 'announcer' },
      { image: 'comic-c1-3', line: 'comic-c1-3', portrait: 'driver-nux' },
    ],
  },
  {
    n: 2, name: 'Gas Town', home: [540, -80],
    panels: [
      { image: 'comic-c2-1', line: 'comic-c2-1', portrait: 'char-peopleeater' },
      { image: 'comic-c2-2', line: 'comic-c2-2', portrait: 'driver-furiosa' },
      { image: 'comic-c2-3', line: 'comic-c2-3', portrait: 'announcer' },
    ],
  },
  {
    n: 3, name: 'The Bullet Farm', home: [-540, -60],
    panels: [
      { image: 'comic-c3-1', line: 'comic-c3-1', portrait: 'char-bulletfarmer' },
      { image: 'comic-c3-2', line: 'comic-c3-2', portrait: 'announcer' },
      { image: 'comic-c3-3', line: 'comic-c3-3', portrait: 'driver-max' },
    ],
  },
  {
    n: 4, name: 'Fury Road', home: [0, 300],
    panels: [
      { image: 'comic-c4-1', line: 'comic-c4-1', portrait: 'driver-furiosa' },
      { image: 'comic-c4-2', line: 'comic-c4-2', portrait: 'char-joe' },
      { image: 'comic-c4-3', line: 'comic-c4-3', portrait: 'driver-nux' },
    ],
  },
  {
    n: 5, name: "Dementus's Horde", home: [100, 80],
    panels: [
      { image: 'comic-c5-1', line: 'comic-c5-1', portrait: 'char-dementus' },
      { image: 'comic-c5-2', line: 'comic-c5-2', portrait: 'char-dementus' },
      { image: 'comic-c5-3', line: 'comic-c5-3', portrait: 'driver-furiosa' },
    ],
  },
];

/** Shown after the last boss. */
export const FINALE: ComicPanel[] = [
  { image: 'comic-end-1', line: 'comic-end-1', portrait: 'announcer' },
  { image: 'comic-end-2', line: 'comic-end-2', portrait: 'driver-nux' },
  { image: 'comic-end-3', line: 'comic-end-3', portrait: 'announcer' },
];

const R = (scrap: number, chrome: number, guzzoline: number, car?: string) => ({ scrap, chrome, guzzoline, car });

export const EVENTS: StoryEvent[] = [
  // Chapter 1: The Citadel
  { id: 'c1-race', chapter: 1, name: 'Citadel Circuit', mode: 'race', track: 'fury-1', intro: 'ev-c1-race', introBy: 'driver-nux', at: [-110, -390], reward: R(120, 3, 10) },
  { id: 'c1-chase', chapter: 1, name: 'War Boy Ambush', mode: 'chase', track: 'road-citadel', intro: 'ev-c1-chase', introBy: 'char-slit', at: [110, -370], reward: R(140, 3, 15) },
  { id: 'c1-arena', chapter: 1, name: 'Citadel Pit Smash', mode: 'arena', arena: 'pit-citadel', intro: 'ev-c1-arena', introBy: 'announcer', at: [0, -310], reward: R(120, 3, 20) },
  { id: 'c1-boss', chapter: 1, name: 'Rictus & Big Foot', mode: 'boss', boss: 'rictus', arena: 'arena-bigfoot', intro: 'boss-rictus-intro', introBy: 'char-rictus', at: [0, -450], reward: R(250, 8, 30, 'bigfoot') },
  // Chapter 2: Gas Town
  { id: 'c2-race', chapter: 2, name: 'Gas Town Gauntlet', mode: 'race', track: 'fury-2', intro: 'ev-c2-race', introBy: 'char-slit', at: [470, -170], reward: R(130, 3, 10) },
  { id: 'c2-escort', chapter: 2, name: 'Guzzoline Run', mode: 'escort', track: 'road-gastown', intro: 'ev-c2-escort', introBy: 'driver-furiosa', at: [420, -20], reward: R(160, 4, 30) },
  { id: 'c2-doof', chapter: 2, name: 'Doof Run', mode: 'race', track: 'doof-loop', variants: ['doof'], intro: 'ev-c2-doof', introBy: 'driver-doof', at: [640, 40], reward: R(140, 3, 15) },
  { id: 'c2-boss', chapter: 2, name: 'The People Eater', mode: 'boss', boss: 'peopleeater', track: 'refinery', variants: ['firejets'], intro: 'boss-peopleeater-intro', introBy: 'char-peopleeater', at: [620, -160], reward: R(280, 10, 40) },
  // Chapter 3: The Bullet Farm
  { id: 'c3-race', chapter: 3, name: 'Bullet Farm Blitz', mode: 'race', track: 'fury-3', variants: ['night'], intro: 'ev-c3-race', introBy: 'char-rictus', at: [-470, -160], reward: R(140, 3, 10) },
  { id: 'c3-arena', chapter: 3, name: 'Mine Pit Smash', mode: 'arena', arena: 'pit-mine', variants: ['night'], intro: 'ev-c3-arena', introBy: 'announcer', at: [-630, 60], reward: R(140, 3, 25) },
  { id: 'c3-chase', chapter: 3, name: 'Night Raid', mode: 'chase', track: 'road-bulletfarm', variants: ['night'], intro: 'ev-c3-chase', introBy: 'driver-max', at: [-430, 50], reward: R(160, 4, 20) },
  { id: 'c3-boss', chapter: 3, name: 'The Bullet Farmer', mode: 'boss', boss: 'bulletfarmer', arena: 'arena-peacemaker', intro: 'boss-bulletfarmer-intro', introBy: 'char-bulletfarmer', at: [-610, -150], reward: R(300, 10, 40, 'peacemaker') },
  // Chapter 4: Fury Road
  { id: 'c4-escort', chapter: 4, name: 'The Fury Road', mode: 'escort', track: 'road-fury', intro: 'ev-c4-escort', introBy: 'driver-furiosa', at: [-70, 230], reward: R(200, 5, 40) },
  { id: 'c4-storm', chapter: 4, name: 'Into the Storm', mode: 'race', track: 'storm-loop', variants: ['sandstorm'], intro: 'ev-c4-storm', introBy: 'driver-nux', at: [120, 330], reward: R(160, 4, 15) },
  { id: 'c4-bog', chapter: 4, name: 'The Bog at Night', mode: 'race', track: 'bog-loop', variants: ['night', 'crows'], intro: 'ev-c4-bog', introBy: 'driver-max', at: [420, 440], reward: R(160, 4, 15) },
  { id: 'c4-chase', chapter: 4, name: 'Canyon Chase', mode: 'chase', track: 'road-canyon', intro: 'ev-c4-chase', introBy: 'driver-furiosa', at: [-210, 470], reward: R(180, 4, 20) },
  { id: 'c4-boss', chapter: 4, name: 'Immortan Joe', mode: 'boss', boss: 'joe', track: 'road-gigahorse', intro: 'boss-joe-intro', introBy: 'char-joe', at: [-400, 540], reward: R(400, 15, 50, 'gigahorse') },
  // Chapter 5: Dementus's Horde
  { id: 'c5-chase', chapter: 5, name: 'Horde Chase', mode: 'chase', track: 'road-horde', intro: 'ev-c5-chase', introBy: 'char-dementus', at: [230, 110], reward: R(200, 5, 20) },
  { id: 'c5-arena', chapter: 5, name: 'Gas Town Showdown', mode: 'arena', arena: 'pit-gastown', intro: 'ev-c5-arena', introBy: 'char-dementus', at: [680, -20], reward: R(200, 5, 30) },
  { id: 'c5-race', chapter: 5, name: 'Wasteland Rally', mode: 'race', track: 'plains-loop', intro: 'ev-c5-race', introBy: 'driver-max', at: [-160, 110], reward: R(200, 5, 15) },
  { id: 'c5-boss', chapter: 5, name: 'Dementus', mode: 'boss', boss: 'dementus', track: 'chariot-loop', intro: 'boss-dementus-intro', introBy: 'char-dementus', at: [0, 40], reward: R(500, 20, 60, 'chariot') },
];

export const eventById = (id: string) => EVENTS.find((e) => e.id === id)!;
export const chapterEvents = (n: number) => EVENTS.filter((e) => e.chapter === n);
export const bossEvent = (n: number) => EVENTS.find((e) => e.chapter === n && e.mode === 'boss')!;

/** Fixed places on the Wasteland map. */
export const LANDMARKS: { id: string; name: string; at: [number, number]; art: string; scale: number; chapter: number }[] = [
  { id: 'citadel', name: 'The Citadel', at: [0, -560], art: 'lm-citadel', scale: 46, chapter: 1 },
  { id: 'gastown', name: 'Gas Town', at: [600, -80], art: 'lm-gastown', scale: 36, chapter: 2 },
  { id: 'bulletfarm', name: 'The Bullet Farm', at: [-600, -60], art: 'lm-bulletfarm', scale: 34, chapter: 3 },
  { id: 'greenplace', name: 'The Green Place', at: [-470, 640], art: 'lm-greenplace', scale: 30, chapter: 4 },
  { id: 'dome', name: 'Thunder Dome', at: [290, -440], art: 'lm-dome', scale: 30, chapter: 1 },
];

/** Doors on the map that aren't story events. */
export const DOORS: { id: 'garage' | 'classics'; name: string; at: [number, number]; icon: string; emoji: string }[] = [
  { id: 'garage', name: 'Garage', at: [70, -480], icon: 'mk-garage', emoji: '🔧' },
  { id: 'classics', name: 'Thunder Dome Classics', at: [260, -390], icon: 'mk-dome', emoji: '🏟️' },
];

export const START_POS: [number, number] = [0, -260];
