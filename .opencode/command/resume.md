---
description: Load project memory and working tree state, then report where the last session left off.
agent: build
---

Session resume. Do exactly this, then stop and report in at most 10 lines.

1. Read `memory/SESSION.md`, `memory/DECISIONS.md`, `memory/ENVIRONMENT.md`.
2. Run `git log --oneline -10` and `git status --short` (use the workdir, do not `cd`).
3. If `memory/SESSION.md` is stale relative to the working tree, say so in one line and prefer
   the working tree, then update `memory/SESSION.md` to match reality.
4. Report: goal reached, current state, the exact next command, open questions.

If the user already gave a goal in this session, skip straight to executing it — do not spend
tokens restating memory back to them.
