// AILGEN Lab: run any model this account can reach, with the passcode only its owner knows (GitHub secret LAB_PASSCODE, set on
// the Pages project by tools/site-switch.mjs). Never linked from a site; the page and this route are noindex.
// POST { model, input, kind?, route?, fallback?, hint?: { seconds }, dry? } + header x-lab-key
//   → { ok, ms, kind, text?, image?, images?, video?, audio?, result?, usage?, cost: { usd, src, route, neurons? }, estimate?, budget? }
//   dry: true checks the model, the input's price and the budget, and stops before the call (nothing is spent)
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
import { estimate as priceOf } from '../../../../lab/price.js';

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
// the paid catalog (cloud/lab/catalog-paid.mjs): every model the credits pay for, by sector and tier
const PAIDMAP = Object.fromEntries(PAID.groups.flatMap(g => Object.entries(g.tiers).flatMap(([tier, list]) => list.map(m => [m.id, { ...m, group: g.id, tier }]))));

export async function gate(request, env) {
  if (!env.LAB_PASSCODE) return json({ error: 'locked', why: 'no LAB_PASSCODE secret yet' }, 423);
  if (!(await same(request.headers.get('x-lab-key') || '', env.LAB_PASSCODE))) return json({ error: 'wrong passcode' }, 401);
  if (!env.AI) return json({ error: 'no AI binding' }, 503);
  return null;
}

// text out of any provider's own format: chat completions, OpenAI Responses, Anthropic messages, Gemini candidates, Workers AI
function textAny(o) {
  if (!o) return '';
  if (o.state && o.result && typeof o.result === 'object') return textAny(o.result);
  const t = textOf(o); if (t) return t;
  if (typeof o.output_text === 'string' && o.output_text) return o.output_text;
  if (Array.isArray(o.output)) { const x = o.output.flatMap(i => Array.isArray(i.content) ? i.content : []).filter(c => typeof c.text === 'string').map(c => c.text).join(''); if (x) return x; }
  if (Array.isArray(o.content)) return o.content.filter(b => b.type === 'text').map(b => b.text).join('');
  const parts = o.candidates?.[0]?.content?.parts; if (Array.isArray(parts)) return parts.map(p => p.text || '').join('');
  if (o.answers && typeof o.answers === 'object') return JSON.stringify(o.answers, null, 1);
  return o.translated_text || o.text || o.description || '';
}
// the first media the answer points to, wherever the provider put it (result.video, task.content.url, images[0].url…)
function mediaAny(o, want, depth = 0) {
  if (!o || depth > 5) return null;
  if (typeof o === 'string') return /^data:(image|video|audio)\//.test(o) || /^https:\/\//.test(o) ? o : null;
  if (Array.isArray(o)) { for (const x of o) { const m = mediaAny(x, want, depth + 1); if (m) return m; } return null; }
  if (typeof o !== 'object') return null;
  const keys = Object.keys(o).sort((a, b) => (b === want) - (a === want) || /url|uri/.test(b) - /url|uri/.test(a));
  for (const k of keys) if (!/^(id|model|prompt|headers|status|error|usage|gatewayMetadata|object|created.*|webhook.*|callback.*)$/.test(k)) { const m = mediaAny(o[k], want, depth + 1); if (m) return m; }
  return null;
}
function tokens(o) {
  const u = o?.usage || o?.usageMetadata || {};
  return { in: u.prompt_tokens ?? u.input_tokens ?? u.promptTokenCount ?? 0, out: u.completion_tokens ?? u.output_tokens ?? u.candidatesTokenCount ?? 0, neurons: u.neurons ?? null };
}

// what a call costs by the published prices, when the gateway's log has no cost yet
function estimate(model, input, out, hint) {
  const p = PAIDMAP[model], tk = tokens(out);
  if (p) return priceOf(p, input, { seconds: hint.seconds, used: tk.in || tk.out ? tk : null }).usd || 0;
  if (model.startsWith('@cf/')) {
    if (tk.neurons) return tk.neurons * NEURON_USD;
    if (/flux-2-klein-4b/.test(model)) return Math.ceil((input.width || 1024) / 512) * Math.ceil((input.height || 1024) / 512) * 26.05 * NEURON_USD;
    if (/flux-2-klein-9b/.test(model)) return 0.015;
    if (/flux-2-dev/.test(model)) return Math.ceil((input.width || 1024) / 512) * Math.ceil((input.height || 1024) / 512) * 37.5 * 25 * NEURON_USD;
    return 0;
  }
  return 0;
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
  const model = String(body.model || ''), kind = String(body.kind || ''), input = body.input && typeof body.input === 'object' ? body.input : {};
  if (!/^(@cf\/[\w.-]+\/[\w.@-]+|[a-z0-9-]+\/[\w.:-]+)$/i.test(model)) return json({ error: 'bad model name' }, 400);
  const gw = env.LAB_GATEWAY || 'ailgen-lab', workers = model.startsWith('@cf/'), p = PAIDMAP[model];
  const hint = { seconds: Math.min(7200, Math.max(0, +(body.hint && body.hint.seconds) || 0)) || undefined };
  if (!workers && !p) return json({ ok: false, error: 'not in the catalog', hint: 'המודל לא בקטלוג של המעבדה. הקטלוג מתעדכן מ-Cloudflare עם node cloud/lab/catalog-paid.mjs ונכנס בפרסום הבא.' }, 400);
  if (p && p.live === false) return json({ ok: false, error: 'realtime only', hint: 'המודל הזה עובד רק בשיחה בזמן אמת (WebSocket), ולכן אי אפשר להריץ אותו בבקשה אחת במעבדה.' }, 400);
  // a paid model always goes through the credits; a free Workers AI model, only when asked (or on fallback)
  let route = !workers || p || body.route === 'credits' ? 'credits' : 'free';
  const s = await settings(env);
  const gateBudget = async est => {   // the lab's own cap, before any credits call
    if (!hasLedger(env)) return null;
    const { spent: used } = await spent(env, s.period);
    if (used + (est || 0) > s.budget) return json({ ok: false, error: 'budget', why: `ההרצה הזו תעבור את התקציב: הוצאו $${used.toFixed(2)} מתוך $${s.budget}, וההרצה עולה כ-$${(est || 0).toFixed(2)}. אפשר להגדיל את התקציב בלשונית "תקציב".`, budget: { budget: s.budget, spent: used } }, 402);
    return null;
  };
  const pre = p ? priceOf(p, input, hint) : null;
  if (route === 'credits') { const stop = await gateBudget(pre && pre.usd || 0); if (stop) return stop; }
  if (body.dry) return json({ ok: true, dry: true, route, estimate: pre, budget: hasLedger(env) ? { budget: s.budget, spent: (await spent(env, s.period)).spent } : null });

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
    cost = g ? { usd: g.usd, src: 'gateway', route, log: g.log } : { usd: estimate(model, input, out, hint), src: 'estimate', route };
    await record(env, s.period, { model, usd: cost.usd, src: cost.src, ms, kind: kind || (p && p.group) || 'call' });
  } else {
    const n = tokens(out).neurons; cost = { usd: 0, src: 'free', route, neurons: n };
    if (n) await addFree(env, n);
  }
  const budget = hasLedger(env) ? { budget: s.budget, spent: (await spent(env, s.period)).spent } : null;
  const base = { ok: true, ms, cost, budget, estimate: pre || undefined };

  // the answer, whatever its shape: bytes, base64, URLs (third-party media), or text
  if (out instanceof ReadableStream || out instanceof ArrayBuffer || ArrayBuffer.isView(out)) {
    const buf = out instanceof ReadableStream ? await new Response(out).arrayBuffer() : out instanceof ArrayBuffer ? out : out.buffer;
    const b = b64(buf), type = sniff(b), k = type.startsWith('audio') ? 'audio' : 'image';
    return json({ ...base, kind: k, [k]: `data:${type};base64,${b}` });
  }
  const r = out && out.result && typeof out.result === 'object' ? out.result : out;
  const url = v => typeof v === 'string' && /^https?:\/\//.test(v);
  if (r && url(r.video)) return json({ ...base, kind: 'video', video: r.video, result: out });
  // images as URLs, as base64, or as { url } / { b64_json } objects, depending on the provider
  const img = x => typeof x === 'string' ? (url(x) || x.startsWith('data:') ? x : `data:${sniff(x)};base64,${x}`) : x && (x.url || (x.b64_json && `data:image/png;base64,${x.b64_json}`)) || null;
  if (r && Array.isArray(r.images) && r.images.length) { const list = r.images.map(img).filter(Boolean); if (list.length) return json({ ...base, kind: 'image', image: list[0], images: list, result: list.every(url) ? out : undefined }); }
  if (r && typeof r.image === 'string') return json({ ...base, kind: 'image', image: url(r.image) ? r.image : `data:${sniff(r.image)};base64,${r.image}`, result: url(r.image) ? out : undefined });
  if (r && typeof r.audio === 'string' && !r.text) return json({ ...base, kind: 'audio', audio: url(r.audio) ? r.audio : `data:${sniff(r.audio)};base64,${r.audio}` });
  if (r && typeof r.audio === 'string' && url(r.audio)) return json({ ...base, kind: 'audio', audio: r.audio, result: out });
  // a paid model's media in a place of its own (a task object, a list of { url }): its sector says what to look for
  if (p && p.out && p.out !== 'text') {
    const m = mediaAny(r, p.out);
    if (m) return json({ ...base, kind: p.out, [p.out]: m, result: out });
    if (out && out.state && out.state !== 'Completed') return json({ ...base, ok: false, error: `state: ${out.state}`, result: out }, 502);
  }
  const text = textAny(out);
  return json({ ...base, kind: text ? 'text' : 'data', text, result: out, usage: out?.usage || out?.usageMetadata || out?.result?.usage || null });
}
