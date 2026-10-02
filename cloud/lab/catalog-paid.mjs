#!/usr/bin/env node
// AILGEN Lab's paid catalog, built from Cloudflare's own model catalog (developers.cloudflare.com/ai/models/): every model that
// AI Gateway bills from the credits (all third-party models), with its id, task, description, price list and the exact input
// schema (schema-input.json), so the lab can run each one end to end. Writes:
//   lab/paid.json            the catalog, by sector and tier (cloud/lab/tiers.json holds the tiering rules and the reviewed overrides)
//   lab/schemas/<slug>.json  one input schema per model, loaded when the model is opened in the lab
// Pages are read once and cached in cloud/lab/.cache/ (polite: one request at a time). Free; no credentials.
//   node cloud/lab/catalog-paid.mjs [--refresh]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ensureProxyEnv } from '../../.claude/skills/ailgen-studio/scripts/lib.mjs';
if (ensureProxyEnv()) process.exit(0);

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const CACHE = path.join(ROOT, 'cloud/lab/.cache'), BASE = 'https://developers.cloudflare.com';
const refresh = process.argv.includes('--refresh');
fs.mkdirSync(CACHE, { recursive: true });
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function get(url, file) {
  const f = path.join(CACHE, file);
  if (!refresh && fs.existsSync(f)) return fs.readFileSync(f, 'utf8');
  for (let i = 0; i < 3; i++) {
    const r = await fetch(url, { headers: { accept: 'text/markdown, application/json' } }).catch(() => null);
    if (r && r.ok) { const t = await r.text(); fs.writeFileSync(f, t); await sleep(200); return t; }
    if (r && r.status === 404) return null;
    await sleep(1500 * (i + 1));
  }
  return null;
}

const index = await get(`${BASE}/ai/models/index.md`, 'index.md');
const third = [...new Set([...index.matchAll(/\]\((https:\/\/developers\.cloudflare\.com\/ai\/models\/(?!@cf\/)[a-z0-9.-]+\/[a-z0-9._-]+\/)\)/gi)].map(m => m[1]))];
// and the Workers AI models that need Workers Paid (lab/models.json, from the account's own listing): without that plan they run
// only through the gateway, from the same credits, so they belong to the paid catalog too
const FREE = JSON.parse(fs.readFileSync(path.join(ROOT, 'lab/models.json'), 'utf8'));
const workersPaid = FREE.models.filter(m => m.paid).map(m => `${BASE}/ai/models/${m.name}/`);
const urls = [...third, ...workersPaid];
console.log(`  ${third.length} third-party model pages in the catalog · ${workersPaid.length} Workers AI models that need Workers Paid`);

const parsePrice = md => {
  const row = (md.match(/\|\s*Pricing\s*\|(.*)\|/) || [])[1] || '';
  const list = [...row.matchAll(/<li>(.*?)\$([\d.,]+)<\/li>/g)].map(m => ({ label: m[1].trim(), usd: +m[2].replace(/,/g, '') }));
  if (list.length) return list;
  // a Workers AI page: "| Unit Pricing | $0.95 per M input tokens, $4.00 per M output tokens, $0.16 per M cached input tokens |"
  const unit = (md.match(/\|\s*Unit Pricing\s*\|(.*)\|/) || [])[1] || '';
  const LABEL = { 'input tokens': 'Input (per 1M tokens)', 'output tokens': 'Output (per 1M tokens)', 'cached input tokens': 'Cached input (per 1M tokens)' };
  return [...unit.matchAll(/\$([\d.,]+) per M ([a-z ]+?)(?:,|$)/g)].map(m => ({ label: LABEL[m[2].trim()] || m[2].trim(), usd: +m[1].replace(/,/g, '') }));
};
const SECTOR = t => /Text Generation/i.test(t) ? 'text' : /to-Image|Image-to-Image/i.test(t) ? 'image' : /Video/i.test(t) ? 'video'
  : /Text-to-Speech/i.test(t) ? 'voice' : /Speech Recognition|Voice|websocket/i.test(t) ? 'listen' : /Music/i.test(t) ? 'music' : 'other';

// the page's own examples: each curl call's JSON input (exact JSON, unlike the TypeScript beside it), its title, and the media it made
function examplesOf(md) {
  const list = [], parts = md.split(/--data '(?=\{)/);
  for (let i = 1; i < parts.length && list.length < 4; i++) {
    const end = parts[i].indexOf("\n}'"); if (end < 0) continue;
    let body; try { body = JSON.parse(parts[i].slice(0, end + 2)); } catch { continue; }
    if (!body || typeof body !== 'object') continue;
    if (typeof body.input !== 'object') { const { model, stream, ...rest } = body; body = { input: rest }; }   // an OpenAI-style call: the body is the input
    const before = parts[i - 1], after = parts[i].slice(end);
    const title = (before.match(/<summary>\*\*([^*]+)\*\*(?: — ([^<]+))?<\/summary>[^<]*$/) || [])[1] || (after.match(/^!\[([^\]]+)\]/m) || [])[1] || null;
    const media = (after.match(/!\[[^\]]*\]\((https:\/\/(?:pub-[a-z0-9]+\.r2\.dev|examples\.aig\.cloudflare\.com)\/[^)\s]+)\)/) || [])[1] || (after.match(/"(?:image|video|audio|images|url)":\s*\[?\s*"(https:\/\/(?:pub-[a-z0-9]+\.r2\.dev|examples\.aig\.cloudflare\.com)\/[^"]+\.(?:png|jpe?g|webp|gif|mp4|webm|mp3|wav|ogg|svg))"/) || [])[1] || null;
    if (!/stream/i.test(title || '') && !body.input.stream) list.push({ title, input: body.input, media });
  }
  return list;
}
const models = [];
for (const url of urls) {
  const rel = url.replace(`${BASE}/ai/models/`, '').replace(/\/$/, ''), slug = rel.replace(/^@/, '').replace(/[^a-z0-9.-]+/gi, '__');
  const md = await get(url + 'index.md', slug + '.md');
  if (!md) { console.log('  ✗ no page', rel); continue; }
  const id = (md.match(/^`((?:@cf\/)?[a-z0-9-]+\/[^`]+)`$/m) || [])[1] || rel;
  const title = ((md.match(/^# (.+)$/m) || [])[1] || id).replace(/\\([[\]_*()])/g, '$1');   // the page's markdown escapes: FLUX.2 \[max\]
  const line = (md.match(/^# .+\n\n(.+?) • (.+)$/m) || []);
  const task = line[1] || '', provider = line[2] || id.split('/')[0];
  const description = (md.match(/^description: (.+)$/m) || [])[1] || '';
  const zdr = /Zero data retention \| Yes/.test(md), beta = /^- Beta$/m.test(md);
  const wai = rel.startsWith('@cf/');   // Workers AI pages name their schemas sync-input / sync-output
  const schemaTxt = await get(url + (wai ? 'sync-input.json' : 'schema-input.json'), slug + '.input.json');
  const outTxt = await get(url + (wai ? 'sync-output.json' : 'schema-output.json'), slug + '.output.json');
  let schema = null, out = null;
  try { schema = JSON.parse(schemaTxt); } catch {}
  try { out = JSON.parse(outTxt); } catch {}
  models.push({ id, slug, title, task, sector: SECTOR(task), provider, description, zdr, beta, price: parsePrice(md), schema, out, examples: examplesOf(md) });
}
console.log(`  ${models.length} models read · ${models.filter(m => m.schema).length} with an input schema`);

// tiers: the arsenal decides (cloud/lab/arsenal/knowledge/: a measured quality band per sector, or the junk pool with its rule);
// a model the arsenal does not know yet falls back to the reviewed list in tiers.json, then to the rule (flagship words → top, light words → low)
const T = JSON.parse(fs.readFileSync(path.join(ROOT, 'cloud/lab/tiers.json'), 'utf8'));
const KN = Object.assign({}, ...(await Promise.all(['text', 'image', 'video', 'audio', 'utility'].map(n => import(path.join(ROOT, 'cloud/lab/arsenal/knowledge', n + '.mjs'))))).map(x => Object.values(x)[0]));
const AR = fs.existsSync(path.join(ROOT, 'lab/arsenal.json')) ? JSON.parse(fs.readFileSync(path.join(ROOT, 'lab/arsenal.json'), 'utf8')).models : {};
const quality = id => { const q = AR[id]?.measured || {}; return q.aa?.index ?? (q.t2i ? q.t2i.elo / 25 : q.edit ? q.edit.elo / 25 : q.t2v ? q.t2v.elo / 25 : q.i2v ? (q.i2v.elo - 120) / 25 : q.tts ? q.tts.elo / 25 : q.stt ? 60 - q.stt.wer : q.music ? 40 : 0); };
const tierOf = m => { const k = KN[m.id]; if (k) return k.junk ? 'junk' : (k.tier === 'free' ? 'low' : k.tier); return T.override[m.id] || ruleTier(m); };
const ruleTier = m => {
  const n = m.id.toLowerCase();
  if (T.low.some(w => n.includes(w))) return 'low';
  if (T.top.some(w => n.includes(w))) return 'top';
  return 'mid';
};
// a schema's variants: the top level itself, or each branch of a top-level oneOf / anyOf
const variants = s => !s ? [] : [s, ...(s.oneOf || []), ...(s.anyOf || [])].filter(v => v && v.properties);
const outKind = m => {   // what comes back, by the sector first (a chat model's output schema mentions "audio" as an optional part)
  if (m.sector === 'text') return 'text';
  if (m.sector === 'listen') return 'text';
  if (m.sector === 'voice' || m.sector === 'music') return 'audio';
  if (m.sector === 'video') return 'video';
  if (m.sector === 'image') return 'image';
  const p = JSON.stringify(m.out || {});
  return /"video"/.test(p) ? 'video' : /"images?"/.test(p) ? 'image' : /"audio"/.test(p) ? 'audio' : 'text';
};
const shape = s => {   // how the lab talks to the model: chat formats get one shared form, the rest a form from the schema
  const vs = variants(s), has = k => vs.find(v => v.properties[k]);
  const msg = vs.filter(v => v.properties.messages);
  if (msg.some(v => v.properties.max_completion_tokens || !v.properties.system)) return 'chat';
  if (msg.length) return 'anthropic';
  if (has('contents')) return 'gemini';
  const r = has('input');
  if (r && !r.properties.prompt && (r.properties.instructions || r.properties.max_output_tokens)) return 'responses';
  return 'schema';
};
fs.mkdirSync(path.join(ROOT, 'lab/schemas'), { recursive: true });
const SECTORS = [['text', 'טקסט'], ['image', 'תמונה'], ['video', 'וידאו'], ['voice', 'הקראה'], ['listen', 'תמלול וקול'], ['music', 'מוזיקה'], ['other', 'אחר']];
const groups = SECTORS.map(([id, title]) => ({ id, title, tiers: { top: [], mid: [], low: [], junk: [] } }));
for (const m of models) {
  const tier = tierOf(m), g = groups.find(x => x.id === m.sector), k = KN[m.id];
  if (m.schema) fs.writeFileSync(path.join(ROOT, 'lab/schemas', m.slug + '.json'), JSON.stringify({ id: m.id, shape: shape(m.schema), schema: m.schema, examples: m.examples }));
  // a model the lab cannot run in one request (a realtime WebSocket session) is listed, marked, and never sent
  const live = !(m.schema && m.schema.properties && Object.keys(m.schema.properties).join() === 'websocket');
  g.tiers[tier].push({ id: m.id, slug: m.slug, sector: m.sector, name: m.title, provider: m.id.startsWith('@cf/') ? 'Workers AI' : m.provider, wai: m.id.startsWith('@cf/'), live, task: m.task, about: m.description.slice(0, 220), price: m.price, zdr: m.zdr, beta: m.beta, out: outKind(m), shape: shape(m.schema), note: k && k.junk ? null : T.notes[m.id] || null, junk: k && k.junk ? { rule: k.junk, why: k.why, instead: k.instead || [] } : null, keepBy: k && k.keepBy || null, hasSchema: !!m.schema, cover: /vector/.test(m.id) ? null : (m.examples.find(x => x.media && /\.(png|jpe?g|webp|gif)$/.test(x.media)) || {}).media || null, demo: (m.examples.find(x => x.media && /\.(mp4|webm)$/.test(x.media)) || {}).media || null });
}
// inside a tier, the stronger first: the measured quality (the arsenal's boards), then the price (the provider's own positioning)
const top = p => Math.max(0, ...p.map(x => x.usd));
for (const g of groups) for (const k of ['top', 'mid', 'low', 'junk']) g.tiers[k].sort((a, b) => quality(b.id) - quality(a.id) || top(b.price) - top(a.price) || a.name.localeCompare(b.name));
const out = { checked: new Date().toISOString().slice(0, 10), source: `${BASE}/ai/models/`, creditFee: 0.05, count: models.length, tiersWhy: T.why, groups: groups.filter(g => Object.values(g.tiers).some(l => l.length)) };
fs.writeFileSync(path.join(ROOT, 'lab/paid.json'), JSON.stringify(out, null, 1));
for (const g of out.groups) console.log(`  ${g.id.padEnd(7)} top ${g.tiers.top.length} · mid ${g.tiers.mid.length} · low ${g.tiers.low.length} · junk ${g.tiers.junk.length}`);
