#!/usr/bin/env node
// The free visual layer: render code-native imagery (WebGL shaders, Three.js scenes, canvas, SVG) to stills and films.
//   node glrender.mjs --page visual/free/atelier.html --out visual/free/out/atelier --still 1120x1120,1600x900 [--t 2.5]
//   node glrender.mjs --page visual/free/ribbon.html --out visual/free/out/ribbon --film 1280x548 --seconds 8 --fps 24
// A page exposes window.frame(t, w, h) (async allowed) that draws time t (seconds) into a canvas of w×h and resolves when
// the pixels are ready (resize the canvas only when the size changes: a resize clears the buffer, and a capture can
// catch it half drawn; resolve after two animation frames); it may read window.PARAMS (JSON from --params). Stills are PNG (and WebP beside them); a film is
// PNG frames encoded with ffmpeg to H.264 (yuv420p, +faststart) with a poster. Headless Chromium renders WebGL through
// SwiftShader: slower than a GPU, identical pixels on every machine. Everything here is free and runs offline except
// libraries loaded from a CDN by the page itself.
import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';
import { pathToFileURL } from 'url';
import { parseArgs, repoRoot, loadPlaywright, routeThroughNode, ensureProxyEnv } from './lib.mjs';
if (ensureProxyEnv()) process.exit(0);
const a = parseArgs(), ROOT = repoRoot();
if (!a.page || !a.out) { console.error('usage: node glrender.mjs --page <file.html> --out <dir/base> (--still WxH ... | --film WxH --seconds s [--fps 24]) [--t s] [--params json]'); process.exit(2); }
const page = path.resolve(ROOT, a.page), out = path.resolve(ROOT, a.out); fs.mkdirSync(path.dirname(out), { recursive: true });
const list = v => (Array.isArray(v) ? v : v ? String(v).split(',') : []);
const b = await loadPlaywright().chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
async function open(w, h) {
  const ctx = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
  if (process.env.HTTPS_PROXY) await routeThroughNode(ctx);   // behind a TLS-inspecting proxy the browser fetches through Node (TLS stays verified)
  const pg = await ctx.newPage();
  pg.on('pageerror', e => console.error('page error:', e.message)); pg.on('console', m => m.type() === 'error' && console.error('console:', m.text()));
  await pg.addInitScript(p => { window.PARAMS = p; }, a.params ? JSON.parse(a.params) : {});
  await pg.goto(pathToFileURL(page).href, { waitUntil: 'load' });
  await pg.waitForFunction(() => typeof window.frame === 'function', null, { timeout: 60000 });
  return pg;
}
const shot = async (pg, w, h, t, file) => { await pg.evaluate(([t, w, h]) => window.frame(t, w, h), [t, w, h]); await pg.screenshot({ path: file, clip: { x: 0, y: 0, width: w, height: h } }); };
try {
  for (const s of list(a.still)) {
    const [w, h] = String(s).split('x').map(Number), pg = await open(w, h), file = `${out}-${w}x${h}.png`;
    await shot(pg, w, h, +(a.t || 0), file); await pg.close();
    spawnSync('python3', ['-c', 'import sys\nfrom PIL import Image\nImage.open(sys.argv[1]).convert("RGB").save(sys.argv[2], "WEBP", quality=86, method=6)', file, file.replace(/\.png$/, '.webp')]);
    console.log('still', path.relative(ROOT, file));
  }
  if (a.film) {
    const [w, h] = String(a.film).split('x').map(Number), fps = +(a.fps || 24), n = Math.round(+(a.seconds || 8) * fps);
    const dir = `${out}-frames`; fs.rmSync(dir, { recursive: true, force: true }); fs.mkdirSync(dir, { recursive: true });
    const pg = await open(w, h), t0 = Date.now();
    for (let i = 0; i < n; i++) { await shot(pg, w, h, i / fps, path.join(dir, `f${String(i).padStart(4, '0')}.png`)); if (i % 24 === 0) process.stdout.write(`\r  frame ${i}/${n}`); }
    await pg.close();
    const mp4 = `${out}.mp4`;
    const r = spawnSync('ffmpeg', ['-y', '-v', 'error', '-framerate', String(fps), '-i', path.join(dir, 'f%04d.png'), '-c:v', 'libx264', '-preset', 'slow', '-crf', '20', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', mp4]);
    if (r.status) { console.error(r.stderr.toString()); process.exit(1); }
    fs.copyFileSync(path.join(dir, `f${String(n - 1).padStart(4, '0')}.png`), `${out}-poster.png`);
    fs.rmSync(dir, { recursive: true, force: true });
    console.log(`\nfilm ${path.relative(ROOT, mp4)} · ${n} frames in ${((Date.now() - t0) / 1000).toFixed(0)} s`);
  }
} finally { await b.close(); }
