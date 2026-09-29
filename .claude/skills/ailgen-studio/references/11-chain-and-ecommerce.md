# 11 · The chain check, measurement per element, and online stores

Learned on two builds: Talor Karadi (a link of the chain was skipped and the user had to ask twice) and Eden Cosmetics
(a Shopify store: the first run with the chain check and a meter mark for every element).

## 1. The chain check: nothing is skipped, nothing is silent

`scripts/chain.mjs` holds the list of every element a studio project owes (53 today), the **evidence** that each exists, and
what each one cost. It replaces "I think I did it all" with a table.

```bash
node $S/scripts/chain.mjs --project projects/<slug> --init     # copies templates/chain.json; set the flags by hand
node $S/scripts/chain.mjs --project projects/<slug> --soft     # report while working (never fails)
node $S/scripts/chain.mjs --project projects/<slug>            # the delivery gate: exit 1 while anything is missing
```

- `chain.json` flags: `url` (has an old site), `store` (an online store), `mascot`, `film`, `seoOld` (an old site's SEO to
  inherit), plus `site` (the static export folder) and `camp` (`campaigns/<slug>`). An element whose flag is false is
  listed as *skipped by flag*, with the flag, never dropped quietly.
- Evidence types: `file` (+ `min` bytes), `files`, `json` (+ `path`, `equals`/`minLength`), `contains` (a regex or text in a
  file), `glob` (+ `min` count), `link` (a key in `links.json`: `site`, `studio`, `ailgen`), `meterClosed`, `gitClean`.
- It writes `CHAIN.md` and `chain-report.json` next to the project: element, phase, status, minutes, cost.
- Delivery (phase 8) is not allowed until the chain check exits 0. A missing element is either built or, with the owner's
  word, turned off by a flag and said so in the report.

## 2. Measure every element, not only every phase

Phases hide the expensive part. Give every element its own sub-phase:

```bash
node $S/scripts/meter.mjs --mark projects/<slug>/meter.jsonl --phase 3-site/proof-tool --ev start   # ... and end
```

`phase/element` marks roll up into their phase; `chain.mjs` matches an element's `phase/id` exactly, otherwise the plain phase.
Repeated windows of one sub-phase add up. Open the mark **when you start the element** (a retro-fitted mark is labelled as
reconstructed). Report machine time (crawl, render, Lighthouse) separately from agent time, because it runs in the background.

## 3. Online stores (Shopify and similar)

The store keeps doing what it is good at: the cart, the payment, the account, the tax. The new site is the storefront.

1. **Catalog from the public storefront JSON**, not by scraping pages: `scripts/shopify-catalog.mjs https://store --out projects/<slug>/catalog`.
   It reads `/products.json` and `/collections.json` (with each collection's products), honours robots.txt, waits between
   requests and never touches cart, checkout or account. Prices and stock are a **snapshot with a date**; every page that shows
   them says so, and the price on the store wins.
2. **Cart hand-off with the store's own permalink** `/cart/<variant>:<qty>,<variant>:<qty>` on the store's domain. The site never
   automates payment and never asks for card details.
3. **Keep the URL scheme** (`/products/<handle>`, `/collections/<handle>`, `/pages/…`, `/policies/…`, `/blogs/news`) so the old
   search equity carries over; list the paths that stay on the store (`/cart`, `/checkout`, `/account`, `/agents.md`, `/.well-known/…`)
   in `seo/external.txt` and pass `--external` to `seo-plan`/`seo-run`: they count as covered, and the redirects file never
   shadows them. `--robots-extra` and `--redirects-extra` add the store's own rules.
4. **Product pages are generated** by `seo-pages.mjs` (`product` and `collection` types: Product/Offer/ItemList JSON-LD, one
   unique title and description per product, share card per page). One composer per project (`seo/compose.mjs`) reads the catalog.
5. **Never invent what the store does not say:** reviews, gifts, course dates, specs. An empty collection (courses) becomes a
   waiting list, not a fake schedule. The store's own policy text is the legal text; the owner approves anything added.
6. **Proof tool for a store** is the thing the visitor cannot do on the current site: a kit builder that turns "which kit and what else"
   into a cart in under a minute, with the store's own products and prices, and a real cart link at the end.

## 4. Protected sites (Cloudflare and similar)

Stores often sit behind a bot shield. Crawl once, slowly (`--delay`), from the sitemap; **when a request is challenged, stop
hitting the origin.** Do not rotate agents, do not look for a way around it, do not disable TLS verification. Take the rest of
the assets one request at a time, and record it in `brief.md` ("what the shield did, what we stopped doing"). If something is
missing, ask the owner for an export. The catalog JSON, the sitemap and one crawl of the pages were enough for Eden's 88 URLs.

## 5. Tools added with this chapter

| Tool | Use |
|---|---|
| `scripts/chain.mjs` | The chain check (evidence per element, time and cost per element, exit 1 on a gap) |
| `scripts/shopify-catalog.mjs` | Catalog from a Shopify store's public JSON, images resized by the CDN |
| `scripts/shot.mjs` | Screenshot any local file or URL (brand boards, icon sheets, transparent logo PNGs) |
| `scripts/site-qa.mjs` | Console errors, failed requests, overflow at 390 px, reduced motion, keyboard, plus a scenario of real interactions |
| `scripts/lighthouse.mjs` | Lighthouse 12 mobile and desktop on a production-like local server (gzip, headers, redirects), dated, into `qa/lighthouse.json` |
| `scripts/film-qa.mjs` | Format, duration, audio, loudness (−14 ±1 LUFS) and true peak of every film; `--fix` re-normalizes only the audio |
| `engine/loudness.mjs` | Two-pass linear loudnorm (single pass overshot on Eden's track: −12.6 LUFS, −0.8 dBTP) |

Film engine additions: the `lift` scene and the `curl` motif (lash and beauty), `mascot.reserve` / `reserveWide` / `sayWide` to keep the
character's bubble off the contact lines in every ratio, `fx`/`fy` focal point on the hook image (a 9:16 collage is cropped in 4:5),
`labels` overrides for the honesty chip. Review **all three ratios** at the closing scene before rendering: a layout that works in
9:16 can put the speech bubble over the phone number in 4:5.

## 6. Lessons that cost a re-render

- Read every Hebrew string of `film.json` once as text (`python3` walk) before rendering: a typo in a button cost two renders.
- A synchronous child process inside a process that also serves the test site freezes the server (Lighthouse hung ten minutes).
  Use async `spawn` there, as `seo-run` does.
- Measure loudness with `film-qa.mjs` before calling a film done; a 29 s track can land 1.4 LU too loud in single-pass mode.

## 7. Performance and accessibility lessons (measured on Eden, mobile Lighthouse, simulated slow 4G)

- **Variable fonts were downloaded once per weight.** Google Fonts answers a request for `400;700;900` with three blocks that point at the same
  file, and `fonts.mjs` used to save each one under its own name: 18 faces, 435 KB, first paint 3.2 s, performance 80. It now saves the file once and
  declares a weight range (5 faces, 118 KB, first paint 2.0 s, performance 94). Test the cost of type by measuring a copy with no web fonts:
  if first paint drops by seconds, the fonts are the bottleneck, not the images or the script.
- **Static pages need the same care as the home page:** preload the Hebrew faces (`seo-pages.mjs` does it from `fontsCss`), keep the first row of a
  product grid eager (a lazy first image is flagged as a lazy LCP), give every image its width and height.
- **Label in name (WCAG 2.5.3):** if a control shows text, its `aria-label` must contain that text. Best: no `aria-label` and let the visible text
  name it; when a badge shows a number (the cart count), put the number in the label. A link inside running text needs an underline, not only a color.
- **Measure the launch build, not the preview:** the preview is `noindex` on purpose and fails the "is crawlable" audit. `lighthouse.mjs --launch`
  measures a copy without the preview flag and says so in `lighthouse.json`. Quote mobile and desktop, the date and the conditions.
