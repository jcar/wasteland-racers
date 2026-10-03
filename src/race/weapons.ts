import * as THREE from 'three';
import { COLORS, ball, box, cyl, toon } from '../art/materials';
import { gooPuddle } from '../art/placeholders';
import { sfx } from '../audio/sfx';
import { speak } from '../audio/voice';
import { texture } from '../systems/assets';
import type { CarBody } from './CarBody';
import type { Effects } from './effects';
import type { TrackGeometry } from './trackGeometry';

/**
 * Every gadget and lore weapon in one place: Season 1's boost, goo and
 * boing, the War Boys' thunder sticks, harpoons, caltrops and flamethrowers,
 * and each legend car's special move. Race modes plug in through `Arena`,
 * so chases, arenas and boss fights can share all of it later.
 */
export interface Fighter {
  body: CarBody;
  gadget: string;
  isPlayer: boolean;
  /** Seconds until an AI driver may fire again. */
  cooldown: number;
}

export interface Arena {
  readonly fighters: Fighter[];
  readonly player: Fighter;
  readonly scene: THREE.Scene;
  readonly effects: Effects;
  readonly geo: TrackGeometry;
  /** Close enough to the player to be worth a sound. */
  near(f: Fighter): boolean;
  /** A lore hit: damage, spin, wreck effects and announcer lines. */
  hurt(target: Fighter, by: Fighter | undefined, damage: number, spin: number): void;
  /** Distance raced, for "who is ahead of whom". */
  progress(f: Fighter): number;
  shake(amount: number): void;
}

/** How the AI decides when to fire each weapon. */
type Aim = 'self' | 'ahead' | 'behind' | 'near';
const AIM: Record<string, Aim> = {
  boost: 'self', blower: 'self', doublev8: 'self', witness: 'near', spikes: 'near',
  goo: 'behind', caltrops: 'behind', boing: 'near', stomp: 'near',
  thunder: 'ahead', harpoon: 'ahead', flame: 'ahead', flameguitar: 'ahead', thundershot: 'ahead', bikes: 'ahead',
};

interface Hazard { kind: 'goo' | 'caltrops'; mesh: THREE.Object3D; x: number; z: number; owner: Fighter; age: number }
interface Missile { kind: 'thunder' | 'bike'; mesh: THREE.Object3D; x: number; z: number; y: number; heading: number; owner: Fighter; target?: Fighter; age: number }
interface Shell { mesh: THREE.Object3D; marker: THREE.Object3D; from: THREE.Vector3; to: THREE.Vector3; owner: Fighter; age: number }
interface Flame { owner: Fighter; age: number; length: number; cone: number; hit: Set<Fighter> }
interface Cable { line: THREE.Line; owner: Fighter; target: Fighter; age: number; done: boolean }

const SHELL_TIME = 0.9;

export class Weapons {
  private arena: Arena;
  private hazards: Hazard[] = [];
  private missiles: Missile[] = [];
  private shells: Shell[] = [];
  private flames: Flame[] = [];
  private cables: Cable[] = [];

  constructor(arena: Arena) {
    this.arena = arena;
  }

  /** Use one charge of the fighter's gadget. Returns false if it couldn't fire. */
  fire(f: Fighter): boolean {
    const b = f.body;
    if (b.charges <= 0 || b.towing > 0 || b.spin > 0 || b.wrecked > 0) return false;
    b.charges--;
    const a = this.arena;
    const mine = f === a.player;
    const loud = mine || a.near(f);
    const fx = Math.cos(b.heading), fz = Math.sin(b.heading);
    switch (f.gadget) {
      case 'boost':
        b.boost = 1.6;
        if (loud) sfx.boost();
        if (mine) speak('boost', { priority: 0, cooldown: 15 });
        break;
      case 'blower':
        b.boost = 2.6;
        b.boostPower = 1.75;
        if (loud) sfx.boost();
        if (mine) speak('blower', { priority: 0, cooldown: 15 });
        break;
      case 'doublev8':
        b.boost = 2.2;
        b.boostPower = 1.7;
        b.ram = 2.2;
        if (loud) { sfx.boost(); sfx.explosion(false); }
        if (mine) speak('doublev8', { priority: 0, cooldown: 15 });
        break;
      case 'witness':
        b.star = 3.5;
        if (loud) sfx.spray();
        if (mine) speak('witness', { priority: 1, cooldown: 8 });
        break;
      case 'spikes':
        b.ram = 3;
        if (loud) sfx.clang();
        if (mine) speak('spikes', { priority: 0, cooldown: 15 });
        break;
      case 'boing':
        b.boing = 2.2;
        if (loud) sfx.boing();
        break;
      case 'goo':
      case 'caltrops':
        this.dropHazard(f, f.gadget);
        if (loud) f.gadget === 'goo' ? sfx.splat() : sfx.clang();
        if (mine && f.gadget === 'caltrops') speak('caltrops', { priority: 0, cooldown: 15 });
        break;
      case 'stomp': {
        a.effects.ring(b.x, b.y, b.z, 10, '#c9a47a');
        if (loud) sfx.stomp();
        if (mine) { a.shake(0.8); speak('stomp', { priority: 0, cooldown: 12 }); }
        for (const o of a.fighters) {
          if (o === f) continue;
          const dx = o.body.x - b.x, dz = o.body.z - b.z, d = Math.hypot(dx, dz);
          if (d > 10 || d === 0) continue;
          o.body.vx += (dx / d) * 16;
          o.body.vz += (dz / d) * 16;
          a.hurt(o, f, 1, 0.8);
        }
        break;
      }
      case 'flame':
      case 'flameguitar': {
        const guitar = f.gadget === 'flameguitar';
        this.flames.push({ owner: f, age: 0, length: guitar ? 18 : 12, cone: guitar ? 0.8 : 0.6, hit: new Set() });
        if (loud) { sfx.flame(); if (guitar) sfx.guitar(); }
        if (mine) speak('flame', { priority: 0, cooldown: 12 });
        break;
      }
      case 'thunder':
        this.launch(f, 'thunder', this.targetAhead(f, 50, 0.7));
        if (loud) sfx.whoosh();
        if (mine) speak('thunder', { priority: 0, cooldown: 12 });
        break;
      case 'bikes': {
        const targets = this.fighterOrder(f).slice(0, 3);
        for (let i = 0; i < 3; i++) this.launch(f, 'bike', targets[i % Math.max(1, targets.length)], (i - 1) * 0.5);
        if (loud) sfx.boost();
        if (mine) speak('bikes', { priority: 0, cooldown: 15 });
        break;
      }
      case 'harpoon': {
        const target = this.targetAhead(f, 34, 0.55);
        if (!target) { b.charges++; return false; }
        const geo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]);
        const line = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: '#3a2a20' }));
        a.scene.add(line);
        this.cables.push({ line, owner: f, target, age: 0, done: false });
        if (loud) sfx.harpoon();
        if (mine) speak('harpoon', { priority: 0, cooldown: 12 });
        break;
      }
      case 'thundershot': {
        const target = this.targetAhead(f, 60, 0.6) ?? this.fighterOrder(f)[0];
        const to = target ? new THREE.Vector3(target.body.x + target.body.vx * SHELL_TIME, 0, target.body.z + target.body.vz * SHELL_TIME) : new THREE.Vector3(b.x + fx * 30, 0, b.z + fz * 30);
        to.y = a.geo.locate(to.x, to.z).h;
        const mesh = ball(0.55, '#2b2b2b', b.x, b.y + 2, b.z);
        const marker = new THREE.Mesh(new THREE.RingGeometry(4, 5, 32), new THREE.MeshBasicMaterial({ color: '#ff3b1f', transparent: true, opacity: 0.7, side: THREE.DoubleSide }));
        marker.rotation.x = -Math.PI / 2;
        marker.position.set(to.x, to.y + 0.15, to.z);
        a.scene.add(mesh, marker);
        this.shells.push({ mesh, marker, from: new THREE.Vector3(b.x, b.y + 2, b.z), to, owner: f, age: 0 });
        if (loud) { sfx.explosion(false); sfx.whistle(); }
        if (mine) speak('thundershot', { priority: 0, cooldown: 12 });
        break;
      }
    }
    return true;
  }

  /** Should this AI fighter fire now? Uses the same rules for every weapon of a kind. */
  aiWants(f: Fighter, dt: number, cooldownAfter: number): boolean {
    f.cooldown -= dt;
    const b = f.body;
    if (b.charges <= 0 || f.cooldown > 0) return false;
    const a = this.arena;
    const p = a.player;
    const gap = a.progress(f) - a.progress(p);
    const dist = Math.hypot(p.body.x - b.x, p.body.z - b.z);
    let want = false;
    switch (AIM[f.gadget] ?? 'self') {
      case 'self': want = a.geo.maxCurveAhead(b.pos.s, 40) < 0.025 && gap < 30; break;
      case 'ahead': want = !!this.targetAhead(f, 40, 0.6); break;
      case 'behind': want = gap > 4 && gap < 22; break;
      case 'near': want = f.gadget === 'boing' ? gap < -1 && gap > -7 && Math.abs(b.pos.lateral - p.body.pos.lateral) < 4 : dist < 9; break;
    }
    if (f.cooldown < -15) want = true; // don't hoard forever
    if (want) f.cooldown = cooldownAfter;
    return want;
  }

  /** Two cars touching: boing bumpers, spiked rams and chrome star power. */
  contact(a: Fighter, b: Fighter) {
    for (const [hitter, target] of [[a, b], [b, a]] as const) {
      const hb = hitter.body, tb = target.body;
      const dx = tb.x - hb.x, dz = tb.z - hb.z, d = Math.hypot(dx, dz);
      if (d === 0 || d > 4.2) continue;
      const fx = Math.cos(hb.heading), fz = Math.sin(hb.heading);
      const inFront = (dx * fx + dz * fz) / d > 0.3;
      if (hb.boing > 0 && inFront && tb.spin <= 0 && !tb.safe) {
        tb.vx += (dx / d) * 14 + fx * 4;
        tb.vz += (dz / d) * 14 + fz * 4;
        tb.startSpin(tb.stats.spinTime * 0.7);
        hb.boing = 0;
        sfx.boing();
        this.arena.effects.sparkle(tb.x, tb.y, tb.z, '#ffffff', 12);
        if (hitter === this.arena.player || target === this.arena.player) speak('boing', { priority: 0, cooldown: 10 });
      } else if ((hb.star > 0 || hb.ram > 0) && d < 3.2) {
        tb.vx += (dx / d) * 12;
        tb.vz += (dz / d) * 12;
        this.arena.hurt(target, hitter, hb.star > 0 ? 2 : 1, 0.8);
      }
    }
  }

  update(dt: number) {
    const a = this.arena;
    this.updateHazards(dt);
    // Thunder sticks and bikes home in on their targets.
    for (let i = this.missiles.length - 1; i >= 0; i--) {
      const m = this.missiles[i];
      m.age += dt;
      const speed = m.kind === 'thunder' ? 55 : 42;
      if (m.target && m.target.body.wrecked <= 0) {
        let want = Math.atan2(m.target.body.z - m.z, m.target.body.x - m.x) - m.heading;
        want = Math.atan2(Math.sin(want), Math.cos(want));
        m.heading += Math.max(-4 * dt, Math.min(4 * dt, want));
      }
      m.x += Math.cos(m.heading) * speed * dt;
      m.z += Math.sin(m.heading) * speed * dt;
      m.y = a.geo.locate(m.x, m.z).h + (m.kind === 'thunder' ? 1.4 : 0.4);
      m.mesh.position.set(m.x, m.y, m.z);
      m.mesh.rotation.y = -m.heading;
      let hit: Fighter | undefined;
      for (const f of a.fighters) if (f !== m.owner && Math.hypot(f.body.x - m.x, f.body.z - m.z) < 2.2 && f.body.wrecked <= 0) hit = f;
      const done = hit || m.age > (m.kind === 'thunder' ? 1.6 : 3);
      if (!done) continue;
      if (m.kind === 'thunder') {
        a.effects.explosion(m.x, m.y - 1, m.z, false);
        if (hit === a.player || m.owner === a.player || a.near(m.owner)) sfx.explosion(false);
      } else a.effects.dust(m.x, m.y, m.z, '#c9a47a', 6);
      if (hit) a.hurt(hit, m.owner, 1, 0.8);
      a.scene.remove(m.mesh);
      this.missiles.splice(i, 1);
    }
    // Peacemaker shells arc over and blow up where the red ring was.
    for (let i = this.shells.length - 1; i >= 0; i--) {
      const sh = this.shells[i];
      sh.age += dt;
      const t = Math.min(1, sh.age / SHELL_TIME);
      sh.mesh.position.lerpVectors(sh.from, sh.to, t);
      sh.mesh.position.y += Math.sin(t * Math.PI) * 12;
      (sh.marker as THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>).material.opacity = 0.4 + 0.4 * Math.abs(Math.sin(sh.age * 14));
      if (t < 1) continue;
      a.effects.explosion(sh.to.x, sh.to.y, sh.to.z, true);
      sfx.explosion(true);
      for (const f of a.fighters) if (f !== sh.owner && Math.hypot(f.body.x - sh.to.x, f.body.z - sh.to.z) < 5) a.hurt(f, sh.owner, 2, 1);
      if (Math.hypot(a.player.body.x - sh.to.x, a.player.body.z - sh.to.z) < 25) a.shake(0.6);
      a.scene.remove(sh.mesh, sh.marker);
      this.shells.splice(i, 1);
    }
    // Flamethrowers: a short stream that hurts anyone in the cone once.
    for (let i = this.flames.length - 1; i >= 0; i--) {
      const fl = this.flames[i];
      fl.age += dt;
      const b = fl.owner.body;
      a.effects.flame(b.x + Math.cos(b.heading) * 2.2, b.y, b.z + Math.sin(b.heading) * 2.2, b.heading, fl.length / 6);
      for (const f of a.fighters) {
        if (f === fl.owner || fl.hit.has(f)) continue;
        const dx = f.body.x - b.x, dz = f.body.z - b.z, d = Math.hypot(dx, dz);
        if (d > fl.length || d === 0) continue;
        if ((dx * Math.cos(b.heading) + dz * Math.sin(b.heading)) / d < Math.cos(fl.cone)) continue;
        fl.hit.add(f);
        a.hurt(f, fl.owner, 1, 0.6);
      }
      if (fl.age > 0.6) this.flames.splice(i, 1);
    }
    // Harpoons: the line flies out, then yanks the target back.
    for (let i = this.cables.length - 1; i >= 0; i--) {
      const c = this.cables[i];
      c.age += dt;
      const o = c.owner.body, t = c.target.body;
      const reach = Math.min(1, c.age / 0.3);
      const pos = c.line.geometry.attributes.position as THREE.BufferAttribute;
      pos.setXYZ(0, o.x, o.y + 1.2, o.z);
      pos.setXYZ(1, o.x + (t.x - o.x) * reach, o.y + 1.2 + (t.y - o.y) * reach, o.z + (t.z - o.z) * reach);
      pos.needsUpdate = true;
      if (reach >= 1 && !c.done) {
        c.done = true;
        t.vx *= 0.3;
        t.vz *= 0.3;
        o.boost = Math.max(o.boost, 0.6);
        a.hurt(c.target, c.owner, 1, 1);
      }
      if (c.age > 0.7) {
        a.scene.remove(c.line);
        c.line.geometry.dispose();
        this.cables.splice(i, 1);
      }
    }
  }

  /** Car visuals that depend on weapons: chrome shimmer, ram sparks. */
  decorate(f: Fighter) {
    const b = f.body;
    if (b.star > 0) this.arena.effects.chrome(b.x, b.y, b.z, 2);
    if (b.ram > 0 && Math.random() < 0.3) this.arena.effects.sparkle(b.x + Math.cos(b.heading) * 2, b.y, b.z + Math.sin(b.heading) * 2, '#ffd23f', 1);
  }

  clear() {
    for (const h of this.hazards) this.arena.scene.remove(h.mesh);
    for (const m of this.missiles) this.arena.scene.remove(m.mesh);
    for (const s of this.shells) this.arena.scene.remove(s.mesh, s.marker);
    for (const c of this.cables) this.arena.scene.remove(c.line);
    this.hazards = [];
    this.missiles = [];
    this.shells = [];
    this.cables = [];
    this.flames = [];
  }

  // ------------------------------------------------------------------ helpers

  /** The closest car in front of `f`, within range and a cone (cos of half-angle). */
  private targetAhead(f: Fighter, range: number, cosCone: number): Fighter | undefined {
    const b = f.body;
    const fx = Math.cos(b.heading), fz = Math.sin(b.heading);
    let best: Fighter | undefined, bestD = range;
    for (const o of this.arena.fighters) {
      if (o === f || o.body.safe) continue;
      const dx = o.body.x - b.x, dz = o.body.z - b.z, d = Math.hypot(dx, dz);
      if (d < bestD && d > 0 && (dx * fx + dz * fz) / d > cosCone) { best = o; bestD = d; }
    }
    return best;
  }

  /** Everyone ahead of `f` in the race, nearest first. */
  private fighterOrder(f: Fighter): Fighter[] {
    const a = this.arena;
    const me = a.progress(f);
    return a.fighters.filter((o) => o !== f && a.progress(o) > me).sort((x, y) => a.progress(x) - a.progress(y));
  }

  private launch(f: Fighter, kind: Missile['kind'], target: Fighter | undefined, spread = 0) {
    const b = f.body;
    const g = new THREE.Group();
    if (kind === 'thunder') {
      const shaft = cyl(0.08, 2.4, '#7a5a3a', 0, 0, 0, g);
      shaft.rotation.z = Math.PI / 2;
      ball(0.35, '#d2442c', 1.3, 0, 0, g);
      ball(0.15, '#ffd23f', 1.6, 0.2, 0, g);
    } else {
      box(1.2, 0.35, 0.3, '#34343c', 0, 0.3, 0, g);
      for (const x of [0.5, -0.5]) {
        const w = cyl(0.28, 0.15, COLORS.tire, x, 0.28, 0, g);
        w.rotation.x = Math.PI / 2;
      }
      ball(0.2, '#f1c29a', -0.1, 0.75, 0, g);
    }
    this.arena.scene.add(g);
    this.missiles.push({ kind, mesh: g, x: b.x + Math.cos(b.heading) * 2.5, z: b.z + Math.sin(b.heading) * 2.5, y: b.y + 1, heading: b.heading + spread, owner: f, target, age: 0 });
  }

  private dropHazard(f: Fighter, kind: Hazard['kind']) {
    const b = f.body;
    const x = b.x - Math.cos(b.heading) * 3.4, z = b.z - Math.sin(b.heading) * 3.4;
    const h = this.arena.geo.locate(x, z, b.pos.i).h;
    let mesh: THREE.Object3D;
    if (kind === 'goo') {
      const m = new THREE.Mesh(new THREE.CircleGeometry(2.3, 20), toon('#ffffff', { map: texture('goo-puddle', gooPuddle), transparent: true }));
      m.geometry.rotateX(-Math.PI / 2);
      mesh = m;
    } else {
      const g = new THREE.Group();
      for (let i = 0; i < 9; i++) {
        const spike = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.6, 4), toon(COLORS.metal));
        const a = Math.random() * Math.PI * 2, r = Math.random() * 2.2;
        spike.position.set(Math.cos(a) * r, 0.25, Math.sin(a) * r);
        spike.rotation.set(Math.random(), Math.random(), Math.random());
        g.add(spike);
      }
      mesh = g;
    }
    mesh.position.set(x, h + 0.12, z);
    this.arena.scene.add(mesh);
    this.hazards.push({ kind, mesh, x, z, owner: f, age: 0 });
  }

  private updateHazards(dt: number) {
    const a = this.arena;
    for (let i = this.hazards.length - 1; i >= 0; i--) {
      const hz = this.hazards[i];
      hz.age += dt;
      let hit: Fighter | undefined;
      for (const f of a.fighters) {
        if (f === hz.owner && hz.age < 1.5) continue;
        const b = f.body;
        if (!b.airborne && b.towing <= 0 && b.wrecked <= 0 && Math.hypot(b.x - hz.x, b.z - hz.z) < 2.6) hit = f;
      }
      if (hit) {
        if (hz.kind === 'goo') {
          hit.body.startSpin(hit.body.stats.spinTime);
          a.effects.splat(hz.x, hit.body.y, hz.z);
          if (hit === a.player) speak('got-spun', { priority: 0, cooldown: 20 });
          else if (hz.owner === a.player) speak('goo', { priority: 0, cooldown: 12 });
          if (hit === a.player || a.near(hit)) sfx.splat();
        } else {
          a.effects.sparkle(hz.x, hit.body.y, hz.z, '#c9d0d8', 8);
          sfx.clang();
          a.hurt(hit, hz.owner, 1, 1);
        }
      }
      if (hit || hz.age > 14) {
        a.scene.remove(hz.mesh);
        this.hazards.splice(i, 1);
      } else hz.mesh.scale.setScalar(Math.min(1, hz.age * 4));
    }
  }
}
