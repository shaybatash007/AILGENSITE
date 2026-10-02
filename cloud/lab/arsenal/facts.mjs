#!/usr/bin/env node
// AILGEN Lab · the arsenal's facts: what Cloudflare publishes about every model the lab can call (the 171 paid models of
// lab/paid.json and the free Workers AI models of lab/models.json), read from each model's page and its input and output schema.
// Machine-made and checkable: every field here comes from a page or a schema, never from memory. The curated half of each
// profile (lineage, strengths, weaknesses, filter strictness) is cloud/lab/arsenal/knowledge.json; build.mjs joins the two.
//   node cloud/lab/arsenal/facts.mjs [--refresh]     → cloud/lab/arsenal/facts.json
// Pages are read once into cloud/lab/.cache/ (polite: one request at a time, a pause between them).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ensureProxyEnv } from '../../../.claude/skills/ailgen-studio/scripts/lib.mjs';
if (ensureProxyEnv()) process.exit(0);

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const CACHE = path.join(ROOT, 'cloud/lab/.cache'), BASE = 'https://developers.cloudflare.com/ai/models';
const refresh = process.argv.includes('--refresh');
const { variantsOf, field, deref } = await import(path.join(ROOT, 'lab/schema.js'));
const sleep = ms => new Promise(r => setTimeout(r, ms));
fs.mkdirSync(CACHE, { recursive: true });

async function get(url, file) {
  const f = path.join(CACHE, file);
  if (!refresh && fs.existsSync(f) && fs.statSync(f).size) return fs.readFileSync(f, 'utf8');
  for (let i = 0; i < 3; i++) {
    const r = await fetch(url, { headers: { accept: 'text/markdown, application/json' } }).catch(() => null);
    if (r && r.ok) { const t = await r.text(); fs.writeFileSync(f, t); await sleep(250); return t; }
    if (r && r.status === 404) return null;
    await sleep(1500 * (i + 1));
  }
  return null;
}
const json = t => { try { return JSON.parse(t); } catch { return null; } };

/* ---------- the models ---------- */
const PAID = JSON.parse(fs.readFileSync(path.join(ROOT, 'lab/paid.json'), 'utf8'));
const FREE = JSON.parse(fs.readFileSync(path.join(ROOT, 'lab/models.json'), 'utf8'));
const SECTOR_OF_TASK = t => /Text Generation/i.test(t) ? 'text' : /to-Image|Image-to-Image/i.test(t) ? 'image' : /Video/i.test(t) ? 'video'
  : /Text-to-Speech/i.test(t) ? 'voice' : /Speech Recognition|Voice|websocket/i.test(t) ? 'listen' : /Music/i.test(t) ? 'music'
  : /Embedding/i.test(t) ? 'embed' : /Translation/i.test(t) ? 'translate' : /Image-to-Text|Image Classification/i.test(t) ? 'vision' : /Classification/i.test(t) ? 'classify' : 'other';
const list = [];
for (const g of PAID.groups) for (const [tier, ms] of Object.entries(g.tiers)) for (const m of ms) list.push({ id: m.id, slug: m.slug, paid: true, sector: g.id, tier, provider: m.provider, task: m.task, price: m.price, zdr: m.zdr, beta: m.beta, live: m.live !== false });
for (const m of FREE.models) if (!m.paid) list.push({ id: m.name, slug: m.name.replace(/^@/, '').replace(/[^a-z0-9.-]+/gi, '__'), paid: false, sector: SECTOR_OF_TASK(m.task), tier: 'free', provider: 'Workers AI', task: m.task, price: m.price, beta: m.beta, how: m.how, created: m.created, context: m.context, terms: m.terms, measured: m.note || null,
  flags: { vision: !!m.vision, reasoning: !!m.reasoning, tools: !!m.tools } });
// the account listing's flags for the Workers AI models that need Workers Paid (they are in the paid catalog too)
const WAI = Object.fromEntries(FREE.models.map(m => [m.name, m]));
for (const m of list) if (m.paid && WAI[m.id]) Object.assign(m, { created: WAI[m.id].created, flags: { vision: !!WAI[m.id].vision, reasoning: !!WAI[m.id].reasoning, tools: !!WAI[m.id].tools } });

/* ---------- a page: description, feature tags, the model-info table ---------- */
function page(md) {
  if (!md) return {};
  const fm = (md.match(/^description: (.+)$/m) || [])[1] || '';
  const after = md.split(/^`[^`]+`$/m)[1] || '';
  const tags = [...after.split('\n## ')[0].matchAll(/^- (.+)$/gm)].map(m => m[1].trim()).filter(t => t.length < 40);
  const info = {};
  for (const m of md.matchAll(/^\| ([^|]+?)\s*(?:\[ ?↗\]\([^)]*\))?\s*\| (.+?) \|$/gm)) {
    const k = m[1].replace(/\[.*$/, '').trim(), v = m[2].trim();
    if (!k || /^(Model Info|---)/.test(k) || k.length > 40) continue;
    info[k] = v;
  }
  const link = v => (String(v || '').match(/\]\((https?:[^)]+)\)/) || [])[1] || null;
  const paidOnly = /Paid access required|not available through standard Workers Free/i.test(md);
  const ctx = info['Context Window'] ? +String(info['Context Window']).replace(/[^\d]/g, '') || null : null;
  return { description: fm, tags, context: ctx, terms: link(info['Terms and License']), docs: link(info['More information']), formats: info['Request formats'] || null,
    reasoningInfo: info.Reasoning || null, paidOnly, unitPricing: info['Unit Pricing'] || null };
}

/* ---------- a schema: every field, the media it takes, the controls it offers ---------- */
const SAFETY = /safety|moderation|nsfw|content_filter|content_moderation|guardrail|safe_mode|watermark|sensitive|person_generation|allow_people/i;
function schemaFacts(s, sector) {
  if (!s || typeof s !== 'object') return null;
  const vs = variantsOf(s), root = s, txt = JSON.stringify(s);
  const fields = {}, media = {}, safety = {};
  for (const v of vs) for (const [k, d0] of Object.entries(v.properties || {})) {
    if (fields[k]) continue;
    const d = deref(d0, root), f = field(k, d0, root, sector), alts = (d.anyOf || d.oneOf || []).map(x => deref(x, root));
    const rng = src => ({ min: src.minimum, max: src.maximum });
    const num = [d, ...alts].find(x => x && (x.minimum != null || x.maximum != null)) || {};
    fields[k] = { t: f.t, req: vs.every(x => (x.required || []).includes(k)), ...(f.def !== undefined ? { def: f.def } : {}), ...(f.options ? { options: f.options.slice(0, 40) } : {}),
      ...(num.minimum != null || num.maximum != null ? rng(num) : {}), ...(d.maxLength ? { maxLength: d.maxLength } : {}), desc: String(f.desc || '').replace(/\s+/g, ' ').slice(0, 220) };
    if (f.t === 'media') media[k] = { kind: f.accept.split('/')[0], multi: !!f.multi, max: f.max, b64: !!f.b64 };
    if (SAFETY.test(k) || /safety|moderat|nsfw/i.test(String(f.desc || ''))) safety[k] = { t: f.t, ...(f.options ? { options: f.options } : {}), ...(num.minimum != null || num.maximum != null ? rng(num) : {}), ...(f.def !== undefined ? { def: f.def } : {}), desc: String(f.desc || '').slice(0, 220) };
  }
  const pick = re => Object.entries(fields).filter(([k]) => re.test(k));
  const opts = re => { const p = pick(re).find(([, f]) => f.options); return p ? p[1].options : null; };
  const range = re => { const p = pick(re).find(([, f]) => f.min != null || f.max != null); return p ? { min: p[1].min, max: p[1].max } : null; };
  const msgItem = /"image_url"|"input_image"|"inlineData"|"inline_data"|\{"type":"string","enum":\["image"\]|"const":"image"/.test(txt);
  return {
    variants: vs.map(v => v.title || Object.entries(v.properties).filter(([, d]) => d && d.const !== undefined).map(([k, d]) => `${k}=${d.const}`).join(',') || null).filter(Boolean),
    fields, media, safety,
    controls: {
      aspect: opts(/^(aspect_ratio|ratio)$/), size: opts(/^(size|image_size|output_size)$/), resolution: opts(/^(resolution|output_resolution|quality)$/),
      duration: opts(/^duration$/) || range(/^(duration|seconds)$/), fps: opts(/^fps$/) || range(/^fps$/), count: range(/^(n|num_images|max_images|batch_size|num_outputs)$/),
      seed: !!pick(/^seed$/).length, negative: !!pick(/^negative_prompt$/).length, audio: !!pick(/^(generate_audio|audio|with_audio)$/).length,
      voice: opts(/^(voice|voice_id)$/), language: opts(/^(language|language_code|lang)$/), format: opts(/^(output_format|format|response_format)$/),
      steps: range(/^(steps|num_inference_steps)$/), guidance: range(/^(guidance|guidance_scale|cfg)$/),
    },
    chat: fields.messages || fields.contents || (fields.input && !fields.prompt) ? {
      tools: /"tools"/.test(txt), json: /"json_schema"|"response_format"|"responseMimeType"|"output_format"/.test(txt), reasoning: /reasoning_effort|"thinking"|"reasoning"|thinkingConfig|"effort"/.test(txt),
      vision: msgItem, audioIn: /"input_audio"|"audio\/|"inlineData"/.test(txt) && /audio/.test(txt), webSearch: /web_search|google_search|"search"/.test(txt),
      maxOut: Math.max(0, ...pick(/^(max_tokens|max_completion_tokens|max_output_tokens|maxOutputTokens)$/).map(([, f]) => f.max || 0)) || null,
      temperature: range(/^temperature$/),
    } : null,
  };
}
function outFacts(s) {
  if (!s) return null;
  const txt = JSON.stringify(s);
  return { url: /"format":"uri"|https?:/.test(txt), base64: /base64|"format":"byte"|\^data:/.test(txt), keys: Object.keys((s.properties || (s.oneOf || s.anyOf || [{}])[0].properties || {})).slice(0, 20),
    citations: /citations/.test(txt), usage: /"usage"/.test(txt), async: /"task_id"|"status"|"queued"|"running"/.test(txt) };
}

/* ---------- run ---------- */
const out = {};
let fetched = 0;
for (const m of list) {
  const rel = m.id;
  const md = await get(`${BASE}/${rel}/index.md`, m.slug + '.md');
  let ins = null, outs = null;
  if (m.paid) ins = (json(fs.readFileSync(path.join(ROOT, 'lab/schemas', m.slug + '.json'), 'utf8')) || {}).schema || null;
  // the schema's file name is on the page (schema-input.json, or sync-input.json for the newer Workers AI pages)
  const linked = kind => ((md || '').match(new RegExp(`/(${kind === 'in' ? 'sync-input|schema-input' : 'sync-output|schema-output'})\\.json\\)`)) || [])[1];
  const inName = linked('in') || (m.id.startsWith('@cf/') ? 'sync-input' : 'schema-input'), outName = linked('out') || (m.id.startsWith('@cf/') ? 'sync-output' : 'schema-output');
  const cachedIn = path.join(CACHE, m.slug + '.input.json');
  if (!ins) ins = json(fs.existsSync(cachedIn) && fs.statSync(cachedIn).size ? fs.readFileSync(cachedIn, 'utf8') : await get(`${BASE}/${rel}/${inName}.json`, m.slug + '.input.json'));
  outs = json(await get(`${BASE}/${rel}/${outName}.json`, m.slug + '.output.json'));
  const p = page(md);
  const sf = schemaFacts(ins, m.sector);
  // what the model can do, from every source that says it: the page's tags, the account listing, the schema
  const caps = { vision: !!(m.flags && m.flags.vision) || (p.tags || []).includes('Vision') || !!(sf && sf.chat && sf.chat.vision),
    reasoning: !!(m.flags && m.flags.reasoning) || (p.tags || []).includes('Reasoning') || !!(sf && sf.chat && sf.chat.reasoning),
    tools: !!(m.flags && m.flags.tools) || (p.tags || []).includes('Function calling') || !!(sf && sf.chat && sf.chat.tools),
    json: !!(sf && sf.chat && sf.chat.json), batch: (p.tags || []).includes('Batch'), zdr: !!m.zdr || (p.tags || []).includes('Zero data retention'),
    openWeights: /huggingface\.co|apache|mit-license|llama|gemma|github\.com/i.test(String(p.terms || m.terms || '')) };
  out[m.id] = { ...m, ...p, context: p.context || m.context || null, caps, schema: sf, output: outFacts(outs), hasPage: !!md };
  fetched++;
  if (fetched % 25 === 0) console.log(`  ${fetched}/${list.length}`);
}
fs.mkdirSync(path.join(ROOT, 'cloud/lab/arsenal'), { recursive: true });
fs.writeFileSync(path.join(ROOT, 'cloud/lab/arsenal/facts.json'), JSON.stringify({ at: new Date().toISOString().slice(0, 10), count: list.length, models: out }, null, 1));
const noPage = Object.values(out).filter(m => !m.hasPage).map(m => m.id), noSchema = Object.values(out).filter(m => !m.schema).map(m => m.id);
console.log(`  facts for ${list.length} models · no page: ${noPage.length}${noPage.length ? ' (' + noPage.join(', ') + ')' : ''} · no input schema: ${noSchema.length}${noSchema.length ? ' (' + noSchema.join(', ') + ')' : ''}`);
