import type { Scene } from '../Game';
import { EXTRAS, RIVALS, WAR_BOYS, rivalById, type Racer } from '../data/characters';
import type { StoryEvent } from '../data/story';
import { trackById, trackIndex } from '../data/tracks';
import { worldById } from '../data/worlds';
import { sfx } from '../audio/sfx';
import { speak } from '../audio/voice';
import type { CarEvent } from '../race/CarBody';
import { EventScene, type Entry, type Mode } from '../race/EventScene';
import { TrackGeometry } from '../race/trackGeometry';
import { trackSvg } from '../race/trackMesh';
import type { Fighter } from '../race/weapons';
import { aiSpeed, storyAiSpeed } from '../systems/Economy';
import { state } from '../systems/GameState';
import { PodiumScene } from '../scenes/PodiumScene';
import { applyVariants } from './variants';
import { storyFinish } from './storyFinish';

/** Gadgets the AI racers use. */
export const AI_GADGET: Record<string, string> = {
  rex: 'boost', muffler: 'boing', bertha: 'goo', warlord: 'boing', dusty: 'boost', nutsy: 'goo', sparky: 'boost', rattles: 'boing',
  slit: 'harpoon', rictus: 'stomp', morsov: 'thunder', ace: 'caltrops', corpus: 'thunder', doofwagon: 'boost',
};

const DOOF_WAGON: Racer = { id: 'doofwagon', name: 'The Doof Warrior', portrait: 'driver-doof', emoji: '🎸', color: '#1c1c1c', body: 'doof', head: { skin: '#d22b2b', hat: '#1c1c1c', kind: 'doof' }, skill: 0.6, rival: true };

/** A classic lap race: first across the line after the last lap wins. */
export class LapMode implements Mode {
  readonly geo: TrackGeometry;
  readonly ground: TrackGeometry;
  readonly world;
  readonly laps: number;
  readonly music: string;
  readonly variants;
  protected finishOrder: Entry[] = [];
  private lastPlace = 0;
  protected trackId: string;
  protected event?: StoryEvent;

  constructor(trackId: string, event?: StoryEvent) {
    this.trackId = trackId;
    this.event = event;
    const def = trackById(trackId);
    this.geo = this.ground = new TrackGeometry(def);
    this.world = worldById(def.world);
    this.laps = def.laps;
    this.music = this.world.music;
    this.variants = event?.variants ?? [];
  }

  intro() {
    const def = this.geo.def;
    if (this.event) return { portrait: this.event.introBy, emoji: '🏁', line: this.event.intro };
    const rival = def.rival ? rivalById(def.rival) : undefined;
    if (rival) return { portrait: rival.portrait, emoji: rival.emoji, line: `${rival.id}-intro` };
    if (def.world === 'fury') return { portrait: 'driver-furiosa', emoji: '🦾', line: 'fury-intro' };
    if (def.world === 'dome') return { portrait: 'announcer', emoji: '🎤', line: 'dome-intro' };
    return undefined;
  }

  setup(core: EventScene) {
    const def = this.geo.def;
    const s = state.data;
    const idx = Math.max(0, trackIndex(this.trackId));
    // Opponents: the world's rival (all of them in the Thunder Dome) plus extras.
    let opponents: Racer[];
    if (def.world === 'dome') opponents = [...RIVALS];
    else {
      const rival = def.rival ? rivalById(def.rival) : undefined;
      const pool = ['dunes', 'junkyard', 'swamp', 'volcano'].includes(def.world) ? EXTRAS : WAR_BOYS;
      const extras = [...pool.slice(idx % pool.length), ...pool.slice(0, idx % pool.length)];
      opponents = rival ? [rival, ...extras.slice(0, 2)] : extras.slice(0, 3);
    }
    // The Doof Run is led by the Doof Wagon itself, guitar blazing.
    if (this.variants.includes('doof')) opponents[0] = DOOF_WAGON;
    core.addPlayer();
    const base = this.event ? storyAiSpeed(this.event.chapter, s.settings.difficulty) : aiSpeed(this.trackId, s.settings.difficulty);
    for (const [i, r] of opponents.entries()) {
      const e = core.addOpponent(r, AI_GADGET[r.id] ?? 'boost', r.rival ? { engine: 2, tires: 2, armor: 2, gadget: 3 } : { engine: i % 3, tires: 1, armor: 0, gadget: 0 });
      core.driveOnTrack(e, base + r.skill, [0.5, -0.5, 0.2, -0.2][i % 4]);
    }
    // Starting grid, two by two behind the line. The player starts in the second row.
    const order = core.entries.filter((e) => !e.isPlayer);
    order.splice(Math.min(2, order.length), 0, core.player);
    order.forEach((e, i) => {
      const row = Math.floor(i / 2);
      e.body.place(this.geo, this.geo.length - 5 - row * 7, i % 2 ? -3.5 : 3.5);
    });
    applyVariants(core, this.variants);
  }

  update(core: EventScene, _dt = 0) {
    const place = this.order(core).indexOf(core.player) + 1;
    if (core.raceTime > 4 && this.lastPlace && place < this.lastPlace) {
      if (place === 1) speak('lead', { priority: 1, cooldown: 25 });
      else speak('passed', { priority: 0, cooldown: 15 });
    }
    this.lastPlace = place;
  }

  onEvent(core: EventScene, e: Entry, ev: CarEvent) {
    const b = e.body;
    const mine = e === core.player;
    if (ev === 'lap' && mine && !b.finished && b.lap > 0) {
      if (b.lap === this.laps - 1) {
        core.hud.show('FINAL LAP!', 1.8, true);
        speak('final-lap', { priority: 2 });
      } else core.hud.show(`LAP ${b.lap + 1}`, 1.2, true);
      sfx.lap();
    }
    if (ev === 'finish') {
      b.finishTime = core.raceTime;
      this.finishOrder.push(e);
      if (mine) {
        const place = this.finishOrder.indexOf(e) + 1;
        core.end(place === 1 ? 'YOU WIN!' : 'FINISH!');
        if (place === 1) sfx.fanfare();
      }
    }
  }

  order(core: EventScene): Entry[] {
    const rest = core.fighters.filter((e) => !this.finishOrder.includes(e));
    rest.sort((a, b) => b.body.progress(this.geo) - a.body.progress(this.geo));
    return [...this.finishOrder, ...rest];
  }

  progress(_core: EventScene, f: Fighter) {
    return f.body.progress(this.geo);
  }

  finish(core: EventScene): Scene {
    const order = this.order(core);
    const place = this.finishOrder.indexOf(core.player) + 1;
    if (this.event) return storyFinish(core, this.event, { stars: place === 1 ? 3 : place === 2 ? 2 : 1, won: place === 1, place, order: order.map((e) => e.racer) });
    return new PodiumScene({ trackId: this.trackId, order: order.map((e) => e.racer), place, bolts: core.player.body.bolts, wrecks: core.wrecks });
  }

  restart(): Scene {
    return new EventScene(new LapMode(this.trackId, this.event));
  }

  minimap() {
    return trackSvg(this.geo, 190, 7);
  }
}
