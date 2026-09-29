#!/usr/bin/env node
// Builds the Eden Cosmetics brand kit from the traced logo (trace-logo.py) and the tokens below:
//   brand/logo-light.svg, logo-dark.svg, symbol-light.svg, symbol-dark.svg      (vector, from the client's own logo)
//   img/logo-light.png, logo-dark.png, symbol-800.png                            (transparent PNG)
//   ../../edencosmetic/icon.svg + img/favicon-32.png, apple-touch-icon.png, icon-512.png   (favicon set, in the site)
//   ../../edencosmetic/fonts/*                                                    (self-hosted type + fonts.css)
//   brand.json                                                                    (concept, claim, signature, palette, contrast, type)
import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';
const HERE = path.dirname(new URL(import.meta.url).pathname), PROJ = path.join(HERE, '..'), ROOT = path.join(PROJ, '..', '..');
const SITE = path.join(ROOT, 'edencosmetic'), SHOT = path.join(ROOT, '.claude/skills/ailgen-studio/scripts/shot.mjs');
fs.mkdirSync(path.join(SITE, 'img'), { recursive: true });

// ---- tokens (roles, not colour names) ----
const P = {
  ink: '#241A18', paper: '#F8EFEA', surface: '#FFFFFF', blush: '#F0D3C3', petal: '#E7C3B2', rose: '#BF7F7F',
  accent: '#964F58', accentInk: '#964F58', onAccent: '#FFFFFF', cocoa: '#6F574B', mute: '#6B5A54', line: '#E6D3C9',
  onDark: '#F8EFEA', blushOnDark: '#E9B8B2',
  real: '#2B7049', render: '#1F6C86', concept: '#8F5C0E', demo: '#6B5A54',
};
const lum = h => { const c = [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16) / 255).map(v => v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; };
const cr = (a, b) => { const x = lum(a), y = lum(b); return +(((Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05)).toFixed(2)); };
const contrast = {
  'ink/paper': cr(P.ink, P.paper), 'ink/blush': cr(P.ink, P.blush), 'mute/paper': cr(P.mute, P.paper), 'cocoa/paper': cr(P.cocoa, P.paper),
  'accentInk/paper': cr(P.accentInk, P.paper), 'accentInk/surface': cr(P.accentInk, P.surface), 'onAccent/accent': cr(P.onAccent, P.accent),
  'paper/ink': cr(P.paper, P.ink), 'blushOnDark/ink': cr(P.blushOnDark, P.ink), 'rose/paper (graphics only, ≥3)': cr(P.rose, P.paper),
  'real/paper': cr(P.real, P.paper), 'render/paper': cr(P.render, P.paper), 'concept/paper': cr(P.concept, P.paper),
};
for (const [k, v] of Object.entries(contrast)) { const need = /graphics/.test(k) ? 2.5 : 4.5; if (v < need) { console.error('CONTRAST FAIL', k, v); process.exitCode = 1; } }

// ---- logo variants ----
const parts = JSON.parse(fs.readFileSync(path.join(HERE, 'symbol-parts.json'), 'utf8'));
const trace = JSON.parse(fs.readFileSync(path.join(HERE, 'trace.json'), 'utf8'));
const svgOf = (vb, d, fill) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb.join(' ')}"><path fill="${fill}" fill-rule="evenodd" d="${d}"/></svg>\n`;
const full = fs.readFileSync(path.join(HERE, 'logo-full.svg'), 'utf8');
const dOf = s => s.match(/ d="([^"]+)"/)[1], vbOf = s => s.match(/viewBox="([^"]+)"/)[1].split(/\s+/).map(Number);
for (const [name, fill] of [['light', P.ink], ['dark', P.onDark]]) {
  fs.writeFileSync(path.join(HERE, `logo-${name}.svg`), svgOf(vbOf(full), dOf(full), fill));
  const all = parts.parts.ring + parts.parts.mono + parts.parts.lotus;
  fs.writeFileSync(path.join(HERE, `symbol-${name}.svg`), svgOf(parts.viewBox, all, fill));
}
// the mark in numbers: bounding box of a path (absolute M/C data from the tracer)
const bbox = d => { const n = (d.match(/-?\d+\.?\d*/g) || []).map(Number); let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9; for (let i = 0; i + 1 < n.length; i += 2) { x0 = Math.min(x0, n[i]); x1 = Math.max(x1, n[i]); y0 = Math.min(y0, n[i + 1]); y1 = Math.max(y1, n[i + 1]); } return { x0, y0, x1, y1, w: x1 - x0, h: y1 - y0 }; };
const mb = bbox(parts.parts.mono);

// ---- favicon set: the EC monogram in cream on the accent ----
const s = 0.62 * 512 / Math.max(mb.w, mb.h), tx = 256 - (mb.x0 + mb.w / 2) * s, ty = 256 - (mb.y0 + mb.h / 2) * s;
const mono = fill => `<path fill="${fill}" fill-rule="evenodd" transform="translate(${tx.toFixed(2)} ${ty.toFixed(2)}) scale(${s.toFixed(4)})" d="${parts.parts.mono}"/>`;
const icon = (rx) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><rect width="512" height="512" rx="${rx}" fill="${P.accent}"/>${mono(P.paper)}</svg>\n`;
fs.writeFileSync(path.join(SITE, 'icon.svg'), icon(112));
fs.writeFileSync(path.join(HERE, 'icon-square.svg'), icon(0));
const shot = (svg, out, w, h) => {
  const html = path.join(HERE, '.tmp-shot.html');
  fs.writeFileSync(html, `<!doctype html><body style="margin:0;background:transparent"><img src="file://${svg}" width="${w}" height="${h}" style="display:block">`);
  const r = spawnSync(process.execPath, [SHOT, html, out, '--w', String(w), '--h', String(h), '--transparent'], { encoding: 'utf8' });
  if (r.status) console.error(r.stderr); fs.rmSync(html, { force: true });
};
shot(path.join(SITE, 'icon.svg'), path.join(SITE, 'img/icon-512.png'), 512, 512);
shot(path.join(HERE, 'icon-square.svg'), path.join(SITE, 'img/apple-touch-icon.png'), 180, 180);
shot(path.join(SITE, 'icon.svg'), path.join(SITE, 'img/favicon-32.png'), 32, 32);
// logos as PNG for the site, the film and the ads
const vb = vbOf(full), aspect = vb[3] / vb[2];
const img = path.join(PROJ, 'img'); fs.mkdirSync(img, { recursive: true });
shot(path.join(HERE, 'logo-light.svg'), path.join(img, 'logo-light.png'), 1600, Math.round(1600 * aspect));
shot(path.join(HERE, 'logo-dark.svg'), path.join(img, 'logo-dark.png'), 1600, Math.round(1600 * aspect));
shot(path.join(HERE, 'symbol-light.svg'), path.join(img, 'symbol-800.png'), 800, Math.round(800 * parts.viewBox[3] / parts.viewBox[2]));
fs.copyFileSync(path.join(HERE, 'symbol-light.svg'), path.join(img, 'symbol.svg'));
fs.copyFileSync(path.join(HERE, 'logo-light.svg'), path.join(img, 'logo-light.svg'));
fs.copyFileSync(path.join(HERE, 'logo-dark.svg'), path.join(img, 'logo-dark.svg'));

// ---- fonts into the site ----
const fdir = path.join(SITE, 'fonts'); fs.mkdirSync(fdir, { recursive: true });
for (const f of fs.readdirSync(path.join(PROJ, 'fonts'))) fs.copyFileSync(path.join(PROJ, 'fonts', f), path.join(fdir, f));
fs.writeFileSync(path.join(fdir, 'fonts.css'), fs.readFileSync(path.join(PROJ, 'fonts/fonts.css'), 'utf8').replace(/font-display: block/g, 'font-display: swap'));

// ---- brand.json ----
const bj = JSON.parse(fs.readFileSync(path.join(PROJ, 'brand.json'), 'utf8'));
Object.assign(bj, {
  status: 'real-client',
  business: {
    type: 'חנות מקוונת לציוד מקצועי להרמת ריסים וגבות: ערכות שלבים, סיליקונים, דבקים, צבעים וכלים',
    sector: 'יופי מקצועי, קמעונאות מקוונת (Shopify), מכירה למטפלות ולמתלמדות',
    audience: ['מטפלות בהרמת ריסים וגבות (סלון, מכון, בית)', 'מתלמדות וסטודנטיות לקורסים', 'לקוחות פרטיות שקונות לעצמן'],
    offer: ['ערכות להרמת ריסים וגבות (THUYA, My lamination)', 'סיליקונים ודבקים (ZOLA, Kodi, סיליקונים בעיצובים)', 'צבעים וחמצן (THUYA, RefectoCil, NIKK MOLE)', 'כלים ומוצרים נלווים (פינצטות, מסרקים, מברשות)', 'קורסים והשתלמויות (הקולקציה ריקה כרגע)'],
    proof: ['71 מוצרים בקטלוג, ₪8 עד ₪420 (נשלף 29.9.2026)', 'משלוח חינם מעל ₪499', 'משלוח 4–5 ימי עסקים, איסוף עצמי מנתיבות בתיאום', 'הבעלים, עדן נחמני, מטפלת ומדריכה בתחום (במילותיה)'],
    objections: ['איזו ערכה מתאימה לי ומה עוד אני צריכה?', 'האם זה במלאי ומתי יגיע?', 'כמה יעלה עם משלוח ואיך מגיעים למשלוח חינם?', 'יש עם מי לדבר?', 'יש קורסים?'],
  },
  concept: {
    idea: 'העיקול: קו ישר שמתרומם ונהיה קימור, כמו ריס אחרי הרמה, וכמו הזנב של ה-E שהופך ל-C בסמל',
    claim: 'ציוד מקצועי להרמת ריסים וגבות, ממי שמטפלת ומדריכה בתחום.',
    signature: 'העיקול: קו באקסנט הוורוד שמתחיל ישר ומתעגל. בכל אייקון, בכל מפריד אזורים, בטעינת הסמל, בעיניים של לוטי ובסצנת ההרמה שבסרט.',
    spirit: 'beauty + makers: רגוע, מנחה, חם ונשי בלי קיטש. קרם, ורוד עמוק, קקאו ושחור-שוקולד; סריף אלגנטי לכותרות',
    twist: 'טעינת הסמל בשלוש תנועות (הטבעת נכתבת, האותיות עולות, הלוטוס נפתח) ואז קו ישר שמתרומם. בסרט: שורת ריסים שמתרוממת, "ההרמה".',
  },
  voice: {
    tone: ['מנחה', 'חם', 'מקצועי', 'בגובה העיניים של מטפלת'],
    slogan: 'העיקול שלך מתחיל כאן.',
    do: ['מחיר ומלאי כפי שהם בחנות, עם תאריך', 'פנייה בלשון נקבה (מטפלות, מתלמדות)', 'משפטים קצרים, רשימה לפני פסקה', 'מה שכתוב במוצר, מילה במילה'],
    dont: ['"הכי טוב", "הכי זול" בלי הוכחה', 'הוראות שימוש, זמנים או טענות רפואיות שלא כתובים במוצר', 'המלצות או ביקורות בדויות', 'הבטחת מתנה בלי תנאים כתובים'],
  },
  palette: { ...P, roles: { bg: 'paper', text: 'ink', accent: 'accent', accent2: 'cocoa', onDark: 'onDark', softPanel: 'blush' }, contrast, fromSite: bj.palette.fromSite,
    note: 'paper/blush/petal/rose נלקחו מהאתר הקיים (#F8EFEA, #F0D3C3, #E7C3B2, #BF7F7F); accent (#964F58) הוא הוורוד של האתר בעומק שעומד ב-4.5:1 עם לבן; cocoa כהה מעט מהכפתור הקיים (#81685B) כדי לעבור 4.5:1. הכחולים של תבנית Shopify (#3A8DC2, #87CEEB) אינם חלק מהמותג ולא בשימוש.' },
  type: {
    display: { family: 'Frank Ruhl Libre', weights: [500, 700, 900], use: 'כותרות (עברית ולטינית)' },
    body: { family: 'Assistant', weights: [300, 400, 600, 700], use: 'טקסט רץ, כפתורים' },
    num: { family: 'Frank Ruhl Libre', weights: [700], use: 'מחירים ומספרים' },
    latin: { family: 'Cinzel', weights: [500, 700], use: 'Eden Cosmetics ותוויות באותיות רישיות מרווחות, כמו הלוגו' },
    fonts: 'fonts/fonts.css', displayWeight: 700, bodyWeight: 400, numWeight: 700,
  },
  logo: {
    files: { light: 'img/logo-light.svg', dark: 'img/logo-dark.svg', mark: 'brand/symbol.svg', png: 'img/logo-light.png', pngDark: 'img/logo-dark.png' },
    symbol: 'brand/symbol.svg',
    parts: 'brand/symbol-parts.json',
    construction: 'brand/board.png',
    note: 'הלוגו הוא של הלקוחה, לא צויר מחדש: מעקב וקטורי מקובץ ה-PNG של האתר (brand/trace-logo.py, פי 6, החלקה והתאמת עקומות). הטבעת, ה-EC והלוטוס הם חלקים נפרדים כדי שאפשר יהיה להנפיש אותם בזה אחר זה.',
    favicon: 'הסמל EC בקרם על ורוד עמוק (icon.svg, 32, 180, 512)',
  },
  icons: { grid: 24, stroke: 1.6, signature: 'העיקול: קו אחד באקסנט שמתחיל ישר ומתעגל, בכל אחד מ-24 האייקונים', files: 'img/i-*.svg (+ -white לרקע כהה), brand/make-icons.mjs', count: 24 },
  honesty: { ...bj.honesty, notes: 'תמונות מוצר הן מהחנות (real). אין ביקורות ואין המלצות. מחירים ומלאי הם צילום מצב מ-29.9.2026. "מתנה בכל רכישה" לא מובטח באתר כי אין תנאים כתובים.' },
  campaign: { film: 'film.json', motif: 'lift', hook: 'ההרמה', cta: 'בונה הערכה' },
});
fs.writeFileSync(path.join(PROJ, 'brand.json'), JSON.stringify(bj, null, 1));
console.log('brand kit built. contrast:', JSON.stringify(contrast));
