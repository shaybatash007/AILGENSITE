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

## The free layer (before any key, and the brief for the paid one)

Every concept is first built as a code-native plate with free tools, in the same composition, palette, light and ratio as its
brief. It is not a mood board: it runs in the site's own slots, it is what the site shows until a paid asset is approved,
and it becomes the composition reference (`--ref`) for the paid drafts, so the paid layer changes the material and never the
decisions.

| Need | Free tool | How |
|---|---|---|
| Surfaces, light, shadow play, material fields | WebGL2 fragment shaders | `projects/<slug>/visual/free/*.html` exposing `window.frame(t, w, h)`; `scripts/glrender.mjs --still WxH[,WxH]` |
| A hero object in 3D (ribbon, fabric, glass) | Three.js (MIT) from jsDelivr, physically based materials (sheen for satin) | the same page contract; `glrender.mjs --film WxH --seconds 8` renders a draft film (H.264, muted, poster) |
| Product cutouts the flood fill cannot cut (white on white, glass, products shot in a setting) | rembg (MIT) + BiRefNet (MIT) on the CPU | `scripts/matte.py`: the model decides alpha only; RGB is the store photo, proven by PSNR ≥ 32 dB |
| Marks and motifs | the brand's own vector marks | drawn large and soft (Eden's lotus field) |
| Free AI drafts | Cloudflare Workers AI daily allocation (FLUX.2 [klein] 4B) | needs only a free account token; see the routing below |

### Live on the site, not beside it

A direction page with mockups is not delivery: the owner judges the live site, and a layer that sits on a separate page
reads as "nothing changed" (Eden, round 4). The free layer ships into the site itself, as real-time code, in the slots its
briefs name, and the paid assets later replace its material in the same places.

| Slot | Live, free | Guardrails that keep the page fast and honest |
|---|---|---|
| First screen | One WebGL2 scene (`src/4c-atelier.js`): the surface is computed once per size into a texture; the foliage shadow is drawn at a third of the resolution (soft by nature); the products are uploaded as a texture array **from the images the page already chose** (srcset, no second download) and composited after tone mapping at full light, so their pixels stay the store's; they cast their own shadows, and the pointer moves the sun | starts after `load` and idle; shaders compile with `KHR_parallel_shader_compile` and no synchronous status query; a software renderer (SwiftShader, llvmpipe) gets no live scene; a watchdog lowers the resolution, then freezes a still; paused off screen and in a hidden tab; reduced motion draws one frame; the still plate is tiny and low-entropy (under 0.05 bits per pixel) so it never becomes the LCP |
| Signature scene | A pinned scroll section drawn in Canvas 2D (`src/4d-lift.js`): the business's own process as a state machine per stage (Eden: a closed eye whose lashes go through the treatment), with the store's words and the products for each stage from the same filters as the proof tool | eased with real elapsed time (capped), so a slow frame never slows the story; images load when the section enters; a rail of stages; a focused control brings its stage; no pin and one final drawing with reduced motion; the mascot steps aside while it is on screen |
| Brand shelves | Material fields rendered with `glrender.mjs` once, as small WebP, set as each card's background when the shelf comes near | a paid field (`.bf`) replaces it in place |
| Page-wide motion | `src/4e-motion.js`: headings rise word by word behind their line, cards tilt with a glare, a collection's product follows the pointer, a sentence fills with ink as it is read | pointer effects only with a fine pointer; nothing moves with reduced motion; every floating layer is clipped by its section (a float outside the page scrolls an RTL page sideways) |

Measure before and after with `lighthouse.mjs --launch`: Eden's first cut of this layer took mobile performance from 92 to
52 (a GPU scene started during load, a background plate became the LCP); the guardrails above brought it back to 89 to 91.
Film the result with `scripts/film-site.mjs` (a virtual clock: the page's time, rAF and every CSS animation advance one frame
per capture, so the footage is smooth even where the machine renders WebGL on the CPU).

Checked and not used: anonymous free image APIs (Pollinations now answers only one small model without payment, and its
terms do not suit client work); Hugging Face serverless inference (needs a token, a few cents of free credit a month);
open-weight diffusion or video models locally (no GPU in the cloud container; CPU generation of a 4B model is minutes per
image). Headless Chromium renders WebGL through SwiftShader, so every machine gets identical pixels, just slower than a GPU.

## Cloudflare Workers AI: what one free token gives the studio (checked 2026-10-01)

One token (Workers AI Read + Edit), stored as an API credential in the cloud environment's settings (type Bearer, allowed
website `api.cloudflare.com`; the environment adds it to each request and no script sees it) or as `CLOUDFLARE_API_TOKEN`. The
account ID is not a secret and sits in `surfaces.json`. No payment method: 10,000 neurons a day on every plan, reset at 00:00 UTC;
above that $0.011 per 1,000 neurons on Workers Paid ($5 a month), and on the Free plan calls fail until the reset. Cloudflare does
not train on what is sent. The key reaches Workers AI only: Pages, Vectorize, D1, R2, KV, AI Gateway, Images, Stream and Browser
Rendering answer 401/403 with it (site publishing has its own token, in GitHub).

| Job | Model | Free a day | Tool |
|---|---|---|---|
| Image drafts | `@cf/black-forest-labs/flux-2-klein-4b` (26.05 neurons per 512 tile) | about 60 at the concepts' sizes | `imagegen.mjs` route `draft` |
| Best free image | `@cf/black-forest-labs/flux-2-dev` (37.5 neurons per tile per step, references, editing) | about 2 at 1 MP | `final` (after the paid routes), `bakeoff` |
| Fast, many | `flux-1-schnell` (4.8 per tile + 9.6 per step) | about 170 | `--use` |
| Hebrew answers from facts (an agent like Lotti) | `@cf/openai/gpt-oss-120b` | about 90 answers | `cfai.mjs --run` |
| Vision: packaging text, alt text, the image gate | `@cf/meta/llama-4-scout-17b-16e-instruct`, `@cf/mistralai/mistral-small-3.1-24b-instruct` | | `cfai.mjs --image` |
| Translation | `@cf/openai/gpt-oss-120b` (about 30 neurons a product text), not `m2m100` | | `cfai.mjs --run --system` |
| Speech to text | `whisper-large-v3-turbo` (Hebrew supported; not yet tested on Hebrew audio) | | `cfai.mjs --audio` |

Measured on Eden on 2026-10-01 (Free plan), so the next project starts from results, not from the catalog page:
- **Agent answers.** The question was "I'm starting lash lifts, budget 150 ₪, what should I buy?", with the whole catalog (71 products,
  2,300 tokens) in the system prompt. `gpt-oss-120b` named the right two products with exact prices and a correct total, in good
  Hebrew: 111 neurons, 6.8 s. `llama-3.3-70b` was right but made Hebrew mistakes (188 neurons). `llama-4-scout` was right and short
  (69 neurons, 1.7 s). `mistral-small-3.1` gave wrong advice (tweezers to lift lashes). `nemotron-3-120b` spent all 1,500 tokens
  reasoning and gave no answer. `gemma-4-26b`, `qwen3.8-27b` and `glm-4.7-flash` returned 502 after 30 s at the time of the test.
- **Paid only, confirmed:** GLM-5.3, Kimi K2.6, DeepSeek V4 Pro and Flash refuse with error 5035 ("not available on the Workers
  Free plan").
- **Vision.** Scout and Mistral Small read every word on a THUYA kit's packaging, with a slip or two (one misread line, one wrong
  colour), so a person confirms anything that is published. As an automatic gate on generated images (JSON: text, logo, product,
  person, artifacts, palette) Scout answered correctly on the drafts in about 7 s.
- **Translation.** `m2m100-1.2b` garbles Hebrew in both directions; `gpt-oss-120b` with a one-line system prompt translates well.
- **Search.** Hebrew embeddings are weak: of `bge-m3`, `qwen3-embedding-0.6b` and `embeddinggemma-300m`, the best (`bge-m3`) still
  missed "a tool to pluck brow hairs" (tweezers) and "what holds the lashes on the silicone" (glue). For a catalog under a few hundred
  products, give the agent the whole catalog instead; embeddings plus a reranker only for large catalogs.
- **Missing:** no Hebrew text-to-speech (Aura speaks English and Spanish, MeloTTS has no Hebrew) and no video model.

Workers AI has no video; video through Cloudflare is xAI Grok Imagine on AI Gateway unified billing (credits plus a 5% fee,
480p/720p), below the 1080p of Veo 3.1 and Kling 3.0 on fal, so the film routes stay on fal. The studio's own words and judgement
stay with Claude; these models carry volume (drafts, the image gate, translation checks, a site agent's answers, transcripts).

### In production: the same models behind every published site (2026-10-01)

The token is for the studio's own work. A published site does not use it. A site uses its Cloudflare Pages project's binding
(`env.AI`), declared by the deploy, so nothing reaches the page (`cloud/README.md`).

| Where | Route | Model and settings | Measured |
|---|---|---|---|
| Eden: Lotti on the public site | `/api/lotti` | `gpt-oss-120b`, `reasoning_effort: low`, the page's own facts (9,282 characters); a second try without the low effort; then the page's fixed answers | 4.7 s, about 140 neurons an answer; declined an off-topic request |
| AILGEN studio demo | `/api/brief` → `/api/mood` | `gpt-oss-120b` for the brief (JSON); FLUX.2 [klein] 4B at 768×432 for the first atmosphere image, one retry | brief 5-7 s, about 52 neurons; image 10-25 s, about 52 neurons |
| AILGEN Lab | `/api/run` | any model in the catalog, behind `LAB_PASSCODE` | every free model one click away |

- **The gate on generated images.** `image-review.mjs --check --vision` runs Llama 4 Scout with a fixed JSON rubric. On Eden's eight
  candidates it failed three:
  - The 4B hands, for major artifacts. A person had reached the same verdict.
  - The 4B ribbon and the THUYA material study, as "product or packaging".
  The gate is strict: a material study can fail it, and the reviewer may approve with `--override` and a written reason. It passed the
  approved 9B craft image.
- **What the lab proved, and what it disproved:**
  - Before shipping, the agent's first context made gpt-oss leak its reasoning ("analysis: … eyel eyel eyel"). The route now rejects
    leaked or looping text (`broken()` in `cloud/_shared/ai.js`) and retries.
  - Adding the product type to each line, and the treatment's stages as the page shows them, turned "stage 1 is a starter kit" into
    the right answer.

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

- Cloudflare (Workers AI Read + Edit token): free drafts. Best stored as an API credential in the cloud environment's settings (type Bearer, allowed website `api.cloudflare.com`): the environment adds it to each request and the scripts never see it. `CLOUDFLARE_API_TOKEN` as a variable works too. The account ID comes from `surfaces.json`.
- `FAL_KEY`: one key for the routed finals and videos; $15–20 of prepaid credit covers a site with margin.
- Optional: `GEMINI_API_KEY` (billing enabled), `OPENAI_API_KEY`. Keys are environment variables of the cloud environment,
  never pasted into a chat or committed.
- Real photographs (a shot list per project): they beat any generated plate where a picture could be read as documentary.
- A budget ceiling (the scripts' cap follows it) and approval of the picks (`--by owner`) for anything with a person in it.
