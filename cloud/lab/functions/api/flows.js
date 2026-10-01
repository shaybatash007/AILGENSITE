// AILGEN Lab · AI UNIFIED: the flows and their runs, kept in the lab's KV namespace (binding LEDGER) so the owner's page and the
// agent's CLI (cloud/lab/unified.mjs) see the same flows and the same history. Behind the same passcode as /api/run. The flows
// run where they are opened (the page or the CLI); every model call inside them goes through /api/run, so the budget and the
// ledger count it.
// POST + header x-lab-key
//   { op: 'list' }                       → { kv, flows: [{ id, name, about, updated, by, nodes }] }
//   { op: 'get', id }                    → { flow }
//   { op: 'save', flow, by? }            → { ok, id, updated }        by: 'owner' (the page) | 'agent' (the CLI)
//   { op: 'delete', id }                 → { ok }
//   { op: 'record', run }                → { ok, key }                a finished run: the flow as it ran, its results (slim), cost
//   { op: 'runs', flow?, limit? }        → { runs: [{ key, flow, name, at, usd, status, by, outputs }] }
//   { op: 'run', key }                   → { run }
import { json, readJSON } from '../../../_shared/ai.js';
import { gate } from './run.js';

const ID = /^[a-z0-9][a-z0-9_-]{1,63}$/i, BY = ['owner', 'agent'];
const REV = t => String(9e15 - t).padStart(16, '0');
const meta = f => ({ id: f.id, name: String(f.name || '').slice(0, 80), about: String(f.about || '').slice(0, 160), updated: f.updated, by: f.by, nodes: (f.nodes || []).length });

async function listAll(kv, prefix, limit) {
  const out = []; let cursor;
  do { const p = await kv.list({ prefix, cursor, limit: 1000 }); out.push(...p.keys); cursor = p.list_complete ? null : p.cursor; } while (cursor && out.length < limit);
  return out.slice(0, limit);
}

export async function onRequestPost({ request, env }) {
  const denied = await gate(request, env); if (denied) return denied;
  let b; try { b = await readJSON(request, 4e6); } catch { return json({ error: 'bad request' }, 400); }
  const kv = env.LEDGER;
  if (!kv) return json({ kv: false, error: 'no ledger', hint: 'היומן (KV) לא מחובר, ולכן הזרימות נשמרות רק בדפדפן הזה' }, b.op === 'list' ? 200 : 409);
  const op = String(b.op || '');

  if (op === 'list') {
    const keys = await listAll(kv, 'flow:', 500);
    return json({ kv: true, flows: keys.map(k => k.metadata || { id: k.name.slice(5) }).sort((a, c) => String(c.updated || '').localeCompare(String(a.updated || ''))) });
  }
  if (op === 'get') {
    if (!ID.test(String(b.id || ''))) return json({ error: 'bad id' }, 400);
    const f = await kv.get('flow:' + b.id, 'json');
    return f ? json({ flow: f }) : json({ error: 'not found' }, 404);
  }
  if (op === 'save') {
    const f = b.flow;
    if (!f || typeof f !== 'object' || !ID.test(String(f.id || '')) || !Array.isArray(f.nodes) || !Array.isArray(f.edges)) return json({ error: 'bad flow' }, 400);
    if (f.nodes.length > 200 || f.edges.length > 600) return json({ error: 'too large', hint: 'עד 200 צמתים ו-600 חיבורים בזרימה' }, 413);
    // pinned results stay with the flow, but not inline media (a data: URI larger than 200 KB is dropped from the saved copy)
    const slimNode = n => { const d = { ...(n.data || {}) }; if (d.pinnedItems) d.pinnedItems = d.pinnedItems.filter(it => !(typeof it.value === 'string' && it.value.startsWith('data:') && it.value.length > 200000)); return { ...n, data: d }; };
    const flow = { ...f, nodes: f.nodes.map(slimNode), updated: new Date().toISOString(), by: BY.includes(b.by) ? b.by : 'owner' };
    const body = JSON.stringify(flow); if (body.length > 1.5e6) return json({ error: 'too large', hint: 'הזרימה גדולה מ-1.5MB. קבצים גדולים עדיף לתת כקישור' }, 413);
    await kv.put('flow:' + flow.id, body, { metadata: meta(flow) });
    return json({ ok: true, id: flow.id, updated: flow.updated });
  }
  if (op === 'delete') {
    if (!ID.test(String(b.id || ''))) return json({ error: 'bad id' }, 400);
    await kv.delete('flow:' + b.id); return json({ ok: true });
  }
  if (op === 'record') {
    const r = b.run;
    if (!r || typeof r !== 'object' || !r.flow || !ID.test(String(r.flow.id || ''))) return json({ error: 'bad run' }, 400);
    const at = Date.now(), body = JSON.stringify({ ...r, at, by: BY.includes(r.by) ? r.by : 'owner' });
    if (body.length > 4e6) return json({ error: 'too large' }, 413);
    const key = `run:${REV(at)}:${r.flow.id}`, outs = (r.outputs || []).slice(0, 4).map(it => ({ kind: it.kind, value: typeof it.value === 'string' && it.value.length < 300 ? it.value : '' }));
    await kv.put(key, body, { metadata: { flow: r.flow.id, name: String(r.flow.name || '').slice(0, 60), at, usd: +(+r.spent || 0).toFixed(4), status: r.stopped ? 'stopped' : (r.errors || []).length ? 'errors' : 'done', by: BY.includes(r.by) ? r.by : 'owner', outputs: JSON.stringify(outs).length < 600 ? outs : [] } });
    return json({ ok: true, key });
  }
  if (op === 'runs') {
    const keys = await listAll(kv, 'run:', Math.min(+b.limit || 60, 300) * (b.flow ? 6 : 1));
    const runs = keys.map(k => ({ key: k.name, ...(k.metadata || {}) })).filter(r => !b.flow || r.flow === b.flow).slice(0, Math.min(+b.limit || 60, 300));
    return json({ runs });
  }
  if (op === 'run') {
    if (!/^run:\d{16}:[a-z0-9_-]+$/i.test(String(b.key || ''))) return json({ error: 'bad key' }, 400);
    const r = await kv.get(b.key, 'json');
    return r ? json({ run: r }) : json({ error: 'not found' }, 404);
  }
  return json({ error: 'unknown op' }, 400);
}
