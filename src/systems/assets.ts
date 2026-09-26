import * as THREE from 'three';

/**
 * Generated art and sound (see tools/generate-assets.mjs) are listed in
 * public/assets/assets.json. Anything missing falls back to placeholder art
 * drawn in code, so the game always works, and each file replaces its
 * placeholder the moment it loads.
 */
const urls = new Map<string, string>();

export async function loadAssetIndex() {
  try {
    const res = await fetch('assets/assets.json', { cache: 'no-cache' });
    const index = (await res.json()) as { images: { key: string; url: string }[]; audio: { key: string; url: string }[] };
    for (const e of [...index.images, ...index.audio]) urls.set(e.key, e.url);
  } catch {
    /* no generated assets yet: placeholders everywhere */
  }
}

export const assetUrl = (key: string) => urls.get(key);
export const hasAsset = (key: string) => urls.has(key);

const textures = new Map<string, THREE.Texture>();
const loader = new THREE.TextureLoader();

/**
 * A texture for `key`. Returns the placeholder right away and swaps in the
 * real image when it arrives, so materials never have to be rebuilt.
 */
export function texture(key: string, placeholder: () => HTMLCanvasElement, opts: { repeat?: boolean } = {}): THREE.Texture {
  const cacheKey = `${key}|${opts.repeat ? 'r' : ''}`;
  const hit = textures.get(cacheKey);
  if (hit) return hit;
  const tex: THREE.Texture = new THREE.CanvasTexture(placeholder());
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  if (opts.repeat) tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  textures.set(cacheKey, tex);
  const url = urls.get(key);
  if (url)
    loader.load(url, (loaded) => {
      // A different size needs fresh GPU storage, so drop the old upload first.
      tex.dispose();
      tex.image = loaded.image;
      tex.needsUpdate = true;
    });
  return tex;
}

/** An <img> for generated art, or a big emoji until it exists. */
export function artHtml(key: string, emoji: string, cls = ''): string {
  const url = key ? urls.get(key) : undefined;
  return url ? `<img class="art ${cls}" src="${url}" alt="" draggable="false">` : `<span class="emoji ${cls}">${emoji}</span>`;
}
