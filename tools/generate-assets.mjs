#!/usr/bin/env node
/**
 * Wasteland Racers asset generator (Gemini).
 *
 *   npm run assets                       generate everything that's missing
 *   npm run assets -- --only title-bg,rival-*   just these (a trailing * matches a prefix)
 *   npm run assets -- --kind voice       only images | voice | music
 *   npm run assets -- --force            regenerate even if the file exists
 *   npm run assets -- --dry-run          show what would be generated
 *   npm run assets -- --list-models      list models this API key can use
 *   npm run assets -- --index            only rebuild public/assets/assets.json
 *   npm run assets -- --rekey            redo the cut-out/resize from saved originals (no API calls)
 *
 * Reads GEMINI_API_KEY from .env. Writes to public/assets/{images,audio}/ and
 * rebuilds public/assets/assets.json, which the game reads at startup. Any
 * PNG/WAV/MP3/OGG you drop into those folders by hand (kids' drawings!) is
 * picked up the same way, as long as it's named after a texture key.
 */
import 'dotenv/config';
import { GoogleGenAI } from '@google/genai';
import sharp from 'sharp';
import { existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { unlink } from 'node:fs/promises';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const IMG_DIR = path.join(ROOT, 'public/assets/images');
const AUDIO_DIR = path.join(ROOT, 'public/assets/audio');
const INDEX = path.join(ROOT, 'public/assets/assets.json');

const MODELS = {
  image: process.env.GEMINI_IMAGE_MODEL || 'gemini-3-pro-image',
  tts: process.env.GEMINI_TTS_MODEL || 'gemini-3.8-flash-tts',
  music: process.env.GEMINI_MUSIC_MODEL || 'lyria-3.5',
  /** Listens to each voice clip to make sure only the line was spoken. */
  check: process.env.GEMINI_CHECK_MODEL || 'gemini-2.5-flash',
};

// ------------------------------------------------------------------ cli

const args = process.argv.slice(2);
const flag = (name) => args.includes(`--${name}`);
const opt = (name) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
};
const only = opt('only')?.split(',').map((s) => s.trim()).filter(Boolean);
const kind = opt('kind');
const force = flag('force');
const dryRun = flag('dry-run');

const wanted = (id, k) => {
  if (kind && kind !== k) return false;
  if (!only) return true;
  return only.some((p) => (p.endsWith('*') ? id.startsWith(p.slice(0, -1)) : id === p));
};

// ------------------------------------------------------------------ helpers

let ai;
function client() {
  if (ai) return ai;
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'your-key-here') {
    console.error('Missing GEMINI_API_KEY. Copy .env.example to .env and paste your key.');
    process.exit(1);
  }
  ai = new GoogleGenAI({ apiKey });
  return ai;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function withRetry(label, fn, tries = 4) {
  for (let i = 1; ; i++) {
    try {
      return await fn();
    } catch (e) {
      const msg = String(e?.message ?? e);
      const retryable = /429|500|503|RESOURCE_EXHAUSTED|UNAVAILABLE|overloaded|deadline|fetch failed|ECONNRESET|ETIMEDOUT|socket/i.test(msg);
      if (!retryable || i >= tries) throw e;
      const wait = 2000 * 2 ** i;
      console.warn(`  ${label}: busy, retrying in ${wait / 1000}s (${msg.slice(0, 80)})`);
      await sleep(wait);
    }
  }
}

function inlineParts(res) {
  return (res?.candidates ?? []).flatMap((c) => c?.content?.parts ?? []).filter((p) => p.inlineData?.data);
}

function closestAspect(w, h) {
  const options = { '1:1': 1, '4:3': 4 / 3, '3:4': 3 / 4, '3:2': 3 / 2, '2:3': 2 / 3, '16:9': 16 / 9, '9:16': 9 / 16, '5:4': 5 / 4, '4:5': 4 / 5, '21:9': 21 / 9 };
  const r = w / h;
  return Object.entries(options).sort((a, b) => Math.abs(Math.log(a[1] / r)) - Math.abs(Math.log(b[1] / r)))[0][0];
}

/**
 * Turn the magenta backdrop transparent, with soft edges and the pink fringe
 * removed, then trim and fit into exactly w×h. The model doesn't always use
 * pure #FF00FF, so the backdrop color is read from the image corners.
 */
async function keyOutMagenta(buf, w, h) {
  const { data, info } = await sharp(buf).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const W = info.width, H = info.height;
  const samples = [];
  for (const [x, y] of [[2, 2], [W - 3, 2], [2, H - 3], [W - 3, H - 3], [W >> 1, 2], [2, H >> 1]]) {
    const i = (y * W + x) * 4;
    samples.push([data[i], data[i + 1], data[i + 2]]);
  }
  const magentaish = ([r, g, b]) => Math.min(r, b) - g > 60;
  const bgs = samples.filter(magentaish);
  const bg = bgs.length ? [0, 1, 2].map((c) => bgs.map((s) => s[c]).sort((a, b) => a - b)[bgs.length >> 1]) : [255, 0, 255];
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i], g = data[i + 1], b = data[i + 2];
    // Close to the backdrop color, or strongly magenta: see-through.
    const d = Math.hypot(r - bg[0], g - bg[1], b - bg[2]);
    const m = Math.min(r, b) - g;
    let a = 1;
    if (d < 55 || m > 160) a = 0;
    else if (d < 110 && m > 50) a = (d - 55) / 55;
    else if (m > 90) a = 1 - (m - 90) / 70;
    if (a < 1) {
      data[i + 3] = Math.round(data[i + 3] * a);
      // Despill: pull the leftover magenta tint out of edge pixels.
      const cap = Math.max(g, Math.round((r + b) / 2 - Math.max(0, m - 40)));
      data[i] = Math.min(r, cap);
      data[i + 2] = Math.min(b, cap);
    }
  }
  return sharp(data, { raw: info })
    .trim({ threshold: 1 })
    .resize(w, h, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 }, kernel: 'lanczos3' })
    .png()
    .toBuffer();
}

function pcmToWav(pcm, rate = 24000, channels = 1, bits = 16) {
  const header = Buffer.alloc(44);
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + pcm.length, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(channels, 22);
  header.writeUInt32LE(rate, 24);
  header.writeUInt32LE((rate * channels * bits) / 8, 28);
  header.writeUInt16LE((channels * bits) / 8, 32);
  header.writeUInt16LE(bits, 34);
  header.write('data', 36);
  header.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([header, pcm]);
}

/** Trim silence off both ends of a 16-bit mono WAV, keeping a short natural pad. */
function trimWav(buf) {
  let off = 12, fmt, data;
  while (off + 8 <= buf.length) {
    const id = buf.toString('ascii', off, off + 4);
    const size = buf.readUInt32LE(off + 4);
    if (id === 'fmt ') fmt = { channels: buf.readUInt16LE(off + 10), rate: buf.readUInt32LE(off + 12), bits: buf.readUInt16LE(off + 22) };
    if (id === 'data') data = buf.subarray(off + 8, off + 8 + size);
    off += 8 + size + (size % 2);
  }
  if (!fmt || !data || fmt.bits !== 16 || fmt.channels !== 1) return buf;
  const n = data.length / 2;
  const win = Math.floor(fmt.rate / 50);
  const loud = (i) => {
    let sum = 0;
    for (let k = i; k < Math.min(n, i + win); k++) sum += Math.abs(data.readInt16LE(k * 2));
    return sum / win > 300;
  };
  let start = 0, end = n;
  while (start < n && !loud(start)) start += win;
  while (end > start && !loud(Math.max(0, end - win))) end -= win;
  const pad = Math.floor(fmt.rate * 0.15);
  start = Math.max(0, start - pad);
  end = Math.min(n, end + pad);
  return pcmToWav(Buffer.from(data.subarray(start * 2, end * 2)), fmt.rate);
}

const AUDIO_EXT = { 'audio/mpeg': 'mp3', 'audio/mp3': 'mp3', 'audio/wav': 'wav', 'audio/x-wav': 'wav', 'audio/ogg': 'ogg' };

// ------------------------------------------------------------------ generators

async function generateImageOnce(asset, manifest) {
  const parts = [];
  if (asset.ref) {
    const refPath = path.join(IMG_DIR, `${asset.ref}.png`);
    if (!existsSync(refPath)) throw new Error(`needs ${asset.ref}.png first (run it with --only ${asset.ref})`);
    // Flatten the reference onto magenta so the model keeps the same backdrop.
    const ref = await sharp(refPath).flatten({ background: '#ff00ff' }).png().toBuffer();
    parts.push({ inlineData: { mimeType: 'image/png', data: ref.toString('base64') } });
  }
  const rules = manifest.rules[asset.kind] ?? manifest.rules.backdrop;
  // Assets can pick a named style (e.g. the grittier Fury Road look); the default keeps Season 1 consistent.
  const style = (asset.style && manifest.styles?.[asset.style]) || manifest.style;
  parts.push({ text: `${asset.prompt}\n\nStyle: ${style}\n\n${rules}` });

  const res = await withRetry(asset.id, () =>
    client().models.generateContent({
      model: MODELS.image,
      contents: [{ role: 'user', parts }],
      config: { responseModalities: ['IMAGE'], imageConfig: { aspectRatio: closestAspect(asset.w, asset.h) } },
    }),
  );
  const img = inlineParts(res)[0];
  if (!img) throw new Error(`no image returned${res?.promptFeedback?.blockReason ? ` (blocked: ${res.promptFeedback.blockReason})` : ''}`);
  const raw = Buffer.from(img.inlineData.data, 'base64');
  // Keep the untouched original too, in case the magenta keying needs tweaking later.
  await mkdir(path.join(ROOT, 'tools/assets/raw'), { recursive: true });
  await writeFile(path.join(ROOT, 'tools/assets/raw', `${asset.id}.png`), raw);

  await processImage(asset, raw);
}

/** Did the cut-out work? If the corners are still solid, the model ignored the magenta backdrop. */
async function cutOutOk(asset) {
  if (asset.kind !== 'sprite') return true;
  const { data, info } = await sharp(imagePath(asset)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const a = (x, y) => data[(y * info.width + x) * 4 + 3];
  const w = info.width - 1, h = info.height - 1;
  return [a(0, 0), a(w, 0), a(0, h), a(w, h)].filter((v) => v > 200).length < 2;
}

async function generateImage(asset, manifest) {
  for (let attempt = 1; attempt <= 3; attempt++) {
    await generateImageOnce(asset, manifest);
    if (await cutOutOk(asset)) return;
    console.warn(`\n  ${asset.id}: background wasn't magenta, trying again (${attempt}/3)`);
  }
  throw new Error('kept getting a non-magenta background (the image was saved anyway)');
}

/**
 * Make a texture tile without visible seams: blend it with a copy of itself
 * shifted by half, weighted so the shifted copy (which wraps cleanly) wins at
 * the edges and the original wins in the middle.
 */
async function makeSeamless(buf, w, h) {
  const { data, info } = await sharp(buf).resize(w, h, { fit: 'cover' }).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const ch = info.channels;
  const out = Buffer.alloc(data.length);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const wx = 1 - Math.abs((x + 0.5) / w - 0.5) * 2;
      const wy = 1 - Math.abs((y + 0.5) / h - 0.5) * 2;
      const t = Math.min(1, Math.min(wx, wy) * 2.2);
      const i = (y * w + x) * ch;
      const j = (((y + h / 2) % h) * w + ((x + w / 2) % w)) * ch;
      for (let c = 0; c < ch; c++) out[i + c] = Math.round(data[i + c] * t + data[j + c] * (1 - t));
    }
  }
  return sharp(out, { raw: { width: w, height: h, channels: ch } }).png().toBuffer();
}

/** Backdrops are big paintings, so they're saved as JPEG to load fast. Everything else is PNG. */
const imagePath = (asset) => path.join(IMG_DIR, `${asset.id}.${asset.kind === 'backdrop' ? 'jpg' : 'png'}`);

async function processImage(asset, raw) {
  const out = asset.kind === 'sprite'
    ? await keyOutMagenta(raw, asset.w, asset.h)
    : asset.kind === 'texture'
      ? await makeSeamless(raw, asset.w, asset.h)
      : await sharp(raw).resize(asset.w, asset.h, { fit: 'cover' }).jpeg({ quality: 86, mozjpeg: true }).toBuffer();
  await writeFile(imagePath(asset), out);
}

const words = (t) => t.toLowerCase().replace(/[^a-z0-9' ]+/g, ' ').split(/\s+/).filter(Boolean);

/**
 * How many spoken words aren't in the line. The TTS model sometimes reads
 * its style notes out loud ("Say like a silly dinosaur..."), which shows up
 * here as extra words. A word or two of slack covers "rawr" vs "rarr".
 */
async function extraWords(wav, line) {
  const res = await withRetry('check', () =>
    client().models.generateContent({
      model: MODELS.check,
      contents: [{ role: 'user', parts: [
        { inlineData: { mimeType: 'audio/wav', data: wav.toString('base64') } },
        { text: 'Transcribe exactly every word spoken in this audio. Output only the words.' },
      ] }],
    }),
  );
  const heard = res.text ?? '';
  const expected = new Set(words(line));
  let extra = words(heard).filter((w) => !expected.has(w)).length;
  // Words from the style notes are a sure sign they were read out.
  if (/director|notes|style|transcript/i.test(heard) && !/director|notes|style|transcript/i.test(line)) extra += 10;
  return { extra, heard };
}

async function speakOnce(text, voice, style) {
  // Style goes in separate notes, never glued onto the line, or it gets read aloud.
  const prompt = style ? `### DIRECTOR'S NOTES\nStyle: ${style}.\n\n### TRANSCRIPT\n${text}` : text;
  const res = await withRetry('voice', () =>
    client().models.generateContent({
      model: MODELS.tts,
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      config: {
        responseModalities: ['AUDIO'],
        speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: voice } } },
      },
    }),
  );
  const a = inlineParts(res)[0];
  if (!a) throw new Error('no audio returned');
  const data = Buffer.from(a.inlineData.data, 'base64');
  const mime = a.inlineData.mimeType ?? '';
  const rate = Number(/rate=(\d+)/.exec(mime)?.[1] ?? 24000);
  return trimWav(/L16|pcm/i.test(mime) || !mime ? pcmToWav(data, rate) : data);
}

async function generateVoice(id, line, manifest) {
  const v = manifest.voices[line.speaker] ?? manifest.voices.announcer;
  // A few tries in character, then plain (no style) as a last resort.
  const attempts = [v.style, v.style, v.style, v.style, null, null];
  let wav, last = '';
  for (const style of attempts) {
    const clip = await speakOnce(line.text, v.voice, style);
    const { extra, heard } = await extraWords(clip, line.text);
    if (extra <= 2) { wav = clip; break; }
    last = heard;
    console.warn(`\n  ${id}: heard extra words, retrying ("${heard.slice(0, 90)}")`);
  }
  if (!wav) throw new Error(`every take had extra words (last: "${last.slice(0, 120)}")`);
  const wavPath = path.join(AUDIO_DIR, `vo-${id}.wav`);
  await writeFile(wavPath, wav);
  // Voice clips are much smaller as MP3 (matters for the web build). Keep the WAV if ffmpeg isn't installed.
  const mp3 = spawnSync('ffmpeg', ['-loglevel', 'error', '-y', '-i', wavPath, '-ac', '1', '-b:a', '64k', wavPath.replace(/\.wav$/, '.mp3')]);
  if (mp3.status === 0) await unlink(wavPath);
}

async function generateMusic(track) {
  const res = await withRetry(track.id, () =>
    client().models.generateContent({
      model: MODELS.music,
      contents: [{ role: 'user', parts: [{ text: track.prompt }] }],
      config: { responseModalities: ['AUDIO'] },
    }),
  );
  const a = inlineParts(res)[0];
  if (!a) throw new Error('no audio returned');
  const mime = (a.inlineData.mimeType ?? 'audio/wav').split(';')[0];
  const data = Buffer.from(a.inlineData.data, 'base64');
  const ext = AUDIO_EXT[mime] ?? 'wav';
  await writeFile(path.join(AUDIO_DIR, `${track.id}.${ext}`), ext === 'wav' && /L16|pcm/i.test(a.inlineData.mimeType) ? pcmToWav(data) : data);
}

// ------------------------------------------------------------------ index

async function writeIndex() {
  const list = async (dir, exts) =>
    (existsSync(dir) ? await readdir(dir) : [])
      .filter((f) => exts.includes(path.extname(f).toLowerCase()))
      .sort()
      .map((f) => ({ key: path.basename(f, path.extname(f)), url: `assets/${path.basename(dir)}/${f}` }));
  const index = {
    images: await list(IMG_DIR, ['.png', '.jpg', '.jpeg', '.webp']),
    audio: await list(AUDIO_DIR, ['.wav', '.mp3', '.ogg']),
  };
  await writeFile(INDEX, JSON.stringify(index, null, 2) + '\n');
  console.log(`assets.json: ${index.images.length} images, ${index.audio.length} sounds`);
}

// ------------------------------------------------------------------ main

async function main() {
  await mkdir(IMG_DIR, { recursive: true });
  await mkdir(AUDIO_DIR, { recursive: true });

  if (flag('list-models')) {
    const pager = await client().models.list();
    for await (const m of pager) {
      if (/image|tts|lyria|imagen|audio/i.test(m.name)) console.log(m.name.replace('models/', ''), '-', m.displayName ?? '');
    }
    return;
  }
  if (flag('index')) return writeIndex();

  const manifest = JSON.parse(await readFile(path.join(ROOT, 'tools/assets/manifest.json'), 'utf8'));
  const dialogue = JSON.parse(await readFile(path.join(ROOT, 'src/data/dialogue.json'), 'utf8'));

  if (flag('rekey')) {
    // Re-run cut-out and resize on the saved originals. No API calls.
    for (const a of manifest.images) {
      const rawPath = path.join(ROOT, 'tools/assets/raw', `${a.id}.png`);
      if (wanted(a.id, 'images') && existsSync(rawPath)) {
        await processImage(a, await readFile(rawPath));
        console.log('rekeyed', a.id);
      }
    }
    return writeIndex();
  }

  const jobs = [];
  for (const a of manifest.images)
    if (wanted(a.id, 'images') && (force || !existsSync(imagePath(a))))
      jobs.push({ label: a.id, kind: 'image', run: () => generateImage(a, manifest) });
  for (const [id, line] of Object.entries(dialogue))
    if (wanted(`vo-${id}`, 'voice') && (force || !['wav', 'mp3'].some((e) => existsSync(path.join(AUDIO_DIR, `vo-${id}.${e}`)))))
      jobs.push({ label: `vo-${id}`, kind: 'voice', run: () => generateVoice(id, line, manifest) });
  for (const t of manifest.music)
    if (wanted(t.id, 'music') && (force || !['wav', 'mp3', 'ogg'].some((e) => existsSync(path.join(AUDIO_DIR, `${t.id}.${e}`)))))
      jobs.push({ label: t.id, kind: 'music', run: () => generateMusic(t) });

  if (!jobs.length) {
    console.log('Nothing to generate (everything already exists, use --force to redo).');
    return writeIndex();
  }
  console.log(`Models: image=${MODELS.image} tts=${MODELS.tts} music=${MODELS.music}`);
  console.log(`${jobs.length} to generate: ${jobs.map((j) => j.label).join(', ')}`);
  if (dryRun) return;

  const failed = [];
  for (const [i, job] of jobs.entries()) {
    process.stdout.write(`[${i + 1}/${jobs.length}] ${job.label} ... `);
    try {
      await job.run();
      console.log('ok');
    } catch (e) {
      console.log('FAILED');
      console.warn(`  ${String(e?.message ?? e).slice(0, 300)}`);
      failed.push(job.label);
    }
  }
  await writeIndex();
  if (failed.length) {
    console.log(`\n${failed.length} failed (the game keeps using placeholders for these): ${failed.join(', ')}`);
    process.exitCode = 1;
  }
}

main();
