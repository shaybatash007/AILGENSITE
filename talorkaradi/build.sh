#!/bin/sh
# Assemble the site from src/ into index.html (no build tools; plain concatenation).
cd "$(dirname "$0")" && cat src/1-head.html src/2-body.html src/3-data.js src/4-app.js src/5-live.js > index.html && echo "index.html $(wc -c < index.html) bytes"
