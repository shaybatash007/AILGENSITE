#!/usr/bin/env node
// The whole SEO phase in one command, with gates. Run it after every change to the site; run it with --launch on launch day.
//   node seo-run.mjs --project projects/<slug> [--launch] [--refresh-old] [--skip-old]
// Reads projects/<slug>/seo/seo.config.json:
//   { "site": "https://example.co.il",          production origin (canonical, sitemap, llms.txt)
//     "siteDir": "example",                      the built static site
//     "oldUrl": "https://example.co.il/",        existing site to inherit from; omit for a new business
//     "compose": "projects/example/seo/compose.mjs",   optional: builds pages.json and the home page markers from intake + data
//     "pages":   "projects/example/seo/pages.json",
//     "build":   "sh example/build.sh",          optional: assembles the home page
//     "after":   ["node projects/example/seo/compare.mjs"] }
// Steps: old-site audit → compose → social cards → compose again → pages + 404 → build → plan (url-map, _redirects,
// sitemap, robots, _headers, llms.txt, launch.md) → serve like production → audit the new build (gate) → verify every old URL.
// Writes projects/<slug>/seo/RUN.md. Exit code 1 when a gate fails, so a deploy script can rely on it.
import { fileURLToPath } from 'url';
import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import { parseArgs, repoRoot } from './lib.mjs';
import { startServer } from './seo-serve.mjs';

const a = parseArgs(), ROOT = repoRoot(), HERE = path.dirname(fileURLToPath(import.meta.url));
if (!a.project) { console.error('usage: node seo-run.mjs --project projects/<slug> [--launch] [--refresh-old]'); process.exit(2); }
const PROJ = path.resolve(ROOT, a.project), SEO = path.join(PROJ, 'seo');
const cfg = JSON.parse(fs.readFileSync(path.join(SEO, 'seo.config.json'), 'utf8'));
const rel = p => path.resolve(ROOT, p), launch = !!a.launch;
// children run asynchronously: the production-like server lives in this process and must keep answering while they work
const run = (cmd, args) => new Promise(res => spawn(cmd, args, { cwd: ROOT, stdio: 'inherit' }).on('exit', code => res(code === 0)).on('error', () => res(false)));
const node = (script, args) => run(process.execPath, [script, ...args]);
const sh = cmd => run('sh', ['-c', cmd]);
const S = f => path.join(HERE, f);
const steps = [];
async function step(name, fn, { gate = false } = {}) {
  const t0 = Date.now(); console.log(`\n=== ${name}`); let ok = true, note = '';
  try { const r = await fn(); if (r === false) ok = false; else if (typeof r === 'string') note = r; } catch (e) { ok = false; note = String(e.message || e); console.error(e); }
  steps.push({ name, ok, gate, note, s: Math.round((Date.now() - t0) / 100) / 10 });
  return ok;
}

const oldReport = path.join(SEO, 'old', 'seo-report.json'), planDir = path.join(SEO, 'plan');
const hasOld = !!cfg.oldUrl && !a['skip-old'];
if (hasOld) await step('audit the old site (what we inherit)', () => (fs.existsSync(oldReport) && !a['refresh-old']) ? 'exists, reused (--refresh-old to crawl again)' : node(S('seo-audit.mjs'), [cfg.oldUrl, '--out', path.join(SEO, 'old'), '--max', '80', '--delay', '900']));
if (cfg.compose) await step('compose pages and home from intake and data', () => node(rel(cfg.compose), []));
const pagesFile = cfg.pages && rel(cfg.pages);
if (pagesFile && fs.existsSync(pagesFile)) {
  const hasOg = JSON.parse(fs.readFileSync(pagesFile, 'utf8')).home;
  if (hasOg) { await step('social preview cards', () => node(S('seo-og.mjs'), ['--config', pagesFile])); if (cfg.compose) await step('compose again (picks up the cards)', () => node(rel(cfg.compose), [])); }
  await step('render crawlable pages and 404', () => node(S('seo-pages.mjs'), ['--config', pagesFile]));
}
if (cfg.build) await step('build the home page', () => sh(cfg.build));
if (hasOld && fs.existsSync(oldReport)) {
  await step('migration plan (url-map, _redirects, sitemap, robots, _headers, llms.txt, launch.md)', () => node(S('seo-plan.mjs'), ['--old', oldReport, '--new-dir', rel(cfg.siteDir), '--site', cfg.site, '--out', planDir, '--copy', ...(launch ? ['--launch'] : []), ...(fs.existsSync(path.join(SEO, 'redirect-overrides.json')) ? ['--overrides', path.join(SEO, 'redirect-overrides.json')] : []), ...['robots-extra', 'redirects-extra', 'external'].flatMap(k => fs.existsSync(path.join(SEO, k + '.txt')) ? ['--' + k, path.join(SEO, k + '.txt')] : [])]), { gate: true });
} else await step('sitemap and robots for a new site', () => node(S('seo-plan.mjs'), ['--new-dir', rel(cfg.siteDir), '--site', cfg.site, '--out', planDir, '--copy', ...(launch ? ['--launch'] : []), ...['robots-extra', 'redirects-extra', 'external'].flatMap(k => fs.existsSync(path.join(SEO, k + '.txt')) ? ['--' + k, path.join(SEO, k + '.txt')] : [])]));
const server = await startServer({ dir: rel(cfg.siteDir) });
try {
  await step(`audit the new build (gate: no high findings) at ${server.url}`, () => node(S('seo-audit.mjs'), [server.url + '/', '--out', path.join(SEO, 'new'), '--delay', '120', '--max', '120', '--gate', 'high', ...(launch ? [] : ['--preview'])]), { gate: true });
  if (fs.existsSync(path.join(planDir, 'url-map.json'))) await step('verify every old URL on the production-like server', () => node(S('seo-verify.mjs'), ['--map', path.join(planDir, 'url-map.json'), '--base', server.url, '--out', path.join(SEO, 'verify'), ...(launch ? [] : ['--preview'])]), { gate: true });
} finally { await server.close(); }
for (const cmd of cfg.after || []) await step(cmd, () => sh(cmd));

const gates = steps.filter(s => s.gate), bad = steps.filter(s => !s.ok), ok = !bad.length;
const md = [`# ריצת SEO: ${cfg.site}`, '', `${new Date().toISOString().slice(0, 16).replace('T', ' ')} · מצב: ${launch ? 'השקה (index, HSTS)' : 'תצוגה מקדימה (noindex)'} · **${ok ? 'כל השערים עברו' : 'יש כשלים'}**`, '', '| שלב | תוצאה | שניות |', '|---|---|---|', ...steps.map(s => `| ${s.name}${s.gate ? ' (שער)' : ''} | ${s.ok ? 'עבר' : '**נכשל**'}${s.note ? ' · ' + s.note : ''} | ${s.s} |`), '',
  'קבצים: `plan/plan.md` (הגירה), `plan/launch.md` (השקה ושבועות אחריה), `new/seo-report.md` (ביקורת), `verify/verify.md` (אימות כתובות ישנות), `old/seo-report.md` (מה ירשנו).'].join('\n') + '\n';
fs.writeFileSync(path.join(SEO, 'RUN.md'), md);
console.log(`\n${ok ? 'ALL GATES PASSED' : 'FAILED: ' + bad.map(s => s.name).join('; ')}  (${gates.length} gates) → ${path.relative(ROOT, path.join(SEO, 'RUN.md'))}`);
process.exit(ok ? 0 : 1);
