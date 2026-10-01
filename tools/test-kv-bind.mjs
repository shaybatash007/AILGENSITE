// Behavioural proof for the declared-id bind: run the REAL pagesConfig and read the
// REAL wrangler.toml it writes, with the network replaced by a probe.
//
// The fixture in test-kv-declared.mjs checks the source text. This checks behaviour:
// that a declared id produces a wrangler.toml containing a [[kv_namespaces]] block, and
// that no HTTP request is attempted while producing it. The second half is the whole
// point - it is what makes the deploy independent of the token's KV permission.

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

// --- load the real functions out of site-switch.mjs, without running its CLI ---
// The module ends in a CLI dispatch. We take the two functions we need by slicing the
// source and evaluating just them, so the code under test is the shipped code, not a copy.
const src = fs.readFileSync(path.join(root, 'tools/site-switch.mjs'), 'utf8');
// Slice from kvNamespace to the end of pagesConfig. String#search has no `from` argument,
// so the closing brace is found by scanning forward from the writeFileSync call: the
// first `^}` AFTER that call closes pagesConfig. Searching from index 0 would match an
// earlier function and produce a slice that runs backwards, which is what happened once.
const from = src.indexOf('async function kvNamespace');
const writeAt = src.indexOf('fs.writeFileSync(path.join(fdir');
const to = src.indexOf('\n}', writeAt) + 2;
if (from < 0 || writeAt < 0 || writeAt < from || to <= writeAt) {
  console.error(`could not locate the functions: from=${from} writeAt=${writeAt} to=${to}`);
  process.exit(2);
}
const slice = src.slice(from, to);

const project = s => 'ailgen-' + s.name;
// site-switch.mjs closes over `root = process.cwd()` at module scope. The slice below is
// evaluated with new Function, so `root` must be supplied as a parameter - passing a
// directory in as an argument does nothing, because the body reads the closed-over name.
// (An earlier fixture missed that and looked for a file that was never written.)
const makeApi = (rootDir) => new Function('fs', 'path', 'root', 'project', 'fetch', `
  ${slice}
  return { pagesConfig, kvNamespace };
`);

async function scenario(label, surface, expectId, expectFetchCalls) {
  // site-switch.mjs resolves its paths from `root = process.cwd()`, so the sandbox has to
  // BE the working directory for the run - a temp path passed in as an argument is not
  // where the real code looks. That is why an earlier version of this fixture read a
  // wrangler.toml that did not exist: it was looking in the wrong tree.
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'kvb-'));
  fs.mkdirSync(path.join(dir, 'cloud/lab/functions'), { recursive: true });
  fs.mkdirSync(path.join(dir, 'built'), { recursive: true });

  const prevCwd = process.cwd();
  let fetched = 0;
  const fakeFetch = async (url) => { fetched++; return { json: async () => ({ success: false, errors: [{ message: 'Authentication error' }] }) }; };

  let toml = '', fdir = null;
  const origLog = console.log; console.log = () => {};
  try {
    const api = makeApi(dir)(fs, path, dir, project, fakeFetch);
    fdir = await api.pagesConfig(surface, path.join(dir, 'built'));
  } finally {
    console.log = origLog;
    process.chdir(prevCwd);
  }

  // pagesConfig returns fdir, and it is <root>/<functions> - "cloud/lab", NOT
  // "cloud/lab/functions". Reading the returned value is the only way to be sure.
  const tomlPath = fdir ? path.join(fdir, 'wrangler.toml') : path.join(dir, 'cloud/lab/wrangler.toml');
  toml = fs.existsSync(tomlPath) ? fs.readFileSync(tomlPath, 'utf8') : '';
  const m = toml.match(/\[\[kv_namespaces\]\][\s\S]*?id = "([^"]+)"/);

  console.log(`\n  ${label}`);
  ok('pagesConfig returned its functions dir', !!fdir, `got: ${fdir}`);
  ok('wrangler.toml exists', !!toml, tomlPath);
  if (expectId === '(none)') {
    // The API refused, so there is nothing to bind. A wrangler.toml with the AI binding
    // and no kv block is the CORRECT output: a lab with no LEDGER runs, shows each call's
    // own price, and - crucially - enforces no ceiling, which is why the deploy log says so.
    ok('the AI binding is still written', /\[\[?ai\]?\]/.test(toml) || /binding = "AI"/.test(toml), toml.slice(-160));
    ok('no KV block is written (the API failed, and that is honest)', !/\[\[kv_namespaces\]\]/.test(toml), toml.slice(-160));
  } else {
    ok('it declares the KV binding', /\[\[kv_namespaces\]\]/.test(toml), toml.slice(-200));
    ok(`binding id is ${expectId}`, m && m[1] === expectId, `got: ${m ? m[1] : '(none)'}`);
  }
  ok(`no API call was made (${expectFetchCalls} expected)`, fetched === expectFetchCalls, `made ${fetched}`);
  fs.rmSync(dir, { recursive: true, force: true });
  return toml;
}

console.log('KV declared-id · behaviour of the real pagesConfig');

await scenario('declared id, no token, network blocked', {
  name: 'lab', functions: 'cloud/lab', kv: ['LEDGER'], kvIds: { LEDGER: 'kv-id-declared-1234' },
}, 'kv-id-declared-1234', 0);

await scenario('no declared id -> falls back to the API (which fails)', {
  name: 'lab', functions: 'cloud/lab', kv: ['LEDGER'],
}, '(none)', 1);

// the fallback message must name the surfaces.json route, since that is the fix that
// does not require touching the token
{
  console.log('\n  the fallback message');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'kvm-'));
  fs.mkdirSync(path.join(dir, 'cloud/lab/functions'), { recursive: true });
  fs.mkdirSync(path.join(dir, 'built'), { recursive: true });
  const seen = [];
  const fakeFetch = async (url) => { seen.push(url); return { json: async () => ({ success: false, errors: [{ message: 'Authentication error' }] }) }; };
  const prevCwd = process.cwd();
  const orig = console.log; let msg = '';
  try {
    console.log = (...a) => { msg += a.join(' ') + '\n'; };
    const api = makeApi(dir)(fs, path, dir, project, fakeFetch);
    await api.pagesConfig({ name: 'lab', functions: 'cloud/lab', kv: ['LEDGER'] }, path.join(dir, 'built'));
  } finally {
    console.log = orig;
    process.chdir(prevCwd);
  }
  ok('it says the ceiling is NOT active', /WITHOUT its budget ceiling/i.test(msg), msg.trim());
  ok('it names the surfaces.json fix', /kvIds/.test(msg));
  ok('it explains why not to widen the token', /deliberately NOT suggested/.test(msg));
  ok('the request really went to the KV API', seen.length === 1 && /storage\/kv\/namespaces/.test(seen[0]), seen.join(' '));
  fs.rmSync(dir, { recursive: true, force: true });
}

// vars must still be written alongside the binding
{
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'kvv-'));
  fs.mkdirSync(path.join(dir, 'cloud/lab/functions'), { recursive: true });
  fs.mkdirSync(path.join(dir, 'built'), { recursive: true });
  const prevCwd = process.cwd();
  const orig = console.log; console.log = () => {};
  let fdir;
  try {
    const api = makeApi(dir)(fs, path, dir, project, async () => ({ json: async () => ({}) }));
    fdir = await api.pagesConfig({
      name: 'lab', functions: 'cloud/lab', kv: ['LEDGER'], kvIds: { LEDGER: 'kv-x' },
      vars: { LAB_BUDGET_USD: '100', LAB_GATEWAY: 'ailgen-lab' },
    }, path.join(dir, 'built'));
  } finally { console.log = orig; process.chdir(prevCwd); }
  const toml = fs.readFileSync(path.join(fdir, 'wrangler.toml'), 'utf8');
  ok('the AI binding is still declared', /\[ai\]\s*\nbinding = "AI"/.test(toml), toml);
  ok('vars survive alongside kvIds', /LAB_BUDGET_USD = "100"/.test(toml) && /LAB_GATEWAY = "ailgen-lab"/.test(toml));
  ok('the KV id is written verbatim', /id = "kv-x"/.test(toml));
  fs.rmSync(dir, { recursive: true, force: true });
}

console.log(`\n  ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
