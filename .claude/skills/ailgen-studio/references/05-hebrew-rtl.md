# Hebrew and RTL, done right

Lessons paid for in the three builds. Check every one before calling a region done.

## Document
- `<html lang="he" dir="rtl">` (artifact: set both from an inline head script, the wrapper has no attributes).
- Use logical CSS (`margin-inline-start`, `inset-inline-end`, `padding-inline`), never left/right for layout.
- Directional icons (arrows, chevrons, "next") point in reading direction: next = left. Mirror with
  `transform: scaleX(-1)` where an icon was drawn LTR.

## Mixed text (bidi)
- Numbers, ranges, units and Latin inside Hebrew get reordered by the bidi algorithm: "400–600 NIT" can show
  as "NIT 600–400", "4K · HDR" as "HDR · 4K". In HTML wrap them: `<bdi dir="ltr">6,500 NIT</bdi>`.
- In **canvas** (film, ads) isolate LTR runs with U+2066 (LRI) … U+2069 (PDI); the engine's `bidi()` does it.
- Phone numbers, emails, URLs: `dir="ltr"` (and `text-align:right` in RTL inputs).
- Inch mark: write "אינץ׳" in running Hebrew (a raw ″ after a number flips sides).
- Geresh and gershayim: ׳ (U+05F3) and ״ (U+05F4), not ' and " (סוויצ׳ינג, ״ברור כמו לילה״).

## Typography
- Hebrew display fonts sit differently on the baseline; check descenders (ק ר ך ן ף ץ) are not clipped by
  masks and line-height (≥ 0.9 for display, ≥ 1.5 for body).
- `text-wrap: balance` for headings, `pretty` for paragraphs. In canvas, use `wrapBalanced()`.
- Measure 45–75 characters. Hebrew reads well slightly larger than Latin at the same px.
- Numbers get their own family and `font-variant-numeric: tabular-nums` in tables and counters.
- Do not letter-space Hebrew body text; tracking is for Latin caps only.

## Forms and data
- Validate Israeli phones loosely (≥ 9 digits); convert to WhatsApp format `972…` by dropping the leading 0.
- Dates with `toLocaleDateString('he-IL', …)`; currency "₪9,900" or "9,900 ₪" consistently.
- Placeholders are examples, not labels; every input has a visible `<label>`.

## Check
- [ ] Every mixed line read aloud in the rendered page (not in the source).
- [ ] Screenshots at 390 px: no clipped glyphs, no orphan single word lines in headings.
- [ ] Film frames: numbers and Latin in the right order on every scene.
