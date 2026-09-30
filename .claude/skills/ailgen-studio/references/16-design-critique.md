# 16 · Design critique: the first draft is never kept by default

A site that "sits right" is not done. Every region is judged the way a senior designer would judge it before signing,
then rebuilt until it would be signed. This step runs after the first build (phase 5) and again after any redesign, and
its output is part of the deliverable (`projects/<slug>/critique/critique.md` plus before/after shots).

## The loop

1. **Shoot every region alone.** `node scripts/regions.mjs --url <page> --out projects/<slug>/critique/before`
   (desktop 1440 and phone 390, one PNG per region, sticky and floating elements that do not belong to the region hidden).
   Also shoot the inner page types (a product, a brand or service, a guide) the same way.
2. **Score each region 1–10 on six axes**, naming every flaw concretely ("ten purple pads in two columns read as a grid
   and dominate the flat lay", never "could be better"):

   | Axis | 10 looks like |
   |---|---|
   | Hierarchy | one first read, one second read, one action |
   | Typography | a deliberate scale; measure 45–75 characters; no widows; tabular figures for prices and counts; **no letter-spacing on Hebrew** (Latin only) |
   | Composition | one grid; optical alignment; rhythm between sections; nothing floating over content |
   | Imagery | one art direction: same light, same stage, same scale for every product; nothing clipped by accident |
   | Detail | every state designed (hover, focus, active, empty, error, success); micro-interactions with a reason |
   | Distinctiveness | it could only be this business: the signature element appears where it means something, not as decoration on every heading |

3. **For every region below 9, consider at least two alternative directions** and write which one wins and why. The
   first draft competes like any other option; it is kept only when it wins.
4. **Rebuild, then reshoot to `critique/after`**, rescore, and put before/after side by side. Anything still below 9 goes
   back to step 3. Record the scores in `critique.md`.
5. **Lock the promises into QA.** Each decision that could regress becomes a check in the project's `qa/scenario.mjs`
   (Eden: no Hebrew letter-spacing, every product on the same stage, full product names in the kit, the flat lay points
   name a real product and price, one footer link per legal text).

## The eye checklist (the flaws a quick look misses)

- Letter-spaced Hebrew (kickers, footer headings, labels): Hebrew has no capitals; tracking only breaks the word shapes.
- A select or input that clips its own text; a label and a link split across lines inside a flex row.
- Parentheses and numbers inside flex containers (gap pushes "(", the number and ")" apart).
- The same ornament over every heading: it stops meaning anything. Use the signature once, where it tells the story.
- Cards that are generic (icon, heading, paragraph, link): ask what the one number or object is, and lead with it.
- A wall of identical filled buttons in a grid: the action should be clear and quiet until hover or focus.
- Product images from different backgrounds and scales: cut them out (scripts/cutout.py) and put them on one stage;
  white products on white only ever go on a white stage (cutout.py flags them as `whiteOnWhite`).
- Floating helpers (mascot, chat, bars) over the first screen or over content on a phone.
- Copy that still describes the old layout ("four collections" when three are shown).
- Placeholders presented as content (a striped box with an icon is not an image).

## What "wow" means here

Not more effects. A premium page is quieter and more exact: an editorial scale for headings, real objects on a
consistent stage, one signature gesture that carries the brand (Eden: the lash curl written once under "ריסים"), numbers
that read at a glance, and interactions that reward attention (points on the flat lay that name the product and its price,
a receipt that shows what a kit costs before anyone asks). Every region should have one detail worth noticing, and none
should have a detail that fights another.
