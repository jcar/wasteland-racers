import type { Scene } from '../Game';
import { carStats } from '../systems/Economy';
import type { StoryEvent } from '../data/story';
import { trackById } from '../data/tracks';
import { worldById } from '../data/worlds';
import { sfx } from '../audio/sfx';
import { speak } from '../audio/voice';
import type { AIDriver } from '../race/AIDriver';
import type { CarEvent } from '../race/CarBody';
import { EventScene, type Entry, type Mode } from '../race/EventScene';
import { TrackGeometry } from '../race/trackGeometry';
import { FINISH_GAP, trackSvg } from '../race/trackMesh';
import type { Fighter } from '../race/weapons';
import { storyAiSpeed } from '../systems/Economy';
import { state } from '../systems/GameState';
import { addCrew, raiderGadget, raiders } from './common';
import { storyFinish } from './storyFinish';
import { applyVariants } from './variants';

const RIG_ARMOR = 100;

/**
 * Escort: Furiosa drives the War Rig down the road while raiders try to
 * wreck it. Knock them away. The Rig never gives up: damage just slows it,
 * and it waits for you if you fall behind.
 */
export class EscortMode implements Mode {
  readonly geo: TrackGeometry;
  readonly ground: TrackGeometry;
  readonly world;
  readonly laps = 1;
  readonly music: string = 'music-chase';
  readonly variants;
  protected event: StoryEvent;
  protected rig!: Entry;
  protected rigAi!: AIDriver;
  protected rigSpeed: number;
  protected spawnT = 6;
  protected spawned = 0;
  protected maxRaiders: number;
  private started = false;
  private lastRigHit = -9;
  private raiderNames: ReturnType<typeof raiders>;

  constructor(event: StoryEvent) {
    this.event = event;
    this.geo = this.ground = new TrackGeometry(trackById(event.track!));
    this.world = worldById(this.geo.def.world);
    this.variants = event.variants ?? [];
    this.rigSpeed = storyAiSpeed(event.chapter, state.data.settings.difficulty) * 0.72;
    this.maxRaiders = 6 + event.chapter * 2;
    this.raiderNames = raiders(this.maxRaiders, event.chapter, 'rd');
  }

  intro() {
    return { portrait: this.event.introBy, emoji: '🚛', line: this.event.intro };
  }

  setup(core: EventScene) {
    const stats = carStats({ car: 'rig', upgrades: { engine: 0, tires: 2, armor: 4, gadget: 0 } });
    stats.mass = 6;
    this.rig = core.addRacer(
      { id: 'warrig', name: 'War Rig', portrait: 'car-rig', emoji: '🚛', color: '#c75a22', isPlayer: false },
      { body: 'rig', paint: '#9c4a22', upgrades: { engine: 3, tires: 3, armor: 3, gadget: 0 }, head: { skin: '#e8c0a0', hat: '#1c1c1c', kind: 'furiosa' } },
      'boost',
      stats,
    );
    this.rig.armed = false;
    this.rig.team = 'player';
    this.rig.score = RIG_ARMOR;
    this.rig.body.place(this.geo, 30, 3);
    this.rigAi = core.driveOnTrack(this.rig, this.rigSpeed, 0.15, false);
    const p = core.addPlayer();
    p.team = 'player';
    p.body.place(this.geo, 22, -4);
    addCrew(core, (e, i) => e.body.place(this.geo, 15 - i * 6, i ? 4 : -5));
    applyVariants(core, this.variants);
  }

  update(core: EventScene, dt: number) {
    if (!this.started) {
      this.started = true;
      core.hud.showOrder(false);
      speak('escort-start', { priority: 1 });
    }
    const rb = this.rig.body, pb = core.player.body;
    // The Rig slows when hurt, and waits if you're far behind.
    const behind = rb.pos.s - pb.pos.s;
    const wait = behind > 45 ? 0.45 : behind > 30 ? 0.75 : 1;
    this.rigAi.baseSpeed = this.rigSpeed * (0.6 + 0.4 * (this.rig.score / RIG_ARMOR)) * wait;

    // Raiders join from behind, a few at a time.
    this.spawnT -= dt;
    const active = core.fighters.filter((e) => e.racer.id.startsWith('rd')).length;
    if (this.spawnT <= 0 && this.spawned < this.maxRaiders && active < 3 && rb.pos.s < this.geo.length - 150) {
      this.spawnT = 7 + Math.random() * 3;
      this.spawnRaider(core);
    }
    // Raiders hold the Rig's lane and ram it.
    for (const e of core.fighters) {
      if (!e.racer.id.startsWith('rd')) continue;
      const ai = (e as Entry & { ai?: AIDriver }).ai;
      if (!ai) continue;
      ai.lane = Math.max(-0.8, Math.min(0.8, -rb.pos.lateral / (this.geo.halfWidth - 2.5)));
      const close = Math.abs(e.body.pos.s - rb.pos.s) < 8;
      e.body.ram = close ? 0.5 : 0;
    }
    core.hud.setBar('WAR RIG', this.rig.score / RIG_ARMOR, '#c75a22');
    const left = Math.max(0, this.geo.length - FINISH_GAP - rb.pos.s);
    core.hud.setStatus(`🏁 ${Math.round(100 - (left / (this.geo.length - FINISH_GAP - 30)) * 100)}%`);
    if (left <= 0) this.arrived(core);
  }

  protected arrived(core: EventScene) {
    core.end('RIG DELIVERED!');
  }

  protected spawnRaider(core: EventScene) {
    const r = this.raiderNames[this.spawned++];
    const e = core.addOpponent(r, raiderGadget(r), { engine: 1, tires: 1, armor: 0, gadget: 0 });
    const rb = this.rig.body;
    e.body.place(this.geo, Math.max(2, rb.pos.s - 45), (Math.random() * 2 - 1) * 4);
    e.body.charges = 1;
    const ai = core.driveOnTrack(e, this.rigSpeed + 9, 0, false);
    (e as Entry & { ai?: AIDriver }).ai = ai;
    // They chase the Rig, not the player.
    e.brain = (dt) => ai.think(dt, this.geo, rb.pos.s);
  }

  /** Hits on the Rig wear down its armor instead of wrecking it. */
  hurt(core: EventScene, target: Entry, _by: Entry | undefined, damage: number) {
    if (target !== this.rig) return false;
    // A raider leaning on the Rig only counts once in a while.
    if (this.rig.score <= 0 || core.raceTime - this.lastRigHit < 0.8) return true;
    this.lastRigHit = core.raceTime;
    this.rig.score = Math.max(0, this.rig.score - damage * 7);
    core.effects.sparkle(target.body.x, target.body.y + 1, target.body.z, '#ffb347', 8);
    sfx.bump();
    speak('escort-hit', { priority: 0, cooldown: 14 });
    return true;
  }

  onEvent(core: EventScene, e: Entry, ev: CarEvent) {
    // Wrecked raiders are out for good.
    if (ev === 'respawn' && e.racer.id.startsWith('rd')) core.removeEntry(e);
  }

  order(core: EventScene): Entry[] {
    return [...core.fighters].sort((a, b) => b.body.pos.s - a.body.pos.s);
  }

  progress(_core: EventScene, f: Fighter) {
    return f.body.pos.s;
  }

  protected stars() {
    const armor = this.rig.score / RIG_ARMOR;
    return armor > 0.7 ? 3 : armor > 0.35 ? 2 : 1;
  }

  finish(core: EventScene): Scene {
    return storyFinish(core, this.event, { stars: this.stars(), won: true, detail: `Rig armor ${Math.round((this.rig.score / RIG_ARMOR) * 100)}%` });
  }

  restart(): Scene {
    return new EventScene(new EscortMode(this.event));
  }

  minimap() {
    return trackSvg(this.geo, 190, 7);
  }
}
