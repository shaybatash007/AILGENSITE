// AILGEN Lab · AI UNIFIED: ready flows. Each one is a whole job made of several engines, opened as a starting point: the brief
// is replaced, models are swapped from the catalog, nodes are added. Node ids are readable on purpose: the agent's CLI sets
// values by them (node cloud/lab/unified.mjs run launch-film --set brief.text="...").
// Models are chosen by what each step needs, and priced before every run; none of them makes a product's pixels.
const T = (id, name, about, nodes, edges, extra = {}) => ({ v: 1, id, name, about, template: true, nodes, edges: edges.map(([from, out, to, inp], i) => ({ id: 'e' + (i + 1), from, out, to, in: inp })), ...extra });
const n = (id, type, data = {}, title) => ({ id, type, data, ...(title ? { title } : {}) });

const FILM_PLAN = `You are the creative director of a short vertical launch film (9:16, about 12 seconds).
From the brief below, plan exactly 3 shots. Return JSON only, no prose, in exactly this shape:
{"title":"...","voiceover":"<Hebrew voiceover, 2-3 short sentences, about 12 seconds read aloud>","music":"<English prompt for instrumental music: mood, instruments, tempo>","shots":[{"image":"<English prompt for the opening still: subject, setting, light, lens, palette; no text, no logos, no product packaging>","motion":"<English prompt for 4 seconds of camera and subject motion from that still>"}]}
Brief: {{a}}`;

const CAMPAIGN_PLAN = `You are an art director. From the brief below, write 4 distinct photographic directions for a social campaign (4:5).
Each prompt is one English paragraph: subject, setting, light, lens, palette, mood. No text, no logos, no product packaging.
Return JSON only: {"shots":[{"prompt":"..."},{"prompt":"..."},{"prompt":"..."},{"prompt":"..."}]}
Brief: {{a}}`;

const STORY_PLAN = `You write a short spoken piece for a brand (about 30 seconds read aloud, in Hebrew), and art-direct its single cover image and its music.
Return JSON only: {"script":"<Hebrew script>","image":"<English prompt for one 16:9 cover image; no text, no logos>","music":"<English prompt for calm instrumental music>"}
Topic: {{a}}`;

export const TEMPLATES = [
  T('launch-film', 'סרטון השקה מבריף', 'בריף ← תוכנית צילומים (Claude) ← 3 תמונות פתיחה ← 3 שוטים בווידאו (Veo) + קריינות בעברית + מוזיקה ← סרטון אחד 9:16', [
    n('brief', 'input.text', { text: 'סטודיו להרמת ריסים בתל אביב. התחושה: עדינות, אור חלון של אחר הצהריים, טרוורטין וסרט סאטן בוורוד מאובק. הקהל: נשים 25–45 שרוצות מראה טבעי.' }, 'בריף'),
    n('plan', 'tool.template', { template: FILM_PLAN }, 'הנחיה לבמאי'),
    n('director', 'model', { model: 'anthropic/claude-sonnet-5', input: { max_tokens: 1800 } }, 'במאי (Claude)'),
    n('stills', 'tool.extract', { path: 'shots[].image', expect: 3 }, 'תמונות פתיחה'),
    n('motion', 'tool.extract', { path: 'shots[].motion', expect: 3 }, 'תנועה'),
    n('vo', 'tool.extract', { path: 'voiceover' }, 'קריינות'),
    n('mood', 'tool.extract', { path: 'music' }, 'מוזיקה'),
    n('frames', 'model', { model: 'google/nano-banana-2', input: { aspect_ratio: '9:16' } }, 'פריימים'),
    n('shots', 'model', { model: 'google/veo-3.1-fast', input: { duration: '4s', resolution: '720p', generate_audio: false, aspect_ratio: '9:16' }, expectSeconds: 4 }, 'שוטים'),
    n('voice', 'model', { model: 'elevenlabs/eleven-v3' }, 'קול'),
    n('music', 'model', { model: 'elevenlabs/music-v2', input: { music_length_ms: 14000, force_instrumental: true } }, 'מוזיקה'),
    n('film', 'tool.compose', { aspect: '9:16', musicVolume: 0.22, fade: 0.35 }, 'הרכבה'),
    n('out', 'output', {}, 'פלט'),
  ], [
    ['brief', 'text', 'plan', 'a'], ['plan', 'text', 'director', 'message'],
    ['director', 'out', 'stills', 'text'], ['director', 'out', 'motion', 'text'], ['director', 'out', 'vo', 'text'], ['director', 'out', 'mood', 'text'],
    ['stills', 'value', 'frames', 'prompt'], ['frames', 'out', 'shots', 'image_input'], ['motion', 'value', 'shots', 'prompt'],
    ['vo', 'value', 'voice', 'text'], ['mood', 'value', 'music', 'prompt'],
    ['shots', 'out', 'film', 'visuals'], ['voice', 'out', 'film', 'voice'], ['music', 'out', 'film', 'music'],
    ['film', 'video', 'out', 'items'], ['frames', 'out', 'out', 'items'],
  ]),
  T('image-campaign', 'קמפיין תמונות', 'בריף ← 4 כיווני צילום (Claude) ← 4 תמונות 4:5 (Seedream 4.5) במקביל', [
    n('brief', 'input.text', { text: 'מותג טיפוח טבעוני חדש: אבן, מים, אור בוקר. רגוע, נקי, יוקרתי בלי ראוותנות.' }, 'בריף'),
    n('plan', 'tool.template', { template: CAMPAIGN_PLAN }, 'הנחיה'),
    n('ad', 'model', { model: 'anthropic/claude-sonnet-5', input: { max_tokens: 1400 } }, 'ארט דירקטור'),
    n('prompts', 'tool.extract', { path: 'shots[].prompt', expect: 4 }, '4 כיוונים'),
    n('images', 'model', { model: 'bytedance/seedream-4.5' }, 'תמונות'),
    n('out', 'output', {}, 'פלט'),
  ], [['brief', 'text', 'plan', 'a'], ['plan', 'text', 'ad', 'message'], ['ad', 'out', 'prompts', 'text'], ['prompts', 'value', 'images', 'prompt'], ['images', 'out', 'out', 'items']]),
  T('image-shootout', 'השוואת מודלי תמונה', 'אותו תיאור לשלושה מודלים מובחרים במקביל: Nano Banana Pro, FLUX.2 [max], Seedream 5 Pro', [
    n('prompt', 'input.text', { text: 'Top-down editorial photograph of an empty travertine surface in late-afternoon window light, soft long shadows, a folded dusty-rose silk ribbon at one corner, no text, no products.' }, 'תיאור'),
    n('a', 'model', { model: 'google/nano-banana-pro', input: { aspect_ratio: '1:1' } }, 'Nano Banana Pro'),
    n('b', 'model', { model: 'black-forest-labs/flux-2-max' }, 'FLUX.2 [max]'),
    n('c', 'model', { model: 'bytedance/seedream-5-pro' }, 'Seedream 5 Pro'),
    n('out', 'output', {}, 'פלט'),
  ], [['prompt', 'text', 'a', 'prompt'], ['prompt', 'text', 'b', 'prompt'], ['prompt', 'text', 'c', 'prompt'], ['a', 'out', 'out', 'items'], ['b', 'out', 'out', 'items'], ['c', 'out', 'out', 'items']]),
  T('voice-story', 'סיפור קולי עם תמונה', 'נושא ← תסריט בעברית (Gemini) ← הקראה + תמונת שער + מוזיקה ← סרטון 16:9', [
    n('topic', 'input.text', { text: 'למה טיפול עדין בריסים מתחיל בשאלה ולא במוצר' }, 'נושא'),
    n('plan', 'tool.template', { template: STORY_PLAN }, 'הנחיה'),
    n('writer', 'model', { model: 'google/gemini-3.5-flash', input: { max_completion_tokens: 1400 } }, 'כותב'),
    n('script', 'tool.extract', { path: 'script' }, 'תסריט'),
    n('cover', 'tool.extract', { path: 'image' }, 'תמונה'),
    n('mood', 'tool.extract', { path: 'music' }, 'מוזיקה'),
    n('read', 'model', { model: 'elevenlabs/eleven-multilingual-v2' }, 'הקראה'),
    n('picture', 'model', { model: 'google/nano-banana-2', input: { aspect_ratio: '16:9' } }, 'תמונת שער'),
    n('music', 'model', { model: 'elevenlabs/music-v2', input: { music_length_ms: 32000, force_instrumental: true } }, 'מוזיקה'),
    n('video', 'tool.compose', { aspect: '16:9', musicVolume: 0.2 }, 'הרכבה'),
    n('out', 'output', {}, 'פלט'),
  ], [
    ['topic', 'text', 'plan', 'a'], ['plan', 'text', 'writer', 'message'], ['writer', 'out', 'script', 'text'], ['writer', 'out', 'cover', 'text'], ['writer', 'out', 'mood', 'text'],
    ['script', 'value', 'read', 'text'], ['cover', 'value', 'picture', 'prompt'], ['mood', 'value', 'music', 'prompt'],
    ['picture', 'out', 'video', 'visuals'], ['read', 'out', 'video', 'voice'], ['music', 'out', 'video', 'music'], ['video', 'video', 'out', 'items'], ['script', 'value', 'out', 'items'],
  ]),
  T('listen-summarize-speak', 'הקלטה ← סיכום ← הקראה', 'קובץ קול ← תמלול (GPT-4o Transcribe) ← סיכום בעברית (Claude Haiku) ← הקראה (Eleven v3)', [
    n('audio', 'input.media', { kind: 'audio', urls: [] }, 'הקלטה'),
    n('stt', 'model', { model: 'openai/gpt-4o-transcribe' }, 'תמלול'),
    n('ask', 'tool.template', { template: 'סכמו בעברית, בשלושה משפטים קצרים וברורים, את מה שנאמר בהקלטה:\n\n{{a}}' }, 'הנחיה'),
    n('sum', 'model', { model: 'anthropic/claude-haiku-4.5', input: { max_tokens: 600 } }, 'סיכום'),
    n('say', 'model', { model: 'elevenlabs/eleven-v3' }, 'הקראה'),
    n('out', 'output', {}, 'פלט'),
  ], [['audio', 'media', 'stt', 'file'], ['stt', 'out', 'ask', 'a'], ['ask', 'text', 'sum', 'message'], ['sum', 'out', 'say', 'text'], ['sum', 'out', 'out', 'items'], ['say', 'out', 'out', 'items']]),
  T('image-to-film', 'מתמונה לסרטון', 'תמונה קיימת ← שוט וידאו (Veo 3.1 Fast) + מוזיקה ← סרטון אחד', [
    n('still', 'input.media', { kind: 'image', urls: [] }, 'תמונה'),
    n('move', 'input.text', { text: 'Slow push-in, soft window light drifting across the surface, a ribbon end lifting gently. Static horizon, no cuts.' }, 'תנועה'),
    n('shot', 'model', { model: 'google/veo-3.1-fast', input: { duration: '6s', resolution: '720p', generate_audio: false, aspect_ratio: '16:9' }, expectSeconds: 6 }, 'שוט'),
    n('music', 'model', { model: 'elevenlabs/music-v2', input: { music_length_ms: 8000, force_instrumental: true, prompt: 'Warm minimal piano, calm and elegant, 80 bpm' } }, 'מוזיקה'),
    n('film', 'tool.compose', { aspect: '16:9', musicVolume: 0.35 }, 'הרכבה'),
    n('out', 'output', {}, 'פלט'),
  ], [['still', 'media', 'shot', 'image_input'], ['move', 'text', 'shot', 'prompt'], ['shot', 'out', 'film', 'visuals'], ['music', 'out', 'film', 'music'], ['film', 'video', 'out', 'items']]),
  T('free-sketch', 'סקיצה חינמית', 'בלי עלות: בריף ← תיאור תמונה (gpt-oss-120b) ← תמונה (FLUX.2 klein). מהמכסה החינמית היומית', [
    n('brief', 'input.text', { text: 'מרחב טיפולים שקט ומואר, טרוורטין ופשתן, אור בוקר' }, 'בריף'),
    n('writer', 'model', { model: '@cf/openai/gpt-oss-120b', system: 'Turn the brief into one English image prompt: subject, setting, light, lens, palette. No text, no logos. Output the prompt only.', max: 400 }, 'תיאור'),
    n('image', 'model', { model: '@cf/black-forest-labs/flux-2-klein-4b', width: 1024, height: 768 }, 'תמונה'),
    n('out', 'output', {}, 'פלט'),
  ], [['brief', 'text', 'writer', 'message'], ['writer', 'out', 'image', 'prompt'], ['writer', 'out', 'out', 'items'], ['image', 'out', 'out', 'items']]),
];
