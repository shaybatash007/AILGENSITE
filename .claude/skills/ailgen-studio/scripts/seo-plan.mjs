#!/usr/bin/env node
// SEO migration plan: keep or redirect every old URL, and generate the files the new site needs.
//   node seo-plan.mjs --old projects/<slug>/seo/old/seo-report.json --new-dir <slug> --site https://example.co.il \
//        --out projects/<slug>/seo/plan [--copy] [--noindex-preview]
// Inputs
//   --old      the report written by seo-audit.mjs on the OLD site (its crawl + every sitemap URL)
//   --new-dir  the built new site (static export): every folder with an index.html is a page; the root one is "/"
//   --site     the production origin, used for sitemap.xml, canonical checks and robots.txt
// Output (in --out)
//   url-map.csv / url-map.json   every old URL → keep | 301 → new URL | decide (with confidence and why)
//   _redirects                   Cloudflare Pages / Netlify syntax, one 301 per changed URL
//   sitemap.xml, robots.txt      for the new site (with --copy they are also written into --new-dir)
//   plan.md                      the summary for people, in Hebrew, including old pages with no good successor
// Matching: same path → keep. Otherwise the old title (brand suffix removed) is compared with each new page's
// title and h1 (shared meaningful words). Below the threshold the row is "decide": a person chooses. Never
// redirect everything to the home page.
import fs from 'fs';
import path from 'path';
import { parseArgs, writeJSON } from './lib.mjs';
import { tokens, overlap } from './seo-lib.mjs';

const a = parseArgs();
if (!a.old || !a['new-dir'] || !a.site) { console.error('usage: node seo-plan.mjs --old <seo-report.json> --new-dir <folder> --site <https://origin> [--out dir] [--copy]'); process.exit(2); }
const OUT = path.resolve(a.out || 'seo/plan'); fs.mkdirSync(OUT, { recursive: true });
const SITE = a.site.replace(/\/$/, ''), NEW = path.resolve(a['new-dir']), THRESH = +(a.threshold || 0.45);
const old = JSON.parse(fs.readFileSync(a.old, 'utf8'));
const overrides = a.overrides ? JSON.parse(fs.readFileSync(a.overrides, 'utf8')) : {}; // { '/old/path/': '/new/path/' | 410 }, decided by a person or the composer

/** Canonical path form: decoded, lower-case, one trailing slash, no query. */
const P = u => { try { const x = new URL(u, SITE + '/'); return decodeURIComponent(x.pathname).toLowerCase().replace(/\/?$/, '/'); } catch { return null; } };
const enc = p => encodeURI(p);

// ---- new site inventory: every index.html below --new-dir
const SKIP = /(^|\/)(node_modules|fonts|img|assets|m|src|\.git)(\/|$)/;
function scan(dir, rel = '') {
  const out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const r = path.posix.join(rel, e.name);
    if (e.isDirectory()) { if (!SKIP.test(r)) out.push(...scan(path.join(dir, e.name), r)); }
    else if (e.name === 'index.html') {
      const html = fs.readFileSync(path.join(dir, e.name), 'utf8'), st = fs.statSync(path.join(dir, e.name));
      const title = (html.match(/<title>([^<]*)<\/title>/i) || [])[1] || '', h1 = ((html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i) || [])[1] || '').replace(/<[^>]+>/g, ' ');
      out.push({ path: '/' + (rel ? rel + '/' : '').toLowerCase(), title, h1, lastmod: st.mtime.toISOString().slice(0, 10), noindex: /<meta[^>]+name=["']robots["'][^>]+noindex/i.test(html) });
    }
  }
  return out;
}
const fresh = scan(NEW);
if (!fresh.length) { console.error('no index.html found in ' + NEW); process.exit(1); }
const newSet = new Map(fresh.map(p => [p.path, p]));

// ---- old inventory: crawled pages plus every sitemap URL (the owner's own list of what should be indexed)
const oldPages = new Map();
for (const p of old.pages) oldPages.set(P(p.url), { url: p.url, title: p.title, inbound: p.inbound, status: p.status, inSitemap: p.inSitemap, words: p.wordsRendered });
for (const u of old.site.sitemapUrls) { const k = P(u); if (k && !oldPages.has(k)) oldPages.set(k, { url: u, title: '', inbound: 0, status: null, inSitemap: true, words: 0 }); }

// ---- matching
const toks = tokens;
const newToks = fresh.map(p => ({ p, t: new Set([...toks(p.title), ...toks(p.h1)]) }));

const rows = [];
for (const [k, o] of [...oldPages].sort((x, y) => y[1].inbound - x[1].inbound)) {
  const row = { old: decodeURIComponent(new URL(o.url).pathname), oldTitle: o.title, inbound: o.inbound, status: o.status, words: o.words, action: '', new: '', confidence: 0, why: '' };
  if (o.status && o.status >= 400) { row.action = 'skip'; row.why = `כבר מחזיר ${o.status}`; rows.push(row); continue; }
  const ov = overrides[k] ?? overrides[decodeURIComponent(k)];
  if (ov === 410) { row.action = '410'; row.why = 'הוסר בהסכמה'; rows.push(row); continue; }
  if (ov && !newSet.has(k)) { row.action = '301'; row.new = ov; row.confidence = 1; row.why = 'הוחלט בתהליך (כפילות, דף זמני או עמוד יורש)'; rows.push(row); continue; }
  if (newSet.has(k)) { row.action = 'keep'; row.new = k; row.confidence = 1; row.why = 'אותה כתובת קיימת באתר החדש'; rows.push(row); continue; }
  const ot = toks(o.title || decodeURIComponent(k).replace(/[-_/]/g, ' '));
  const best = newToks.map(({ p, t }) => ({ p, s: overlap(ot, t) })).sort((x, y) => y.s - x.s)[0];
  if (best && best.s >= THRESH) { row.action = '301'; row.new = best.p.path; row.confidence = +best.s.toFixed(2); row.why = 'התאמה לפי שם וכותרת'; }
  else { row.action = 'decide'; row.new = best?.p.path || '/'; row.confidence = +(best?.s || 0).toFixed(2); row.why = 'אין יורש טוב. מי שמחליט: מוסיפים עמוד, או מפנים לעמוד קרוב, או 410 באישור הבעלים'; }
  rows.push(row);
}

// ---- verification: every redirect target must be a real new page (no chains, no dead ends)
for (const r of rows.filter(r => r.action === '301')) {
  if (!newSet.has(r.new)) { r.action = 'decide'; r.why = `היעד ${r.new} לא קיים באתר החדש. ` + r.why; }
}
const verifyOk = rows.filter(r => r.action === '301').every(r => newSet.has(r.new) && !overrides[r.new]);

// ---- files
const keep = rows.filter(r => r.action === 'keep'), red = rows.filter(r => r.action === '301'), gone = rows.filter(r => r.action === '410'), dec = rows.filter(r => r.action === 'decide');
const redirects = ['# generated by seo-plan.mjs: one 301 per changed URL, never a chain. Verify on the real host (non-ASCII paths).',
  ...red.map(r => `${enc(r.old)} ${enc(r.new)} 301${r.confidence < 0.7 ? ' # REVIEW ' + r.confidence : ''}`),
  ...gone.map(r => `${enc(r.old)} /404/ 410`),
  ...dec.map(r => `# DECIDE ${enc(r.old)} -> ${enc(r.new)} (${r.why})`)].join('\n') + '\n';
const live = a.launch ? fresh.filter(p => !p.noindex) : fresh; // before launch every page is noindex; the sitemap still lists them
const sitemap = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${live.map(p => `  <url><loc>${SITE}${enc(p.path)}</loc><lastmod>${p.lastmod}</lastmod></url>`).join('\n')}\n</urlset>\n`;
const robots = `User-agent: *\nAllow: /\n\nSitemap: ${SITE}/sitemap.xml\n`;
const csv = ['old,old_title,inbound_links,action,new,confidence,why', ...rows.map(r => [r.old, r.oldTitle, r.inbound, r.action, r.new, r.confidence, r.why].map(v => `"${String(v).replace(/"/g, '""')}"`).join(','))].join('\n') + '\n';
fs.writeFileSync(path.join(OUT, 'url-map.csv'), csv); writeJSON(path.join(OUT, 'url-map.json'), { site: SITE, newPages: fresh, rows });
fs.writeFileSync(path.join(OUT, '_redirects'), redirects); fs.writeFileSync(path.join(OUT, 'sitemap.xml'), sitemap); fs.writeFileSync(path.join(OUT, 'robots.txt'), robots);
if (a.copy) for (const f of ['_redirects', 'sitemap.xml', 'robots.txt']) fs.copyFileSync(path.join(OUT, f), path.join(NEW, f));

const total = rows.filter(r => r.action !== 'skip').length, covered = keep.length + red.length + gone.length;
const md = [`# תוכנית הגירה ל-SEO: ${SITE}`, '',
  `כתובות ישנות (סרוקות + ממפת האתר): **${oldPages.size}** · עמודים באתר החדש: **${fresh.length}** (${fresh.filter(p => p.noindex).length} מסומנים noindex)`, '',
  `- נשארות באותה כתובת: **${keep.length}**`, `- 301 לעמוד יורש: **${red.length}**`, `- 410 (הוסרו בהסכמה): ${gone.length}`, `- דורשות החלטה (אין יורש): **${dec.length}**`, `- כבר מחזירות שגיאה: ${rows.filter(r => r.action === 'skip').length}`, '',
  `בדיקת יעדים: ${verifyOk ? 'כל יעד 301 הוא עמוד קיים באתר החדש, בלי שרשראות' : 'יש יעדים שבורים, ראו "דורשות החלטה"'}.`, '',
  `כיסוי: **${total ? Math.round(covered / total * 100) : 100}%** מהכתובות הישנות שומרות על הערך שלהן. המטרה לפני השקה: 100%.`, ''];
if (dec.length) { md.push('## כתובות שאין להן יורש (מסודר לפי קישורים נכנסים)', '', '| כתובת ישנה | title ישן | נכנסים | ההתאמה הקרובה ביותר |', '|---|---|---|---|'); for (const r of dec) md.push(`| ${r.old.slice(0, 60)} | ${(r.oldTitle || '—').slice(0, 55)} | ${r.inbound} | ${r.new} (${r.confidence}) |`); md.push(''); }
if (red.length) { md.push('## הפניות 301 שנוצרו', '', '| מ | אל | ביטחון |', '|---|---|---|'); for (const r of red) md.push(`| ${r.old.slice(0, 60)} | ${r.new} | ${r.confidence} |`); md.push(''); }
md.push('## אחרי הפריסה', '', '1. להעתיק `_redirects`, `sitemap.xml`, `robots.txt` לשורש האתר (`--copy` עושה זאת).', '2. לבדוק באחסון האמיתי שכל כתובת ישנה מחזירה 301 אחד ל-200 (כתובות בעברית במיוחד).', '3. להסיר noindex מהתצוגה רק ביום ההשקה, לשלוח את מפת האתר ב-Search Console.');
fs.writeFileSync(path.join(OUT, 'plan.md'), md.join('\n') + '\n');
console.log(`old urls ${oldPages.size} · new pages ${fresh.length} · keep ${keep.length} · 301 ${red.length} · decide ${dec.length} · coverage ${total ? Math.round(covered / total * 100) : 100}%\nplan: ${path.join(OUT, 'plan.md')}`);
