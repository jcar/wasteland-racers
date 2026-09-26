import * as THREE from 'three';

/** Cartoon (cel) shading: three flat bands of light. */
const gradient = (() => {
  const t = new THREE.DataTexture(new Uint8Array([90, 170, 255]), 3, 1, THREE.RedFormat);
  t.minFilter = t.magFilter = THREE.NearestFilter;
  t.needsUpdate = true;
  return t;
})();

const cache = new Map<string, THREE.MeshToonMaterial>();

export function toon(color: string, opts: { map?: THREE.Texture; transparent?: boolean; emissive?: string } = {}): THREE.MeshToonMaterial {
  const key = `${color}|${opts.map?.uuid ?? ''}|${opts.transparent ? 't' : ''}|${opts.emissive ?? ''}`;
  let m = cache.get(key);
  if (!m) {
    m = new THREE.MeshToonMaterial({ color, gradientMap: gradient, map: opts.map ?? null });
    if (opts.transparent) {
      m.transparent = true;
      m.alphaTest = 0.25;
      m.depthWrite = false;
      m.polygonOffset = true;
      m.polygonOffsetFactor = -2;
    }
    if (opts.emissive) {
      m.emissive = new THREE.Color(opts.emissive);
      m.emissiveIntensity = 0.6;
    }
    cache.set(key, m);
  }
  return m;
}

export const COLORS = {
  metal: '#5d6068',
  chrome: '#c9d0d8',
  rust: '#8a4b2a',
  tire: '#26262a',
  seat: '#3a2a20',
  glass: '#2b3d4f',
  gold: '#ffc93c',
  outline: '#1c1410',
};

/** Add a mesh that casts and receives shadows. */
export function mesh(geo: THREE.BufferGeometry, mat: THREE.Material, x = 0, y = 0, z = 0, parent?: THREE.Object3D) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  parent?.add(m);
  return m;
}

export const box = (w: number, h: number, d: number, color: string, x: number, y: number, z: number, parent?: THREE.Object3D) =>
  mesh(new THREE.BoxGeometry(w, h, d), toon(color), x, y, z, parent);

/** A cylinder standing up (along y). */
export const cyl = (r: number, h: number, color: string, x: number, y: number, z: number, parent?: THREE.Object3D, segments = 10) =>
  mesh(new THREE.CylinderGeometry(r, r, h, segments), toon(color), x, y, z, parent);

export const ball = (r: number, color: string, x: number, y: number, z: number, parent?: THREE.Object3D) =>
  mesh(new THREE.SphereGeometry(r, 14, 10), toon(color), x, y, z, parent);
