#!/usr/bin/env node
// AILGEN Lab · the arsenal's independent measurements: snapshots of the public boards the profiles cite, trimmed to the rows the
// catalog uses (plus each board's top 10, for context), so build.mjs can show real numbers without calling anyone at run time.
//   node cloud/lab/arsenal/sources.mjs                  download the boards now (one request at a time) and rewrite sources/*.json
//   node cloud/lab/arsenal/sources.mjs --from <dir>     parse pages already saved in <dir> (same file names as below)
// Boards: Artificial Analysis (LLM index, image/video/voice/music arenas, speech-to-text error rate), SpeechMap (how often a model
// answers controversial-speech requests in full), EQ-Bench Creative Writing v3. Each snapshot records where and when it was read.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ensureProxyEnv } from '../../../.claude/skills/ailgen-studio/scripts/lib.mjs';
if (ensureProxyEnv()) process.exit(0);

const HERE = path.dirname(fileURLToPath(import.meta.url)), OUT = path.join(HERE, 'sources');
const arg = k => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : null; };
const FROM = arg('from');
const sleep = ms => new Promise(r => setTimeout(r, ms));
const PAGES = {
  'aa-models.html': 'https://artificialanalysis.ai/leaderboards/models',
  'image_leaderboard_text-to-image.html': 'https://artificialanalysis.ai/image/leaderboard/text-to-image',
  'image_leaderboard_editing.html': 'https://artificialanalysis.ai/image/leaderboard/editing',
  'video_leaderboard_text-to-video.html': 'https://artificialanalysis.ai/video/leaderboard/text-to-video',
  'video_leaderboard_image-to-video.html': 'https://artificialanalysis.ai/video/leaderboard/image-to-video',
  'video_leaderboard_video-editing.html': 'https://artificialanalysis.ai/video/leaderboard/video-editing',
  'text-to-speech_leaderboard.html': 'https://artificialanalysis.ai/text-to-speech/leaderboard/provider-voice',
  'music_leaderboard_instrumental.html': 'https://artificialanalysis.ai/music/leaderboard/instrumental',
  'music.html': 'https://artificialanalysis.ai/music/leaderboard/vocals',
  'speech-to-text.html': 'https://artificialanalysis.ai/speech-to-text/non-streaming',
  'speechmap-models.html': 'https://speechmap.ai/models/',
  'eq-cw.js': 'https://eqbench.com/creative_writing.js',
};

async function page(file) {
  if (FROM) return fs.readFileSync(path.join(FROM, file), 'utf8');
  const r = await fetch(PAGES[file], { headers: { 'user-agent': 'Mozilla/5.0 (AILGEN Lab arsenal; one request per board)' } });
  if (!r.ok) throw new Error(`${PAGES[file]} → HTTP ${r.status}`);
  const t = await r.text(); await sleep(1200); return t;
}
const num = v => v == null || v === 'null' || /^"\$/.test(v) ? null : /^"/.test(v) ? v.slice(1, -1) : v === 'true' ? true : v === 'false' ? false : +v;

/* ---------- Artificial Analysis, LLM leaderboard (Next.js flight data) ---------- */
function aaLLM(html) {
  const s = html.replace(/\\"/g, '"'), rows = {};
  const re = /\{"slug":"([^"]+)","name":"([^"]+)","shortName":"[^"]*","deprecated":(true|false),"isReasoning":(true|false),"isOpenWeights":(true|false),/g;
  let m;
  while ((m = re.exec(s))) {
    if (rows[m[2]]) continue;
    const end = s.indexOf('{"slug":', re.lastIndex), chunk = s.slice(m.index, end > 0 ? end : m.index + 6000);
    const g = k => { const x = chunk.match(new RegExp(`"${k}":(null|"[^"]*"|-?[0-9.eE+-]+|true|false)`)); return x ? num(x[1]) : null; };
    rows[m[2]] = { name: m[2], creator: g('modelCreatorName'), deprecated: m[3] === 'true', open: m[5] === 'true', context: g('contextWindowTokens'),
      index: g('intelligenceIndex'), estimated: g('intelligenceIndexIsEstimated'), nonHallucination: g('omniscienceNonHallucination'), gpqa: g('gpqa'), hle: g('hle'),
      priceIn: g('price1mInputTokens'), priceOut: g('price1mOutputTokens'), tokensPerSecond: g('medianOutputTokensPerSecond'), firstToken: g('medianTimeToFirstTokenSeconds') };
  }
  return Object.values(rows);
}
/* ---------- Artificial Analysis arenas ---------- */
function arena(html) {
  const s = html.replace(/\\"/g, '"'), out = [], seen = new Set();
  const re = /"values":\{"id":"[^"]+","name":"([^"]+)"/g; let m;
  while ((m = re.exec(s))) {
    if (seen.has(m[1])) continue; seen.add(m[1]);
    const chunk = s.slice(m.index, m.index + 1500);
    const g = k => { const x = chunk.match(new RegExp(`"${k}":(null|"[^"]*"|-?[0-9.eE+-]+)`)); return x ? num(x[1]) : null; };
    const creator = (chunk.match(/"creator":\{"id":"[^"]+","name":"([^"]+)"/) || [])[1] || '';
    const price = (chunk.match(/"price[A-Za-z0-9]*":([0-9.]+)/) || [])[1];
    const elo = g('elo'); if (elo == null) continue;
    out.push({ name: m[1], creator, elo: Math.round(elo * 10) / 10, votes: g('appearances'), released: g('releaseDate'), ci: g('ciDelta'), price: price ? +price : null });
  }
  return out.sort((a, b) => b.elo - a.elo).map((r, i) => ({ rank: i + 1, ...r }));
}
const strip = h => h.replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/&#x27;|&#39;/g, "'").replace(/&quot;/g, '"').replace(/\s+/g, ' ').trim();
function stt(html) {
  const out = [];
  for (const tr of html.match(/<tr class="border-b[^"]*">[\s\S]*?<\/tr>/g) || []) {
    const c = [...tr.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map(x => strip(x[1]));
    if (c.length >= 6 && /%$/.test(c[3])) out.push({ name: c[0], provider: c[1], wer: +c[3].slice(0, -1), speedFactor: +c[4] || null, usdPer1000Minutes: +c[5] || 0 });
  }
  return out.sort((a, b) => a.wer - b.wer).map((r, i) => ({ rank: i + 1, ...r }));
}
/* ---------- SpeechMap ---------- */
function speechmap(html) {
  const out = [];
  const re = /<a href="\/models\/[^/]+\/">([^<]+)<\/a><\/td><td class="td-meta">([^<]*)<\/td><td class="td-num td-complete">[0-9.]+%<\/td><td class="td-bar"><span class="verdict-bar" title="Complete ([0-9.]+)% · Evasive ([0-9.]+)% · Denial ([0-9.]+)% · Error ([0-9.]+)%"/g;
  let m; while ((m = re.exec(html))) out.push({ model: m[1], released: m[2], complete: +m[3], evasive: +m[4], denial: +m[5], error: +m[6] });
  return out.sort((a, b) => b.complete - a.complete).map((r, i) => ({ rank: i + 1, ...r }));
}
/* ---------- EQ-Bench Creative Writing v3 ---------- */
function eqbench(js) {
  const csv = (js.match(/leaderboardDataCreativeWritingV3 = `\n([\s\S]*?)`/) || [])[1] || '';
  return csv.trim().split('\n').slice(1).map(l => l.split(',')).filter(p => p.length >= 7)
    .map(p => ({ model: p[0].replace(/^\*/, ''), elo: +p[1], score: +p[2], length: Math.round(+p[3]), slop: +p[5], repetition: +p[6] }))
    .sort((a, b) => b.elo - a.elo).map((r, i) => ({ rank: i + 1, ...r }));
}

/* ---------- which rows the catalog uses ---------- */
const parts = await Promise.all(['text', 'image', 'video', 'audio', 'utility'].map(n => import(path.join(HERE, 'knowledge', n + '.mjs'))));
const K = Object.assign({}, ...parts.map(p => Object.values(p)[0]));
const want = { aa: new Set(), t2i: new Set(), edit: new Set(), t2v: new Set(), i2v: new Set(), vedit: new Set(), tts: new Set(), stt: new Set(), music: new Set(), speech: new Set(), cw: new Set() };
for (const m of Object.values(K)) for (const [k, v] of Object.entries(m.refs || {})) { if (k === 'speechAlt') want.speech.add(v); else if (want[k]) want[k].add(v); }
const keep = (rows, key, set, top = 10) => rows.filter((r, i) => i < top || set.has(r[key]));
const today = new Date().toISOString().slice(0, 10);
const write = (file, url, rows, about) => { fs.mkdirSync(OUT, { recursive: true }); fs.writeFileSync(path.join(OUT, file), JSON.stringify({ read: today, url, about, rows }, null, 1)); console.log(`  ${file.padEnd(22)} ${rows.length} rows`); };

const aa = aaLLM(await page('aa-models.html'));
// the top 10 by index among current models, plus every row a profile names
const aaTop = aa.filter(r => !r.deprecated && r.index != null).sort((a, b) => b.index - a.index).slice(0, 10).map(r => r.name);
write('aa-llm.json', PAGES['aa-models.html'], aa.filter(r => want.aa.has(r.name) || aaTop.includes(r.name)).sort((a, b) => (b.index || 0) - (a.index || 0)),
  'Artificial Analysis Intelligence Index v4.1 (higher is smarter), price per million tokens, output speed, non-hallucination rate (share of unknown questions answered with "I don\'t know" instead of an invention)');
const boards = {};
for (const [k, file, set] of [['textToImage', 'image_leaderboard_text-to-image.html', want.t2i], ['imageEditing', 'image_leaderboard_editing.html', want.edit],
  ['textToVideo', 'video_leaderboard_text-to-video.html', want.t2v], ['imageToVideo', 'video_leaderboard_image-to-video.html', want.i2v],
  ['videoEditing', 'video_leaderboard_video-editing.html', want.vedit], ['tts', 'text-to-speech_leaderboard.html', want.tts],
  ['musicInstrumental', 'music_leaderboard_instrumental.html', want.music], ['musicVocals', 'music.html', want.music]]) boards[k] = { url: PAGES[file], rows: keep(arena(await page(file)), 'name', set) };
boards.stt = { url: PAGES['speech-to-text.html'], rows: keep(stt(await page('speech-to-text.html')), 'name', want.stt) };
fs.mkdirSync(OUT, { recursive: true });
fs.writeFileSync(path.join(OUT, 'aa-media.json'), JSON.stringify({ read: today, about: 'Artificial Analysis arenas: Elo from blind human preference votes (higher is better; compare only inside one board). stt: word error rate % (lower is better).', boards }, null, 1));
console.log(`  aa-media.json          ${Object.entries(boards).map(([k, b]) => k + ' ' + b.rows.length).join(', ')}`);
write('speechmap.json', PAGES['speechmap-models.html'], keep(speechmap(await page('speechmap-models.html')), 'model', want.speech),
  'SpeechMap: share of controversial-speech requests answered in full (complete), evasively, or refused (denial). Higher complete = less filtered.');
write('eqbench.json', 'https://eqbench.com/creative_writing.html', keep(eqbench(await page('eq-cw.js')), 'model', want.cw),
  'EQ-Bench Creative Writing v3: Elo from pairwise judging of creative writing (higher is better); slop = over-used AI phrasing (lower is better).');
// every ref must exist in its board, or the profile shows nothing
const have = { aa: new Set(aa.map(r => r.name)), speech: new Set(JSON.parse(fs.readFileSync(path.join(OUT, 'speechmap.json'))).rows.map(r => r.model)), cw: new Set(JSON.parse(fs.readFileSync(path.join(OUT, 'eqbench.json'))).rows.map(r => r.model)) };
const media = { t2i: 'textToImage', edit: 'imageEditing', t2v: 'textToVideo', i2v: 'imageToVideo', vedit: 'videoEditing', tts: 'tts', stt: 'stt' };
const misses = [];
for (const [id, m] of Object.entries(K)) for (const [k, v] of Object.entries(m.refs || {})) {
  const ok = k === 'aa' ? have.aa.has(v) : k === 'speech' || k === 'speechAlt' ? have.speech.has(v) : k === 'cw' ? have.cw.has(v)
    : k === 'music' ? boards.musicInstrumental.rows.some(r => r.name === v) || boards.musicVocals.rows.some(r => r.name === v) : boards[media[k]]?.rows.some(r => r.name === v);
  if (!ok) misses.push(`${id} ${k}=${v}`);
}
console.log(misses.length ? `\n${misses.length} refs not found on their board:\n  ${misses.join('\n  ')}` : '\nevery ref found on its board');
