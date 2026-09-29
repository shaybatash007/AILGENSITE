#!/usr/bin/env node
// Launch gate: request every old URL on the new host and prove that nothing was lost.
//   node seo-verify.mjs --map projects/<slug>/seo/plan/url-map.json --base https://example.co.il [--out dir] [--delay 300] [--preview]
// For each row of the URL map (from seo-plan.mjs):
//   keep  → 200 at the same URL with no redirect
//   301   → exactly one 301/308 hop to the planned successor, then 200 (no chains, no 302)
//   410   → 410
// and on every final page: real HTML, one non-empty h1 in the served HTML, a title, a canonical that points at the final
// URL's path, and no noindex (unless --preview). Exit code 1 when anything fails, so it can gate a deploy.
// Against a live host it waits --delay ms between requests (default 300); against 127.0.0.1 it does not.
import fs from 'fs';
import path from 'path';
import { ensureProxyEnv, parseArgs, writeJSON } from './lib.mjs';

ensureProxyEnv();
const a = parseArgs();
if (!a.map || !a.base) { console.error('usage: node seo-verify.mjs --map <url-map.json> --base <https://host> [--out dir] [--delay 300] [--preview]'); process.exit(2); }
const map = JSON.parse(fs.readFileSync(a.map, 'utf8')), BASE = a.base.replace(/\/$/, '');
const local = /^https?:\/\/(127\.|localhost|\[::1\])/.test(BASE), DELAY = +(a.delay ?? (local ? 0 : 300));
const OUT = path.resolve(a.out || path.join(path.dirname(a.map), '..', 'verify')); fs.mkdirSync(OUT, { recursive: true });
const UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const dec = p => { try { return decodeURIComponent(p).toLowerCase().replace(/\/?$/, '/'); } catch { return p.toLowerCase(); } };

/** One request, no automatic redirect following. */
const hop = async url => { try { return await fetch(url, { redirect: 'manual', headers: { 'user-agent': UA } }); } catch (e) { return { status: 0, error: String(e.message || e), headers: new Headers() }; } };

async function check(row) {
  const start = BASE + encodeURI(row.old); const chain = []; let url = start, res;
  for (let i = 0; i < 6; i++) {
    res = await hop(url); const loc = res.headers.get('location');
    chain.push({ url: decodeURI(url).replace(BASE, ''), status: res.status });
    if ([301, 302, 303, 307, 308].includes(res.status) && loc) { url = new URL(loc, url).href; if (DELAY) await sleep(DELAY); continue; }
    break;
  }
  const fails = [], redirects = chain.filter(c => [301, 302, 303, 307, 308].includes(c.status));
  const final = chain[chain.length - 1];
  if (row.action === '410') { if (final.status !== 410) fails.push(`צפוי 410, התקבל ${final.status}`); return { row, chain, fails }; }
  if (row.action === 'keep') { if (redirects.length) fails.push(`צפוי בלי הפניה, התקבלו ${redirects.length}`); }
  else if (row.action === '301') {
    if (redirects.length !== 1) fails.push(`צפוי 301 אחד, התקבלו ${redirects.length} (שרשרת)`);
    else if (![301, 308].includes(redirects[0].status)) fails.push(`ההפניה היא ${redirects[0].status} ולא 301`);
    if (dec(new URL(url).pathname) !== dec(row.new)) fails.push(`יעד שגוי: ${decodeURI(new URL(url).pathname)} במקום ${row.new}`);
  }
  if (final.status !== 200) { fails.push(`הכתובת הסופית מחזירה ${final.status}${res.error ? ' (' + res.error + ')' : ''}`); return { row, chain, fails }; }
  const html = await (await fetch(url, { headers: { 'user-agent': UA } })).text();
  if (!/<html/i.test(html)) fails.push('התשובה אינה HTML');
  const h1 = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i); if (!h1 || !h1[1].replace(/<[^>]+>/g, '').trim()) fails.push('אין h1 עם טקסט ב-HTML שנשלח');
  if (!/<title>[^<]{5,}<\/title>/i.test(html)) fails.push('אין title');
  const canon = (html.match(/<link[^>]+rel=["']canonical["'][^>]*href=["']([^"']+)["']/i) || [])[1];
  if (!canon) fails.push('אין canonical'); else if (dec(new URL(canon, url).pathname) !== dec(new URL(url).pathname)) fails.push(`canonical מצביע ל-${canon}`);
  if (!a.preview && /<meta[^>]+name=["']robots["'][^>]+noindex/i.test(html)) fails.push('העמוד עדיין noindex');
  return { row, chain, fails };
}

const rows = map.rows.filter(r => ['keep', '301', '410'].includes(r.action));
const results = [];
for (const r of rows) { results.push(await check(r)); if (DELAY) await sleep(DELAY); }
// site files
const site = {};
for (const f of ['/robots.txt', '/sitemap.xml']) { const r = await hop(BASE + f); site[f] = r.status; if (DELAY) await sleep(DELAY); }
const nf = await hop(BASE + '/seo-probe-' + Math.random().toString(36).slice(2, 8) + '/'); site.notFound = nf.status;
const siteFails = [];
if (site['/robots.txt'] !== 200) siteFails.push('robots.txt לא זמין');
if (site['/sitemap.xml'] !== 200) siteFails.push('sitemap.xml לא זמין');
if (site.notFound !== 404) siteFails.push(`כתובת לא קיימת מחזירה ${site.notFound} ולא 404`);
const failed = results.filter(r => r.fails.length);
const hops = results.reduce((m, r) => { const n = r.chain.filter(c => [301, 302, 307, 308].includes(c.status)).length; m[n] = (m[n] || 0) + 1; return m; }, {});
const ok = !failed.length && !siteFails.length;
const md = [`# אימות הגירה: ${BASE}`, '', `נבדק ב-${new Date().toISOString().slice(0, 16).replace('T', ' ')} · ${results.length} כתובות ישנות · **${ok ? 'עבר' : 'נכשל'}**`, '',
  `- עברו: ${results.length - failed.length} · נכשלו: ${failed.length}`, `- הפניות לכתובת: ${Object.entries(hops).map(([k, v]) => `${k} הפניות: ${v}`).join(' · ')}`,
  `- robots.txt: ${site['/robots.txt']} · sitemap.xml: ${site['/sitemap.xml']} · כתובת לא קיימת: ${site.notFound}`, ...siteFails.map(f => `- **${f}**`), '',
  ...(failed.length ? ['## כשלים', '', ...failed.flatMap(f => [`- \`${f.row.old}\` (${f.row.action}):`, ...f.fails.map(x => `  - ${x}`)])] : ['כל כתובת ישנה נשארת או מופנית בהפניה אחת ליורש שלה, וכל עמוד סופי עונה ב-HTML תקין עם h1, title ו-canonical.'])].join('\n') + '\n';
fs.writeFileSync(path.join(OUT, 'verify.md'), md); writeJSON(path.join(OUT, 'verify.json'), { base: BASE, ok, site, results });
console.log(`${results.length} urls · passed ${results.length - failed.length} · failed ${failed.length} · site checks ${siteFails.length ? 'FAILED: ' + siteFails.join('; ') : 'ok'}\nreport: ${path.join(OUT, 'verify.md')}`);
process.exit(ok ? 0 : 1);
