#!/usr/bin/env node
// Turns catalog/catalog.json (the store's public storefront JSON, 29.9.2026) into the site's data and images:
//   edencosmetic/src/3a-catalog.js      const CAT = { snap, freeShip, items: [...], cols: [...] }  (real prices, stock, text)
//   edencosmetic/img/p/<id>.jpg (720)   product photos as the store serves them, resized
//   edencosmetic/img/p/t/<id>.jpg (360) grid thumbnails
//   projects/edencosmetic/site-src/catalog-map.json   the same items with category and brand, for the SEO composer
// Nothing is invented: category and brand are read from the product title and the store's own type; text is the store's text.
import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';
const HERE = path.dirname(new URL(import.meta.url).pathname), PROJ = path.join(HERE, '..'), ROOT = path.join(PROJ, '..', '..'), SITE = path.join(ROOT, 'edencosmetic');
const cat = JSON.parse(fs.readFileSync(path.join(PROJ, 'catalog/catalog.json'), 'utf8'));

const BRANDS = [['My lamination', /my ?lamination|מיי למינ/i], ['NIKK MOLE', /nikk ?mol|ניק מול/i], ['THUYA', /thuya|טויה/i], ['ZOLA', /zola|זולה/i], ['RefectoCil', /refectocil|רפקטוסיל/i], ['Kodi', /kodi|קודי/i], ['Stalex', /stalex|סטאלקס/i]];
const brandOf = p => { const t = p.title; const b = BRANDS.find(([, rx]) => rx.test(t)) || BRANDS.find(([, rx]) => rx.test(p.text.slice(0, 200))); return b ? b[0] : ''; };
// category from the title (order matters); labels are the store's own words
const KINDS = [
  ['set',       'ערכות', /ערכת|ערכה|^my lamination סט|מיני ערכת/i],
  ['step',      'שלבים בודדים', /שלב [123]/],
  ['pads',      'סיליקונים', /סיליקונים|סיליקון לכיסוי|תיקונים/],
  ['glue',      'דבק ובלאם', /^דבק/],
  ['tint',      'צבע', /^צבע|^my lamination צבע|צבע לגבות|צבע לריסים/i],
  ['oxidant',   'חמצן', /חמצן/],
  ['clean',     'ניקוי', /קצף|שמפו/],
  ['serum',     'טיפוח', /מסקרת|סרום/],
  ['tool',      'כלים', /פינצטה|מספריים|מסרק|מברשת|מוט הרמה|כוסית|ניילון|סרט דבק|בייביבראש|פאצים|תופסנים|עדשת/],
];
const kindOf = p => (KINDS.find(([, , rx]) => rx.test(p.title)) || ['other', 'אחר'])[0];
const colIndex = new Map(); cat.collections.forEach(c => c.products.forEach(h => (colIndex.get(h) || colIndex.set(h, []).get(h)).push(c.handle)));
const clean = t => String(t || '').replace(/[‎‏‪-‮]/g, '').replace(/[ \t]+/g, ' ').replace(/ *\n */g, '\n').replace(/\n{2,}/g, '\n').trim();

const items = cat.products.map(p => {
  const v = p.variants[0];
  return { i: p.id, h: p.handle, t: clean(p.title), p: v.price, c: v.compareAt || 0, a: v.available ? 1 : 0, v: v.id, b: brandOf(p), k: kindOf(p), g: colIndex.get(p.handle) || [], d: clean(p.text), s: v.sku || '', tags: p.tags.slice(0, 12), type: p.type };
});
// display titles: two products with the same store title get the colour their own description names, so every page and card is unique
const colourOf = d => (String(d).match(/בצבע\s+([^\s,.\n]+(?:\s[^\s,.\n]+)?)/) || String(d).match(/צבע\s+([^\s,.\n]+(?:\s[^\s,.\n]+)?)/) || [])[1]?.replace(/[\s\-–]+$/, '') || '';
const seen = new Map(); items.forEach(x => seen.set(x.t, (seen.get(x.t) || 0) + 1));
// display typography only (the store's words stay): a space between Hebrew and Latin, standard spelling of ורוד, spaced slashes and dashes
const tidy = t => String(t).replace(/([\u05D0-\u05EA])([A-Za-z])/g, '$1 $2').replace(/([A-Za-z])([\u05D0-\u05EA])/g, '$1 $2').replace(/(^|[\s(\-–])וורוד/g, '$1ורוד').replace(/(\D)\s*\/\s*(?=\D)/g, '$1 / ').replace(/\s+-\s*|\s*-\s+/g, ' – ').replace(/\s{2,}/g, ' ').trim();
items.forEach(x => { x.dt = tidy(x.t); if (seen.get(x.t) > 1) { const c = colourOf(x.d); x.dt = c ? `${tidy(x.t)} (${tidy(c)})` : tidy(x.t); } });
const dtSeen = new Map(); items.forEach(x => dtSeen.set(x.dt, (dtSeen.get(x.dt) || 0) + 1));
items.forEach(x => { if (dtSeen.get(x.dt) > 1) x.dt = `${x.dt} (${x.s || x.i})`; });
const cols = cat.collections.filter(c => !['frontpage', 'all'].includes(c.handle)).map(c => ({ h: c.handle, t: c.title, n: c.products.length, ids: c.products, d: c.description || '' }));

// images: 720 px for the page, 360 px for grids
fs.mkdirSync(path.join(SITE, 'img/p/t'), { recursive: true });
const py = `
import sys, os
from PIL import Image
src, dst = sys.argv[1], sys.argv[2]
im = Image.open(src).convert('RGB')
for size, sub, q in ((720, '', 82), (360, 't', 78)):
    im2 = im.copy(); im2.thumbnail((size, size), Image.LANCZOS)
    im2.save(os.path.join(dst, sub, os.path.basename(src)), 'JPEG', quality=q, optimize=True, progressive=True)
`;
let made = 0;
for (const it of items) {
  const s = path.join(PROJ, 'catalog/img', `${it.i}-1.jpg`); if (!fs.existsSync(s)) { console.warn('no image', it.h); continue; }
  const dst720 = path.join(SITE, 'img/p', `${it.i}-1.jpg`);
  if (!fs.existsSync(dst720)) { const r = spawnSync('python3', ['-c', py, s, path.join(SITE, 'img/p')]); if (r.status) { console.error(r.stderr.toString()); process.exit(1); } made++; }
  it.img = `${it.i}-1`;
}
const CAT = { snap: '2026-09-29', freeShip: 499, origin: cat.source, currency: 'ILS', kinds: Object.fromEntries(KINDS.map(([k, l]) => [k, l])), items: items.map(({ tags, type, ...x }) => x), cols };
fs.writeFileSync(path.join(SITE, 'src/3a-catalog.js'), `/* generated by projects/edencosmetic/site-src/make-data.mjs from the store's public storefront JSON, ${CAT.snap} */\nconst CAT=${JSON.stringify(CAT)};\n`);
fs.writeFileSync(path.join(HERE, 'catalog-map.json'), JSON.stringify({ snap: CAT.snap, items, cols }, null, 1));
// the brand registry (projects/edencosmetic/brands.json, facts with sources) joined to the catalog: which products each brand has
const REG = JSON.parse(fs.readFileSync(path.join(PROJ, 'brands.json'), 'utf8'));
const regOf = name => REG.brands.find(b => b.match.some(m => m.toLowerCase() === String(name).toLowerCase()));
const BR = { list: REG.brands.map(b => ({ key: b.key, name: b.name, short: b.short || b.name, origin: b.origin ? b.origin.he : '', about: b.about && b.about.he ? b.about.he : '', src: b.about && b.about.src ? b.about.src : '', look: b.look, cut: `img/cut/${b.cut}.webp`, ids: items.filter(x => regOf(x.b) === b).map(x => x.i) })).filter(b => b.ids.length),
  house: { ...REG.house, cut: `img/cut/${REG.house.cut}.webp`, ids: items.filter(x => !x.b).map(x => x.i) }, pageMin: REG.pageMin };
BR.list.forEach(b => { b.page = b.ids.length >= REG.pageMin; });
fs.writeFileSync(path.join(SITE, 'src/3c-brands.js'), `/* generated by projects/edencosmetic/site-src/make-data.mjs from projects/edencosmetic/brands.json (official sources, checked ${REG.checked}) */\nconst BRANDS=${JSON.stringify(BR)};\n`);
// approved generated visuals (image-review.mjs --publish, videogen.mjs --publish): the site uses them only if they exist
const manFile = path.join(SITE, 'img/v/manifest.json'), VM = fs.existsSync(manFile) ? JSON.parse(fs.readFileSync(manFile, 'utf8')) : { images: {}, videos: {} };
fs.writeFileSync(path.join(SITE, 'src/3d-visual.js'), `/* generated by projects/edencosmetic/site-src/make-data.mjs from edencosmetic/img/v/manifest.json (approved, reviewed images and videos only) */\nconst VISUAL=${JSON.stringify({ images: VM.images || {}, videos: VM.videos || {}, disclosure: VM.disclosure || null })};\n`);
console.log('brands:', BR.list.map(b => `${b.name} ${b.ids.length}${b.page ? '' : ' (no page)'}`).join(', '), '· house', BR.house.ids.length);
const byK = {}; items.forEach(x => (byK[x.k] ||= []).push(x)); 
for (const [k, l] of Object.entries(byK)) console.log(k, l.length, l.map(x => x.t.slice(0, 32)).slice(0, 4).join(' | '));
console.log(`${items.length} items, ${cols.length} collections, ${made} images written, brands:`, [...new Set(items.map(x => x.b))].join(', '));
console.log('bytes', fs.statSync(path.join(SITE, 'src/3a-catalog.js')).size);
