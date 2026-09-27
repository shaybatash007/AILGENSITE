# Content and honesty

The full method is the user's **levelup2** skill (`references/skills/levelup2.md`): inventory → understand →
audit → plan → build → verify, with a before/after copy deck. This page adds the studio's house rules.

## The copy deck

1. Inventory every visible string per region (headings, body, buttons, labels, empty/success/error states,
   alt text, meta description, agent prompts). For a URL client, start from `intake/content.md`.
2. For each line: clarity · specificity · voice · rhythm · proof · action · language. Rewrite before → after.
3. Apply everywhere the text lives: markup, `DEF` content model, agent prompt and FALLBACK, film.json, ads.

## House style (Hebrew first)

- Open with the visitor's situation, not with the company ("בצהריים של אוגוסט טלוויזיה רגילה נעלמת").
- One idea per sentence. Concrete nouns, numbers with units, verbs of what happens ("שליחה, ונחזור אליכם").
- Plural address ("אתם") for businesses and homes; keep it consistent across site, agent and ads.
- The slogan appears where it lands hardest (hero, CTA, film end), not in every section.
- Cut: empty superlatives ("ברמה הגבוהה ביותר", "חדשני", "מהפכני"), category clichés, the same idea twice.
- Buttons say the outcome ("לתכנן עכשיו", "לייעוץ חינם"), never "שלח" / "לחץ כאן".
- Numbers: the claim's proof sits next to the claim (6,500 NIT next to "ברור כמו לילה").

## Honesty (non-negotiable)

| Situation | Rule |
|---|---|
| Image or video of real work | label **מהשטח** (green dot) |
| Render, AI image, stock | label **הדמיה** (cyan dot); never present it as a project |
| Concept / fictional brand | badge **פרויקט קונספט** on the card, in the case study, and on the site itself |
| Screens with sample data | caption **נתוני הדגמה** |
| Numbers | only measured or stated by the owner; source and date in `brief.md`; Lighthouse with conditions |
| Testimonials | real customer, with permission; first name + initial + place; editable in the admin |
| A simulation (sun test, planner) | say it is a simulation or a rule of thumb, and what it assumes |
| Promises (response time, results) | only if the owner stated them |

The honesty labels are part of the design (a dark pill with a coloured dot), not fine print. They build the
trust the whole site depends on.

## Imagery, in order of preference

1. Real photos and videos the business owns (their work, place, people). Film the site itself for portfolio.
2. Images generated to the brand (palette, light, mood), graded to match, **labeled render**.
3. Imagery drawn in code (SVG, canvas): illustrations born from the logo (AILGEN's house at night, the figure
   with a lantern; VERMEIL's bottles built from layers).
Every image: alt text, correct aspect, lazy below the fold, a poster for every video.

## What only the owner can give (list it, don't fake it)

Real photos of the team/place · permission for each testimonial · prices they will publish · legal texts
(privacy, accessibility, business details) · contacts and hours · logo source files.
