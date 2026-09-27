#!/bin/sh
# Assemble the studio page from src/ (plain concatenation, no build tools).
cd "$(dirname "$0")" && cat src/1-head.html src/2-body.html src/3-app.js src/4-run.js src/5-live.js > index.html && echo "index.html $(wc -c < index.html) bytes"
