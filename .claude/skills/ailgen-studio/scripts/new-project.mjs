#!/usr/bin/env node
// Start a studio project from any of the three inputs, and prepare everything the next phases need.
//   node new-project.mjs --url https://example.co.il [--slug example]        existing site: crawl it
//   node new-project.mjs --concept "בוטיק לקפה מיוחד בחיפה, אווירה חמה" --slug haifa-coffee
//   node new-project.mjs --name "אור ים" [--type "מסעדת דגים"] --slug or-yam
// Creates projects/<slug>/ with brief.md, brand.json, film.json (from templates), and for --url:
// intake/ (texts, media, shots, contacts) plus a palette suggestion and brand.json pre-filled from the site.
import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';
import { parseArgs, repoRoot, slugify, writeJSON } from './lib.mjs';

const args = parseArgs();
const HERE = path.dirname(new URL(import.meta.url).pathname);
const TPL = path.join(HERE, '../templates');
const ROOT = repoRoot();
const mode = args.url ? 'url' : args.concept ? 'concept' : args.name ? 'name' : null;
if (!mode) {
  console.error('usage: node new-project.mjs --url <site> | --concept "<text>" | --name "<name>"  [--slug s] [--type "<business type>"]');
  process.exit(2);
}
const source = args.url || args.concept || args.name;
const slug = slugify(args.slug || (args.url ? new URL(args.url).hostname.replace(/^www\./, '').split('.')[0] : args.name || 'project'));
const DIR = path.join(ROOT, 'projects', slug);
if (fs.existsSync(path.join(DIR, 'brand.json')) && !args.force) { console.error(`projects/${slug} already exists (use --force to refresh the intake only)`); process.exit(1); }
fs.mkdirSync(DIR, { recursive: true });

const brand = JSON.parse(fs.readFileSync(path.join(TPL, 'brand.json'), 'utf8'));
brand.slug = slug; brand.source = { mode, url: args.url || '', brief: args.concept || '' };
if (args.name) brand.name = args.name;
if (args.type) brand.business.type = args.type;
if (mode === 'concept') brand.status = 'concept';

if (mode === 'url') {
  const intake = path.join(DIR, 'intake');
  const r = spawnSync(process.execPath, [path.join(HERE, 'intake.mjs'), args.url, '--out', intake, '--max', String(args.max || 30), '--delay', String(args.delay || 1200), '--media', String(args.media || 80)], { stdio: 'inherit' });
  if (r.status !== 0) { console.error('intake failed: see the log above. The folder is kept so you can retry.'); process.exit(1); }
  const site = JSON.parse(fs.readFileSync(path.join(intake, 'site.json'), 'utf8'));
  brand.name = brand.name || site.name;
  brand.status = 'real-client';
  const d = site.design || {};
  brand.palette = { ink: d.text?.[0]?.hex || '', paper: d.backgrounds?.[0]?.hex || '', accent: d.buttons?.find(b => !['#FFFFFF', '#000000'].includes(b.hex))?.hex || '', accent2: '', fromSite: { backgrounds: d.backgrounds, text: d.text, buttons: d.buttons } };
  brand.type.fromSite = d.fonts;
  brand.contacts = site.contacts;
  const logos = site.media.filter(m => m.logo && m.file && !/\.svg$/.test(m.file)).map(m => path.join(intake, m.file));
  const shots = [path.join(intake, 'shots/home-desktop.png')].filter(fs.existsSync);
  if (logos.length || shots.length) {
    const p = spawnSync('python3', [path.join(HERE, 'palette.py'), ...logos, ...shots, '--out', path.join(intake, 'palette.json')], { encoding: 'utf8' });
    if (p.status === 0) console.log('palette suggestion -> intake/palette.json');
  }
}
if (!brand.name) brand.name = args.name || slug;
writeJSON(path.join(DIR, 'brand.json'), brand);

const film = JSON.parse(fs.readFileSync(path.join(TPL, 'film.json'), 'utf8'));
film.name = brand.name;
writeJSON(path.join(DIR, 'film.json'), film);

const brief = fs.readFileSync(path.join(TPL, 'brief.md'), 'utf8')
  .replace('{{NAME}}', brand.name).replace('{{DATE}}', new Date().toISOString().slice(0, 10))
  .replace('{{MODE}}', mode).replace('{{SOURCE}}', source);
if (!fs.existsSync(path.join(DIR, 'brief.md'))) fs.writeFileSync(path.join(DIR, 'brief.md'), brief);

console.log(`\nproject ready: projects/${slug}/`);
console.log(fs.readdirSync(DIR).map(f => '  ' + f).join('\n'));
console.log(`\nnext: phase 1 (intake) is ${mode === 'url' ? 'done: read intake/summary.md and intake/content.md' : 'research: fill brief.md from the concept/name'}; then brand DNA (references/01-brand-dna.md).`);
