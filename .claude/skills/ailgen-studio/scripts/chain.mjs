#!/usr/bin/env node
// The chain check: every element of a studio project, the evidence that it exists, and what it cost to make.
//   node chain.mjs --project projects/<slug> [--init] [--soft]
//   --init   copy templates/chain.json into the project (flags to set by hand: url, store, mascot, film, seoOld)
//   --soft   report only; do not exit 1 on missing elements
// Reads projects/<slug>/chain.json (see templates/chain.json), checks each element by evidence (a file, a JSON field, a
// text in a file, a link in links.json, closed meter phases, a clean git tree), and joins the time and cost of the meter
// phase named on the element (`phase` or `phase/element` sub-phases from meter.mjs). Writes CHAIN.md and chain-report.json.
// A missing element is never silent: it is listed, and the exit code is 1, so the delivery step cannot pass with a gap.
import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';
import { parseArgs, repoRoot, writeJSON } from './lib.mjs';

const a = parseArgs(), ROOT = repoRoot(), HERE = path.dirname(new URL(import.meta.url).pathname);
if (!a.project) { console.error('usage: node chain.mjs --project projects/<slug> [--init] [--soft]'); process.exit(2); }
const PROJ = path.resolve(ROOT, a.project), slug = path.basename(PROJ), file = path.join(PROJ, 'chain.json');
if (a.init) { fs.copyFileSync(path.join(HERE, '../templates/chain.json'), file); console.log('chain.json created: set the flags, then run again without --init'); process.exit(0); }
const chain = JSON.parse(fs.readFileSync(file, 'utf8'));
const V = { slug, site: chain.site || slug, camp: `campaigns/${chain.camp || slug}` };
const sub = s => String(s).replace(/\{(\w+)\}/g, (_, k) => V[k] ?? '{' + k + '}');
const R = p => path.resolve(ROOT, sub(p));
const size = p => { try { const s = fs.statSync(R(p)); return s.isFile() ? s.size : -1; } catch { return -1; } };
const read = p => { try { return fs.readFileSync(R(p), 'utf8'); } catch { return ''; } };
const dig = (o, p) => p.split('.').reduce((x, k) => (x == null ? undefined : x[k]), o);
const filled = v => v !== undefined && v !== null && v !== '' && !(Array.isArray(v) && !v.length) && !(typeof v === 'object' && !Array.isArray(v) && !Object.keys(v).length);
const glob = pat => { const p = R(pat), d = path.dirname(p), re = new RegExp('^' + path.basename(p).replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*') + '$'); try { return fs.readdirSync(d).filter(f => re.test(f)); } catch { return []; } };
const links = (() => { try { return JSON.parse(fs.readFileSync(path.join(PROJ, 'links.json'), 'utf8')); } catch { return {}; } })();
const marks = (() => { try { return fs.readFileSync(path.join(PROJ, 'meter.jsonl'), 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l)); } catch { return []; } })();
const report = (() => { try { return JSON.parse(fs.readFileSync(path.join(PROJ, 'meter-report.json'), 'utf8')); } catch { return { rows: [] }; } })();
const has = (text, n) => typeof n === 'string' ? text.includes(n) : new RegExp(n.re).test(text);

function check(c) {
  const why = [];
  if (c.file) { const n = size(c.file); if (n < 0) why.push(`חסר ${sub(c.file)}`); else if (n < (c.min || 1)) why.push(`${sub(c.file)} קטן מדי (${n} בתים)`); else if (c.contains && !has(read(c.file), c.contains)) why.push(`ב-${sub(c.file)} חסר "${c.contains.re || c.contains}"`); }
  if (c.files) for (const f of c.files) if (size(f) <= 0) why.push(`חסר ${sub(f)}`);
  if (c.glob) { const n = glob(c.glob).length; if (n < (c.min || 1)) why.push(`${sub(c.glob)}: ${n} קבצים, נדרשו ${c.min || 1}`); }
  if (c.json) {
    let j; try { j = JSON.parse(read(c.json)); } catch { why.push(`חסר או שבור ${sub(c.json)}`); }
    if (j) {
      if (c.path !== undefined) { const v = dig(j, c.path); if (c.length !== undefined && (v?.length ?? -1) !== c.length) why.push(`${c.path}: אורך ${v?.length ?? 'חסר'}, נדרש ${c.length}`); if (c.minLength !== undefined && (v?.length ?? 0) < c.minLength) why.push(`${c.path}: ${v?.length ?? 0} פריטים, נדרשו ${c.minLength}`); if (c.equals !== undefined && v !== c.equals) why.push(`${c.path} אינו ${JSON.stringify(c.equals)}`); if (typeof c.minKeys === 'number' && Object.keys(v || {}).length < c.minKeys) why.push(`${c.path}: פחות מ-${c.minKeys} מפתחות`); if (c.length === undefined && c.minLength === undefined && c.equals === undefined && c.minKeys === undefined && !filled(v)) why.push(`${c.path} ריק`); }
      for (const p of c.paths || []) if (!filled(dig(j, p))) why.push(`${p} ריק ב-${path.basename(c.json)}`);
      if (c.minKeys && typeof c.minKeys === 'object') for (const [p, n] of Object.entries(c.minKeys)) if (Object.keys(dig(j, p) || {}).length < n) why.push(`${p}: פחות מ-${n}`);
    }
  }
  if (c.contains && !c.file) {
    const [f, ...needles] = c.contains;
    if (size(f) < 0) why.push(`חסר ${sub(f)}`);
    else { const t = read(f); for (const n of needles) { const nn = typeof n === 'string' ? sub(n) : { re: sub(n.re) }; if (!has(t, nn)) why.push(`ב-${sub(f)} חסר "${typeof n === 'string' ? nn : n.re}"`); } }
  }
  if (c.link) { const u = links[c.link]; if (!u || !/^https?:/.test(u)) why.push(`אין קישור "${c.link}" ב-links.json`); }
  if (c.meterClosed) {
    const open = new Map(); for (const m of marks) { if (m.ev === 'start') open.set(m.phase, true); else open.delete(m.phase); }
    if (!marks.length) why.push('אין סימוני מדידה'); else if (open.size) why.push(`שלבים פתוחים: ${[...open.keys()].join(', ')}`);
    if (!report.rows?.length) why.push('אין meter-report.json');
  }
  if (c.gitClean) { const r = spawnSync('git', ['status', '--porcelain', '--', ...c.gitClean.map(sub)], { cwd: ROOT, encoding: 'utf8' }); if (r.stdout.trim()) why.push(`${r.stdout.trim().split('\n').length} קבצים לא מחויבים`); }
  return why;
}

const flags = chain.flags || {};
const rows = chain.elements.map(e => {
  if ((e.when || []).some(f => !flags[f])) return { ...e, status: 'na', why: [] };
  const why = check(e.check || {}); return { ...e, status: why.length ? 'missing' : 'ok', why };
});
// time and cost per element: exact sub-phase `phase/id`, else the phase itself shared by its elements
const byPhase = new Map(report.rows.map(r => [r.phase, r]));
const per = new Map(); for (const r of rows) if (r.status !== 'na') per.set(r.phase, (per.get(r.phase) || 0) + 1);
for (const r of rows) {
  const own = byPhase.get(`${r.phase}/${r.id}`), ph = byPhase.get(r.phase);
  if (own) { r.ms = own.wallMs; r.cost = own.cost; r.timing = 'exact'; }
  else if (ph && r.status !== 'na') { r.ms = ph.wallMs / per.get(r.phase); r.cost = ph.cost / per.get(r.phase); r.timing = 'phase'; }
}
const ok = rows.filter(r => r.status === 'ok'), miss = rows.filter(r => r.status === 'missing'), na = rows.filter(r => r.status === 'na');
const mm = ms => ms == null ? '—' : ms >= 60000 ? (ms / 60000).toFixed(1) + ' דק׳' : Math.round(ms / 1000) + ' שנ׳';
const md = [`# בדיקת השרשרת: ${slug}`, '', `${new Date().toISOString().slice(0, 16).replace('T', ' ')} · ${chain.elements.length} אלמנטים · **${ok.length} קיימים** · ${miss.length ? `**${miss.length} חסרים**` : '0 חסרים'} · ${na.length} לא רלוונטיים`, '',
  miss.length ? '## חסרים (חוסמים מסירה)\n\n' + miss.map(r => `- **${r.label}** (${r.phase}): ${r.why.join('; ')}`).join('\n') + '\n' : 'כל אלמנט בשרשרת קיים, עם ראיה.\n',
  '## כל האלמנטים, עם זמן ועלות', '', 'זמן: `מדוד` = סימון משלו במדידה (`שלב/אלמנט`); `משוער` = חלק שווה מהשלב כולו.', '', '| שלב | אלמנט | מצב | זמן | עלות |', '|---|---|---|---|---|',
  ...rows.map(r => `| ${r.phase} | ${r.label} | ${r.status === 'ok' ? 'קיים' : r.status === 'na' ? 'לא רלוונטי' : '**חסר**'} | ${r.ms != null ? mm(r.ms) + (r.timing === 'exact' ? ' (מדוד)' : ' (משוער)') : '—'} | ${r.cost != null ? '$' + r.cost.toFixed(2) : '—'} |`), '',
  '## סיכום לפי שלב', '', '| שלב | אלמנטים | קיימים | זמן | עלות |', '|---|---|---|---|---|',
  ...[...new Set(rows.map(r => r.phase))].map(ph => { const rs = rows.filter(r => r.phase === ph && r.status !== 'na'), row = byPhase.get(ph); return `| ${ph} | ${rs.length} | ${rs.filter(r => r.status === 'ok').length} | ${row ? mm(row.wallMs) : '—'} | ${row ? '$' + row.cost.toFixed(2) : '—'} |`; })].join('\n') + '\n';
fs.writeFileSync(path.join(PROJ, 'CHAIN.md'), md);
writeJSON(path.join(PROJ, 'chain-report.json'), { slug, at: new Date().toISOString(), ok: ok.length, missing: miss.map(r => ({ id: r.id, phase: r.phase, why: r.why })), na: na.length, elements: rows.map(({ id, phase, label, status, ms, cost, timing }) => ({ id, phase, label, status, ms, cost, timing })) });
console.log(`${chain.elements.length} elements · ok ${ok.length} · missing ${miss.length} · n/a ${na.length}`);
for (const r of miss) console.log(`  ✗ [${r.phase}] ${r.label}: ${r.why.join('; ')}`);
process.exit(miss.length && !a.soft ? 1 : 0);
