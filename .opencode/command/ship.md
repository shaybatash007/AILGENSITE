---
description: Pre-ship gate. Verify the claim independently, run the doctor, sync memory, then commit with the model stamp. Never pushes.
agent: build
---

Ship the current work. Target: $ARGUMENTS

1. **State the claim.** One sentence: what is true now that was not true before. If you cannot write
   that sentence, stop and say what is missing.
2. **Verify it independently.** Delegate to the `verifier` subagent with that one sentence. It finds
   and runs the real check. Read its literal output. A claim you did not verify does not ship.
3. **Review it adversarially.** Delegate to the `oracle` subagent over `git diff HEAD`. Fix only
   findings that are real and in scope; note the rest in the report.
4. **Doctor.** Run `powershell -NoProfile -ExecutionPolicy Bypass -File scripts\doctor.ps1`. The
   commit guard blocks on FAIL, so fix those now.
5. **Hebrew gate.** If the diff contains any Hebrew text, delegate to the `hebrew-qa` subagent.
   Missing honesty labels are FAIL.
6. **Memory.** Append any decision or machine fact this work produced to `memory/DECISIONS.md` or
   `memory/ENVIRONMENT.md` with the `[YYYY-MM-DD | <ModelName>]` stamp, rewrite the
   `memory/SESSION.md` sections to match reality, then run `scripts/handoff.ps1`. Logging is silent
   and automatic — never ask permission for it.
7. **Commit.** Stage only the files this work touched. Subject line: `[Model: <ModelName>] <type>: <imperative summary under 72 chars>`. The model name comes from the environment, never from memory of an earlier session.
8. **Stop.** Do not push, do not open a PR, do not amend. Report the commit hash, what was verified
   and how, and anything still unverified.
