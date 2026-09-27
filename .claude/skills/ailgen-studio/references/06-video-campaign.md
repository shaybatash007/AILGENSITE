# Phase 6 · Launch film and campaign

A 20–30 second film for Reels, Stories and the feed, built in code frame by frame, with an original
soundtrack, three stills and ad copy. The engine (`engine/`) produces a strong version for any brand from
`film.json`; a signature moment can be hand-crafted on top (see "Beyond the engine").

## 1. The story arc (map it to scenes)

| Beat | Seconds | Engine scene | What it must do |
|---|---|---|---|
| Hook | 0–3 | `hook` | the visitor's situation or pain, in their words, over a real image; one word can dissolve (`strike`) |
| Turn | 3–6 | `reveal` | the brand's signature motif reveals the solution; the promise lands |
| Proof | 6–9 | `stat` | one number that proves the claim, with an honest comparison |
| Range | 9–15 | `gallery` | 3–5 offers or projects, one beat each, each image labeled real/render |
| Truth | 15–18 | `quote` | a real customer's words (the music breaks down here) |
| Trust | 18–21 | `cards` | answers to the objections: guarantee, time, durability, price model |
| Action | 21–26 | `cta` | logo lights up, one action (button), site + phone, mascot's last line |

Order can change; the hook and the action cannot move. 6–8 scenes, 24–28 s total.

## 2. Filling film.json from the brand kit

- `colors`, `type`, `fonts`, `logo`: straight from `brand.json` (fonts via `scripts/fonts.mjs`).
- `motif` by spirit: `pixels` (tech, screens, digital), `particles` (AI, energy, kids), `spin` (round or pinwheel logos: recycling, energy, circular businesses), `light` (luxury,
  health, calm), `ink` (food, craft, handmade), `wipe` (law, finance, sport), `iris` (soft reveals).
- `highlight`: `marker` (a bar under the key word, energetic) or `color` (the word in accent, calmer).
- `mascot`: the grid from phase 3; use it in the hook (surprised) and in the cta (the last line + `finale`).
- `audio.mood`: `bright` (pop/electronic 120), `tech` (124, minor), `warm` (100, major), `luxury` (84,
  jazz chords), `calm` (76, pads only).
- Text: from the copy deck. Headlines ≤ 6 words per line, 1–2 lines. Mark the key word with `*word*`.
- Every image gets `tag`: `real`, `render`, `concept` or `demo`.

Full field reference: `engine/README.md`. Two complete examples in opposite spirits: `projects/switching-tv/film.json`
(bright-tech: `pixels` motif, Karantina + stencil numbers, TIVI, `bright` score) and `projects/ailgen/film.json`
(nocturnal: `particles` motif, Frank Ruhl Libre, AILI, `tech` score, no testimonial scene because none is real).

## 3. Review, render, deliver

```bash
S=.claude/skills/ailgen-studio
node $S/engine/render.mjs --project projects/<slug> --scale .5 --frames 1,2.5,4,6,8,11,14,17,20,23,25
python3 $S/scripts/contact_sheet.py "projects/<slug>/out/review/f_*.png" /tmp/sheet.png 6
# look at every tile; then check 4:5, 1:1 and 16:9 the same way (--w 540 --h 676 etc.)
node $S/engine/render.mjs --project projects/<slug> --audio auto                   # 9:16, ~5 min for 26 s
node $S/engine/render.mjs --project projects/<slug> --w 1080 --h 1350 --audio auto  # 4:5
node $S/engine/render.mjs --project projects/<slug> --stills                       # stills from film.json
```

Review rules: text inside safe zones (9:16: top 12%, bottom 20% belong to the app UI); no overlap between a
bubble, a headline and a label; numbers in the right order; each transition reads as the brand motif; the
final frame holds long enough to read the phone number (≥ 1.5 s). Check loudness (`ffmpeg -af ebur128`),
target −14 LUFS (render.mjs normalizes when it muxes).

For the web (site film section, portfolio): a lighter encode,
`ffmpeg -i film.mp4 -vf scale=720:-2 -c:v libx264 -crf 24 -preset slow -c:a aac -b:a 128k -movflags +faststart film-web.mp4`
plus a poster JPG from the strongest frame.

## 4. Ad copy and running

Write three primary texts (A: the main audience's pain; B: short, for Reels, built on the quote; C: the second
audience), five headlines ≤ 40 characters, one description, one CTA. Example: `campaigns/switching-tv/README.md`.
- Objective: leads (WhatsApp messages or an instant form). CTA to WhatsApp is the easiest first step.
- Placements: Advantage+. 9:16 to Reels/Stories, 4:5 to feeds, uploaded in the same ad.
- Week-one A/B: the film vs. the best still vs. the mascot still, same audience and budget; keep the cheapest
  cost per lead after 5–7 days.
- Links with UTM: `?utm_source=meta&utm_medium=paid&utm_campaign=<slug>-launch`.
- If the ad promises something the live site doesn't have yet (a planner, a mascot), point the ad to WhatsApp
  until the new site is live, and say so in the campaign README.

## 5. The signature scene

Every film needs one moment no template can tell. The engine now has a generic one, `morph`: a real photo of
the problem shatters into particles, they swirl in the brand's vortex, become the clean material, assemble into
what the business makes of it, and close into the logo (Talor Karadi: demolition dust → recycled aggregate →
a protective shelter → the four-blade symbol). Give it the photo, a silhouette of the result and the symbol
with alpha; 6.5–7 s; it adds its own cues (glitch, swishes, riser, hit, chime).

## 6. Beyond the engine: a hand-crafted scene

When the brand has a moment no template can tell (Switching: the sun washes out a TV, TIVI sends its light,
thousands of LEDs switch on), write it by hand on the same principles: a pure `render(t)` on canvas, stepped
by the renderer, the soundtrack cued to it. The complete example is `campaigns/switching-tv/source/`
(`reel.html` 26 s film with an LED renderer, the pixel mascot, a sun flare and kinetic RTL type;
`audio.py` scored to the picture; `render.mjs` parallel encoding). Budget: a day for one signature scene.

## Gate

- [ ] Contact sheet reviewed at 9:16, 4:5 and 1:1; nothing clipped, overlapping or reversed.
- [ ] Every image labeled; the quote is real; numbers match the brief.
- [ ] 9:16 + 4:5 MP4 with sound, −14 LUFS ±1; three stills; ad copy A/B/C; campaign README.
