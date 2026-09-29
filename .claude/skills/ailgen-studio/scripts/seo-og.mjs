#!/usr/bin/env node
// Social preview images: one 1200×630 card per page, so a link shared on WhatsApp, Facebook or LinkedIn shows the page's
// own headline and a real photo instead of a generic logo. Israeli B2B leads travel through shared links.
//   node seo-og.mjs --config projects/<slug>/seo/pages.json
// Reads the same config as seo-pages.mjs (plus config.home = { h1, kicker, image: { src } } for "/"), writes
//   <out>/og/<hash>.jpg   and   <out>/og/og-map.json  (path → /og/<hash>.jpg), which seo-pages.mjs and the composer pick up.
// Colours and fonts come from config.og = { bg, fg, accent } and config.fontsCss; photos are the page's own image.
import fs from 'fs';
import os from 'os';
import path from 'path';
import crypto from 'crypto';
import { loadPlaywright, parseArgs } from './lib.mjs';

const a = parseArgs();
if (!a.config) { console.error('usage: node seo-og.mjs --config <pages.json>'); process.exit(2); }
const cfgFile = path.resolve(a.config), C = JSON.parse(fs.readFileSync(cfgFile, 'utf8'));
const OUT = path.resolve(path.dirname(cfgFile), C.out || '.'), dir = path.join(OUT, 'og'); fs.mkdirSync(dir, { recursive: true });
const B = C.brand, O = { bg: '#0B1B2E', fg: '#EEF3F6', accent: '#C9F03A', ...(C.og || {}) };
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fonts = C.fontsCss ? fs.readFileSync(path.resolve(path.dirname(cfgFile), C.fontsCss), 'utf8').replace(/url\(([^)/][^)]*)\)/g, (m, f) => `url(file://${path.join(OUT, 'fonts', f)})`) : '';
const file = src => src && !/^https?:/.test(src) && fs.existsSync(path.join(OUT, src)) ? 'file://' + path.join(OUT, src) : '';
const host = new URL(C.site).host;
const cards = [...(C.home ? [{ path: '/', h1: C.home.h1, kicker: C.home.kicker || '', image: C.home.image }] : []), ...C.pages.filter(p => p.path !== '/')];
const html = p => {
  const h = String(p.h1 || '').replace(/\*/g, ''), len = h.length, size = len <= 34 ? 74 : len <= 60 ? 62 : len <= 90 ? 52 : 44, photo = file(p.image?.src || B.ogImage);
  return `<!doctype html><html lang="he" dir="rtl"><meta charset="utf-8"><style>${fonts}
*{box-sizing:border-box;margin:0}body{width:1200px;height:630px;background:${O.bg};color:${O.fg};font-family:'${O.font || 'Rubik'}',system-ui,sans-serif;position:relative;overflow:hidden}
.grid{position:absolute;inset:0;background-image:linear-gradient(${O.grid || 'rgba(201,240,58,.07)'} 1px,transparent 1px),linear-gradient(90deg,${O.grid || 'rgba(201,240,58,.07)'} 1px,transparent 1px);background-size:48px 48px}
.ph{position:absolute;inset-block:0;left:0;width:470px;background:url(${photo}) center/cover}.ph::after{content:"";position:absolute;inset:0;background:linear-gradient(90deg,transparent 0,${O.bg} 100%)}
.tx{position:absolute;inset-block:0;right:0;width:740px;padding:56px 64px 48px 24px;display:flex;flex-direction:column;justify-content:space-between}
.k{font:600 22px/1 '${O.mono || 'IBM Plex Mono'}',monospace;letter-spacing:.14em;color:${O.accent}}
h1{font-weight:800;font-size:${size}px;line-height:1.08;letter-spacing:-.015em;text-wrap:balance}
.f{display:flex;align-items:center;gap:16px;font-weight:700;font-size:28px}.f img{width:54px;height:54px}.f small{display:block;font:500 20px/1.2 '${O.mono || 'IBM Plex Mono'}',monospace;color:${O.accent};letter-spacing:.06em;direction:ltr}
</style><body><div class="grid"></div>${photo ? '<div class="ph"></div>' : ''}<div class="tx"><div class="k">${esc(p.kicker || B.short || '')}</div><h1>${esc(h)}</h1><div class="f"><img src="${file(B.logo || '/icon.svg')}" alt=""><div>${esc(B.name)}<small>${esc(host)}</small></div></div></div></body></html>`;
};

const { chromium } = loadPlaywright();
const browser = await chromium.launch(), pg = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
const map = {}, tmp = path.join(os.tmpdir(), 'seo-og-' + process.pid + '.html');
for (const p of cards) {
  fs.writeFileSync(tmp, html(p));
  await pg.goto('file://' + tmp); await pg.evaluate(() => document.fonts.ready); await pg.waitForTimeout(80);
  const id = crypto.createHash('sha1').update(p.path).digest('hex').slice(0, 10) + '.jpg';
  await pg.screenshot({ path: path.join(dir, id), type: 'jpeg', quality: 82 }); map[p.path] = '/og/' + id;
}
await browser.close(); fs.rmSync(tmp, { force: true });
fs.writeFileSync(path.join(dir, 'og-map.json'), JSON.stringify(map, null, 1));
console.log(`${cards.length} social cards written to ${dir}`);
