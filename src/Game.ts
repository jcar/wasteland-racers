import * as THREE from 'three';
import { Controls } from './systems/Controls';
import { resumeMusic } from './audio/music';
import { audio } from './audio/sfx';

/** A screen of the game: title, garage, race, and so on. */
export interface Scene {
  enter(): void;
  update(dt: number): void;
  exit(): void;
  /** What to draw in 3D, if anything. */
  view?: { scene: THREE.Scene; camera: THREE.Camera };
}

class Game {
  readonly renderer: THREE.WebGLRenderer;
  readonly ui = document.getElementById('ui')!;
  readonly root = document.getElementById('game')!;
  readonly controls = new Controls();
  private current?: Scene;
  private last = performance.now();
  /** Dev only (?fast): run the clock faster and render cheaply, for automated playthroughs. */
  private timeScale = 1;

  constructor() {
    const canvas = document.getElementById('view') as HTMLCanvasElement;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(2, window.devicePixelRatio));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    if (import.meta.env.DEV && new URLSearchParams(location.search).has('fast')) {
      this.timeScale = 3;
      this.renderer.setPixelRatio(0.5);
      this.renderer.shadowMap.enabled = false;
    }
    this.resize();
    window.addEventListener('resize', () => this.resize());
    this.controls.onFirstInput = () => {
      audio();
      resumeMusic();
    };
  }

  get width() {
    return this.root.clientWidth;
  }
  get height() {
    return this.root.clientHeight;
  }

  private resize() {
    this.renderer.setSize(this.width, this.height, false);
  }

  go(scene: Scene) {
    this.current?.exit();
    this.ui.innerHTML = '';
    this.root.style.backgroundImage = '';
    this.current = scene;
    scene.enter();
  }

  start() {
    const frame = (now: number) => {
      const dt = Math.min(0.05, (now - this.last) / 1000) * this.timeScale;
      this.last = now;
      const scene = this.current;
      scene?.update(dt);
      const view = this.current?.view;
      // 2D-only screens hide the canvas so the page background shows through.
      this.renderer.domElement.style.visibility = view ? 'visible' : 'hidden';
      if (view) this.renderer.render(view.scene, view.camera);
      this.controls.endFrame();
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  }
}

export const game = new Game();
