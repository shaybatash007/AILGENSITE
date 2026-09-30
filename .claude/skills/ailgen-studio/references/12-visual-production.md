# 12 · The visual system: generated imagery and video, under control

Generated images are a production tool, not decoration. Every image has a job, a place and hard limits, and nothing reaches
a site without passing automatic checks and a review. The system is the same for every project; the concepts are not.

## The laws

1. **Product pixels are never generated.** Product imagery is the business's own photos. On a composed stage, a product is a
   cutout made by `scripts/cutout.py`, which only adds an alpha channel and proves it: the product region is compared with the
   store photo (PSNR ≥ 32 dB; compression stays above it, any repaint falls far below). A white product on a white photo that
   the flood fill cannot separate is rejected and not used (`visual/cutouts.json`, `review`).
2. **Generated images carry no product, packaging, logo, text, face, eye or treatment result.** Results must be real photos of
   real work. A generated person can pass as the owner, a client or a student, so people appear only as cropped hands, and
   that image is labeled for visitors ("תמונת אווירה").
3. **At most five concepts per site** (`projects/<slug>/visual/concepts.json`). A concept can serve several placements and
   ratios; a sixth idea replaces one of the five or waits.
4. **Six classes, strictness rising with specificity:** atmospheric → editorial → lifestyle → product-supporting → brand-
   supporting → product. The last one is never generated. Brand-supporting images use only the colours measured from the
   brand's real packaging (`brands.json → look`), never its logo, packaging or claims.
5. **Place by job, not by space.** Imagery goes where it improves the first impression, the story or brand perception. The
   shop grid, the proof tool, the cart and the forms stay clean. A site with no approved images is complete; slots render
   only when an approved asset exists (no placeholders).
6. **Honest to visitors, in visitor language.** Abstract plates need no caption. An image that could be read as documentary
   (hands at work) carries "תמונת אווירה". When any generated image is shown, the footer adds one plain sentence
   (concepts.json → `disclosure`). Provenance (provider, model, prompt hash, review) lives in `img/v/manifest.json`, and
   Gemini/Veo output carries SynthID.

## The pipeline (scripts)

| Step | Command | Gate |
|---|---|---|
| Product cutouts | `python3 cutout.py --in photo.jpg --out img/cut/x.webp --manifest visual/cutouts.json` | pixels kept (PSNR); look at every cutout on a light and a dark background |
| Check the key | `node imagegen.mjs --project projects/<slug> --probe` | the routed models are listed |
| See the requests | `node imagegen.mjs --project … --concept all --dry` | prompts read right; cost estimate within budget |
| Generate | `node imagegen.mjs --project … --concept atelier --tier draft` then `--tier final` | budget cap (concepts.json `budgetUsd`), ledger.jsonl |
| Check | `node image-review.mjs --project … --check` | ratio ±2%, not flat, palette ΔE ≤ 28, no neon, never a stub |
| Review | `node image-review.mjs --project … --sheet` → look at `visual/review/*.jpg` | the rubric below, verdict per file |
| Approve | `node image-review.mjs --project … --verdict <file> approve --why "…" --pick [--by owner]` | only passing candidates can be approved |
| Publish | `node image-review.mjs --project … --publish --site <folder>` | WebP 640/1280/1920 + manifest with provenance |
| Video | `node videogen.mjs --project … --concept atelier` (from an approved still), `image-review.mjs --frames`, `--verdict`, `videogen.mjs --publish` | starts from a reviewed still; muted web versions + poster |

`--provider stub` renders a code-drawn plate locally to test the whole chain without a key; the checks refuse to approve it.

**The review rubric** (a candidate needs all of them): it does its job in its placement; it belongs to this business and no
other; no product, packaging, logo, letters, face, eye or result, even blurred; no stock cliché; no artifacts (warped
geometry, melted edges, repeated textures); light, palette and grain match the site; it leaves room for what sits on it
(the text, the cutouts); it survives a crop to every ratio it is used in.

## Research and routing (checked 2026-09-30)

| Job | Choice | Why | Price (per unit) |
|---|---|---|---|
| Final stills | **Gemini 3 Pro Image** (`gemini-3-pro-image`, "Nano Banana Pro") | best photographic quality and prompt adherence in the Gemini API, 1K/2K/4K, custom ratios, multi-turn edits, SynthID | ≈ $0.134 (1K–2K), $0.24 (4K); batch −50% |
| Drafts and variations | **Gemini 3.1 Flash Image** (`gemini-3.1-flash-image`, "Nano Banana 2") | fast, cheap, all the ratios the site needs (incl. 21:9), up to 10 object references | ≈ $0.045–0.10 by size |
| A second opinion | **OpenAI gpt-image-2** (optional, `--provider openai`) | strong editing with masks and 2K/4K output; useful when a concept stalls | ≈ $0.06 (medium) – $0.22 (high, 1024²) |
| Video | **Veo 3.1** (`veo-3.1-generate-preview`; `-fast-` for drafts, `-lite-` exists) | image-to-video from an approved still, first/last frame, 9:16 and 16:9, 1080p at 8 s, SynthID | $0.40/s (fast $0.10–0.12/s, lite $0.05–0.08/s) |

Evaluated and not chosen as defaults: FLUX.2 (Black Forest Labs; excellent photorealism, per-megapixel pricing, a strong
alternative through fal.ai or BFL's API), Imagen 4 (no longer listed on the Gemini API pricing page), Kling 3.0 and Runway
Gen-4.5 (good video at lower cost per second, another account and key), Sora 2 (strong physics, higher cost). MCP servers
for media generation exist (Google's genmedia MCP for Vertex AI, fal and Replicate MCPs); scripts were chosen instead
because they run the same in a session, in a scheduled routine and in CI, and they log cost and provenance per file.

Free tiers: the Gemini API no longer serves image or video generation on the free tier (image output needs billing
enabled), so there is no professional free path for these models. One Google key with billing covers stills and video.
Rate limits depend on the account's tier; the scripts wait and retry four times (2–16 s) on 429/5xx and then stop.

Sources: ai.google.dev/gemini-api/docs/pricing, …/image-generation, …/veo, …/interactions (the `interactions` endpoint is the
new default; `generateContent`, used here, "remains fully supported"); OpenAI and third-party price summaries for gpt-image-2
(April 2026 release); buildmvpfast.com, openrouter.ai and modelslab.com price comparisons (July–September 2026).

## Cost of a site

Eden, as planned: 4 concepts × 2–3 ratios × 4 drafts on Flash (≈ $4) + finals on Pro (≈ $5) + brand fields 7 × 2 × 2 on
Flash (≈ $3) + two 8-second videos on Veo 3.1 (≈ $6.40) ≈ **$20**, under the $30 cap in concepts.json.

## What the owner provides

- `GEMINI_API_KEY`: a Google AI Studio key on a project with billing enabled (images and video). Added as an environment
  variable of the cloud environment (never pasted into a chat). Optional: `OPENAI_API_KEY` for the second opinion.
- A monthly budget ceiling (the scripts' cap follows it).
- Approval of the picks (`--by owner`) for anything shown with a person in it.
