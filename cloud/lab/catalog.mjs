#!/usr/bin/env node
// AILGEN Lab's model catalog: every Workers AI model this account sees, how to call it, whether it needs Workers Paid, its price,
// and what the studio measured on it (cloud/lab/notes.json). Writes lab/models.json, which the lab page reads.
//   node cloud/lab/catalog.mjs          (free: the model listing costs no neurons)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ensureProxyEnv, cloudflareAuth } from '../../.claude/skills/ailgen-studio/scripts/lib.mjs';
if (ensureProxyEnv()) process.exit(0);

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const cfg = JSON.parse(fs.readFileSync(path.join(ROOT, 'surfaces.json'), 'utf8'));
const ACC = process.env.CLOUDFLARE_ACCOUNT_ID || cfg.cloudflare.accountId;
const NOTES = JSON.parse(fs.readFileSync(path.join(ROOT, 'cloud/lab/notes.json'), 'utf8'));

const all = [];
for (let page = 1; page < 10; page++) {
  const r = await fetch(`https://api.cloudflare.com/client/v4/accounts/${ACC}/ai/models/search?per_page=100&page=${page}`, { headers: cloudflareAuth() });
  const j = await r.json();
  if (!r.ok || j.success === false) { console.error('  Cloudflare refused the listing:', JSON.stringify(j.errors || j).slice(0, 200)); process.exit(1); }
  all.push(...j.result); if (j.result.length < 100) break;
}

// how the lab calls each model (the input shape differs by family)
function how(m, p) {
  const n = m.name, t = m.task?.name || '';
  if (t === 'Text Generation') return p.vision ? 'chat-vision' : 'chat';
  if (t === 'Text-to-Image') return /flux-2/.test(n) ? 'flux2' : /flux-1-schnell/.test(n) ? 'image-json' : /inpainting|img2img/.test(n) ? 'raw' : 'image';
  if (t === 'Image-to-Text') return 'vision-bytes';
  if (t === 'Translation') return 'translate';
  if (t === 'Text Embeddings') return 'embed';
  if (t === 'Automatic Speech Recognition') return /flux|nova/.test(n) ? 'raw' : 'asr';
  if (t === 'Text-to-Speech') return 'tts';
  if (t === 'Text Classification') return /reranker/.test(n) ? 'rerank' : 'classify';
  return 'raw';
}
const models = all.map(m => {
  const p = Object.fromEntries((m.properties || []).map(x => [x.property_id, x.value]));
  const note = NOTES.notes[m.name] || null;
  return {
    name: m.name, task: m.task?.name || '', how: how(m, p), about: String(m.description || '').split(/(?<=\.)\s/)[0].slice(0, 220),
    paid: p.require_workers_paid === 'true', price: Array.isArray(p.price) ? p.price.map(x => `$${x.price} ${x.unit}`).join(' · ') : null,
    vision: p.vision === 'true', context: p.context_window ? +p.context_window : null, reasoning: p.reasoning === 'true', tools: p.function_calling === 'true',
    beta: p.beta === 'true', terms: typeof p.terms === 'string' ? p.terms : null, created: (m.created_at || '').slice(0, 10), note,
  };
}).sort((a, b) => a.task.localeCompare(b.task) || (b.note?.verdict === 'best') - (a.note?.verdict === 'best') || a.name.localeCompare(b.name));

const out = { at: new Date().toISOString(), plan: NOTES.plan, measuredOn: NOTES.measuredOn, count: models.length, free: models.filter(m => !m.paid).length, models };
fs.writeFileSync(path.join(ROOT, 'lab/models.json'), JSON.stringify(out, null, 1));
console.log(`  lab/models.json: ${models.length} models, ${out.free} free, ${models.filter(m => m.note).length} with measured notes`);
