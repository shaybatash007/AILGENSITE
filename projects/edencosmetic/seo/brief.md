# SEO brief: עדן קוסמטיקס

- Created: 2026-09-29 · input: url (https://edencosmetic.co.il/)
- Production domain: `https://edencosmetic.co.il` (the same domain; see "Domain decision" below) · language: he-IL · audience/regions: ישראל, מטפלות ומתלמדות בהרמת ריסים וגבות, ולקוחות פרטיות שקונות לעצמן. איסוף עצמי מנתיבות.

> Written **before** the blueprint. The URL list in section 4 becomes the site's pages. See `references/10-seo.md`.

## 0. What this brief is and is not

- There is **no keyword-volume tool and no Search Console export** in this run, and two web searches (US-only search tool, Hebrew queries) returned nothing usable about Israeli competitors. So **no search volumes and no competitor rankings are written here**; every "unknown" below is a real unknown, to be measured after launch.
- The search phrases below come from the one real source we have: **the owner's own product tags and collection names in the store** (`catalog/catalog.json`), which are the Hebrew phrases she expects buyers to type, plus the product titles themselves.

## 1. What people search for (demand and intent)

| Search phrase (Hebrew, as in the store's own tags) | Intent | Who ranks now | Our page that answers it |
|---|---|---|---|
| הרמת ריסים / הרמת גבות | know + buy | unknown (needs SERP check with a local IP) | `/collections/הרמת-ריסים-וגבות` |
| ערכה להרמת ריסים וגבות | compare + buy | unknown | `/guides/ערכה-להרמת-ריסים-וגבות/` (comparison table from the catalog) + the collection |
| סיליקונים להרמת ריסים / סיליקון הרמת גבות | compare + buy | unknown | `/collections/דבקים-סיליקונים` + `/guides/סיליקונים-להרמת-ריסים-מידות/` |
| דבק להרמת ריסים / דבק קודי / ZOLA Lami Balm | buy | unknown | product pages + collection |
| צבע לגבות / צבע לריסים / טויה גבות / RefectoCil | compare + buy | unknown | `/guides/צבע-לריסים-וגבות-מה-יש-בחנות/` + product pages |
| שמפו קצף לריסים / קצף ניקוי | buy | unknown | product pages |
| פינצטה לגבות / מסרק ריסים / מוט הרמה | buy | unknown | `/collections/מוצרים-נלווים` + product pages |
| קורסים להרמת ריסים / השתלמויות | know + local | unknown | `/collections/קורסים-והשתלמויות` (waiting list, no invented courses) |
| brand + product (THUYA, My lamination, NIKK MOLE, ZOLA, Kodi) | buy | unknown | `/brands/<brand>/` hubs (from real product names) |

Intent decides the page type: *buy* → product/collection page with price and availability; *compare* → a table built from the catalog; *know* → short guide that only carries facts the store already states.

## 2. What the business can say better than anyone (proof)

- The real catalog: **71 products, ₪8–₪420, 61 in stock**, seven brands named in the titles (dated 29.9.2026).
- Real product facts already written by the owner: volumes, shelf life after opening, "לשימוש מקצועי בלבד", "תוצרת איטליה", "מכיל חינה שחורה/PPD", the three steps of the My lamination system with application times.
- Real policies: free shipping over ₪499, 4–5 business days, pickup from Netivot, 14-day returns with the 7% fee, the store keeps Shabbat.
- The owner: Eden Nahmani trains and treats (her own words).
- **Nothing else.** No reviews (none exist), no "best price", no medical claims.

## 3. Competitors (3–5)

| Site | Strongest pages | Gap we can fill |
|---|---|---|
| **unknown, not researched** | | The measurable gap is on our own side: see section 5 (what the old site loses). Competitor SERP review is a launch-week task with a local IP and Search Console access. |

## 4. Page inventory (one URL per thing people search)

Shopify's URL scheme is **kept exactly** so nothing indexed is lost: `/products/<handle>`, `/collections/<handle>`, `/pages/<handle>`, `/policies/<slug>`, `/blogs/news`.

| URL (decoded) | Type | Count | Notes |
|---|---|---|---|
| `/` | home | 1 | the app; SEO head + static links + JSON-LD (Store, WebSite) |
| `/products/<handle>/` | product | 71 | Product + Offer JSON-LD from the catalog (price, availability, sku), real images, real description word for word, related by shared tags, breadcrumb, buy button → store cart, question button → WhatsApp. **No AggregateRating.** |
| `/collections/הרמת-ריסים-וגבות`, `/collections/דבקים-סיליקונים`, `/collections/מוצרים-נלווים`, `/collections/הנבחרת-שלנו`, `/collections/כל-המוצרים` | collection | 5 | grid with price/availability, intro sentence, ItemList JSON-LD |
| `/collections/קורסים-והשתלמויות` | collection (empty) | 1 | kept (it is in the sitemap), honest: no courses published yet; waiting list form |
| `/collections/all`, `/collections/frontpage` | duplicates | 2 | 301 → `/collections/כל-המוצרים` and → `/collections/הנבחרת-שלנו` (Shopify system collections; the frontpage collection is the store's "our selection" list of 4, not the home page) |
| `/pages/contact`, `/pages/הצהרת-נגישות` | page | 2 | kept |
| `/policies/shipping-policy`, `/policies/refund-policy`, `/policies/privacy-policy`, `/policies/terms-of-service`, `/policies/contact-information` | policy | 5 | the store's own policy texts, word for word |
| `/blogs/news` | hub | 1 | kept; lists the guides |
| `/guides/…` | guide | 3 | data-driven guides (see below), **draft for Eden's approval** |
| `/brands/…` | hub | 5 | THUYA, My lamination, NIKK MOLE, ZOLA, RefectoCil (brands with ≥ 2 products) |

New guides (each links to the collection it leads to and to the kit builder; content = catalog data + facts the store states):
1. `/guides/ערכה-להרמת-ריסים-וגבות/`: the store's kits side by side (price, contents as written, brand), and what is sold separately.
2. `/guides/סיליקונים-להרמת-ריסים-מידות/`: the silicone pad lines (shapes, number of sizes as written in each product, price).
3. `/guides/צבע-לריסים-וגבות-מה-יש-בחנות/`: tints and developers in stock, by brand, price, shelf life as written.

- Every guide links to 2–3 collections/products and to the kit builder; each collection links to its best guides.
- One phrase, one page: the three guides do not compete with the collections because each is a *comparison*, the collections are the *buy* pages.

## 5. Existing site (URL mode)

- [x] `seo/old/seo-report.md` read. What it found (29.9.2026, 88 pages): **84 high, 102 medium, 108 low**. The concrete ones:
  - **71 broken internal links**: every product page links to `/products/<span class='notranslate'>{{ link }}</span>` (a theme/translation template bug that leaks into the HTML) and returns 404.
  - **12 orphan products**: nothing links to them.
  - **Home h1 empty in the HTML as sent** (filled by JavaScript).
  - 64 pages where about half of the words exist only after JavaScript runs.
  - 25 pages with no meta description.
  - Sitemap incomplete: `/policies/*` and `/collections/all` are missing from it.
- [ ] Search Console export requested (Pages + Queries, 16 months): `seo/inputs/` **(owner-only)**.
- [x] URL policy: keep every URL (`seo/plan/url-map.csv`); the two Shopify system collections get one 301; nothing is 410.
- **Domain decision (owner-only):** the store keeps checkout on Shopify. The new front can (a) run on the same domain with Shopify as the origin for `/cart`, `/checkout`, `/account`, `/agents.md`, `/.well-known/ucp`, `/api/ucp/mcp`, or (b) run on a sub-domain during a trial. The plan keeps those paths on Shopify and lists them in `launch.md`.

## 6. Local and entity facts (only verified)

Name: עדן קוסמטיקס / Eden Cosmetics · owner: עדן נחמני · phone/WhatsApp 052-545-3602 · email Edencosmetics29@gmail.com · pickup: נתיבות, בתיאום מראש · Instagram edennahmani1. **No street address is published**; none is invented. No Google Business Profile status known. Reviews: none exist.

## 7. Measurement

- [ ] Search Console + one privacy-friendly analytics installed on launch; events: kit builder completed, add to cart, hand-off to store cart, WhatsApp tap, form.
- [x] Lead source is saved with every lead (organic / paid / social / referral / direct + landing page) in the site.
- [ ] Baseline date and the four-week review in `seo/plan/launch.md`.
