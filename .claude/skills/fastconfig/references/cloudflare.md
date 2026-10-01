# Cloudflare

Checked 2026-10-01. Deep links use `https://dash.cloudflare.com/?to=/:account/<path>`: the dashboard fills in the account.
⚡ In the dashboard, the quick search (Ctrl+K / ⌘K) jumps to any product or setting by name.

## The "full working access" token (ask for this once)

A **user API token** stored as the Claude environment's API credential for `api.cloudflare.com` (or `CLOUDFLARE_API_TOKEN` where
credentials are not offered). One token, scoped to the owner's account, covers everything Claude builds and runs there.

- **Edit the existing token instead of creating one** when there is one: the value stays the same, so nothing else changes.
  https://dash.cloudflare.com/profile/api-tokens → the token's **⋯** → **Edit** → add the rows → **Continue to summary** → **Update token**.
- **New token**: https://dash.cloudflare.com/profile/api-tokens → **Create Token** → **Create Custom Token** → **Get started**.
  Name it `claude`, add the rows, Account Resources: *Include → the account*, Zone Resources: *Include → All zones*, no TTL →
  **Continue to summary** → **Create Token** → copy once into the environment's API credential for `api.cloudflare.com`.
- ⚡ Each row's permission box is searchable: type two letters ("Ga", "Pa", "KV"), Enter, Tab to the level, "Edit". **+ Add more** for
  the next row.

| Scope | Permission | Level | What it unlocks |
|---|---|---|---|
| Account | Workers AI | Edit | every Workers AI model |
| Account | AI Gateway | Edit | gateways, logs, cost per call, spend-limit rules |
| Account | Cloudflare Pages | Edit | Pages projects, deployments, secrets and variables |
| Account | Workers Scripts | Edit | Workers, their secrets and routes |
| Account | Workers KV Storage | Edit | KV namespaces and keys |
| Account | Workers R2 Storage | Edit | R2 buckets (media storage) |
| Account | D1 | Edit | D1 databases |
| Account | Account Settings | Read | the account itself (account id discovery) |
| Account | Account Analytics | Read | usage numbers |
| Zone | Zone | Read | the domains |
| Zone | DNS | Edit | DNS records (custom domains for Pages) |
| Zone | Workers Routes | Edit | routes on the domains |
| Zone | Cache Purge | Purge | clearing the cache after a deploy |

Billing stays with the owner: credits, payment methods and plan changes are never done by Claude.

## Probe (what the current token can do)

`scripts/probe.sh` checks each row with a read call: `GET /user/tokens/verify`, `/accounts/{id}/ai/models/search`,
`/ai-gateway/gateways`, `/pages/projects`, `/workers/scripts`, `/storage/kv/namespaces`, `/r2/buckets`, `/d1/database`, `/zones`.
403 / 10000 = the permission is missing; 401 = no token reached the API.

## Pages and secrets without GitHub

With Pages Edit, a Pages project's secrets and variables are set by API (`PATCH /accounts/{id}/pages/projects/{name}` with
`deployment_configs.production.env_vars`), and a deploy can run from the session (`npx wrangler pages deploy`). No GitHub secret is
needed for anything Cloudflare holds.

## AI Gateway credits (Unified Billing): the owner's money steps

- **Dashboard**: https://dash.cloudflare.com/?to=/:account/ai/ai-gateway
- **Top up**: the **Credits Available** card → **Manage** → (payment method if asked) → **Top-up credits** → amount → confirm. $100 of
  credits costs $105 (5% fee). Leave **auto top-up** off when the amount is meant as a ceiling.
- **Workers AI from the credits**: the gateway → **Settings** → **Workers AI Billing** → **Unified billing**.
- **Spend limits**: per gateway, Settings → Spend limits (up to 20 rules; a 429 once reached). Claude can set these by API with AI
  Gateway Edit; an account-wide limit is in the Credits card once credits exist.
- **By API (AI Gateway Edit)**: the balance is `GET /accounts/{id}/ai-gateway/billing/credit-balance` (balance, card on file, auto
  top-up); a gateway is created with `POST /accounts/{id}/ai-gateway/gateways` and `workers_ai_billing_mode: "unified"`,
  `authentication: true` (Worker bindings stay pre-authenticated) and `spend_limits: { enabled, rules: [{ id, limitType: "cost",
  limit: <dollars>, window: <seconds>, technique: "sliding" }] }`. Claude does all of this; only the top-up is the owner's.
- **Email alert on usage**: https://dash.cloudflare.com/?to=/:account/billing → Billable Usage → budget alert.

## Other deep links

| Page | Link |
|---|---|
| Workers & Pages | https://dash.cloudflare.com/?to=/:account/workers-and-pages |
| KV | https://dash.cloudflare.com/?to=/:account/workers/kv/namespaces |
| R2 | https://dash.cloudflare.com/?to=/:account/r2/overview |
| Workers AI | https://dash.cloudflare.com/?to=/:account/ai/workers-ai |
| Billing | https://dash.cloudflare.com/?to=/:account/billing |
| Notifications | https://dash.cloudflare.com/?to=/:account/notifications |
| API tokens (user) | https://dash.cloudflare.com/profile/api-tokens |
