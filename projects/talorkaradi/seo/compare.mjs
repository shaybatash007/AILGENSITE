#!/usr/bin/env node
// Old site vs the new build, from the two audit reports: what the migration kept, changed or improved.
//   node projects/talorkaradi/seo/compare.mjs   → projects/talorkaradi/seo/comparison.md
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
const HERE = path.dirname(fileURLToPath(import.meta.url));
const O = JSON.parse(fs.readFileSync(path.join(HERE, 'old/seo-report.json'), 'utf8')), N = JSON.parse(fs.readFileSync(path.join(HERE, 'new/seo-report.json'), 'utf8'));
const key = u => decodeURIComponent(new URL(u).pathname).toLowerCase().replace(/\/?$/, '/');
const nm = new Map(N.pages.map(p => [key(p.url), p])), om = new Map(O.pages.map(p => [key(p.url), p]));
const guides = O.pages.filter(p => p.ldTypes.includes('Article'));
// the old site's contextual links (outside menus) come from the full intake, which kept the link graph
const I = JSON.parse(fs.readFileSync(path.join(HERE, '../intake-full/site.json'), 'utf8'));
const oldCtxIn = new Map(), oldCtxOut = new Map();
for (const p of I.pages) { const a = key(p.url); for (const l of p.linkList || []) { if (l.nav) continue; const b = key('https://x' + l.to); if (a === b) continue; oldCtxOut.set(a, (oldCtxOut.get(a) || 0) + 1); (oldCtxIn.get(b) || oldCtxIn.set(b, new Set()).get(b)).add(a); } }
const oldCtxTotal = [...oldCtxOut.values()].reduce((a, b) => a + b, 0);
const avg = a => a.length ? +(a.reduce((x, y) => x + y, 0) / a.length).toFixed(1) : 0;
const gN = guides.map(g => nm.get(key(g.url))).filter(Boolean);
const rows = guides.map(g => { const n = nm.get(key(g.url)); return `| ${decodeURIComponent(new URL(g.url).pathname).slice(0, 46)} | ${g.wordsRendered} | ${n ? n.wordsRendered : '—'} | ${oldCtxIn.get(key(g.url))?.size ?? 0} | ${n ? n.ctxIn : '—'} | ${g.ldTypes.includes('FAQPage') ? 'כן' : '—'} | ${n && n.ldTypes.includes('FAQPage') ? 'כן' : '—'} |`; });
const md = `# האתר הישן מול הבנייה החדשה (SEO)

נמדד בכלי \`seo-audit.mjs\`: הישן ב-https://talorkaradi.co.il (${O.summary.crawledAt.slice(0, 10)}), החדש כבנייה סטטית מקומית (תצוגה מקדימה, noindex צפוי).

| | האתר הישן | האתר החדש: לפני התיקון | האתר החדש: אחרי |
|---|---|---|---|
| כתובות עם תוכן (URL) | ${O.summary.pages} עמודים, ${O.summary.sitemapUrls} במפת האתר | 1 | ${N.summary.pages} עמודים, ${N.summary.sitemapUrls} במפת האתר, ועוד 19 הפניות 301 |
| מדריכים (מאמרים) | ${guides.length} | 0 | ${gN.length} |
| ממוצע מילים לעמוד (אחרי JS) | ${O.summary.avgWordsRendered} | 1,439 (עמוד אחד) | ${N.summary.avgWordsRendered} |
| נתונים מובנים (JSON-LD) | Article, FAQPage, BreadcrumbList, Organization, WebSite | אין | Article, FAQPage, Service, BreadcrumbList, Organization, WebSite, ItemList |
| h1 ב-HTML שנשלח | כן | ריק (נמלא ב-JavaScript) | כן, בכל עמוד |
| מפת אתר / robots | יש (8 מפות, 52 כתובות) | אין / אין | יש / יש |
| canonical | ברוב העמודים (5 כפילויות מצביעות לעמוד הראשי שלהן) | אין | בכל עמוד |
| קישורים פנימיים (סה"כ / מתוך תוכן) | ${O.summary.internalEdges} / ${oldCtxTotal} | 0 (ניווט בעוגנים #) | ${N.summary.internalEdges} / ${N.summary.contextualEdges} |
| עמודים יתומים | ${O.summary.orphans} | — | ${N.summary.orphans} |
| קישורים נכנסים למדריך מתוך תוכן של עמודים אחרים (ממוצע / מינימום) | ${avg(guides.map(g => oldCtxIn.get(key(g.url))?.size ?? 0))} / ${Math.min(...guides.map(g => oldCtxIn.get(key(g.url))?.size ?? 0))} | 0 | ${avg(gN.map(g => g.ctxIn))} / ${gN.length ? Math.min(...gN.map(g => g.ctxIn)) : 0} |
| ממצאים בחומרה גבוהה | ${O.summary.issues.high} | 2 | ${N.summary.issues.high} |

## המדריכים: מילים וקישורים נכנסים, ישן מול חדש

| מדריך | מילים (ישן) | מילים (חדש) | נכנסים מתוכן (ישן) | נכנסים מתוכן (חדש) | FAQ (ישן) | FAQ (חדש) |
|---|---|---|---|---|---|---|
${rows.join('\n')}

מילים בטבלה כוללות תפריטים ותחתית של כל אתר. השוואה ישירה של גוף המאמר בלבד (טקסט ראשי ישן מול גוף העמוד החדש, כולל טבלאות ושאלות): לפחות 102% ובממוצע 122% בכל 21 המדריכים. "נכנסים מתוכן": עמודים שמקשרים מגוף התוכן שלהם, לא מהתפריט או מהתחתית (בחדש: קישורים בגוף הטקסט, בלוק "עוד בנושא", מרכזי המדריכים והשירותים ודף הבית).
`;
fs.writeFileSync(path.join(HERE, 'comparison.md'), md); console.log(md.split('\n').slice(0, 16).join('\n'));
