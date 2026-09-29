# בדיקת השרשרת: edencosmetic

2026-09-29 20:02 · 53 אלמנטים · **16 קיימים** · **37 חסרים** · 0 לא רלוונטיים

## חסרים (חוסמים מסירה)

- **Mascot: name, pixel grid, ≥ 6 faces** (3-mascot): חסר או שבור projects/edencosmetic/mascot/mascot.json
- **Mascot sheet: every state visible** (3-mascot): projects/edencosmetic/mascot/preview*.png: 0 קבצים, נדרשו 1
- **Mascot manners in the site: tips ≤ 6, quiet for a week, reduced motion** (3-mascot): חסר edencosmetic/index.html
- **Blueprint: every section has a job line and a visitor doubt** (4-blueprint): חסר projects/edencosmetic/blueprint.md
- **One crawlable page per service / guide / product / collection** (4b-seo): חסר או שבור projects/edencosmetic/seo/pages.json
- **seo-run.mjs: all gates passed** (4b-seo): חסר projects/edencosmetic/seo/RUN.md
- **Every old URL kept or one 301 (coverage 100%)** (4b-seo): חסר projects/edencosmetic/seo/plan/plan.md
- **Verify gate: every old URL answers correctly** (4b-seo): חסר projects/edencosmetic/seo/verify/verify.md
- **sitemap, robots, _redirects, _headers, llms.txt, 404** (4b-seo): חסר edencosmetic/sitemap.xml; חסר edencosmetic/robots.txt; חסר edencosmetic/_headers; חסר edencosmetic/llms.txt; חסר edencosmetic/404.html
- **A share card for every page** (4b-seo): edencosmetic/og/*.jpg: 0 קבצים, נדרשו 10
- **Static export of the site (index.html + build.sh + src/)** (5-site): חסר edencosmetic/index.html; חסר edencosmetic/build.sh
- **Live preview published (artifact link)** (5-site): אין קישור "site" ב-links.json
- **Proof tool present and answers the main question** (5-site): חסר projects/edencosmetic/blueprint.md
- **Owner control center (leads, content, agent tabs)** (5-site): חסר edencosmetic/index.html
- **AI agent with offline FALLBACK and create_lead** (5-site): חסר edencosmetic/index.html
- **Privacy policy and accessibility statement (pages + dialogs)** (5-site): חסר edencosmetic/legal.json
- **Accessibility menu and skip link** (5-site): חסר edencosmetic/index.html
- **Lead source saved per lead (organic / paid / social / referral / direct)** (5-site): חסר edencosmetic/index.html
- **Store: product pages, collections, cart hand-off to the store's checkout** (5-site): חסר edencosmetic/index.html
- **QA: zero console errors, no overflow at 390 px, keyboard pass (qa/site-qa.json)** (5-site): חסר או שבור projects/edencosmetic/qa/site-qa.json
- **Lighthouse desktop + mobile, dated (qa/lighthouse.json)** (5-site): חסר או שבור projects/edencosmetic/qa/lighthouse.json
- **levelup VERIFY: every region and element ≥ 9 (qa/levelup.md)** (5-site): חסר projects/edencosmetic/qa/levelup.md
- **Signature scene (morph or hand-crafted)** (6-film): ב-projects/edencosmetic/film.json חסר ""type": ?"(morph|signature)""
- **Film 9:16 with soundtrack** (6-film): חסר campaigns/edencosmetic/edencosmetic-film-9x16.mp4
- **Film 4:5 for the feed** (6-film): חסר campaigns/edencosmetic/edencosmetic-film-4x5.mp4
- **Three ad stills + poster** (6-film): חסר campaigns/edencosmetic/ad-feed-4x5.jpg; חסר campaigns/edencosmetic/ad-square-1x1.jpg; חסר campaigns/edencosmetic/ad-story-9x16.jpg; חסר campaigns/edencosmetic/poster.jpg
- **Campaign README: copy A/B/C, headlines, targeting, UTM** (6-film): חסר campaigns/edencosmetic/README.md
- **Loudness −14 LUFS ±1 measured (qa/film-qa.json)** (6-film): חסר או שבור projects/edencosmetic/qa/film-qa.json
- **The film is on the client's site (film section + poster)** (6-film): חסר edencosmetic/m/film-web.mp4; חסר edencosmetic/m/film-poster.jpg
- **Studio: closed real case (flow step with real output)** (7-portfolio): ב-studio/src/3b-flow.js חסר "edencosmetic"
- **Studio artifact republished** (7-portfolio): אין קישור "studio" ב-links.json
- **AILGEN portfolio (repo index.html): card + case** (7-portfolio): ב-index.html חסר "data-case="edencosmetic""
- **AILGEN portfolio (live artifact) updated** (7-portfolio): אין קישור "ailgen" ב-links.json
- **Real screencasts: desktop, mobile, tool, mascot, flow** (7-portfolio): projects/edencosmetic/out/portfolio/*.mp4: 0 קבצים, נדרשו 5
- **Meter: every phase opened and closed, report written** (8-deliver): שלבים פתוחים: 2-brand/palette-board; אין meter-report.json
- **Report to the owner in Hebrew (report.md) with links and what only they can supply** (8-deliver): חסר projects/edencosmetic/report.md
- **Committed and pushed** (8-deliver): 2 קבצים לא מחויבים

## כל האלמנטים, עם זמן ועלות

זמן: `מדוד` = סימון משלו במדידה (`שלב/אלמנט`); `משוער` = חלק שווה מהשלב כולו.

| שלב | אלמנט | מצב | זמן | עלות |
|---|---|---|---|---|
| 0-brief | brief.md: facts sheet with a source for every number | קיים | — | — |
| 0-brief | seo/brief.md: demand, intent, competitors, page inventory | קיים | — | — |
| 1-intake | Intake: every sitemap URL crawled (notCrawled = 0) | קיים | — | — |
| 1-intake | Intake: summary.md and content.md | קיים | — | — |
| 1-intake | Screenshots of the old site (before) | קיים | — | — |
| 1-intake | Store catalog: products, collections, prices, images | קיים | — | — |
| 1-intake | SEO inventory of the old site (seo/old/seo-report.md) | קיים | — | — |
| 1-intake | Every image labelled real / render (media-labels.json) | קיים | — | — |
| 2-brand | brand.json complete: concept, claim, signature, palette, type | קיים | — | — |
| 2-brand | Logo as vector (symbol.svg) and light/dark PNG | קיים | — | — |
| 2-brand | Icon family (≥ 12 SVGs, the signature in each) | קיים | — | — |
| 2-brand | Favicon set: icon.svg, 32 px, apple-touch, 512 px | קיים | — | — |
| 2-brand | Fonts self-hosted (Hebrew + Latin) with fonts.css | קיים | — | — |
| 2-brand | Brand board image | קיים | — | — |
| 2-brand | Contrast checked: text pairs ≥ 4.5 | קיים | — | — |
| 3-mascot | Mascot: name, pixel grid, ≥ 6 faces | **חסר** | — | — |
| 3-mascot | Mascot sheet: every state visible | **חסר** | — | — |
| 3-mascot | Mascot manners in the site: tips ≤ 6, quiet for a week, reduced motion | **חסר** | — | — |
| 4-blueprint | Blueprint: every section has a job line and a visitor doubt | **חסר** | — | — |
| 4b-seo | One crawlable page per service / guide / product / collection | **חסר** | — | — |
| 4b-seo | seo-run.mjs: all gates passed | **חסר** | — | — |
| 4b-seo | Every old URL kept or one 301 (coverage 100%) | **חסר** | — | — |
| 4b-seo | Verify gate: every old URL answers correctly | **חסר** | — | — |
| 4b-seo | sitemap, robots, _redirects, _headers, llms.txt, 404 | **חסר** | — | — |
| 4b-seo | A share card for every page | **חסר** | — | — |
| 5-site | Static export of the site (index.html + build.sh + src/) | **חסר** | — | — |
| 5-site | Live preview published (artifact link) | **חסר** | — | — |
| 5-site | Proof tool present and answers the main question | **חסר** | — | — |
| 5-site | Owner control center (leads, content, agent tabs) | **חסר** | — | — |
| 5-site | AI agent with offline FALLBACK and create_lead | **חסר** | — | — |
| 5-site | Privacy policy and accessibility statement (pages + dialogs) | **חסר** | — | — |
| 5-site | Accessibility menu and skip link | **חסר** | — | — |
| 5-site | Lead source saved per lead (organic / paid / social / referral / direct) | **חסר** | — | — |
| 5-site | Store: product pages, collections, cart hand-off to the store's checkout | **חסר** | — | — |
| 5-site | QA: zero console errors, no overflow at 390 px, keyboard pass (qa/site-qa.json) | **חסר** | — | — |
| 5-site | Lighthouse desktop + mobile, dated (qa/lighthouse.json) | **חסר** | — | — |
| 5-site | levelup VERIFY: every region and element ≥ 9 (qa/levelup.md) | **חסר** | — | — |
| 6-film | film.json filled from the brand and real content | קיים | — | — |
| 6-film | Signature scene (morph or hand-crafted) | **חסר** | — | — |
| 6-film | Film 9:16 with soundtrack | **חסר** | — | — |
| 6-film | Film 4:5 for the feed | **חסר** | — | — |
| 6-film | Three ad stills + poster | **חסר** | — | — |
| 6-film | Campaign README: copy A/B/C, headlines, targeting, UTM | **חסר** | — | — |
| 6-film | Loudness −14 LUFS ±1 measured (qa/film-qa.json) | **חסר** | — | — |
| 6-film | The film is on the client's site (film section + poster) | **חסר** | — | — |
| 7-portfolio | Studio: closed real case (flow step with real output) | **חסר** | — | — |
| 7-portfolio | Studio artifact republished | **חסר** | — | — |
| 7-portfolio | AILGEN portfolio (repo index.html): card + case | **חסר** | — | — |
| 7-portfolio | AILGEN portfolio (live artifact) updated | **חסר** | — | — |
| 7-portfolio | Real screencasts: desktop, mobile, tool, mascot, flow | **חסר** | — | — |
| 8-deliver | Meter: every phase opened and closed, report written | **חסר** | — | — |
| 8-deliver | Report to the owner in Hebrew (report.md) with links and what only they can supply | **חסר** | — | — |
| 8-deliver | Committed and pushed | **חסר** | — | — |

## סיכום לפי שלב

| שלב | אלמנטים | קיימים | זמן | עלות |
|---|---|---|---|---|
| 0-brief | 2 | 2 | — | — |
| 1-intake | 6 | 6 | — | — |
| 2-brand | 7 | 7 | — | — |
| 3-mascot | 3 | 0 | — | — |
| 4-blueprint | 1 | 0 | — | — |
| 4b-seo | 6 | 0 | — | — |
| 5-site | 12 | 0 | — | — |
| 6-film | 8 | 1 | — | — |
| 7-portfolio | 5 | 0 | — | — |
| 8-deliver | 3 | 0 | — | — |
