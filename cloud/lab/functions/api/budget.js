// AILGEN Lab's budget: what was spent, on what, and what is left. Behind the same passcode as /api/run.
// POST {}                       → { ledger, budget, spent, left, calls, byModel, recent, freeToday, since, gateway }
// POST { set: 100 }             → change the budget (USD)
// POST { reset: true }          → start a new period (the old calls stay in the namespace as history)
import { json, readJSON } from '../../../_shared/ai.js';
import { gate } from './run.js';
import { settings, calls, setBudget, newPeriod, freeToday, hasLedger } from '../../ledger.js';

export async function onRequestPost({ request, env }) {
  const denied = await gate(request, env); if (denied) return denied;
  let body = {}; try { body = await readJSON(request, 2000); } catch {}
  if (!hasLedger(env)) return json({ ledger: false, budget: +(env.LAB_BUDGET_USD || 100), gateway: env.LAB_GATEWAY || 'ailgen-lab' });
  if (body.set !== undefined) await setBudget(env, body.set);
  if (body.reset === true) await newPeriod(env);
  const s = await settings(env), list = await calls(env, s.period);
  const total = list.reduce((a, c) => a + (+c.usd || 0), 0), byModel = {};
  for (const c of list) { const m = (byModel[c.model] ||= { usd: 0, calls: 0 }); m.usd += +c.usd || 0; m.calls++; }
  return json({
    ledger: true, gateway: env.LAB_GATEWAY || 'ailgen-lab', budget: s.budget, since: s.since, spent: +total.toFixed(4), left: +(s.budget - total).toFixed(4),
    calls: list.length, byModel: Object.entries(byModel).sort((a, b) => b[1].usd - a[1].usd).map(([model, v]) => ({ model, usd: +v.usd.toFixed(4), calls: v.calls })),
    recent: list.slice(0, 60), freeToday: await freeToday(env),
  });
}
