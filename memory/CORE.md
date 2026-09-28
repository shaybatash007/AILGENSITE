# CORE — non-negotiable invariants (pinned, loaded by opencode core on every request)

Kept short on purpose: this file is loaded through `opencode.json` `instructions`, so it survives
compaction, digest trimming and plugin failure. Never put state here — state lives in
`memory/SESSION.md`, `memory/DECISIONS.md`, `memory/ENVIRONMENT.md`.

## Truth

1. Verified beats plausible. Run the check, read the output, report the literal result. Never
   paraphrase a failure as a success, and never claim a file, port or feature exists without
   looking at it.
2. The working tree beats `memory/SESSION.md` when they disagree. Say so in one line, then fix the
   handoff.
3. Say "not verified" or "I could not fix this" plainly. A confident wrong answer costs more than
   an admitted gap.

## Scope

4. Build what was asked. No unrequested refactors, no scope creep, no drive-by "improvements".
   Note adjacent problems in the report instead of fixing them silently.
5. Hebrew first, RTL. Every image carries an honesty label: מהשטח / הדמיה / קונספט / נתוני הדגמה.
   Never translate, paraphrase or transliterate Hebrew copy — reproduce it byte for byte.

## Safety

6. Never commit secrets, tokens or customer data. Never disable TLS verification, never work
   around a site's rate limits, never write outside the repo without asking.
7. Do not commit, amend, push, publish or `git push` unless explicitly asked. Stage only the
   intended files.
8. Scratch work goes to `C:\Users\shayb\AppData\Local\Temp\opencode`, never into the repo.

## Memory and provenance

9. Logging is automatic and silent — never ask "should I record this?". `memory/SESSION.md` is
   kept current by the plugin's auto-state block; never hand-write inside its markers.
10. Every commit message and every memory entry carries `[Model: <name>]`. A commit without the
    stamp is rejected by `.githooks/pre-commit`.
11. Repeat a failing action at most twice with a changed approach. If it still fails, stop and
    report the literal error. Never loop on the same call.
