import * as THREE from 'three';
import { game, type Scene } from '../Game';
import { DECALS, PAINTS, carById, type BodyKind, type UpgradeStat } from '../data/cars';
import { driverById, type Racer } from '../data/characters';
import type { Variant } from '../data/story';
import type { WorldDef } from '../data/worlds';
import { buildCar, type CarModel } from '../art/carBuilder';
import { COLORS, box, cyl, toon } from '../art/materials';
import { emojiArt } from '../art/placeholders';
import { EngineSound } from '../audio/engine';
import { playMusic, stopMusic } from '../audio/music';
import { sfx } from '../audio/sfx';
import { lineText, speak, stopVoice } from '../audio/voice';
import { texture } from '../systems/assets';
import { carStats, raceGadget, type CarStats } from '../systems/Economy';
import { state } from '../systems/GameState';
import { Hud, type HudRacer, type MiniMap } from '../ui/hud';
import { Nav, html } from '../ui/nav';
import { openSettings } from '../ui/settings';
import { AIDriver } from './AIDriver';
import { CarBody, collideCars, type CarEvent, type DriveInput } from './CarBody';
import { Effects } from './effects';
import type { ArenaGround, Ground } from './ground';
import { buildArenaVisuals } from './arenaMesh';
import type { TrackGeometry } from './trackGeometry';
import { buildTrackVisuals, type TrackVisuals } from './trackMesh';
import { Weapons, type Arena, type Fighter } from './weapons';

/**
 * Everything every event shares: cars and their physics, weapons, pickups,
 * the camera, the HUD, pausing and the countdown. A `Mode` adds the rules:
 * a lap race, a chase, an escort, an arena smash or a boss fight.
 */
const ASSIST = { strong: 2.2, medium: 1.1, off: 0 };
const VIEW_HEIGHT = 38;
const CAM_DIR = new THREE.Vector3(1, 1.2, 1).normalize();
export const AI_COOLDOWN = { chill: 12, normal: 7, tough: 4 };

export interface Entry extends Fighter {
  racer: HudRacer;
  model: CarModel;
  /** Computer driver (AI racers, and the player after the finish). */
  brain?: (dt: number) => DriveInput;
  /** Whether the AI fires its gadget on its own. */
  armed: boolean;
  maxCharges: number;
  steer: number;
  input: DriveInput;
  drone?: THREE.Group;
  /** Mode-specific numbers: fuel cans held, boss hit points, and so on. */
  score: number;
  /** Removed from play (e.g. a raider knocked out for good). */
  gone?: boolean;
}

export interface Mode {
  readonly ground: Ground;
  /** Set when racing on a track or road. */
  readonly geo?: TrackGeometry;
  /** Set when fighting in an arena. */
  readonly arena?: ArenaGround;
  readonly world: WorldDef;
  readonly laps: number;
  readonly music: string;
  readonly variants: Variant[];
  /** A character to introduce the event before the countdown. */
  intro(): { portrait: string; emoji: string; line: string } | undefined;
  /** Add the cars (player included) and anything extra. */
  setup(core: EventScene): void;
  /** Every frame once the race is on. */
  update(core: EventScene, dt: number): void;
  onEvent?(core: EventScene, e: Entry, ev: CarEvent): void;
  /** Places, best first (drives the HUD list). */
  order(core: EventScene): Entry[];
  /** How far along a car is, for weapon aiming and keeping the pack close. */
  progress(core: EventScene, f: Fighter): number;
  /** Where to go when it's over. */
  finish(core: EventScene): Scene;
  /** A fresh copy of this event, for "Start Over". */
  restart(): Scene;
  minimap(core: EventScene): MiniMap;
  /** How a hit on one of this mode's special cars is handled (bosses). Return true if handled. */
  hurt?(core: EventScene, target: Entry, by: Entry | undefined, damage: number, spin: number): boolean;
  /** Free driving (the Wasteland): no countdown, no finish. */
  readonly freeRoam?: boolean;
  /** How much of the world fits on screen (default 38). */
  readonly viewHeight?: number;
  /** Build custom scenery (when there's no track or arena). */
  decorate?(core: EventScene): void;
  /** Space means something else right now (e.g. "start this event"), so don't fire the gadget. */
  spaceTaken?(core: EventScene): boolean;
  /** Replace the pause menu (e.g. the Wasteland's fast travel). */
  menu?(core: EventScene, close: () => void): { update(): void };
}

export interface CarLookSpec {
  body: BodyKind;
  paint: string;
  decal?: string;
  upgrades: Record<UpgradeStat, number>;
  head: Racer['head'];
  ornament?: string;
}

interface Crate { mesh: THREE.Mesh; x: number; z: number; h: number; away: number; respawn: number }
interface Bolt { mesh: THREE.Mesh; x: number; z: number; h: number; taken: boolean }
export interface Zone { s0: number; s1: number; lat: number; half: number }

let gadgetHintGiven = false;

export class EventScene implements Scene, Arena {
  view: { scene: THREE.Scene; camera: THREE.OrthographicCamera };
  readonly mode: Mode;
  readonly effects = new Effects();
  readonly weapons: Weapons;
  entries: Entry[] = [];
  player!: Entry;
  hud!: Hud;
  phase: 'intro' | 'countdown' | 'race' | 'finish' = 'intro';
  /** Seconds since the race started. */
  raceTime = 0;
  /** Cars the player wrecked. */
  wrecks = 0;
  /** Times the player got wrecked. */
  timesWrecked = 0;
  sun!: THREE.DirectionalLight;
  hemi!: THREE.HemisphereLight;
  private t = 0;
  private visuals?: TrackVisuals;
  private crates: Crate[] = [];
  private bolts: Bolt[] = [];
  /** Boost pads on the track (variants like the Doof beat light them up). */
  readonly pads: Zone[] = [];
  private goo: Zone[] = [];
  private camTarget = new THREE.Vector3();
  private engine = new EngineSound();
  private countdownStep = -1;
  private pause?: { update(): void };
  private introTime = 1.2;
  private shakeAmount = 0;
  private finishTimer = 0;
  /** Extra per-frame jobs from variants (night, sandstorm, ...). */
  readonly tickers: ((dt: number) => void)[] = [];
  /** Space does something else right now (e.g. "start this event" in the Wasteland). */
  gadgetLocked = false;
  dustColor: string;

  constructor(mode: Mode) {
    this.mode = mode;
    this.weapons = new Weapons(this);
    this.dustColor = mode.world.groundColor;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(mode.world.sky);
    const camera = new THREE.OrthographicCamera(-10, 10, 10, -10, 1, 600);
    this.view = { scene, camera };
  }

  // ------------------------------------------------------------------ Arena (for weapons)

  get fighters() {
    return this.entries.filter((e) => !e.gone);
  }
  get scene() {
    return this.view.scene;
  }
  get ground() {
    return this.mode.ground;
  }
  get track() {
    return this.mode.geo;
  }
  progress(f: Fighter) {
    return this.mode.progress(this, f);
  }
  shake(amount: number) {
    this.shakeAmount = Math.max(this.shakeAmount, amount);
  }
  near(e: Fighter) {
    return Math.hypot(e.body.x - this.player.body.x, e.body.z - this.player.body.z) < 35;
  }
  hurt(target: Fighter, by: Fighter | undefined, damage: number, spin: number) {
    if (this.mode.hurt?.(this, target as Entry, by as Entry | undefined, damage, spin)) return;
    const b = target.body;
    const result = b.hit(damage, spin);
    if (result === 'none') return;
    const mine = target === this.player, byMe = by === this.player;
    if (result === 'hit') {
      this.effects.sparkle(b.x, b.y, b.z, '#ffb347', 6);
      if (mine || byMe) sfx.bump();
      return;
    }
    this.effects.explosion(b.x, b.y, b.z, true);
    if (mine || byMe || this.near(target)) sfx.explosion(true);
    if (mine) {
      this.timesWrecked++;
      this.shake(0.9);
      speak('got-wrecked', { priority: 1, cooldown: 10 });
    } else if (byMe) {
      this.wrecks++;
      this.shake(0.4);
      speak('wrecked-them', { priority: 1, cooldown: 6 });
    }
  }

  // ------------------------------------------------------------------ building

  enter() {
    const { scene } = this.view;
    const m = this.mode;
    this.hemi = new THREE.HemisphereLight('#fff4e0', m.world.groundColor, 1.6);
    scene.add(this.hemi);
    this.sun = new THREE.DirectionalLight('#ffffff', 2.2);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    const sc = this.sun.shadow.camera;
    sc.left = sc.bottom = -45;
    sc.right = sc.top = 45;
    sc.near = 1;
    sc.far = 200;
    this.sun.shadow.bias = -0.0005;
    scene.add(this.sun, this.sun.target);

    if (m.geo) {
      this.visuals = buildTrackVisuals(m.geo, m.world, m.geo.def.id.length + 7);
      scene.add(this.visuals.group);
      this.buildTrackPickups(m.geo);
    } else if (m.arena) scene.add(buildArenaVisuals(m.arena, m.world, m.arena.def.id.length + 3));
    m.decorate?.(this);
    scene.add(this.effects.group);

    m.setup(this);
    this.hud = new Hud(m.minimap(this), this.entries.map((e) => e.racer), this.player.gadget);
    game.ui.appendChild(this.hud.el);
    this.hud.setGadget(0);
    if (m.geo && !m.geo.open) this.hud.setLap(0, m.laps);

    const intro = m.intro();
    if (m.freeRoam) {
      this.phase = 'race';
      this.hud.hideCallout();
      this.hud.showOrder(false);
    } else if (intro) {
      this.introTime = 3.4;
      this.hud.say(intro.portrait, intro.emoji, lineText(intro.line));
      speak(intro.line, { priority: 2 });
    } else {
      this.hud.hideCallout();
      speak('race-intro', { priority: 2 });
    }
    playMusic(m.music);
    this.engine.start();
    this.snapCamera();
    // Dev only: lets test scripts poke the event (e.g. hand out gadget charges).
    if (import.meta.env.DEV) (window as unknown as { race?: EventScene }).race = this;
  }

  /** Add a car. `look` is how it's drawn; `stats` how it drives. */
  addRacer(racer: HudRacer, look: CarLookSpec, gadget: string, stats: CarStats): Entry {
    const model = buildCar(look);
    this.view.scene.add(model.root);
    const e: Entry = {
      racer, model, gadget, body: new CarBody(stats, racer.id), cooldown: 0, isPlayer: racer.isPlayer,
      armed: !racer.isPlayer, maxCharges: racer.isPlayer ? stats.maxCharges : 2, steer: 0, input: { steer: 0, gas: 0, brake: false }, score: 0,
    };
    this.entries.push(e);
    this.hud?.addRacer(racer);
    return e;
  }

  /** The player's car, from the save. */
  addPlayer(): Entry {
    const s = state.data;
    const driver = driverById(s.driver);
    const car = carById(s.car);
    const paint = PAINTS.find((p) => p.id === s.paint)?.color ?? PAINTS[0].color;
    const decal = DECALS.find((d) => d.id === s.decal)?.image || undefined;
    this.player = this.addRacer(
      { id: 'player', name: driver.name, portrait: driver.portrait, emoji: driver.emoji, color: paint, isPlayer: true },
      { body: car.body, paint, decal, upgrades: s.upgrades, head: driver.head, ornament: s.ornament },
      raceGadget(s),
      carStats(s),
    );
    return this.player;
  }

  /** An AI racer from a character, driving a car like theirs. */
  addOpponent(r: Racer, gadget: string, upgrades: Record<UpgradeStat, number>, speed?: number): Entry {
    const stats = carStats({ car: r.body === 'truck' ? 'spike' : r.body, upgrades: { engine: 0, tires: 0, armor: 0, gadget: 0 } });
    stats.accel = Math.max(stats.accel, 15);
    if (speed) stats.maxSpeed = speed;
    const e = this.addRacer(
      { id: r.id, name: r.name, portrait: r.portrait, emoji: r.emoji, color: r.color, isPlayer: false },
      { body: r.body, paint: r.color, upgrades, head: r.head },
      gadget,
      stats,
    );
    e.cooldown = AI_COOLDOWN[state.data.settings.difficulty] * (0.5 + Math.random());
    return e;
  }

  /** Give a car the track-following AI. */
  driveOnTrack(e: Entry, speed: number, lane: number, rubberBand = true) {
    const geo = this.mode.geo!;
    const ai = new AIDriver(e.body, speed, lane);
    e.brain = (dt) => ai.think(dt, geo, rubberBand && !e.isPlayer ? this.progress(this.player) : undefined);
    return ai;
  }

  removeEntry(e: Entry) {
    e.gone = true;
    this.view.scene.remove(e.model.root);
    if (e.drone) this.view.scene.remove(e.drone);
    this.hud?.removeRacer(e.racer.id);
    this.entries = this.entries.filter((x) => x !== e);
  }

  /** A gadget crate that comes back a few seconds after it's taken. */
  addCrate(x: number, z: number, h: number, respawn = 5) {
    const mesh = new THREE.Mesh(crateGeo(), crateMat());
    mesh.castShadow = true;
    this.view.scene.add(mesh);
    this.crates.push({ mesh, x, z, h, away: 0, respawn });
  }

  private buildTrackPickups(geo: TrackGeometry) {
    const def = geo.def;
    const L = geo.length, hw = geo.halfWidth;
    for (const at of def.pickups ?? [])
      // One in the middle so holding straight still gets one; the sides are for steerers.
      for (const lat of [-hw * 0.6, 0, hw * 0.6]) {
        const p = geo.pointAt(at * L, lat);
        this.addCrate(p.x, p.z, p.h);
      }
    const boltGeo = new THREE.CylinderGeometry(0.55, 0.55, 0.3, 6);
    boltGeo.rotateX(Math.PI / 2);
    const boltMat = toon(COLORS.gold, { emissive: '#aa7a00' });
    for (const b of def.bolts ?? [])
      for (let i = 0; i < b.count; i++) {
        // Lines near the middle become a swerve from one side to the other; the rest hug a side.
        const frac = Math.abs(b.lane) < 0.3 ? -0.65 + (1.3 * i) / Math.max(1, b.count - 1) : Math.sign(b.lane) * 0.7;
        const p = geo.pointAt(b.at * L + i * 3.5, -frac * (hw - 2.5));
        const mesh = new THREE.Mesh(boltGeo, boltMat);
        mesh.castShadow = true;
        this.view.scene.add(mesh);
        this.bolts.push({ mesh, x: p.x, z: p.z, h: p.h, taken: false });
      }
    for (const b of def.boosts ?? []) this.pads.push({ s0: b.at * L, s1: b.at * L + 6, lat: -b.lane * (hw - 3), half: 2.4 });
    for (const g of def.goo ?? []) this.goo.push({ s0: g.at * L, s1: (g.at + g.len) * L, lat: -g.lane * (hw - 3.5), half: 3.5 });
  }

  // ------------------------------------------------------------------ loop

  update(dt: number) {
    const c = game.controls;
    if (this.pause) {
      this.pause.update();
      return;
    }
    if (c.back() && this.phase !== 'finish') {
      if (this.mode.menu) {
        this.engine.update(0, false);
        this.pause = this.mode.menu(this, () => (this.pause = undefined));
        return;
      }
      return this.openPause();
    }
    if (c.just('m')) {
      state.data.settings.muted = !state.data.settings.muted;
      state.persist();
    }

    this.t += dt;
    if (this.phase === 'intro' && this.t > this.introTime) {
      this.phase = 'countdown';
      this.t = 0;
      this.hud.hideCallout();
    }
    if (this.phase === 'countdown') this.countdown();

    if (this.phase === 'race' || this.phase === 'finish') {
      this.raceTime += dt;
      this.simulate(dt);
      if (this.phase === 'race') this.mode.update(this, dt);
    }
    for (const tick of this.tickers) tick(dt);
    this.syncVisuals(dt);
    this.updateCamera(dt);
    this.visuals?.update(dt);
    this.effects.update(dt);
    this.hud.update(dt);

    if (this.phase === 'finish') {
      this.finishTimer += dt;
      if (this.finishTimer > 4) game.go(this.mode.finish(this));
    }
  }

  /** The event is over for the player: show a banner and let the computer drive. */
  end(banner: string) {
    if (this.phase === 'finish') return;
    this.phase = 'finish';
    this.finishTimer = 0;
    this.hud.show(banner, 0);
    sfx.cheer();
    const p = this.player;
    if (this.mode.geo) this.driveOnTrack(p, p.body.stats.maxSpeed * 0.8, 0, false);
    else p.brain = () => ({ steer: 0, gas: 0, brake: true });
    p.armed = false;
  }

  private countdown() {
    const step = Math.floor(this.t);
    if (step === this.countdownStep) return;
    this.countdownStep = step;
    if (step < 3) {
      this.hud.show(String(3 - step), 0.9);
      sfx.beep();
      speak(['three', 'two', 'one'][step], { priority: 2 });
    } else {
      this.hud.show('GO!', 1.2);
      sfx.go();
      speak('go', { priority: 2 });
      this.phase = 'race';
      this.t = 0;
      if (!gadgetHintGiven) this.hud.setTip('Hold <span class="keycap">↑</span> to go · <span class="keycap">←</span><span class="keycap">→</span> to steer');
      setTimeout(() => this.hud.setTip(''), 6000);
    }
  }

  private simulate(dt: number) {
    const c = game.controls;
    const s = state.data.settings;
    for (const e of this.fighters) {
      if (!e.brain) continue;
      e.input = e.brain(dt);
      e.steer = e.input.steer;
      if (e.armed && this.phase === 'race' && this.weapons.aiWants(e, dt, AI_COOLDOWN[s.difficulty] * (0.7 + Math.random() * 0.6))) this.weapons.fire(e);
    }
    const steps = Math.ceil(dt / (1 / 60));
    const h = dt / steps;
    const assist = ASSIST[s.steerHelp];
    const ground = this.mode.ground;
    const laps = this.mode.laps;
    for (let k = 0; k < steps; k++) {
      for (const e of this.fighters) {
        const b = e.body;
        if (this.mode.geo) {
          b.slowed = this.inZone(this.goo, b);
          if (this.inZone(this.pads, b) && b.boost < 0.6) {
            b.boost = 1.0;
            b.events.push('boostpad');
          }
        }
        if (e.brain) b.step(h, e.input, ground, 0, laps);
        else {
          const down = c.held('down');
          const gas = down ? 0 : s.autoGas || c.held('up') ? 1 : 0;
          e.steer = c.steer;
          b.step(h, { steer: c.steer, gas, brake: down }, ground, assist, laps);
        }
      }
      const live = this.fighters;
      for (let i = 0; i < live.length; i++) for (let j = i + 1; j < live.length; j++) this.bump(live[i], live[j]);
    }

    if (this.phase === 'race' && !this.gadgetLocked && !this.mode.spaceTaken?.(this) && c.just('space') && this.weapons.fire(this.player)) gadgetHintGiven = true;

    this.updatePickups(dt);
    this.weapons.update(dt);
    for (const e of [...this.entries]) this.handleEvents(e);
    this.updatePlaces();
  }

  private inZone(zones: Zone[], b: CarBody) {
    const geo = this.mode.geo;
    if (b.airborne || !geo) return false;
    for (const z of zones) {
      // Roads don't wrap around, so a zone ahead of you isn't one you're in.
      const ds = geo.open ? b.pos.s - z.s0 : geo.wrap(b.pos.s - z.s0);
      if (ds >= 0 && ds < z.s1 - z.s0 && Math.abs(b.pos.lateral - z.lat) < z.half) return true;
    }
    return false;
  }

  private bump(a: Entry, b: Entry) {
    const impact = collideCars(a.body, b.body);
    this.weapons.contact(a, b);
    if (impact > 5 && (a === this.player || b === this.player)) sfx.bump();
  }

  private updatePickups(dt: number) {
    const spin = this.raceTime * 2;
    for (const c of this.crates) {
      if (c.away > 0) {
        c.away -= dt;
        c.mesh.visible = c.away <= 0;
        continue;
      }
      for (const e of this.fighters) {
        const b = e.body;
        if (Math.hypot(b.x - c.x, b.z - c.z) > 2.2 || b.towing > 0 || b.wrecked > 0) continue;
        c.away = c.respawn;
        c.mesh.visible = false;
        if (b.charges < e.maxCharges) b.charges++;
        this.effects.sparkle(c.x, c.h, c.z, '#ffd23f', 10);
        if (e === this.player) {
          sfx.crate();
          if (!gadgetHintGiven) {
            gadgetHintGiven = true;
            speak('gadget-hint', { priority: 2 });
            this.hud.setTip('Press <span class="keycap">SPACE</span> to use your gadget!');
            setTimeout(() => this.hud.setTip(''), 5000);
          }
        }
        break;
      }
    }
    for (const bolt of this.bolts) {
      if (bolt.taken) continue;
      const b = this.player.body;
      if (Math.hypot(b.x - bolt.x, b.z - bolt.z) < 2 && Math.abs(b.y - bolt.h) < 2.5) {
        bolt.taken = true;
        bolt.mesh.visible = false;
        b.bolts++;
        sfx.bolt();
        this.effects.sparkle(bolt.x, bolt.h, bolt.z, '#ffc93c', 5);
      }
    }
    for (const c of this.crates) {
      c.mesh.position.set(c.x, c.h + 1.4 + Math.sin(spin + c.x) * 0.25, c.z);
      c.mesh.rotation.set(0.3, spin, 0.2);
    }
    for (const bolt of this.bolts) {
      bolt.mesh.position.set(bolt.x, bolt.h + 1 + Math.sin(spin * 1.5 + bolt.z) * 0.15, bolt.z);
      bolt.mesh.rotation.y = spin * 1.5;
    }
  }

  private handleEvents(e: Entry) {
    const b = e.body;
    const mine = e === this.player;
    const geo = this.mode.geo;
    for (const ev of b.events) {
      switch (ev) {
        case 'wall':
          if (mine) sfx.wall(b.lastHit / 6);
          this.effects.dust(b.x, b.y, b.z, this.dustColor, 3);
          break;
        case 'takeoff':
          if (mine && geo?.onJump(b.pos.s)) {
            sfx.whoosh();
            speak(['jump-1', 'jump-2', 'jump-3'][Math.floor(Math.random() * 3)], { priority: 0, cooldown: 6 });
          }
          break;
        case 'land': {
          const big = b.airTime > 0.3;
          if (mine || this.near(e)) sfx.land(big);
          this.effects.dust(b.x, b.y, b.z, this.dustColor, big ? 18 : 6);
          if (big && mine) {
            this.effects.sparkle(b.x, b.y, b.z, '#ffe14d', 14);
            this.shake(0.7);
          }
          break;
        }
        case 'tow':
          if (mine) {
            sfx.tow();
            speak('tow', { priority: 1, cooldown: 25 });
          }
          break;
        case 'spin':
          if (mine) sfx.spin();
          break;
        case 'respawn':
          this.effects.sparkle(b.x, b.y, b.z, '#ffffff', 10);
          break;
        case 'boostpad':
          if (mine) sfx.boost();
          break;
      }
      this.mode.onEvent?.(this, e, ev);
    }
    b.events.length = 0;
  }

  private updatePlaces() {
    const order = this.mode.order(this);
    this.hud.setOrder(order.map((e) => e.racer.id));
    const pb = this.player.body;
    if (this.mode.geo && !this.mode.geo.open) this.hud.setLap(pb.lap, this.mode.laps);
    this.hud.setGadget(pb.charges);
    this.hud.setBolts(pb.bolts);
    this.hud.setHp(pb.wrecked > 0 ? 0 : pb.hp, pb.stats.maxHp, pb.shield > 0 || pb.star > 0);
    for (const e of this.fighters) this.hud.setDot(e.racer.id, e.body.x, e.body.z);
  }

  // ------------------------------------------------------------------ visuals

  private syncVisuals(dt: number) {
    const geo = this.mode.geo;
    for (const e of this.fighters) {
      const b = e.body, m = e.model;
      m.root.position.set(b.x, b.y, b.z);
      m.root.rotation.y = -b.heading;
      const fwd = b.forwardSpeed;
      // Tilt with the ground, lean into turns.
      let slope = 0;
      if (geo) {
        const facing = Math.cos(b.heading) * b.pos.tx + Math.sin(b.heading) * b.pos.tz;
        slope = ((geo.heightAt(b.pos.s + 1.5) - geo.heightAt(b.pos.s - 1.5)) / 3) * facing;
      } else {
        const fx = Math.cos(b.heading) * 1.5, fz = Math.sin(b.heading) * 1.5;
        slope = (this.mode.ground.locate(b.x + fx, b.z + fz, -1).h - this.mode.ground.locate(b.x - fx, b.z - fz, -1).h) / 3;
      }
      const pitch = b.airborne ? Math.max(-0.4, Math.min(0.4, b.vy * 0.04)) : Math.atan(slope);
      m.chassis.rotation.z += (pitch - m.chassis.rotation.z) * Math.min(1, dt * 10);
      m.chassis.rotation.x += (e.steer * 0.08 * Math.min(1, Math.abs(fwd) / 20) - m.chassis.rotation.x) * Math.min(1, dt * 6);
      for (const w of m.wheels) {
        w.rotation.z -= (fwd * dt) / m.wheelRadius;
        if (w.position.x > 0) w.rotation.y = -e.steer * 0.35;
      }
      m.boing.visible = b.boing > 0;
      if (b.boing > 0) m.boing.scale.x = Math.min(1, (2.2 - b.boing) * 6);
      m.flames.visible = b.boost > 0;
      if (b.boost > 0) {
        m.flames.scale.set(0.8 + Math.random() * 0.5, 1, 1);
        if (Math.random() < 0.5) this.effects.smoke(b.x - Math.cos(b.heading) * 2.5, b.y + 1, b.z - Math.sin(b.heading) * 2.5);
      }
      if (!b.airborne && b.towing <= 0 && b.wrecked <= 0 && Math.abs(fwd) > 6 && Math.random() < (e === this.player ? 0.5 : 0.25))
        this.effects.dust(b.x - Math.cos(b.heading) * 1.6, b.y, b.z - Math.sin(b.heading) * 1.6, b.slowed ? '#9be15d' : this.dustColor);
      if (b.spin > 0 && Math.random() < 0.15) this.effects.sparkle(b.x, b.y + 1.5, b.z, '#ffffff', 2);
      if (b.wrecked > 0) {
        m.root.rotation.x += dt * 7;
        m.root.rotation.z += dt * 4;
        if (Math.random() < 0.3) this.effects.smoke(b.x, b.y + 0.5, b.z);
      } else m.root.rotation.x = m.root.rotation.z = 0;
      m.root.visible = !(b.shield > 0 && Math.floor(b.shield * 10) % 2 === 0);
      this.weapons.decorate(e);
      this.updateDrone(e, dt);
    }
    if (this.phase !== 'intro' && this.phase !== 'countdown') {
      const pb = this.player.body;
      this.engine.update(Math.min(1.2, Math.abs(pb.forwardSpeed) / pb.stats.maxSpeed), pb.boost > 0);
    } else this.engine.update(game.controls.held('up') ? 0.5 : 0.05, false);
  }

  private updateDrone(e: Entry, dt: number) {
    const b = e.body;
    if (b.towing <= 0) {
      if (e.drone) e.drone.visible = false;
      return;
    }
    if (!e.drone) {
      const d = new THREE.Group();
      box(1.6, 0.4, 1.6, '#f5c518', 0, 0, 0, d);
      for (const [x, z] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) cyl(0.55, 0.05, '#34343c', x, 0.3, z, d, 12).name = 'rotor';
      cyl(0.04, 2.2, '#222', 0, -1.2, 0, d);
      this.view.scene.add(d);
      e.drone = d;
    }
    e.drone.visible = true;
    e.drone.position.set(b.x, b.y + 3.6, b.z);
    e.drone.children.forEach((c) => c.name === 'rotor' && (c.rotation.y += dt * 30));
  }

  private snapCamera() {
    const pb = this.player.body;
    this.camTarget.set(pb.x, pb.y, pb.z);
    this.updateCamera(0);
  }

  private updateCamera(dt: number) {
    const cam = this.view.camera;
    const aspect = game.width / Math.max(1, game.height);
    const view = this.mode.viewHeight ?? VIEW_HEIGHT;
    let halfH = view / 2;
    if (aspect < 1.2) halfH = (view * 0.6) / aspect;
    cam.left = -halfH * aspect;
    cam.right = halfH * aspect;
    cam.top = halfH;
    cam.bottom = -halfH;
    cam.updateProjectionMatrix();

    const pb = this.player.body;
    const want = new THREE.Vector3(pb.x + pb.vx * 0.45, pb.y, pb.z + pb.vz * 0.45);
    this.camTarget.lerp(want, dt ? 1 - Math.exp(-4 * dt) : 1);
    const look = this.camTarget.clone();
    if (this.shakeAmount > 0) {
      look.x += (Math.random() - 0.5) * this.shakeAmount;
      look.y += (Math.random() - 0.5) * this.shakeAmount;
      this.shakeAmount = Math.max(0, this.shakeAmount - dt * 1.8);
    }
    cam.position.copy(look).addScaledVector(CAM_DIR, 150);
    cam.lookAt(look);
    this.sun.position.set(this.camTarget.x - 30, this.camTarget.y + 60, this.camTarget.z + 20);
    this.sun.target.position.copy(this.camTarget);
  }

  // ------------------------------------------------------------------ menus & exit

  private openPause() {
    this.engine.update(0, false);
    const back = html(`<div class="modal-back"><div class="modal panel">
      <h2 class="outlined">Paused</h2>
      <button class="btn green" data-nav data-a="go">▶ Keep Racing</button>
      <button class="btn" data-nav data-a="restart">🔁 Start Over</button>
      <button class="btn" data-nav data-a="quit">🚪 Leave</button>
      <button class="btn gray" data-nav data-a="settings">⚙ Grown-ups</button>
    </div></div>`);
    const modal = back.firstElementChild as HTMLElement;
    const nav = new Nav(modal);
    const close = () => {
      back.remove();
      this.pause = undefined;
    };
    modal.querySelectorAll<HTMLElement>('[data-a]').forEach((b) => {
      b.onclick = () => {
        sfx.confirm();
        const a = b.dataset.a;
        if (a === 'go') close();
        else if (a === 'restart') game.go(this.mode.restart());
        else if (a === 'quit') game.go(leaveTo());
        else if (a === 'settings') {
          back.style.display = 'none';
          this.pause = openSettings(() => {
            back.style.display = '';
            this.pause = pauseMenu;
            nav.refocus();
          });
        }
      };
    });
    const pauseMenu = {
      update: () => {
        if (game.controls.back()) return close();
        nav.update(game.controls);
      },
    };
    this.pause = pauseMenu;
    game.ui.appendChild(back);
    nav.refocus();
  }

  exit() {
    this.weapons.clear();
    this.engine.stop();
    stopVoice();
    stopMusic();
    this.view.scene.traverse((o) => {
      if (o instanceof THREE.Mesh) o.geometry.dispose();
    });
  }
}

/** Where "Leave" goes: set by the hub (garage or Wasteland) so events don't import it. */
let leaveTo: () => Scene = () => {
  throw new Error('leave target not set');
};
export const setLeaveTarget = (f: () => Scene) => {
  leaveTo = f;
};

let crateGeometry: THREE.BoxGeometry | undefined;
const crateGeo = () => (crateGeometry ??= new THREE.BoxGeometry(1.6, 1.6, 1.6));
const crateMat = () => toon('#ffffff', { map: texture('icon-gadget', emojiArt('⚡')), emissive: '#ffb000' });
