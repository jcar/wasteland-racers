import * as THREE from 'three';
import { texture } from '../systems/assets';
import { puff, star } from '../art/placeholders';

/**
 * Cheap pooled particles: dust behind the wheels, goo splats, sparkles and
 * boost smoke. Sprites always face the camera, which suits the view.
 */
interface Particle {
  sprite: THREE.Sprite;
  vx: number;
  vy: number;
  vz: number;
  life: number;
  max: number;
  grow: number;
  gravity: number;
}

export class Effects {
  private pool: Particle[] = [];
  private live: Particle[] = [];
  private puffTex = texture('fx-puff', puff);
  private starTex = texture('fx-star', star);
  readonly group = new THREE.Group();

  private spawn(x: number, y: number, z: number, color: string, opts: { size?: number; vx?: number; vy?: number; vz?: number; life?: number; grow?: number; gravity?: number; star?: boolean } = {}) {
    let p = this.pool.pop();
    if (!p) {
      const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ transparent: true, depthWrite: false }));
      this.group.add(sprite);
      p = { sprite, vx: 0, vy: 0, vz: 0, life: 0, max: 1, grow: 0, gravity: 0 };
    }
    const m = p.sprite.material;
    m.map = opts.star ? this.starTex : this.puffTex;
    m.color.set(color);
    m.opacity = 1;
    const size = opts.size ?? 1;
    p.sprite.scale.set(size, size, 1);
    p.sprite.position.set(x, y, z);
    p.sprite.visible = true;
    p.vx = opts.vx ?? 0;
    p.vy = opts.vy ?? 0;
    p.vz = opts.vz ?? 0;
    p.life = p.max = opts.life ?? 0.8;
    p.grow = opts.grow ?? 1.5;
    p.gravity = opts.gravity ?? 0;
    this.live.push(p);
  }

  dust(x: number, y: number, z: number, color: string, amount = 1) {
    if (this.live.length > 400) return;
    for (let i = 0; i < amount; i++)
      this.spawn(x + (Math.random() - 0.5), y + 0.3, z + (Math.random() - 0.5), color, { size: 0.8 + Math.random() * 0.6, vy: 1 + Math.random(), life: 0.6 + Math.random() * 0.4, grow: 2.2 });
  }

  smoke(x: number, y: number, z: number) {
    this.spawn(x, y, z, '#ffb347', { size: 0.9, vy: 1.5, life: 0.35, grow: 3 });
  }

  splat(x: number, y: number, z: number, color = '#9be15d', count = 14) {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2, s = 3 + Math.random() * 5;
      this.spawn(x, y + 0.5, z, color, { size: 0.7, vx: Math.cos(a) * s, vz: Math.sin(a) * s, vy: 5 + Math.random() * 5, gravity: 20, life: 0.8, grow: 0 });
    }
  }

  sparkle(x: number, y: number, z: number, color = '#ffe14d', count = 10) {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2, s = 2 + Math.random() * 4;
      this.spawn(x, y + 1, z, color, { size: 0.9, vx: Math.cos(a) * s, vz: Math.sin(a) * s, vy: 4 + Math.random() * 4, gravity: 12, life: 0.7, grow: -0.8, star: true });
    }
  }

  update(dt: number) {
    for (let i = this.live.length - 1; i >= 0; i--) {
      const p = this.live[i];
      p.life -= dt;
      if (p.life <= 0) {
        p.sprite.visible = false;
        this.live.splice(i, 1);
        this.pool.push(p);
        continue;
      }
      p.vy -= p.gravity * dt;
      p.sprite.position.x += p.vx * dt;
      p.sprite.position.y += p.vy * dt;
      p.sprite.position.z += p.vz * dt;
      const s = Math.max(0.05, p.sprite.scale.x + p.grow * dt);
      p.sprite.scale.set(s, s, 1);
      p.sprite.material.opacity = Math.min(1, (p.life / p.max) * 1.5);
    }
  }
}
