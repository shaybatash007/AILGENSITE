---
description: Persist a durable rule, preference, or environment fact to project memory permanently.
agent: build
---

Persist this fact: $ARGUMENTS

1. Classify the fact:
   - Architectural decision, convention, or a stated user preference → `memory/DECISIONS.md`
   - Machine/port/command/trap detail, or a stated workflow preference → `memory/ENVIRONMENT.md`
   - A rule that changes how every session behaves → also add or update the relevant line in
     `AGENTS.md`
   If it fits two files, write it to both; if classification is genuinely ambiguous, write it to
   `DECISIONS.md` and say why in one line.
2. Append to the correct file. Never rewrite or reorder existing entries — these logs are
   append-only, newest last, with a `---` separator and the date as the entry header.
3. Never store a secret, API key, token, or credential. If the input contains one, refuse, tell
   the user, and store only a note that a credential lives in that location.
4. If the fact contradicts an existing entry, do not delete the old one. Append a new entry that
   supersedes it and reference the date of the one it replaces.
5. Confirm in one line: which file, what the entry says.

Use this the moment the user states a preference, so it is never lost at session end.
