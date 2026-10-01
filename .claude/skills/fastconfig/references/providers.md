# Providers: where each key is made, and its variable name

Checked 2026-10-01. Keys go into the Claude environment's settings (environment variables, or API credentials for the host), never the
chat. Use the standard names below so every tool and SDK finds them without configuration. When a host is blocked by the
environment's network policy, ask for it in the same message (the "hosts" column).

| Service | Key page | Variable | Hosts |
|---|---|---|---|
| OpenAI | https://platform.openai.com/api-keys | `OPENAI_API_KEY` | api.openai.com |
| Anthropic API | https://console.anthropic.com/settings/keys | `ANTHROPIC_API_KEY` | api.anthropic.com |
| Google Gemini (AI Studio) | https://aistudio.google.com/app/apikey | `GEMINI_API_KEY` | generativelanguage.googleapis.com |
| fal.ai | https://fal.ai/dashboard/keys | `FAL_KEY` | fal.ai, fal.run, queue.fal.run, rest.alpha.fal.ai, v3.fal.media |
| ElevenLabs | https://elevenlabs.io/app/settings/api-keys | `ELEVENLABS_API_KEY` | api.elevenlabs.io |
| Replicate | https://replicate.com/account/api-tokens | `REPLICATE_API_TOKEN` | api.replicate.com, replicate.delivery |
| Hugging Face | https://huggingface.co/settings/tokens | `HF_TOKEN` | huggingface.co |
| Stripe | https://dashboard.stripe.com/apikeys (a restricted key) | `STRIPE_API_KEY` | api.stripe.com |
| Vercel | https://vercel.com/account/tokens | `VERCEL_TOKEN` | api.vercel.com |
| Netlify | https://app.netlify.com/user/applications#personal-access-tokens | `NETLIFY_AUTH_TOKEN` | api.netlify.com |
| Supabase | https://supabase.com/dashboard/account/tokens | `SUPABASE_ACCESS_TOKEN` | api.supabase.com |
| Shopify (a store's Admin API) | https://admin.shopify.com/store/STORE/settings/apps/development → Create an app → Admin API scopes → Install → reveal the token once | `SHOPIFY_ADMIN_TOKEN`, `SHOPIFY_STORE` | STORE.myshopify.com |
| Meta (Facebook / Instagram ads) | https://business.facebook.com/settings/system-users → a system user → Generate new token (ads_management, pages_*) | `META_ACCESS_TOKEN` | graph.facebook.com |
| Google Search Console | https://search.google.com/search-console → add the property (owner's step; DNS verification can be done by Claude with Cloudflare DNS Edit) | — | — |

## Pro shortcuts

- **One key per service, widest working scope, no expiry unless the owner wants one.** A key that expires mid-project is a second ask.
- **Spending caps live with the provider**: set a monthly limit on the key's billing page when the provider has one (OpenAI, Anthropic,
  fal, ElevenLabs), and name it in the ask.
- **Probe right after**: `scripts/probe.sh` calls each provider's cheapest read endpoint (a model or account listing) and prints only
  the HTTP status.
