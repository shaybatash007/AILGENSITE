# DECISIONS-ARCHIVE — superseded decisions, kept for provenance

Nothing here is deleted. These entries were active on 2026-09-28 and were rotated out of
`memory/DECISIONS.md` by the archivist because each is now enforced in a stronger place. Read the
"enforced by" pointer before treating an entry as current.

## Rotation log

- **2026-09-29** (Space Bunny Free): nine entries moved here to bring `memory/DECISIONS.md` back
  toward its 4000-char budget. They were not deleted and none was contradicted — each was already
  fully enforced by `AGENTS.md`, `memory/CORE.md`, `.githooks/`, `scripts/` or
  `.opencode/plugin/memory.ts`, so keeping the prose in the injected digest only cost tokens. The
  three newest entries (web UI binding bug, eyes as pixels, a visual audit that can doubt itself)
  stayed in `memory/DECISIONS.md`, untouched.
- One partial refinement, not a contradiction: the 2026-09-28 "Hebrew bidi is a renderer problem"
  entry said to use the browser interface for Hebrew-heavy sessions. The later "web UI is not a
  separate scope" entry measured that the web UI cannot even bind this repo, and narrowed the
  advice to: Windows Terminal + TUI is the working path, and the web UI is a Hebrew-rendering
  surface for an already-open session only. The later entry wins.

---

## 2026-09-28 — Memory lives in markdown files, not in the chat

Decision: the durable memory layer is `AGENTS.md` (rules, auto-loaded by opencode) plus files under
`memory/`: `CORE.md`, `SESSION.md`, `DECISIONS.md`, `ENVIRONMENT.md`.

Why: any fact that only exists in a conversation is lost on compaction or session end. Files
survive both, are diffable in git, and are readable without opencode.

Consequences: the agent must write a fact to a file the moment the user states it.

Enforced by: `AGENTS.md` (deterministic layer, session start protocol) and
`memory/DECISIONS.md` (autonomous logging, CORE.md).

---

## 2026-09-28 — Compaction is configured and hardened, not left to the default

Decision: `opencode.json` sets `compaction.auto: true`, `compaction.prune: true`, an explicit
`tail_turns` and `reserved` buffer. The `memory.ts` plugin appends project-decision context to the
compaction prompt so the summary retains decisions, file paths and Hebrew copy.

Why: the default compaction preserves recent turns verbatim but has no project knowledge. A long
session would otherwise drift on exactly the facts that cost the most to re-derive.

Consequences: the plugin becomes load-bearing. If summaries start losing decisions, check the
plugin's `experimental.session.compacting` hook first, and check that `memory/CORE.md` is still
listed in `instructions`.

Enforced by: `opencode.json` (`compaction`), the plugin's `session.compacting` hook, and the config
floors the plugin re-asserts on every start.

---

## 2026-09-28 — Tool output is truncated aggressively to protect the context window

Decision: `tool_output.max_lines: 400`, `max_bytes: 24000`. Full output is written to opencode's
truncation directory and only a preview enters the conversation.

Why: the user reported context filling with heavy terminal logs. Bounding output at the tool layer
is cheaper than trying to remember not to print it.

Consequences: when output is truncated, read the saved file with the read tool instead of
re-running the command with a wider window.

Enforced by: `opencode.json` (`tool_output`) plus the plugin's config floor, which raises the caps
if a later edit lowers them.

---

## 2026-09-28 — Autonomy is default-on, with a narrow ask-list

Decision: routine and reversible steps run without confirmation. The agent asks only for
destructive-outside-repo actions, secrets, paid APIs, or genuinely divergent interpretations of the
goal.

Why: the user explicitly does not want to be a passenger approving each step, but silent
destructive actions are a real risk.

Consequences: permission prompts should be rare. If one appears during a routine flow, the
permission config in `opencode.json` is wrong.

Enforced by: `AGENTS.md` (autonomy rules) and `opencode.json` `permission` (the ask-list that makes
the ask-list enforceable rather than aspirational).

---

## [2026-09-28 | Space Bunny Free] Decision: logging is 100% autonomous, zero manual commands

Decision: the agent writes to `memory/DECISIONS.md`, `memory/SESSION.md` and
`memory/ENVIRONMENT.md` in the same turn as any decision, pattern or code change. The user never
runs `/remember` or `/handoff`; the slash commands remain only as conveniences.

Why: the user explicitly does not want to be a passenger approving bookkeeping mid-flow. Manual
commands also silently fail when the user forgets, which loses exactly the decisions that matter.

Consequences: memory writes are part of "done", not a wrap-up chore. A finished unit of work with
a stale `SESSION.md` is incomplete. Never ask "should I record this?".

Enforced by: `AGENTS.md` ("100% autonomous logging (zero manual commands) — PERMANENT") and
`memory/CORE.md` rule 9 ("Logging is automatic and silent"). Rotated 2026-09-29.

---

## [2026-09-28 | Space Bunny Free] Decision: every commit and memory entry is model-stamped

Decision: commit messages use `[Model: <ModelName>] <action>`; memory entries use
`[YYYY-MM-DD | <ModelName>] Decision: ...` and `Last updated: YYYY-MM-DD | <ModelName>` in
`memory/SESSION.md`.

Why: provenance. When several models work the same repo over weeks, the git log and the decision
log must say which model produced which artifact.

Consequences: the model name is read from the environment, never guessed or carried over from a
stale stamp. An unstamped commit or entry is an incomplete deliverable.

Enforced by: `AGENTS.md` ("Model attribution and stamping — PERMANENT") and `.githooks/pre-commit`,
which rejects an unstamped subject and also refuses to commit while the doctor reports a FAIL.
`scripts/doctor.ps1` reports unstamped commits as a WARN. Rotated 2026-09-29.

---

## [2026-09-28 | Space Bunny Free] Decision: the memory architecture is committed to git

Decision: `AGENTS.md`, `opencode.json`, `.opencode/`, `memory/` and `.githooks/` are tracked in
git so the operating memory travels across machines and environments.

Why: the memory is project intent, not secrets — it belongs in version control like any other
source of truth, and the plugin, commands, agents and commit guard must be present for another
clone to behave identically.

Consequences: `memory/` is intentionally tracked and must never contain credentials, tokens or
private URLs.

Enforced by: the tracked file set itself plus `AGENTS.md` (session start protocol, safety rules:
never commit secrets, tokens or customer data). `memory/CORE.md` rule 6. Rotated 2026-09-29.

---

## [2026-09-28 | Space Bunny Free] Decision: invariants live in CORE.md, loaded by opencode core

Decision: the non-negotiable invariants move to `memory/CORE.md`, listed in `opencode.json`
`instructions`. The digest no longer repeats them; the plugin reports CORE.md as `via instructions`.

Why: the digest is a per-request token cost with a trimming budget, and a `tail` trim drops the
*oldest* entries — which is exactly where load-bearing law accumulates. Files loaded through
`instructions` sit in the system prompt, survive compaction natively, and are never trimmed. The
invariants therefore get the strongest guarantee the runtime offers.

Consequences: if CORE.md grows past ~3k chars it starts costing every request; when that happens,
move detail out to AGENTS.md and keep only the rule in CORE.md.

Enforced by: `opencode.json` `instructions` (which lists `AGENTS.md`, `CLAUDE.md` and
`memory/CORE.md`) and the plugin's self-healing config floor, which re-asserts that list on every
start and reports `loaded: CORE (via instructions)`. `npm run doctor` prints the CORE budget.
Rotated 2026-09-29.

---

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

Enforced by: `.opencode/plugin/memory.ts` (the `tool.execute.after` hook) and
`scripts/handoff.ps1`, both of which own the block; `npm run handoff` refreshes it. `AGENTS.md` and
`memory/CORE.md` rule 9 forbid hand-writing inside the markers. Rotated 2026-09-29.

---

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

Enforced by: `.opencode/plugin/memory.ts` (bounded, line-aligned reads) and the memory-budget check
in `scripts/doctor.ps1`, which prints `chars / digest budget / actually injected` per file and
WARNs when a file outgrows its budget. Rotated 2026-09-29.

---

## [2026-09-28 | Space Bunny Free] Decision: the commit guard is a git hook, not a convention

Decision: `.githooks/pre-commit` rejects any subject without `[Model: ...]` and any commit made
while `scripts/doctor.ps1` reports a FAIL. `npm run setup` activates it with
`git config core.hooksPath .githooks` (per-clone, reversible with `git config --unset
core.hooksPath`).

Why: "mandatory attribution" was prose in `AGENTS.md`, which is exactly the kind of rule a model
drops under pressure or at 2am. A hook has no judgement and no memory.

Consequences: commits now fail loudly instead of silently losing provenance. Bypass
(`--no-verify`) is possible and must be justified in the report.

Enforced by: `.githooks/pre-commit` itself, activated per clone by `scripts/setup.ps1`; `npm run
doctor` reports `commit guard: installed`. `AGENTS.md` documents the bypass. Rotated 2026-09-29.

---

## [2026-09-28 | Space Bunny Free] Decision: no subagent pins a model

Decision: `oracle`, `verifier`, `hebrew-qa` and `archivist` declare no `model:`, so they inherit
the session model. Only `small_model` is pinned, to a free flash model for title/summary generation.

Why: pinning a model in an agent file turns a provider outage or a lapsed key into a broken tool.
Portability across "any model in any session" is a stated requirement, and reasoning quality in
these four roles comes from the prompt contract, not from the checkpoint.

Consequences: to bias a role, change the session model, or add the pin knowingly. If the free Zen
tier lapses, title generation degrades; nothing else does.

Enforced by: the agent files themselves in `.opencode/agent/*.md`, which carry no `model:` key, and
`AGENTS.md` ("Project subagents, all defined in `.opencode/agent/` with no pinned model so they
inherit whatever model the session uses"). Rotated 2026-09-29.

---

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

Partially superseded by: the 2026-09-28 "the web UI is not a separate scope, and the empty UI is a
client-side binding bug" entry, still in `memory/DECISIONS.md`. It measured that on opencode
1.18.33 the web UI cannot bind a repo outside `$HOME`, so the browser interface is a
Hebrew-rendering surface for an already-open session, not the primary working path. The
conclusion that the TUI cannot do bidi stands.

Enforced by: `AGENTS.md` ("Hebrew and RTL — the honest state of things"), the machine facts in
`memory/ENVIRONMENT.md` ("Terminal and Hebrew"), and the terminal/code-page check in
`scripts/doctor.ps1`. Rotated 2026-09-29.
