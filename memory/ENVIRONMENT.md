# ENVIRONMENT — machine, ports, commands, traps

Add with `/remember`. Keep it factual: what is true of the machine, not what should happen.

## Machine

- Windows 11, PowerShell 5.1 as the default shell for the bash tool.
- opencode CLI 1.18.33, launched from `C:\mastercoding\AILGENSITE`.
- opencode data lives in `%USERPROFILE%\.local\share\opencode\` (sessions in `opencode.db`).
- opencode global config: `%USERPROFILE%\.config\opencode\opencode.jsonc` (currently schema-only).
- Global `@opencode-ai/plugin` 1.18.33 installed under the global config dir — available for
  local plugins.

## Shell traps

- `&&` is not supported in PowerShell 5.1. Use `cmd1; if ($?) { cmd2 }`.
- Do not `cd` inside commands; use the tool's `workdir` parameter.
- PowerShell writes native-command stderr as error records under `2>&1`; opencode's TUI may show
  red text for a successful `opencode --help`. Verify by content, not by colour.

## File-editing rules

- Use read/write/edit/glob/grep tools, not `Get-Content`/`Set-Content`/`Select-String`.

## Repo commands

| Purpose | Command |
| --- | --- |
| Serve the site (port 8000) | `npm run dev` or `npm run up` |
| Stop the dev server | `npm run down` |
| Save a version snapshot | `npm run save` |
| Restore a version snapshot | `npm run restore` |
| Plain static server | `python3 -m http.server` |

## Ports

- 8000 — local dev server for the AILGEN site.

## Scratch space

- Use `C:\Users\shayb\AppData\Local\Temp\opencode` for anything temporary. Never leave temp files
  in the repo.

## Git state notes

- `projects/*/out/`, `versions/`, `node_modules/`, `projects/*/intake/media/`,
  `projects/*/intake/shots/` are gitignored.
- Do not commit, amend, push or open a PR unless explicitly asked.
