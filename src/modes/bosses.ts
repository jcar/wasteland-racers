import * as THREE from 'three';
import type { Scene } from '../Game';
import { arenaById } from '../data/arenas';
import { WAR_BOYS, type Racer } from '../data/characters';
import type { StoryEvent } from '../data/story';
import { trackById } from '../data/tracks';
import { worldById } from '../data/worlds';
import { sfx } from '../audio/sfx';
import { speak } from '../audio/voice';
import { arenaSvg } from '../race/arenaMesh';
import type { CarEvent } from '../race/CarBody';
import { EventScene, type Entry, type Mode } from '../race/EventScene';
import { ArenaGround } from '../race/ground';
import { TrackGeometry } from '../race/trackGeometry';
import { trackSvg } from '../race/trackMesh';
import type { Fighter } from '../race/weapons';
import { storyAiSpeed } from '../systems/Economy';
import { state } from '../systems/GameState';
import { addCrew, raiders, starsForWrecks, steerToward } from './common';
import { EscortMode } from './escort';
import { LapMode } from './lap';
import { storyFinish } from './storyFinish';
import { applyVariants } from './variants';

/**
 * The five bosses. Each one has a moment when it can be hurt, shown with a
 * glowing ring and a shout from the announcer; the rest of the time hits
 * just bounce off. Touching a boss while it glows counts as a hit, so a kid
 * who mostly holds the gas can still win.
 */

const BOSSES: Record<string, Racer> = {
  rictus: { id: 'boss-rictus', name: 'Rictus', portrait: 'char-rictus', emoji: '💪', color: '#7a3b1e', body: 'bigfoot', head: { skin: '#e8b890', hat: '#3a2a1e', kind: 'rictus' }, skill: 0, rival: true },
  peopleeater: { id: 'boss-peopleeater', name: 'The People Eater', portrait: 'char-peopleeater', emoji: '🧮', color: '#2b2b2b', body: 'limo', head: { skin: '#e0ac7e', hat: '#1c1c1c', kind: 'kid' }, skill: 0, rival: true },
  bulletfarmer: { id: 'boss-bulletfarmer', name: 'The Bullet Farmer', portrait: 'char-bulletfarmer', emoji: '🕶️', color: '#6b6b3a', body: 'peacemaker', head: { skin: '#e2b48c', hat: '#5a3a1e', kind: 'max' }, skill: 0, rival: true },
  joe: { id: 'boss-joe', name: 'Immortan Joe', portrait: 'char-joe', emoji: '😷', color: '#2b2b2b', body: 'gigahorse', head: { skin: '#e8d8c8', hat: '#f4f1ea', kind: 'joe' }, skill: 0, rival: true },
  dementus: { id: 'boss-dementus', name: 'Dementus', portrait: 'char-dementus', emoji: '🧸', color: '#b8281e', body: 'chariot', head: { skin: '#e2b48c', hat: '#a0703a', kind: 'dementus' }, skill: 0, rival: true },
};

/** A pulsing ring under a boss while it can be hurt. */
class WeakSpot {
  readonly ring: THREE.Mesh;
  constructor(scene: THREE.Scene) {
    this.ring = new THREE.Mesh(new THREE.RingGeometry(3, 4.2, 40), new THREE.MeshBasicMaterial({ color: '#ffe14d', transparent: true, opacity: 0.8, side: THREE.DoubleSide, depthWrite: false }));
    this.ring.rotation.x = -Math.PI / 2;
    this.ring.visible = false;
    scene.add(this.ring);
  }
  update(b: { x: number; y: number; z: number }, on: boolean, t: number) {
    this.ring.visible = on;
    if (!on) return;
    this.ring.position.set(b.x, b.y + 0.2, b.z);
    this.ring.scale.setScalar(1 + Math.sin(t * 10) * 0.12);
  }
}

/** Shared boss bookkeeping: hit points, the weak moment, hits and defeat. */
class BossFight {
  boss!: Entry;
  hp: number;
  readonly maxHp: number;
  vulnerable = false;
  defeated = false;
  private spot?: WeakSpot;
  private lastHit = -9;
  private id: string;

  constructor(id: string, hp: number) {
    this.id = id;
    this.hp = this.maxHp = hp;
  }

  spawn(core: EventScene, speed: number, upgrades = { engine: 3, tires: 3, armor: 4, gadget: 0 }) {
    const r = BOSSES[this.id];
    this.boss = core.addOpponent(r, 'boost', upgrades, speed);
    this.boss.armed = false;
    this.boss.body.stats.mass = 5;
    this.spot = new WeakSpot(core.view.scene);
    return this.boss;
  }

  /** Call every frame: draws the ring, and counts a touch from the player as a hit. */
  tick(core: EventScene) {
    const b = this.boss.body;
    this.spot?.update(b, this.vulnerable && !this.defeated, core.raceTime);
    const p = core.player.body;
    if (this.vulnerable && !this.defeated && Math.hypot(p.x - b.x, p.z - b.z) < 4.2) this.hit(core);
    core.hud.setBar(BOSSES[this.id].name.toUpperCase(), this.hp / this.maxHp);
  }

  /** A hit on the boss. Only counts while it's vulnerable. Returns true if it landed. */
  hit(core: EventScene): boolean {
    const b = this.boss.body;
    if (this.defeated) return false;
    if (!this.vulnerable || core.raceTime - this.lastHit < 1.2) {
      core.effects.sparkle(b.x, b.y + 1, b.z, '#c9d0d8', 4);
      return false;
    }
    this.lastHit = core.raceTime;
    this.hp--;
    this.vulnerable = false;
    core.effects.explosion(b.x, b.y, b.z, false);
    sfx.explosion(false);
    core.shake(0.6);
    if (this.hp <= 0) {
      this.defeated = true;
      b.wreck();
      core.effects.explosion(b.x, b.y, b.z, true);
      sfx.explosion(true);
      this.boss.brain = () => ({ steer: 0, gas: 0, brake: true });
      core.end('BOSS DEFEATED!');
    } else {
      speak(Math.random() < 0.5 ? `boss-${this.id}-hurt` : 'boss-hit', { priority: 1 });
      core.hud.show('HIT!', 0.8, true);
    }
    return true;
  }

  /** Lore weapons only hurt the boss while it's vulnerable. */
  intercept(core: EventScene, target: Entry): boolean {
    if (target !== this.boss) return false;
    this.hit(core);
    return true;
  }
}

/** Shared arena boss setup. */
abstract class ArenaBoss implements Mode {
  readonly arena: ArenaGround;
  readonly ground: ArenaGround;
  readonly world;
  readonly laps = 0;
  readonly music = 'music-boss';
  readonly variants;
  protected event: StoryEvent;
  protected fight: BossFight;
  protected t = 0;

  constructor(event: StoryEvent, hp: number) {
    this.event = event;
    this.arena = this.ground = new ArenaGround(arenaById(event.arena!));
    this.world = worldById(this.arena.def.theme);
    this.variants = event.variants ?? [];
    this.fight = new BossFight(event.boss!, hp);
    // Steer help: toward the boss when it's hittable, otherwise away from it.
    this.arena.aim = (x, z) => {
      const b = this.fight.boss?.body;
      if (!b) return undefined;
      if (this.fight.vulnerable) return { x: b.x, z: b.z };
      const dx = x - b.x, dz = z - b.z, d = Math.hypot(dx, dz) || 1;
      const r = Math.min(this.arena.halfW, this.arena.halfH) * 0.7;
      return { x: Math.max(-r, Math.min(r, x + (dx / d) * 20 - z * 0.15)), z: Math.max(-r, Math.min(r, z + (dz / d) * 20 + x * 0.15)) };
    };
  }

  intro() {
    return { portrait: this.event.introBy, emoji: '💀', line: this.event.intro };
  }

  setup(core: EventScene) {
    const p = core.addPlayer();
    const R = Math.min(this.arena.halfW, this.arena.halfH) - 14;
    p.body.placeAt(this.arena, 0, R, -Math.PI / 2);
    addCrew(core, (e, i) => e.body.placeAt(this.arena, (i ? -1 : 1) * 10, R - 4, -Math.PI / 2));
    const boss = this.fight.spawn(core, this.bossSpeed());
    boss.body.placeAt(this.arena, 0, -R, Math.PI / 2);
    for (let i = 0; i < 5; i++) {
      const spot = this.arena.randomSpot();
      core.addCrate(spot.x, spot.z, 0, 5);
    }
    applyVariants(core, this.variants);
  }

  protected abstract bossSpeed(): number;

  update(core: EventScene, dt: number) {
    this.t += dt;
    core.hud.showOrder(false);
    core.hud.setStatus(this.fight.vulnerable ? '<span style="color:#ffe14d">HIT HIM!</span>' : '');
    this.fight.tick(core);
  }

  hurt(core: EventScene, target: Entry) {
    return this.fight.intercept(core, target);
  }

  order(core: EventScene): Entry[] {
    return core.fighters;
  }

  progress(_core: EventScene, f: Fighter) {
    return f === this.fight.boss ? 1 : 0;
  }

  finish(core: EventScene): Scene {
    return storyFinish(core, this.event, { stars: this.fight.defeated ? starsForWrecks(core.timesWrecked) : 1, won: this.fight.defeated });
  }

  minimap() {
    return arenaSvg(this.arena, 190);
  }

  abstract restart(): Scene;
}

/** Rictus charges in Big Foot. Dodge, and when he slams into a wall he's dazed: hit him then. */
export class RictusBoss extends ArenaBoss {
  private state: 'aim' | 'charge' | 'dazed' = 'aim';
  private stateT = 0;

  constructor(event: StoryEvent) {
    super(event, 3);
  }

  protected bossSpeed() {
    return storyAiSpeed(1, state.data.settings.difficulty) * 0.95;
  }

  setup(core: EventScene) {
    super.setup(core);
    this.fight.boss.brain = () => this.think(core);
  }

  private think(core: EventScene) {
    const b = this.fight.boss.body, p = core.player.body;
    if (this.state === 'aim') return steerToward(b, p.x, p.z, 5);
    if (this.state === 'charge') return { steer: 0, gas: 1, brake: false };
    return { steer: 0, gas: 0, brake: true };
  }

  update(core: EventScene, dt: number) {
    super.update(core, dt);
    const b = this.fight.boss.body;
    this.stateT += dt;
    if (this.state === 'aim' && this.stateT > 1.6) {
      this.state = 'charge';
      this.stateT = 0;
      b.boost = 2.5;
      b.boostPower = 1.4;
      b.ram = 2.5;
      sfx.boost();
    } else if (this.state === 'charge' && this.stateT > 2.8) {
      this.state = 'aim';
      this.stateT = 0;
      b.ram = 0;
    } else if (this.state === 'dazed') {
      if (Math.random() < 0.2) core.effects.sparkle(b.x, b.y + 3, b.z, '#ffffff', 1);
      if (this.stateT > 4 || !this.fight.vulnerable) {
        this.state = 'aim';
        this.stateT = 0;
        this.fight.vulnerable = false;
      }
    }
  }

  onEvent(core: EventScene, e: Entry, ev: CarEvent) {
    // Slamming into a wall or tire stack while charging leaves him dazed.
    if (e === this.fight.boss && ev === 'wall' && this.state === 'charge') {
      this.state = 'dazed';
      this.stateT = 0;
      this.fight.vulnerable = true;
      e.body.ram = 0;
      e.body.boost = 0;
      core.shake(0.5);
      sfx.stomp();
      speak('boss-rictus-dazed', { priority: 1, cooldown: 6 });
    }
  }

  restart(): Scene {
    return new EventScene(new RictusBoss(this.event));
  }
}

/** The Bullet Farmer lobs shells at you from the Peacemaker. Dodge the red rings; hit him while he reloads. */
export class BulletFarmerBoss extends ArenaBoss {
  private phase: 'fire' | 'reload' = 'fire';
  private phaseT = 0;
  private shots = 0;
  private wander = { x: 0, z: 0 };
  private wanderT = 0;

  constructor(event: StoryEvent) {
    super(event, 4);
  }

  protected bossSpeed() {
    return 12;
  }

  setup(core: EventScene) {
    super.setup(core);
    this.fight.boss.brain = () => {
      const b = this.fight.boss.body;
      if (this.phase === 'reload') return { steer: 0, gas: 0, brake: true };
      return steerToward(b, this.wander.x, this.wander.z, 12);
    };
  }

  update(core: EventScene, dt: number) {
    super.update(core, dt);
    this.phaseT += dt;
    this.wanderT -= dt;
    if (this.wanderT <= 0) {
      this.wanderT = 5;
      this.wander = this.arena.randomSpot(Math.random, 20);
    }
    if (this.phase === 'fire') {
      if (this.phaseT > 1.1 * (this.shots + 1)) {
        const p = core.player.body;
        core.weapons.lob(this.fight.boss, { x: p.x + p.vx * 0.9 + (Math.random() - 0.5) * 4, z: p.z + p.vz * 0.9 + (Math.random() - 0.5) * 4 });
        if (this.shots === 0) speak('boss-incoming', { priority: 1, cooldown: 12 });
        this.shots++;
      }
      if (this.shots >= 4 && this.phaseT > 5.5) {
        this.phase = 'reload';
        this.phaseT = 0;
        this.fight.vulnerable = true;
        core.hud.show('NOW!', 1.2, true);
        speak('boss-now', { priority: 1 });
      }
    } else if (this.phaseT > 5 || !this.fight.vulnerable) {
      this.phase = 'fire';
      this.phaseT = 0;
      this.shots = 0;
      this.fight.vulnerable = false;
    }
  }

  restart(): Scene {
    return new EventScene(new BulletFarmerBoss(this.event));
  }
}

/** The People Eater races his tanker limo through the refinery. Beat him, or knock his tanker out. */
export class PeopleEaterBoss extends LapMode {
  private fight = new BossFight('peopleeater', 3);
  private story: StoryEvent;
  private glowT = 0;

  constructor(event: StoryEvent) {
    super(event.track!, { ...event, variants: event.variants ?? ['firejets'] });
    this.story = event;
  }

  setup(core: EventScene) {
    const s = state.data;
    core.addPlayer();
    const base = storyAiSpeed(2, s.settings.difficulty);
    const boss = this.fight.spawn(core, base + 1.5);
    core.driveOnTrack(boss, base + 1.5, 0.3);
    for (const [i, r] of WAR_BOYS.slice(0, 2).entries()) {
      const e = core.addOpponent(r, 'thunder', { engine: 1, tires: 1, armor: 0, gadget: 0 });
      core.driveOnTrack(e, base + r.skill, i ? -0.5 : 0.5);
    }
    const grid = core.entries.filter((e) => !e.isPlayer);
    grid.splice(1, 0, core.player);
    grid.forEach((e, i) => e.body.place(this.geo, this.geo.length - 5 - Math.floor(i / 2) * 7, i % 2 ? -3.5 : 3.5));
    applyVariants(core, this.variants);
  }

  update(core: EventScene, dt: number) {
    super.update(core);
    // His tanker glows now and then: ram it or shoot it.
    this.glowT += dt;
    if (!this.fight.defeated) this.fight.vulnerable = this.glowT % 8 > 4.5;
    this.fight.tick(core);
  }

  hurt(core: EventScene, target: Entry) {
    return this.fight.intercept(core, target);
  }

  onEvent(core: EventScene, e: Entry, ev: CarEvent) {
    if (this.fight.defeated && e === this.fight.boss) return;
    super.onEvent(core, e, ev);
  }

  finish(core: EventScene): Scene {
    // Beat him to the line (or he never finished).
    const me = this.finishOrder.indexOf(core.player), him = this.finishOrder.indexOf(this.fight.boss);
    const ahead = me !== -1 && (him === -1 || me < him);
    const won = this.fight.defeated || ahead;
    return storyFinish(core, this.story, { stars: this.fight.defeated ? 3 : ahead ? 2 : 1, won, order: this.order(core).map((x) => x.racer) });
  }

  restart(): Scene {
    return new EventScene(new PeopleEaterBoss(this.story));
  }
}

/** Immortan Joe chases Furiosa's War Rig in the Gigahorse. Protect the Rig and knock off his four giant wheels. */
export class JoeBoss extends EscortMode {
  private fight = new BossFight('joe', 4);
  private glowT = 0;
  readonly music = 'music-boss';

  constructor(event: StoryEvent) {
    super(event);
    this.maxRaiders = 4;
  }

  setup(core: EventScene) {
    super.setup(core);
    const boss = this.fight.spawn(core, this.rigSpeed + 4, { engine: 4, tires: 4, armor: 4, gadget: 0 });
    boss.body.place(this.geo, 5, -4);
    const ai = core.driveOnTrack(boss, this.rigSpeed + 4, -0.5, false);
    boss.brain = (dt) => {
      const p = core.player.body;
      // While his wheels glow he comes after you, so you can hit him; otherwise he leans on the Rig.
      if (this.fight.vulnerable) {
        ai.lane = Math.max(-0.8, Math.min(0.8, -p.pos.lateral / (this.geo.halfWidth - 2.5)));
        return ai.think(dt, this.geo, p.pos.s);
      }
      ai.lane = -Math.sign(this.rig.body.pos.lateral || 1) * 0.5;
      return ai.think(dt, this.geo, this.rig.body.pos.s);
    };
  }

  update(core: EventScene, dt: number) {
    super.update(core, dt);
    this.glowT += dt;
    const was = this.fight.vulnerable;
    if (!this.fight.defeated) this.fight.vulnerable = this.glowT % 7 > 2.5;
    if (this.fight.vulnerable && !was) speak('boss-wheel', { priority: 1, cooldown: 5 });
    const b = this.fight.boss.body;
    b.ram = !this.fight.vulnerable && Math.abs(b.pos.s - this.rig.body.pos.s) < 7 ? 0.5 : 0;
    // Furiosa won't finish without you: near the end she waits until Joe is beaten.
    if (!this.fight.defeated && this.rig.body.pos.s > this.geo.length - 200) {
      this.rigAi.baseSpeed = 0;
      core.hud.setTip('Furiosa waits for you: knock off Joe’s glowing wheels!');
    }
    this.fight.tick(core);
    core.hud.setStatus(`🚛 ${Math.round((this.rig.score / 100) * 100)}%`);
  }

  protected arrived(core: EventScene) {
    core.end(this.fight.defeated ? 'BOSS DEFEATED!' : 'JOE GOT AWAY!');
  }

  hurt(core: EventScene, target: Entry, by: Entry | undefined, damage: number) {
    if (this.fight.intercept(core, target)) return true;
    return super.hurt(core, target, by, damage);
  }

  finish(core: EventScene): Scene {
    return storyFinish(core, this.event, { stars: this.fight.defeated ? this.stars() : 1, won: this.fight.defeated });
  }

  restart(): Scene {
    return new EventScene(new JoeBoss(this.event));
  }
}

/** Dementus races his chariot round and round. Knock his three bikes loose while they glow. */
export class DementusBoss implements Mode {
  readonly geo: TrackGeometry;
  readonly ground: TrackGeometry;
  readonly world;
  readonly laps = 99;
  readonly music = 'music-boss';
  readonly variants;
  private event: StoryEvent;
  private fight = new BossFight('dementus', 3);
  private glowT = 0;
  private baseSpeed = 0;
  private ai?: { baseSpeed: number };

  constructor(event: StoryEvent) {
    this.event = event;
    this.geo = this.ground = new TrackGeometry(trackById(event.track!));
    this.world = worldById(this.geo.def.world);
    this.variants = event.variants ?? [];
  }

  intro() {
    return { portrait: this.event.introBy, emoji: '🧸', line: this.event.intro };
  }

  setup(core: EventScene) {
    const s = state.data;
    core.addPlayer();
    this.baseSpeed = storyAiSpeed(5, s.settings.difficulty) + 2;
    const boss = this.fight.spawn(core, this.baseSpeed);
    boss.armed = true;
    boss.gadget = 'caltrops';
    this.ai = core.driveOnTrack(boss, this.baseSpeed, 0, false);
    raiders(2, 5, 'hd').forEach((r, i) => {
      const e = core.addOpponent(r, 'harpoon', { engine: 1, tires: 1, armor: 0, gadget: 0 });
      core.driveOnTrack(e, this.baseSpeed - 1, i ? -0.5 : 0.5);
    });
    const grid = core.entries.filter((e) => !e.isPlayer);
    grid.splice(2, 0, core.player);
    grid.forEach((e, i) => e.body.place(this.geo, this.geo.length - 5 - Math.floor(i / 2) * 7, i % 2 ? -3.5 : 3.5));
    const back = this.geo.length - 5 - Math.ceil(grid.length / 2) * 7;
    addCrew(core, (e, i) => e.body.place(this.geo, back - 7, i ? -3.5 : 3.5));
    for (const e of core.entries) e.body.lap = 0;
    applyVariants(core, this.variants);
  }

  update(core: EventScene, dt: number) {
    this.glowT += dt;
    const was = this.fight.vulnerable;
    if (!this.fight.defeated) this.fight.vulnerable = this.glowT % 6 > 2.5;
    if (this.fight.vulnerable && !was) speak('boss-bike', { priority: 1, cooldown: 5 });
    this.fight.tick(core);
    // "Catch me if you can": he stays just ahead of you. Fall behind and he waits;
    // pass him and he roars back past (another chance to hit him). Lost bikes slow him.
    if (this.ai) {
      const gap = this.fight.boss.body.progress(this.geo) - core.player.body.progress(this.geo);
      const pace = gap < 8 ? 1.3 : gap > 60 ? 0.72 : 0.82 + 0.06 * this.fight.hp;
      this.ai.baseSpeed = core.player.body.stats.maxSpeed * pace;
    }
    core.hud.setStatus(`🏍️ ${this.fight.hp} bikes left`);
    if (core.raceTime > 300) core.end('HE GOT AWAY!');
  }

  hurt(core: EventScene, target: Entry) {
    const landed = target === this.fight.boss && this.fight.vulnerable;
    if (!this.fight.intercept(core, target)) return false;
    // A bike comes loose off the front of the chariot.
    if (landed) core.effects.explosion(target.body.x + Math.cos(target.body.heading) * 2.5, target.body.y, target.body.z + Math.sin(target.body.heading) * 2.5, false);
    return true;
  }

  order(core: EventScene): Entry[] {
    return [...core.fighters].sort((a, b) => b.body.progress(this.geo) - a.body.progress(this.geo));
  }

  progress(_core: EventScene, f: Fighter) {
    return f.body.progress(this.geo);
  }

  finish(core: EventScene): Scene {
    return storyFinish(core, this.event, { stars: this.fight.defeated ? starsForWrecks(core.timesWrecked) : 1, won: this.fight.defeated });
  }

  restart(): Scene {
    return new EventScene(new DementusBoss(this.event));
  }

  minimap() {
    return trackSvg(this.geo, 190, 7);
  }
}
