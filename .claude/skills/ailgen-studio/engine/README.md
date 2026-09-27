# Brand film engine

One HTML file renders a launch film for any brand from `projects/<slug>/film.json`. Every frame is a pure
function of time, so the renderer steps it at 30 fps and pipes PNGs to ffmpeg. The same scenes lay themselves
out for **9:16, 4:5, 1:1 and 16:9**, and the soundtrack is composed from the film's own cues.

```bash
S=.claude/skills/ailgen-studio
node $S/engine/render.mjs --project projects/<slug> --scale .5 --frames 1,4,8      # review frames → out/review/
node $S/engine/render.mjs --project projects/<slug> --audio auto                    # 9:16 MP4 → out/film-1080x1920.mp4
node $S/engine/render.mjs --project projects/<slug> --w 1080 --h 1350 --audio auto  # 4:5
node $S/engine/render.mjs --project projects/<slug> --stills                        # stills → out/stills/
python3 $S/engine/audio.py --cues projects/<slug>/out/cues.json --film projects/<slug>/film.json --out track.wav [--mood luxury]
```
Open a frame in a browser: serve the repo root (`python3 -m http.server`) and go to
`/.claude/skills/ailgen-studio/engine/film.html?p=/projects/<slug>/&w=1080&h=1920&t=8.2`.
Options: `--jobs 3` (parallel browsers), `--crf 18`, `--scale .5` (quick preview), `--out file.mp4`, `--fps`.
Timing: ~12 frames/s total with 3 jobs; a 25 s 1080×1920 film with soundtrack ≈ 5 minutes.

## film.json

| Field | Meaning |
|---|---|
| `name`, `lang` (`he`), `dir` (auto from lang), `fps` (30) | basics; RTL is automatic for Hebrew/Arabic |
| `fonts` | path to a `fonts.css` with local woff2 (make it with `scripts/fonts.mjs`) |
| `type` | `display`, `displayWeight`, `body`, `bodyWeight`, `num`, `numWeight` (font family names) |
| `colors` | `bg surface paper ink inkMuted text muted accent accent2 accentInk line` + honesty `real render concept demo` |
| `logo` | `light` (for dark grounds) and `dark` (for light grounds): SVG or PNG |
| `motif` | `pixels` · `particles` · `light` · `ink` · `iris` · `wipe` · `spin` (4 swirling blades, for round/pinwheel logos): every transition and reveal |
| `motifColors` | colours of the lit edge for pixels/particles/spin (e.g. RGB LEDs, the logo's blade colours) |
| `highlight` | `marker` (bar under `*word*`) or `color` (word in accent) |
| `transition` | seconds of each scene change (0.45) |
| `texture` | `dots` (default) or `none` |
| `grain` | film grain amount (0.045) |
| `mascot` | pixel character: `grid`, `colors`, `faces`, `cell` (see references/02-mascot.md) |
| `labels` | override honesty label texts (`real` `render` `concept` `demo` `stock`, or any custom key) |
| `audio` | `mood` (`bright` `tech` `warm` `luxury` `calm`), optional `bpm` |
| `scenes` | the story, in order (below); durations add up to the film length |
| `stills` | `[{ name, w, h, t }]`: frames re-laid out at other sizes, for ads |

Examples: `projects/switching-tv/film.json` (pixels, TIVI, light and dark scenes) and `projects/ailgen/film.json`
(particles, AILI, all-night palette). Paths are relative to the project folder, or absolute from the repo root (`/campaigns/…`).
Text: `*word*` highlights a word. Every scene accepts `theme` (`dark` · `light` · `accent`), `motif`/`transition`
overrides, `size`, and `mascot: { at, say, mood, finale, x, y, cell }`.

### Scenes

| type | Fields | Notes |
|---|---|---|
| `hook` | `image`, `tag`, `lines[]`, `strike` (a word that dissolves), `wash` (0–1, wash the image out), `washColor`, `sub`, `y`, `fx`/`fy` | the visitor's situation; kinetic lines over the image |
| `reveal` | `image` + `tag`, or `logo: true`; `title[]`, `sub` | the motif reveals the image/logo, a flash of accent, the promise |
| `stat` | `headline[]`, `value`, `display`, `unit`, `suffix`, `label`, `label2`, `from`, `compare: { label, value, display }` | a number counts up; two bars, sqrt-scaled, the text keeps the truth |
| `gallery` | `headline`, `items: [{ image, title, sub, tag, fx, fy }]`, `titleSize` | one beat per item, motif transitions inside the frame, counter |
| `quote` | `kicker`, `text`, `who`, `where`, `stars` (5) | balanced lines, stars pop, a watermark quote mark; music breaks down |
| `cards` | `headline[]`, `cards: [{ icon, value, display, unit, label }]` | 2×2 (4×1 in 16:9), numeric values count up |
| `cta` | `headline[]`, `button`, `sub[]` (site, phone), `logoW` | the logo lights up with the motif; button with a light sweep |
| `morph` | `image` + `tag`, `shape` (silhouette PNG/SVG with alpha), `final` (symbol with alpha, optional), `steps[]` (up to 5 captions), `stepColors[]` (3 colours: raw, clean, shape), `cols` | **signature scene**: the photo shatters into particles, they swirl in the brand's four-blade vortex, change colour, assemble into the shape, then into the symbol. "Your waste becomes a shelter", "flour becomes bread". Example: `projects/talorkaradi/film.json` |

### Cues (for the soundtrack)
`render.mjs` writes `out/cues.json`: `whoosh` (scene changes), `intro`, `glitch` (strike), `hit`/`drop` (reveal),
`ticks` (count-up), `pop`, `swish` (gallery), `break` (quote), `chime` (stars), `chip`/`type` (mascot),
`riser` → `final` (CTA). `audio.py` builds the arrangement around them: drone intro → groove from the first
drop → breakdown in the quote → roll and big chord at the CTA → ringing last chord.

## Adding a scene type
Add `SC.<type> = (s, lt) => { … }` in `film.html` (draw with the helpers: `ground`, `headline`, `words`,
`text`, `pill`, `motifReveal`, `cover`, `honesty`, `hlFit` + `blockTop` for vertical centering), and its cues
in `layout()`. Keep it a pure function of `lt` (no randomness without a seed, no timers).
