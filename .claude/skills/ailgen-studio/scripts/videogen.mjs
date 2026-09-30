#!/usr/bin/env node
// The visual system, step 3: short brand videos from an approved still (image-to-video, Veo 3.1 on the Gemini API).
//   node videogen.mjs --project projects/<slug> --concept atelier [--from <approved.png>] [--tier final|draft] [--dry]
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
const PER_S = { 'veo-3.1-generate-preview': 0.40, 'veo-3.1-fast-generate-preview': 0.12, 'veo-3.1-lite-generate-preview': 0.08 };
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
  (man.videos ||= {})[meta.concept] = { src: out, poster: 'img/v/' + path.basename(poster), seconds: meta.seconds, ratio: meta.ratio, use: (CFG.concepts.find(c => c.id === meta.concept) || {}).video?.use || '', provenance: { provider: 'gemini', model: meta.model, at: meta.at, synthid: true, from: meta.from, review: meta.review } };
  man.updated = new Date().toISOString(); fs.writeFileSync(manFile, JSON.stringify(man, null, 1));
  console.log('published video', meta.concept, Object.keys(out).join('/'), '→', path.relative(ROOT, manFile)); process.exit(0);
}

const c = CFG.concepts.find(x => x.id === a.concept);
if (!c || !c.video) { console.error('no video brief for concept ' + a.concept + ' (concepts with video: ' + CFG.concepts.filter(x => x.video).map(x => x.id).join(', ') + ')'); process.exit(2); }
let from = a.from ? path.resolve(ROOT, a.from) : null;
if (!from) { const pick = walk(path.join(VIS, 'candidates', c.id)).filter(f => /\.(png|jpe?g)$/.test(f)).find(f => { const m = JSON.parse(fs.readFileSync(f.replace(/\.\w+$/, '.json'), 'utf8')); return m.status === 'approved' && m.ratio === c.video.ratio; }); from = pick || null; }
if (!from && !a.dry) { console.error(`no approved ${c.video.ratio} image of "${c.id}" yet: a video starts from a reviewed still (imagegen.mjs, then image-review.mjs --verdict ... approve)`); process.exit(5); }
const model = a.model || (a.tier === 'draft' ? CFG.routing.videoDraft : CFG.routing.video), secs = +(a.seconds || c.video.seconds || 8);
const neg = `${c.avoid}; ${CFG.never.join('; ')}; text, captions, logos, cuts, camera shake`;
const img = from ? { inlineData: { mimeType: /\.jpe?g$/.test(from) ? 'image/jpeg' : 'image/png', data: fs.readFileSync(from).toString('base64') } } : { inlineData: { mimeType: 'image/png', data: '<approved still, base64>' } };
const body = { instances: [{ prompt: c.video.prompt + ' ' + CFG.house, image: img }], parameters: { aspectRatio: c.video.ratio, resolution: a.resolution || '1080p', durationSeconds: String(secs), negativePrompt: neg, personGeneration: 'allow_adult' } };
const cost = secs * (PER_S[model] || 0.4);
if (a.dry) { const show = JSON.parse(JSON.stringify(body)); show.instances[0].image.inlineData.data = `<${from ? path.basename(from) : 'approved still'} base64>`; console.log(`POST ${GL}/models/${model}:predictLongRunning  (≈ $${cost.toFixed(2)})\n` + JSON.stringify(show, null, 1)); process.exit(0); }
if (!KEY) { console.error('GEMINI_API_KEY is not set. Nothing was generated. Use --dry to see the request.'); process.exit(3); }
const spent = fs.existsSync(path.join(VIS, 'ledger.jsonl')) ? fs.readFileSync(path.join(VIS, 'ledger.jsonl'), 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l)).reduce((s, x) => s + (x.costUsd || 0), 0) : 0;
if (spent + cost > (CFG.budgetUsd || 20) && !a['force-budget']) { console.error(`over budget: $${(spent + cost).toFixed(2)} > $${CFG.budgetUsd}`); process.exit(4); }

async function post(b) { const r = await fetch(`${GL}/models/${model}:predictLongRunning`, { method: 'POST', headers: { 'x-goog-api-key': KEY, 'content-type': 'application/json' }, body: JSON.stringify(b) }); const t = await r.text(); return { ok: r.ok, status: r.status, t }; }
let r = await post(body);
if (!r.ok && r.status === 400 && /durationSeconds/.test(r.t)) { body.parameters.durationSeconds = secs; r = await post(body); }
if (!r.ok && r.status === 400 && /image|inlineData/.test(r.t)) { body.instances[0].image = { bytesBase64Encoded: img.inlineData.data, mimeType: img.inlineData.mimeType }; r = await post(body); }
if (!r.ok) { console.error(`Veo: HTTP ${r.status} ${r.t.slice(0, 500)}`); process.exit(1); }
const op = JSON.parse(r.t); console.log('operation', op.name, '· polling every 10 s');
let done = null; const t0 = Date.now();
while (Date.now() - t0 < 12 * 60e3) { await sleep(10e3); const s = await (await fetch(`${GL}/${op.name}`, { headers: { 'x-goog-api-key': KEY } })).json(); if (s.done) { done = s; break; } process.stdout.write('.'); }
if (!done) { console.error('\nstill running after 12 minutes; the operation is ' + op.name); process.exit(1); }
if (done.error) { console.error('\nVeo error:', JSON.stringify(done.error).slice(0, 400)); process.exit(1); }
const sample = (((done.response || {}).generateVideoResponse || {}).generatedSamples || [])[0];
if (!sample) { console.error('\nno video in the response (filtered?):', JSON.stringify(done.response || {}).slice(0, 400)); process.exit(1); }
const dir = path.join(VIS, 'candidates', c.id, 'video'); fs.mkdirSync(dir, { recursive: true });
const file = path.join(dir, `${new Date().toISOString().replace(/[:.]/g, '-')}.mp4`);
const v = await fetch(sample.video.uri, { headers: { 'x-goog-api-key': KEY }, redirect: 'follow' }); fs.writeFileSync(file, Buffer.from(await v.arrayBuffer()));
fs.writeFileSync(file.replace(/\.mp4$/, '.json'), JSON.stringify({ concept: c.id, kind: 'video', ratio: c.video.ratio, seconds: secs, provider: 'gemini', model, from: path.relative(ROOT, from), prompt: body.instances[0].prompt, negative: neg, at: new Date().toISOString(), ms: Date.now() - t0, costUsd: cost, synthid: true, status: 'candidate', review: null }, null, 1));
fs.appendFileSync(path.join(VIS, 'ledger.jsonl'), JSON.stringify({ at: new Date().toISOString(), kind: 'video', provider: 'gemini', model, concept: c.id, seconds: secs, costUsd: cost, ok: true }) + '\n');
console.log(`\n✓ ${path.relative(ROOT, file)} ($${cost.toFixed(2)}). Review frames, then: node image-review.mjs --verdict ${path.relative(ROOT, file)} approve --why ".." ; node videogen.mjs --publish ...`);
