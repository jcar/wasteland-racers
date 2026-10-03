import * as THREE from 'three';
import type { WorldDef } from '../data/worlds';
import { COLORS, mesh, toon } from '../art/materials';
import { propPlaceholder, speckle, stripes } from '../art/placeholders';
import { texture } from '../systems/assets';
import type { MiniMap } from '../ui/hud';
import type { ArenaGround, Obstacle } from './ground';

/**
 * The look of an arena: a dirt floor, a striped rubber wall around the edge,
 * rock pillars, tire stacks and fuel drums, and scenery outside the wall.
 */
export function buildArenaVisuals(arena: ArenaGround, world: WorldDef, seed: number): THREE.Group {
  const group = new THREE.Group();
  const def = arena.def;

  const groundTex = texture(world.ground, speckle(world.groundColor, 3), { repeat: true });
  groundTex.repeat.set(75, 75);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(1800, 1800), toon('#b8aca0', { map: groundTex }));
  ground.geometry.rotateX(-Math.PI / 2);
  ground.position.y = -0.05;
  ground.receiveShadow = true;
  group.add(ground);

  // The floor, a little brighter so the play area stands out.
  const floorTex = texture(world.road, speckle(world.roadColor, 7, 1400), { repeat: true });
  const floorMat = toon('#ffffff', { map: floorTex });
  const floorGeo = def.shape === 'circle' ? new THREE.CircleGeometry(def.radius!, 64) : new THREE.PlaneGeometry(def.w!, def.h!);
  floorGeo.rotateX(-Math.PI / 2);
  const uv = floorGeo.attributes.uv as THREE.BufferAttribute;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 8, uv.getY(i) * 8);
  const floor = new THREE.Mesh(floorGeo, floorMat);
  floor.position.y = 0.02;
  floor.receiveShadow = true;
  group.add(floor);

  // The wall: a ring (or box) of striped rubber.
  const [ca] = world.wallColors;
  const wallMat = toon('#ffffff', { map: texture(`wall-${ca}`, stripes(ca, '#2a2a2e'), { repeat: true }) });
  if (def.shape === 'circle') {
    const r = def.radius!;
    const wall = new THREE.Mesh(new THREE.CylinderGeometry(r + 0.6, r + 0.6, 1.8, 96, 1, true), wallMat);
    (wall.material as THREE.Material).side = THREE.DoubleSide;
    const wuv = wall.geometry.attributes.uv as THREE.BufferAttribute;
    for (let i = 0; i < wuv.count; i++) wuv.setX(i, wuv.getX(i) * r * 0.8);
    wall.position.y = 0.9;
    wall.castShadow = true;
    group.add(wall);
  } else {
    const hw = def.w! / 2, hh = def.h! / 2;
    for (const [x, z, w, d] of [[0, -hh - 0.6, def.w! + 2.4, 1.2], [0, hh + 0.6, def.w! + 2.4, 1.2], [-hw - 0.6, 0, 1.2, def.h!], [hw + 0.6, 0, 1.2, def.h!]]) {
      const wall = new THREE.Mesh(new THREE.BoxGeometry(w, 1.8, d), wallMat);
      wall.position.set(x, 0.9, z);
      wall.castShadow = true;
      group.add(wall);
    }
  }

  for (const o of def.obstacles) group.add(buildObstacle(o, o.kind));

  // Scenery outside the wall.
  let r = seed * 7919 + 17;
  const rand = () => ((r = (r * 16807) % 2147483647) / 2147483647);
  const reach = Math.max(arena.halfW, arena.halfH);
  for (let i = 0; i < 40; i++) {
    const key = world.props[Math.floor(rand() * world.props.length)];
    const a = rand() * Math.PI * 2, d = reach + 8 + rand() * 40;
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture(key, propPlaceholder(key)), alphaTest: 0.3 }));
    const h = 5 + rand() * 4;
    sprite.scale.set(h, h, 1);
    sprite.center.set(0.5, 0.06);
    sprite.position.set(Math.cos(a) * d, 0, Math.sin(a) * d);
    group.add(sprite);
  }
  return group;
}

/** Rock pillars, tire stacks, fuel drums and stone columns. */
export function buildObstacle(o: Obstacle, kind: 'rock' | 'tires' | 'drums' | 'pillar'): THREE.Group {
  const g = new THREE.Group();
  g.position.set(o.x, 0, o.z);
  if (kind === 'rock') {
    const rock = mesh(new THREE.DodecahedronGeometry(o.r, 0), toon('#8a6a50'), 0, o.r * 0.6, 0, g);
    rock.scale.set(1, 0.9, 1);
    rock.rotation.set(0.4, 0.8, 0.2);
  } else if (kind === 'tires') {
    for (let i = 0; i < 3; i++) {
      const t = mesh(new THREE.TorusGeometry(o.r * 0.7, o.r * 0.28, 8, 18), toon(i % 2 ? '#e8322a' : COLORS.tire), 0, 0.5 + i * o.r * 0.5, 0, g);
      t.rotation.x = Math.PI / 2;
    }
  } else if (kind === 'drums') {
    for (const [dx, dz] of [[-0.5, 0], [0.5, 0.3], [0, -0.5]]) mesh(new THREE.CylinderGeometry(o.r * 0.45, o.r * 0.45, 2.2, 12), toon(dx > 0 ? '#3a86e0' : '#c75a22'), dx * o.r, 1.1, dz * o.r, g);
  } else {
    mesh(new THREE.CylinderGeometry(o.r * 0.8, o.r, 9, 10), toon('#a0806a'), 0, 4.5, 0, g);
    mesh(new THREE.CylinderGeometry(o.r * 1.05, o.r * 1.05, 0.8, 10), toon('#7a5a46'), 0, 9, 0, g);
  }
  return g;
}

/** Minimap for an arena, drawn at the same isometric angle as the camera. */
export function arenaSvg(arena: ArenaGround, size: number): MiniMap {
  const rot = (x: number, z: number): [number, number] => [(x - z) * Math.SQRT1_2, (x + z) * Math.SQRT1_2 * 0.6];
  const R = Math.max(arena.halfW, arena.halfH) * Math.SQRT2;
  const scale = (size - 16) / (R * 2);
  const toSvg = (x: number, z: number): [number, number] => {
    const [a, b] = rot(x, z);
    return [size / 2 + a * scale, size / 2 + b * scale];
  };
  const def = arena.def;
  let outline: string;
  if (def.shape === 'circle') {
    const pts = Array.from({ length: 48 }, (_, i) => {
      const a = (i / 48) * Math.PI * 2;
      return toSvg(Math.cos(a) * def.radius!, Math.sin(a) * def.radius!);
    });
    outline = `M${pts.map((p) => p.map((v) => v.toFixed(1)).join(',')).join('L')}Z`;
  } else {
    const hw = def.w! / 2, hh = def.h! / 2;
    outline = `M${[toSvg(-hw, -hh), toSvg(hw, -hh), toSvg(hw, hh), toSvg(-hw, hh)].map((p) => p.map((v) => v.toFixed(1)).join(',')).join('L')}Z`;
  }
  const obstacles = def.obstacles.map((o) => {
    const [x, y] = toSvg(o.x, o.z);
    return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${Math.max(3, o.r * scale).toFixed(1)}" fill="#6b5446"/>`;
  });
  return { svg: `<path d="${outline}" fill="rgba(255,244,220,0.35)" stroke="#fff4dc" stroke-width="5"/>${obstacles.join('')}`, toSvg };
}
