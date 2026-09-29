#!/bin/sh
# Installs the real .githooks into a throwaway repo and proves they behave.
# Runs the REAL hook files, not a copy of the rules.
ROOT_SRC="$1"
DEST="$2"
rm -rf "$DEST"; mkdir -p "$DEST"
cd "$DEST"
git init -q
git config user.email "t@example.invalid"
git config user.name "T"
git config core.hooksPath "$ROOT_SRC"

pass=0; fail=0
t() { # t <label> <expect: allow|block> <message>
  out=$(git commit -m "$3" 2>&1); rc=$?
  got=$([ $rc -eq 0 ] && echo allow || echo block)
  if [ "$got" = "$2" ]; then pass=$((pass+1)); echo "  PASS  $1 -> $got"
  else fail=$((fail+1)); echo "  FAIL  $1 -> $got (expected $2)"; echo "$out" | sed 's/^/          /'; fi
}

echo "  -- first commit of an empty repo: unstamped"
echo x > a.txt; git add a.txt
t "empty repo, unstamped" block "no attribution whatsoever"

echo "  -- seeded, then unstamped"
echo y > b.txt; git add b.txt
git commit -q --no-verify -m "[Model: Test Person] feat: seed"
t "stamped HEAD, unstamped subject" block "no attribution whatsoever"

echo "  -- stamped"
echo z > c.txt; git add c.txt
t "stamped subject" allow "[Model: Test Person] feat: a real change"

echo "  -- stamped with a different model name"
echo w > d.txt; git add d.txt
t "different model" allow "[Model: Someone Else] fix: something"

echo "  -- fixup and merge are exempt"
echo v > e.txt; git add e.txt
t "fixup! prefix" allow "fixup! something"
echo u > f.txt; git add f.txt
t "squash! prefix" allow "squash! something"

echo
echo "  $pass passed, $fail failed"
[ $fail -eq 0 ]
