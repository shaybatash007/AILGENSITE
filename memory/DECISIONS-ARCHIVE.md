# DECISIONS-ARCHIVE — superseded decisions, kept for provenance

Nothing here is deleted. These entries were active on 2026-09-28 and were rotated out of
`memory/DECISIONS.md` by the archivist because each is now enforced in a stronger place, superseded
by a later measurement, or both. Read the "Enforced by" / "Superseded by" pointer before treating an
entry as current. Every entry keeps the stamp of the model that wrote it.

## Rotation log

- **2026-10-01, third pass** (Space Bunny Free): the two remaining 2026-09-29 entries moved here -
  the forward-slash path spelling and rehearse-before-write. Both are now enforced verbatim by
  `AGENTS.md` (the `canon:check` / `canon:apply` / `test:mutate` rows), by the code in
  `tools/canonicalize-paths.mjs`, and by `npm run test:canon` + `npm run test:mutate`, which
  reintroduce each destructive bug class and require the fixture to fail. The verbatim text of both
  is kept below, and is also recoverable from git. The two 2026-10-01 entries (declared KV
  namespace id; "no tracking" copy and an honest probe) stay active: they are the only record of a
  budget ceiling that shipped unenforced.
- **2026-09-29, second pass** (Space Bunny Free): five more entries moved here - the web UI client
  binding bug, eyes as pixels plus rules, a visual audit that can doubt itself, WMI daemon
  creation, and the `$HOME` relocation tool. Four of the five are now enforced verbatim by
  `AGENTS.md` or by the tool they describe; the web UI entry is still an open upstream bug and is
  tracked in `memory/SESSION.md`; the `$HOME` entry is superseded by the forward-slash spelling
  entry. The two 2026-09-29 entries (forward-slash spelling, rehearse-before-write) stayed active,
  as the only record of a real data-loss incident. This supersedes the first bullet's list of what
  stayed: the "eyes as pixels" and "a visual audit that can doubt itself" entries are now archived
  too, and only the web UI entry of that earlier list was still active between the two passes.
- **2026-09-29** (Space Bunny Free): nine entries moved here to bring `memory/DECISIONS.md` back
  toward its 4000-char budget. They were not deleted and none was contradicted — each was already
  fully enforced by `AGENTS.md`, `memory/CORE.md`, `.githooks/`, `scripts/` or
  `.opencode/plugin/memory.ts`, so keeping the prose in the injected digest only cost tokens. The
  three newest entries (web UI binding bug, eyes as pixels, a visual audit that can doubt itself)
  stayed in `memory/DECISIONS.md`, untouched at that time.
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

---

## [2026-09-28 | Space Bunny Free] Decision: the web UI is not a separate scope, and the empty UI is a client-side binding bug

Decision: stop treating `npm run web` as needing its own configuration. The web client and the CLI
are one process against one database. The fix is not a sync step; it is a project binding in the UI.

Why: proven on this machine, not assumed. `opencode web` (PID 30696, started by `scripts/he.ps1
-Web`) serves the same `opencode.db` and the same `auth.json` (`nvidia`, `zenmux`) as the CLI.
`GET /session` and `GET /api/session?limit=5000` both return all 13 sessions, all under
`C:/mastercoding/AILGENSITE`; `GET /project` returns the git worktree. So there is nothing to
synchronise and nothing to re-configure. What actually happens: the web client fetches
`/api/session`, receives all 13 sessions, and still renders "Nothing here yet". It never calls
`/project/current`, never binds a project, and filters the project list to descendants of its bound
directory. `GET /path` reports `home = C:\Users\shayb`, and the in-app "Add project" picker is
rooted there. The repo lives at `C:\mastercoding\AILGENSITE`, outside home, so it is unreachable
from the picker. `opencode://open-project?directory=...` deep links exist in the bundle but are
gated behind `platform === "desktop"`, so they cannot help a browser. `?directory=` on the page URL
does not bind the client store (verified: still empty). No localStorage key persists the choice.

Consequences: on opencode 1.18.33, a project outside `$HOME` is invisible and unselectable in the
web UI. Until upstream fixes it, the TUI in Windows Terminal is the unified working path, and the
web UI is a Hebrew-rendering surface for an already-open session. Do not add a "sync the web UI"
step to any script; there is no state to move. A directory junction under `$HOME` was considered and
rejected: sessions are keyed by the directory string, so a junction would register a second, empty
project rather than the real one.

Enforced by: `AGENTS.md` ("Hebrew and RTL — the honest state of things", which states the working
path is TUI in Windows Terminal and the web UI is a rendering surface only) and the measured
endpoint behaviour in `memory/ENVIRONMENT.md` ("Browser automation", archived in
`memory/ENVIRONMENT-ARCHIVE.md`). The open status is tracked in `memory/SESSION.md` ("Still open,
and still the upstream client bug").

Partially superseded by: the 2026-09-29 "opencode's canonical path spelling is FORWARD slashes"
entry, active in `memory/DECISIONS.md`. That entry measured a second, independent cause of the same
empty UI — the path string mismatch, since fixed — so "unreachable from the picker because the repo
is outside `$HOME`" is only half the story. The client-side binding bug diagnosed here is real and
still open. Rotated 2026-09-29.

---

## [2026-09-28 | Space Bunny Free] Decision: the agent gets eyes as pixels plus deterministic rules, not as a screenshot

Decision: ship two complementary layers and require both. `playwright-mcp` in `opencode.json` is
the hands (click, type, navigate, read the a11y tree) and is inherited by every agent in every
session of this repo. `tools/eyes.mjs` is the diagnostic layer: one pass returns a real Chromium
screenshot, computed styles, layout shifts, console and network state, and rule findings, and exits
non-zero on FAIL so it can gate a commit like `doctor` does.

Why: a screenshot shows what is present. The defects that cost real time are the absent ones - a
clipped element, an overflowing column, an image that never loaded, a Hebrew run laid out LTR, a
contrast failure. Judging those from pixels alone is where a vision model starts guessing, and a
confident wrong answer is worse than an admitted gap. Measured, the rules found on the homepage
that the fold screenshot did not show: a Hebrew button computing `direction:ltr`, a Latin domain
mixed with Hebrew with no `unicode-bidi`, and 23 sub-44px tap targets on mobile.

Consequences: `eyes.mjs` must be read for its findings and the PNG must be opened and looked at;
either alone is insufficient. The suite found three false positives on its first real run against
the production homepage, all three fixed in the tool rather than in the site - see the next entry.

Enforced by: `AGENTS.md` ("Browser eyes (the agent can see)", section 1 = the Playwright MCP hands
and section 2 = `tools/eyes.mjs` as the diagnostic layer that exits non-zero on FAIL, including the
rule that both must be used) and `memory/CORE.md` rule 1 ("Verified beats plausible"). The tool
itself is `tools/eyes.mjs`, wired as `npm run eyes` / `npm run eyes:all`. Rotated 2026-09-29.

---

## [2026-09-28 | Space Bunny Free] Decision: a visual audit must be able to doubt itself

Decision: `tools/eyes.mjs` carries three self-correction mechanisms, because on its first run
against the real homepage it produced three confident wrong answers, each of which would have been
worse than no tool at all.

Why: the three false positives, and what each one taught.
1. **Wrong background compositing.** The effective-background walk composited translucent layers
   over *white* instead of over the first opaque ancestor, inventing `rgb(191,191,191)` under
   dark-navy text and reporting 1.11:1 contrast on the footer links. 5 phantom contrast failures.
   Fixed by collecting layers nearest-first and applying them farthest-first over the opaque
   ancestor. Contrast failures dropped 5 -> 2, and the 2 survivors were the real ones.
2. **Splash mistaken for a broken page.** The hero is a timed intro. At the default 900ms settle the
   whole first screen is an empty dark field, and the site looks catastrophically broken - 16,683px
   of content hidden behind an unplayed animation. Fixed by measuring text in the fold
   (`capture/possible-intro`) and by segmenting tall pages instead of emitting one illegible
   full-page PNG. Re-running at `--settle 7000` showed a correct, well-composed RTL hero.
3. **Hidden placeholder image counted as broken.** `#benchMeImg` sits in a `hidden` figure with no
   `src` until script fills it; it was reported as a failed load. Load state now only matters for
   elements the user can see. `alt` is still checked on hidden images, because that is a DOM
   concern rather than a rendering one.

Consequences: a rule engine with no way to say "this is on purpose" trains the user to ignore it,
and an agent that reports a design flaw the designer intended is worse than an agent that reports
nothing. Intentional cases are suppressed per-finding in `projects/_eyes/ignore.json` with a written
reason, never per-rule. The remaining honest state of the homepage: one real FAIL
(`rtl/hebrew-in-ltr-box`, a Hebrew button computing `direction:ltr`, consistent across all three
viewports), one real WARN (`rtl/mixed-content-flex`, a Latin domain mixed into Hebrew in a flex
container with no `unicode-bidi`), and 23 sub-44px tap targets on mobile.

Enforced by: the rule code in `tools/eyes.mjs` itself (`capture/possible-intro`, the opaque-ancestor
compositing walk, the visibility gate on load state), the per-finding exemption file
`projects/_eyes/ignore.json`, and `AGENTS.md` ("Rules learned the hard way, from real runs against
this site": `--settle 7000`, `--max-fullpage` 4000, `--segments N`, "Actually look", and "suppress
the case, never the whole rule"). The residual homepage findings are reproduced in
`AGENTS.md` and in `memory/SESSION.md`. Rotated 2026-09-29.

---

## [2026-09-28 | Space Bunny Free] Decision: daemons are created through WMI, because the agent shell waits on the whole process tree

Decision: all long-running services are started by `tools/supervisor.mjs`, which creates the
process via `Win32_Process::Create`. No daemon may be launched from a foreground tool call by any
other means.

Why: three freezes of the agent loop, and the intuitive explanation was wrong. Stream redirection,
`detached: true`, `windowsHide: true` and `unref()` are all insufficient, because the runner does
not wait for the foreground command to finish - it waits for the entire process tree. Measured: a
child with explicit file-descriptor stdio, so it held no pipe whatsoever, still froze the runner for
the full timeout. WMI creation returns in 0.19s and the created process keeps running, because it
is parented by the WMI host and never enters the runner's tree. Secondary finding: `Start-Process`
on a `.cmd` shim returns the `cmd.exe` wrapper, not the server, so stopping it orphans the real
listener while appearing to succeed - observed here as tracked 41944/32316 against actual listeners
45132/29904.

Consequences: `.launch/state.json` plus `supervisor status|gc|doctor` is the source of truth for
what is running. `taskkill /T` only. Launch real executables, never shims, so one process is tracked
per service. Never probe with `Invoke-WebRequest` in a retry loop. The mandate is in `AGENTS.md`
under "Non-blocking execution" and the traps in `memory/ENVIRONMENT.md`.

Enforced by: `AGENTS.md` ("Non-blocking execution (non-negotiable)", all seven numbered rules, which
restate this entry nearly verbatim), the WMI implementation in `tools/supervisor.mjs` and its shim
resolver, `node tools/supervisor.mjs gc` as the documented cleanup path, and the measured traps in
`memory/ENVIRONMENT.md` ("Non-blocking execution"). Rotated 2026-09-29.

---

## [2026-09-28 | Space Bunny Free] Decision: the $HOME relocation is a rehearsed, one-shot tool, not an in-agent move

Decision: the repo moves to `%USERPROFILE%\projects\AILGENSITE` via `tools/migrate-home.mjs`, run
once by the user from a normal terminal with opencode closed.

Why: the move cannot be performed by the agent that would perform it. Windows returns EBUSY for a
rename of a directory that is a live process's working directory - measured, blocked while a holder
ran and succeeded immediately after killing it - and the agent is an opencode process rooted in
that directory. The tool therefore refuses to run when it detects opencode, and the SQL was
rehearsed against a copy of the real database: 16 rows repointed (1 project, 1 project_directory,
14 sessions), 14 sessions attached to the new root, 0 old-root rows remaining, and the 538-message /
2228-part tree untouched. The rehearsal also proved the correct target count is 14, not 15: a stray
session rooted at `C:/Users/shayb/Videos` belongs to no project and must stay put.

Consequences: a junction under `$HOME` is still rejected - it yields 0 sessions against 14 on the
real path, because the directory string is the key and it does not canonicalise. Rewriting those
strings is the whole point of the migration. Backup and rollback are built in: the tool checkpoints
the WAL before copying, so the restore is complete.

Enforced by: the tool itself, `tools/migrate-home.mjs`, which refuses to run with opencode live and
checkpoints the WAL. The general method it established - rehearse the transformation on a copy and
assert before touching the live file - is now a standing rule in the 2026-09-29 "a database tool
rehearses on a copy" entry, active in `memory/DECISIONS.md`.

Superseded in part by: the 2026-09-29 "opencode's canonical path spelling is FORWARD slashes" entry
(active in `memory/DECISIONS.md`), which measured that this migration wrote the backslash form into
a database opencode spells with forward slashes. The rehearsal proved the row counts right and could
not catch the spelling, because nothing compared against what opencode itself had written. The
migration has been run; the repo is at `%USERPROFILE%\projects\AILGENSITE`. Rotated 2026-09-29.

---

## [2026-09-29 | Space Bunny Free] Decision: opencode's canonical path spelling is FORWARD slashes, and the migration wrote them backwards

Decision: the canonical form for a Windows path in `opencode.db` is `C:/Users/shayb/...`, not
`C:\Users\shayb\...`. `tools/canonicalize-paths.mjs` normalises to forward slashes, and
`tools/migrate-home.mjs` is the tool that introduced the wrong spelling.

Why: measured on `opencode.db.bak_1790663969179`, the pre-migration database, which opencode itself
had written over days: `project.worktree`, `project_directory.directory` and all 14 sessions were
`C:/mastercoding/AILGENSITE`. The `Videos` session, also written by opencode, was
`C:/Users/shayb/Videos`. Every session opencode created after the move is forward-slash too. The
backslashes appeared only after `migrate-home.mjs` ran. The migration's intent was right and its
spelling was wrong, so it rewrote 14 rows into a form opencode does not recognise, added a second
`project_directory` row instead of updating the existing one, and left the Web UI with a project
that resolved to no sessions. The premise of the first `canonicalize-paths.mjs` - "native Windows
form means backslashes" - was the exact inverse of the truth.

Consequences: the correct repair is the reverse direction. After the fix, 15 sessions share one
string (`C:/Users/shayb/projects/AILGENSITE`), the duplicate `project_directory` row is gone, and
`GET /api/session?directory=C:/Users/shayb/projects/AILGENSITE` returns all 15. The Web UI still
renders "Nothing here yet" - that is the client-side binding bug archived on 2026-09-28, and
repairing the data did not fix it. Any tool that writes a path into this database must copy
opencode's spelling, not Windows'.

Enforced by: `AGENTS.md` (the `canon:check` / `canon:apply` row: "Normalise every path column in
`opencode.db` to the spelling opencode itself writes (forward slashes)"), the `canon()` function in
`tools/canonicalize-paths.mjs`, and `npm run test:canon`, whose fixture asserts the forward-slash
form against a copy of the live database's real schema. Rotated 2026-10-01.

## [2026-09-29 | Space Bunny Free] Decision: a database tool rehearses on a copy and proves non-destruction before it opens the real file for writing

Decision: `tools/canonicalize-paths.mjs` runs its exact transformation against a `VACUUM INTO` copy
first, and refuses to touch the live file unless the copy produced the expected result. A
row-count invariant runs over every table, and only a dedupe declared per table may lose a row.

Why: the first version of this tool destroyed 14 sessions, 675 messages and 2,825 parts. Its
dedupe step was `DELETE FROM session WHERE directory = ? AND directory != ?` - the second predicate
excludes exactly what the first one selects, so it was true for every row it matched and it deleted
the entire non-canonical spelling. The `UPDATE` that followed matched zero rows and reported
success. The run that was mid-write then started throwing `Failed query: insert into "part"`, which
is how the loss was finally noticed, several sessions later. Three things would each have caught it
and none were there: no rehearsal, no row-count assertion, and a dedupe predicate that was never
executed against a fixture.

Consequences: the rehearsal is not optional decoration - it is what makes the live write safe to
attempt, and it also caught a wrong `canon()` in the rewritten version, before it reached the real
database. A 24-check fixture at `tools/test-canonicalize.mjs` (`npm run test:canon`) reproduces the
live database's exact shape, including the duplicate `project_directory` row and a path-in-primary-key
collision that must be refused. The general rule: a tool that writes to a store holding irreplaceable
history gets a copy, an assertion, and a fixture, in that order. Recovery, when it is needed, is
additive - `INSERT OR IGNORE` from a pre-deletion snapshot, which is how the 14 sessions were
restored from `~/.local/share/opencode/backups/opencode-2026-09-29T06-47-55-166Z.db` — the opencode
data directory, NOT the repo, which has no `backups/`.

Enforced by: `AGENTS.md` (the `canon:check` / `canon:apply` row: "`--apply` rehearses on a
`VACUUM INTO` copy, proves non-destruction per table, then backs up via `VACUUM INTO` and requires
`PRAGMA integrity_check` = ok before touching live"), the rehearsal and row-count assertion in
`tools/canonicalize-paths.mjs`, and `npm run test:mutate`, which reintroduces each destructive bug
class into a copy of the tool and requires the fixture to fail on every one. Rotated 2026-10-01.

