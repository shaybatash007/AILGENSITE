// The studio demo's first atmosphere image: surface, light and material in the brief's palette, never a person, text or logo.
// POST { scene, palette: { bg, accent, accent2 } } → { image: 'data:image/...;base64,...' }. FLUX.2 [klein] 4B at 768×432,
// about 50 neurons of the free daily allocation.
import { MODELS, json, image, sameOrigin, throttle, readJSON } from '../../../_shared/ai.js';

const hex = h => (/^#[0-9a-f]{6}$/i.test(h || '') ? h : null);

export async function onRequestPost({ request, env }) {
  if (!sameOrigin(request)) return json({ error: 'origin' }, 403);
  if (!env.AI) return json({ error: 'unavailable' }, 503);
  if (!throttle(request, 'mood', 6, 10 * 60e3)) return json({ error: 'busy' }, 429, { 'retry-after': '300' });
  let body; try { body = await readJSON(request, 4000); } catch { return json({ error: 'bad request' }, 400); }
  const scene = String(body.scene || '').replace(/[^\p{L}\p{N}\s,.'()-]/gu, ' ').trim().slice(0, 220);
  if (scene.length < 8) return json({ error: 'bad request' }, 400);
  const p = body.palette || {}, colours = [hex(p.bg), hex(p.accent), hex(p.accent2)].filter(Boolean).join(', ');
  const prompt = `Editorial photograph, the opening image of a website: ${scene}. ${colours ? 'Colour palette: ' + colours + '. ' : ''}Natural light, real materials, shallow depth, generous empty space for a headline. No people, no faces, no hands, no text, no letters, no logos, no products, no packaging.`;
  try {
    return json({ image: await image(env, MODELS.draft, prompt, 768, 432) });
  } catch (e) {
    console.error('mood', e && e.message);
    return json({ error: 'unavailable' }, 503);
  }
}
