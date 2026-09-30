#!/usr/bin/env node
// Content quality, step 1: harvest every piece of text a visitor can meet, on every page and in every state.
//   node copy-harvest.mjs --site <folder> --out projects/<slug>/qa/copy [--states projects/<slug>/qa/copy-states.mjs] [--pages home|all] [--js "src/3-data.js,src/4*.js"]
// Script text meant for a model or a machine (an agent prompt, a tool schema) is fenced with /* copy-skip:start */ … /* copy-skip:end */.
// What counts as text: visible text, hidden-but-reachable text (closed dialogs, collapsed details, drawers, noscript),
// alt, aria-label, title, placeholder, the document title, meta description and share titles, and the Hebrew string
// literals in the site's scripts (tips, errors and answers that only appear after an interaction).
// Owner-only UI is skipped: anything inside #adm or [data-copy-skip]. A states module (optional) drives the page
// through its dynamic states: `export default async function (page, snap) { await page.click(...); await snap('cart open'); }`.
// Writes strings.json ({ strings: [{ t, kind, where, pages, states, visible }] }) and a short summary on stdout.
import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';
import { pathToFileURL } from 'url';
import { parseArgs, repoRoot } from './lib.mjs';
import { startServer } from './seo-serve.mjs';
const require = createRequire(import.meta.url);
let pw; try { pw = require('playwright'); } catch { pw = require('/opt/node22/lib/node_modules/playwright'); }
const a = parseArgs(), ROOT = repoRoot();
if (!a.site || !a.out) { console.error('usage: node copy-harvest.mjs --site <folder> --out <dir> [--states file.mjs] [--pages home|all] [--js "src/*.js"]'); process.exit(2); }
const SITE = path.resolve(ROOT, a.site), OUT = path.resolve(ROOT, a.out); fs.mkdirSync(OUT, { recursive: true });

// ---- the pages: the home page plus every URL in sitemap.xml, plus the 404 page
let pages = ['/'];
if ((a.pages || 'all') === 'all') {
  const sm = path.join(SITE, 'sitemap.xml');
  if (fs.existsSync(sm)) pages.push(...[...fs.readFileSync(sm, 'utf8').matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => new URL(m[1]).pathname).filter(p => p !== '/'));
  if (fs.existsSync(path.join(SITE, '404.html'))) pages.push('/404.html');
}
pages = [...new Set(pages)];

// ---- in-page collector: text blocks (a block element's own inline text), attributes, head strings
function collect() {
  const SKIP = 'script,style,template,#adm,[data-copy-skip]';
  const isInline = el => { const d = getComputedStyle(el).display; return (d.startsWith('inline') || d === 'contents') && !/^(INPUT|SELECT|TEXTAREA|BUTTON|IMG|SVG)$/i.test(el.tagName); };
  const inlineText = el => { let s = ''; for (const n of el.childNodes) { if (n.nodeType === 3) s += n.nodeValue; else if (n.nodeType === 1) { if (n.closest(SKIP)) continue; if (n.tagName === 'BR') s += ' '; else if (isInline(n)) s += inlineText(n); } } return s; };
  const where = el => { const parts = []; for (let e = el; e && e !== document.body && parts.length < 4; e = e.parentElement) { let p = e.tagName.toLowerCase(); if (e.id) { p += '#' + e.id; parts.unshift(p); break; } if (e.classList.length) p += '.' + [...e.classList].slice(0, 2).join('.'); parts.unshift(p); } return parts.join(' > '); };
  const vis = el => { try { return el.checkVisibility ? el.checkVisibility({ checkVisibilityCSS: true }) : !!el.offsetParent; } catch { return false; } };
  const norm = s => String(s || '').replace(/[‎‏⁦-⁩]/g, '').replace(/\s+/g, ' ').trim();
  const has = s => /[\p{L}]/u.test(s);
  const out = [];
  for (const el of document.body.querySelectorAll('*')) {
    if (el.closest(SKIP) || el.closest('svg')) continue;
    if (!isInline(el)) { const t = norm(inlineText(el)); if (t && has(t)) out.push({ t, kind: el.tagName === 'NOSCRIPT' ? 'noscript' : el.tagName === 'OPTION' ? 'option' : /^H[1-6]$/.test(el.tagName) ? 'heading' : /^(BUTTON|A|SUMMARY)$/.test(el.tagName) ? 'action' : 'text', where: where(el), visible: vis(el) }); }
    for (const at of ['aria-label', 'alt', 'title', 'placeholder', 'aria-description']) { const v = norm(el.getAttribute(at)); if (v && has(v)) out.push({ t: v, kind: at, where: where(el), visible: vis(el) }); }
    if (el.tagName === 'A' && isInline(el)) { const t = norm(el.textContent); if (t && has(t)) out.push({ t, kind: 'link', where: where(el), visible: vis(el) }); }
  }
  // noscript content is parsed as text when scripting is on
  for (const ns of document.querySelectorAll('noscript')) { const t = norm(ns.textContent.replace(/<[^>]+>/g, '')); if (t && has(t)) out.push({ t, kind: 'noscript', where: 'noscript', visible: false }); }
  const meta = n => norm(document.querySelector(`meta[name="${n}"],meta[property="${n}"]`)?.content);
  out.push({ t: norm(document.title), kind: 'title', where: 'head', visible: false });
  for (const n of ['description', 'og:title', 'og:description', 'og:image:alt']) { const v = meta(n); if (v) out.push({ t: v, kind: 'meta:' + n, where: 'head', visible: false }); }
  return out;
}

const all = new Map(); // key: kind + text
const add = (list, page, state) => { for (const s of list) { const k = s.kind + '\u0001' + s.t; const e = all.get(k) || { t: s.t, kind: s.kind, where: s.where, pages: new Set(), states: new Set(), visible: false }; e.pages.add(page); if (state) e.states.add(state); e.visible = e.visible || s.visible; all.set(k, e); } };

const srv = await startServer({ dir: SITE, port: 0 });
const b = await pw.chromium.launch();
try {
  for (const [label, vp] of [['desktop', { width: 1440, height: 900 }], ...(a.mobile === false ? [] : [['mobile', { width: 390, height: 844, isMobile: true, hasTouch: true }]])]) {
    const ctx = await b.newContext({ locale: 'he-IL', viewport: { width: vp.width, height: vp.height }, isMobile: !!vp.isMobile, hasTouch: !!vp.hasTouch });
    const pg = await ctx.newPage();
    const list = label === 'desktop' ? pages : ['/'];
    for (const p of list) {
      await pg.goto(srv.url.replace(/\/$/, '') + encodeURI(p), { waitUntil: 'load' });
      await pg.waitForTimeout(p === '/' ? 2600 : 250);
      add(await pg.evaluate(collect), p, p === '/' ? label : '');
      if (p === '/' && a.states) {
        const mod = await import(pathToFileURL(path.resolve(ROOT, a.states)).href);
        const snap = async st => add(await pg.evaluate(collect), p, label + ': ' + st);
        try { await mod.default(pg, snap, { mobile: label === 'mobile' }); } catch (e) { console.error('  states (' + label + ') stopped:', e.message.split('\n')[0]); }
      }
    }
    await ctx.close();
  }
} finally { await b.close(); await srv.close(); }

// ---- Hebrew string literals in the site's scripts (text that appears only after an interaction)
if (a.js) {
  const rxs = String(a.js).split(',').map(g => new RegExp('^' + g.trim().replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '[^/]*') + '$'));
  const rx = { test: f => rxs.some(r => r.test(f)) };
  const walk = d => fs.readdirSync(d, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]);
  for (const f of walk(SITE).filter(f => rx.test(path.relative(SITE, f)))) {
    // a region between /* copy-skip:start */ and /* copy-skip:end */ holds text for a model or a machine (an agent prompt, a tool schema), not for visitors
    const src = fs.readFileSync(f, 'utf8').replace(/\/\*\s*copy-skip:start[\s\S]*?copy-skip:end\s*\*\//g, m => m.replace(/[^\n]/g, ' '));
    for (const m of src.matchAll(/(['"`])((?:\\.|(?!\1).)*?[֐-׿](?:\\.|(?!\1).)*?)\1/g)) {
      // a literal that holds code or markup (a mis-paired quote, an attribute) is not visitor text: the rendered harvest covers those
      if (/'\s*\+|\+\s*'|\)\s*\+|\b(esc|bdi|money|title|cutW)\(|=>|\.test\(|[\w-]+="|<\/?[a-z]|\?\s*'/.test(m[2])) continue;
      const t = m[2].replace(/\\n/g, ' ').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
      if (t.length < 2) continue;
      add([{ t, kind: 'js', where: path.relative(SITE, f) + ':' + (src.slice(0, m.index).split('\n').length), visible: false }], 'js', '');
    }
  }
}

const strings = [...all.values()].map(e => ({ ...e, pages: [...e.pages].slice(0, 8), pageCount: e.pages.size, states: [...e.states] }));
fs.writeFileSync(path.join(OUT, 'strings.json'), JSON.stringify({ site: path.relative(ROOT, SITE), pages: pages.length, at: new Date().toISOString(), strings }, null, 1));
const by = strings.reduce((m, s) => (m[s.kind] = (m[s.kind] || 0) + 1, m), {});
console.log(`harvested ${strings.length} distinct strings from ${pages.length} pages · ` + Object.entries(by).map(([k, n]) => `${k} ${n}`).join(' · '));
console.log('wrote', path.relative(ROOT, path.join(OUT, 'strings.json')));
