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

## Superseded by a stronger file

- The rules now live in `AGENTS.md`: "Ports, scratch, git" is in "Repo conventions" and "Environment
  (Windows 11)"; the "Non-blocking execution" rules are in `AGENTS.md` under the same name, with
  seven numbered items; the `waitUntil: "networkidle"` trap is in `AGENTS.md` ("Browser eyes") and
  in the opencode upstream docs.
- The forward-slash path fact is a decision, not just a machine fact: see `memory/DECISIONS.md`,
  2026-09-29, "opencode's canonical path spelling is FORWARD slashes".

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

