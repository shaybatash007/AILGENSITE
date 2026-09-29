#!/usr/bin/env node
// Download Google Fonts as local woff2 files (Hebrew + Latin subsets) and write fonts.css.
// Local fonts make video rendering deterministic and let a site self-host its type.
//   node fonts.mjs --out projects/x/fonts "Heebo:400,700,900" "Karantina:700" ["Frank Ruhl Libre:500,900"]
//   [--subsets hebrew,latin]  [--display block|swap]
import fs from 'fs';
import path from 'path';
import { ensureProxyEnv, parseArgs } from './lib.mjs';

ensureProxyEnv();
const args = parseArgs();
const OUT = path.resolve(args.out || 'fonts');
const SUBSETS = String(args.subsets || 'hebrew,latin').split(',');
const DISPLAY = args.display || 'block';
// a current desktop Chrome UA makes the CSS API answer with woff2 split into unicode-range subsets
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36';
if (!args._.length) {
  console.error('usage: node fonts.mjs --out <dir> "Family:400,700" ["Other Family:500"] [--subsets hebrew,latin]');
  process.exit(2);
}
fs.mkdirSync(OUT, { recursive: true });

/**
 * Fetch one family's CSS and download the requested subsets.
 * @param {string} spec  "Family Name:400,700" (weights optional, default 400)
 * @returns {Promise<string[]>} rewritten @font-face blocks
 */
async function family(spec) {
  const [name, w = '400'] = spec.split(':');
  const weights = w.split(',').map(x => x.trim()).filter(Boolean).sort((a, b) => a - b);
  const url = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(name.trim()).replace(/%20/g, '+')}:wght@${weights.join(';')}&display=${DISPLAY}`;
  const r = await fetch(url, { headers: { 'user-agent': UA } });
  if (!r.ok) throw new Error(`${name}: Google Fonts answered ${r.status} (check the family name and weights)`);
  const css = await r.text();
  const blocks = [...css.matchAll(/\/\*\s*([\w-]+)\s*\*\/\s*(@font-face\s*{[^}]+})/g)];
  // Variable fonts come back once per requested weight, all pointing at the same file. Download it once and declare a weight range:
  // three weights used to mean three identical downloads (Eden: 435 KB of fonts, 118 KB after this, first paint 3.2 s -> 1.6 s on mobile).
  const groups = new Map();
  for (const [, subset, block] of blocks) {
    if (!SUBSETS.includes(subset)) continue;
    const src = block.match(/url\((https:[^)]+\.woff2)\)/)?.[1];
    if (!src) continue;
    const weight = +(block.match(/font-weight:\s*(\d+)/)?.[1] || 400);
    const style = block.match(/font-style:\s*(\w+)/)?.[1] || 'normal';
    const key = subset + '|' + style + '|' + src;
    const g = groups.get(key) || { subset, style, src, block, weights: [] };
    g.weights.push(weight); groups.set(key, g);
  }
  const out = [];
  for (const g of groups.values()) {
    const lo = Math.min(...g.weights), hi = Math.max(...g.weights), range = g.weights.length > 1;
    const file = `${name.trim().replace(/\s+/g, '')}-${range ? `${lo}-${hi}` : lo}${g.style === 'italic' ? 'i' : ''}-${g.subset}.woff2`;
    const f = await fetch(g.src, { headers: { 'user-agent': UA } });
    if (!f.ok) throw new Error(`${name}: download failed ${f.status}`);
    fs.writeFileSync(path.join(OUT, file), Buffer.from(await f.arrayBuffer()));
    let block = g.block.replace(g.src, file).replace(/font-display:\s*\w+/, `font-display: ${DISPLAY}`);
    if (range) block = block.replace(/font-weight:\s*\d+/, `font-weight: ${lo} ${hi}`);
    out.push(`/* ${g.subset} */\n` + block);
    console.log('font', file, range ? `(variable, weights ${lo}-${hi})` : '');
  }
  if (!out.length) console.warn(`${name}: none of the subsets ${SUBSETS.join(',')} exist for this family`);
  return out;
}

const css = [];
for (const spec of args._) css.push(...await family(spec));
fs.writeFileSync(path.join(OUT, 'fonts.css'), css.join('\n') + '\n');
console.log(`wrote ${path.join(OUT, 'fonts.css')} (${css.length} faces)`);
