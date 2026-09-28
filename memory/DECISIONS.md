# DECISIONS — architectural decisions that must not be re-litigated

Append-only, newest last. Each entry: `[date | Model]`, decision, why, consequences. Entries
already enforced by `AGENTS.md`, `memory/CORE.md`, `.githooks/` or `scripts/` live in
`memory/DECISIONS-ARCHIVE.md` with a pointer; `/archive` (agent `archivist`) rotates it.

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