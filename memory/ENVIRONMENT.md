# ENVIRONMENT — machine facts, traps, ports

`AGENTS.md` holds the rules. Rotated, with "Enforced by" pointers: `ENVIRONMENT-ARCHIVE.md`.

## Claude Code cloud environment: what a session can reach (fastconfig probe, 2026-10-01)

Run `bash .claude/skills/fastconfig/scripts/probe.sh --cf-account 9213747898b0eef6d720f037cb32bee4` for the current table
(names and HTTP status only, never values). As of this date:

- **Cloudflare**: a user token is injected by the environment for `api.cloudflare.com` (no variable in the shell). Widened by the
  owner on 2026-10-01: Workers AI, AI Gateway, Pages, Workers Scripts, KV, D1, Account Settings and Zones all answer; R2 is not
  enabled on the account yet (dashboard step, only if R2 is needed).
- **AI Gateway `ailgen-lab`** created by the agent on 2026-10-01: Workers AI billing `unified`, authentication on (Worker bindings
  are pre-authenticated), logs on, spend limits $10 per day and $100 per 30 days (sliding). Credit balance at creation: $0, card on
  file, auto top-up off (`GET /accounts/{id}/ai-gateway/billing/credit-balance`).
- **The lab from CI**: `.github/workflows/lab-run.yml` runs `cloud/lab/unified.mjs` with the `LAB_PASSCODE` repository secret.
- **GitHub**: the Claude GitHub App reaches all 8 of the owner's repositories with push (`list_repos`); Actions secrets stay owner clicks.
- **Not set**: `LAB_PASSCODE` (the lab's passcode for `cloud/lab/unified.mjs`), any provider key (`FAL_KEY`, `GEMINI_API_KEY`…).
- **Network**: npm, PyPI, GitHub raw, Cloudflare, OpenAI, Anthropic, Google, fal and ElevenLabs hosts answer.

## Cloudflare: the deploy token has NO Workers KV permission (2026-10-01)

Account `9213747898b0eef6d720f037cb32bee4`. The `CLOUDFLARE` repo secret reads Pages and **cannot
touch KV**: `GET` and `POST /storage/kv/namespaces` both return `Authentication error`. So:

- No local `wrangler login` (`wrangler whoami` -> not authenticated), no `CLOUDFLARE_*` variable.
  **The agent has no Cloudflare access except through CI.** Ask permission questions only via
  `gh workflow run kv-probe.yml` — it prints facts, never values.
- Repo secrets are write-only, so every permission change is an owner dashboard action.
- `CLOUDFLARE_ACCOUNT_ID` is an **empty secret by design**; the id is an identifier in
  `surfaces.json` under `cloudflare.accountId`. Do not "fix" it.
- `LAB_PASSCODE` is set. Without a correct `x-lab-key`, `/api/ping`, `/api/run` and `/api/budget`
  return 401 (`423 locked` = unset), so an agent cannot read live lab state and must infer it from
  deploy logs and CI.
- **$100 of AI Gateway credits costs $105** (5% credit fee), so the card ceiling is $105. Never
  enable Auto top-up, or the ceiling stops meaning anything.

## Git: the clone at projects/AILGENSITE is 46 commits behind and DIRTY

Uncommitted work (`lab/`, `cloud/`, `docs/`, `plans/`, `.opencode/`) on a diverged branch. **Do not
pull into it and do not touch it.** Work happens in a clean clone at `projects/_ailgenlab`, pushed
straight to `origin/claude/cool-fermat-us543u`; the owner's checkout just falls behind.

## A fresh clone has no commit guard until hooksPath is set

`core.hooksPath = .githooks` is set by `npm run setup`, so **three commits went out unstamped**
(e4d2f8a, 4e3f976, f634f81). Run `git config core.hooksPath .githooks` in any new clone; verify
with an unstamped `--allow-empty` commit.

## PowerShell 5.1 silently corrupts a shell-written file (2026-10-01)

A JS string containing `\"kvIds\"` written through a PowerShell double-quoted argument reached git as
`"kvIds"`, and git read the `"` as a path separator: `fatal: \, ':' is outside repository`. Write any
commit message or patch with quotes, backslashes or `${` to a temp file via the `write` tool, then
`git commit --file <path>`. A **CRLF** checkout caused the same miss twice.
