---
name: fastconfig
description: The owner's settings, done at full speed. Use it the moment a task needs anything only the account owner can grant or set - an API key or token, a token permission, an environment variable, a secret, network access, a setup script, a connector, the Claude GitHub App, a dashboard toggle, billing, credits, spend limits, DNS, a plan upgrade - and whenever a command fails with 401, 403, "permission", "unauthorized", "not allowed", "quota", "host not allowed" or a missing credential, in any repository or none. Also when the owner says fastconfig, "תגדיר", "הגדרות", "גישה", "מה אני צריך לעשות", "תן לי גישה", "מפתח", "טוקן", or asks how to give Claude access to GitHub, Cloudflare, Google, OpenAI, fal, ElevenLabs, Shopify, Meta or any other service. It probes what is already reachable, does everything its access allows by itself, and asks the owner once, in one batch, with exact links, exact values to pick and the fastest path - never for a secret in the chat.
---

# fastconfig

The owner wants Claude to hold full working access to their stack, and to be asked for as little as possible, as rarely as possible,
as precisely as possible. Every setting request costs the owner a context switch; make each one count.

## The law

1. **Probe before asking.** Run `scripts/probe.sh` (it never prints a secret value) and read its table: what is set, what each
   credential can actually do, which hosts the network allows. In a Claude Code cloud session, the session's own tools also count:
   GitHub MCP tools, `add_repo` / `list_repos`, connectors, `read_documentation`. Never ask for what is already there.
2. **Do it yourself first.** Whatever the access allows (APIs, CLIs, MCP tools, connectors, dashboards' APIs) is done, not delegated.
   A gateway, a KV namespace, a Pages secret, a DNS record, a repo setting the MCP tools reach: do it, then report it.
3. **Ask once, batched, widest useful grant.** Collect every gap the task (and the next likely tasks) will hit and ask in one message.
   When a token is needed, ask for the service's full working profile (references) so the next task does not ask again. Prefer
   widening an existing credential (its value stays the same: nothing else to update) over creating a new one.
4. **Every step is exact.** For each step: the direct link (deep link, not a home page), the clicks in order (5 or fewer), the exact
   names and values to choose or type, where the value goes, a pro shortcut, and the time it takes. Order steps by what unblocks the
   most. Number them. One line of why per step, no more.
5. **Secrets never travel through the chat.** Keys go where they are used: the Claude environment's settings (API credentials or
   environment variables), GitHub Secrets, the provider's own secret store. Name the variable exactly. If the owner pastes a secret
   anyway, do not repeat it, tell them to rotate it, and continue.
6. **Money, identity and legal steps are always the owner's.** Payments, top-ups, plan upgrades, accepting terms, 2FA, KYC, creating
   accounts: give the exact link and the exact amount or option, never act on them.
7. **Verify, then record.** When the owner says done ("בוצע", "done"), probe again, say what now works and what still does not. Record
   what was granted (names, scopes, dates; never values) in the repository's environment notes if it has one (for example
   `memory/ENVIRONMENT.md`), otherwise in `.fastconfig.md` at the repository root, so a later session does not ask again.
8. **Say it up front.** If full access to a service is possible, say so before the work starts and give the one-time grant (the
   profiles below), so the rest of the work runs without interruptions.

## How to write the ask

In the owner's language (Hebrew for this owner, RTL-safe: links and values on their own, in code). Shape:

```
**1. <what> (<time>)** — <why, one line>
<direct link>
- <click> → <click> → <click>
- choose / type: `<exact value>`
- ⚡ <the shortcut>
```

End with one line: what to reply when done, and what Claude does right after.

## Where things are (read the reference for the service)

| Need | Reference |
|---|---|
| Claude itself: cloud environment settings (network, env vars, API credentials, setup script), connectors, GitHub App, account skills, remote control | `references/claude.md` |
| Cloudflare: the full-access token profile, editing a token in place, deep links, AI Gateway credits and spend limits, what the API can do | `references/cloudflare.md` |
| GitHub: repo access, secrets, tokens, Pages, Actions, what the MCP tools cover | `references/github.md` |
| AI and other providers: key pages and the variable names to use (OpenAI, Anthropic, Google, fal, ElevenLabs, Replicate, Hugging Face, Shopify, Meta, Stripe, Vercel, Netlify, Supabase) | `references/providers.md` |

In a Claude Code cloud session, also call `read_documentation` with the matching topic (`environment.secrets`, `environment.network`,
`environment.setup_script`, `github.access`, `connectors.add`): the owner then gets a button straight to that settings page.

## The one-time "full access" set (offer it when the owner asks for full control)

1. **Claude environment** (once per environment; every repo and session using it inherits it): network access wide enough for the
   work, the credentials as API credentials or environment variables, and the setup-script line that installs this skill
   (`references/claude.md`).
2. **This skill everywhere**: upload `fastconfig.zip` at https://claude.ai/customize/skills (enabled skills also load in Claude Code
   and Cowork with the same account).
3. **GitHub**: the Claude GitHub App on all repositories.
4. **Cloudflare**: one user API token with the full profile, stored as the environment's credential for `api.cloudflare.com`.
5. **Each provider key** the work uses, as an environment variable with the standard name.
