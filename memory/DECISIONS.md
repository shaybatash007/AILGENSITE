# DECISIONS — must not be re-litigated

Append-only, newest last. Rotated: `memory/DECISIONS-ARCHIVE.md` (`/archive`).

---

## [2026-10-01 | Space Bunny Free] Decision: the lab's budget ledger is bound by a DECLARED namespace id, never by an API lookup

Decision: `surfaces.json` carries a new `kvIds` field per surface. `tools/site-switch.mjs` uses a
declared id as-is and calls the KV API only when no id is declared.

Why: the lab's $100 was not enforced, and the failure was silent by construction. Binding the
LEDGER namespace by listing it and matching a title made every deploy depend on a token
permission of `Account · Workers KV Storage · Edit`. The repository token has
`Account · Cloudflare Pages · Edit` only, so the lookup returned `Authentication error`, the deploy
printed one line and continued, and `gateBudget()` in `cloud/lab/functions/api/run.js` returned
`null` because `hasLedger(env)` was false - meaning **no paid call was ever checked against the
ceiling**. Measured, not assumed: `tools/kv-probe.mjs` run in CI (the only place the token
exists) reports Pages reachable, then `NO · Authentication error` for the KV read AND the KV
write, so the token carries no KV permission of any kind.

A KV namespace id is an identifier, not a secret - the same category as `cloudflare.accountId`,
which `surfaces.json` already carries for the same reason, and it is already written into
`cloud/lab/wrangler.toml` on every machine that deploys. Declaring it removes the dependency for
good, and it is the stronger posture: a token that cannot create namespaces cannot silently delete
them either. Widening the token instead would grant storage create-and-delete to a token whose
entire job is uploading a site, so the deploy's failure message names the `surfaces.json` route
first and says widening the token is deliberately not the suggestion.

Consequences: (a) `surfaces.json` has `kvIds: {}` and stays empty until a namespace exists - the
API lookup is still the fallback and nothing regresses; (b) the fix is one dashboard action the
owner must take (create `ailgen-lab-LEDGER`, copy its id), after which a single commit binds it;
(c) `npm run test:kv` (26 checks) must stay green - `tools/test-kv-bind.mjs` asserts the real
`pagesConfig` makes **zero** HTTP requests given a declared id, because that zero is the only
property that removes the token dependency.

## [2026-10-01 | Space Bunny Free] Decision: the lab says "no tracking" when it cannot enforce, and a diagnostic never reports an untested conclusion

Decision: without a ledger the budget pill reads `תקציב: אין מעקב` and the tab states plainly that
nothing stops an over-budget call. Separately, `kv-probe` attempts the KV **write** whenever a
create is requested, regardless of what the read returned.

Why, both halves measured. (a) The interface implied a ceiling it could not enforce: with no
ledger `pill()` was never called, so the button kept its placeholder text, and the budget tab
promised the ledger would work "after step 5" - a step that does not exist in that document. A
budget surface that under-reports its own enforcement is worse than no budget surface, because the
user reads "$0.00 of $100" and concludes there is nothing to worry about. (b) Cloudflare grants
Workers KV Storage `· Read` and `· Edit` independently, so "cannot list" is not evidence about
"cannot create" - yet the probe exited on the failed read before ever trying the write, so it
reported a conclusion it had not tested.

Consequences: the general rule is that a diagnostic which cannot test something must say it did not
test it, and a control surface must report the state of its own enforcement rather than the state
it would like to have. Reading the rendered page also found a bug the source did not show: the
gateway name appeared as the literal text `${esc(b.gateway)}`, because those setup strings are
concatenated at runtime instead of interpolated as one template literal.
