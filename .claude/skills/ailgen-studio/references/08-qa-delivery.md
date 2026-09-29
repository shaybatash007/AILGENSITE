# Phase 8 · QA, publish, deliver

The skill-orchestrator's certification (`references/skills/skill-orchestrator.md`, Phase 6) applied to a
studio project. Tick every box for real; a box ticked on a broken result is worse than an open one.

## Site
- [ ] levelup VERIFY: every region ≥ 9 on all 8 axes, before/after captures (`scripts/capture.py`).
- [ ] Zero console errors (desktop + mobile), no horizontal overflow at 390 px, no layout shift on entry.
- [ ] Keyboard-only pass: skip link, menus, dialogs (trap + Esc + focus return), detail views, admin.
- [ ] `prefers-reduced-motion` and the a11y menu's "stop animations": instant first screen, no autoplay.
- [ ] Returning-visit pass (short entry), first-visit pass (full choreography), mascot birth once.
- [ ] Proof tool → WhatsApp/form; form → lead in admin with the right source; agent → `create_lead`.
- [ ] Static export: opens over http with no errors; content from `data/site.json`; form falls back to WhatsApp.
- [ ] Every image labeled; every number sourced; testimonials real; concept work labeled on the site itself.
- [ ] Legal: privacy policy and accessibility statement reachable from the footer and the a11y menu.
- [ ] Lighthouse measured after the last change (quote desktop; note mobile).

## Search visibility (references/10-seo.md)
- [ ] `seo/brief.md` (demand, intent, page inventory) or `seo/old/seo-report.md` done; Search Console export requested.
- [ ] `seo-run.mjs` green: audit gate (0 high findings, no orphans, every page ≥ 3 inbound, depth ≤ 3) and verify gate (every old URL: 200 or one 301, no chains).
- [ ] Old site (if any): `seo-plan` coverage 100%, redirect targets exist; `seo-verify` also passed on the **real staging host** (Hebrew paths).
- [ ] Every service and guide has its own URL, unique title and description, one h1, canonical and valid JSON-LD, all in the served HTML; body text ≥ 100% of the old page.
- [ ] sitemap.xml, robots.txt, `_redirects`, `_headers`, `llms.txt`, `404.html` (status 404), per-page share cards; http and www redirect to one host.
- [ ] Preview is `noindex`; the launch-day flip (`--launch`) and `launch.md` are in the report to the owner.
- [ ] Lead source (organic / paid / social / referral / direct + landing page) saved and visible in the control center; privacy text mentions it.

## Film and campaign
- [ ] Contact sheets at 9:16, 4:5, 1:1 reviewed; final MP4s watched start to end with sound.
- [ ] −14 LUFS ±1, no clipping; the SFX match the picture (reveal hit, pops, typing).
- [ ] Stills, ad copy A/B/C, headlines, targeting and UTM in the campaign README; caveats stated.

## Publishing
- Live artifacts: for an existing URL, read the saved live source **in full** first and build the new version
  from it (never from memory). Large media: published `files` (`m/…`) or uploaded assets (`/_blob/…`).
  Keep capabilities as they were unless the change needs new ones.
- Repo: site in `<slug>/`, brand kit in `projects/<slug>/`, campaign in `campaigns/<slug>/` (video, stills,
  audio, source, README). Render work folders (`out/parts`, `work/`) stay out of git.
- Commit in logical steps with clear messages (what and why), push to the working branch. Large binaries only
  when they are deliverables (final MP4s, posters, stills).

## Report to the owner (in Hebrew)
1. What was built, in one paragraph, with links (live site, repo folder, films).
2. The concept in one sentence and why it fits the business.
3. What is real vs. render/concept, stated plainly.
4. What only they can supply (real photos, permissions, prices, legal texts, contacts), as a short list.
5. Next steps (connect a form backend for the static site, point the domain, run the A/B for a week).
6. Search: what was preserved (URLs kept / redirected), what changed, the Search Console export we still need, and the four-week watch list.
