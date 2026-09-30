#!/usr/bin/env node
// The autonomy loop: keep a live site in step with the business behind it, without rebuilding it by hand.
//   node evolve.mjs --project projects/<slug>                    diff the current catalog against the last snapshot, report only
//   node evolve.mjs --project projects/<slug> --fetch            first take a fresh catalog from the store (one polite pass)
//   node evolve.mjs --project projects/<slug> --fetch --apply    ...then update everything the change touches and run the gates
// Config: projects/<slug>/evolve.json { store, catalogDir, brands, cutouts: {dir, manifest}, concepts, steps: {data, pages, build}, gates: {name: cmd} }
// What it does with a change:
//   new or removed products, prices, stock   → site data, product/collection/brand pages, sitemap, share cards (steps)
//   a brand the registry does not know       → a draft brand record: catalog facts, colours measured from its packaging,
//                                               a real product cutout, a visual brief; its origin and story stay empty
//                                               until a person verifies them on the brand's official site
//   every run                                → the copy gate and the SEO gates; a report of what changed, what was done,
//                                               and what needs a person (projects/<slug>/evolve/<date>.md)
// It never publishes, never generates images without --generate and a key, and stops at once if the store blocks the fetch.
import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';
import { parseArgs, repoRoot } from './lib.mjs';
const a = parseArgs(), ROOT = repoRoot();
if (!a.project) { console.error('usage: node evolve.mjs --project projects/<slug> [--fetch] [--apply] [--generate] [--against snapshot.json]'); process.exit(2); }
const PROJ = path.resolve(ROOT, a.project), CFG = JSON.parse(fs.readFileSync(path.join(PROJ, 'evolve.json'), 'utf8'));
const R = p => path.resolve(ROOT, p), S = f => path.join(ROOT, '.claude/skills/ailgen-studio/scripts', f);
const today = new Date().toISOString().slice(0, 10), stamp = new Date().toISOString().replace(/[:.]/g, '-');
const nHe = n => n === 1 ? 'מוצר אחד' : `${n} מוצרים`;
const CAT = R(CFG.catalogDir), HIST = path.join(CAT, 'history'); fs.mkdirSync(HIST, { recursive: true });
const log = [], needs = [], done = [];
const run = (label, cmd) => { const t0 = Date.now(); const r = spawnSync('sh', ['-c', cmd], { cwd: ROOT, encoding: 'utf8', env: process.env }); const ok = r.status === 0; log.push({ label, ok, s: +((Date.now() - t0) / 1000).toFixed(1), tail: (r.stdout + r.stderr).trim().split('\n').slice(-3).join(' | ').slice(0, 300) }); console.log(`${ok ? '✓' : '✗'} ${label} (${log[log.length - 1].s}s)`); return ok; };

// ---- 1 · the snapshot to compare with, and (optionally) a fresh catalog
const catFile = path.join(CAT, 'catalog.json');
const snaps = fs.readdirSync(HIST).filter(f => f.endsWith('.json')).sort();
if (a.fetch) {
  if (fs.existsSync(catFile)) fs.copyFileSync(catFile, path.join(HIST, `${stamp}.json`));
  if (!run('fetch the store catalog (public storefront JSON, robots.txt honoured)', `node ${S('shopify-catalog.mjs')} ${CFG.store} --out ${CFG.catalogDir} --delay 900`)) {
    needs.push('The store did not answer the catalog fetch (blocked or down). Nothing was retried or bypassed. Check the store, or run again later.');
    finish(); process.exit(1);
  }
}
const prevFile = a.against ? R(a.against) : (a.fetch ? path.join(HIST, `${stamp}.json`) : (snaps.length ? path.join(HIST, snaps[snaps.length - 1]) : null));
const cur = JSON.parse(fs.readFileSync(catFile, 'utf8')), prev = prevFile && fs.existsSync(prevFile) ? JSON.parse(fs.readFileSync(prevFile, 'utf8')) : null;
if (!prev) { fs.copyFileSync(catFile, path.join(HIST, `${stamp}.json`)); console.log('first run: snapshot saved, nothing to compare yet'); }

// ---- 2 · what changed
const byId = list => new Map(list.map(p => [p.id, p])), P0 = prev ? byId(prev.products) : new Map(), P1 = byId(cur.products);
const v0 = p => p.variants[0] || {}, money = n => '₪' + Math.round(n);
const added = prev ? cur.products.filter(p => !P0.has(p.id)) : [], removed = prev ? prev.products.filter(p => !P1.has(p.id)) : [];
const priced = [], stock = [];
for (const p of cur.products) { const o = P0.get(p.id); if (!o) continue; if (v0(o).price !== v0(p).price) priced.push({ t: p.title, from: v0(o).price, to: v0(p).price }); if (!!v0(o).available !== !!v0(p).available) stock.push({ t: p.title, now: v0(p).available ? 'חזר למלאי' : 'אזל' }); }
const change = { added: added.map(p => p.title), removed: removed.map(p => p.title), priced, stock };
const any = added.length || removed.length || priced.length || stock.length;

// ---- 3 · brands the registry does not know (names in titles, or a vendor other than the store)
const REGF = R(CFG.brands), REG = JSON.parse(fs.readFileSync(REGF, 'utf8'));
const known = p => REG.brands.some(b => b.match.some(m => (p.title + ' ' + (p.vendor || '')).toLowerCase().includes(m.toLowerCase())));
const STOP = new Set(['ml', 'my', 'new', 'strong', 'formula', 'kit', 'set', 'pro', 'professional', 'mini', 'lash', 'brow', 'lift', 'balm', 'deep', 'black', 'brown', 'bluish', 'glue', 'the', 'and', 'for', 'with', 'color', 'colour', 'cream', 'gel', 'xl', 'xs']);
const tokens = {}; for (const p of cur.products.filter(p => !known(p))) { const v = (p.vendor || '').trim(); const cands = [...(p.title.match(/[A-Za-z][A-Za-z'’-]{2,}(?:\s+[A-Z][A-Za-z'’-]{2,})?/g) || []), ...(v && !/eden/i.test(v) ? [v] : [])].filter(t => !STOP.has(t.toLowerCase())); for (const t of cands) (tokens[t] ||= []).push(p); }
const newBrands = Object.entries(tokens).filter(([t, ps]) => ps.length >= 1 && /^[A-Z]/.test(t)).map(([t, ps]) => ({ name: t, products: ps }));

// ---- 4 · apply
if (a.apply) {
  for (const nb of newBrands) {
    const key = nb.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    if (REG.brands.some(b => b.key === key)) continue;
    // colours from its packaging photos, and a real cutout of its first product
    const imgs = nb.products.map(p => path.join(CAT, 'img', `${p.id}-1.jpg`)).filter(f => fs.existsSync(f));
    let look = { field: '#F3EEEB', ink: '#241A18', accent: '#6F574B', soft: '#F7F2EF', type: 'caps-light', motif: 'measured', note: 'measured automatically; review' };
    if (imgs.length) { const r = spawnSync('python3', ['-c', `
import sys, json, numpy as np
from PIL import Image
px = []
for f in sys.argv[1:]:
    a = np.asarray(Image.open(f).convert('RGB').resize((96, 96))).reshape(-1, 3).astype(float)
    mx, mn = a.max(1), a.min(1); px.append(a[~((mx > 228) & ((mx - mn) / (mx + 1e-6) < .12))])
a = np.concatenate(px) if px else np.zeros((1, 3)); s = (a.max(1) - a.min(1))
acc = a[s.argsort()[-max(1, len(a) // 10):]].mean(0) if len(a) > 10 else a.mean(0)
h = lambda c: '#%02X%02X%02X' % tuple(int(max(0, min(255, v))) for v in c)
print(json.dumps({'accent': h(acc * .8), 'soft': h(acc * .08 + 255 * .92), 'field': h(acc * .12 + 255 * .88)}))`, ...imgs], { encoding: 'utf8' }); try { Object.assign(look, JSON.parse(r.stdout)); } catch { /* keep neutral */ } }
    let cut = null;
    if (imgs[0] && CFG.cutouts) { const out = path.join(R(CFG.cutouts.dir), `${key}.webp`); const r = spawnSync('python3', [S('cutout.py'), '--in', imgs[0], '--out', out, '--id', key, '--manifest', R(CFG.cutouts.manifest), '--max', '760'], { encoding: 'utf8' }); if (r.status === 0) cut = key; }
    REG.brands.push({ key, name: nb.name, match: [nb.name], status: 'draft', origin: null, about: { he: null, src: null, note: `found by evolve.mjs on ${today}: verify the origin and a one-line description on the brand's official site, then set status to verified` }, look, cut: cut || REG.house.cut });
    done.push(`מותג חדש נוסף כטיוטה: ${nb.name} (${nHe(nb.products.length)}). צבעים נמדדו מהאריזה${cut ? ', נחתך מוצר אמיתי לפאנל' : ''}.`);
    needs.push(`לאמת את ${nb.name}: ארץ מוצא ומשפט אחד מהאתר הרשמי של המותג (brands.json), ואז status: verified. עד אז הפאנל מציג רק עובדות מהחנות.`);
    // a visual brief for its brand field (generated only with --generate and a key, then reviewed)
    if (CFG.concepts) { const cf = R(CFG.concepts), C = JSON.parse(fs.readFileSync(cf, 'utf8')), field = C.concepts.find(c => c.id === 'field'); if (field && !field.perBrand[key]) { field.perBrand[key] = `a calm material study in ${look.accent} and ${look.field}, from the colours of its packaging`; fs.writeFileSync(cf, JSON.stringify(C, null, 1)); done.push(`נוסף בריף ויזואלי לשדה המותג ${nb.name}.`); } }
  }
  if (newBrands.length) fs.writeFileSync(REGF, JSON.stringify(REG, null, 1));
  if (any || newBrands.length || a.force) {
    const steps = Object.entries(CFG.steps || {}).filter(([, cmd]) => cmd); let ok = steps.length > 0;
    for (const [k, cmd] of steps) ok = run(`update: ${k}`, cmd) && ok;
    if (ok) done.push('נתוני האתר, עמודי המוצר, הקולקציות והמותגים, מפת האתר וכרטיסי השיתוף עודכנו.'); else if (steps.length) needs.push('שלב עדכון נכשל (הפירוט בטבלה למטה). האתר לא פורסם.');
  }
  if (a.generate && newBrands.length) for (const nb of newBrands) run(`generate the brand field for ${nb.name}`, `node ${S('imagegen.mjs')} --project ${a.project} --concept field --brand ${nb.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')} --tier draft`);
}
{ const noDesc = cur.products.filter(p => !String(p.text || '').trim()).map(p => p.title);
  if (noDesc.length) needs.push(`${noDesc.length} מוצרים בלי תיאור בחנות (לא נכתב להם תיאור מומצא): ${noDesc.slice(0, 5).join(' · ')}${noDesc.length > 5 ? ' ועוד' : ''}.`);
  const drafts = REG.brands.filter(b => b.status === 'draft'); if (drafts.length) needs.push(`מותגים שעדיין בטיוטה (בלי ארץ מוצא ותיאור מאומתים): ${drafts.map(b => b.name).join(', ')}.`); }
// ---- 5 · gates (every run)
for (const [k, cmd] of Object.entries(CFG.gates || {})) if (!run(`gate: ${k}`, cmd)) needs.push(`השער "${k}" נכשל: ${log[log.length - 1].tail}`);
if (!a.fetch && !a.against) fs.copyFileSync(catFile, path.join(HIST, `${stamp}.json`));
// keep the last three snapshots (they are the loop's memory between runs, and they are committed)
fs.readdirSync(HIST).filter(f => f.endsWith('.json')).sort().slice(0, -3).forEach(f => fs.unlinkSync(path.join(HIST, f)));
finish();

function finish() {
  const dir = path.join(PROJ, 'evolve'); fs.mkdirSync(dir, { recursive: true });
  const md = [`# סבב עדכון · ${today}`, '', `חנות: ${CFG.store} · מול: ${prevFile ? path.relative(ROOT, prevFile) : 'אין (סבב ראשון)'}`, '',
    '## מה השתנה בחנות', change.added.length || change.removed.length || change.priced.length || change.stock.length || newBrands.length ? '' : 'שום דבר.',
    ...change.added.map(t => `- חדש: ${t}`), ...change.removed.map(t => `- הוסר: ${t}`), ...change.priced.map(x => `- מחיר: ${x.t}: ${money(x.from)} → ${money(x.to)}`), ...change.stock.map(x => `- מלאי: ${x.t}: ${x.now}`), ...newBrands.map(b => `- מותג שלא היה ברשימה: ${b.name} (${nHe(b.products.length)})`),
    '', '## מה נעשה אוטומטית', ...(done.length ? done.map(x => `- ${x}`) : ['- (דיווח בלבד: הריצה בלי --apply)']),
    '', '## מה צריך אדם', ...(needs.length ? needs.map(x => `- ${x}`) : ['- כלום.']),
    '', '## שלבים ושערים', '| שלב | תוצאה | שניות |', '|---|---|---|', ...log.map(l => `| ${l.label} | ${l.ok ? 'עבר' : 'נכשל'} | ${l.s} |`), ''].join('\n');
  fs.writeFileSync(path.join(dir, `${today}.md`), md);
  fs.writeFileSync(path.join(dir, 'last.json'), JSON.stringify({ at: new Date().toISOString(), change, newBrands: newBrands.map(b => ({ name: b.name, n: b.products.length })), done, needs, log }, null, 1));
  console.log(`\nreport: ${path.relative(ROOT, path.join(dir, today + '.md'))} · ${change.added.length} new, ${change.removed.length} removed, ${change.priced.length} prices, ${change.stock.length} stock, ${newBrands.length} unknown brands · needs a person: ${needs.length}`);
}
