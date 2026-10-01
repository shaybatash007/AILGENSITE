#!/usr/bin/env node
// Run a surface's Cloudflare Pages functions here, against the real Workers AI, before anything ships.
// env.AI is a stand-in that calls the Workers AI REST API (the key comes from the environment's credential for
// api.cloudflare.com, or CLOUDFLARE_API_TOKEN); everything else is the code that deploys.
//   node cloud/dev.mjs serve <surface> [--port 8788] [--key <lab passcode>]     the surface + its /api routes on localhost
//   node cloud/dev.mjs call <surface> <route> '<json body>' [--key ...] [--out f]   one POST, the answer printed (and saved)
//   --mock-paid   answer gateway calls here, in each provider's own shape, with the catalog's own example media, after a short
//                 wait: the lab's paid tab end to end with nothing spent (the answers are not the models')
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { ensureProxyEnv, cloudflareAuth } from '../.claude/skills/ailgen-studio/scripts/lib.mjs';
if (ensureProxyEnv()) process.exit(0);

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2), flag = k => (argv.includes(k) ? argv[argv.indexOf(k) + 1] : undefined);
const [cmd, name, route, body] = argv.filter((a, i) => !a.startsWith('--') && !(i && argv[i - 1].startsWith('--')));
const cfg = JSON.parse(fs.readFileSync(path.join(ROOT, 'surfaces.json'), 'utf8'));
const s = cfg.surfaces.find(x => x.name === name);
if (!s || !s.functions) { console.error('usage: node cloud/dev.mjs serve|call <surface with "functions" in surfaces.json> ...'); process.exit(2); }
const ACC = process.env.CLOUDFLARE_ACCOUNT_ID || cfg.cloudflare.accountId;

let neurons = 0;
const MOCK = argv.includes('--mock-paid');
async function mockPaid(model, input) {
  const P = JSON.parse(fs.readFileSync(path.join(ROOT, 'lab/paid.json'), 'utf8'));
  const m = P.groups.flatMap(g => Object.values(g.tiers).flat()).find(x => x.id === model);
  if (!m) throw new Error(`${model}: not in the gateway catalog`);
  if (JSON.stringify(input).includes('__mock_fail__')) throw new Error('mock: the provider refused this input (400)');
  await new Promise(r => setTimeout(r, 600 + Math.random() * 900));
  const ex = JSON.parse(fs.readFileSync(path.join(ROOT, 'lab/schemas', m.slug + '.json'), 'utf8')).examples.find(e => e.media);
  const said = 'תשובת דמה מהמריץ המקומי (' + model + '): בלי קריאה למודל ובלי עלות.';
  const usage = { prompt_tokens: 120, completion_tokens: 240 };
  if (m.out === 'text') {
    if (m.shape === 'anthropic') return { id: 'mock', type: 'message', role: 'assistant', content: [{ type: 'text', text: said }], usage: { input_tokens: 120, output_tokens: 240 } };
    if (m.shape === 'responses') return { id: 'mock', object: 'response', output_text: said, output: [{ type: 'message', content: [{ type: 'output_text', text: said }] }], usage: { input_tokens: 120, output_tokens: 240 } };
    if (m.sector === 'listen') return { text: said };
    return { id: 'mock', object: 'chat.completion', choices: [{ index: 0, message: { role: 'assistant', content: said } }], usage };
  }
  if (m.id === 'minimax/h3') return { state: 'Completed', result: { task: { status: 'succeeded', content: { url: ex && ex.media } } } };
  return { state: 'Completed', gatewayMetadata: { keySource: 'Unified' }, result: { [m.out]: ex ? ex.media : null } };
}
const AI = {
  aiGatewayLogId: null,
  gateway: () => ({ async getLog() { return null; } }),   // no gateway log here: the lab falls back to its estimate
  async run(model, input, opts) {
    if (opts && opts.gateway && MOCK) return mockPaid(model, input);
    // the credits path goes through an AI Gateway with Unified Billing; here only when DEV_GATEWAY_OK=1 says the gateway exists
    if (opts && opts.gateway && !process.env.DEV_GATEWAY_OK) throw new Error(`gateway ${opts.gateway.id}: not reachable from the local runner (set DEV_GATEWAY_OK=1 once it exists)`);
    let init;
    if (input && input.multipart) init = { body: Buffer.from(await new Response(input.multipart.body).arrayBuffer()), headers: { 'content-type': input.multipart.contentType } };
    else init = { body: JSON.stringify(input), headers: { 'content-type': 'application/json' } };
    const r = await fetch(`https://api.cloudflare.com/client/v4/accounts/${ACC}/ai/run/${model}`, { method: 'POST', ...init, headers: { ...cloudflareAuth(), ...init.headers } });
    const type = r.headers.get('content-type') || '';
    if (!type.includes('json')) { if (!r.ok) throw new Error(model + ' ' + r.status); return new Response(await r.arrayBuffer()).body; }
    const j = await r.json();
    if (!r.ok || j.success === false) { const e = new Error(model + ' ' + r.status + ' ' + JSON.stringify(j.errors || j).slice(0, 200)); e.status = r.status; throw e; }
    if (j.result && j.result.usage && j.result.usage.neurons) neurons += j.result.usage.neurons;
    return j.result;
  },
};
// a KV namespace in memory, with metadata and prefix listing, so the lab's ledger runs here as it does on Cloudflare
const kvStore = new Map();
const LEDGER = {
  async get(k, type) { const v = kvStore.get(k); return v == null ? null : type === 'json' ? JSON.parse(v.value) : v.value; },
  async put(k, value, o = {}) { kvStore.set(k, { value: String(value), metadata: o.metadata }); },
  async list({ prefix = '', limit = 1000 } = {}) { const keys = [...kvStore.keys()].filter(k => k.startsWith(prefix)).sort().slice(0, limit).map(name => ({ name, metadata: kvStore.get(name).metadata })); return { keys, list_complete: true }; },
};
const env = { AI, LEDGER, LAB_GATEWAY: 'ailgen-lab', LAB_BUDGET_USD: '100', ...(flag('--key') ? { LAB_PASSCODE: flag('--key') } : {}) };
const fnDir = path.join(ROOT, s.functions, 'functions');

async function dispatch(request) {
  const url = new URL(request.url), file = path.join(fnDir, url.pathname.replace(/^\/+/, '') + '.js');
  if (!url.pathname.startsWith('/api/') || !fs.existsSync(file)) return null;
  const mod = await import(pathToFileURL(file).href + '?t=' + fs.statSync(file).mtimeMs);
  const h = mod['onRequest' + request.method[0] + request.method.slice(1).toLowerCase()] || mod.onRequest;
  if (!h) return new Response('method not allowed', { status: 405 });
  return h({ request, env, params: {}, waitUntil() {}, next() {} });
}

if (cmd === 'call') {
  const t0 = Date.now();
  const res = await dispatch(new Request('http://localhost/' + route.replace(/^\//, ''), { method: 'POST', headers: { 'content-type': 'application/json', ...(flag('--key') ? { 'x-lab-key': flag('--key') } : {}) }, body: body || '{}' }));
  if (!res) { console.error('no such route'); process.exit(2); }
  const text = await res.text();
  console.log(res.status, ((Date.now() - t0) / 1000).toFixed(1) + 's', neurons ? `${neurons.toFixed(0)} neurons` : '');
  if (flag('--out')) fs.writeFileSync(flag('--out'), text);
  console.log(text.length > 3000 ? text.slice(0, 3000) + ` … (${text.length} chars)` : text);
  process.exit(0);
}

if (cmd === 'serve') {
  const dir = path.join(ROOT, s.dir), port = +(flag('--port') || 8788);
  const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.woff2': 'font/woff2', '.mp4': 'video/mp4', '.ico': 'image/x-icon', '.txt': 'text/plain' };
  http.createServer(async (req, res) => {
    try {
      const chunks = []; for await (const c of req) chunks.push(c);
      const request = new Request('http://localhost:' + port + req.url, { method: req.method, headers: req.headers, body: ['GET', 'HEAD'].includes(req.method) ? undefined : Buffer.concat(chunks) });
      const out = await dispatch(request);
      if (out) { res.writeHead(out.status, Object.fromEntries(out.headers)); res.end(Buffer.from(await out.arrayBuffer())); return; }
      let p = decodeURIComponent(new URL(request.url).pathname); if (p.endsWith('/')) p += 'index.html';
      let f = path.join(dir, p); if (!f.startsWith(dir)) { res.writeHead(403); res.end(); return; }
      if (!fs.existsSync(f) && fs.existsSync(f + '.html')) f += '.html';
      if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); res.end('not found'); return; }
      res.writeHead(200, { 'content-type': types[path.extname(f)] || 'application/octet-stream' }); res.end(fs.readFileSync(f));
    } catch (e) { res.writeHead(500); res.end(String(e.message)); }
  }).listen(port, () => console.log(`  ${name} with its functions: http://localhost:${port}/`));
}
