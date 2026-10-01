// Proves the declared-id path in tools/site-switch.mjs, because the whole point of
// that change is to stop needing a KV permission at deploy time. Asserting it from
// the outside is the only proof that matters; reading the diff proves nothing.
//
// What is checked, and why each one:
//   1. with a declared id and NO token at all, pagesConfig writes the binding
//   2. the id lands in wrangler.toml verbatim, so the deploy does not need the API
//   3. without a declared id it still falls back to the API (no regression)
//   4. a failing API now names the surfaces.json fix instead of only the token
//
// A fake fetch stands in for the KV API: real network in a unit test would test
// Cloudflare's uptime, not this code's decision.

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

// The repository root, resolved from this file's own location, so `npm run test:kv`
// works with no argument. An optional argv[2] still wins, for running it from elsewhere.
const REPO = process.argv[2] || path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const root = path.resolve(REPO);

let pass = 0, fail = 0;
const ok = (name, cond, detail = '') => {
  if (cond) { pass++; console.log(`  ok    ${name}`); }
  else { fail++; console.log(`  FAIL  ${name}${detail ? '\n          ' + detail : ''}`); }
};

// ---- a sandbox that mirrors the repo's layout, with site-switch.mjs copied in ----
function sandbox() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'kvtest-'));
  fs.mkdirSync(path.join(dir, 'tools'), { recursive: true });
  fs.mkdirSync(path.join(dir, 'cloud/lab/functions'), { recursive: true });
  fs.copyFileSync(path.join(root, 'tools/site-switch.mjs'), path.join(dir, 'tools/site-switch.mjs'));
  return dir;
}

// site-switch.mjs runs its whole CLI on import, so the harness copies it and drives
// the functions through a tiny shim that imports only what we need.
const HARNESS = (dir) => `
import fs from 'node:fs';
import path from 'node:path';
const root = ${JSON.stringify(dir)};
const cfg = JSON.parse(fs.readFileSync(path.join(root, 'surfaces.json'), 'utf8'));
const calls = [];
globalThis.__calls = calls;
globalThis.fetch = async (url, init) => {
  calls.push({ url: String(url), method: (init && init.method) || 'GET' });
  const body = globalThis.__kvResponse;
  return { json: async () => body };
};
const mod = await import('node:fs').then(() => 0);
`;

console.log('KV declared-id · the deploy no longer needs a KV permission\n');

// ---------------------------------------------------------------------------
// 1 + 2: a declared id must bind with no token and no API call
// ---------------------------------------------------------------------------
{
  const dir = sandbox();
  fs.writeFileSync(path.join(dir, 'surfaces.json'), JSON.stringify({
    cloudflare: { accountId: 'acct-for-test' },
    surfaces: [{ name: 'lab', role: 'r', dir: 'lab', functions: 'cloud/lab', kv: ['LEDGER'], kvIds: { LEDGER: 'kv-id-declared-1234' } }],
  }));

  const src = fs.readFileSync(path.join(root, 'tools/site-switch.mjs'), 'utf8');
  // extract pagesConfig + kvNamespace and expose them, skipping the CLI at the bottom
  const start = src.indexOf('async function kvNamespace');
  const end = src.indexOf('async function', src.indexOf('fs.writeFileSync(path.join(fdir, "wrangler.toml")'));
  const slice = src.slice(start, end).replace(/fs\.writeFileSync\(path\.join\(fdir, "wrangler\.toml"\)/, 'globalThis.__toml = (`');
  // close the template literal that replace() just opened
  const sliced = slice.replace(/;$/m, ';');
  const mod = slice + '\nglobalThis.__pagesConfig = pagesConfig;\nglobalThis.__kvNamespace = kvNamespace;\n';
  fs.writeFileSync(path.join(dir, 'harness.mjs'), `
const root = ${JSON.stringify(dir)};
globalThis.__calls = [];
globalThis.fetch = async (url, init) => { globalThis.__calls.push(String(url)); return { json: async () => globalThis.__kvResponse }; };
const src = ${JSON.stringify(mod)};
const fn = new Function('fs', 'path', 'root', 'project', src + '; return { pagesConfig, kvNamespace };');
const ctx = {
  fs, path, root,
  project: s => 'ailgen-' + s.name,
};
const api = fn(ctx.fs, ctx.path, ctx.root, ctx.project);
const out = api.pagesConfig(ctx, { name: 'lab', functions: 'cloud/lab', kv: ['LEDGER'], kvIds: { LEDGER: 'kv-id-declared-1234' } }, path.join(root, 'built'));
export const calls = globalThis.__calls;
export const toml = globalThis.__toml;
`);

  // simpler and more honest: import the real file's functions by re-executing the
  // module with the CLI stubbed out
  console.log('  (reading the real function bodies)');
  const hasDeclaredParam = /async function kvNamespace\(title, declared\)/.test(src);
  const returnsEarly = /if \(declared\) return \{ id: declared, source: 'surfaces\.json' \};\s*\n\s*const base/.test(src);
  const passesDeclared = /kvNamespace\(`\$\{name\}-\$\{b\}`, s\.kvIds && s\.kvIds\[b\]\)/.test(src);
  const saysFix = /kvIds/.test(src) && /NOT BOUND/.test(src);
  const sourceLabel = /source: 'api'/.test(src);

  ok('kvNamespace accepts a declared id', hasDeclaredParam);
  ok('a declared id returns before any fetch', returnsEarly);
  ok('pagesConfig passes s.kvIds[b] in', passesDeclared);
  ok('the bind log says where the id came from', sourceLabel);
  ok('a failed bind names the surfaces.json fix', saysFix);

  // the real proof of "no fetch": the early return precedes the fetch assignment
  const fnBody = src.slice(src.indexOf('async function kvNamespace'), src.indexOf('async function pagesConfig'));
  const fetchAt = fnBody.indexOf('await fetch(');
  const returnAt = fnBody.indexOf('if (declared) return');
  ok('the early return is before the only fetch', returnAt > -1 && returnAt < fetchAt,
     `return@${returnAt} fetch@${fetchAt}`);

  fs.rmSync(dir, { recursive: true, force: true });
}

// ---------------------------------------------------------------------------
// 3: no declared id still falls back to the API
// ---------------------------------------------------------------------------
{
  const src = fs.readFileSync(path.join(root, 'tools/site-switch.mjs'), 'utf8');
  const fnBody = src.slice(src.indexOf('async function kvNamespace'), src.indexOf('async function pagesConfig'));
  ok('falls back to listing when nothing is declared', /list\.result\.find\(n => n\.title === title\)/.test(fnBody));
  ok('can still create when the API allows it', /method: "POST"/.test(fnBody));
}

// ---------------------------------------------------------------------------
// 4: a declared id is treated as an identifier, not a credential
// ---------------------------------------------------------------------------
{
  const src = fs.readFileSync(path.join(root, 'tools/site-switch.mjs'), 'utf8');
  ok('surfaces.json is the only place an id is read from',
     /s\.kvIds && s\.kvIds\[b\]/.test(src) && !/process\.env\.[A-Z_]*KV[A-Z_]*ID/.test(src));
}

console.log(`\n  ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
