import * as THREE from 'three';
import type { BodyKind } from '../data/cars';
import { COLORS, ball, box, cyl, mesh, toon } from './materials';
import type { Frame } from './carBuilder';

/**
 * The Wasteland legends, built from the same chunky shapes as the Season 1
 * cars: the Interceptor, Nux Car, Buzzard, Big Foot, Doof Wagon, Peacemaker,
 * Gigahorse and Dementus's chariot. Cars face +x; y is up.
 */
const M = COLORS.metal, CH = COLORS.chrome, GL = COLORS.glass;

/** A pipe lying along x. */
function pipe(r: number, len: number, color: string, x: number, y: number, z: number, parent: THREE.Object3D) {
  const p = cyl(r, len, color, x, y, z, parent);
  p.rotation.z = Math.PI / 2;
  return p;
}

/** A spike pointing along `dir`. */
function spike(parent: THREE.Object3D, x: number, y: number, z: number, dir: THREE.Vector3, size = 1) {
  const s = mesh(new THREE.ConeGeometry(0.1 * size, 0.42 * size, 6), toon(CH), x, y, z, parent);
  s.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize());
  return s;
}

export function buildLoreBody(kind: BodyKind, P: string, c: THREE.Group): Frame | undefined {
  switch (kind) {
    case 'interceptor': {
      box(3.7, 0.45, 1.75, P, 0, 0.62, 0, c);
      box(1.5, 0.3, 1.65, P, 1.0, 0.95, 0, c);
      box(1.3, 0.55, 1.55, P, -0.45, 1.15, 0, c);
      box(0.08, 0.36, 1.4, GL, 0.24, 1.2, 0, c);
      box(0.55, 0.4, 0.55, CH, 0.95, 1.3, 0, c); // the blower
      box(0.45, 0.14, 0.5, M, 0.95, 1.56, 0, c);
      for (const z of [0.95, -0.95]) pipe(0.09, 2.4, CH, 0.1, 0.45, z, c);
      box(0.3, 0.08, 1.6, P, -1.75, 1.0, 0, c);
      return { wheelR: 0.55, wheels: [[1.25, 0.95], [1.25, -0.95], [-1.2, 0.95, 1.1], [-1.2, -0.95, 1.1]], frontX: 1.85, backX: -1.85, halfW: 0.85, deckY: 1.1, hoodX: 1.35, roofY: 1.45, headPos: [-0.45, 1.6] };
    }
    case 'nuxcar': {
      box(3.4, 0.25, 1.1, M, 0, 0.6, 0, c);
      box(1.6, 0.5, 1.3, P, -0.6, 0.95, 0, c);
      box(1.1, 0.6, 0.9, CH, 0.9, 1.05, 0, c); // exposed V8
      for (const x of [0.75, 1.1]) box(0.32, 0.36, 0.36, CH, x, 1.55, 0, c);
      for (const z of [0.55, -0.55]) for (const x of [0.65, 1.15]) {
        const ex = cyl(0.07, 0.8, CH, x, 1.05, z, c);
        ex.rotation.x = z > 0 ? -0.7 : 0.7;
      }
      ball(0.22, '#f4f1ea', 1.55, 0.9, 0, c); // skull grille
      return { wheelR: 0.55, wheels: [[1.35, 0.8, 0.8], [1.35, -0.8, 0.8], [-1.1, 0.95, 1.4], [-1.1, -0.95, 1.4]], frontX: 1.75, backX: -1.6, halfW: 0.65, deckY: 1.2, hoodX: -0.5, roofY: 1.3, headPos: [-0.7, 1.5] };
    }
    case 'buzzard': {
      box(3.0, 0.4, 1.6, M, 0, 0.6, 0, c);
      const shell = ball(1.0, P, 0, 1.0, 0, c);
      shell.scale.set(1.7, 0.8, 0.95);
      for (let i = 0; i < 26; i++) {
        const a = (i / 26) * Math.PI * 2 * 3.1, up = 0.15 + ((i * 7) % 10) / 12;
        const n = new THREE.Vector3(Math.cos(a) * 1.7 * (1 - up * 0.4), up * 0.8 + 0.1, Math.sin(a) * 0.95 * (1 - up * 0.4));
        spike(c, n.x, 1.0 + n.y * 0.95, n.z, new THREE.Vector3(Math.cos(a), up * 1.4, Math.sin(a)));
      }
      for (const z of [-0.5, 0, 0.5]) spike(c, 1.55, 0.65, z, new THREE.Vector3(1, 0, 0), 1.4);
      return { wheelR: 0.5, wheels: [[1.05, 0.85], [1.05, -0.85], [-1.0, 0.85], [-1.0, -0.85]], frontX: 1.7, backX: -1.6, halfW: 0.8, deckY: 1.62, hoodX: 0.55, roofY: 1.85, headPos: [0.1, 1.95] };
    }
    case 'bigfoot': {
      const lift = 1.4;
      box(3.2, 0.35, 1.4, M, 0, 0.6 + lift * 0.65, 0, c);
      for (const x of [1.4, -1.4]) for (const z of [0.6, -0.6]) cyl(0.14, 1.0, COLORS.gold, x, 1.1 + lift * 0.4, z, c);
      box(1.1, 0.6, 1.95, P, 1.25, 1.35 + lift * 0.6, 0, c);
      box(1.2, 1.0, 2.0, P, 0.1, 1.6 + lift * 0.6, 0, c);
      box(0.08, 0.45, 1.7, GL, 0.72, 1.8 + lift * 0.6, 0, c);
      box(1.3, 0.6, 2.0, P, -1.0, 1.35 + lift * 0.6, 0, c);
      for (const z of [0.9, -0.9]) box(0.08, 0.9, 0.08, M, -0.6, 2.4 + lift * 0.6, z, c);
      box(0.08, 0.08, 1.88, M, -0.6, 2.85 + lift * 0.6, 0, c);
      for (const z of [-0.6, 0, 0.6]) spike(c, 1.95, 1.2 + lift * 0.6, z, new THREE.Vector3(1, 0, 0), 1.5);
      return { wheelR: 1.35, wheels: [[1.45, 1.45], [1.45, -1.45], [-1.45, 1.45], [-1.45, -1.45]], frontX: 1.8, backX: -1.65, halfW: 1.0, deckY: 1.65 + lift * 0.6, hoodX: 1.25, roofY: 2.1 + lift * 0.6, headPos: [0.1, 2.35 + lift * 0.6] };
    }
    case 'doof': {
      box(4.2, 0.45, 2.0, M, 0, 0.85, 0, c);
      box(1.2, 1.1, 1.9, P, 1.35, 1.6, 0, c);
      box(0.08, 0.5, 1.6, GL, 1.96, 1.8, 0, c);
      box(1.8, 2.2, 2.0, '#1c1c1c', -1.0, 2.2, 0, c); // the speaker wall
      for (const z of [1.02, -1.02]) for (const x of [-1.5, -0.5]) for (const y of [1.6, 2.4]) {
        const cone = cyl(0.32, 0.08, '#444', x, y, z, c, 14);
        cone.rotation.x = Math.PI / 2;
        const dust = cyl(0.12, 0.1, CH, x, y, z * 1.02, c, 10);
        dust.rotation.x = Math.PI / 2;
      }
      for (const x of [-1.5, -0.5]) cyl(0.42, 0.5, '#a0522d', x, 3.55, 0, c, 14); // war drums
      // The Doof Warrior on his bungee rig, guitar spitting fire.
      cyl(0.05, 1.4, M, 2.25, 2.0, 0, c);
      box(0.32, 0.75, 0.38, '#d22b2b', 2.35, 2.3, 0, c);
      ball(0.2, '#d22b2b', 2.35, 2.85, 0, c);
      box(0.2, 0.12, 0.3, '#1c1c1c', 2.5, 2.85, 0, c);
      const guitar = box(0.85, 0.14, 0.3, '#1c1c1c', 2.6, 2.25, 0.2, c);
      guitar.rotation.z = 0.5;
      const fire = mesh(new THREE.ConeGeometry(0.2, 0.9, 8), toon('#ff7a1a', { emissive: '#ff5a00' }), 3.05, 2.75, 0.2, c);
      fire.rotation.z = -0.9;
      return { wheelR: 0.65, wheels: [[1.45, 1.05], [1.45, -1.05], [-0.5, 1.05], [-0.5, -1.05], [-1.6, 1.05], [-1.6, -1.05]], frontX: 2.1, backX: -2.1, halfW: 1.0, deckY: 2.15, hoodX: 1.35, roofY: 2.15, headPos: [1.35, 2.4] };
    }
    case 'peacemaker': {
      box(3.8, 0.9, 2.0, P, 0, 1.05, 0, c);
      const nose = box(0.8, 0.6, 1.9, P, 1.9, 0.95, 0, c);
      nose.rotation.z = -0.5;
      for (const z of [1.15, -1.15]) box(3.9, 0.7, 0.45, '#2b2b2b', 0, 0.55, z, c);
      cyl(0.75, 0.5, P, -0.3, 1.75, 0, c, 14);
      pipe(0.13, 1.7, M, 0.75, 1.85, 0, c);
      for (const x of [-1.4, -0.5, 0.4, 1.3]) for (const z of [0.95, -0.95]) ball(0.06, CH, x, 1.3, z * 1.05, c);
      return { wheelR: 0.4, wheels: [[1.35, 1.15], [0.45, 1.15], [-0.45, 1.15], [-1.35, 1.15], [1.35, -1.15], [0.45, -1.15], [-0.45, -1.15], [-1.35, -1.15]], frontX: 2.0, backX: -1.9, halfW: 1.0, deckY: 1.5, hoodX: 1.15, roofY: 2.0, headPos: [-0.3, 2.25] };
    }
    case 'gigahorse': {
      box(3.8, 0.35, 1.4, M, 0, 1.45, 0, c);
      box(3.6, 0.55, 1.9, P, 0, 1.9, 0, c); // lower car
      box(3.2, 0.5, 1.75, P, -0.1, 2.45, 0, c); // upper car
      box(1.3, 0.45, 1.5, P, -0.45, 2.9, 0, c);
      box(0.08, 0.32, 1.3, GL, 0.22, 2.92, 0, c);
      for (const y of [2.1, 2.65]) for (const z of [0.85, -0.85]) {
        const fin = box(0.7, 0.4, 0.08, P, -1.7, y + 0.2, z, c);
        fin.rotation.z = 0.35;
      }
      for (const z of [0.45, -0.45]) {
        box(0.7, 0.6, 0.6, CH, 1.55, 2.45, z, c); // twin V8s
        box(0.32, 0.35, 0.35, CH, 1.55, 2.9, z, c);
      }
      return { wheelR: 1.2, wheels: [[1.45, 1.3], [1.45, -1.3], [-1.5, 1.35, 1.12], [-1.5, -1.35, 1.12]], frontX: 2.0, backX: -1.9, halfW: 0.95, deckY: 3.1, hoodX: 0.9, roofY: 3.15, headPos: [-0.45, 3.4] };
    }
    case 'chariot': {
      for (const z of [-1.1, 0, 1.1]) {
        box(1.3, 0.3, 0.25, M, 1.3, 0.75, z, c);
        box(0.45, 0.25, 0.3, P, 1.4, 0.98, z, c);
        box(0.08, 0.08, 0.6, CH, 1.85, 1.18, z, c);
        pipe(0.06, 0.8, CH, 1.0, 0.55, z + 0.18, c);
        box(1.3, 0.08, 0.08, M, 0.25, 0.85, z * 0.7, c); // tow bars
      }
      box(1.2, 0.9, 1.5, P, -0.9, 1.15, 0, c);
      box(1.25, 0.12, 1.55, COLORS.gold, -0.9, 1.62, 0, c);
      const cape = box(0.05, 1.1, 0.95, '#f4f1ea', -1.65, 1.85, 0, c);
      cape.rotation.z = 0.55;
      return { wheelR: 0.5, wheels: [[1.85, -1.1, 0.8], [0.75, -1.1, 0.8], [1.85, 0, 0.8], [0.75, 0, 0.8], [1.85, 1.1, 0.8], [0.75, 1.1, 0.8], [-0.9, 0.95, 1.4], [-0.9, -0.95, 1.4]], frontX: 2.3, backX: -1.6, halfW: 0.75, deckY: 1.68, hoodX: -0.9, roofY: 1.7, headPos: [-0.9, 2.0] };
    }
  }
  return undefined;
}

/** Things bolted to the front of the hood. */
export function buildOrnament(id: string): THREE.Group | undefined {
  const g = new THREE.Group();
  switch (id) {
    case 'skull':
      ball(0.28, CH, 0, 0.25, 0, g).scale.set(1, 0.9, 1.1);
      for (const z of [0.1, -0.1]) ball(0.07, '#1c1c1c', 0.22, 0.3, z, g);
      box(0.18, 0.12, 0.3, CH, 0.12, 0.05, 0, g);
      break;
    case 'wheel': {
      const ring = mesh(new THREE.TorusGeometry(0.28, 0.06, 8, 16), toon(CH), 0, 0.32, 0, g);
      ring.rotation.y = Math.PI / 2;
      box(0.06, 0.5, 0.06, CH, 0, 0.32, 0, g);
      box(0.06, 0.06, 0.5, CH, 0, 0.32, 0, g);
      break;
    }
    case 'teddy':
      ball(0.2, '#8a5a3a', 0, 0.2, 0, g);
      ball(0.15, '#8a5a3a', 0, 0.48, 0, g);
      for (const z of [0.1, -0.1]) ball(0.06, '#8a5a3a', 0, 0.6, z, g);
      ball(0.04, '#1c1c1c', 0.14, 0.5, 0, g);
      break;
    case 'horns':
      for (const z of [1, -1]) {
        const h = mesh(new THREE.ConeGeometry(0.08, 0.7, 8), toon('#f4f1ea'), 0, 0.3, z * 0.35, g);
        h.rotation.x = z * -1.1;
      }
      break;
    default:
      return undefined;
  }
  return g;
}
