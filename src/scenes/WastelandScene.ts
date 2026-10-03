import * as THREE from 'three';
import { game, type Scene } from '../Game';
import { WAR_BOYS } from '../data/characters';
import { CHAPTERS, DOORS, EVENTS, LANDMARKS, START_POS, type StoryEvent } from '../data/story';
import { THEMES } from '../data/worlds';
import { toon } from '../art/materials';
import { hazard, propPlaceholder, speckle } from '../art/placeholders';
import { sfx } from '../audio/sfx';
import { speak } from '../audio/voice';
import { artHtml, texture } from '../systems/assets';
import type { CarEvent } from '../race/CarBody';
import { EventScene, type Entry, type Mode } from '../race/EventScene';
import { TerrainGround, type Obstacle } from '../race/ground';
import { storyAiSpeed } from '../systems/Economy';
import { state } from '../systems/GameState';
import { currentChapter, eventOpen, eventWon, nextEvent } from '../systems/Story';
import { Nav, html } from '../ui/nav';
import { openSettings } from '../ui/settings';
import { addCrew, steerToward } from '../modes/common';
import { ComicScene } from './ComicScene';
import { startEvent } from './events';
import { GarageScene } from './GarageScene';
import { TitleScene } from './TitleScene';
import { TrackSelectScene } from './TrackSelectScene';

/**
 * The Wasteland: drive anywhere. Story events are marked by colored beams;
 * drive into one to start it. War Boy patrols roam, and guzzoline and chrome
 * are hidden around the map. Steer help points you at your next adventure.
 */
const HALF = 800;
const MODE_INFO: Record<StoryEvent['mode'], { label: string; icon: string; emoji: string; color: string }> = {
  race: { label: 'Race', icon: 'mk-race', emoji: '🏁', color: '#ffd23f' },
  chase: { label: 'Chase', icon: 'mk-chase', emoji: '💨', color: '#ff7a1a' },
  escort: { label: 'Escort', icon: 'mk-escort', emoji: '🚛', color: '#1fb5ad' },
  arena: { label: 'Smash', icon: 'mk-arena', emoji: '⛽', color: '#e8322a' },
  boss: { label: 'BOSS', icon: 'mk-boss', emoji: '💀', color: '#b8281e' },
};

/** Where to put the car when coming back to the map (next to the last place you went). */
let returnTo: { x: number; z: number } | undefined;

interface Marker {
  kind: 'event' | 'door';
  id: string;
  name: string;
  x: number;
  z: number;
  group: THREE.Group;
  beam: THREE.Mesh;
  event?: StoryEvent;
  door?: (typeof DOORS)[number];
}

interface Pickup { id: string; kind: 'guzzoline' | 'chrome'; x: number; z: number; mesh: THREE.Object3D }

/** Seeded random numbers, so the map is the same every time. */
function rng(seed: number) {
  return () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
}

/** Roads drawn between the big places (for looks and finding your way). */
const ROADS: [number, number][][] = [
  [[0, -520], [0, -400], [10, -250], [0, -100], [0, 60]],
  [[0, -250], [200, -220], [400, -140], [560, -80]],
  [[0, -250], [-200, -200], [-420, -120], [-560, -60]],
  [[0, 60], [20, 200], [0, 300], [-150, 450], [-440, 600]],
  [[560, -80], [520, 150], [470, 350], [430, 500]],
  [[0, -420], [140, -440], [270, -430]],
  [[0, 60], [-160, 110], [-430, 50]],
  [[0, 60], [230, 110], [520, 60]],
];

class WastelandMode implements Mode {
  readonly freeRoam = true;
  readonly viewHeight = 46;
  readonly ground: TerrainGround;
  readonly world = THEMES[0];
  readonly laps = 0;
  readonly music = 'music-wasteland';
  readonly variants = [];
  private markers: Marker[] = [];
  private pickups: Pickup[] = [];
  private near?: Marker;
  private card?: HTMLElement;
  private overlay!: HTMLElement;
  private arrow!: HTMLElement;
  private patrolT = 5;
  private patrolN = 0;
  private objective?: StoryEvent;

  constructor() {
    const obstacles: Obstacle[] = LANDMARKS.map((l) => ({ x: l.at[0], z: l.at[1] - 8, r: l.scale * 0.55 }));
    const flats = [
      ...LANDMARKS.map((l) => ({ x: l.at[0], z: l.at[1], r: l.scale * 1.6 })),
      ...EVENTS.map((e) => ({ x: e.at[0], z: e.at[1], r: 14 })),
      ...DOORS.map((d) => ({ x: d.at[0], z: d.at[1], r: 14 })),
    ];
    // Scattered rocks to steer around.
    const rand = rng(42);
    for (let i = 0; i < 70; i++) {
      const x = (rand() * 2 - 1) * (HALF - 40), z = (rand() * 2 - 1) * (HALF - 40);
      if (flats.some((f) => Math.hypot(f.x - x, f.z - z) < f.r + 10) || nearRoad(x, z, 14)) continue;
      obstacles.push({ x, z, r: 2.5 + rand() * 2.5 });
    }
    this.ground = new TerrainGround(HALF, obstacles, flats);
    // A few big ramps along the roads, just for fun.
    this.ground.ramps.push(
      { x: 4, z: -190, angle: Math.PI / 2, len: 18, w: 10, h: 3.4 },
      { x: 300, z: -160, angle: -0.35, len: 18, w: 10, h: 3.4 },
      { x: -300, z: -150, angle: Math.PI + 0.35, len: 18, w: 10, h: 3.4 },
      { x: 12, z: 160, angle: Math.PI / 2, len: 18, w: 10, h: 3.4 },
      { x: 500, z: 250, angle: Math.PI / 2 + 0.2, len: 18, w: 10, h: 3.4 },
    );
    this.objective = nextEvent(state.data);
    this.ground.aim = () => (this.objective ? { x: this.objective.at[0], z: this.objective.at[1] } : undefined);
  }

  intro() {
    return undefined;
  }

  decorate(core: EventScene) {
    const scene = core.view.scene;
    // Rolling dunes.
    const geo = new THREE.PlaneGeometry(HALF * 2 + 200, HALF * 2 + 200, 180, 180);
    geo.rotateX(-Math.PI / 2);
    const pos = geo.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i++) pos.setY(i, this.ground.heightAt(pos.getX(i), pos.getZ(i)));
    geo.computeVertexNormals();
    const tex = texture(this.world.ground, speckle(this.world.groundColor, 5), { repeat: true });
    tex.repeat.set(70, 70);
    const terrain = new THREE.Mesh(geo, toon('#c9b8a6', { map: tex }));
    terrain.receiveShadow = true;
    scene.add(terrain);

    // Roads.
    const roadTex = texture('road-fury', speckle('#b9773f', 9), { repeat: true });
    const roadMat = toon('#ffffff', { map: roadTex });
    for (const road of ROADS) scene.add(this.roadMesh(road, roadMat));

    // Landmarks (big billboards).
    for (const l of LANDMARKS) {
      const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture(l.art, propPlaceholder('prop-citadel')), alphaTest: 0.3 }));
      sprite.scale.set(l.scale * 1.1, l.scale * 1.25, 1);
      sprite.center.set(0.5, 0.04);
      sprite.position.set(l.at[0], 0, l.at[1]);
      scene.add(sprite);
    }
    // Rocks and scenery.
    const rand = rng(7);
    for (const o of this.ground.obstacles.slice(LANDMARKS.length)) {
      const key = rand() < 0.6 ? 'prop-canyonrock' : 'prop-rock';
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture(key, propPlaceholder(key)), alphaTest: 0.3 }));
      s.scale.set(o.r * 2.6, o.r * 3.2, 1);
      s.center.set(0.5, 0.05);
      s.position.set(o.x, this.ground.heightAt(o.x, o.z), o.z);
      scene.add(s);
    }
    for (let i = 0; i < 160; i++) {
      const x = (rand() * 2 - 1) * HALF, z = (rand() * 2 - 1) * HALF;
      if (nearRoad(x, z, 10)) continue;
      const key = this.world.props[Math.floor(rand() * this.world.props.length)];
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture(key, propPlaceholder(key)), alphaTest: 0.3 }));
      const h = 4 + rand() * 3;
      s.scale.set(h, h, 1);
      s.center.set(0.5, 0.05);
      s.position.set(x, this.ground.heightAt(x, z), z);
      scene.add(s);
    }
    // Striped ramps, shaped like their slopes.
    const rampTex = texture('hazard', hazard, { repeat: true });
    for (const r of this.ground.ramps) {
      const g = new THREE.PlaneGeometry(r.len, r.w, 12, 2);
      g.rotateX(-Math.PI / 2);
      const pos = g.attributes.position as THREE.BufferAttribute;
      const c = Math.cos(r.angle), sn = Math.sin(r.angle);
      for (let i = 0; i < pos.count; i++) {
        const u = pos.getX(i) + r.len / 2, v = pos.getZ(i);
        const x = r.x + u * c - v * sn, z = r.z + u * sn + v * c;
        pos.setXYZ(i, x, this.ground.heightAt(x, z) + 0.12, z);
      }
      g.computeVertexNormals();
      const m = new THREE.Mesh(g, toon('#ffffff', { map: rampTex }));
      (m.material as THREE.Material).side = THREE.DoubleSide;
      m.receiveShadow = m.castShadow = true;
      scene.add(m);
    }
    this.buildMarkers(core);
    this.buildPickups(core);
  }

  private roadMesh(points: [number, number][], mat: THREE.Material) {
    // A smooth ribbon laid over the dunes.
    const curve = new THREE.CatmullRomCurve3(points.map(([x, z]) => new THREE.Vector3(x, 0, z)));
    const pts = curve.getSpacedPoints(Math.ceil(curve.getLength() / 4));
    const verts: number[] = [], uvs: number[] = [], idx: number[] = [];
    let dist = 0;
    pts.forEach((p, i) => {
      const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)];
      const tx = b.x - a.x, tz = b.z - a.z, l = Math.hypot(tx, tz) || 1;
      const nx = tz / l, nz = -tx / l;
      if (i) dist += p.distanceTo(pts[i - 1]);
      for (const side of [5, -5]) {
        const x = p.x + nx * side, z = p.z + nz * side;
        verts.push(x, this.ground.heightAt(x, z) + 0.15, z);
        uvs.push(side > 0 ? 0 : 1, dist / 10);
      }
      if (i) idx.push(i * 2 - 2, i * 2, i * 2 - 1, i * 2 - 1, i * 2, i * 2 + 1);
    });
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    g.setIndex(idx);
    g.computeVertexNormals();
    const m = new THREE.Mesh(g, mat);
    (m.material as THREE.Material).side = THREE.DoubleSide;
    m.receiveShadow = true;
    return m;
  }

  private buildMarkers(core: EventScene) {
    const s = state.data;
    const chapter = currentChapter(s);
    const add = (kind: Marker['kind'], id: string, name: string, x: number, z: number, color: string, icon: string, emoji: string, extra: Partial<Marker>) => {
      const group = new THREE.Group();
      const h = this.ground.heightAt(x, z);
      group.position.set(x, h, z);
      const ring = new THREE.Mesh(new THREE.RingGeometry(5, 6.5, 40), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.85, side: THREE.DoubleSide, depthWrite: false }));
      ring.rotation.x = -Math.PI / 2;
      ring.position.y = 0.2;
      const beam = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 2.4, 40, 16, 1, true), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.28, side: THREE.DoubleSide, depthWrite: false }));
      beam.position.y = 20;
      const sign = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture(icon, propPlaceholder('prop-sign')), alphaTest: 0.2 }));
      sign.scale.set(6, 6, 1);
      sign.position.y = 9;
      sign.name = 'icon';
      group.add(ring, beam, sign);
      core.view.scene.add(group);
      this.markers.push({ kind, id, name, x, z, group, beam, ...extra });
      void emoji;
    };
    for (const ev of EVENTS) {
      if (ev.chapter > chapter) continue;
      const info = MODE_INFO[ev.mode];
      const open = eventOpen(s, ev), won = eventWon(s, ev.id);
      if (!open && ev.mode !== 'boss') continue;
      add('event', ev.id, ev.name, ev.at[0], ev.at[1], won ? '#9aa3ad' : open ? info.color : '#4a4a4a', info.icon, info.emoji, { event: ev });
    }
    for (const d of DOORS) add('door', d.id, d.name, d.at[0], d.at[1], '#7bcf3c', d.icon, d.emoji, { door: d });
  }

  private buildPickups(core: EventScene) {
    const rand = rng(99);
    const s = state.data;
    for (let i = 0; i < 50; i++) {
      const kind = i < 40 ? 'guzzoline' : 'chrome';
      const id = `${kind[0]}${i}`;
      let x = 0, z = 0;
      for (let k = 0; k < 20; k++) {
        x = (rand() * 2 - 1) * (HALF - 30);
        z = (rand() * 2 - 1) * (HALF - 30);
        if (!this.ground.obstacles.some((o) => Math.hypot(o.x - x, o.z - z) < o.r + 4)) break;
      }
      if (s.collected.includes(id)) continue;
      const mesh = new THREE.Mesh(kind === 'guzzoline' ? new THREE.BoxGeometry(1, 1.3, 0.55) : new THREE.OctahedronGeometry(0.9), toon(kind === 'guzzoline' ? '#d2201e' : '#e8eef4', { emissive: kind === 'guzzoline' ? '#5a0000' : '#8899aa' }));
      mesh.castShadow = true;
      mesh.position.set(x, this.ground.heightAt(x, z) + 1.2, z);
      core.view.scene.add(mesh);
      this.pickups.push({ id, kind, x, z, mesh });
    }
    // A few gadget crates near the roads, for fighting patrols.
    for (const road of ROADS) for (const [x, z] of road.slice(1, -1)) core.addCrate(x + 8, z + 8, this.ground.heightAt(x + 8, z + 8), 20);
  }

  setup(core: EventScene) {
    const p = core.addPlayer();
    const at = returnTo ?? { x: START_POS[0], z: START_POS[1] };
    p.body.placeAt(this.ground, at.x, at.z, -Math.PI / 2);
    p.body.charges = 1;
    addCrew(core, (e, i) => e.body.placeAt(this.ground, at.x + (i ? -6 : 6), at.z + 8, -Math.PI / 2));
  }

  update(core: EventScene, dt: number) {
    if (!this.overlay) this.buildOverlay(core);
    const p = core.player.body;
    const t = core.raceTime;
    // Markers bob and glow; the nearest open one shows its card.
    let near: Marker | undefined;
    for (const m of this.markers) {
      const icon = m.group.getObjectByName('icon')!;
      icon.position.y = 9 + Math.sin(t * 2 + m.x) * 0.6;
      (m.beam.material as THREE.MeshBasicMaterial).opacity = 0.2 + 0.12 * Math.sin(t * 3 + m.z);
      if (Math.hypot(p.x - m.x, p.z - m.z) < 11) near = m;
    }
    if (near !== this.near) this.showCard(core, near);
    if (this.near && game.controls.just('space')) this.activate(core, this.near);
    // Coasting into a marker brings the car to a gentle stop inside the ring.
    if (this.near && !game.controls.held('up')) {
      p.vx *= 1 - 3 * dt;
      p.vz *= 1 - 3 * dt;
    }

    // Pickups.
    for (let i = this.pickups.length - 1; i >= 0; i--) {
      const k = this.pickups[i];
      k.mesh.rotation.y = t * 2;
      if (Math.hypot(p.x - k.x, p.z - k.z) > 2.6) continue;
      const s = state.data;
      s.collected.push(k.id);
      if (k.kind === 'guzzoline') { s.guzzoline += 5; speak('world-guzzoline', { priority: 0, cooldown: 3 }); sfx.bolt(); }
      else { s.chrome += 1; s.totalChrome += 1; speak('shiny', { priority: 0, cooldown: 3 }); sfx.crate(); }
      state.persist();
      core.effects.sparkle(k.x, this.ground.heightAt(k.x, k.z), k.z, k.kind === 'guzzoline' ? '#ff4d4d' : '#ffffff', 12);
      core.view.scene.remove(k.mesh);
      this.pickups.splice(i, 1);
    }

    this.updatePatrols(core, dt);
    this.updateOverlay(core);
  }

  private updatePatrols(core: EventScene, dt: number) {
    const p = core.player.body;
    const patrols = core.fighters.filter((e) => e.racer.id.startsWith('patrol'));
    for (const e of patrols) if (Math.hypot(e.body.x - p.x, e.body.z - p.z) > 220) core.removeEntry(e);
    this.patrolT -= dt;
    if (this.patrolT > 0 || patrols.length >= 2 || currentChapter(state.data) === 0) return;
    this.patrolT = 12 + Math.random() * 10;
    const r = WAR_BOYS[this.patrolN % WAR_BOYS.length];
    const e = core.addOpponent({ ...r, id: `patrol${this.patrolN++}` }, 'thunder', { engine: 1, tires: 1, armor: 0, gadget: 0 }, storyAiSpeed(currentChapter(state.data), state.data.settings.difficulty) * 0.8);
    const a = Math.random() * Math.PI * 2;
    const x = Math.max(-HALF + 20, Math.min(HALF - 20, p.x + Math.cos(a) * 90)), z = Math.max(-HALF + 20, Math.min(HALF - 20, p.z + Math.sin(a) * 90));
    e.body.placeAt(this.ground, x, z, a + Math.PI);
    e.body.charges = 1;
    let spotted = false;
    let wander = { x, z };
    e.brain = () => {
      const d = Math.hypot(p.x - e.body.x, p.z - e.body.z);
      if (d < 55) {
        if (!spotted) { spotted = true; speak('world-patrol', { priority: 0, cooldown: 30 }); }
        return steerToward(e.body, p.x, p.z);
      }
      if (Math.hypot(wander.x - e.body.x, wander.z - e.body.z) < 10) wander = { x: e.body.x + (Math.random() - 0.5) * 120, z: e.body.z + (Math.random() - 0.5) * 120 };
      return steerToward(e.body, wander.x, wander.z, 14);
    };
  }

  onEvent(core: EventScene, e: Entry, ev: CarEvent) {
    // Wrecked patrols drop guzzoline and are gone for a while.
    if (ev === 'wreck' && e.racer.id.startsWith('patrol')) {
      state.data.guzzoline += 10;
      state.persist();
    }
    if (ev === 'respawn' && e.racer.id.startsWith('patrol')) core.removeEntry(e);
  }

  private showCard(core: EventScene, m?: Marker) {
    this.near = m;
    this.card?.remove();
    this.card = undefined;
    if (!m) return;
    sfx.select();
    let body: string;
    if (m.event) {
      const ev = m.event;
      const info = MODE_INFO[ev.mode];
      const open = eventOpen(state.data, ev);
      const stars = state.data.story[ev.id]?.stars ?? 0;
      body = `<div class="icon">${artHtml(info.icon, info.emoji)}</div>
        <div><div class="kind" style="color:${info.color}">${info.label}</div><div class="name">${ev.name}</div>
        <div class="stars-row">${[0, 1, 2].map((i) => `<span class="${i < stars ? 'on' : ''}">★</span>`).join('')}</div></div>
        <div class="go">${open ? '<span class="keycap">SPACE</span> Let’s go!' : '🔒 Win the rest of this chapter first'}</div>`;
      if (open) speak(ev.intro, { priority: 1, cooldown: 20 });
      else speak('world-locked', { priority: 1, cooldown: 10 });
    } else body = `<div class="icon">${artHtml(m.door!.icon, m.door!.emoji)}</div><div><div class="name">${m.name}</div></div><div class="go"><span class="keycap">SPACE</span> Go in</div>`;
    this.card = html(`<div class="event-card panel pop">${body}</div>`);
    core.hud.el.appendChild(this.card);
  }

  private activate(_core: EventScene, m: Marker) {
    returnTo = { x: m.x, z: m.z + 14 };
    sfx.confirm();
    if (m.door) return game.go(m.door.id === 'garage' ? new GarageScene() : new TrackSelectScene());
    const ev = m.event!;
    if (!eventOpen(state.data, ev)) return sfx.nope();
    game.go(startEvent(ev));
  }

  private buildOverlay(core: EventScene) {
    this.overlay = html(`<div class="wasteland-hud"><div class="wallet"></div><div class="objective"></div></div>`);
    this.arrow = html(`<div class="obj-arrow">➤</div>`);
    core.hud.el.appendChild(this.overlay);
    core.hud.el.appendChild(this.arrow);
    core.hud.el.classList.add('wasteland');
    const s = state.data;
    const n = currentChapter(s);
    if (n && !this.objective) speak('world-hello', { priority: 1, cooldown: 600 });
    else if (this.objective?.mode === 'boss') speak('boss-ready', { priority: 1, cooldown: 120 });
    else speak('world-hello', { priority: 1, cooldown: 600 });
  }

  private updateOverlay(core: EventScene) {
    const s = state.data;
    this.overlay.querySelector('.wallet')!.innerHTML = `
      <span>${artHtml('icon-scrap', '🔩')}${s.scrap}</span><span>${artHtml('icon-chrome', '💎')}${s.chrome}</span><span>${artHtml('icon-guzzoline', '⛽')}${s.guzzoline}</span>`;
    const obj = this.objective;
    const objEl = this.overlay.querySelector('.objective')!;
    if (!obj) {
      objEl.innerHTML = '🏆 Road Warrior! Every chapter done.';
      this.arrow.style.display = 'none';
      return;
    }
    const p = core.player.body;
    const d = Math.hypot(obj.at[0] - p.x, obj.at[1] - p.z);
    objEl.innerHTML = `Chapter ${obj.chapter}: ${CHAPTERS[obj.chapter - 1].name}<br><b>${MODE_INFO[obj.mode].emoji} ${obj.name}</b> · ${Math.round(d)}m`;
    // An arrow around the car pointing at the next event (hidden when it's on screen).
    const cam = core.view.camera;
    const target = new THREE.Vector3(obj.at[0], this.ground.heightAt(obj.at[0], obj.at[1]), obj.at[1]).project(cam);
    const me = new THREE.Vector3(p.x, p.y, p.z).project(cam);
    const onScreen = Math.abs(target.x) < 0.85 && Math.abs(target.y) < 0.8;
    this.arrow.style.display = onScreen ? 'none' : '';
    const angle = Math.atan2(-(target.y - me.y) * game.height, (target.x - me.x) * game.width);
    const sx = ((me.x + 1) / 2) * game.width + Math.cos(angle) * 90;
    const sy = ((1 - me.y) / 2) * game.height + Math.sin(angle) * 90;
    this.arrow.style.transform = `translate(${sx - 24}px, ${sy - 24}px) rotate(${angle}rad)`;
  }

  order(core: EventScene) {
    return core.fighters;
  }

  /** Space starts an event (instead of firing) whenever you're at a marker. */
  spaceTaken(core: EventScene) {
    const p = core.player.body;
    return this.markers.some((m) => Math.hypot(p.x - m.x, p.z - m.z) < 13);
  }

  progress() {
    return 0;
  }

  finish(): Scene {
    return new WastelandScene();
  }

  restart(): Scene {
    return new WastelandScene();
  }

  minimap() {
    // The whole map: landmarks, events and doors.
    const size = 190;
    const scale = (size - 16) / (HALF * 2 * Math.SQRT2);
    const toSvg = (x: number, z: number): [number, number] => [size / 2 + (x - z) * Math.SQRT1_2 * scale, size / 2 + (x + z) * Math.SQRT1_2 * 0.6 * scale];
    const corner = [toSvg(-HALF, -HALF), toSvg(HALF, -HALF), toSvg(HALF, HALF), toSvg(-HALF, HALF)];
    let svg = `<path d="M${corner.map((c) => c.map((v) => v.toFixed(1)).join(',')).join('L')}Z" fill="rgba(217,154,90,0.45)" stroke="#fff4dc" stroke-width="3"/>`;
    for (const r of ROADS) svg += `<path d="M${r.map(([x, z]) => toSvg(x, z).map((v) => v.toFixed(1)).join(',')).join('L')}" fill="none" stroke="#7a4a22" stroke-width="2"/>`;
    for (const l of LANDMARKS) {
      const [x, y] = toSvg(l.at[0], l.at[1]);
      svg += `<rect x="${x - 4}" y="${y - 4}" width="8" height="8" fill="#5a3a1e"/>`;
    }
    for (const m of this.markers) {
      const [x, y] = toSvg(m.x, m.z);
      const color = m.event ? (eventWon(state.data, m.event.id) ? '#9aa3ad' : MODE_INFO[m.event.mode].color) : '#7bcf3c';
      svg += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="4" fill="${color}" stroke="#111" stroke-width="1.5"/>`;
    }
    return { svg, toSvg };
  }

  /** Esc: fast travel to any open event, or to the garage. */
  menu(core: EventScene, close: () => void) {
    const s = state.data;
    const items = EVENTS.filter((e) => eventOpen(s, e));
    const back = html(`<div class="modal-back"><div class="modal panel travel">
      <h2 class="outlined">The Wasteland</h2>
      <div class="list"></div>
      <div class="row-btns">
        <button class="btn green" data-nav data-a="go">▶ Keep Driving</button>
        <button class="btn" data-nav data-a="garage">🔧 Garage</button>
        <button class="btn" data-nav data-a="classics">🏟️ Classics</button>
        <button class="btn gray" data-nav data-a="settings">⚙ Grown-ups</button>
        <button class="btn gray" data-nav data-a="title">🏠 Title</button>
      </div></div></div>`);
    const modal = back.firstElementChild as HTMLElement;
    const list = modal.querySelector('.list')!;
    for (const ev of items) {
      const info = MODE_INFO[ev.mode];
      const stars = s.story[ev.id]?.stars ?? 0;
      const b = html(`<button class="btn travel-item ${eventWon(s, ev.id) ? 'teal' : ''}" data-nav>${artHtml(info.icon, info.emoji)}<span>${ev.name}</span><span class="mini-stars">${'★'.repeat(stars)}${'☆'.repeat(3 - stars)}</span></button>`);
      b.onclick = () => {
        returnTo = { x: ev.at[0], z: ev.at[1] + 14 };
        sfx.confirm();
        game.go(startEvent(ev));
      };
      list.appendChild(b);
    }
    const nav = new Nav(modal);
    const done = () => {
      back.remove();
      close();
    };
    let settings: { update(): void } | undefined;
    modal.querySelectorAll<HTMLElement>('[data-a]').forEach((b) => {
      b.onclick = () => {
        sfx.confirm();
        const a = b.dataset.a;
        if (a === 'go') done();
        else if (a === 'garage') game.go(new GarageScene());
        else if (a === 'classics') game.go(new TrackSelectScene());
        else if (a === 'title') game.go(new TitleScene());
        else if (a === 'settings') {
          back.style.display = 'none';
          settings = openSettings(() => {
            back.style.display = '';
            settings = undefined;
            nav.refocus();
          });
        }
      };
    });
    core.hud.el.parentElement!.appendChild(back);
    nav.refocus('[data-a="go"]');
    return {
      update: () => {
        if (settings) return settings.update();
        if (game.controls.back()) return done();
        nav.update(game.controls);
      },
    };
  }
}

function nearRoad(x: number, z: number, dist: number) {
  for (const road of ROADS)
    for (let i = 1; i < road.length; i++) {
      const [ax, az] = road[i - 1], [bx, bz] = road[i];
      const vx = bx - ax, vz = bz - az, l2 = vx * vx + vz * vz;
      const t = Math.max(0, Math.min(1, ((x - ax) * vx + (z - az) * vz) / l2));
      if (Math.hypot(x - (ax + vx * t), z - (az + vz * t)) < dist) return true;
    }
  return false;
}

export class WastelandScene extends EventScene {
  constructor() {
    super(new WastelandMode());
  }
}

/** Go to the Wasteland, showing a new chapter's comic first if it hasn't been seen. */
export function wastelandHub(): Scene {
  const s = state.data;
  const n = currentChapter(s);
  if (n && !s.comicsSeen.includes(n)) return new ComicScene(CHAPTERS[n - 1].panels, n, 'music-wasteland', () => new WastelandScene());
  return new WastelandScene();
}
