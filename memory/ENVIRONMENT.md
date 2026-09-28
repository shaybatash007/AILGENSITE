# ENVIRONMENT — machine facts, traps, ports

`AGENTS.md` holds the rules; superseded narrative: `memory/DECISIONS-ARCHIVE.md`.

## Terminal and Hebrew

- Bash tool = legacy conhost: `Host=ConsoleHost`, `WT_SESSION` empty, code page **862**
  (Hebrew DOS codepage, not UTF-8); `wt.exe` is installed. The TUI implements no Unicode bidi and no
  setting changes that, so read Hebrew via `npm run web` (127.0.0.1:4096) or write it to files.

## Shell traps (all hit on this machine)

- A backtick fence (```` ``` ````) inside a double-quoted PowerShell string is an escape sequence
  and breaks the parser — use single quotes for markdown fences.
- In `-replace`, `'$1' + "2026-..."` is read by .NET as *group 12026* and silently vanishes — use a
  capture-free pattern or `${1}`. `"... of $head: history"` parses as drive-qualified `$head:`.
- Native-command stderr renders as error records under `2>&1`, so a successful `opencode --help` can
  print red. Verify by content, not by colour.

## Ports, scratch, git

- 8000 dev server; 4096 opencode web UI. Scratch:
  `C:\Users\shayb\AppData\Local\Temp\opencode`; never leave temp files in the repo.
- Commit guard `.githooks/`, per-clone `core.hooksPath = .githooks`; revert with
  `git config --unset core.hooksPath`. Ignored dirs: `.gitignore`.

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
- opencode web UI specifics, measured on 1.18.33: `GET /path` returns `home` (the picker root),
  `config`, `state`, `worktree`, `directory`. The client sends **no** directory header or query
  param; it calls `/api/session`, `/project`, `/path`. It never calls `/project/current`.

## Non-blocking execution (hard-won, 2026-09-29)

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