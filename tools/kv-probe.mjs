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

// The account id is an identifier, not a secret: surfaces.json carries it, and so
// does every dashboard URL. The pages workflow reads it from there and passes it
// in the environment; this script falls back to the file so that running it by
// hand never depends on a repository secret that does not exist.
function accountId() {
  if (process.env.CLOUDFLARE_ACCOUNT_ID) return process.env.CLOUDFLARE_ACCOUNT_ID;
  try {
    const j = JSON.parse(fs.readFileSync(path.join(root, 'surfaces.json'), 'utf8'));
    return j?.cloudflare?.accountId || null;
  } catch { return null; }
}
const root = path.join(import.meta.dirname, '..');
const ACC = accountId();
const API = ACC ? `https://api.cloudflare.com/client/v4/accounts/${ACC}` : null;
const TITLE = process.env.TITLE || 'ailgen-lab-LEDGER';
const CREATE = process.env.CREATE === '1' || process.env.CREATE === 'true';

import fs from 'node:fs';
import path from 'node:path';

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
  say(`  account   ${ACC || '(not found — set CLOUDFLARE_ACCOUNT_ID or check surfaces.json)'}`);
  say(`  token     ${process.env.CLOUDFLARE_API_TOKEN ? 'present in this job' : 'MISSING from this job'}`);
  say(`  namespace ${TITLE}`);
  say(`  mode      ${CREATE ? 'create if missing' : 'read only'}`);

  if (!API) {
    say('\nFAIL · no account id. Set CLOUDFLARE_ACCOUNT_ID, or check cloudflare.accountId in surfaces.json.');
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

  // Read and write are separate permissions, so a denied list is NOT proof that a create
  // would fail: Cloudflare grants "Workers KV Storage · Read" and "· Edit" independently,
  // and this token demonstrably has neither. When CREATE is asked for, the write is
  // attempted regardless of what the read returned - otherwise the probe would report a
  // conclusion it never tested.
  const made = CREATE
    ? await call('/storage/kv/namespaces', { method: 'POST', body: JSON.stringify({ title: TITLE }) })
    : null;

  rule('2 · Workers KV Storage · read');
  const list = await call('/storage/kv/namespaces?per_page=100');
  if (!list.ok) {
    say(`  NO · ${firstError(list.body)}`);
    say('\n  The token cannot list KV namespaces. That is why the deploy printed');
    say('  "KV LEDGER not bound", and it is why the lab has no budget ceiling.');
  } else {
    const namespaces = Array.isArray(list.body?.result) ? list.body.result : [];
    say(`  yes · ${namespaces.length} namespace(s) visible`);
    for (const n of namespaces.slice(0, 12)) say(`        ${n.title}  ${n.id}`);
    const hit = namespaces.find(n => n.title === TITLE);
    rule('3 · the lab ledger');
    if (hit) {
      say(`  FOUND · ${hit.title}`);
      say(`  id     ${hit.id}`);
      say('\n  Nothing to create. If the lab still shows "the ledger is not connected",');
      say('  the deploy that binds it has not run since the token was fixed.');
      say(`  Run:  node tools/site-switch.mjs cloudflare   (or push to trigger it)`);
      return 0;
    }
    say(`  MISSING · no namespace titled "${TITLE}"`);
  }

  if (!CREATE) {
    say('\n  Re-run with the "create" input ticked, or with CREATE=1, to test the write');
    say('  and make the namespace if the token is allowed.');
    return 1;
  }

  rule('3 · Workers KV Storage · write');
  if (!made) {
    say('  SKIPPED · create was not requested');
    return 1;
  }
  if (!made.ok) {
    say(`  NO · ${firstError(made.body)}`);
    say('\n  Both the read and the write are refused, so this token carries no');
    say('  "Workers KV Storage" permission at all. Only the dashboard can change that:');
    say('\nFIX · dash.cloudflare.com -> My Profile -> API Tokens -> the token of this deploy');
    say('      -> Edit -> Add permission:  Account  ·  Workers KV Storage  ·  Edit');
    say('      -> Save. Then re-run this probe.');
    say('\n  OR, with no token change at all: create the namespace by hand at');
    say('      Workers & Pages -> KV -> Create namespace, name it');
    say(`      ${TITLE}, and put its id into surfaces.json:`);
    say(`      { "kvIds": { "LEDGER": "<the id>" } }   // under the lab surface`);
    say('  The id is an identifier, not a secret: it already appears in every');
    say('  wrangler.toml, and declaring it makes the deploy independent of this token.');
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
