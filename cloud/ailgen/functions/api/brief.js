// The studio's live demo on the public site: a first brand brief for a business, from a name or an idea, on open models.
// POST { mode: 'name' | 'idea', input } → { spec }. The page shows it as a first draft, labeled; nothing is stored.
import { MODELS, json, answer, parseJSON, sameOrigin, throttle, readJSON } from '../../../_shared/ai.js';

// the fonts the page can load (studio/src/3-app.js FONTS_OK); anything else falls back to Heebo on the page
const FONTS = ['Frank Ruhl Libre', 'Heebo', 'Rubik', 'Assistant', 'Secular One', 'Suez One', 'Karantina', 'Varela Round', 'Amatic SC', 'Bellefair', 'David Libre', 'Noto Serif Hebrew', 'IBM Plex Sans Hebrew', 'Alef', 'Miriam Libre', 'Fredoka', 'Noto Sans Hebrew', 'Bona Nova'];

const prompt = (mode, input) => `אתה מנוע המיתוג של סטודיו AILGEN. לקוח ${mode === 'name' ? 'נתן רק שם של עסק' : 'תיאר רעיון לעסק'}: "${input}".
החזר JSON בלבד, בעברית, במבנה הזה בדיוק:
{"name":"שם העסק","type":"סוג העסק במילים ספורות","spirit":"הרוח ב-2–3 מילים","idea":"הרעיון של המותג כתמונה, משפט אחד","claim":"כותרת ראשית לאתר, עד 8 מילים","sub":"משפט משנה לאתר, עד 22 מילים","palette":{"bg":"#hex","ink":"#hex","accent":"#hex","accent2":"#hex"},"display":"פונט כותרות","body":"פונט טקסט","motif":"אחד מ: pixels, particles, light, ink, iris, wipe, spin","mascot":"כן / לא, ומשפט למה","tool":"כלי ההוכחה באתר: שם ומה הוא עושה, משפט אחד","toolCta":"כפתור של הכלי, 2–3 מילים","sections":["6 שמות סקשנים קצרים"],"film":["7 סצנות לסרטון של 26 שניות, כל אחת עד 7 מילים"],"domains":["3 הצעות דומיין לטיניות, בלי www"],"scene":"באנגלית: תמונת אווירה אחת לראש האתר, משטח, אור וחומר בלבד, עד 30 מילים, בלי אנשים, בלי טקסט ובלי לוגו"}
כללים: הפונטים רק מתוך: ${FONTS.join(', ')}. ניגודיות ink על bg לפחות 7:1. בלי המלצות, מספרים או לקוחות מומצאים. בלי קלישאות כמו "מהפכה" או "העתיד כבר כאן". אם הקלט אינו עסק, החזר {"error":"not a business"}.`;

export async function onRequestPost({ request, env }) {
  if (!sameOrigin(request)) return json({ error: 'origin' }, 403);
  if (!env.AI) return json({ error: 'unavailable' }, 503);
  if (!throttle(request, 'brief', 8, 10 * 60e3)) return json({ error: 'busy' }, 429, { 'retry-after': '300' });
  let body; try { body = await readJSON(request, 4000); } catch { return json({ error: 'bad request' }, 400); }
  const mode = body.mode === 'name' ? 'name' : 'idea', input = String(body.input || '').replace(/["\\]/g, ' ').trim().slice(0, 400);
  if (input.length < 2) return json({ error: 'bad request' }, 400);
  try {
    const r = await answer(env, MODELS.json, { messages: [{ role: 'user', content: prompt(mode, input) }], max_tokens: 1600 }, t => !!parseJSON(t));
    const spec = parseJSON(r.text);
    if (!spec || spec.error || !spec.palette || !spec.claim) return json({ error: 'no brief' }, 422);
    return json({ spec, model: r.model });
  } catch (e) {
    console.error('brief', e && e.message);
    return json({ error: 'unavailable' }, 503);
  }
}
