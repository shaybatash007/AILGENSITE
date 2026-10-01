// AILGEN Lab: run any Workers AI model this account can use, with the passcode only its owner knows (GitHub secret
// LAB_PASSCODE, set on the Pages project by tools/site-switch.mjs). Never linked from a site; the page and this route are noindex.
// POST { model, input, kind? } + header x-lab-key → { ok, ms, kind, text?, image?, audio?, result?, usage? }
//   kind 'flux2'  input { prompt, width, height, steps?, seed? }   FLUX.2 (multipart through the binding)
//   kind 'audio'  input { audio: base64, ... }                       speech to text (whisper takes bytes, the rest base64)
//   anything else: input goes to the model as is (chat, translation, embeddings, classification, speech out, older image models)
import { json, textOf, same, readJSON } from '../../../_shared/ai.js';

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

export async function gate(request, env) {
  if (!env.LAB_PASSCODE) return json({ error: 'locked', why: 'no LAB_PASSCODE secret yet' }, 423);
  if (!(await same(request.headers.get('x-lab-key') || '', env.LAB_PASSCODE))) return json({ error: 'wrong passcode' }, 401);
  if (!env.AI) return json({ error: 'no AI binding' }, 503);
  return null;
}

export async function onRequestPost({ request, env }) {
  const denied = await gate(request, env); if (denied) return denied;
  let body; try { body = await readJSON(request, 12e6); } catch { return json({ error: 'bad request' }, 400); }
  const model = String(body.model || ''), kind = String(body.kind || ''), input = body.input || {};
  if (!/^@cf\/[\w.-]+\/[\w.@-]+$/.test(model)) return json({ error: 'bad model name' }, 400);
  const t0 = Date.now();
  try {
    let out;
    if (kind === 'flux2') {
      const form = new FormData();
      for (const k of ['prompt', 'width', 'height', 'steps', 'seed', 'guidance']) if (input[k] !== undefined && input[k] !== '') form.append(k, String(input[k]));
      const r = new Response(form);
      out = await env.AI.run(model, { multipart: { body: r.body, contentType: r.headers.get('content-type') } });
    } else if (kind === 'audio' && /whisper$|whisper-tiny/.test(model)) {
      const bin = Uint8Array.from(atob(String(input.audio || '')), c => c.charCodeAt(0));
      out = await env.AI.run(model, { audio: [...bin] });
    } else {
      out = await env.AI.run(model, input);
    }
    const ms = Date.now() - t0;
    if (out instanceof ReadableStream || out instanceof ArrayBuffer || ArrayBuffer.isView(out)) {
      const buf = out instanceof ReadableStream ? await new Response(out).arrayBuffer() : out instanceof ArrayBuffer ? out : out.buffer;
      const s = b64(buf), type = sniff(s);
      return json({ ok: true, ms, kind: type.startsWith('audio') ? 'audio' : 'image', [type.startsWith('audio') ? 'audio' : 'image']: `data:${type};base64,${s}` });
    }
    if (out && typeof out.image === 'string') return json({ ok: true, ms, kind: 'image', image: `data:${sniff(out.image)};base64,${out.image}` });
    if (out && typeof out.audio === 'string' && !out.text) return json({ ok: true, ms, kind: 'audio', audio: `data:${sniff(out.audio)};base64,${out.audio}` });
    const text = textOf(out) || out?.translated_text || out?.text || out?.description || '';
    return json({ ok: true, ms, kind: text ? 'text' : 'data', text, result: out, usage: out?.usage || null });
  } catch (e) {
    return json({ ok: false, ms: Date.now() - t0, error: String(e && e.message || e).slice(0, 600) }, 502);
  }
}
