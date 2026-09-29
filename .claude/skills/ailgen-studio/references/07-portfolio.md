# Phase 7 · Portfolio: the client site and AILGEN

## 1. Put the film into the client's site

Pattern from `switching-tv/index.html` (search for `/* ---------- film ---------- */`):
- A **film section** right after the stats: eyebrow "הסרט · 26 שניות", a headline tied to the claim, three
  proof points (numbers in `<bdi dir="ltr">`), a "watch with sound" button and a secondary CTA to the proof tool;
  the video in a phone frame styled from the signature element (Switching: the TV bezel with RGB LEDs).
- `data-src` + IntersectionObserver: loads only in view, plays muted, pauses out of view, never autoplays under
  reduced motion; a round sound toggle (`aria-pressed`, label changes).
- A small link in the hero trust row ("הסרט, 26 שניות") and a **mascot tip** on the section.
- Media: `m/<slug>_film.mp4` (720w web encode) + poster JPG.

## 2. Add the project to AILGEN

AILGEN's portfolio is data: an index row in `#work` and an entry in `CASES` (in `index.html`). Fields:

```js
<id>: { crumb, title, latin?, badges: ['לקוח אמיתי' | 'פרויקט קונספט', '<type>', '<year>'],
  sub, url, meta: [['לקוח',…],['סוג',…],['תפקיד',…],['פלטפורמה',…],['סטטוס',…]],
  hero: { v, p } | { img, alt },
  brief, challenge, solution,
  visual: { title, palette: [[name, hex, fg]…], types: [[family, role, sample, css]…] } | { img, alt, cap },
  moments: [{ v, p, portrait?, t, d } | { img, alt, t, d }],        // 3–6; portrait: true for 9:16 films
  mobile: { v, p, t, d },
  details: [[icon, title, text] × 4],
  nums: [[value, label] × 4], numnote: 'measured with …, date',
  honest: 'what is real, what is render/concept/demo' }
```

Index row: a looping video in a browser frame + a phone breaking the frame, index number, year, title,
one-sentence outcome, tags (add "קמפיין וידאו" when there is a film), CTA to the case study and to the live site.

## 3. Footage (film the real site)

```python
from rec import record, top_at, to        # scripts/rec.py
def camera(pg):
    pg.wait_for_timeout(3000)             # the entry choreography
    top_at(pg, '#planner'); pg.wait_for_timeout(900)
    to(pg, '[data-s="garden"]'); pg.mouse.down(); pg.mouse.up(); pg.wait_for_timeout(1400)
record('http://127.0.0.1:8000/<slug>/', 'out/<slug>-planner', camera)
```
No Python Playwright? `scripts/rec.mjs` is the Node twin (`record(url, out, async pg => {...}, {vp, scale, cursor, init, setup})`,
`topAt`, `to`, and `viaCurl` to fetch Google Fonts through curl when the sandbox browser cannot reach them). It found Playwright
for Node at `/opt/node22/lib/node_modules/playwright`. Record the studio's own flow the same way for the "process" moment.
Then: a timestamped contact sheet (`drawtext=text='%{pts\:hms}'`, 1 fps) to pick cuts; moment clips 1280w,
crf ~23, no audio, `+faststart`; a card loop from 3–4 moments with `xfade=transition=fade:duration=0.6`; a mobile
cut (390×844 @2x → ~468w); a poster JPG for every clip. Film **after** the copy and illustrations are final.

## 4. Numbers

Lighthouse 12 on the served page (desktop and mobile), fix what it finds first, then quote with conditions and
date in `numnote`.

Run it as `CHROME_PATH=/opt/pw-browsers/chromium npx -y lighthouse@12 <url> [--preset=desktop] --output=json --chrome-flags="--headless=new --no-sandbox"`
against a **compressing static server** (`npx serve -n <folder>`, served at its own root), not `python3 -m http.server`:
without gzip the mobile score reads 20 points low and misleads. Talor Karadi went from 64 to 92 (mobile) and 99 (desktop) with:
a preview banner that is in the HTML instead of unhidden by script (it caused the layout shift), self-hosted fonts inlined in
a `<style>` with `font-display:swap` and two preloads (no request to Google, nothing render-blocking), `inert` on the closed
drawer, heading order, one contrast fix, and accessible names that contain the visible text. Other honest numbers: page weight, pages merged, guides imported, frames built in code.

## 5. Live and repo

- Repo: add media to `assets/`, edit `index.html` (card text, tags, `CASES` meta and moments).
- Live AILGEN artifact: upload media with `asset: true` (returns `/_blob/<id>`), read the live source in full,
  apply the same edits with the blob URLs, publish to the same URL.

## Gate
- [ ] Film section works in the client site (desktop, 390 px, keyboard, reduced motion).
- [ ] Case study: all parts present, portrait videos in a phone frame, numbers with source and date.
- [ ] Both the repo and the live artifacts updated.
