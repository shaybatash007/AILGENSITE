#!/usr/bin/env node
// Lighthouse (mobile and desktop) against a production-like local server (gzip, _headers, redirects), dated, into qa/lighthouse.json.
//   node lighthouse.mjs --site <static dir> --out projects/<slug>/qa [--path /] [--extra /products/x/,/collections/y/]
// Uses `npx lighthouse@12` with the pre-installed Chromium (no download). Reports scores and the core lab metrics.
import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import { parseArgs, repoRoot } from './lib.mjs';
import { startServer } from './seo-serve.mjs';
const a = parseArgs(), ROOT = repoRoot();
if (!a.site) { console.error('usage: node lighthouse.mjs --site <dir> --out <qa dir> [--path /] [--extra /a/,/b/]'); process.exit(2); }
const OUT = path.resolve(ROOT, a.out || 'qa'); fs.mkdirSync(OUT, { recursive: true });
// --launch: measure a copy with the preview flag removed (a preview is noindex on purpose and fails the "is crawlable" audit, which says nothing about the launch build)
let siteDir = path.resolve(ROOT, a.site);
if (a.launch) {
  const tmp = fs.mkdtempSync('/tmp/lh-launch-'); fs.cpSync(siteDir, tmp, { recursive: true }); siteDir = tmp;
  const walk = d => fs.readdirSync(d, { withFileTypes: true }).forEach(e => { const f = path.join(d, e.name); if (e.isDirectory()) walk(f); else if (/\.html$/.test(e.name)) fs.writeFileSync(f, fs.readFileSync(f, 'utf8').replace(/<meta name="robots" content="noindex[^>]*>\n?/g, '')); });
  walk(tmp);
}
const server = await startServer({ dir: siteDir });
const chrome = process.env.CHROME_PATH || '/opt/pw-browsers/chromium';
const paths = [a.path || '/', ...String(a.extra || '').split(',').filter(Boolean)];
// async on purpose: the test server lives in this process, and a synchronous spawn would freeze it
const run = (cmd, args, env, ms) => new Promise(res => { const c = spawn(cmd, args, { env, stdio: ['ignore', 'ignore', 'pipe'] }); let err = ''; c.stderr.on('data', d => err = (err + d).slice(-400)); const t = setTimeout(() => c.kill('SIGKILL'), ms); c.on('close', code => { clearTimeout(t); res({ status: code, stderr: err }); }); });
const summary = { at: new Date().toISOString(), tool: 'lighthouse@12', url: server.url, note: 'local production-like server with gzip; lab data, not field data' + (a.launch ? '; measured on a copy without the preview noindex (launch state)' : '; preview build, noindex on purpose') };
for (const [i, p] of paths.entries()) {
  for (const mode of ['mobile', 'desktop']) {
    const file = path.join(OUT, `lh-${i}-${mode}.json`);
    const args = ['-y', 'lighthouse@12', server.url + encodeURI(p), '--output=json', '--output-path=' + file, '--quiet', '--chrome-flags=--headless=new --no-sandbox', ...(mode === 'desktop' ? ['--preset=desktop'] : [])];
    const r = await run('npx', args, { ...process.env, CHROME_PATH: chrome }, 240000);
    if (r.status || !fs.existsSync(file)) { console.error(mode, p, 'failed:', r.stderr); continue; }
    const j = JSON.parse(fs.readFileSync(file, 'utf8')), sc = k => Math.round((j.categories[k]?.score ?? 0) * 100), m = k => j.audits[k]?.numericValue;
    const row = { performance: sc('performance'), accessibility: sc('accessibility'), bestPractices: sc('best-practices'), seo: sc('seo'), lcpMs: Math.round(m('largest-contentful-paint')), cls: +(m('cumulative-layout-shift') || 0).toFixed(3), tbtMs: Math.round(m('total-blocking-time')), fcpMs: Math.round(m('first-contentful-paint')), speedIndexMs: Math.round(m('speed-index')), transferKB: Math.round((m('total-byte-weight') || 0) / 1024) };
    // what is not passing, so the numbers can be worked on and not only quoted
    row.fails = Object.values(j.audits).filter(x => x.score !== null && x.score < 0.9 && x.scoreDisplayMode !== 'informative' && x.scoreDisplayMode !== 'manual' && x.scoreDisplayMode !== 'notApplicable').map(x => `${x.id}${x.displayValue ? ' (' + x.displayValue + ')' : ''}`);
    row.lcpElement = j.audits['largest-contentful-paint-element']?.details?.items?.[0]?.items?.[0]?.node?.snippet?.slice(0, 120) || null;
    if (a.keep) fs.copyFileSync(file, path.join(OUT, `lh-${i}-${mode}.full.json`));
    if (i === 0) summary[mode] = row; else (summary.pages ||= {})[p + ' ' + mode] = row;
    console.log(mode.padEnd(8), p.padEnd(40), JSON.stringify(row));
    fs.rmSync(file, { force: true });
  }
}
await server.close();
fs.writeFileSync(path.join(OUT, 'lighthouse.json'), JSON.stringify(summary, null, 1));
console.log('→', path.join(OUT, 'lighthouse.json'));
