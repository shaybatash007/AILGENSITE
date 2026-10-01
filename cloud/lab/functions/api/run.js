// AILGEN Lab: run any model this account can reach, with the passcode only its owner knows (GitHub secret LAB_PASSCODE, set on
// the Pages project by tools/site-switch.mjs). Never linked from a site; the page and this route are noindex.
// POST { model, input, kind?, route?, fallback?, estimate? } + header x-lab-key
//   → { ok, ms, kind, text?, image?, images?, video?, audio?, result?, usage?, cost: { usd, src, route, neurons? }, budget? }
// Two ways to pay, one budget:
//   route 'free'     a Workers AI model on the free daily allocation (no gateway; costs nothing until the allocation is spent)
//   route 'credits'  through the AI Gateway LAB_GATEWAY with Unified Billing: the prepaid credits pay. Every model that is not
//                    a Workers AI model (@cf/) goes this way, and so does a free model when `fallback` is on and the free
//                    allocation is spent. Each credits call is recorded in the ledger with the cost from the gateway's log.
// Before a credits call, the lab refuses (402) when the period's spending plus the call's estimate would pass the budget.
//   kind 'flux2'  input { prompt, width, height, steps?, seed? }   FLUX.2 on Workers AI (multipart through the binding)
//   kind 'audio'  input { audio: base64, ... }                       speech to text (whisper takes bytes, the rest base64)
import { json, textOf, same, readJSON, why } from '../../../_shared/ai.js';
import { settings, spent, record, addFree, hasLedger } from '../../ledger.js';
import PAID from '../../../../lab/paid.json' with { type: 'json' };

const b64 = buf => { let s = ''; const u = new Uint8Array(buf); for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000)); return btoa(s); };
const sniff = s => {   // the file type from its first bytes
  const h = atob(String(s).slice(0, 16));
  if (h.startsWith('\xFF\xD8')) return 'image/jpeg';
  if (h.startsWith('\x89PNG')) return 'image/png';
  if (h.startsWith('RIFF')) return h.slice(8, 12) === 'WEBP' ? 'image/webp' : 'audio/wav';
  if (h.startsWith('ID3') || h.charCodeAt(0) === 0xFF) return 'audio/mpeg';
  if (h.startsWith('OggS')) return 'audio/ogg';
  return 'application/octet-stream';
};
const sleep = ms => new Promise(r => setTimeout(r, ms));
const NEURON_USD = 0.011 / 1000;
const PAIDMAP = Object.fromEntries(PAID.groups.flatMap(g => g.models.map(m => [m.id, { ...m, group: g.id }])));

export async function gate(request, env) {
  if (!env.LAB_PASSCODE) return json({ error: 'locked', why: 'no LAB_PASSCODE secret yet' }, 423);
  if (!(await same(request.headers.get('x-lab-key') || '', env.LAB_PASSCODE))) return json({ error: 'wrong passcode' }, 401);
  if (!env.AI) return json({ error: 'no AI binding' }, 503);
  return null;
}

// text out of any provider's own format: chat completions, Anthropic messages, Gemini candidates, Workers AI
function textAny(o) {
  if (!o) return '';
  const t = textOf(o); if (t) return t;
  if (Array.isArray(o.content)) return o.content.filter(b => b.type === 'text').map(b => b.text).join('');
  const parts = o.candidates?.[0]?.content?.parts; if (Array.isArray(parts)) return parts.map(p => p.text || '').join('');
  return o.translated_text || o.text || o.description || '';
}
function tokens(o) {
  const u = o?.usage || o?.usageMetadata || {};
  return { in: u.prompt_tokens ?? u.input_tokens ?? u.promptTokenCount ?? 0, out: u.completion_tokens ?? u.output_tokens ?? u.candidatesTokenCount ?? 0, neurons: u.neurons ?? null };
}

// what a call costs by the published prices, when the gateway's log has no cost yet
function estimate(model, input, out) {
  const p = PAIDMAP[model], tk = tokens(out);
  if (model.startsWith('@cf/')) {
    if (tk.neurons) return tk.neurons * NEURON_USD;
    if (p && p.price && (tk.in || tk.out)) return (tk.in * p.price.in + tk.out * p.price.out) / 1e6;
    if (/flux-2-klein-4b/.test(model)) return Math.ceil((input.width || 1024) / 512) * Math.ceil((input.height || 1024) / 512) * 26.05 * NEURON_USD;
    if (/flux-2-klein-9b/.test(model)) return 0.015;
    if (/flux-2-dev/.test(model)) return Math.ceil((input.width || 1024) / 512) * Math.ceil((input.height || 1024) / 512) * 37.5 * 25 * NEURON_USD;
    return 0;
  }
  if (!p) return 0;
  return before(p, input) ?? (p.price && (tk.in || tk.out) ? (tk.in * p.price.in + tk.out * (p.price.out || 0)) / 1e6 : 0);
}
// the price of a call before it runs (null when it depends on tokens not yet known)
export function before(p, input) {
  if (!p) return null;
  if (p.per === 'image') { const k = input.image_size || input.resolution || input.quality || 'any'; return (p.est[k] ?? Object.values(p.est)[0]) * Math.max(1, +input.max_images || 1); }
  if (p.per === 'megapixel') { const mp = Math.max(1, ((input.width || 1024) * (input.height || 1024)) / 1e6); return p.price.firstMp + Math.max(0, Math.ceil(mp) - 1) * p.price.nextMp; }
  if (p.per === 'second') { const s = parseInt(input.duration, 10) || 5, r = p.rate[input.resolution] ?? Object.values(p.rate)[0]; return s * (r + (input.generate_audio && p.audio ? p.audio : 0)); }
  if (p.per === 'char') return String(input.text || '').length * p.rate;
  return null;
}

async function costFromGateway(env, gw) {
  const id = env.AI.aiGatewayLogId; if (!id) return null;
  for (let i = 0; i < 4; i++) {   // the log is written a moment after the answer
    try { const log = await env.AI.gateway(gw).getLog(id); if (log && log.cost != null) return { usd: +log.cost, log: { id, tokens_in: log.tokens_in, tokens_out: log.tokens_out, provider: log.provider } }; } catch {}
    await sleep(350 * (i + 1));
  }
  return null;
}

async function call(env, model, input, kind, gw) {
  const opts = gw ? { gateway: { id: gw, metadata: { app: 'ailgen-lab' } } } : undefined;
  if (kind === 'flux2') {
    const form = new FormData();
    for (const k of ['prompt', 'width', 'height', 'steps', 'seed', 'guidance']) if (input[k] !== undefined && input[k] !== '') form.append(k, String(input[k]));
    const r = new Response(form);
    return env.AI.run(model, { multipart: { body: r.body, contentType: r.headers.get('content-type') } }, opts);
  }
  if (kind === 'audio' && /whisper$|whisper-tiny/.test(model)) {
    const bin = Uint8Array.from(atob(String(input.audio || '')), c => c.charCodeAt(0));
    return env.AI.run(model, { audio: [...bin] }, opts);
  }
  return env.AI.run(model, input, opts);
}

export async function onRequestPost({ request, env }) {
  const denied = await gate(request, env); if (denied) return denied;
  let body; try { body = await readJSON(request, 12e6); } catch { return json({ error: 'bad request' }, 400); }
  const model = String(body.model || ''), kind = String(body.kind || ''), input = body.input || {};
  if (!/^(@cf\/[\w.-]+\/[\w.@-]+|[a-z0-9-]+\/[\w.:-]+)$/i.test(model)) return json({ error: 'bad model name' }, 400);
  const gw = env.LAB_GATEWAY || 'ailgen-lab', workers = model.startsWith('@cf/');
  let route = !workers || body.route === 'credits' ? 'credits' : 'free';
  const s = await settings(env);
  const gateBudget = async est => {   // the lab's own cap, before any credits call
    if (!hasLedger(env)) return null;
    const { spent: used } = await spent(env, s.period);
    if (used + (est || 0) > s.budget) return json({ ok: false, error: 'budget', why: `ההרצה הזו תעבור את התקציב: הוצאו $${used.toFixed(2)} מתוך $${s.budget}, וההרצה עולה כ-$${(est || 0).toFixed(2)}. אפשר להגדיל את התקציב בלשונית "תקציב".`, budget: { budget: s.budget, spent: used } }, 402);
    return null;
  };
  const pre = workers ? null : before(PAIDMAP[model], input);
  if (route === 'credits') { const stop = await gateBudget(pre || 0); if (stop) return stop; }

  const t0 = Date.now(); let out;
  try {
    try { out = await call(env, model, input, kind, route === 'credits' ? gw : null); }
    catch (e) {   // the free allocation is spent: continue from the credits when the owner allows it
      if (route === 'free' && body.fallback && why(e) === 'quota') { const stop = await gateBudget(0); if (stop) return stop; route = 'credits'; out = await call(env, model, input, kind, gw); }
      else throw e;
    }
  } catch (e) {
    const m = String(e && e.message || e);
    const hint = /gateway/i.test(m) && /not found|does not exist|404/i.test(m) ? `עוד אין Gateway בשם ${gw}: ליצור אותו ב-Cloudflare תחת AI ← AI Gateway, עם Workers AI billing על Unified billing`
      : /credit|insufficient|balance|402/i.test(m) ? 'נגמרו הקרדיטים: טעינה ב-Cloudflare תחת AI ← AI Gateway ← Credits Available'
      : why(e) === 'quota' ? 'המכסה החינמית של היום נוצלה (מתאפסת בחצות UTC). אפשר להפעיל למעלה "להמשיך מהתקציב"' : '';
    return json({ ok: false, ms: Date.now() - t0, route, error: m.slice(0, 600), hint }, 502);
  }
  const ms = Date.now() - t0;

  // the cost: the gateway's own log for credits calls (an estimate until it is written), nothing for the free allocation
  let cost;
  if (route === 'credits') {
    const g = await costFromGateway(env, gw);
    cost = g ? { usd: g.usd, src: 'gateway', route, log: g.log } : { usd: estimate(model, input, out), src: 'estimate', route };
    await record(env, s.period, { model, usd: cost.usd, src: cost.src, ms, kind: kind || (PAIDMAP[model]?.group) || 'call' });
  } else {
    const n = tokens(out).neurons; cost = { usd: 0, src: 'free', route, neurons: n };
    if (n) await addFree(env, n);
  }
  const budget = hasLedger(env) ? { budget: s.budget, spent: (await spent(env, s.period)).spent } : null;
  const base = { ok: true, ms, cost, budget };

  // the answer, whatever its shape: bytes, base64, URLs (third-party media), or text
  if (out instanceof ReadableStream || out instanceof ArrayBuffer || ArrayBuffer.isView(out)) {
    const buf = out instanceof ReadableStream ? await new Response(out).arrayBuffer() : out instanceof ArrayBuffer ? out : out.buffer;
    const b = b64(buf), type = sniff(b), k = type.startsWith('audio') ? 'audio' : 'image';
    return json({ ...base, kind: k, [k]: `data:${type};base64,${b}` });
  }
  const r = out && out.result && typeof out.result === 'object' ? out.result : out;
  const url = v => typeof v === 'string' && /^https?:\/\//.test(v);
  if (r && url(r.video)) return json({ ...base, kind: 'video', video: r.video, result: out });
  if (r && Array.isArray(r.images) && r.images.length) return json({ ...base, kind: 'image', image: r.images[0], images: r.images, result: out });
  if (r && typeof r.image === 'string') return json({ ...base, kind: 'image', image: url(r.image) ? r.image : `data:${sniff(r.image)};base64,${r.image}`, result: url(r.image) ? out : undefined });
  if (r && typeof r.audio === 'string' && !r.text) return json({ ...base, kind: 'audio', audio: url(r.audio) ? r.audio : `data:${sniff(r.audio)};base64,${r.audio}` });
  const text = textAny(out);
  return json({ ...base, kind: text ? 'text' : 'data', text, result: out, usage: out?.usage || out?.usageMetadata || null });
}
