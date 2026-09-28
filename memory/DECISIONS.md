# DECISIONS — architectural decisions that must not be re-litigated

Append-only, newest last. The agent writes here without being asked; `/archive` (agent
`archivist`) rotates it. Each entry: `[date | Model]`, decision, why, consequences.
Decisions that are fully enforced by `memory/CORE.md` or `AGENTS.md` are moved to
`memory/DECISIONS-ARCHIVE.md` with a pointer, so the injected digest keeps the load-bearing half.

---

## [2026-09-28 | Space Bunny Free] Decision: logging is 100% autonomous, zero manual commands

Decision: the agent writes to `memory/DECISIONS.md`, `memory/SESSION.md` and
`memory/ENVIRONMENT.md` in the same turn as any decision, pattern or code change. The user never
runs `/remember` or `/handoff`; the slash commands remain only as conveniences.

Why: the user explicitly does not want to be a passenger approving bookkeeping mid-flow. Manual
commands also silently fail when the user forgets, which loses exactly the decisions that matter.

Consequences: memory writes are part of "done", not a wrap-up chore. A finished unit of work with
a stale `SESSION.md` is incomplete. Never ask "should I record this?".

## [2026-09-28 | Space Bunny Free] Decision: every commit and memory entry is model-stamped

Decision: commit messages use `[Model: <ModelName>] <action>`; memory entries use
`[YYYY-MM-DD | <ModelName>] Decision: ...` and `Last updated: YYYY-MM-DD | <ModelName>` in
`memory/SESSION.md`.

Why: provenance. When several models work the same repo over weeks, the git log and the decision
log must say which model produced which artifact.

Consequences: the model name is read from the environment, never guessed or carried over from a
stale stamp. An unstamped commit or entry is an incomplete deliverable.

## [2026-09-28 | Space Bunny Free] Decision: the memory architecture is committed to git

Decision: `AGENTS.md`, `opencode.json`, `.opencode/`, `memory/` and `.githooks/` are tracked in
git so the operating memory travels across machines and environments.

Why: the memory is project intent, not secrets — it belongs in version control like any other
source of truth, and the plugin, commands, agents and commit guard must be present for another
clone to behave identically.

Consequences: `memory/` is intentionally tracked and must never contain credentials, tokens or
private URLs.

## [2026-09-28 | Space Bunny Free] Decision: invariants live in CORE.md, loaded by opencode core

Decision: the non-negotiable invariants move to `memory/CORE.md`, listed in `opencode.json`
`instructions`. The digest no longer repeats them; the plugin reports CORE.md as `via instructions`.

Why: the digest is a per-request token cost with a trimming budget, and a `tail` trim drops the
*oldest* entries — which is exactly where load-bearing law accumulates. Files loaded through
`instructions` sit in the system prompt, survive compaction natively, and are never trimmed. The
invariants therefore get the strongest guarantee the runtime offers.

Consequences: if CORE.md grows past ~3k chars it starts costing every request; when that happens,
move detail out to AGENTS.md and keep only the rule in CORE.md.

## [2026-09-28 | Space Bunny Free] Decision: handoff state is machine-generated, not model-asserted

Decision: `.opencode/plugin/memory.ts` writes a `<!-- ailgen:auto -->` block into
`memory/SESSION.md` (refreshed timestamp, model, branch, HEAD, porcelain status), throttled to one
write per 15s and written atomically via temp-file rename. `scripts/handoff.ps1` does the same on
demand. The model owns the prose sections above the markers and never writes inside them.

Why: a handoff note written by the same agent that changed the tree drifts from git — that was the
single largest structural gap in the first review. A cheap `git status --porcelain` in a hook makes
the state self-healing, independent of model quality, and adds a fresh-HEAD signal the doctor can
check.

Consequences: the block is derived data. If it is wrong, the doctor says so instead of the model
having to remember to look. Setting `AILGEN_NO_AUTO_STATE=1` disables it; last-writer-wins still
applies if two agents run simultaneously.

## [2026-09-28 | Space Bunny Free] Decision: memory files are read and written on line boundaries

Decision: the plugin reads only a bounded window of each memory file (never the whole file) and
trims on line boundaries; a single oversized line is hard-cut and flagged. Doctor budgets match the
plugin budgets.

Why: the first implementation read whole files with `readFileSync` and sliced raw char offsets. A
large pasted log cost a full synchronous read on the request path, and a raw slice could split a
Hebrew word or a markdown code fence — silent corruption that then propagates into compaction
summaries.

Consequences: the digest may elide the middle of a file; `npm run doctor` prints exactly how many
chars are dropped per file, so elision is visible instead of hypothetical.

## [2026-09-28 | Space Bunny Free] Decision: the commit guard is a git hook, not a convention

Decision: `.githooks/pre-commit` rejects any subject without `[Model: ...]` and any commit made
while `scripts/doctor.ps1` reports a FAIL. `npm run setup` activates it with
`git config core.hooksPath .githooks` (per-clone, reversible with `git config --unset
core.hooksPath`).

Why: "mandatory attribution" was prose in `AGENTS.md`, which is exactly the kind of rule a model
drops under pressure or at 2am. A hook has no judgement and no memory.

Consequences: commits now fail loudly instead of silently losing provenance. Bypass
(`--no-verify`) is possible and must be justified in the report.

## [2026-09-28 | Space Bunny Free] Decision: no subagent pins a model

Decision: `oracle`, `verifier`, `hebrew-qa` and `archivist` declare no `model:`, so they inherit
the session model. Only `small_model` is pinned, to a free flash model for title/summary generation.

Why: pinning a model in an agent file turns a provider outage or a lapsed key into a broken tool.
Portability across "any model in any session" is a stated requirement, and reasoning quality in
these four roles comes from the prompt contract, not from the checkpoint.

Consequences: to bias a role, change the session model, or add the pin knowingly. If the free Zen
tier lapses, title generation degrades; nothing else does.

## [2026-09-28 | Space Bunny Free] Decision: Hebrew bidi is a renderer problem, not a config problem

Decision: do not attempt to fix Hebrew input direction in the opencode TUI. Ship `npm run he`
(Windows Terminal + UTF-8, for encoding and font coverage) and `npm run web` (browser interface,
where the bidi algorithm exists) and record the limitation in `memory/ENVIRONMENT.md`.

Why: the TUI paints each cell itself and implements no Unicode bidi, so Hebrew is emitted in
logical order and the terminal faithfully displays reversed glyphs. No opencode setting, theme or
font changes that. Web/desktop RTL work exists upstream but is not in the TUI. Diagnosed on this
machine: `Host=ConsoleHost`, no `WT_SESSION`, code page 862 — legacy conhost, which cannot do bidi
at all, and Windows Terminal is installed and available as the partial fix.

Consequences: for Hebrew-heavy sessions, use the browser interface. Hebrew in the TUI is still
safe to *write into files* — the agent reads files, so nothing is lost to the broken renderer.
