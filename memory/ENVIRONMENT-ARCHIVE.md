# ENVIRONMENT-ARCHIVE — machine facts rotated out of memory/ENVIRONMENT.md

Nothing here is deleted. These facts were measured on this machine and are kept verbatim; they were
moved out of `memory/ENVIRONMENT.md` on 2026-09-29 by the archivist because the active file was
6035 chars against a 2400-char digest budget, and a tail-trimmed digest would have kept the newest
sections while silently dropping these. Read this file before a PowerShell quoting, ports, browser
automation or `npm run safe` task. Entries that turned out to be opinions or tooling descriptions
are marked as such; the measurement stays either way.

Rotated sections: "Shell traps (all hit on this machine)", "Ports, scratch, git", "Browser
automation (added 2026-09-28)", the `npm run safe` bullet from "Non-blocking execution", and the
long form of "The desktop shortcut is a migration casualty".

## Rotation log

- **2026-10-01** (Space Bunny Free): four more sections moved here out of a 6197-char active file
  against a 2400-char budget — "Browser binaries are gated by WDAC", "Terminal and Hebrew",
  "PowerShell 5.1 traps", and "Non-blocking execution". All four are enforced verbatim by
  `AGENTS.md`; the last two were already duplicated below, and the pointers say so. The four
  2026-10-01 sections (Cloudflare has no KV permission, the dirty clone, the missing commit guard,
  PowerShell corrupting a shell-written file) stayed active: they are the facts that stop a repeat
  of the unenforced-budget incident.

## Superseded by a stronger file

- The rules now live in `AGENTS.md`: "Ports, scratch, git" is in "Repo conventions" and "Environment
  (Windows 11)"; the "Non-blocking execution" rules are in `AGENTS.md` under the same name, with
  seven numbered items; the `waitUntil: "networkidle"` trap is in `AGENTS.md` ("Browser eyes") and
  in the opencode upstream docs.
- The four sections rotated on 2026-10-01 are enforced by: `AGENTS.md` "Environment (Windows 11)"
  (Shell = PowerShell 5.1, no `&&`, `where` is an alias, long-running commands need a timeout, the
  WDAC/playwright-MCP paragraph); `AGENTS.md` "Non-blocking execution (non-negotiable)", all eight
  numbered rules; and `AGENTS.md` "Hebrew and RTL" plus `scripts/doctor.ps1`'s terminal check
  (`BROKEN: legacy conhost … Fix: npm run he`) for the code-page-862 finding. The
  PowerShell quoting traps are the same class as the 2026-10-01 "PowerShell corrupts a shell-written
  file" fact, which stayed active.
- The forward-slash path fact is a decision, not just a machine fact: see
  `memory/DECISIONS-ARCHIVE.md`, 2026-09-29, "opencode's canonical path spelling is FORWARD
  slashes" — both that decision and the rehearse-before-write rule it shares were rotated there on
  2026-10-01.

---

## Shell traps (all hit on this machine)

- A backtick fence (```` ``` ````) inside a double-quoted PowerShell string is an escape sequence
  and breaks the parser — use single quotes for markdown fences.
- In `-replace`, `'$1' + "2026-..."` is read by .NET as *group 12026* and silently vanishes — use a
  capture-free pattern or `${1}`. `"... of $head: history"` parses as drive-qualified `$head:`.
- Native-command stderr renders as error records under `2>&1`, so a successful `opencode --help` can
  print red. Verify by content, not by colour.

---

## Ports, scratch, git

- 8000 dev server; 4096 opencode web UI. Scratch:
  `C:\Users\shayb\AppData\Local\Temp\opencode`; never leave temp files in the repo.
- Commit guard `.githooks/`, per-clone `core.hooksPath = .githooks`; revert with
  `git config --unset core.hooksPath`. Ignored dirs: `.gitignore`.

---

## Browser automation (added 2026-09-28)

- `playwright@1.64.0-alpha` + `@playwright/mcp@0.0.82` are devDependencies at the repo root;
  `node_modules/.bin/playwright-mcp` is the MCP binary wired into `opencode.json`.
  `npx playwright install chromium` puts Chromium in `%LOCALAPPDATA%\ms-playwright`.
- `npm run eyes -- --url <u>` runs `tools/eyes.mjs`. Output: `projects/_eyes/out/*.png` plus a
  `--report.json`. Intentional-design exemptions live in `projects/_eyes/ignore.json`; throwaway
  probe scripts go in `projects/_eyes/scratch/` (gitignored).
- **Never use `waitUntil: "networkidle"` against a live app.** Any SSE/websocket client (including
  opencode's own web UI) never goes idle, so navigation hangs until timeout. Use
  `domcontentloaded`/`load` plus an explicit settle. This cost a debugging cycle already.
- opencode web UI specifics, measured on 1.18.33 and re-measured 2026-09-29: `GET /path` returns
  `home` (the picker root), `config`, `state`, `worktree`, `directory`. `GET /api/session` returns
  every session and DOES accept `?directory=` - after the path repair it returns 15 for this repo.
  The client, however, still renders "Nothing here yet" with an empty Projects list: it calls
  `/api/session?limit=5000`, `/project`, `/path` and never binds a project. `?directory=` on the
  page URL does not bind it either (measured, twice). The "Add project" picker IS rooted at
  `$HOME` and can now reach this repo, but the list stays empty after opening a folder.
- **opencode stores Windows paths with FORWARD slashes.** Measured on the pre-migration database,
  which opencode itself had written: `project.worktree`, `project_directory.directory` and all 14
  sessions were `C:/mastercoding/AILGENSITE`. Backslashes in that database came from
  `tools/migrate-home.mjs`, not from opencode. The two spellings do not match, and that mismatch
  was the whole cause of the empty Web UI. See DECISIONS.md.
- `@playwright/mcp` fails to launch on this machine: `async initializeServer: spawn UNKNOWN` on
  `chrome-win64\chrome.exe`. Retried twice, same error. The `playwright` **library** works fine
  (`tools/eyes.mjs` and standalone scripts both render and screenshot), so drive the browser with a
  script rather than concluding the browser is unavailable.

---

## From "Non-blocking execution" (2026-09-29)

- **`npm run safe` (tools/safe-exec.mjs) is the right tool for finite work** and the wrong tool for a
  daemon. It owns both pipes, enforces a hard wall clock (5-120s, default 20s), escalates to
  `taskkill /PID /T /F` on expiry, spills output past 512KB to a file, and resolves `.cmd` shims to
  a real `.exe`. Verified against the exact case that freezes the runner: a child that never exits
  AND a grandchild holding the write end both come back 124 in ~8.5s. Exit 124 = deadline,
  125 = could not spawn.

This is a tooling description as much as a machine fact, so its active pointer is `AGENTS.md`
("Deterministic tools") and the `npm run safe` row there; the measured exit codes stay here.

---

## Non-blocking execution (hard-won, 2026-09-29) — full text

This section stayed active in condensed form because it is the most load-bearing set of traps on
this machine. The long form is here so no measured detail is lost; the active copy in
`memory/ENVIRONMENT.md` keeps one line per trap plus this pointer.

- The agent shell runner waits for the whole **process tree**, not just the foreground command, and
  freezes while any descendant lives. `detached: true` + file-descriptor stdio + `unref()` is NOT
  enough - measured, it still froze for the full timeout.
- **Only WMI works.** `Invoke-CimMethod -ClassName Win32_Process -MethodName Create` makes the
  process a child of the WMI host, outside the runner's tree. Verified: returns in 0.19s while the
  created process keeps running. `tools/supervisor.mjs` does exactly this.
- `Start-Process npx.cmd -PassThru` returns the **cmd.exe wrapper**, not the server. The real
  listener must be resolved from `netstat -ano`; otherwise `-Stop` kills a wrapper and orphans the
  service while appearing to succeed.
- PowerShell 5.1: `where` is an alias for `Where-Object` and returns nothing useful. Scan
  `$env:PATH` manually. `Invoke-WebRequest -TimeoutSec` does not reliably abort a read already in
  flight, so never put it in a retry loop - use `net.connect` / `http.get` with `req.destroy()`.
- Inline `node -e` is unusable on this machine (6 failures): double-quoted strings get mangled by
  `>`/`$_`/`$var`, and single-quoted strings lose their inner quotes during native-argument
  passing. Always write a script file.
- npm shims use `SET dp0=%~dp0` then `"%dp0%\..."`, so a resolver must substitute `%dp0%` and not
  only `%~dp0`.
- **`npm run safe` (tools/safe-exec.mjs) is the right tool for finite work** and the wrong tool for a
  daemon. It owns both pipes, enforces a hard wall clock (5-120s, default 20s), escalates to
  `taskkill /PID /T /F` on expiry, spills output past 512KB to a file, and resolves `.cmd` shims to
  a real `.exe`. Verified against the exact case that freezes the runner: a child that never exits
  AND a grandchild holding the write end both come back 124 in ~8.5s. Exit 124 = deadline,
  125 = could not spawn.
- **opencode stores Windows paths with FORWARD slashes** - backslashes in `opencode.db` came from
  `tools/migrate-home.mjs`, not from opencode. See `memory/DECISIONS.md`, 2026-09-29.

Enforced by: `AGENTS.md` "Non-blocking execution (non-negotiable)", all seven numbered rules.

---

## The desktop shortcut is a migration casualty — full text

- `C:\Users\shayb\OneDrive\Desktop\AILGEN-Dev-Suite.lnk` is generated by
  `scripts/make-shortcut.ps1` and embeds the ABSOLUTE repo path. After the $HOME move it pointed at
  `C:\mastercoding\AILGENSITE\scripts\launch-env.ps1`, which no longer existed, and the launcher
  failed silently. Regenerate it with `powershell -File scripts\make-shortcut.ps1` after ANY move.
  The script derives its target from `$PSScriptRoot`, so running the new copy is sufficient.

---

## Browser binaries are gated by WDAC (measured 2026-09-29)

- A WDAC / AppLocker **Enterprise signing** policy (Policy ID
  `0283ac0f-fff1-49ae-ada1-8a933130cad6`) **blocks**
  `ms-playwright\chromium-1246\chrome-win64\chrome.exe`. Evidence: the
  `Microsoft-Windows-CodeIntegrity/Operational` log, event 3077. Node reports only
  `spawn UNKNOWN`, which is why the MCP "failed to launch" with no visible cause.
- What works, each verified by a real navigation **and** screenshot: Playwright's
  default `chromium.launch()` (it resolves to the headless shell), the headless
  shell explicitly, and the system `msedge.exe`. The MCP is therefore configured
  `--browser msedge --headless`; `--browser chromium` forces the blocked binary.
  A config change binds only after an opencode **restart**, so a fix cannot be
  verified inside the session that makes it. `tools/eyes.mjs` was never affected.

Enforced by: `AGENTS.md` "Environment (Windows 11)", the final bullet — the WDAC policy, the
unhelpful `spawn UNKNOWN`, the `--browser msedge --headless` configuration, and the fact that the
MCP only rebinds on an opencode restart. The `playwright` library is unaffected and is the reliable
path from an agent.

---

## Terminal and Hebrew

- Bash tool = legacy conhost: `Host=ConsoleHost`, `WT_SESSION` empty, code page **862** (Hebrew DOS
  codepage, not UTF-8); `wt.exe` is installed. The TUI implements no Unicode bidi and no setting
  changes that, so read Hebrew via `npm run web` (127.0.0.1:4096) or write it to files.

Enforced by: `AGENTS.md` "Hebrew and RTL — the honest state of things" (the TUI paints each terminal
cell itself and implements no bidi algorithm; use the browser interface) and the live terminal
check in `scripts/doctor.ps1`, which prints `BROKEN: legacy conhost (Host=ConsoleHost, no
WT_SESSION) does no Unicode bidi. Hebrew renders left-to-right. Fix: npm run he`.

---

## PowerShell 5.1 traps (all hit on this machine)

- A backtick fence inside a double-quoted string is an escape sequence and breaks the parser - use
  single quotes for markdown fences.
- `'$1' + "2026-..."` inside `-replace` is read by .NET as *group 12026* and vanishes - use
  `${1}` or a capture-free pattern. `"... of $head: history"` parses as drive-qualified `$head:`.
- Native-command stderr renders as error records under `2>&1`, so a successful command can print
  red. Verify by content, not by colour.

Enforced by: `AGENTS.md` "Environment (Windows 11)" (Shell is Windows PowerShell 5.1, `&&` does not
work, prefer full cmdlet names) plus rule 7 in "Non-blocking execution"; and the *current*
`memory/ENVIRONMENT.md` section "PowerShell 5.1 will silently corrupt a shell-written file
(measured 2026-10-01)", which is the same bug class in its most expensive form. Note the emphasis
character here is a plain hyphen; `scripts/doctor.ps1` additionally flags any U+FFFD in a memory
file, which is how a mangled encoding gets caught.

---

## Non-blocking execution (hard-won, 2026-09-29) — condensed copy rotated 2026-10-01

- The agent shell runner waits for the whole **process tree**, not the foreground command, and
  freezes while any descendant lives. `detached` + fd stdio + `unref()` is NOT enough - measured.
- **Only WMI works.** `Invoke-CimMethod Win32_Process Create` parents the process to the WMI host,
  outside the runner's tree. Verified: 0.19s return, process keeps running. `tools/supervisor.mjs`.
- `Start-Process npx.cmd -PassThru` returns the **cmd.exe wrapper**, not the server. Resolve the
  real listener from `netstat -ano`; otherwise `-Stop` orphans the service while appearing to work.
- `where` is an alias for `Where-Object` in PowerShell 5.1 - scan `$env:PATH` yourself. Never loop
  on `Invoke-WebRequest -TimeoutSec`: it does not reliably abort a read in flight. Use
  `net.connect` / `http.get` with `req.destroy()`.
- Inline `node -e` is unusable here (6 failures): double-quoted strings get mangled by
  `>`/`$_`/`$var`, single-quoted ones lose inner quotes. Always write a script file.
- **opencode stores Windows paths with FORWARD slashes** - the backslashes in `opencode.db` came
  from `tools/migrate-home.mjs`, not from opencode. See `memory/DECISIONS-ARCHIVE.md`, 2026-09-29.
- Desktop shortcut `AILGEN-Dev-Suite.lnk` embeds the absolute repo path: after any move regenerate
  it with `scripts/make-shortcut.ps1`, or the launcher fails silently.

Enforced by: `AGENTS.md` "Non-blocking execution (non-negotiable)" — all eight numbered rules
restate every bullet above, and rule 5 exists because of the `cmd.exe` wrapper finding. The
longer "Non-blocking execution (hard-won, 2026-09-29) — full text" section above in this file is
still the fullest form; nothing measured was lost in this rotation, only a duplicate copy.

