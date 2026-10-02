# 17 · AI UNIFIED: one job, many engines

AI UNIFIED is the lab's flow studio (ailgen-lab.pages.dev, the "זרימות" tab). It joins any of the lab's models (171 paid models
through the AI Gateway credits, plus the free Workers AI models) with inputs, tools and a composer into one job: a launch film from a
brief, an image campaign, a voiced story, a transcription summarised and read back. The owner builds and runs flows on a canvas;
the agent builds and runs the very same flows from the command line. Both see each other's flows and runs.

Use it whenever a deliverable needs more than one engine in sequence or in parallel (text → image → video → voice → music → one
file), when several models should get the same brief side by side, or when a step has to repeat over a list (four directions, four
images). A single call is simpler in the lab's "מודלים בתשלום" tab or with `cloud/lab/unified.mjs call`.

## How it works

| Part | File | Job |
|---|---|---|
| Engine | `lab/unified/engine.js` | Checks a flow, prices it before it runs, runs it level by level, fans lists out (one call per item), reuses pinned or earlier results, stops at a spend cap. No network of its own |
| Requests | `lab/schema.js` | Builds each model's request from its own Cloudflare schema (variants, enums, media fields, the four chat formats); the same code as the paid tab |
| Prices | `lab/price.js` | The price of one call from the price list and the exact input; the server uses it for the budget gate |
| Editor | `lab/unified/ui.js`, `unified.css` | Canvas, library, inspector, run log, outputs, templates, saving |
| Composer | `lab/unified/compose.js` (page), `composeFF` in `cloud/lab/unified.mjs` (agent) | Images and clips in order, voice-over and music, one video file (WebM/MP4 in the page, MP4 from ffmpeg) |
| Server | `cloud/lab/functions/api/flows.js`, `media.js`, `run.js` | Flows and runs in the lab's KV; a model's media through the lab's origin; every model call through `/api/run` (budget, ledger, cost from the gateway's log) |
| Templates | `lab/unified/templates.js` | Ready jobs: `launch-film`, `image-campaign`, `image-shootout`, `voice-story`, `listen-summarize-speak`, `image-to-film`, `free-sketch` |

## The flow format

```json
{ "id": "eden-film", "name": "סרטון השקה · עדן", "about": "…",
  "nodes": [
    { "id": "brief", "type": "input.text", "data": { "text": "…" } },
    { "id": "plan",  "type": "tool.template", "data": { "template": "… Return JSON only … Brief: {{a}}" } },
    { "id": "director", "type": "model", "data": { "model": "anthropic/claude-sonnet-5", "input": { "max_tokens": 1800 } } },
    { "id": "stills", "type": "tool.extract", "data": { "path": "shots[].image", "expect": 3 } },
    { "id": "frames", "type": "model", "data": { "model": "google/nano-banana-2", "input": { "aspect_ratio": "9:16" } } },
    { "id": "film", "type": "tool.compose", "data": { "aspect": "9:16", "musicVolume": 0.22 } },
    { "id": "out", "type": "output" } ],
  "edges": [ { "id": "e1", "from": "brief", "out": "text", "to": "plan", "in": "a" }, … ] }
```

- **Node types**:
  - Inputs: `input.text` (`text`), `input.media` (`kind` image|audio|video, `urls`).
  - `model`: `model` is a catalog id; `input` is the saved request (absent means the model's own Cloudflare example is the base); free models take `system`, `max`, `width`, `height`.
  - Tools:
    - `tool.template`: `{{a}}`–`{{d}}`.
    - `tool.extract`: a JSON path. `scene.prompt` reads one field; `shots[].prompt` returns a list; `shots[0]` takes one item.
    - `tool.split`: lines, a separator, or a JSON array.
    - `tool.join`.
    - `tool.pick`: first, last or index.
  - `tool.compose`: `visuals` (a list of images or clips), `voice`, `music`; `aspect`, `imageSeconds`, `musicVolume`, `fade`, `keepVideoAudio`.
  - `output`.
- **Ports are typed**: text, image, video, audio (and `visual` = image or video). A model's ports come from its schema: its prompts and text fields, its media fields, and one output of its kind. Chat models take `message`, `system` and `image`.
- **Lists fan out.** A list arriving on a single-value port runs the node once per item. Two lists of the same length are paired in order: 3 frames and 3 motions give 3 videos. Ports that take a list (`many`) receive it whole.
- **Links become files when a model needs the file.** A media field whose schema asks for base64 (Veo's `image_input`) gets a link from another model fetched and inlined first.
- **A failed step stops what depends on it.** Nothing after it runs or spends.

## The agent's controls

```bash
node cloud/lab/unified.mjs templates                                   # the ready jobs, priced
node cloud/lab/unified.mjs models --sector video --tier top            # the catalog: id, tier, kind, price, note
node cloud/lab/unified.mjs estimate launch-film --set brief.text="…"   # the plan and its price; nothing runs
node cloud/lab/unified.mjs save launch-film --id eden-film --name "…" --set brief.text="…"   # into the lab, marked [Claude]
node cloud/lab/unified.mjs run eden-film --yes --max-usd 2             # runs; outputs to projects/_unified/out/<flow>-<time>/
node cloud/lab/unified.mjs flows | runs | get <id> | budget            # what the owner and the agent saved and ran
node cloud/lab/unified.mjs call google/nano-banana-2 '{"prompt":"…"}' --yes   # one call
```

- **Access**: `LAB_PASSCODE` in the session's environment, set by the owner in the environment's settings and never pasted into a chat. `LAB_URL` points elsewhere. `--local` talks to `node cloud/dev.mjs serve lab --port 8791 --key test --mock-paid --mock-free`, which runs every flow with nothing spent.
- **From CI, with no passcode in the session**: dispatch the `lab run` workflow (`.github/workflows/lab-run.yml`, GitHub MCP
  `actions_run_trigger` with `command`, `target`, `set`, `input`, `max_usd`), read the job log, and take the outputs from the run's
  artifact `lab-run-<run id>`. It reads `LAB_PASSCODE` from the repository's secrets.
- **Nothing paid runs without `--yes`.**
  - The plan and its price print first.
  - The run stops at `--max-usd` (default 1.5 × the estimate).
  - The lab refuses any call past the owner's budget (402).
- Pinned results are reused: a step already paid for is not paid for again.
- Outputs land in `projects/_unified/out/` (never committed): the composed MP4, the stills, the texts and `run.json`. A deliverable is copied into its project from there.

## Rules

- **Price, then run.** For a run over $1 the agent states the plan and the price before `--yes`. Larger jobs run a cheap draft first: `minimax/h3-max` at 480p or `veo-3.1-fast` at 720p without audio, `nano-banana-2-lite` before `nano-banana-2` or `gpt-image-2.5-sunburst`.
- **Measured models first, from the arsenal.**
  - `node cloud/lab/unified.mjs pick <job>` is the starting choice: the kept models ranked by an independent measurement for that job
    (reference 18). `profile <id>` before committing a flow to a model: its weakness and gotchas often decide.
  - The junk pool stays out of flows (the CLI refuses it without `--junk`, `check` and `run` warn on it); templates use kept models only.
  - A model the lab has measured goes before one it has not (`cloud/lab/notes.json`, the bench, `cloud/lab/arsenal/measured.json`).
  - The result decides.
- **Product pixels are never generated** (reference 12): flows make atmosphere, motion, voice and music, never a client's product.
  At most five generated concepts per site, each approved before publishing, with the visitor-language label where an image could be read as documentary.
- **Every step is honest.**
  - A flow's outputs keep their provenance (model, cost, run key in the lab).
  - A failed step is reported as failed, not hidden behind a fallback.
- **Long jobs are watched.** A video step takes minutes. The CLI prints each node as it finishes, and a stopped run leaves its finished steps reusable: `--set` the next attempt, or pin in the page.
