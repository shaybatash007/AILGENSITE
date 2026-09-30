#!/usr/bin/env node
// Film a live site frame by frame on a virtual clock: smooth 30 fps footage of WebGL, canvas and CSS motion even where the
// machine renders slowly (headless Chromium draws WebGL on the CPU). The page's clock (performance.now, Date.now,
// requestAnimationFrame) and every CSS animation and transition advance exactly one frame per capture, so what is filmed is
// what a visitor with a GPU sees in real time. A shot list drives the camera: scroll targets and pointer paths.
//   node film-site.mjs --url http://127.0.0.1:8131/ --shots projects/<slug>/qa/film-shots.mjs --out projects/<slug>/out/site-film [--w 1280 --h 720 --fps 30]
// The shots module exports default [{ dur: s, scrollTo?: '#sel' | y, px?: 0, frac?: 0..1, pointer?: [[x,y],...] }, ...]
// and optionally `init` (a string of JS run before the page's own scripts, e.g. flags that force the WebGL path).
import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';
import { pathToFileURL } from 'url';
import { parseArgs, repoRoot, loadPlaywright } from './lib.mjs';
const a = parseArgs(), ROOT = repoRoot();
if (!a.url || !a.shots || !a.out) { console.error('usage: node film-site.mjs --url <page> --shots <shots.mjs> --out <dir/base> [--w 1280 --h 720 --fps 30]'); process.exit(2); }
const W = +(a.w || 1280), H = +(a.h || 720), FPS = +(a.fps || 30), out = path.resolve(ROOT, a.out);
const mod = await import(pathToFileURL(path.resolve(ROOT, a.shots)).href), shots = mod.default;
const frames = out + '_frames'; fs.rmSync(frames, { recursive: true, force: true }); fs.mkdirSync(frames, { recursive: true });
const CLOCK = `(()=>{let VT=0;const q=[];const rn=performance.now.bind(performance);const d0=Date.now();
 performance.now=()=>VT; Date.now=()=>d0+VT;
 window.requestAnimationFrame=cb=>{q.push(cb);return q.length;}; window.cancelAnimationFrame=()=>{};
 window.__vt=()=>VT;
 window.__step=dt=>{VT+=dt; const cbs=q.splice(0); cbs.forEach(cb=>{try{cb(VT);}catch(e){console.error(e);}});
  for(const an of document.getAnimations()){ if(an.__v0===undefined){an.__v0=VT-dt;try{an.pause();}catch(_){}} try{an.currentTime=VT-an.__v0;}catch(_){} } };
})();`;
const b = await loadPlaywright().chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const ctx = await b.newContext({ locale: 'he-IL', viewport: { width: W, height: H }, deviceScaleFactor: +(a.scale || 1) });
await ctx.addInitScript(CLOCK);
if (mod.init) await ctx.addInitScript(mod.init);
const pg = await ctx.newPage();
pg.on('pageerror', e => console.error('pageerror', e.message));
await pg.goto(a.url, { waitUntil: 'load' });
await pg.evaluate(() => { document.documentElement.style.scrollBehavior = 'auto'; });
if (mod.ready) await pg.waitForFunction(mod.ready, null, { timeout: 60000, polling: 250 });   // the page's rAF is on the virtual clock: poll on a timer
// a target: a y, a selector (its top, less px), or a selector and frac (that fraction of a tall pinned section's scroll)
const yOf = async (t, px = 0, frac) => typeof t === 'number' ? t : pg.evaluate(([s, p, f]) => { const e = document.querySelector(s); if (!e) return scrollY; const top = e.getBoundingClientRect().top + scrollY; return f == null ? top - p : top + f * (e.offsetHeight - innerHeight); }, [t, px, frac ?? null]);
const ease = x => x < .5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
let n = 0, mouse = [W / 2, H / 2];
const frame = async () => {
  await pg.evaluate(dt => window.__step(dt), 1000 / FPS);
  await pg.evaluate(() => new Promise(r => setTimeout(r, 0)));
  await pg.screenshot({ path: path.join(frames, String(n++).padStart(5, '0') + '.jpg'), type: 'jpeg', quality: 92 });
};
for (const s of shots) {
  const y0 = await pg.evaluate(() => scrollY);
  const y1 = s.scrollTo !== undefined ? await yOf(s.scrollTo, s.px || 0, s.frac) : y0;
  const steps = Math.max(1, Math.round((s.dur || 1) * FPS));
  const path_ = s.pointer || null;
  for (let i = 0; i < steps; i++) {
    const k = (i + 1) / steps;
    if (y1 !== y0) await pg.evaluate(y => scrollTo(0, y), Math.round(y0 + (y1 - y0) * ease(k)));
    if (path_ && path_.length > 1) {
      const f = k * (path_.length - 1), j = Math.min(path_.length - 2, Math.floor(f)), u = ease(f - j);
      const p = [path_[j][0] + (path_[j + 1][0] - path_[j][0]) * u, path_[j][1] + (path_[j + 1][1] - path_[j][1]) * u];
      await pg.mouse.move(p[0], p[1]); mouse = p;
    }
    await frame();
  }
  process.stdout.write('.');
}
await b.close();
const mp4 = out + '.mp4';
const r = spawnSync('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', String(FPS), '-i', path.join(frames, '%05d.jpg'), '-c:v', 'libx264', '-preset', 'slow', '-crf', '20', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', mp4], { stdio: 'inherit' });
if (r.status) process.exit(r.status);
spawnSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', path.join(frames, String(Math.min(n - 1, FPS * 3)).padStart(5, '0') + '.jpg'), '-q:v', '3', out + '-poster.jpg']);
console.log('\n' + n + ' frames → ' + path.relative(ROOT, mp4));
