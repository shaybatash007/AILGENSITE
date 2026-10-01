# Claude itself: where every setting lives

Checked 2026-10-01. If a page moved, the setting's name still finds it in that product's search.

## Claude Code cloud environment (claude.ai/code)

One environment serves every session that selects it, whatever the repository. Set things there once.

- **Where**: the cloud environment menu in the session's title bar → **Edit**. The sections are Network access, Environment variables,
  API credentials (where offered) and Setup script. A new session picks up a change; the current one does not.
- **API credentials** (header injected per host, the value never enters the container): best for a service called over HTTPS with a
  bearer token, e.g. `api.cloudflare.com`. Claude calls the API with no key in the command; a probe shows it works.
- **Environment variables**: `NAME=value`, one per line, for anything read by name (`LAB_PASSCODE`, `FAL_KEY`, `GEMINI_API_KEY`…).
  Name them exactly as the code reads them (references/providers.md has the standard names).
- **Network access**: the level, plus allowed domains. Levels are described at https://code.claude.com/docs/en/claude-code-on-the-web.
  A blocked host shows as an HTTP 000/403 from the proxy; name the host and ask for it (or a wider level) once, with the others
  the work will need (e.g. `fal.ai`, `queue.fal.run`, `api.elevenlabs.io`).
- **Setup script**: runs at the start of every new container. The line that installs this skill in every session of the environment:
  ```bash
  curl -fsSL https://raw.githubusercontent.com/shaybatash007/AILGENSITE/HEAD/.claude/skills/fastconfig/scripts/install.sh | bash
  ```
- ⚡ In a cloud session, `read_documentation(topic)` gives the owner a button straight to the right settings page:
  `environment.secrets`, `environment.network`, `environment.setup_script`, `environment.dependencies`, `session.resources`.

## GitHub for Claude

- Connect or reconnect: https://claude.ai/connect-github
- The Claude GitHub App on every repository: https://github.com/apps/claude/installations/select_target → the account →
  **Repository access: All repositories** → Save. Then every repo is reachable (`list_repos`, `add_repo`) without asking again.
- A session's repositories are chosen when it starts; `add_repo` attaches another one mid-session.

## Connectors (Gmail, Google Drive, Calendar, Slack, Notion, Linear…)

- https://claude.ai/customize/connectors → the connector → Connect → sign in. Connectors are read when a session starts: new session.

## Account skills (this skill, and any other, in every Claude surface)

- https://claude.ai/customize/skills → **+** → **Create skill** → **Upload a skill** → the `.zip` of the skill folder → toggle on.
- Enabled skills load in claude.ai chat, Cowork, and Claude Code signed in with the same account (listed under "claude.ai sync").
- To update: upload the new zip over it (same name).

## The owner's own computer

- When the work needs the owner's machine (local files, a desktop app, a local build), use `read_documentation('remote_control.setup')`
  in a cloud session and follow it.
