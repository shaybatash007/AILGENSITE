// rec.mjs — the Node twin of rec.py, for machines where Playwright is installed for Node only.
// Real-time screencast of a scripted visit -> MP4 at a constant 30 fps (real frame durations).
//   import { record, topAt, to } from './rec.mjs';
//   await record('http://127.0.0.1:8000/', 'out/loop', async pg => { await pg.waitForTimeout(2500); await topAt(pg, '#work'); });
import { createRequire } from 'module';
import { execFileSync } from 'child_process';
import fs from 'fs'; import path from 'path';
const require = createRequire(import.meta.url);
let pw; try { pw = require('playwright'); } catch { pw = require('/opt/node22/lib/node_modules/playwright'); }
const CURSOR = `addEventListener('DOMContentLoaded',()=>{const c=document.createElement('div');
c.style.cssText='position:fixed;left:0;top:0;width:26px;height:26px;margin:-13px 0 0 -13px;border-radius:50%;border:1.5px solid rgba(COL,.95);background:rgba(COL,.12);pointer-events:none;z-index:2147483647;transition:transform .18s;opacity:0';
document.documentElement.appendChild(c);let x=-99,y=-99,tx=-99,ty=-99;
addEventListener('mousemove',e=>{tx=e.clientX;ty=e.clientY;c.style.opacity=1},true);
addEventListener('mousedown',()=>c.style.transform='scale(.7)',true);addEventListener('mouseup',()=>c.style.transform='',true);
(function f(){x+=(tx-x)*.35;y+=(ty-y)*.35;c.style.left=x+'px';c.style.top=y+'px';requestAnimationFrame(f)})()});`;
const SMOOTH = "(y,ms)=>new Promise(r=>{const s=scrollY,t0=performance.now(),e=x=>x<.5?4*x*x*x:1-Math.pow(-2*x+2,3)/2;(function f(n){const k=Math.min(1,(n-t0)/ms);scrollTo(0,s+(y-s)*e(k));k<1?requestAnimationFrame(f):r()})(t0)})";
export async function topAt(pg, sel, px = 110, ms = 2000) {
  const y = await pg.evaluate(`document.querySelector('${sel}').getBoundingClientRect().top+scrollY-${px}`);
  await pg.evaluate(`(${SMOOTH})(${y},${ms})`);
}
export async function to(pg, sel, { steps = 32, pause = 500, dx = .5, dy = .5 } = {}) {
  const b = await (await pg.$(sel)).boundingBox();
  await pg.mouse.move(b.x + b.width * dx, b.y + b.height * dy, { steps });
  if (pause) await pg.waitForTimeout(pause);
}
// setup(pg) runs before the page loads (routes, storage); init is a script injected into every page.
export async function record(url, out, script, { vp = [1440, 900], scale = 1, cursor = true, color = '255,255,255', init, setup } = {}) {
  const d = out + '_frames'; fs.rmSync(d, { recursive: true, force: true }); fs.mkdirSync(d, { recursive: true });
  const frames = [];
  const b = await pw.chromium.launch();
  const pg = await b.newPage({ viewport: { width: vp[0], height: vp[1] }, deviceScaleFactor: scale });
  if (cursor) await pg.addInitScript(CURSOR.replace('COL', color));
  if (init) await pg.addInitScript(init);
  if (setup) await setup(pg);
  const cdp = await pg.context().newCDPSession(pg);
  cdp.on('Page.screencastFrame', f => {
    const fn = `${d}/${String(frames.length).padStart(5, '0')}.jpg`;
    fs.writeFileSync(fn, Buffer.from(f.data, 'base64')); frames.push([fn, f.metadata.timestamp]);
    cdp.send('Page.screencastFrameAck', { sessionId: f.sessionId }).catch(() => {});
  });
  await pg.goto(url, { waitUntil: 'commit' });
  await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 92, maxWidth: vp[0] * scale, maxHeight: vp[1] * scale });
  await script(pg); await cdp.send('Page.stopScreencast'); await b.close();
  let list = '';
  frames.forEach(([fn, ts], i) => {
    const dur = i + 1 < frames.length ? frames[i + 1][1] - ts : .04;
    list += `file '${path.resolve(fn)}'\nduration ${Math.max(dur, .001).toFixed(4)}\n`;
  });
  list += `file '${path.resolve(frames.at(-1)[0])}'\n`;
  fs.writeFileSync(out + '_list.txt', list);
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', out + '_list.txt', '-vf', 'fps=30,scale=trunc(iw/2)*2:trunc(ih/2)*2,format=yuv420p', '-c:v', 'libx264', '-crf', '18', '-movflags', '+faststart', out + '.mp4']);
  return out + '.mp4';
}
// Google Fonts through curl (TLS verified by the system CA bundle), for sandboxes where the browser cannot reach them directly.
export async function viaCurl(pg) {
  await pg.route(/fonts\.(googleapis|gstatic)\.com/, async r => {
    const u = r.request().url();
    const body = execFileSync('curl', ['-sS', '--fail', '-A', 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Safari/537.36', u]);
    await r.fulfill({ body, contentType: u.includes('googleapis') ? 'text/css' : 'font/woff2', headers: { 'access-control-allow-origin': '*' } });
  });
}
