// KV probe: what can the deploy token reach, and does the lab's ledger exist?
//
// Why this file exists. The lab enforces its budget with a KV namespace bound as
// LEDGER. tools/site-switch.mjs binds it during a deploy, and when it cannot the
// deploy prints one warning line and moves on:
//
//   lab: KV LEDGER not bound (Authentication error): ...
//
// That warning is correct but silent about the fix, and it is invisible to the
// agent maintaining this repository: CLOUDFLARE_API_TOKEN is a write-only secret,
// so nobody outside CI can tell whether the token carries Workers KV Storage
// permission or not. This script answers that question from inside a job that
// already has the token, and prints the answer as plain text.
//
// It reads and lists. It writes only when CREATE=true, and only a namespace that
// does not already exist. It never reads a secret's value and never prints one.
//
//   node tools/kv-probe.mjs                 read-only: what the token can reach
//   CREATE=1 TITLE=ailgen-lab-LEDGER node tools/kv-probe.mjs   create if missing
//
// Exit codes: 0 healthy, 1 the token cannot reach the KV API, 2 a usage error.

const API = process.env.CLOUDFLARE_ACCOUNT_ID
  ? `https://api.cloudflare.com/client/v4/accounts/${process.env.CLOUDFLARE_ACCOUNT_ID}`
  : null;
const TITLE = process.env.TITLE || 'ailgen-lab-LEDGER';
const CREATE = process.env.CREATE === '1' || process.env.CREATE === 'true';

const say = (...a) => console.log(...a);
const rule = (t) => say(`\n── ${t} ${'─'.repeat(Math.max(0, 62 - t.length))}`);

// The token is a secret: its value never reaches stdout. Only these four facts do.
async function call(path, init) {
  const headers = {
    authorization: `Bearer ${process.env.CLOUDFLARE_API_TOKEN || ''}`,
    'content-type': 'application/json',
    ...(init?.headers || {}),
  };
  const res = await fetch(`${API}${path}`, { ...init, headers });
  const body = await res.json().catch(() => null);
  return { status: res.status, ok: res.ok && body?.success !== false, body };
}

function firstError(body) {
  return body?.errors?.[0]?.message || body?.errors?.map(e => e.message).join('; ') || `HTTP ${body?.success === false ? 'error' : '?'}`;
}

async function main() {
  say('AILGEN · KV probe');
  say(`  account   ${API ? API.split('/accounts/')[1] : '(CLOUDFLARE_ACCOUNT_ID is not set)'}`);
  say(`  token     ${process.env.CLOUDFLARE_API_TOKEN ? 'present in this job' : 'MISSING from this job'}`);
  say(`  namespace ${TITLE}`);
  say(`  mode      ${CREATE ? 'create if missing' : 'read only'}`);

  if (!API) {
    say('\nFAIL · CLOUDFLARE_ACCOUNT_ID is not set on this repository.');
    say('      surfaces.json carries the account id (it is an identifier, not a secret).');
    say('      Either set the repository secret, or fall back to surfaces.json.');
    process.exit(2);
  }
  if (!process.env.CLOUDFLARE_API_TOKEN) {
    say('\nFAIL · no CLOUDFLARE_API_TOKEN in this job.');
    say('      The pages workflow falls back to the secret named CLOUDFLARE.');
    process.exit(2);
  }

  rule('1 · can the token read the account at all');
  const who = await call('/pages/projects');
  say(who.ok ? '  yes · Pages is reachable with this token'
             : `  no  · ${firstError(who.body)}`);
  if (!who.ok) {
    say('\n  The token cannot reach the account, so nothing else can be concluded.');
    say('  That is a different problem from KV: check the token itself.');
    process.exit(1);
  }

  rule('2 · Workers KV Storage');
  const list = await call('/storage/kv/namespaces?per_page=100');
  if (!list.ok) {
    say(`  NO · ${firstError(list.body)}`);
    say('\n  The token cannot list KV namespaces. That is why the deploy printed');
    say('  "KV LEDGER not bound", and it is why the lab has no budget ceiling.');
    say('\nFIX · dash.cloudflare.com -> My Profile -> API Tokens -> the token of this deploy');
    say('      -> Edit -> Add permission:  Account  ·  Workers KV Storage  ·  Edit');
    say('      -> Save. Then push anything; the next deploy binds the namespace.');
    process.exit(1);
  }

  const namespaces = Array.isArray(list.body?.result) ? list.body.result : [];
  say(`  yes · ${namespaces.length} namespace(s) visible`);
  for (const n of namespaces.slice(0, 12)) say(`        ${n.title}  ${n.id}`);

  rule('3 · the lab ledger');
  const hit = namespaces.find(n => n.title === TITLE);
  if (hit) {
    say(`  FOUND · ${hit.title}`);
    say(`  id     ${hit.id}`);
    say('\n  Nothing to create. If the lab still shows "the ledger is not connected",');
    say('  the deploy that binds it has not run since the token was fixed.');
    say(`  Run:  node tools/site-switch.mjs cloudflare   (or push to trigger it)`);
    return 0;
  }

  say(`  MISSING · no namespace titled "${TITLE}"`);
  if (!CREATE) {
    say('\n  Re-run with the "create" input ticked, or with CREATE=1, to make it.');
    return 1;
  }

  const made = await call('/storage/kv/namespaces', { method: 'POST', body: JSON.stringify({ title: TITLE }) });
  if (!made.ok) {
    say(`  FAILED · ${firstError(made.body)}`);
    return 1;
  }
  say(`  CREATED · ${made.body.result.title}`);
  say(`  id        ${made.body.result.id}`);
  say('\n  Next: push to the branch. tools/site-switch.mjs finds the namespace by');
  say('  title, writes [[kv_namespaces]] into cloud/lab/wrangler.toml, and the lab');
  say('  enforces the budget from that deploy onward.');
  return 0;
}

main().then(code => process.exit(code || 0)).catch(e => { say(`\nERROR · ${e?.message || e}`); process.exit(1); });
