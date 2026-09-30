#!/bin/sh
# Assemble the site from src/ into index.html (no build tools; plain concatenation, the sprite is inlined at its marker).
cd "$(dirname "$0")" || exit 1
{ cat src/1-head.html; sed -e '/<!--sprite-->/{r src/2a-sprite.html' -e 'd}' src/2-body.html; cat src/3-data.js src/3a-catalog.js src/3b-brand.js src/3c-brands.js src/3d-visual.js src/4-app.js src/4b-lotti.js src/5-live.js; } > index.html && echo "index.html $(wc -c < index.html) bytes"
