/* AILGEN Lab: every free Workers AI model and the paid models of the AI Gateway catalog, one budget. All calls go to /api/run
   (cloud/lab/functions), behind the passcode; /api/budget is the ledger. */
(() => {
'use strict';
const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const store = { get(k) { try { return localStorage.getItem(k); } catch { return null; } }, set(k, v) { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch {} } };
const secs = ms => (ms / 1000).toFixed(ms < 10000 ? 1 : 0) + 's';
const short = n => n.replace(/^@cf\//, '');
let KEY = store.get('ailgenLabKey') || '', CAT = null, neurons = 0;
const BEST_TEXT = '@cf/openai/gpt-oss-120b', VISION_EXTRA = ['@cf/mistralai/mistral-small-3.1-24b-instruct'];

/* ---------- the server ---------- */
// route: 'free' (the free daily allocation) or 'credits' (the AI Gateway credits, recorded against the budget)
let FALLBACK = store.get('labFallback') === '1', BUDGET = null;
async function call(model, input, kind, route) {
  let r, j;
  route = route || (model.startsWith('@cf/') ? 'free' : 'credits');
  try {
    r = await fetch('/api/run', { method: 'POST', headers: { 'content-type': 'application/json', 'x-lab-key': KEY }, body: JSON.stringify({ model, input, kind, route, fallback: FALLBACK }) });
    j = await r.json();
  } catch (e) { return { ok: false, error: r ? 'HTTP ' + r.status : 'אין חיבור לשרת המעבדה' }; }
  if (r.status === 401 || r.status === 423) { lock(j); return { ok: false, error: j.error }; }
  if (j && j.budget) pill(j.budget);
  if (r.status === 402) return { ok: false, error: j.why || 'התקציב נגמר' };
  const n = j?.cost?.neurons ?? j?.usage?.neurons ?? j?.result?.usage?.neurons;
  if (n) { neurons += n; $('#meter').textContent = Math.round(neurons).toLocaleString('he-IL') + ' נוירונים בסשן'; }
  return j;
}
const money = (v, d) => '$' + (+v || 0).toFixed(d ?? ((+v || 0) && (+v || 0) < 0.01 ? 4 : 2));
function pill(b) {
  BUDGET = b; const p = $('#budgetPill'), used = b.spent / (b.budget || 1);
  p.textContent = `${money(b.spent, 2)} מתוך ${money(b.budget, b.budget < 10 ? 2 : 0)}`;
  p.classList.toggle('warn', used >= .8 && used < 1); p.classList.toggle('out', used >= 1);
}
$('#fb').checked = FALLBACK; $('#fb').onchange = e => { FALLBACK = e.target.checked; store.set('labFallback', FALLBACK ? '1' : '0'); };
$('#budgetPill').onclick = () => { show('budget'); renderBudget(); };
const textOf = j => j.text || (j.result && (j.result.response || j.result.translated_text)) || '';

/* ---------- the lock ---------- */
function lock(j) {
  $('#lock').hidden = false; $('#logout').hidden = true;
  if (j && j.error === 'locked') $('#lockMsg').innerHTML = 'עוד לא נקבע קוד למעבדה. ב-GitHub: Settings ← Secrets and variables ← Actions ← <b>New repository secret</b>, בשם <bdi dir="ltr">LAB_PASSCODE</bdi>, עם סיסמה שבוחרים. אחרי הפרסום הבא היא הקוד כאן.';
  else if (j && j.error === 'wrong passcode') $('#lockErr').textContent = 'הקוד לא נכון.';
  setTimeout(() => $('#lockIn').focus(), 30);
}
$('#lockF').addEventListener('submit', async e => {
  e.preventDefault(); KEY = $('#lockIn').value.trim(); $('#lockErr').textContent = 'בודקים…';
  const r = await fetch('/api/ping', { method: 'POST', headers: { 'x-lab-key': KEY } }).catch(() => null), j = r ? await r.json().catch(() => ({})) : {};
  if (r && r.ok) { store.set('ailgenLabKey', KEY); $('#lock').hidden = true; $('#logout').hidden = false; $('#lockErr').textContent = ''; $('#main').focus(); renderBudget(true); }
  else if (j.error === 'locked') lock(j);
  else $('#lockErr').textContent = r ? 'הקוד לא נכון.' : 'אין חיבור לשרת המעבדה.';
});
$('#logout').onclick = () => { store.set('ailgenLabKey', null); KEY = ''; $('#lockIn').value = ''; lock(); };

/* ---------- tabs ---------- */
function show(tab) {
  $$('#tabs button').forEach(b => b.setAttribute('aria-current', b.dataset.tab === tab ? 'page' : 'false'));
  $$('.pane').forEach(p => p.hidden = p.id !== 'p-' + tab);
  if (location.hash !== '#' + tab) history.replaceState(null, '', '#' + tab);
  if (tab === 'budget' && KEY && typeof renderBudget === 'function') renderBudget();
}
$$('#tabs button').forEach(b => b.addEventListener('click', () => { show(b.dataset.tab); $('#main').focus({ preventScroll: true }); }));

/* ---------- cards ---------- */
function card(into, model, prepend) {
  const c = document.createElement('article'); c.className = 'card';
  c.innerHTML = `<div class="h"><span class="m">${esc(short(model))}</span><span class="st"></span></div><div class="body"><div class="wait">עובד…</div></div>`;
  prepend ? into.prepend(c) : into.appendChild(c); return c;
}
function fill(c, j, render) {
  const st = $('.st', c), body = $('.body', c);
  st.innerHTML = [j.ms != null ? esc(secs(j.ms)) : '', costLabel(j)].filter(Boolean).join(' · ');
  if (!j.ok) { body.innerHTML = `<div class="err" dir="auto">${esc(j.error || 'no answer')}</div>${j.hint ? `<p class="hintx">${esc(j.hint)}</p>` : ''}`; return; }
  body.innerHTML = ''; (render || defaultRender)(body, j);
  const raw = document.createElement('details'); raw.innerHTML = '<summary>JSON</summary><pre></pre>';
  $('pre', raw).textContent = JSON.stringify(j.result ?? { kind: j.kind }, null, 1).slice(0, 20000); body.appendChild(raw);
}
function costLabel(j) {
  const c = j && j.cost; if (!c) { const n = j?.usage?.neurons ?? j?.result?.usage?.neurons; return n ? Math.round(n) + ' neurons' : ''; }
  if (c.src === 'free') return `<span class="cost free">חינם${c.neurons ? ' · ' + Math.round(c.neurons) + ' neurons' : ''}</span>`;
  return `<span class="cost" title="${c.src === 'gateway' ? 'המחיר מהיומן של Cloudflare' : 'הערכה לפי המחירון: היומן עוד לא החזיר מחיר'}">${c.src === 'gateway' ? '' : '~'}${money(c.usd)}</span>`;
}
function defaultRender(body, j) {
  if (j.kind === 'video') { const v = document.createElement('video'); v.controls = true; v.playsInline = true; v.src = j.video; body.appendChild(v); const a = document.createElement('a'); a.href = j.video; a.target = '_blank'; a.rel = 'noopener'; a.textContent = 'פתיחה בחלון'; body.appendChild(a); return; }
  if (j.kind === 'image') { const im = new Image(); im.src = j.image; im.alt = 'תמונה שנוצרה'; im.style.cssText = 'width:100%;border-radius:8px'; body.appendChild(im); return; }
  if (j.kind === 'audio') { const a = document.createElement('audio'); a.controls = true; a.src = j.audio; a.style.width = '100%'; body.appendChild(a); return; }
  const t = document.createElement('div'); t.className = 'tx'; t.dir = 'auto'; t.textContent = textOf(j) || JSON.stringify(j.result).slice(0, 4000); body.appendChild(t);
}
const busy = async (btn, f) => { btn.disabled = true; try { await f(); } finally { btn.disabled = false; } };

/* ---------- selects and picks from the catalog ---------- */
const free = how => CAT.models.filter(m => !m.paid && (Array.isArray(how) ? how.includes(m.how) : m.how === how));
const verdictTag = m => m.note && m.note.verdict === 'best' ? ' ★' : '';
function fillSelect(sel, list, pick) { sel.innerHTML = list.map(m => `<option value="${esc(m.name)}"${m.name === pick ? ' selected' : ''}>${esc(short(m.name))}${verdictTag(m)}</option>`).join(''); }
function fillPicks(fs, list, checked, max) {
  fs.insertAdjacentHTML('beforeend', list.map(m => `<label class="pick${m.paid ? ' paid' : ''}" title="${esc(m.note ? m.note.note : m.about)}"><input type="checkbox" value="${esc(m.name)}"${checked.includes(m.name) ? ' checked' : ''}${m.paid ? ' disabled' : ''}>${esc(short(m.name))}${m.note && m.note.verdict === 'best' ? ' <em>★</em>' : ''}</label>`).join(''));
  if (max) fs.addEventListener('change', e => { const on = $$('input:checked', fs); if (on.length > max) e.target.checked = false; });
}
const picked = fs => $$('input:checked', fs).map(i => i.value);

/* ---------- text ---------- */
function chatInput(sys, msg, max, temp, effort, model) {
  const input = { messages: [...(sys ? [{ role: 'system', content: sys }] : []), { role: 'user', content: msg }], max_tokens: +max || 800 };
  if (temp !== '' && temp != null) input.temperature = +temp;
  const m = CAT.models.find(x => x.name === model);
  if (effort && m && m.reasoning) input.reasoning_effort = effort;
  return input;
}
$('#tGo').onclick = () => busy($('#tGo'), async () => {
  const model = $('#tModel').value, msg = $('#tMsg').value.trim(); if (!msg) return $('#tMsg').focus();
  const c = card($('#tOut'), model, true);
  fill(c, await call(model, chatInput($('#tSys').value.trim(), msg, $('#tMax').value, $('#tTemp').value, $('#tEffort').value, model)));
});
$('#tMsg').addEventListener('keydown', e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) $('#tGo').click(); });

/* ---------- compare ---------- */
$('#cGo').onclick = () => busy($('#cGo'), async () => {
  const ms = picked($('#cPicks')), msg = $('#cMsg').value.trim(); if (!ms.length || !msg) return;
  $('#cOut').innerHTML = '';
  await Promise.all(ms.map(async m => { const c = card($('#cOut'), m); fill(c, await call(m, chatInput($('#cSys').value.trim(), msg, 900, '', 'low', m))); }));
});

/* ---------- image ---------- */
const SIZES = { s: 0.3e6, m: 1.0e6 };
function dims(ratio, size) { const [a, b] = ratio.split(':').map(Number), px = SIZES[size], h = Math.sqrt(px * b / a), w = h * a / b, r = v => Math.max(256, Math.round(v / 16) * 16); return { w: r(w), h: r(h) }; }
function imgCost(model, w, h) {
  const tiles = Math.ceil(w / 512) * Math.ceil(h / 512), mp = w * h / 1e6;
  if (/klein-4b/.test(model)) return tiles * 26; if (/klein-9b/.test(model)) return Math.round((0.015 + Math.max(0, Math.ceil(mp) - 1) * 0.002) / 0.011 * 1000);
  if (/flux-2-dev/.test(model)) return Math.round(tiles * 37.5 * 25); if (/flux-1-schnell/.test(model)) return Math.round(tiles * 4.8 + 4 * 9.6); return null;
}
function updCost() {
  const { w, h } = dims($('#iRatio').value, $('#iSize').value), ms = picked($('#iPicks'));
  const est = ms.map(m => imgCost(m, w, h)).filter(x => x != null).reduce((a, b) => a + b, 0);
  $('#iCost').textContent = `${w}×${h}` + (est ? ` · כ-${est.toLocaleString('he-IL')} נוירונים (הערכה)` : '');
}
['#iRatio', '#iSize'].forEach(s => $(s).addEventListener('change', updCost));
$('#iGo').onclick = () => busy($('#iGo'), async () => {
  const prompt = $('#iPrompt').value.trim(), ms = picked($('#iPicks')); if (!prompt || !ms.length) return $('#iPrompt').focus();
  const { w, h } = dims($('#iRatio').value, $('#iSize').value), seed = $('#iSeed').value;
  await Promise.all(ms.map(async m => {
    const meta = CAT.models.find(x => x.name === m), c = card($('#iOut'), m, true);
    const input = meta.how === 'flux2' ? { prompt, width: w, height: h, ...(seed ? { seed: +seed } : {}) } : meta.how === 'image-json' ? { prompt, steps: 4, ...(seed ? { seed: +seed } : {}) } : { prompt, width: w, height: h, ...(seed ? { seed: +seed } : {}) };
    const j = await call(m, input, meta.how === 'flux2' ? 'flux2' : '');
    fill(c, j, (body, r) => { if (r.kind !== 'image') return defaultRender(body, r); const im = new Image(); im.src = r.image; im.alt = prompt.slice(0, 120); body.appendChild(im); const a = document.createElement('a'); a.href = r.image; a.download = short(m).replace(/\W+/g, '-') + '.' + (r.image.slice(11, 15).replace(/;.*/, '') || 'png'); a.textContent = 'הורדה'; body.appendChild(a); });
  }));
});

/* ---------- vision ---------- */
let VIMG = null;
async function takeImage(file) {
  if (!file || !/^image\//.test(file.type)) return;
  const bmp = await createImageBitmap(file), k = Math.min(1, 1024 / Math.max(bmp.width, bmp.height));
  const cv = document.createElement('canvas'); cv.width = Math.round(bmp.width * k); cv.height = Math.round(bmp.height * k); cv.getContext('2d').drawImage(bmp, 0, 0, cv.width, cv.height);
  VIMG = cv.toDataURL('image/jpeg', 0.88); $('#vPrev').src = VIMG; $('#vPrev').hidden = false; $('#vHint').hidden = true;
}
const drop = $('#vDrop');
drop.onclick = () => $('#vFile').click(); drop.onkeydown = e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); $('#vFile').click(); } };
$('#vFile').onchange = e => takeImage(e.target.files[0]);
drop.addEventListener('dragover', e => { e.preventDefault(); drop.classList.add('over'); });
drop.addEventListener('dragleave', () => drop.classList.remove('over'));
drop.addEventListener('drop', e => { e.preventDefault(); drop.classList.remove('over'); takeImage(e.dataTransfer.files[0]); });
document.addEventListener('paste', e => { if (!$('#p-vision').hidden) { const f = [...(e.clipboardData?.files || [])].find(x => /^image\//.test(x.type)); if (f) takeImage(f); } });
$$('#vQuick button').forEach(b => b.onclick = () => { $('#vQ').value = b.dataset.q; });
$('#vGo').onclick = () => busy($('#vGo'), async () => {
  if (!VIMG) return drop.focus(); const q = $('#vQ').value.trim(), ms = picked($('#vPicks')); if (!ms.length) return;
  $('#vOut').innerHTML = '';
  await Promise.all(ms.map(async m => {
    const meta = CAT.models.find(x => x.name === m), c = card($('#vOut'), m);
    let input;
    if (meta.how === 'vision-bytes') { const bin = atob(VIMG.split(',')[1]); input = { image: Array.from(bin, ch => ch.charCodeAt(0)), prompt: q, max_tokens: 400 }; }
    else input = { messages: [{ role: 'user', content: [{ type: 'text', text: q }, { type: 'image_url', image_url: { url: VIMG } }] }], max_tokens: 500 };
    fill(c, await call(m, input));
  }));
});

/* ---------- translate ---------- */
const LANGS = [['hebrew', 'עברית'], ['english', 'אנגלית'], ['arabic', 'ערבית'], ['russian', 'רוסית'], ['french', 'צרפתית'], ['spanish', 'ספרדית'], ['german', 'גרמנית'], ['italian', 'איטלקית']];
$('#trFrom').innerHTML = LANGS.map(([v, l]) => `<option value="${v}">${l}</option>`).join('');
$('#trTo').innerHTML = LANGS.map(([v, l], i) => `<option value="${v}"${i === 1 ? ' selected' : ''}>${l}</option>`).join('');
$('#trGo').onclick = () => busy($('#trGo'), async () => {
  const text = $('#trText').value.trim(); if (!text) return $('#trText').focus();
  const from = $('#trFrom').value, to = $('#trTo').value, llm = $('#trLlm').value; $('#trOut').innerHTML = '';
  const mt = free('translate').filter(m => !/indic/.test(m.name));
  await Promise.all([
    ...mt.map(async m => { const c = card($('#trOut'), m.name); fill(c, await call(m.name, { text, source_lang: from, target_lang: to })); }),
    (async () => { const c = card($('#trOut'), llm); fill(c, await call(llm, chatInput(`Translate the text from ${from} to ${to} for a professional business website. Keep names, numbers and brand names. Output only the translation.`, text, 1200, '', 'low', llm))); })(),
  ]);
});

/* ---------- speech ---------- */
const b64 = async blob => { const buf = new Uint8Array(await blob.arrayBuffer()); let s = ''; for (let i = 0; i < buf.length; i += 0x8000) s += String.fromCharCode.apply(null, buf.subarray(i, i + 0x8000)); return btoa(s); };
async function transcribe(blob) {
  const m = $('#sModel').value, c = card($('#sOut'), m, true), lang = $('#sLang').value;
  const input = { audio: await b64(blob), ...(lang && /large-v3/.test(m) ? { language: lang } : {}) };
  fill(c, await call(m, input, 'audio'));
}
$('#sFile').onchange = e => { const f = e.target.files[0]; if (f) transcribe(f); };
let rec = null, chunks = [];
$('#sRec').onclick = async () => {
  if (rec && rec.state === 'recording') { rec.stop(); return; }
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true }); chunks = [];
    rec = new MediaRecorder(stream); rec.ondataavailable = e => chunks.push(e.data);
    rec.onstop = () => { stream.getTracks().forEach(t => t.stop()); $('#sRec').textContent = 'הקלטה'; $('#sRec').classList.remove('rec'); $('#sState').textContent = ''; transcribe(new Blob(chunks, { type: rec.mimeType })); };
    rec.start(); $('#sRec').textContent = 'עצירה'; $('#sRec').classList.add('rec'); $('#sState').textContent = 'מקליטים…';
  } catch { $('#sState').textContent = 'אין גישה למיקרופון בדפדפן הזה.'; }
};
$('#ttsGo').onclick = () => busy($('#ttsGo'), async () => {
  const m = $('#ttsModel').value, text = $('#ttsText').value.trim(); if (!text) return;
  const input = /melotts/.test(m) ? { prompt: text, lang: 'en' } : { text };
  const c = card($('#ttsOut'), m, true); fill(c, await call(m, input));
});

/* ---------- search ---------- */
const embedCache = new Map();
$('#seEden').onclick = async () => { const j = await (await fetch('data/eden-products.json')).json(); $('#seDocs').value = j.items.map(x => `${x.t} · ${x.k} · ${x.p} ₪`).join('\n'); $('#seN').textContent = j.items.length + ' פריטים'; };
const cos = (a, b) => { let s = 0, x = 0, y = 0; for (let i = 0; i < a.length; i++) { s += a[i] * b[i]; x += a[i] * a[i]; y += b[i] * b[i]; } return s / Math.sqrt(x * y); };
async function embed(model, texts) {
  const out = [];
  for (let i = 0; i < texts.length; i += 50) { const j = await call(model, { text: texts.slice(i, i + 50) }); if (!j.ok) throw new Error(j.error); out.push(...(j.result.data || j.result)); }
  return out;
}
$('#seGo').onclick = () => busy($('#seGo'), async () => {
  const docs = $('#seDocs').value.split('\n').map(s => s.trim()).filter(Boolean), q = $('#seQ').value.trim(), ms = picked($('#sePicks'));
  if (!docs.length || !q || !ms.length) return; $('#seOut').innerHTML = '';
  await Promise.all(ms.map(async m => {
    const c = card($('#seOut'), m), t0 = performance.now();
    try {
      const key = m + '|' + docs.join('\n'); if (!embedCache.has(key)) embedCache.set(key, await embed(m, docs));
      const dv = embedCache.get(key), [qv] = await embed(m, [q]);
      const top = dv.map((v, i) => [cos(qv, v), i]).sort((a, b) => b[0] - a[0]).slice(0, 6);
      fill(c, { ok: true, ms: performance.now() - t0, kind: 'data', result: { top: top.map(([s, i]) => ({ score: +s.toFixed(3), item: docs[i] })) } }, body => {
        const ol = document.createElement('ol'); ol.style.cssText = 'margin:0;padding-inline-start:20px;display:grid;gap:4px';
        top.forEach(([s, i]) => { const li = document.createElement('li'); li.innerHTML = `<span style="font:500 12px var(--mono);color:var(--amber)">${s.toFixed(3)}</span> ${esc(docs[i])}`; ol.appendChild(li); }); body.appendChild(ol);
      });
    } catch (e) { fill(c, { ok: false, error: e.message }); }
  }));
});

/* ---------- raw ---------- */
const EXAMPLES = {
  chat: { messages: [{ role: 'system', content: 'ענו בעברית, בקצרה.' }, { role: 'user', content: 'מה ההבדל בין הרמת ריסים להארכת ריסים?' }], max_tokens: 400 },
  'chat-vision': { messages: [{ role: 'user', content: [{ type: 'text', text: 'What is in this image?' }, { type: 'image_url', image_url: { url: 'https://upload.wikimedia.org/wikipedia/commons/3/3a/Cat03.jpg' } }] }], max_tokens: 300 },
  flux2: { prompt: 'Soft-focus photograph of a pale blush lotus on still water at dawn, mist, warm cream light', width: 1024, height: 576 },
  'image-json': { prompt: 'a travertine surface in warm window light', steps: 4 },
  image: { prompt: 'a travertine surface in warm window light', width: 1024, height: 576 },
  translate: { text: 'ערכה להרמת ריסים בשלושה שלבים', source_lang: 'hebrew', target_lang: 'english' },
  embed: { text: ['דבק להרמת ריסים', 'פינצטה לגבות'] },
  tts: { text: 'Hello from the studio.' },
  classify: { text: 'I love this kit, it works perfectly.' },
  rerank: { query: 'glue for lash lift', contexts: [{ text: 'Lash lift glue balm' }, { text: 'Brow tweezers' }] },
  asr: { audio: '<base64 audio>' }, 'vision-bytes': { image: '<bytes>', prompt: 'Describe the image' }, raw: {},
};
$('#rModel').addEventListener('change', () => { const m = CAT.models.find(x => x.name === $('#rModel').value); $('#rKind').value = m.how === 'flux2' ? 'flux2' : m.how === 'asr' ? 'audio' : ''; });
$('#rEx').onclick = () => { const m = CAT.models.find(x => x.name === $('#rModel').value); $('#rIn').value = JSON.stringify(EXAMPLES[m.how] || {}, null, 1); };
$('#rGo').onclick = () => busy($('#rGo'), async () => {
  let input; try { input = JSON.parse($('#rIn').value); } catch (e) { const c = card($('#rOut'), 'JSON', true); fill(c, { ok: false, error: 'JSON: ' + e.message }); return; }
  const m = $('#rModel').value, c = card($('#rOut'), m, true); fill(c, await call(m, input, $('#rKind').value));
});

/* ---------- models ---------- */
const VERDICT = { best: 'מומלץ', ok: 'עובד', weak: 'חלש', down: 'לא ענה', untested: 'לא נבדק', 'no-hebrew': 'אין עברית' };
const TRY = { chat: 'text', 'chat-vision': 'text', flux2: 'image', 'image-json': 'image', image: 'image', translate: 'translate', embed: 'search', asr: 'speech', tts: 'speech', 'vision-bytes': 'vision' };
function renderModels() {
  const q = $('#mQ').value.trim().toLowerCase(), task = $('#mTask').value, paid = $('#mPaid').value;
  const list = CAT.models.filter(m => (!task || m.task === task) && (!paid || (paid === 'paid' ? m.paid : !m.paid)) && (!q || (m.name + ' ' + m.about + ' ' + (m.note?.note || '')).toLowerCase().includes(q)));
  $('#mList').innerHTML = list.map(m => `<div class="mrow"><div><div class="n">${esc(short(m.name))}</div><div class="t">${esc(m.task)}${m.context ? ' · ' + (m.context / 1000).toFixed(0) + 'K' : ''}${m.vision ? ' · ראייה' : ''}${m.tools ? ' · כלים' : ''}${m.beta ? ' · בטא' : ''}</div></div>
   <div>${m.paid ? '<span class="badge b-paid">בתשלום</span>' : ''}${m.note ? `<span class="badge b-${esc(m.note.verdict)}">${esc(VERDICT[m.note.verdict] || m.note.verdict)}</span>` : ''}<p dir="ltr" style="text-align:left">${esc(m.about)}</p>${m.note ? `<p class="note">${esc(m.note.note)}</p>` : ''}${m.price ? `<div class="price">${esc(m.price)}</div>` : ''}</div>
   <div>${!m.paid && TRY[m.how] ? `<button class="try" type="button" data-m="${esc(m.name)}" data-tab="${TRY[m.how]}">לנסות</button>` : !m.paid ? `<button class="try" type="button" data-m="${esc(m.name)}" data-tab="raw">JSON</button>` : ''}</div></div>`).join('') || '<p class="lead">אין מודלים שמתאימים לסינון.</p>';
  if (PAID && paid !== 'free') {   // the gateway catalog: paid from the credits, through the lab's budget
    const rows = PAID.groups.flatMap(g => g.models.filter(m => !m.id.startsWith('@cf/') && (!task || task === 'gateway') && (!q || (m.id + ' ' + m.name + ' ' + m.note).toLowerCase().includes(q))).map(m => `<div class="mrow"><div><div class="n">${esc(m.id)}</div><div class="t">${esc(g.title)} · AI Gateway</div></div><div><span class="badge b-paid">בתשלום · קרדיטים</span><p class="note">${esc(m.note)}</p></div><div><button class="try" type="button" data-pg="${g.id}" data-m="${esc(m.id)}">לנסות</button></div></div>`));
    $('#mList').insertAdjacentHTML('beforeend', rows.join(''));
    $$('#mList .try[data-pg]').forEach(b => b.onclick = () => { show('paid'); pgGroup(b.dataset.pg); $$('#pgPicks input').forEach(i => { i.checked = i.value === b.dataset.m; }); pgEstimate(); scrollTo({ top: 0 }); });
  }
  $$('#mList .try:not([data-pg])').forEach(b => b.onclick = () => openWith(b.dataset.m, b.dataset.tab));
}
function openWith(model, tab) {
  show(tab);
  const sel = { text: '#tModel', translate: '#trLlm', speech: /tts|aura|melo/.test(model) ? '#ttsModel' : '#sModel', raw: '#rModel' }[tab];
  if (sel && $(sel)) { $(sel).value = model; $(sel).dispatchEvent(new Event('change')); }
  const fs = { image: '#iPicks', vision: '#vPicks', search: '#sePicks' }[tab];
  if (fs) { $$('input', $(fs)).forEach(i => { i.checked = i.value === model; }); if (tab === 'image') updCost(); }
  $('#main').focus({ preventScroll: true }); scrollTo({ top: 0 });
}
['#mQ', '#mTask', '#mPaid'].forEach(s => $(s).addEventListener('input', renderModels));

/* ---------- bench ---------- */
async function renderBench() {
  const B = await (await fetch('bench.json')).json();
  $('#bLead').textContent = `הרצות אמיתיות מ-${B.date} (${B.plan}). התשובות מצוטטות כמו שהן, מקוצרות.`;
  const vClass = v => /^נכון|^סירב/.test(v || '') ? 'v-right' : /שגוי|לא ענה|השיר|בתשלום/.test(v || '') ? 'v-wrong' : '';
  $('#bList').innerHTML = B.tests.map(t => {
    let body = '';
    if (t.id === 'search') body = `<div class="cols">${t.runs.map(r => `<div class="card"><div class="h"><span class="m">${esc(short(r.model))}</span></div>${r.queries.map(q => `<p style="margin:8px 0 2px;font-weight:600">«${esc(q.q)}» <span class="hint">(מילות מפתח: ${q.keyword})</span></p><ol style="margin:0;padding-inline-start:20px">${q.top.map(x => `<li><span style="font:500 11.5px var(--mono);color:var(--amber)">${x.score.toFixed(3)}</span> ${esc(x.title)}</li>`).join('')}</ol>`).join('')}</div>`).join('')}</div>`;
    else if (t.id === 'images') body = `<div class="gallery">${t.runs.map(r => `<div class="card"><img src="${esc(r.image)}" alt="${esc(r.verdict)}" loading="lazy"><div class="h" style="margin-top:8px"><span class="m">${esc(short(r.model))}</span><span class="st">${secs(r.ms)}</span></div><p class="hint" style="margin:0">${esc(r.verdict)}</p></div>`).join('')}</div>`;
    else body = `${t.image ? `<img src="${esc(t.image)}" alt="" style="width:160px;border-radius:10px;margin-bottom:10px">` : ''}<div class="scroll"><table><thead><tr><th>מודל</th><th>זמן</th><th>נוירונים</th><th>תוצאה</th><th>תשובה</th></tr></thead><tbody>${t.runs.map(r => `<tr><td class="m">${esc(short(r.model))}${r.opts ? `<br><span class="hint">${esc(r.opts)}</span>` : ''}</td><td class="n">${r.ms ? secs(r.ms) : ''}</td><td class="n">${r.neurons || ''}</td><td class="${vClass(r.verdict)}">${esc(r.verdict || '')}</td><td class="a" dir="auto">${esc(r.answer || '')}</td></tr>`).join('')}</tbody></table></div>`;
    return `<section class="bench"><h2>${esc(t.title)}</h2><p class="setup">${esc(t.setup)}</p>${t.correct ? `<p class="correct">התשובה הנכונה: ${esc(t.correct)}</p>` : ''}${body}</section>`;
  }).join('');
}

/* ---------- paid models: one balance, a price before and after every run ---------- */
let PAID = null, PG = 'text';
const PM = id => PAID.groups.flatMap(g => g.models.map(m => ({ ...m, group: g.id }))).find(m => m.id === id);
// the price before a run (the server uses the same rules; the real price comes from the gateway's log)
function before(p, input) {
  if (p.per === 'image') { const k = input.image_size || input.resolution || input.quality || 'any'; return p.est[k] ?? Object.values(p.est)[0]; }
  if (p.per === 'megapixel') { const mp = Math.max(1, ((input.width || 1024) * (input.height || 1024)) / 1e6); return p.price.firstMp + Math.max(0, Math.ceil(mp) - 1) * p.price.nextMp; }
  if (p.per === 'second') { const s = parseInt(input.duration, 10) || 5, r = p.rate[input.resolution] ?? Object.values(p.rate)[0]; return s * (r + (input.generate_audio && p.audio ? p.audio : 0)); }
  if (p.per === 'char') return String(input.text || '').length * p.rate;
  if (p.price) { const inTok = Math.ceil(((input.__chars || 0) + 40) / 3.2), outTok = input.__max || 800; return (inTok * p.price.in + outTok * p.price.out) / 1e6; }
  return 0;
}
const RATIO_PX = { '1:1': [1024, 1024], '16:9': [1344, 768], '9:16': [768, 1344], '4:5': [896, 1120], '3:4': [880, 1184], '21:9': [1536, 656] };
const GPT_SIZE = r => (r === '1:1' ? '1024x1024' : ['16:9', '21:9'].includes(r) ? '1536x1024' : '1024x1536');
function paidInput(p, v) {
  const f = p.fmt;
  if (PG === 'text') {
    const msgs = [...(v.sys ? [{ role: 'system', content: v.sys }] : []), { role: 'user', content: v.msg }], meta = { __chars: (v.sys + v.msg).length, __max: v.max };
    if (f === 'anthropic') return { input: { messages: [{ role: 'user', content: v.msg }], max_tokens: v.max, ...(v.sys ? { system: v.sys } : {}) }, meta };
    if (f === 'gemini') return { input: { contents: [{ role: 'user', parts: [{ text: v.msg }] }], ...(v.sys ? { systemInstruction: { parts: [{ text: v.sys }] } } : {}), generationConfig: { maxOutputTokens: v.max } }, meta };
    return { input: p.id.startsWith('@cf/') ? { messages: msgs, max_tokens: v.max } : { messages: msgs, max_completion_tokens: v.max }, meta };
  }
  if (PG === 'image') {
    const [w, h] = RATIO_PX[v.ratio] || [1024, 1024], big = v.size === '4K' ? 2 : v.size === '2K' ? 1.41 : 1;
    if (f === 'nano-pro') return { input: { prompt: v.prompt, aspect_ratio: v.ratio, output_format: 'png', image_size: v.size } };
    if (f === 'nano-2') return { input: { prompt: v.prompt, aspect_ratio: v.ratio, output_format: 'png', resolution: v.size } };
    if (f === 'gpt-image') return { input: { prompt: v.prompt, size: GPT_SIZE(v.ratio), quality: v.quality, output_format: 'png' } };
    if (f === 'flux-max') return { input: { prompt: v.prompt, width: Math.round(w * big / 16) * 16, height: Math.round(h * big / 16) * 16, output_format: 'png' } };
    if (f === 'seedream') return { input: { prompt: v.prompt, aspect_ratio: v.ratio, size: v.size === '4K' ? '4K' : '2K' } };
  }
  if (PG === 'video') {
    if (f === 'veo') return { input: { prompt: v.prompt, duration: v.dur + 's', aspect_ratio: v.ratio, resolution: v.res === '480p' ? '720p' : v.res, generate_audio: v.audio } };
    if (f === 'seedance') return { input: { prompt: v.prompt, duration: +v.dur, resolution: v.res, aspect_ratio: v.ratio, generate_audio: v.audio } };
  }
  if (PG === 'voice') return { input: { text: v.text, voice_id: v.voice, language_code: v.lang || undefined, output_format: 'mp3_44100_128' } };
  return { input: {} };
}
const FORMS = {
  text: `<label>הוראות (system)<textarea id="pgSys" rows="2" placeholder="למשל: ענו בעברית, בקצרה."></textarea></label><label>הודעה<textarea id="pgMsg" rows="4"></textarea></label><div class="row3"><label>אורך מרבי (טוקנים)<input id="pgMax" type="number" min="16" max="8000" value="800"></label></div>`,
  image: `<label>בקשה (באנגלית עובד הכי טוב)<textarea id="pgPrompt" rows="3" placeholder="Top-down editorial photograph of an empty travertine surface in late-afternoon window light…"></textarea></label><div class="row3"><label>יחס<select id="pgRatio"><option>1:1</option><option selected>16:9</option><option>9:16</option><option>4:5</option><option>3:4</option><option>21:9</option></select></label><label>גודל<select id="pgSize"><option>1K</option><option selected>2K</option><option>4K</option></select></label><label>איכות (GPT Image)<select id="pgQ"><option>low</option><option selected>medium</option><option>high</option></select></label></div>`,
  video: `<label>בקשה<textarea id="pgPrompt" rows="3" placeholder="A dusty-rose satin ribbon lies straight, then slowly lifts at one end into a soft curl. Static camera."></textarea></label><div class="row3"><label>משך (שניות)<select id="pgDur"><option>4</option><option selected>6</option><option>8</option></select></label><label>רזולוציה<select id="pgRes"><option>480p</option><option selected>720p</option><option>1080p</option></select></label><label>יחס<select id="pgRatio"><option selected>16:9</option><option>9:16</option><option>1:1</option></select></label></div><label class="tog" style="font-size:14px;margin-bottom:14px"><input type="checkbox" id="pgAudio"> עם קול</label>`,
  voice: `<label>טקסט<textarea id="pgText" rows="3">שלום, זו הקראה לדוגמה מהמעבדה של AILGEN.</textarea></label><div class="row3"><label>קול (voice_id של ElevenLabs)<input id="pgVoice" value="JBFqnCBsd6RMkjVDRZzb" dir="ltr"></label><label>שפה<select id="pgLang"><option value="he" selected>עברית</option><option value="en">אנגלית</option><option value="ar">ערבית</option><option value="">זיהוי אוטומטי</option></select></label></div>`,
};
const val = id => { const e = $('#' + id); return e ? (e.type === 'checkbox' ? e.checked : e.value) : undefined; };
const pgVals = () => ({ sys: (val('pgSys') || '').trim(), msg: (val('pgMsg') || '').trim(), max: +val('pgMax') || 800, prompt: (val('pgPrompt') || '').trim(), ratio: val('pgRatio'), size: val('pgSize'), quality: val('pgQ'), dur: val('pgDur'), res: val('pgRes'), audio: !!val('pgAudio'), text: (val('pgText') || '').trim(), voice: (val('pgVoice') || '').trim(), lang: val('pgLang') });
function pgEstimate() {
  const v = pgVals(), ms = picked($('#pgPicks')).map(PM).filter(Boolean);
  const sum = ms.reduce((a, p) => { const { input, meta } = paidInput(p, v); return a + before(p, { ...input, ...(meta || {}) }); }, 0);
  $('#pgEst').textContent = ms.length ? `${PG === 'text' ? 'עד ' : 'כ-'}${money(sum)} להרצה${ms.length > 1 ? ` (${ms.length} מודלים)` : ''}${BUDGET ? ` · נשארו ${money(BUDGET.budget - BUDGET.spent, 2)}` : ''}` : '';
  return sum;
}
function pgGroup(id) {
  PG = id; const g = PAID.groups.find(x => x.id === id);
  $$('#pgSeg button').forEach(b => b.setAttribute('aria-selected', String(b.dataset.g === id)));
  const fs = $('#pgPicks'); fs.innerHTML = '<legend>מודלים</legend>';
  const one = id === 'video' || id === 'voice';
  fs.insertAdjacentHTML('beforeend', g.models.map((m, i) => `<label class="pick" title="${esc(m.note)}"><input type="checkbox" value="${esc(m.id)}"${i === 0 ? ' checked' : ''}>${esc(m.name)} <small>${esc(m.note.split(';')[0])}</small></label>`).join(''));
  fs.onchange = e => { if (one && e.target.checked) $$('input', fs).forEach(i => { if (i !== e.target) i.checked = false; }); if (!one && $$('input:checked', fs).length > 4) e.target.checked = false; pgEstimate(); };
  $('#pgForm').innerHTML = FORMS[id]; $('#pgForm').oninput = pgEstimate; $('#pgForm').onchange = pgEstimate; pgEstimate();
}
$('#pgGo').onclick = () => busy($('#pgGo'), async () => {
  const v = pgVals(), ms = picked($('#pgPicks')).map(PM).filter(Boolean); if (!ms.length) return;
  if ((PG === 'text' && !v.msg) || ((PG === 'image' || PG === 'video') && !v.prompt) || (PG === 'voice' && !v.text)) return $('#pgForm textarea')?.focus();
  const est = pgEstimate();
  if (est > 1 && !confirm(`ההרצה תעלה כ-${money(est, 2)} מהתקציב. להמשיך?`)) return;
  $('#pgOut').innerHTML = '';
  await Promise.all(ms.map(async p => { const c = card($('#pgOut'), p.name); const { input } = paidInput(p, v); fill(c, await call(p.id, input, '', 'credits')); }));
  renderBudget(true);
});

/* ---------- budget ---------- */
async function budgetCall(body) {
  const r = await fetch('/api/budget', { method: 'POST', headers: { 'content-type': 'application/json', 'x-lab-key': KEY }, body: JSON.stringify(body || {}) }).catch(() => null);
  return r && r.ok ? r.json() : null;
}
async function renderBudget(quiet) {
  const b = await budgetCall(); if (!b) return;
  if (b.ledger) pill({ budget: b.budget, spent: b.spent });
  if (quiet && $('#p-budget').hidden) return;
  const used = b.ledger ? b.spent / (b.budget || 1) : 0, cls = used >= 1 ? 'out' : used >= .8 ? 'warn' : '';
  $('#bgTiles').innerHTML = b.ledger ? `<div><span>הוצאה</span><b>${money(b.spent, 2)}</b></div><div><span>נשאר</span><b>${money(Math.max(0, b.left), 2)}</b></div><div><span>תקציב</span><b>${money(b.budget, 0)}</b></div><div><span>הרצות בתשלום · חינם היום</span><b>${b.calls} · ${(b.freeToday || 0).toLocaleString('he-IL')}</b></div>` : `<div style="grid-column:1/-1"><span>היומן המרכזי עוד לא מחובר</span><b style="font-size:1.1rem">כל הרצה עדיין מציגה את המחיר שלה; הסיכום והעצירה בתקציב יפעלו אחרי שלב 5 למטה</b></div>`;
  $('#bgBar').style.width = Math.min(100, used * 100) + '%'; $('#bgBar').className = cls;
  if (document.activeElement !== $('#bgIn')) $('#bgIn').value = b.budget;
  $('#bgModels').innerHTML = '<thead><tr><th>מודל</th><th>הרצות</th><th>עלות</th></tr></thead><tbody>' + ((b.byModel || []).map(m => `<tr><td class="m">${esc(short(m.model))}</td><td>${m.calls}</td><td class="n">${money(m.usd)}</td></tr>`).join('') || '<tr><td colspan="3">עוד אין הרצות בתשלום</td></tr>') + '</tbody>';
  $('#bgRecent').innerHTML = '<thead><tr><th>מתי</th><th>מודל</th><th>עלות</th><th>מקור</th></tr></thead><tbody>' + ((b.recent || []).map(c => `<tr><td>${new Date(c.at).toLocaleString('he-IL', { day: 'numeric', month: 'numeric', hour: '2-digit', minute: '2-digit' })}</td><td class="m">${esc(short(c.model || ''))}</td><td class="n">${money(c.usd)}</td><td>${c.src === 'gateway' ? 'יומן' : 'הערכה'}</td></tr>`).join('') || '<tr><td colspan="4">עוד אין הרצות בתשלום</td></tr>') + '</tbody>';
  const D = 'https://dash.cloudflare.com/?to=/:account/ai/ai-gateway';
  $('#bgSetup').innerHTML = [
    `ליצור Gateway בשם <bdi dir="ltr"><b>${esc(b.gateway)}</b></bdi>: <a href="${D}" target="_blank" rel="noopener">AI ← AI Gateway</a> ← Create Gateway, ובשדה <b>Workers AI Billing</b> לבחור <b>Unified billing</b>.`,
    `לטעון קרדיטים: באותו עמוד, בכרטיס <b>Credits Available</b> ← Manage ← Top-up credits. ‏$100 של קרדיטים עולים $105 (עמלה של 5%). לא להפעיל Auto top-up, כדי ש-$100 יהיו תקרה אמיתית.`,
    `תקרה בצד של Cloudflare: Credits Available ← Manage ← spend limit של $100 לחשבון. אפשר גם כלל ל-Gateway עצמו: ${esc(b.gateway)} ← Settings ← Spend limits (למשל $10 ליום).`,
    `התקציב של המעבדה: השדה למעלה (ברירת המחדל $100). המעבדה עוצרת הרצה בתשלום שתעבור אותו.`,
    `היומן המרכזי: ${b.ledger ? '<b class="ok">מחובר</b>' : '<b class="no">עוד לא מחובר</b>. ב-Cloudflare: My Profile ← API Tokens ← הטוקן של הפרסום ← Edit ← להוסיף הרשאה Account · <b>Workers KV Storage</b> · Edit ← Update. הערך של הטוקן לא משתנה, ובפרסום הבא היומן נוצר לבד.'}`,
  ].map(x => `<li>${x}</li>`).join('');
}
$('#bgSave').onclick = async () => { const b = await budgetCall({ set: +$('#bgIn').value }); $('#bgMsg').textContent = b && b.ledger ? 'נשמר.' : 'אי אפשר לשמור בלי היומן המרכזי (שלב 5).'; renderBudget(); };
$('#bgReset').onclick = async () => { if (!confirm('לאפס את ההוצאה ולהתחיל ספירה חדשה? ההרצות הקודמות נשמרות כהיסטוריה.')) return; await budgetCall({ reset: true }); $('#bgMsg').textContent = 'ההוצאה אופסה.'; renderBudget(); };

/* ---------- start ---------- */
(async () => {
  [CAT, PAID] = await Promise.all([fetch('models.json').then(r => r.json()), fetch('paid.json').then(r => r.json())]);
  $('#pgSeg').innerHTML = PAID.groups.map(g => `<button type="button" role="tab" data-g="${g.id}">${esc(g.title)}</button>`).join('');
  $$('#pgSeg button').forEach(b => b.onclick = () => pgGroup(b.dataset.g)); pgGroup('text');
  $('#plan').textContent = `${CAT.free} מודלים חינמיים מתוך ${CAT.count} · ${CAT.plan} · נמדד ${CAT.measuredOn}`;
  $('#mLead').textContent = `${CAT.count} מודלים בחשבון, ${CAT.free} מהם בחינם. ההערות הן מה שהסטודיו מדד בפועל.`;
  fillSelect($('#tModel'), free(['chat', 'chat-vision']), BEST_TEXT);
  fillSelect($('#trLlm'), free(['chat', 'chat-vision']), BEST_TEXT);
  fillSelect($('#rModel'), CAT.models.filter(m => !m.paid), BEST_TEXT);
  fillSelect($('#sModel'), free(['asr', 'raw']).filter(m => /Speech Recognition/.test(m.task)), '@cf/openai/whisper-large-v3-turbo');
  fillSelect($('#ttsModel'), free('tts'), '@cf/deepgram/aura-2-en');
  fillPicks($('#cPicks'), free(['chat', 'chat-vision']), [BEST_TEXT, '@cf/meta/llama-3.3-70b-instruct-fp8-fast', '@cf/meta/llama-4-scout-17b-16e-instruct'], 4);
  fillPicks($('#iPicks'), CAT.models.filter(m => ['flux2', 'image-json', 'image'].includes(m.how)), ['@cf/black-forest-labs/flux-2-klein-4b']);
  fillPicks($('#vPicks'), CAT.models.filter(m => !m.paid && (m.how === 'chat-vision' || m.how === 'vision-bytes' || VISION_EXTRA.includes(m.name))), ['@cf/meta/llama-4-scout-17b-16e-instruct']);
  fillPicks($('#sePicks'), free('embed'), ['@cf/baai/bge-m3']);
  $('#iPicks').addEventListener('change', updCost); updCost();
  const tasks = [...new Set(CAT.models.map(m => m.task))].sort();
  $('#mTask').insertAdjacentHTML('beforeend', tasks.map(t => `<option>${esc(t)}</option>`).join('') + '<option value="gateway">AI Gateway (בתשלום)</option>');
  renderModels(); renderBench();
  const tab = location.hash.slice(1); if (tab && $('#p-' + tab)) show(tab);
  if (!KEY) lock(); else { const r = await fetch('/api/ping', { method: 'POST', headers: { 'x-lab-key': KEY } }).catch(() => null); if (r && r.ok) { $('#logout').hidden = false; renderBudget(true); } else lock(r ? await r.json().catch(() => null) : null); }
})();
})();
