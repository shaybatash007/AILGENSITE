# cloud/ · the server side of every surface

Every surface in `surfaces.json` is static: HTML, CSS and JS, with no build step. A surface that needs a server gets one here.
It is a Cloudflare Pages Function with the Workers AI binding `env.AI`. That binding is the only "key", and it never reaches a page.

| Surface | Routes | What they do |
|---|---|---|
| `edencosmetic` | `POST /api/lotti` | Lotti answers in Hebrew from the shop's own facts (`context.js`, built from the page). On 503 the page falls back to its fixed answers. |
| `ailgen` | `POST /api/brief`, `POST /api/mood` | The studio demo on the public site: a brand brief from a name or an idea, then a first atmosphere image. |
| `lab` | `POST /api/run`, `POST /api/ping`, `POST /api/budget` | AILGEN Lab, behind `LAB_PASSCODE`: every free model, the paid catalog through the AI Gateway (`lab/paid.json`), and one budget for both. |

## How it ships

`tools/site-switch.mjs cloudflare` runs in the `pages` workflow. For a surface with `"functions": "cloud/<surface>"`, it deploys
from that folder:

- It writes `wrangler.toml` (project name, the built static folder, `[ai] binding = "AI"`).
- Wrangler compiles `functions/` and uploads it with the static files.
- Secrets listed in the surface's `"secrets"` are copied from the repository secrets to the Pages project first.

While the switch is **off**, no functions ship: the closed worker answers every path.

## Working on a function

```bash
node cloud/dev.mjs call edencosmetic api/lotti '{"messages":[{"role":"user","content":"מה כדאי למתחילה?"}]}'
node cloud/dev.mjs serve ailgen --port 8790            # http://localhost:8790/studio/?cloud=1
node cloud/dev.mjs serve lab --port 8791 --key test    # the lab, passcode "test"
node cloud/context.mjs edencosmetic                    # rebuild Lotti's facts after the catalog or the site changes
node cloud/lab/catalog.mjs                             # refresh the lab's model list (free)
node cloud/lab/catalog-paid.mjs                        # refresh the paid catalog from Cloudflare's model pages (free)
node cloud/dev.mjs serve lab --port 8791 --key test --mock-paid   # the paid tab end to end, with mocked answers, nothing spent
```

`dev.mjs` runs the same function code, with `env.AI` calling the Workers AI REST API. The key comes from the environment's
credential for `api.cloudflare.com`, or from `CLOUDFLARE_API_TOKEN`.

## Rules

- **The page's facts, not the visitor's.** The agent's instructions are built from the page (`context.mjs`), on the server. A
  visitor sends messages, never instructions, a model name or a catalog.
- **Limits on every public route:**
  - same-origin only;
  - a size cap on the input;
  - a per-visitor throttle;
  - `max_tokens`;
  - a fallback when no model answers.
- **Shared allocation.** The free allocation (10,000 neurons a day) is shared by Lotti, the studio demo, the lab and the studio's own
  drafts. On the Free plan, running out means errors until 00:00 UTC, never a bill. The pages then fall back to fixed answers.
- **Measured models only.** A route uses a model the lab has measured for that job (`lab/bench.json`, `cloud/lab/notes.json`).

## The lab's paid catalog

- **Every paid model, end to end.** `cloud/lab/catalog-paid.mjs` reads Cloudflare's own model catalog
  (`developers.cloudflare.com/ai/models/`): every third-party model the gateway bills from the credits, plus the Workers AI models
  that need Workers Paid (the lab's account runs them only from the credits). For each model it keeps the id, the task, the price
  list, the input schema and the page's own examples. It writes `lab/paid.json` (by sector and tier) and `lab/schemas/<slug>.json`.
- **Tiers per sector: top, mid, low.** `cloud/lab/tiers.json` holds the reviewed tier of every model, the reason (`why`), a Hebrew
  note per model, and the order inside a tier. A model Cloudflare adds later falls back to the word rules there (Pro/Max → top,
  Mini/Nano/Lite/Turbo → low) until it is reviewed. A model the lab measured moves by its result.
- **One form per model, from its schema.** The page builds the form from the model's input schema: variants (`oneOf`, e.g. text,
  image or video to video), enums, numbers, media (upload, link, or a result from this session), and the rest under "more
  settings". The four chat formats (OpenAI chat, OpenAI Responses, Anthropic, Gemini) share one chat form with a running thread.
  The exact JSON is shown and can be edited.
- **One price, before and after.** `lab/price.js` computes a call's price from the price list and the exact input (tokens, per
  image, per megapixel, per second by resolution and audio, per clip, per character, per minute, per track). The page shows it
  with its breakdown before a run; the server (`run.js`) uses the same code for the budget gate and as the cost until the
  gateway's log has one. `POST /api/run` with `dry: true` checks the model, the price and the budget without calling anything.
- **Compare.** Up to four models of one sector take one brief; each gets it in its own format (its own first example as the base,
  the brief's values in the fields it calls by those names, at the nearest value its schema allows).

## The lab's budget

- **One pot: prepaid AI Gateway credits (Unified Billing).**
  - Credits cost 5% over face value.
  - Paid models go through the gateway `LAB_GATEWAY`, whose Workers AI billing is set to Unified billing. That covers the gateway catalog (Veo, Nano Banana, GPT, Claude, Gemini, FLUX.2 max, Seedream, ElevenLabs…) and the Workers AI frontier models (Kimi K2.6, GLM-5.2), which need no Workers Paid plan this way.
  - Free models run on the daily allocation. With "continue from the budget" on, they move to the gateway once it is spent.
- **Each paid call is recorded in KV `LEDGER`** (`cloud/lab/ledger.js`), with its cost from the gateway's log (`env.AI.aiGatewayLogId`, `gateway().getLog()`). It falls back to the published price (`lab/paid.json`) when the log has no cost yet.
- **Before a paid call, the lab refuses (402)** when the spending plus the call's estimate would pass the budget. Cloudflare's own caps sit behind it: the credit balance itself (no auto top-up), the account-level spend limit, and gateway spend-limit rules.
- **`site-switch.mjs` creates the namespace on deploy** (`"kv": ["LEDGER"]` in `surfaces.json`). This needs `Account · Workers KV Storage · Edit` on the publishing token; without it the lab runs and shows each call's cost, but keeps no total.
