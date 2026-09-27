# Phase 1 · Intake

The goal of intake is a **facts sheet you can defend**: everything the business is, sells, promises and has
proven, with a source next to each item. Nothing downstream may invent what intake did not find.

## Mode A · a URL (existing business)

```bash
node $S/scripts/new-project.mjs --url https://business.co.il [--slug name] [--max 40]
# or only the crawl:
node $S/scripts/intake.mjs https://business.co.il --out projects/<slug>/intake --max 40 --media 80 --delay 800
```

What lands in `intake/`:

| File | Contents | How to use it |
|---|---|---|
| `summary.md` | name, phones, emails, WhatsApp, socials, sampled colours, fonts, logo candidates, page list | first read; copy contacts into `brand.json` |
| `content.md` | every page's text in reading order (headings, paragraphs, lists, buttons) | read **all of it**; it is the raw material of the copy deck |
| `site.json` | structured pages (blocks, images with alt and size, videos, YouTube, JSON-LD), design sample, media manifest | programmatic access; source for numbers and quotes |
| `media/` | largest images, logos (incl. inline SVG), og images, favicon | label each real / render; pick hero candidates |
| `shots/` | home desktop (first screen + full) and mobile | the "before" for the case study |
| `palette.json` | (from new-project) colour suggestion from logo + screenshot | starting point for phase 2 |

The crawler reads the sitemap first, then navigation, then discovered links; it paces itself (`--delay`),
stops politely on 403/429/503, strips speculative prefetch, and blocks service workers so every request is
visible. Behind a proxy it routes browser traffic through Node's fetch with TLS verified.

**If the site blocks the crawler** (firewall, rate limit): wait and retry with `--delay 2500 --max 15`, or ask
the owner for an export (WordPress: Tools → Export; or a zip of the media library). Never try to evade it.

### Reading the intake like a strategist
1. **Offer map**: every product/service, its price if public, its page. Merge duplicates (Switching had 15
   pages saying the same thing; they became 8 full solution pages).
2. **Proof inventory**: numbers with units, warranties, years, project counts, certifications, real footage,
   reviews (who, where). Copy them exactly, with the URL.
3. **Contradictions**: the same FAQ answered two ways, a testimonial repeated three times, prices that differ.
   List them in `brief.md` for the owner; never silently pick one.
4. **Media truth**: for each image decide *real* (their work, their place, their team) or *render/stock*.
   Clues: identical lighting across "projects", AI artifacts (a sparkle watermark in a corner, warped text),
   stock-site file names. When unsure, label it render and ask.
5. **Visitor doubts**: the questions in their FAQ, reviews and blog titles are the objections. Keep the 3–4
   that decide a purchase.

## Mode B · a written concept

The owner describes an idea ("a boutique wine chain that feels like the visit itself"). There is no site to
read, so intake is research and synthesis:
1. Restate the idea in one sentence and list the explicit facts the owner gave.
2. Category scan: 3 competitors or references (web search when the tools allow; otherwise from knowledge,
   marked as such). For each: promise, visual language, what they do badly.
3. Visitor and occasion: who buys, when, what they fear, what would delight them.
4. If there is no name, propose 3 (short, pronounceable in Hebrew and English, domain-checkable), pick one,
   note why. Mark the project **concept** in `brand.json` and on every page.
5. Everything else (products, prices, branches) is fictional **and labeled fictional**, as in VERMEIL.

## Mode C · just a name

1. Search for it. If a real business exists with a site, switch to Mode A. If it exists without a site
   (Instagram, Google Business, Facebook page), collect what is public and treat it as a real client.
2. If nothing exists, it is a concept: derive the business type from the name only if it is obvious;
   otherwise this is the one question to ask ("מה העסק עושה?").
3. AILGEN itself started here: from a name to a studio concept, a slogan, a mark and a site.

## Gate

- [ ] `brief.md` sections 1–3 filled; facts and assumptions separated.
- [ ] Every number, price, quote and testimonial has a source (URL or "owner, date").
- [ ] Every image in `intake/media` used later is labeled real / render / stock.
- [ ] Contradictions listed for the owner.
- [ ] Contacts complete or marked missing (phone, WhatsApp, email, address, hours).
