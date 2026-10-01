#!/usr/bin/env node
// The visual system, step 1: generate candidate images for a project's concepts (projects/<slug>/visual/concepts.json).
// Vendor-neutral: every job names a route of "provider:model" in concepts.json; the first route whose key is present runs.
//   node imagegen.mjs --project projects/<slug> --probe                            which providers and models the keys here reach
//   node imagegen.mjs --project projects/<slug> --concept atelier [--ratio 4:5] [--n 4] [--tier draft|final] [--brand thuya] [--dry]
//   node imagegen.mjs --project projects/<slug> --concept atelier --bakeoff        the same brief through every model in routing.bakeoff
//   node imagegen.mjs --project projects/<slug> --concept field --ref a.png,b.png    reference images (composition, light, colour swatch)
//   node imagegen.mjs ... --use fal:fal-ai/flux-2-pro                               one route, explicitly
// Providers and their keys (environment variables, set in the environment settings, never in chat or code):
//   cloudflare  CLOUDFLARE_API_TOKEN (+ the account ID, from the environment or surfaces.json)   Workers AI; 10,000 neurons a day free:
//               FLUX.2 [klein] 4B (~95 images a day), FLUX.2 [dev] (best free quality, ~2 a day), FLUX.2 [klein] 9B, FLUX.1 [schnell]
//   fal         FAL_KEY                                        one key for Nano Banana Pro, FLUX.2 [pro], Seedream 4.5, Veo 3.1, Kling 3.0
//   gemini      GEMINI_API_KEY (or GOOGLE_API_KEY)             Gemini 3 Pro Image / 3.1 Flash Image, Veo 3.1 (billing required)
//   openai      OPENAI_API_KEY                                 gpt-image-2
//   stub        none: a code-drawn plate, only to test the pipeline end to end; never approvable
// Rules (references/12-visual-production.md): no product, logo, text, face or result is ever generated; the prompt carries the
// concept, the house style and the project's never-list. Every file gets a sidecar (provider, model, prompt, refs, time, cost)
// and a line in visual/ledger.jsonl. The budget in concepts.json is a hard cap. A 429 or 5xx waits and retries at most four
// times (2, 4, 8, 16 s), then stops: never hammer a provider. Candidates wait for review (image-review.mjs); nothing reaches
// the site without an approval, and approved plates are graded to the brand palette on publish (grade.py).
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { spawnSync } from 'child_process';
import { parseArgs, repoRoot, ensureProxyEnv } from './lib.mjs';
if (ensureProxyEnv()) process.exit(0);
const a = parseArgs(), ROOT = repoRoot();
if (!a.project) { console.error('usage: node imagegen.mjs --project projects/<slug> (--probe | --concept <id|all>) [--ratio r] [--n k] [--tier draft|final] [--bakeoff] [--use provider:model] [--ref a.png,b.png] [--brand key] [--dry]'); process.exit(2); }
const PROJ = path.resolve(ROOT, a.project), VIS = path.join(PROJ, 'visual');
const CFG = JSON.parse(fs.readFileSync(path.join(VIS, 'concepts.json'), 'utf8'));
// the Cloudflare account ID is not a secret: it may come from surfaces.json at the repository root; the token only from the environment
try { const sj = JSON.parse(fs.readFileSync(path.join(ROOT, 'surfaces.json'), 'utf8')); if (!process.env.CLOUDFLARE_ACCOUNT_ID && sj.cloudflare && sj.cloudflare.accountId) process.env.CLOUDFLARE_ACCOUNT_ID = sj.cloudflare.accountId; } catch (_) {}
const env = process.env, has = {
  cloudflare: !!((env.CLOUDFLARE_ACCOUNT_ID || env.CF_ACCOUNT_ID) && (env.CLOUDFLARE_API_TOKEN || env.CF_API_TOKEN)),
  fal: !!(env.FAL_KEY || env.FAL_API_KEY), gemini: !!(env.GEMINI_API_KEY || env.GOOGLE_API_KEY), openai: !!env.OPENAI_API_KEY, stub: true,
};
const KEYVAR = { cloudflare: 'CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN', fal: 'FAL_KEY', gemini: 'GEMINI_API_KEY', openai: 'OPENAI_API_KEY' };
const GL = 'https://generativelanguage.googleapis.com/v1beta';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const hash = s => crypto.createHash('sha256').update(s).digest('hex').slice(0, 12);
const TIER = a.tier || 'final';

// ---- routes: "provider:model"; routing.<tier> is an ordered list (the first one whose key is present runs)
const R = CFG.routing || {};
const list = v => (Array.isArray(v) ? v : v ? [v] : []);
const parse = r => { const i = r.indexOf(':'); return { provider: r.slice(0, i), model: r.slice(i + 1), route: r }; };
function pick(tier, concept) {
  if (a.use) return [parse(String(a.use))];
  if (a.provider === 'stub') return [{ provider: 'stub', model: 'stub', route: 'stub:stub' }];
  const routes = list((concept && concept.route && concept.route[tier]) || R[tier]).map(parse);
  if (a.bakeoff) return list((concept && concept.route && concept.route.bakeoff) || R.bakeoff).map(parse).filter(r => has[r.provider]);
  const ok = routes.find(r => has[r.provider]);
  return ok ? [ok] : routes.length ? [{ ...routes[0], missing: true }] : [];
}

// ---- sizes: every provider gets the same ratio; pixel sizes are multiples of 16 near the requested megapixels
function dims(ratio, size) {
  const [rw, rh] = ratio.split(':').map(Number), mp = { '1K': 1.0, '2K': 2.1, '4K': 8.3 }[size] || 1.0;
  const h = Math.sqrt(mp * 1e6 * rh / rw), w = h * rw / rh, r16 = v => Math.max(256, Math.round(v / 16) * 16);
  return { w: r16(w), h: r16(h) };
}

// ---- cost estimates (USD), from the providers' pricing pages on 2026-09-30; the ledger records what each call cost
function costOf(p, model, ratio, size, nRefs = 0) {
  const { w, h } = dims(ratio, p === 'cloudflare' ? '1K' : size), MP = w * h / 1e6, tiles = Math.ceil(w / 512) * Math.ceil(h / 512);
  if (p === 'stub') return 0;
  if (p === 'cloudflare') {
    if (/flux-2-klein-4b/.test(model)) return tiles * 0.000287 + nRefs * 0.000059;
    if (/flux-1-schnell/.test(model)) return tiles * 0.0000528 + 4 * 0.0001056;
    if (/flux-2-klein-9b/.test(model)) return 0.015 + Math.max(0, Math.ceil(MP) - 1) * 0.002;
    if (/flux-2-dev/.test(model)) return tiles * (37.5 * 25 * 0.011 / 1000) + nRefs * (18.75 * 25 * 0.011 / 1000);   // per tile per step, ~25 steps
    return tiles * 0.007;
  }
  if (p === 'fal') {
    if (/nano-banana-pro/.test(model)) return size === '4K' ? 0.30 : 0.15;
    if (/flux-2-pro/.test(model)) return 0.03 + Math.max(0, Math.ceil(MP) - 1) * 0.015 + nRefs * 0.015;
    if (/seedream/.test(model)) return 0.04;
    if (/nano-banana-2|gemini-3.1-flash/.test(model)) return 0.08;
    return 0.15;
  }
  const G = { 'gemini-3-pro-image': { '1K': 0.134, '2K': 0.134, '4K': 0.24 }, 'gemini-3.1-flash-image': { '1K': 0.067, '2K': 0.101, '4K': 0.151 }, 'gemini-3.1-flash-lite-image': { '1K': 0.034 }, 'gpt-image-2': { '1K': 0.22, '2K': 0.33 } };
  const t = G[String(model).replace(/-preview.*$/, '')] || {}; return t[size] ?? t['2K'] ?? t['1K'] ?? 0.15;
}
const ledgerFile = path.join(VIS, 'ledger.jsonl');
const spent = () => fs.existsSync(ledgerFile) ? fs.readFileSync(ledgerFile, 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l)).reduce((s, x) => s + (x.costUsd || 0), 0) : 0;

async function call(url, init, label, as = 'json') {
  for (let i = 0; ; i++) {
    const r = await fetch(url, init);
    if (r.ok) return as === 'json' ? r.json() : Buffer.from(await r.arrayBuffer());
    const body = await r.text();
    if ((r.status === 429 || r.status >= 500) && i < 4) { const w = 2000 * 2 ** i; console.log(`  ${label}: ${r.status}, waiting ${w / 1000}s`); await sleep(w); continue; }
    const e = new Error(`${label}: HTTP ${r.status} ${body.slice(0, 400)}`); e.status = r.status; e.body = body; throw e;
  }
}

// ---- reference images: composition, light or colour references (never a product to repaint, never a person to copy)
const REFS = String(a.ref || '').split(',').map(s => s.trim()).filter(Boolean).map(f => path.resolve(ROOT, f));
for (const f of REFS) if (!fs.existsSync(f)) { console.error('no such reference: ' + f); process.exit(2); }
function refData(f, max) {
  // Cloudflare wants each reference under 512×512; the others take the file as a data URI (a JPEG copy keeps requests small)
  const out = path.join(VIS, '.refcache', hash(f + max) + '.jpg'); fs.mkdirSync(path.dirname(out), { recursive: true });
  if (!fs.existsSync(out)) { const r = spawnSync((process.env.PYTHON || (process.platform === 'win32' ? 'python' : 'python3')), ['-c', `import sys\nfrom PIL import Image\nim=Image.open(sys.argv[1]).convert('RGB'); im.thumbnail((int(sys.argv[3]),int(sys.argv[3]))); im.save(sys.argv[2],quality=90)`, f, out, String(max)]); if (r.status) throw new Error(r.stderr.toString()); }
  return fs.readFileSync(out);
}

// ---- probe: which providers and models do the keys in this environment reach?
if (a.probe) {
  const rows = [];
  for (const p of ['cloudflare', 'fal', 'gemini', 'openai']) rows.push(p + (has[p] ? ': key present' : `: no key (${KEYVAR[p]})`));
  console.log(rows.join('\n'));
  const out = { at: new Date().toISOString(), keys: Object.fromEntries(Object.entries(has).filter(([k]) => k !== 'stub')), models: {} };
  if (has.cloudflare) {
    const acc = env.CLOUDFLARE_ACCOUNT_ID || env.CF_ACCOUNT_ID, tok = env.CLOUDFLARE_API_TOKEN || env.CF_API_TOKEN;
    try { const j = await call(`https://api.cloudflare.com/client/v4/accounts/${acc}/ai/models/search?search=flux&per_page=50`, { headers: { authorization: `Bearer ${tok}` } }, 'cloudflare models'); out.models.cloudflare = (j.result || []).map(m => m.name); console.log('  cloudflare:', out.models.cloudflare.join(', ')); }
    catch (e) { console.log('  cloudflare:', e.message.split('\n')[0]); }
  }
  if (has.gemini) {
    try { const j = await call(`${GL}/models?pageSize=1000`, { headers: { 'x-goog-api-key': env.GEMINI_API_KEY || env.GOOGLE_API_KEY } }, 'gemini models'); out.models.gemini = (j.models || []).map(m => m.name.replace(/^models\//, '')).filter(n => /image|veo|imagen/.test(n)); console.log('  gemini:', out.models.gemini.join(', ')); }
    catch (e) { console.log('  gemini:', e.message.split('\n')[0]); }
  }
  if (has.fal) console.log('  fal: one key for every fal model; the first call confirms it (fal has no free listing call)');
  for (const t of ['draft', 'final', 'bakeoff', 'video']) console.log(`route ${t}: ` + list(R[t]).map(r => (has[parse(r).provider] ? '✓ ' : '✗ ') + r).join('  ·  '));
  fs.writeFileSync(path.join(VIS, 'probe.json'), JSON.stringify(out, null, 1));
  process.exit(0);
}

// ---- the prompt: concept + house style + never-list, per brand for the brand-field concept
function promptFor(c, brand) {
  const body = c.perBrand ? c.prompt.replace('{brand}', c.perBrand[brand]) : c.prompt;
  const refNote = REFS.length ? 'Use the reference image(s) only for composition, light and colour; copy no object, text or person from them.' : '';
  return [body, `House style: ${CFG.house}`, `Do not include: ${c.avoid}. Never: ${CFG.never.join('; ')}.`, refNote, 'Photographic, natural, no illustration look, no AI gloss, no watermark.'].filter(Boolean).join('\n\n');
}

// ---- providers: each returns { bytes, mime, note?, usage? } or { blocked } or { dry }
async function gemini(model, prompt, ratio, size) {
  const parts = [{ text: prompt }, ...REFS.map(f => ({ inline_data: { mime_type: 'image/jpeg', data: refData(f, 1024).toString('base64') } }))];
  const body = { contents: [{ role: 'user', parts }], generationConfig: { responseModalities: ['IMAGE'], imageConfig: { aspectRatio: ratio, imageSize: size } } };
  if (a.dry) return { dry: { url: `${GL}/models/${model}:generateContent`, body: { ...body, contents: [{ role: 'user', parts: [{ text: prompt }, ...REFS.map(f => ({ inline_data: '<' + path.basename(f) + '>' }))] }] } } };
  const key = env.GEMINI_API_KEY || env.GOOGLE_API_KEY, go = () => call(`${GL}/models/${model}:generateContent`, { method: 'POST', headers: { 'x-goog-api-key': key, 'content-type': 'application/json' }, body: JSON.stringify(body) }, model);
  let j; try { j = await go(); } catch (e) { if (e.status === 400 && /modalit/i.test(e.body || '')) { body.generationConfig.responseModalities = ['TEXT', 'IMAGE']; j = await go(); } else throw e; }
  const cand = (j.candidates || [])[0] || {}, ps = (cand.content && cand.content.parts) || [];
  const img = ps.find(p => p.inlineData || p.inline_data), note = ps.filter(p => p.text).map(p => p.text).join(' ').slice(0, 400);
  if (!img) return { blocked: (j.promptFeedback && j.promptFeedback.blockReason) || cand.finishReason || 'no image', note };
  const d = img.inlineData || img.inline_data;
  return { bytes: Buffer.from(d.data, 'base64'), mime: d.mimeType || d.mime_type || 'image/png', note, usage: j.usageMetadata || null };
}
async function openai(model, prompt, ratio) {
  if (REFS.length) console.log('  openai: reference images are not sent on this route (use fal or gemini for references)');
  const size = { '16:9': '1536x1024', '21:9': '1536x1024', '4:5': '1024x1536', '9:16': '1024x1536', '1:1': '1024x1024' }[ratio] || 'auto';
  const body = { model, prompt, size, quality: 'high', n: 1, output_format: 'png' };
  if (a.dry) return { dry: { url: 'https://api.openai.com/v1/images/generations', body } };
  const j = await call('https://api.openai.com/v1/images/generations', { method: 'POST', headers: { authorization: `Bearer ${env.OPENAI_API_KEY}`, 'content-type': 'application/json' }, body: JSON.stringify(body) }, model);
  const d = (j.data || [])[0]; if (!d) return { blocked: 'no image' };
  return { bytes: Buffer.from(d.b64_json, 'base64'), mime: 'image/png', usage: j.usage || null };
}
async function cloudflare(model, prompt, ratio) {
  // Workers AI, multipart form: prompt, width, height, and input_image_0..3 for references (each under 512×512)
  const { w, h } = dims(ratio, '1K'), acc = env.CLOUDFLARE_ACCOUNT_ID || env.CF_ACCOUNT_ID, url = `https://api.cloudflare.com/client/v4/accounts/${acc || '<account>'}/ai/run/${model}`;
  if (/flux-1-schnell/.test(model)) {
    const body = { prompt, steps: 4 };
    if (a.dry) return { dry: { url, body } };
    const j = await call(url, { method: 'POST', headers: { authorization: `Bearer ${env.CLOUDFLARE_API_TOKEN || env.CF_API_TOKEN}`, 'content-type': 'application/json' }, body: JSON.stringify(body) }, model);
    const b64 = j.result && j.result.image; return b64 ? { bytes: Buffer.from(b64, 'base64'), mime: 'image/jpeg' } : { blocked: JSON.stringify(j.errors || j).slice(0, 200) };
  }
  const form = new FormData(); form.append('prompt', prompt); form.append('width', String(w)); form.append('height', String(h));
  REFS.slice(0, 4).forEach((f, i) => form.append('input_image_' + i, new Blob([refData(f, 511)], { type: 'image/jpeg' }), 'ref' + i + '.jpg'));
  if (a.dry) return { dry: { url, body: { multipart: { prompt: prompt.slice(0, 120) + '…', width: w, height: h, refs: REFS.map(f => path.basename(f)) } } } };
  const j = await call(url, { method: 'POST', headers: { authorization: `Bearer ${env.CLOUDFLARE_API_TOKEN || env.CF_API_TOKEN}` }, body: form }, model);
  const b64 = (j.result && j.result.image) || j.image; if (!b64) return { blocked: JSON.stringify(j.errors || j).slice(0, 200) };
  return { bytes: Buffer.from(b64, 'base64'), mime: 'image/png' };
}
async function fal(model, prompt, ratio, size) {
  // fal: one key, synchronous endpoint; references switch the model to its /edit variant with image_urls (data URIs)
  const { w, h } = dims(ratio, size), m = REFS.length && !/\/edit$/.test(model) ? model + '/edit' : model;
  const body = { prompt, num_images: 1, output_format: 'png', sync_mode: true };
  if (/nano-banana/.test(m)) Object.assign(body, { aspect_ratio: ratio, resolution: size || '2K' });
  else Object.assign(body, { image_size: { width: w, height: h } });
  if (/seedream/.test(m)) delete body.output_format;
  if (REFS.length) body.image_urls = REFS.map(f => 'data:image/jpeg;base64,' + refData(f, 1536).toString('base64'));
  if (a.dry) return { dry: { url: 'https://fal.run/' + m, body: { ...body, image_urls: body.image_urls && REFS.map(f => '<' + path.basename(f) + '>') } } };
  const j = await call('https://fal.run/' + m, { method: 'POST', headers: { authorization: `Key ${env.FAL_KEY || env.FAL_API_KEY}`, 'content-type': 'application/json' }, body: JSON.stringify(body) }, m);
  const img = (j.images || [])[0]; if (!img) return { blocked: JSON.stringify(j).slice(0, 200) };
  const bytes = /^data:/.test(img.url) ? Buffer.from(img.url.split(',')[1], 'base64') : await call(img.url, {}, 'download', 'buf');
  return { bytes, mime: img.content_type || 'image/png', note: j.description || '', usage: { seed: j.seed ?? null } };
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
const RUN = { gemini, openai, cloudflare, fal };

// ---- run
const concepts = a.concept === 'all' ? CFG.concepts : CFG.concepts.filter(c => c.id === a.concept);
if (!concepts.length) { console.error('no such concept: ' + a.concept + ' (have: ' + CFG.concepts.map(c => c.id).join(', ') + ')'); process.exit(2); }
const jobs = [];
for (const c of concepts) {
  const routes = pick(TIER, c);
  if (!routes.length) { console.error(`no route for ${c.id}: set routing.${a.bakeoff ? 'bakeoff' : TIER} in concepts.json` + (a.bakeoff ? ' (and a key for at least one of its providers)' : '')); process.exit(3); }
  for (const r of routes) if (r.missing && !a.dry) { console.error(`${r.route}: ${KEYVAR[r.provider]} is not set, and no other route for "${TIER}" has a key. Nothing was generated. Use --dry to see the exact requests, or --provider stub to test the pipeline.`); process.exit(3); }
  const brands = c.perBrand ? (a.brand ? [a.brand] : Object.keys(c.perBrand)) : [null];
  const n = a.bakeoff ? +(a.n || 1) : +(a.n || c.candidates || 2);
  for (const r of routes) for (const br of brands) for (const ratio of (a.ratio ? [a.ratio] : a.bakeoff ? [c.ratios[0]] : c.ratios)) for (let i = 0; i < n; i++) jobs.push({ c, br, ratio, i, r, size: a.size || c.size || '2K' });
}
const est = jobs.reduce((s, j) => s + costOf(j.r.provider, j.r.model, j.ratio, j.size, REFS.length), 0), budget = +(a.budget || CFG.budgetUsd || 20), before = spent();
console.log(`${jobs.length} images · ${[...new Set(jobs.map(j => j.r.route))].join(' + ')} · estimate $${est.toFixed(3)} · spent so far $${before.toFixed(2)} of $${budget}`);
if (!a.dry && before + est > budget && !a['force-budget']) { console.error(`over budget: $${(before + est).toFixed(2)} > $${budget}. Lower --n, pick --ratio, use --tier draft, or raise budgetUsd in concepts.json.`); process.exit(4); }
let made = 0, blocked = 0, cost = 0; const shown = new Set();
for (const j of jobs) {
  const prompt = promptFor(j.c, j.br), dir = path.join(VIS, 'candidates', j.c.id + (j.br ? '/' + j.br : ''), j.ratio.replace(':', 'x'));
  const t0 = Date.now(); let r;
  try { r = j.r.provider === 'stub' ? await stub(j.c, j.ratio) : await RUN[j.r.provider](j.r.model, prompt, j.ratio, j.size); }
  catch (e) { console.error('  stopped:', e.message.split('\n')[0]); break; }
  if (r.dry) { const k = j.r.route + j.c.id + j.br + j.ratio; if (!shown.has(k)) { shown.add(k); console.log(`\n--dry ${j.r.route} · ${j.c.id}${j.br ? '/' + j.br : ''} ${j.ratio} · ~$${costOf(j.r.provider, j.r.model, j.ratio, j.size, REFS.length).toFixed(3)}\nPOST ${r.dry.url}\n${JSON.stringify(r.dry.body, null, 1).slice(0, 1400)}`); } continue; }
  const c1 = costOf(j.r.provider, j.r.model, j.ratio, j.size, REFS.length); cost += c1;
  fs.appendFileSync(ledgerFile, JSON.stringify({ at: new Date().toISOString(), kind: 'image', provider: j.r.provider, model: j.r.model, concept: j.c.id, brand: j.br, ratio: j.ratio, size: j.size, refs: REFS.length, costUsd: +c1.toFixed(4), ok: !!r.bytes, bakeoff: !!a.bakeoff }) + '\n');
  if (!r.bytes) { blocked++; console.log(`  ✗ ${j.r.route} ${j.c.id} ${j.ratio} #${j.i + 1}: ${r.blocked} ${r.note || ''}`); continue; }
  fs.mkdirSync(dir, { recursive: true });
  const slug = j.r.model.replace(/^.*\//, '').replace(/[^a-z0-9.-]/gi, '-').slice(0, 28);
  const base = `${new Date().toISOString().replace(/[:.]/g, '-')}-${slug}-${j.i + 1}`, ext = /jpe?g/.test(r.mime) ? 'jpg' : 'png', file = path.join(dir, `${base}.${ext}`);
  fs.writeFileSync(file, r.bytes);
  fs.writeFileSync(file.replace(/\.\w+$/, '.json'), JSON.stringify({ concept: j.c.id, brand: j.br, ratio: j.ratio, size: j.size, provider: j.r.provider, model: j.r.model, route: j.r.route, bakeoff: !!a.bakeoff, refs: REFS.map(f => path.relative(ROOT, f)), prompt, promptHash: hash(prompt), at: new Date().toISOString(), ms: Date.now() - t0, costUsd: +c1.toFixed(4), synthid: j.r.provider === 'gemini' || /nano-banana|veo/.test(j.r.model), note: r.note || '', usage: r.usage || null, status: 'candidate', review: null }, null, 1));
  made++; console.log(`  ✓ ${path.relative(ROOT, file)} (${j.r.route}, ${((Date.now() - t0) / 1000).toFixed(1)}s)`);
}
if (!a.dry) console.log(`\n${made} candidates, ${blocked} blocked · $${cost.toFixed(3)} this run · $${(before + cost).toFixed(2)} total. Next: node image-review.mjs --project ${a.project} --check && node image-review.mjs --project ${a.project} --sheet`);
