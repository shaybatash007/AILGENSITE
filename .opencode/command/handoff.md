---
description: Write a durable handoff note to memory/SESSION.md before a session ends or compacts.
agent: build
---

Write the handoff note. Optional note from the user: $ARGUMENTS

1. Run `git status --short` and `git log --oneline -5` for accuracy.
2. Rewrite `memory/SESSION.md` with exactly these sections, no others:
   - `Last updated:` — today's date
   - `## Goal reached` — what was accomplished and how it was verified
   - `## Current state` — uncommitted changes, running processes, what is broken or half-done
   - `## Exact next command` — one copy-pasteable command or action
   - `## Open questions` — anything genuinely blocked on the user; omit the section if none
3. Do not invent progress. If something was not verified, write that it was not verified.
4. Report back in 3 lines: what you wrote, the next command, and anything left open.

Run this proactively when context is getting heavy, before compaction — the file is the durable
anchor that survives both compaction and session end.
