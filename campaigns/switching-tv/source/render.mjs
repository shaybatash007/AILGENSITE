// Render reel.html frame by frame and encode with ffmpeg.
//   node render.mjs --w 1080 --h 1920 --out ../video/reel.mp4 [--audio work/track.wav] [--jobs 3]
//   node render.mjs --w 1080 --h 1920 --frames 1.2,3.7,5 --dir work/review     (stills for review)
import { createRequire } from 'module';
import { spawn } from 'child_process';
import http from 'http';
import fs from 'fs';
import path from 'path';
import os from 'os';
const require = createRequire('/opt/node22/lib/node_modules/');
const { chromium } = require('playwright');

const args = Object.fromEntries(process.argv.slice(2).reduce((a, v, i, arr) => (v.startsWith('--') && a.push([v.slice(2), arr[i + 1]]), a), []));
const W = +(args.w || 1080), H = +(args.h || 1920), FPS = 30;
const ROOT = path.dirname(new URL(import.meta.url).pathname);
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.jpg': 'image/jpeg', '.png': 'image/png', '.svg': 'image/svg+xml', '.woff2': 'font/woff2' };
const server = http.createServer((req, res) => {
  const p = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
  if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'content-type': TYPES[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(res);
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const URL_ = `http://127.0.0.1:${server.address().port}/reel.html?w=${W}&h=${H}`;
const browser = await chromium.launch({ args: ['--disable-gpu-vsync', '--force-color-profile=srgb'] });

async function openPage(br = browser) {
  const page = await br.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
  page.on('pageerror', e => console.error('PAGE ERROR', String(e)));
  page.on('console', m => { if (m.type() === 'error') console.error('console:', m.text()); });
  await page.goto(URL_);
  await page.evaluate(() => window.READY);
  return page;
}
async function frame(page, t) {
  await page.evaluate(t => window.render(t), t);
  return page.screenshot({ type: 'png', animations: 'disabled', caret: 'initial' });
}

if (args.still) {
  const dir = path.resolve(args.dir || '../static'); fs.mkdirSync(dir, { recursive: true });
  const page = await openPage();
  for (const n of args.still.split(',')) { await page.evaluate(n => window.drawStill(n), n); fs.writeFileSync(`${dir}/${n}.png`, await page.screenshot({ type: 'png' })); console.log('still', n); }
} else if (args.frames) {
  const dir = path.resolve(args.dir || 'work/review'); fs.mkdirSync(dir, { recursive: true });
  const page = await openPage();
  for (const t of args.frames.split(',').map(Number)) {
    const t0 = Date.now(); fs.writeFileSync(`${dir}/f_${String(t.toFixed(2)).padStart(6, '0')}.png`, await frame(page, t));
    console.log('frame', t, Date.now() - t0, 'ms');
  }
} else {
  const DUR = await (async () => { const p = await openPage(); const d = await p.evaluate(() => window.META.DUR); await p.close(); return d; })();
  const N = Math.round((+args.dur || DUR) * FPS), jobs = +(args.jobs || Math.max(1, Math.min(4, os.cpus().length - 1)));
  const tmp = path.resolve(args.tmp || 'work/parts'); fs.mkdirSync(tmp, { recursive: true });
  // render in parallel chunks, each encoded losslessly-ish, then concatenate
  const chunks = Array.from({ length: jobs }, (_, j) => [Math.floor(N * j / jobs), Math.floor(N * (j + 1) / jobs)]);
  const t0 = Date.now();
  await Promise.all(chunks.map(async ([a, b], j) => {
    // one browser per job: screenshot PNG encoding runs in the browser process, so a shared browser is single-threaded
    const own = await chromium.launch({ args: ['--disable-gpu-vsync', '--force-color-profile=srgb'] });
    const page = await openPage(own);
    const ff = spawn('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'png', '-i', '-',
      '-c:v', 'libx264', '-preset', 'medium', '-crf', '10', '-pix_fmt', 'yuv444p', `${tmp}/part${j}.mkv`], { stdio: ['pipe', 'inherit', 'inherit'] });
    for (let i = a; i < b; i++) {
      const buf = await frame(page, i / FPS);
      if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r));
      if ((i - a) % 60 === 0) console.log(`job ${j}: frame ${i}/${b} (${((Date.now() - t0) / 1000).toFixed(0)}s)`);
    }
    ff.stdin.end(); await new Promise(r => ff.on('close', r)); await page.close(); await own.close();
  }));
  fs.writeFileSync(`${tmp}/list.txt`, chunks.map((_, j) => `file 'part${j}.mkv'`).join('\n'));
  const out = path.resolve(args.out || '../video/reel.mp4'); fs.mkdirSync(path.dirname(out), { recursive: true });
  const enc = ['-hide_banner', '-loglevel', 'error', '-y', '-f', 'concat', '-safe', '0', '-i', `${tmp}/list.txt`];
  if (args.audio) enc.push('-i', path.resolve(args.audio));
  enc.push('-map', '0:v:0');
  if (args.audio) enc.push('-map', '1:a:0', '-c:a', 'aac', '-b:a', '256k', '-ar', '48000');
  enc.push('-c:v', 'libx264', '-preset', 'slow', '-crf', String(args.crf || 17), '-profile:v', 'high', '-level', '4.2', '-pix_fmt', 'yuv420p',
    '-color_primaries', 'bt709', '-color_trc', 'bt709', '-colorspace', 'bt709', '-r', String(FPS), '-g', String(FPS * 2), '-movflags', '+faststart', '-shortest', out);
  await new Promise((res, rej) => spawn('ffmpeg', enc, { stdio: 'inherit' }).on('close', c => c ? rej(new Error('ffmpeg ' + c)) : res()));
  console.log('wrote', out, ((Date.now() - t0) / 1000).toFixed(0) + 's');
}
await browser.close(); server.close();
