# The reference builds

Read the one closest to the new project before starting. Each shows the whole chain from input to output.

## Switching TV · input: a URL (real client)

| | |
|---|---|
| Input | `https://switching.co.il/`: 15 overlapping pages, one testimonial repeated 3×, conflicting FAQ answers, mostly AI renders, real phone videos hidden in the media library |
| Claim | a normal TV disappears at noon; the LED screen stays sharp (6,500 NIT vs 400–600) |
| Concept | "clear as night, even in the August sun" (the customer's own words); a **bright** site because the screens work in daylight |
| Signature | the TV box of the logo: double bezel, one amber pixel, RGB LEDs |
| Entry | the bezel draws, one amber LED lights, a scan line, the bezel stretches into the hero screen playing a reel where every project first appears as LEDs |
| Proof tools | screen planner (place, distance, sun → size, pixel pitch, NIT, IP, model, scale drawing, WhatsApp); sun test (drag the sun, contrast collapses on the TV) |
| Mascot | TIVI, a pixel TV born from the hero screen; faces on its own LEDs; standby red LED when asleep |
| Honesty | every image labeled הדמיה / מהשטח; the sun test says it is a calculated simulation |
| Film | hand-crafted 26 s "sun test" reel (`campaigns/switching-tv/`) + the engine version (`projects/switching-tv/film.json`) |
| Files | site `switching-tv/`, live https://claude.ai/artifact/XWtrx6tuhpq6XUgKioNobo, kit `projects/switching-tv/brand.json` |

## AILGEN · input: a name (own brand)

| | |
|---|---|
| Input | the name "AILGEN" and the idea of an AI and automation studio for small businesses |
| Claim | the site itself is the demo: a live agent, an admin, measured scores |
| Concept | a small house with a lit window at night: a business that answers at 23:40; slogan "קדימה. או מאחור." |
| Signature | the amber square window (16 units on a 96×100 grid) |
| Entry | an honest loader: the roof draws, the window blinks like a cursor; the mark breaks into particles that stream into the hero mark |
| Proof tool | a live AI agent that answers in Hebrew and saves leads; portfolio case studies with real footage |
| Mascot | AILI, born when the amber pixel leaves the logo; carries it as a heart |
| Illustration | a system born from the logo: the house at night, a figure with a lantern, process spots |
| Film | brand reel `brand/ads` + the engine version `projects/ailgen/film.json` (particles, AILI; no quote scene, because there is no real testimonial yet) |
| Files | `index.html`, live https://claude.ai/artifact/KEyTNCaGtF4GhgHZDLPwNk, brand `brand/`, kit `projects/ailgen/brand.json` |

## VERMEIL · input: a written concept

| | |
|---|---|
| Input | "a boutique chain of wine and spirits that feels like the visit to the shop itself" |
| Claim | (concept) "הטעם של הרגע", the taste of the moment |
| Concept | the site is an exhibition: gallery light on the shelf, every bottle shown like a work of art |
| Signature | the gold seal and gallery light |
| Entry | the legal age question becomes an opening ceremony: a gold seal is written, then the door opens |
| Proof tool | a digital sommelier: what's on the table + the mood → one bottle and a sentence why |
| Mascot | none: luxury gets a voice (the sommelier), not a figure |
| Craft | no photos at all: every bottle is drawn in code from layers (glass, cork, label, reflection) |
| Honesty | "פרויקט קונספט" everywhere; names, products, prices, branches are fictional |
| Files | `vermeil/`, live https://claude.ai/artifact/Jfu3ejh3zVcUS3xJKUydcZ, kit `projects/vermeil/brand.json` |

## Talor Karadi · input: a URL (real client, B2B industry, measured run)

| | |
|---|---|
| Input | `https://talorkaradi.co.il/`: WordPress/Elementor, 30 pages, 82 images (mostly real field photos), 5 YouTube videos, a guide with waste-quantity formulas |
| Claim | over 90% of the waste that reaches the plants is recycled; the group holds the whole circle (container → recycling → washing → concrete and shelters) |
| Concept | "המעגל נסגר. מה שיוצא מהאתר, חוזר לבנות." the company's own line: construction waste leaves the site as part of a shelter |
| Signature | the four blades of the logo = the four stages of the circle; the symbol redrawn as a vector from a 1983px image |
| Entry | four blades fly in and lock into the symbol, which flies to the header; the hero symbol is built from four field photos |
| Proof tool | "מאזן פסולת": project type + built area (or demolition volume) → tonnes to declare for the permit, the ±15% band, what returns to building; styled as a weighbridge ticket |
| Mascot | **סבבי**, born from the four blades (first version skipped the mascot; the owner asked for the full chain: every brand gets one unless it truly harms trust) |
| Film | engine, motif `spin`, 29 s; signature `morph` scene: demolition photo → particles → four-blade vortex → clean material → shelter → symbol; סבבי opens ("רגע. זה לא פסולת.") and closes |
| Measured | 33 min of agent work, $10.36, 84 model calls; renders 356 s (9:16) + 268 s (4:5) in the background (`projects/talorkaradi/meter-report.json`) |
| Files | site `talorkaradi/` (src + `build.sh`), kit `projects/talorkaradi/`, campaign `campaigns/talorkaradi/`; live preview https://claude.ai/artifact/7aj1NcY14KNP9ygLgadNYL (with a "preview by AILGEN" banner); the studio shows the whole case as a closed flow: https://claude.ai/artifact/RgdAN2WDjEuDNhiZBMs7td |

## What they share (the method)

One true claim → one signature element from the logo → an entry where the logo **becomes** the hero → a proof
tool that answers the visitor's main question → honest labels on every image → an owner admin → a film that
tells the same story in 26 seconds → a case study that shows the work with real footage and measured numbers.
