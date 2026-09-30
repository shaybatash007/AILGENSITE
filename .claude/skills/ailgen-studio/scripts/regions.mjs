#!/usr/bin/env node
// Design critique, step 1: shoot every region of a page, desktop and mobile, one PNG per region, plus a sheet.
//   node regions.mjs --url http://127.0.0.1:8131/ --out projects/<slug>/critique/before [--regions "bar,hdr,top,cats,kit,…"] [--wait 2600]
// Without --regions it takes the page's landmark children: header, every body > section / main > section with an id, footer.
// A region is shot in its own frame (element screenshot, animations settled, lazy images loaded), so it can be judged alone:
// the critique (references/16-design-critique.md) scores each one on its own before the page is judged as a whole.
// Writes <out>/<label>-<id>.png and <out>/regions.json ({ id, label, w, h, file }).
import fs from 'fs';
import path from 'path';
import { parseArgs, repoRoot, loadPlaywright } from './lib.mjs';
const a = parseArgs(), ROOT = repoRoot();
if (!a.url || !a.out) { console.error('usage: node regions.mjs --url <page> --out <dir> [--regions "id,id"] [--mobile-only|--desktop-only]'); process.exit(2); }
const OUT = path.resolve(ROOT, a.out); fs.mkdirSync(OUT, { recursive: true });
const pw = loadPlaywright(), b = await pw.chromium.launch(), rows = [];
const views = [['desktop', { width: 1440, height: 900 }], ['mobile', { width: 390, height: 844, isMobile: true, hasTouch: true, deviceScaleFactor: 2 }]]
  .filter(([l]) => !(a['mobile-only'] && l === 'desktop') && !(a['desktop-only'] && l === 'mobile'));
try {
  for (const [label, vp] of views) {
    const ctx = await b.newContext({ locale: 'he-IL', viewport: { width: vp.width, height: vp.height }, isMobile: !!vp.isMobile, hasTouch: !!vp.hasTouch, deviceScaleFactor: vp.deviceScaleFactor || 1 });
    const pg = await ctx.newPage();
    await pg.goto(a.url, { waitUntil: 'load' }); await pg.waitForTimeout(+(a.wait || 2600));
    // scroll the page once so scroll reveals fire the site's own way (never add classes: a class can collide with a layout name)
    await pg.evaluate(async () => { for (let y = 0; y < document.body.scrollHeight; y += 400) { scrollTo(0, y); await new Promise(r => setTimeout(r, 90)); } scrollTo(0, 0); });
    await pg.waitForTimeout(700);
    const ids = a.regions ? String(a.regions).split(',').map(s => s.trim()) : await pg.evaluate(() => [...document.querySelectorAll('body > header[id], body > section[id], main > section[id], body > footer[id], body > div.bar[id]')].map(e => e.id));
    for (const id of ids) {
      const el = await pg.$('#' + id); if (!el) { console.log('  – no #' + id); continue; }
      if (!(await el.isVisible())) { console.log('  – hidden #' + id + ' (' + label + ')'); continue; }
      const file = path.join(OUT, `${label}-${id}.png`);
      await el.scrollIntoViewIfNeeded(); await pg.waitForTimeout(250);
      // judge the region alone: sticky headers, floating helpers and bottom bars that do not belong to it are hidden for the shot
      await pg.evaluate(id => { const r = document.getElementById(id); for (const e of document.body.querySelectorAll('*')) { const p = getComputedStyle(e).position; if ((p === 'fixed' || p === 'sticky') && !e.contains(r) && !r.contains(e)) e.setAttribute('data-rg-hide', ''); } if (!document.getElementById('rg-hide')) { const st = document.createElement('style'); st.id = 'rg-hide'; st.textContent = '[data-rg-hide]{visibility:hidden!important}'; document.head.append(st); } }, id);
      await el.screenshot({ path: file, animations: 'disabled' });
      await pg.evaluate(() => document.querySelectorAll('[data-rg-hide]').forEach(e => e.removeAttribute('data-rg-hide')));
      const bb = await el.boundingBox(); rows.push({ id, label, w: Math.round(bb.width), h: Math.round(bb.height), file: path.relative(ROOT, file) });
    }
    await ctx.close();
  }
} finally { await b.close(); }
fs.writeFileSync(path.join(OUT, 'regions.json'), JSON.stringify(rows, null, 1));
console.log(`${rows.length} region shots → ${path.relative(ROOT, OUT)}`);
