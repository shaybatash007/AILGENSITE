# 13 · The content-quality layer

Every word a visitor can meet is part of the design. The layer has three parts: a harvest that finds every string, a lint
that catches what never belongs on a page, and a review that judges what a rule cannot. It runs on every build and in the
autonomy loop, and it is the same for every project; the voice and vocabulary are per project (`copy-rules.json`).

## 1 · Harvest: every string, every state

`node copy-harvest.mjs --site <folder> --out projects/<slug>/qa/copy --states projects/<slug>/qa/copy-states.mjs --js "src/3-data.js,src/4*.js"`

- Renders every page in the sitemap plus 404, desktop and mobile, and collects visible text, hidden-but-reachable text
  (closed dialogs, collapsed details, drawers, noscript), `alt`, `aria-label`, `title`, `placeholder`, the document title,
  meta description and share texts.
- The project's states module drives the page through every dynamic state (the proof tool's options, empty and full cart,
  quick view in and out of stock, each suggested question to the agent, validation messages, the mobile drawer).
- Hebrew string literals in the site's scripts are added too: tips, answers and errors that appear only after an action.
- Owner-only screens (`#adm`, `[data-copy-skip]`) are left out: they are not visitor copy.

## 2 · Lint: what must never reach a visitor

`node copy-lint.mjs --in …/strings.json --rules projects/<slug>/copy-rules.json --gate`

| Severity | Rule | Catches |
|---|---|---|
| high | internal | production and provenance language: preview, snapshot, "from the existing site", demo data, draft, "by the name in the catalog", render/concept/field labels, "prepared by" |
| high | placeholder | lorem, TODO, TBD, `[text]`, `@@` markers |
| high | dev | undefined, null, NaN, `${`, `=>`, JSON, API, artifact, Claude, noindex |
| medium | stale-date | a hard-coded date in visitor copy (live data is refreshed by the loop, not dated) |
| medium | filler | claims nobody can check and AI tells: "wide range", "uncompromising quality", "the best", "in today's world" |
| medium | english-leak | Latin words inside Hebrew copy that are not brand names or units (`latinAllowed`) |
| medium | voice | plural or masculine imperatives when the project speaks to one woman; actions named with an infinitive or a noun |
| low | typography | Hebrew glued to Latin, space before punctuation, non-standard spelling |

Hebrew needs explicit word edges: JavaScript's `\b` is ASCII-only even with the `u` flag, so the rules use lookarounds.
The gate passes at 0 high and 0 medium (project limits in `copy-rules.json → gate`). Exceptions are exact strings in
`allow` (for example the owner's own words, quoted as hers) and are reviewed like any other change.

## 3 · Review: judgement, with a rubric

Rules find leaks; people read meaning. After each content change, read the harvested strings grouped by page and state,
and fix what fails any of these:

1. **Purpose:** does this sentence remove a visitor's doubt or move them to act? If neither, cut it.
2. **Truth:** every number, price, origin and claim has a source (the catalog, the brand's official site, the owner's text).
   Uncertain facts stay out; they are not softened.
3. **Voice:** the project's address (for Eden: one woman, "את"), plain words, numbers instead of adjectives, no superlatives.
4. **Hierarchy:** headline says what, subline says why, action says what happens next. One idea per sentence.
5. **Consistency:** one term per thing (סל, not עגלה and סל; בונה הערכה everywhere), one format per number (₪65 עד ₪330).
6. **Context:** microcopy matches its moment (empty states offer a next step; errors say how to fix, never blame).
7. **Culture and language:** natural Hebrew, correct RTL for numbers and Latin (bdi), gender agreement, no translated idioms.
8. **Nothing internal:** where a text or image came from belongs in the project files, never on the page.

Product titles and descriptions are the business's own words: the site fixes typography only (spaces between Hebrew and
Latin, standard spelling, dashes) and never writes a description that the business did not.

## Measured on Eden (2026-09-30)

Before: 1,014 strings, 25 high, 41 medium, 55 low (preview bar, "price snapshot", "by product name in the catalog", "photo
from the existing site", drafts, dates, a plural call to action). After: see `projects/edencosmetic/qa/copy/lint.json`.
