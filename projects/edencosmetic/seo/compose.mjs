#!/usr/bin/env node
// Eden Cosmetics · SEO composer: the store's catalog, policies and pages become crawlable pages, and the home page gets its static SEO head and links.
//   node projects/edencosmetic/seo/compose.mjs
// Reads   projects/edencosmetic/site-src/catalog-map.json   (71 products with category, brand, display title; the store's public JSON, 29.9.2026)
//         projects/edencosmetic/intake/site.json           (the old site's policy and page texts, word for word)
//         edencosmetic/legal.json, edencosmetic/src/3-data.js (FAQ)
//         projects/edencosmetic/seo/seo.config.json         ({ preview: true } until launch day)
// Writes  projects/edencosmetic/seo/pages.json              the config for scripts/seo-pages.mjs and seo-og.mjs
//         projects/edencosmetic/seo/redirect-overrides.json /collections/all and /collections/frontpage → their successors (the only 301s)
//         projects/edencosmetic/seo/robots-extra.txt, redirects-extra.txt   paths that stay on Shopify (cart, checkout, account, agents.md, UCP)
//         edencosmetic/src/1-head.html, 2-body.html         idempotent marker blocks (seo:head, seo:links-*, seo:faq, seo:noscript)
// Policy: every URL of the old site keeps its exact path (Shopify's /products/<h>, /collections/<h>, /pages/<h>, /policies/<s>, /blogs/news).
// Nothing is invented: text is the store's own, numbers come from the catalog, guides are tables of catalog data (a draft for Eden's approval).
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const HERE = path.dirname(fileURLToPath(import.meta.url)), ROOT = path.resolve(HERE, '../../..'), SITEDIR = path.join(ROOT, 'edencosmetic'), PROJ = path.join(ROOT, 'projects/edencosmetic');
const rd = f => fs.readFileSync(f, 'utf8'), cfg = JSON.parse(rd(path.join(HERE, 'seo.config.json')));
const SITE = cfg.site, PREVIEW = cfg.preview !== false, SNAP = '29.9.2026', STORE = 'https://edencosmetic.co.il';
const cat = JSON.parse(rd(path.join(PROJ, 'site-src/catalog-map.json'))), intake = JSON.parse(rd(path.join(PROJ, 'intake/site.json')));
const legal = JSON.parse(rd(path.join(SITEDIR, 'legal.json')));
const enc = encodeURI, esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const bidiClean = t => String(t).replace(/[‎‏‪-‮⁦-⁩]/g, '').replace(/\s+/g, ' ').trim();
// typography only, never wording: no space before punctuation, one after a comma (the store's legal texts keep every word)
const typo = t => String(t).replace(/\s+([,.;:!?])(?=\s|$)/g, '$1').replace(/,(?=[\u05D0-\u05EAA-Za-z])/g, ', ').replace(/\s{2,}/g, ' ');
const money = n => '₪' + Math.round(n).toLocaleString('he-IL');
const items = cat.items, byH = new Map(items.map(x => [x.h, x])), P = x => `/products/${x.h}/`;
const KINDS = { set: 'ערכות', step: 'שלבים בודדים', pads: 'סיליקונים', glue: 'דבק ובלאם', tint: 'צבע', oxidant: 'חמצן', clean: 'ניקוי', serum: 'טיפוח', tool: 'כלים' };
const NAME = 'עדן קוסמטיקס', WA = 'https://wa.me/972525453602?text=' + encodeURIComponent('שלום עדן, הגעתי מהאתר. ');
const range = a => a.length ? [Math.min(...a.map(x => x.p)), Math.max(...a.map(x => x.p))] : [0, 0];
const inStock = a => a.filter(x => x.a).length;
const cut = (t, max) => { t = String(t).replace(/\s+/g, ' ').trim(); if (t.length <= max) return t; const w = t.slice(0, max).replace(/\s+\S*$/, '').replace(/[\s,.;:–-]+$/, ''); return w; };
const title = (core, suffix = ' | ' + NAME) => { let t = core + suffix; if (t.length <= 65) return t; if (core.length <= 65) return core; return cut(core, 65); };
const desc = (t, min = 70, max = 158) => { let d = cut(t, max); if (d.length < min) d = (d + ' ' + 'עדן קוסמטיקס: ציוד מקצועי להרמת ריסים וגבות.').slice(0, max); return d; };

// ---------- collections and brands (the brand registry: projects/edencosmetic/brands.json, facts with official sources)
const REG = JSON.parse(rd(path.join(PROJ, 'brands.json')));
const regOf = name => REG.brands.find(b => b.match.some(m => m.toLowerCase() === String(name || '').toLowerCase())) || null;
const COLS = cat.cols;
const colTitle = h => (COLS.find(c => c.h === h) || {}).t || h;
const brandSlug = Object.fromEntries(REG.brands.map(r => [r.name, r.key]));
const brandList = r => items.filter(x => regOf(x.b) === r);
const BRANDS = REG.brands.filter(r => brandList(r).length >= REG.pageMin).map(r => r.name);
const colPath = h => `/collections/${h}/`, brandPath = b => `/brands/${brandSlug[b]}/`;
const GUIDES = [
  { path: '/guides/ערכה-להרמת-ריסים-וגבות/', key: 'kits' }, { path: '/guides/סיליקונים-להרמת-ריסים-מידות/', key: 'pads' }, { path: '/guides/צבע-לריסים-וגבות-מה-יש-בחנות/', key: 'tints' },
];
const POLICIES = [['shipping-policy', 'מדיניות משלוחים'], ['refund-policy', 'מדיניות החזרים'], ['terms-of-service', 'תנאי שירות'], ['privacy-policy', 'מדיניות פרטיות (החנות)'], ['contact-information', 'פרטי קשר']];
const CTA = { t: 'לבונה הערכה', href: '/#kit', title: 'מה עוד צריך לטיפול?', text: 'בונה הערכה מרכיב רשימה של מוצרים מהחנות, עם סכום ומה חסר למשלוח חינם.' };

// ---------- the store's own texts
const oldPage = p => intake.pages.find(x => decodeURIComponent(new URL(x.url).pathname) === p);
const NOISE = /^(משלוחים חינם|האתר שומר שבת|ESC$|דלג לתוכן|העגלה ריקה|סינון|מיין לפי|הצהרת נגישות$|דיווח הפרה)|Shift\+|Alt\+|^(ניווט מקלדת|ביטול הבהובים|מונוכרום|ספיה|ניגודיות גבוהה|שחור צהוב|היפוך צבעים|הדגשת|הצגת תיאור|תיאור קבוע|גופן קריא|הגדלת|הקטנת|סמן |איפוס)/;
function storeBlocks(p, { dropH1 = true } = {}) {
  const pg = oldPage(p); if (!pg) throw new Error('no old page ' + p);
  const out = [], seen = new Set();
  for (const b of pg.blocks) {
    if (b.region !== 'main' || b.kind === 'cta' || NOISE.test(b.text)) continue;
    if (b.kind === 'h1' && dropH1) continue;
    const t = bidiClean(b.text); if (!t || seen.has(b.kind + t)) continue; seen.add(b.kind + t);
    const tt = typo(t); out.push(/^h[1-6]$/.test(b.kind) ? { k: 'h2', t: tt } : b.kind === 'li' ? { k: 'ul', items: [tt] } : { k: 'p', t: tt });
  }
  return out.reduce((a, b) => { const l = a[a.length - 1]; if (b.k === 'ul' && l && l.k === 'ul') l.items.push(...b.items); else a.push(b); return a; }, []);
}
// a product description: consecutive short lines become a list, the rest are paragraphs; the words are the store's, untouched
function descBlocks(d) {
  const lines = String(d || '').split('\n').map(bidiClean).filter(Boolean), out = [];
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i], run = [l]; while (i + 1 < lines.length && lines[i + 1].length < 46 && l.length < 46 && !/[.!?:]$/.test(lines[i + 1])) run.push(lines[++i]);
    if (run.length >= 3) out.push({ k: 'ul', items: run }); else if (run.length === 2 && run.every(x => x.length < 28)) out.push({ k: 'p', t: run.join(' · ') }); else out.push(...run.map(t => ({ k: 'p', t })));
  }
  return out;
}

// ---------- pages
const pages = [], overrides = {};
const primaryCol = x => ['הרמת-ריסים-וגבות', 'דבקים-סיליקונים', 'מוצרים-נלווים'].find(h => x.g.includes(h)) || x.g[0] || 'כל-המוצרים';
const related = x => { const same = items.filter(y => y.i !== x.i && y.k === x.k && y.b === x.b && y.b), kind = items.filter(y => y.i !== x.i && y.k === x.k), col = items.filter(y => y.i !== x.i && y.g.includes(primaryCol(x))); return [...new Set([...same, ...kind, ...col].filter(y => y.a).map(P))].slice(0, 4); };
for (const x of items) {
  const stock = x.a ? 'במלאי' : 'אזל מהמלאי', kindL = KINDS[x.k] || '';
  const firstSentence = cut(bidiClean((x.d || '').split('\n').find(l => l.length > 24) || ''), 100);
  const d = x.d ? `${x.dt}. ${money(x.p)}, ${stock}. ${firstSentence}` : `${x.dt}. ${money(x.p)}, ${stock}. ציוד מקצועי להרמת ריסים וגבות, משלוח חינם מעל ₪499, איסוף עצמי מנתיבות.`;
  // (no dates in visitor copy: stock and prices are refreshed by the autonomy loop, scripts/evolve.mjs)
  const r = regOf(x.b), size = (x.dt.match(/(\d+(?:\.\d+)?)\s*(מ״ל|מ"ל|ml|יחידות|מידות|שקיות|זוגות|גרם|g)(?=\s|$|\))/) || [])[0];
  const facts = [['מחיר', money(x.p) + ' (כולל מע"מ, לא כולל משלוח)'], ['מלאי', stock], ...(r ? [['מותג', r.name + (r.origin ? ' · ' + r.origin.he : '')]] : []), ...(kindL ? [['קטגוריה', kindL]] : []), ...(size ? [['נפח / כמות', size]] : []), ...(x.s ? [['מק"ט', x.s]] : []), ['משלוח', 'חינם מעל ₪499 · 4–5 ימי עסקים']];
  pages.push({
    path: P(x), type: 'product', title: title(x.dt), description: desc(d), h1: x.dt, short: cut(x.dt, 44), kicker: (x.b || kindL || 'ציוד מקצועי').toUpperCase(),
    image: { src: `/img/p/${x.img}.jpg`, alt: x.dt, w: 720, h: 720 },
    product: {
      price: x.p, currency: 'ILS', priceText: money(x.p), compareText: x.c ? money(x.c) : '', availability: x.a ? 'InStock' : 'OutOfStock', sku: x.s || String(x.i), brand: x.b, facts,
      images: [{ src: `/img/p/${x.img}.jpg`, alt: x.dt, w: 720, h: 720 }],
      buy: x.a ? { href: `${STORE}/cart/${x.v}:1`, t: 'הוספה לסל' } : null,
      brandCard: r ? { name: r.name, origin: r.origin ? r.origin.he : '', about: r.about && r.about.he ? r.about.he : '', href: brandList(r).length >= REG.pageMin ? brandPath(r.name) : '', t: `לכל ${brandList(r).length} המוצרים של ${r.name}` } : null,
      ask: { href: 'https://wa.me/972525453602?text=' + encodeURIComponent(x.a ? `שלום עדן, שאלה על: ${x.dt} (${money(x.p)})` : `שלום עדן, עדכנו אותי כשיהיה במלאי: ${x.dt}`), t: x.a ? 'שאלה בוואטסאפ' : 'עדכנו אותי כשחוזר במלאי' },
      snapshot: 'הסכום הסופי מוצג בקופה של החנות.',
    },
    blocks: x.d ? [{ k: 'h2', t: 'על המוצר' }, ...descBlocks(x.d), { k: 'p', t: 'יש שאלה על המוצר? עדן עונה בוואטסאפ.' }] : [{ k: 'p', t: 'יש שאלה על המוצר? עדן עונה בוואטסאפ.' }],
    parent: { t: colTitle(primaryCol(x)), href: colPath(primaryCol(x)) }, related: related(x), relatedTitle: 'עוד מוצרים דומים', cta: CTA,
  });
}
const colSpecs = {
  'הרמת-ריסים-וגבות': 'ערכות, שלבים בודדים, צבעים, חמצן, כלים וטיפוח להרמת ריסים וגבות.', 'דבקים-סיליקונים': 'סיליקונים בצורות ובמידות שונות, ודבקי בלאם של ZOLA ו-Kodi.',
  'מוצרים-נלווים': 'פינצטות, מסרקים, מברשות, כוסיות, ניילון נצמד, סרט דבק רפואי ועוד: הכלים הקטנים שסביב הטיפול.', 'הנבחרת-שלנו': 'המוצרים שעדן בחרה להבליט בחנות.', 'כל-המוצרים': 'כל מוצרי החנות במקום אחד.',
};
for (const c of COLS.filter(c => c.h !== 'קורסים-והשתלמויות')) {
  const list = c.ids.map(h => byH.get(h)).filter(Boolean), [lo, hi] = range(list);
  const d = `${c.t}: ${list.length} מוצרים, ${money(lo)} עד ${money(hi)}, ${inStock(list)} במלאי. ${colSpecs[c.h] || ''}`;
  pages.push({ path: colPath(c.h), type: 'collection', title: title(`${c.t} | ${list.length} מוצרים`), description: desc(d), h1: c.t, short: c.t, kicker: 'קולקציה', lead: `${list.length} מוצרים, ${money(lo)} עד ${money(hi)}, ${inStock(list)} מהם במלאי. ${colSpecs[c.h] || ''}`.trim(), blocks: [], list: list.map(P), parent: { t: 'החנות', href: colPath('כל-המוצרים') }, cta: CTA });
}
pages.push({ path: colPath('קורסים-והשתלמויות'), type: 'collection', title: title('קורסים והשתלמויות בהרמת ריסים וגבות'), description: desc('קורסים והשתלמויות של עדן נחמני בהרמת ריסים, הרמת גבות ועיצוב גבות. כרגע אין קורס פתוח להרשמה, ואפשר להצטרף לרשימת ההמתנה.'),
  h1: 'קורסים והשתלמויות', short: 'קורסים והשתלמויות', kicker: 'קולקציה', lead: 'עדן מלמדת הרמת ריסים, הרמת גבות ועיצוב גבות.',
  blocks: [{ k: 'h2', t: 'מתי הקורס הבא' }, { k: 'p', t: 'כרגע אין קורס פתוח להרשמה. מועדים, מחיר ותוכנית יפורסמו כאן ובחנות עם פתיחת הקורס הבא.' }, { k: 'p', t: 'אפשר להצטרף לרשימת ההמתנה, ועדן תחזור אלייך כשייפתח קורס.' }], list: [], parent: { t: 'החנות', href: colPath('כל-המוצרים') }, cta: { t: 'לרשימת ההמתנה', href: '/#courses', title: 'רוצה לדעת כשיהיה קורס?', text: 'שם וטלפון, ועדן חוזרת אלייך.' } });
const host = u => { try { return new URL(u).hostname.replace(/^www\./, ''); } catch { return ''; } };
for (const b of BRANDS) {
  const r = regOf(b), list = brandList(r), [lo, hi] = range(list), L = r.look, dark = (h => { const n = parseInt(h.slice(1), 16); return ((n >> 16) * 299 + (n >> 8 & 255) * 587 + (n & 255) * 114) / 1000 < 128; })(L.field);
  const kinds = Object.entries(list.reduce((m, x) => (m[x.k] = (m[x.k] || 0) + 1, m), {})).sort((a, c) => c[1] - a[1]);
  const about = r.about && r.about.he ? r.about.he : `${list.length} מוצרים של ${r.name} בחנות: ${kinds.map(([k]) => KINDS[k]).join(', ')}.`;
  const heroHtml = `<div class="bhero${dark ? ' dark' : ''}"><div class="bx"><p class="kick">מותג${r.origin ? ' · ' + esc(r.origin.he) : ''}</p><h1 class="bt" data-type="${esc(L.type)}">${esc(r.name)}</h1><p class="lead">${esc(about)}</p>`
    + `<ul class="bstats"><li><b>${list.length}</b><span>מוצרים בחנות</span></li><li><b>${lo === hi ? `<bdi>${money(lo)}</bdi>` : `<bdi>${money(lo)}</bdi> <small>עד</small> <bdi>${money(hi)}</bdi>`}</b><span>טווח מחירים</span></li><li><b>${inStock(list)}</b><span>במלאי</span></li></ul>`
    + (r.about && r.about.src ? `<p class="bsrc">על המותג, מתוך האתר שלו: <a href="${esc(r.about.src)}" rel="noopener nofollow">${esc(host(r.about.src))}</a></p>` : '')
    + `</div><figure class="bimg"><img src="/img/cut/${esc(r.cut)}.webp" alt="" width="600" height="600" fetchpriority="high"></figure></div>`;
  const kindsHtml = `<h2>מה יש מ-${esc(r.name)} בחנות</h2><ul class="kz">${kinds.map(([k, n]) => `<li><b>${n}</b> ${esc(KINDS[k] || k)}</li>`).join('')}</ul>`;
  const others = REG.brands.filter(o => o !== r && brandList(o).length >= REG.pageMin);
  const othersHtml = `<h2>עוד מותגים על המדף</h2><ul class="bmore">${others.map(o => `<li><a class="bt" data-type="${esc(o.look.type)}" href="${enc(brandPath(o.name))}" style="--bc:${o.look.accent}">${esc(o.name)}</a></li>`).join('')}</ul>`;
  pages.push({ path: brandPath(b), type: 'collection', title: title(`${r.name} בחנות | ${list.length} מוצרים`), description: desc(`${r.name}${r.origin ? ' (' + r.origin.he + ')' : ''} בעדן קוסמטיקס: ${list.length} מוצרים, ${money(lo)} עד ${money(hi)}, ${inStock(list)} במלאי. ${kinds.map(([k]) => KINDS[k]).slice(0, 3).join(', ')}.`), h1: r.name, short: r.name, kicker: 'מותג',
    heroHtml, style: `:root{--bf:${L.field};--bi:${L.ink};--ba:${L.accent};--bs:${L.soft}}`, bodyClass: 'brandpage', blocks: [{ k: 'html', html: kindsHtml }], after: [], list: list.map(P), parent: { t: 'מותגים', href: '/collections/כל-המוצרים/' }, cta: CTA, trail: othersHtml });
}
// policies and pages: the store's own words
const policyPages = POLICIES.map(([slug, t]) => ({ slug, t, blocks: storeBlocks(`/policies/${slug}`) }));
const pol = { 'shipping-policy': 'אספקה באמצעות חברת שליחויות: 4–5 ימי עסקים, איסוף עצמי מנתיבות, משלוח חינם מעל ₪499.', 'refund-policy': 'החלפות והחזרות עד 14 ימים, מוצר שלא נפתח, ביטול עסקה, דמי ביטול.', 'terms-of-service': 'תנאי השימוש באתר החנות, אחריות המוצרים והחזרות.', 'privacy-policy': 'מדיניות הפרטיות של החנות: פרטי הזמנה, אשראי, משלוח ומחירים.', 'contact-information': 'פרטי הקשר של עדן קוסמטיקס: וואטסאפ וטלפון 052-545-3602 ואימייל.' };
for (const p of policyPages) pages.push({ path: `/policies/${p.slug}/`, type: 'page', title: title(p.t), description: desc(`${p.t} של עדן קוסמטיקס. ${pol[p.slug]}`), h1: p.t, short: p.t, kicker: 'מדיניות', lead: 'הנוסח המלא של מדיניות החנות.', blocks: p.blocks, parent: { t: 'מדיניות', href: '/policies/shipping-policy/' }, cta: p.slug === 'privacy-policy' || p.slug === 'terms-of-service' ? null : CTA });
pages.push({ path: '/pages/contact/', type: 'page', title: title('צור קשר | וואטסאפ, טלפון ואימייל'), description: desc('צור קשר עם עדן קוסמטיקס: וואטסאפ וטלפון 052-545-3602, אימייל Edencosmetics29@gmail.com, איסוף עצמי מנתיבות בתיאום מראש.'), h1: 'צור קשר', short: 'צור קשר', kicker: 'קשר',
  lead: 'שאלה על מוצר, על הזמנה או על קורס: כותבות לעדן.', blocks: [{ k: 'h2', t: 'איך יוצרים קשר' }, { k: 'links', items: [{ t: 'וואטסאפ: 052-545-3602', href: 'https://wa.me/972525453602' }, { t: 'טלפון: 052-545-3602', href: 'tel:0525453602' }, { t: 'אימייל: Edencosmetics29@gmail.com', href: 'mailto:Edencosmetics29@gmail.com' }, { t: 'אינסטגרם: edennahmani1', href: 'https://www.instagram.com/edennahmani1' }] }, { k: 'h2', t: 'איסוף עצמי' }, { k: 'p', t: 'איסוף עצמי מנתיבות, בתיאום מראש בלבד: 052-545-3602.' }], cta: CTA });
pages.push({ path: '/pages/הצהרת-נגישות/', type: 'page', title: title('הצהרת נגישות'), description: desc('הצהרת הנגישות של האתר של עדן קוסמטיקס: מה קיים באתר, מה נבדק, ולמי פונים כשמשהו לא עובד.'), h1: 'הצהרת נגישות', short: 'הצהרת נגישות', kicker: 'נגישות', lead: 'מה נעשה כדי שהאתר יהיה נגיש, ולמי פונים כשמשהו לא עובד.',
  blocks: legal.a11y.split('\n').map(bidiClean).filter(l => l && !/^\(?טיוטה|^הצהרת נגישות ·/.test(l)).map(l => l.startsWith('•') ? { k: 'ul', items: [l.replace(/^•\s*/, '')] } : /^(מה קיים באתר|מה נבדק ומה לא|ההסבר על החנות עצמה)$/.test(l) ? { k: 'h2', t: l } : { k: 'p', t: l }).reduce((a, b) => { const p = a[a.length - 1]; if (b.k === 'ul' && p && p.k === 'ul') p.items.push(...b.items); else a.push(b); return a; }, []), cta: null });
// the news blog: kept, lists the guides
pages.push({ path: '/blogs/news/', type: 'hub', title: title('מדריכים ועדכונים'), description: desc('מדריכים של עדן קוסמטיקס: ערכות להרמת ריסים וגבות, סיליקונים ומידות, צבעים וחמצן, בטבלאות עם המחיר והמלאי של כל מוצר.'), h1: 'מדריכים ועדכונים', short: 'מדריכים', kicker: 'מדריכים', lead: 'מדריכים קצרים שמסדרים את המדף: ערכות, סיליקונים לפי מידות, וצבעים עם החמצן שלהם.', blocks: [], list: GUIDES.map(g => g.path), cta: CTA });

// guides: tables of the catalog's own data, with the store's words quoted, never advice
const firstLine = x => bidiClean((x.d || '').split('\n')[0] || '') || '—';
const table = (head, rows) => ({ k: 'table', id: 1, rows: [head, ...rows] });
const kits = items.filter(x => x.k === 'set'), [klo, khi] = range(kits);
const pads = items.filter(x => x.k === 'pads'), [plo, phi] = range(pads);
const tints = items.filter(x => x.k === 'tint'), oxs = items.filter(x => x.k === 'oxidant'), [tlo, thi] = range(tints);
const GSHORT = { kits: 'ערכות להרמת ריסים וגבות', pads: 'סיליקונים והמידות שלהם', tints: 'צבע וחמצן בחנות' };
const G = {
  kits: { t: 'ערכות להרמת ריסים וגבות בחנות: מה יש, כמה עולה, מה כתוב עליהן', d: `${kits.length} ערכות וסטים להרמת ריסים וגבות, ${money(klo)} עד ${money(khi)}, בטבלה אחת: מותג, מחיר, מלאי ומה כתוב על כל אחת בחנות.`,
    lead: `בחנות ${kits.length} ערכות וסטים להרמת ריסים וגבות, ${money(klo)} עד ${money(khi)}. הטבלה מסדרת אותן לפי מחיר, בלי המלצה, ואת התיאור המלא של כל ערכה אפשר לקרוא בעמוד שלה.`,
    blocks: [{ k: 'h2', t: 'הערכות בחנות, ממחיר נמוך לגבוה' }, table(['ערכה', 'מותג', 'מחיר', 'מלאי'], kits.slice().sort((a, b) => a.p - b.p).map(x => [x.dt, x.b, money(x.p), x.a ? 'במלאי' : 'אזל'])),
      { k: 'h2', t: 'ערכה מול שלבים בודדים' }, { k: 'p', t: `מלבד הערכות, החנות מוכרת גם את שלבי My lamination בנפרד (${items.filter(x => x.k === 'step').length} מוצרים, ${money(range(items.filter(x => x.k === 'step'))[0])} עד ${money(range(items.filter(x => x.k === 'step'))[1])}), למי שכבר עובדת ורוצה להשלים מלאי.` },
      { k: 'h2', t: 'מה עוד קונים סביב הערכה' }, { k: 'p', t: 'הסיליקונים, הדבק והכלים נמכרים בנפרד. בונה הערכה באתר מרכיב את הרשימה כולה, עם סכום ומה חסר למשלוח חינם.' }],
    list: kits.map(P) },
  pads: { t: 'סיליקונים להרמת ריסים: כל הדגמים בחנות, מידות ומחירים', d: `${pads.length} דגמי סיליקון בחנות, ${money(plo)} עד ${money(phi)}: צורות, צבעים ומספר המידות כפי שכתוב בכל מוצר.`,
    lead: `בחנות ${pads.length} דגמי סיליקון להרמת ריסים וגבות, ${money(plo)} עד ${money(phi)}. מספר המידות כתוב בשם כל מוצר.`,
    blocks: [{ k: 'h2', t: 'כל הסיליקונים בחנות' }, table(['דגם', 'מחיר', 'מלאי', 'תיאור'], pads.slice().sort((a, b) => a.p - b.p).map(x => [x.dt, money(x.p), x.a ? 'במלאי' : 'אזל', cut(firstLine(x), 90)])),
      { k: 'h2', t: 'דבק ובלאם' }, { k: 'p', t: `לצד הסיליקונים יש בחנות ${items.filter(x => x.k === 'glue').length} מוצרי דבק ובלאם (ZOLA Lami Balm ו-Kodi), ${money(range(items.filter(x => x.k === 'glue'))[0])} עד ${money(range(items.filter(x => x.k === 'glue'))[1])}. חלקם אזלו כרגע.` }],
    list: pads.map(P) },
  tints: { t: 'צבע לריסים וגבות בחנות: THUYA, RefectoCil, NIKK MOLE ו-My lamination', d: `${tints.length} צבעים ו-${oxs.length} סוגי חמצן בחנות, ${money(tlo)} עד ${money(thi)}, לפי מותג, גוון ומלאי.`,
    lead: `בחנות ${tints.length} צבעים לריסים וגבות ו-${oxs.length} סוגי חמצן. חלק מהם אזלו כרגע (${tints.filter(x => !x.a).length} צבעים, ${oxs.filter(x => !x.a).length} חמצן).`,
    blocks: [{ k: 'h2', t: 'הצבעים' }, table(['צבע', 'מותג', 'מחיר', 'מלאי'], tints.map(x => [x.dt, x.b, money(x.p), x.a ? 'במלאי' : 'אזל'])), { k: 'h2', t: 'החמצן' }, table(['חמצן', 'מותג', 'מחיר', 'מלאי'], oxs.map(x => [x.dt, x.b, money(x.p), x.a ? 'במלאי' : 'אזל'])),
      { k: 'h2', t: 'חשוב לדעת' }, { k: 'p', t: 'על חלק מהצבעים כתוב "מכיל חינה שחורה/PPD". קוראים את הכתוב על כל מוצר לפני הרכישה; תנאי השירות של החנות קובעים שהאחריות לשימוש נכון ולתגובה אלרגית היא של הלקוחה.' }],
    list: [...tints, ...oxs].map(P) },
};
for (const g of GUIDES) { const x = G[g.key]; pages.push({ path: g.path, type: 'guide', title: title(x.t), description: desc(x.d), h1: x.t, short: GSHORT[g.key], kicker: 'מדריך', lead: x.lead, blocks: x.blocks, after: [{ k: 'links', t: 'המוצרים שבמדריך', items: x.list.slice(0, 12).map(p => ({ href: p, t: byH.get(decodeURIComponent(p.split('/')[2])).dt })) }], parent: { t: 'מדריכים', href: '/blogs/news/' }, related: x.list.filter(p => byH.get(decodeURIComponent(p.split('/')[2])).a).slice(0, 4), relatedTitle: 'מהחנות', datePublished: '2026-09-29', dateModified: '2026-09-29', cta: CTA }); }

// ---------- redirects: only Shopify's two system collections change address
overrides['/collections/all/'] = '/collections/כל-המוצרים/'; overrides['/collections/frontpage/'] = '/collections/הנבחרת-שלנו/';
fs.writeFileSync(path.join(HERE, 'redirect-overrides.json'), JSON.stringify(overrides, null, 1));
fs.writeFileSync(path.join(HERE, 'robots-extra.txt'), ['# paths that belong to the store (Shopify) and are not pages of this site',
  'Disallow: /cart', 'Disallow: /checkout', 'Disallow: /account', 'Disallow: /orders', 'Disallow: /*?*sort_by=', 'Disallow: /*?*filter.', 'Disallow: /*?*variant=',
  '# agent and commerce discovery files are served by Shopify (UCP): keep them reachable', 'Allow: /agents.md', 'Allow: /.well-known/ucp'].join('\n') + '\n');
fs.writeFileSync(path.join(HERE, 'redirects-extra.txt'), ['# these paths are served by Shopify. On a host that puts this front in front of the store, proxy them (status 200) to the store origin:',
  '# /cart/*        https://<store>.myshopify.com/cart/:splat   200', '# /checkout/*    https://<store>.myshopify.com/checkout/:splat 200', '# /account/*     https://<store>.myshopify.com/account/:splat  200',
  '# /agents.md     https://<store>.myshopify.com/agents.md      200', '# /.well-known/ucp https://<store>.myshopify.com/.well-known/ucp  200', '# /api/ucp/mcp   https://<store>.myshopify.com/api/ucp/mcp    200',
  '# (the store origin is decided with the owner: see launch.md, "Domain decision")'].join('\n') + '\n');

// ---------- Lotti on inner pages: a quiet corner guide (a native <details>, no script), with facts about the page she is on
const M = JSON.parse(rd(path.join(PROJ, 'mascot/mascot.json')));
const LOTTI_SVG = (() => { const W = M.grid[0].length, H = M.grid.length, col = M.colors; let r = ''; M.grid.forEach((row, y) => { let x = 0; while (x < row.length) { const ch = row[x]; let n = 1; while (row[x + n] === ch) n++; if (ch !== '.') r += `<rect x="${x}" y="${y}" width="${n}" height="1" fill="${col[ch]}"/>`; x += n; } }); for (const [x, y, w, h, k] of M.faces.happy) r += `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${col[k]}"/>`; return `<svg viewBox="0 0 ${W} ${H}" shape-rendering="crispEdges" aria-hidden="true" focusable="false">${r}</svg>`; })();
const waT = t => 'https://wa.me/972525453602?text=' + encodeURIComponent(t);
for (const pg of pages) {
  if (pg.type === 'product') { const x = byH.get(decodeURIComponent(pg.path.split('/')[2])); if (!x) continue;
    pg.guide = { lines: [x.a ? `${KINDS[x.k] || 'המוצר'} · ${money(x.p)} · במלאי.` : 'המוצר אזל כרגע. אפשר לבקש מעדן עדכון כשיחזור.', 'רוצה לראות מה עוד צריך לטיפול? בונה הערכה מרכיב רשימה עם סכום, ומה חסר למשלוח חינם.'], links: [{ t: 'לבונה הערכה', href: '/#kit' }, { t: x.a ? 'שאלה לעדן בוואטסאפ' : 'בקשת עדכון בוואטסאפ', href: waT(x.a ? `שלום עדן, שאלה על: ${x.dt}` : `שלום עדן, עדכנו אותי כשיחזור: ${x.dt}`) }] }; }
  else if (pg.bodyClass === 'brandpage') { const r = REG.brands.find(b => pg.path === brandPath(b.name)), list = brandList(r);
    pg.guide = { lines: [`${r.name}: ${list.length === 1 ? 'מוצר אחד' : list.length + ' מוצרים'} בחנות, ${inStock(list)} במלאי.`, 'רוצה לראות מה עוד צריך לטיפול? בונה הערכה מרכיב רשימה עם סכום.'], links: [{ t: 'לבונה הערכה', href: '/#kit' }, { t: `שאלה על ${r.name} בוואטסאפ`, href: waT(`שלום עדן, שאלה על ${r.name}`) }] }; }
  else if (pg.type === 'collection' && pg.list && pg.list.length) { const list = pg.list.map(u => byH.get(decodeURIComponent(u.split('/')[2]))).filter(Boolean);
    pg.guide = { lines: [`${list.length} מוצרים כאן, ${inStock(list)} מהם במלאי.`, 'בחנות שבדף הבית אפשר לחפש ולסנן לפי מותג.'], links: [{ t: 'לחנות ולחיפוש', href: '/#shop' }, { t: 'לבונה הערכה', href: '/#kit' }] }; }
  else if (pg.type === 'guide') pg.guide = { lines: ['המדריך מסדר את המדף לפי מחיר ומלאי, בלי המלצה.', 'לשאלה מקצועית, עדן עונה בוואטסאפ.'], links: [{ t: 'שאלה לעדן בוואטסאפ', href: waT('שלום עדן, שאלה מהמדריך באתר') }] };
}

// ---------- brand config
const THEME = `:root{--deep:#241A18;--onDeep:#F8EFEA;--paper:#F8EFEA;--surface:#fff;--ink:#241A18;--steel:#6B5A54;--line:#E6D3C9;--kick:#964F58;--link:#964F58;--accent:#964F58;--onAccent:#fff;--mute:#E9B8B2;--hdrBg:#F8EFEA;--hdrFg:#241A18;--ftBg:#241A18;--ftFg:#F8EFEA;--display:'Frank Ruhl Libre','Times New Roman',serif;--body:'Assistant',system-ui,'Arial Hebrew',Arial,sans-serif;--num:'Frank Ruhl Libre',serif;--mono:'Assistant',system-ui,sans-serif;--wrap:1240px;color-scheme:light}
@media (prefers-color-scheme:dark){:root{--paper:#1B1311;--surface:#261B18;--ink:#F6EAE3;--steel:#C9B3AA;--line:#40302A;--kick:#E9B8B2;--link:#E9B8B2;--accent:#E9B8B2;--onAccent:#241A18;--hdrBg:#1B1311;--hdrFg:#F6EAE3;--ftBg:#120C0B;--ftFg:#F6EAE3;--deep:#33241F;--onDeep:#F6EAE3;--mute:#C9B3AA;color-scheme:dark}}
body{font-size:17.5px}h1,h2,h3{font-family:var(--display)}h1{font-weight:900;letter-spacing:-.02em}article h2{font-weight:700}
.kick{font:700 12.5px/1 var(--body);letter-spacing:.2em;text-transform:uppercase}.logo{color:var(--ink)}.logo img{width:50px;height:48px}.logo span{font:700 15px/1.1 'Cinzel','Times New Roman',serif;letter-spacing:.2em;text-transform:uppercase}
.crumbs{font-family:var(--body)}.btn{border:0}.cta{background:var(--deep)}.cta h2{color:var(--onDeep)}.call{border-radius:999px}
header.site{border-bottom:1px solid var(--line)}.hero{background:#fff}.pc{background:var(--surface)}.tw{background:var(--surface)}footer.site h2{font-family:'Cinzel',serif;letter-spacing:.2em;color:#E7C3B2}
header.site{position:sticky;top:0;z-index:30;background:color-mix(in srgb,var(--paper) 92%,transparent);backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px)}header.site .in{min-height:74px}
nav.main a,nav.main summary{font-weight:600;font-size:16px}.call{gap:6px}nav.main a:hover,nav.main summary:hover{background:color-mix(in srgb,var(--accent) 10%,transparent)}.call{min-height:44px;display:inline-flex;align-items:center;gap:6px}
.dd div{border-radius:18px;box-shadow:0 26px 50px -26px rgba(36,26,24,.45)}
article h1{font-size:clamp(34px,5vw,58px);line-height:1.04}.lead{max-width:62ch}
.pdp .gal{border-radius:28px}.pdp .gal img{padding:4%}.facts{border-radius:18px}.facts li{padding:12px 16px}
.bcard{border:1px solid var(--line);border-radius:18px;padding:14px 16px;background:var(--surface);display:grid;gap:4px}.bcard b{font:700 18px/1.2 var(--display)}.bcard .or{font-size:13.5px;color:var(--steel);font-weight:700}.bcard p{margin:4px 0 0;font-size:15.5px;line-height:1.6;color:var(--steel)}.bcard a{font-weight:700;margin-top:6px}
.snap{font-size:14px}
.grid{gap:18px}.pc{border-radius:22px;transition:transform .3s,box-shadow .3s,border-color .3s}.pc:hover{transform:translateY(-3px);box-shadow:0 22px 40px -26px rgba(36,26,24,.45);border-color:color-mix(in srgb,var(--accent) 40%,var(--line))}
.bhero{display:grid;grid-template-columns:minmax(0,1.2fr) minmax(0,.8fr);gap:clamp(16px,4vw,48px);align-items:center;background:var(--bf);color:var(--bi);border-radius:34px;padding:clamp(24px,4vw,52px);margin:18px 0 8px;position:relative;overflow:hidden}
.bhero::after{content:"";position:absolute;inset-inline-end:-10%;top:-30%;width:60%;aspect-ratio:1;border-radius:50%;background:radial-gradient(closest-side,color-mix(in srgb,var(--ba) 34%,transparent),transparent);opacity:.6;pointer-events:none}
.bhero .kick{color:inherit;opacity:.8;margin-top:0}.bhero h1{font-size:clamp(40px,6vw,76px);line-height:1;color:inherit}.bhero .lead{color:inherit;opacity:.9}
.bhero .bstats{list-style:none;margin:22px 0 0;padding:0;display:flex;flex-wrap:wrap;gap:10px 28px}.bstats b{display:block;font:700 clamp(26px,3vw,34px)/1 var(--display)}.bstats small{font-size:.5em;font-weight:600;opacity:.8}.bstats span{font-size:14px;opacity:.8}
.bhero .bsrc{font-size:14px;opacity:.85;margin:18px 0 0}.bhero .bsrc a{color:inherit;font-weight:700}
.bimg{margin:0;position:relative;z-index:1;display:grid;place-items:center}.bimg img{max-height:320px;width:auto;max-width:100%;filter:drop-shadow(-12px 20px 18px rgba(0,0,0,.3))}
.bt[data-type=caps-bold]{font-family:var(--body);font-weight:800;letter-spacing:.12em;text-transform:uppercase}.bt[data-type=lower-light]{font-family:var(--body);font-weight:300;text-transform:lowercase;letter-spacing:.01em}.bt[data-type=serif-classic]{font-family:var(--display);font-weight:600}.bt[data-type=round-bold]{font-family:var(--body);font-weight:800;letter-spacing:.04em}.bt[data-type=caps-heavy]{font-family:var(--body);font-weight:800;letter-spacing:.06em;text-transform:uppercase}.bt[data-type=caps-light]{font-family:'Cinzel',serif;font-weight:400;letter-spacing:.18em;text-transform:uppercase}.bt[data-type=caps-wide]{font-family:'Cinzel',serif;font-weight:600;letter-spacing:.28em;text-transform:uppercase}
.kz{list-style:none;margin:10px 0 0;padding:0;display:flex;flex-wrap:wrap;gap:8px}.kz li{border:1px solid var(--line);background:var(--surface);border-radius:999px;padding:6px 14px;font-weight:600;font-size:15px}.kz b{color:var(--kick)}
.bmore{list-style:none;margin:12px 0 0;padding:0;display:flex;flex-wrap:wrap;gap:8px 26px}.bmore a{--bc:var(--ink);color:var(--ink);text-decoration:none;font-size:19px;opacity:.8}.bmore a:hover{opacity:1;color:var(--bc)}
body.brandpage article.wide>h2{margin-top:1.3em}
@media (max-width:760px){.bhero{grid-template-columns:1fr}.bimg{order:-1}.bimg img{max-height:200px}}
@media (prefers-color-scheme:dark){.bcard{background:var(--surface)}}`;
const brand = { name: NAME, short: 'Eden Cosmetics', logoSmall: '', phone: '052-545-3602', phoneHref: '0525453602', phoneLabel: 'וואטסאפ וטלפון', logo: '/img/symbol.svg', appleIcon: '/img/apple-touch-icon.png', ogImage: SITE + '/img/p/8479070290091-1.jpg', themeColor: '#F8EFEA', sameAs: ['https://www.instagram.com/edennahmani1'], cta: CTA, credit: 'עיצוב ופיתוח: AILGEN' };
const groups = { collections: ['כל-המוצרים', 'הרמת-ריסים-וגבות', 'דבקים-סיליקונים', 'מוצרים-נלווים', 'הנבחרת-שלנו', 'קורסים-והשתלמויות'].map(colPath), guides: GUIDES.map(g => g.path), brands: BRANDS.map(brandPath), policies: [...POLICIES.map(([s]) => `/policies/${s}/`), '/pages/הצהרת-נגישות/'] };
const pagesConfig = {
  site: SITE, out: '../../../edencosmetic', preview: PREVIEW, lang: 'he', dir: 'rtl', brand, fontsCss: '../../../edencosmetic/fonts/fonts.css', theme: { css: THEME },
  strings: { ctaTitle: 'מה עוד צריך לטיפול?', ctaText: 'בונה הערכה מרכיב רשימה אמיתית מהחנות.', notFoundLead: 'ייתכן שהכתובת השתנתה. אלה הקולקציות, המדריכים והמותגים של החנות, ואפשר גם לחזור לדף הבית.' },
  nav: [{ t: 'החנות', menu: 'collections', all: { t: 'כל המוצרים', href: colPath('כל-המוצרים') } }, { t: 'מדריכים', menu: 'guides', all: { t: 'כל המדריכים', href: '/blogs/news/' } }, { t: 'מותגים', menu: 'brands' }, { t: 'בונה הערכה', href: '/#kit' }, { t: 'צור קשר', href: '/pages/contact/' }],
  groups, groupTitles: { collections: 'החנות', guides: 'מדריכים', brands: 'מותגים', policies: 'מדיניות' }, contactTitle: 'צור קשר',
  footerLinks: [{ t: 'וואטסאפ', href: 'https://wa.me/972525453602' }, { t: 'צור קשר', href: '/pages/contact/' }, { t: 'אינסטגרם', href: 'https://www.instagram.com/edennahmani1' }],
  autolinks: [...BRANDS.map(b => ({ phrase: b, href: brandPath(b) })), { phrase: 'הרמת ריסים', href: colPath('הרמת-ריסים-וגבות') }, { phrase: 'סיליקונים', href: colPath('דבקים-סיליקונים') }, { phrase: 'קורסים והשתלמויות', href: colPath('קורסים-והשתלמויות') }],
  guideAvatar: LOTTI_SVG, guideLabel: 'לוטי, המדריכה של האתר',
  og: { bg: '#F8EFEA', fg: '#241A18', accent: '#964F58', font: 'Frank Ruhl Libre', mono: 'Assistant', grid: 'rgba(150,79,88,.07)' },
  home: { h1: 'ציוד מקצועי להרמת ריסים וגבות', kicker: 'EDEN COSMETICS', image: { src: '/img/p/8479070290091-1.jpg' } }, pages,
};
fs.writeFileSync(path.join(HERE, 'pages.json'), JSON.stringify(pagesConfig, null, 1));

// ---------- the home page: head, static links, static FAQ (idempotent marker blocks)
const dataSrc = rd(path.join(SITEDIR, 'src/3-data.js'));
const faq = (0, eval)('(' + dataSrc.slice(dataSrc.indexOf('faq:[') + 4, dataSrc.indexOf('],\n privacy') + 1) + ')');
const HOME_TITLE = 'עדן קוסמטיקס | ציוד מקצועי להרמת ריסים וגבות', HOME_DESC = 'ציוד מקצועי להרמת ריסים וגבות: ערכות, סיליקונים, דבקים וצבעים של THUYA, My lamination, ZOLA ועוד. משלוח חינם מעל ₪499. עדן נחמני, מטפלת ומדריכה.';
const ogMapFile = path.join(SITEDIR, 'og', 'og-map.json'), OG = fs.existsSync(ogMapFile) ? JSON.parse(rd(ogMapFile)) : {}, homeImg = SITE + (OG['/'] || '/img/p/8479070290091-1.jpg');
const [allLo, allHi] = range(items);
const ld = { '@context': 'https://schema.org', '@graph': [
  { '@type': 'Organization', '@id': SITE + '/#org', name: NAME, alternateName: 'Eden Cosmetics', url: SITE + '/', logo: SITE + '/img/symbol.svg', sameAs: ['https://www.instagram.com/edennahmani1'], contactPoint: { '@type': 'ContactPoint', telephone: '+972-52-545-3602', contactType: 'customer service', areaServed: 'IL', availableLanguage: 'he', email: 'Edencosmetics29@gmail.com' }, founder: { '@type': 'Person', name: 'עדן נחמני' } },
  { '@type': 'Store', '@id': SITE + '/#store', name: NAME, url: SITE + '/', image: homeImg, telephone: '+972-52-545-3602', priceRange: `${money(allLo)}–${money(allHi)}`, currenciesAccepted: 'ILS', parentOrganization: { '@id': SITE + '/#org' }, areaServed: { '@type': 'Country', name: 'IL' } },
  { '@type': 'VideoObject', '@id': SITE + '/#film', name: 'החנות ב-29 שניות', description: 'סרטון של 29 שניות על החנות של עדן קוסמטיקס: ציוד להרמת ריסים וגבות, מחירי החנות ומה חשוב לדעת על משלוח והחזרה.', thumbnailUrl: SITE + '/m/film-poster.jpg', contentUrl: SITE + '/m/film-web.mp4', uploadDate: '2026-09-29', duration: 'PT29S', inLanguage: 'he' },
  { '@type': 'WebSite', '@id': SITE + '/#site', url: SITE + '/', name: NAME, inLanguage: 'he', publisher: { '@id': SITE + '/#org' } },
  { '@type': 'WebPage', '@id': SITE + '/#home', url: SITE + '/', name: HOME_TITLE, description: HOME_DESC, isPartOf: { '@id': SITE + '/#site' }, about: { '@id': SITE + '/#store' }, inLanguage: 'he' },
  { '@type': 'FAQPage', mainEntity: faq.map(([q, a]) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a } })) },
  { '@type': 'ItemList', name: 'קולקציות החנות', itemListElement: COLS.filter(c => c.h !== 'כל-המוצרים').map((c, i) => ({ '@type': 'ListItem', position: i + 1, name: c.t, url: SITE + enc(colPath(c.h)) })) },
] };
const head = `<!--seo:head-->
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>${esc(HOME_TITLE)}</title>
<meta name="description" content="${esc(HOME_DESC)}">
<link rel="canonical" href="${SITE}/">
${PREVIEW ? '<meta name="robots" content="noindex,follow">' : '<meta name="robots" content="index,follow,max-image-preview:large">'}
<meta property="og:type" content="website"><meta property="og:locale" content="he_IL"><meta property="og:site_name" content="${NAME}"><meta property="og:title" content="${esc(HOME_TITLE)}"><meta property="og:description" content="${esc(HOME_DESC)}"><meta property="og:url" content="${SITE}/"><meta property="og:image" content="${esc(homeImg)}">${OG['/'] ? '<meta property="og:image:width" content="1200"><meta property="og:image:height" content="630">' : ''}<meta property="og:image:alt" content="${NAME}: ציוד מקצועי להרמת ריסים וגבות">
<meta name="twitter:card" content="summary_large_image">
<link rel="preload" as="image" href="img/cut/thuya-kit-380.webp" imagesrcset="img/cut/thuya-kit-380.webp 380w, img/cut/thuya-kit.webp 681w" imagesizes="(max-width:980px) 42vw, 280px" type="image/webp">
<script type="application/ld+json">${JSON.stringify(ld)}</script>
<!--/seo:head-->`;
const li = (p, t) => `<li><a href="${enc(p)}">${esc(t)}</a></li>`;
const blocks = {
  head,
  'links-cols': groups.collections.map(p => li(p, p === colPath('כל-המוצרים') ? 'כל המוצרים' : colTitle(decodeURIComponent(p.split('/')[2])))).join(''),
  'links-guides': [...GUIDES.map(g => li(g.path, GSHORT[g.key])), ...BRANDS.map(b => li(brandPath(b), b))].join(''),
  'links-policy': [...POLICIES.map(([s, t]) => li(`/policies/${s}/`, t)), li('/pages/הצהרת-נגישות/', 'הצהרת נגישות'), li('/pages/contact/', 'צור קשר'), li('/blogs/news/', 'מדריכים')].join(''),
  'links-products': items.map(x => li(P(x), x.dt)).join(''),
  faq: faq.map(([q, a], i) => `<details${i === 0 ? ' open' : ''}><summary>${esc(q)}</summary><p>${esc(a)}</p></details>`).join(''),
  noscript: `<noscript><p style="text-align:center;padding:14px;background:#F0D3C3;color:#241A18;margin:0">כדי להשתמש בסל ובבונה הערכה צריך לאפשר סקריפטים בדפדפן. אפשר לגלוש בכל המוצרים והמדיניות דרך הקישורים בתחתית העמוד, ולהזמין בחנות: <a href="${STORE}">${STORE.replace('https://', '')}</a>, או בוואטסאפ <a href="${WA}">052-545-3602</a>.</p></noscript>`,
};
function swap(file, name, html) {
  const f = path.join(SITEDIR, file); let s = rd(f); const re = new RegExp(`<!--seo:${name}-->[\\s\\S]*?<!--/seo:${name}-->`);
  if (name === 'head') { if (!re.test(s)) throw new Error('no head marker'); s = s.replace(re, () => html); }
  else { if (!re.test(s)) throw new Error('no marker ' + name + ' in ' + file); s = s.replace(re, () => `<!--seo:${name}-->${html}<!--/seo:${name}-->`); }
  fs.writeFileSync(f, s);
}
swap('src/1-head.html', 'head', blocks.head);
for (const k of ['links-cols', 'links-guides', 'links-policy', 'links-products', 'faq', 'noscript']) swap('src/2-body.html', k, blocks[k]);
fs.copyFileSync(path.join(PROJ, 'brand/symbol.svg'), path.join(SITEDIR, 'img/symbol.svg'));
console.log(`pages.json: ${pages.length} pages (${items.length} products, ${COLS.length} collections, ${BRANDS.length} brands, ${GUIDES.length} guides, ${POLICIES.length} policies) · preview=${PREVIEW}`);
