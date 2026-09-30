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
| Check the keys | `node imagegen.mjs --project projects/<slug> --probe` | every route shows ✓ or the missing key |
| Bake-off | `node imagegen.mjs --project … --concept atelier --bakeoff` | one sheet, one image per model; the winner goes into `route.final` |
| See the requests | `node imagegen.mjs --project … --concept all --dry` | prompts read right; cost estimate within budget |
| Generate | `node imagegen.mjs --project … --concept atelier --tier draft` then `--tier final` | budget cap (concepts.json `budgetUsd`), ledger.jsonl |
| Check | `node image-review.mjs --project … --check` | ratio ±2%, not flat, palette ΔE ≤ 28, no neon, never a stub |
| Review | `node image-review.mjs --project … --sheet` → look at `visual/review/*.jpg` | the rubric below, verdict per file |
| Approve | `node image-review.mjs --project … --verdict <file> approve --why "…" --pick [--by owner]` | only passing candidates can be approved |
| Publish | `node image-review.mjs --project … --publish --site <folder>` | graded to the palette (grade.py, ΔE before/after), WebP 640/1280/1920 + manifest with provenance |
| Video | `node videogen.mjs --project … --concept atelier` (from an approved still), `image-review.mjs --frames`, `--verdict`, `videogen.mjs --publish` | starts from a reviewed still; muted web versions + poster |

`--provider stub` renders a code-drawn plate locally to test the whole chain without a key; the checks refuse to approve it.

**The review rubric** (a candidate needs all of them): it does its job in its placement; it belongs to this business and no
other; no product, packaging, logo, letters, face, eye or result, even blurred; no stock cliché; no artifacts (warped
geometry, melted edges, repeated textures); light, palette and grain match the site; it leaves room for what sits on it
(the text, the cutouts); it survives a crop to every ratio it is used in.

## Choosing a model: vendor-neutral routing (checked 2026-09-30)

No provider is the default by habit. Every job names an ordered route of `provider:model` in `concepts.json`
(`routing.draft`, `routing.final`, `routing.bakeoff`, `routing.video`, `routing.videoFinal`, and per concept `route.final`
with a one-line `why`); the first route whose key is present runs. Changing a model is one line of data, never code.

| Job | Route (in order) | Why | Price |
|---|---|---|---|
| Drafts (prompt and composition calibration) | `cloudflare:@cf/black-forest-labs/flux-2-klein-4b` → `fal:fal-ai/flux-2-pro` → `gemini:gemini-3.1-flash-image` | Workers AI gives 10,000 neurons a day free: ≈ 95 klein images a day; Apache 2.0 weights; takes up to 4 references (each < 512²) | free within the daily allocation, then ≈ $0.0012 per 1 MP |
| Photographic finals (light, material, surfaces) | `fal:fal-ai/nano-banana-pro` → `gemini:gemini-3-pro-image` → `fal:fal-ai/flux-2-pro` → `openai:gpt-image-2` | Nano Banana Pro is Google's Gemini 3 Pro Image, reached through the same fal key as every other model | $0.15 (fal) / $0.134 (Gemini API); 4K $0.30 / $0.24 |
| Colour-exact fields, wide textures | `fal:fal-ai/flux-2-pro` (with a colour-swatch reference, `grade.py --swatch`) | per-megapixel pricing suits 21:9; holds a strict palette; `/edit` takes reference images | $0.03 first MP + $0.015 per extra MP (references count as MP) |
| Soft organic textures | `fal:fal-ai/bytedance/seedream/v4.5/text-to-image` | delicate detail, cheapest good final | $0.04 |
| Bake-off (before any series) | Nano Banana Pro · FLUX.2 [pro] · Seedream 4.5 (+ klein, Gemini, OpenAI when keyed) | the same brief, one image each, one review sheet labelled by model | ≈ $0.25 |
| Video drafts | `fal:fal-ai/veo3.1/fast/image-to-video` → `fal:fal-ai/kling-video/v3/pro/image-to-video` → `gemini:veo-3.1-fast-generate-preview` | image-to-video from an approved still; audio off (the site's videos are muted) | $0.10/s · $0.112/s · $0.12/s |
| Video finals | `fal:fal-ai/veo3.1/image-to-video` → `gemini:veo-3.1-generate-preview` | Veo 3.1 at 1080p, 8 s; SynthID | $0.20/s without audio (fal) / $0.40/s (Gemini API) |

Checked and not routed: Adobe Firefly (commercially indemnified, but the API is enterprise-only), Midjourney (no official
API, so no place in an automated pipeline), Hailuo's free tier (watermarked, no commercial rights), Kling's web credits (manual
use only), FLUX.2 [klein] 9B and FLUX.2 [dev] weights (non-commercial licences), open video weights such as Wan 2.2 and
LTX (they need a GPU; the cloud container has none). Input schemas were read from fal's OpenAPI for every routed fal model
(`fal.ai/api/openapi/queue/openapi.json?endpoint_id=<model>`); Workers AI takes multipart `prompt`, `width`, `height`,
`input_image_0..3`.

Sources: developers.cloudflare.com/workers-ai/platform/pricing, developers.cloudflare.com/changelog/2026-01-15-flux-2-klein-4b-workers-ai,
fal.ai/docs/model-apis/model-endpoints/queue, the fal model pages (fal-ai/nano-banana-pro, fal-ai/flux-2-pro, fal-ai/veo3.1,
fal-ai/kling-video/v3), ai.google.dev/gemini-api/docs/pricing.

**Brand grade.** On publish every approved plate goes through `grade.py`: a gentle Lab statistics transfer toward the concept
palette (strength 0.35 by default, `concepts.json` → `grade`), reported as the median ΔE to the palette before and after and
stored in the manifest's provenance. Never on product photos, cutouts or anything with product pixels.

**References.** `--ref a.png,b.png` sends composition, light or colour references (Gemini: inline parts; fal: the model's
`/edit` variant with `image_urls`; Cloudflare: `input_image_N`). A reference is never a product to repaint or a person to copy.

**Publishing guard.** An approval never overrides the automatic checks: a stub or a candidate that failed a check is not
published (`--allow-test` exists only for pipeline tests).

## Cost of a site

Eden, as planned (`projects/edencosmetic/visual/plan.md`): bake-off $0.25 + hero plate 12 candidates on Nano Banana Pro $1.80
+ curl band 12 on FLUX.2 [pro] $0.72 + 7 brand fields × 2 ratios × 2 on FLUX.2 [pro] with swatches $1.05 + lotus 6 on
Seedream $0.24 + craft fallback 8 $1.20 (zero with Eden's own photos) + two 8-second videos with one draft ≈ $3.20
≈ **$8.50, about $12 with retries**, under the $20 cap. Drafts before each series run free on Cloudflare. Products: no
generated pixels (real cutouts on one stage); the mascot: drawn in code; share cards: code from real photos.

## What the owner provides

- `CLOUDFLARE_ACCOUNT_ID` and `CLOUDFLARE_API_TOKEN` (Workers AI permission): free drafts.
- `FAL_KEY`: one key for the routed finals and videos; $15–20 of prepaid credit covers a site with margin.
- Optional: `GEMINI_API_KEY` (billing enabled), `OPENAI_API_KEY`. Keys are environment variables of the cloud environment,
  never pasted into a chat or committed.
- Real photographs (a shot list per project): they beat any generated plate where a picture could be read as documentary.
- A budget ceiling (the scripts' cap follows it) and approval of the picks (`--by owner`) for anything with a person in it.
