// AILGEN Lab's ledger: what each call cost, and how much of the budget is left. One KV namespace (binding LEDGER, created and
// bound by tools/site-switch.mjs). Each paid call is one key whose metadata holds its cost, so concurrent calls never overwrite
// each other's spending; the total is the sum of the keys of the current budget period. Without the binding the lab still runs
// and still shows each call's cost; only the running total and the lab's own budget gate are off.
//   budget        the budget in USD (set from the lab; default LAB_BUDGET_USD)
//   period        the current period id (a reset starts a new one; the old keys stay as history)
//   c:<period>:<reverse time>:<rand>   one paid call, metadata { usd, model, src, ms, kind, at }
//   free:<YYYY-MM-DD>                  neurons the lab used from the free daily allocation (counted, not billed)

const NOW = () => Date.now();
const REV = t => String(9e15 - t).padStart(16, '0');   // newest first in a KV listing

export const hasLedger = env => !!env.LEDGER;

export async function settings(env) {
  if (!env.LEDGER) return { budget: +(env.LAB_BUDGET_USD || 100), period: 'p0', since: null };
  const [b, p] = await Promise.all([env.LEDGER.get('budget'), env.LEDGER.get('period', 'json')]);
  return { budget: b != null ? +b : +(env.LAB_BUDGET_USD || 100), period: p?.id || 'p0', since: p?.since || null };
}

// every paid call of the period, newest first (a KV listing returns up to 1,000 keys per page)
export async function calls(env, period, max = 5000) {
  if (!env.LEDGER) return [];
  const out = []; let cursor;
  do {
    const page = await env.LEDGER.list({ prefix: `c:${period}:`, cursor, limit: 1000 });
    for (const k of page.keys) out.push(k.metadata || {});
    cursor = page.list_complete ? null : page.cursor;
  } while (cursor && out.length < max);
  return out;
}

// spent in the period; cached per isolate for a few seconds so a burst of calls does not list the namespace each time
let cache = { at: 0, period: '', spent: 0, n: 0 };
export async function spent(env, period, fresh = false) {
  if (!env.LEDGER) return { spent: 0, n: 0 };
  if (!fresh && cache.period === period && NOW() - cache.at < 5000) return cache;
  const list = await calls(env, period);
  cache = { at: NOW(), period, spent: list.reduce((s, c) => s + (+c.usd || 0), 0), n: list.length };
  return cache;
}

export async function record(env, period, entry) {
  if (!env.LEDGER) return;
  const at = NOW(), meta = { ...entry, usd: +(+entry.usd || 0).toFixed(6), at };
  await env.LEDGER.put(`c:${period}:${REV(at)}:${Math.random().toString(36).slice(2, 7)}`, '', { metadata: meta });
  if (cache.period === period) { cache.spent += meta.usd; cache.n++; }
}

export async function addFree(env, neurons) {
  if (!env.LEDGER || !neurons) return;
  const k = 'free:' + new Date().toISOString().slice(0, 10), v = +(await env.LEDGER.get(k)) || 0;
  await env.LEDGER.put(k, String(Math.round(v + neurons)), { expirationTtl: 4 * 86400 });
}
export async function freeToday(env) {
  if (!env.LEDGER) return null;
  return +(await env.LEDGER.get('free:' + new Date().toISOString().slice(0, 10))) || 0;
}

export async function setBudget(env, usd) { if (env.LEDGER) await env.LEDGER.put('budget', String(Math.max(0, +usd || 0))); }
export async function newPeriod(env) {
  if (!env.LEDGER) return null;
  const p = { id: 'p' + NOW().toString(36), since: new Date().toISOString() };
  await env.LEDGER.put('period', JSON.stringify(p)); cache = { at: 0, period: '', spent: 0, n: 0 };
  return p;
}
