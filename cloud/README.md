# cloud/ · the server side of every surface

Every surface in `surfaces.json` is static: HTML, CSS and JS, with no build step. A surface that needs a server gets one here.
It is a Cloudflare Pages Function with the Workers AI binding `env.AI`. That binding is the only "key", and it never reaches a page.

| Surface | Routes | What they do |
|---|---|---|
| `edencosmetic` | `POST /api/lotti` | Lotti answers in Hebrew from the shop's own facts (`context.js`, built from the page). On 503 the page falls back to its fixed answers. |
| `ailgen` | `POST /api/brief`, `POST /api/mood` | The studio demo on the public site: a brand brief from a name or an idea, then a first atmosphere image. |
| `lab` | `POST /api/run`, `POST /api/ping` | AILGEN Lab, the private workbench for every free model, behind `LAB_PASSCODE`. |

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
