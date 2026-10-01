// AILGEN Lab · the price of one paid call before it runs, from the catalog's own price list (lab/paid.json, Cloudflare's numbers)
// and the exact input that will be sent. The page shows it before a run; the server (cloud/lab/functions/api/run.js) uses the same
// code for the budget gate and as the cost when the gateway's log has none yet. The real cost of every call is the gateway's log.
//   estimate(model, input, { seconds?, used? }) → { usd, kind, lines: [{ label, qty, unit, usd }], note? }
//     kind 'exact'    a fixed price for what was asked (per image, per second at the chosen resolution, per character)
//          'about'    depends on something only known after the run (image tokens, the length of an uploaded file)
//          'upTo'     a ceiling: text models are billed by the tokens they write, and the ceiling is the max-tokens setting
//          'unknown'  no published price for this model; the cost appears after the run
//     seconds   the length of an uploaded audio or video file, measured by the page
//     used      { in, out } tokens from the answer's usage, for the cost after a run

const DEFAULT_MAX_OUT = 4096;            // what a text model may write when the request sets no ceiling (the lab always sets one)
const IMAGE_TOKENS_IN = 1300;            // an attached image, as input tokens (OpenAI, Anthropic and Google land near this for ~1 MP)

const n = v => { const x = typeof v === 'string' ? parseFloat(v) : v; return Number.isFinite(x) ? x : null; };
const low = s => String(s || '').toLowerCase();
const isMedia = s => typeof s === 'string' && (/^data:(image|audio|video)\//.test(s) || /^https?:\/\/\S+\.(png|jpe?g|webp|gif|mp4|webm|mov|mp3|wav|ogg|flac|m4a)(\?|$)/i.test(s));
const isVideo = s => typeof s === 'string' && (/^data:video\//.test(s) || /\.(mp4|webm|mov)(\?|$)/i.test(s));

// what the input holds: characters of text (Latin and other scripts tokenise differently) and attached media
function scan(v, acc = { latin: 0, other: 0, images: 0, videos: 0 }, key = '') {
  if (typeof v === 'string') {
    if (isMedia(v)) { isVideo(v) ? acc.videos++ : /^data:audio|\.(mp3|wav|ogg|flac|m4a)/i.test(v) ? 0 : acc.images++; return acc; }
    if (key === 'data' && v.length > 512) { acc.images++; return acc; }   // Anthropic's base64 image block
    for (let i = 0; i < v.length; i++) v.charCodeAt(i) < 0x250 ? acc.latin++ : acc.other++;
  } else if (Array.isArray(v)) v.forEach(x => scan(x, acc, key));
  else if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) { if (!/^(type|role|media_type|model|voice|voice_id|format|output_format|response_format|reasoning_effort|effort|mode)$/.test(k)) scan(x, acc, k); }
  return acc;
}
const tokensOf = a => Math.ceil(a.latin / 4 + a.other / 2) + 8;

// a price row, read: what it charges for and under which condition
function row(p) {
  const l = low(p.label);
  const ctx = l.match(/(<=|>=|<|>)\s*(\d+)k/), per1m = /per 1m/.test(l);
  return {
    ...p, l, per1m,
    io: /threshold/.test(l) ? 'skip' : /cache creation|cache write/.test(l) ? 'write' : /cached/.test(l) ? 'cached' : /reasoning/.test(l) ? 'reason' : /^(short-context |long-context )?input/.test(l) ? 'in' : /^(short-context |long-context )?output/.test(l) ? 'out' : null,
    media: /image/.test(l) ? 'image' : /audio/.test(l) ? 'audio' : /video/.test(l) ? 'video' : 'text',
    ctx: ctx ? { op: ctx[1], k: +ctx[2] * 1000 } : /short-context/.test(l) ? { op: '<=', k: null } : /long-context/.test(l) ? { op: '>', k: null } : null,
  };
}
const fits = (r, tokens, threshold) => {
  if (!r.ctx) return true;
  const k = r.ctx.k ?? threshold ?? 200000;
  return r.ctx.op === '<=' ? tokens <= k : r.ctx.op === '<' ? tokens < k : r.ctx.op === '>=' ? tokens >= k : tokens > k;
};
const pick = (rows, io, media, tokens, threshold) => rows.find(r => r.per1m && r.io === io && r.media === media && fits(r, tokens, threshold))
  || (media === 'text' ? null : rows.find(r => r.per1m && r.io === io && r.media === 'text' && fits(r, tokens, threshold)));
const line = (label, qty, unit, rate, per = 1) => ({ label, qty, unit, usd: qty * rate / per });

// the output resolution asked for, in one vocabulary: '480p', '720p', '1080p', '4k', '2k', '1k', 'hd', 'fhd'
function resOf(input) {
  for (const k of ['resolution', 'output_resolution', 'quality', 'size', 'image_size', 'video_quality']) {
    const v = low(input[k]); if (!v) continue;
    const m = v.match(/(\d{3,4})\s*p\b/); if (m) return m[1] + 'p';
    if (/\b4k\b|2160/.test(v)) return '4k';
    if (/\b2k\b|1440/.test(v)) return '2k';
    if (/\b1k\b/.test(v)) return '1k';
    if (v === 'fhd' || v === 'hd') return v;
    const wh = v.match(/(\d{3,4})\s*[x×*]\s*(\d{3,4})/); if (wh) { const s = Math.min(+wh[1], +wh[2]); return s >= 2000 ? '4k' : s >= 1000 ? '1080p' : s >= 700 ? '720p' : '480p'; }
  }
  return null;
}
function secondsOf(input, fallback) {
  for (const k of ['duration', 'seconds', 'duration_seconds', 'length', 'video_length']) {
    const v = input[k]; if (v == null || v === '' || v === 'auto') continue;
    const x = n(String(v).replace(/s$/i, '')); if (x) return { s: x, known: true };
  }
  if (input.num_frames && input.fps) return { s: input.num_frames / input.fps, known: true };
  return { s: fallback, known: false };
}
const megapixels = input => {
  const w = n(input.width), h = n(input.height); if (w && h) return w * h / 1e6;
  const r = resOf(input); return r === '4k' ? 8.3 : r === '2k' ? 3.7 : r === '1080p' ? 2.1 : 1;
};
const countImages = input => scan(Object.fromEntries(Object.entries(input).filter(([k]) => !/^(prompt|text|messages|input|contents|negative_prompt)$/.test(k)))).images;

export function estimate(m, input = {}, opt = {}) {
  const rows = (m && m.price || []).map(row), out = { usd: 0, kind: 'exact', lines: [] };
  if (!m) return { usd: null, kind: 'unknown', lines: [] };
  if (!rows.length || m.live === false) return { usd: null, kind: 'unknown', lines: [], note: m.live === false ? 'live' : 'none' };
  const sector = m.sector || ({ text: 'text', image: 'image', video: 'video', audio: 'audio' })[m.out] || 'text';
  const add = (l, kind) => { if (l && l.usd) { out.lines.push(l); out.usd += l.usd; } if (kind && rank[kind] > rank[out.kind]) out.kind = kind; };
  const rank = { exact: 0, about: 1, upTo: 2, unknown: 3 };
  const by = re => rows.find(r => re.test(r.l));
  const threshold = n((rows.find(r => /threshold/.test(r.l)) || {}).usd) || null;

  // per second at a resolution, with or without audio, from a video or not, draft or final
  const perSecond = rows.filter(r => /per second/.test(r.l) && !/^default/.test(r.l));
  const fixedClips = rows.filter(r => /^\d+s @/.test(r.l));
  const named = rows.filter(r => /^(v2v )?(hd|fhd)( draft)?$/.test(r.l));
  const audioOn = input.generate_audio ?? input.with_audio ?? (typeof input.audio === 'boolean' ? input.audio : undefined);
  const fromVideo = ['video', 'reference_video', 'start_video', 'reference_videos', 'video_url'].some(k => input[k] && (Array.isArray(input[k]) ? input[k].length : true));
  const draft = input.draft === true || input.turbo === true;

  if (sector === 'video' && rows.some(r => r.per1m && r.media === 'video')) {   // Gemini Omni: billed by video tokens, unknown before the run
    const a = scan(input), i = pick(rows, 'in', 'text', tokensOf(a), threshold);
    if (i) add(line(i.label, tokensOf(a), 'טוקנים', i.usd, 1e6));
    return { ...out, kind: 'unknown', note: 'video-tokens' };
  }
  if (sector === 'video' && (perSecond.length || fixedClips.length || named.length || by(/^default \(per second\)/))) {
    const { s, known } = secondsOf(input, 5), res = resOf(input);
    if (fixedClips.length) {   // "6s @768p", "8s @720p w/ audio": a price per clip
      const want = r => (!res || r.l.includes('@' + res)) && (/w\/ audio/.test(r.l) === !!audioOn);
      const list = fixedClips.filter(want).map(r => ({ r, d: +r.l.match(/^(\d+)s/)[1] })).sort((a, b) => a.d - b.d);
      const hit = list.find(x => x.d >= s) || list[list.length - 1];
      if (hit) { add(line(hit.r.label, 1, 'סרטון', hit.r.usd), known && res ? 'exact' : 'about'); return out; }
    }
    if (named.length) {        // FLUX video: hd / fhd, from a video or not, draft or final
      const key = (fromVideo || input.mode === 'v2v' ? 'v2v ' : '') + (res === 'fhd' || res === '1080p' ? 'fhd' : 'hd') + (draft ? ' draft' : '');
      const r = named.find(x => x.l === key) || named[0], d = known ? s : 10;
      add(line(r.label + ' · לשנייה', d, 'שניות', r.usd), 'about'); return out;
    }
    const score = r => {
      let sc = 0;
      if (res) sc += r.l.includes('@' + res) ? 4 : /@\d|@[24]k/.test(r.l) ? -4 : 0;
      if (perSecond.some(x => /w\/ audio/.test(x.l))) sc += (/w\/ audio/.test(r.l) === (audioOn !== false)) ? 2 : -2;
      if (perSecond.some(x => /video input/.test(x.l))) sc += (/non-video input/.test(r.l) ? !fromVideo : /video input/.test(r.l) ? fromVideo : false) ? 2 : -2;
      if (perSecond.some(x => /draft/.test(x.l))) sc += (/draft/.test(r.l) === draft) ? 1 : -1;
      return sc;
    };
    const best = perSecond.slice().sort((a, b) => score(b) - score(a))[0] || by(/^default \(per second\)/);
    const r = best && (res || !by(/^default \(per second\)/)) ? best : by(/^default \(per second\)/) || best;
    add(line(r.label, s, 'שניות', r.usd), known && (res || r === by(/^default/)) ? 'exact' : 'about');
    return out;
  }
  if (by(/per megapixel-second/)) {   // video upscale: megapixels of the result × seconds
    const r = (low(input.mode) === 'creative' && by(/^creative/)) || by(/^precise/) || by(/per megapixel-second/);
    const s = opt.seconds || secondsOf(input, 5).s, mp = megapixels(input);
    add(line(r.label, +(mp * s).toFixed(1), 'MP·שניות', r.usd), 'about'); return out;
  }

  // images: per image, per megapixel, or by image tokens
  if (sector === 'image') {
    const count = Math.max(1, n(input.n) || n(input.num_images) || n(input.batch_size) || n(input.max_images) || 1);
    const ins = countImages(input), text = tokensOf(scan({ p: input.prompt, t: input.text, n: input.negative_prompt }));
    const tiered = rows.filter(r => /^per image \(\d+-\d+ mp\)/.test(r.l));
    if (tiered.length) {
      const mp = megapixels(input) * (n(input.scale) || n(input.upscale_factor) || 1) ** 2;
      const r = tiered.find(x => { const [a, b] = x.l.match(/(\d+)-(\d+)/).slice(1).map(Number); return mp <= b; }) || tiered[tiered.length - 1];
      add(line(r.label, count, 'תמונות', r.usd), 'about'); return out;
    }
    const sized = rows.filter(r => /^output size/.test(r.l));
    if (sized.length) {
      const res = resOf(input), r = sized.find(x => res && x.l.endsWith(res)) || sized[0];
      add(line(r.label, count, 'תמונות', r.usd), res ? 'exact' : 'about');
    } else if (by(/^per image$/)) add(line(by(/^per image$/).label, count, 'תמונות', by(/^per image$/).usd), 'exact');
    else if (by(/first output megapixel/)) {
      const mp = Math.max(1, Math.ceil(megapixels(input) - 1e-9));
      for (let i = 0; i < count; i++) {
        add(line(by(/first output megapixel/).label, 1, 'MP', by(/first output megapixel/).usd), 'exact');
        if (mp > 1 && by(/additional output megapixel/)) add(line(by(/additional output megapixel/).label, mp - 1, 'MP', by(/additional output megapixel/).usd));
      }
      if (ins && by(/per input megapixel/)) add(line(by(/per input megapixel/).label, ins, 'MP', by(/per input megapixel/).usd), 'about');
      return out;
    } else if (rows.some(r => r.per1m)) {   // image tokens: OpenAI by quality and size, Google by resolution
      const q = low(input.quality), res = resOf(input), wide = /1536|1792|3:2|2:3|16:9|9:16/.test(low(input.size) + low(input.aspect_ratio));
      const per = /openai\//.test(m.id) ? ({ low: 272, medium: 1056, high: 4160 }[q] || 4160) * (wide ? 1.5 : 1) : res === '4k' ? 2000 : 1290;
      const o = pick(rows, 'out', 'image', 0, threshold) || pick(rows, 'out', 'text', 0, threshold);
      if (o) add(line(o.label, Math.round(per * count), 'טוקנים', o.usd, 1e6), 'about');
      const i = pick(rows, 'in', 'text', text, threshold); if (i) add(line(i.label, text, 'טוקנים', i.usd, 1e6));
      const ii = pick(rows, 'in', 'image', 0, threshold); if (ins && ii) add(line(ii.label, ins * IMAGE_TOKENS_IN, 'טוקנים', ii.usd, 1e6));
      return out;
    }
    if (ins && by(/^per input image/)) add(line(by(/^per input image/).label, ins, 'תמונות קלט', by(/^per input image/).usd));
    if (out.lines.length) return out;
  }

  // voice: per character, or (Gemini) by tokens of text in and audio out
  if (by(/^per character/)) {
    const t = String(input.text ?? input.input ?? input.prompt ?? ''), r = by(/^per character/);
    add(line(r.label, t.length, 'תווים', r.usd), 'exact'); return out;
  }
  // transcription: per minute of audio (+ the options that cost extra)
  if (by(/per (audio )?minute/)) {
    const min = Math.max(1 / 60, (opt.seconds || 60) / 60), q = +min.toFixed(2);
    add(line(by(/per audio minute|^per minute$/).label, q, 'דקות', by(/per audio minute|^per minute$/).usd), opt.seconds ? 'exact' : 'about');
    if (input.speaker_labels && by(/diarization/)) add(line(by(/diarization/).label, q, 'דקות', by(/diarization/).usd));
    if (Array.isArray(input.keyterms_prompt) && input.keyterms_prompt.length && by(/key terms/)) add(line(by(/key terms/).label, q, 'דקות', by(/key terms/).usd));
    if (/medical/.test(low(input.domain) + low(input.speech_model)) && by(/medical/)) add(line(by(/medical/).label, q, 'דקות', by(/medical/).usd));
    return out;
  }
  // music: per second of the track, or a flat price per track
  if (by(/^per track/)) {
    add(line(by(/^per track/).label, 1, 'רצועה', by(/^per track/).usd), 'exact');
    if (input.lyrics_optimizer === true && by(/lyrics/)) add(line(by(/lyrics/).label, 1, '', by(/lyrics/).usd));
    return out;
  }
  if (by(/output audio seconds/)) {
    const ms = n(input.music_length_ms), s = ms ? ms / 1000 : secondsOf(input, 60).s;
    add(line(by(/output audio seconds/).label, Math.round(s), 'שניות', by(/output audio seconds/).usd), ms ? 'exact' : 'about'); return out;
  }

  // text (and anything priced by tokens): the prompt as it is, the answer up to its ceiling
  if (rows.some(r => r.per1m)) {
    const a = scan(input), tin = tokensOf(a) + a.images * IMAGE_TOKENS_IN;
    const used = opt.used && (opt.used.in || opt.used.out) ? opt.used : null;
    const ceiling = n(input.max_completion_tokens) ?? n(input.max_output_tokens) ?? n(input.max_tokens) ?? n(input.generationConfig?.maxOutputTokens) ?? n(input.max_new_tokens);
    const tIn = used ? used.in : tin, tOut = used ? used.out : (ceiling || DEFAULT_MAX_OUT);
    const i = pick(rows, 'in', 'text', tIn, threshold), o = pick(rows, 'out', sector === 'voice' ? 'audio' : 'text', tIn, threshold);
    if (i) add(line(i.label, tIn, 'טוקנים', i.usd, 1e6), used ? 'about' : 'about');
    if (o) {
      // speech out of a token model: about 32 audio tokens a second, about 15 characters of speech a second
      const audioOut = sector === 'voice' ? Math.ceil((a.latin + a.other) / 15 * 32) : null;
      add(line(o.label, audioOut || tOut, 'טוקנים', o.usd, 1e6), used || audioOut ? 'about' : 'upTo');
    }
    if (out.lines.length) return out;
  }
  // a model priced only by a default per-second rate (a few image and voice pages list just that)
  const d = by(/^default \(per second\)/);
  if (d) { add(line(d.label, 1, '', d.usd), 'about'); return out; }
  return { usd: null, kind: 'unknown', lines: [], note: 'none' };
}

// how the page writes it: "$0.40", "≈ $0.013", "עד $0.12"
export function label(e) {
  if (!e || e.usd == null || e.kind === 'unknown') return e && e.note === 'live' ? 'לא רץ בבקשה אחת' : e && e.note === 'video-tokens' ? 'לפי טוקנים: המחיר אחרי ההרצה' : 'אין מחיר מפורסם';
  const v = e.usd, s = v > 0 && v < 0.0001 ? 'פחות מ-$0.0001' : '$' + (v === 0 ? '0' : v < 0.01 ? v.toFixed(4) : v < 1 ? v.toFixed(3) : v.toFixed(2));
  return e.kind === 'upTo' ? 'עד ' + s : e.kind === 'about' ? '≈ ' + s : s;
}
