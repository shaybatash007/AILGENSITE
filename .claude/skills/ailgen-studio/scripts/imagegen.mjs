#!/usr/bin/env node
// The visual system, step 1: generate candidate images for a project's concepts (projects/<slug>/visual/concepts.json).
//   node imagegen.mjs --project projects/<slug> --probe                         check the key and list the image/video models it can use
//   node imagegen.mjs --project projects/<slug> --concept atelier [--ratio 4:5] [--n 4] [--tier draft|final] [--brand thuya] [--dry]
//   node imagegen.mjs --project projects/<slug> --concept all --tier draft      every concept, every ratio (within the budget)
// Providers: gemini (default; GEMINI_API_KEY), openai (--provider openai; OPENAI_API_KEY), stub (--provider stub: a code-drawn
// plate rendered locally, only to test the pipeline end to end; never approvable for the site).
// Rules (references/12-visual-production.md): no product, logo, text, face or result is ever generated; the prompt carries the
// concept, the house style and the project's never-list. Every file gets a sidecar with provider, model, prompt, time and cost,
// and a line in visual/ledger.jsonl. The budget in concepts.json is a hard cap. A 429 or 5xx waits and retries at most four
// times (2, 4, 8, 16 s), then stops: never hammer a provider. Candidates wait for review (image-review.mjs); nothing reaches
// the site without an approval.
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { parseArgs, repoRoot, ensureProxyEnv } from './lib.mjs';
if (ensureProxyEnv()) process.exit(0);
const a = parseArgs(), ROOT = repoRoot();
if (!a.project) { console.error('usage: node imagegen.mjs --project projects/<slug> (--probe | --concept <id|all>) [--ratio r] [--n k] [--tier draft|final] [--brand key] [--provider gemini|openai|stub] [--dry]'); process.exit(2); }
const PROJ = path.resolve(ROOT, a.project), VIS = path.join(PROJ, 'visual');
const CFG = JSON.parse(fs.readFileSync(path.join(VIS, 'concepts.json'), 'utf8'));
const PROVIDER = a.provider || 'gemini', TIER = a.tier || 'final';
const KEY = { gemini: process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || '', openai: process.env.OPENAI_API_KEY || '' };
const GL = 'https://generativelanguage.googleapis.com/v1beta';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const hash = s => crypto.createHash('sha256').update(s).digest('hex').slice(0, 12);

// ---- cost estimates (USD per image), from the providers' pricing pages, 2026-09-30; the ledger records what was spent
const PRICE = {
  'gemini-3-pro-image': { '1K': 0.134, '2K': 0.134, '4K': 0.24 }, 'gemini-3.1-flash-image': { '1K': 0.067, '2K': 0.101, '4K': 0.151 },
  'gemini-3.1-flash-lite-image': { '1K': 0.034 }, 'gpt-image-2': { '1K': 0.22, '2K': 0.33 }, stub: { '1K': 0, '2K': 0, '4K': 0 },
};
const modelFor = () => PROVIDER === 'openai' ? (a.model || CFG.routing.alt || 'gpt-image-2') : PROVIDER === 'stub' ? 'stub' : (a.model || (TIER === 'draft' ? CFG.routing.draft : CFG.routing.final));
const costOf = (model, size) => { const base = String(model).replace(/-preview.*$/, ''); const t = PRICE[base] || PRICE[model] || {}; return t[size] ?? t['2K'] ?? t['1K'] ?? 0.15; };
const ledgerFile = path.join(VIS, 'ledger.jsonl');
const spent = () => fs.existsSync(ledgerFile) ? fs.readFileSync(ledgerFile, 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l)).reduce((s, x) => s + (x.costUsd || 0), 0) : 0;

async function call(url, init, label) {
  for (let i = 0; ; i++) {
    const r = await fetch(url, init);
    if (r.ok) return r.json();
    const body = await r.text();
    if ((r.status === 429 || r.status >= 500) && i < 4) { const w = 2000 * 2 ** i; console.log(`  ${label}: ${r.status}, waiting ${w / 1000}s`); await sleep(w); continue; }
    const e = new Error(`${label}: HTTP ${r.status} ${body.slice(0, 400)}`); e.status = r.status; e.body = body; throw e;
  }
}

// ---- probe: which models does this key reach?
if (a.probe) {
  if (!KEY.gemini) { console.error('GEMINI_API_KEY is not set in this environment. Add it as an environment variable (see references/12-visual-production.md, "What the owner provides").'); process.exit(3); }
  const j = await call(`${GL}/models?pageSize=1000`, { headers: { 'x-goog-api-key': KEY.gemini } }, 'models');
  const names = (j.models || []).map(m => ({ name: m.name.replace(/^models\//, ''), methods: m.supportedGenerationMethods || [] }));
  const media = names.filter(m => /image|veo|imagen/.test(m.name));
  fs.writeFileSync(path.join(VIS, 'probe.json'), JSON.stringify({ at: new Date().toISOString(), models: media }, null, 1));
  console.log(`key ok · ${names.length} models, ${media.length} for images/video:`); media.forEach(m => console.log('  ' + m.name + '  [' + m.methods.join(', ') + ']'));
  const want = [CFG.routing.final, CFG.routing.draft, CFG.routing.video];
  for (const w of want) console.log((media.some(m => m.name === w || m.name.startsWith(w)) ? '  ✓ ' : '  ✗ ') + w);
  process.exit(0);
}

// ---- the prompt: concept + house style + never-list, per brand for the brand-field concept
function promptFor(c, brand) {
  const body = c.perBrand ? c.prompt.replace('{brand}', c.perBrand[brand]) : c.prompt;
  return [body, `House style: ${CFG.house}`, `Do not include: ${c.avoid}. Never: ${CFG.never.join('; ')}.`, 'Photographic, natural, no illustration look, no AI gloss, no watermark.'].join('\n\n');
}

// ---- providers
async function gemini(model, prompt, ratio, size) {
  const body = { contents: [{ role: 'user', parts: [{ text: prompt }] }], generationConfig: { responseModalities: ['IMAGE'], imageConfig: { aspectRatio: ratio, imageSize: size } } };
  if (a.dry) return { dry: { url: `${GL}/models/${model}:generateContent`, body } };
  let j;
  try { j = await call(`${GL}/models/${model}:generateContent`, { method: 'POST', headers: { 'x-goog-api-key': KEY.gemini, 'content-type': 'application/json' }, body: JSON.stringify(body) }, model); }
  catch (e) { if (e.status === 400 && /modalit/i.test(e.body || '')) { body.generationConfig.responseModalities = ['TEXT', 'IMAGE']; j = await call(`${GL}/models/${model}:generateContent`, { method: 'POST', headers: { 'x-goog-api-key': KEY.gemini, 'content-type': 'application/json' }, body: JSON.stringify(body) }, model); } else throw e; }
  const cand = (j.candidates || [])[0] || {}, parts = (cand.content && cand.content.parts) || [];
  const img = parts.find(p => p.inlineData || p.inline_data), note = parts.filter(p => p.text).map(p => p.text).join(' ').slice(0, 400);
  if (!img) return { blocked: (j.promptFeedback && j.promptFeedback.blockReason) || cand.finishReason || 'no image', note };
  const d = img.inlineData || img.inline_data;
  return { bytes: Buffer.from(d.data, 'base64'), mime: d.mimeType || d.mime_type || 'image/png', note, usage: j.usageMetadata || null };
}
async function openai(model, prompt, ratio) {
  const size = { '16:9': '1536x1024', '21:9': '1536x1024', '4:5': '1024x1536', '9:16': '1024x1536', '1:1': '1024x1024' }[ratio] || 'auto';
  const body = { model, prompt, size, quality: 'high', n: 1, output_format: 'png' };
  if (a.dry) return { dry: { url: 'https://api.openai.com/v1/images/generations', body } };
  const j = await call('https://api.openai.com/v1/images/generations', { method: 'POST', headers: { authorization: `Bearer ${KEY.openai}`, 'content-type': 'application/json' }, body: JSON.stringify(body) }, model);
  const d = (j.data || [])[0]; if (!d) return { blocked: 'no image' };
  return { bytes: Buffer.from(d.b64_json, 'base64'), mime: 'image/png', usage: j.usage || null };
}
async function stub(c, ratio) {
  // a code-drawn plate (gradients and grain in the concept's palette): proves the pipeline without a key; flagged, never approvable
  const [w, h] = ratio.split(':').map(Number), W = 1280, H = Math.round(W * h / w);
  const { loadPlaywright } = await import('./lib.mjs'); const pw = loadPlaywright();
  const b = await pw.chromium.launch(); const pg = await b.newPage({ viewport: { width: W, height: H } });
  await pg.setContent(`<body style="margin:0;background:radial-gradient(70% 60% at 84% 10%,#FFFBF7,transparent 68%),linear-gradient(158deg,#F4E9E2,#EAD8CD 52%,#DFC7BA)"><div style="position:fixed;inset:0;background:repeating-linear-gradient(118deg,transparent 0 10%,rgba(255,252,249,.34) 10% 15.5%,transparent 15.5% 27%);filter:blur(12px)"></div></body>`);
  const bytes = await pg.screenshot({ type: 'png' }); await b.close();
  return { bytes, mime: 'image/png', note: 'stub: code-drawn plate for pipeline tests' };
}

// ---- run
const concepts = a.concept === 'all' ? CFG.concepts : CFG.concepts.filter(c => c.id === a.concept);
if (!concepts.length) { console.error('no such concept: ' + a.concept + ' (have: ' + CFG.concepts.map(c => c.id).join(', ') + ')'); process.exit(2); }
if (!a.dry && PROVIDER !== 'stub' && !KEY[PROVIDER]) { console.error(`${PROVIDER === 'openai' ? 'OPENAI_API_KEY' : 'GEMINI_API_KEY'} is not set. Nothing was generated. Use --dry to see the exact requests, or --provider stub to test the pipeline.`); process.exit(3); }
const model = modelFor(), jobs = [];
for (const c of concepts) {
  const brands = c.perBrand ? (a.brand ? [a.brand] : Object.keys(c.perBrand)) : [null];
  for (const br of brands) for (const ratio of (a.ratio ? [a.ratio] : c.ratios)) for (let i = 0; i < +(a.n || c.candidates || 2); i++) jobs.push({ c, br, ratio, i, size: a.size || c.size || '2K' });
}
const est = jobs.reduce((s, j) => s + costOf(model, j.size), 0), budget = +(a.budget || CFG.budgetUsd || 20), before = spent();
console.log(`${jobs.length} images · ${PROVIDER}/${model} · estimate $${est.toFixed(2)} · spent so far $${before.toFixed(2)} of $${budget}`);
if (!a.dry && before + est > budget && !a['force-budget']) { console.error(`over budget: $${(before + est).toFixed(2)} > $${budget}. Lower --n, pick --ratio, use --tier draft, or raise budgetUsd in concepts.json.`); process.exit(4); }
let made = 0, blocked = 0, cost = 0;
for (const j of jobs) {
  const prompt = promptFor(j.c, j.br), dir = path.join(VIS, 'candidates', j.c.id + (j.br ? '/' + j.br : ''), j.ratio.replace(':', 'x'));
  const t0 = Date.now();
  let r;
  try { r = PROVIDER === 'openai' ? await openai(model, prompt, j.ratio) : PROVIDER === 'stub' ? await stub(j.c, j.ratio) : await gemini(model, prompt, j.ratio, j.size); }
  catch (e) { console.error('  stopped:', e.message.split('\n')[0]); break; }
  if (r.dry) { if (j.i === 0) console.log(`\n--dry ${j.c.id}${j.br ? '/' + j.br : ''} ${j.ratio}\nPOST ${r.dry.url}\n${JSON.stringify(r.dry.body, null, 1).slice(0, 1800)}`); continue; }
  const c1 = costOf(model, j.size); cost += c1;
  fs.appendFileSync(ledgerFile, JSON.stringify({ at: new Date().toISOString(), kind: 'image', provider: PROVIDER, model, concept: j.c.id, brand: j.br, ratio: j.ratio, size: j.size, costUsd: c1, ok: !!r.bytes }) + '\n');
  if (!r.bytes) { blocked++; console.log(`  ✗ ${j.c.id} ${j.ratio} #${j.i + 1}: ${r.blocked} ${r.note || ''}`); continue; }
  fs.mkdirSync(dir, { recursive: true });
  const base = `${new Date().toISOString().replace(/[:.]/g, '-')}-${j.i + 1}`, ext = /jpe?g/.test(r.mime) ? 'jpg' : 'png', file = path.join(dir, `${base}.${ext}`);
  fs.writeFileSync(file, r.bytes);
  fs.writeFileSync(file.replace(/\.\w+$/, '.json'), JSON.stringify({ concept: j.c.id, brand: j.br, ratio: j.ratio, size: j.size, provider: PROVIDER, model, prompt, promptHash: hash(prompt), at: new Date().toISOString(), ms: Date.now() - t0, costUsd: c1, synthid: PROVIDER === 'gemini', note: r.note || '', usage: r.usage || null, status: 'candidate', review: null }, null, 1));
  made++; console.log(`  ✓ ${path.relative(ROOT, file)} (${((Date.now() - t0) / 1000).toFixed(1)}s)`);
}
if (!a.dry) console.log(`\n${made} candidates, ${blocked} blocked · $${cost.toFixed(2)} this run · $${(before + cost).toFixed(2)} total. Next: node image-review.mjs --project ${a.project} --sheet`);
