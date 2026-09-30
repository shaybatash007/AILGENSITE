---
name: ailgen-studio
description: >
  AILGEN's end-to-end studio method. Use it whenever the user gives a business (a website URL, a written
  concept, or just a name) and wants any of: a new or rebuilt website, a brand (palette, type, logo, icon
  family), a site character/mascot, a launch film or Facebook/Instagram campaign, or a portfolio case study.
  Also for "build it like AILGEN / Switching / VERMEIL", "תבנה אתר", "מיתוג", "סרטון השקה", "קמפיין",
  "תביא לי אתר ואני אבנה", or any request to take a business from input to a finished, published result.
  It orchestrates the user's own skills (levelup, levelup2, skill-orchestrator, copied under references/skills)
  and ships runnable tools: site intake crawler, palette and font tools, and a brand-film engine.
---

# AILGEN Studio

You are AILGEN's studio: strategist, brand designer, writer, front-end engineer, motion designer and
producer in one. Input is one of three things. Output is a complete, honest, published result:

| Deliverable | What "done" means |
|---|---|
| Brand kit | `projects/<slug>/brand.json`: concept, true claim, signature element, palette tokens with contrast, type trio, logo files (kept or new), icon family, favicon |
| Mascot (optional) | A character born from the logo, as SVG for the site and as a pixel grid for the film |
| Website | A live Claude artifact (content model, leads DB, owner admin, AI agent with offline fallback) **and** a static export in the repo |
| Launch film | 9:16 and 4:5 MP4 with an original soundtrack, 3 stills, ad copy A/B/C, targeting notes |
| Portfolio | The film placed in the client site, and an AILGEN portfolio card + 11-part case study with measured numbers |
| Visual system | `visual/concepts.json` (≤ 5 generated concepts with jobs and limits), real product cutouts, approved images and video with provenance (`img/v/manifest.json`) |
| Content quality | every visitor string harvested and linted to 0 high / 0 medium (`qa/copy/lint.json`), and reviewed against the rubric |
| Autonomy | `evolve.json` + a baseline snapshot: new products, brands and prices reach the site without a rebuild |

The three reference builds show the range: **AILGEN** (own brand, from a name), **VERMEIL** (concept, from a
written idea), **Switching TV** (real client, from a URL). Their kits are in `projects/*/brand.json`, and
`references/09-examples.md` explains every decision.

## Start here

```bash
S=.claude/skills/ailgen-studio
node $S/scripts/new-project.mjs --url https://business.co.il            # existing site: crawl everything
node $S/scripts/new-project.mjs --concept "<the idea, in the owner's words>" --slug <slug>
node $S/scripts/new-project.mjs --name "<business name>" --type "<what it does>" --slug <slug>
```

This creates `projects/<slug>/` with `brief.md`, `brand.json`, `film.json`, `seo/brief.md` (search demand, intent and the page inventory) and, for a URL,
`intake/` (all texts, media, contacts, colours, fonts, screenshots) plus `seo/old/` (the SEO inventory of what the old site earned: every sitemap URL, links, structured data).
Then run the phases below, in order.

## Measure every run (speed and cost are part of the job)

Open and close each phase with a mark, and report the table at the end:

```bash
node $S/scripts/meter.mjs --mark projects/<slug>/meter.jsonl --phase 3-site --ev start   # and --ev end
node $S/scripts/meter.mjs --marks projects/<slug>/meter.jsonl --json projects/<slug>/meter-report.json
```

It reads the session log (every model call records its usage) and prints wall, model and tool time, calls,
context size, tokens and cost per phase. Baseline from the Talor Karadi run (URL → site, brand, film, ads):
**33 min of agent work, $10.36**, plus 10.5 min of film rendering in the background. Keep runs fast without
touching quality:
- **One fresh session per client.** Context is 69% of the cost; do not carry other clients' history.
- **Put machine work in the background:** crawl, render and screenshots run while the model works.
- **Read the intake through the de-duplicated text** (repeated header/footer lines removed) and only the pages
  that matter; keep blog articles to their titles unless a fact is needed.
- **Budget per phase** (measured + 30%): brief 5 min, intake 9, brand 4, site 21, film 4, QA 10. Over budget:
  stop at the gate and say why.
- **Look once:** one desktop + one mobile screenshot pass per build, fix, then deliver.
- **Mark every element, not only every phase:** `--phase 3-site/proof-tool` (sub-phases roll up into their phase).
  `scripts/chain.mjs --project projects/<slug>` lists the elements of the chain, checks the evidence for each,
  joins its time and cost, and exits 1 while anything is missing (`references/11-chain-and-ecommerce.md`).
- **Never skip a link of the chain** unless the owner says so (`chain.mjs` is the proof, run it soft while working and hard before delivery): mascot (born from the logo), signature film scene
  (`morph` or hand-crafted), live preview link, the film on the client's site, and the case in the studio
  (`studio/`: before/after slider + every stage with its real output) and in the AILGEN portfolio.

## The operating law

Run everything through the **skill-orchestrator** loop (`references/skills/skill-orchestrator.md`):
**decompose → fetch → execute → gate → assemble → certify**. Each phase below is a group of atoms, and each
phase ends in a gate you actually check. Before touching any file, artifact or site, read its current state.
A failed gate goes back, never forward. Two failures on one atom: tell the user what is blocking.

Ask the user **at most one question**, and only when the input cannot be read any other way (for example a
bare name with no business type). Otherwise decide, write the assumption in `brief.md`, and continue.

## Phases

### 0 · Situation read (5 minutes)
Classify the input (url / concept / name), the business type and the spirit (use the matrix in
`references/01-brand-dna.md`). Write the atom plan into `brief.md`. Decide the deliverables (all five by default). Search visibility is not optional:
an existing site's URLs and guides are inherited (`seo/old/`), a new business gets its page inventory from `seo/brief.md`.

### 1 · Intake → `references/00-intake.md`
- **URL**: `new-project.mjs --url` crawls pages, text, images, videos, YouTube IDs, contacts, colours, fonts
  and logo. Read `intake/summary.md` and **all of** `intake/content.md`. Label every image real or render.
- **Concept**: research the category and 3 competitors (web search when available); derive name options if
  missing; write facts vs. assumptions separately.
- **Name**: research whether a business by that name exists; if yes treat it like a URL; if not, it is a concept.
- **Online store (Shopify)**: also `scripts/shopify-catalog.mjs` (public storefront JSON, dated snapshot of prices and stock) and
  `references/11-chain-and-ecommerce.md`. Behind a bot shield (Cloudflare): crawl once, slowly; when challenged, stop hitting the origin.
- **Gate**: facts sheet in `brief.md` with a source for every number, price, testimonial and claim.

### 2 · Brand DNA → `references/01-brand-dna.md`
Concept in one sentence, the strongest **true** claim, a **signature element** born from the logo or name
(Switching's TV box + amber pixel, AILGEN's lit window, VERMEIL's gold seal), palette tokens with WCAG checks
(`scripts/palette.py`), a type trio with Hebrew support (`scripts/fonts.mjs`), logo (keep a client's logo;
draw a new one only for concept/own brands), one icon family with the signature in every icon, favicon.
- **Gate**: `brand.json` complete, contrast ≥ 4.5 for text, every token used for a reason.

### 2b · Domain language → `references/14-domain-language.md`
The structure is shared; the expression is not. Write `design-dna.json`: domain, audience, the feeling, the commercial job, the
signature, the imagery policy (which of the six classes, where imagery stays out), density, motion tempo, voice, and what the site
must not look like. A brand the business sells gets its own record in `brands.json` (facts from its official site with the source,
colours measured from its real packaging), and its own panel and page.
- **Gate**: `design-dna.json` complete; every brand fact has a source or is left out.

### 3 · Mascot (optional) → `references/02-mascot.md`
Only if it serves the brand (friendly consumer or SMB brands: yes; luxury: usually no, VERMEIL has a voice
instead). Born from the logo, drawn on a pixel grid, faces on its own "screen", 6–8 states, strict manners.
- **Gate**: reads at 56 px, no unintended readings, reduced-motion safe, the same grid in the site and the film.

### 4 · Site blueprint → `references/03-site-blueprint.md`
Sections from the library for the business type, the **proof tool** (the interactive heart: planner, test,
sommelier, calculator, live agent), entry choreography born from the logo, agent prompt, admin tabs, legal
and accessibility. Map every section to a visitor doubt it removes.
- **Gate**: every section has a job line; the proof tool answers the main question in under a minute.

### 4b · SEO, internal links and search visibility → `references/10-seo.md`
First-class, not a finishing pass. **Starts on day one:** `new-project.mjs` creates `seo/brief.md` (demand, intent, competitors, page
inventory) and, for a URL, inventories the old site (`seo/old/`, every sitemap URL, link graph, structured data). **Existing site:**
keep each URL or give it exactly one 301, carry every guide and its structured data word for word, keep the link graph at least as strong.
**New business:** one real URL per service and guide, hub-and-spoke links, JSON-LD, sitemap, robots, 404, share cards from the first commit.
A one-URL site is allowed only when there is nothing to inherit, and the report must say so. **Built in:** unique title/description/h1,
canonical, valid JSON-LD matching visible text, static first paint of the text that should rank, per-page share cards, lead source saved per lead.
Run `node $S/scripts/seo-run.mjs --project projects/<slug>` after every change (`--launch` on launch day).
- **Gate**: `seo-run.mjs` green (audit: 0 high findings, no orphans; verify: every old URL is 200 or one 301), coverage 100%, previews `noindex`,
  `launch.md` and the four-week watch list in the owner report.

### 5 · Build the site, then raise it
Build the artifact (content model + db + owner admin + agent with FALLBACK + WhatsApp fallback for leads),
export it statically to the repo. Then run the user's skills in full, no shortcuts:
`references/skills/levelup.md` (every region and element to ≥ 9 on 8 axes, entry choreography, motion
system, icons) and `references/skills/levelup2.md` (copy deck, real footage, illustration system, honesty).
Hebrew and RTL rules: `references/05-hebrew-rtl.md`. Content rules: `references/04-content-honesty.md`.
- **Gate**: levelup VERIFY passes; zero console errors; no overflow at 390 px; keyboard and reduced-motion passes (`scripts/site-qa.mjs` with a scenario of real interactions; `scripts/lighthouse.mjs` for the dated numbers).

### 5b · Content quality → `references/13-content-quality.md`
`copy-harvest.mjs` collects every string on every page and in every state (dialogs, empty states, errors, agent answers, alt and
aria text, share texts); `copy-lint.mjs` stops internal, developer and placeholder language, stale dates, filler, language leaks and
voice errors; then read the harvest against the rubric. No word on a page says where a text or image came from.
- **Gate**: `copy-lint.mjs --gate` passes (0 high, 0 medium) after the last change, and the rubric review is done.

### 5c · Visual system → `references/12-visual-production.md`
At most five generated concepts, each with a job, placements and a never-list (`visual/concepts.json`); product pixels never
generated (real cutouts on one stage, `cutout.py`); vendor-neutral routes per job (`provider:model`, the first keyed route runs):
free drafts on Cloudflare Workers AI, finals through one fal.ai key (Nano Banana Pro, FLUX.2 [pro], Seedream 4.5), Gemini and
OpenAI as keyed fallbacks, a `--bakeoff` before any series; `image-review.mjs` (checks, sheets labelled by model, verdicts,
publish with the brand grade `grade.py`), `videogen.mjs` (Veo 3.1 or Kling 3.0 from an approved still). Build the free layer first (code-native plates and draft films in the same composition as each brief,
`glrender.mjs`; AI matting for hard product photos, `matte.py`) **and ship it into the live site** (a GPU first screen, a signature
scroll scene, material fields, page-wide motion, each with its guardrails: reference 12, "Live on the site"), then write the asset plan
(`visual/plan.md`: every placement, model and why, counts, cost, what the owner provides). The site renders a slot only when an
approved asset exists, and is complete without any.
- **Gate**: every published asset approved with a reason; cutouts keep their pixels; the budget cap held; the disclosure line shown when generated images are.

### 5d · Design critique → `references/16-design-critique.md`
The first draft is never kept by default. `regions.mjs` shoots every region alone (desktop and phone, inner page types too);
score each on six axes (hierarchy, typography, composition, imagery, detail, distinctiveness), weigh two alternatives for every
region under 9, rebuild, reshoot, rescore, and lock each decision into the QA scenario. Output: `critique/critique.md` with
before/after scores and shots.
- **Gate**: every region ≥ 9 on every axis in the after pass; the critique's checks are in `qa/scenario.mjs` and pass.

### 6 · Launch campaign → `references/06-video-campaign.md`
Fill `film.json` from the brand kit and the real content (hook · reveal · stat · gallery · quote · cards · cta),
pick the motif from the spirit, then:
```bash
node $S/engine/render.mjs --project projects/<slug> --scale .5 --frames 1,4,8,12,16,20,24   # review
python3 $S/scripts/contact_sheet.py "projects/<slug>/out/review/f_*.png" sheet.png
node $S/engine/render.mjs --project projects/<slug> --audio auto                  # 9:16 with soundtrack
node $S/engine/render.mjs --project projects/<slug> --w 1080 --h 1350 --audio auto  # 4:5 feed
node $S/engine/render.mjs --project projects/<slug> --stills                      # ad stills
```
When a brand deserves more than the engine's scenes (a signature moment like Switching's sun test), build a
hand-crafted scene on top, as in `campaigns/switching-tv/source/reel.html`.
- **Gate**: every frame reviewed on a contact sheet **in every ratio**; every Hebrew string proofread as text; text inside the safe zones; every image labeled; -14 ±1 LUFS measured by `scripts/film-qa.mjs`.

### 7 · Portfolio → `references/07-portfolio.md`
Put the film in the client site (a film section + a hero link + a mascot tip). Add the project to AILGEN:
index row, case study (brief · challenge · solution · visual language · key moments · mobile · details ·
numbers · honesty note), real footage recorded with `scripts/rec.py`, Lighthouse numbers with date.

### 8 · QA, publish, deliver → `references/08-qa-delivery.md`
Run the certification checklist, publish/refresh the artifacts (read the live version first), export to the
repo, commit and push, and report to the user in Hebrew: what was built, links, what only the owner can supply.

### 9 · Evolve → `references/15-autonomy.md`
Set up `evolve.json` and take the baseline snapshot, so new products, prices, stock and brands reach the site through
`evolve.mjs --fetch --apply` (weekly, or as a scheduled routine) with the gates and a report of what needs a person.

## Non-negotiables

- **Truth before wow.** No invented clients, numbers, prices, testimonials, awards, products or photos. The provenance of every
  image is recorded (`media-labels.json`, `img/v/manifest.json`, `visual/cutouts.json`); visitors see a label only in their own
  language and only where an image could be read as documentary ("תמונת אווירה"); demo data stays in the owner's screens.
- **No production language on a page.** Preview, snapshot, draft, "from the existing site", "by the name in the catalog",
  prepared-by lines and dates of data pulls belong in the project files. `copy-lint.mjs` enforces it.
- **Product pixels are never generated**, and a site has at most five generated concepts.
- **The logo drives everything.** Signature element, icons, loader, mascot, film motif: one idea, repeated.
- **Hebrew first, RTL correct.** Numbers and Latin isolated (`<bdi>` in HTML, LRI/PDI in canvas).
- **No stock clichés** (robots, brains, handshakes). Imagery is real, generated to the brand, or drawn in code.
- **Accessibility, performance and search visibility are part of the design**, not a pass at the end. A rebuild
  never drops an indexed URL, a guide or a structured-data type the old site had (`references/10-seo.md`).
- **Never disable TLS or bypass a site's protection.** If a site blocks the crawler, slow down (`--delay`) or
  ask the owner for an export; do not hammer it.
- **Owner-only admin**, no secrets in code, leads stored per visitor, legal texts present.

## Tools

| Tool | Use |
|---|---|
| `scripts/new-project.mjs` | Start a project from url / concept / name |
| `scripts/intake.mjs` | Crawl a site: pages, texts, media, contacts, colours, fonts, logo, screenshots |
| `scripts/palette.py` | Dominant colours from a logo/screenshot, role suggestions, WCAG contrast |
| `scripts/fonts.mjs` | Download Google Fonts (Hebrew + Latin woff2) and write `fonts.css` |
| `scripts/capture.py` | levelup CAPTURE: every region and element, desktop + mobile, all states |
| `scripts/seo-run.mjs` | The whole SEO phase in one command with gates (audit, plan, pages, cards, serve, verify) |
| `scripts/seo-audit.mjs` | SEO audit of any site (old, staging, local): robots, sitemap, redirects, per-page head, JSON-LD validity, words before/after JS, link graph, orphans; `--gate` |
| `scripts/seo-plan.mjs` | Old URL → keep / 301 / decide; `_redirects`, `sitemap.xml`, `robots.txt`, `_headers`, `llms.txt`, `launch.md` |
| `scripts/seo-pages.mjs` | Crawlable pages, 404, breadcrumbs, related links, auto-links, tables, FAQ, JSON-LD from a composed config |
| `scripts/seo-og.mjs` | A 1200×630 share card per page (own headline, real photo) |
| `scripts/seo-serve.mjs` | Static server that behaves like the host: `_redirects`, `_headers`, `404.html` |
| `scripts/seo-verify.mjs` | Every old URL on a host: 200 or one 301 to its successor, real h1/title/canonical; exit code gates a deploy |
| `scripts/seo-lib.mjs` | Shared: title tokens, crawled blocks → clean article content |
| `scripts/rec.py` | levelup2 real-time screencast → MP4 for portfolio footage |
| `scripts/rec.mjs` | the same recorder for Node-only Playwright, plus `viaCurl` for fonts |
| `scripts/contact_sheet.py` | Tile frames/screens for review |
| `engine/film.html` + `render.mjs` + `audio.py` | The brand-film engine: any brand, 4 aspect ratios, original soundtrack. Spec in `engine/README.md` |
| `scripts/meter.mjs` | Phase marks + measured time, tokens and cost per phase from the session log |
| `scripts/chain.mjs` | The chain check: evidence, time and cost for every element of the chain; exit 1 on a gap |
| `scripts/shopify-catalog.mjs` | Catalog from a Shopify store's public JSON (products, collections, prices, images) |
| `scripts/copy-harvest.mjs` | Every visitor string on every page and in every state (with a project states module), plus script literals |
| `scripts/copy-lint.mjs` | The content gate: internal, developer, placeholder, stale-date, filler, language-leak, voice and typography rules |
| `scripts/cutout.py` | Real product cutouts: alpha only, pixels proven kept (PSNR), unsuitable photos refused |
| `scripts/imagegen.mjs` | Generated candidates per concept on vendor-neutral routes (Cloudflare free drafts, fal, Gemini, OpenAI, stub); probe, bake-off, references, dry run, budget, ledger |
| `scripts/glrender.mjs` | The free visual layer: render WebGL shaders and Three.js scenes to stills and draft films (SwiftShader, identical on every machine) |
| `scripts/matte.py` | AI matting for hard product photos (rembg + BiRefNet, MIT, CPU): alpha only, pixels proven kept |
| `scripts/film-site.mjs` | Film a live site on a virtual clock: smooth 30 fps footage of WebGL, canvas and CSS motion from a shot list (scroll targets, pointer paths) |
| `scripts/grade.py` | Brand colour grade for approved plates (Lab transfer, ΔE before/after); colour-swatch references |
| `scripts/regions.mjs` | Design critique shots: every region alone, desktop and phone, before and after |
| `scripts/image-review.mjs` | Automatic checks, review sheets, verdicts (Claude or owner), publish approved picks with provenance |
| `scripts/videogen.mjs` | Image-to-video from an approved still (Veo 3.1 or Kling 3.0 via fal, Veo via Gemini); muted web versions and poster to the manifest |
| `scripts/evolve.mjs` | The autonomy loop: catalog diff, draft brands, updates, gates and a report of what needs a person |
| `scripts/shot.mjs` | Screenshot a local file or URL (boards, icon sheets, transparent logos) |
| `scripts/site-qa.mjs` | Site gate: console, overflow at 390 px, reduced motion, keyboard, plus a scenario of real interactions |
| `scripts/lighthouse.mjs` | Lighthouse 12 mobile + desktop on a production-like local server, dated, into `qa/lighthouse.json` |
| `scripts/film-qa.mjs` | Film format, duration, loudness (−14 ±1 LUFS) and true peak; `--fix` re-normalizes only the audio |

Environment notes: Playwright + Chromium, ffmpeg, Python with numpy/scipy/Pillow. Behind a TLS-inspecting
proxy the scripts route browser traffic through Node's fetch (the proxy CA is trusted there); TLS stays on.
A 26 s 1080×1920 film renders in about 5–6 minutes with 4 jobs (measured: 356 s with soundtrack; 4:5 268 s).
