# AGENTS.md — AILGENSITE operating memory

This file is loaded automatically on every opencode launch in this repo. It is the persistent
memory layer: preferences, environment quirks and project rules live here so they never need to be
re-explained in a new session. `memory/CORE.md` holds the short list of non-negotiable invariants
and is loaded right after this file. See `CLAUDE.md` for the studio's brand/content conventions.

## The deterministic layer (prefer these over your own judgment calls)

Anything a script can measure, a script measures. Do not guess state; read it.

| Command | What it does | Use it when |
| --- | --- | --- |
| `npm run doctor` | Config validity, memory budgets, handoff freshness, commit attribution, Hebrew copy integrity, terminal/RTL diagnosis | start of a session, before a commit, when something feels wrong |
| `npm run resume` | Prints handoff + git log/status + auto-state + a STALE/FRESH verdict | resuming work; `/resume` runs it for you |
| `npm run handoff` | Rewrites the machine state block in `memory/SESSION.md` and stamps the model | after a unit of work, before committing |
| `npm run setup` | Installs the `[Model: ...]` commit guard (`core.hooksPath = .githooks`), then doctor | once per clone, and after a fresh machine |
| `npm run save` / `npm run restore` | Local snapshot of the site into gitignored `versions/` | before handing over a folder of assets |
| `npm run he` | Relaunches opencode in Windows Terminal with UTF-8 | legacy conhost console |
| `npm run web` | Starts the browser interface — the only place Hebrew renders correctly today | any Hebrew-heavy session |
| `npm run dev` / `npm run down` | Serve the site on port 8000 / stop it | previewing a change |
| `npm run eyes -- --url <u>` | Screenshots a page at 3 viewports + audits layout, RTL, a11y, contrast, console and network. Exits non-zero on FAIL | any visual or CSS work; before claiming a page "looks right" |
| `npm run eyes:all` | Same, forced responsive (mobile + tablet + desktop) | before shipping a page |

`scripts/doctor.ps1` exits non-zero only on FAIL; WARN is informational. Read the tool output — do
not paraphrase a clean result you did not see.

## Session start protocol

1. Run `/resume` (or `npm run resume`). It reads `memory/SESSION.md`, prints the git facts and
   returns a STALE/FRESH verdict.
2. If it says STALE, trust the working tree, say so in one line, and rewrite the handoff sections
   to match reality. Then run `npm run handoff`.
3. `memory/DECISIONS.md` (decisions that must not be re-litigated) and `memory/ENVIRONMENT.md`
   (machine facts) are injected into every request by `.opencode/plugin/memory.ts` — you already
   have them; you do not need to re-read them to begin.
4. Then execute the user's goal end-to-end. Do not ask for confirmation on routine steps.

## Commands

`/resume` `/handoff` `/remember` `/memory` `/verify` — memory and verification.
`/doctor` — environment health check with fixes. `/ship` — the pre-ship gate (verify, review,
doctor, Hebrew gate, memory, commit; never pushes). `/review` — adversarial review of the
uncommitted diff. `/hebrew` — Hebrew/RTL quality gate. `/archive` — rotate and re-stamp memory.

## Agents

Built-in: `build` (primary, full access), `plan` (primary, no edits), `general`, `explore`.

Project subagents, all defined in `.opencode/agent/` with no pinned model so they inherit whatever
model the session uses:

- `oracle` — adversarial architecture reviewer. Ranks failure modes by likelihood x damage, cites
  `file:line`, never fixes anything. Use before shipping anything non-trivial.
- `verifier` — independent verification. Finds the check that would prove a claim, runs it, reports
  the literal result. Read-only by design: a verifier that edits what it verifies destroys its
  evidence.
- `hebrew-qa` — Hebrew/RTL gate: verbatim copy, final letter forms, honesty labels, bidi safety.
- `archivist` — the only agent allowed to rotate and rewrite the memory layer.

Delegation rule: verify with `verifier` before any commit that claims something works; review with
`oracle` before any commit that changes architecture. Two subagents in parallel is normal, not
excessive.

## 100% autonomous logging (zero manual commands) — PERMANENT

The user never runs a memory command during work. Logging is the agent's job, in the background.

- After any architectural decision, technical pattern or code change, append an entry to
  `memory/DECISIONS.md` (`decision / why / consequences`) in the same turn. Do not batch it for the
  end of the session.
- Keep `memory/SESSION.md` continuously refreshed: goal reached, current state, exact next command,
  open questions — then run `npm run handoff` so the machine state block matches git.
- Machine facts and traps go to `memory/ENVIRONMENT.md` as they are discovered.
- Never ask "should I record this?" — just write it.
- Never hand-write inside the `<!-- ailgen:auto -->` markers in `memory/SESSION.md`; the plugin
  and `npm run handoff` own that block.

### Digest budgets (the plugin injects only this much, line-aligned)

| File | Budget | If it outgrows the budget |
| --- | --- | --- |
| `memory/CORE.md` | loaded whole by opencode core | never trim it; it is the invariant layer |
| `memory/DECISIONS.md` | 4000 chars, newest kept | `/archive` moves superseded entries aside |
| `memory/ENVIRONMENT.md` | 2400 chars, newest kept | split machine facts from opinions |
| `memory/SESSION.md` | 2600 chars, head kept | shorten the prose; state belongs in the auto block |

Superseded decisions go to `memory/DECISIONS-ARCHIVE.md` with a pointer to whatever now enforces
them. `AILGEN_DIGEST_SCALE` (0.25-2) scales all three budgets if a session needs a bigger or
smaller memory window.

## Model attribution and stamping — PERMANENT

Every artifact names the model that produced it.

- Commit messages: `[Model: <ModelName>] <action>`. Read the model name from the
  environment/system prompt; never guess it, never reuse a stale stamp.
- Memory entries: `## [YYYY-MM-DD | <ModelName>] Decision: ...`, and the same stamp on the
  `Last updated` line of `memory/SESSION.md`.
- `.githooks/pre-commit` rejects any unstamped subject, and refuses to commit while the doctor
  reports a FAIL. Emergency bypass is `git commit --no-verify`, and using it needs a reason.
- The plugin also writes the model into the SESSION.md state block, captured from the live session,
  so the handoff is attributed even when the model forgot to say so.

## Verification ladder

Use the strongest check that is actually available, in this order:

1. Run the script / start the server / connect to the port.
2. Load the page in a browser and look at it.
3. Read the file back after writing it.
4. Grep for a string (last resort — proves presence, never correctness).
5. Reasoning about the code without running it. Never report this as verification.

Report the literal result, including exact error text. A confident wrong answer costs far more than
an admitted gap. "Unverified" is a valid result; a guess is not.

## Autonomy rules

- Run the flow end-to-end. Do not stop to ask about intermediate steps that are reversible or
  already implied by the goal.
- Ask only when: the action is destructive and outside the repo, a credential or secret is
  involved, a paid/external API is called, or two interpretations would produce materially
  different deliverables.
- **Do not loop.** Repeat a failing action at most twice, and only with a changed approach. If it
  still fails, stop and report the literal error. `permission.doom_loop` is `ask` on purpose.
- Build what was asked. No unrequested refactors, no drive-by improvements. Report adjacent
  problems instead of silently fixing them.
- Keep the environment clean: no temp files in the repo, no leftover background servers, no
  committed secrets. Scratch goes to `C:\Users\shayb\AppData\Local\Temp\opencode`.
- Never commit, amend, push or open a PR unless explicitly asked. When asked, stage only intended
  files.
- Use `todowrite` for any task with 3+ steps and keep exactly one item `in_progress`.

## Self-healing configuration

`.opencode/plugin/memory.ts` re-asserts the load-bearing config on every start: the tool-output
caps, `compaction.auto/prune`, the instruction files (`AGENTS.md`, `CLAUDE.md`, `memory/CORE.md`),
the bash ask-list, the credential-path denials and `doom_loop: ask`. If a bad edit lowers them, the
plugin puts them back and tells you in the system prompt what it restored. You do not have to
remember the config; you have to keep the file honest.

If opencode ever refuses to start because of a broken config, the escape hatches are
`OPENCODE_DISABLE_PROJECT_CONFIG=1`, `OPENCODE_CONFIG_CONTENT='{"$schema":"..."}'` and
`OPENCODE_PURE=1`.

## Hebrew and RTL — the honest state of things

- Hebrew is the product language. Copy is reproduced byte for byte, never paraphrased or
  transliterated, and every image carries an honesty label: מהשטח / הדמיה / קונספט / נתוני הדגמה.
- The opencode **TUI cannot render Hebrew correctly and no configuration can change it**: it paints
  each terminal cell itself and implements no bidi algorithm, so Hebrew is laid out in logical
  order and the glyphs appear reversed. Windows Terminal plus a Unicode font fixes encoding and
  font coverage for every other program, but not the TUI.
- For Hebrew input and output, use the browser interface: `npm run web`. Browsers implement the
  Unicode bidi algorithm. Upstream RTL work exists for the web/desktop clients and is not merged
  into the TUI.
- Write Hebrew into files rather than into the composer when the session is TUI-based. Files are
  read by the agent directly, so nothing is lost to a broken renderer.

## Context and compaction discipline

- Never dump whole files or directory listings into the conversation. Locate with `grep`/`glob`,
  then `read` with a bounded `offset`/`limit`.
- Treat `npm run build`, `git log` and crawl output as streamed-and-summarized, not pasted.
- If a fact must survive compaction, it must exist in a file. The plugin re-injects memory and
  hardens the compaction prompt, but a fact that only ever lived in chat is gone.
- When context gets heavy, run `npm run handoff` before compaction.

## Browser eyes (the agent can see)

Two layers, and they are not interchangeable. Use both.

1. **Playwright MCP** (`playwright` in `opencode.json`, already connected) — the *hands*. Click,
   type, navigate, drive a real flow, read the a11y tree. Available to every agent in this repo in
   every session with no extra setup.
2. **`tools/eyes.mjs`** (`npm run eyes`) — the *diagnostic layer*. One pass returns a screenshot
   plus computed state plus rule findings, and exits non-zero on FAIL so it can guard a commit.

A screenshot alone is not review. Pixels show what is **present**; the expensive defects are what is
**absent** — a clipped element, an overflowing column, an image that never loaded, a Hebrew run laid
out LTR, a contrast failure. `eyes.mjs` checks for those deterministically, so the judgement about
"does this look right" rests on measurements, not on optimism.

Rules learned the hard way, from real runs against this site:

- **Never judge a page before its intro finishes.** AILGEN's hero is a timed animation; at a 900ms
  settle the entire first screen is an empty dark field and the site looks catastrophically broken.
  Use `--settle 7000`. `eyes` detects this and raises `capture/possible-intro` instead of letting
  you report a false defect.
- **Never judge a page from a full-page PNG of a long page.** The homepage is 16,683px tall on
  desktop; a single capture of that is downscaled into an illegible smear. Above `--max-fullpage`
  (4000px) the tool captures the fold, and `--segments N` walks the page in viewport-sized slices.
- **Actually look.** Read the PNG back into the conversation. A vision model that never opens the
  screenshot is guessing, and guessing is exactly what this layer exists to eliminate.
- Intentional design goes in `projects/_eyes/ignore.json` **with a written reason**. Ghost headline
  watermarks fail WCAG on purpose. Suppress the case, never the whole rule.

## Non-blocking execution (non-negotiable)

This machine's shell runner does not return when the foreground command finishes. It waits for the
whole **process tree** and will not unblock while any descendant is alive. Measured directly: a
child spawned with `detached: true`, `windowsHide: true` and explicit file-descriptor stdio — so
it inherited no pipe whatsoever — still froze the runner until its timeout. **Stream redirection,
`unref()` and `detached` are necessary but NOT sufficient.** Three separate freezes cost real
time before this was found.

Rules:

1. **Never launch a daemon from a foreground tool call.** Not with `Start-Process`, not with
   `spawn`, not with `npx`. Use `node tools/supervisor.mjs`, which creates the process through the
   WMI provider so it is a child of the WMI host instead of the agent's shell.
2. **Every foreground command gets an explicit `timeout`** (milliseconds) and must be written to
   finish in seconds. A health-check loop is bounded by a hard deadline and prints the failing
   child's log tail, so a stall is an error message rather than a hang.
3. **Never use `Invoke-WebRequest` in a retry loop.** It can block past `-TimeoutSec` once a
   request has begun. Probe with `net.connect` / `http.get` plus an abort, as the supervisor does.
4. **Kill process trees with `taskkill /PID <pid> /T /F`.** `Stop-Process` on a parent leaves
   grandchildren alive and still holding the port.
5. **Launch real executables, never shims.** `npx`/`npm`/package `.cmd` shims create a
   four-process chain (`npx` -> `npm` -> `cmd` -> `node`). The supervisor resolves a shim to its
   real `.exe` so exactly one process is tracked.
6. **Node/JavaScript work goes in a script file, never inline `node -e`.** On PowerShell 5.1 both
   quoting styles break: double quotes get mangled by `>`, `$_` and `$var`; single quotes have
   their inner quotes stripped during native-argument passing. This failed six times.
7. `where` is an alias for `Where-Object` in PowerShell. To locate a real executable, scan `$env:PATH`
   yourself or call `where.exe`.

Never let a daemon outlive the session unmanaged: `.launch/state.json` records every service, and
`node tools/supervisor.mjs gc` kills any listener on the managed ports that is not tracked.

## Repo conventions

- Static HTML/CSS/JS, no build step. `npm run dev` (port 8000); `python3 -m http.server` also works.
- New project working files go in `projects/<slug>/`; `projects/<slug>/out/` is render output and
  is gitignored. Deliverables that ship live in `projects/<slug>/demo/`.
- Business -> site/brand/film/ads/case requests follow the `ailgen-studio` skill at
  `.claude/skills/ailgen-studio/SKILL.md`.
- Live published versions are Claude artifacts: read the live source in full before republishing.
- Never disable TLS verification and never work around a site's rate limits.

## Environment (Windows 11)

- Shell is Windows PowerShell 5.1. `&&` does not work — use `; if ($?) { ... }`.
- Prefer full cmdlet names over aliases. Use the `workdir` parameter instead of `cd`.
- Do not use shell file cmdlets for reading/writing/searching files; use the read/write/edit/
  glob/grep tools instead.
- Scripts in `scripts/` are ASCII-only and saved as UTF-8 **with BOM**. PowerShell 5.1 parses a BOM-less
  UTF-8 file as ANSI, which turns an em dash into a parse error. Never put non-ASCII characters in a
  `.ps1` file.
- Long-running commands need an explicit `timeout` in milliseconds.
