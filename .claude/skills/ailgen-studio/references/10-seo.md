# Phase 4b · SEO, internal links and search visibility

A first-class phase, not a finishing pass. It starts on day one (`seo/brief.md`, or the inventory of an existing site),
shapes the blueprint (which URLs exist), is built into the templates, runs as one command with gates
(`scripts/seo-run.mjs`), and is proven on the real host before launch (`scripts/seo-verify.mjs`).

## Why it decides the outcome
1. **Search is the acquisition that compounds.** Ads stop when the budget stops; a page that answers a real question keeps
   bringing people for years, at no cost per visit. For a contractor, "אישור הטמנה לטופס 4" or "מכולה לפינוי פסולת מחיר" is
   typed by someone who needs the service this week.
2. **What the old site earned is an asset, and a rebuild can destroy it in one deploy.** Talor Karadi's old site had 52 sitemap
   URLs, 21 guides of 800–2,000 words with structured data. The first build was one URL: every one of them would have returned
   404, and the rankings, links and habits attached to them would have gone. This is the most expensive mistake a redesign makes,
   and it is invisible in a demo.
3. **The decisions are architectural, so they cannot be added later.** Which URLs exist, how they link, and what is in the HTML
   the server sends are decided when the site is designed. Retrofitting means rebuilding.
4. **Everything else depends on it.** Search engines, AI answer engines, WhatsApp and Facebook previews, screen readers and slow
   phones all read the same thing: real pages, clear headings, honest structured data, fast HTML.
5. **It makes the client's money visible.** With lead source saved per lead, the owner sees what search, each page and each
   campaign actually brought in.

Honest limits: nobody can promise a ranking; results take weeks or months; what we can guarantee is that the site does not
lose what it had, is built to be found, and is measured. We also cannot see rankings, clicks or backlinks from outside: those live in the
owner's Search Console and Analytics (§0).

## Two situations, one process
| Situation | Risk | What the process does |
|---|---|---|
| **Existing site** (URL given) | Every URL that disappears, every guide not carried over, is lost equity. | Inventory (`seo-audit`) → keep or 301 every URL (`seo-plan`) → carry the content and its structured data → prove it (`seo-verify`). |
| **New business** (idea or name) | Nothing to lose, everything to build: no URLs, links, authority. | Research demand and intent → page inventory before design → hub-and-spoke architecture → all technical files from the first commit. |

## 0. What we can and cannot know
We can measure structure: URLs, titles, headings, links, structured data, what renders without JavaScript, speed. We **cannot**
see rankings, clicks, backlinks or Analytics from outside. First ask to the owner, before building: a Search Console export
(Performance → Pages and Queries, last 16 months; save in `seo/inputs/`) and any backlink list. Without it, treat **every**
indexed URL as valuable. Never guess which are safe to drop.

## 1. Research (always; the core of a new-business build) → `seo/brief.md`
`templates/seo-brief.md` is created by `new-project.mjs`. Fill it **before** the site blueprint:
- **Demand and intent**: the phrases people type (from web search results, related searches and "people also ask", the
  owner's sales calls, WhatsApp questions), each with an intent (know / compare / buy / local). Never invent volumes.
- **Competitors** (3–5): their strongest pages and the gap we can fill (depth, proof, a tool, speed).
- **Page inventory**: one URL per thing people search, with title, description and its links. No page without a search
  phrase, no phrase without a page, one phrase per page (no cannibalisation; the audit flags near-identical titles).
- Intent decides the page: *know* → guide, *compare* → comparison table, *buy/quote* → service page with the proof tool, *local* → place page.

## 2. Inventory the inherited site (before design)
```bash
node $S/scripts/seo-audit.mjs https://old-site.co.il --out projects/<slug>/seo/old --max 80 --delay 900
```
(`new-project.mjs --url` runs it for you.) It reads robots.txt and every sitemap first (the sitemap is what the owner asked
Google to index; intake alone once stopped at 30 pages and left 22 of 52 URLs uninventoried), then crawls with and without
JavaScript. Report: per page status, title, description, canonical, h1, headings, structured data (and whether it is valid), words before/after JS,
inbound/outbound links, contextual links (inside content, not menus), depth, orphans; site level: robots, sitemap coverage,
redirects, 404 behaviour, duplicates, near-duplicate titles. Read it as:
1. **Money pages**: guides with long Hebrew slugs (long-tail traffic), service pages, hubs. They keep their URL or get the exact successor.
2. **Weak spots to fix while rebuilding**: duplicate titles, missing descriptions, canonical duplicates, orphans, http/www not unified.
3. **The link graph**: which pages carry the site, which are buried. The new site must be at least as connected.

## 3. URL policy (decided in the blueprint)
- **Same URL if it is good.** Do not rename a URL that ranks because the new site prefers other names (Talor keeps `/sevices/…`).
- **One 301 per changed URL**, to the closest equivalent (never a blanket redirect to the home page, never a chain, never a 302).
  Duplicates, archives, temporary pages get their successor; a page with none gets 410 only with the owner's approval.
- **Real URLs for everything people search for.** A one-URL build is allowed only for a microsite with nothing to inherit,
  and the report must say so. Hebrew slugs stay Hebrew.
- `seo-plan.mjs` produces `url-map.csv/json`, `_redirects` (Cloudflare Pages / Netlify), and refuses to leave a redirect
  pointing at a page that does not exist. A claude.ai preview cannot serve redirects: say so.

## 4. What every page carries (in the template, not a later pass)
| Element | Rule |
|---|---|
| `<title>` | 30–65 characters, unique, phrase first and brand last. Never just the brand. |
| description | 70–160 characters, a promise plus a proof, unique. |
| `<h1>` | exactly one, with text **in the served HTML**. |
| canonical | absolute, self-referencing, on the production domain. |
| Open Graph / Twitter | title, description, absolute `og:image` **per page** (`seo-og.mjs`: a 1200×630 card with the page's headline and a real photo), size and alt. |
| structured data | JSON-LD that matches visible text (§8). |
| headings | h1 → h2 → h3 in order, none skipped for styling. |
| images | Hebrew `alt` for content images, `width`/`height` always, real photos labelled ("מהשטח"), hero preloaded. |
| links | descriptive anchors, never "לחצו כאן" for an internal link. |

## 5. Internal linking (planned, then verified)
- **Hub and spoke**: home → hubs (`/services/`, `/blog/`) → children; every guide links to its service and to the proof tool;
  every service links to its 2–3 best guides and related services; "עוד בנושא" block on every page (`seo-pages.mjs` computes it from titles).
- **Contextual links, not only menus**: in-body links from a phrase list (`autolinks`, first mention, once per page, max 4),
  hub pages that link onward, the home page linking to top guides. The audit reports pages linked only from menus/footer.
- **Every page ≥ 3 inbound, depth ≤ 3 clicks, no orphans**; real `<a href>` in the initial HTML; breadcrumbs with `BreadcrumbList`; a footer map of all services and guides.

## 6. Crawlability and rendering
- The text a crawler needs (h1, intro, body, links, JSON-LD) is in the **served HTML**. Client-side rendering is for interaction
  (calculators, maps, the mascot), not for text that should rank. Static first paint of the hero, FAQ and service list, replaced by the app with the same text
  (owner edits in the control center still win). The audit compares raw vs rendered words and flags an h1 that is empty before JavaScript.
- `robots.txt` (names the sitemap), `sitemap.xml` (every canonical page, `lastmod`), a real **404 page that returns 404**
  (`404.html`), HTTPS, one host (www or apex; the other 301s).
- **Previews are `noindex`** and their canonical points to the production domain; launch day flips it (`--launch`).

## 7. Images and social cards
Photos as WebP with dimensions; the hero of every page preloaded; alt text that describes the picture; no image text that carries the keyword. Every page gets a
generated share card (WhatsApp/Facebook/LinkedIn preview) so a shared link shows its own headline; Israeli B2B leads travel through shared links.

## 8. Structured data (the rule: it must match what the visitor sees)
| Page | Types |
|---|---|
| home | `Organization` (name, url, logo, sameAs, contactPoint, foundingDate), `WebSite`, `WebPage`, `ItemList` of services, `FAQPage` if the questions are on the page |
| service | `Service` (provider, areaServed), `BreadcrumbList` |
| guide | `Article` (headline, image, dates, author, publisher), `BreadcrumbList`, `FAQPage` only with the questions visible |
| hub | `CollectionPage` + `hasPart` |
| place (verified data only) | `LocalBusiness`/`Place` with address, geo, hours |
No invented ratings, reviews, prices or coordinates. `seo-audit.mjs` validates required fields, breadcrumb positions, and that every FAQ question appears in the visible text.

## 9. Local and entity SEO (when the business has places or serves an area)
Same legal name, address and phone everywhere (site, schema, Google Business Profile, social); one page per real facility **only when there is enough true content**
(a thin page per branch hurts); a Business Profile claimed by the owner; service area stated in words on the page; reviews only real, only where the platform allows.

## 10. AI answer engines
Lead with the answer (a sentence, then the detail), keep FAQ blocks honest, tables for comparisons, the entity described the same way across pages, `sameAs` links,
and a `llms.txt` (title, one-paragraph summary, the pages that answer questions), generated by `seo-plan.mjs`. `robots.txt` allows crawlers by default; blocking AI crawlers is the owner's decision.

## 11. Performance, security, headers
Lighthouse on the served build (`07-portfolio.md` §4): mobile ≥ 90 performance, 100 accessibility. `seo-plan.mjs` writes `_headers`
(nosniff, referrer policy, frame policy, cache lifetimes; HSTS from launch). Fonts self-hosted and inlined; nothing render-blocking; no layout shift from banners or images.

## 12. Measurement
- **Lead attribution built in**: every lead saves where it came from (organic / paid / social / referral / direct), the landing page, and campaign parameters (first touch, 30 days); content-page calls to action carry `?from=<page>`; the control center shows the source per lead and a summary.
  The privacy text says so.
- Search Console + Analytics (or Plausible) installed on launch, events for form, calculator, phone tap and WhatsApp; UTM on every ad link (`campaigns/*/README.md`).

## 13. The pipeline (run after every change)
```bash
node $S/scripts/seo-run.mjs --project projects/<slug>            # preview: noindex, gates on
node $S/scripts/seo-run.mjs --project projects/<slug> --launch   # launch: index, HSTS, indexable-only sitemap
```
Steps: old-site audit → compose (per project) → social cards → pages + 404 → build → plan (`url-map`, `_redirects`, `sitemap.xml`, `robots.txt`, `_headers`, `llms.txt`,
`launch.md`) → serve like production (`seo-serve.mjs`: applies `_redirects`, `_headers`, `404.html`) → **audit gate** (no high findings) → **verify gate** (every old URL: 200 or one 301 to its successor, real h1/title/canonical). Output: `seo/RUN.md`.
Config: `seo/seo.config.json`. The per-project composer builds `pages.json` from intake + site data (see `projects/talorkaradi/seo/compose.mjs`).

## 14. Launch and the weeks after (`seo/plan/launch.md` is generated with your numbers)
Before DNS: staging passes `seo-verify` on the real host (Hebrew paths in `_redirects` behave differently per host); mail records copied. Launch day: remove noindex, verify the live host,
submit the sitemap, request indexing for the ten richest pages, keep the old Search Console property, annotate analytics. Weeks 1–4: coverage errors, indexed vs sitemap, clicks per page against the export from §0, redirects that were missed.
A dip of a few weeks is normal even in a clean migration; tell the owner before it happens.

## Gate
- [ ] `seo/brief.md` filled (demand, intent, competitors, page inventory) or `seo/old/seo-report.md` read; Search Console export requested.
- [ ] URL map complete: every old URL kept, or one 301, or an approved 410 (`seo-plan` coverage 100%, targets exist).
- [ ] Every service and guide: own URL, unique title and description, one h1, canonical, valid JSON-LD, all in the served HTML; content ≥ 100% of the old body text.
- [ ] `seo-run.mjs` green: audit gate (0 high, no orphans, ≥ 3 inbound per page) and verify gate (all old URLs).
- [ ] sitemap.xml, robots.txt, `_redirects`, `_headers`, `llms.txt`, `404.html`, per-page share cards present; preview `noindex`.
- [ ] Lead source saved and visible in the control center; privacy text mentions it.
- [ ] `launch.md` and the four-week watch list handed to the owner in the report.

## Tools
| Tool | Job |
|---|---|
| `seo-audit.mjs` | Audit any site (old, staging, local): site files, per-page head, structured data validity, words before/after JS, link graph, orphans, cannibalisation; `--gate` |
| `seo-plan.mjs` | URL map, `_redirects`, sitemap, robots, `_headers`, `llms.txt`, `launch.md` |
| `seo-pages.mjs` | Crawlable pages, 404, breadcrumbs, related, auto-links, tables, FAQ, JSON-LD from a composed config |
| `seo-og.mjs` | 1200×630 share card per page |
| `seo-serve.mjs` | Static server that behaves like the host (`_redirects`, `_headers`, 404) |
| `seo-verify.mjs` | Every old URL on a host: single 301 → 200, real HTML head; exit code for gating |
| `seo-run.mjs` | All of the above in order, with gates |
| `seo-lib.mjs` | Shared helpers (title tokens, crawled blocks → clean article content, tables, quotes) |
