# AILGENSITE

AILGEN's studio repository: the AILGEN site (`index.html`), client and concept sites (`switching-tv/`,
`vermeil/`), brand assets (`brand/`), campaigns (`campaigns/`), and per-project brand kits (`projects/`).
Everything is static HTML/CSS/JS with no build step; serve with `python3 -m http.server`.

When the user brings a business (a URL, a written concept or just a name) and wants a site, a brand, a
mascot, a launch film, ads or a portfolio case, follow the `ailgen-studio` skill in
`.claude/skills/ailgen-studio/SKILL.md`. It uses the user's own skills (levelup, levelup2,
skill-orchestrator), copied under `references/skills/`, and ships the tools under `scripts/` and `engine/`.

Conventions:
- Hebrew first, RTL. Every image's provenance is recorded in the project files; visitors see a label only in visitor language
  and only where an image could be read as documentary ("תמונת אווירה"). No production language on any page (preview, snapshot,
  draft, "from the existing site"): `copy-lint.mjs` gates it. Product pixels are never generated; at most five generated concepts per site.
- Project working files go in `projects/<slug>/`; render output in `projects/<slug>/out/` is not committed.
- Live versions are Claude artifacts; read the live source in full before republishing one.
- Never disable TLS verification or work around a site's rate limits.
