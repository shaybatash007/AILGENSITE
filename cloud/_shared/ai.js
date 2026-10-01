// The server side of every surface on Cloudflare Pages: one Workers AI binding (env.AI), no key anywhere.
// Each surface's functions live in cloud/<surface>/functions/ and import this file; tools/site-switch.mjs deploys them with
// the binding declared in a generated wrangler.toml. Measured choices (references/12-visual-production.md, 2026-10-01):
// gpt-oss-120b answers Hebrew from facts best; reasoning_effort "low" cuts its time to about a second for a short answer.

// Each attempt is a model and its options; the first clean answer wins. Measured on Eden (2026-10-01): gpt-oss-120b with
// reasoning_effort "low" answers correctly in about 4 s and keeps to the rules; without it, it is right but takes 10-13 s and can
// spend its token budget on reasoning; Llama 4 Scout is fast but recommended a single step as a starter kit, so a shop agent
// falls back to the page's fixed answers rather than to it.
export const MODELS = {
  answer: [{ model: '@cf/openai/gpt-oss-120b', opts: { reasoning_effort: 'low' } }, { model: '@cf/openai/gpt-oss-120b', opts: { max_tokens: 1400 } }],
  json: [{ model: '@cf/openai/gpt-oss-120b', opts: { reasoning_effort: 'low' } }, { model: '@cf/meta/llama-3.3-70b-instruct-fp8-fast', opts: {} }],
  draft: '@cf/black-forest-labs/flux-2-klein-4b',
};

export const json = (data, status = 200, extra = {}) => new Response(JSON.stringify(data), {
  status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'x-robots-tag': 'noindex', ...extra },
});

// the text of any Workers AI answer: chat completions, the legacy {response}, or the Responses API output list
export function textOf(r) {
  if (r == null) return '';
  if (typeof r === 'string') return r;
  if (typeof r.response === 'string') return r.response;
  const c = r.choices && r.choices[0] && r.choices[0].message && r.choices[0].message.content;
  if (typeof c === 'string') return c;
  if (typeof r.output_text === 'string') return r.output_text;
  if (Array.isArray(r.output)) return r.output.filter(o => o.type === 'message').flatMap(o => o.content || []).map(x => x.text || '').join('');
  return '';
}

// plain text for a chat bubble: no markdown marks, no runs of blank lines
export const plain = s => String(s || '').replace(/\*\*|__|^#+\s*/gm, '').replace(/^\s*[-*•]\s+/gm, '· ').replace(/\n{3,}/g, '\n\n').trim();

// an answer that leaked the model's reasoning, or that loops on one word, is not an answer
export const broken = s => /^\s*(analysis|assistantfinal|<\|)/i.test(s) || /(\S{2,})(\s+\1){6,}/.test(s);

// try each attempt in order; the first clean text wins
export async function answer(env, attempts, input, ok = s => s.trim() && !broken(s)) {
  let last = null;
  for (const a of attempts) {
    const { model, opts = {} } = typeof a === 'string' ? { model: a } : a;
    try {
      const r = await env.AI.run(model, { ...input, ...opts });
      const text = textOf(r);
      if (ok(text)) return { model, text, usage: r.usage || null };
      last = new Error('no clean answer from ' + model);
    } catch (e) { last = e; }
  }
  throw last || new Error('no model answered');
}

// JSON out of a model answer, even when it wraps it in prose or a code fence
export function parseJSON(text) {
  const s = String(text || ''), a = s.indexOf('{'), b = s.lastIndexOf('}');
  if (a < 0 || b <= a) return null;
  try { return JSON.parse(s.slice(a, b + 1)); } catch { return null; }
}

// FLUX.2 takes a multipart form through the binding and answers { image: base64 }; this returns a data URI
export async function image(env, model, prompt, w, h) {
  const form = new FormData();
  form.append('prompt', prompt); form.append('width', String(w)); form.append('height', String(h));
  let out;
  for (let i = 0; i < 2 && !out; i++) {   // the first call to a cold image model can time out; one retry, never more
    const r = new Response(form);
    try { out = await env.AI.run(model, { multipart: { body: r.body, contentType: r.headers.get('content-type') } }); }
    catch (e) { if (i) throw e; }
  }
  const b64 = out && (out.image || (out.result && out.result.image));
  if (!b64) throw new Error('no image from ' + model);
  return 'data:' + (b64.startsWith('/9j/') ? 'image/jpeg' : b64.startsWith('UklG') ? 'image/webp' : 'image/png') + ';base64,' + b64;
}

// a page may call its own functions; another site may not (a browser always sends Origin on a cross-site POST)
export function sameOrigin(request) {
  const o = request.headers.get('origin');
  if (!o) return true;
  try { return new URL(o).host === new URL(request.url).host; } catch { return false; }
}

// best effort, per isolate: enough to stop one visitor from emptying the day's free allocation in a loop
const hits = new Map();
export function throttle(request, key, max, windowMs) {
  const ip = request.headers.get('cf-connecting-ip') || 'local', k = key + ':' + ip, now = Date.now();
  const list = (hits.get(k) || []).filter(t => now - t < windowMs);
  if (list.length >= max) { hits.set(k, list); return false; }
  list.push(now); hits.set(k, list);
  if (hits.size > 5000) hits.clear();
  return true;
}

// constant-time comparison of two strings through their SHA-256
export async function same(a, b) {
  const enc = new TextEncoder();
  const [x, y] = await Promise.all([a, b].map(s => crypto.subtle.digest('SHA-256', enc.encode(String(s || '')))));
  const p = new Uint8Array(x), q = new Uint8Array(y); let d = 0;
  for (let i = 0; i < p.length; i++) d |= p[i] ^ q[i];
  return d === 0;
}

// why a route could not answer, in one word, so the owner can tell a spent daily allocation from a missing binding
export const why = e => { const m = String((e && e.message) || e || ''); return /allocation|neurons|429/i.test(m) ? 'quota' : /5035|Workers Paid/i.test(m) ? 'paid-only' : 'model'; };

export async function readJSON(request, maxBytes = 64000) {
  const t = await request.text();
  if (t.length > maxBytes) throw new Error('too large');
  return JSON.parse(t || '{}');
}
