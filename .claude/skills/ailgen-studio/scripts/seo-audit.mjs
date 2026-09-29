#!/usr/bin/env node
// SEO audit: what a search engine gets from a site, page by page, before and after JavaScript.
//   node seo-audit.mjs https://example.co.il --out projects/example/seo/old [--max 60] [--delay 800] [--js-only]
//   node seo-audit.mjs http://localhost:8767/ --out projects/example/seo/new --preview   (a local or staging copy: noindex is expected)
// Output (in --out): seo-report.json (everything, for other tools) and seo-report.md (for people, in Hebrew).
// What it checks
//   site   robots.txt, sitemap coverage, http→https and www redirects, real 404s, HSTS
//   page   status, title, description, canonical, robots meta, h1, headings order, structured data, Open Graph,
//          hreflang, image alt text, words before and after JavaScript (what a crawler sees without rendering)
//   links  the internal link graph: inbound links per page, depth from home, orphans, broken targets,
//          weak anchor text, and whether navigation uses real URLs or only #anchors
// It is polite: one request at a time with a delay, the normal desktop Chrome identity, and it stops on 403/429.
import fs from 'fs';
import path from 'path';
import { loadPlaywright, ensureProxyEnv, routeThroughNode, parseArgs, writeJSON } from './lib.mjs';

ensureProxyEnv();
const args = parseArgs();
const START = args._[0];
if (!START || !/^https?:\/\//.test(START)) { console.error('usage: node seo-audit.mjs <url> --out <dir> [--max 60] [--delay 800]'); process.exit(2); }
const OUT = path.resolve(args.out || 'seo'); fs.mkdirSync(OUT, { recursive: true });
const MAX = +(args.max || 60), DELAY = +(args.delay || 800);
const start = new URL(START), origin = start.origin;
const local = /^(localhost|127\.|\[::1\])/.test(start.hostname);
const UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36';
const HINTS = { 'sec-ch-ua': '"Chromium";v="130", "Google Chrome";v="130", "Not?A_Brand";v="99"', 'sec-ch-ua-mobile': '?0', 'sec-ch-ua-platform': '"Linux"' };
const sleep = ms => new Promise(r => setTimeout(r, ms));

/** Normalised page key: no hash, no query, no trailing slash, escape codes decoded. */
const norm = u => { try { const x = new URL(u); x.hash = ''; x.search = ''; return decodeURI(x.href).replace(/\/$/, '').toLowerCase(); } catch { return null; } };
const isAsset = u => /\.(jpe?g|png|gif|webp|svg|avif|pdf|zip|mp4|webm|mp3|docx?|xlsx?|ico|css|js|xml|json|txt|woff2?)$/i.test(new URL(u).pathname);
const pageUrl = (href, base) => { try { const u = new URL(href, base); if (u.origin !== origin || !/^https?:$/.test(u.protocol) || isAsset(u.href)) return null; if (/\/(wp-json|wp-admin|feed|cart|checkout|my-account)\b/.test(u.pathname)) return null; u.hash = ''; return u.href; } catch { return null; } };

/** Runs in the page: everything an SEO review reads from one document. */
function extract() {
  const q = s => document.querySelector(s), meta = n => (q(`meta[name="${n}" i]`) || q(`meta[property="${n}" i]`))?.content || '';
  const types = o => { const t = []; const w = x => { if (!x || typeof x !== 'object') return; if (Array.isArray(x)) return x.forEach(w); if (x['@type']) t.push(...[].concat(x['@type'])); if (x['@graph']) w(x['@graph']); }; w(o); return t; };
  const ld = [...document.querySelectorAll('script[type="application/ld+json"]')].map(s => { try { return JSON.parse(s.textContent); } catch { return { '@type': 'INVALID_JSON' }; } });
  const text = (document.body?.innerText || '').replace(/\s+/g, ' ').trim();
  const heads = [...document.querySelectorAll('h1,h2,h3,h4,h5,h6')].map(h => ({ l: +h.tagName[1], t: h.textContent.replace(/\s+/g, ' ').trim().slice(0, 100) }));
  const imgs = [...document.images];
  return {
    title: document.title || '', description: meta('description'), canonical: q('link[rel="canonical" i]')?.href || '',
    robots: meta('robots'), viewport: !!q('meta[name="viewport"]'), lang: document.documentElement.lang || '', dir: document.documentElement.dir || '',
    h1: heads.filter(h => h.l === 1).map(h => h.t), heads,
    words: text ? text.split(' ').length : 0,
    og: { title: meta('og:title'), description: meta('og:description'), image: meta('og:image'), url: meta('og:url'), type: meta('og:type') }, twitter: meta('twitter:card'),
    hreflang: [...document.querySelectorAll('link[rel="alternate" i][hreflang]')].map(l => l.hreflang),
    ldTypes: [...new Set(ld.flatMap(types))],
    imgs: imgs.length, imgNoAlt: imgs.filter(i => !i.hasAttribute('alt')).length, imgEmptyAlt: imgs.filter(i => i.getAttribute('alt') === '').length,
    main: !!q('main'), nav: !!q('nav'),
    links: [...document.querySelectorAll('a[href]')].map(a => ({ href: a.getAttribute('href') || '', abs: a.href, text: (a.textContent || a.getAttribute('aria-label') || '').replace(/\s+/g, ' ').trim().slice(0, 70), nav: !!a.closest('header,nav,footer'), nofollow: /nofollow/i.test(a.rel) })),
  };
}

const issues = [];
const add = (sev, code, page, msg) => issues.push({ sev, code, page: page || '(site)', msg });

/** Site-level probes with plain fetch: robots, sitemap, redirects, 404 behaviour. */
async function siteChecks() {
  const site = { robots: null, sitemaps: [], sitemapUrls: [], redirects: {}, notFound: null, hsts: null };
  const get = async (u, o = {}) => { try { return await fetch(u, { headers: { 'user-agent': UA }, redirect: 'manual', ...o }); } catch { return null; } };
  const r = await get(origin + '/robots.txt', { redirect: 'follow' });
  if (r && r.ok && !/<html/i.test((await r.clone().text()).slice(0, 200))) {
    const t = await r.text(); site.robots = { status: r.status, sitemapLines: [...t.matchAll(/^sitemap:\s*(\S+)/gim)].map(m => m[1]), disallowAll: /^disallow:\s*\/\s*$/im.test(t), text: t.slice(0, 1500) };
  } else site.robots = { status: r?.status ?? 0 };
  const remap = u => { try { const x = new URL(u); return (local || args['map-origin']) && x.origin !== origin ? origin + x.pathname + x.search : u; } catch { return u; } };
  const cands = new Set([origin + '/sitemap.xml', ...(site.robots.sitemapLines || []).map(remap), origin + '/sitemap_index.xml', origin + '/wp-sitemap.xml']);
  const seen = new Set(), urls = new Set();
  const read = async (u, d) => {
    if (seen.has(u) || d > 3) return; seen.add(u);
    const x = await get(u, { redirect: 'follow' }); if (!x || !x.ok) return;
    const t = await x.text(); if (!/<(urlset|sitemapindex)/i.test(t)) return;
    site.sitemaps.push(u);
    for (const m of t.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/g)) { if (/<sitemapindex/i.test(t)) await read(remap(m[1]), d + 1); else urls.add(remap(m[1])); }
  };
  for (const c of cands) await read(c, 0);
  site.sitemapUrls = [...urls];
  if (!local) {
    const h = start.hostname, bare = h.replace(/^www\./, ''), other = h.startsWith('www.') ? bare : 'www.' + bare;
    for (const [k, u] of [['http', `http://${h}/`], ['wwwToggle', `${start.protocol}//${other}/`]]) {
      const x = await get(u); site.redirects[k] = x ? { status: x.status, to: x.headers.get('location') || '' } : { status: 0, to: '' };
    }
  }
  const home = await get(origin + '/', { redirect: 'follow' }); site.hsts = home?.headers.get('strict-transport-security') || null;
  const nf = await get(origin + '/seo-probe-' + Math.random().toString(36).slice(2, 8) + '/', { redirect: 'follow' });
  site.notFound = nf ? { status: nf.status } : null;
  return site;
}

async function main() {
  const { chromium } = loadPlaywright();
  const browser = await chromium.launch();
  const mk = async js => { const c = await browser.newContext({ viewport: { width: 1440, height: 900 }, userAgent: UA, locale: 'he-IL', serviceWorkers: 'block', javaScriptEnabled: js, extraHTTPHeaders: HINTS }); if (!local) await routeThroughNode(c); return c; };
  const ctxJs = await mk(true), ctxRaw = await mk(false);
  const pJs = await ctxJs.newPage(), pRaw = await ctxRaw.newPage();

  const site = await siteChecks();
  console.log(`robots: ${site.robots.status} · sitemaps: ${site.sitemaps.length} · sitemap urls: ${site.sitemapUrls.length} · 404 probe: ${site.notFound?.status}`);

  const queue = [start.href], seen = new Set([norm(start.href)]), pages = [], statuses = {};
  let blocked = 0;
  const enqueue = (u, from) => { const p = pageUrl(u, from); if (p && !seen.has(norm(p))) { seen.add(norm(p)); queue.push(p); } };
  for (const u of site.sitemapUrls) enqueue(u, origin);
  for (let i = 0; i < queue.length && pages.length < MAX; i++) {
    const url = queue[i];
    try {
      const res = await pJs.goto(url, { waitUntil: 'load', timeout: 45000 });
      const st = res?.status() ?? 0; statuses[norm(url)] = st;
      if ([403, 429, 503].includes(st)) { blocked++; console.log('blocked', st, url); if (blocked >= 3) { console.log('the site refuses requests; stopping politely. Retry later with a larger --delay.'); break; } await sleep(DELAY * 6); continue; }
      blocked = 0;
      if (!res || st >= 400 || !/html/.test(res.headers()['content-type'] || 'html')) { console.log('status', st, url); continue; }
      await pJs.waitForTimeout(700);
      const js = await pJs.evaluate(extract);
      const xrt = res.headers()['x-robots-tag'] || '';
      let raw = null;
      if (!args['js-only']) {
        await sleep(DELAY);
        const rr = await pRaw.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 }).catch(() => null);
        raw = rr && rr.status() < 400 ? await pRaw.evaluate(extract).catch(() => null) : null;
      }
      pages.push({ url: pJs.url(), status: st, xRobotsTag: xrt, rendered: js, raw });
      for (const l of js.links) enqueue(l.abs, url);
      console.log(`page ${pages.length}/${MAX} ${decodeURI(pJs.url()).slice(0, 90)}  words raw=${raw?.words ?? '?'} js=${js.words} links=${js.links.length}`);
      await sleep(DELAY);
    } catch (e) { console.log('fail', url, e.message.split('\n')[0]); }
  }
  await browser.close();
  analyse(site, pages, statuses);
}

function analyse(site, pages, statuses) {
  const byKey = new Map(pages.map(p => [norm(p.url), p]));
  const home = byKey.get(norm(start.href)) || pages[0];
  // ---- link graph (rendered DOM, real page URLs only)
  const inbound = new Map(pages.map(p => [norm(p.url), new Set()])), ctxIn = new Map(pages.map(p => [norm(p.url), new Set()])), out = new Map(), broken = [], anchorOnly = new Map();
  for (const p of pages) {
    const k = norm(p.url), targets = new Set(); let anchors = 0;
    for (const l of p.rendered.links) {
      if (/^#/.test(l.href) || (norm(l.abs) === k && /#/.test(l.abs))) { anchors++; continue; }
      const t = pageUrl(l.abs, p.url); if (!t) continue; const tk = norm(t); if (tk === k) continue;
      targets.add(tk);
      if (inbound.has(tk)) { inbound.get(tk).add(k); if (!l.nav) ctxIn.get(tk).add(k); }
      else if (statuses[tk] >= 400) broken.push({ from: p.url, to: t, status: statuses[tk], text: l.text });
    }
    out.set(k, targets); anchorOnly.set(k, anchors);
  }
  const depth = new Map(); if (home) { const hk = norm(home.url); depth.set(hk, 0); const bfs = [hk]; for (let i = 0; i < bfs.length; i++) for (const t of out.get(bfs[i]) || []) if (!depth.has(t) && inbound.has(t)) { depth.set(t, depth.get(bfs[i]) + 1); bfs.push(t); } }
  const weak = /^(לחצו כאן|לחץ כאן|קרא עוד|קראו עוד|עוד|המשך|למידע נוסף|לפרטים|click here|read more|more)$/i;
  const weakAnchors = pages.flatMap(p => p.rendered.links.filter(l => weak.test(l.text)).map(l => ({ from: p.url, text: l.text, to: l.abs }))).length;
  const rows = pages.map(p => {
    const k = norm(p.url), r = p.rendered, w = p.raw;
    return { url: p.url, status: p.status, title: r.title, titleLen: r.title.length, description: r.description, descLen: r.description.length, canonical: r.canonical, robots: r.robots, xRobotsTag: p.xRobotsTag,
      h1: r.h1, h1Raw: w?.h1 ?? null, ldTypes: r.ldTypes, ldTypesRaw: w?.ldTypes ?? null, og: r.og, twitter: r.twitter, hreflang: r.hreflang, lang: r.lang,
      wordsRendered: r.words, wordsRaw: w?.words ?? null, imgs: r.imgs, imgNoAlt: r.imgNoAlt, imgEmptyAlt: r.imgEmptyAlt,
      ctxOut: p.rendered.links.filter(l => !l.nav && !/^#/.test(l.href) && pageUrl(l.abs, p.url) && norm(pageUrl(l.abs, p.url)) !== k).length, ctxIn: ctxIn.get(k)?.size ?? 0,
      inbound: inbound.get(k).size, outbound: out.get(k).size, anchorLinks: anchorOnly.get(k), depth: depth.has(k) ? depth.get(k) : null, inSitemap: site.sitemapUrls.some(u => norm(u) === k) };
  });
  // ---- issues
  const dup = key => { const m = new Map(); rows.forEach(r => { const v = (key(r) || '').trim(); if (v) m.set(v, [...(m.get(v) || []), r.url]); }); return [...m].filter(([, u]) => u.length > 1); };
  if (!site.robots || site.robots.status !== 200) add('med', 'robots-missing', '', 'אין robots.txt. גוגל יסרוק הכול, ואין הפניה למפת האתר.');
  else { if (site.robots.disallowAll) add('high', 'robots-blocks-all', '', 'robots.txt חוסם את כל האתר (Disallow: /).'); if (!site.robots.sitemapLines.length) add('low', 'robots-no-sitemap', '', 'ב-robots.txt אין שורת Sitemap.'); }
  if (!site.sitemaps.length) add('high', 'sitemap-missing', '', 'אין sitemap.xml. גוגל מגלה עמודים רק דרך קישורים.');
  else {
    const crawled = new Set(pages.map(p => norm(p.url))), notCrawled = site.sitemapUrls.filter(u => !crawled.has(norm(u)) && statuses[norm(u)] >= 400);
    notCrawled.forEach(u => add('high', 'sitemap-broken-url', u, `כתובת במפת האתר מחזירה ${statuses[norm(u)]}.`));
    const missing = pages.filter(p => !site.sitemapUrls.some(u => norm(u) === norm(p.url)));
    if (missing.length) add('med', 'sitemap-incomplete', '', `${missing.length} עמודים שנסרקו לא מופיעים במפת האתר.`);
  }
  if (!local) {
    const hs = site.redirects.http?.status;
    if (hs === 200) add('high', 'http-no-redirect', '', 'כתובת http מחזירה את האתר עצמו (200) במקום 301 ל-https. גוגל עלול לאנדקס גם את הגרסה הלא מאובטחת.');
    else if ([301, 302, 307, 308].includes(hs) && !site.redirects.http.to.startsWith('https')) add('med', 'http-redirect-not-https', '', `http מופנה ל-${site.redirects.http.to}, לא ל-https.`);
    const ws = site.redirects.wwwToggle?.status;
    if (ws === 200) add('med', 'www-not-unified', '', 'הגרסה עם/בלי www עונה 200 בשתיהן. חייבת להיות אחת בלבד, והשנייה 301 אליה.');
    if (!site.hsts) add('low', 'no-hsts', '', 'אין כותרת HSTS.');
  }
  if (site.notFound && site.notFound.status === 200) add('high', 'soft-404', '', 'כתובת שלא קיימת מחזירה 200 במקום 404 (soft 404). גוגל אוסף עמודי זבל.');
  for (const r of rows) {
    const u = r.url;
    if (!r.title) add('high', 'title-missing', u, 'אין title.'); else if (r.titleLen < 25) add('med', 'title-short', u, `title קצר מדי (${r.titleLen} תווים): "${r.title}".`); else if (r.titleLen > 70) add('low', 'title-long', u, `title ארוך (${r.titleLen} תווים), יחתך בתוצאות.`);
    if (!r.description) add('med', 'description-missing', u, 'אין meta description.'); else if (r.descLen < 70 || r.descLen > 165) add('low', 'description-length', u, `אורך description ${r.descLen} (מומלץ 70–160).`);
    const cp = r.canonical && norm(r.canonical) && new URL(r.canonical).pathname, up = new URL(u).pathname;
    if (!r.canonical) add('med', 'canonical-missing', u, 'אין canonical.');
    else if (decodeURI(cp).replace(/\/$/, '') !== decodeURI(up).replace(/\/$/, '')) add('med', 'canonical-differs', u, `canonical מצביע ל-${r.canonical}.`);
    else if (!local && !args['map-origin'] && new URL(r.canonical).origin !== origin) add('med', 'canonical-origin', u, `canonical בדומיין אחר (${new URL(r.canonical).origin}).`);
    if (/noindex/i.test(r.robots + r.xRobotsTag)) add(args.preview ? 'low' : 'high', args.preview ? 'noindex-preview' : 'noindex', u, args.preview ? 'noindex בתצוגה מקדימה: צפוי. להסיר ביום ההשקה.' : 'העמוד מסומן noindex.');
    const rawEmptyH1 = r.h1Raw?.length && r.h1Raw.every(t => !t.trim());
    if (rawEmptyH1) add('high', 'h1-empty-in-html', u, 'ה-h1 ב-HTML שנשלח ריק ונמלא רק ב-JavaScript. מנוע חיפוש שלא מריץ JavaScript לא רואה כותרת.');
    if (r.h1.length === 0) add('high', 'h1-missing', u, 'אין h1.'); else if (r.h1.length > 1) add('low', 'h1-multiple', u, `${r.h1.length} כותרות h1.`);
    if (!r.ldTypes.length) add('med', 'structured-data-missing', u, 'אין נתונים מובנים (JSON-LD).');
    if (!r.og.title || !r.og.image) add('low', 'og-incomplete', u, 'חסרים תגי Open Graph (שיתוף בפייסבוק ובוואטסאפ).'); else if (r.og.image && !/^https?:/.test(r.og.image)) add('med', 'og-image-relative', u, 'תמונת ה-og היא כתובת יחסית, ולכן שיתוף ייכשל.');
    if (r.imgNoAlt) add('med', 'img-alt-missing', u, `${r.imgNoAlt} תמונות בלי alt.`);
    if (r.wordsRaw !== null) {
      if (r.wordsRaw < 60 && r.wordsRendered > 150) add('high', 'js-only-content', u, `בלי JavaScript יש ${r.wordsRaw} מילים, ואחרי ${r.wordsRendered}. התוכן נבנה בדפדפן, וזה מסכן אינדוקס.`);
      else if (r.wordsRaw < r.wordsRendered * 0.6) add('med', 'js-heavy-content', u, `רק ${r.wordsRaw} מתוך ${r.wordsRendered} מילים קיימות ב-HTML הראשוני.`);
    }
    if (r.wordsRendered < 150) add('low', 'thin-content', u, `${r.wordsRendered} מילים בלבד.`);
    if (r.inbound === 0 && norm(u) !== norm(start.href)) add('high', 'orphan', u, 'אף עמוד לא מקשר אליו (יתום). גוגל ימצא אותו רק במפת האתר, בלי משקל.');
    else if (r.inbound === 1 && norm(u) !== norm(start.href)) add('low', 'one-inbound', u, 'עמוד אחד בלבד מקשר אליו.');
    if (r.inbound > 0 && r.ctxIn === 0 && norm(u) !== norm(start.href) && !/(privacy|accesab|accessib|terms|legal|contact|cookie)/i.test(decodeURI(u))) add('med', 'no-contextual-inbound', u, 'מקושר רק מתפריטים ומהתחתית, לא מתוך תוכן של עמוד אחר. קישור מתוכן שווה יותר.');
    if (r.depth === null && r.inbound > 0) add('med', 'unreachable-from-home', u, 'אי אפשר להגיע אליו מדף הבית דרך קישורים.');
    if (r.depth !== null && r.depth > 3) add('low', 'deep', u, `${r.depth} קליקים מדף הבית.`);
  }
  dup(r => r.title).forEach(([t, u]) => add('med', 'title-duplicate', u.join(' , '), `אותו title ב-${u.length} עמודים: "${t}".`));
  dup(r => r.description).forEach(([t, u]) => add('low', 'description-duplicate', u.join(' , '), `אותו description ב-${u.length} עמודים.`));
  broken.forEach(b => add('high', 'broken-internal-link', b.from, `קישור שבור (${b.status}) אל ${b.to}.`));
  if (weakAnchors) add('low', 'weak-anchor-text', '', `${weakAnchors} קישורים פנימיים עם טקסט כללי ("קרא עוד", "לחצו כאן") במקום מילות מפתח.`);
  const anchorsOnly = rows.length === 1 && rows[0].anchorLinks > 5;
  if (anchorsOnly) add('high', 'single-url-site', rows[0].url, `כל האתר בכתובת אחת (${rows[0].anchorLinks} קישורי #). אין דפי שירות או מאמרים שאפשר לדרג בנפרד.`);
  const order = { high: 0, med: 1, low: 2 }; issues.sort((a, b) => order[a.sev] - order[b.sev]);

  const summary = { origin, crawledAt: new Date().toISOString(), pages: rows.length, sitemapUrls: site.sitemapUrls.length, issues: { high: issues.filter(i => i.sev === 'high').length, med: issues.filter(i => i.sev === 'med').length, low: issues.filter(i => i.sev === 'low').length },
    internalEdges: [...out.values()].reduce((a, s) => a + s.size, 0), orphans: rows.filter(r => r.inbound === 0 && norm(r.url) !== norm(start.href)).length, contextualEdges: rows.reduce((a, r) => a + r.ctxOut, 0), pagesWithContextualOut: rows.filter(r => r.ctxOut > 0).length, avgWordsRendered: Math.round(rows.reduce((a, r) => a + r.wordsRendered, 0) / Math.max(1, rows.length)), avgWordsRaw: Math.round(rows.reduce((a, r) => a + (r.wordsRaw ?? 0), 0) / Math.max(1, rows.length)) };
  writeJSON(path.join(OUT, 'seo-report.json'), { summary, site, pages: rows, issues, broken, links: Object.fromEntries([...out].map(([k, v]) => [k, [...v]])) });
  fs.writeFileSync(path.join(OUT, 'seo-report.md'), markdown(summary, site, rows, issues));
  console.log(`\n${summary.pages} pages · issues: high ${summary.issues.high} · med ${summary.issues.med} · low ${summary.issues.low} · orphans ${summary.orphans} · internal links ${summary.internalEdges}\nreport: ${path.join(OUT, 'seo-report.md')}`);
}

function markdown(s, site, rows, iss) {
  const L = [`# בדיקת SEO: ${s.origin}`, '', `נסרק ב-${s.crawledAt.slice(0, 16).replace('T', ' ')} · ${s.pages} עמודים · מפת אתר: ${s.sitemapUrls} כתובות · קישורים פנימיים: ${s.internalEdges} (מתוכן העמודים: ${s.contextualEdges}, ב-${s.pagesWithContextualOut} עמודים) · עמודים יתומים: ${s.orphans}`, '',
    `חומרה: **${s.issues.high} גבוהה**, ${s.issues.med} בינונית, ${s.issues.low} נמוכה. ממוצע מילים: ${s.avgWordsRaw} ב-HTML הראשוני, ${s.avgWordsRendered} אחרי JavaScript.`, '',
    '## האתר', `- robots.txt: ${site.robots?.status ?? '—'}${site.robots?.sitemapLines?.length ? ' · Sitemap: ' + site.robots.sitemapLines.join(', ') : ''}`, `- מפות אתר: ${site.sitemaps.join(', ') || 'אין'}`,
    `- http → https: ${site.redirects.http ? site.redirects.http.status + ' ' + site.redirects.http.to : 'לא נבדק'} · www: ${site.redirects.wwwToggle ? site.redirects.wwwToggle.status + ' ' + site.redirects.wwwToggle.to : 'לא נבדק'}`, `- כתובת לא קיימת מחזירה: ${site.notFound?.status ?? '—'} · HSTS: ${site.hsts ? 'יש' : 'אין'}`, '',
    '## ממצאים'];
  const groups = { high: 'גבוהה', med: 'בינונית', low: 'נמוכה' };
  for (const sev of ['high', 'med', 'low']) {
    const it = iss.filter(i => i.sev === sev); if (!it.length) continue;
    L.push('', `### חומרה ${groups[sev]} (${it.length})`);
    const byCode = new Map(); it.forEach(i => byCode.set(i.code, [...(byCode.get(i.code) || []), i]));
    for (const [c, list] of byCode) { L.push(`- **${c}** (${list.length}): ${list[0].msg}`); list.slice(0, 4).forEach(i => L.push(`  - ${decodeURI(i.page).replace(origin, '').slice(0, 90) || '/'}${list.length > 1 ? ': ' + i.msg : ''}`)); if (list.length > 4) L.push(`  - ועוד ${list.length - 4}`); }
  }
  L.push('', '## עמודים', '', '| כתובת | title | h1 | מילים (HTML / אחרי JS) | נכנסים | מתוכן | יוצאים | מתוכן | עומק | JSON-LD |', '|---|---|---|---|---|---|---|---|---|---|');
  for (const r of rows) L.push(`| ${decodeURI(r.url).replace(origin, '').slice(0, 48) || '/'} | ${r.titleLen} | ${r.h1.length} | ${r.wordsRaw ?? '?'} / ${r.wordsRendered} | ${r.inbound} | ${r.ctxIn} | ${r.outbound} | ${r.ctxOut} | ${r.depth ?? '—'} | ${r.ldTypes.join(', ') || '—'} |`);
  return L.join('\n') + '\n';
}

main().catch(e => { console.error(e); process.exit(1); });
