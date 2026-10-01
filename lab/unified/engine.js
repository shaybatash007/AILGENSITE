// AILGEN Lab · AI UNIFIED: the flow engine. A flow is a graph of nodes (inputs, AI models, tools, a composer, outputs) joined by
// typed edges (text, image, video, audio). The engine checks a flow, prices it before it runs, runs it level by level, fans a
// list out into one call per item (as n8n runs a node once per item), reuses pinned or earlier results, and stops at a spend cap.
// No page and no network of its own: the host gives it the catalog, a way to call a model (always through the lab's /api/run, so
// the budget and the ledger see every call), and a composer. The lab's page (unified/ui.js) and the agent's CLI
// (cloud/lab/unified.mjs) run the very same flows with it.
import { estimate as priceOf } from '../price.js';
import { portsOf, assemble, isChatShape } from '../schema.js';

export const VERSION = 1;
export const KIND_NAME = { text: 'טקסט', image: 'תמונה', video: 'וידאו', audio: 'קול', visual: 'תמונה או וידאו', any: 'הכול' };
export const accepts = (portKind, itemKind) => portKind === 'any' || portKind === itemKind || (portKind === 'visual' && (itemKind === 'image' || itemKind === 'video'));

/* ---------- node types ---------- */
// ins: { key, kind, many?: 'list' (takes the whole list) | 'one-or-list', req?, label }; outs: { key, kind }
export const TYPES = {
  'input.text': { cat: 'input', title: 'טקסט', about: 'בריף, רעיון או כל טקסט שנכנס לזרימה', ins: [], outs: [{ key: 'text', kind: 'text' }] },
  'input.media': { cat: 'input', title: 'קובץ', about: 'תמונה, קול או וידאו: העלאה, קישור או תוצאה קודמת', ins: [], outs: [{ key: 'media', kind: n => (n.data && n.data.kind) || 'image' }] },
  model: { cat: 'ai', title: 'מודל AI', about: 'כל מודל מהקטלוג: בתשלום (מהקרדיטים) או חינמי', dynamic: true },
  'tool.template': { cat: 'tool', title: 'תבנית', about: 'מרכיב טקסט מכמה קלטים: {{a}}, {{b}}, {{c}}, {{d}}', ins: ['a', 'b', 'c', 'd'].map(k => ({ key: k, kind: 'text', label: '{{' + k + '}}' })), outs: [{ key: 'text', kind: 'text' }] },
  'tool.extract': { cat: 'tool', title: 'חילוץ מ-JSON', about: 'שולף שדה מתשובה של מודל: shots[].prompt מחזיר רשימה', ins: [{ key: 'text', kind: 'text', req: true, label: 'JSON' }], outs: [{ key: 'value', kind: 'text' }] },
  'tool.split': { cat: 'tool', title: 'פיצול לרשימה', about: 'טקסט לרשימה: שורה, מפריד או מערך JSON. כל צומת אחריה רץ על כל פריט', ins: [{ key: 'text', kind: 'text', req: true, label: 'טקסט' }], outs: [{ key: 'items', kind: 'text' }] },
  'tool.join': { cat: 'tool', title: 'איחוד', about: 'רשימה לטקסט אחד', ins: [{ key: 'items', kind: 'text', many: 'list', req: true, label: 'פריטים' }], outs: [{ key: 'text', kind: 'text' }] },
  'tool.pick': { cat: 'tool', title: 'בחירה מרשימה', about: 'פריט אחד מתוך רשימה (הראשון, האחרון, או לפי מספר)', ins: [{ key: 'items', kind: 'any', many: 'list', req: true, label: 'פריטים' }], outs: [{ key: 'item', kind: n => (n.data && n.data.kind) || 'any' }] },
  'tool.compose': { cat: 'compose', title: 'הרכבה לסרטון', about: 'תמונות וסרטונים ברצף, עם קריינות ומוזיקה, לסרטון אחד', ins: [{ key: 'visuals', kind: 'visual', many: 'list', req: true, label: 'תמונות / וידאו' }, { key: 'voice', kind: 'audio', label: 'קריינות' }, { key: 'music', kind: 'audio', label: 'מוזיקה' }], outs: [{ key: 'video', kind: 'video' }] },
  output: { cat: 'output', title: 'פלט', about: 'מה שהזרימה מוסרת בסוף', ins: [{ key: 'items', kind: 'any', many: 'list', req: true, label: 'תוצאות' }], outs: [] },
};

// a free Workers AI model, by how the lab calls it (lab/models.json "how")
const FREE_PORTS = {
  chat: () => [{ key: 'message', kind: 'text', req: true, label: 'הודעה' }, { key: 'system', kind: 'text', label: 'הוראות' }],
  'chat-vision': () => [{ key: 'message', kind: 'text', req: true, label: 'הודעה' }, { key: 'system', kind: 'text', label: 'הוראות' }, { key: 'image', kind: 'image', label: 'תמונה' }],
  flux2: () => [{ key: 'prompt', kind: 'text', req: true, label: 'תיאור' }], image: () => [{ key: 'prompt', kind: 'text', req: true, label: 'תיאור' }], 'image-json': () => [{ key: 'prompt', kind: 'text', req: true, label: 'תיאור' }],
  tts: () => [{ key: 'text', kind: 'text', req: true, label: 'טקסט' }], asr: () => [{ key: 'audio', kind: 'audio', req: true, label: 'קול' }],
  translate: () => [{ key: 'text', kind: 'text', req: true, label: 'טקסט' }],
};
export const FREE_OUT = { chat: 'text', 'chat-vision': 'text', flux2: 'image', image: 'image', 'image-json': 'image', tts: 'audio', asr: 'text', translate: 'text' };
export const freeRunnable = m => !!FREE_PORTS[m.how];

/* ---------- the engine ---------- */
// host: { catalog: { get(id) → model }, schemaOf(model) → schema file, call(id, input, { kind, route, hint }) → /api/run answer,
//         compose({ visuals, voice, music }, data, onProgress) → item, toBase64(url) → base64 (free speech-to-text only) }
export function createEngine(host) {
  const schemas = new Map();
  const schema = async m => { if (!m || m.free) return null; if (!schemas.has(m.id)) schemas.set(m.id, await host.schemaOf(m)); return schemas.get(m.id); };
  const modelOf = n => host.catalog.get(n.data && n.data.model);

  async function ports(n) {
    const T = TYPES[n.type]; if (!T) return { ins: [], outs: [] };
    const resolve = list => list.map(p => ({ ...p, kind: typeof p.kind === 'function' ? p.kind(n) : p.kind }));
    if (!T.dynamic) return { ins: resolve(T.ins), outs: resolve(T.outs) };
    const m = modelOf(n); if (!m) return { ins: [], outs: [{ key: 'out', kind: 'any' }] };
    if (m.free) return { ins: (FREE_PORTS[m.how] || (() => []))(), outs: [{ key: 'out', kind: FREE_OUT[m.how] || 'text' }] };
    return portsOf(m, await schema(m));
  }

  // the order to run in, and every problem a run would hit, before anything is spent
  async function check(flow) {
    const errs = [], ids = new Set(), byId = new Map(flow.nodes.map(n => [n.id, n]));
    for (const n of flow.nodes) {
      if (ids.has(n.id)) errs.push({ node: n.id, msg: 'שני צמתים עם אותו מזהה' }); ids.add(n.id);
      if (!TYPES[n.type]) errs.push({ node: n.id, msg: `סוג צומת לא מוכר: ${n.type}` });
      if (n.type === 'model') { const m = modelOf(n); if (!m) errs.push({ node: n.id, msg: 'לא נבחר מודל, או שהוא לא בקטלוג' }); else if (m.live === false) errs.push({ node: n.id, msg: 'המודל הזה לא רץ בבקשה אחת' }); else if (m.free && !freeRunnable(m)) errs.push({ node: n.id, msg: 'המודל החינמי הזה עוד לא נתמך בזרימות' }); }
    }
    const P = new Map(); for (const n of flow.nodes) P.set(n.id, await ports(n));
    for (const e of flow.edges) {
      const a = byId.get(e.from), b = byId.get(e.to);
      if (!a || !b) { errs.push({ edge: e.id, msg: 'חיבור לצומת שלא קיים' }); continue; }
      const o = P.get(a.id).outs.find(p => p.key === e.out), i = P.get(b.id).ins.find(p => p.key === e.in);
      if (!o || !i) { errs.push({ edge: e.id, node: b.id, msg: `חיבור לשקע שלא קיים (${e.out} → ${e.in})` }); continue; }
      if (o.kind !== 'any' && !accepts(i.kind, o.kind)) errs.push({ edge: e.id, node: b.id, msg: `${KIND_NAME[o.kind] || o.kind} לא נכנס ל${i.label || i.key} (${KIND_NAME[i.kind] || i.kind})` });
    }
    let order = [];
    try { order = topo(flow); } catch (e) { errs.push({ msg: e.message }); }
    for (const n of flow.nodes) {
      const p = P.get(n.id), bound = new Set(flow.edges.filter(e => e.to === n.id).map(e => e.in));
      for (const i of p.ins) if (i.req && !bound.has(i.key) && !hasStatic(n, i.key)) errs.push({ node: n.id, msg: `חסר קלט: ${i.label || i.key}` });
    }
    return { ok: !errs.length, errors: errs, order, ports: P };
  }
  const hasStatic = (n, key) => {
    const d = n.data || {}, inp = d.input || {};
    if (n.type === 'model') { const m = modelOf(n); if (m && !m.free && isChatShape(m.shape)) return key === 'message' && !!(d.input && JSON.stringify(d.input).length > 20); return inp[key] !== undefined && inp[key] !== ''; }
    return false;
  };

  /* how many items each node will make, and what the flow costs, before it runs */
  async function estimate(flow, opt = {}) {
    const { order, ports: P } = await check(flow).catch(() => ({ order: [], ports: new Map() }));
    const count = {}, per = {}; let total = 0, unknown = 0, upTo = false;
    for (const id of order) {
      const n = flow.nodes.find(x => x.id === id), d = n.data || {}, ins = flow.edges.filter(e => e.to === id);
      const p = P.get(id) || { ins: [] };
      const lens = ins.filter(e => !(p.ins.find(i => i.key === e.in) || {}).many).map(e => count[e.from] || 1);
      const runs = Math.max(1, ...lens);
      if (d.pinned && d.pinnedItems) { count[id] = d.pinnedItems.length; per[id] = { usd: 0, runs: 0, kind: 'pinned' }; continue; }
      if (n.type === 'model') {
        const m = modelOf(n); if (!m) { count[id] = runs; continue; }
        if (m.free) { per[id] = { usd: 0, runs, kind: 'free' }; count[id] = runs; continue; }
        const s = await schema(m), bound = {};
        for (const e of ins) { const i = p.ins.find(x => x.key === e.in); if (!i) continue; bound[e.in] = i.kind === 'text' ? 'x'.repeat(d.expectChars || 700) : i.many ? ['https://example.com/a.png'] : 'https://example.com/a.png'; }
        const a = assemble(m, s, d.input, bound), e = a.input ? priceOf(m, a.input, { seconds: d.expectSeconds || 30 }) : { usd: null, kind: 'unknown' };
        const usd = e.usd == null || e.kind === 'unknown' ? null : e.usd * runs;
        per[id] = { usd, runs, kind: e.kind, each: e.usd }; if (usd == null) unknown++; else total += usd; if (e.kind === 'upTo') upTo = true;
        const out = a.input ? Math.max(1, +(a.input.n || a.input.num_images || a.input.batch_size || 1)) : 1;
        count[id] = runs * out;
      } else if (n.type === 'tool.split' || (n.type === 'tool.extract' && /\[\]/.test(d.path || ''))) count[id] = runs * (d.expect || 4);
      else if (['tool.join', 'tool.pick', 'tool.compose', 'output'].includes(n.type)) count[id] = 1;
      else count[id] = n.type === 'input.media' ? Math.max(1, (d.urls || []).length) : runs;
    }
    return { total, unknown, upTo, per, count };
  }

  /* run: every node, or only one node and what it needs (only), or everything after a node (from), reusing earlier results */
  async function run(flow, opt = {}) {
    const { ok, errors, order, ports: P } = await check(flow);
    if (!ok) throw Object.assign(new Error('הזרימה לא תקינה: ' + errors.map(e => e.msg).join(' · ')), { errors });
    const on = opt.on || (() => {}), prev = opt.prev || {}, res = {}, byId = new Map(flow.nodes.map(n => [n.id, n]));
    const up = id => { const s = new Set(), go = x => flow.edges.filter(e => e.to === x).forEach(e => { if (!s.has(e.from)) { s.add(e.from); go(e.from); } }); go(id); return s; };
    const down = id => { const s = new Set([id]), go = x => flow.edges.filter(e => e.from === x).forEach(e => { if (!s.has(e.to)) { s.add(e.to); go(e.to); } }); go(id); return s; };
    const want = opt.only ? new Set([opt.only, ...up(opt.only)]) : new Set(order);
    const fresh = opt.from ? down(opt.from) : opt.only ? new Set([opt.only]) : new Set(order);
    let spent = 0, held = 0, stopped = null;
    // the run's own cap (on top of the lab's budget): returns why it stops, or nothing
    // calls running side by side hold their estimate, so parallel branches cannot pass the cap together
    const cap = add => { if (opt.maxUsd != null && spent + held + (add || 0) > opt.maxUsd + 1e-9) return `הריצה נעצרה בתקרה שנקבעה לה ($${opt.maxUsd}): הוצאו $${spent.toFixed(3)}, והקריאה הבאה עולה כ-$${(add || 0).toFixed(3)}`; held += add || 0; return null; };

    // level by level: every node whose inputs are ready runs, up to `parallel` at a time
    const done = new Set(), pending = order.filter(id => want.has(id));
    while (pending.length && !stopped) {
      if (opt.signal && opt.signal.aborted) { stopped = 'הריצה בוטלה'; break; }
      const ready = pending.filter(id => flow.edges.filter(e => e.to === id && want.has(e.from)).every(e => done.has(e.from)));
      if (!ready.length) break;
      await Promise.all(ready.map(async id => {
        pending.splice(pending.indexOf(id), 1);
        const n = byId.get(id), d = n.data || {};
        const reuse = !fresh.has(id) && (prev[id] && prev[id].items) ? prev[id] : d.pinned && d.pinnedItems ? { items: d.pinnedItems, pinned: true } : null;
        if (reuse) { res[id] = { ...reuse, reused: true, cost: 0 }; on({ type: 'node', id, status: 'done', ...res[id] }); done.add(id); return; }
        // a node whose input comes from a step that failed does not run (and does not spend): the failure is the first one
        const broken = flow.edges.filter(e => e.to === id && want.has(e.from)).map(e => res[e.from]).find(r => r && (r.status === 'error' || r.status === 'skipped'));
        if (broken) { res[id] = { status: 'skipped', error: 'שלב קודם נכשל', items: [] }; on({ type: 'node', id, ...res[id] }); done.add(id); return; }
        const ins = gather(flow, id, res, P.get(id));
        const missing = P.get(id).ins.filter(i => i.req && !(ins[i.key] && ins[i.key].length) && !hasStatic(n, i.key));
        if (missing.length) { res[id] = { status: 'skipped', error: 'אין קלט: ' + missing.map(i => i.label || i.key).join(', '), items: [] }; on({ type: 'node', id, ...res[id] }); done.add(id); return; }
        const t0 = Date.now(); on({ type: 'node', id, status: 'running' });
        try {
          const r = await exec(n, ins, P.get(id), { on: x => on({ type: 'node', id, status: 'running', ...x }), cap, add: (c, hold) => { spent += c; held = Math.max(0, held - (hold || 0)); }, signal: opt.signal });
          res[id] = { status: 'done', ms: Date.now() - t0, ...r }; on({ type: 'node', id, ...res[id] });
        } catch (e) {
          res[id] = { status: 'error', ms: Date.now() - t0, error: String(e && e.message || e), hint: e && e.hint, items: [], cost: e && e.cost || 0 }; on({ type: 'node', id, ...res[id] });
          if (e && e.cap) stopped = stopped || e.message;
        }
        done.add(id);
      }));
    }
    const outputs = flow.nodes.filter(n => n.type === 'output').flatMap(n => (res[n.id] && res[n.id].items) || []);
    const summary = { spent: +spent.toFixed(6), stopped, outputs, errors: Object.entries(res).filter(([, r]) => r.status === 'error').map(([id, r]) => ({ id, error: r.error })) };
    on({ type: 'done', ...summary });
    return { results: res, ...summary };
  }

  // the values on each input port: every edge into it, in order (a port takes many edges; their items are joined into one list)
  function gather(flow, id, res, p) {
    const ins = {};
    for (const e of flow.edges.filter(x => x.to === id).sort((a, b) => (a.order || 0) - (b.order || 0))) {
      const r = res[e.from]; if (!r || !r.items) continue;
      (ins[e.in] ||= []).push(...r.items.filter(it => it && it.value != null && (accepts((p.ins.find(i => i.key === e.in) || {}).kind || 'any', it.kind) || !it.kind)));
    }
    return ins;
  }

  // one node, fanned out over its list inputs
  async function exec(n, ins, p, ctx) {
    const d = n.data || {};
    if (n.type === 'input.text') return { items: [{ kind: 'text', value: String(d.text || '') }], cost: 0 };
    if (n.type === 'input.media') { const urls = d.urls && d.urls.length ? d.urls : d.url ? [d.url] : []; if (!urls.length) throw new Error('לא נבחר קובץ'); return { items: urls.map(u => ({ kind: d.kind || 'image', value: u })), cost: 0 }; }
    if (n.type === 'output') return { items: (ins.items || []).slice(), cost: 0 };
    if (n.type === 'tool.join') return { items: [{ kind: 'text', value: (ins.items || []).map(i => String(i.value)).join(d.sep != null ? d.sep.replace(/\\n/g, '\n') : '\n\n') }], cost: 0 };
    if (n.type === 'tool.pick') { const l = ins.items || [], i = d.which === 'last' ? l.length - 1 : Math.max(0, (+d.index || 1) - 1); if (!l[i]) throw new Error('אין פריט במקום הזה'); return { items: [l[i]], cost: 0 }; }
    if (n.type === 'tool.compose') {
      if (!host.compose) throw new Error('הרכבה לא זמינה כאן');
      const it = await host.compose({ visuals: ins.visuals || [], voice: (ins.voice || [])[0], music: (ins.music || [])[0] }, d, ctx.on);
      return { items: [it], cost: 0 };
    }
    // per item: the list inputs fan out, single values repeat
    const scalar = p.ins.filter(i => !i.many && ins[i.key] && ins[i.key].length), lens = scalar.map(i => ins[i.key].length), runs = Math.max(1, ...lens);
    const bad = scalar.find(i => ins[i.key].length !== 1 && ins[i.key].length !== runs);
    if (bad) throw new Error(`רשימות באורך שונה נכנסות לאותו צומת (${lens.join(', ')}): אחת מהן צריכה להיות פריט אחד, או שתיהן באותו אורך`);
    const at = (key, i) => { const l = ins[key]; if (!l || !l.length) return undefined; const pi = p.ins.find(x => x.key === key); return pi && pi.many ? l.map(x => x.value) : (l.length === 1 ? l[0] : l[i]).value; };
    const items = []; let cost = 0;
    for (let i = 0; i < runs; i++) {
      if (ctx.signal && ctx.signal.aborted) throw new Error('הריצה בוטלה');
      if (runs > 1) ctx.on({ progress: `${i + 1}/${runs}` });
      const vals = Object.fromEntries(p.ins.map(x => [x.key, at(x.key, i)]).filter(([, v]) => v !== undefined));
      if (n.type === 'tool.template') { items.push({ kind: 'text', value: String(d.template || '').replace(/\{\{\s*([a-d])\s*\}\}/g, (_, k) => vals[k] != null ? String(vals[k]) : '') }); continue; }
      if (n.type === 'tool.extract') { items.push(...extract(vals.text, d.path || '').map(v => ({ kind: 'text', value: typeof v === 'string' ? v : JSON.stringify(v) }))); continue; }
      if (n.type === 'tool.split') { items.push(...split(vals.text, d).map(v => ({ kind: 'text', value: v }))); continue; }
      if (n.type === 'model') { const r = await callModel(n, vals, ctx); items.push(...r.items); cost += r.cost; continue; }
    }
    return { items, cost, runs };
  }

  async function callModel(n, vals, ctx) {
    const m = modelOf(n), d = n.data || {};
    let input, kind = '', route = m.free ? 'free' : 'credits';
    if (m.free) ({ input, kind } = await freeInput(m, d, vals));
    else {
      const s = await schema(m), p = portsOf(m, s);
      // a field that takes the file itself (base64), fed a link by another model: the file is fetched and inlined first
      for (const port of p.ins.filter(x => x.b64 && vals[x.key] != null)) {
        const conv = async v => /^https:\/\//.test(v) && host.toDataURI ? host.toDataURI(v) : v;
        vals[port.key] = Array.isArray(vals[port.key]) ? await Promise.all(vals[port.key].map(conv)) : await conv(vals[port.key]);
      }
      const a = assemble(m, s, d.input, vals);
      if (a.error) throw new Error(a.error);
      input = a.input;
    }
    const est = m.free ? 0 : (priceOf(m, input, { seconds: d.expectSeconds }).usd || 0);
    const why = ctx.cap(est); if (why) throw Object.assign(new Error(why), { cap: true });
    let j; try { j = await host.call(m.id, input, { kind, route, hint: d.expectSeconds ? { seconds: d.expectSeconds } : undefined }); } catch (e) { ctx.add(0, est); throw e; }
    const usd = (j && j.cost && +j.cost.usd) || 0; ctx.add(usd, est);
    if (!j || !j.ok) throw Object.assign(new Error((j && (j.why || j.error)) || 'אין תשובה'), { hint: j && j.hint, cost: usd });
    const items = itemsOf(j, m);
    if (!items.length) throw Object.assign(new Error('התשובה הגיעה בלי תוצאה שאפשר להעביר הלאה'), { cost: usd });
    return { items: items.map(it => ({ ...it, model: m.id, usd: items.length ? usd / items.length : usd })), cost: usd };
  }
  async function freeInput(m, d, v) {
    const how = m.how;
    if (how === 'chat' || how === 'chat-vision') {
      const content = v.image ? [{ type: 'text', text: v.message }, { type: 'image_url', image_url: { url: v.image } }] : v.message;
      return { input: { messages: [...(v.system || d.system ? [{ role: 'system', content: v.system || d.system }] : []), { role: 'user', content }], max_tokens: d.max || 1024, ...(m.reasoning ? { reasoning_effort: d.effort || 'low' } : {}) } };
    }
    if (how === 'flux2') return { kind: 'flux2', input: { prompt: v.prompt, width: d.width || 1024, height: d.height || 768, ...(d.steps ? { steps: d.steps } : {}) } };
    if (how === 'image-json') return { input: { prompt: v.prompt, steps: d.steps || 4 } };
    if (how === 'image') return { input: { prompt: v.prompt, width: d.width || 1024, height: d.height || 768 } };
    if (how === 'tts') return { input: /melotts/.test(m.id) ? { prompt: v.text, lang: d.lang || 'en' } : { text: v.text } };
    if (how === 'translate') return { input: { text: v.text, source_lang: d.from || 'hebrew', target_lang: d.to || 'english' } };
    if (how === 'asr') return { kind: 'audio', input: { audio: await host.toBase64(v.audio) } };
    throw new Error('המודל החינמי הזה עוד לא נתמך בזרימות');
  }
  return { ports, check, estimate, run, schema, TYPES };
}

// what an /api/run answer carries forward, as items
export function itemsOf(j, m) {
  if (j.kind === 'text' || (j.text && !j.image && !j.video && !j.audio)) return j.text ? [{ kind: 'text', value: j.text }] : [];
  if (j.kind === 'image') return (j.images && j.images.length ? j.images : [j.image]).filter(Boolean).map(v => ({ kind: 'image', value: v }));
  if (j.kind === 'video' && j.video) return [{ kind: 'video', value: j.video }];
  if (j.kind === 'audio' && j.audio) return [{ kind: 'audio', value: j.audio }];
  return [];
}

/* ---------- tools ---------- */
// JSON out of a model's answer: a fenced block, or the first {...} / [...] in it
export function parseLoose(text) {
  const t = String(text || '').trim();
  try { return JSON.parse(t); } catch {}
  const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/); if (fence) { try { return JSON.parse(fence[1]); } catch {} }
  for (const [o, c] of [['{', '}'], ['[', ']']]) { const a = t.indexOf(o), b = t.lastIndexOf(c); if (a >= 0 && b > a) { try { return JSON.parse(t.slice(a, b + 1)); } catch {} } }
  return null;
}
// path: "voiceover", "scene.prompt", "shots[].prompt" (every item), "shots[0].prompt"; empty: the whole thing
export function extract(text, path) {
  const data = parseLoose(text);
  if (data == null) throw new Error('לא נמצא JSON בטקסט שנכנס. כדאי לבקש מהמודל להחזיר JSON בלבד');
  let cur = [data];
  for (const part of String(path || '').split('.').filter(Boolean)) {
    const m = part.match(/^([^[\]]*)(?:\[(\d*)\])?$/); if (!m) throw new Error('נתיב לא תקין: ' + part);
    cur = cur.flatMap(x => { let v = m[1] ? (x == null ? undefined : x[m[1]]) : x; if (m[2] !== undefined) v = m[2] === '' ? (Array.isArray(v) ? v : []) : (Array.isArray(v) ? [v[+m[2]]] : []); else v = [v]; return v; }).filter(v => v !== undefined);
  }
  if (!cur.length) throw new Error(`השדה "${path}" לא נמצא ב-JSON`);
  return cur;
}
export function split(text, d = {}) {
  const t = String(text || '');
  if (d.by === 'json') { const a = parseLoose(t); if (!Array.isArray(a)) throw new Error('לא נמצא מערך JSON'); return a.map(x => typeof x === 'string' ? x : JSON.stringify(x)); }
  const parts = d.by === 'sep' ? t.split(d.sep || '---') : t.split(/\n+/);
  return parts.map(s => s.replace(/^\s*(?:[-*•]|\d+[.)])\s+/, '').trim()).filter(Boolean).slice(0, d.max || 50);
}

/* ---------- graph helpers ---------- */
export function topo(flow) {
  const indeg = new Map(flow.nodes.map(n => [n.id, 0])), out = new Map(flow.nodes.map(n => [n.id, []]));
  for (const e of flow.edges) if (indeg.has(e.to) && out.has(e.from)) { indeg.set(e.to, indeg.get(e.to) + 1); out.get(e.from).push(e.to); }
  const q = flow.nodes.filter(n => !indeg.get(n.id)).map(n => n.id), order = [];
  while (q.length) { const id = q.shift(); order.push(id); for (const t of out.get(id)) { indeg.set(t, indeg.get(t) - 1); if (!indeg.get(t)) q.push(t); } }
  if (order.length !== flow.nodes.length) throw new Error('יש מעגל בזרימה: צומת מחובר בחזרה לעצמו');
  return order;
}
// positions by depth, so a flow written as JSON (by the agent, or imported) opens readable
export function layout(flow, { dx = 300, dy = 170 } = {}) {
  let order; try { order = topo(flow); } catch { order = flow.nodes.map(n => n.id); }
  const depth = {};
  for (const id of order) depth[id] = Math.max(0, ...flow.edges.filter(e => e.to === id).map(e => (depth[e.from] ?? -1) + 1));
  const rows = {};
  for (const id of order) { const c = depth[id]; rows[c] = (rows[c] || 0) + 1; const n = flow.nodes.find(x => x.id === id); n.x = 40 + c * dx; n.y = 40 + (rows[c] - 1) * dy; }
  return flow;
}
export const newId = (p = 'n') => p + Math.random().toString(36).slice(2, 8);
export function blank(name = 'זרימה חדשה') { return { v: VERSION, id: 'f' + Date.now().toString(36), name, about: '', nodes: [], edges: [] }; }
// what a run keeps: results without bulky inline media (a data: URI larger than 200 KB becomes a note)
export function slim(results) {
  const cut = v => typeof v === 'string' && v.startsWith('data:') && v.length > 200000 ? `[${Math.round(v.length / 1024)}KB inline]` : v;
  return Object.fromEntries(Object.entries(results || {}).map(([id, r]) => [id, { status: r.status, error: r.error, cost: r.cost, ms: r.ms, runs: r.runs, items: (r.items || []).map(it => ({ ...it, value: cut(it.value) })) }]));
}
