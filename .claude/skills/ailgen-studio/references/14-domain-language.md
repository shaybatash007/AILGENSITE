# 14 · Domain language: the structure is shared, the expression is not

A visitor must never feel that the site could belong to another business with the logo swapped. The studio reuses its
structure (intake, SEO, proof tool, admin, legal, QA); the expression is derived from the domain and the business, and is
written down per project in `projects/<slug>/design-dna.json` before the first pixel.

## How to derive it

1. **Domain and audience:** what is sold or served, to whom, and what they already know (a lash technician knows brands and
   steps; a first-time home buyer does not know the process).
2. **The feeling the visitor should leave with**, in three words, and the commercial job in one sentence.
3. **The signature born from the logo or the name** (01-brand-dna.md), used in type, icons, motion, film and the guide.
4. **Imagery policy:** which of the six classes the domain needs (12-visual-production.md), and where imagery stays out.
5. **Density:** how much a buyer compares (prices, specs, stock) versus how much they need to be reassured (story, proof).
6. **Motion tempo and voice** (address, register, what is never said).
7. **What this is not:** the two or three neighbouring domains it must not look like.

## The matrix

| Domain | Feels like | Type | Imagery | Density | Motion | Never |
|---|---|---|---|---|---|---|
| Cosmetics, pro beauty supply | an atelier: warm, calm, precise | editorial serif + clean sans | real products on a styled surface, material macros, hands at work (labeled) | compact commerce: price, stock, kit totals | slow, settling | glossy ad clichés, generated results |
| Luxury | restraint, time, material | high-contrast serif, wide tracking | few, large, dark or very light; one object | sparse | very slow, fades | discounts shouting, many colours |
| Real estate | place, light, trust | sturdy sans, clear numbers | architecture and light, real listings only | high: filters, maps, specs | purposeful, map-led | fake renders shown as built |
| Law firm | authority, clarity | classic serif, calm sans | people and places that are real, or none | medium: services, fees logic, steps | minimal | gavels, scales, handshakes |
| Electronics retail | precision, speed, comparison | technical sans, tabular numbers | product on neutral, specs visual | very high: compare tables, filters | fast, functional | lifestyle fluff hiding specs |
| Cybersecurity | calm control, evidence | geometric sans, mono accents | diagrams of real mechanisms, no hooded hackers | medium-high: proof, certifications | precise, systematic | padlocks, binary rain, fear |
| Professional services | competence, method | humanist sans | real team, real work | medium: process, cases | restrained | stock handshakes, skylines |
| Children's brand | warmth, play, safety | rounded sans | bright, illustrated, real kids only with consent | low | bouncy but gentle | adult sarcasm, dark palettes |
| Medical | safety, clarity, empathy | legible sans, large sizes | real staff and places, diagrams | medium: services, access, hours | minimal, never startling | before/after without consent, miracle claims |

The matrix starts the conversation; the business decides the details (Eden: a practitioner's store, not a spa and not a
clinic). Every row keeps the non-negotiables: truth before wow, Hebrew first and correct RTL, accessibility and search.

## Gate

`design-dna.json` exists and names the feeling, the signature, the imagery policy, the density, the motion, the voice and
what the site is not; the first screen, one inner page per type and the shelf of brands (if any) are checked against it at
1440, 1024, 768 and 390 px.
