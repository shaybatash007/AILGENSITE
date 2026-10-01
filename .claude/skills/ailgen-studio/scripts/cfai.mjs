#!/usr/bin/env node
// Cloudflare Workers AI from the studio: any model in the catalog, one command. Images go through imagegen.mjs (routes,
// ledger, review); this is for everything else: text, vision, translation, speech, embeddings.
//   node cfai.mjs --verify                                              is the token valid, which account, what it reaches
//   node cfai.mjs --models [--task "Text Generation"]                   the catalog this account sees (id, task)
//   node cfai.mjs --run @cf/meta/llama-3.3-70b-instruct-fp8-fast --prompt "..." [--system "..."] [--max 800]
//   node cfai.mjs --run @cf/meta/llama-4-scout-17b-16e-instruct --image a.jpg --prompt "What is on the stone?"   (vision)
//   node cfai.mjs --run @cf/meta/m2m100-1.2b --text "..." --from english --to hebrew                            (translation)
//   node cfai.mjs --run @cf/baai/bge-m3 --text "one|two|three"                                                  (embeddings; | splits)
//   node cfai.mjs --run @cf/openai/whisper-large-v3-turbo --audio clip.mp3                                       (speech to text)
//   node cfai.mjs --run <model> --json '{"any":"input"}' [--out file]                                           (any model, raw input)
// Keys: a token with Workers AI Read + Edit, never in chat or code: an API credential in the cloud environment's settings
// (Bearer, allowed website api.cloudflare.com; the environment adds it to each request), or CLOUDFLARE_API_TOKEN. The account
// ID is not a secret: CLOUDFLARE_ACCOUNT_ID, or cloudflare.accountId in surfaces.json at the repository root.
// Cost: 10,000 neurons a day are free on every plan (they reset at 00:00 UTC); above that $0.011 per 1,000 neurons on Workers
// Paid, and on the Free plan the calls fail until the reset. A 429 or 5xx waits and retries (2, 4, 8 s), then stops.
// Cloudflare does not train models on what is sent (developers.cloudflare.com/workers-ai/platform/data-usage/).
import fs from 'fs';
import path from 'path';
import { parseArgs, repoRoot, ensureProxyEnv, cloudflareAuth } from './lib.mjs';
if (ensureProxyEnv()) process.exit(0);
const a = parseArgs(), ROOT = repoRoot(), env = process.env;
try { const sj = JSON.parse(fs.readFileSync(path.join(ROOT, 'surfaces.json'), 'utf8')); if (!env.CLOUDFLARE_ACCOUNT_ID && sj.cloudflare?.accountId) env.CLOUDFLARE_ACCOUNT_ID = sj.cloudflare.accountId; } catch (_) {}
const ACC = env.CLOUDFLARE_ACCOUNT_ID || env.CF_ACCOUNT_ID, TOK = env.CLOUDFLARE_API_TOKEN || env.CF_API_TOKEN;
const API = `https://api.cloudflare.com/client/v4/accounts/${ACC}`;
const HELP = 'Cloudflare refused the request: add a token with Workers AI Read + Edit in the environment settings (API credential: Bearer, website api.cloudflare.com), then start a new session';
process.on('uncaughtException', e => { console.error('  ' + (e && e.message || e)); process.exit(1); });
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function call(url, init = {}) {
  for (let i = 0; ; i++) {
    const r = await fetch(url, { ...init, headers: { ...cloudflareAuth(), ...(init.headers || {}) } });
    if ((r.status === 429 || r.status >= 500) && i < 3) { await sleep(2000 * 2 ** i); continue; }
    const type = r.headers.get('content-type') || '';
    if (!type.includes('json')) { if (!r.ok) throw new Error(r.status + ' ' + (await r.text()).slice(0, 300)); return { binary: Buffer.from(await r.arrayBuffer()), type }; }
    const j = await r.json();
    if (!TOK && (r.status === 401 || r.status === 403 || (j.errors || []).some(e => [1001, 9106, 9109, 10000].includes(e.code)))) throw new Error(HELP);
    if (!r.ok || j.success === false) throw new Error(r.status + ' ' + JSON.stringify(j.errors || j).slice(0, 400));
    return j;
  }
}
const mime = f => ({ '.png': 'image/png', '.webp': 'image/webp', '.gif': 'image/gif' })[path.extname(f).toLowerCase()] || 'image/jpeg';
const dataUri = f => `data:${mime(f)};base64,${fs.readFileSync(path.resolve(f)).toString('base64')}`;

if (a.verify) {
  const v = await call('https://api.cloudflare.com/client/v4/user/tokens/verify').catch(async () => call(`${API}/tokens/verify`));
  console.log('  token:', v.result?.status || 'ok', ' account:', ACC);
  const m = await call(`${API}/ai/models/search?per_page=1`);
  console.log('  Workers AI reachable:', m.success !== false ? 'yes' : 'no');
  process.exit(0);
}
if (a.models) {
  const out = []; for (let page = 1; page < 10; page++) { const j = await call(`${API}/ai/models/search?per_page=100&page=${page}${a.task ? '&task=' + encodeURIComponent(a.task) : ''}`); out.push(...(j.result || [])); if ((j.result || []).length < 100) break; }
  out.sort((x, y) => (x.task?.name || '').localeCompare(y.task?.name || '') || x.name.localeCompare(y.name)).forEach(m => console.log(`  ${(m.task?.name || '').padEnd(24)} ${m.name}`));
  console.log(`\n  ${out.length} models`); process.exit(0);
}
if (!a.run) { console.error('usage: node cfai.mjs --verify | --models [--task t] | --run <model> (--prompt | --image | --text | --audio | --json)'); process.exit(2); }
const model = String(a.run);
let body;
if (a.json) body = JSON.parse(a.json);
else if (a.audio) body = { audio: fs.readFileSync(path.resolve(a.audio)).toString('base64') };
else if (a.from || a.to) body = { text: String(a.text || a.prompt || ''), source_lang: a.from || 'english', target_lang: a.to || 'hebrew' };
else if (a.text && !a.prompt) body = { text: String(a.text).split('|') };
else {
  const user = a.image ? [{ type: 'text', text: String(a.prompt || 'Describe this image.') }, ...String(a.image).split(',').map(f => ({ type: 'image_url', image_url: { url: dataUri(f) } }))] : String(a.prompt || '');
  body = { messages: [...(a.system ? [{ role: 'system', content: String(a.system) }] : []), { role: 'user', content: user }], max_tokens: +(a.max || 1024) };
}
if (a.dry) { console.log(JSON.stringify({ url: `${API}/ai/run/${model}`, body: JSON.stringify(body).slice(0, 400) }, null, 1)); process.exit(0); }
const t0 = Date.now(), j = await call(`${API}/ai/run/${model}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
if (j.binary) { const f = path.resolve(a.out || 'cfai-out' + (j.type.includes('audio') ? '.mp3' : '.bin')); fs.writeFileSync(f, j.binary); console.log('  wrote', path.relative(process.cwd(), f), `(${((Date.now() - t0) / 1000).toFixed(1)} s)`); process.exit(0); }
const r = j.result ?? j;
const text = typeof r === 'string' ? r : r.response ?? r.translated_text ?? r.text ?? r.choices?.[0]?.message?.content ?? null;
if (a.out) fs.writeFileSync(path.resolve(a.out), JSON.stringify(r, null, 1));
console.log(text != null ? (typeof text === 'string' ? text : JSON.stringify(text)) : JSON.stringify(r).slice(0, 2000));
if (r.usage) console.error(`  usage: ${JSON.stringify(r.usage)} · ${((Date.now() - t0) / 1000).toFixed(1)} s`);
