// AILGEN Lab · reading a model's input schema (lab/schemas/<slug>.json, Cloudflare's own) and building a valid request from it.
// Pure functions, no page: the paid tab (paid.js), AI UNIFIED (unified/engine.js) and the agent's CLI (cloud/lab/unified.mjs)
// all build requests with the same code, so a request that works in one works in the others.

export const CHAT = ['chat', 'anthropic', 'responses', 'gemini'];
export const isChatShape = shape => CHAT.includes(shape);
export const deref = (d, root) => { let x = d || {}; for (let i = 0; i < 4 && x.$ref; i++) x = (root.$defs || root.definitions || {})[x.$ref.split('/').pop()] || {}; return x; };

// the schema's variants (a top-level oneOf / anyOf), each with the shared properties merged in
export function variantsOf(s) {
  const vs = (s.oneOf || s.anyOf || []).filter(v => v && v.properties);
  return vs.length ? vs.map(v => ({ ...v, properties: { ...(s.properties || {}), ...v.properties }, required: [...new Set([...(s.required || []), ...(v.required || [])])] })) : [{ ...s, properties: s.properties || {}, required: s.required || [] }];
}
export const MODE = { t2v: 'טקסט לווידאו', i2v: 'תמונה לווידאו', v2v: 'המשך של וידאו', r2v: 'וידאו מתמונות ייחוס', t2i: 'טקסט לתמונה', i2i: 'עריכת תמונה', edit: 'עריכה', generate: 'יצירה' };
export function vlabel(v, i) {
  const c = Object.entries(v.properties).find(([, d]) => d && d.const !== undefined);
  if (c) return MODE[c[1].const] || String(c[1].const);
  if (v.title) return ({ Prompt: 'פרומפט אחד', Messages: 'שיחה (messages)' })[v.title] || v.title;
  if (v.properties.messages) return 'שיחה (messages)';
  if (v.properties.contents) return 'Gemini (contents)';
  if (v.properties.input) return 'Responses (input)';
  return 'אפשרות ' + (i + 1);
}
export const MEDIA_KEY = /(^|_)(image|images|frame|frames|video|videos|audio|audios|file|mask|pose|person|garment|garments|keyframes|reference|references|start_video|audio_url|image_url|video_url)(_|$)/i;
export const LONG_KEY = /^(prompt|text|lyrics|negative_prompt|instructions?|input|system|voice_script|previous_text|next_text|instruction_prompt|description|style_prompt|script)$/;
export const GLOSS = {
  prompt: 'תיאור', text: 'טקסט', input: 'קלט', lyrics: 'מילים', negative_prompt: 'מה לא להראות', aspect_ratio: 'יחס', ratio: 'יחס', size: 'גודל', image_size: 'גודל', width: 'רוחב', height: 'גובה',
  resolution: 'רזולוציה', quality: 'איכות', duration: 'משך', seed: 'זרע אקראיות', n: 'כמה', num_images: 'כמה', max_images: 'עד כמה', image: 'תמונה', images: 'תמונות', image_input: 'תמונת קלט',
  input_image: 'תמונת קלט', input_images: 'תמונות קלט', reference_images: 'תמונות ייחוס', last_frame_image: 'פריים אחרון', first_frame_image: 'פריים ראשון', start_image: 'תמונת פתיחה', end_image: 'תמונת סיום',
  video: 'וידאו', audio: 'קול', audio_url: 'קובץ קול', file: 'קובץ', generate_audio: 'קול בווידאו', voice_id: 'קול', voice: 'קול', output_format: 'פורמט', format: 'פורמט', style: 'סגנון', language_code: 'שפה',
  language: 'שפה', speed: 'מהירות', mode: 'מצב', draft: 'טיוטה', music_length_ms: 'אורך (מילישניות)', temperature: 'טמפרטורה', mask: 'מסכה', guidance: 'היצמדות לתיאור', steps: 'צעדים',
  person_image: 'תמונת אדם', garment_images: 'בגדים', reference_video: 'וידאו ייחוס', start_video: 'וידאו להמשך', keyframes: 'פריימים', camera_fixed: 'מצלמה קבועה', watermark: 'סימן מים',
  prompt_optimizer: 'שיפור התיאור', is_instrumental: 'בלי שירה', force_instrumental: 'בלי שירה', lyrics_optimizer: 'כתיבת מילים', speaker_labels: 'זיהוי דוברים', background: 'רקע', model_id: 'מודל',
  message: 'הודעה', system: 'הוראות',
};
export const PRIORITY = ['mode', 'prompt', 'text', 'input', 'lyrics', 'image', 'images', 'image_input', 'input_image', 'input_images', 'person_image', 'garment_images', 'start_image', 'first_frame_image', 'keyframes',
  'reference_images', 'last_frame_image', 'end_image', 'video', 'start_video', 'reference_video', 'audio', 'audio_url', 'file', 'voice_id', 'voice', 'aspect_ratio', 'ratio', 'size', 'image_size', 'resolution',
  'quality', 'duration', 'music_length_ms', 'generate_audio', 'is_instrumental', 'n', 'num_images', 'max_images', 'negative_prompt', 'style', 'language_code', 'language', 'speaker_labels'];
export const mediaAccept = (k, desc, sector) => /video/i.test(k) ? 'video/*' : /audio|file|voice/i.test(k) || sector === 'listen' ? 'audio/*' : /image|frame|mask|pose|person|garment|keyframe|reference/i.test(k) ? 'image/*' : /data:video/.test(desc) ? 'video/*' : /data:audio/.test(desc) ? 'audio/*' : 'image/*';

// what kind of value a property takes: const, enum, bool, num, numauto, str, long, list, json, or media (image / audio / video)
export function field(k, d0, root, sector) {
  const d = deref(d0, root), alts = (d.anyOf || d.oneOf || []).map(x => deref(x, root)).filter(x => x && x.type !== 'null');
  const desc = [d.description, ...alts.map(a => a.description)].filter(Boolean).join(' ');
  const types = new Set([d.type, ...alts.map(a => a.type)].flat().filter(Boolean)); types.delete('null');
  const f = { k, desc, def: d.default, title: GLOSS[k] || '' };
  if (d.const !== undefined) return { ...f, t: 'const', v: d.const };
  const enums = d.enum || (alts.length && alts.every(a => a.enum || a.const !== undefined) ? alts.flatMap(a => a.enum || [a.const]) : null);
  if (enums) return { ...f, t: 'enum', options: enums.filter(x => x !== null), num: typeof enums.find(x => x !== null) === 'number' };
  const notMedia = /webhook|callback|_format$|_settings$|^voice_id$|^voice$|_seconds$|_ms$|_labels$|^audio_(start|end)/.test(k) || types.has('boolean') || types.has('number') || types.has('integer');
  if (!notMedia && (MEDIA_KEY.test(k) || /data:(image|audio|video)|base64[- ]encoded|data uri/i.test(desc))) {
    const item = deref(d.items || (alts.find(a => a.type === 'array') || {}).items, root), wrap = (d.type === 'object' && d.properties && d.properties.url) || (item && item.properties && item.properties.url);
    const multi = types.has('array') || d.type === 'array';
    // b64: the provider takes the file itself (base64 / a data: URI), not a link; a link from another model is converted first
    const b64 = /base64|data uri|data:image|data:audio|data:video/i.test(desc) && !/https?|\burl\b|public url/i.test(desc);
    if (types.has('string') || wrap || (item && item.type === 'string')) return { ...f, t: 'media', b64, multi, single: types.has('string') || (d.type === 'object' && !!wrap), wrap: !!wrap, max: Math.max(d.maxItems || 0, ...alts.map(a => a.maxItems || 0)) || (multi ? 8 : 1), accept: mediaAccept(k, desc, sector) };
  }
  if (types.has('boolean') && types.size === 1) return { ...f, t: 'bool' };
  if ([...types].every(t => t === 'integer' || t === 'number') && types.size) { const src = d.type ? d : alts[0] || d; return { ...f, t: 'num', int: types.has('integer') && !types.has('number'), min: src.minimum, max: src.maximum }; }
  if ((types.has('integer') || types.has('number')) && alts.some(a => a.const === 'auto' || (a.enum || []).includes('auto'))) return { ...f, t: 'numauto' };
  if (types.size === 1 && types.has('string')) return { ...f, t: LONG_KEY.test(k) || (d.maxLength || 0) > 600 ? 'long' : 'str' };
  if (d.type === 'array' && deref(d.items, root).type === 'string') return { ...f, t: 'list' };
  return { ...f, t: 'json' };
}
export const fieldsOf = (v, root, sector) => Object.fromEntries(Object.entries(v.properties).map(([k, d]) => [k, field(k, d, root, sector)]));

// the variant an input belongs to: its consts agree, most of its keys exist there, fewest required keys missing
export function bestVariant(vs, input) {
  let best = 0, score = -Infinity;
  vs.forEach((v, i) => {
    const keys = Object.keys(input), cons = Object.entries(v.properties).filter(([, d]) => d && d.const !== undefined);
    if (cons.some(([k, d]) => input[k] !== undefined && input[k] !== d.const)) return;
    const sc = keys.filter(k => v.properties[k]).length * 2 - keys.filter(k => !v.properties[k]).length * 3 - v.required.filter(k => input[k] === undefined && !(v.properties[k] && v.properties[k].const !== undefined)).length;
    if (sc > score) { score = sc; best = i; }
  });
  return best;
}

/* ---------- chat: one set of parameters, four wire formats (OpenAI chat, OpenAI Responses, Anthropic, Gemini) ---------- */
export function chatCaps(m, schema) {
  const vs = variantsOf(schema), shape = m.shape;
  const v = shape === 'chat' ? vs.find(x => x.properties.messages && (x.properties.max_completion_tokens || !x.properties.system)) || vs[0]
    : shape === 'anthropic' ? vs.find(x => x.properties.messages) : shape === 'responses' ? vs.find(x => x.properties.input) : vs.find(x => x.properties.contents);
  const p = (v && v.properties) || {}, en = d => { d = deref(d, schema); return d.enum || ((d.anyOf || d.oneOf || []).map(x => deref(x, schema)).find(x => x.enum) || {}).enum || null; };
  const effort = shape === 'chat' ? (p.reasoning_effort && en(p.reasoning_effort)) : shape === 'responses' ? (p.reasoning && deref(p.reasoning, schema).properties && en(deref(p.reasoning, schema).properties.effort))
    : shape === 'anthropic' ? (p.output_config && deref(p.output_config, schema).properties && en(deref(p.output_config, schema).properties.effort)) : null;
  // max_completion_tokens when the schema also has an Anthropic-style variant, so the request matches exactly one of them
  const both = vs.filter(x => x.properties.messages).length > 1;
  const maxKey = shape === 'chat' ? (p.max_completion_tokens && (/^openai\//.test(m.id) || !p.max_tokens || both) ? 'max_completion_tokens' : 'max_tokens') : shape === 'anthropic' ? 'max_tokens' : shape === 'responses' ? 'max_output_tokens' : 'maxOutputTokens';
  const temp = shape === 'gemini' ? true : !!p.temperature;
  return { effort: effort && effort.filter(x => x !== null), maxKey, temp, thinking: shape === 'anthropic' && !!p.thinking };
}
export const dataParts = d => ({ mime: d.slice(5, d.indexOf(';')), data: d.slice(d.indexOf(',') + 1) });
export function buildChat(shape, c, { msg, sys, max, temp, effort, img, hist = [] }) {
  const b64 = dataParts;
  if (shape === 'anthropic') {
    const content = img ? [{ type: 'image', source: img.startsWith('data:') ? { type: 'base64', media_type: b64(img).mime, data: b64(img).data } : { type: 'url', url: img } }, { type: 'text', text: msg }] : msg;
    return { messages: [...hist, { role: 'user', content }], max_tokens: max, ...(sys ? { system: sys } : {}), ...(temp !== undefined ? { temperature: temp } : {}), ...(effort ? { output_config: { effort } } : {}) };
  }
  if (shape === 'responses') {
    const turn = { role: 'user', content: [{ type: 'input_text', text: msg }, ...(img ? [{ type: 'input_image', image_url: img }] : [])] };
    return { input: hist.length || img ? [...hist.map(h => ({ role: h.role, content: h.content })), turn] : msg, max_output_tokens: max, ...(sys ? { instructions: sys } : {}), ...(temp !== undefined ? { temperature: temp } : {}), ...(effort ? { reasoning: { effort } } : {}) };
  }
  if (shape === 'gemini') {
    const parts = [{ text: msg }, ...(img && img.startsWith('data:') ? [{ inlineData: { mimeType: b64(img).mime, data: b64(img).data } }] : [])];
    return { contents: [...hist.map(h => ({ role: h.role === 'assistant' ? 'model' : 'user', parts: [{ text: h.content }] })), { role: 'user', parts }], ...(sys ? { systemInstruction: { parts: [{ text: sys }] } } : {}), generationConfig: { maxOutputTokens: max, ...(temp !== undefined ? { temperature: temp } : {}) } };
  }
  const content = img ? [{ type: 'text', text: msg }, { type: 'image_url', image_url: { url: img } }] : msg;
  return { messages: [...(sys ? [{ role: 'system', content: sys }] : []), ...hist, { role: 'user', content }], [c.maxKey]: max, ...(temp !== undefined ? { temperature: temp } : {}), ...(effort ? { reasoning_effort: effort } : {}) };
}
// the other way: the parameters inside a request already built (a node's saved settings, an example)
export function chatParams(shape, input = {}) {
  const textOf = c => typeof c === 'string' ? c : Array.isArray(c) ? c.map(x => x.text || '').join(' ') : '';
  const msgs = input.messages || [], lastUser = msgs.filter(x => x.role === 'user').pop();
  const msg = shape === 'gemini' ? textOf(((input.contents || []).filter(c => c.role !== 'model').pop() || {}).parts)
    : shape === 'responses' ? (typeof input.input === 'string' ? input.input : textOf(((input.input || []).filter(x => x.role === 'user').pop() || {}).content)) : textOf(lastUser && lastUser.content);
  const sys = shape === 'anthropic' ? (typeof input.system === 'string' ? input.system : '') : shape === 'responses' ? input.instructions || ''
    : shape === 'gemini' ? textOf((input.systemInstruction || {}).parts) : textOf((msgs.find(x => x.role === 'system') || {}).content);
  const max = input.max_tokens ?? input.max_completion_tokens ?? input.max_output_tokens ?? input.generationConfig?.maxOutputTokens;
  const temp = input.temperature ?? input.generationConfig?.temperature;
  const effort = input.reasoning_effort ?? input.reasoning?.effort ?? input.output_config?.effort;
  return { msg, sys, max, temp, effort };
}
export const exampleText = input => { const m = (input.messages || []).filter(x => x.role === 'user').pop(); return String((m && (typeof m.content === 'string' ? m.content : (m.content || []).map(c => c.text || '').join(' '))) || input.input || input.prompt || ''); };

/* ---------- a full request from a few values: the paid tab's compare, and every AI UNIFIED model node ---------- */
export const nearest = (opts, want) => { const n = v => parseFloat(String(v).replace(/[^\d.]/g, '')) || 0; return opts.slice().sort((a, b) => Math.abs(n(a) - n(want)) - Math.abs(n(b) - n(want)))[0]; };
const mediaValue = (f, vals) => { const w = f.wrap ? vals.map(url => ({ url })) : vals; return f.multi && !(f.single && w.length === 1) ? w.slice(0, f.max || w.length) : w[0]; };

// the ports a model exposes in a flow: its prompts and text fields, its media fields; one output of its own kind
export function portsOf(m, s) {
  const out = [{ key: 'out', kind: m.out || 'text' }];
  if (isChatShape(m.shape)) return { ins: [{ key: 'message', kind: 'text', req: true, label: 'הודעה' }, { key: 'system', kind: 'text', label: 'הוראות' }, { key: 'image', kind: 'image', label: 'תמונה' }], outs: out };
  const root = s.schema, vs = variantsOf(root), seen = new Map();
  for (const v of vs) for (const [k, d] of Object.entries(v.properties)) {
    if (seen.has(k) || /^(stream|webhook.*|callback_url|hf_api_token|websocket|user|metadata)$/.test(k)) continue;
    const f = field(k, d, root, m.group);
    if (f.t === 'media') seen.set(k, { key: k, kind: f.accept.split('/')[0], b64: f.b64, many: f.multi && !f.single ? 'list' : f.multi ? 'one-or-list' : false, max: f.max, label: f.title || k, req: vs.every(x => x.required.includes(k)) });
    else if (f.t === 'long' || (f.t === 'str' && LONG_KEY.test(k))) seen.set(k, { key: k, kind: 'text', label: f.title || k, req: vs.every(x => x.required.includes(k)) });
  }
  const ins = [...seen.values()].sort((a, b) => (b.req - a.req) || ((PRIORITY.indexOf(a.key) + 1 || 99) - (PRIORITY.indexOf(b.key) + 1 || 99)));
  return { ins, outs: out };
}

// base: the node's saved request (or nothing: the page's own first example is the base); bound: { field: value | [values] }
export function assemble(m, s, base, bound = {}) {
  if (isChatShape(m.shape)) {
    const caps = chatCaps(m, s.schema), p = chatParams(m.shape, base || (s.examples && s.examples[0] && s.examples[0].input) || {});
    const msg = bound.message != null ? String(bound.message) : p.msg, sys = bound.system != null ? String(bound.system) : p.sys;
    if (!msg) return { error: 'חסרה הודעה למודל', need: ['message'] };
    return { input: buildChat(m.shape, caps, { msg, sys, max: +p.max || 1024, temp: p.temp, effort: p.effort, img: Array.isArray(bound.image) ? bound.image[0] : bound.image }) };
  }
  const root = s.schema, vs = variantsOf(root), ex = (s.examples || [])[0];
  const fromExample = !base, start = base ? JSON.parse(JSON.stringify(base)) : {};
  // the variant: the one the saved request is in, moved to one that has the bound fields when needed
  const keys = { ...start, ...Object.fromEntries(Object.keys(bound).map(k => [k, true])) };
  const vi = bestVariant(vs, keys), v = vs[vi], F = fieldsOf(v, root, m.group);
  let input = {};
  if (fromExample && ex) { for (const [k, x] of Object.entries(ex.input)) if (F[k] && F[k].t !== 'media' && F[k].t !== 'const') input[k] = x; }
  else for (const [k, x] of Object.entries(start)) if (F[k]) input[k] = x;
  for (const [k, f] of Object.entries(F)) if (f.t === 'const') input[k] = f.v;
  for (const [k, val] of Object.entries(bound)) {
    const f = F[k]; if (!f || val == null || val === '') continue;
    const vals = (Array.isArray(val) ? val : [val]).map(String);
    if (f.t === 'media') input[k] = mediaValue(f, vals);
    else if (f.t === 'enum') input[k] = f.options.includes(vals[0]) ? vals[0] : nearest(f.options, vals[0]);
    else if (f.t === 'num') input[k] = +vals[0];
    else if (f.t === 'list') input[k] = vals;
    else input[k] = vals.join('\n\n');
  }
  for (const k of v.required) if (input[k] === undefined && F[k] && F[k].def !== undefined) input[k] = F[k].def;   // required with a default
  const miss = v.required.filter(k => input[k] === undefined);
  if (miss.length) return { error: 'חסר בבקשה: ' + miss.join(', '), need: miss, variant: vi };
  return { input, variant: vi };
}

// a simple brief (prompt, ratio, seconds, resolution, audio, reference image…) put into this model's own fields
export function briefInput(m, s, b) {
  if (isChatShape(m.shape)) return { input: buildChat(m.shape, chatCaps(m, s.schema), { msg: b.msg, sys: b.sys, max: b.max, img: null, hist: [] }) };
  const root = s.schema, vs = variantsOf(root), ex = (s.examples || [])[0];
  const needs = v => v.required.filter(k => field(k, v.properties[k], root, m.group).t === 'media');
  let vi = vs.findIndex(v => b.ref ? needs(v).length <= 1 && needs(v).every(k => /image|frame|keyframe/.test(k)) && needs(v).length : !needs(v).length);
  if (vi < 0) vi = vs.findIndex(v => !needs(v).length); if (vi < 0) vi = 0;
  const v = vs[vi], F = fieldsOf(v, root, m.group), input = {};
  if (ex) for (const [k, x] of Object.entries(ex.input)) if (F[k] && F[k].t !== 'media' && F[k].t !== 'const') input[k] = x;
  for (const [k, f] of Object.entries(F)) if (f.t === 'const') input[k] = f.v;
  for (const k of v.required) if (input[k] === undefined && F[k] && F[k].def !== undefined) input[k] = F[k].def;
  const set = (keys, val) => { const k = keys.find(x => F[x]); if (k == null || val == null || val === '') return; const f = F[k];
    if (f.t === 'enum') { const o = f.options.includes(val) ? val : nearest(f.options, val); if (o != null) input[k] = o; }
    else if (f.t === 'num' || f.t === 'numauto') input[k] = Math.min(f.max ?? 1e9, Math.max(f.min ?? -1e9, +String(val).replace(/[^\d.]/g, '')));
    else if (f.t === 'bool') input[k] = !!val; else input[k] = val; };
  set(['prompt', 'text', 'input'], m.group === 'voice' ? b.text : b.prompt);
  if (b.ratio) { const k = ['aspect_ratio', 'ratio'].find(x => F[x]); if (k && F[k].t === 'enum') { const o = F[k].options.find(o => String(o) === b.ratio) || F[k].options.find(o => { const [w, h] = String(o).split(/[:x]/).map(Number), [a, c] = b.ratio.split(':').map(Number); return w && h && Math.abs(w / h - a / c) < 0.02; }); if (o) input[k] = o; } else set(['aspect_ratio'], b.ratio); }
  if (b.dur) { const f = F.duration; if (f && f.t === 'enum') input.duration = nearest(f.options, b.dur); else set(['duration', 'seconds'], b.dur); }
  if (b.res) { const f = F.resolution; if (f && f.t === 'enum') input.resolution = f.options.find(o => String(o).toLowerCase() === b.res) || f.options.find(o => /^(hd)$/i.test(o) && b.res === '720p') || f.options.find(o => /^fhd$/i.test(o) && b.res === '1080p') || nearest(f.options, b.res); }
  if (b.audio != null && F.generate_audio) input.generate_audio = b.audio;
  if (b.len) { if (F.music_length_ms) input.music_length_ms = b.len * 1000; else set(['duration'], b.len); }
  const media = (want, val) => { if (!val) return; const k = Object.keys(F).filter(k => F[k].t === 'media' && F[k].accept.startsWith(want)).sort((a, c) => (PRIORITY.indexOf(a) + 1 || 99) - (PRIORITY.indexOf(c) + 1 || 99))[0]; if (k) input[k] = mediaValue(F[k], [val]); };
  media('image', b.ref); media('audio', b.aud);
  const miss = v.required.filter(k => input[k] === undefined);
  if (miss.some(k => F[k] && F[k].t === 'media')) return { error: F[miss.find(k => F[k].t === 'media')].accept.startsWith('image') ? 'המודל הזה צריך תמונה: מוסיפים תמונת פתיחה למעלה' : 'המודל הזה צריך קובץ קלט' };
  return miss.length ? { error: 'חסר בבקשה: ' + miss.join(', ') } : { input };
}
