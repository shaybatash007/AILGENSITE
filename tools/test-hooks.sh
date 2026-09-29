#!/bin/sh
# Installs the real .githooks into a throwaway repo and proves the guard works.
#
#   sh tools/test-hooks.sh <hooks-dir> <tmp-dir>
#
# Two things this harness got wrong, both found by the verifier, both silent:
#   * core.hooksPath was set to a RELATIVE path after cd'ing into the throwaway
#     repo, so git resolved it to <throwaway>/.githooks, which does not exist.
#     GIT_TRACE=1 showed no hook ran at all. A relative hooksPath is fine in the
#     real repo (git resolves it against the toplevel) but NOT after a cd.
#   * cases shared files, so a "block" could really be git refusing to commit
#     because there was nothing staged. Every case now stages its own file, and
#     the reason for each verdict is printed so a block is attributable.
ROOT_SRC="$1"
DEST="$2"
[ -n "$ROOT_SRC" ] && [ -n "$DEST" ] || { echo "usage: test-hooks.sh <hooks-dir> <tmp-dir>"; exit 2; }
case "$ROOT_SRC" in /*) ;; *) ROOT_SRC="$(cd "$ROOT_SRC" && pwd)" ;; esac

rm -rf "$DEST"; mkdir -p "$DEST"; cd "$DEST" || exit 2
git init -q
git config user.email "t@example.invalid"
git config user.name "T"
git config core.hooksPath "$ROOT_SRC"   # ABSOLUTE - see the note above

pass=0; fail=0; n=0
t() { # t <expect allow|block> <message...>
  expect="$1"; shift
  n=$((n + 1))
  f="file$n.txt"
  printf 'x\n' > "$f"
  git add "$f"
  out=$(git commit -m "$1" 2>&1); rc=$?
  got=$([ $rc -eq 0 ] && echo allow || echo block)
  if [ "$got" = "$expect" ]; then
    pass=$((pass + 1)); echo "  PASS  $expect <- \"$1\""
  else
    fail=$((fail + 1))
    echo "  FAIL  expected $expect, got $got <- \"$1\""
    printf '%s\n' "$out" | sed 's/^/          /'
  fi
}

# The seed commit must exist for the "HEAD is stamped" cases to be meaningful.
printf 'seed\n' > seed.txt; git add seed.txt
git commit -q --no-verify -m "[Model: Test Person] feat: seed"
echo "  (seed HEAD: $(git log -1 --format=%s))"
echo ""

echo "  -- a well-formed stamp is allowed"
t allow "[Model: Test Person] feat: a real change"
t allow "[Model: Someone Else] fix: something"

echo "  -- unstamped subjects are blocked"
t block  "no attribution whatsoever"
t block  "wip"
t block  ""
t block  "   "
t block  "[Model: Test Person]"                       # stamp but no action
t block  "chore: x [Model: Test Person]"              # stamp in the wrong place
t block  "  [Model: Test Person] leading space"
t block  "[Model:Test Person] no space after the colon"

echo "  -- merge and fixup commits are exempt by design"
t allow "fixup! something"
t allow "squash! something"
t allow "amend! something"

echo "  -- the file is the REAL hook, at the path git actually uses"
grep -q "commit-msg" "$ROOT_SRC/commit-msg" 2>/dev/null \
  && { pass=$((pass+1)); echo "  PASS  the guard lives in commit-msg"; } \
  || { fail=$((fail+1)); echo "  FAIL  no commit-msg hook in $ROOT_SRC"; }
resolved=$(git rev-parse --git-path hooks)
case "$resolved" in
  /*) ;;
  *) resolved="$(cd "$(dirname "$resolved")" && pwd)/$(basename "$resolved")" ;;
esac
if [ -f "$resolved/commit-msg" ]; then
  pass=$((pass+1)); echo "  PASS  git resolves hooks to $resolved"
else
  fail=$((fail+1)); echo "  FAIL  git looks in $resolved and there is no commit-msg there"
fi

echo ""
echo "  $pass passed, $fail failed"
[ $fail -eq 0 ]
