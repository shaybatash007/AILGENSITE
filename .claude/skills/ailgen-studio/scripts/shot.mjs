#!/usr/bin/env node
// Screenshot any local file (html, svg) or URL to a PNG: brand boards, icon sheets, logo exports, transparent PNGs.
//   node shot.mjs <file|url> <out.png> [--w 1200] [--h 800] [--scale 2] [--transparent] [--full] [--wait 300] [--sel "#board"] [--dark]
// --transparent renders with no page background (logo PNGs); --sel crops to one element; --dark sets prefers-color-scheme.
import { createRequire } from 'module';
import path from 'path';
import { pathToFileURL } from 'url';
import { parseArgs } from './lib.mjs';
const require = createRequire(import.meta.url);
let pw; try { pw = require('playwright'); } catch { pw = require('/opt/node22/lib/node_modules/playwright'); }
const a = parseArgs(), [src, out] = a._;
if (!src || !out) { console.error('usage: node shot.mjs <file|url> <out.png> [--w 1200] [--h 800] [--scale 2] [--transparent] [--full] [--sel css] [--dark]'); process.exit(2); }
const url = /^https?:|^file:/.test(src) ? src : pathToFileURL(path.resolve(src)).href;
const b = await pw.chromium.launch();
const ctx = await b.newContext({ viewport: { width: +(a.w || 1200), height: +(a.h || 800) }, deviceScaleFactor: +(a.scale || 1), colorScheme: a.dark ? 'dark' : 'light' });
const pg = await ctx.newPage();
await pg.goto(url, { waitUntil: 'networkidle' });
await pg.evaluate(() => document.fonts && document.fonts.ready);
if (a.wait) await pg.waitForTimeout(+a.wait);
const opt = { path: path.resolve(out), omitBackground: !!a.transparent };
if (a.sel) await (await pg.$(a.sel)).screenshot(opt); else await pg.screenshot({ ...opt, fullPage: !!a.full });
await b.close();
console.log('wrote', out);
