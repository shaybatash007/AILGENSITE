#!/usr/bin/env bash
# Installs the fastconfig skill for the current user (~/.claude/skills/fastconfig), so it is there in every repository and session.
# Meant for a Claude Code cloud environment's setup script (runs on every new container):
#   curl -fsSL https://raw.githubusercontent.com/shaybatash007/AILGENSITE/HEAD/.claude/skills/fastconfig/scripts/install.sh | bash
# FASTCONFIG_SRC overrides where the files come from.
set -e
SRC="${FASTCONFIG_SRC:-https://raw.githubusercontent.com/shaybatash007/AILGENSITE/HEAD/.claude/skills/fastconfig}"
DST="${HOME}/.claude/skills/fastconfig"
mkdir -p "$DST/references" "$DST/scripts"
for f in SKILL.md references/claude.md references/cloudflare.md references/github.md references/providers.md scripts/probe.sh scripts/install.sh; do
  curl -fsSL "$SRC/$f" -o "$DST/$f"
done
chmod +x "$DST/scripts/"*.sh
echo "fastconfig installed in $DST"
