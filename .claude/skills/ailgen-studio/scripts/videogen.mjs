#!/usr/bin/env node
// The visual system, step 3: short brand videos from an approved still (image-to-video), vendor-neutral like imagegen.mjs:
// routing.video (drafts) and routing.videoFinal in concepts.json are ordered "provider:model" lists; the first with a key runs.
//   fal     FAL_KEY          Veo 3.1 / Veo 3.1 Fast (image_url), Kling 3.0 Pro (start_image_url); queue API, audio off
//   gemini  GEMINI_API_KEY   Veo 3.1 (predictLongRunning)
//   node videogen.mjs --project projects/<slug> --concept atelier [--from <approved.png>] [--tier final|draft] [--use fal:fal-ai/veo3.1/image-to-video] [--dry]
//   node videogen.mjs --project projects/<slug> --publish <candidate.mp4> --site <folder>     muted web versions + poster → manifest
// A video starts from an approved image of the same concept (never from text alone), so its first frame is already reviewed.
// The motion brief is concepts.json → concept.video. Veo adds SynthID. Cost: seconds × price per second (ledger.jsonl).
// Polling waits 10 s between checks, 12 minutes at most. The site gets a muted, looping-free version that plays when visible
// on desktop, and only the poster on mobile, with reduced motion or with Save-Data.
import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';
import { parseArgs, repoRoot, ensureProxyEnv } from './lib.mjs';
if (ensureProxyEnv()) process.exit(0);
const a = parseArgs(), ROOT = repoRoot();
if (!a.project) { console.error('usage: node videogen.mjs --project projects/<slug> (--concept <id> [--from file] [--tier final|draft] [--dry] | --publish <file.mp4> --site <folder>)'); process.exit(2); }
const PROJ = path.resolve(ROOT, a.project), VIS = path.join(PROJ, 'visual'), CFG = JSON.parse(fs.readFileSync(path.join(VIS, 'concepts.json'), 'utf8'));
const KEY = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || '', GL = 'https://generativelanguage.googleapis.com/v1beta';
// price per second of video (audio off), from the providers' pricing pages on 2026-09-30
const PER_S = { 'veo-3.1-generate-preview': 0.40, 'veo-3.1-fast-generate-preview': 0.12, 'veo-3.1-lite-generate-preview': 0.08, 'fal-ai/veo3.1/image-to-video': 0.20, 'fal-ai/veo3.1/fast/image-to-video': 0.10, 'fal-ai/kling-video/v3/pro/image-to-video': 0.112 };
const FALKEY = process.env.FAL_KEY || process.env.FAL_API_KEY || '';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const walk = d => fs.existsSync(d) ? fs.readdirSync(d, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]) : [];

if (a.publish) {
  const src = path.resolve(ROOT, a.publish), meta = JSON.parse(fs.readFileSync(src.replace(/\.mp4$/, '.json'), 'utf8'));
  if (meta.status !== 'approved') { console.error('approve the video first: node image-review.mjs --verdict ' + a.publish + ' approve --why ".."'); process.exit(5); }
  const SITE = path.resolve(ROOT, a.site || 'site'), OUT = path.join(SITE, 'img/v'); fs.mkdirSync(OUT, { recursive: true });
  const base = `${meta.concept}-video`, out = {};
  for (const w of [1280, 1920]) {
    const f = path.join(OUT, `${base}-${w}.mp4`);
    const r = spawnSync('ffmpeg', ['-y', '-v', 'error', '-i', src, '-an', '-vf', `scale=${w}:-2:flags=lanczos`, '-c:v', 'libx264', '-preset', 'slow', '-crf', w === 1920 ? '23' : '24', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', f]);
    if (r.status) { console.error(r.stderr.toString()); process.exit(1); } out[w] = 'img/v/' + path.basename(f);
  }
  const poster = path.join(OUT, `${base}-poster.webp`); spawnSync('ffmpeg', ['-y', '-v', 'error', '-i', src, '-frames:v', '1', '-vf', 'scale=1280:-2', poster]);
  const manFile = path.join(OUT, 'manifest.json'), man = fs.existsSync(manFile) ? JSON.parse(fs.readFileSync(manFile, 'utf8')) : { images: {}, videos: {} };
  (man.videos ||= {})[meta.concept] = { src: out, poster: 'img/v/' + path.basename(poster), seconds: meta.seconds, ratio: meta.ratio, use: (CFG.concepts.find(c => c.id === meta.concept) || {}).video?.use || '', provenance: { provider: meta.provider || 'gemini', model: meta.model, at: meta.at, synthid: !!meta.synthid, from: meta.from, review: meta.review } };
  man.updated = new Date().toISOString(); fs.writeFileSync(manFile, JSON.stringify(man, null, 1));
  console.log('published video', meta.concept, Object.keys(out).join('/'), '→', path.relative(ROOT, manFile)); process.exit(0);
}

const c = CFG.concepts.find(x => x.id === a.concept);
if (!c || !c.video) { console.error('no video brief for concept ' + a.concept + ' (concepts with video: ' + CFG.concepts.filter(x => x.video).map(x => x.id).join(', ') + ')'); process.exit(2); }
let from = a.from ? path.resolve(ROOT, a.from) : null;
if (!from) { const pick = walk(path.join(VIS, 'candidates', c.id)).filter(f => /\.(png|jpe?g)$/.test(f)).find(f => { const m = JSON.parse(fs.readFileSync(f.replace(/\.\w+$/, '.json'), 'utf8')); return m.status === 'approved' && m.ratio === c.video.ratio; }); from = pick || null; }
if (!from && !a.dry) { console.error(`no approved ${c.video.ratio} image of "${c.id}" yet: a video starts from a reviewed still (imagegen.mjs, then image-review.mjs --verdict ... approve)`); process.exit(5); }
const R = CFG.routing || {}, list = v => (Array.isArray(v) ? v : v ? [v] : []);
const routes = (a.use ? [String(a.use)] : list(a.tier === 'draft' ? R.video : (R.videoFinal || R.video))).map(r => { const i = r.indexOf(':'); return { provider: r.slice(0, i), model: r.slice(i + 1) }; });
const hasKey = p => (p === 'fal' ? !!FALKEY : p === 'gemini' ? !!KEY : false);
const route = routes.find(r => hasKey(r.provider)) || routes[0];
if (!route) { console.error('no video route: set routing.video / routing.videoFinal in concepts.json'); process.exit(2); }
const model = route.model, secs = +(a.seconds || c.video.seconds || 8);
const neg = `${c.avoid}; ${CFG.never.join('; ')}; text, captions, logos, cuts, camera shake`;
const prompt = c.video.prompt + ' ' + CFG.house, cost = secs * (PER_S[model] || 0.4);
const mime = from && /\.jpe?g$/.test(from) ? 'image/jpeg' : 'image/png', b64 = from ? fs.readFileSync(from).toString('base64') : '<approved still, base64>';
const spent = fs.existsSync(path.join(VIS, 'ledger.jsonl')) ? fs.readFileSync(path.join(VIS, 'ledger.jsonl'), 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l)).reduce((s, x) => s + (x.costUsd || 0), 0) : 0;
if (!a.dry && !hasKey(route.provider)) { console.error(`${route.provider === 'fal' ? 'FAL_KEY' : 'GEMINI_API_KEY'} is not set (route ${route.provider}:${model}). Nothing was generated. Use --dry to see the request.`); process.exit(3); }
if (!a.dry && spent + cost > (CFG.budgetUsd || 20) && !a['force-budget']) { console.error(`over budget: $${(spent + cost).toFixed(2)} > $${CFG.budgetUsd}`); process.exit(4); }

async function viaGemini() {
  const img = { inlineData: { mimeType: mime, data: b64 } };
  const body = { instances: [{ prompt, image: img }], parameters: { aspectRatio: c.video.ratio, resolution: a.resolution || '1080p', durationSeconds: String(secs), negativePrompt: neg, personGeneration: 'allow_adult' } };
  if (a.dry) { const show = JSON.parse(JSON.stringify(body)); show.instances[0].image.inlineData.data = `<${from ? path.basename(from) : 'approved still'} base64>`; console.log(`POST ${GL}/models/${model}:predictLongRunning  (≈ $${cost.toFixed(2)})\n` + JSON.stringify(show, null, 1)); process.exit(0); }
  const post = async b => { const r = await fetch(`${GL}/models/${model}:predictLongRunning`, { method: 'POST', headers: { 'x-goog-api-key': KEY, 'content-type': 'application/json' }, body: JSON.stringify(b) }); const t = await r.text(); return { ok: r.ok, status: r.status, t }; };
  let r = await post(body);
  if (!r.ok && r.status === 400 && /durationSeconds/.test(r.t)) { body.parameters.durationSeconds = secs; r = await post(body); }
  if (!r.ok && r.status === 400 && /image|inlineData/.test(r.t)) { body.instances[0].image = { bytesBase64Encoded: b64, mimeType: mime }; r = await post(body); }
  if (!r.ok) { console.error(`Veo: HTTP ${r.status} ${r.t.slice(0, 500)}`); process.exit(1); }
  const op = JSON.parse(r.t); console.log('operation', op.name, '· polling every 10 s');
  let done = null; const t0 = Date.now();
  while (Date.now() - t0 < 12 * 60e3) { await sleep(10e3); const s = await (await fetch(`${GL}/${op.name}`, { headers: { 'x-goog-api-key': KEY } })).json(); if (s.done) { done = s; break; } process.stdout.write('.'); }
  if (!done) { console.error('\nstill running after 12 minutes; the operation is ' + op.name); process.exit(1); }
  if (done.error) { console.error('\nVeo error:', JSON.stringify(done.error).slice(0, 400)); process.exit(1); }
  const sample = (((done.response || {}).generateVideoResponse || {}).generatedSamples || [])[0];
  if (!sample) { console.error('\nno video in the response (filtered?):', JSON.stringify(done.response || {}).slice(0, 400)); process.exit(1); }
  const v = await fetch(sample.video.uri, { headers: { 'x-goog-api-key': KEY }, redirect: 'follow' }); return Buffer.from(await v.arrayBuffer());
}
async function viaFal() {
  // fal queue API: submit, poll status_url every 10 s (12 minutes at most), then read response_url
  const kling = /kling/.test(model), dataUri = `data:${mime};base64,${b64}`;
  const body = kling ? { prompt, start_image_url: dataUri, duration: String(Math.min(15, Math.max(3, secs))), negative_prompt: neg, generate_audio: false }
    : { prompt, image_url: dataUri, duration: (secs <= 4 ? '4s' : secs <= 6 ? '6s' : '8s'), resolution: a.resolution || '1080p', aspect_ratio: c.video.ratio === '9:16' ? '9:16' : '16:9', negative_prompt: neg, generate_audio: false };
  if (a.dry) { console.log(`POST https://queue.fal.run/${model}  (≈ $${cost.toFixed(2)})\n` + JSON.stringify({ ...body, image_url: body.image_url && '<' + (from ? path.basename(from) : 'approved still') + '>', start_image_url: body.start_image_url && '<' + (from ? path.basename(from) : 'approved still') + '>' }, null, 1)); process.exit(0); }
  const H = { authorization: `Key ${FALKEY}`, 'content-type': 'application/json' };
  const sub = await fetch(`https://queue.fal.run/${model}`, { method: 'POST', headers: H, body: JSON.stringify(body) });
  if (!sub.ok) { console.error(`fal: HTTP ${sub.status} ${(await sub.text()).slice(0, 500)}`); process.exit(1); }
  const q = await sub.json(); console.log('request', q.request_id, '· polling every 10 s');
  const t0 = Date.now(); let st = null;
  while (Date.now() - t0 < 12 * 60e3) { await sleep(10e3); st = await (await fetch(q.status_url, { headers: H })).json(); if (st.status === 'COMPLETED') break; process.stdout.write('.'); }
  if (!st || st.status !== 'COMPLETED') { console.error('\nstill running after 12 minutes; request ' + q.request_id); process.exit(1); }
  const res = await (await fetch(q.response_url, { headers: H })).json(); const url = res.video && res.video.url;
  if (!url) { console.error('\nno video in the response:', JSON.stringify(res).slice(0, 400)); process.exit(1); }
  return Buffer.from(await (await fetch(url)).arrayBuffer());
}
const t0 = Date.now(), bytes = route.provider === 'fal' ? await viaFal() : await viaGemini();
const dir = path.join(VIS, 'candidates', c.id, 'video'); fs.mkdirSync(dir, { recursive: true });
const file = path.join(dir, `${new Date().toISOString().replace(/[:.]/g, '-')}-${model.replace(/^.*\//, '').replace(/[^a-z0-9.-]/gi, '-')}.mp4`);
fs.writeFileSync(file, bytes);
fs.writeFileSync(file.replace(/\.mp4$/, '.json'), JSON.stringify({ concept: c.id, kind: 'video', ratio: c.video.ratio, seconds: secs, provider: route.provider, model, from: path.relative(ROOT, from), prompt, negative: neg, at: new Date().toISOString(), ms: Date.now() - t0, costUsd: cost, synthid: /veo/.test(model), status: 'candidate', review: null }, null, 1));
fs.appendFileSync(path.join(VIS, 'ledger.jsonl'), JSON.stringify({ at: new Date().toISOString(), kind: 'video', provider: route.provider, model, concept: c.id, seconds: secs, costUsd: cost, ok: true }) + '\n');
console.log(`\n✓ ${path.relative(ROOT, file)} ($${cost.toFixed(2)}). Review frames, then: node image-review.mjs --verdict ${path.relative(ROOT, file)} approve --why ".." ; node videogen.mjs --publish ...`);
