# DECISIONS — architectural decisions that must not be re-litigated

Append-only, newest last. Add with `/remember`. Each entry: date, decision, why, consequences.

---

## 2026-09-28 — Memory lives in markdown files, not in the chat

Decision: the durable memory layer is `AGENTS.md` (rules, auto-loaded by opencode) plus three
files under `memory/`: `SESSION.md`, `DECISIONS.md`, `ENVIRONMENT.md`.

Why: any fact that only exists in a conversation is lost on compaction or session end. Files
survive both, are diffable in git, and are readable without opencode.

Consequences: the agent must write a fact to a file the moment the user states it. If a decision
matters after compaction, it belongs in `DECISIONS.md`, not just in the summary.

## 2026-09-28 — Compaction is configured and hardened, not left to the default

Decision: `opencode.json` sets `compaction.auto: true`, `compaction.prune: true`, an explicit
`tail_turns` and `reserved` buffer. The `memory.ts` plugin appends project-decision context to the
compaction prompt so the summary retains decisions, file paths and Hebrew copy.

Why: the default compaction preserves recent turns verbatim but has no project knowledge. A
long session would otherwise drift on exactly the facts that cost the most to re-derive.

Consequences: the plugin becomes load-bearing. If summaries start losing decisions, check the
plugin's `experimental.session.compacting` hook first.

## 2026-09-28 — Tool output is truncated aggressively to protect the context window

Decision: `tool_output.max_lines: 400`, `max_bytes: 24000`. Full output is written to opencode's
truncation directory and only a preview enters the conversation.

Why: the user reported context filling with heavy terminal logs. Bounding output at the tool layer
is cheaper than trying to remember not to print it.

Consequences: when output is truncated, read the saved file with the read tool instead of
re-running the command with a wider window.

## 2026-09-28 — Autonomy is default-on, with a narrow ask-list

Decision: routine and reversible steps run without confirmation. The agent asks only for
destructive-outside-repo actions, secrets, paid APIs, or genuinely divergent interpretations of the
goal.

Why: the user explicitly does not want to be a passenger approving each step, but silent
destructive actions are a real risk.

Consequences: permission prompts should be rare. If one appears during a routine flow, the
permission config in `opencode.json` is wrong.

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

Decision: `AGENTS.md`, `opencode.json`, `.opencode/` (plugin + commands, minus its gitignored
`node_modules`) and `memory/` are tracked in git so the operating memory travels across machines
and environments.

Why: the memory is project intent, not secrets — it belongs in version control like any other
source of truth, and the plugin/commands must be present for another clone to behave identically.

Consequences: `memory/` is intentionally tracked and must never contain credentials, tokens or
private URLs. Pre-existing uncommitted work (`package.json`, `package-lock.json`, `scripts/`,
`.gitignore`) is left unstaged for a separate decision.
