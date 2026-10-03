import * as THREE from 'three';
import type { Variant } from '../data/story';
import { propPlaceholder } from '../art/placeholders';
import { noise, sfx, tone } from '../audio/sfx';
import { speak } from '../audio/voice';
import { texture } from '../systems/assets';
import type { EventScene } from '../race/EventScene';

/**
 * Twists on an ordinary event: racing at night by headlight, inside a
 * sandstorm, to the Doof Wagon's drumbeat, past refinery fire jets, or
 * through the Bog's crow people on stilts.
 */
export function applyVariants(core: EventScene, variants: Variant[]) {
  for (const v of variants) VARIANTS[v](core);
}

const VARIANTS: Record<Variant, (core: EventScene) => void> = {
  night(core) {
    core.view.scene.background = new THREE.Color('#0d1222');
    core.hemi.intensity = 0.35;
    core.hemi.color.set('#8aa0ff');
    core.sun.intensity = 0.3;
    core.sun.color.set('#9fb4ff');
    core.dustColor = '#5a5a6a';
    // Headlights: a real spotlight for the player, a glow for everyone else.
    const lights = new Map<object, THREE.Light>();
    const target = new THREE.Object3D();
    core.view.scene.add(target);
    core.tickers.push(() => {
      for (const e of core.fighters) {
        let l = lights.get(e);
        if (!l) {
          if (e.isPlayer) {
            const spot = new THREE.SpotLight('#fff2c0', 900, 80, 0.55, 0.5, 1.3);
            spot.target = target;
            l = spot;
          } else l = new THREE.PointLight('#ffd090', 120, 18, 1.6);
          core.view.scene.add(l);
          lights.set(e, l);
        }
        const b = e.body;
        l.position.set(b.x + Math.cos(b.heading) * 1.5, b.y + 3, b.z + Math.sin(b.heading) * 1.5);
        if (e.isPlayer) target.position.set(b.x + Math.cos(b.heading) * 25, b.y, b.z + Math.sin(b.heading) * 25);
      }
    });
  },

  sandstorm(core) {
    core.view.scene.background = new THREE.Color('#d9a066');
    core.view.scene.fog = new THREE.Fog('#d9a066', 135, 205);
    core.hemi.color.set('#ffd9a8');
    core.sun.intensity = 1.2;
    let gust = 0, gustDir = 1, gustT = 4, lightningT = 6, flash = 0;
    // A tornado that wanders the track and tosses anyone it catches.
    const geo = core.mode.geo;
    let tornadoS = geo ? geo.length * 0.5 : 0;
    const tornado = { x: 0, z: 0 };
    core.tickers.push((dt) => {
      const p = core.player.body;
      for (let i = 0; i < 3; i++)
        core.effects.wind(p.x + (Math.random() - 0.5) * 70 - gustDir * 30, p.y + 1 + Math.random() * 6, p.z + (Math.random() - 0.5) * 70, gustDir * (25 + gust * 20), gustDir * 6);
      if (core.phase !== 'race') return;
      gustT -= dt;
      if (gustT <= 0) {
        gust = 1;
        gustDir = Math.random() < 0.5 ? -1 : 1;
        gustT = 4 + Math.random() * 3;
        noise(1.6, 'bandpass', 400, 900, 0.18);
      }
      if (gust > 0) {
        gust = Math.max(0, gust - dt * 0.8);
        for (const e of core.fighters) if (!e.body.airborne) e.body.vx += gustDir * gust * 6 * dt;
      }
      lightningT -= dt;
      if (lightningT <= 0) {
        lightningT = 6 + Math.random() * 4;
        flash = 0.25;
        noise(1.2, 'lowpass', 300, 40, 0.35, 0.15);
      }
      if (flash > 0) {
        flash -= dt;
        core.hemi.intensity = flash > 0 ? 5 : 1.6;
      }
      if (geo) {
        tornadoS = geo.wrap(tornadoS + dt * 6);
        const pt = geo.pointAt(tornadoS, Math.sin(core.raceTime * 0.6) * (geo.halfWidth - 3));
        tornado.x = pt.x;
        tornado.z = pt.z;
        for (let i = 0; i < 4; i++) {
          const a = core.raceTime * 6 + i * 1.6, r = 1.5 + i * 0.8;
          core.effects.wind(tornado.x + Math.cos(a) * r, pt.h + i * 2.5, tornado.z + Math.sin(a) * r, -Math.sin(a) * 8, Math.cos(a) * 8, '#b88a5a');
        }
        for (const e of core.fighters) {
          const b = e.body;
          if (!b.airborne && b.towing <= 0 && Math.hypot(b.x - tornado.x, b.z - tornado.z) < 4) {
            b.vy = 13;
            b.airborne = true;
            b.airTime = 0;
            b.startSpin(1);
            if (e.isPlayer) speak('jump-2', { priority: 0, cooldown: 6 });
          }
        }
      }
    });
  },

  doof(core) {
    // The Doof Wagon's drums: hit a boost pad on the beat for a mega boost.
    const BEAT = 0.5;
    let t = 0, lastBeat = -1;
    core.tickers.push((dt) => {
      if (core.phase !== 'race') return;
      t += dt;
      const beat = Math.floor(t / BEAT);
      if (beat !== lastBeat) {
        lastBeat = beat;
        tone(33, 0, 0.18, 'sine', beat % 2 ? 0.18 : 0.3);
        if (beat % 4 === 2) noise(0.1, 'bandpass', 1500, 800, 0.2);
      }
      const phase = (t % BEAT) / BEAT;
      const onBeat = phase < 0.22 || phase > 0.85;
      const geo = core.mode.geo;
      const b = core.player.body;
      if (!geo || b.airborne) return;
      for (const z of core.pads) {
        const ds = geo.wrap(b.pos.s - z.s0);
        if (ds < z.s1 - z.s0 && Math.abs(b.pos.lateral - z.lat) < z.half && onBeat && b.boostPower < 1.6) {
          b.boost = 1.8;
          b.boostPower = 1.7;
          core.effects.sparkle(b.x, b.y, b.z, '#ff4dd2', 14);
          core.hud.show('ON THE BEAT!', 0.8, true);
          sfx.guitar();
        }
      }
    });
  },

  firejets(core) {
    // Refinery pipes across the road: glow (warning), then blast fire.
    const geo = core.mode.geo;
    if (!geo) return;
    const jets = [0.2, 0.45, 0.7, 0.92].map((f, i) => ({ s: f * geo.length, t: -i * 1.4, mesh: stripMesh(core, geo.pointAt(f * geo.length), geo.def.width) }));
    let warned = false;
    core.tickers.push((dt) => {
      if (core.phase !== 'race') return;
      for (const j of jets) {
        j.t += dt;
        const cycle = j.t % 6;
        const warning = cycle >= 2.5 && cycle < 3.7;
        const firing = cycle >= 3.7 && cycle < 5;
        const mat = j.mesh.material as THREE.MeshBasicMaterial;
        mat.opacity = warning ? 0.35 + 0.35 * Math.abs(Math.sin(j.t * 12)) : firing ? 0.8 : 0;
        mat.color.set(firing ? '#ff5a00' : '#ffd23f');
        if (warning && !warned && Math.abs(core.player.body.pos.s - j.s) < 60) {
          warned = true;
          speak('boss-fire', { priority: 0, cooldown: 20 });
        }
        if (!firing) continue;
        const p = geo.pointAt(j.s, (Math.random() - 0.5) * geo.def.width);
        core.effects.jet(p.x, p.h, p.z);
        for (const e of core.fighters) {
          if (Math.abs(geo.wrap(e.body.pos.s - j.s + 3)) < 6 && !e.body.airborne) core.hurt(e, undefined, 1, 0.8);
        }
      }
    });
  },

  crows(core) {
    // Crow people on stilts stride back and forth across the road.
    const geo = core.mode.geo;
    if (!geo) return;
    const crows = Array.from({ length: 7 }, (_, i) => {
      const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture('prop-crow', propPlaceholder('prop-crow')), alphaTest: 0.3 }));
      sprite.scale.set(4, 8, 1);
      sprite.center.set(0.5, 0.05);
      core.view.scene.add(sprite);
      return { sprite, s: ((i + 0.5) / 7) * geo.length, phase: i * 1.3 };
    });
    core.tickers.push(() => {
      for (const c of crows) {
        const lat = Math.sin(core.raceTime * 0.5 + c.phase) * (geo.halfWidth - 2);
        const p = geo.pointAt(c.s, lat);
        c.sprite.position.set(p.x, p.h, p.z);
        for (const e of core.fighters) {
          const b = e.body;
          if (b.spin <= 0 && !b.airborne && Math.hypot(b.x - p.x, b.z - p.z) < 1.8) {
            b.startSpin(0.8);
            b.vx *= 0.4;
            b.vz *= 0.4;
            if (e.isPlayer) sfx.bump();
          }
        }
      }
    });
  },
};

/** A glowing strip across the road (fire jet warning). */
function stripMesh(core: EventScene, p: { x: number; z: number; tx: number; tz: number; h: number }, width: number) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(4, width + 1), new THREE.MeshBasicMaterial({ color: '#ffd23f', transparent: true, opacity: 0, depthWrite: false }));
  m.rotation.x = -Math.PI / 2;
  m.rotation.z = -Math.atan2(p.tz, p.tx);
  m.position.set(p.x, p.h + 0.15, p.z);
  core.view.scene.add(m);
  return m;
}
