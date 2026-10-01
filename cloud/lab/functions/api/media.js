// AILGEN Lab · a model's media through the lab's own origin. The composer in AI UNIFIED draws videos and images on a canvas and
// records it; a canvas that drew media from another origin cannot be recorded, so the page fetches a provider's file here first.
// POST { url } + header x-lab-key → the file's bytes (https only; images, video and audio; up to 150 MB)
import { json, readJSON } from '../../../_shared/ai.js';
import { gate } from './run.js';

export async function onRequestPost({ request, env }) {
  const denied = await gate(request, env); if (denied) return denied;
  let b; try { b = await readJSON(request, 4000); } catch { return json({ error: 'bad request' }, 400); }
  let u; try { u = new URL(String(b.url || '')); } catch { return json({ error: 'bad url' }, 400); }
  if (u.protocol !== 'https:') return json({ error: 'https only' }, 400);
  const r = await fetch(u.toString(), { redirect: 'follow' }).catch(() => null);
  if (!r || !r.ok) return json({ error: 'upstream ' + (r ? r.status : 'unreachable') }, 502);
  const type = (r.headers.get('content-type') || '').split(';')[0].trim().toLowerCase(), size = +r.headers.get('content-length') || 0;
  const ext = (u.pathname.match(/\.([a-z0-9]{2,4})$/i) || [])[1] || '';
  const guess = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp', gif: 'image/gif', mp4: 'video/mp4', webm: 'video/webm', mov: 'video/quicktime', mp3: 'audio/mpeg', wav: 'audio/wav', ogg: 'audio/ogg', m4a: 'audio/mp4', flac: 'audio/flac' }[ext.toLowerCase()];
  const ct = /^(image|video|audio)\//.test(type) ? type : guess;
  if (!ct) return json({ error: 'not media', type }, 415);
  if (size > 150e6) return json({ error: 'too large' }, 413);
  return new Response(r.body, { headers: { 'content-type': ct, 'cache-control': 'private, max-age=3600', ...(size ? { 'content-length': String(size) } : {}) } });
}
