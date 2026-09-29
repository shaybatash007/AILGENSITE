#!/usr/bin/env node
// Catalog intake for a Shopify store, from the public storefront JSON (the same data the store's own pages render):
//   node shopify-catalog.mjs https://store.co.il --out projects/<slug>/catalog [--delay 700] [--images 1] [--width 900]
// Reads /products.json (paged) and /collections.json with each collection's products, then writes
//   catalog.json   products (handle, title, vendor, type, tags, text, variants with prices and availability, images),
//                  collections (handle, title, product handles), brands, product types, price range, counts
//   img/           the first image of every product (or --images N), resized by the CDN to --width, as downloaded
// It honours robots.txt, waits between requests, uses Node's fetch (TLS on), and never touches cart, checkout or account.
import fs from 'fs';
import path from 'path';
import { ensureProxyEnv, parseArgs, writeJSON } from './lib.mjs';
import { robotsAllowed } from './seo-lib.mjs';

ensureProxyEnv();
const a = parseArgs(), START = a._[0];
if (!START || !/^https?:\/\//.test(START)) { console.error('usage: node shopify-catalog.mjs <https://store> --out <dir> [--delay 700] [--images 1] [--width 900]'); process.exit(2); }
const origin = new URL(START).origin, OUT = path.resolve(a.out || 'catalog'), DELAY = +(a.delay || 700), NIMG = a.images === undefined ? 1 : +a.images, WIDTH = +(a.width || 900);
fs.mkdirSync(path.join(OUT, 'img'), { recursive: true });
const UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const get = async u => { const r = await fetch(u, { headers: { 'user-agent': UA, accept: 'application/json' } }); if (!r.ok) throw new Error(r.status + ' ' + u); return r; };

let allowed = () => true;
try { allowed = robotsAllowed(await (await get(origin + '/robots.txt')).text()); } catch { /* none */ }
const text = h => String(h || '').replace(/<br\s*\/?>/gi, '\n').replace(/<\/(p|li|h\d|div)>/gi, '\n').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/[ \t]+/g, ' ').replace(/\n\s*\n+/g, '\n').trim();

const products = [];
for (let page = 1; page < 40; page++) {
  const u = `${origin}/products.json?limit=250&page=${page}`; if (!allowed('/products.json')) { console.error('robots.txt disallows /products.json'); process.exit(1); }
  const j = await (await get(u)).json(); if (!j.products?.length) break;
  products.push(...j.products); console.log(`products page ${page}: +${j.products.length}`); await sleep(DELAY);
}
const collections = [];
try {
  const cj = await (await get(`${origin}/collections.json?limit=250`)).json(); await sleep(DELAY);
  for (const c of cj.collections || []) {
    const items = [];
    for (let page = 1; page < 20; page++) {
      const j = await (await get(`${origin}/collections/${encodeURIComponent(c.handle)}/products.json?limit=250&page=${page}`)).json(); await sleep(DELAY);
      if (!j.products?.length) break; items.push(...j.products.map(p => p.handle)); if (j.products.length < 250) break;
    }
    collections.push({ id: c.id, handle: c.handle, title: c.title, description: text(c.body_html), image: c.image?.src || '', products: items });
    console.log(`collection ${c.handle}: ${items.length} products`);
  }
} catch (e) { console.warn('collections:', e.message); }

const out = products.map(p => ({
  id: p.id, handle: p.handle, title: p.title, vendor: p.vendor, type: p.product_type, tags: p.tags || [], text: text(p.body_html), html: p.body_html || '',
  publishedAt: p.published_at, updatedAt: p.updated_at, options: (p.options || []).map(o => ({ name: o.name, values: o.values })),
  variants: p.variants.map(v => ({ id: v.id, title: v.title, sku: v.sku, price: +v.price, compareAt: v.compare_at_price ? +v.compare_at_price : null, available: !!v.available })),
  images: p.images.map(i => ({ src: i.src, w: i.width, h: i.height, alt: i.alt || '' }))
}));
// first images, sized by the CDN
let got = 0;
for (const p of out) {
  p.localImages = [];
  for (const [i, im] of p.images.slice(0, NIMG).entries()) {
    const file = `${String(p.id)}-${i + 1}.jpg`, dest = path.join(OUT, 'img', file);
    if (!fs.existsSync(dest)) {
      try { const r = await get(im.src.replace(/(\.\w+)(\?|$)/, `_${WIDTH}x$1$2`)); fs.writeFileSync(dest, Buffer.from(await r.arrayBuffer())); await sleep(Math.min(DELAY, 300)); } catch { try { const r = await get(im.src); fs.writeFileSync(dest, Buffer.from(await r.arrayBuffer())); } catch { continue; } }
    }
    p.localImages.push('img/' + file); got++;
  }
}
const prices = out.flatMap(p => p.variants.map(v => v.price)).filter(Boolean);
const count = k => Object.entries(out.reduce((m, p) => (p[k] && (m[p[k]] = (m[p[k]] || 0) + 1), m), {})).sort((x, y) => y[1] - x[1]);
const catalog = { source: origin, fetchedAt: new Date().toISOString(), counts: { products: out.length, collections: collections.length, images: got, variants: out.reduce((n, p) => n + p.variants.length, 0) }, priceRange: prices.length ? [Math.min(...prices), Math.max(...prices)] : null, vendors: count('vendor'), types: count('type'), collections, products: out };
writeJSON(path.join(OUT, 'catalog.json'), catalog);
console.log(`\n${out.length} products · ${collections.length} collections · ${got} images → ${path.join(OUT, 'catalog.json')}`);
