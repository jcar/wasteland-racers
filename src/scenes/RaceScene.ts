import * as THREE from 'three';
import { game, type Scene } from '../Game';
import { carById, PAINTS, DECALS, type BodyKind } from '../data/cars';
import { driverById, EXTRAS, RIVALS, rivalById, type Racer } from '../data/characters';
import { trackById, trackIndex } from '../data/tracks';
import { worldById } from '../data/worlds';
import { buildCar, type CarModel } from '../art/carBuilder';
import { toon, COLORS, box, cyl } from '../art/materials';
import { emojiArt } from '../art/placeholders';
import { AIDriver } from '../race/AIDriver';
import { CarBody, collideCars, type DriveInput } from '../race/CarBody';
import { Effects } from '../race/effects';
import { TrackGeometry } from '../race/trackGeometry';
import { buildTrackVisuals, type TrackVisuals } from '../race/trackMesh';
import { EngineSound } from '../audio/engine';
import { playMusic, stopMusic } from '../audio/music';
import { sfx } from '../audio/sfx';
import { lineText, speak, stopVoice } from '../audio/voice';
import { texture } from '../systems/assets';
import { aiSpeed, carStats } from '../systems/Economy';
import { state } from '../systems/GameState';
import { Hud, type HudRacer } from '../ui/hud';
import { Nav, html } from '../ui/nav';
import { openSettings } from '../ui/settings';
import { GarageScene } from './GarageScene';
import { PodiumScene, type RaceResult } from './PodiumScene';

const ASSIST = { strong: 2.2, medium: 1.1, off: 0 };
const AI_GADGET: Record<string, string> = { rex: 'boost', muffler: 'boing', bertha: 'goo', warlord: 'boing', dusty: 'boost', nutsy: 'goo', sparky: 'boost', rattles: 'boing' };
const AI_COOLDOWN = { chill: 12, normal: 7, tough: 4 };
const VIEW_HEIGHT = 38;
const CAM_DIR = new THREE.Vector3(1, 1.2, 1).normalize();

interface Entry {
  racer: HudRacer;
  body: CarBody;
  model: CarModel;
  ai?: AIDriver;
  gadget: string;
  maxCharges: number;
  steer: number;
  input: DriveInput;
  drone?: THREE.Group;
}

interface Crate { mesh: THREE.Mesh; x: number; z: number; h: number; away: number }
interface Bolt { mesh: THREE.Mesh; x: number; z: number; h: number; taken: boolean }
interface Slick { mesh: THREE.Mesh; x: number; z: number; owner: Entry; age: number }
interface Zone { s0: number; s1: number; lat: number; half: number }

let gadgetHintGiven = false;

export class RaceScene implements Scene {
  view: { scene: THREE.Scene; camera: THREE.OrthographicCamera };
  private trackId: string;
  private geo: TrackGeometry;
  private visuals!: TrackVisuals;
  private effects = new Effects();
  private entries: Entry[] = [];
  private player!: Entry;
  private hud!: Hud;
  private phase: 'intro' | 'countdown' | 'race' | 'finish' = 'intro';
  private t = 0;
  private raceTime = 0;
  private laps: number;
  private crates: Crate[] = [];
  private bolts: Bolt[] = [];
  private slicks: Slick[] = [];
  private pads: Zone[] = [];
  private goo: Zone[] = [];
  private finishOrder: Entry[] = [];
  private camTarget = new THREE.Vector3();
  private sun!: THREE.DirectionalLight;
  private engine = new EngineSound();
  private lastPlace = 0;
  private countdownStep = -1;
  private pause?: { update(): void };
  private introTime = 1.2;
  private dustColor: string;
  /** Screen shake after a big landing; fades out. */
  private shake = 0;

  constructor(trackId: string) {
    this.trackId = trackId;
    const def = trackById(trackId);
    this.geo = new TrackGeometry(def);
    this.laps = def.laps;
    const world = worldById(def.world);
    this.dustColor = world.groundColor;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(world.sky);
    const camera = new THREE.OrthographicCamera(-10, 10, 10, -10, 1, 600);
    this.view = { scene, camera };
  }

  enter() {
    const { scene } = this.view;
    const def = this.geo.def;
    const world = worldById(def.world);

    // Light: a warm sun with shadows, and a sky/ground fill.
    scene.add(new THREE.HemisphereLight('#fff4e0', world.groundColor, 1.6));
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

    this.visuals = buildTrackVisuals(this.geo, world, trackIndex(this.trackId) + 1);
    scene.add(this.visuals.group, this.effects.group);

    this.buildRacers();
    this.buildPickups();

    this.hud = new Hud(this.geo, this.entries.map((e) => e.racer), this.player.gadget);
    game.ui.appendChild(this.hud.el);
    this.hud.setLap(0, this.laps);
    this.hud.setGadget(0);

    const rival = def.rival ? rivalById(def.rival) : undefined;
    if (rival) {
      this.introTime = 3.4;
      this.hud.say(rival.portrait, rival.emoji, lineText(`${rival.id}-intro`));
      speak(`${rival.id}-intro`, { priority: 2 });
    } else if (def.world === 'dome') {
      this.introTime = 3.4;
      this.hud.say('announcer', '🎤', lineText('dome-intro'));
      speak('dome-intro', { priority: 2 });
    } else {
      this.hud.hideCallout();
      speak('race-intro', { priority: 2 });
    }
    playMusic(world.music);
    this.engine.start();
    this.snapCamera();
  }

  private buildRacers() {
    const def = this.geo.def;
    const s = state.data;
    const idx = trackIndex(this.trackId);
    // Opponents: the world's rival (all of them in the Thunder Dome) plus extras.
    let opponents: Racer[];
    if (def.world === 'dome') opponents = [...RIVALS];
    else {
      const rival = def.rival ? rivalById(def.rival) : undefined;
      const extras = [...EXTRAS.slice(idx % EXTRAS.length), ...EXTRAS.slice(0, idx % EXTRAS.length)];
      opponents = rival ? [rival, ...extras.slice(0, 2)] : extras.slice(0, 3);
    }

    const driver = driverById(s.driver);
    const car = carById(s.car);
    const paint = PAINTS.find((p) => p.id === s.paint)?.color ?? PAINTS[0].color;
    const decal = DECALS.find((d) => d.id === s.decal)?.image || undefined;
    const playerEntry = this.addEntry(
      { id: 'player', name: driver.name, portrait: driver.portrait, emoji: driver.emoji, color: paint, isPlayer: true },
      car.body, paint, decal, s.upgrades, driver.head, s.gadget, carStats(s),
    );
    this.player = playerEntry;

    const base = aiSpeed(this.trackId, s.settings.difficulty);
    const none = { engine: 0, tires: 0, armor: 0, gadget: 0 };
    for (const [i, r] of opponents.entries()) {
      const stats = carStats({ car: bodyToCar(r.body), upgrades: none });
      stats.accel = Math.max(stats.accel, 15);
      const e = this.addEntry(
        { id: r.id, name: r.name, portrait: r.portrait, emoji: r.emoji, color: r.color, isPlayer: false },
        r.body, r.color, undefined, r.rival ? { engine: 2, tires: 2, armor: 2, gadget: 3 } : { engine: i % 3, tires: 1, armor: 0, gadget: 0 }, r.head,
        AI_GADGET[r.id] ?? 'boost', stats,
      );
      e.maxCharges = 2;
      e.ai = new AIDriver(e.body, base + r.skill, [0.5, -0.5, 0.2, -0.2][i % 4]);
      e.ai.gadgetCooldown = AI_COOLDOWN[s.settings.difficulty] * (0.5 + Math.random());
    }

    // Starting grid, two by two behind the line. The player starts in the second row.
    const order = [...this.entries.filter((e) => !e.racer.isPlayer)];
    order.splice(Math.min(2, order.length), 0, this.player);
    order.forEach((e, i) => {
      const row = Math.floor(i / 2);
      e.body.place(this.geo, this.geo.length - 5 - row * 7, i % 2 ? -3.5 : 3.5);
    });
  }

  private addEntry(racer: HudRacer, body: BodyKind, paint: string, decal: string | undefined, upgrades: Record<'engine' | 'tires' | 'armor' | 'gadget', number>, head: Racer['head'], gadget: string, stats: ReturnType<typeof carStats>) {
    const model = buildCar({ body, paint, decal, upgrades, head });
    this.view.scene.add(model.root);
    const e: Entry = { racer, body: new CarBody(stats, racer.id), model, gadget, maxCharges: stats.maxCharges, steer: 0, input: { steer: 0, gas: 0, brake: false } };
    this.entries.push(e);
    return e;
  }

  private buildPickups() {
    const def = this.geo.def;
    const L = this.geo.length, hw = this.geo.halfWidth;
    const crateMat = toon('#ffffff', { map: texture('icon-gadget', emojiArt('⚡')), emissive: '#ffb000' });
    const crateGeo = new THREE.BoxGeometry(1.6, 1.6, 1.6);
    for (const at of def.pickups ?? [])
      // Off to the sides, never the middle: steering is how you get them.
      for (const lat of [-hw * 0.6, hw * 0.6]) {
        const p = this.geo.pointAt(at * L, lat);
        const mesh = new THREE.Mesh(crateGeo, crateMat);
        mesh.castShadow = true;
        this.view.scene.add(mesh);
        this.crates.push({ mesh, x: p.x, z: p.z, h: p.h, away: 0 });
      }
    const boltGeo = new THREE.CylinderGeometry(0.55, 0.55, 0.3, 6);
    boltGeo.rotateX(Math.PI / 2);
    const boltMat = toon(COLORS.gold, { emissive: '#aa7a00' });
    for (const b of def.bolts ?? [])
      for (let i = 0; i < b.count; i++) {
        // Lines near the middle become a swerve from one side to the other; the rest hug a side.
        const frac = Math.abs(b.lane) < 0.3 ? -0.65 + (1.3 * i) / Math.max(1, b.count - 1) : Math.sign(b.lane) * 0.7;
        const p = this.geo.pointAt(b.at * L + i * 3.5, -frac * (hw - 2.5));
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
    if (c.back() && this.phase !== 'finish') return this.openPause();
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

    const racing = this.phase === 'race' || this.phase === 'finish';
    if (racing) {
      this.raceTime += dt;
      this.simulate(dt);
    }
    this.syncVisuals(dt);
    this.updateCamera(dt);
    this.visuals.update(dt);
    this.effects.update(dt);
    this.hud.update(dt);

    if (this.phase === 'finish' && this.t > 4) this.toPodium();
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
    const playerProgress = this.player.body.progress(this.geo);

    // Inputs.
    for (const e of this.entries) {
      if (e.ai) {
        e.input = e.ai.think(dt, this.geo, e.racer.isPlayer ? undefined : playerProgress);
        e.steer = e.input.steer;
        if (!e.racer.isPlayer) this.aiGadgets(e, dt);
      }
    }
    const steps = Math.ceil(dt / (1 / 60));
    const h = dt / steps;
    const assist = ASSIST[s.steerHelp];
    for (let k = 0; k < steps; k++) {
      for (const e of this.entries) {
        const b = e.body;
        b.slowed = this.inZone(this.goo, b);
        if (this.inZone(this.pads, b) && b.boost < 0.6) {
          b.boost = 1.0;
          b.events.push('boostpad');
        }
        if (e.ai) {
          b.step(h, e.input, this.geo, 0, this.laps);
        } else {
          const down = c.held('down');
          const gas = down ? 0 : s.autoGas || c.held('up') ? 1 : 0;
          e.steer = c.steer;
          b.step(h, { steer: c.steer, gas, brake: down }, this.geo, assist, this.laps);
        }
      }
      for (let i = 0; i < this.entries.length; i++)
        for (let j = i + 1; j < this.entries.length; j++) this.bump(this.entries[i], this.entries[j]);
    }

    if (this.phase === 'race' && c.just('space')) this.useGadget(this.player);

    this.updatePickups(dt);
    this.updateSlicks(dt);
    for (const e of this.entries) this.handleEvents(e);
    this.updatePlaces();
  }

  private inZone(zones: Zone[], b: CarBody) {
    if (b.airborne) return false;
    for (const z of zones) {
      const ds = this.geo.wrap(b.pos.s - z.s0);
      if (ds < z.s1 - z.s0 && Math.abs(b.pos.lateral - z.lat) < z.half) return true;
    }
    return false;
  }

  private bump(a: Entry, b: Entry) {
    // A boing bumper sends whoever is in front flying.
    for (const [hitter, target] of [[a, b], [b, a]] as const) {
      if (hitter.body.boing <= 0 || target.body.spin > 0) continue;
      const dx = target.body.x - hitter.body.x, dz = target.body.z - hitter.body.z;
      const d = Math.hypot(dx, dz);
      const fx = Math.cos(hitter.body.heading), fz = Math.sin(hitter.body.heading);
      if (d < 4.2 && (dx * fx + dz * fz) / d > 0.3) {
        target.body.vx += (dx / d) * 14 + fx * 4;
        target.body.vz += (dz / d) * 14 + fz * 4;
        target.body.startSpin(target.body.stats.spinTime * 0.7);
        hitter.body.boing = 0;
        sfx.boing();
        this.effects.sparkle(target.body.x, target.body.y, target.body.z, '#ffffff', 12);
        if (hitter === this.player || target === this.player) speak('boing', { priority: 0, cooldown: 10 });
      }
    }
    const impact = collideCars(a.body, b.body);
    if (impact > 5 && (a === this.player || b === this.player)) sfx.bump();
  }

  private useGadget(e: Entry) {
    const b = e.body;
    if (b.charges <= 0 || b.towing > 0 || b.spin > 0) return;
    b.charges--;
    const mine = e === this.player;
    gadgetHintGiven ||= mine;
    switch (e.gadget) {
      case 'boost':
        b.boost = 1.6;
        if (mine || this.near(e)) sfx.boost();
        if (mine) speak('boost', { priority: 0, cooldown: 15 });
        break;
      case 'goo': {
        const x = b.x - Math.cos(b.heading) * 3.4, z = b.z - Math.sin(b.heading) * 3.4;
        const pos = this.geo.locate(x, z, b.pos.i);
        const mesh = new THREE.Mesh(new THREE.CircleGeometry(2.3, 20), toon('#ffffff', { map: texture('goo-puddle', emojiArt('🟢')), transparent: true }));
        mesh.geometry.rotateX(-Math.PI / 2);
        mesh.position.set(x, pos.h + 0.12, z);
        this.view.scene.add(mesh);
        this.slicks.push({ mesh, x, z, owner: e, age: 0 });
        if (mine || this.near(e)) sfx.splat();
        break;
      }
      case 'boing':
        b.boing = 2.2;
        if (mine || this.near(e)) sfx.boing();
        break;
    }
  }

  private near(e: Entry) {
    return Math.hypot(e.body.x - this.player.body.x, e.body.z - this.player.body.z) < 35;
  }

  private aiGadgets(e: Entry, dt: number) {
    const ai = e.ai!;
    const b = e.body;
    ai.gadgetCooldown -= dt;
    if (b.charges <= 0 || ai.gadgetCooldown > 0 || this.phase !== 'race') return;
    const gap = b.progress(this.geo) - this.player.body.progress(this.geo);
    const sameLane = Math.abs(b.pos.lateral - this.player.body.pos.lateral) < 4;
    let use = false;
    if (e.gadget === 'boost') use = this.geo.maxCurveAhead(b.pos.s, 40) < 0.025 && gap < 30;
    else if (e.gadget === 'goo') use = gap > 4 && gap < 22;
    else if (e.gadget === 'boing') use = gap < -1 && gap > -7 && sameLane;
    if (ai.gadgetCooldown < -15) use = true; // don't hoard forever
    if (!use) return;
    this.useGadget(e);
    ai.gadgetCooldown = AI_COOLDOWN[state.data.settings.difficulty] * (0.7 + Math.random() * 0.6);
  }

  private updatePickups(dt: number) {
    const spin = this.raceTime * 2;
    for (const c of this.crates) {
      if (c.away > 0) {
        c.away -= dt;
        c.mesh.visible = c.away <= 0;
        continue;
      }
      for (const e of this.entries) {
        const b = e.body;
        if (Math.hypot(b.x - c.x, b.z - c.z) > 2.2 || b.towing > 0) continue;
        c.away = 5;
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

  private updateSlicks(dt: number) {
    for (let i = this.slicks.length - 1; i >= 0; i--) {
      const sl = this.slicks[i];
      sl.age += dt;
      let hit: Entry | undefined;
      for (const e of this.entries) {
        if (e === sl.owner && sl.age < 1.5) continue;
        const b = e.body;
        if (!b.airborne && b.towing <= 0 && Math.hypot(b.x - sl.x, b.z - sl.z) < 2.4) hit = e;
      }
      if (hit) {
        hit.body.startSpin(hit.body.stats.spinTime);
        this.effects.splat(sl.x, hit.body.y, sl.z);
        if (hit === this.player) speak('got-spun', { priority: 0, cooldown: 20 });
        else if (sl.owner === this.player) speak('goo', { priority: 0, cooldown: 12 });
        if (hit === this.player || this.near(hit)) sfx.splat();
      }
      if (hit || sl.age > 14) {
        this.view.scene.remove(sl.mesh);
        sl.mesh.geometry.dispose();
        this.slicks.splice(i, 1);
      } else sl.mesh.scale.setScalar(Math.min(1, sl.age * 4));
    }
  }

  private handleEvents(e: Entry) {
    const b = e.body;
    const mine = e === this.player;
    for (const ev of b.events) {
      switch (ev) {
        case 'wall':
          if (mine) sfx.wall(b.lastHit / 6);
          this.effects.dust(b.x, b.y, b.z, this.dustColor, 3);
          break;
        case 'takeoff':
          if (mine && this.geo.onJump(b.pos.s)) {
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
            this.shake = 0.7;
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
        case 'boostpad':
          if (mine) sfx.boost();
          break;
        case 'lap':
          if (mine && !b.finished && b.lap > 0) {
            if (b.lap === this.laps - 1) {
              this.hud.show('FINAL LAP!', 1.8, true);
              speak('final-lap', { priority: 2 });
            } else this.hud.show(`LAP ${b.lap + 1}`, 1.2, true);
            sfx.lap();
          }
          break;
        case 'finish':
          b.finishTime = this.raceTime;
          this.finishOrder.push(e);
          if (mine) this.playerFinished();
          break;
      }
    }
    b.events.length = 0;
  }

  private playerFinished() {
    const place = this.finishOrder.indexOf(this.player) + 1;
    this.phase = 'finish';
    this.t = 0;
    this.hud.show(place === 1 ? 'YOU WIN!' : 'FINISH!', 0);
    sfx.cheer();
    if (place === 1) sfx.fanfare();
    // Let the computer drive the victory lap.
    this.player.ai = new AIDriver(this.player.body, this.player.body.stats.maxSpeed * 0.8, 0);
    this.engine.update(0.3, false);
  }

  private currentOrder(): Entry[] {
    const rest = this.entries.filter((e) => !this.finishOrder.includes(e));
    rest.sort((a, b) => b.body.progress(this.geo) - a.body.progress(this.geo));
    return [...this.finishOrder, ...rest];
  }

  private updatePlaces() {
    const order = this.currentOrder();
    this.hud.setOrder(order.map((e) => e.racer.id));
    const place = order.indexOf(this.player) + 1;
    if (this.phase === 'race' && this.raceTime > 4 && this.lastPlace && place < this.lastPlace) {
      if (place === 1) speak('lead', { priority: 1, cooldown: 25 });
      else speak('passed', { priority: 0, cooldown: 15 });
    }
    this.lastPlace = place;
    const pb = this.player.body;
    this.hud.setLap(pb.lap, this.laps);
    this.hud.setGadget(pb.charges);
    this.hud.setBolts(pb.bolts);
    for (const e of this.entries) this.hud.setDot(e.racer.id, e.body.x, e.body.z);
  }

  // ------------------------------------------------------------------ visuals

  private syncVisuals(dt: number) {
    for (const e of this.entries) {
      const b = e.body, m = e.model;
      m.root.position.set(b.x, b.y, b.z);
      m.root.rotation.y = -b.heading;
      const fwd = b.forwardSpeed;
      // Tilt with the road, lean into turns.
      const facing = Math.cos(b.heading) * b.pos.tx + Math.sin(b.heading) * b.pos.tz;
      const slope = (this.geo.heightAt(b.pos.s + 1.5) - this.geo.heightAt(b.pos.s - 1.5)) / 3;
      const pitch = b.airborne ? Math.max(-0.4, Math.min(0.4, b.vy * 0.04)) : Math.atan(slope) * facing;
      m.chassis.rotation.z += (pitch - m.chassis.rotation.z) * Math.min(1, dt * 10);
      m.chassis.rotation.x += (e.steer * 0.08 * Math.min(1, Math.abs(fwd) / 20) - m.chassis.rotation.x) * Math.min(1, dt * 6);
      for (const w of m.wheels) {
        w.rotation.z -= (fwd * dt) / m.wheelRadius;
        if (w.position.x > 0) w.rotation.y = -e.steer * 0.35;
      }
      // Gadgets.
      m.boing.visible = b.boing > 0;
      if (b.boing > 0) m.boing.scale.x = Math.min(1, (2.2 - b.boing) * 6);
      m.flames.visible = b.boost > 0;
      if (b.boost > 0) {
        m.flames.scale.set(0.8 + Math.random() * 0.5, 1, 1);
        if (Math.random() < 0.5) this.effects.smoke(b.x - Math.cos(b.heading) * 2.5, b.y + 1, b.z - Math.sin(b.heading) * 2.5);
      }
      // Dust from the back wheels.
      if (!b.airborne && b.towing <= 0 && Math.abs(fwd) > 6 && Math.random() < (e === this.player ? 0.5 : 0.25))
        this.effects.dust(b.x - Math.cos(b.heading) * 1.6, b.y, b.z - Math.sin(b.heading) * 1.6, b.slowed ? '#9be15d' : this.dustColor);
      if (b.spin > 0 && Math.random() < 0.15) this.effects.sparkle(b.x, b.y + 1.5, b.z, '#ffffff', 2);
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
      for (const [x, z] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
        const rotor = cyl(0.55, 0.05, '#34343c', x, 0.3, z, d, 12);
        rotor.name = 'rotor';
      }
      const cable = cyl(0.04, 2.2, '#222', 0, -1.2, 0, d);
      cable.name = 'cable';
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
    let halfH = VIEW_HEIGHT / 2;
    if (aspect < 1.2) halfH = (VIEW_HEIGHT * 0.6) / aspect;
    cam.left = -halfH * aspect;
    cam.right = halfH * aspect;
    cam.top = halfH;
    cam.bottom = -halfH;
    cam.updateProjectionMatrix();

    const pb = this.player.body;
    const want = new THREE.Vector3(pb.x + pb.vx * 0.45, pb.y, pb.z + pb.vz * 0.45);
    this.camTarget.lerp(want, dt ? 1 - Math.exp(-4 * dt) : 1);
    const look = this.camTarget.clone();
    if (this.shake > 0) {
      look.x += (Math.random() - 0.5) * this.shake;
      look.y += (Math.random() - 0.5) * this.shake;
      this.shake = Math.max(0, this.shake - dt * 1.8);
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
      <button class="btn" data-nav data-a="garage">🔧 Garage</button>
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
        else if (a === 'restart') game.go(new RaceScene(this.trackId));
        else if (a === 'garage') game.go(new GarageScene());
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

  private toPodium() {
    const order = this.currentOrder();
    const result: RaceResult = {
      trackId: this.trackId,
      order: order.map((e) => e.racer),
      place: this.finishOrder.indexOf(this.player) + 1,
      bolts: this.player.body.bolts,
    };
    game.go(new PodiumScene(result));
  }

  exit() {
    this.engine.stop();
    stopVoice();
    stopMusic();
    this.view.scene.traverse((o) => {
      if (o instanceof THREE.Mesh) o.geometry.dispose();
    });
  }
}

function bodyToCar(body: BodyKind): string {
  return { buggy: 'buggy', hopper: 'hopper', truck: 'spike', monster: 'monster', rig: 'rig' }[body];
}

