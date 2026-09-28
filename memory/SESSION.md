# SESSION — handoff note

Last updated: 2026-09-28 | Space Bunny Free

## Goal reached

OpenCode workspace configured for long autonomous sessions: persistent memory
(`AGENTS.md` + `memory/`), automatic memory re-injection and hardened compaction via
`.opencode/plugin/memory.ts`, compaction/tool-output tuning in `opencode.json`, and the
slash commands `/resume`, `/handoff`, `/remember`, `/memory`, `/verify`.

Hardened with two permanent rules: 100% autonomous logging (no manual memory commands from
the user) and mandatory model attribution on every commit and memory entry.

## Current state

Committed: `AGENTS.md`, `opencode.json`, `.opencode/` (plugin + commands, `node_modules`
gitignored by `.opencode/.gitignore`), `memory/` (SESSION, DECISIONS, ENVIRONMENT).

Still uncommitted, pre-dating the memory setup and left for a separate decision:

- `package.json`, `package-lock.json`, `scripts/` (dev.ps1, dev-stop.ps1) — new
- `.gitignore` — modified

## Exact next command

Restart opencode so the new config, plugin and commands load (config is read once at startup),
then:

```
/resume
```

## Open questions

- `package.json` + `scripts/` + the `.gitignore` change: commit them, or drop them? They make
  `npm run dev|up|down|save|restore` work, and `AGENTS.md` already documents those commands.
- `small_model` is not set globally. Title/summary generation uses the configured default. Set one
  in `opencode.json` if compaction summaries feel slow.
