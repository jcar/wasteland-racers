import type { Scene } from '../Game';
import type { StoryEvent } from '../data/story';
import { trackById } from '../data/tracks';
import { worldById } from '../data/worlds';
import { speak } from '../audio/voice';
import { EventScene, type Entry, type Mode } from '../race/EventScene';
import { TrackGeometry } from '../race/trackGeometry';
import { FINISH_GAP, trackSvg } from '../race/trackMesh';
import type { Fighter } from '../race/weapons';
import { storyAiSpeed } from '../systems/Economy';
import { state } from '../systems/GameState';
import { addCrew, raiderGadget, raiders, starsForWrecks } from './common';
import { storyFinish } from './storyFinish';
import { applyVariants } from './variants';

/**
 * Chase: a War Party is right behind you. Get down the road to the finish.
 * Getting wrecked only costs time; you always get there in the end.
 */
export class ChaseMode implements Mode {
  readonly geo: TrackGeometry;
  readonly ground: TrackGeometry;
  readonly world;
  readonly laps = 1;
  readonly music = 'music-chase';
  readonly variants;
  private event: StoryEvent;
  private started = false;

  constructor(event: StoryEvent) {
    this.event = event;
    this.geo = this.ground = new TrackGeometry(trackById(event.track!));
    this.world = worldById(this.geo.def.world);
    this.variants = event.variants ?? [];
  }

  intro() {
    return { portrait: this.event.introBy, emoji: '💀', line: this.event.intro };
  }

  setup(core: EventScene) {
    const p = core.addPlayer();
    p.body.place(this.geo, 34, 0);
    addCrew(core, (e, i) => e.body.place(this.geo, 27 - i * 6, i ? -4.5 : 4.5));
    const ch = this.event.chapter;
    const speed = storyAiSpeed(ch, state.data.settings.difficulty) + 1;
    raiders(3 + Math.floor(ch / 2), ch, 'wp').forEach((r, i) => {
      const e = core.addOpponent(r, raiderGadget(r), { engine: 1, tires: 1, armor: 0, gadget: 0 });
      e.body.place(this.geo, 6 + (i % 3) * 5, ((i % 2) * 2 - 1) * 4);
      e.body.charges = 1;
      core.driveOnTrack(e, speed + (i % 3) * 0.6, [0.5, -0.5, 0][i % 3]);
    });
    applyVariants(core, this.variants);
  }

  update(core: EventScene) {
    if (!this.started) {
      this.started = true;
      core.hud.showOrder(false);
      speak('chase-start', { priority: 1 });
    }
    const p = core.player.body;
    const left = Math.max(0, this.geo.length - FINISH_GAP - p.pos.s);
    core.hud.setStatus(`🏁 ${Math.round(100 - (left / (this.geo.length - FINISH_GAP - 34)) * 100)}%`);
    if (left <= 0) core.end('ESCAPED!');
  }

  order(core: EventScene): Entry[] {
    return [...core.fighters].sort((a, b) => b.body.pos.s - a.body.pos.s);
  }

  progress(_core: EventScene, f: Fighter) {
    return f.body.pos.s;
  }

  finish(core: EventScene): Scene {
    return storyFinish(core, this.event, { stars: starsForWrecks(core.timesWrecked), won: true, detail: core.timesWrecked ? `Wrecked ${core.timesWrecked}×` : 'Never wrecked!' });
  }

  restart(): Scene {
    return new EventScene(new ChaseMode(this.event));
  }

  minimap() {
    return trackSvg(this.geo, 190, 7);
  }
}
