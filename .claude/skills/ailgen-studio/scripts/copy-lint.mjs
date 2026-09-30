#!/usr/bin/env node
// Content quality, step 2: lint every harvested string (copy-harvest.mjs) against rules that hold for any site, plus the
// project's own voice, vocabulary and allowlist. Deterministic, so it runs on every build and in the autonomy loop;
// the judgement pass (clarity, tone, hierarchy) is the review in references/12-content-quality.md.
//   node copy-lint.mjs --in projects/<slug>/qa/copy/strings.json --rules projects/<slug>/copy-rules.json [--out lint.json] [--gate]
// rules file (all optional): {
//   "voice": { "address": "fem-singular" | "plural" | "neutral", "ctas": "infinitive" },   how the site speaks to the visitor
//   "latinAllowed": ["THUYA", "ml", ...],     Latin words that belong (brand names, units)
//   "banned": [{ "re": "regex", "why": "..." }], "allow": ["exact string", ...], "allowRe": ["regex"],
//   "gate": { "high": 0, "medium": 0 }        the maximum per severity for --gate to pass
// }
// Severities: high = internal/production/developer language or placeholders reaching a visitor; medium = voice,
// terminology, stale dates, language leaks, filler; low = typography. Exit 1 with --gate when a limit is exceeded.
import fs from 'fs';
import path from 'path';
import { parseArgs, repoRoot } from './lib.mjs';
const a = parseArgs(), ROOT = repoRoot();
if (!a.in) { console.error('usage: node copy-lint.mjs --in strings.json [--rules copy-rules.json] [--out lint.json] [--gate]'); process.exit(2); }
const H = JSON.parse(fs.readFileSync(path.resolve(ROOT, a.in), 'utf8'));
const R = a.rules && fs.existsSync(path.resolve(ROOT, a.rules)) ? JSON.parse(fs.readFileSync(path.resolve(ROOT, a.rules), 'utf8')) : {};
const allow = new Set(R.allow || []), allowRe = (R.allowRe || []).map(s => new RegExp(s, 'u'));
const latinOk = new Set((R.latinAllowed || []).map(s => s.toLowerCase()));
const voice = R.voice || { address: 'neutral', ctas: 'infinitive' };
// JavaScript's \b is ASCII-only, even with the u flag: Hebrew word edges need explicit lookarounds
const E = '(?=$|[^\\u0590-\\u05FF])', S = '(?<=^|[^\\u0590-\\u05FF])';
const he = (src, flags = 'u') => new RegExp(src.replace(/\\b/g, '').replace(/<E>/g, E).replace(/<S>/g, S), flags);

// ---- global rules (every site, every language the studio writes in: Hebrew first)
const RULES = [
  // high: production and developer language that must never reach a visitor
  { id: 'internal', sev: 'high', re: he('תצוגה מקדימה|צילום מצב|(מה|ב)אתר הקיים|האתר החדש|חזית (חדשה )?(לחנות|של)|נתוני הדגמה|\\(טיוטה\\)|טיוטה לאישור|לאישור (הבעלים|עדן)|לא מוצג במנועי חיפוש|הוכן על ידי|כמו שה(ם|ן) (בחנות|באתר)|כפי שה(ם|ן|וא|יא) (מופיע|באתר)|לפי (השמות|שם המוצר) בקטלוג|<S>בקטלוג<E>|מהקטלוג|מנתוני הקטלוג|מדף הבית של (החנות|האתר)|תמונ(ת|ות) (מוצר )?מהחנות|צילום מהאתר|<S>הדמיה<E>|<S>קונספט<E>|<S>מהשטח<E>'), why: 'production or provenance language: where a text or image came from belongs in the project files, not on the page' },
  { id: 'placeholder', sev: 'high', re: /lorem|ipsum|\bTODO\b|\bFIXME\b|\bTBD\b|\bXXX\b|placeholder|\?\?\?|\[\s*(שם|טקסט|תמונה|כותרת)\s*\]|@@/iu, why: 'placeholder or unfinished text' },
  { id: 'dev', sev: 'high', re: /\bundefined\b|\bnull\b|\bNaN\b|\[object |\{\{|\}\}|\$\{|=>|console\.|\bnoindex\b|\bartifact\b|ארטיפקט|\bClaude\b|\bJSON\b|\bAPI\b(?! ?key)/u, why: 'developer or tooling language' },
  // medium: stale data, filler, AI tells, voice
  { id: 'stale-date', sev: 'medium', re: /\b\d{1,2}\.\d{1,2}\.20\d\d\b/u, why: 'a hard-coded date in visitor copy goes stale; state live data without a date, or keep dates to legal "last updated" lines', kinds: /^(text|heading|action|link|aria-label|meta:|title|js)/ },
  { id: 'filler', sev: 'medium', re: he('מגוון רחב|איכות ללא פשרות|חוויה (ייחודית|בלתי נשכחת)|פתרונות? מתקדמ|<S>הכי טוב(ים|ה|ות)?<E>|המובילה? בתחום|ברמה הגבוהה ביותר|<S>מושלמ(ת|ים|ות)?<E>|לכל מטרה|בעולם של היום|לא רק .{2,40} אלא גם|חשוב לציין|יתרה מזאת|בואו נצלול'), why: 'generic filler or a claim nobody can check' },
  { id: 'english-leak', sev: 'medium', test: s => { if (!/[֐-׿]/.test(s)) return null; const w = (s.match(/[A-Za-z][A-Za-z0-9'’-]{2,}/g) || []).filter(x => !latinOk.has(x.toLowerCase())); return w.length ? w.slice(0, 4).join(', ') : null; }, why: 'Latin words inside Hebrew copy that are not brand names or units' },
  // low: typography
  { id: 'glued', sev: 'low', re: /[א-ת][A-Za-z]|[A-Za-z][א-ת]/u, why: 'Hebrew and Latin letters without a space between them' },
  { id: 'space-punct', sev: 'low', re: /\s[,.;:!?](?!\d)|[,;](?=[א-תA-Za-z])/u, why: 'space before punctuation, or none after a comma' },
  { id: 'spelling', sev: 'low', re: he('<S>וורוד(ה|ים|ות)?<E>'), why: 'standard spelling is ורוד (one vav at the start)' },
];
if (voice.address === 'fem-singular' || voice.ctas === 'infinitive') RULES.push({ id: 'voice-plural', sev: 'medium', kinds: /^(action|link|js|aria-label)/, re: he('^(בנו|קנו|הוסיפו|שלחו|בחרו|לחצו|היכנסו|הירשמו|גלו|צפו|קראו|שאלו|כתבו|הזמינו|השאירו|הצטרפו)<E>'), why: 'plural imperative in an action; the site speaks ' + (voice.address === 'fem-singular' ? 'to one woman (את) and names actions with an infinitive or noun' : 'with infinitives or nouns in actions') });
if (voice.address === 'fem-singular') RULES.push({ id: 'voice-masc', sev: 'medium', re: he('^(הוסף|שלח|בחר|לחץ|הירשם|קנה|צפה|גלה|השאר|הזמן|פנה|התקשר)<E>'), kinds: /^(action|link|aria-label|placeholder|js)/, why: 'masculine imperative; the site speaks to one woman (את)' });
for (const b of R.banned || []) RULES.push({ id: 'banned', sev: b.sev || 'high', re: new RegExp(b.re, 'u'), why: b.why || 'banned in this project' });

const findings = [];
for (const s of H.strings) {
  if (allow.has(s.t) || allowRe.some(r => r.test(s.t))) continue;
  for (const r of RULES) {
    if (r.kinds && !r.kinds.test(s.kind)) continue;
    const hit = r.test ? r.test(s.t) : (s.t.match(r.re) || [])[0];
    if (!hit) continue;
    findings.push({ rule: r.id, sev: r.sev, hit: String(hit).slice(0, 60), t: s.t.slice(0, 220), kind: s.kind, where: s.where, pages: s.pages, pageCount: s.pageCount || (s.pages || []).length, visible: s.visible, why: r.why });
  }
}
const order = { high: 0, medium: 1, low: 2 };
findings.sort((x, y) => order[x.sev] - order[y.sev] || y.pageCount - x.pageCount);
const count = findings.reduce((m, f) => (m[f.sev] = (m[f.sev] || 0) + 1, m), { high: 0, medium: 0, low: 0 });
const byRule = findings.reduce((m, f) => (m[f.rule] = (m[f.rule] || 0) + 1, m), {});
const out = { in: a.in, at: new Date().toISOString(), strings: H.strings.length, count, byRule, findings };
const outFile = path.resolve(ROOT, a.out || path.join(path.dirname(a.in), 'lint.json'));
fs.writeFileSync(outFile, JSON.stringify(out, null, 1));
console.log(`copy-lint: ${H.strings.length} strings · high ${count.high} · medium ${count.medium} · low ${count.low} · ` + Object.entries(byRule).map(([k, n]) => `${k} ${n}`).join(', '));
for (const f of findings.filter(f => f.sev !== 'low').slice(0, +(a.show || 25))) console.log(`  [${f.sev}] ${f.rule} «${f.hit}» · ${f.kind} · ${f.pageCount}p · ${f.t.slice(0, 110)}`);
console.log('wrote', path.relative(ROOT, outFile));
const gate = { high: 0, medium: 0, ...(R.gate || {}) };
if (a.gate && (count.high > gate.high || count.medium > gate.medium)) { console.error(`copy gate: FAIL (high ${count.high}/${gate.high}, medium ${count.medium}/${gate.medium})`); process.exit(1); }
