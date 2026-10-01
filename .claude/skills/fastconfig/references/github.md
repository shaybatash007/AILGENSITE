# GitHub

Checked 2026-10-01. Replace `OWNER/REPO`.

## What Claude already has in a cloud session

- The repositories the Claude GitHub App can reach (`list_repos`), clone and push through the session's git proxy, and the GitHub MCP
  tools: files, branches, commits, pull requests, reviews, issues, Actions runs, jobs and logs, re-runs and dispatch.
- Not covered by the MCP tools: **Actions secrets and variables**, repository settings (Pages source, branch protection, collaborators),
  org settings. These are the owner's clicks, or move the secret to where it is used (a Cloudflare secret by API, an environment
  variable in Claude's environment).

## Links

| Need | Link and steps |
|---|---|
| Claude on every repository | https://github.com/apps/claude/installations/select_target → the account → **All repositories** → Save |
| A new Actions secret | https://github.com/OWNER/REPO/settings/secrets/actions/new → Name (exact, upper case) → Secret → **Add secret** |
| Update a secret | https://github.com/OWNER/REPO/settings/secrets/actions → the secret's ✎ → paste → **Update secret** (a secret cannot be read back: when its value is lost, set a new one everywhere it is used) |
| An Actions variable (not secret) | https://github.com/OWNER/REPO/settings/variables/actions/new |
| Pages settings | https://github.com/OWNER/REPO/settings/pages |
| Run a workflow by hand | https://github.com/OWNER/REPO/actions → the workflow → **Run workflow** (Claude can dispatch it through the MCP tools) |
| Fine-grained token (only when a tool outside Claude needs one) | https://github.com/settings/personal-access-tokens/new |

⚡ GitHub's settings pages are fastest by URL: type the path after the repository URL. `.` on a repository page opens the web editor.
