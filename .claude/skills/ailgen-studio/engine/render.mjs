#!/usr/bin/env node
// Render a project's brand film (film.json) to MP4, stills or review frames.
//   node render.mjs --project projects/acme                         9:16 film  -> projects/acme/out/film-1080x1920.mp4
//   node render.mjs --project projects/acme --w 1080 --h 1350        4:5 feed version
//   node render.mjs --project projects/acme --audio auto              + synthesized soundtrack (audio.py, mood from film.json)
//   node render.mjs --project projects/acme --stills                  every still in film.json -> out/stills/<name>.png
//   node render.mjs --project projects/acme --frames 1.2,4,9.5        review frames -> out/review/
//   options: --jobs 3  --crf 18  --scale .5 (quick preview)  --out file.mp4
import { fileURLToPath } from 'url';
import { loudnormFilter } from './loudness.mjs';
import { spawn, spawnSync } from 'child_process';
import http from 'http';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { loadPlaywright, parseArgs, repoRoot } from '../scripts/lib.mjs';

const args = parseArgs();
if (!args.project) { console.error('usage: node render.mjs --project projects/<slug> [--w 1080 --h 1920] [--audio auto|file.wav] [--stills] [--frames 1,2]'); process.exit(2); }
const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = repoRoot(path.resolve(args.project));
const PROJ = path.resolve(args.project);
const CFG = JSON.parse(fs.readFileSync(path.join(PROJ, 'film.json'), 'utf8'));
const SCALE = +(args.scale || 1);
const W = Math.round(+(args.w || 1080) * SCALE / 2) * 2, H = Math.round(+(args.h || 1920) * SCALE / 2) * 2;
const FPS = +(args.fps || CFG.fps || 30);
const OUT = path.join(PROJ, 'out');
fs.mkdirSync(OUT, { recursive: true });
const rel = p => '/' + path.relative(ROOT, p).split(path.sep).join('/');
const { chromium } = loadPlaywright();

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.woff2': 'font/woff2' };
const server = http.createServer((req, res) => {
  const p = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
  if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'content-type': TYPES[path.extname(p).toLowerCase()] || 'application/octet-stream' }); fs.createReadStream(p).pipe(res);
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const pageUrl = (w, h) => `http://127.0.0.1:${server.address().port}${rel(path.join(HERE, 'film.html'))}?p=${rel(PROJ)}/&w=${w}&h=${h}`;
const LAUNCH = { args: ['--disable-gpu-vsync', '--force-color-profile=srgb'] };

/** Open the engine in its own page and wait until fonts, images and config are ready. */
async function openPage(browser, w = W, h = H) {
  const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
  const errors = [];
  page.on('pageerror', e => { errors.push(String(e)); console.error('PAGE ERROR', String(e)); });
  page.on('console', m => { if (m.type() === 'error') console.error('console:', m.text()); });
  await page.goto(pageUrl(w, h));
  await page.evaluate(() => window.READY);
  if (errors.length) throw new Error('the film page failed to load: ' + errors[0]);
  return page;
}
const frame = async (page, t) => { await page.evaluate(t => window.render(t), t); return page.screenshot({ type: 'png', animations: 'disabled', caret: 'initial' }); };

const browser = await chromium.launch(LAUNCH);
try {
  const first = await openPage(browser);
  const META = await first.evaluate(() => window.META);
  fs.writeFileSync(path.join(OUT, 'cues.json'), JSON.stringify({ dur: META.DUR, cues: META.CUES }, null, 1));
  await first.close();
  console.log(`film "${CFG.name || path.basename(PROJ)}": ${META.DUR.toFixed(2)}s, ${META.CUES.length} cues -> out/cues.json`);

  if (args.stills) {
    const dir = path.join(OUT, 'stills'); fs.mkdirSync(dir, { recursive: true });
    for (const s of CFG.stills || []) {
      const p = await openPage(browser, s.w, s.h);
      await p.evaluate(n => window.drawStill(n), s.name);
      fs.writeFileSync(path.join(dir, s.name + '.png'), await p.screenshot({ type: 'png' }));
      await p.close(); console.log('still', s.name, `${s.w}x${s.h}`);
    }
  } else if (args.frames) {
    const dir = path.join(OUT, 'review'); fs.mkdirSync(dir, { recursive: true });
    const p = await openPage(browser);
    for (const t of String(args.frames).split(',').map(Number)) {
      const f = path.join(dir, `f_${W}x${H}_${t.toFixed(2).padStart(6, '0')}.png`); fs.writeFileSync(f, await frame(p, t)); console.log('frame', t, f);
    }
  } else {
    let audio = args.audio;
    if (audio === 'auto') {
      audio = path.join(OUT, 'soundtrack.wav');
      const r = spawnSync((process.env.PYTHON || (process.platform === 'win32' ? 'python' : 'python3')), [path.join(HERE, 'audio.py'), '--cues', path.join(OUT, 'cues.json'), '--film', path.join(PROJ, 'film.json'), '--out', audio], { stdio: 'inherit' });
      if (r.status !== 0) throw new Error('audio.py failed');
    }
    const N = Math.round((+args.dur || META.DUR) * FPS), jobs = +(args.jobs || Math.max(1, Math.min(4, os.cpus().length - 1)));
    const tmp = path.join(OUT, 'parts'); fs.mkdirSync(tmp, { recursive: true });
    const chunks = Array.from({ length: jobs }, (_, j) => [Math.floor(N * j / jobs), Math.floor(N * (j + 1) / jobs)]);
    const t0 = Date.now();
    await Promise.all(chunks.map(async ([a, b], j) => {
      // one browser per job: PNG encoding runs in the browser process, so a shared browser is single-threaded
      const own = await chromium.launch(LAUNCH), page = await openPage(own);
      const ff = spawn('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'png', '-i', '-',
        '-c:v', 'libx264', '-preset', 'medium', '-crf', '10', '-pix_fmt', 'yuv444p', `${tmp}/part${j}.mkv`], { stdio: ['pipe', 'inherit', 'inherit'] });
      for (let i = a; i < b; i++) {
        const buf = await frame(page, i / FPS);
        if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r));
        if ((i - a) % 90 === 0) console.log(`job ${j}: frame ${i}/${b} (${((Date.now() - t0) / 1000).toFixed(0)}s)`);
      }
      ff.stdin.end(); await new Promise(r => ff.on('close', r)); await page.close(); await own.close();
    }));
    fs.writeFileSync(`${tmp}/list.txt`, chunks.map((_, j) => `file 'part${j}.mkv'`).join('\n'));
    const out = path.resolve(args.out || path.join(OUT, `film-${W}x${H}.mp4`));
    const enc = ['-hide_banner', '-loglevel', 'error', '-y', '-f', 'concat', '-safe', '0', '-i', `${tmp}/list.txt`];
    if (audio) enc.push('-i', path.resolve(audio));
    enc.push('-map', '0:v:0');
    if (audio) enc.push('-map', '1:a:0', '-af', await loudnormFilter(path.resolve(audio)), '-c:a', 'aac', '-b:a', '256k', '-ar', '48000');
    enc.push('-c:v', 'libx264', '-preset', 'slow', '-crf', String(args.crf || 18), '-profile:v', 'high', '-pix_fmt', 'yuv420p',
      '-color_primaries', 'bt709', '-color_trc', 'bt709', '-colorspace', 'bt709', '-r', String(FPS), '-g', String(FPS * 2), '-movflags', '+faststart', '-shortest', out);
    await new Promise((res, rej) => spawn('ffmpeg', enc, { stdio: 'inherit' }).on('close', c => c ? rej(new Error('ffmpeg exited ' + c)) : res()));
    fs.rmSync(tmp, { recursive: true, force: true });
    console.log('wrote', out, ((Date.now() - t0) / 1000).toFixed(0) + 's');
  }
} finally {
  await browser.close(); server.close();
}
