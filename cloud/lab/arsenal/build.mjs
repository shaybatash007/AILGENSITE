#!/usr/bin/env node
// AILGEN Lab · the arsenal, built: every model the lab can call, with its facts (facts.json: read from Cloudflare's pages and schemas),
// its curated profile (knowledge/*.mjs: lineage, power, weakness, jobs, tips, gotchas, Hebrew, the junk verdict), the independent
// measurements (sources/*.json: Artificial Analysis, SpeechMap, EQ-Bench), the lab's own calibration (measured.json) and the
// filter-strictness stars computed from all of it, plus a ranked shortlist per job. Output: lab/arsenal.json (the page, the CLI,
// the director's handbook). Checks run on every build and fail it: a model without a profile, a replacement that is itself junk,
// a reference that is not on its board, a job or source that does not exist.
//   node cloud/lab/arsenal/build.mjs [--check]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url)), ROOT = path.resolve(HERE, '../../..');
const read = f => JSON.parse(fs.readFileSync(path.join(HERE, f), 'utf8'));
const core = await import(path.join(HERE, 'knowledge/core.mjs'));
const parts = await Promise.all(['text', 'image', 'video', 'audio', 'utility'].map(n => import(path.join(HERE, 'knowledge', n + '.mjs'))));
const K = Object.assign({}, ...parts.map(p => Object.values(p)[0]));
const FACTS = read('facts.json').models;
const AA = Object.fromEntries(read('sources/aa-llm.json').rows.map(r => [r.name, r]));
const MEDIA = read('sources/aa-media.json').boards;
const SPEECH = Object.fromEntries(read('sources/speechmap.json').rows.map(r => [r.model, r]));
const EQ = Object.fromEntries(read('sources/eqbench.json').rows.map(r => [r.model, r]));
const MEASURED = fs.existsSync(path.join(HERE, 'measured.json')) ? read('measured.json') : { labels: {}, images: {}, hebrew: {}, notes: {} };
const PAID = JSON.parse(fs.readFileSync(path.join(ROOT, 'lab/paid.json'), 'utf8'));
const FREE = JSON.parse(fs.readFileSync(path.join(ROOT, 'lab/models.json'), 'utf8'));
const { estimate } = await import(path.join(ROOT, 'lab/price.js'));
const PAIDBY = Object.fromEntries(PAID.groups.flatMap(g => Object.values(g.tiers).flat()).map(m => [m.id, m]));
const FREEBY = Object.fromEntries(FREE.models.map(m => [m.name, m]));
const errors = [];

/* ---------- the price of one typical job (core.RULES.typical) ---------- */
const TYPICAL = {
  text: { input: { messages: [{ role: 'user', content: 'x'.repeat(8000) }], max_tokens: 1000 }, opt: { used: { in: 2000, out: 1000 } }, unit: '2,000 טוקנים פנימה ו-1,000 החוצה' },
  image: { input: { prompt: 'a ceramic cup on a table, morning light', width: 1024, height: 1024, size: '1024x1024', aspect_ratio: '1:1' }, opt: {}, unit: 'תמונה של 1024×1024' },
  video: { input: { prompt: 'a ceramic cup on a table, slow push in', duration: 5, resolution: '720p', seconds: 5 }, opt: {}, unit: '5 שניות ב-720p' },
  voice: { input: { text: 'א'.repeat(1000), input: 'א'.repeat(1000) }, opt: {}, unit: '1,000 תווים' },
  listen: { input: { audio: 'https://x/a.mp3' }, opt: { seconds: 600 }, unit: '10 דקות שמע' },
  music: { input: { prompt: 'warm acoustic guitar', duration: 30, music_length_ms: 30000 }, opt: { seconds: 30 }, unit: '30 שניות' },
};
// image models whose Workers AI price is in neurons only (developers.cloudflare.com/workers-ai/platform/pricing): one 1024² image
const FREE_NEURONS = { '@cf/black-forest-labs/flux-2-klein-4b': 105, '@cf/black-forest-labs/flux-2-klein-9b': 1364, '@cf/black-forest-labs/flux-2-dev': 3000, '@cf/black-forest-labs/flux-1-schnell': 57 };
function typicalPrice(id, f) {
  const p = PAIDBY[id];
  if (p) {
    const t = TYPICAL[f.sector] || TYPICAL.text;
    try { const e = estimate(p, t.input, t.opt); return e.usd != null && e.kind !== 'unknown' ? { usd: +e.usd.toFixed(5), kind: e.kind, unit: t.unit } : { usd: null, kind: 'unknown', unit: t.unit }; }
    catch { return { usd: null, kind: 'unknown', unit: t.unit }; }
  }
  // free Workers AI: from the per-model rate (beyond the daily free allocation; inside it the cost is neurons)
  if (FREE_NEURONS[id] != null) return { usd: +(FREE_NEURONS[id] * 0.011 / 1000).toFixed(5), kind: 'free', unit: `תמונה של 1024×1024 (כ-${FREE_NEURONS[id].toLocaleString('en')} נוירונים)` };
  const s = String(f.price || FREEBY[id]?.price || '');
  const tin = s.match(/\$([0-9.]+) per M input tokens/), tout = s.match(/\$([0-9.]+) per M output tokens/);
  if (tin && tout) return { usd: +((2000 * +tin[1] + 1000 * +tout[1]) / 1e6).toFixed(5), kind: 'free', unit: TYPICAL.text.unit };
  if (tin) return { usd: +((2000 * +tin[1]) / 1e6).toFixed(6), kind: 'free', unit: '2,000 טוקנים' };
  const tile = s.match(/\$([0-9.]+) per 512 by 512 tile/), step = s.match(/\$([0-9.]+) per step/);
  if (tile) return { usd: +(4 * +tile[1] + 20 * (step ? +step[1] : 0)).toFixed(4), kind: 'free', unit: 'תמונה של 1024×1024, 20 צעדים' };
  if (/\$0 per step/.test(s)) return { usd: 0, kind: 'free', unit: 'תמונה' };
  const min = s.match(/\$([0-9.]+) per audio minute/); if (min) return { usd: +(10 * +min[1]).toFixed(5), kind: 'free', unit: '10 דקות שמע' };
  const chars = s.match(/\$([0-9.]+) per 1k characters/); if (chars) return { usd: +chars[1], kind: 'free', unit: '1,000 תווים' };
  return { usd: null, kind: 'free', unit: '' };
}

/* ---------- measurements ---------- */
const board = (k, name) => { const b = MEDIA[k]; if (!b || !name) return null; const r = b.rows.find(x => x.name === name); return r ? { ...r, board: k } : null; };
function measurements(m) {
  const r = m.refs || {}, out = {};
  if (r.aa) { const a = AA[r.aa]; if (a) out.aa = { name: a.name, index: a.index != null ? +a.index.toFixed(1) : null, estimated: !!a.estimated, nonHallucination: a.nonHallucination != null ? +a.nonHallucination.toFixed(2) : null, tokensPerSecond: a.tokensPerSecond ? Math.round(a.tokensPerSecond) : null }; else errors.push(`${m.id}: aa ref not found: ${r.aa}`); }
  if (r.cw) { const e = EQ[r.cw]; if (e) out.cw = { model: e.model, elo: e.elo, rank: e.rank, slop: e.slop }; else errors.push(`${m.id}: eqbench ref not found: ${r.cw}`); }
  for (const key of ['speech', 'speechAlt']) if (r[key]) { const s = SPEECH[r[key]]; if (s) out[key] = { model: s.model, complete: s.complete, evasive: s.evasive, denial: s.denial }; else errors.push(`${m.id}: speechmap ref not found: ${r[key]}`); }
  for (const [k, b] of [['t2i', 'textToImage'], ['edit', 'imageEditing'], ['t2v', 'textToVideo'], ['i2v', 'imageToVideo'], ['vedit', 'videoEditing'], ['tts', 'tts']]) if (r[k]) { const x = board(b, r[k]); if (x) out[k] = { name: x.name, elo: x.elo, rank: x.rank, votes: x.votes }; else errors.push(`${m.id}: ${k} ref not found: ${r[k]}`); }
  if (r.stt) { const x = MEDIA.stt.rows.find(y => y.name === r.stt); if (x) out.stt = { name: x.name, wer: x.wer, rank: x.rank }; else errors.push(`${m.id}: stt ref not found: ${r.stt}`); }
  if (r.music) { const i = board('musicInstrumental', r.music), v = board('musicVocals', r.music); if (i || v) out.music = { name: r.music, instrumental: i?.elo ?? null, vocals: v?.elo ?? null }; else errors.push(`${m.id}: music ref not found: ${r.music}`); }
  return out;
}

/* ---------- filter strictness: the stars ---------- */
const speechLevel = c => c >= 90 ? 3 : c >= 75 ? 2 : c >= 60 ? 1 : 0;
const SCORE = { full: 2, soft: 1, refused: 0 };
function calibration(id) {
  const L = MEASURED.labels?.[id]; if (!L) return null;
  const axes = Object.entries(L).filter(([p]) => p !== 'hebrew' && SCORE[L[p]] !== undefined);
  if (axes.length < 5) return null;   // too few answered requests to say anything
  const score = axes.reduce((s, [, v]) => s + SCORE[v], 0), max = axes.length * 2, scaled = score * 14 / max;
  return { score, max, level: scaled >= 13 ? 3 : scaled >= 10 ? 2 : scaled >= 7 ? 1 : 0, labels: L };
}
function imageCalibration(id) {
  const L = MEASURED.images?.[id]; if (!L) return null;
  const vals = Object.values(L), ok = vals.filter(v => v === 'delivered').length;
  return { delivered: ok, of: vals.length, level: ok === vals.length && vals.length >= 2 ? 2 : ok >= 2 ? 1 : 0, labels: L };
}
function stars(m, f, meas) {
  const basis = [];
  if (m.filter && 'n' in m.filter) return { n: m.filter.n, conf: m.filter.conf || 'medium', why: m.filter.why, basis: ['documented'] };
  const sec = f.sector;
  if (sec === 'text') {
    const sp = meas.speech ? speechLevel(meas.speech.complete) : null, cal = calibration(m.id);
    if (sp != null) basis.push('speechmap'); if (cal) basis.push('lab');
    if (sp == null && !cal) return { n: null, conf: 'low', why: 'לא נמדד: אין מודל זה ב-SpeechMap ועוד לא עבר את כיול המעבדה.', basis };
    const n = sp != null && cal ? Math.floor((sp + cal.level) / 2) : sp ?? cal.level;
    const why = [sp != null ? `SpeechMap: ${meas.speech.complete}% תשובות מלאות` : '', cal ? `כיול המעבדה: ${cal.score}/${cal.max}` : ''].filter(Boolean).join(' · ');
    return { n, conf: cal ? 'high' : 'medium', why, basis, calibration: cal || undefined };
  }
  const safety = f.schema?.safety || {};
  const off = Object.entries(safety).find(([k]) => /disable_safety/.test(k));
  if (off) return { n: 3, conf: 'high', why: `${off[0]} במסמך המודל${off[1].def === true ? ' (כבוי כברירת מחדל)' : ''}.`, basis: ['schema'] };
  const tol = safety.safety_tolerance;
  if (tol && tol.max != null) {
    const capped = /capped/i.test(tol.desc || '');
    return { n: tol.max >= 5 && !capped ? 3 : 2, conf: 'high', why: `safety_tolerance עד ${tol.max}${capped ? ', עם תקרה למיניות ולשנאה' : tol.max >= 5 ? ' (המתירני ביותר)' : ' (תקרת היצרן)'}.`, basis: ['schema'] };
  }
  const ic = imageCalibration(m.id);
  if (!ic && !['image', 'video'].includes(sec)) return { n: null, conf: 'low', why: 'לא רלוונטי כאן: המסנן כמעט לא משפיע על קול, תמלול, מוזיקה וכלי עזר; לא נמדד.', basis };
  if (ic) return { n: ic.level, conf: 'high', why: `כיול המעבדה: ${ic.delivered} מתוך ${ic.of} תמונות נמסרו בלי ריכוך.`, basis: ['lab'], calibration: ic };
  return { n: null, conf: 'low', why: 'לא נמדד ואין מתג במסמך.', basis };
}

/* ---------- one profile per model ---------- */
const models = {};
for (const [id, f] of Object.entries(FACTS)) {
  const m = K[id]; if (!m) { errors.push(`${id}: no profile in knowledge/`); continue; }
  m.id = id;
  const meas = measurements(m);
  const fam = core.FAMILIES[m.fam]; if (!fam) errors.push(`${id}: unknown family ${m.fam}`);
  for (const s of m.sources || []) if (!core.SOURCES[s]) errors.push(`${id}: unknown source ${s}`);
  const jobsOf = Object.fromEntries(Object.values(core.JOBS).flatMap(o => Object.entries(o)));
  for (const j of m.jobs || []) if (!jobsOf[j]) errors.push(`${id}: unknown job ${j}`);
  const junk = !!m.junk;
  if (junk) { if (!core.RULES[m.junk]) errors.push(`${id}: unknown rule ${m.junk}`); if (!m.why) errors.push(`${id}: junk without a reason`); }
  else for (const k of ['tier', 'power', 'weak', 'jobs', 'hebrew']) if (!m[k] || (Array.isArray(m[k]) && !m[k].length && k !== 'jobs')) errors.push(`${id}: kept but no ${k}`);
  const p = PAIDBY[id];
  models[id] = {
    id, name: p?.name || id.split('/').pop(), sector: f.sector, paid: f.paid, wai: id.startsWith('@cf/'), live: f.live !== false,
    maker: fam?.name || m.fam, fam: m.fam, released: m.released || f.created || null,
    verdict: junk ? 'junk' : 'keep', tier: junk ? 'junk' : m.tier, keepBy: m.keepBy || null,
    rule: junk ? m.junk : null, instead: m.instead || [], why: m.why || null,
    lineage: m.lineage || null, power: m.power || null, weak: m.weak || null, jobs: m.jobs || [], tips: m.tips || [], gotchas: m.gotchas || [], hebrew: m.hebrew || null,
    price: typicalPrice(id, f),
    caps: { context: f.context || null, ...(f.caps || f.flags || {}), inputs: Object.values(f.schema?.media || {}).map(x => x.kind).filter((v, i, a) => a.indexOf(v) === i), safety: Object.keys(f.schema?.safety || {}), controls: Object.fromEntries(Object.entries(f.schema?.controls || {}).filter(([, v]) => v)) },
    measured: meas,
    stars: null,
    docs: f.docs || null, terms: f.terms || null, sources: (m.sources || []).map(s => s),
  };
  models[id].stars = stars(m, f, meas);
}
for (const m of Object.values(models)) for (const r of m.instead) { if (!models[r]) errors.push(`${m.id}: replacement ${r} is not in the catalog`); else if (models[r].verdict === 'junk') errors.push(`${m.id}: replacement ${r} is itself junk`); }

/* ---------- the shortlist per job ---------- */
const kept = Object.values(models).filter(m => m.verdict === 'keep');
const q = {
  aa: m => m.measured.aa?.index ?? -1, cw: m => m.measured.cw?.elo ?? (m.measured.aa?.index != null ? 1000 + m.measured.aa.index * 10 : -1),
  t2i: m => m.measured.t2i?.elo ?? m.measured.edit?.elo ?? -1, edit: m => m.measured.edit?.elo ?? m.measured.t2i?.elo ?? -1,
  t2v: m => m.measured.t2v?.elo ?? (m.measured.i2v ? m.measured.i2v.elo - 120 : -1), i2v: m => m.measured.i2v?.elo ?? -1, vedit: m => m.measured.vedit?.elo ?? -1,
  tts: m => m.measured.tts?.elo ?? -1, stt: m => m.measured.stt ? -m.measured.stt.wer : -99, music: m => Math.max(m.measured.music?.instrumental ?? -1, m.measured.music?.vocals ?? -1),
  cheap: m => m.price.usd == null ? -1e9 : -m.price.usd, ctx: m => m.caps.context || 0,
  loose: m => (m.stars.n ?? -1) * 1000 + (m.sector === 'text' ? (m.measured.speech?.complete ?? 0) + (m.measured.aa?.index ?? 0) / 100
    : m.sector === 'image' ? (m.measured.t2i?.elo ?? m.measured.edit?.elo ?? 700) / 10 : (m.measured.t2v?.elo ?? (m.measured.i2v ? m.measured.i2v.elo - 120 : 700)) / 10),
};
const RANK = { think: 'aa', write: 'cw', 'copy-he': 'cw', 'plan-json': 'aa', long: 'ctx', code: 'aa', agent: 'aa', research: 'aa', see: 'aa', bulk: 'cheap', judge: 'cheap', loose: 'loose',
  hero: 't2i', edit: 'edit', type: 't2i', vector: 'cheap', mockup: 't2i', style: 't2i', draft: 'cheap', upscale: 'cheap', tryon: 'cheap',
  film: 't2v', i2v: 'i2v', refs: 't2v', sound: 't2v', extend: 't2v', avatar: 'cheap',
  'voice-he': 'tts', 'voice-en': 'tts', acting: 'tts', long_: 'tts', cheap_: 'cheap', 'stt-he': 'stt', 'stt-en': 'stt', speakers: 'stt',
  score: 'music', song: 'music', embed: 'cheap', rerank: 'cheap', guard: 'cheap', inpaint: 'cheap' };
const jobs = {};
for (const [sector, list] of Object.entries(core.JOBS)) for (const [job, text] of Object.entries(list)) {
  const key = (sector === 'video' && job === 'edit') ? 'vedit' : (sector === 'video' && job === 'loose') ? 'loose' : (sector === 'voice' && job === 'long') ? 'tts' : (sector === 'voice' && job === 'cheap') || (sector === 'listen' && job === 'cheap') ? 'cheap' : RANK[job] || 'cheap';
  const pool = kept.filter(m => m.jobs.includes(job) && (sector === 'utility' || m.sector === sector || (sector === 'text' && ['text'].includes(m.sector))));
  const sorted = pool.sort((a, b) => q[key](b) - q[key](a) || (a.price.usd ?? 1e9) - (b.price.usd ?? 1e9));
  jobs[`${sector}:${job}`] = { sector, job, text, by: key, models: sorted.map(m => m.id) };
}

/* ---------- write ---------- */
const count = { total: Object.keys(models).length, keep: kept.length, junk: Object.values(models).filter(m => m.verdict === 'junk').length,
  byRule: Object.fromEntries(Object.keys(core.RULES).filter(k => /^R/.test(k)).map(r => [r, Object.values(models).filter(m => m.rule === r).length])),
  keptByException: kept.filter(m => m.keepBy === 'K').length,
  stars: Object.fromEntries([3, 2, 1, 0].map(n => [n, kept.filter(m => m.stars.n === n).length])), unrated: kept.filter(m => m.stars.n == null).length };
const out = { built: new Date().toISOString(), researched: core.RESEARCHED, count, rules: core.RULES, stars: core.STARS, sources: core.SOURCES, families: core.FAMILIES,
  boards: { aaLLM: read('sources/aa-llm.json').read, media: read('sources/aa-media.json').read, speechmap: read('sources/speechmap.json').read, eqbench: read('sources/eqbench.json').read, lab: MEASURED.at || null },
  jobs, models };
if (errors.length) { console.error(`${errors.length} problems:\n  ${errors.join('\n  ')}`); process.exit(1); }
if (!process.argv.includes('--check')) fs.writeFileSync(path.join(ROOT, 'lab/arsenal.json'), JSON.stringify(out));
console.log(`arsenal: ${count.total} models · kept ${count.keep} (${count.keptByException} by exception) · junk ${count.junk} ${JSON.stringify(count.byRule)}`);
console.log(`stars among the kept: ★★★ ${count.stars[3]} · ★★ ${count.stars[2]} · ★ ${count.stars[1]} · strict ${count.stars[0]} · unrated ${count.unrated}`);
console.log(`jobs: ${Object.keys(jobs).length} · ${process.argv.includes('--check') ? 'checked, not written' : 'lab/arsenal.json ' + Math.round(fs.statSync(path.join(ROOT, 'lab/arsenal.json')).size / 1024) + ' KB'}`);
