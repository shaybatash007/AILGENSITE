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
const money = n => '₪' + Math.round(n).toLocaleString('he-IL');
const items = cat.items, byH = new Map(items.map(x => [x.h, x])), P = x => `/products/${x.h}/`;
const KINDS = { set: 'ערכות', step: 'שלבים בודדים', pads: 'סיליקונים', glue: 'דבק ובלאם', tint: 'צבע', oxidant: 'חמצן', clean: 'ניקוי', serum: 'טיפוח', tool: 'כלים' };
const NAME = 'עדן קוסמטיקס', WA = 'https://wa.me/972525453602?text=' + encodeURIComponent('שלום עדן, הגעתי מהאתר. ');
const range = a => a.length ? [Math.min(...a.map(x => x.p)), Math.max(...a.map(x => x.p))] : [0, 0];
const inStock = a => a.filter(x => x.a).length;
const cut = (t, max) => { t = String(t).replace(/\s+/g, ' ').trim(); if (t.length <= max) return t; const w = t.slice(0, max).replace(/\s+\S*$/, '').replace(/[\s,.;:–-]+$/, ''); return w; };
const title = (core, suffix = ' | ' + NAME) => { let t = core + suffix; if (t.length <= 65) return t; if (core.length <= 65) return core; return cut(core, 65); };
const desc = (t, min = 70, max = 158) => { let d = cut(t, max); if (d.length < min) d = (d + ' ' + 'עדן קוסמטיקס: ציוד מקצועי להרמת ריסים וגבות.').slice(0, max); return d; };

// ---------- collections and brands
const COLS = cat.cols;
const colTitle = h => (COLS.find(c => c.h === h) || {}).t || h;
const brandSlug = { 'My lamination': 'my-lamination', 'NIKK MOLE': 'nikk-mole', 'THUYA': 'thuya', 'ZOLA': 'zola', 'RefectoCil': 'refectocil' };
const brandCount = b => items.filter(x => x.b === b).length;
const BRANDS = Object.keys(brandSlug).filter(b => brandCount(b) >= 2);
const colPath = h => `/collections/${h}/`, brandPath = b => `/brands/${brandSlug[b]}/`;
const GUIDES = [
  { path: '/guides/ערכה-להרמת-ריסים-וגבות/', key: 'kits' }, { path: '/guides/סיליקונים-להרמת-ריסים-מידות/', key: 'pads' }, { path: '/guides/צבע-לריסים-וגבות-מה-יש-בחנות/', key: 'tints' },
];
const POLICIES = [['shipping-policy', 'מדיניות משלוחים'], ['refund-policy', 'מדיניות החזרים'], ['terms-of-service', 'תנאי שירות'], ['privacy-policy', 'מדיניות פרטיות (החנות)'], ['contact-information', 'פרטי קשר']];
const CTA = { t: 'בונה הערכה', href: '/#kit', title: 'מה עוד צריך לטיפול?', text: 'בונה הערכה מרכיב רשימה אמיתית מהחנות, עם סכום ומה חסר למשלוח חינם.' };

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
    out.push(/^h[1-6]$/.test(b.kind) ? { k: 'h2', t } : b.kind === 'li' ? { k: 'ul', items: [t] } : { k: 'p', t });
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
  const facts = [['מחיר', money(x.p) + ' (כולל מע"מ, לא כולל משלוח)'], ['מלאי', stock + ' (' + SNAP + ')'], ...(x.b ? [['מותג', x.b]] : []), ...(kindL ? [['קטגוריה', kindL]] : []), ...(x.s ? [['מק"ט', x.s]] : []), ['משלוח', 'חינם מעל ₪499 · 4–5 ימי עסקים']];
  pages.push({
    path: P(x), type: 'product', title: title(x.dt), description: desc(d), h1: x.dt, short: cut(x.dt, 44), kicker: (x.b || kindL || 'ציוד מקצועי').toUpperCase(),
    image: { src: `/img/p/${x.img}.jpg`, alt: x.dt, w: 720, h: 720 },
    product: {
      price: x.p, currency: 'ILS', priceText: money(x.p), compareText: x.c ? money(x.c) : '', availability: x.a ? 'InStock' : 'OutOfStock', sku: x.s || String(x.i), brand: x.b, facts,
      images: [{ src: `/img/p/${x.img}.jpg`, alt: x.dt, w: 720, h: 720, label: 'תמונת מוצר מהחנות' }],
      buy: x.a ? { href: `${STORE}/cart/${x.v}:1`, t: 'הוספה לעגלה בחנות' } : null,
      ask: { href: 'https://wa.me/972525453602?text=' + encodeURIComponent(x.a ? `שלום עדן, שאלה על: ${x.dt} (${money(x.p)})` : `שלום עדן, עדכנו אותי כשיהיה במלאי: ${x.dt}`), t: x.a ? 'שאלה בוואטסאפ' : 'עדכנו אותי כשחוזר במלאי' },
      snapshot: `מחיר ומלאי כפי שמופיעים בחנות ב-${SNAP}. הסל והתשלום בחנות (${STORE.replace('https://', '')}).`,
    },
    blocks: x.d ? [{ k: 'h2', t: 'על המוצר' }, ...descBlocks(x.d)] : [{ k: 'p', t: 'אין תיאור למוצר הזה בחנות. אפשר לשאול את עדן בוואטסאפ.' }],
    parent: { t: colTitle(primaryCol(x)), href: colPath(primaryCol(x)) }, related: related(x), relatedTitle: 'עוד מוצרים דומים', cta: CTA,
  });
}
const colSpecs = {
  'הרמת-ריסים-וגבות': 'ערכות, שלבים בודדים, צבעים, חמצן, כלים וטיפוח להרמת ריסים וגבות.', 'דבקים-סיליקונים': 'סיליקונים בצורות ובמידות שונות, ודבקי בלאם של ZOLA ו-Kodi.',
  'מוצרים-נלווים': 'פינצטות, מסרקים, מברשות, כוסיות, ניילון נצמד, סרט דבק רפואי ועוד: הכלים הקטנים שסביב הטיפול.', 'הנבחרת-שלנו': 'הקולקציה הנבחרת של החנות, כפי שהיא מופיעה בדף הבית שלה.', 'כל-המוצרים': 'כל מוצרי החנות במקום אחד.',
};
for (const c of COLS.filter(c => c.h !== 'קורסים-והשתלמויות')) {
  const list = c.ids.map(h => byH.get(h)).filter(Boolean), [lo, hi] = range(list);
  const d = `${c.t}: ${list.length} מוצרים, ${money(lo)} עד ${money(hi)}, ${inStock(list)} במלאי (${SNAP}). ${colSpecs[c.h] || ''}`;
  pages.push({ path: colPath(c.h), type: 'collection', title: title(`${c.t} | ${list.length} מוצרים`), description: desc(d), h1: c.t, short: c.t, kicker: 'קולקציה', lead: `${list.length} מוצרים, ${money(lo)} עד ${money(hi)}. ${inStock(list)} במלאי נכון ל-${SNAP}. ${colSpecs[c.h] || ''}`.trim(), blocks: [], list: list.map(P), parent: { t: 'החנות', href: colPath('כל-המוצרים') }, cta: CTA });
}
pages.push({ path: colPath('קורסים-והשתלמויות'), type: 'collection', title: title('קורסים והשתלמויות בהרמת ריסים וגבות'), description: desc('קורסים והשתלמויות של עדן נחמני בהרמת ריסים, הרמת גבות ועיצוב גבות. הקולקציה בחנות ריקה כרגע: אין תאריכים או מחירים. אפשר להצטרף לרשימת המתנה.'),
  h1: 'קורסים והשתלמויות', short: 'קורסים והשתלמויות', kicker: 'קולקציה', lead: 'עדן מעבירה קורסים והשתלמויות בהרמת ריסים, הרמת גבות ועיצוב גבות. הקולקציה בחנות ריקה כרגע.',
  blocks: [{ k: 'h2', t: 'מה יש כאן היום' }, { k: 'p', t: 'אין כרגע קורס שפתוח להרשמה, ולכן אין כאן תאריכים, מחירים או מקומות פנויים. כשעדן תפרסם קורס, הוא יופיע כאן ובחנות.' }, { k: 'p', t: 'אפשר להצטרף לרשימת המתנה, ועדן תחזור כשיהיה קורס.' }], list: [], parent: { t: 'החנות', href: colPath('כל-המוצרים') }, cta: { t: 'לרשימת ההמתנה', href: '/#courses', title: 'רוצה לדעת כשיהיה קורס?', text: 'שם וטלפון, ועדן חוזרת אלייך.' } });
for (const b of BRANDS) {
  const list = items.filter(x => x.b === b), [lo, hi] = range(list);
  pages.push({ path: brandPath(b), type: 'collection', title: title(`${b} בחנות | ${list.length} מוצרים`), description: desc(`${b} בעדן קוסמטיקס: ${list.length} מוצרים, ${money(lo)} עד ${money(hi)}, ${inStock(list)} במלאי (${SNAP}). ציוד מקצועי להרמת ריסים וגבות.`), h1: `${b} בחנות`, short: b, kicker: 'מותג', lead: `${list.length} מוצרים של ${b} בחנות, ${money(lo)} עד ${money(hi)}. ${inStock(list)} במלאי נכון ל-${SNAP}. המותג לפי שם המוצר בקטלוג.`, blocks: [], list: list.map(P), parent: { t: 'מותגים', href: '/collections/כל-המוצרים/' }, cta: CTA });
}
// policies and pages: the store's own words
const policyPages = POLICIES.map(([slug, t]) => ({ slug, t, blocks: storeBlocks(`/policies/${slug}`) }));
const pol = { 'shipping-policy': 'אספקה באמצעות חברת שליחויות: 4–5 ימי עסקים, איסוף עצמי מנתיבות, משלוח חינם מעל ₪499.', 'refund-policy': 'החלפות והחזרות עד 14 ימים, מוצר שלא נפתח, ביטול עסקה, דמי ביטול.', 'terms-of-service': 'תנאי השימוש באתר החנות, אחריות המוצרים והחזרות.', 'privacy-policy': 'מדיניות הפרטיות של החנות: פרטי הזמנה, אשראי, משלוח ומחירים.', 'contact-information': 'פרטי הקשר של עדן קוסמטיקס: וואטסאפ וטלפון 052-545-3602 ואימייל.' };
for (const p of policyPages) pages.push({ path: `/policies/${p.slug}/`, type: 'page', title: title(p.t), description: desc(`${p.t} של עדן קוסמטיקס. ${pol[p.slug]}`), h1: p.t, short: p.t, kicker: 'מדיניות', lead: 'הנוסח של החנות, כפי שהוא באתר הקיים.', blocks: p.blocks, parent: { t: 'מדיניות', href: '/policies/shipping-policy/' }, cta: p.slug === 'privacy-policy' || p.slug === 'terms-of-service' ? null : CTA });
pages.push({ path: '/pages/contact/', type: 'page', title: title('צור קשר | וואטסאפ, טלפון ואימייל'), description: desc('צור קשר עם עדן קוסמטיקס: וואטסאפ וטלפון 052-545-3602, אימייל Edencosmetics29@gmail.com, איסוף עצמי מנתיבות בתיאום מראש.'), h1: 'צור קשר', short: 'צור קשר', kicker: 'קשר',
  lead: 'שאלה על מוצר, על הזמנה או על קורס: כותבות לעדן.', blocks: [{ k: 'h2', t: 'איך יוצרים קשר' }, { k: 'links', items: [{ t: 'וואטסאפ: 052-545-3602', href: 'https://wa.me/972525453602' }, { t: 'טלפון: 052-545-3602', href: 'tel:0525453602' }, { t: 'אימייל: Edencosmetics29@gmail.com', href: 'mailto:Edencosmetics29@gmail.com' }, { t: 'אינסטגרם: edennahmani1', href: 'https://www.instagram.com/edennahmani1' }] }, { k: 'h2', t: 'איסוף עצמי' }, { k: 'p', t: 'איסוף עצמי מנתיבות, בתיאום מראש בלבד: 052-545-3602.' }], cta: CTA });
pages.push({ path: '/pages/הצהרת-נגישות/', type: 'page', title: title('הצהרת נגישות'), description: desc('הצהרת הנגישות של האתר של עדן קוסמטיקס: מה קיים, מה נבדק, ולמי פונים. טיוטה לאישור.'), h1: 'הצהרת נגישות', short: 'הצהרת נגישות', kicker: 'נגישות', lead: 'טיוטה שהוכנה עם האתר החדש. הנגישות בחנות עצמה (Shopify) נעשית בתוסף UnAble, וההצהרה שלו מופיעה שם.',
  blocks: legal.a11y.split('\n').map(bidiClean).filter(l => l && !/^\(?טיוטה|^הצהרת נגישות ·/.test(l)).map(l => l.startsWith('•') ? { k: 'ul', items: [l.replace(/^•\s*/, '')] } : /^(מה קיים באתר|מה נבדק ומה לא|ההסבר על החנות עצמה)$/.test(l) ? { k: 'h2', t: l } : { k: 'p', t: l }).reduce((a, b) => { const p = a[a.length - 1]; if (b.k === 'ul' && p && p.k === 'ul') p.items.push(...b.items); else a.push(b); return a; }, []), cta: null });
// the news blog: kept, lists the guides
pages.push({ path: '/blogs/news/', type: 'hub', title: title('מדריכים ועדכונים'), description: desc('מדריכים של עדן קוסמטיקס: ערכות להרמת ריסים וגבות, סיליקונים ומידות, צבעים וחמצן, בטבלאות ממחירי החנות. טיוטה לאישור עדן.'), h1: 'מדריכים ועדכונים', short: 'מדריכים', kicker: 'בלוג', lead: 'הבלוג של החנות היה ריק. במקומו, שלושה מדריכים שנבנו מנתוני הקטלוג. טיוטה לאישור עדן.', blocks: [], list: GUIDES.map(g => g.path), cta: CTA });

// guides: tables of the catalog's own data, with the store's words quoted, never advice
const firstLine = x => bidiClean((x.d || '').split('\n')[0] || '') || '—';
const table = (head, rows) => ({ k: 'table', id: 1, rows: [head, ...rows] });
const kits = items.filter(x => x.k === 'set'), [klo, khi] = range(kits);
const pads = items.filter(x => x.k === 'pads'), [plo, phi] = range(pads);
const tints = items.filter(x => x.k === 'tint'), oxs = items.filter(x => x.k === 'oxidant'), [tlo, thi] = range(tints);
const GSHORT = { kits: 'ערכות להרמת ריסים וגבות', pads: 'סיליקונים והמידות שלהם', tints: 'צבע וחמצן בחנות' };
const G = {
  kits: { t: 'ערכות להרמת ריסים וגבות בחנות: מה יש, כמה עולה, מה כתוב עליהן', d: `${kits.length} ערכות וסטים להרמת ריסים וגבות, ${money(klo)} עד ${money(khi)}, בטבלה אחת: מותג, מחיר, מלאי ומה כתוב על כל אחת בחנות.`,
    lead: `בחנות ${kits.length} ערכות וסטים להרמת ריסים וגבות, ${money(klo)} עד ${money(khi)}. הטבלה מסדרת אותן מהקטלוג, בלי המלצה. את התיאור המלא של כל ערכה, כפי שכתוב בחנות, אפשר לקרוא בעמוד שלה.`,
    blocks: [{ k: 'h2', t: 'הערכות בחנות, ממחיר נמוך לגבוה' }, table(['ערכה', 'מותג', 'מחיר', 'מלאי'], kits.slice().sort((a, b) => a.p - b.p).map(x => [x.dt, x.b, money(x.p), x.a ? 'במלאי' : 'אזל'])),
      { k: 'h2', t: 'ערכה מול שלבים בודדים' }, { k: 'p', t: `מלבד הערכות, החנות מוכרת גם את שלבי My lamination בנפרד (${items.filter(x => x.k === 'step').length} מוצרים, ${money(range(items.filter(x => x.k === 'step'))[0])} עד ${money(range(items.filter(x => x.k === 'step'))[1])}), למי שכבר עובדת ורוצה להשלים מלאי.` },
      { k: 'h2', t: 'מה עוד קונים סביב הערכה' }, { k: 'p', t: 'הסיליקונים, הדבק והכלים נמכרים בנפרד. בונה הערכה באתר מרכיב את הרשימה כולה, עם סכום ומה חסר למשלוח חינם.' }],
    list: kits.map(P) },
  pads: { t: 'סיליקונים להרמת ריסים: כל הדגמים בחנות, מידות ומחירים', d: `${pads.length} דגמי סיליקון בחנות, ${money(plo)} עד ${money(phi)}: צורות, צבעים ומספר המידות כפי שכתוב בכל מוצר.`,
    lead: `בחנות ${pads.length} דגמי סיליקון להרמת ריסים וגבות, ${money(plo)} עד ${money(phi)}. מספר המידות כתוב בשם כל מוצר.`,
    blocks: [{ k: 'h2', t: 'כל הסיליקונים בחנות' }, table(['דגם', 'מחיר', 'מלאי', 'מה כתוב בחנות'], pads.slice().sort((a, b) => a.p - b.p).map(x => [x.dt, money(x.p), x.a ? 'במלאי' : 'אזל', cut(firstLine(x), 90)])),
      { k: 'h2', t: 'דבק ובלאם' }, { k: 'p', t: `לצד הסיליקונים יש בחנות ${items.filter(x => x.k === 'glue').length} מוצרי דבק ובלאם (ZOLA Lami Balm ו-Kodi), ${money(range(items.filter(x => x.k === 'glue'))[0])} עד ${money(range(items.filter(x => x.k === 'glue'))[1])}. חלקם אזלו כרגע.` }],
    list: pads.map(P) },
  tints: { t: 'צבע לריסים וגבות בחנות: THUYA, RefectoCil, NIKK MOLE ו-My lamination', d: `${tints.length} צבעים ו-${oxs.length} סוגי חמצן בחנות, ${money(tlo)} עד ${money(thi)}, לפי מותג, גוון ומלאי (${SNAP}).`,
    lead: `בחנות ${tints.length} צבעים לריסים וגבות ו-${oxs.length} סוגי חמצן. חלק מהם אזלו כרגע (${tints.filter(x => !x.a).length} צבעים, ${oxs.filter(x => !x.a).length} חמצן).`,
    blocks: [{ k: 'h2', t: 'הצבעים' }, table(['צבע', 'מותג', 'מחיר', 'מלאי'], tints.map(x => [x.dt, x.b, money(x.p), x.a ? 'במלאי' : 'אזל'])), { k: 'h2', t: 'החמצן' }, table(['חמצן', 'מותג', 'מחיר', 'מלאי'], oxs.map(x => [x.dt, x.b, money(x.p), x.a ? 'במלאי' : 'אזל'])),
      { k: 'h2', t: 'שימו לב' }, { k: 'p', t: 'על חלק מהצבעים כתוב בחנות "מכיל חינה שחורה/PPD". קוראים את הכתוב על כל מוצר לפני הרכישה; תנאי השירות של החנות קובעים שהאחריות לשימוש נכון ולתגובה אלרגית היא של הלקוחה.' }],
    list: [...tints, ...oxs].map(P) },
};
for (const g of GUIDES) { const x = G[g.key]; pages.push({ path: g.path, type: 'guide', title: title(x.t), description: desc(x.d), h1: x.t, short: GSHORT[g.key], kicker: 'מדריך · טיוטה לאישור עדן', lead: x.lead, blocks: x.blocks, after: [{ k: 'links', t: 'המוצרים שבמדריך', items: x.list.slice(0, 12).map(p => ({ href: p, t: byH.get(decodeURIComponent(p.split('/')[2])).dt })) }], parent: { t: 'מדריכים', href: '/blogs/news/' }, related: x.list.filter(p => byH.get(decodeURIComponent(p.split('/')[2])).a).slice(0, 4), relatedTitle: 'מהחנות', datePublished: '2026-09-29', dateModified: '2026-09-29', cta: CTA }); }

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

// ---------- brand config
const THEME = `:root{--deep:#241A18;--onDeep:#F8EFEA;--paper:#F8EFEA;--surface:#fff;--ink:#241A18;--steel:#6B5A54;--line:#E6D3C9;--kick:#964F58;--link:#964F58;--accent:#964F58;--onAccent:#fff;--mute:#E9B8B2;--hdrBg:#F8EFEA;--hdrFg:#241A18;--ftBg:#241A18;--ftFg:#F8EFEA;--display:'Frank Ruhl Libre','Times New Roman',serif;--body:'Assistant',system-ui,'Arial Hebrew',Arial,sans-serif;--num:'Frank Ruhl Libre',serif;--mono:'Assistant',system-ui,sans-serif;--wrap:1240px;color-scheme:light}
@media (prefers-color-scheme:dark){:root{--paper:#1B1311;--surface:#261B18;--ink:#F6EAE3;--steel:#C9B3AA;--line:#40302A;--kick:#E9B8B2;--link:#E9B8B2;--accent:#E9B8B2;--onAccent:#241A18;--hdrBg:#1B1311;--hdrFg:#F6EAE3;--ftBg:#120C0B;--ftFg:#F6EAE3;--deep:#33241F;--onDeep:#F6EAE3;--mute:#C9B3AA;color-scheme:dark}}
body{font-size:17.5px}h1,h2,h3{font-family:var(--display)}h1{font-weight:900;letter-spacing:-.02em}article h2{font-weight:700}
.kick{font:700 12.5px/1 var(--body);letter-spacing:.2em;text-transform:uppercase}.logo{color:var(--ink)}.logo img{width:50px;height:48px}.logo span{font:700 15px/1.1 'Cinzel','Times New Roman',serif;letter-spacing:.2em;text-transform:uppercase}
.crumbs{font-family:var(--body)}.btn{border:0}.cta{background:var(--deep)}.cta h2{color:var(--onDeep)}.call{border-radius:999px}
header.site{border-bottom:1px solid var(--line)}.hero{background:#fff}.pc{background:var(--surface)}.tw{background:var(--surface)}footer.site h2{font-family:'Cinzel',serif;letter-spacing:.2em;color:#E7C3B2}
.lbl::before{background:#7BD0A0}`;
const brand = { name: NAME, short: 'Eden Cosmetics', logoSmall: '', phone: '052-545-3602', phoneHref: '0525453602', phoneLabel: 'וואטסאפ וטלפון', logo: '/img/symbol.svg', appleIcon: '/img/apple-touch-icon.png', ogImage: SITE + '/img/p/8479070290091-1.jpg', themeColor: '#F8EFEA', sameAs: ['https://www.instagram.com/edennahmani1'], cta: CTA, bannerHtml: 'תצוגה מקדימה של האתר החדש · עדן קוסמטיקס · <b>לא מוצג במנועי חיפוש</b>' };
const groups = { collections: ['כל-המוצרים', 'הרמת-ריסים-וגבות', 'דבקים-סיליקונים', 'מוצרים-נלווים', 'הנבחרת-שלנו', 'קורסים-והשתלמויות'].map(colPath), guides: GUIDES.map(g => g.path), brands: BRANDS.map(brandPath), policies: [...POLICIES.map(([s]) => `/policies/${s}/`), '/pages/הצהרת-נגישות/'] };
const pagesConfig = {
  site: SITE, out: '../../../edencosmetic', preview: PREVIEW, lang: 'he', dir: 'rtl', brand, fontsCss: '../../../edencosmetic/fonts/fonts.css', theme: { css: THEME },
  strings: { ctaTitle: 'מה עוד צריך לטיפול?', ctaText: 'בונה הערכה מרכיב רשימה אמיתית מהחנות.', notFoundLead: 'ייתכן שהכתובת השתנתה. אלה הקולקציות, המדריכים והמותגים של החנות, ואפשר גם לחזור לדף הבית.' },
  nav: [{ t: 'החנות', menu: 'collections', all: { t: 'כל המוצרים', href: colPath('כל-המוצרים') } }, { t: 'מדריכים', menu: 'guides', all: { t: 'כל המדריכים', href: '/blogs/news/' } }, { t: 'מותגים', menu: 'brands' }, { t: 'בונה הערכה', href: '/#kit' }, { t: 'צור קשר', href: '/pages/contact/' }],
  groups, groupTitles: { collections: 'החנות', guides: 'מדריכים', brands: 'מותגים', policies: 'מדיניות' }, contactTitle: 'צור קשר',
  footerLinks: [{ t: 'וואטסאפ', href: 'https://wa.me/972525453602' }, { t: 'צור קשר', href: '/pages/contact/' }, { t: 'אינסטגרם', href: 'https://www.instagram.com/edennahmani1' }],
  autolinks: [...BRANDS.map(b => ({ phrase: b, href: brandPath(b) })), { phrase: 'הרמת ריסים', href: colPath('הרמת-ריסים-וגבות') }, { phrase: 'סיליקונים', href: colPath('דבקים-סיליקונים') }, { phrase: 'קורסים והשתלמויות', href: colPath('קורסים-והשתלמויות') }],
  og: { bg: '#F8EFEA', fg: '#241A18', accent: '#964F58', font: 'Frank Ruhl Libre', mono: 'Assistant', grid: 'rgba(150,79,88,.07)' },
  home: { h1: 'ציוד מקצועי להרמת ריסים וגבות', kicker: 'EDEN COSMETICS', image: { src: '/img/p/8479070290091-1.jpg' } }, pages,
};
fs.writeFileSync(path.join(HERE, 'pages.json'), JSON.stringify(pagesConfig, null, 1));

// ---------- the home page: head, static links, static FAQ (idempotent marker blocks)
const dataSrc = rd(path.join(SITEDIR, 'src/3-data.js'));
const faq = (0, eval)('(' + dataSrc.slice(dataSrc.indexOf('faq:[') + 4, dataSrc.indexOf('],\n privacy') + 1) + ')');
const HOME_TITLE = 'עדן קוסמטיקס | ציוד מקצועי להרמת ריסים וגבות', HOME_DESC = 'ציוד מקצועי להרמת ריסים וגבות: ערכות, סיליקונים, דבקים וצבעים במחירי החנות ובמלאי שלה. משלוח חינם מעל ₪499. עדן נחמני, מטפלת ומדריכה.';
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
<link rel="preload" as="image" href="img/p/8479070290091-1.jpg">
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
  noscript: `<noscript><p style="text-align:center;padding:14px;background:#F0D3C3;color:#241A18;margin:0">הסל ובונה הערכה דורשים JavaScript. אפשר לגלוש בכל המוצרים והמדיניות דרך הקישורים בתחתית העמוד, ולהזמין בחנות: <a href="${STORE}">${STORE.replace('https://', '')}</a>, או בוואטסאפ <a href="${WA}">052-545-3602</a>.</p></noscript>`,
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
