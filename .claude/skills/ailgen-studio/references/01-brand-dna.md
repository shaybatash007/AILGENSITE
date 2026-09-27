# Phase 2 · Brand DNA

A brand here is **one idea, repeated with discipline**: a true claim, a signature element born from the logo
or the name, and a small system (palette, type, icons, motion) that carries it everywhere: site loader,
icons, mascot, film motif, ads, favicon.

## 1. Concept, claim, signature

Write these four lines into `brand.json → concept` before any colour is picked:

| Field | Question | Switching TV | AILGEN | VERMEIL |
|---|---|---|---|---|
| idea | What is this brand, as an image? | a screen that stays clear in the sun | a small house with a lit window at night | a gallery where every bottle is art |
| claim | The strongest thing it can **prove** | TV disappears at noon, LED stays sharp (6,500 vs 400–600 NIT) | the site itself is the demo | (concept: "the taste of the moment") |
| signature | The element from the logo that appears everywhere | the TV box: double bezel + one amber pixel + RGB LEDs | the amber square window | the gold seal and gallery light |
| twist | What no default would do | the loader bezel becomes the hero screen | the loader mark streams into particles that land as the hero | the age gate is an opening ceremony |

If the business has a logo, the signature comes from **it** (Switching's TV-box letters). If not, design the
mark around the idea (AILGEN: roof + window = a business awake at 23:40).

## 2. Spirit matrix

Pick the row nearest to the business, then adapt. It sets defaults for every later phase.

| Business type | Spirit | Palette direction | Type direction | Film motif | Mascot | Proof tool | Entry |
|---|---|---|---|---|---|---|---|
| Home tech, installers, devices | bright-tech, trustworthy | light paper + ink + one warm accent + one tech blue | condensed display + clean sans + stencil numbers | `pixels` | yes, an object-character from the logo | planner / physical test (sun test) | the product "powers on" |
| AI, software, agencies | nocturnal, confident | deep navy + one amber | editorial serif display + plex/grotesk sans | `particles` | small, pixel | live agent / live demo | logo from particles |
| Luxury retail, wine, jewellery, fashion | luxury-calm | near-black + one deep colour + gold | high-contrast serif + light sans + Latin italic | `light` | no: a voice (sommelier, stylist) | recommender / configurator | a seal, a door, a curtain |
| Restaurants, cafés, bakeries | warm, sensory | cream + one deep colour + an appetizing accent | friendly serif or hand accent + sans | `ink` | optional (steam, cup) | menu explorer + booking | steam / a plate set down |
| Clinics, health, beauty | calm, reassuring | soft neutrals + one clean hue | humanist sans, generous size | `light` / `iris` | rarely | booking + "what happens in the visit" | a soft breath, never a flash |
| Law, finance, B2B consulting | authoritative, precise | ink + paper + one restrained accent | serif display + neutral sans | `wipe` | no | calculator / eligibility check | typographic, fast |
| Kids, education, leisure | playful | bright, several colours, high contrast | rounded sans (Varela Round, Fredoka, Rubik) | `particles` / `pixels` | yes | quiz / age picker | a bounce, a pop |
| Real estate, architecture, interiors | editorial, spacious | stone neutrals + one metal | serif or refined grotesk, lots of air | `wipe` / `light` | no | project map, plan viewer, filters | a slow reveal of space |
| Fitness, sport | bold, energetic | black + one neon accent | condensed heavy | `wipe` | maybe | plan builder, schedule | a hard cut on the beat |
| Makers, florists, crafts, local shops | handmade, warm | natural palette | hand accent (Gveret Levin, Amatic SC) + sans | `ink` | maybe | product builder (build a bouquet) | a hand-drawn line |
| Industry, manufacturing, logistics | engineered | steel greys + a safety accent | stencil / mono numbers + sans | `pixels` / `wipe` | no | spec configurator, quote builder | a blueprint drawing itself |

## 3. Palette tokens

Use roles, not colour names, so every file (site CSS, `film.json`, ads) speaks the same language:

```
ink        main text and dark grounds        paper    light ground
ink2/mute  secondary and tertiary text       surface  cards on dark grounds
line       hairlines                         accent   ONE colour for the primary action + the signature element
accentInk  text on accent                    accent2  a supporting hue for glows and data
real/render/concept/demo                     honesty label dots (green / cyan / amber / grey)
```

Rules:
- **One accent.** It marks every primary action and the signature element, nothing else.
- Start from the logo: `python3 $S/scripts/palette.py logo.png --k 8` (roles + contrast). For a URL, also
  read `intake/summary.md → button colours`, which are usually the real brand accent.
- Contrast: body text ≥ 4.5:1, large text and UI ≥ 3:1. Fix by moving lightness, never hue. Keep a darker
  "ink" version of the accent for text links (Switching: `sun #F5A524` for fills, `sunInk #8A5300` for text).
- Light or dark ground follows the product truth: Switching is bright **because its screens work in daylight**;
  AILGEN is night **because the business answers at 23:40**.

## 4. Type trio

Display (headlines, the brand's voice) · body (reading) · numbers (specs, prices, counters).
Hebrew-capable Google families, by feel (verify with `fonts.mjs`; it fails loudly when a subset is missing):

| Feel | Display | Body |
|---|---|---|
| editorial, trustworthy | Frank Ruhl Libre, David Libre, Noto Serif Hebrew | IBM Plex Sans Hebrew, Assistant |
| luxury | Bellefair (+ Cormorant Garamond for Latin) | Assistant 300 |
| bold, compact, technical | Karantina, Secular One, Suez One | Heebo, Rubik |
| friendly, rounded | Varela Round, Fredoka, Rubik | Rubik, Assistant |
| handmade | Gveret Levin, Amatic SC (accents only) | Assistant, Heebo |
| neutral | Heebo, Noto Sans Hebrew, Open Sans | same family, lighter weight |

Numbers: a family whose digits carry the brand (Switching: *Big Shoulders Stencil Display*, like the stencil
letters of its logo). Self-host for speed and for the film engine:

```bash
node $S/scripts/fonts.mjs --out projects/<slug>/fonts "Karantina:700" "Heebo:400,500,700,800" "Big Shoulders Stencil Display:800"
```

## 5. Logo

- **Real client**: keep their logo. Extract a clean SVG (`intake/media/logo-inline-*.svg`, or trace a PNG by
  hand as paths), make light/dark versions. Improve only with permission.
- **Concept / own brand**: build the mark on a grid from simple geometry, with the signature element as a
  measured part of it (AILGEN: a 96×100 roof polygon, a 16-unit amber window). Test at 16 px (favicon), 56 px
  (app icon), full screen. Make a construction sheet: grid lines on the real vertices, clear space, versions,
  palette, type (see `assets/ailgen-logo-system.jpg`). Boards are HTML rendered to PNG with Playwright.

## 6. Icon family

One family, drawn for the brand: 24 px grid, one stroke weight (1.6–1.8), one corner/terminal language, and
the **signature element in every icon** (AILGEN and Switching: a small amber square). Ship as an inline
`<svg><symbol id="i-…">` sprite and `<use href="#i-…">`. Keep universally recognised glyphs (phone,
WhatsApp, close) plain where recognition beats originality. For the film, export white and ink versions as
`.svg` files (see `campaigns/switching-tv/source/img/i-*-white.svg`).

## 7. Favicon and small marks

Inline SVG data URI: the mark on the brand ground, readable at 16 px:
`<link rel="icon" href="data:image/svg+xml,%3Csvg …%3E">`.

## Gate

- [ ] `brand.json → concept` has idea, claim (provable), signature, twist.
- [ ] Palette in roles, one accent, contrast checked and noted.
- [ ] Type trio loads with Hebrew + Latin subsets (fonts.css in the project).
- [ ] Logo light/dark SVGs; construction sheet for new marks.
- [ ] Icon family started with the signature element; favicon.
