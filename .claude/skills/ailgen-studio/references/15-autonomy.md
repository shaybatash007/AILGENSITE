# 15 · Autonomy: the site keeps up with the business

A launched site is not finished. New products, new brands, price and stock changes and new categories should reach the site
without rebuilding it, and without anyone inventing what the business did not say.

## The loop (`scripts/evolve.mjs`, config `projects/<slug>/evolve.json`)

```bash
node .claude/skills/ailgen-studio/scripts/evolve.mjs --project projects/<slug>                   # diff + report only
node .claude/skills/ailgen-studio/scripts/evolve.mjs --project projects/<slug> --fetch --apply   # one polite fetch, update, gates
```

| Change | What happens by itself | What waits for a person |
|---|---|---|
| New, removed or renamed product; price; stock | site data, product/collection/brand pages, sitemap, share cards | nothing |
| A product without a description | shown with its facts and "ask Eden"; listed in the report | the description, from the business |
| A brand the registry does not know | draft record: catalog facts, colours measured from its packaging, a real product cutout, a visual brief | origin and one sentence from the brand's official site, then `status: verified` |
| A new category | pages and nav from the store's collections | the category's one-line description |
| A visual for a new brand | generated only with `--generate` and a key, as a draft, then checked | approval of the pick |
| Every run | copy gate, SEO gates | fixes for anything a gate stops |

The loop keeps the last three catalog snapshots in `catalog/history/` (committed: they are its memory between runs) and writes
`projects/<slug>/evolve/<date>.md`, the report for the owner. It never publishes and never retries a store that blocks it.

## Running it on a schedule

A Claude Code routine (a scheduled session) runs the loop weekly in a fresh cloud session: fetch, apply, gates, review the
changed pages and any generated drafts with the rubrics (12, 13), commit to the working branch, and send the report. It needs
the repository, `GEMINI_API_KEY` only if drafts should be generated, and nothing else: no extra keys for the review, because
the session itself does it. Publishing the live version stays a human "go" (or a routine explicitly allowed to publish).

## Gate

`evolve.json` exists; a baseline snapshot exists; the last report has no failed step.
