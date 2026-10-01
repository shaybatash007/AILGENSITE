/* AILGEN Lab · AI UNIFIED: the flow editor. A canvas of nodes (inputs, any of the lab's models, tools, the composer, outputs)
   joined by typed wires; the library of everything that can be added; the inspector for the selected node; the run log and the
   outputs. Flows and runs are saved in the lab's KV (/api/flows), so the agent's CLI (cloud/lab/unified.mjs) sees and runs the
   same flows. Every model call goes through /api/run: the budget, the ledger and the price before and after are the lab's own. */
import { createEngine, TYPES, KIND_NAME, accepts, layout, blank, newId, slim, FREE_OUT, freeRunnable } from './engine.js';
import { TEMPLATES } from './templates.js';
import { compose } from './compose.js';
import { label } from '../price.js';
import { PAID, ALL, brief, TIER_NAME, SESSION, configure } from '../paid.js';

const L = window.LAB, $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)], esc = L.esc;
const store = { get(k) { try { return localStorage.getItem(k); } catch { return null; } }, set(k, v) { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch {} } };
const usd = v => v == null ? '—' : v === 0 ? '$0' : '$' + (v < 0.01 ? v.toFixed(4) : v < 1 ? v.toFixed(3) : v.toFixed(2));
const clone = o => JSON.parse(JSON.stringify(o));

/* ---------- the catalog: the paid models and the free ones a flow can run ---------- */
const FREEJ = await fetch('models.json').then(r => r.json());
const SECT = { text: 'text', image: 'image', audio: 'voice' };
const FREE = FREEJ.models.filter(m => !m.paid && freeRunnable(m)).map(m => ({ id: m.name, name: m.name.replace(/^@cf\//, ''), provider: 'Workers AI · חינם', free: true, how: m.how, reasoning: m.reasoning, out: FREE_OUT[m.how],
  group: m.how === 'asr' ? 'listen' : SECT[FREE_OUT[m.how]] || 'text', tier: 'free', note: m.note && m.note.note, best: m.note && m.note.verdict === 'best' }));
const CATALOG = new Map([...ALL.map(m => [m.id, m]), ...FREE.map(m => [m.id, m])]);
const SECTORS = [['all', 'הכול'], ...PAID.groups.map(g => [g.id, g.title]), ['free', 'חינמי']];

/* ---------- the host the engine runs in: this page ---------- */
async function fetchBlob(v) {
  if (/^(data|blob):/.test(v)) return (await fetch(v)).blob();
  const r = await fetch('/api/media', { method: 'POST', headers: { 'content-type': 'application/json', 'x-lab-key': L.key }, body: JSON.stringify({ url: v }) });
  if (!r.ok) throw new Error(`הקובץ לא נטען (${r.status})`);
  return r.blob();
}
const toData = b => new Promise((ok, no) => { const r = new FileReader(); r.onload = () => ok(r.result); r.onerror = no; r.readAsDataURL(b); });
const engine = createEngine({
  catalog: { get: id => CATALOG.get(id) },
  schemaOf: m => fetch('schemas/' + m.slug + '.json').then(r => r.json()),
  call: (id, input, o) => L.call(id, input, o.kind || '', o.route, o.hint ? { hint: o.hint } : undefined),
  compose: (ins, d, on) => compose(ins, d, on, fetchBlob),
  toDataURI: async url => toData(await fetchBlob(url)),
  toBase64: async v => (await toData(await fetchBlob(v))).split(',')[1],
});
const api = async body => { const r = await fetch('/api/flows', { method: 'POST', headers: { 'content-type': 'application/json', 'x-lab-key': L.key }, body: JSON.stringify(body) }).catch(() => null); return r ? r.json().catch(() => ({ error: 'bad answer' })) : { error: 'אין חיבור לשרת המעבדה' }; };

/* ---------- state ---------- */
let FLOW = null, SEL = null, RES = {}, RUN = null, VIEW = { x: 0, y: 0, z: 1 }, DIRTY = false, ESTIMATE = null, CAP_TOUCHED = false;
const HIST = { undo: [], redo: [] }, PORTS = new Map();
const canvas = $('#uCanvas'), world = $('#uWorld'), wires = $('#uWires'), nodesEl = $('#uNodes');
const typeOf = n => TYPES[n.type] || {};
const portKey = n => `${n.type}|${(n.data && n.data.model) || ''}|${(n.data && n.data.kind) || ''}`;
async function portsOf(n) { const k = portKey(n); if (!PORTS.has(k)) PORTS.set(k, await engine.ports(n)); return PORTS.get(k); }

function load(flow, { results = {}, fit = true } = {}) {
  FLOW = clone(flow); delete FLOW.template; RES = results; SEL = null; HIST.undo = []; HIST.redo = []; DIRTY = false; CAP_TOUCHED = false;
  if (FLOW.nodes.some(n => n.x == null)) mirrorLayout();
  $('#uName').value = FLOW.name || ''; render(); if (fit) requestAnimationFrame(fitView); saved(FLOW.updated ? 'נשמרה' : 'לא נשמרה');
}
function commit(msg) {   // every change: one undo step, the draft in this browser, a fresh render and price
  HIST.undo.push(JSON.stringify(FLOW)); if (HIST.undo.length > 80) HIST.undo.shift(); HIST.redo = [];
  DIRTY = true; saved('שינויים לא שמורים'); render(); if (msg) log(msg);
}
function snapshot() { HIST.undo.push(JSON.stringify(FLOW)); HIST.redo = []; }
function undo() { if (!HIST.undo.length) return; HIST.redo.push(JSON.stringify(FLOW)); FLOW = JSON.parse(HIST.undo.pop()); DIRTY = true; render(); }
function redo() { if (!HIST.redo.length) return; HIST.undo.push(JSON.stringify(FLOW)); FLOW = JSON.parse(HIST.redo.pop()); DIRTY = true; render(); }
const saved = t => { $('#uSaved').textContent = t; $('#uSaved').classList.toggle('warn', /לא/.test(t)); };
setInterval(() => { if (FLOW && DIRTY) store.set('unifiedDraft', JSON.stringify(FLOW)); }, 1500);

/* ---------- the canvas: nodes, ports, wires ---------- */
const ICON = { 'input.text': 'T', 'input.media': '⬚', model: '✦', 'tool.template': '{ }', 'tool.extract': '⌁', 'tool.split': '⫶', 'tool.join': '⊕', 'tool.pick': '☝', 'tool.compose': '▶', output: '◎' };
function subtitle(n) {
  const d = n.data || {};
  if (n.type === 'model') { const m = CATALOG.get(d.model); return m ? `${m.free ? 'חינם' : TIER_NAME[m.tier] || ''} · ${m.provider}` : 'לא נבחר מודל'; }
  if (n.type === 'input.text') return (d.text || 'ריק').slice(0, 46);
  if (n.type === 'input.media') return `${KIND_NAME[d.kind || 'image']} · ${(d.urls || []).length} קבצים`;
  if (n.type === 'tool.extract') return d.path || 'כל ה-JSON';
  if (n.type === 'tool.split') return { lines: 'לפי שורות', sep: 'לפי מפריד', json: 'מערך JSON' }[d.by || 'lines'];
  if (n.type === 'tool.compose') return `${d.aspect || '9:16'} · קול ומוזיקה`;
  return typeOf(n).about ? typeOf(n).about.slice(0, 46) : '';
}
function preview(r) {
  if (!r) return '';
  if (r.status === 'error' || r.status === 'skipped') return `<p class="uerr" dir="auto">${esc(r.error || '')}</p>`;
  const items = r.items || [];
  const media = items.filter(i => i.kind !== 'text').slice(0, 4), texts = items.filter(i => i.kind === 'text');
  return (media.length ? `<div class="uthumbs">${media.map(i => i.kind === 'image' ? `<img src="${esc(i.value)}" alt="" loading="lazy">` : i.kind === 'video' ? `<span class="uv">▶</span>` : `<span class="uv">♪</span>`).join('')}${items.length > 4 ? `<span class="umore">+${items.length - 4}</span>` : ''}</div>` : '')
    + (texts.length ? `<p class="utxt" dir="auto">${esc(String(texts[0].value).slice(0, 150))}${texts.length > 1 ? ` <b>(+${texts.length - 1})</b>` : ''}</p>` : '');
}
// renders run one after another (each awaits the ports of new nodes), so two quick changes never draw over each other
let rendering = Promise.resolve();
function render() { rendering = rendering.then(draw, draw); return rendering; }
async function draw() {
  if (!FLOW) return;
  $('#uEmpty').hidden = !!FLOW.nodes.length;
  const keep = new Set();
  for (const n of FLOW.nodes) {
    keep.add(n.id);
    let el = nodesEl.querySelector(`[data-id="${CSS.escape(n.id)}"]`);
    if (!el) { el = document.createElement('div'); el.className = 'un'; el.dataset.id = n.id; el.tabIndex = 0; nodesEl.appendChild(el); }
    const p = await portsOf(n), outKind = (p.outs[0] || {}).kind || 'any', r = RES[n.id], T = typeOf(n), est = ESTIMATE && ESTIMATE.per[n.id];
    const linked = new Set(FLOW.edges.filter(e => e.to === n.id).map(e => e.in));
    el.className = `un c-${T.cat || 'tool'} k-${outKind}${SEL === n.id ? ' sel' : ''}${r ? ' s-' + (r.status || 'done') : ''}${n.data && n.data.pinned ? ' pinned' : ''}`;
    el.style.left = n.x + 'px'; el.style.top = n.y + 'px';
    el.setAttribute('aria-label', `${n.title || T.title} · ${subtitle(n)}`);
    el.innerHTML = `<div class="unh" data-drag><span class="uic">${ICON[n.type] || '•'}</span><div class="unt"><b dir="auto">${esc(n.title || (n.type === 'model' && CATALOG.get(n.data.model) ? CATALOG.get(n.data.model).name : T.title))}</b><small dir="auto">${esc(subtitle(n))}</small></div><span class="ust" aria-live="polite">${r && r.status === 'running' ? (r.progress || '') : n.data && n.data.pinned ? '📌' : ''}</span></div>
     <div class="unp"><div class="uins">${p.ins.map(i => `<div class="up in k-${i.kind}${linked.has(i.key) ? ' on' : ''}" data-port="${esc(i.key)}" data-kind="${i.kind}" title="${esc(KIND_NAME[i.kind] || i.kind)}${i.many ? ' · רשימה' : ''}"><i></i><span>${esc(i.label || i.key)}${i.req ? '<b>*</b>' : ''}</span></div>`).join('')}</div>
     <div class="uouts">${p.outs.map(o => `<div class="up out k-${o.kind}" data-port="${esc(o.key)}" data-kind="${o.kind}" title="גוררים מכאן לחיבור"><span>${esc(KIND_NAME[o.kind] || o.kind)}</span><i></i></div>`).join('')}</div></div>
     ${preview(r) ? `<div class="unr">${preview(r)}</div>` : ''}
     <div class="unf"><span>${r && r.status === 'done' ? (r.reused ? 'מהריצה הקודמת' : `${r.ms != null ? (r.ms / 1000).toFixed(1) + 's' : ''}${r.runs > 1 ? ' · ' + r.runs + '×' : ''}`) : est && est.runs > 1 ? `${est.runs}×` : ''}</span><span class="ucost">${r && r.status === 'done' && r.cost != null && !r.reused ? usd(r.cost) : est ? (est.kind === 'free' ? 'חינם' : est.kind === 'pinned' ? 'נעוץ' : est.usd == null ? '?' : '≈ ' + usd(est.usd)) : ''}</span></div>`;
  }
  $$('.un', nodesEl).forEach(el => { if (!keep.has(el.dataset.id)) el.remove(); });
  drawWires(); inspector(); price();
}
function portPoint(nodeId, key, dir) {
  const el = nodesEl.querySelector(`[data-id="${CSS.escape(nodeId)}"] .up.${dir}[data-port="${CSS.escape(key)}"] i`); if (!el) return null;
  const a = el.getBoundingClientRect(), w = world.getBoundingClientRect();
  return { x: (a.left + a.width / 2 - w.left) / VIEW.z, y: (a.top + a.height / 2 - w.top) / VIEW.z };
}
const curve = (a, b) => { const dx = Math.max(50, Math.abs(a.x - b.x) / 2); return `M${a.x},${a.y} C${a.x - dx},${a.y} ${b.x + dx},${b.y} ${b.x},${b.y}`; };
function drawWires() {
  const out = [];
  for (const e of FLOW.edges) {
    const a = portPoint(e.from, e.out, 'out'), b = portPoint(e.to, e.in, 'in'); if (!a || !b) continue;
    const kind = (nodesEl.querySelector(`[data-id="${CSS.escape(e.from)}"] .up.out[data-port="${CSS.escape(e.out)}"]`) || {}).dataset?.kind || 'any';
    const flowing = RES[e.to] && RES[e.to].status === 'running';
    out.push(`<g class="uw k-${kind}${SEL && SEL.edge === e.id ? ' sel' : ''}${flowing ? ' flow' : ''}" data-edge="${esc(e.id)}"><path class="hit" d="${curve(a, b)}"/><path class="ln" d="${curve(a, b)}"/>${SEL && SEL.edge === e.id ? `<g class="ux" data-x="${esc(e.id)}" transform="translate(${(a.x + b.x) / 2},${(a.y + b.y) / 2})"><circle r="11"/><text dy="4" text-anchor="middle">✕</text></g>` : ''}</g>`);
  }
  wires.innerHTML = out.join('') + '<path id="uTemp" class="temp" d=""/>';
}
const applyView = () => { world.style.transform = `translate(${VIEW.x}px,${VIEW.y}px) scale(${VIEW.z})`; $('#uZoom').textContent = Math.round(VIEW.z * 100) + '%'; };
function fitView() {
  if (!FLOW.nodes.length) { VIEW = { x: 40, y: 40, z: 1 }; return applyView(); }
  const els = $$('.un', nodesEl), xs = FLOW.nodes.map(n => n.x), ys = FLOW.nodes.map(n => n.y);
  const w = Math.max(...FLOW.nodes.map((n, i) => n.x + (els[i] ? els[i].offsetWidth : 250))) - Math.min(...xs), h = Math.max(...FLOW.nodes.map((n, i) => n.y + (els[i] ? els[i].offsetHeight : 160))) - Math.min(...ys);
  // readable first: never below 55%; a flow wider than the canvas opens at its start (the right side: the page reads right to left)
  const r = canvas.getBoundingClientRect(), z = Math.max(0.55, Math.min(1.1, Math.min((r.width - 80) / w, (r.height - 80) / h)));
  const maxX = Math.max(...FLOW.nodes.map((n, i) => n.x + (els[i] ? els[i].offsetWidth : 250)));
  VIEW = { z, x: w * z > r.width - 80 ? r.width - 40 - maxX * z : (r.width - w * z) / 2 - Math.min(...xs) * z, y: h * z > r.height - 80 ? 40 - Math.min(...ys) * z : (r.height - h * z) / 2 - Math.min(...ys) * z };
  applyView(); drawWires();
}
function mirrorLayout() {   // the engine lays out left to right by depth; the page reads right to left
  layout(FLOW); const max = Math.max(...FLOW.nodes.map(n => n.x));
  FLOW.nodes.forEach(n => { n.x = max - n.x + 40; });
}
const toWorld = (cx, cy) => { const r = canvas.getBoundingClientRect(); return { x: (cx - r.left - VIEW.x) / VIEW.z, y: (cy - r.top - VIEW.y) / VIEW.z }; };

/* pointer: pan the canvas, move a node, draw a wire */
let drag = null;
const capture = e => { try { canvas.setPointerCapture(e.pointerId); } catch {} };   // a pointer that already ended has nothing to capture
canvas.addEventListener('pointerdown', e => {
  if (e.target.closest('.uempty, .uzoom, .umob, button:not(.ux), a, input, textarea, select, video, audio')) return;   // the canvas's own controls take their clicks
  const up = e.target.closest('.up.out'), head = e.target.closest('[data-drag]'), node = e.target.closest('.un'), x = e.target.closest('.ux'), wire = e.target.closest('.uw');
  if (x) { snapshot(); FLOW.edges = FLOW.edges.filter(ed => ed.id !== x.dataset.x); SEL = null; commit(); return; }
  if (wire && !node) { SEL = { edge: wire.dataset.edge }; render(); return; }
  if (up) {
    const n = up.closest('.un').dataset.id, kind = up.dataset.kind;
    drag = { type: 'wire', from: n, out: up.dataset.port, kind, start: portPoint(n, up.dataset.port, 'out') };
    $$('.up.in', nodesEl).forEach(p => p.classList.toggle('ok', p.closest('.un').dataset.id !== n && (kind === 'any' || accepts(p.dataset.kind, kind))));
    canvas.classList.add('wiring'); capture(e); e.preventDefault(); return;
  }
  if (head && node) {
    const n = FLOW.nodes.find(z => z.id === node.dataset.id); select(n.id);
    drag = { type: 'node', id: n.id, ox: n.x, oy: n.y, sx: e.clientX, sy: e.clientY, moved: false }; capture(e); e.preventDefault(); return;
  }
  if (node) { select(node.dataset.id); return; }
  drag = { type: 'pan', sx: e.clientX, sy: e.clientY, ox: VIEW.x, oy: VIEW.y }; capture(e); canvas.classList.add('panning');
  if (SEL) { SEL = null; render(); }
});
canvas.addEventListener('pointermove', e => {
  if (!drag) return;
  if (drag.type === 'pan') { VIEW.x = drag.ox + e.clientX - drag.sx; VIEW.y = drag.oy + e.clientY - drag.sy; applyView(); return; }
  if (drag.type === 'node') {
    const n = FLOW.nodes.find(z => z.id === drag.id), dx = (e.clientX - drag.sx) / VIEW.z, dy = (e.clientY - drag.sy) / VIEW.z;
    if (!drag.moved && Math.hypot(dx, dy) > 3) { drag.moved = true; snapshot(); }
    n.x = Math.round((drag.ox + dx) / 8) * 8; n.y = Math.round((drag.oy + dy) / 8) * 8;
    const el = nodesEl.querySelector(`[data-id="${CSS.escape(n.id)}"]`); el.style.left = n.x + 'px'; el.style.top = n.y + 'px'; drawWires(); return;
  }
  if (drag.type === 'wire') { const p = toWorld(e.clientX, e.clientY); $('#uTemp').setAttribute('d', curve(drag.start, p)); $('#uTemp').setAttribute('class', 'temp k-' + drag.kind); }
});
canvas.addEventListener('pointerup', e => {
  if (!drag) return;
  const d = drag; drag = null; canvas.classList.remove('wiring', 'panning'); $$('.up.in.ok', nodesEl).forEach(p => p.classList.remove('ok'));
  if (d.type === 'node' && d.moved) { DIRTY = true; saved('שינויים לא שמורים'); return; }
  if (d.type === 'wire') {
    const t = document.elementFromPoint(e.clientX, e.clientY), inp = t && t.closest('.up.in');
    $('#uTemp') && $('#uTemp').setAttribute('d', '');
    if (!inp) return;
    const to = inp.closest('.un').dataset.id;
    if (to === d.from) return;
    if (d.kind !== 'any' && !accepts(inp.dataset.kind, d.kind)) return log(`${KIND_NAME[d.kind]} לא נכנס לשקע של ${KIND_NAME[inp.dataset.kind]}`, 'err');
    if (FLOW.edges.some(x => x.from === d.from && x.out === d.out && x.to === to && x.in === inp.dataset.port)) return;
    snapshot(); FLOW.edges.push({ id: newId('e'), from: d.from, out: d.out, to, in: inp.dataset.port }); commit();
  }
});
canvas.addEventListener('wheel', e => {
  e.preventDefault();
  if (e.ctrlKey || e.metaKey) { const r = canvas.getBoundingClientRect(), z = Math.max(0.25, Math.min(2, VIEW.z * (e.deltaY < 0 ? 1.1 : 0.9))), mx = e.clientX - r.left, my = e.clientY - r.top; VIEW.x = mx - (mx - VIEW.x) * z / VIEW.z; VIEW.y = my - (my - VIEW.y) * z / VIEW.z; VIEW.z = z; }
  else { VIEW.x -= e.deltaX; VIEW.y -= e.deltaY; }
  applyView();
}, { passive: false });
const zoom = k => { const r = canvas.getBoundingClientRect(), z = Math.max(0.25, Math.min(2, VIEW.z * k)); VIEW.x = r.width / 2 - (r.width / 2 - VIEW.x) * z / VIEW.z; VIEW.y = r.height / 2 - (r.height / 2 - VIEW.y) * z / VIEW.z; VIEW.z = z; applyView(); };
$('#uZin').onclick = () => zoom(1.15); $('#uZout').onclick = () => zoom(1 / 1.15); $('#uFit').onclick = fitView;
nodesEl.addEventListener('keydown', e => { const n = e.target.closest('.un'); if (n && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); select(n.dataset.id); $('#uInsp').focus(); } });
function select(id) { SEL = id; $$('.un', nodesEl).forEach(el => el.classList.toggle('sel', el.dataset.id === id)); inspector(); drawWires(); document.body.classList.add('uinsp-open'); }

/* ---------- adding nodes ---------- */
function addNode(type, data = {}, at) {
  snapshot();
  const prev = SEL && typeof SEL === 'string' ? FLOW.nodes.find(n => n.id === SEL) : null;
  const r = canvas.getBoundingClientRect(), c = at || (prev ? { x: prev.x - 300, y: prev.y } : toWorld(r.left + r.width / 2 - 120, r.top + r.height / 2 - 60));
  const n = { id: newId(type === 'model' ? 'm' : type.split('.').pop().slice(0, 3)), type, x: Math.round(c.x / 8) * 8, y: Math.round(c.y / 8) * 8, data };
  FLOW.nodes.push(n);
  // a smart wire: from the selected node's output into the first input of the new node that takes it
  if (prev) portsOf(prev).then(async pp => {
    const o = pp.outs[0], np = await portsOf(n), i = o && np.ins.find(x => accepts(x.kind, o.kind) || o.kind === 'any');
    if (i) FLOW.edges.push({ id: newId('e'), from: prev.id, out: o.key, to: n.id, in: i.key });
    SEL = n.id; commit();
  }); else { SEL = n.id; commit(); }
  return n;
}
canvas.addEventListener('dragover', e => { if (e.dataTransfer.types.includes('text/x-unified')) { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; } });
canvas.addEventListener('drop', e => {
  const raw = e.dataTransfer.getData('text/x-unified'); if (!raw) return; e.preventDefault();
  const { type, data } = JSON.parse(raw), p = toWorld(e.clientX - 110, e.clientY - 30), keep = SEL; SEL = null; addNode(type, data, p); if (!keep) return;
});

/* ---------- the library ---------- */
let LIBSECT = store.get('uLibSect') || 'all';
const BASIC = [
  ['input', 'קלט', [['input.text', {}, 'טקסט'], ['input.media', { kind: 'image', urls: [] }, 'תמונה'], ['input.media', { kind: 'audio', urls: [] }, 'קול'], ['input.media', { kind: 'video', urls: [] }, 'וידאו']]],
  ['tool', 'כלים', [['tool.template', { template: '{{a}}' }], ['tool.extract', { path: '' }], ['tool.split', { by: 'lines' }], ['tool.join', { sep: '\\n\\n' }], ['tool.pick', { which: 'first' }]]],
  ['compose', 'הרכבה ופלט', [['tool.compose', { aspect: '9:16', musicVolume: 0.22 }], ['output', {}]]],
];
function library() {
  const q = $('#uLibQ').value.trim().toLowerCase();
  const basic = BASIC.map(([cat, title, list]) => {
    const items = list.filter(([t, , name]) => !q || ((name || TYPES[t].title) + ' ' + TYPES[t].about).toLowerCase().includes(q));
    return items.length ? `<h3>${title}</h3>${items.map(([t, d, name]) => `<button class="ulib-i c-${cat}" draggable="true" data-type="${t}" data-data="${esc(JSON.stringify(d))}"><span class="uic">${ICON[t]}</span><span><b>${esc(name || TYPES[t].title)}</b><small>${esc(TYPES[t].about)}</small></span></button>`).join('')}` : '';
  }).join('');
  const models = [...ALL, ...FREE].filter(m => m.live !== false && (LIBSECT === 'all' || (LIBSECT === 'free' ? m.free : !m.free && m.group === LIBSECT)) && (!q || (m.id + ' ' + m.name + ' ' + m.provider + ' ' + (m.note || '')).toLowerCase().includes(q)));
  const order = { top: 0, mid: 1, low: 2, free: 3 };
  models.sort((a, b) => (order[a.tier] - order[b.tier]) || (a.rank || 0) - (b.rank || 0));
  $('#uLibList').innerHTML = basic + `<h3>מודלים <small>${models.length}</small></h3>` + models.slice(0, 220).map(m => `<button class="ulib-i c-ai k-${m.out}" draggable="true" data-type="model" data-data="${esc(JSON.stringify({ model: m.id }))}" title="${esc(m.note || m.about || '')}"><span class="uic">✦</span><span><b dir="ltr">${esc(m.name)}</b><small>${esc(m.free ? 'חינם' : TIER_NAME[m.tier])} · ${esc(KIND_NAME[m.out] || '')} · ${esc(m.free ? m.provider : brief(m))}</small></span></button>`).join('');
  $('#uLibSeg').innerHTML = SECTORS.map(([id, t]) => `<button type="button" data-s="${id}" aria-pressed="${id === LIBSECT}">${esc(t)}</button>`).join('');
}
$('#uLibQ').addEventListener('input', library);
$('#uLibSeg').addEventListener('click', e => { const b = e.target.closest('[data-s]'); if (!b) return; LIBSECT = b.dataset.s; store.set('uLibSect', LIBSECT); library(); });
$('#uLibList').addEventListener('click', e => { const b = e.target.closest('.ulib-i'); if (!b) return; addNode(b.dataset.type, JSON.parse(b.dataset.data)); if (innerWidth < 860) document.body.classList.remove('ulib-open'); });
$('#uLibList').addEventListener('dragstart', e => { const b = e.target.closest('.ulib-i'); if (!b) return; e.dataTransfer.setData('text/x-unified', JSON.stringify({ type: b.dataset.type, data: JSON.parse(b.dataset.data) })); e.dataTransfer.effectAllowed = 'copy'; });

/* ---------- the inspector ---------- */
const NODE = () => FLOW && typeof SEL === 'string' ? FLOW.nodes.find(n => n.id === SEL) : null;
function set(path, v, { rerender = true } = {}) { const n = NODE(); if (!n) return; snapshot(); n.data = n.data || {}; n.data[path] = v; DIRTY = true; saved('שינויים לא שמורים'); if (rerender) render(); else { price(); updateNode(n); } }
function updateNode(n) { const el = nodesEl.querySelector(`[data-id="${CSS.escape(n.id)}"] .unt small`); if (el) el.textContent = subtitle(n); }
function inspector() {
  const box = $('#uInsp'), n = NODE();
  if (!n) {
    const e = SEL && SEL.edge ? FLOW.edges.find(x => x.id === SEL.edge) : null;
    box.innerHTML = e ? `<h2>חיבור</h2><p class="hint">${esc(nodeName(e.from))} ← ${esc(nodeName(e.to))} (${esc(e.in)})</p><button class="ghost" id="uDelEdge">מחיקת החיבור</button>`
      : `<h2>${esc(FLOW.name || 'זרימה')}</h2><label>תיאור<textarea id="uAbout" rows="3" dir="auto">${esc(FLOW.about || '')}</textarea></label>${summary()}<details class="ukeys"><summary>קיצורי מקלדת</summary><ul><li><kbd>Ctrl</kbd>+<kbd>Enter</kbd> הרצה</li><li><kbd>Ctrl</kbd>+<kbd>S</kbd> שמירה</li><li><kbd>Ctrl</kbd>+<kbd>Z</kbd> / <kbd>Ctrl</kbd>+<kbd>Y</kbd> ביטול / חזרה</li><li><kbd>Delete</kbd> מחיקת צומת או חיבור</li><li><kbd>Ctrl</kbd>+<kbd>D</kbd> שכפול צומת</li><li><kbd>Ctrl</kbd>+גלגלת: זום · גרירה ברקע: הזזה</li></ul></details>`;
    if (e) $('#uDelEdge').onclick = () => { snapshot(); FLOW.edges = FLOW.edges.filter(x => x.id !== e.id); SEL = null; commit(); };
    if ($('#uAbout')) $('#uAbout').oninput = ev => { FLOW.about = ev.target.value; DIRTY = true; };
    return;
  }
  const T = typeOf(n), d = n.data || {}, r = RES[n.id], est = ESTIMATE && ESTIMATE.per[n.id];
  let body = '';
  if (n.type === 'input.text') body = `<label>טקסט<textarea id="uiText" rows="9" dir="auto">${esc(d.text || '')}</textarea></label><p class="hint" id="uiCount">${(d.text || '').length} תווים</p>`;
  else if (n.type === 'input.media') body = `<label>סוג<select id="uiKind">${['image', 'audio', 'video'].map(k => `<option value="${k}"${(d.kind || 'image') === k ? ' selected' : ''}>${KIND_NAME[k]}</option>`).join('')}</select></label>
    <div class="fld media" id="uiMedia"><span class="fl">קבצים <span class="hint">(יותר מאחד: כל צומת אחריו רץ על כל קובץ)</span></span><div class="thumbs"></div><div class="madd"><button class="ghost sm" type="button" data-act="file">קובץ</button><button class="ghost sm" type="button" data-act="url">קישור</button><button class="ghost sm" type="button" data-act="prev">מתוצאה קודמת</button><input type="file" multiple hidden></div><div class="murl" hidden><input type="url" dir="ltr" placeholder="https://…"><button class="ghost sm" type="button">הוספה</button></div><div class="mprev" hidden></div></div>`;
  else if (n.type === 'model') body = modelPanel(n);
  else if (n.type === 'tool.template') body = `<label>תבנית<textarea id="uiTpl" rows="10" dir="auto" class="mono">${esc(d.template || '')}</textarea></label><p class="hint">משתנים: ${['a', 'b', 'c', 'd'].map(k => `<button class="chipb" data-ins="{{${k}}}">{{${k}}}</button>`).join(' ')} · כל אחד מקבל את מה שמחובר לשקע באותו שם.</p>`;
  else if (n.type === 'tool.extract') body = `<label>נתיב<input id="uiPath" dir="ltr" value="${esc(d.path || '')}" placeholder="shots[].prompt"></label><p class="hint">שם שדה (<code dir="ltr">voiceover</code>), שדה בתוך שדה (<code dir="ltr">scene.prompt</code>), או כל הפריטים ברשימה (<code dir="ltr">shots[].prompt</code>), ואז כל צומת אחריו רץ על כל פריט.</p><label>כמה פריטים צפויים (להערכת המחיר)<input id="uiExpect" type="number" min="1" max="50" dir="ltr" value="${esc(d.expect || 4)}"></label>`;
  else if (n.type === 'tool.split') body = `<label>פיצול<select id="uiBy"><option value="lines"${(d.by || 'lines') === 'lines' ? ' selected' : ''}>שורה לכל פריט</option><option value="sep"${d.by === 'sep' ? ' selected' : ''}>לפי מפריד</option><option value="json"${d.by === 'json' ? ' selected' : ''}>מערך JSON</option></select></label><label>מפריד<input id="uiSep" dir="ltr" value="${esc(d.sep || '---')}"></label><label>כמה פריטים צפויים<input id="uiExpect" type="number" min="1" max="50" dir="ltr" value="${esc(d.expect || 4)}"></label>`;
  else if (n.type === 'tool.join') body = `<label>מפריד<input id="uiSep" dir="ltr" value="${esc(d.sep ?? '\\n\\n')}"></label>`;
  else if (n.type === 'tool.pick') body = `<label>איזה פריט<select id="uiWhich"><option value="first"${d.which !== 'last' && !d.index ? ' selected' : ''}>הראשון</option><option value="last"${d.which === 'last' ? ' selected' : ''}>האחרון</option><option value="index"${d.index ? ' selected' : ''}>לפי מספר</option></select></label><label>מספר<input id="uiIndex" type="number" min="1" dir="ltr" value="${esc(d.index || 1)}"></label>`;
  else if (n.type === 'tool.compose') body = `<label>יחס<select id="uiAspect">${['9:16', '16:9', '1:1', '4:5'].map(a => `<option${(d.aspect || '9:16') === a ? ' selected' : ''}>${a}</option>`).join('')}</select></label>
    <div class="row2"><label>שניות לכל תמונה<input id="uiImgS" type="number" min="1" max="20" step="0.5" dir="ltr" value="${esc(d.imageSeconds || 3)}"></label><label>עוצמת מוזיקה (0–1)<input id="uiMusic" type="number" min="0" max="1" step="0.05" dir="ltr" value="${esc(d.musicVolume ?? 0.22)}"></label></div>
    <div class="row2"><label>מעבר (שניות)<input id="uiFade" type="number" min="0" max="2" step="0.05" dir="ltr" value="${esc(d.fade ?? 0.35)}"></label><label class="tog"><input type="checkbox" id="uiKeep"${d.keepVideoAudio ? ' checked' : ''}> לשמור את הקול של הסרטונים</label></div>
    <p class="hint">ההרכבה רצה בדפדפן בזמן אמת: סרטון של 12 שניות לוקח כ-12 שניות. בזמן הזה הלשונית צריכה להישאר פתוחה. מה-CLI אותו צומת מורכב עם ffmpeg ל-MP4.</p>`;
  else if (n.type === 'output') body = `<p class="hint">כל מה שמתחבר לכאן הוא התוצאה של הזרימה, והוא נשמר בהיסטוריית הריצות.</p>`;
  box.innerHTML = `<div class="uih"><span class="uic">${ICON[n.type]}</span><div><input id="uiTitle" value="${esc(n.title || '')}" placeholder="${esc(T.title)}" aria-label="שם הצומת" dir="auto"><small>${esc(T.title)} · <span dir="ltr">${esc(n.id)}</span></small></div></div>
    ${body}
    ${est && est.usd != null && n.type === 'model' ? `<p class="uiest">הערכה לצומת: ${est.kind === 'upTo' ? 'עד ' : '≈ '}${usd(est.usd)}${est.runs > 1 ? ` (${est.runs} הרצות × ${usd(est.each)})` : ''}</p>` : ''}
    <div class="uiact"><button class="ghost sm" id="uiRunOne">הרצת הצומת הזה</button><button class="ghost sm" id="uiRunFrom">הרצה מכאן והלאה</button><button class="ghost sm" id="uiDup">שכפול</button><button class="ghost sm danger" id="uiDel">מחיקה</button></div>
    ${r ? resultsPanel(n, r) : ''}`;
  wireInspector(n);
}
const nodeName = id => { const n = FLOW.nodes.find(x => x.id === id); return n ? n.title || (n.type === 'model' && CATALOG.get(n.data.model) ? CATALOG.get(n.data.model).name : typeOf(n).title) : id; };
function summary() {
  const e = ESTIMATE; if (!e) return '';
  const lines = Object.entries(e.per).filter(([, v]) => v.usd || v.kind === 'free').map(([id, v]) => `<tr><td dir="auto">${esc(nodeName(id))}</td><td class="n">${v.kind === 'free' ? 'חינם' : (v.kind === 'upTo' ? 'עד ' : '≈ ') + usd(v.usd)}</td></tr>`).join('');
  return `<h3>מחיר משוער</h3><table class="tbl"><tbody>${lines || '<tr><td>אין צמתים בתשלום</td></tr>'}<tr><td><b>סך הכול</b></td><td class="n"><b>${usd(e.total)}</b></td></tr></tbody></table>${e.unknown ? `<p class="hint">ל-${e.unknown} צמתים אין הערכת מחיר; המחיר שלהם יתברר בריצה.</p>` : ''}`;
}
function modelPanel(n) {
  const d = n.data || {}, m = CATALOG.get(d.model);
  if (!m) return `<p class="hint">בוחרים מודל מהספרייה, או כאן:</p>${pickerHTML('')}`;
  const linked = FLOW.edges.filter(e => e.to === n.id);
  const free = m.free ? `<label>הוראות (system)<textarea id="uiSys" rows="3" dir="auto">${esc(d.system || '')}</textarea></label>
     ${m.out === 'text' ? `<label>אורך מרבי<input id="uiMax" type="number" dir="ltr" min="32" max="8000" value="${esc(d.max || 1024)}"></label>` : ''}
     ${m.out === 'image' ? `<div class="row2"><label>רוחב<input id="uiW" type="number" dir="ltr" step="16" value="${esc(d.width || 1024)}"></label><label>גובה<input id="uiH" type="number" dir="ltr" step="16" value="${esc(d.height || 768)}"></label></div>` : ''}` : '';
  return `<div class="uimodel"><b dir="ltr">${esc(m.name)}</b><span>${esc(m.free ? 'חינם · מהמכסה היומית' : TIER_NAME[m.tier] + ' · ' + m.provider)}</span><p>${esc(m.note || '')}</p><p class="price">${esc(m.free ? '' : brief(m))}</p></div>
    <div class="uiact">${m.free ? '' : '<button class="go sm" id="uiCfg">הגדרות מלאות של המודל</button>'}<button class="ghost sm" id="uiSwap">החלפת מודל</button></div>
    <div id="uiPicker" hidden>${pickerHTML(m.out)}</div>
    ${free}
    ${!m.free ? `<details class="ujson"${d.input ? '' : ''}><summary>${d.input ? 'הבקשה שנשמרה בצומת' : 'בלי הגדרות: הדוגמה של Cloudflare היא הבסיס'}</summary>${d.input ? `<pre dir="ltr">${esc(JSON.stringify(d.input, null, 1).slice(0, 3000))}</pre><button class="ghost sm" id="uiReset">איפוס להגדרות של הדוגמה</button>` : ''}</details>` : ''}
    <h3>קלטים</h3><ul class="uiports" id="uiPorts"></ul>
    ${['listen'].includes(m.group) || /video|audio/.test(m.out) ? `<label>${m.group === 'listen' ? 'אורך משוער של ההקלטה (שניות)' : 'אורך משוער (שניות, להערכת המחיר)'}<input id="uiSecs" type="number" dir="ltr" min="1" value="${esc(d.expectSeconds || '')}" placeholder="30"></label>` : ''}
    <p class="hint">${linked.length ? '' : 'אין עדיין חיבורים לצומת הזה. '}שקע עם * הוא חובה.</p>`;
}
function pickerHTML(kind) {
  const list = [...ALL, ...FREE].filter(m => m.live !== false && (!kind || m.out === kind)).sort((a, b) => ({ top: 0, mid: 1, low: 2, free: 3 }[a.tier] - { top: 0, mid: 1, low: 2, free: 3 }[b.tier]));
  return `<input id="uiPickQ" type="search" placeholder="חיפוש מודל" dir="auto"><div class="uipick">${list.map(m => `<button type="button" data-m="${esc(m.id)}"><b dir="ltr">${esc(m.name)}</b><small>${esc(m.free ? 'חינם' : TIER_NAME[m.tier])} · ${esc(m.free ? '' : brief(m))}</small></button>`).join('')}</div>`;
}
function resultsPanel(n, r) {
  const items = r.items || [];
  return `<h3>תוצאה ${r.status === 'error' ? '<span class="bad">· שגיאה</span>' : r.reused ? '<span class="hint">· מהריצה הקודמת</span>' : ''}</h3>
    ${r.error ? `<p class="uerr" dir="auto">${esc(r.error)}</p>${r.hint ? `<p class="hintx">${esc(r.hint)}</p>` : ''}` : ''}
    <div class="uires">${items.map((it, i) => it.kind === 'image' ? `<figure><img src="${esc(it.value)}" alt="תוצאה ${i + 1}"><figcaption>${mediaActs(it, i)}</figcaption></figure>`
      : it.kind === 'video' ? `<figure><video src="${esc(it.value)}" controls playsinline preload="metadata"></video><figcaption>${mediaActs(it, i)}</figcaption></figure>`
      : it.kind === 'audio' ? `<figure><audio src="${esc(it.value)}" controls preload="metadata"></audio><figcaption>${mediaActs(it, i)}</figcaption></figure>`
      : `<pre class="uitext" dir="auto">${esc(String(it.value).slice(0, 6000))}</pre>`).join('')}</div>
    ${items.length && n.type !== 'output' ? `<div class="uiact"><button class="ghost sm" id="uiPin">${n.data && n.data.pinned ? 'ביטול הנעיצה' : '📌 נעיצת התוצאה (בלי לשלם עליה שוב)'}</button></div>` : ''}`;
}
const mediaActs = (it, i) => `<a href="${esc(it.value)}" target="_blank" rel="noopener"${it.local ? ` download="${esc(it.name || 'ailgen-unified')}"` : ''}>${it.local ? 'הורדה' : 'פתיחה'}</a>${it.local ? '' : ` · <button class="linkb" data-use="${i}">כקלט חדש</button>`}${it.usd ? ` · ${usd(it.usd)}` : ''}`;

function wireInspector(n) {
  const on = (sel, ev, f) => { const el = $(sel); if (el) el['on' + ev] = f; };
  on('#uiTitle', 'change', e => { snapshot(); n.title = e.target.value.trim() || undefined; commit(); });
  on('#uiText', 'input', e => { n.data.text = e.target.value; $('#uiCount').textContent = e.target.value.length + ' תווים'; DIRTY = true; updateNode(n); price(); });
  on('#uiText', 'change', () => { snapshot(); commit(); });
  on('#uiKind', 'change', e => { set('kind', e.target.value); });
  on('#uiTpl', 'change', e => set('template', e.target.value, { rerender: false }));
  $$('[data-ins]').forEach(b => b.onclick = () => { const t = $('#uiTpl'); t.setRangeText(b.dataset.ins, t.selectionStart, t.selectionEnd, 'end'); t.focus(); set('template', t.value, { rerender: false }); });
  on('#uiPath', 'change', e => set('path', e.target.value.trim(), { rerender: false }));
  on('#uiExpect', 'change', e => set('expect', +e.target.value || 4, { rerender: false }));
  on('#uiBy', 'change', e => set('by', e.target.value));
  on('#uiSep', 'change', e => set('sep', e.target.value, { rerender: false }));
  on('#uiWhich', 'change', e => { if (e.target.value === 'index') set('index', +$('#uiIndex').value || 1); else { n.data.index = undefined; set('which', e.target.value); } });
  on('#uiIndex', 'change', e => { set('which', 'index', { rerender: false }); set('index', +e.target.value || 1, { rerender: false }); });
  on('#uiAspect', 'change', e => set('aspect', e.target.value));
  on('#uiImgS', 'change', e => set('imageSeconds', +e.target.value || 3, { rerender: false }));
  on('#uiMusic', 'change', e => set('musicVolume', Math.max(0, Math.min(1, +e.target.value)), { rerender: false }));
  on('#uiFade', 'change', e => set('fade', Math.max(0, +e.target.value), { rerender: false }));
  on('#uiKeep', 'change', e => set('keepVideoAudio', e.target.checked, { rerender: false }));
  on('#uiSys', 'change', e => set('system', e.target.value, { rerender: false }));
  on('#uiMax', 'change', e => set('max', +e.target.value || 1024, { rerender: false }));
  on('#uiW', 'change', e => set('width', +e.target.value || 1024, { rerender: false }));
  on('#uiH', 'change', e => set('height', +e.target.value || 768, { rerender: false }));
  on('#uiSecs', 'change', e => set('expectSeconds', +e.target.value || undefined, { rerender: false }));
  on('#uiReset', 'click', () => { n.data.input = undefined; set('input', undefined); });
  on('#uiCfg', 'click', () => configure(n.data.model, n.data.input, input => { snapshot(); n.data.input = input; commit('ההגדרות נשמרו בצומת'); select(n.id); }));
  on('#uiSwap', 'click', () => { $('#uiPicker').hidden = !$('#uiPicker').hidden; if (!$('#uiPicker').hidden) $('#uiPickQ').focus(); });
  on('#uiPickQ', 'input', e => { const q = e.target.value.toLowerCase(); $$('.uipick button').forEach(b => { b.hidden = q && !b.textContent.toLowerCase().includes(q); }); });
  $$('.uipick button').forEach(b => b.onclick = () => { snapshot(); const keepIns = FLOW.edges.filter(e => e.to === n.id); n.data = { model: b.dataset.m }; commit(); portsOf(n).then(p => { FLOW.edges = FLOW.edges.filter(e => e.to !== n.id || p.ins.some(i => i.key === e.in)); if (FLOW.edges.length !== keepIns.length) render(); }); });
  on('#uiRunOne', 'click', () => runFlow({ only: n.id }));
  on('#uiRunFrom', 'click', () => runFlow({ from: n.id }));
  on('#uiDup', 'click', () => duplicate(n));
  on('#uiDel', 'click', () => removeNode(n.id));
  on('#uiPin', 'click', () => { snapshot(); const r = RES[n.id]; if (n.data.pinned) { n.data.pinned = false; delete n.data.pinnedItems; } else { n.data.pinned = true; n.data.pinnedItems = (r.items || []).filter(it => !it.local); } commit(n.data.pinned ? 'התוצאה ננעצה: בריצות הבאות הצומת לא ירוץ שוב' : 'הנעיצה בוטלה'); });
  $$('[data-use]').forEach(b => b.onclick = () => { const it = (RES[n.id].items || [])[+b.dataset.use]; SEL = null; addNode('input.media', { kind: it.kind, urls: [it.value] }, { x: n.x, y: n.y + 220 }); });
  if (n.type === 'model') portsOf(n).then(p => {
    const ul = $('#uiPorts'); if (!ul) return;
    ul.innerHTML = p.ins.map(i => { const es = FLOW.edges.filter(e => e.to === n.id && e.in === i.key); return `<li class="k-${i.kind}"><i></i><span>${esc(i.label || i.key)}${i.req ? ' <b>*</b>' : ''} <small dir="ltr">${esc(i.key)}</small></span><em>${es.length ? '← ' + es.map(e => esc(nodeName(e.from))).join(', ') : n.data.input && n.data.input[i.key] != null ? 'מההגדרות' : 'לא מחובר'}</em></li>`; }).join('');
  });
  if (n.type === 'input.media') mediaBox(n);
}
function mediaBox(n) {
  const el = $('#uiMedia'), kind = n.data.kind || 'image', file = $('input[type=file]', el), urlBox = $('.murl', el);
  file.accept = kind + '/*';
  const draw = () => { const v = n.data.urls || []; $('.thumbs', el).innerHTML = v.map((u, i) => `<span class="th">${kind === 'image' ? `<img src="${esc(u)}" alt="">` : `<i>${kind === 'video' ? '🎬' : '♪'}</i>`}<button type="button" data-rm="${i}" aria-label="הסרה">✕</button></span>`).join(''); $$('[data-rm]', el).forEach(b => b.onclick = () => { snapshot(); n.data.urls.splice(+b.dataset.rm, 1); commit(); }); };
  const add = u => { snapshot(); n.data.urls = [...(n.data.urls || []), u]; commit(); };
  $('[data-act=file]', el).onclick = () => file.click();
  file.onchange = async () => { for (const f of file.files) { if (f.size > 8.5e6) { alert('הקובץ גדול מ-8.5MB: עדיף קישור'); continue; } add(await toData(f)); } };
  $('[data-act=url]', el).onclick = () => { urlBox.hidden = !urlBox.hidden; };
  $('button', urlBox).onclick = () => { const v = $('input', urlBox).value.trim(); if (/^https:\/\//.test(v)) add(v); };
  $('[data-act=prev]', el).onclick = () => {
    const box = $('.mprev', el), list = [...Object.values(RES).flatMap(r => r.items || []).filter(i => i.kind === kind && !i.local).map(i => i.value), ...SESSION.filter(s => s.kind === kind).map(s => s.url)];
    box.hidden = !box.hidden; box.innerHTML = list.length ? [...new Set(list)].slice(0, 40).map(u => `<button type="button" data-u="${esc(u)}">${kind === 'image' ? `<img src="${esc(u)}" alt="">` : `<i>${kind === 'video' ? '🎬' : '♪'}</i>`}</button>`).join('') : '<span class="hint">עוד אין תוצאות מהסוג הזה בסשן.</span>';
    $$('[data-u]', box).forEach(b => b.onclick = () => add(b.dataset.u));
  };
  draw();
}
function duplicate(n) { const c = clone(n); c.id = newId(n.type === 'model' ? 'm' : 'n'); c.x += 32; c.y += 32; if (c.data) { delete c.data.pinned; delete c.data.pinnedItems; } snapshot(); FLOW.nodes.push(c); SEL = c.id; commit(); }
function removeNode(id) { snapshot(); FLOW.nodes = FLOW.nodes.filter(n => n.id !== id); FLOW.edges = FLOW.edges.filter(e => e.from !== id && e.to !== id); delete RES[id]; SEL = null; commit(); }

/* ---------- price before the run ---------- */
let priceT = 0;
function price() {
  clearTimeout(priceT);
  priceT = setTimeout(async () => {
    if (!FLOW) return;
    ESTIMATE = await engine.estimate(FLOW).catch(() => null);
    const e = ESTIMATE; if (!e) return;
    $('#uEst').textContent = !FLOW.nodes.length ? '' : `${e.upTo ? 'עד ' : '≈ '}${usd(e.total)} לריצה${e.unknown ? ` · ${e.unknown} בלי מחיר` : ''}`;
    if (!CAP_TOUCHED) $('#uCap').value = e.total ? Math.max(1, Math.ceil(e.total * 1.5 * 2) / 2) : '';
    $$('.un', nodesEl).forEach(el => { const v = e.per[el.dataset.id], c = el.querySelector('.ucost'); if (c && !(RES[el.dataset.id] && RES[el.dataset.id].status === 'done')) c.textContent = v ? (v.kind === 'free' ? 'חינם' : v.kind === 'pinned' ? 'נעוץ' : v.usd == null ? '?' : (v.kind === 'upTo' ? 'עד ' : '≈ ') + usd(v.usd)) : ''; });
    if (!NODE() && !(SEL && SEL.edge)) inspector();
  }, 250);
}
$('#uCap').addEventListener('input', () => { CAP_TOUCHED = true; });

/* ---------- run ---------- */
const logEl = $('#uLogList');
function log(msg, cls = '') { const li = document.createElement('li'); li.className = cls; li.innerHTML = `<time>${new Date().toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</time><span dir="auto">${msg}</span>`; logEl.prepend(li); $('#uStatus').innerHTML = msg; }
async function runFlow(opt = {}) {
  if (RUN) return;
  if (!L.key) return log('צריך להיכנס עם הקוד של המעבדה', 'err');
  const c = await engine.check(FLOW);
  $$('.un', nodesEl).forEach(el => el.classList.remove('bad'));
  if (!c.ok) { c.errors.forEach(er => { log(`${er.node ? esc(nodeName(er.node)) + ': ' : ''}${esc(er.msg)}`, 'err'); if (er.node) { const el = nodesEl.querySelector(`[data-id="${CSS.escape(er.node)}"]`); if (el) el.classList.add('bad'); } }); document.body.classList.add('ulog-open'); return; }
  const e = await engine.estimate(FLOW), cap = $('#uCap').value === '' ? null : +$('#uCap').value, b = L.budget;
  if (!opt.only && !opt.from && ((e.total || 0) > 1 || e.unknown) && !confirm(`הזרימה תעלה ${e.upTo ? 'עד ' : 'כ-'}${usd(e.total)}${e.unknown ? `, ועוד ${e.unknown} צמתים בלי הערכה` : ''}.${cap != null ? ` תקרת הריצה: $${cap}.` : ''}${b ? ` נשארו בתקציב ${usd(b.budget - b.spent)}.` : ''}\n\nלהריץ?`)) return;
  RUN = new AbortController(); document.body.classList.add('urunning'); $('#uRun').disabled = true; $('#uStop').hidden = false;
  log(`<b>ריצה</b>${opt.only ? ` של «${esc(nodeName(opt.only))}»` : opt.from ? ` מ«${esc(nodeName(opt.from))}» והלאה` : ''} · הערכה ${usd(e.total)}`);
  const t0 = Date.now();
  try {
    const r = await engine.run(FLOW, { prev: RES, only: opt.only, from: opt.from, maxUsd: cap, signal: RUN.signal, on: ev => {
      if (ev.type !== 'node') return;
      RES[ev.id] = { ...(RES[ev.id] || {}), ...ev, items: ev.items || (ev.status === 'running' ? (RES[ev.id] || {}).items : []) };
      if (ev.status === 'running') { if (!ev.progress) log(`${esc(nodeName(ev.id))} · רץ…`); }
      else if (ev.status === 'done' && !ev.reused) log(`${esc(nodeName(ev.id))} · ${(ev.items || []).length} תוצאות · ${usd(ev.cost || 0)} · ${((ev.ms || 0) / 1000).toFixed(1)}s`, 'ok');
      else if (ev.status === 'error') log(`${esc(nodeName(ev.id))} · ${esc(ev.error)}${ev.hint ? ' · ' + esc(ev.hint) : ''}`, 'err');
      else if (ev.status === 'skipped') log(`${esc(nodeName(ev.id))} · דולג: ${esc(ev.error)}`, 'warn');
      render();
    } });
    log(`<b>${r.stopped ? 'נעצרה' : r.errors.length ? 'הסתיימה עם שגיאות' : 'הסתיימה'}</b> · הוצאו ${usd(r.spent)} · ${((Date.now() - t0) / 1000).toFixed(0)} שניות${r.stopped ? ' · ' + esc(r.stopped) : ''}`, r.stopped || r.errors.length ? 'warn' : 'ok');
    outputs(r.outputs);
    const rec = await api({ op: 'record', run: { flow: { ...FLOW, nodes: FLOW.nodes.map(n => ({ ...n, data: { ...n.data, pinnedItems: undefined } })) }, results: slim(RES), spent: r.spent, stopped: r.stopped, errors: r.errors, outputs: r.outputs.filter(i => !i.local), by: 'owner', only: opt.only, from: opt.from } });
    if (rec && rec.ok) log('הריצה נשמרה בהיסטוריה');
  } catch (err) { log(esc(err.message), 'err'); }
  finally { RUN = null; document.body.classList.remove('urunning'); $('#uRun').disabled = false; $('#uStop').hidden = true; L.renderBudget(true); render(); }
}
function outputs(items) {
  const box = $('#uOut');
  box.innerHTML = items.length ? items.map((it, i) => it.kind === 'image' ? `<figure><img src="${esc(it.value)}" alt="פלט ${i + 1}"><figcaption>${mediaActs(it, i)}</figcaption></figure>`
    : it.kind === 'video' ? `<figure class="vid"><video src="${esc(it.value)}" controls playsinline></video><figcaption>${it.local ? `<a href="${esc(it.value)}" download="${esc(it.name)}">הורדת הסרטון (${(it.size / 1e6).toFixed(1)}MB · ${it.seconds}s)</a>` : `<a href="${esc(it.value)}" target="_blank" rel="noopener">פתיחה</a>`}</figcaption></figure>`
    : it.kind === 'audio' ? `<figure><audio src="${esc(it.value)}" controls></audio></figure>` : `<pre class="uitext" dir="auto">${esc(String(it.value).slice(0, 4000))}</pre>`).join('') : '<p class="hint">לזרימה אין צומת פלט, או שהוא ריק.</p>';
  if (items.length) document.body.classList.add('ulog-open');
  $$('[data-use]', box).forEach(b => b.onclick = () => { const it = items[+b.dataset.use]; addNode('input.media', { kind: it.kind, urls: [it.value] }); });
}
$('#uRun').onclick = () => runFlow();
$('#uStop').onclick = () => { if (RUN) { RUN.abort(); log('עוצרים אחרי הקריאה שרצה עכשיו…', 'warn'); } };
$('#uLogT').onclick = () => document.body.classList.toggle('ulog-open');

/* ---------- flows: new, open, save, templates, JSON, runs ---------- */
async function save() {
  FLOW.name = $('#uName').value.trim() || 'זרימה ללא שם';
  const r = await api({ op: 'save', flow: FLOW, by: 'owner' });
  if (r.ok) { FLOW.updated = r.updated; DIRTY = false; saved('נשמרה'); store.set('unifiedDraft', null); store.set('unifiedLast', FLOW.id); log(`נשמרה בענן: «${esc(FLOW.name)}»`, 'ok'); }
  else { store.set('unifiedDraft', JSON.stringify(FLOW)); DIRTY = false; saved('נשמרה בדפדפן'); log(esc(r.hint || r.error || 'השמירה בענן נכשלה') + ' · נשמרה בדפדפן הזה', 'warn'); }
}
$('#uSave').onclick = save;
$('#uName').addEventListener('change', e => { FLOW.name = e.target.value; DIRTY = true; saved('שינויים לא שמורים'); });
$('#uNew').onclick = () => { if (DIRTY && !confirm('יש שינויים שלא נשמרו. להתחיל זרימה חדשה?')) return; load(blank()); };
$('#uLayout').onclick = () => { snapshot(); mirrorLayout(); commit(); requestAnimationFrame(fitView); };
$('#uUndo').onclick = undo; $('#uRedo').onclick = redo;

const dlg = $('#uDlg');
function dialog(title, html, wire) { $('#uDlgT').textContent = title; $('#uDlgB').innerHTML = html; dlg.showModal(); wire && wire($('#uDlgB')); }
dlg.addEventListener('click', e => { if (e.target === dlg) dlg.close(); });
$('#uTpl').onclick = async () => {
  const est = await Promise.all(TEMPLATES.map(t => engine.estimate(t).then(e => e.total).catch(() => null)));
  dialog('תבניות', `<p class="lead">כל תבנית היא עבודה שלמה שמשלבת כמה מנועים. פותחים, מחליפים את הבריף, ומריצים. אפשר להחליף כל מודל.</p><div class="utpls">${TEMPLATES.map((t, i) => `<article class="utpl"><h3>${esc(t.name)}</h3><p>${esc(t.about)}</p><div class="utplf"><span class="cost">${est[i] == null ? '' : est[i] === 0 ? 'חינם' : '≈ ' + usd(est[i])}</span><span class="hint">${t.nodes.length} צמתים</span><button class="go sm" data-t="${i}">פתיחה</button></div></article>`).join('')}</div>`,
    box => $$('[data-t]', box).forEach(b => b.onclick = () => { if (DIRTY && !confirm('יש שינויים שלא נשמרו. לפתוח את התבנית במקומם?')) return; const t = clone(TEMPLATES[+b.dataset.t]); t.id = 'f' + Date.now().toString(36); load(t); dlg.close(); }));
};
$('#uOpen').onclick = async () => {
  const [f, r] = await Promise.all([api({ op: 'list' }), api({ op: 'runs', limit: 40 })]);
  const by = x => x === 'agent' ? '<span class="badge b-wai">Claude</span>' : '';
  const draft = store.get('unifiedDraft');
  dialog('זרימות וריצות', `<div class="seg sm" role="tablist"><button type="button" data-tab="f" aria-selected="true">זרימות שמורות</button><button type="button" data-tab="r" aria-selected="false">היסטוריית ריצות</button></div>
    <div data-p="f">${f.kv === false ? `<p class="hint">${esc(f.hint || 'אין שמירה בענן')}</p>` : ''}${draft ? `<p><button class="ghost sm" id="uDraft">טיוטה מהדפדפן הזה</button></p>` : ''}
     <table class="tbl"><thead><tr><th>שם</th><th>עודכנה</th><th>צמתים</th><th></th></tr></thead><tbody>${(f.flows || []).map(x => `<tr><td dir="auto">${esc(x.name)} ${by(x.by)}<br><small class="hint">${esc(x.about || '')}</small></td><td>${x.updated ? new Date(x.updated).toLocaleString('he-IL', { dateStyle: 'short', timeStyle: 'short' }) : ''}</td><td>${x.nodes || ''}</td><td><button class="go sm" data-open="${esc(x.id)}">פתיחה</button> <button class="ghost sm danger" data-del="${esc(x.id)}">מחיקה</button></td></tr>`).join('') || '<tr><td colspan="4">עוד אין זרימות שמורות</td></tr>'}</tbody></table></div>
    <div data-p="r" hidden><table class="tbl"><thead><tr><th>זרימה</th><th>מתי</th><th>עלות</th><th>מצב</th><th></th></tr></thead><tbody>${(r.runs || []).map(x => `<tr><td dir="auto">${esc(x.name)} ${by(x.by)}</td><td>${new Date(x.at).toLocaleString('he-IL', { dateStyle: 'short', timeStyle: 'short' })}</td><td class="n">${usd(x.usd)}</td><td>${{ done: 'הסתיימה', errors: 'שגיאות', stopped: 'נעצרה' }[x.status] || ''}</td><td><button class="ghost sm" data-run="${esc(x.key)}">פתיחה</button></td></tr>`).join('') || '<tr><td colspan="5">עוד אין ריצות</td></tr>'}</tbody></table></div>`,
  box => {
    $$('[data-tab]', box).forEach(b => b.onclick = () => { $$('[data-tab]', box).forEach(x => x.setAttribute('aria-selected', String(x === b))); $$('[data-p]', box).forEach(p => { p.hidden = p.dataset.p !== b.dataset.tab; }); });
    $$('[data-open]', box).forEach(b => b.onclick = async () => { const g = await api({ op: 'get', id: b.dataset.open }); if (g.flow) { load(g.flow); dlg.close(); } });
    $$('[data-del]', box).forEach(b => b.onclick = async () => { if (!confirm('למחוק את הזרימה?')) return; await api({ op: 'delete', id: b.dataset.del }); b.closest('tr').remove(); });
    $$('[data-run]', box).forEach(b => b.onclick = async () => { const g = await api({ op: 'run', key: b.dataset.run }); if (g.run) { load(g.run.flow, { results: g.run.results || {} }); outputs(g.run.outputs || []); log(`ריצה מ-${new Date(g.run.at).toLocaleString('he-IL')} · ${usd(g.run.spent)}${g.run.by === 'agent' ? ' · הורצה ע״י Claude' : ''}`); dlg.close(); } });
    const dr = $('#uDraft', box); if (dr) dr.onclick = () => { load(JSON.parse(draft)); DIRTY = true; dlg.close(); };
  });
};
$('#uJson').onclick = () => dialog('JSON של הזרימה', `<p class="hint">זו הזרימה כולה. אפשר להעתיק, לשמור כקובץ, או להדביק כאן זרימה אחרת (גם כזו ש-Claude כתב) ולהחיל.</p><textarea id="uJsonT" class="mono" rows="18" dir="ltr" spellcheck="false">${esc(JSON.stringify(FLOW, null, 1))}</textarea><div class="actions"><button class="go sm" id="uJsonApply">החלה</button><button class="ghost sm" id="uJsonCopy">העתקה</button><a class="ghost sm" id="uJsonDl" download="${esc((FLOW.name || 'flow').replace(/\s+/g, '-'))}.json">הורדה</a></div><p class="uerr" id="uJsonErr"></p>`, box => {
  $('#uJsonDl', box).href = URL.createObjectURL(new Blob([JSON.stringify(FLOW, null, 1)], { type: 'application/json' }));
  $('#uJsonCopy', box).onclick = () => navigator.clipboard && navigator.clipboard.writeText($('#uJsonT', box).value);
  $('#uJsonApply', box).onclick = async () => { try { const f = JSON.parse($('#uJsonT', box).value); if (!Array.isArray(f.nodes) || !Array.isArray(f.edges)) throw new Error('חסרים nodes או edges'); f.id = f.id || 'f' + Date.now().toString(36); load(f); DIRTY = true; dlg.close(); } catch (e) { $('#uJsonErr', box).textContent = e.message; } };
});

/* ---------- keyboard ---------- */
document.addEventListener('keydown', e => {
  if ($('#p-unified').hidden || dlg.open || $('#pdSheet').open) return;
  const typing = e.target.closest('input,textarea,select,[contenteditable]'), mod = e.ctrlKey || e.metaKey;
  if (mod && e.key === 's') { e.preventDefault(); save(); return; }
  if (mod && e.key === 'Enter') { e.preventDefault(); runFlow(); return; }
  if (typing) return;
  if (mod && e.key.toLowerCase() === 'z') { e.preventDefault(); e.shiftKey ? redo() : undo(); }
  else if (mod && e.key.toLowerCase() === 'y') { e.preventDefault(); redo(); }
  else if (mod && e.key.toLowerCase() === 'd' && NODE()) { e.preventDefault(); duplicate(NODE()); }
  else if ((e.key === 'Delete' || e.key === 'Backspace') && SEL) { e.preventDefault(); if (SEL.edge) { snapshot(); FLOW.edges = FLOW.edges.filter(x => x.id !== SEL.edge); SEL = null; commit(); } else removeNode(SEL); }
  else if (e.key === 'Escape' && SEL) { SEL = null; render(); }
});
addEventListener('beforeunload', e => { if (DIRTY && FLOW && FLOW.nodes.length) { store.set('unifiedDraft', JSON.stringify(FLOW)); } });
$('#uLibBtn').onclick = () => document.body.classList.toggle('ulib-open');
$('#uInspBtn').onclick = () => document.body.classList.toggle('uinsp-open');
$('#uEmpty').addEventListener('click', e => { const b = e.target.closest('[data-start]'); if (!b) return; if (b.dataset.start === 'blank') { addNode('input.text', { text: '' }, { x: 900, y: 120 }); fitView(); } else { const t = clone(TEMPLATES[+b.dataset.start]); t.id = 'f' + Date.now().toString(36); load(t); } });
$('#uEmpty').querySelector('.ustarts').innerHTML = TEMPLATES.slice(0, 3).map((t, i) => `<button class="utpl mini" data-start="${i}"><b>${esc(t.name)}</b><small>${esc(t.about)}</small></button>`).join('') + '<button class="utpl mini" data-start="blank"><b>זרימה ריקה</b><small>מתחילים מצומת טקסט ובונים</small></button>';

/* ---------- start ---------- */
library(); applyView();
const draft = store.get('unifiedDraft'), last = store.get('unifiedLast');
let first = null;
try { if (draft) first = JSON.parse(draft); } catch {}
if (!first && last && L.key) { const g = await api({ op: 'get', id: last }); if (g.flow) first = g.flow; }
load(first || blank(), { fit: true });
if (draft && first) { DIRTY = true; saved('טיוטה מהדפדפן'); }
// the tab opens on top of a hidden pane: fit once it is visible
new MutationObserver(() => { if (!$('#p-unified').hidden) requestAnimationFrame(() => { render().then(fitView); }); }).observe($('#p-unified'), { attributes: true, attributeFilter: ['hidden'] });
window.UNIFIED = { load, get flow() { return FLOW; }, run: runFlow, engine };
