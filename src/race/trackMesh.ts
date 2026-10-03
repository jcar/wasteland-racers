import * as THREE from 'three';
import type { WorldDef } from '../data/worlds';
import { texture } from '../systems/assets';
import { toon } from '../art/materials';
import { checker, chevrons, gooPuddle, hazard, propPlaceholder, speckle, stripes } from '../art/placeholders';
import type { TrackGeometry } from './trackGeometry';

/**
 * Turns the track numbers into things to look at: the road, striped kerbs,
 * rubber walls, the start arch, boost pads, goo and scenery.
 */

/** Width / height of each prop picture (matches tools/assets/manifest.json). */
const PROP_ASPECT: Record<string, number> = {
  'prop-cactus': 0.75, 'prop-rock': 1.33, 'prop-skull': 1.33, 'prop-tires': 0.75, 'prop-junkcar': 1.33, 'prop-barrel': 0.83,
  'prop-mushroom': 0.75, 'prop-deadtree': 0.75, 'prop-lavarock': 1.33, 'prop-crowd': 1.67, 'prop-flag': 0.5, 'prop-sign': 1, 'prop-jump-sign': 0.8,
};

type Profile = { lat: number; dy: number; abs?: boolean }[];

/** On a road, the finish line is this far before the end wall. */
export const FINISH_GAP = 12;

/**
 * Sweep a cross-section along the track between two distances. Each profile
 * point is a sideways offset and a height (above the road, or absolute).
 */
function sweep(geo: TrackGeometry, profile: Profile, from: number, to: number, vScale: number, step = 1): THREE.BufferGeometry {
  const pos: number[] = [], uv: number[] = [], idx: number[] = [];
  const rows = Math.max(1, Math.ceil((to - from) / step));
  // Distance along the profile, for u.
  const lens = [0];
  for (let j = 1; j < profile.length; j++) lens.push(lens[j - 1] + Math.hypot(profile[j].lat - profile[j - 1].lat, profile[j].dy - profile[j - 1].dy));
  const total = lens[lens.length - 1] || 1;
  for (let r = 0; r <= rows; r++) {
    const s = from + ((to - from) * r) / rows;
    const c = geo.pointAt(s);
    for (let j = 0; j < profile.length; j++) {
      const p = profile[j];
      pos.push(c.x + c.tz * p.lat, p.abs ? p.dy : c.h + p.dy, c.z - c.tx * p.lat);
      uv.push(lens[j] / total, (s - from) / vScale);
    }
  }
  const w = profile.length;
  for (let r = 0; r < rows; r++)
    for (let j = 0; j < w - 1; j++) {
      const a = r * w + j, b = a + 1, c = a + w, d = c + 1;
      idx.push(a, c, b, b, c, d);
    }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

function addMesh(parent: THREE.Object3D, geo: THREE.BufferGeometry, mat: THREE.Material, shadows = true) {
  const m = new THREE.Mesh(geo, mat);
  m.receiveShadow = shadows;
  parent.add(m);
  return m;
}

export interface TrackVisuals {
  group: THREE.Group;
  update(dt: number): void;
}

export function buildTrackVisuals(geo: TrackGeometry, world: WorldDef, seed: number): TrackVisuals {
  const group = new THREE.Group();
  const def = geo.def;
  const hw = geo.halfWidth;
  const L = geo.length;

  // Ground.
  const groundTex = texture(world.ground, speckle(world.groundColor, 3), { repeat: true });
  groundTex.repeat.set(75, 75);
  // Slightly muted so the road stands out clearly against it.
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(1800, 1800), toon('#b8aca0', { map: groundTex }));
  ground.geometry.rotateX(-Math.PI / 2);
  ground.position.y = -0.05;
  ground.receiveShadow = true;
  group.add(ground);

  // Road.
  const roadTex = texture(world.road, speckle(world.roadColor, 7, 1400), { repeat: true });
  const roadMat = toon('#ffffff', { map: roadTex });
  roadMat.side = THREE.DoubleSide;
  addMesh(group, sweep(geo, [{ lat: hw, dy: 0.02 }, { lat: -hw, dy: 0.02 }], 0, L, geo.def.width), roadMat);

  // Kerbs and walls, in the world's colors.
  const [ca, cb] = world.wallColors;
  const kerbMat = toon('#ffffff', { map: texture(`kerb-${ca}${cb}`, stripes(ca, cb), { repeat: true }) });
  const wallMat = toon('#ffffff', { map: texture(`wall-${ca}${cb}`, stripes(ca, '#2a2a2e'), { repeat: true }) });
  wallMat.side = kerbMat.side = THREE.DoubleSide;
  for (const side of [1, -1]) {
    addMesh(group, sweep(geo, [{ lat: side * hw, dy: 0.05 }, { lat: side * (hw - 1), dy: 0.05 }], 0, L, 3), kerbMat);
    const wall = addMesh(
      group,
      sweep(geo, [{ lat: side * hw, dy: 0 }, { lat: side * hw, dy: 1.1 }, { lat: side * (hw + 1.2), dy: 1.1 }, { lat: side * (hw + 1.2), dy: -2, abs: true }], 0, L, 4),
      wallMat,
    );
    wall.castShadow = true;
  }

  // Start line and arch.
  const checkTex = texture('checker', checker, { repeat: true });
  const startMat = toon('#ffffff', { map: checkTex, transparent: false });
  addMesh(group, sweep(geo, [{ lat: hw, dy: 0.06 }, { lat: -hw, dy: 0.06 }], -1, 1, 2 / (def.width / 2)), startMat);
  const arch = (s: number) => {
    const p = geo.pointAt(s);
    const a = new THREE.Group();
    a.position.set(p.x, p.h, p.z);
    a.rotation.y = -Math.atan2(p.tz, p.tx);
    for (const side of [1, -1]) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.5, 8, 8), toon('#5d6068'));
      post.position.set(0, 4, -side * (hw + 1.8));
      post.castShadow = true;
      a.add(post);
    }
    const banner = new THREE.Mesh(new THREE.BoxGeometry(0.6, 1.8, def.width + 4.4), toon('#ffffff', { map: checkTex }));
    banner.position.y = 7.4;
    banner.castShadow = true;
    a.add(banner);
    group.add(a);
  };
  arch(0);
  // Roads: a finish line near the end, and a wall across each end.
  if (geo.open) {
    addMesh(group, sweep(geo, [{ lat: hw, dy: 0.06 }, { lat: -hw, dy: 0.06 }], L - FINISH_GAP - 1, L - FINISH_GAP + 1, 2 / (def.width / 2)), startMat);
    arch(L - FINISH_GAP);
    for (const s of [0.5, L - 0.5]) {
      const p = geo.pointAt(s);
      const end = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.8, def.width + 2.4), wallMat);
      end.position.set(p.x, p.h + 0.9, p.z);
      end.rotation.y = -Math.atan2(p.tz, p.tx);
      end.castShadow = true;
      group.add(end);
    }
  }

  // Boost pads.
  const chevTex = texture('chevrons', chevrons, { repeat: true });
  const padMat = toon('#ffffff', { map: chevTex, emissive: '#ff8a00' });
  for (const b of def.boosts ?? []) {
    const s = b.at * L, lat = -b.lane * (hw - 3);
    addMesh(group, sweep(geo, [{ lat: lat + 2.2, dy: 0.07 }, { lat: lat - 2.2, dy: 0.07 }], s, s + 6, 3, 0.5), padMat, false);
  }

  // Jumps: striped ramps you can see coming, with warning signs before them.
  const rampMat = toon('#ffffff', { map: texture('hazard', hazard, { repeat: true }) });
  rampMat.side = THREE.DoubleSide;
  for (const j of def.jumps ?? []) {
    const s0 = j.at * L, s1 = (j.at + j.len) * L;
    addMesh(group, sweep(geo, [{ lat: hw - 1, dy: 0.07 }, { lat: -(hw - 1), dy: 0.07 }], s0, s1, 4, 0.5), rampMat, false);
    for (const side of [1, -1]) {
      const p = geo.pointAt(s0 - 16, side * (hw + 3.5));
      const sign = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture('prop-jump-sign', propPlaceholder('prop-jump-sign')), alphaTest: 0.3 }));
      sign.scale.set(5.6, 7, 1);
      sign.center.set(0.5, 0.06);
      sign.position.set(p.x, p.h, p.z);
      group.add(sign);
    }
  }

  // Goo puddles (slow zones).
  const gooMat = toon('#ffffff', { map: texture('goo-puddle', gooPuddle), transparent: true });
  for (const g of def.goo ?? []) {
    const s = g.at * L, lat = -g.lane * (hw - 3.5), len = g.len * L;
    addMesh(group, sweep(geo, [{ lat: lat + 3.5, dy: 0.08 }, { lat: lat - 3.5, dy: 0.08 }], s, s + len, len, 1), gooMat, false);
  }

  // Scenery, kept clear of the road.
  let r = seed * 9301 + 49297;
  const rand = () => ((r = (r * 16807) % 2147483647) / 2147483647);
  const count = Math.round(L / 7);
  for (let i = 0; i < count; i++) {
    const key = world.props[Math.floor(rand() * world.props.length)];
    const s = rand() * L;
    const side = rand() < 0.5 ? 1 : -1;
    const dist = hw + 4 + rand() * rand() * 30;
    const p = geo.pointAt(s, side * dist);
    const near = geo.locate(p.x, p.z);
    if (Math.abs(near.lateral) < hw + 3.5) continue;
    const mat = new THREE.SpriteMaterial({ map: texture(key, propPlaceholder(key)), alphaTest: 0.3 });
    const sprite = new THREE.Sprite(mat);
    const h = 5 + rand() * 3.5;
    sprite.scale.set(h * (PROP_ASPECT[key] ?? 1), h, 1);
    sprite.center.set(0.5, 0.06);
    sprite.position.set(p.x, 0, p.z);
    group.add(sprite);
  }

  return {
    group,
    update(dt) {
      chevTex.offset.y -= dt * 1.5;
    },
  };
}

/** SVG outline of a track, for the minimap and track cards. */
export function trackSvg(geo: TrackGeometry, size: number, stroke = 6): { svg: string; toSvg: (x: number, z: number) => [number, number] } {
  const xs = geo.samples.map((p) => p.x), zs = geo.samples.map((p) => p.z);
  const minX = Math.min(...xs), maxX = Math.max(...xs), minZ = Math.min(...zs), maxZ = Math.max(...zs);
  // Rotate 45° so the map matches the isometric camera (which looks from +x,+z).
  const rot = (x: number, z: number): [number, number] => [(x - z) * Math.SQRT1_2, (x + z) * Math.SQRT1_2 * 0.6];
  const pts = geo.samples.map((p) => rot(p.x, p.z));
  const corners = [rot(minX, minZ), rot(maxX, minZ), rot(minX, maxZ), rot(maxX, maxZ)];
  const rx = Math.min(...corners.map((c) => c[0])), ry = Math.min(...corners.map((c) => c[1]));
  const w = Math.max(...corners.map((c) => c[0])) - rx, h = Math.max(...corners.map((c) => c[1])) - ry;
  const scale = (size - stroke * 2) / Math.max(w, h);
  const ox = (size - w * scale) / 2, oy = (size - h * scale) / 2;
  const toSvg = (x: number, z: number): [number, number] => {
    const [a, b] = rot(x, z);
    return [ox + (a - rx) * scale, oy + (b - ry) * scale];
  };
  // Roads aren't closed loops, and get a finish flag at the far end.
  const d = pts.map((p, i) => `${i ? 'L' : 'M'}${(ox + (p[0] - rx) * scale).toFixed(1)},${(oy + (p[1] - ry) * scale).toFixed(1)}`).join('') + (geo.open ? '' : 'Z');
  const [sx, sy] = toSvg(geo.samples[0].x, geo.samples[0].z);
  const end = geo.samples[geo.samples.length - 1];
  const [fx, fy] = toSvg(end.x, end.z);
  const flag = geo.open ? `<circle cx="${fx}" cy="${fy}" r="7" fill="#ffd23f" stroke="#111" stroke-width="3"/>` : '';
  const svg = `<path d="${d}" fill="none" stroke="rgba(0,0,0,0.55)" stroke-width="${stroke + 3}" stroke-linejoin="round" stroke-linecap="round"/><path d="${d}" fill="none" stroke="#fff4dc" stroke-width="${stroke}" stroke-linejoin="round" stroke-linecap="round"/><rect x="${sx - 4}" y="${sy - 4}" width="8" height="8" fill="#111" stroke="#fff" stroke-width="2"/>${flag}`;
  return { svg, toSvg };
}
