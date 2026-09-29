# Phase 4b · SEO and internal links (runs inside the site phase, gates the launch)

Search visibility is not a coat of paint added at the end. Two things decide it, and both are decided by how
the site is **built**: (1) which real URLs exist and how they link to each other, (2) what a crawler receives
without running our JavaScript. A beautiful one-page app can throw away years of ranking in a single deploy.

Two situations, one process:

| Situation | Risk | What the process must do |
|---|---|---|
| **Existing site** (a URL was given) | The old pages have earned rankings, links and habits. Every URL that disappears, every guide that is not carried over, is lost equity. | Inventory → keep or 301 every URL → carry the content → prove it before launch. |
| **New business** (idea or name) | Nothing to lose, everything to build: no URLs, no links, no authority. | Build the architecture in from the first commit: one page per thing people search for, linked on purpose. |

## 0. What we can and cannot know
We can measure structure: URLs, titles, headings, links, structured data, what renders without JavaScript.
We **cannot** see rankings, clicks, backlinks or Analytics from outside. So the first ask to the owner, before
building, is an export from Search Console (Performance → Pages and Queries, last 16 months) and, if they have
it, a backlink list. Without it, treat **every** indexed URL as valuable. Never guess which ones are safe to drop.

## 1. Inventory (before design)
```bash
node $S/scripts/seo-audit.mjs https://old-site.co.il --out projects/<slug>/seo/old --max 80 --delay 900
```
Reads robots.txt and every sitemap first (the sitemap is the truth about what the owner wants indexed; intake
alone caps at `--max` pages and once left 22 of 52 sitemap URLs uninventoried), then crawls, with and without
JavaScript. Output: `seo-report.md` (people) and `seo-report.json` (tools): per page status, title, description,
canonical, h1, headings, structured data, words before/after JS, inbound/outbound internal links, depth, orphans.
Read the report like this:
1. **Money pages**: the pages with the most inbound internal links, the guides with long Hebrew slugs (long-tail
   traffic), the service pages. These keep their URL or get a 301 to the exact successor.
2. **Weak spots to fix while rebuilding**: duplicate titles, missing h1, generic titles, orphans, pages without
   structured data, http/www not unified.
3. **The link graph**: which pages carry the site (many inbound), which are buried. The new site must keep the
   important pages at most 2 clicks from home and link every guide to the service it sells.

## 2. URL policy (decided in the blueprint, not at the end)
- **Same URL if it is good.** Do not change a URL that ranks just because the new site prefers other names.
- **One 301 per changed URL**, to the closest equivalent page (never to the home page as a blanket, never a chain,
  never a 302). A page that truly has no successor gets a 410 only after the owner agrees.
- **Real URLs for everything people search for.** Each service, each guide, each location gets its own page with
  its own `<title>`, description, `<h1>` and canonical. A single scrolling page can hold the brand story, but it
  cannot rank for ten different searches. A one-URL build is allowed only for a microsite with nothing to inherit,
  and the report must say so.
- **Hebrew slugs stay Hebrew** (percent-encoded in files, decoded in the address bar). Do not transliterate.
- **Redirects live in the host config**, generated: `node $S/scripts/seo-plan.mjs` writes `_redirects`
  (Cloudflare Pages / Netlify syntax) from the URL map. A claude.ai preview cannot serve redirects; say so.

## 3. What every page carries (the template, not a later pass)
| Element | Rule |
|---|---|
| `<title>` | 30–65 characters, unique, the search phrase first and the brand last. Never just the brand name. |
| description | 70–160 characters, a promise plus a proof, unique. |
| `<h1>` | exactly one, the same idea as the title, visible in the raw HTML. |
| canonical | absolute, self-referencing, on the final production domain. |
| Open Graph / Twitter | title, description, `og:image` **absolute** (relative images fail on WhatsApp/Facebook), `og:url`, `og:locale`. |
| structured data | JSON-LD that matches visible text: `Organization`/`LocalBusiness` (home), `Service`, `Article` (guides), `FAQPage` (only if the questions are on the page), `BreadcrumbList` (inner pages). No invented ratings or reviews. |
| headings | h1 → h2 → h3 in order; no level skipped for styling. |
| images | meaningful `alt` in Hebrew for content images, empty `alt` for decoration; width/height set. |
| links | descriptive anchors ("מאזן פסולת להיתר"), never "לחצו כאן" for an internal link. |

## 4. Internal linking (build it like a plan, then verify it)
- **Hub and spoke.** Home → service pages → guides about that service; every guide links back to its service and
  to the proof tool (calculator, planner); every service links to its 2–3 best guides and to related services.
- **Every page ≥ 3 inbound links, depth ≤ 3 clicks from home, no orphans.** The audit reports all three.
- **Real `<a href>` to real URLs** in the initial HTML. Buttons that only scroll to `#anchors`, or links written
  by JavaScript after load, do not count as internal links for a crawler that does not render.
- **Breadcrumbs** on inner pages (with `BreadcrumbList`), a footer with the full service and guide list, and
  "related" blocks at the end of each guide.
- Keep old anchors where they were natural (the old "המשך קריאה" links become "לקריאת המדריך המלא על X").

## 5. Crawlability and rendering
- The content a crawler needs (h1, intro, body text, links, JSON-LD) must be in the **served HTML**. Client-side
  rendering is fine for interaction (calculators, maps, the mascot), not for the text that should rank. The audit
  compares words with and without JavaScript; under 60% present in raw HTML is a finding.
- `robots.txt` (allows everything public, names the sitemap), `sitemap.xml` (every canonical page, with
  `lastmod`), a real **404 page that returns 404**, HTTPS everywhere, one host (www or apex, the other 301s).
- **Previews are `noindex`** and never canonical to production until launch day: the preview build sets
  `<meta name="robots" content="noindex">`; the launch checklist flips it.
- Performance is part of ranking: measure with Lighthouse (`07-portfolio.md` §4) and keep the numbers.

## 6. Launch and the weeks after
Before switching DNS: staging with `noindex` reachable; `seo-audit.mjs` on staging = zero high findings; every old
URL requested and answered with one 301 (or 200) — `seo-plan.mjs --verify`; sitemap and robots final.
On launch day: remove `noindex`, keep the old Search Console property, submit the sitemap, request indexing for
the top 10 pages, annotate the date in Analytics. For four weeks: watch Coverage (404s, "Crawled – not indexed"),
compare clicks per page against the export from §0, fix redirects that were missed. Expect a dip of a few weeks
even in a clean migration; say so to the owner in advance.

## Gate
- [ ] Search Console export requested (or the owner told we are treating every URL as valuable).
- [ ] `seo/old/seo-report.md` read; money pages and weak spots written into `brief.md`.
- [ ] URL map complete: every old URL is kept, or has exactly one 301, or an owner-approved 410.
- [ ] Every service and guide has its own URL, title, description, h1, canonical, JSON-LD, in the served HTML.
- [ ] `seo-audit.mjs` on the new build: zero **high** findings, no orphans, ≥ 3 inbound per page.
- [ ] sitemap.xml, robots.txt, 404 page, `_redirects` generated and tested; preview is `noindex`.
- [ ] Launch-day and four-week steps given to the owner in the report.
