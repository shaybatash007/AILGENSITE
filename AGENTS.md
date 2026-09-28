# AGENTS.md — AILGENSITE operating memory

This file is loaded automatically on every opencode launch in this repo. It is the persistent
memory layer: preferences, environment quirks and project rules live here so they never need to be
re-explained in a new session. See `CLAUDE.md` for the studio's brand/content conventions.

## Session start protocol

1. Read `memory/SESSION.md` — the handoff note from the last session (goal, state, next step).
2. Read `memory/DECISIONS.md` — architectural decisions that must not be re-litigated.
3. Read `memory/ENVIRONMENT.md` — machine quirks, ports, commands, known traps.
4. Run `/resume` (or `git log --oneline -10` + `git status`) to confirm the working tree state.
5. Then execute the user's goal end-to-end. Do not ask for confirmation on routine steps.

If `memory/SESSION.md` is stale relative to the working tree, trust the working tree and say so
in one line, then update the handoff.

## 100% autonomous logging (zero manual commands) — PERMANENT

The user never runs `/remember`, `/handoff` or any other memory command during work. Logging is
the agent's job and happens in the background, unprompted.

- After any architectural decision, technical pattern, or codebase modification, append an entry
  to `memory/DECISIONS.md` (decision / why / consequences) in the same turn — do not batch it for
  the end of the session and do not wait for the user to ask.
- Keep `memory/SESSION.md` continuously refreshed: after each completed unit of work update goal
  reached, current state, exact next command, open questions. A restart must be able to resume
  from that file alone.
- Machine facts and traps go to `memory/ENVIRONMENT.md` as they are discovered.
- The slash commands (`/remember`, `/handoff`, `/memory`, `/resume`, `/verify`) still exist for
  the user's convenience, but they are optional conveniences, never a prerequisite.
- Never ask the user "should I record this?" — just write it.

## Model attribution and stamping — PERMANENT

Every artifact must name the model that produced it.

- Commit messages: `[Model: <ModelName>] <action>`, e.g.
  `[Model: Space Bunny Free] feat: initialize persistent memory architecture and operating agents`.
  Read the model name from the environment/system prompt; do not guess or reuse a stale stamp.
- Memory entries: `[YYYY-MM-DD | <ModelName>] Decision: ...` as the entry header in
  `memory/DECISIONS.md`, and the same stamp in the `Last updated` line of `memory/SESSION.md`.
- A commit or memory entry without a model stamp is an incomplete deliverable.

## Memory maintenance commands

- `/remember <fact>` — append a durable rule or preference to `memory/DECISIONS.md` or
  `memory/ENVIRONMENT.md`.
- `/handoff [note]` — write `memory/SESSION.md`.
- `/memory` — print the current memory digest without touching anything.
- The `.opencode/plugin/memory.ts` plugin re-injects a compact digest of these files into the
  system prompt on every request, and hardens the compaction prompt so summaries preserve
  decisions, file paths and Hebrew copy. Do not delete it.

## Autonomy rules

- Run the flow end-to-end. Do not stop to ask about intermediate steps that are reversible or
  already implied by the goal.
- Ask only when: the action is destructive and outside the repo, a credential or secret is
  involved, a paid/external API is called, or two interpretations of the goal would produce
  materially different deliverables.
- Always verify results: run the check, read the output, confirm. Do not report success on an
  unverified claim.
- Keep the environment clean: no stray temp files in the repo, no leftover background servers,
  no committed secrets. Use `C:\Users\shayb\AppData\Local\Temp\opencode` for scratch work.
- Never commit, amend, push or open a PR unless explicitly asked. When asked, stage only intended
  files.
- Use `todowrite` for any task with 3+ steps and keep exactly one item `in_progress`.

## Context and compaction discipline

Long sessions fill the window with terminal logs. To keep it healthy:

- Never dump whole files or whole directory listings into the conversation. Use `grep`/`glob`
  to locate, then `read` with a bounded `offset`/`limit`.
- Prefer `rg` via bash for counting matches; prefer the grep tool for locating them.
- Treat `npm run build`, `git log`, and crawl output as streamed-and-summarized, not pasted.
- When context gets heavy, say so and run `/handoff` before compaction so the summary has a
  durable anchor on disk. Auto-compaction preserves the last turns verbatim; the plugin adds
  the project decisions on top of that.
- If a fact must survive compaction, it must exist in a file, not only in the chat.

## Repo conventions (restated for the agent)

- Static HTML/CSS/JS, no build step. Serve with `npm run dev` (`scripts/dev.ps1`, port 8000);
  `npm run down` to stop. `python3 -m http.server` also works.
- Hebrew first, RTL. Every image carries an honesty label: מהשטח / הדמיה / קונספט / נתוני הדגמה.
- New project working files go in `projects/<slug>/`. `projects/<slug>/out/` is render output and
  is gitignored. Deliverables that ship live in `projects/<slug>/demo/`.
- Business → site/brand/film/ads/case requests follow the `ailgen-studio` skill at
  `.claude/skills/ailgen-studio/SKILL.md`.
- Live published versions are Claude artifacts: read the live source in full before republishing.
- Never disable TLS verification and never work around a site's rate limits.

## Environment (Windows 11)

- Shell is Windows PowerShell 5.1. `&&` does not work — use `; if ($?) { ... }`.
- Prefer full cmdlet names (`Get-ChildItem`, `Set-Content`) over aliases.
- Use the `workdir` parameter instead of `cd`.
- Do not use shell file cmdlets for reading/writing/searching files; use the read/write/edit/
  glob/grep tools instead.
- Long-running commands need an explicit `timeout` in milliseconds.
