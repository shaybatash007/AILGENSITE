#!/usr/bin/env node
// Talor Karadi · SEO composer: turns the old site's inventory into the new site's crawlable pages and home links.
//   node projects/talorkaradi/seo/compose.mjs
// Reads   intake-full/site.json (all 52 sitemap pages, with JSON-LD and link graph; falls back to intake/site.json)
//         talorkaradi/src/3-data.js (services, FAQ, jobs, videos), talorkaradi/legal.json
// Writes  projects/talorkaradi/seo/pages.json          the config for scripts/seo-pages.mjs
//         projects/talorkaradi/seo/redirect-overrides.json   duplicates and temporary pages → their successor
//         talorkaradi/src/1-head.html, 2-body.html, 3-data.js, 4-app.js   (idempotent marker blocks: SEO head, guides, footer map)
// Then:   node .claude/skills/ailgen-studio/scripts/seo-pages.mjs --config projects/talorkaradi/seo/pages.json
//         sh talorkaradi/build.sh
// Policy: every old URL that has content keeps its exact path (equity stays where it is); duplicates, job postings,
// author and category archives get one 301 to the closest successor; nothing goes to the home page as a blanket.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execFileSync } from 'child_process';
import { cleanBlocks, tokens, overlap, pathOf, stem, wordCount } from '../../../.claude/skills/ailgen-studio/scripts/seo-lib.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url)), ROOT = path.resolve(HERE, '../../..'), SITEDIR = path.join(ROOT, 'talorkaradi');
const SITE = 'https://talorkaradi.co.il';
const rd = f => fs.readFileSync(f, 'utf8'), P = pathOf;
const intakeFile = ['intake-full', 'intake'].map(d => path.join(ROOT, 'projects/talorkaradi', d, 'site.json')).find(f => fs.existsSync(f));
const intake = JSON.parse(rd(intakeFile)); console.log('intake:', path.relative(ROOT, intakeFile), intake.pages.length, 'pages');

// ---------- site data (the same constants the app uses)
const dataSrc = rd(path.join(SITEDIR, 'src/3-data.js'));
function grab(name) {
  const i = dataSrc.indexOf('const ' + name + '='); let j = dataSrc.indexOf('=', i) + 1, d = 0, q = null;
  for (let k = j; k < dataSrc.length; k++) {
    const c = dataSrc[k];
    if (q) { if (c === '\\') k++; else if (c === q) q = null; continue; }
    if ('\'"`'.includes(c)) { q = c; continue; }
    if ('[{('.includes(c)) d++;
    if (']})'.includes(c)) { d--; if (d === 0) return (0, eval)('(' + dataSrc.slice(j, k + 1) + ')'); }
  }
}
const SVCS = grab('SVCS'), DEF = grab('DEF'), VIDS = grab('VIDS'), JOBS = grab('JOBS'), PH = grab('PH'), SITES = grab('SITES');
const PREVIEW = /const PREVIEW=true/.test(dataSrc);
const legal = JSON.parse(rd(path.join(SITEDIR, 'legal.json')));

// ---------- old page lookups
const oldPages = new Map(intake.pages.map(p => [P(p.url), p]));
const vis = t => String(t || '').replace(/\s*[>»›<«‹]+\s*$/, '').trim();
const meta = p => p.metaDescription || p.description || '';
const stripBrand = t => String(t).replace(/\s+[|–-]\s+(קבוצת )?טל\s?אור.*$/, '').trim();
const h1Of = p => stripBrand((p.blocks.find(b => b.kind === 'h1') || {}).text || p.title);
const ldAll = p => { const out = []; const w = x => { if (!x || typeof x !== 'object') return; if (Array.isArray(x)) return x.forEach(w); out.push(x); if (x['@graph']) w(x['@graph']); if (x.mainEntity) w(x.mainEntity); }; w(p.jsonld); return out; };
const ldOf = (p, type) => ldAll(p).find(x => [].concat(x['@type']).includes(type));
const faqOf = p => { const f = ldAll(p).filter(x => [].concat(x['@type']).includes('FAQPage')).flatMap(x => [].concat(x.mainEntity || [])); const seen = new Set(); return f.map(q => [String(q.name || '').trim(), String(q.acceptedAnswer?.text || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()]).filter(([q, a]) => q && a && !seen.has(q) && seen.add(q)); };

// ---------- images (real site photos; sizes read once so the pages never shift)
const dims = new Map();
function image(key, alt) {
  const file = path.join(SITEDIR, 'img', key + '.webp'); if (!fs.existsSync(file)) return null;
  if (!dims.has(key)) { let out = ''; try { execFileSync('ffmpeg', ['-i', file], { stdio: ['ignore', 'ignore', 'pipe'] }); } catch (e) { out = String(e.stderr); } const m = out.match(/, (\d{2,5})x(\d{2,5})/); dims.set(key, m ? [+m[1], +m[2]] : [1200, 675]); }
  const [w, h] = dims.get(key); return { src: `/img/${key}.webp`, alt: alt || PH[key] || '', w, h, label: 'מהשטח' };
}
const imgFor = title => {
  const t = title || '';
  const k = /אסבסט/.test(t) ? 'dust' : /הריס|פירוק/.test(t) ? 'demo2' : /בטון|טלאור בטון/.test(t) ? 'concrete' : /מכולה|מכולות/.test(t) ? 'container' : /מיחזור|מחזור|5281|ירוק/.test(t) ? 'stack' : /מיגון|הנדסה|תשתיות/.test(t) ? 'excav' : /gps|שטר מטען|משאית|לוגיסט/i.test(t) ? 'truck' : /טופס 4|היתר|אישור|חוק|כמויות/.test(t) ? 'team' : 'hero';
  return image(k);
};

// ---------- classify
const SVC_MAP = { waste: '/sevices/waste-disposal/', demolition: '/sevices/demolition/', permits: '/sevices/contract-agreements/', recycling: '/sevices/recycling-plants/', soils: '/sevices/soils/', washing: '/sevices/washing/', concrete: '/sevices/talor_concrete/', engineering: '/sevices/civil-engineering/', infra: '/sevices/infrastructure/' };
const FIXED = new Set(['/', '/sevices/', '/about/', '/south/', '/projects/', '/contact/', '/blog/', '/jobs/', '/privacy-statement/', '/accesability/', '/' + 'שאלות-נפוצות' + '/']);
const svcPaths = Object.values(SVC_MAP);
const guides = [...oldPages].filter(([k, p]) => !FIXED.has(k) && !svcPaths.includes(k) && ldOf(p, 'Article')).map(([k, p]) => ({ k, p }));
console.log('guides:', guides.length);

const pages = [], overrides = {};
const CTA = { t: 'חשבו מאזן פסולת', href: '/#calc', title: 'כמה פסולת יהיה בפרויקט שלכם?', text: 'מחשבון להיתר ולטופס 4, מוקד בטלפון ושיחה עם הצוות.' };

const TABLES = fs.existsSync(path.join(HERE, 'tables.json')) ? JSON.parse(rd(path.join(HERE, 'tables.json'))) : {};
function withTables(blocks, k) {
  for (const t of TABLES[k] || []) {
    const i = blocks.findIndex(b => ['h2', 'h3'].includes(b.k) && t.after && (b.t.startsWith(t.after.slice(0, 25)) || t.after.startsWith(b.t.slice(0, 25))));
    const tb = { k: 'table', rows: t.rows };
    if (i < 0) { blocks.push(tb); continue; }
    let j = i + 1; while (j < blocks.length && blocks[j].k === 'p' && j < i + 2) j++; // after the paragraph that introduces it
    blocks.splice(j, 0, tb);
  }
  return blocks;
}

// guides: same URL, same title and description, same text, plus what the old page lacked (links, FAQ on the page, photo)
for (const { k, p } of guides) {
  let blocks = withTables(cleanBlocks(p.blocks), k);
  const li = blocks.findIndex(b => b.k === 'p'); let lead = li >= 0 ? blocks[li].t : '';
  if (lead.length > 240) lead = vis(meta(p)); else if (li >= 0) blocks.splice(li, 1);
  const art = ldOf(p, 'Article') || {};
  pages.push({ path: k, type: 'guide', kicker: 'מדריך', title: p.title, description: meta(p) || lead.slice(0, 150), h1: h1Of(p), short: stripBrand(p.title), lead, blocks, faq: faqOf(p), parent: { t: 'מדריכים', href: '/blog/' }, image: imgFor(p.title), datePublished: art.datePublished, dateModified: art.dateModified, cta: CTA, relatedTitle: 'עוד מדריכים ושירותים בנושא' });
}

// services: the old page's text, plus the curated points from the app's own service card
for (const [key, v] of Object.entries(SVCS)) {
  const k = SVC_MAP[key], p = oldPages.get(k); if (!p) { console.warn('no old page for', key); continue; }
  const blocks = cleanBlocks(p.blocks, { stopAt: /^(שאלות ותשובות|צרו איתנו קשר|השאירו פרטים|פרוי?יקטים)/ });
  const txt = blocks.map(b => b.t || b.items.join(' ')).join(' ');
  const extra = (v.list || []).filter(x => !txt.includes(x.slice(0, 18)));
  if (extra.length) blocks.push({ k: 'h2', t: 'מה כולל השירות' }, { k: 'ul', items: extra });
  const li = blocks.findIndex(b => b.k === 'p'); const lead = li >= 0 ? blocks[li].t : v.sh; if (li >= 0) blocks.splice(li, 1);
  pages.push({ path: k, type: 'service', kicker: `שירות · שלב ${v.s + 1}`, title: p.title.trim(), description: meta(p) || v.sh, h1: v.t.includes(':') ? v.t : h1Of(p) === stem(p.title) ? v.t : h1Of(p), short: v.t.split(':')[0], lead, blocks, parent: { t: 'שירותים', href: '/sevices/' }, image: image(v.img), cta: { ...CTA, title: 'רוצים הצעה או תיאום?', text: 'השאירו פרטים או חייגו למוקד, ונחזור אליכם.' , t: 'להשארת פרטים', href: '/#contact' }, relatedTitle: 'מדריכים ושירותים קשורים' });
}

// hub pages
const svcList = Object.values(SVC_MAP).filter(k => pages.some(x => x.path === k));
const gdList = guides.map(g => g.k).sort((a, b) => String(pages.find(x => x.path === b).datePublished || '').localeCompare(String(pages.find(x => x.path === a).datePublished || '')));
const old = k => oldPages.get(k);
pages.push({ path: '/sevices/', type: 'hub', kicker: 'השירותים', title: (old('/sevices/')?.title || 'השירותים שלנו - קבוצת טלאור כראדי').trim(), description: 'כל השירותים של קבוצת טלאור כראדי תחת קורת גג אחת: פינוי פסולת במכולות, מפעלי מיחזור, הריסה, בטון מובא, הנדסה ומיגון, קרקעות ותשתיות.', h1: 'השירותים שלנו', short: 'שירותים', lead: 'מפינוי הפסולת ועד בטון חדש: כל שלב במעגל של הבנייה נמצא אצל אותה קבוצה.', blocks: [], list: svcList, cta: CTA });
pages.push({ path: '/blog/', type: 'hub', kicker: 'מדריכים', title: 'מדריכים לקבלנים ויזמים: פינוי, מיחזור, טופס 4 והריסה | טלאור כראדי', description: 'מדריכים מקצועיים של קבוצת טלאור כראדי: חישוב כמויות פסולת, אישור הטמנה לטופס 4, מיחזור פסולת בניין, הריסת מבנים, בטון ומיגון.', h1: 'מדריכים לקבלנים ויזמים', short: 'מדריכים', lead: 'ידע מהשטח על פסולת בניין, היתרים, מיחזור והריסה. כל מדריך נכתב מניסיון של הצוות.', blocks: [], list: gdList, cta: CTA });

// inner pages from the old text
const inner = (k, kicker, extra = {}) => { const p = old(k); if (!p) { console.warn('missing', k); return; } const blocks = cleanBlocks(p.blocks); const li = blocks.findIndex(b => b.k === 'p'); const lead = li >= 0 ? blocks[li].t : ''; if (li >= 0) blocks.splice(li, 1); pages.push({ path: k, type: 'page', kicker, title: p.title.trim(), description: meta(p) || lead.slice(0, 150), h1: h1Of(p), short: stripBrand(p.title), lead, blocks, cta: CTA, ...extra }); };
inner('/about/', 'הקבוצה'); inner('/south/', 'מתקנים');
{ // projects: the app's own video list, as text links
  const p = old('/projects/');
  pages.push({ path: '/projects/', type: 'page', kicker: 'פרויקטים', title: (p?.title || 'פרויקטים - קבוצת טלאור כראדי').trim(), description: 'פרויקטים של קבוצת טלאור כראדי בסרטון: הריסה בירושלים, התחדשות עירונית בבת ים, עבודות עפר באשדוד והקמת מפעל הבטון.', h1: 'פרויקטים', short: 'פרויקטים', lead: 'כמה מהעבודות של הקבוצה בשטח, בצילומים שלנו.', blocks: [{ k: 'links', items: VIDS.map(v => ({ t: v.t, href: `https://www.youtube.com/watch?v=${v.id}`, note: `(${v.c})` })) }], cta: CTA });
}
pages.push({ path: '/contact/', type: 'page', kicker: 'יצירת קשר', title: (old('/contact/')?.title || 'יצירת קשר - קבוצת טלאור כראדי').trim(), description: `יצירת קשר עם קבוצת טלאור כראדי: מוקד ${DEF.phone}, טלפון ${DEF.phone2}, ${DEF.email}, ${DEF.address}.`, h1: 'יצירת קשר', short: 'צור קשר', lead: `מוקד ${DEF.phone} זמין לפינוי, מכולות והצעות. אפשר גם להשאיר פרטים בטופס ונחזור אליכם.`,
  blocks: [{ k: 'h2', t: 'פרטים' }, { k: 'ul', items: [`מוקד: ${DEF.phone}`, `טלפון: ${DEF.phone2}`, `משרד: ${DEF.phone3}`, `אימייל: ${DEF.email}`, `כתובת המשרדים: ${DEF.address}`, `כתובת למכתבים: ${DEF.mailAddr}`] }, { k: 'h2', t: 'מתקני הקבוצה' }, { k: 'ul', items: SITES.map(s => `${s.n}: ${s.d}`) }], cta: { t: 'לטופס השארת פרטים', href: '/#contact', title: 'מעדיפים שנחזור אליכם?', text: 'ממלאים שם וטלפון, ונחזור בהקדם.' } });
pages.push({ path: '/jobs/', type: 'page', kicker: 'קריירה', title: (old('/jobs/')?.title || 'דרושים - קבוצת טלאור כראדי').trim(), description: 'משרות פנויות בקבוצת טלאור כראדי: פינוי, מיחזור, בטון והנדסה. שלחו קורות חיים ונחזור אליכם.', h1: 'דרושים בקבוצת טלאור כראדי', short: 'דרושים', lead: 'הקבוצה מחפשת אנשים טובים שיצטרפו לצוות.', blocks: [{ k: 'h2', t: 'משרות' }, { k: 'ul', items: JOBS }, { k: 'p', t: `קורות חיים שולחים ל-${DEF.jobsEmail}.` }], cta: { t: 'שליחת מייל', href: 'mailto:' + DEF.jobsEmail, title: 'רוצים להצטרף?', text: 'שלחו קורות חיים ואת שם המשרה.' } });
{ // legal pages from the same text the app shows in its dialogs
  const toBlocks = txt => txt.split(/\n\s*\n/).flatMap(par => { const lines = par.split('\n').map(x => x.trim()).filter(Boolean); if (!lines.length) return []; const head = /^\d+\.\s/.test(lines[0]); return head ? [{ k: 'h2', t: lines[0].replace(/^\d+\.\s*/, '') }, ...(lines.length > 1 ? [{ k: 'p', t: lines.slice(1).join(' ') }] : [])] : [{ k: 'p', t: lines.join(' ') }]; });
  const priv = toBlocks(legal.privacy), a11y = toBlocks(legal.a11y || DEF.a11yText || '');
  const first = a => { const i = a.findIndex(b => b.k === 'p'); return i >= 0 ? a.splice(i, 1)[0].t : ''; };
  const l1 = first(priv), l2 = first(a11y);
  pages.push({ path: '/privacy-statement/', type: 'page', kicker: 'משפטי', title: 'מדיניות פרטיות - קבוצת טלאור כראדי בע"מ', description: 'מדיניות הפרטיות של האתר של קבוצת טלאור כראדי: איזה מידע נאסף, למה, כמה זמן נשמר ואיך פונים בנושא.', h1: 'מדיניות פרטיות', short: 'פרטיות', lead: l1, blocks: priv, cta: null });
  pages.push({ path: '/accesability/', type: 'page', kicker: 'משפטי', title: 'הצהרת נגישות - קבוצת טלאור כראדי בע"מ', description: 'הצהרת הנגישות של האתר של קבוצת טלאור כראדי: התקן, התאמות, ואיך לפנות בבעיית נגישות.', h1: 'הצהרת נגישות', short: 'נגישות', lead: l2, blocks: a11y, cta: null });
}
{ // FAQ: every question the old page answered, plus the new ones
  const oldF = old('/שאלות-נפוצות/') ? faqOf(old('/שאלות-נפוצות/')) : []; const seen = new Set(oldF.map(x => x[0]));
  const faq = [...oldF, ...DEF.faq.filter(([q]) => !seen.has(q))];
  pages.push({ path: '/שאלות-נפוצות/', type: 'page', kicker: 'שאלות ותשובות', title: (old('/שאלות-נפוצות/')?.title || 'שאלות נפוצות - קבוצת טלאור כראדי').trim(), description: 'תשובות לשאלות נפוצות על פינוי פסולת, מכולות, מיחזור, בטון והיתרים: הסכם להיתר, אישור הטמנה לטופס 4 וכמויות פסולת.', h1: 'שאלות נפוצות', short: 'שאלות נפוצות', lead: 'התשובות לשאלות שקבלנים ויזמים שואלים אותנו הכי הרבה.', blocks: [], faq, faqTitle: 'שאלות ותשובות', cta: CTA });
}

// inner pages must be reachable from content, not only from menus
const HUBMORE = {
  '/sevices/': [{ t: 'עוד על הקבוצה', k: 'links', items: [{ t: 'פארק תעשיות דרום ירוק', href: '/south/', note: '– המתקן שמשלים את מעגל המיחזור תחת קורת גג אחת.' }, { t: 'פרויקטים בסרטון', href: '/projects/', note: '– הריסה, התחדשות עירונית ועבודות עפר בשטח.' }, { t: 'הקבוצה והסיפור שלה', href: '/about/', note: '– מ-2008 ועד 5 מתקנים בדרום ובמרכז.' }] }],
  '/blog/': [{ t: 'לפני שמתחילים', k: 'links', items: [{ t: 'שאלות נפוצות', href: '/שאלות-נפוצות/', note: '– הסכם להיתר, אישור הטמנה וכמויות פסולת בקצרה.' }, { t: 'הקבוצה', href: '/about/', note: '– מי כתב את המדריכים ומאיפה הניסיון.' }] }],
  '/contact/': [{ t: 'קישורים שימושיים', k: 'links', items: [{ t: 'משרות פנויות', href: '/jobs/' }, { t: 'שאלות נפוצות', href: '/שאלות-נפוצות/' }, { t: 'מתקני הקבוצה', href: '/south/' }, { t: 'על הקבוצה', href: '/about/' }] }],
  '/about/': [{ t: 'המשך קריאה', k: 'links', items: [{ t: 'פרויקטים', href: '/projects/' }, { t: 'הפארק בדרום', href: '/south/' }, { t: 'משרות פנויות', href: '/jobs/' }] }]
};
for (const [k, after] of Object.entries(HUBMORE)) { const pg = pages.find(x => x.path === k); if (pg) pg.after = after; }

// titles and descriptions must be unique: the old site had two guides sharing one, and the fix belongs to the migration
{
  const seenT = new Map(), seenD = new Map();
  for (const pg of pages) {
    const dupT = seenT.has(pg.title), dupD = seenD.has(pg.description);
    if (dupT || dupD) {
      const lead = (pg.blocks.find(b => b.k === 'p') || {}).t || pg.lead;
      if (dupT) { console.log('duplicate title made unique:', pg.path); pg.title = `${pg.h1} | טלאור כראדי`; pg.short = pg.h1.split(':')[0]; }
      if (dupD) { console.log('duplicate description made unique:', pg.path); pg.description = lead.replace(/\s+/g, ' ').slice(0, 150).replace(/\s\S*$/, '') + '…'; }
    }
    seenT.set(pg.title, pg.path); seenD.set(pg.description, pg.path);
  }
}

// ---------- related links and contextual auto-links
const byP = new Map(pages.map(p => [p.path, p]));
const tk = p => new Set([...tokens(p.title), ...tokens(p.h1)]);
const T = new Map(pages.map(p => [p.path, tk(p)]));
const best = (self, pool, n) => pool.filter(x => x !== self).map(x => ({ x, s: overlap(T.get(self), T.get(x)) })).filter(o => o.s > 0).sort((a, b) => b.s - a.s).slice(0, n).map(o => o.x);
for (const p of pages) {
  if (p.type === 'guide') p.related = [...best(p.path, svcList, 1), ...best(p.path, gdList, 3)].slice(0, 4);
  if (p.type === 'service') p.related = [...best(p.path, gdList, 3), ...best(p.path, svcList, 1)].slice(0, 4);
  if (['page'].includes(p.type) && !p.related) p.related = svcList.slice(0, 3);
  if (p.related?.length < 3 && p.type !== 'page') p.related = [...new Set([...p.related, ...gdList.filter(x => x !== p.path)])].slice(0, 4);
}
const find = re => [...byP.keys()].find(k => re.test(k));
const A = [['הסכם התקשרות', SVC_MAP.permits], ['הסכמי התקשרות', SVC_MAP.permits], ['פינוי פסולת', SVC_MAP.waste], ['הריסת מבנים', SVC_MAP.demolition], ['בטון מובא', SVC_MAP.concrete], ['אספקת בטון', SVC_MAP.concrete], ['מפעל מיחזור', SVC_MAP.recycling], ['מפעלי מיחזור', SVC_MAP.recycling], ['מיגוניות', SVC_MAP.engineering], ['הנדסה אזרחית', SVC_MAP.engineering], ['שיקום קרקעות', SVC_MAP.soils], ['טיפול בקרקעות', SVC_MAP.soils],
  ['תקן 5281', find(/תקן-5281/)], ['אסבסט', find(/אסבסט/)], ['חישוב כמויות', find(/חישוב-כמויות/)], ['שטר מטען', find(/שטר-מטען/)], ['אישור הטמנה', find(/אישור-הטמנה/)], ['פארק תעשיות דרום ירוק', '/south/'], ['מאזן הפסולת', '/#calc'], ['מאזן פסולת', '/#calc']].filter(([, h]) => h);

// ---------- duplicates and temporary pages → one 301 each
for (const [k, p] of oldPages) {
  if (byP.has(k) || k === '/') continue;
  if (/^\/(civil-engineering|talor_concrete|contract-agreements|soils|infrastructure)\/$/.test(k)) overrides[k] = '/sevices' + k;
  else if (/^\/drushim\//.test(k)) overrides[k] = '/jobs/';
  else if (/^\/category\//.test(k)) overrides[k] = '/blog/';
  else if (/^\/author\//.test(k)) overrides[k] = '/about/';
  else if (k === '/עמוד-הבית-אפרת/') overrides[k] = '/';
}
for (const u of (intake.sitemapUrls || [])) { const k = P(u); if (k && !byP.has(k) && !overrides[k] && k !== '/') console.warn('unmapped sitemap url', k); }

// ---------- config for the renderer
const cfg = {
  site: SITE, out: '../../../talorkaradi', preview: PREVIEW, lang: 'he', dir: 'rtl',
  brand: { name: 'קבוצת טלאור כראדי', short: 'טלאור כראדי', phone: DEF.phone, phoneHref: DEF.phone, logo: '/icon.svg', ogImage: '/img/hero.webp', themeColor: '#0B1B2E', sameAs: [DEF.facebook, DEF.instagram].filter(Boolean), foundingDate: '2008', cta: CTA, bannerHtml: 'תצוגה מקדימה של האתר החדש · <b>הוכן על ידי AILGEN</b> עבור קבוצת טלאור כראדי' },
  fontsCss: '../../../talorkaradi/fonts/fonts.css',
  nav: [{ t: 'בית', href: '/' }, { t: 'שירותים', menu: 'services', all: { t: 'כל השירותים', href: '/sevices/' } }, { t: 'מדריכים', href: '/blog/' }, { t: 'מאזן פסולת', href: '/#calc' }, { t: 'הקבוצה', href: '/about/' }, { t: 'צור קשר', href: '/contact/' }],
  groups: { services: svcList, guides: gdList }, groupTitles: { services: 'שירותים', guides: 'מדריכים' },
  footerLinks: [{ t: 'הקבוצה', href: '/about/' }, { t: 'מתקנים', href: '/south/' }, { t: 'פרויקטים', href: '/projects/' }, { t: 'שאלות נפוצות', href: '/שאלות-נפוצות/' }, { t: 'דרושים', href: '/jobs/' }, { t: 'צור קשר', href: '/contact/' }, { t: 'מדיניות פרטיות', href: '/privacy-statement/' }, { t: 'הצהרת נגישות', href: '/accesability/' }],
  autolinks: A.map(([phrase, href]) => ({ phrase, href })), pages
};
fs.writeFileSync(path.join(HERE, 'pages.json'), JSON.stringify(cfg, null, 1));
fs.writeFileSync(path.join(HERE, 'redirect-overrides.json'), JSON.stringify(overrides, null, 1));
console.log('pages', pages.length, 'services', svcList.length, 'guides', gdList.length, 'redirect overrides', Object.keys(overrides).length);

// ---------- the home page (idempotent marker blocks)
const enc = encodeURI, esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const HOME_TITLE = 'קבוצת טלאור כראדי | פינוי פסולת, מיחזור ובטון בדרום ובמרכז';
const HOME_DESC = `קבוצת טלאור כראדי: פינוי פסולת במכולות, מפעלי מיחזור, בטון מובא, הריסה, הנדסה ומיגון. מעל 90% מהפסולת שמגיעה למפעלים חוזרת לבנייה. מוקד ${DEF.phone}.`;
const homeLd = { '@context': 'https://schema.org', '@graph': [
  { '@type': 'Organization', '@id': SITE + '/#org', name: cfg.brand.name, url: SITE + '/', logo: SITE + '/icon.svg', foundingDate: '2008', sameAs: cfg.brand.sameAs, address: { '@type': 'PostalAddress', streetAddress: 'האודם 14, א.ת. עד הלום', addressCountry: 'IL' }, contactPoint: [{ '@type': 'ContactPoint', telephone: DEF.phone, contactType: 'customer service', areaServed: 'IL', availableLanguage: 'he' }, { '@type': 'ContactPoint', telephone: '+972-72-326-7235', contactType: 'sales', areaServed: 'IL', availableLanguage: 'he' }] },
  { '@type': 'WebSite', '@id': SITE + '/#site', url: SITE + '/', name: cfg.brand.name, inLanguage: 'he', publisher: { '@id': SITE + '/#org' } },
  { '@type': 'WebPage', '@id': SITE + '/#home', url: SITE + '/', name: HOME_TITLE, description: HOME_DESC, isPartOf: { '@id': SITE + '/#site' }, about: { '@id': SITE + '/#org' }, inLanguage: 'he' },
  { '@type': 'FAQPage', mainEntity: DEF.faq.map(([q, a]) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a } })) },
  { '@type': 'ItemList', name: 'השירותים של קבוצת טלאור כראדי', itemListElement: svcList.map((k, i) => ({ '@type': 'ListItem', position: i + 1, name: byP.get(k).short, url: SITE + enc(k) })) }] };
const headBlock = `<!--seo:head-->
<title>${esc(HOME_TITLE)}</title>
<meta name="description" content="${esc(HOME_DESC)}">
<link rel="canonical" href="${SITE}/">
${PREVIEW ? '<meta name="robots" content="noindex,follow">' : '<meta name="robots" content="index,follow,max-image-preview:large">'}
<meta property="og:type" content="website"><meta property="og:locale" content="he_IL"><meta property="og:site_name" content="${esc(cfg.brand.name)}"><meta property="og:title" content="${esc(HOME_TITLE)}"><meta property="og:description" content="${esc(HOME_DESC)}"><meta property="og:url" content="${SITE}/"><meta property="og:image" content="${SITE}/img/hero.webp">
<meta name="twitter:card" content="summary_large_image">
<script type="application/ld+json">${JSON.stringify(homeLd)}</script>
<!--/seo:head-->`;
const linksBlock = `<!--seo:links-->
<div class="fmap"><section aria-labelledby="fm-s"><h2 id="fm-s">שירותים</h2><ul>${svcList.map(k => `<li><a href="${enc(k)}">${esc(byP.get(k).short)}</a></li>`).join('')}</ul></section><section aria-labelledby="fm-g"><h2 id="fm-g">מדריכים</h2><ul>${gdList.map(k => `<li><a href="${enc(k)}">${esc(byP.get(k).short)}</a></li>`).join('')}</ul></section><section aria-labelledby="fm-c"><h2 id="fm-c">הקבוצה</h2><ul>${cfg.footerLinks.map(l => `<li><a href="${enc(l.href)}">${esc(l.t)}</a></li>`).join('')}</ul></section></div>
<!--/seo:links-->`;
const topGuides = ['אישור-הטמנה', 'חישוב-כמויות', 'טופס-4-דרישה', 'מכולה-לפינוי-פסולת-בניין-מחיר', 'חוק-פסולת', 'building-demolition'].map(x => gdList.find(k => k.includes(x))).filter(Boolean);
const guidesBlock = `<!--seo:guides-->
<section class="sec" id="guides" aria-labelledby="gdH"><div class="wrap"><p class="eyebrow">ידע מהשטח</p><h2 id="gdH">מדריכים לקבלנים ולמהנדסים</h2><p class="lead">הנוסחאות, האישורים והדרישות שמאחורי פינוי ומיחזור של פסולת בניין, כפי שהצוות שלנו מסביר אותם.</p>
<ul class="gd">${topGuides.map(k => `<li><a href="${enc(k)}"><b>${esc(byP.get(k).h1)}</b><span>${esc(vis(byP.get(k).description))}</span></a></li>`).join('')}</ul>
<p style="margin-top:22px"><a class="btn" href="/blog/">לכל המדריכים <span class="ar" aria-hidden="true">←</span></a></p></div></section>
<!--/seo:guides-->`;
const swap = (file, name, block, fallback) => {
  const f = path.join(SITEDIR, file); let s = rd(f); const re = new RegExp(`<!--seo:${name}-->[\\s\\S]*?<!--/seo:${name}-->`);
  if (re.test(s)) s = s.replace(re, () => block); else s = fallback(s, block);
  fs.writeFileSync(f, s);
};
swap('src/1-head.html', 'head', headBlock, s => s);
{ // the old relative og tags outside the block are removed; the block itself is never touched
  const f = path.join(SITEDIR, 'src/1-head.html'); const s = rd(f);
  const a = s.indexOf('<!--seo:head-->'), b = s.indexOf('<!--/seo:head-->') + '<!--/seo:head-->'.length;
  fs.writeFileSync(f, s.slice(0, a) + s.slice(a, b) + s.slice(b).replace(/<meta property="og:title"[^\n]*og:locale[^\n]*\n?/, ''));
}
swap('src/2-body.html', 'links', linksBlock, s => s);
swap('src/2-body.html', 'guides', guidesBlock, (s, b) => s.replace('<section class="sec" id="faq"', b + '\n<section class="sec" id="faq"'));
// service cards link to their full pages; the app's dialog stays as the quick view
{
  const f = path.join(SITEDIR, 'src/3-data.js'); let s = rd(f);
  const line = `const SVC_URL=${JSON.stringify(SVC_MAP)}; /* generated by projects/talorkaradi/seo/compose.mjs: the full page of each service */\n`;
  s = /const SVC_URL=.*\n/.test(s) ? s.replace(/const SVC_URL=.*\n/, line) : s.replace('const PH=', line + 'const PH='); fs.writeFileSync(f, s);
  const g = path.join(SITEDIR, 'src/4-app.js'); let a = rd(g);
  if (!a.includes('class="more"')) {
    a = a.replace('aria-haspopup="dialog">מה כולל</button></div></article>', 'aria-haspopup="dialog">מה כולל</button><a class="more" href="${SVC_URL[k]}">לעמוד המלא</a></div></article>'); fs.writeFileSync(g, a);
  }
}
{ // the hero, the services and the FAQ exist in the served HTML; the app re-renders them from the admin's data
  const hl = t => esc(t).replace(/\*(.+?)\*/g, '<em>$1</em>');
  swap('src/2-body.html', 'kick', `<!--seo:kick-->${DEF.heroKick.split('·').map(x => `<span>${esc(x.trim())}</span>`).join('')}<!--/seo:kick-->`, s => s);
  swap('src/2-body.html', 'h1', `<!--seo:h1-->${hl(DEF.heroLine)}<!--/seo:h1-->`, s => s);
  swap('src/2-body.html', 'sub', `<!--seo:sub-->${esc(DEF.heroSub)}<!--/seo:sub-->`, s => s);
  swap('src/2-body.html', 'faq', `<!--seo:faq-->${DEF.faq.map(([q, a], i) => `<details${i === 0 ? ' open' : ''}><summary>${esc(q)}</summary><p>${esc(a)}</p></details>`).join('')}<!--/seo:faq-->`, s => s);
  swap('src/2-body.html', 'svc', `<!--seo:svc--><ul class="svc-static">${svcList.map(k => { const key = Object.keys(SVC_MAP).find(x => SVC_MAP[x] === k); return `<li><a href="${enc(k)}">${esc(SVCS[key].t)}</a>: ${esc(SVCS[key].sh)}</li>`; }).join('')}</ul><!--/seo:svc-->`, s => s);
}
console.log('home patched (head, guides, footer map, service links); preview =', PREVIEW);
