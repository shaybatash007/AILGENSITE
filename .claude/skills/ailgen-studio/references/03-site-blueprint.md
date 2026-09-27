# Phases 4–5 · Site blueprint and build

Every site is **one HTML file** that works in two places: as a live Claude artifact (database, owner login,
AI, uploads) and as a static site in the repo (everything visual works; data features degrade gracefully).
The reference implementations to read before building: `switching-tv/index.html` (light, product, planner,
advisor, full admin), `index.html` (AILGEN: dark, particles, live agent, portfolio + case studies),
`vermeil/index.html` (luxury concept, no photos, sommelier).

## 1. Architecture

```
<head>  fonts (preconnect + preload as=style + noscript) · favicon (SVG data URI) · one <style>
        inline script: set html.pre before first paint (hides first-screen elements), failsafe timeout
<body>  SVG sprite (<symbol> icons + logo) · loader · header/nav · main sections · footer
        overlays: detail view (#s-id deep links) · reader · lightbox · legal <dialog> · a11y panel
        floating: mascot · a11y button · mobile call bar · owner-only admin button + console
<script>
  DEF        the content model (every editable text, stats, testimonials, FAQ, contacts, toggles)
  C          = DEF merged with db doc "data/site" (live) or fetch('data/site.json') (static)
  data       product/solution/project arrays that are code, not owner-editable
  render     applyContent() → renderStatic() → tools → mascot → entry choreography
  platform   window.claude.use('db' | 'user' | 'sample' | 'assets') when present, else fallbacks
```

**Capabilities** (declare on publish; load the `artifact-capabilities` skill first):
`db` with rules → `(root) read view write admin; data/site read view write admin; data/admin read admin write admin;
leads read admin write admin; leads/{self} read interact write interact`, plus `user`, `sample`, `assets`.

**Leads**: one doc per visitor, `leads/<uid>` with an `items` array (`{id, at, status:'new', note, name, phone,
msg, source: form|planner|ai}`). The admin subscribes to the `leads` collection. **Offline fallback**: when the
DB is missing (static export), the form offers the same message as a prefilled WhatsApp link, never a dead end.

**AI agent/advisor**: `sample(turns, {cache:false, modelTier:'quick', tools:[create_lead], onText})`. The system
prompt lists only facts from the site (offers, specs, prices, FAQ, owner notes) and the rules: answer in
Hebrew, ≤ 4 sentences, never invent prices/specs/clients, ask one focused question, offer the proof tool or
contact, call `create_lead` only with name + phone. **FALLBACK**: a list of regex → answer pairs for the
static site, so the chat still helps without a model.

**Owner admin** (owner only via `user.isOwner`): overview KPIs · leads (status, notes, WhatsApp to client,
delete with confirm, source badge) · content & contacts · testimonials · projects (YouTube id or uploaded real
photo via `assets`) · FAQ · mascot & agent (on/off, greeting, extra knowledge). Every save writes `data/site`.

## 2. Section library (pick by the visitor's doubts)

| Section | Job | Notes |
|---|---|---|
| Hero | claim + proof in 5 s + two entry CTAs (by audience) | real media first; the claim's source under it (Switching quotes the customer who said it) |
| Stats | measured facts | label "business data" and date |
| Film | the launch film in a phone frame | muted autoplay in view, "watch with sound" button, hero link to it, mascot tip |
| Offer grid → detail pages | the full range, each with a complete page | `#s-id` deep links, prev/next, compare table, how to choose, model & price, real projects, FAQ |
| **Proof tool** | answers the main question in < 1 min | planner, physical test, recommender, calculator, live agent (see below) |
| Real work | proof it was done | real footage labeled "מהשטח", lightbox with sound, YouTube cards |
| Why us | 6 differentiators | each with a brand icon and a concrete fact |
| Process | what happens after contact | 3–4 steps, time to result, progress line |
| Testimonials | social proof | real only, editable in admin, name + place |
| FAQ + agent | objections, answered | FAQ feeds the agent's prompt |
| Guides | SEO and expertise | import blog posts from intake; reader overlay; link to original |
| Contact | one easy action | name + phone minimum; WhatsApp; copy phone; address; attach the proof-tool result |
| Footer | trust and law | privacy policy, accessibility statement, credit "עיצוב ופיתוח: AILGEN" |

**Proof tool patterns**: *planner* (3 questions → spec + scale drawing + model + send to WhatsApp) ·
*physical test* (drag the sun, contrast collapses) · *recommender* (dish + mood → one bottle and why) ·
*calculator* (ROI, savings, price range) · *eligibility checker* · *live agent* that books. It must produce a
result the visitor can **send** (prefilled WhatsApp or attached to the form).

## 3. Entry choreography

Born from the logo, honest about loading: wait for `document.fonts` and the hero poster with a short minimum
hold and a hard cap; background of the loader = background of the hero; the loader's mark **becomes** the
hero's main object (Switching: bezel stretches into the hero screen; AILGEN: mark → particles → hero mark).
Then headline lines rise in order, CTAs, nav; floating UI last. Phones: no overlay; the hero powers on in
place (keeps LCP fast). Returning visitors: ≤ 0.8 s version. Reduced motion: instant.

## 4. Accessibility and law (Israel)

- Accessibility menu: larger text, contrast, highlight links, readable font, stop animations (saved), plus an
  accessibility statement (WCAG 2.x AA / IS 5568) reachable from the footer and the menu.
- Privacy policy in plain Hebrew: what is collected (form, agent), why, who processes (AI provider), rights.
- Keyboard: focus visible, traps in dialogs and overlays, Esc closes, focus returns to the trigger.
- Mobile: call/WhatsApp bar after the hero, nothing floating over content, 44 px targets.

## 5. Performance

Lazy video (`data-src` + IntersectionObserver, `preload="none"`, poster first), `content-visibility:auto` on
long sections, fonts preloaded, images sized, canvas paused off-screen. Measure with Lighthouse before quoting.

## 6. Publishing and the static export

- **Artifact**: publish the HTML (it is wrapped automatically). Media either as published files (`files`
  map, e.g. `m/hero.mp4`) or as uploaded assets (`asset: true` → `/_blob/<id>` URLs). Before republishing
  an existing artifact, read its saved source **in full** and apply your edits to that version.
- **Repo export** (`<slug>/index.html`): unwrap the artifact wrapper, keep relative media paths, add static
  fallbacks: content from `data/site.json`, posts from `posts.json`, legal from `legal.json`. Serve with
  `python3 -m http.server` to test (fetch needs http).
- Links between sites are relative in the repo and artifact URLs in the live versions.

## Gate (before levelup)

- [ ] Every section has a job line and removes a named doubt.
- [ ] Proof tool works end to end and produces a sendable result.
- [ ] Admin: every editable text is in `DEF`; leads flow from form, tool and agent.
- [ ] Static export opens without errors; the form falls back to WhatsApp; the agent falls back to FALLBACK.
