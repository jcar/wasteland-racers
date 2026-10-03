import * as THREE from 'three';
import type { Scene } from '../Game';
import { arenaById } from '../data/arenas';
import type { StoryEvent } from '../data/story';
import { worldById } from '../data/worlds';
import { toon } from '../art/materials';
import { sfx } from '../audio/sfx';
import { speak } from '../audio/voice';
import { arenaSvg } from '../race/arenaMesh';
import type { CarEvent } from '../race/CarBody';
import { EventScene, type Entry, type Mode } from '../race/EventScene';
import { ArenaGround } from '../race/ground';
import type { Fighter } from '../race/weapons';
import { storyAiSpeed } from '../systems/Economy';
import { state } from '../systems/GameState';
import { raiderGadget, raiders, steerToward } from './common';
import { storyFinish } from './storyFinish';
import { applyVariants } from './variants';

const TIME = 75;
const CANS = 7;

interface Can { mesh: THREE.Group; x: number; z: number }

/**
 * Arena Smash: guzzoline cans are scattered around a walled pit. Grab the
 * most before time runs out. Get hit and you drop some; wreck someone and
 * their cans spill everywhere.
 */
export class ArenaMode implements Mode {
  readonly arena: ArenaGround;
  readonly ground: ArenaGround;
  readonly world;
  readonly laps = 0;
  readonly music = 'music-boss';
  readonly variants;
  private event: StoryEvent;
  private cans: Can[] = [];
  private timeLeft = TIME;
  private started = false;
  private announcedLead = false;
  /** AI cars stop for a moment after grabbing a can (it gives kids a fair chance). */
  private refuel = new Map<Entry, number>();

  constructor(event: StoryEvent) {
    this.event = event;
    this.arena = this.ground = new ArenaGround(arenaById(event.arena!));
    this.world = worldById(this.arena.def.theme);
    this.variants = event.variants ?? [];
    // Steer help points you at the nearest can.
    this.arena.aim = (x, z) => this.nearestCan(x, z);
  }

  intro() {
    return { portrait: this.event.introBy, emoji: '⛽', line: this.event.intro };
  }

  setup(core: EventScene) {
    const p = core.addPlayer();
    const R = Math.min(this.arena.halfW, this.arena.halfH) - 12;
    p.body.placeAt(this.arena, 0, R, -Math.PI / 2);
    const ch = this.event.chapter;
    const speed = storyAiSpeed(ch, state.data.settings.difficulty) * 0.78;
    raiders(3, ch, 'ar').forEach((r, i) => {
      const e = core.addOpponent(r, raiderGadget(r), { engine: 1, tires: 1, armor: 0, gadget: 0 });
      const a = Math.PI / 2 + ((i + 1) / 4) * Math.PI * 2;
      e.body.placeAt(this.arena, Math.cos(a) * R, Math.sin(a) * R, a + Math.PI);
      e.body.stats.maxSpeed = speed;
      e.brain = () => this.think(core, e);
    });
    for (let i = 0; i < CANS; i++) this.addCan(core);
    for (let i = 0; i < 4; i++) {
      const spot = this.arena.randomSpot();
      core.addCrate(spot.x, spot.z, 0, 6);
    }
    applyVariants(core, this.variants);
  }

  private addCan(core: EventScene, at?: { x: number; z: number }) {
    const spot = at ?? this.arena.randomSpot();
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.9, 1.2, 0.5), toon('#d2201e', { emissive: '#5a0000' }));
    body.castShadow = true;
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.3, 8), toon('#f5c518'));
    cap.position.set(0.25, 0.7, 0);
    g.add(body, cap);
    g.position.set(spot.x, 0.8, spot.z);
    core.view.scene.add(g);
    this.cans.push({ mesh: g, x: spot.x, z: spot.z });
  }

  private nearestCan(x: number, z: number) {
    let best: Can | undefined, bd = Infinity;
    for (const c of this.cans) {
      const d = Math.hypot(c.x - x, c.z - z);
      if (d < bd) { bd = d; best = c; }
    }
    return best && { x: best.x, z: best.z };
  }

  /** AI: go for the nearest can; sometimes hunt whoever is winning. */
  private think(core: EventScene, e: Entry) {
    const b = e.body;
    if ((this.refuel.get(e) ?? 0) > core.raceTime) return { steer: 0, gas: 0, brake: true };
    const leader = this.order(core)[0];
    if (leader !== e && leader.score >= e.score + 3 && Math.hypot(leader.body.x - b.x, leader.body.z - b.z) < 18) return steerToward(b, leader.body.x, leader.body.z);
    const can = this.nearestCan(b.x, b.z);
    return can ? steerToward(b, can.x, can.z) : { steer: 0.3, gas: 0.6, brake: false };
  }

  update(core: EventScene, dt: number) {
    if (!this.started) {
      this.started = true;
      speak('arena-start', { priority: 1 });
    }
    this.timeLeft -= dt;
    const spin = core.raceTime * 3;
    for (let i = this.cans.length - 1; i >= 0; i--) {
      const c = this.cans[i];
      c.mesh.rotation.y = spin;
      c.mesh.position.y = 0.9 + Math.sin(spin + c.x) * 0.2;
      for (const e of core.fighters) {
        const b = e.body;
        if (b.wrecked > 0 || b.towing > 0 || Math.hypot(b.x - c.x, b.z - c.z) > 2.3) continue;
        e.score++;
        if (!e.isPlayer) this.refuel.set(e, core.raceTime + 0.9);
        core.view.scene.remove(c.mesh);
        this.cans.splice(i, 1);
        core.effects.sparkle(c.x, 0, c.z, '#ff4d4d', 8);
        if (e.isPlayer) { sfx.bolt(); speak('world-guzzoline', { priority: 0, cooldown: 4 }); }
        break;
      }
    }
    while (this.cans.length < CANS) this.addCan(core);
    const p = core.player;
    const lead = this.order(core)[0] === p && p.score > 0;
    if (lead && !this.announcedLead) speak('lead', { priority: 0, cooldown: 20 });
    this.announcedLead = lead;
    core.hud.setStatus(`⛽ ${p.score} · ⏱ ${Math.max(0, Math.ceil(this.timeLeft))}`);
    if (this.timeLeft <= 0) {
      const place = this.order(core).indexOf(p) + 1;
      core.end(place === 1 ? 'YOU WIN!' : 'TIME!');
    }
  }

  onEvent(core: EventScene, e: Entry, ev: CarEvent) {
    // Getting hit spills cans; getting wrecked spills half of them.
    // (A hit always comes with a spin, so 'spin' covers hits, goo and boings.)
    if ((ev !== 'wreck' && ev !== 'spin') || e.score <= 0) return;
    const drop = ev === 'wreck' ? Math.ceil(e.score / 2) : 1;
    e.score -= drop;
    for (let i = 0; i < drop; i++) {
      const a = Math.random() * Math.PI * 2, d = 4 + Math.random() * 5;
      const x = e.body.x + Math.cos(a) * d, z = e.body.z + Math.sin(a) * d;
      const inside = this.ground.contain(x, z, this.ground.locate(), 2) ? this.arena.randomSpot() : { x, z };
      this.addCan(core, inside);
    }
    if (e.isPlayer) speak('arena-drop', { priority: 0, cooldown: 10 });
  }

  order(core: EventScene): Entry[] {
    return [...core.fighters].sort((a, b) => b.score - a.score);
  }

  progress(_core: EventScene, f: Fighter) {
    return (f as Entry).score;
  }

  finish(core: EventScene): Scene {
    const order = this.order(core);
    const place = order.indexOf(core.player) + 1;
    return storyFinish(core, this.event, { stars: place === 1 ? 3 : place === 2 ? 2 : 1, won: place === 1, place, order: order.map((e) => e.racer), detail: `⛽ ${core.player.score} cans` });
  }

  restart(): Scene {
    return new EventScene(new ArenaMode(this.event));
  }

  minimap() {
    return arenaSvg(this.arena, 190);
  }
}
