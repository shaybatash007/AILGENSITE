#!/usr/bin/env bash
# fastconfig probe: what this environment can already reach, without printing any secret value.
#   bash probe.sh [--cf-account <id>] [--hosts "a.com b.com"]
# Sections: where we are · credentials present (names only) · Cloudflare permissions · provider keys · network hosts · gaps.
# Every check is a read call (a listing or a verify); nothing is created, changed or billed.

CF_ACC="${CLOUDFLARE_ACCOUNT_ID:-}"; HOSTS_EXTRA=""
while [ $# -gt 0 ]; do case "$1" in --cf-account) CF_ACC="$2"; shift 2;; --hosts) HOSTS_EXTRA="$2"; shift 2;; *) shift;; esac; done
GAPS=(); gap(){ GAPS+=("$1"); }
row(){ printf "  %-30s %-6s %s\n" "$1" "$2" "$3"; }
has_py=$(command -v python3 >/dev/null && echo 1)
# a JSON field out of a file: "ok" for success:true, else the first error code and message
jmsg(){ if [ -n "$has_py" ]; then python3 - "$1" <<'PY'
import json,sys
try:
  j=json.load(open(sys.argv[1]))
  if isinstance(j,dict) and j.get("success") is True: print("ok")
  elif isinstance(j,dict) and j.get("errors"): e=j["errors"][0]; print(f'{e.get("code","")} {e.get("message","")}'[:70])
  else: print("")
except Exception: print("")
PY
else grep -q '"success":true' "$1" && echo ok || echo ""; fi; }
TMP=$(mktemp)

echo "where"
row "machine" "" "$(uname -sm) · $( [ -n "$CLAUDE_CODE_REMOTE" ] && echo 'Claude Code cloud session' || echo 'local or other')"
if git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  row "repository" "" "$(git remote get-url origin 2>/dev/null | sed -E 's#https?://[^@/]*@#https://#; s#\.git$##') @ $(git branch --show-current 2>/dev/null)"
  if timeout 15 git ls-remote --exit-code origin HEAD >/dev/null 2>&1; then row "git remote" "ok" "fetch works"; else row "git remote" "no" "cannot reach origin"; gap "git: origin unreachable (github access, references/github.md)"; fi
else row "repository" "-" "not inside a git repository"; fi

echo; echo "credentials present (names only)"
names=$(env | cut -d= -f1 | grep -E '(TOKEN|_KEY|KEY$|SECRET|PASSCODE|PASSWORD|API)' | grep -vE '^(MAX_THINKING|CLAUDE|CCR_|ANT_|SESSION_|CLOUDSDK_|AWS_|GIT_|SBX_|MCP_|ENV_|ENVRUNNER|npm_|NODE_|BUN_|DOCKER_|GLOBAL_AGENT)' | sort)
if [ -n "$names" ]; then for n in $names; do note=""; case "$n" in GITHUB_TOKEN|GH_TOKEN) [ -n "$CLAUDE_CODE_REMOTE" ] && note="(the session's git proxy, scoped to its repositories)";; esac; row "$n" "set" "$note"; done; else row "(none)" "" ""; fi

echo; echo "Cloudflare"
CF="https://api.cloudflare.com/client/v4"; AUTH=()
[ -n "$CLOUDFLARE_API_TOKEN" ] && AUTH=(-H "Authorization: Bearer $CLOUDFLARE_API_TOKEN")
code=$(curl -s -m 12 -o "$TMP" -w "%{http_code}" "${AUTH[@]}" "$CF/user/tokens/verify"); m=$(jmsg "$TMP")
if [ "$code" = "000" ]; then row "api.cloudflare.com" "no" "host blocked by the network policy"; gap "network: allow api.cloudflare.com"
elif [ "$m" = "ok" ]; then
  row "token" "ok" "a user token is active$( [ -z "$CLOUDFLARE_API_TOKEN" ] && echo ' (injected by the environment)')"
  if [ -z "$CF_ACC" ]; then curl -s -m 12 -o "$TMP" "${AUTH[@]}" "$CF/accounts?per_page=5"; CF_ACC=$( [ -n "$has_py" ] && python3 -c 'import json,sys;r=json.load(open(sys.argv[1])).get("result") or [];print(r[0]["id"] if r else "")' "$TMP" 2>/dev/null); fi
  if [ -z "$CF_ACC" ]; then row "account" "?" "not visible (needs Account Settings: Read, or pass --cf-account)"; gap "cloudflare: Account Settings Read (or give the account id)"; fi
  if [ -n "$CF_ACC" ]; then
    for spec in "Workers AI|/accounts/$CF_ACC/ai/models/search?per_page=1" "AI Gateway|/accounts/$CF_ACC/ai-gateway/gateways" "Cloudflare Pages|/accounts/$CF_ACC/pages/projects" \
                "Workers Scripts|/accounts/$CF_ACC/workers/scripts" "Workers KV Storage|/accounts/$CF_ACC/storage/kv/namespaces" "Workers R2 Storage|/accounts/$CF_ACC/r2/buckets" \
                "D1|/accounts/$CF_ACC/d1/database" "Account Settings|/accounts/$CF_ACC"; do
      name=${spec%%|*}; path=${spec#*|}; c=$(curl -s -m 12 -o "$TMP" -w "%{http_code}" "${AUTH[@]}" "$CF$path"); m=$(jmsg "$TMP")
      if [ "$m" = "ok" ]; then row "$name" "ok" ""; else row "$name" "no" "$c $m"; gap "cloudflare: $name"; fi
    done
  fi
  c=$(curl -s -m 12 -o "$TMP" -w "%{http_code}" "${AUTH[@]}" "$CF/zones?per_page=1"); m=$(jmsg "$TMP")
  if [ "$m" = "ok" ]; then n=$( [ -n "$has_py" ] && python3 -c 'import json,sys;print((json.load(open(sys.argv[1])).get("result_info") or {}).get("total_count","?"))' "$TMP"); row "Zones (domains)" "ok" "$n zone(s) visible"; else row "Zones (domains)" "no" "$c $m"; gap "cloudflare: Zone Read"; fi
else row "token" "no" "$code $m"; gap "cloudflare: no working token (references/cloudflare.md)"; fi

echo; echo "provider keys (status of one read call)"
p(){ local name="$1" var="$2" url="$3"; shift 3; if [ -n "${!var}" ]; then c=$(curl -s -m 12 -o /dev/null -w "%{http_code}" "$@" "$url"); [ "$c" = "200" ] && row "$name" "ok" "" || { row "$name" "no" "HTTP $c"; gap "$name: key set but the call returned $c"; }; fi; }
p "OpenAI" OPENAI_API_KEY "https://api.openai.com/v1/models" -H "Authorization: Bearer $OPENAI_API_KEY"
p "Anthropic" ANTHROPIC_API_KEY "https://api.anthropic.com/v1/models" -H "x-api-key: $ANTHROPIC_API_KEY" -H "anthropic-version: 2023-06-01"
p "Gemini" GEMINI_API_KEY "https://generativelanguage.googleapis.com/v1beta/models?key=$GEMINI_API_KEY"
p "ElevenLabs" ELEVENLABS_API_KEY "https://api.elevenlabs.io/v1/user" -H "xi-api-key: $ELEVENLABS_API_KEY"
p "Replicate" REPLICATE_API_TOKEN "https://api.replicate.com/v1/account" -H "Authorization: Bearer $REPLICATE_API_TOKEN"
p "Hugging Face" HF_TOKEN "https://huggingface.co/api/whoami-v2" -H "Authorization: Bearer $HF_TOKEN"
[ -n "$FAL_KEY" ] && row "fal.ai" "set" "(no free read endpoint; checked on first use)"

echo; echo "network (the environment's policy)"
for h in api.cloudflare.com raw.githubusercontent.com registry.npmjs.org pypi.org api.openai.com api.anthropic.com generativelanguage.googleapis.com fal.ai queue.fal.run api.elevenlabs.io api.replicate.com $HOSTS_EXTRA; do
  c=$(curl -s -m 8 -o /dev/null -w "%{http_code}" "https://$h/"); if [ "$c" = "000" ]; then row "$h" "no" "blocked or unreachable"; gap "network: allow $h"; else row "$h" "ok" "HTTP $c"; fi
done

echo; if [ ${#GAPS[@]} -eq 0 ]; then echo "gaps: none"; else echo "gaps (${#GAPS[@]}):"; printf "  - %s\n" "${GAPS[@]}"; fi
rm -f "$TMP"
