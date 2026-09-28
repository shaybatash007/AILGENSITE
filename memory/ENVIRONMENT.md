# ENVIRONMENT — machine, ports, commands, traps

Add with `/remember`. Keep it factual: what is true of the machine, not what should happen.

## Machine

- Windows 11, PowerShell 5.1 as the default shell for the bash tool.
- opencode CLI 1.18.33 (npm global at `%APPDATA%\npm\node_modules\opencode-ai`, single 180 MB
  binary). `opencode web` / `serve` are the browser-based interfaces; `opencode models` lists 185
  models including the free Zen tier (`opencode/space-bunny-free`, `opencode/mimo-v2.6-flash-free`,
  `opencode/ling-3.0-flash-fin-free`).
- opencode data lives in `%USERPROFILE%\.local\share\opencode\` (sessions in `opencode.db`).
- opencode global config: `%USERPROFILE%\.config\opencode\opencode.jsonc` (currently schema-only).
- Node 24.13.1 runs the plugin's TypeScript directly (type stripping), so the plugin can be
  exercised outside opencode: `node -e "import('./.opencode/plugin/memory.ts')"`.

## Terminal and Hebrew (diagnosed 2026-09-28)

- The bash tool runs in **legacy conhost**: `Host=ConsoleHost`, `WT_SESSION` empty, code page
  **862** (Hebrew DOS codepage, not UTF-8).
- conhost has no Unicode bidi, so Hebrew renders left-to-right and reversed. Windows Terminal
  (`wt.exe`, installed) fixes encoding and font coverage for plain-text programs, but **not** the
  opencode TUI, which paints per cell and implements no bidi. There is no opencode setting for
  this; the config schema has no `tui` section at all.
- `npm run he` launches opencode inside Windows Terminal with `chcp 65001`;
  `npm run he -PatchTerminal` also sets the terminal font to Consolas (writes
  `%LOCALAPPDATA%\Packages\Microsoft.WindowsTerminal_8wekyb3d8bbwe\LocalState\settings.json`,
  backs it up first).
- `npm run web` starts the browser interface on 127.0.0.1:4096 — the only place Hebrew renders
  correctly today, because browsers implement the bidi algorithm.

## Shell traps

- `&&` is not supported in PowerShell 5.1. Use `cmd1; if ($?) { cmd2 }`.
- Do not `cd` inside commands; use the tool's `workdir` parameter.
- PowerShell writes native-command stderr as error records under `2>&1`; opencode's TUI may show
  red text for a successful `opencode --help`. Verify by content, not by colour.
- Scripts in `scripts/` are ASCII-only, saved as UTF-8 **with BOM**. A BOM-less file is parsed as
  ANSI by PowerShell 5.1 and an em dash becomes a parse error. A backtick fence (```` ``` ````)
  inside a double-quoted PowerShell string is an escape sequence and breaks the parser — use single
  quotes for markdown fences.
- Two more PowerShell 5.1 string traps, both hit and fixed on 2026-09-28: in `-replace`, a
  replacement of `'$1' + "2026-..."` is read by .NET as *group 12026*, which silently vanishes — use
  a capture-free pattern or `${1}`. And `"... of $head: history"` is parsed as the drive-qualified
  variable `$head:` — write `${head}:`.

## File-editing rules

- Use read/write/edit/glob/grep tools, not `Get-Content`/`Set-Content`/`Select-String`.

## Repo commands

The full command table lives in `AGENTS.md`. Not repeated here on purpose: this file has a bounded
injection budget and duplicated tables are where budgets go to die.

## Ports

- 8000 — local dev server for the AILGEN site.
- 4096 — opencode browser interface (`npm run web`).

## Scratch space

- Use `C:\Users\shayb\AppData\Local\Temp\opencode` for anything temporary. Never leave temp files
  in the repo.

## Git state notes

- `projects/*/out/`, `versions/`, `node_modules/`, `projects/*/intake/media/`,
  `projects/*/intake/shots/`, `.opencode/node_modules/` are gitignored.
- The commit guard lives in `.githooks/` (committed) and is activated per clone with
  `core.hooksPath = .githooks`; revert with `git config --unset core.hooksPath`.
- Do not commit, amend, push or open a PR unless explicitly asked.
