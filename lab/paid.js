/* AILGEN Lab · the paid catalog. Every model the credits pay for (lab/paid.json, built from Cloudflare's own catalog by
   cloud/lab/catalog-paid.mjs), by sector and by tier, and every one runnable end to end: the form is built from the model's
   own input schema (lab/schemas/<slug>.json), the price is computed before the run from the same input (price.js, shared with
   the server), and the real cost comes back from the gateway's log. */
import { estimate, label } from './price.js';
import { variantsOf, vlabel, PRIORITY, field, bestVariant as bestOf, chatCaps as capsOf, chatParams, buildChat, exampleText as exText, briefInput, isChatShape } from './schema.js';

const L = window.LAB, $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = L.esc, store = { get(k) { try { return localStorage.getItem(k); } catch { return null; } }, set(k, v) { try { localStorage.setItem(k, v); } catch {} } };
const PAID = await fetch('paid.json').then(r => r.json());
const ALL = PAID.groups.flatMap(g => Object.entries(g.tiers).flatMap(([tier, list]) => list.map((m, i) => ({ ...m, group: g.id, tier, rank: i }))));
const BY = Object.fromEntries(ALL.map(m => [m.id, m]));
const TIERS = [
  ['top', 'מובחרים', 'מודל הדגל של כל יצרן: האיכות הגבוהה ביותר, והמחיר בהתאם.'],
  ['mid', 'בינוניים', 'מאוזנים: איכות גבוהה במחיר נמוך יותר, או הדגל של הדור הקודם.'],
  ['low', 'חלשים', 'זולים ומהירים: Lite, Mini, Nano ו-Turbo, דורות קודמים וכלי עזר. מתאימים למשימות פשוטות ולכמויות.'],
];
const TIER_NAME = Object.fromEntries(TIERS.map(([k, t]) => [k, t]));
const SECTOR_LEAD = {
  text: 'כתיבה, ניתוח, קוד ושיחה. המחיר לפי טוקנים: מה שנכנס ומה שהמודל כותב. התקרה נקבעת לפי "אורך מרבי".',
  image: 'יצירה ועריכה של תמונות. רוב המודלים גובים מחיר קבוע לתמונה, ו-Nano Banana ו-GPT Image גובים לפי טוקנים של תמונה.',
  video: 'וידאו מטקסט, מתמונה ומווידאו. המחיר לשנייה, לפי הרזולוציה ולפי אם יש קול. כדאי לבדוק בטיוטה קצרה לפני סרטון ארוך.',
  voice: 'הקראה של טקסט. המחיר לפי תווים, ולכן הקראה של משפט עולה פחות מאגורה.',
  listen: 'תמלול של קבצי קול. המחיר לדקה של הקלטה.',
  music: 'מוזיקה מקורית לפי תיאור: לפי שנייה של רצועה, או מחיר קבוע לרצועה.',
};

/* ---------- prices on the card: the unit the provider bills by ---------- */
const usd = v => '$' + (v >= 1 ? (+v.toFixed(2)).toString() : v >= 0.01 ? (+v.toFixed(3)).toString() : (+v.toPrecision(2)).toString());
const range = vs => { const a = Math.min(...vs), b = Math.max(...vs); return a === b ? usd(a) : `${usd(a)}–${usd(b)}`; };
function brief(m) {
  const P = m.price || [], has = re => P.filter(x => re.test(x.label.toLowerCase()));
  if (!P.length) return 'אין מחיר מפורסם';
  const tin = has(/^(short-context )?input( text)?( <=?\s*\d+k)? \(per 1m/)[0], tout = has(/^(short-context )?output( text| audio)?( <=?\s*\d+k)? \(per 1m/)[0];
  if ((m.group === 'text') && tin && tout) return `קלט ${usd(tin.usd)} · פלט ${usd(tout.usd)} למיליון טוקנים`;
  if (m.group === 'video') {
    const ps = has(/per second/).filter(x => !/^default/i.test(x.label)), clips = has(/^\d+s @/), named = has(/^(v2v )?(hd|fhd)( draft)?$/);
    if (ps.length) return range(ps.map(x => x.usd)) + ' לשנייה';
    if (clips.length) return range(clips.map(x => x.usd)) + ' לסרטון';
    if (named.length) return range(named.map(x => x.usd)) + ' לשנייה';
    if (has(/megapixel-second/).length) return range(has(/megapixel-second/).map(x => x.usd)) + ' למגה-פיקסל-שנייה';
    if (has(/^default \(per second\)/).length && !tin) return usd(has(/^default/)[0].usd) + ' לשנייה';
  }
  if (has(/^per image \(\d/).length) return 'מ-' + usd(Math.min(...has(/^per image \(/).map(x => x.usd))) + ' לתמונה';
  if (has(/^output size/).length) return range(has(/^output size/).map(x => x.usd)) + ' לתמונה';
  if (has(/^per image$/).length) return usd(has(/^per image$/)[0].usd) + ' לתמונה';
  if (has(/first output megapixel/).length) return usd(has(/first output megapixel/)[0].usd) + ' למגה-פיקסל';
  if (has(/^per character/).length) return usd(has(/^per character/)[0].usd * 1000) + ' ל-1,000 תווים';
  if (has(/per audio minute/).length) return usd(has(/per audio minute/)[0].usd) + ' לדקה';
  if (has(/^per track/).length) return usd(has(/^per track/)[0].usd) + ' לרצועה';
  if (has(/output audio seconds/).length) return usd(has(/output audio seconds/)[0].usd * 60) + ' לדקה';
  if (m.group === 'image') { const e = estimate(m, STD.image); return label(e) + ' לתמונה'; }
  if (tin && tout) return `קלט ${usd(tin.usd)} · פלט ${usd(tout.usd)} למיליון טוקנים`;
  return label(estimate(m, STD[m.group] || {}));
}
// one reference job per sector, to sort by price: 1,000 tokens in and out, one square image, 5 s of 720p, 1,000 characters, a minute
const STD = {
  text: { messages: [{ role: 'user', content: 'x'.repeat(4000) }], max_tokens: 1000 },
  image: { prompt: 'x', aspect_ratio: '1:1' },
  video: { prompt: 'x', duration: 5, resolution: '720p', generate_audio: false },
  voice: { text: 'x'.repeat(1000) },
  listen: {},
  music: { prompt: 'x', music_length_ms: 60000 },
};
const refPrice = m => { const e = estimate(m, STD[m.group] || {}, { seconds: 60 }); return e.usd == null || e.kind === 'unknown' ? Infinity : e.usd; };

/* ---------- the catalog: sector tabs, three tiers, cards ---------- */
let SECTOR = store.get('labSector') && PAID.groups.some(g => g.id === store.get('labSector')) ? store.get('labSector') : 'text';
const PICKED = new Set();
const hay = m => (m.id + ' ' + m.name + ' ' + m.provider + ' ' + (m.note || '') + ' ' + m.about + ' ' + m.task).toLowerCase();
const badges = m => [
  m.wai ? '<span class="badge b-wai" title="רץ ב-Workers AI של Cloudflare. בלי Workers Paid, רק מהקרדיטים">Workers AI</span>' : '',
  m.zdr ? '<span class="badge b-zdr" title="Zero data retention: הספק לא שומר את מה שנשלח">ZDR</span>' : '',
  m.beta ? '<span class="badge b-untested">בטא</span>' : '',
  m.live === false ? '<span class="badge b-down">לא רץ כאן</span>' : '',
].join('');
function cardHTML(m) {
  const text = m.note || m.about, he = !!m.note;
  return `<article class="mc${m.live === false ? ' off' : ''}" data-id="${esc(m.id)}">
   ${m.cover ? `<div class="cov"><img src="${esc(m.cover)}" alt="" loading="lazy" decoding="async"></div>` : m.demo ? `<div class="cov vid"><span>▶ סרטון לדוגמה</span></div>` : ['image', 'video'].includes(m.group) ? `<div class="cov ph"><span dir="ltr">${esc(m.provider)}</span></div>` : ''}
   <div class="mch"><span class="pv">${esc(m.provider)}</span><span class="bd">${badges(m)}</span></div>
   <h3><button type="button" class="open" data-open="${esc(m.id)}">${esc(m.name)}</button></h3>
   <p class="nt"${he ? '' : ' dir="ltr"'}>${esc(text.length > 150 ? text.slice(0, 147) + '…' : text)}</p>
   <div class="mcf"><span class="pr">${esc(brief(m))}</span>${m.live === false ? '' : `<label class="cmp"><input type="checkbox" data-cmp="${esc(m.id)}"${PICKED.has(m.id) ? ' checked' : ''}> להשוואה</label>`}</div>
  </article>`;
}
function renderSeg() {
  $('#pdSeg').innerHTML = PAID.groups.map(g => { const n = Object.values(g.tiers).reduce((a, l) => a + l.length, 0); return `<button type="button" role="tab" data-g="${g.id}" aria-selected="${g.id === SECTOR}">${esc(g.title)} <small>${n}</small></button>`; }).join('');
  $$('#pdSeg button').forEach(b => b.onclick = () => { SECTOR = b.dataset.g; store.set('labSector', SECTOR); PICKED.clear(); renderSeg(); renderProv(); render(); });
}
function renderProv() {
  const provs = [...new Set(ALL.filter(m => m.group === SECTOR).map(m => m.provider))].sort((a, b) => a.localeCompare(b));
  $('#pdProv').innerHTML = `<option value="">כל היצרנים</option>` + provs.map(p => `<option>${esc(p)}</option>`).join('');
}
function render() {
  const q = $('#pdQ').value.trim().toLowerCase(), prov = $('#pdProv').value, sort = $('#pdSort').value;
  let shown = 0;
  $('#pdTiers').innerHTML = `<p class="slead">${esc(SECTOR_LEAD[SECTOR] || '')}</p>` + TIERS.map(([t, title, why]) => {
    let list = ALL.filter(m => m.group === SECTOR && m.tier === t && (!prov || m.provider === prov) && (!q || hay(m).includes(q)));
    if (sort !== 'tier') list = list.slice().sort((a, b) => sort === 'cheap' ? refPrice(a) - refPrice(b) : refPrice(b) - refPrice(a));
    shown += list.length;
    return `<section class="tier t-${t}" aria-labelledby="tier-${t}"><header><h2 id="tier-${t}">${title} <span>${list.length}</span></h2><p>${why}</p></header>
     ${list.length ? `<div class="mgrid">${list.map(cardHTML).join('')}</div>` : '<p class="empty">אין כאן מודלים שמתאימים לחיפוש.</p>'}</section>`;
  }).join('');
  const total = ALL.filter(m => m.group === SECTOR).length;
  $('#pdCount').textContent = shown === total ? `${total} מודלים` : `${shown} מתוך ${total}`;
  $$('#pdTiers [data-open]').forEach(b => b.onclick = () => open(b.dataset.open));
  $$('#pdTiers .cov').forEach(c => c.onclick = () => open(c.closest('.mc').dataset.id));
  $$('#pdTiers [data-cmp]').forEach(i => i.onchange = () => pick(i));
  tray();
}
function pick(i) {
  if (i.checked && PICKED.size >= 4) { i.checked = false; $('#pdTrayTxt').textContent = 'אפשר להשוות עד 4 מודלים בכל פעם.'; return; }
  i.checked ? PICKED.add(i.dataset.cmp) : PICKED.delete(i.dataset.cmp); tray();
}
function tray() {
  $('#pdTray').hidden = !PICKED.size;
  $('#pdTrayTxt').textContent = PICKED.size === 1 ? 'נבחר מודל אחד. אפשר לבחור עוד עד 3.' : `נבחרו ${PICKED.size} מודלים להשוואה`;
  $('#pdCmp').disabled = PICKED.size < 2;
}
$('#pdClear').onclick = () => { PICKED.clear(); $$('#pdTiers [data-cmp]').forEach(i => { i.checked = false; }); tray(); };
['#pdQ', '#pdProv', '#pdSort'].forEach(s => $(s).addEventListener('input', render));

/* ---------- media: upload, link, or a result from this session ---------- */
const SESSION = [];   // { url, kind, model }
async function fileToData(file) {
  if (/^image\//.test(file.type) && file.size > 3.5e6) {   // big photos: shrink before sending (the request is capped at 12 MB)
    const bmp = await createImageBitmap(file), k = Math.min(1, 2048 / Math.max(bmp.width, bmp.height));
    const cv = document.createElement('canvas'); cv.width = Math.round(bmp.width * k); cv.height = Math.round(bmp.height * k); cv.getContext('2d').drawImage(bmp, 0, 0, cv.width, cv.height);
    return cv.toDataURL('image/jpeg', 0.9);
  }
  if (file.size > 8.5e6) throw new Error('הקובץ גדול מ-8.5MB. אפשר להעלות אותו לאחסון ולהדביק קישור.');
  return new Promise((ok, no) => { const r = new FileReader(); r.onload = () => ok(r.result); r.onerror = no; r.readAsDataURL(file); });
}
const mediaKind = v => /^data:video|\.(mp4|webm|mov)(\?|$)/i.test(v) ? 'video' : /^data:audio|\.(mp3|wav|ogg|flac|m4a)(\?|$)/i.test(v) ? 'audio' : 'image';
function seconds(src) { return new Promise(ok => { const a = document.createElement(/video/.test(mediaKind(src)) ? 'video' : 'audio'); a.preload = 'metadata'; a.onloadedmetadata = () => ok(isFinite(a.duration) ? a.duration : 0); a.onerror = () => ok(0); a.src = src; }); }
function thumbs(el) {
  const vals = el._vals || [];
  $('.thumbs', el).innerHTML = vals.map((v, i) => { const k = mediaKind(v); return `<span class="th">${k === 'image' ? `<img src="${esc(v)}" alt="">` : `<i>${k === 'video' ? '🎬' : '♪'}</i>`}<button type="button" data-rm="${i}" aria-label="הסרה">✕</button></span>`; }).join('');
  $$('[data-rm]', el).forEach(b => b.onclick = () => { vals.splice(+b.dataset.rm, 1); thumbs(el); changed(); });
  $('.madd', el).hidden = vals.length >= el._max;
}
function wireMedia(el) {
  el._vals = el._vals || [];
  const file = $('input[type=file]', el), url = $('.murl', el);
  $('[data-act=file]', el).onclick = () => file.click();
  file.onchange = async () => {
    for (const f of [...file.files].slice(0, el._max - el._vals.length)) {
      try { const d = await fileToData(f); el._vals.push(d); if (/^(audio|video)\//.test(f.type)) CUR.seconds = await seconds(d); } catch (e) { alert(e.message); }
    }
    file.value = ''; thumbs(el); changed();
  };
  $('[data-act=url]', el).onclick = () => { url.hidden = !url.hidden; if (!url.hidden) $('input', url).focus(); };
  $('button', url).onclick = () => { const v = $('input', url).value.trim(); if (/^https:\/\//.test(v)) { el._vals.push(v); $('input', url).value = ''; url.hidden = true; thumbs(el); changed(); } else $('input', url).setCustomValidity('קישור שמתחיל ב-https://'), $('input', url).reportValidity(); };
  $('[data-act=prev]', el).onclick = () => {
    const box = $('.mprev', el), want = el._accept.split('/')[0], list = SESSION.filter(s => s.kind === want);
    box.hidden = !box.hidden;
    box.innerHTML = list.length ? list.map((s, i) => `<button type="button" data-i="${i}" title="${esc(s.model)}">${s.kind === 'image' ? `<img src="${esc(s.url)}" alt="">` : `<i>${s.kind === 'video' ? '🎬' : '♪'}</i>`}</button>`).join('') : '<span class="hint">עוד אין כאן תוצאות מהסוג הזה. תמונה, וידאו או קול שנוצרו במעבדה מופיעים כאן.</span>';
    $$('[data-i]', box).forEach(b => b.onclick = () => { el._vals.push(list[+b.dataset.i].url); box.hidden = true; thumbs(el); changed(); });
  };
  thumbs(el);
}
const mediaHTML = (name, accept, max) => `<div class="thumbs"></div><div class="madd"><button class="ghost sm" type="button" data-act="file">קובץ</button><button class="ghost sm" type="button" data-act="url">קישור</button><button class="ghost sm" type="button" data-act="prev">מתוצאה קודמת</button><input type="file" accept="${accept}"${max > 1 ? ' multiple' : ''} hidden aria-label="${esc(name)}"></div><div class="murl" hidden><input type="url" dir="ltr" placeholder="https://…" aria-label="קישור"><button class="ghost sm" type="button">הוספה</button></div><div class="mprev" hidden></div>`;

/* ---------- the runner: one model, its schema, its price, its results ---------- */
const SAMPLE = {
  image: 'Top-down editorial photograph of an empty travertine surface in late-afternoon window light, soft long shadows, a folded dusty-rose silk ribbon at one corner, no text, no products.',
  video: 'A dusty-rose satin ribbon lies straight on travertine, then slowly lifts at one end into a soft curl. Static camera, warm window light.',
  voice: 'שלום, זו הקראה לדוגמה מהמעבדה של AILGEN.',
  music: 'Warm minimal piano and soft strings, calm and elegant, 80 bpm, for a beauty clinic film.',
};
let CUR = null, timer = 0;
const sheet = $('#pdSheet');
const docs = id => `https://developers.cloudflare.com/ai/models/${id}/`;
async function open(id, opts = {}) {
  const m = BY[id]; if (!m) return;
  CUR = { m, s: null, vs: [], v: 0, manual: false, hist: [], seconds: 0, cfg: opts.configure || null };
  $('#pdSave').hidden = !CUR.cfg; $('#pdGo').classList.toggle('ghost', !!CUR.cfg); $('#pdGo').classList.toggle('go', !CUR.cfg);
  $('#pdProvName').textContent = `${m.provider} · ${TIER_NAME[m.tier]} · ${PAID.groups.find(g => g.id === m.group).title}`;
  $('#pdName').textContent = m.name; $('#pdId').textContent = m.id;
  const sample = m.demo ? `<figure class="sample"><video src="${esc(m.demo)}" controls muted playsinline preload="none"></video><figcaption>דוגמה מהקטלוג של Cloudflare</figcaption></figure>`
    : m.cover ? `<figure class="sample"><img src="${esc(m.cover)}" alt="" loading="lazy"><figcaption>דוגמה מהקטלוג של Cloudflare</figcaption></figure>` : '';
  $('#pdFacts').innerHTML = `<div class="fgrid"><div>${m.note ? `<p class="fnote">${esc(m.note)}</p>` : ''}<p class="fabout" dir="ltr">${esc(m.about)}</p><p class="flinks">${badges(m)}<a href="${esc(docs(m.id))}" target="_blank" rel="noopener">הדף של המודל ב-Cloudflare ↗</a></p>${sample}</div>
   <table class="tbl ptbl"><caption class="sr">מחירון</caption><thead><tr><th>מחירון של Cloudflare</th><th>$</th></tr></thead><tbody>${(m.price || []).map(p => `<tr><td dir="ltr">${esc(p.label)}</td><td class="n">${esc(String(p.usd))}</td></tr>`).join('') || '<tr><td colspan="2">אין מחיר מפורסם: המחיר יופיע אחרי ההרצה, מהיומן</td></tr>'}</tbody></table></div>`;
  $('#pdExs').innerHTML = ''; $('#pdVariant').innerHTML = ''; $('#pdForm').innerHTML = '<div class="wait">טוען את סכמת הקלט…</div>'; $('#pdOut').innerHTML = ''; $('#pdLines').innerHTML = ''; $('#pdEst').textContent = '';
  $('#pdJsonBox').open = false; $('#pdGo').disabled = m.live === false;
  if (!sheet.open) sheet.showModal();
  sheet.scrollTop = 0;
  try { CUR.s = await fetch('schemas/' + m.slug + '.json').then(r => r.json()); } catch { $('#pdForm').innerHTML = '<p class="err">הסכמה לא נטענה.</p>'; return; }
  if (CUR.m !== m) return;
  if (m.live === false) { $('#pdForm').innerHTML = `<p class="hintx">${esc(m.note || 'המודל הזה לא רץ בבקשה אחת.')}</p>`; $('#pdEst').textContent = label(estimate(m, {})); return; }
  CUR.vs = variantsOf(CUR.s.schema);
  const ex = CUR.s.examples || [];
  // the examples are Cloudflare's own calls: a click fills the form (and shows what the model made, when there is media)
  $('#pdExs').innerHTML = ex.length ? `<p class="exh">דוגמאות מהקטלוג של Cloudflare</p><div class="exl">${ex.map((e, i) => `<button type="button" class="exb" data-ex="${i}">${e.media && mediaKind(e.media) === 'image' ? `<img src="${esc(e.media)}" alt="" loading="lazy">` : e.media ? `<i>${mediaKind(e.media) === 'video' ? '🎬' : '♪'}</i>` : ''}<span dir="ltr">${esc(e.title || (isChat() ? exText(e.input) : 'דוגמה ' + (i + 1)).slice(0, 60))}</span></button>`).join('')}</div>` : '';
  $$('#pdExs [data-ex]').forEach(b => b.onclick = () => useExample(ex[+b.dataset.ex], true));
  if (isChat()) { chatForm(); if (CUR.cfg && CUR.cfg.input) { const p = chatParams(m.shape, CUR.cfg.input), f = $('#pdForm'); f.msg.value = p.msg || ''; f.sys.value = p.sys || ''; if (p.max) f.max.value = p.max; if (p.effort && f.effort) f.effort.value = p.effort; if (p.temp != null && f.temp) f.temp.value = p.temp; } } else {
    const best = ex[0] ? bestVariant(ex[0].input) : 0;
    variantBar(best); schemaForm(best);
    if (CUR.cfg && CUR.cfg.input) setValues(CUR.cfg.input);
    else if (ex[0]) useExample(ex[0], false);
    else { const k = ['prompt', 'text'].find(x => $(`#pdForm [data-k="${x}"]`)); if (k) $(`#pdForm [data-k="${k}"] textarea, #pdForm [data-k="${k}"] input`).value = SAMPLE[CUR.m.group] || SAMPLE.image; }
  }
  changed();
}
const isChat = () => CUR && isChatShape(CUR.m.shape);
const bestVariant = input => bestOf(CUR.vs, input);
function variantBar(i) {
  CUR.v = i;
  if (CUR.vs.length < 2) { $('#pdVariant').innerHTML = ''; return; }
  $('#pdVariant').innerHTML = `<span class="vl">סוג הבקשה</span><div class="seg sm" role="tablist">${CUR.vs.map((v, j) => `<button type="button" role="tab" data-v="${j}" aria-selected="${j === i}">${esc(vlabel(v, j))}</button>`).join('')}</div>`;
  $$('#pdVariant [data-v]').forEach(b => b.onclick = () => { const keep = readSchema().input; variantBar(+b.dataset.v); schemaForm(+b.dataset.v); setValues(keep); changed(); });
}

/* the generated form: required and common fields first, the rest under "more settings" */
function schemaForm(vi) {
  const v = CUR.vs[vi], root = CUR.s.schema, props = Object.entries(v.properties).filter(([k]) => !/^(stream|webhook.*|callback_url|hf_api_token|websocket|user|metadata)$/.test(k));
  const fields = props.map(([k, d]) => ({ ...field(k, d, root, CUR.m.group), req: v.required.includes(k) }));
  const rank = f => f.req ? -1 : PRIORITY.indexOf(f.k) < 0 ? 999 : PRIORITY.indexOf(f.k);
  fields.sort((a, b) => rank(a) - rank(b));
  const main = fields.filter(f => f.t !== 'const' && (f.req || PRIORITY.includes(f.k))).slice(0, 12), rest = fields.filter(f => f.t !== 'const' && !main.includes(f));
  CUR.fields = fields;
  $('#pdForm').innerHTML = fields.filter(f => f.t === 'const').map(fieldHTML).join('') + `<div class="fgrid2">${main.map(fieldHTML).join('')}</div>`
    + (rest.length ? `<details class="more"><summary>עוד הגדרות (${rest.length})</summary><div class="fgrid2">${rest.map(fieldHTML).join('')}</div></details>` : '');
  $$('#pdForm .fld.media').forEach(el => { const f = fields.find(x => x.k === el.dataset.k); el._max = f.max; el._accept = f.accept; wireMedia(el); });
}
function fieldHTML(f) {
  const id = 'pf-' + f.k, name = `<span class="fk" dir="ltr">${esc(f.k)}</span>${f.title ? ' ' + esc(f.title) : ''}${f.req ? ' <b class="req" title="חובה">*</b>' : ''}`;
  const help = f.desc ? `<span class="fh" dir="ltr" title="${esc(f.desc)}">${esc(f.desc.length > 170 ? f.desc.slice(0, 167) + '…' : f.desc)}</span>` : '';
  const ph = f.def !== undefined ? ` placeholder="${esc(String(f.def))}"` : '';
  const wide = ['long', 'media', 'json'].includes(f.t) ? ' wide' : '';
  if (f.t === 'const') return `<input type="hidden" data-k="${esc(f.k)}" data-t="const" value="${esc(JSON.stringify(f.v))}">`;
  if (f.t === 'media') return `<div class="fld media${wide}" data-k="${esc(f.k)}" data-t="media"><span class="fl">${name}${f.max > 1 ? ` <span class="hint">(עד ${f.max})</span>` : ''}</span>${help}${mediaHTML(f.k, f.accept, f.max)}</div>`;
  let ctl;
  if (f.t === 'enum') ctl = `<select id="${id}">${f.req && f.def === undefined ? '' : `<option value="">${f.def !== undefined ? 'ברירת מחדל: ' + esc(String(f.def)) : 'ברירת מחדל'}</option>`}${f.options.map(o => `<option value="${esc(JSON.stringify(o))}">${esc(String(o))}</option>`).join('')}</select>`;
  else if (f.t === 'bool') ctl = `<select id="${id}"><option value="">${f.def !== undefined ? 'ברירת מחדל: ' + (f.def ? 'כן' : 'לא') : 'ברירת מחדל'}</option><option value="1">כן</option><option value="0">לא</option></select>`;
  else if (f.t === 'num') ctl = `<input id="${id}" type="number" dir="ltr"${f.min != null && f.min > -1e15 ? ` min="${f.min}"` : ''}${f.max != null && f.max < 1e15 ? ` max="${f.max}"` : ''} step="${f.int ? 1 : 'any'}"${ph}>`;
  else if (f.t === 'numauto') ctl = `<input id="${id}" dir="ltr" placeholder="${f.def !== undefined ? esc(String(f.def)) : 'auto או מספר'}">`;
  else if (f.t === 'long') ctl = `<textarea id="${id}" rows="${f.k === 'prompt' || f.k === 'text' || f.k === 'lyrics' ? 4 : 2}" dir="auto"${ph}></textarea>`;
  else if (f.t === 'list') ctl = `<textarea id="${id}" rows="2" dir="auto" placeholder="ערך בכל שורה"></textarea>`;
  else if (f.t === 'json') ctl = `<textarea id="${id}" class="mono" rows="3" dir="ltr" placeholder="JSON"></textarea>`;
  else ctl = `<input id="${id}" dir="auto"${ph}>`;
  return `<label class="fld${wide}" data-k="${esc(f.k)}" data-t="${f.t}" for="${id}"><span class="fl">${name}</span>${ctl}${help}</label>`;
}
function readSchema() {
  const input = {}, missing = [], bad = [];
  for (const el of $$('#pdForm [data-k]')) {
    const k = el.dataset.k, t = el.dataset.t, f = CUR.fields.find(x => x.k === k), ctl = el.matches('input,select,textarea') ? el : $('input,select,textarea', el);
    let v;
    if (t === 'const') v = JSON.parse(el.value);
    else if (t === 'media') { const vals = el._vals || []; if (vals.length) { const w = f.wrap ? vals.map(url => ({ url })) : vals; v = f.multi && !(f.single && w.length === 1) ? w : w[0]; } }
    else if (t === 'enum') v = ctl.value === '' ? undefined : JSON.parse(ctl.value);
    else if (t === 'bool') v = ctl.value === '' ? undefined : ctl.value === '1';
    else if (t === 'num') v = ctl.value === '' ? undefined : +ctl.value;
    else if (t === 'numauto') v = ctl.value.trim() === '' ? undefined : ctl.value.trim() === 'auto' ? 'auto' : +ctl.value;
    else if (t === 'list') { const a = ctl.value.split(/\n|,/).map(s => s.trim()).filter(Boolean); v = a.length ? a : undefined; }
    else if (t === 'json') { if (ctl.value.trim()) { try { v = JSON.parse(ctl.value); } catch { bad.push(k); } } }
    else v = ctl.value.trim() === '' ? undefined : ctl.value;
    if (v === undefined && f && f.req && f.def !== undefined) v = f.def;   // required with a default: send the default
    if (v !== undefined) input[k] = v; else if (f && f.req && t !== 'const') missing.push(k);
  }
  return { input, missing, bad };
}
function setValues(input) {
  for (const [k, v] of Object.entries(input || {})) {
    const el = $(`#pdForm [data-k="${CSS.escape(k)}"]`); if (!el) continue;
    const t = el.dataset.t, ctl = el.matches('input,select,textarea') ? el : $('input,select,textarea', el);
    if (t === 'const') continue;
    if (t === 'media') { const arr = (Array.isArray(v) ? v : [v]).map(x => typeof x === 'object' && x ? x.url : x).filter(x => typeof x === 'string'); el._vals = arr; thumbs(el); continue; }
    if (t === 'enum') { const o = [...ctl.options].find(o => o.value && JSON.parse(o.value) === v); if (o) ctl.value = o.value; continue; }
    if (t === 'bool') { ctl.value = v ? '1' : '0'; continue; }
    if (t === 'json') { ctl.value = JSON.stringify(v, null, 1); continue; }
    if (t === 'list') { ctl.value = (Array.isArray(v) ? v : [v]).join('\n'); continue; }
    ctl.value = typeof v === 'object' ? JSON.stringify(v) : String(v);
  }
  $$('#pdForm details.more').forEach(d => { if ($$('[data-k]', d).some(el => { const c = el.matches('input,select,textarea') ? el : $('input,select,textarea', el); return (c && c.value) || (el._vals && el._vals.length); })) d.open = true; });
}
function useExample(e, announce) {
  if (!e) return;
  if (isChat()) { const t = exText(e.input); $('#pdForm [name=msg]').value = t; const sys = e.input.system || e.input.instructions || ((e.input.messages || []).find(x => x.role === 'system') || {}).content; if (typeof sys === 'string') $('#pdForm [name=sys]').value = sys; }
  else { const vi = bestVariant(e.input); if (vi !== CUR.v) { variantBar(vi); schemaForm(vi); } setValues(e.input); }
  CUR.manual = false; changed();
  if (announce) $('#pdForm').scrollIntoView({ block: 'nearest', behavior: 'smooth' });
}

/* the chat form: one form for the four chat formats (OpenAI chat, OpenAI Responses, Anthropic, Gemini) */
const chatCaps = () => capsOf(CUR.m, CUR.s.schema);
function chatForm() {
  const c = CUR.caps = chatCaps();
  $('#pdForm').innerHTML = `<div class="fgrid2">
   <label class="fld wide"><span class="fl">הוראות למודל <span class="hint">(system)</span></span><textarea name="sys" rows="2" dir="auto" placeholder="למשל: ענו בעברית, בקצרה ובמדויק."></textarea></label>
   <label class="fld wide"><span class="fl">הודעה <b class="req">*</b></span><textarea name="msg" rows="5" dir="auto">כתבו בעברית, בשלוש שורות, פתיח לדף נחיתה של קליניקה להרמת ריסים בתל אביב.</textarea></label>
   <div class="fld media wide" data-k="__img" data-t="media"><span class="fl">תמונה <span class="hint">(לא חובה, למודלים שקוראים תמונות)</span></span>${mediaHTML('image', 'image/*', 1)}</div>
   <label class="fld"><span class="fl">אורך מרבי <span class="fk" dir="ltr">${esc(c.maxKey)}</span></span><input name="max" type="number" dir="ltr" min="16" max="128000" step="1" value="1024"></label>
   ${c.temp ? '<label class="fld"><span class="fl">טמפרטורה</span><input name="temp" type="number" dir="ltr" min="0" max="2" step="0.1" placeholder="ברירת מחדל"></label>' : ''}
   ${c.effort ? `<label class="fld"><span class="fl">מאמץ חשיבה</span><select name="effort"><option value="">ברירת מחדל</option>${c.effort.map(x => `<option>${esc(x)}</option>`).join('')}</select></label>` : ''}
   <div class="fld wide thread"><label class="tog"><input type="checkbox" name="thread" checked> להמשיך את אותה שיחה</label><button class="ghost sm" type="button" id="pdNew">שיחה חדשה</button><span class="hint" id="pdTurns"></span></div>
  </div>`;
  const img = $('#pdForm .fld.media'); img._max = 1; img._accept = 'image/*'; wireMedia(img);
  $('#pdNew').onclick = () => { CUR.hist = []; turns(); changed(); };
  turns();
}
const turns = () => { const n = CUR.hist.length / 2; $('#pdTurns').textContent = n ? `${n} סבבים קודמים נשלחים עם ההודעה` : ''; };
function readChat() {
  const f = $('#pdForm'), c = CUR.caps, shape = CUR.m.shape, msg = f.msg.value.trim(), sys = f.sys.value.trim(), max = Math.max(16, +f.max.value || 1024);
  const temp = f.temp && f.temp.value !== '' ? +f.temp.value : undefined, effort = f.effort && f.effort.value || undefined, img = ($('#pdForm .fld.media')._vals || [])[0];
  const hist = f.thread.checked ? CUR.hist : [];
  return { input: buildChat(shape, c, { msg, sys, max, temp, effort, img, hist }), missing: msg || CUR.cfg ? [] : ['msg'], bad: [] };
}
/* the request as it will be sent, its price, and the run */
function current() {
  if (CUR.manual) { try { return { input: JSON.parse($('#pdJson').value), missing: [], bad: [] }; } catch { return { input: null, missing: [], bad: ['JSON'] }; } }
  return isChat() ? readChat() : readSchema();
}
function changed() {
  clearTimeout(timer);
  timer = setTimeout(() => {
    if (!CUR || !CUR.s || CUR.m.live === false) return;
    const r = current();
    if (!CUR.manual && r.input) $('#pdJson').value = JSON.stringify(shorten(r.input), null, 1);
    const e = r.input ? estimate(CUR.m, r.input, { seconds: CUR.seconds }) : null, b = L.budget;
    $('#pdEst').textContent = e ? `${label(e)}${e.kind === 'unknown' ? '' : ' להרצה'}${b ? ` · נשארו ${L.money(b.budget - b.spent, 2)}` : ''}` : 'ה-JSON לא תקין';
    $('#pdLines').innerHTML = e && e.lines.length ? `<details><summary>איך זה חושב</summary><table class="tbl"><tbody>${e.lines.map(l => `<tr><td dir="ltr">${esc(l.label)}</td><td class="n">${esc(l.qty.toLocaleString('he-IL'))} ${esc(l.unit)}</td><td class="n">${esc(usd(l.usd))}</td></tr>`).join('')}</tbody></table><p class="hint">${e.kind === 'upTo' ? 'זו תקרה: מודל טקסט משלם על מה שהוא כותב בפועל, ובדרך כלל זה פחות.' : e.kind === 'about' ? 'הערכה: חלק מהמחיר תלוי במה שיתברר רק בהרצה.' : 'לפי המחירון של Cloudflare.'} המחיר האמיתי מגיע מהיומן של Cloudflare אחרי ההרצה.</p></details>` : '';
  }, 90);
}
const shorten = v => typeof v === 'string' ? (v.startsWith('data:') && v.length > 120 ? v.slice(0, 60) + `…(${Math.round(v.length / 1024)}KB)` : v) : Array.isArray(v) ? v.map(shorten) : v && typeof v === 'object' ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, k === 'data' && typeof x === 'string' && x.length > 120 ? x.slice(0, 40) + `…(${Math.round(x.length / 1024)}KB)` : shorten(x)])) : v;
$('#pdForm').addEventListener('input', () => { if (CUR) { CUR.manual = false; changed(); } });
$('#pdForm').addEventListener('change', () => { if (CUR) { CUR.manual = false; changed(); } });
$('#pdJson').addEventListener('input', () => { if (CUR) { CUR.manual = true; changed(); } });
$('#pdJsonReset').onclick = () => { if (CUR) { CUR.manual = false; changed(); } };
$('#pdForm').addEventListener('submit', e => e.preventDefault());

function renderOut(body, j, model) {
  L.defaultRender(body, j);
  if (['image', 'video', 'audio'].includes(j.kind)) {
    const src = j[j.kind], urls = j.images && j.images.length > 1 ? j.images : [src];
    if (j.images && j.images.length > 1) { body.innerHTML = ''; urls.forEach(u => { const im = new Image(); im.src = u; im.alt = 'תמונה שנוצרה'; body.appendChild(im); }); }
    urls.forEach(u => SESSION.unshift({ url: u, kind: j.kind, model }));
    const bar = document.createElement('div'); bar.className = 'obar';
    bar.innerHTML = `<a href="${esc(src)}" target="_blank" rel="noopener" download>הורדה / פתיחה</a><span class="hint">נשמר לסשן: אפשר לבחור אותו כקלט בכל מודל ("מתוצאה קודמת")</span>`;
    body.appendChild(bar);
  }
  if (j.estimate && j.cost && j.cost.src === 'gateway') { const p = document.createElement('p'); p.className = 'hint'; p.textContent = `הערכה לפני: ${label(j.estimate)} · בפועל לפי היומן: ${usd(j.cost.usd)}`; body.appendChild(p); }
}
$('#pdGo').onclick = () => L.busy($('#pdGo'), async () => {
  if (!CUR || !CUR.s) return;
  const r = current();
  if (r.bad.length) return alert('יש שדה JSON לא תקין: ' + r.bad.join(', '));
  if (r.missing.length) { const el = $(`#pdForm [data-k="${CSS.escape(r.missing[0])}"], #pdForm [name="${r.missing[0]}"]`); if (el) { el.closest('details')?.setAttribute('open', ''); (el.matches('input,select,textarea') ? el : $('input,select,textarea,button', el))?.focus(); } $('#pdEst').textContent = 'חסר שדה חובה: ' + r.missing.join(', '); return; }
  const e = estimate(CUR.m, r.input, { seconds: CUR.seconds });
  if ((e.usd || 0) > 1 && !confirm(`ההרצה הזו עולה ${label(e)}. להמשיך?`)) return;
  if (e.kind === 'unknown' && !confirm('למודל הזה אין הערכת מחיר לפני ההרצה. המחיר האמיתי יופיע אחרי ההרצה, מהיומן. להמשיך?')) return;
  // a field that takes the file itself (base64), given a link (an earlier result): the file is fetched through the lab and inlined
  if (!isChat() && !CUR.manual) for (const f of (CUR.fields || []).filter(x => x.t === 'media' && x.b64)) {
    const v = r.input[f.k], conv = async u => { if (typeof u !== 'string' || !/^https:\/\//.test(u)) return u; const b = await fetch('/api/media', { method: 'POST', headers: { 'content-type': 'application/json', 'x-lab-key': L.key }, body: JSON.stringify({ url: u }) }).then(x => x.ok ? x.blob() : null).catch(() => null); return b ? new Promise(ok => { const fr = new FileReader(); fr.onload = () => ok(fr.result); fr.readAsDataURL(b); }) : u; };
    if (v != null) r.input[f.k] = Array.isArray(v) ? await Promise.all(v.map(conv)) : await conv(v);
  }
  const m = CUR.m, msg = isChat() ? $('#pdForm').msg.value.trim() : null, c = L.card($('#pdOut'), m.name, true);
  const j = await L.call(m.id, r.input, '', 'credits', { hint: { seconds: CUR.seconds || undefined } });
  L.fill(c, j, (body, x) => renderOut(body, x, m.id));
  if (j.ok && isChat() && CUR.m === m && j.text) { CUR.hist.push({ role: 'user', content: msg }, { role: 'assistant', content: j.text }); turns(); $('#pdForm').msg.value = ''; changed(); }
  L.renderBudget(true);
});
sheet.addEventListener('close', () => { CUR = null; $('#pdSave').hidden = true; $('#pdGo').classList.add('go'); $('#pdGo').classList.remove('ghost'); });
// AI UNIFIED: a flow node's settings are this same form; "save to the node" hands the exact request back instead of running it
$('#pdSave').onclick = () => {
  if (!CUR || !CUR.cfg) return;
  const r = current(); if (r.bad.length) return alert('יש שדה JSON לא תקין: ' + r.bad.join(', '));
  const input = { ...r.input }; if (isChat() && !$('#pdForm').msg.value.trim()) delete input.messages;   // the message usually arrives from the flow
  CUR.cfg.onSave(input); sheet.close();
};
sheet.addEventListener('click', e => { if (e.target === sheet) sheet.close(); });

/* ---------- compare: one simple brief, sent to each model in its own format ---------- */
const csheet = $('#pcSheet');
const CMP_FORM = {
  text: `<label class="fld wide"><span class="fl">הוראות למודל</span><textarea name="sys" rows="2" dir="auto" placeholder="למשל: ענו בעברית, בקצרה."></textarea></label><label class="fld wide"><span class="fl">הודעה</span><textarea name="msg" rows="4" dir="auto">כתבו בעברית, בשלוש שורות, פתיח לדף נחיתה של קליניקה להרמת ריסים בתל אביב.</textarea></label><label class="fld"><span class="fl">אורך מרבי</span><input name="max" type="number" dir="ltr" value="800" min="16"></label>`,
  image: `<label class="fld wide"><span class="fl">תיאור</span><textarea name="prompt" rows="3" dir="auto">Top-down editorial photograph of an empty travertine surface in late-afternoon window light, soft long shadows, a folded dusty-rose silk ribbon at one corner, no text, no products.</textarea></label><label class="fld"><span class="fl">יחס</span><select name="ratio"><option>1:1</option><option>16:9</option><option>9:16</option><option>4:3</option><option>3:4</option></select></label>`,
  video: `<label class="fld wide"><span class="fl">תיאור</span><textarea name="prompt" rows="3" dir="auto">A dusty-rose satin ribbon lies straight on travertine, then slowly lifts at one end into a soft curl. Static camera, warm window light.</textarea></label><label class="fld"><span class="fl">משך (שניות)</span><input name="dur" type="number" dir="ltr" value="5" min="2" max="20"></label><label class="fld"><span class="fl">רזולוציה</span><select name="res"><option>720p</option><option>1080p</option><option>480p</option></select></label><label class="fld"><span class="fl">יחס</span><select name="ratio"><option>16:9</option><option>9:16</option><option>1:1</option></select></label><label class="fld"><span class="fl">קול</span><select name="audio"><option value="0">בלי</option><option value="1">עם קול</option></select></label>`,
  voice: `<label class="fld wide"><span class="fl">טקסט להקראה</span><textarea name="text" rows="3" dir="auto">שלום, זו הקראה לדוגמה מהמעבדה של AILGEN.</textarea></label>`,
  listen: `<div class="fld media wide" data-k="__aud" data-t="media"><span class="fl">קובץ קול</span>${mediaHTML('audio', 'audio/*', 1)}</div>`,
  music: `<label class="fld wide"><span class="fl">תיאור</span><textarea name="prompt" rows="3" dir="auto">Warm minimal piano and soft strings, calm and elegant, 80 bpm, for a beauty clinic film.</textarea></label><label class="fld"><span class="fl">אורך (שניות)</span><input name="len" type="number" dir="ltr" value="30" min="5" max="180"></label>`,
};
const CMP = { models: [], schemas: {}, seconds: 0 };
$('#pdCmp').onclick = async () => {
  CMP.models = [...PICKED].map(id => BY[id]).filter(Boolean);
  $('#pcTitle').textContent = CMP.models.map(m => m.name).join(' · ');
  $('#pcForm').innerHTML = `<div class="fgrid2">${CMP_FORM[SECTOR] || CMP_FORM.text}${['image', 'video'].includes(SECTOR) ? `<div class="fld media wide" data-k="__ref" data-t="media"><span class="fl">תמונת פתיחה או ייחוס <span class="hint">(לא חובה; מודל שדורש תמונה יקבל אותה)</span></span>${mediaHTML('image', 'image/*', 1)}</div>` : ''}</div>`;
  $$('#pcForm .fld.media').forEach(el => { el._max = 1; el._accept = el.dataset.k === '__aud' ? 'audio/*' : 'image/*'; wireMedia(el); });
  $('#pcOut').innerHTML = ''; csheet.showModal();
  await Promise.all(CMP.models.map(async m => { if (!CMP.schemas[m.id]) CMP.schemas[m.id] = await fetch('schemas/' + m.slug + '.json').then(r => r.json()); }));
  cmpChanged();
};
// one brief → this model's input (schema.js: its own first example as the base, the brief's values in the fields it calls by
// those names, at the nearest value its schema allows)
function cmpInput(m, b) { const s = CMP.schemas[m.id]; return s ? briefInput(m, s, b) : { error: 'הסכמה עוד נטענת' }; }
function brief2() {
  const f = $('#pcForm'), g = n => f.querySelector(`[name=${n}]`), media = k => (($(`#pcForm [data-k=${k}]`) || {})._vals || [])[0];
  return { sys: g('sys')?.value.trim(), msg: g('msg')?.value.trim(), max: +(g('max')?.value) || 800, prompt: g('prompt')?.value.trim(), ratio: g('ratio')?.value, dur: +(g('dur')?.value) || null,
    res: g('res')?.value, audio: g('audio') ? g('audio').value === '1' : null, text: g('text')?.value.trim(), len: +(g('len')?.value) || null, ref: media('__ref'), aud: media('__aud') };
}
function cmpChanged() {
  const b = brief2(); let sum = 0, unknown = 0;
  const rows = CMP.models.map(m => { const r = cmpInput(m, b); if (r.error) return `<li><b>${esc(m.name)}</b> <span class="err">${esc(r.error)}</span></li>`; const e = estimate(m, r.input, { seconds: CMP.seconds }); if (e.usd == null || e.kind === 'unknown') unknown++; else sum += e.usd; return `<li><b>${esc(m.name)}</b> ${esc(label(e))}</li>`; });
  $('#pcEst').innerHTML = `${unknown ? 'לפחות ' : ''}${esc(label({ usd: sum, kind: CMP.models.some(m => m.group === 'text') ? 'upTo' : 'about' }))} לכולם<ul class="cl">${rows.join('')}</ul>`;
}
$('#pcForm').addEventListener('input', cmpChanged); $('#pcForm').addEventListener('change', async e => { const el = e.target.closest('.media'); if (el && el._vals && el._vals[0] && el.dataset.k === '__aud') CMP.seconds = await seconds(el._vals[0]); cmpChanged(); });
$('#pcGo').onclick = () => L.busy($('#pcGo'), async () => {
  const b = brief2(), jobs = CMP.models.map(m => ({ m, ...cmpInput(m, b) })), ok = jobs.filter(j => j.input);
  const total = ok.reduce((a, j) => a + (estimate(j.m, j.input, { seconds: CMP.seconds }).usd || 0), 0);
  if (total > 1 && !confirm(`ההשוואה עולה כ-${usd(total)} בסך הכול. להמשיך?`)) return;
  $('#pcOut').innerHTML = '';
  await Promise.all(jobs.map(async j => { const c = L.card($('#pcOut'), j.m.name); if (!j.input) return L.fill(c, { ok: false, error: j.error }); L.fill(c, await L.call(j.m.id, j.input, '', 'credits', { hint: { seconds: CMP.seconds || undefined } }), (body, x) => renderOut(body, x, j.m.id)); }));
  L.renderBudget(true);
});
csheet.addEventListener('click', e => { if (e.target === csheet) csheet.close(); });

/* ---------- the "models" tab: the paid catalog's rows ---------- */
window.LABPAID = {
  open: id => { const m = BY[id]; if (!m) return; L.show('paid'); if (SECTOR !== m.group) { SECTOR = m.group; renderSeg(); renderProv(); render(); } open(id); },
  rows(into, { q, task }) {
    const list = ALL.filter(m => (!task || task === 'gateway' || m.task === task) && (!q || hay(m).includes(q)));
    if (!list.length) return;
    $$('.lead', into).forEach(p => p.remove());
    into.insertAdjacentHTML('beforeend', list.map(m => `<div class="mrow"><div><div class="n">${esc(m.id)}</div><div class="t">${esc(PAID.groups.find(g => g.id === m.group).title)} · ${esc(TIER_NAME[m.tier])} · ${esc(m.provider)}</div></div>
     <div><span class="badge b-paid">בתשלום · קרדיטים</span>${badges(m)}${m.note ? `<p class="note">${esc(m.note)}</p>` : ''}<p dir="ltr" style="text-align:left">${esc(m.about)}</p><div class="price">${esc(brief(m))}</div></div>
     <div><button class="try" type="button" data-pd="${esc(m.id)}">פתיחה</button></div></div>`).join(''));
    $$('[data-pd]', into).forEach(b => b.onclick = () => window.LABPAID.open(b.dataset.pd));
  },
};

/* ---------- start ---------- */
$('#pdLead').textContent = `${PAID.count} מודלים בתשלום, כל מה שיש בקטלוג של Cloudflare (נבדק ${PAID.checked}), וכולם מאותה יתרה של קרדיטים. בכל תחום הם מחולקים למובחרים, בינוניים וחלשים. לפני כל הרצה מוצג כמה היא תעלה, ואחריה המחיר האמיתי מהיומן של Cloudflare.`;
$('#pdWhy p').textContent = PAID.tiersWhy;
renderSeg(); renderProv(); render();
L.renderModels();

/* ---------- what AI UNIFIED (unified/ui.js) uses from the catalog ---------- */
export { PAID, ALL, BY, brief, TIER_NAME, SESSION };
export const configure = (id, input, onSave) => open(id, { configure: { input, onSave } });
