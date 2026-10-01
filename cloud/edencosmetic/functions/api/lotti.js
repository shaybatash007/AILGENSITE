// Lotti on Eden's public site: answers in Hebrew from the shop's own facts (context.js, built from the page itself).
// POST { messages: [{ role: 'user' | 'assistant', content }] } → { text } · 503 when no model answers, and the page then
// falls back to its fixed answers. No key on the page: Workers AI is a binding of this Pages project.
import { MODELS, json, answer, plain, sameOrigin, throttle, readJSON, why } from '../../../_shared/ai.js';
import { SYSTEM } from '../../context.js';

export async function onRequestPost({ request, env }) {
  if (!sameOrigin(request)) return json({ error: 'origin' }, 403);
  if (!env.AI) return json({ error: 'unavailable', why: 'no-binding' }, 503);
  if (!throttle(request, 'lotti', 30, 10 * 60e3)) return json({ error: 'busy' }, 429, { 'retry-after': '120' });
  let body; try { body = await readJSON(request, 24000); } catch { return json({ error: 'bad request' }, 400); }
  const messages = (Array.isArray(body.messages) ? body.messages : []).slice(-8)
    .filter(m => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string' && m.content.trim())
    .map(m => ({ role: m.role, content: m.content.slice(0, 700) }));
  if (!messages.length || messages[messages.length - 1].role !== 'user') return json({ error: 'bad request' }, 400);
  try {
    const r = await answer(env, MODELS.answer, { messages: [{ role: 'system', content: SYSTEM }, ...messages], max_tokens: 900 });
    return json({ text: plain(r.text).slice(0, 1400), model: r.model });
  } catch (e) {
    console.error('lotti', e && e.message);
    return json({ error: 'unavailable', why: why(e) }, 503);
  }
}
