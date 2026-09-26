import * as THREE from 'three';
import type { BodyKind, UpgradeStat } from '../data/cars';
import type { DriverDef } from '../data/characters';
import { texture } from '../systems/assets';
import { COLORS, ball, box, cyl, mesh, toon } from './materials';
import { emojiArt } from './placeholders';

/**
 * Chunky toy cars built from simple shapes. Each upgrade level bolts a
 * visible part on, so the car looks tougher as it gets faster.
 * Cars face +x; y is up.
 */
export interface CarLook {
  body: BodyKind;
  paint: string;
  decal?: string;
  upgrades: Record<UpgradeStat, number>;
  head: DriverDef['head'];
}

export interface CarModel {
  root: THREE.Group;
  /** Everything above the wheels; tilts and bounces. */
  chassis: THREE.Group;
  wheels: THREE.Object3D[];
  wheelRadius: number;
  boing: THREE.Group;
  flames: THREE.Group;
}

interface Frame {
  wheelR: number;
  wheels: [number, number][];
  frontX: number;
  backX: number;
  halfW: number;
  /** Height of the hood/deck top. */
  deckY: number;
  hoodX: number;
  roofY: number;
  headPos: [number, number];
}

function buildBody(kind: BodyKind, paint: string, c: THREE.Group): Frame {
  const P = paint, M = COLORS.metal;
  switch (kind) {
    case 'buggy': {
      box(2.9, 0.35, 1.5, P, 0, 0.7, 0, c);
      const nose = box(0.8, 0.3, 1.3, P, 1.5, 0.66, 0, c);
      nose.rotation.z = -0.35;
      box(0.7, 0.55, 0.9, M, -1.05, 1.1, 0, c); // engine
      box(0.5, 0.5, 0.8, COLORS.seat, -0.35, 1.1, 0, c);
      for (const [x, z] of [[-0.6, 0.6], [-0.6, -0.6], [0.5, 0.6], [0.5, -0.6]]) cyl(0.06, 0.9, M, x, 1.3, z, c);
      box(1.2, 0.08, 0.08, M, -0.05, 1.75, 0.6, c);
      box(1.2, 0.08, 0.08, M, -0.05, 1.75, -0.6, c);
      box(0.08, 0.08, 1.28, M, 0.5, 1.75, 0, c);
      box(0.08, 0.08, 1.28, M, -0.6, 1.75, 0, c);
      return { wheelR: 0.55, wheels: [[1.15, 0.95], [1.15, -0.95], [-1.1, 0.95], [-1.1, -0.95]], frontX: 1.8, backX: -1.45, halfW: 0.75, deckY: 0.88, hoodX: 1.0, roofY: 1.8, headPos: [-0.2, 1.45] };
    }
    case 'hopper': {
      box(3.2, 0.45, 1.7, P, 0, 0.7, 0, c);
      const wedge = box(1.2, 0.35, 1.6, P, 1.3, 0.95, 0, c);
      wedge.rotation.z = -0.25;
      box(1.0, 0.35, 1.2, COLORS.glass, -0.1, 1.1, 0, c);
      box(0.6, 0.7, 0.08, P, -1.35, 1.2, 0.7, c);
      box(0.6, 0.7, 0.08, P, -1.35, 1.2, -0.7, c);
      box(0.5, 0.4, 1.0, M, -1.2, 1.05, 0, c);
      return { wheelR: 0.52, wheels: [[1.15, 0.95], [1.15, -0.95], [-1.1, 0.95], [-1.1, -0.95]], frontX: 1.7, backX: -1.6, halfW: 0.85, deckY: 1.05, hoodX: 1.2, roofY: 1.3, headPos: [-0.15, 1.55] };
    }
    case 'truck': {
      box(3.4, 0.4, 1.8, M, 0, 0.75, 0, c);
      box(1.3, 0.55, 1.8, P, -0.95, 1.2, 0, c); // bed
      box(1.1, 0.25, 1.5, COLORS.rust, -0.95, 1.4, 0, c);
      box(1.1, 0.95, 1.75, P, 0.2, 1.45, 0, c); // cab
      box(0.08, 0.5, 1.5, COLORS.glass, 0.77, 1.6, 0, c);
      box(1.0, 0.55, 1.75, P, 1.25, 1.2, 0, c); // hood
      return { wheelR: 0.62, wheels: [[1.2, 1.0], [1.2, -1.0], [-1.15, 1.0], [-1.15, -1.0]], frontX: 1.75, backX: -1.6, halfW: 0.9, deckY: 1.48, hoodX: 1.25, roofY: 1.93, headPos: [0.2, 2.15] };
    }
    case 'monster': {
      const lift = 0.8;
      box(3.2, 0.3, 1.2, M, 0, 1.1, 0, c);
      for (const x of [1.3, -1.3]) for (const z of [0.6, -0.6]) cyl(0.12, 0.9, COLORS.gold, x, 1.3, z, c);
      box(1.2, 0.55, 1.9, P, -0.95, 1.3 + lift, 0, c);
      box(1.1, 0.9, 1.85, P, 0.2, 1.55 + lift, 0, c);
      box(0.08, 0.45, 1.6, COLORS.glass, 0.77, 1.7 + lift, 0, c);
      box(1.0, 0.55, 1.85, P, 1.25, 1.3 + lift, 0, c);
      return { wheelR: 1.0, wheels: [[1.3, 1.25], [1.3, -1.25], [-1.3, 1.25], [-1.3, -1.25]], frontX: 1.75, backX: -1.55, halfW: 0.95, deckY: 1.58 + lift, hoodX: 1.25, roofY: 2.0 + lift, headPos: [0.2, 2.25 + lift] };
    }
    case 'rig': {
      box(4.0, 0.4, 1.8, M, 0, 0.8, 0, c);
      box(1.3, 1.2, 1.9, P, 1.2, 1.6, 0, c); // cab
      box(0.08, 0.5, 1.6, COLORS.glass, 1.86, 1.85, 0, c);
      box(0.2, 0.6, 1.6, COLORS.chrome, 1.95, 1.2, 0, c); // grille
      const tank = mesh(new THREE.CylinderGeometry(0.85, 0.85, 2.3, 14), toon(COLORS.rust), -0.9, 1.75, 0, c);
      tank.rotation.z = Math.PI / 2;
      box(0.15, 1.2, 1.9, P, -0.9, 1.75, 0, c);
      return { wheelR: 0.6, wheels: [[1.4, 1.0], [1.4, -1.0], [-0.4, 1.0], [-0.4, -1.0], [-1.55, 1.0], [-1.55, -1.0]], frontX: 2.0, backX: -2.0, halfW: 0.95, deckY: 2.2, hoodX: 1.2, roofY: 2.2, headPos: [1.2, 2.45] };
    }
  }
}

export function buildHead(head: DriverDef['head']): THREE.Group {
  const g = new THREE.Group();
  const s = head.skin, h = head.hat;
  switch (head.kind) {
    case 'kid':
      ball(0.32, s, 0, 0, 0, g);
      ball(0.33, h, 0, 0.1, 0, g).scale.set(1, 0.6, 1);
      box(0.12, 0.1, 0.62, COLORS.outline, 0.25, 0.05, 0, g);
      for (const z of [0.13, -0.13]) mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.08, 10), toon('#7fe3ff'), 0.31, 0.05, z, g).rotation.z = Math.PI / 2;
      break;
    case 'dog':
      ball(0.32, s, 0, 0, 0, g);
      box(0.28, 0.2, 0.26, s, 0.3, -0.07, 0, g);
      ball(0.07, COLORS.outline, 0.45, -0.02, 0, g);
      for (const z of [0.25, -0.25]) box(0.14, 0.3, 0.08, '#8a5a2a', -0.05, 0.05, z, g).rotation.x = z > 0 ? 0.5 : -0.5;
      box(0.1, 0.2, 0.62, h, 0.05, -0.28, 0, g); // bandana
      break;
    case 'robot':
      box(0.55, 0.5, 0.55, s, 0, 0, 0, g);
      for (const z of [0.13, -0.13]) ball(0.08, '#4df0e6', 0.28, 0.05, z, g);
      cyl(0.03, 0.35, COLORS.metal, 0, 0.42, 0, g);
      ball(0.07, h, 0, 0.6, 0, g);
      break;
    case 'lizard':
      ball(0.3, s, 0, 0, 0, g).scale.set(1.3, 1, 1);
      for (const z of [0.15, -0.15]) {
        ball(0.11, s, 0.1, 0.22, z, g);
        ball(0.06, COLORS.outline, 0.17, 0.25, z, g);
      }
      ball(0.31, h, -0.08, 0.1, 0, g).scale.set(1, 0.55, 1);
      break;
  }
  return g;
}

export function buildCar(look: CarLook): CarModel {
  const root = new THREE.Group();
  const chassis = new THREE.Group();
  root.add(chassis);
  const f = buildBody(look.body, look.paint, chassis);
  const u = look.upgrades;

  // Wheels: bigger and knobbier with each tire upgrade.
  const wheelR = f.wheelR * (1 + 0.07 * u.tires);
  const wheels: THREE.Object3D[] = [];
  const tireGeo = new THREE.CylinderGeometry(wheelR, wheelR, 0.5 + 0.04 * u.tires, u.tires >= 2 ? 10 : 16);
  tireGeo.rotateX(Math.PI / 2);
  const hubColor = u.tires >= 3 ? COLORS.gold : u.tires >= 1 ? COLORS.chrome : COLORS.metal;
  const hubGeo = new THREE.CylinderGeometry(wheelR * 0.5, wheelR * 0.5, 0.56 + 0.04 * u.tires, 8);
  hubGeo.rotateX(Math.PI / 2);
  for (const [x, z] of f.wheels) {
    const pivot = new THREE.Group();
    pivot.position.set(x, wheelR, z * (1 + 0.04 * u.tires));
    mesh(tireGeo, toon(COLORS.tire), 0, 0, 0, pivot);
    mesh(hubGeo, toon(hubColor), 0, 0, 0, pivot);
    if (u.tires >= 2) for (let i = 0; i < 4; i++) {
      const knob = box(wheelR * 0.3, 0.12, 0.55, '#3a3a40', 0, 0, 0, pivot);
      const a = (i / 4) * Math.PI * 2;
      knob.position.set(Math.cos(a) * wheelR, Math.sin(a) * wheelR, 0);
      knob.rotation.z = a;
    }
    if (u.tires >= 4) {
      const spike = mesh(new THREE.ConeGeometry(0.12, 0.35, 8), toon(COLORS.chrome), 0, 0, Math.sign(z) * 0.45, pivot);
      spike.rotation.x = Math.sign(z) * Math.PI / 2;
    }
    root.add(pivot);
    wheels.push(pivot);
  }
  // Lift the body with bigger tires.
  chassis.position.y = wheelR - f.wheelR;

  // Engine: exhaust pipes, a scoop, taller chrome stacks, a supercharger.
  if (u.engine >= 1) {
    const pipeColor = u.engine >= 3 ? COLORS.chrome : COLORS.metal;
    const tall = u.engine >= 3 ? 1.1 : 0.7;
    for (const z of [f.halfW - 0.25, -(f.halfW - 0.25)]) {
      cyl(0.11, tall, pipeColor, f.backX + 0.35, f.deckY + tall / 2 - 0.1, z, chassis);
      if (u.engine >= 3) ball(0.13, COLORS.outline, f.backX + 0.35, f.deckY + tall - 0.08, z, chassis).scale.y = 0.4;
    }
  }
  if (u.engine >= 2) box(0.5, 0.22, 0.45, COLORS.metal, f.hoodX, f.deckY + 0.1, 0, chassis);
  if (u.engine >= 4) {
    box(0.55, 0.4, 0.55, COLORS.chrome, f.hoodX - 0.1, f.deckY + 0.35, 0, chassis);
    box(0.3, 0.2, 0.7, COLORS.gold, f.hoodX - 0.1, f.deckY + 0.62, 0, chassis);
  }

  // Armor: bumper, side plates, roof cage, front spikes.
  if (u.armor >= 1) {
    box(0.25, 0.3, f.halfW * 2 + 0.3, COLORS.metal, f.frontX + 0.05, 0.75, 0, chassis);
    for (const z of [-0.4, 0, 0.4]) box(0.08, 0.35, 0.08, COLORS.chrome, f.frontX + 0.2, 0.75, z, chassis);
  }
  if (u.armor >= 2) for (const z of [f.halfW + 0.05, -(f.halfW + 0.05)]) {
    box(1.8, 0.35, 0.08, COLORS.rust, 0, 1.0, z, chassis);
    for (const x of [-0.7, 0, 0.7]) ball(0.05, COLORS.chrome, x, 1.0, z * 1.05, chassis);
  }
  if (u.armor >= 3) {
    for (const z of [f.halfW - 0.1, -(f.halfW - 0.1)]) box(1.4, 0.07, 0.07, COLORS.metal, -0.2, f.roofY + 0.15, z, chassis);
    for (const x of [-0.8, -0.2, 0.4]) box(0.07, 0.07, f.halfW * 2 - 0.2, COLORS.metal, x, f.roofY + 0.15, 0, chassis);
  }
  if (u.armor >= 4) for (const z of [-0.45, 0, 0.45]) {
    const spike = mesh(new THREE.ConeGeometry(0.12, 0.45, 8), toon(COLORS.chrome), f.frontX + 0.4, 0.78, z, chassis);
    spike.rotation.z = -Math.PI / 2;
  }

  // Gadget power: antenna flag, light bar, spoiler, golden wing.
  if (u.gadget >= 1) {
    cyl(0.03, 1.3, COLORS.metal, f.backX + 0.3, f.deckY + 0.6, -(f.halfW - 0.1), chassis);
    const flag = box(0.4, 0.25, 0.03, '#ff8a1f', f.backX + 0.1, f.deckY + 1.1, -(f.halfW - 0.1), chassis);
    flag.name = 'flag';
  }
  if (u.gadget >= 2) [-0.45, -0.15, 0.15, 0.45].forEach((z, i) => box(0.18, 0.14, 0.22, i % 2 ? '#ffd23f' : '#ff7a1a', 0.2, f.roofY + 0.05, z, chassis));
  if (u.gadget >= 3) {
    const wingColor = u.gadget >= 4 ? COLORS.gold : look.paint;
    for (const z of [0.5, -0.5]) box(0.08, 0.45, 0.08, COLORS.metal, f.backX + 0.25, f.deckY + 0.25, z, chassis);
    box(0.5, 0.08, f.halfW * 2 + 0.3, wingColor, f.backX + 0.2, f.deckY + 0.5, 0, chassis);
  }
  if (u.gadget >= 4) cyl(0.03, 1.3, COLORS.metal, f.backX + 0.3, f.deckY + 0.6, f.halfW - 0.1, chassis);

  // Hood sticker.
  if (look.decal) {
    const tex = texture(look.decal, emojiArt('⭐'));
    const decal = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 1.0), toon('#ffffff', { map: tex, transparent: true }));
    decal.geometry.rotateX(-Math.PI / 2);
    decal.geometry.rotateY(-Math.PI / 2);
    // Scoot back when the engine scoop takes the middle of the hood.
    decal.position.set(f.hoodX - (u.engine >= 2 ? 0.45 : 0), f.deckY + 0.02, 0);
    chassis.add(decal);
  }

  // Driver.
  const head = buildHead(look.head);
  head.position.set(f.headPos[0], f.headPos[1], 0);
  chassis.add(head);

  // Boing bumper (hidden until used): a spring with a big soft glove.
  const boing = new THREE.Group();
  boing.position.set(f.frontX, 0.9, 0);
  const spring = mesh(new THREE.CylinderGeometry(0.12, 0.12, 1, 8), toon(COLORS.chrome), 0.5, 0, 0, boing);
  spring.rotation.z = Math.PI / 2;
  ball(0.45, '#e8322a', 1.1, 0, 0, boing).scale.set(0.9, 1, 1.1);
  boing.visible = false;
  chassis.add(boing);

  // Rocket flames (hidden until boosting).
  const flames = new THREE.Group();
  for (const z of [0.4, -0.4]) {
    const outer = mesh(new THREE.ConeGeometry(0.28, 1.2, 10), toon('#ff7a1a', { emissive: '#ff5a00' }), f.backX - 0.6, 1.0, z, flames);
    outer.rotation.z = Math.PI / 2;
    const inner = mesh(new THREE.ConeGeometry(0.15, 0.8, 8), toon('#ffe14d', { emissive: '#ffd000' }), f.backX - 0.45, 1.0, z, flames);
    inner.rotation.z = Math.PI / 2;
  }
  flames.visible = false;
  chassis.add(flames);

  return { root, chassis, wheels, wheelRadius: wheelR, boing, flames };
}
