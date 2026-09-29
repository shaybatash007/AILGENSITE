#!/bin/sh
# Talor Karadi SEO phase, one command (from the repository root). Add --launch on launch day, --refresh-old to crawl the old site again.
exec node .claude/skills/ailgen-studio/scripts/seo-run.mjs --project projects/talorkaradi "$@"
