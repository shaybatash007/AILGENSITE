#!/bin/sh
# Talor Karadi SEO pipeline, end to end (run from the repository root; serve talorkaradi/ on :8767 for the audit).
#   1. compose  old inventory + site data → pages.json, home markers, redirect overrides
#   2. render   crawlable pages
#   3. build    the home page
#   4. plan     url-map, _redirects, sitemap.xml, robots.txt (copied into talorkaradi/)
#   5. audit    the new build (needs:  cd talorkaradi && npx serve -l 8767 -n .)
#   6. compare  old vs new
set -e
S=.claude/skills/ailgen-studio/scripts
node projects/talorkaradi/seo/compose.mjs
node $S/seo-pages.mjs --config projects/talorkaradi/seo/pages.json
sh talorkaradi/build.sh
node $S/seo-plan.mjs --old projects/talorkaradi/seo/old/seo-report.json --new-dir talorkaradi --site https://talorkaradi.co.il \
  --out projects/talorkaradi/seo/plan --overrides projects/talorkaradi/seo/redirect-overrides.json --copy
node $S/seo-audit.mjs http://localhost:8767/ --out projects/talorkaradi/seo/new --delay 150 --max 80 --preview
node projects/talorkaradi/seo/compare.mjs > /dev/null
# launch day: set PREVIEW=false in talorkaradi/src/3-data.js, rerun, and pass --launch to seo-plan.
