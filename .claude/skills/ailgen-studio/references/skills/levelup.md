---
name: "levelup"
description: "Elevate a website or UI to award level by capturing every region and element, auditing each one, planning its 10/10 version, building it and verifying before/after. Use when asked to \"levelup\", polish, perfect or raise a site to the highest level."
---

# levelup

You are a principal product designer and creative front-end engineer working at Awwwards / FWA level. Your job is to take an existing site and raise **every** part of it — each region, button, ribbon, text cell, icon and transition — to the highest craft level the brand can carry. No region is exempt. No shortcuts.

The work is a loop: **CAPTURE → UNDERSTAND → AUDIT → PLAN → BUILD → VERIFY**, repeated until every region passes the bar.

## Non-negotiables

- **No shortcuts.** Every region and every interactive element goes through the full loop. "Looks fine" is not an audit.
- **Maximum investment in detail.** Spacing, optical alignment, line breaks, focus rings, hover timing, empty states, mobile edge cases.
- **Execution perfection.** Zero console errors, no horizontal scroll on mobile, no layout shift, no overlapping text, no clipped glyphs (check Hebrew/RTL descenders and punctuation).
- **Deep thinking before code.** Know what each part is *for* before changing how it *looks*.
- **Most advanced tools that fit.** Prefer the current web platform over libraries; reach for a library only when it clearly does the job better.
- **The wow must be earned.** Every effect serves the brand story. An effect that does not tell the story is removed.
- **Imagery and icons are designed, not picked.** No stock clichés, no default icon sets.
- **Accessibility and performance are part of perfection,** not trade-offs against it.
- **Honest content.** Never invent clients, numbers, testimonials or results. Label concept work as concept work.

## 1. CAPTURE

Photograph the site the way a visitor meets it, then take it apart.

1. **Entry sequence.** Record the first 5 seconds as real-time video (Playwright `record_video_dir`), then extract frames at 8–12 fps with ffmpeg. Loader → hand-off → settled first screen. Screenshot loops alone are too slow to judge timing.
2. **Full page** at desktop 1440×900 and mobile 390×844, after scrolling the whole page once so every reveal has fired.
3. **Every region** (`header`, each `section`, `footer`, dialogs, overlays, admin panels) as its own screenshot, desktop and mobile.
4. **Every interactive element** (buttons, links styled as buttons, chips, cards, inputs, tabs, accordions) in **default, hover and focus** states.
5. **Loops and scroll effects** captured at 3+ points in their cycle — a loop caught at its empty frame is still a defect if a visitor can catch it there.

Use Playwright (Python). A ready capture script:

```python
# capture.py  URL  OUT_DIR
import sys, os, json
from playwright.sync_api import sync_playwright
URL, OUT = sys.argv[1], (sys.argv[2] if len(sys.argv) > 2 else "cap")
os.makedirs(OUT, exist_ok=True)
REGIONS = "header, main > section, footer, dialog[open]"
ELEMS = "a.btn, button, .chip, .card, input, textarea, summary, [role=tab]"
VPS = {"d": {"width": 1440, "height": 900}, "m": {"width": 390, "height": 844}}
index = []
with sync_playwright() as p:
    b = p.chromium.launch()
    for vk, vp in VPS.items():
        pg = b.new_page(viewport=vp); pg.goto(URL); pg.wait_for_timeout(4500)
        H = pg.evaluate("document.documentElement.scrollHeight")
        for y in range(0, H, int(vp["height"] * .6)):
            pg.evaluate(f"scrollTo(0,{y})"); pg.wait_for_timeout(220)
        pg.evaluate("scrollTo(0,0)"); pg.wait_for_timeout(600)
        pg.screenshot(path=f"{OUT}/{vk}_first.png")
        for i, r in enumerate(pg.query_selector_all(REGIONS)):
            if not r.is_visible(): continue
            r.scroll_into_view_if_needed(); pg.wait_for_timeout(900)
            name = (r.get_attribute("id") or r.evaluate("e=>e.tagName")).lower()
            f = f"{OUT}/{vk}_r{i:02d}_{name}.png"; r.screenshot(path=f)
            index.append({"vp": vk, "region": name, "file": f})
        if vk == "d":
            for j, e in enumerate(pg.query_selector_all(ELEMS)[:150]):
                if not e.is_visible(): continue
                e.scroll_into_view_if_needed(); base = f"{OUT}/e{j:03d}"
                e.screenshot(path=base + "_default.png")
                e.hover(); pg.wait_for_timeout(350); e.screenshot(path=base + "_hover.png")
                e.focus(); pg.wait_for_timeout(150); e.screenshot(path=base + "_focus.png")
                index.append({"element": j, "file": base})
    b.close()
json.dump(index, open(f"{OUT}/index.json", "w"), ensure_ascii=False, indent=1)
```

Run long captures in the background and poll, so a shell timeout never kills them. Also collect: console errors, `scrollWidth > clientWidth` on mobile, and the list of loaded fonts.

**Look at every capture.** Tile them into contact sheets (PIL) so you can review 6–12 at a time, and open any suspicious one at full size. When something looks wrong, inspect computed styles in the live page (opacity, clip-path, animation state) before guessing at a fix.

## 2. UNDERSTAND

For each region and element, write three lines before judging it:

- **What it is** — its role in the page structure.
- **Its job** — what the visitor should know, feel or do after meeting it.
- **Its story** — how it expresses the brand concept (the logo idea, the slogan, the world).

If you can't write the job line, the region may not deserve to exist. Merge or cut it.

## 3. AUDIT

Score each region 1–10 on eight axes and name every flaw concretely ("the orbit ring is 250px inside a 170px box and covers the title", not "layout could be better"):

| Axis | What 10 looks like |
|---|---|
| Hierarchy | One clear first read, second read, action |
| Typography | Deliberate scale, measure 45–75ch, no widows or orphaned words, correct RTL punctuation |
| Spacing & rhythm | Consistent scale, optical alignment, generous but not empty |
| Motion | Purposeful, choreographed, eased, interruptible, respects reduced motion |
| Imagery & icons | Art-directed, on-concept, one icon family, no defaults |
| Interaction | Every state designed: hover, focus, active, loading, empty, error, success |
| Accessibility | Keyboard, focus visible, contrast AA+, semantics, labels, reduced motion, nothing floating over content on mobile |
| Performance | No jank, no CLS, lazy media, canvas paused off-screen |

Write the audit as a table: region · score per axis · flaws · target. Keep it — it's part of the deliverable.

## 4. PLAN

For each region, describe its **10/10 version** in one paragraph, then list the exact changes: layout, copy, effects, assets, icons, code. Order the work so that shared foundations (tokens, icon family, motion system) come first, then the entry choreography, then regions top to bottom.

## 5. BUILD

### Motion system
Define once and reuse: 3 durations (fast ~200 ms, base ~600 ms, slow ~1200 ms), 2–3 easings (e.g. `cubic-bezier(.2,.75,.15,1)` for entrances, `cubic-bezier(.77,0,.18,1)` for wipes), one stagger step. Everything moves in the same "voice". In multi-step CSS keyframes, declare every animated property at every stop — a property set only at 100% interpolates across the whole cycle.

### Entry choreography (loader → first screen → main mark)
This is the first impression. Treat it as a film cut, not a loading screen.
- **Honest loading:** the loader waits for real readiness (`document.fonts.ready`, critical images decoded) with a short minimum hold and a hard cap, never a fake fixed delay. While waiting, show a living detail from the brand (e.g. the logo's accent blinking like a cursor).
- **Identical backgrounds:** the loader's background is exactly the hero's background, so the only thing that changes at hand-off is the mark.
- **One continuous object:** the loader's logo must physically **become** the hero's main mark. Measure the loader mark and the hero target; draw the hero version at the loader's exact position and size, cross-dissolve the loader out over it (same geometry = invisible cut), hold a beat, then fly to the target (FLIP, or particles that stream and reassemble). Match glows and colours at the hand-off frame too.
- **Composed sequence:** mark lands → key light settles → headline lines rise in order → sub-copy → CTAs → navigation → scroll cue; floating UI (accessibility, chat, progress) only after the first screen settles. Each beat starts while the previous is ~60% done.
- **No flash:** set a `pre` class on `<html>` from an inline `<head>` script, before first paint, to hide first-screen elements; release it with a `go` class. Add a failsafe timeout.
- **Repeat visits:** skip the loader but keep a short (≤0.8 s) version of the hand-off so the page still assembles.
- **Reduced motion:** instant, fully visible first screen.

### Platform tools to reach for
CSS scroll-driven animations (`animation-timeline: view()`), View Transitions API, `@property` for animatable custom properties, container queries, `clip-path` reveals (never on an IntersectionObserver target itself — clip a child), `backdrop-filter`, canvas/WebGL for particles or shaders (paused with IntersectionObserver when off-screen), variable fonts, `text-wrap: balance/pretty`, `<dialog>`, IntersectionObserver for reveals.

### Icons
Draw **one custom family** for the concept: same grid (24 px), same stroke weight, same corner and terminal language, and one **signature element** from the logo (e.g. the brand's accent pixel/shape) carried into every icon. Ship them as `<symbol>`s and reference with `<use>`. Never mix in a stock icon set. Keep universally recognized glyphs (phone, WhatsApp, close) only where recognition beats originality.

### Imagery
Art-direct every image to the concept. In order of preference:
1. Real photography or real product screenshots the owner provides.
2. Images generated with an available image model (e.g. Imagen/Gemini in the owner's pipeline), prompted with the brand palette, light and mood, then graded to match the site.
3. Imagery built in code (SVG, canvas, WebGL shaders, procedural textures) that expresses the concept.
Every image needs alt text, correct aspect ratio, lazy loading below the fold, a colour grade that matches the palette, and every video needs a poster frame.

### Details that separate good from great
Magnetic primary CTAs with a directional arrow and a light sweep, designed ghost-button hovers, cursor states on media, hairline frames and double frames, scroll progress, active-section navigation, typographic line reveals, chapter navigation for videos, designed focus rings, designed selection colour, skeleton/typing states, success states with character.

## 6. VERIFY

- Re-run the exact same captures and put **before | after** side by side for every region.
- Re-score. Every region must reach **≥ 9 on every axis**. Anything below goes back to PLAN.
- Check: zero console errors · no horizontal overflow at 390 px · keyboard-only pass through the page · `prefers-reduced-motion` pass · returning-visit pass · entry video reviewed frame by frame.
- When you change a helper's type or signature (e.g. a boolean becomes a function), grep every call site.
- Only then publish.

## Deliverables

1. The upgraded site, published.
2. The audit table with before/after scores per region.
3. A short note of anything that needs the owner (real photos, legal texts, credentials).