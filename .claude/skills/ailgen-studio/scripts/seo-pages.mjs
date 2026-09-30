#!/usr/bin/env node
// Crawlable pages: one real URL per service, guide and inner page, with everything a search engine reads in the HTML.
//   node seo-pages.mjs --config projects/<slug>/seo/pages.json
// The config is composed per project (see projects/talorkaradi/seo/compose.mjs); this tool only renders it, so the
// rules live in one place: unique title, description, one h1, canonical, Open Graph, JSON-LD, breadcrumbs, related
// links, contextual auto-links, and a footer that lists every service and guide. No JavaScript is needed to read any
// of it. Previews are written with noindex (config.preview); nothing about the preview is shown to visitors (a banner only with
// config.showPreviewBanner). Flip the flag on launch day.
// Page extensions (trusted HTML from the project composer, never from a visitor): p.style (extra CSS, e.g. a brand's colours),
// p.bodyClass, p.heroHtml (replaces kicker/h1/lead; must hold the one h1), p.intro (HTML after the lead), p.trail (HTML after the
// article), p.guide {lines, links} (a corner guide, needs C.guideAvatar), blocks {k:'html', html}, p.product.brandCard {name, origin, about, href, t}.
//
// config = {
//   site: 'https://example.co.il', out: 'folder', preview: true, lang: 'he', dir: 'rtl',
//   brand: { name, short, phone, phoneHref, logo, ogImage, themeColor, sameAs: [], foundingDate, cta: {t, href}, bannerHtml },
//   css: 'optional extra css', fontsCss: 'path to a css file with @font-face (urls relative to the site root)',
//   nav: [{ t, href }], groups: { services: [paths], guides: [paths] }, groupTitles: { services, guides },
//   autolinks: [{ phrase, href }],
//   pages: [{ path, type: 'service'|'guide'|'page'|'hub', title, description, h1, kicker, lead, image: {src, alt, w, h},
//             blocks: [{k:'h2'|'h3'|'p'|'ul', t|items}], parent: {t, href}, related: [paths], cta: {t, href}, list: [paths] }]
// }
import fs from 'fs';
import path from 'path';
import { parseArgs } from './lib.mjs';

const a = parseArgs();
if (!a.config) { console.error('usage: node seo-pages.mjs --config <pages.json>'); process.exit(2); }
const cfgFile = path.resolve(a.config), C = JSON.parse(fs.readFileSync(cfgFile, 'utf8'));
const OUT = path.resolve(path.dirname(cfgFile), C.out || '.');
const SITE = C.site.replace(/\/$/, ''), B = C.brand;
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const enc = p => encodeURI(p);
/** Calls to action that land on the home page carry the page they came from, so the lead shows which page brought it. */
const ctaHref = (h, from) => /^\/#/.test(h) ? `/?from=${encodeURIComponent(from)}${h.slice(1)}` : enc(h);
const abs = p => /^https?:/.test(p) ? p : SITE + enc(p);
const byPath = new Map(C.pages.map(p => [p.path, p]));
const link = p => `<a href="${enc(p)}">${esc(byPath.get(p)?.h1 || byPath.get(p)?.title || p)}</a>`;
const vis = t => String(t || '').replace(/\s*[>»›<«‹]+\s*$/, '').trim();
const short = p => { const x = byPath.get(p); return esc(x?.short || x?.h1 || x?.title || p); };

/** Link the first occurrence of each phrase in a paragraph; each target once per page, never to itself, never nested. */
function autolink(text, used, self, max) {
  const hits = [];
  for (const { phrase, href } of C.autolinks || []) {
    if (used.size + hits.length >= max || used.has(href) || hits.some(h => h.href === href) || href === self || href === '/') continue;
    const i = text.indexOf(phrase); if (i < 0 || hits.some(h => i < h.end && i + phrase.length > h.start)) continue;
    hits.push({ start: i, end: i + phrase.length, href });
  }
  hits.sort((x, y) => x.start - y.start);
  let out = '', at = 0;
  for (const h of hits) { out += esc(text.slice(at, h.start)) + `<a href="${enc(h.href)}">${esc(text.slice(h.start, h.end))}</a>`; at = h.end; used.add(h.href); }
  return out + esc(text.slice(at));
}

const ogMapFile = path.join(OUT, 'og', 'og-map.json'), OGMAP = fs.existsSync(ogMapFile) ? JSON.parse(fs.readFileSync(ogMapFile, 'utf8')) : {}; // written by seo-og.mjs
// preload the Hebrew faces (at most two files) so the font swap does not shift the first paint
const preloadFonts = [...new Set([...(C.fontsCss ? fs.readFileSync(path.resolve(path.dirname(cfgFile), C.fontsCss), 'utf8') : '').matchAll(/\/\* hebrew \*\/\s*@font-face\s*\{[^}]*?url\(([^)]+)\)/g)].map(m => m[1]))].slice(0, 2).map(u => `<link rel="preload" href="/fonts/${u}" as="font" type="font/woff2" crossorigin>`).join('');
const fontsCss = C.fontsCss ? fs.readFileSync(path.resolve(path.dirname(cfgFile), C.fontsCss), 'utf8').replace(/url\(([^)/][^)]*)\)/g, 'url(/fonts/$1)') : '';
const CSS = `
:root{--deep:#0B1B2E;--onAccent:#0B1B2E;--hdrBg:var(--deep);--hdrFg:var(--onDeep);--ftBg:var(--deep);--ftFg:var(--onDeep);--paper:#F4F5F0;--surface:#fff;--ink:#0B1B2E;--steel:#5A6670;--line:#DCE0D8;--kick:#1E7A38;--link:#2560A8;--accent:#C9F03A;--onDeep:#EEF3F6;--mute:#AFC0D0;--display:'Rubik',system-ui,'Arial Hebrew',Arial,sans-serif;--body:var(--display);--num:var(--display);--wrap:1100px;--mono:'IBM Plex Mono',ui-monospace,Menlo,monospace;color-scheme:light}
@media (prefers-color-scheme:dark){:root{--paper:#0F1B27;--surface:#152536;--ink:#E7EDF1;--steel:#A3B1BE;--line:#26394C;--kick:#72C487;--link:#7AB6EC;color-scheme:dark}}
*,*::before,*::after{box-sizing:border-box}html{-webkit-text-size-adjust:100%;overflow-x:clip}body{margin:0;background:var(--paper);color:var(--ink);font:400 18px/1.75 var(--body);-webkit-font-smoothing:antialiased}
img{max-width:100%;height:auto;display:block}a{color:var(--link)}h1,h2,h3{font-weight:800;line-height:1.15;letter-spacing:-.012em;margin:0;text-wrap:balance}p{margin:0 0 1em}
.wrap{max-width:var(--wrap);margin-inline:auto;padding-inline:clamp(16px,4vw,32px)}.skip{position:absolute;inset-inline-start:12px;top:-60px;background:var(--accent);color:var(--onAccent);padding:10px 16px;border-radius:10px;font-weight:700;z-index:10}.skip:focus{top:12px}
:focus-visible{outline:3px solid var(--link);outline-offset:3px;border-radius:6px}
.pv{background:var(--accent);color:var(--onAccent);font:600 13px/1.4 var(--mono);text-align:center;padding:7px 16px}
header.site{background:var(--hdrBg);color:var(--hdrFg)}header.site .in{display:flex;flex-wrap:wrap;align-items:center;gap:8px 20px;min-height:72px;padding-block:8px}
.logo{display:flex;align-items:center;gap:10px;text-decoration:none;color:inherit;font-weight:800;font-size:20px}.logo img{width:42px;height:42px}.logo small{display:block;font:500 12px/1 var(--display);opacity:.8;margin-bottom:3px}
nav.main{display:flex;flex-wrap:wrap;gap:4px 6px;margin-inline-start:auto;align-items:center}nav.main a,nav.main summary{color:inherit;text-decoration:none;padding:8px 12px;border-radius:999px;font-size:15px;font-weight:500;cursor:pointer;list-style:none}
nav.main a:hover,nav.main summary:hover,nav.main [aria-current]{background:color-mix(in srgb,currentColor 12%,transparent)}nav.main summary::-webkit-details-marker{display:none}nav.main summary::after{content:" ▾";font-size:11px}
.dd{position:relative}.dd div{position:absolute;inset-inline-start:0;top:100%;z-index:20;min-width:280px;background:var(--surface);color:var(--ink);border:1px solid var(--line);border-radius:14px;padding:8px;box-shadow:0 20px 40px -20px rgba(0,0,0,.5);display:grid}
.dd div a{color:var(--ink);border-radius:8px}.dd div a:hover{background:var(--paper)}.call{background:var(--accent)!important;color:var(--onAccent)!important;font-weight:700!important}
.crumbs{font:500 13.5px var(--mono);color:var(--steel);padding-block:22px 0}.crumbs ol{list-style:none;margin:0;padding:0;display:flex;flex-wrap:wrap;gap:4px 8px}.crumbs li+li::before{content:"‹";margin-inline-end:8px}.crumbs a{color:inherit}
article{padding-block:16px 40px;max-width:780px}.kick{font:600 12.5px/1 var(--mono);letter-spacing:.14em;color:var(--kick);margin:18px 0 12px}
h1{font-size:clamp(32px,5vw,52px)}.lead{font-size:clamp(19px,2vw,22px);color:var(--steel);margin-top:18px}.hero{margin:26px 0;border-radius:16px;overflow:hidden;background:#1b2c3f}.hero{position:relative}.hero img{width:100%;max-height:440px;object-fit:cover}.hero .lbl{position:absolute;inset-inline-start:12px;bottom:12px;background:rgba(11,27,46,.78);color:#fff;font:600 11.5px/1 var(--mono);letter-spacing:.05em;padding:7px 10px;border-radius:999px}.hero .lbl::before{content:"";display:inline-block;width:7px;height:7px;border-radius:50%;background:var(--accent);margin-inline-end:6px}
article h2{font-size:clamp(25px,3vw,34px);margin:1.6em 0 .5em}article h3{font-size:clamp(20px,2.2vw,25px);margin:1.4em 0 .4em}article ul{padding-inline-start:1.2em;margin:0 0 1.2em}article li{margin-bottom:.35em}
.tw{overflow-x:auto;margin:1em 0 1.4em;border:1px solid var(--line);border-radius:12px}.tw table{border-collapse:collapse;width:100%;min-width:480px;font-size:16px}.tw th,.tw td{padding:10px 14px;text-align:start;border-bottom:1px solid var(--line);vertical-align:top}.tw th{background:var(--surface);font-weight:700}article blockquote{margin:1.2em 0;padding:4px 20px;border-inline-start:4px solid var(--accent);color:var(--steel)}
.toc{background:var(--surface);border:1px solid var(--line);border-radius:14px;padding:16px 20px;margin:24px 0}.toc b{font:600 12px var(--mono);letter-spacing:.1em;color:var(--steel)}.toc ol{margin:8px 0 0;padding-inline-start:1.3em;font-size:16px}
.cta{background:var(--deep);color:var(--onDeep);border-radius:20px;padding:clamp(22px,4vw,36px);margin:36px 0;display:flex;flex-wrap:wrap;gap:16px 24px;align-items:center;justify-content:space-between}.cta h2{font-size:clamp(22px,3vw,30px);margin:0;color:inherit}.cta p{margin:6px 0 0;color:var(--mute)}
.btn{display:inline-flex;align-items:center;min-height:50px;padding:0 24px;border-radius:999px;background:var(--accent);color:var(--onAccent);font-weight:700;text-decoration:none}.btn.ghost{background:transparent;color:inherit;box-shadow:inset 0 0 0 1.5px currentColor;margin-inline-start:8px}
.rel{display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:14px;margin:12px 0 0;padding:0;list-style:none}.rel a{display:block;height:100%;background:var(--surface);border:1px solid var(--line);border-radius:14px;padding:16px 18px;text-decoration:none;color:var(--ink);font-weight:600;line-height:1.4}.rel a:hover{border-color:var(--link)}.rel small{display:block;color:var(--steel);font-weight:400;font-size:14px;margin-top:6px}
.relh{font-size:22px;margin:36px 0 0}.hub{display:grid;gap:14px;list-style:none;padding:0}.hub a{display:block;background:var(--surface);border:1px solid var(--line);border-radius:14px;padding:18px 22px;text-decoration:none;color:var(--ink)}.hub b{display:block;font-size:20px}.hub span{color:var(--steel);font-size:16px}
footer.site{background:var(--ftBg);color:var(--ftFg);padding-block:48px 34px;margin-top:40px;font-size:15.5px}footer.site .cols{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:28px}footer.site h2{font:600 13px var(--mono);letter-spacing:.12em;color:var(--accent);margin:0 0 12px}
footer.site ul{list-style:none;margin:0;padding:0;display:grid;gap:6px}footer.site a{color:var(--ftFg);text-decoration:none;opacity:.9}footer.site a:hover{text-decoration:underline;opacity:1}footer.site .fine{margin-top:28px;padding-top:18px;border-top:1px solid color-mix(in srgb,currentColor 18%,transparent);color:var(--mute);font-size:14px}
article.wide{max-width:none}
.pdp{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:clamp(20px,4vw,48px);align-items:start;margin:24px 0 8px}
.pdp .gal{margin:0;position:relative;background:#fff;border:1px solid var(--line);border-radius:22px;overflow:hidden}.pdp .gal img{width:100%;aspect-ratio:1/1;object-fit:contain}
.pdp .gal .lbl{position:absolute;inset-inline-start:12px;bottom:12px;background:rgba(11,27,46,.78);color:#fff;font:600 11.5px/1 var(--mono);letter-spacing:.05em;padding:7px 10px;border-radius:999px}
.pdp .buy{display:grid;gap:14px;align-content:start}.price{font:700 clamp(34px,4vw,46px)/1 var(--num);color:var(--ink);margin:0}.price s{font-size:.5em;color:var(--steel);font-weight:400;margin-inline-start:10px}
.avail{display:inline-flex;align-items:center;gap:8px;font-weight:600;margin:0}.avail::before{content:"";width:10px;height:10px;border-radius:50%;background:var(--kick)}.avail.out::before{background:var(--steel)}
.pdp .acts{display:flex;flex-wrap:wrap;gap:10px}.snap{font-size:14.5px;color:var(--steel);margin:0}.facts{list-style:none;margin:0;padding:0;display:grid;gap:0;border:1px solid var(--line);border-radius:14px;overflow:hidden}.facts li{display:flex;justify-content:space-between;gap:16px;padding:10px 14px;border-bottom:1px solid var(--line);margin:0}.facts li:last-child{border-bottom:0}.facts b{font-weight:600}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(210px,1fr));gap:16px;list-style:none;margin:18px 0 0;padding:0}.pc{display:flex;flex-direction:column;height:100%;background:var(--surface);border:1px solid var(--line);border-radius:18px;overflow:hidden;text-decoration:none;color:var(--ink)}.pc:hover{border-color:var(--link)}.pc img{width:100%;aspect-ratio:1/1;object-fit:contain;background:#fff}.pc .in{padding:12px 14px 14px;display:grid;gap:4px}.pc b{font-weight:600;line-height:1.35;font-size:16px}.pc .pr{font:700 19px var(--num)}.pc .av{font-size:13.5px;color:var(--steel)}
.mmenu{display:none;margin-inline-start:auto;position:relative}.mmenu summary{list-style:none;cursor:pointer;display:inline-flex;align-items:center;gap:8px;min-height:44px;padding:0 14px;border-radius:999px;font-weight:700;border:1.5px solid color-mix(in srgb,currentColor 30%,transparent)}.mmenu summary::-webkit-details-marker{display:none}.mmenu summary span{width:18px;height:2px;background:currentColor;box-shadow:0 -6px 0 currentColor,0 6px 0 currentColor;margin-block:6px}
.mmenu div{position:absolute;inset-inline-end:0;top:calc(100% + 8px);z-index:40;width:min(330px,calc(100vw - 32px));max-height:75vh;overflow:auto;background:var(--surface);color:var(--ink);border:1px solid var(--line);border-radius:18px;padding:10px;display:grid;gap:2px;box-shadow:0 26px 50px -24px rgba(0,0,0,.45)}.mmenu div a{color:var(--ink);text-decoration:none;padding:10px 12px;border-radius:10px;min-height:44px;display:flex;align-items:center}.mmenu div a:hover{background:var(--paper)}.mmenu div b{font-size:12.5px;letter-spacing:.1em;color:var(--steel);padding:12px 12px 4px}.mmenu .call{justify-content:center;margin-top:8px}
.guide{position:fixed;z-index:25;inset-inline-end:16px;bottom:16px;display:flex;flex-direction:column-reverse;align-items:flex-end;gap:8px}.guide summary{list-style:none;cursor:pointer;width:64px;height:70px;filter:drop-shadow(0 8px 10px rgba(60,30,25,.25));border-radius:14px}.guide summary::-webkit-details-marker{display:none}.guide summary svg{width:100%;height:100%;display:block}
.guide .gb{width:min(300px,calc(100vw - 32px));background:var(--surface);color:var(--ink);border:1.5px solid var(--ink);border-radius:18px 18px 4px 18px;padding:12px 14px;box-shadow:0 20px 40px -24px rgba(0,0,0,.45);font-size:15.5px;line-height:1.55}.guide .gb p{margin:0 0 6px}.guide .gl{display:flex;flex-wrap:wrap;gap:6px 14px;margin:6px 0 0}.guide .gl a{font-weight:700;min-height:32px;display:inline-flex;align-items:center}
@media print{.guide{display:none}}
@media (max-width:760px){.pdp{grid-template-columns:1fr}nav.main{display:none}.mmenu{display:block}header.site .in{flex-wrap:nowrap}}
@media (prefers-reduced-motion:reduce){*{transition:none!important;animation:none!important}}
${C.theme?.css || ''}
${C.css || ''}`;

function ld(p) {
  const org = { '@type': 'Organization', '@id': SITE + '/#org', name: B.name, url: SITE + '/', logo: abs(B.logo || '/icon.svg'), ...(B.sameAs?.length ? { sameAs: B.sameAs } : {}), ...(B.phone ? { contactPoint: { '@type': 'ContactPoint', telephone: B.phone, contactType: 'customer service', areaServed: 'IL', availableLanguage: 'he' } } : {}), ...(B.foundingDate ? { foundingDate: String(B.foundingDate) } : {}) };
  const url = abs(p.path), img = p.image?.src ? abs(p.image.src) : abs(B.ogImage);
  const crumbs = [{ n: B.short || B.name, u: SITE + '/' }, ...(p.parent ? [{ n: p.parent.t, u: abs(p.parent.href) }] : []), { n: p.short || p.h1, u: url }];
  const main = p.type === 'guide' ? { '@type': 'Article', headline: p.h1, description: p.description, inLanguage: C.lang || 'he', mainEntityOfPage: url, image: img, ...(p.datePublished ? { datePublished: p.datePublished } : {}), ...(p.dateModified ? { dateModified: p.dateModified } : {}), author: { '@id': org['@id'] }, publisher: { '@id': org['@id'] } }
    : p.type === 'service' ? { '@type': 'Service', name: p.h1, description: p.description, url, provider: { '@id': org['@id'] }, areaServed: { '@type': 'Country', name: 'IL' }, image: img }
    : p.type === 'product' ? { '@type': 'Product', name: p.h1, description: p.description, url, image: (p.product.images || []).map(i => abs(i.src)), ...(p.product.sku ? { sku: String(p.product.sku) } : {}), ...(p.product.brand ? { brand: { '@type': 'Brand', name: p.product.brand } } : {}),
        offers: { '@type': 'Offer', url, priceCurrency: p.product.currency || 'ILS', price: String(p.product.price), availability: 'https://schema.org/' + (p.product.availability || 'InStock'), ...(p.product.condition === false ? {} : { itemCondition: 'https://schema.org/NewCondition' }), seller: { '@id': org['@id'] } } }
    : p.type === 'collection' ? { '@type': 'CollectionPage', name: p.h1, description: p.description, url, inLanguage: C.lang || 'he', mainEntity: { '@type': 'ItemList', numberOfItems: (p.list || []).length, itemListElement: (p.list || []).map((x, i) => ({ '@type': 'ListItem', position: i + 1, url: abs(x), name: byPath.get(x)?.h1 })) } }
    : p.type === 'hub' ? { '@type': 'CollectionPage', name: p.h1, description: p.description, url, hasPart: (p.list || []).map(x => ({ '@type': 'WebPage', name: byPath.get(x)?.h1, url: abs(x) })) }
    : { '@type': 'WebPage', name: p.h1, description: p.description, url, inLanguage: C.lang || 'he' };
  const faq = p.faq?.length ? [{ '@type': 'FAQPage', mainEntity: p.faq.map(([q, a]) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a } })) }] : [];
  return { '@context': 'https://schema.org', '@graph': [org, main, ...faq, { '@type': 'BreadcrumbList', itemListElement: crumbs.map((c, i) => ({ '@type': 'ListItem', position: i + 1, name: c.n, item: c.u })) }] };
}

function head(p) {
  const url = abs(p.path), og = OGMAP[p.path], img = abs(og || p.image?.src || B.ogImage);
  return `<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>${esc(p.title)}</title><meta name="description" content="${esc(p.description)}">
<link rel="canonical" href="${esc(url)}">${C.preview ? '\n<meta name="robots" content="noindex,follow">' : '\n<meta name="robots" content="index,follow,max-image-preview:large">'}
<meta name="theme-color" content="${esc(B.themeColor || '#0B1B2E')}"><link rel="icon" href="/icon.svg" type="image/svg+xml">${B.appleIcon ? `<link rel="apple-touch-icon" href="${esc(B.appleIcon)}">` : ''}
<meta property="og:type" content="${p.type === 'guide' ? 'article' : p.type === 'product' ? 'product' : 'website'}">${p.type === 'product' ? `<meta property="product:price:amount" content="${esc(p.product.price)}"><meta property="product:price:currency" content="${esc(p.product.currency || 'ILS')}"><meta property="product:availability" content="${p.product.availability === 'OutOfStock' ? 'out of stock' : 'in stock'}">` : ''}<meta property="og:locale" content="he_IL"><meta property="og:site_name" content="${esc(B.name)}"><meta property="og:title" content="${esc(p.title)}"><meta property="og:description" content="${esc(p.description)}"><meta property="og:url" content="${esc(url)}"><meta property="og:image" content="${esc(img)}">
<meta property="og:image:alt" content="${esc(p.h1)}">${og ? '<meta property="og:image:width" content="1200"><meta property="og:image:height" content="630">' : ''}
<meta name="twitter:card" content="summary_large_image">
${preloadFonts}${p.image?.src ? `<link rel="preload" as="image" href="${esc(p.image.src)}">` : ''}<style>${fontsCss}${CSS}${p.style || ''}</style>
<script type="application/ld+json">${JSON.stringify(ld(p))}</script>`;
}

const navHtml = cur => `<nav class="main" aria-label="ניווט ראשי">${(C.nav || []).map(n => n.menu
  ? `<details class="dd"><summary>${esc(n.t)}</summary><div>${n.all ? `<a href="${enc(n.all.href)}"${n.all.href === cur ? ' aria-current="page"' : ''}><b>${esc(n.all.t)}</b></a>` : ''}${(C.groups[n.menu] || []).map(x => `<a href="${enc(x)}"${x === cur ? ' aria-current="page"' : ''}>${short(x)}</a>`).join('')}</div></details>`
  : `<a href="${enc(n.href)}"${n.href === cur ? ' aria-current="page"' : ''}>${esc(n.t)}</a>`).join('')}${B.phone ? `<a class="call" href="tel:${esc(B.phoneHref || B.phone)}">${esc(B.phoneLabel ?? 'מוקד')} <bdi dir="ltr">${esc(B.phone)}</bdi></a>` : ''}</nav>`;

/** On narrow screens the nav collapses into one menu (a native details element: no script, keyboard and screen-reader friendly). */
const mobileMenu = cur => `<details class="mmenu"><summary aria-label="תפריט"><span aria-hidden="true"></span>תפריט</summary><div>${(C.nav || []).map(n => n.menu
  ? `<b>${esc(n.t)}</b>${n.all ? `<a href="${enc(n.all.href)}">${esc(n.all.t)}</a>` : ''}${(C.groups[n.menu] || []).map(x => `<a href="${enc(x)}"${x === cur ? ' aria-current="page"' : ''}>${short(x)}</a>`).join('')}`
  : `<a href="${enc(n.href)}"${n.href === cur ? ' aria-current="page"' : ''}>${esc(n.t)}</a>`).join('')}${B.phone ? `<a class="call" href="tel:${esc(B.phoneHref || B.phone)}">${esc(B.phoneLabel ?? 'מוקד')} <bdi dir="ltr">${esc(B.phone)}</bdi></a>` : ''}</div></details>`;
const footer = () => `<footer class="site"><div class="wrap"><div class="cols">
${Object.entries(C.groups).map(([g, list]) => `<section aria-labelledby="f-${g}"><h2 id="f-${g}">${esc(C.groupTitles?.[g] || g)}</h2><ul>${list.map(x => `<li><a href="${enc(x)}">${short(x)}</a></li>`).join('')}</ul></section>`).join('\n')}
<section aria-labelledby="f-c"><h2 id="f-c">${esc(C.contactTitle || 'צור קשר')}</h2><ul>${B.phone ? `<li><a href="tel:${esc(B.phoneHref || B.phone)}">${esc(B.phoneLabel ?? 'מוקד')} <bdi dir="ltr">${esc(B.phone)}</bdi></a></li>` : ''}${(C.footerLinks || []).map(l => `<li><a href="${enc(l.href)}">${esc(l.t)}</a></li>`).join('')}</ul></section>
</div><p class="fine">© ${new Date().getFullYear()} ${esc(B.name)}${B.credit ? ' · ' + esc(B.credit) : ''}</p></div></footer>`;

function render(p) {
  const used = new Set(), h2s = p.blocks.filter(b => b.k === 'h2');
  const id = t => 'h-' + Math.abs([...t].reduce((h, c) => (h * 31 + c.charCodeAt(0)) | 0, 7)).toString(36);
  const table = b => `<div class="tw"><table><thead><tr>${(b.rows[0] || []).map(c => `<th scope="col">${esc(c)}</th>`).join('')}</tr></thead><tbody>${b.rows.slice(1).filter(Boolean).map(r => `<tr>${r.map(c => `<td>${esc(c)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
  const body = p.blocks.map(b => b.k === 'html' ? b.html : b.k === 'table' ? table(b) : b.k === 'quote' ? `<blockquote>${esc(b.t)}</blockquote>` : b.k === 'links' ? `<ul>${b.items.map(i => `<li><a href="${/^https?:/.test(i.href) ? esc(i.href) : enc(i.href)}"${/^https?:/.test(i.href) ? ' rel="noopener"' : ''}>${esc(i.t)}</a>${i.note ? ' ' + esc(i.note) : ''}</li>`).join('')}</ul>` : b.k === 'p' ? `<p>${autolink(b.t, used, p.path, p.type === 'guide' ? 4 : 2)}</p>` : b.k === 'ul' ? `<ul>${b.items.map(i => `<li>${esc(i)}</li>`).join('')}</ul>` : `<${b.k}${b.k === 'h2' ? ` id="${id(b.t)}"` : ''}>${esc(b.t)}</${b.k}>`).join('\n');
  const toc = p.type === 'guide' && h2s.length >= 4 ? `<nav class="toc" aria-label="בעמוד הזה"><b>בעמוד הזה</b><ol>${h2s.map(h => `<li><a href="#${id(h.t)}">${esc(h.t)}</a></li>`).join('')}</ol></nav>` : '';
  const crumbs = [{ t: B.short || B.name, h: '/' }, ...(p.parent ? [{ t: p.parent.t, h: p.parent.href }] : []), { t: p.short || p.h1 }];
  const cta = p.cta || B.cta;
  const rel = (p.related || []).filter(x => byPath.has(x));
  const pr = p.product, money = t => `<bdi>${esc(t)}</bdi>`;
  const pdp = pr ? `<div class="pdp"><figure class="gal"><img src="${esc(pr.images[0].src)}" alt="${esc(pr.images[0].alt || p.h1)}" width="${pr.images[0].w || 900}" height="${pr.images[0].h || 900}" fetchpriority="high">${pr.images[0].label ? `<figcaption class="lbl">${esc(pr.images[0].label)}</figcaption>` : ''}</figure>
<div class="buy"><p class="price">${money(pr.priceText)}${pr.compareText ? `<s>${money(pr.compareText)}</s>` : ''}</p><p class="avail${pr.availability === 'InStock' ? '' : ' out'}">${pr.availability === 'InStock' ? 'במלאי' : 'אזל מהמלאי'}</p>
<div class="acts">${pr.buy ? `<a class="btn" href="${esc(pr.buy.href)}" rel="nofollow noopener">${esc(pr.buy.t)}</a>` : ''}${pr.ask ? `<a class="btn ghost" href="${esc(pr.ask.href)}" rel="noopener">${esc(pr.ask.t)}</a>` : ''}</div>
${(pr.facts || []).length ? `<ul class="facts">${pr.facts.map(([k, v]) => `<li><b>${esc(k)}</b><span>${esc(v)}</span></li>`).join('')}</ul>` : ''}${pr.brandCard ? `<aside class="bcard" aria-label="על המותג"><b>${esc(pr.brandCard.name)}</b>${pr.brandCard.origin ? `<span class="or">${esc(pr.brandCard.origin)}</span>` : ''}${pr.brandCard.about ? `<p>${esc(pr.brandCard.about)}</p>` : ''}${pr.brandCard.href ? `<a href="${enc(pr.brandCard.href)}">${esc(pr.brandCard.t || 'לעמוד המותג')}</a>` : ''}</aside>` : ''}${pr.snapshot ? `<p class="snap">${esc(pr.snapshot)}</p>` : ''}</div></div>` : '';
  const grid = p.type === 'collection' ? `<ul class="grid">${(p.list || []).filter(x => byPath.has(x)).map((x, gi) => { const c = byPath.get(x), q = c.product; return `<li><a class="pc" href="${enc(x)}">${q ? `<img src="${esc(q.images[0].src)}" alt="${esc(q.images[0].alt || c.h1)}" width="${q.images[0].w || 900}" height="${q.images[0].h || 900}"${gi < 4 ? (gi === 0 ? ' fetchpriority="high"' : '') : ' loading="lazy"'} decoding="async">` : ''}<span class="in"><b>${esc(c.short || c.h1)}</b>${q ? `<span class="pr">${money(q.priceText)}</span><span class="av">${q.availability === 'InStock' ? 'במלאי' : 'אזל מהמלאי'}</span>` : `<span class="av">${esc(vis(c.description).slice(0, 90))}</span>`}</span></a></li>`; }).join('')}</ul>` : '';
  const hub = p.type === 'hub' ? `<ul class="hub">${(p.list || []).map(x => `<li><a href="${enc(x)}"><b>${esc(byPath.get(x).h1)}</b><span>${esc(vis(byPath.get(x).description))}</span></a></li>`).join('')}</ul>` : '';
  return `<!doctype html>
<html lang="${C.lang || 'he'}" dir="${C.dir || 'rtl'}"><head>
${head(p)}
</head><body${p.bodyClass ? ` class="${esc(p.bodyClass)}"` : ''}>
<a class="skip" href="#main">דלג לתוכן</a>${C.preview && C.showPreviewBanner && B.bannerHtml ? `\n<div class="pv">${B.bannerHtml}</div>` : ''}
<header class="site"><div class="wrap in"><a class="logo" href="/"><img src="${esc(B.logo || '/icon.svg')}" alt="" width="42" height="42"><span>${(() => { const sm = B.logoSmall === undefined ? (B.short ? 'קבוצת' : '') : B.logoSmall; return (sm ? `<small>${esc(sm)}</small>` : '') + esc(B.short || B.name); })()}</span></a>${navHtml(p.path)}${mobileMenu(p.path)}</div></header>
<main id="main" class="wrap">
<nav class="crumbs" aria-label="פירורי לחם"><ol>${crumbs.map((c, i) => `<li>${c.h ? `<a href="${enc(c.h)}">${esc(c.t)}</a>` : `<span aria-current="page">${esc(c.t)}</span>`}</li>`).join('')}</ol></nav>
<article${['product', 'collection'].includes(p.type) ? ' class="wide"' : ''}>
${p.heroHtml ? p.heroHtml : `<p class="kick">${esc(p.kicker || '')}</p><h1>${esc(p.h1)}</h1>${p.lead ? `<p class="lead">${esc(p.lead)}</p>` : ''}`}${p.intro || ''}
${pdp}
${p.image?.src && !p.product ? `<figure class="hero" style="margin-inline:0"><img src="${esc(p.image.src)}" alt="${esc(p.image.alt || '')}" width="${p.image.w || 1200}" height="${p.image.h || 675}" fetchpriority="high">${p.image.label ? `<figcaption class="lbl">${esc(p.image.label)}</figcaption>` : ''}</figure>` : ''}
${toc}
${body}
${hub}${grid}
${(p.after || []).map(b => b.k === 'links' ? `<h2>${esc(b.t)}</h2><ul>${b.items.map(i => `<li><a href="${enc(i.href)}">${esc(i.t)}</a>${i.note ? ' ' + esc(i.note) : ''}</li>`).join('')}</ul>` : '').join('')}
${p.faq?.length ? `<section aria-labelledby="faq"><h2 id="faq">${esc(p.faqTitle || 'שאלות ותשובות')}</h2>${p.faq.map(([q, a]) => `<h3>${esc(q)}</h3><p>${esc(a)}</p>`).join('')}</section>` : ''}
${cta ? `<aside class="cta" aria-label="הצעד הבא"><div><h2>${esc(cta.title || C.strings?.ctaTitle || 'רוצים לדעת כמה זה יעלה או כמה פסולת יהיה?')}</h2><p>${esc(cta.text || C.strings?.ctaText || 'מחשבון, מוקד ושיחה עם הצוות.')}</p></div><div><a class="btn" href="${ctaHref(cta.href, p.path)}">${esc(cta.t)}</a>${B.phone ? `<a class="btn ghost" href="tel:${esc(B.phoneHref || B.phone)}">${esc(B.phoneLabel ?? 'מוקד')} <bdi dir="ltr">${esc(B.phone)}</bdi></a>` : ''}</div></aside>` : ''}
</article>
${p.trail ? `<section class="trail">${p.trail}</section>` : ''}${rel.length ? `<section aria-labelledby="rel"><h2 class="relh" id="rel">${esc(p.relatedTitle || 'עוד בנושא')}</h2><ul class="rel">${rel.map(x => `<li><a href="${enc(x)}">${esc(byPath.get(x).h1)}<small>${esc(vis(byPath.get(x).description).slice(0, 110))}</small></a></li>`).join('')}</ul></section>` : ''}
</main>
${footer()}${p.guide && C.guideAvatar ? `\n<details class="guide"><summary aria-label="${esc(C.guideLabel || 'עזרה')}">${C.guideAvatar}</summary><div class="gb">${p.guide.lines.map(l => `<p>${esc(l)}</p>`).join('')}<p class="gl">${(p.guide.links || []).map(l => `<a href="${/^https?:/.test(l.href) ? esc(l.href) : enc(l.href)}"${/^https?:/.test(l.href) ? ' rel="noopener"' : ''}>${esc(l.t)}</a>`).join('')}</p></div></details>` : ''}
</body></html>
`;
}

/** A real 404 page (served with status 404 by the host): helpful links, never indexed. */
if (C.notFound !== false) {
  const p = { path: '/404.html', type: 'page', title: 'העמוד לא נמצא | ' + B.name, description: 'העמוד שחיפשתם לא נמצא.', h1: 'העמוד לא נמצא', short: 'לא נמצא', kicker: '404', lead: C.strings?.notFoundLead || 'ייתכן שהכתובת השתנתה. אלה השירותים והמדריכים שלנו, ואפשר גם לחזור לדף הבית.', blocks: [], cta: B.cta };
  const links = Object.entries(C.groups).map(([g, list]) => `<h2>${esc(C.groupTitles?.[g] || g)}</h2><ul>${list.map(x => `<li>${link(x)}</li>`).join('')}</ul>`).join('');
  const html = render({ ...p, blocks: [] }).replace('<meta name="robots" content="noindex,follow">', '').replace(/<meta name="robots"[^>]*>/, '').replace('<link rel="canonical" href="' + abs('/404.html') + '">', '<meta name="robots" content="noindex,follow">').replace('</article>', links + '</article>');
  fs.mkdirSync(OUT, { recursive: true }); fs.writeFileSync(path.join(OUT, '404.html'), html);
}

let n = 0;
for (const p of C.pages) {
  if (p.path === '/') continue; // the home page is the app; it gets its SEO head and links from the composer
  const dir = path.join(OUT, decodeURIComponent(p.path));
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'index.html'), render(p)); n++;
}
console.log(`${n} pages written to ${OUT}${C.preview ? ' (noindex: preview)' : ''}`);
