#!/usr/bin/env node
// Site intake: crawl an existing website and pull everything a rebuild needs.
//   node intake.mjs https://example.co.il --out projects/example/intake [--max 60] [--media 80] [--delay 800]
// Output (in --out):
//   site.json      pages, texts, contacts, socials, colors, fonts, logos, media manifest
//   content.md     every page's text, in reading order (the raw material for the copy deck)
//   summary.md     the facts at a glance: name, phones, emails, palette, fonts, what was found
//   media/         downloaded images (and logos), named by page and order
//   shots/         home page screenshots, desktop and mobile
import fs from 'fs';
import path from 'path';
import { loadPlaywright, ensureProxyEnv, routeThroughNode, parseArgs, writeJSON } from './lib.mjs';
import { robotsAllowed } from './seo-lib.mjs';

ensureProxyEnv();
const args = parseArgs();
const START = args._[0];
if (!START || !/^https?:\/\//.test(START)) {
  console.error('usage: node intake.mjs <https://site> --out <dir> [--max 60] [--media 80]');
  process.exit(2);
}
const OUT = path.resolve(args.out || 'intake');
const MAX_PAGES = +(args.max || 60), MAX_MEDIA = +(args.media || 80), DELAY = +(args.delay || 800);
const origin = new URL(START).origin;
const UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36';
// many hosting firewalls reject the headless client hint, so send the regular desktop Chrome one
const CLIENT_HINTS = { 'sec-ch-ua': '"Chromium";v="130", "Google Chrome";v="130", "Not?A_Brand";v="99"', 'sec-ch-ua-mobile': '?0', 'sec-ch-ua-platform': '"Linux"' };
fs.mkdirSync(path.join(OUT, 'media'), { recursive: true });
fs.mkdirSync(path.join(OUT, 'shots'), { recursive: true });

// robots.txt is honoured (longest-match Allow/Disallow for `*`); storefront noise (login, cart, search, duplicate product paths) is never a page
let robotsOk = () => true;
const NOISE_URL = args.skip ? new RegExp(args.skip) : /\/(customer_authentication|account|cart|checkout|orders|search|sf_[^/]*|services)(\/|\?|$)|\/collections\/[^/]+\/products\/|[?&](sort_by|filter\.|variant|page)=/i;
/** Same-site page URL without hash, or null for assets, other hosts and non-http links. */
function pageUrl(href, base) {
  try {
    const u = new URL(href, base);
    if (u.origin !== origin || !/^https?:$/.test(u.protocol)) return null;
    if (/\.(jpe?g|png|gif|webp|svg|pdf|zip|mp4|webm|mp3|docx?|xlsx?|ico|css|js|xml|json)$/i.test(u.pathname)) return null;
    if (/\/(wp-json|wp-admin|feed|cart|checkout|my-account)\b|[?&](add-to-cart|replytocom)=/i.test(u.href)) return null;
    if (NOISE_URL.test(u.pathname + u.search) || !robotsOk(u.pathname + u.search)) return null;
    u.hash = '';
    for (const k of [...u.searchParams.keys()]) if (/^(pr_|utm_|fbclid|gclid|igshid|_pos|_sid|_ss|ref$|srsltid)/i.test(k)) u.searchParams.delete(k); // tracking parameters do not make a new page
    return u.href;
  } catch { return null; }
}

/** Dedupe key for a page URL: trailing slash and case of the escape codes do not make a new page. */
const key = u => decodeURI(u).replace(/\/$/, '').toLowerCase();

/** Read sitemap(s) and return page URLs, following nested sitemaps a few levels deep. */
async function sitemapUrls() {
  const found = new Set(), seen = new Set();
  async function read(url, depth) {
    if (seen.has(url) || depth > 3) return; seen.add(url);
    try {
      const r = await fetch(url, { headers: { 'user-agent': UA } }); if (!r.ok) return;
      const xml = await r.text();
      const locs = [...xml.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/g)].map(m => m[1].replace(/&amp;/g, '&'));
      for (const l of locs) {
        if (/\.xml(\?|$)/i.test(l)) await read(l, depth + 1);
        else { const p = pageUrl(l, origin); if (p) found.add(p); }
      }
    } catch { /* no sitemap at this address */ }
  }
  for (const p of ['/sitemap.xml', '/sitemap_index.xml', '/wp-sitemap.xml']) await read(origin + p, 0);
  return [...found];
}

/** Runs inside the page: extract structured content. */
function extractPage() {
  const vis = el => { const r = el.getBoundingClientRect(), s = getComputedStyle(el); return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none' && +s.opacity > 0.05; };
  const txt = el => (el.innerText || el.textContent || '').replace(/\s+/g, ' ').trim();
  const meta = n => document.querySelector(`meta[name="${n}"],meta[property="${n}"]`)?.content || '';
  const blocks = [];
  const skip = 'script,style,noscript,template,svg,iframe';
  document.querySelectorAll('h1,h2,h3,h4,h5,h6,p,li,blockquote,figcaption,td,th,dt,dd,button,a.button,a.btn,.btn,[class*="button"]').forEach(el => {
    if (el.closest(skip) || !vis(el)) return;
    if (el.tagName === 'LI' && el.querySelector('p,li')) return;
    const t = txt(el); if (!t || t.length < 2 || t.length > 1500) return;
    const tag = el.tagName.toLowerCase();
    const kind = /^h\d$/.test(tag) ? tag : tag === 'button' || /btn|button/.test(el.className + '') ? 'cta' : tag;
    const region = el.closest('header,nav') ? 'header' : el.closest('footer') ? 'footer' : 'main';
    const b = { kind, region, text: t };
    if (el.querySelector('br')) { const lines = el.innerHTML.split(/<br\s*\/?>/i).map(x => x.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim()).filter(Boolean); if (lines.length > 1) b.lines = lines; }
    if (kind === 'td' || kind === 'th') { const tb = el.closest('table'), tr = el.closest('tr'); if (tb && tr) { b.table = [...document.querySelectorAll('table')].indexOf(tb); b.row = [...tb.querySelectorAll('tr')].indexOf(tr); b.col = [...tr.children].indexOf(el); } }
    blocks.push(b);
  });
  // text that sits directly in a div or span (rich-text blocks with <br> lines): the tag list above misses it
  const covered = 'h1,h2,h3,h4,h5,h6,p,li,blockquote,figcaption,td,th,dt,dd,button,a,label';
  document.querySelectorAll('div,span,section').forEach(el => {
    if (el.closest(skip) || el.closest(covered) || !vis(el)) return;
    const own = [...el.childNodes].filter(n => n.nodeType === 3).map(n => n.textContent.replace(/\s+/g, ' ').trim()).filter(Boolean).join(' ');
    if (own.length < 20 || own.length > 1500) return;
    blocks.push({ kind: 'p', region: el.closest('header,nav') ? 'header' : el.closest('footer') ? 'footer' : 'main', text: own });
  });
  const dedup = []; const s = new Set();
  for (const b of blocks) { const k = b.kind + '|' + b.text + (b.table !== undefined ? '|' + b.table + '.' + b.row + '.' + b.col : ''); if (!s.has(k)) { s.add(k); dedup.push(b); } }
  const best = img => {
    const ss = img.getAttribute('srcset') || img.getAttribute('data-srcset') || '';
    const c = ss.split(',').map(x => x.trim().split(/\s+/)).filter(x => x[0]).map(([u, w]) => [u, parseInt(w) || 0]).sort((a, b) => b[1] - a[1])[0];
    return new URL((c && c[0]) || img.getAttribute('data-src') || img.getAttribute('data-lazy-src') || img.currentSrc || img.src, location.href).href;
  };
  const images = [...document.images].filter(i => !i.closest('script,noscript')).map(i => ({
    src: best(i), alt: i.alt || '', w: i.naturalWidth, h: i.naturalHeight,
    shownW: Math.round(i.getBoundingClientRect().width), inHeader: !!i.closest('header,nav'),
    logo: /logo/i.test([i.src, i.alt, i.className, i.id, i.parentElement?.className].join(' ')),
  })).filter(i => /^https?:/.test(i.src));
  const bgs = [];
  document.querySelectorAll('section,div,header,figure,a').forEach(el => {
    const b = getComputedStyle(el).backgroundImage; const r = el.getBoundingClientRect();
    if (b && b.startsWith('url(') && r.width > 300 && r.height > 180) {
      const m = b.match(/url\(["']?(.*?)["']?\)/); if (m && /^https?:/.test(new URL(m[1], location.href).href)) bgs.push(new URL(m[1], location.href).href);
    }
  });
  const videos = [...document.querySelectorAll('video, video source')].map(v => v.src || v.getAttribute('src')).filter(Boolean).map(u => new URL(u, location.href).href);
  const embeds = [...document.querySelectorAll('iframe')].map(f => f.src).filter(u => /youtube|youtu\.be|vimeo/.test(u));
  const links = [...document.querySelectorAll('a[href]')].map(a => ({ href: a.href, text: txt(a).slice(0, 80), nav: !!a.closest('header,nav') }));
  const jsonld = [...document.querySelectorAll('script[type="application/ld+json"]')].map(s => { try { return JSON.parse(s.textContent); } catch { return null; } }).filter(Boolean);
  return {
    url: location.href, title: document.title, lang: document.documentElement.lang || '', dir: document.documentElement.dir || getComputedStyle(document.body).direction,
    description: meta('description') || meta('og:description'), metaDescription: meta('description'), canonical: document.querySelector('link[rel="canonical" i]')?.href || '', robotsMeta: meta('robots'), ogImage: meta('og:image'), ogSite: meta('og:site_name'),
    blocks: dedup, images, backgrounds: [...new Set(bgs)], videos: [...new Set(videos)], embeds: [...new Set(embeds)], links, jsonld,
    text: txt(document.body).slice(0, 60000),
  };
}

/** Runs inside the home page: sample the visual identity (colors weighted by area, fonts, logo). */
function extractDesign() {
  const hex = c => { const m = c.match(/rgba?\(([^)]+)\)/); if (!m) return null; const [r, g, b, a = 1] = m[1].split(',').map(x => parseFloat(x)); if (a < 0.5) return null; return '#' + [r, g, b].map(v => Math.round(v).toString(16).padStart(2, '0')).join('').toUpperCase(); };
  const bg = {}, fg = {}, btn = {};
  const add = (o, k, w) => { if (k) o[k] = (o[k] || 0) + w; };
  const H = Math.min(document.documentElement.scrollHeight, 9000);
  document.querySelectorAll('body *').forEach(el => {
    const r = el.getBoundingClientRect(); if (!r.width || !r.height || r.top + scrollY > H) return;
    const s = getComputedStyle(el);
    add(bg, hex(s.backgroundColor), r.width * r.height / 1e4);
    const own = [...el.childNodes].filter(n => n.nodeType === 3).map(n => n.textContent.trim()).join('');
    if (own.length) add(fg, hex(s.color), own.length);
    if (el.matches('button,a.button,a.btn,.btn,[class*="button"],input[type=submit]')) add(btn, hex(s.backgroundColor), 10);
  });
  const top = (o, n) => Object.entries(o).sort((a, b) => b[1] - a[1]).slice(0, n).map(([c, w]) => ({ hex: c, weight: Math.round(w) }));
  const fam = sel => { const el = document.querySelector(sel); return el ? getComputedStyle(el).fontFamily : ''; };
  let big = null, bigSize = 0; // the display face is whatever sets the largest visible text
  document.querySelectorAll('h1,h1 *,h2,h2 *,.hero *,[class*="title"]').forEach(el => { const s = getComputedStyle(el), z = parseFloat(s.fontSize); const r = el.getBoundingClientRect(); if (z > bigSize && r.width && el.textContent.trim()) { bigSize = z; big = s.fontFamily; } });
  const fonts = { display: big || fam('h1'), h1: fam('h1'), h2: fam('h2'), body: fam('p') || getComputedStyle(document.body).fontFamily, button: fam('button,.btn,a.button') };
  const loaded = [...document.fonts].filter(f => f.status === 'loaded').map(f => `${f.family.replace(/["']/g, '')} ${f.weight}`);
  const logos = [];
  document.querySelectorAll('header img, header svg, nav img, [class*="logo"] img, [class*="logo"] svg, img[alt*="logo" i], img[src*="logo" i]').forEach((el, i) => {
    const r = el.getBoundingClientRect(); if (r.width < 24 || r.height < 12 || r.width > 700) return;
    if (el.tagName.toLowerCase() === 'svg') logos.push({ kind: 'svg', svg: el.outerHTML.slice(0, 200000), w: Math.round(r.width), h: Math.round(r.height) });
    else logos.push({ kind: 'img', src: el.currentSrc || el.src, w: Math.round(r.width), h: Math.round(r.height), alt: el.alt });
  });
  const icon = document.querySelector('link[rel~="icon"]')?.href || '';
  return { backgrounds: top(bg, 8), text: top(fg, 6), buttons: top(btn, 4), fonts, loaded: [...new Set(loaded)].slice(0, 20), logos: logos.slice(0, 6), favicon: icon };
}

/** Download a URL to `file` (via Node fetch, so proxies and redirects are handled). */
async function download(url, file) {
  const r = await fetch(url, { headers: { 'user-agent': UA, referer: origin + '/' } });
  if (!r.ok) throw new Error('HTTP ' + r.status);
  const buf = Buffer.from(await r.arrayBuffer());
  fs.writeFileSync(file, buf);
  return { bytes: buf.length, type: r.headers.get('content-type') || '' };
}

const CONTACT = {
  phone: /(?:\+972[-\s]?|0)(?:[23489]|5\d|7\d)[-\s]?\d{3}[-\s]?\d{4}/g,
  email: /[\w.+-]+@[\w-]+\.[\w.-]+/g,
};
const SOCIAL = /(facebook|instagram|youtube|youtu\.be|tiktok|linkedin|twitter|x\.com|pinterest|wa\.me|api\.whatsapp)/i;

async function main() {
  try { const r = await fetch(origin + '/robots.txt', { headers: { 'user-agent': UA } }); if (r.ok) robotsOk = robotsAllowed(await r.text()); } catch { /* no robots.txt: nothing disallowed */ }
  const { chromium } = loadPlaywright();
  const browser = await chromium.launch();
  // service workers would fetch pages outside the route handler, so block them
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, userAgent: UA, locale: 'he-IL', serviceWorkers: 'block', extraHTTPHeaders: CLIENT_HINTS });
  await routeThroughNode(ctx);
  const page = await ctx.newPage();
  const queue = [pageUrl(START, START) || START], seen = new Set(queue.map(key)), pages = [];
  let design = null, blocked = 0; const docs = [];

  const sm = await sitemapUrls();
  console.log(`sitemap: ${sm.length} urls`);

  for (let i = 0; i < queue.length && pages.length < MAX_PAGES; i++) {
    const url = queue[i];
    // text documents listed in the sitemap (agents.md, llms.txt): fetched as text and kept in docs/, never counted as pages
    if (/\.(md|txt)$/i.test(new URL(url).pathname)) {
      try {
        const r = await fetch(url, { headers: { 'user-agent': UA } });
        if (r.ok && /text\/(markdown|plain)/.test(r.headers.get('content-type') || '')) {
          const f = 'docs/' + new URL(url).pathname.split('/').pop(); fs.mkdirSync(path.join(OUT, 'docs'), { recursive: true }); fs.writeFileSync(path.join(OUT, f), await r.text());
          docs.push({ url, file: f }); console.log('doc', f);
        } else console.log('skip', r.status, url);
      } catch (e) { console.log('fail', url, e.message.split('\n')[0]); }
      await page.waitForTimeout(DELAY); continue;
    }
    try {
      const res = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });
      if (res && [403, 429, 503].includes(res.status())) {
        blocked++; console.log('blocked', res.status(), url);
        if (blocked >= 3) { console.log('the site is refusing requests (firewall or rate limit); stopping politely. Retry later with a larger --delay.'); break; }
        await page.waitForTimeout(DELAY * 6); continue;
      }
      if (!res || res.status() >= 400 || !/html/.test(res.headers()['content-type'] || 'html')) { console.log('skip', res?.status(), url); continue; }
      blocked = 0;
      await page.waitForLoadState('load', { timeout: 15000 }).catch(() => {});
      const h = await page.evaluate(() => document.documentElement.scrollHeight);
      for (let y = 0; y < Math.min(h, 12000); y += 700) { await page.evaluate(y => scrollTo(0, y), y); await page.waitForTimeout(120); }
      await page.evaluate(() => scrollTo(0, 0)); await page.waitForTimeout(500);
      const data = await page.evaluate(extractPage);
      if (i === 0) {
        design = await page.evaluate(extractDesign);
        await page.screenshot({ path: path.join(OUT, 'shots/home-desktop.png') });
        await page.screenshot({ path: path.join(OUT, 'shots/home-desktop-full.png'), fullPage: true, clip: { x: 0, y: 0, width: 1440, height: Math.min(h, 7000) } }).catch(() => {});
        const m = await ctx.newPage(); await m.setViewportSize({ width: 390, height: 844 });
        await m.goto(url, { waitUntil: 'load', timeout: 45000 }).catch(() => {}); await m.waitForTimeout(1500);
        await m.screenshot({ path: path.join(OUT, 'shots/home-mobile.png') }); await m.close();
        // navigation links first, then the sitemap, then everything discovered on the way
        for (const l of data.links.filter(l => l.nav)) { const p = pageUrl(l.href, url); if (p && !seen.has(key(p))) { seen.add(key(p)); queue.push(p); } }
        for (const p of sm) if (!seen.has(key(p))) { seen.add(key(p)); queue.push(p); }
      }
      for (const l of data.links) { const p = pageUrl(l.href, url); if (p && !seen.has(key(p))) { seen.add(key(p)); queue.push(p); } }
      pages.push(data);
      await page.waitForTimeout(DELAY); // be gentle with small business servers
      console.log(`page ${pages.length}/${MAX_PAGES} ${decodeURI(url).slice(0, 100)}  blocks=${data.blocks.length} imgs=${data.images.length}`);
    } catch (e) { console.log('fail', url, e.message.split('\n')[0]); }
  }

  // contacts and socials, from every page
  const all = pages.map(p => p.text).join('\n');
  const hrefs = pages.flatMap(p => p.links.map(l => l.href));
  const phones = [...new Set([...(all.match(CONTACT.phone) || []), ...hrefs.filter(h => h.startsWith('tel:')).map(h => decodeURIComponent(h.slice(4)))].map(p => p.replace(/[^\d+]/g, '')))].slice(0, 8);
  const emails = [...new Set([...(all.match(CONTACT.email) || []), ...hrefs.filter(h => h.startsWith('mailto:')).map(h => h.slice(7).split('?')[0])])].filter(e => !/\.(png|jpe?g|webp|svg)$/i.test(e)).slice(0, 8);
  const whatsapp = [...new Set(hrefs.filter(h => /wa\.me|api\.whatsapp/.test(h)).map(h => (h.match(/(?:wa\.me\/|phone=)(\d+)/) || [])[1]).filter(Boolean))];
  const socials = [...new Set(hrefs.filter(h => SOCIAL.test(h) && !/share|sharer|intent|wa\.me|whatsapp|watch\?v=|youtu\.be\/|\/embed\//.test(h)))].slice(0, 20);
  const youtube = [...new Set(pages.flatMap(p => [...p.embeds, ...p.links.map(l => l.href)]).map(u => (u.match(/(?:embed\/|v=|youtu\.be\/|shorts\/)([\w-]{11})/) || [])[1]).filter(Boolean))];

  // media: logos first, then og images, then the largest images and backgrounds
  const want = new Map();
  const pushMedia = (src, meta) => { if (!src || want.has(src) || want.size >= MAX_MEDIA || /\.svg(\?|$)/i.test(src) && !meta.logo) return; want.set(src, meta); };
  (design?.logos || []).filter(l => l.kind === 'img').forEach(l => pushMedia(l.src, { logo: true, alt: l.alt }));
  pages.forEach(p => p.ogImage && pushMedia(new URL(p.ogImage, p.url).href, { og: true, page: p.url }));
  pages.flatMap(p => p.images.map(i => ({ ...i, page: p.url }))).filter(i => i.logo || i.w >= 480 || i.shownW >= 320)
    .sort((a, b) => (b.logo - a.logo) || (b.w * b.h - a.w * a.h)).forEach(i => pushMedia(i.src, { alt: i.alt, w: i.w, h: i.h, page: i.page, logo: i.logo }));
  pages.flatMap(p => p.backgrounds.map(b => ({ b, page: p.url }))).forEach(({ b, page }) => pushMedia(b, { background: true, page }));
  const media = []; let n = 0;
  for (const [src, meta] of want) {
    const ext = (src.split('?')[0].match(/\.(jpe?g|png|webp|gif|svg|avif)$/i) || [, 'jpg'])[1].toLowerCase();
    const file = `media/${String(++n).padStart(3, '0')}${meta.logo ? '-logo' : meta.og ? '-og' : ''}.${ext}`;
    try { const d = await download(src, path.join(OUT, file)); media.push({ file, src, ...meta, ...d }); }
    catch (e) { media.push({ src, ...meta, error: e.message }); }
  }
  (design?.logos || []).filter(l => l.kind === 'svg').forEach((l, i) => { const f = `media/logo-inline-${i + 1}.svg`; fs.writeFileSync(path.join(OUT, f), l.svg.includes('xmlns') ? l.svg : l.svg.replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"')); media.push({ file: f, logo: true, inline: true }); });
  if (design?.favicon) { try { const f = 'media/favicon' + (design.favicon.match(/\.(png|ico|svg)/i)?.[0] || '.png'); await download(design.favicon, path.join(OUT, f)); media.push({ file: f, favicon: true }); } catch { /* optional */ } }

  const home = pages[0] || {};
  // brand name: og:site_name, then JSON-LD, then the title segment that matches the domain, else the shortest one
  const host = new URL(START).hostname.replace(/^www\./, '').split('.')[0].toLowerCase();
  const parts = (home.title || '').split(/\s[|\-–—·]\s|[|–—]/).map(x => x.trim()).filter(Boolean);
  const name = home.ogSite || (home.jsonld || []).map(j => j.name || j['@graph']?.find?.(g => g.name)?.name).find(Boolean)
    || parts.find(x => host.length > 3 && x.toLowerCase().replace(/[^a-z0-9]/g, '').includes(host.replace(/[^a-z0-9]/g, '')))
    || parts.sort((x, y) => x.length - y.length)[0] || host;
  const site = {
    source: START, crawledAt: new Date().toISOString(), name, lang: home.lang, dir: home.dir,
    counts: { pages: pages.length, sitemapUrls: sm.length, media: media.filter(m => m.file).length, youtube: youtube.length },
    notCrawled: sm.filter(u => !pages.some(p => key(p.url) === key(u)) && !docs.some(d => key(d.url) === key(u))),
    docs,
    contacts: { phones, emails, whatsapp, socials, youtube },
    design: design ? { ...design, logos: design.logos.map(l => ({ ...l, svg: l.svg ? '(saved to media/)' : undefined })) } : null,
    pages: pages.map(({ text, links, ...p }) => {
      // keep the link graph (targets and anchor text), not only a count: internal linking is part of what a rebuild must preserve
      const linkList = links.map(l => ({ to: pageUrl(l.href, p.url), text: l.text, nav: l.nav })).filter(l => l.to).map(l => ({ ...l, to: new URL(l.to).pathname }));
      return { ...p, internalLinks: linkList.length, linkList };
    }),
    media,
  };
  writeJSON(path.join(OUT, 'site.json'), site);
  if (site.notCrawled.length) console.log(`WARNING: the sitemap lists ${sm.length} URLs but ${site.notCrawled.length} were not crawled (raise --max). Every indexed page is part of what a rebuild inherits.`);

  const md = pages.map(p => `\n\n## ${p.title}\n<${decodeURI(p.url)}>\n\n` + p.blocks.filter(b => b.region === 'main').map(b => b.lines ? b.lines.join('  \n') : b.kind.startsWith('h') ? `${'#'.repeat(Math.min(6, +b.kind[1] + 2))} ${b.text}` : b.kind === 'li' ? `- ${b.text}` : b.kind === 'cta' ? `[${b.text}]` : b.text).join('\n\n')).join('\n');
  fs.writeFileSync(path.join(OUT, 'content.md'), `# ${name}: all site text\n\nSource: ${START} · crawled ${site.crawledAt.slice(0, 10)} · ${pages.length} pages${md}\n`);

  const pal = d => (d || []).map(c => `\`${c.hex}\``).join(' ');
  const summary = `# Intake summary: ${name}

- Source: ${START}
- Pages read: ${pages.length} · media saved: ${site.counts.media} · YouTube videos: ${youtube.length}
- Language: ${home.lang || '?'} · direction: ${home.dir || '?'}

## Contacts
- Phones: ${phones.join(', ') || '(none found)'}
- Emails: ${emails.join(', ') || '(none found)'}
- WhatsApp: ${whatsapp.join(', ') || '(none found)'}
- Social: ${socials.join(' · ') || '(none found)'}

## Visual identity (sampled from the home page)
- Background colors by area: ${pal(design?.backgrounds)}
- Text colors: ${pal(design?.text)}
- Button colors: ${pal(design?.buttons)}
- Fonts: display \`${design?.fonts?.display || '-'}\` · h1 \`${design?.fonts?.h1 || '-'}\` · body \`${design?.fonts?.body || '-'}\`
- Loaded faces: ${(design?.loaded || []).join(', ') || '-'}
- Logo candidates: ${media.filter(m => m.logo && m.file).map(m => m.file).join(', ') || '(none; check shots/)'}

## Pages
${pages.map(p => `- ${p.title} (${p.blocks.length} text blocks, ${p.images.length} images)`).join('\n')}

## Before using any of this
- Mark every image as real (photographed at the business) or a render/stock image. Ask the owner when unsure.
- Numbers, prices and testimonials must be copied exactly, with the page they came from.
- Read content.md end to end before writing a single new line.
`;
  fs.writeFileSync(path.join(OUT, 'summary.md'), summary);
  await browser.close();
  console.log(`done: ${OUT}  pages=${pages.length} media=${site.counts.media}`);
}

main().catch(e => { console.error(e); process.exit(1); });
