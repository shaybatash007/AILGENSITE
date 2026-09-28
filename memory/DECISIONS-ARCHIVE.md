# DECISIONS-ARCHIVE — superseded decisions, kept for provenance

Nothing here is deleted. These entries were active on 2026-09-28 and were rotated out of
`memory/DECISIONS.md` by the archivist because each is now enforced in a stronger place. Read the
"enforced by" pointer before treating an entry as current.

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
