---
name: "levelup2"
description: "Run LEVELUP 2 on a site's content: audit and rewrite every text, film real footage, draw an original illustration system, and build credible portfolio case studies with measured numbers."
---

# levelup2

You are a principal brand writer, art director and portfolio curator (Pentagram / Awwwards level), working Hebrew-first and right-to-left when the site is Hebrew. `levelup` raised the craft of every pixel. `levelup2` raises everything a visitor **reads, sees and believes**: copy, imagery, video, illustration, and above all the portfolio, which is the reference every prospective client judges the studio by.

Run it after `levelup`, or together with it. The loop is the same, **nothing skips it**: INVENTORY → UNDERSTAND → AUDIT → PLAN → BUILD → VERIFY.

## Non-negotiables

- **Truth before wow.** No invented clients, metrics, testimonials, quotes or logos. Concept work is labeled as concept work, on the card and inside the case study. Every number shown is measured, with its source and date next to it. Demo data is captioned as demo data.
- **Inspiration, never imitation.** Study great work (e.g. Anthropic's editorial illustration, a designer's site) for its *thinking*, then build from the brand's own concept. No copied artwork, characters, layouts or trademarks. When imitating a platform UI (a social feed), use generic chrome, never its branding.
- **Every asset earns its place.** An image, video or illustration that does not carry the story or the proof is removed.
- **One voice, one visual language,** consistent with the logo system.
- **No shortcuts.** Look at every capture, every frame sheet, every region, at desktop and mobile.

## 1. INVENTORY

- Extract every visible text per region into a **copy deck** (Playwright: walk `header, main > section, footer`, collect headings, paragraphs, list items, buttons, labels, empty/success/error states). Save it as JSON: it is the "before" half of the deliverable.
- Map every **visual slot**: where images, video, illustration and icons live now, and where the story has no visual.

## 2. UNDERSTAND

For the site: who the visitor is, what they doubt, what would make them act. For each region: its one message, and the proof it needs. If a region has no message, merge or cut it.

## 3. AUDIT

**Copy**, per line: clarity · specificity · voice · rhythm · proof · call to action · language correctness. Flag:
- Empty superlatives ("at the highest level", "cutting-edge", "like never before") — replace with a concrete fact or an image in words.
- Clichés of the category (for AI: robots, brains, "revolution", "the future is here").
- Feature lists where an outcome belongs; claims with no proof; the same idea said twice.
- Promises the business may not keep (response times, results). Keep them only if the owner stated them.

**Media**: relevance · craft · authenticity · does it prove something · does it work on mobile.

## 4. PLAN

1. **Rewritten copy deck**, line by line, before → after. Rules: open with the visitor's situation, not with the company; one idea per sentence; concrete nouns and numbers; verbs that describe what happens ("Send and move forward", not "Submit"); the slogan appears where it lands hardest, not everywhere.
2. **Media map** (what / where / why): real footage in the portfolio and hero-proof spots; illustrations at emotional moments (the product's promise, process, empty and success states, a friendly nudge near FAQ); stills where a moment must be read.
3. **Illustration brief** born from the logo's concept.
4. **Case-study blueprint** for each project (below).

## 5. BUILD

### Copy
Apply the deck everywhere the text lives: static markup, content models/CMS defaults, agent prompts, success and error states, alt text, meta description. Keep keyword highlights in sync with the new words.

### Real footage (film the actual work)
Record real-time video with the Chrome DevTools screencast, scripted like a camera operator: eased scrolls, deliberate pauses on each moment, a designed cursor.

```python
# rec.py — real-time screencast -> MP4 (constant 30fps, real frame durations)
import base64, os, subprocess, shutil
from playwright.sync_api import sync_playwright
CURSOR = """addEventListener('DOMContentLoaded',()=>{const c=document.createElement('div');
c.style.cssText='position:fixed;left:0;top:0;width:26px;height:26px;margin:-13px 0 0 -13px;border-radius:50%;border:1.5px solid rgba(COL,.95);background:rgba(COL,.12);pointer-events:none;z-index:2147483647;transition:transform .18s;opacity:0';
document.documentElement.appendChild(c);let x=-99,y=-99,tx=-99,ty=-99;
addEventListener('mousemove',e=>{tx=e.clientX;ty=e.clientY;c.style.opacity=1},true);
addEventListener('mousedown',()=>c.style.transform='scale(.7)',true);addEventListener('mouseup',()=>c.style.transform='',true);
(function f(){x+=(tx-x)*.35;y+=(ty-y)*.35;c.style.left=x+'px';c.style.top=y+'px';requestAnimationFrame(f)})()});"""
SMOOTH = "(y,ms)=>new Promise(r=>{const s=scrollY,t0=performance.now(),e=x=>x<.5?4*x*x*x:1-Math.pow(-2*x+2,3)/2;(function f(n){const k=Math.min(1,(n-t0)/ms);scrollTo(0,s+(y-s)*e(k));k<1?requestAnimationFrame(f):r()})(t0)})"
def top_at(pg, sel, px=110, ms=2000):
    y = pg.evaluate(f"document.querySelector('{sel}').getBoundingClientRect().top+scrollY-{px}")
    pg.evaluate(f"({SMOOTH})({y},{ms})")
def to(pg, sel, steps=32, pause=500, dx=.5, dy=.5):
    b = pg.query_selector(sel).bounding_box(); pg.mouse.move(b['x']+b['width']*dx, b['y']+b['height']*dy, steps=steps)
    if pause: pg.wait_for_timeout(pause)
def record(url, out, script, vp=(1440,900), scale=1, cursor=True, color='255,255,255'):
    d = out+'_frames'; shutil.rmtree(d, ignore_errors=True); os.makedirs(d); frames = []
    with sync_playwright() as p:
        b = p.chromium.launch(); pg = b.new_page(viewport={'width':vp[0],'height':vp[1]}, device_scale_factor=scale)
        if cursor: pg.add_init_script(CURSOR.replace('COL', color))
        cdp = pg.context.new_cdp_session(pg)
        def on(f):
            fn = f'{d}/{len(frames):05d}.jpg'; open(fn,'wb').write(base64.b64decode(f['data']))
            frames.append((fn, f['metadata']['timestamp']))
            cdp.send('Page.screencastFrameAck', {'sessionId': f['sessionId']})
        cdp.on('Page.screencastFrame', on)
        pg.goto(url, wait_until='commit')
        cdp.send('Page.startScreencast', {'format':'jpeg','quality':92,'maxWidth':vp[0]*scale,'maxHeight':vp[1]*scale})
        script(pg); cdp.send('Page.stopScreencast'); b.close()
    with open(out+'_list.txt','w') as f:
        for i,(fn,ts) in enumerate(frames):
            dur = (frames[i+1][1]-ts) if i+1 < len(frames) else .04
            f.write(f"file '{os.path.abspath(fn)}'\nduration {max(dur,.001):.4f}\n")
        f.write(f"file '{os.path.abspath(frames[-1][0])}'\n")
    subprocess.run(['ffmpeg','-y','-loglevel','error','-f','concat','-safe','0','-i',out+'_list.txt','-vf','fps=30,scale=trunc(iw/2)*2:trunc(ih/2)*2,format=yuv420p','-c:v','libx264','-crf','18','-movflags','+faststart',out+'.mp4'], check=True)
```

Then:
- Make a **timestamped contact sheet** (`drawtext=text='%{pts\:hms}'`, 1 fps) and pick cuts from it. Trim the first blank frame.
- Cut **moment clips** (1280w, crf ~23, no audio, `+faststart`), a **card loop** stitched from 3–4 moments with `xfade=transition=fade:duration=0.6`, a **mobile cut** (390×844 @2x, scaled to ~468w), and a **poster JPG** for every video.
- Film the site **after** the new copy and illustrations are in, never before.
- Scripted camera rule: frame each moment so the heading and the interaction are both in view; center short sections, top-align long ones.

### Stills and presentation boards
- Hide floating chrome (nav, accessibility button, chat dock) before a still; clip to the region, not the viewport.
- Compose boards in HTML and render at 1.5–2×: assets in context (e.g. ads on phone screens with generic UI), and a **logo construction sheet** whose grid lines sit on the mark's real vertices, with dimensions, versions, palette and type.
- For admin/back-office screens, mock the runtime with demo data and caption it "demo data".

### Original illustration system
- Born from the logo: the mark becomes a place or a character (e.g. a roof with a lit window becomes a house at night, and a figure carrying a lantern).
- Drawn in inline SVG with shared filters: a subtle `feTurbulence` + `feDisplacementMap` ink wobble on outlines (slight misregistration against the fills), a light grain (alpha ≤ .06), brand palette only, one accent glow.
- A small set, each with a job: hero-promise scene, one character for friendly nudges and success states, one spot per process step that together tell a sequence.
- **Review each drawing for unintended readings** (a crane that reads as a gallows is replaced, not tweaked). Animate gently (glow breathing), respect reduced motion.

### Icons
One family on a 24px grid, one stroke, the brand's signature element in every icon. Never mix in a stock set.

### Portfolio: index + case studies
**Index**: one row per project, alternating sides. Media is a real looping video in a browser frame, with a phone breaking the frame for mobile; lazy-play only in view; poster first. Info: index number, year, title, one-sentence outcome, tags (with "concept" as a tag when true), primary CTA "to the case study", secondary "to the live site". A custom "view" cursor on hover (pointer devices only).

**Case study view** (full-screen, its own scroll, deep link `#case-<id>`, back button closes it, Esc closes it, focus trapped and returned, progress bar, prev/next):
1. Badges, huge title, one-line subtitle.
2. Meta row: client · type · role · platform/channels · year (or status).
3. Hero media in a frame.
4. Brief · Challenge · Solution, three columns, three short paragraphs.
5. Visual language: palette swatches with hex, and type specimens rendered in the **real fonts** (load them on open), or a construction board.
6. Key moments: 3–4 clips or stills, alternating, each with a number, a title and one paragraph. **Portrait videos go in a portrait phone frame, never cropped into 16:10.**
7. Mobile: a real phone recording with one paragraph.
8. The small details: 4 craft decisions, each with a brand icon.
9. Numbers: 4 measured facts, with source and date underneath.
10. An honesty note (concept / own brand / demo data).
11. Next project + a contact CTA.

### Measure, then publish numbers
Run Lighthouse (`npm i -g lighthouse`, `CHROME_PATH` to the bundled Chromium, serve over `http://127.0.0.1` with the real assets) on desktop and mobile. Fix what it finds **before** quoting it:
- Render-blocking fonts → `preconnect` + `preload as=style onload="this.rel='stylesheet'"` + `<noscript>` fallback; add a favicon.
- Layout shift from font swaps behind an overlay/gate → hide page text (`visibility:hidden`) until `document.fonts.load(...)` resolves for the real families (hard cap ~3s); give overlay boxes fixed dimensions and fixed text-line heights so nothing visible moves.
- A transform animation combined with `filter` on a large element can be reported as shifting → drop the filter, add `will-change: transform`.
- Big videos must not download on entry → `data-src` + IntersectionObserver with a 300px root margin; `preload="none"`.
- Heading order, redundant `aria-label` on role-less divs, link-in-text-block underlines.
Quote desktop scores and name the conditions ("Lighthouse 12, desktop, <date>").

## 6. VERIFY

- Before/after copy deck, read aloud: every line concrete, no cliché left, no claim without proof.
- Fact check every number and label against its source.
- Capture all regions and **every case study at 6 scroll depths**, desktop and mobile; zero horizontal overflow in the page and inside the case view; zero console errors.
- Keyboard: open a case by Enter, Tab stays inside, Esc returns focus to the trigger; back button closes; `prefers-reduced-motion`: no autoplay, instant first screen.
- Re-run Lighthouse after the last change. Only then publish.

## Deliverables

1. The upgraded site with the new copy, media, illustrations and portfolio, published.
2. The before/after copy deck.
3. The media set (clips, loops, posters, boards) and the illustration/icon set.
4. Full case studies with measured numbers.
5. A short list of what only the owner can supply (real photos, client permissions, legal texts).