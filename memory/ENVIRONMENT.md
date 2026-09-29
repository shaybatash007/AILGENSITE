# ENVIRONMENT — machine facts, traps, ports

`AGENTS.md` holds the rules. Measured detail: `memory/ENVIRONMENT-ARCHIVE.md` (2026-09-29),
narrative: `memory/DECISIONS-ARCHIVE.md`.

## Terminal and Hebrew

- Bash tool = legacy conhost: `Host=ConsoleHost`, `WT_SESSION` empty, code page **862** (Hebrew DOS
  codepage, not UTF-8); `wt.exe` is installed. The TUI implements no Unicode bidi and no setting
  changes that, so read Hebrew via `npm run web` (127.0.0.1:4096) or write it to files.

## PowerShell 5.1 traps (all hit on this machine)

- A backtick fence inside a double-quoted string is an escape sequence and breaks the parser - use
  single quotes for markdown fences.
- `'$1' + "2026-..."` inside `-replace` is read by .NET as *group 12026* and vanishes - use
  `${1}` or a capture-free pattern. `"... of $head: history"` parses as drive-qualified `$head:`.
- Native-command stderr renders as error records under `2>&1`, so a successful command can print
  red. Verify by content, not by colour.

## Non-blocking execution (hard-won, 2026-09-29)

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
  from `tools/migrate-home.mjs`, not from opencode. See `memory/DECISIONS.md`, 2026-09-29.
- Desktop shortcut `AILGEN-Dev-Suite.lnk` embeds the absolute repo path: after any move regenerate
  it with `scripts/make-shortcut.ps1`, or the launcher fails silently.
