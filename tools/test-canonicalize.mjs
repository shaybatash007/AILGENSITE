/**
 * Fixture test for tools/canonicalize-paths.mjs.
 *
 *   node tools/test-canonicalize.mjs      (npm run test:canon)
 *
 * The first version of the tool this guards destroyed 14 real sessions. The
 * second version shipped a fixture that PASSED while that bug was reintroduced
 * and a real row was deleted, because the fixture only ever contained a
 * *complete* duplicate, so the identity restriction on the dedupe DELETE was
 * never load-bearing in any assertion. Case 4 below is that exact gap, and
 * tools/test-mutation.mjs proves this file fails when the bug comes back.
 */
import { DatabaseSync } from "node:sqlite";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { build, counts, CANON, MIGRATED, OTHER } from "./fixture.mjs";

const TMP = path.join(os.tmpdir(), "opencode", "canon-fixture");
const DB = path.join(TMP, "opencode.db");
const TOOL = path.resolve("tools/canonicalize-paths.mjs");

let failures = 0;
const check = (label, actual, expected) => {
  const pass = JSON.stringify(actual) === JSON.stringify(expected);
  if (!pass) failures++;
  console.log(`  ${pass ? "PASS" : "FAIL"}  ${label}${pass ? "" : `\n         expected ${JSON.stringify(expected)}\n         actual   ${JSON.stringify(actual)}`}`);
};
const run = (...args) => {
  try { return { code: 0, out: execFileSync(process.execPath, [TOOL, ...args], { env: { ...process.env, OPENCODE_DB: DB, NO_COLOR: "1" }, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }) }; }
  catch (e) { return { code: e.status, out: (e.stdout || "") + (e.stderr || "") }; }
};
// Connections open and close per call. An unclosed handle keeps the file locked
// on Windows and the teardown below throws EPERM.
const q = (sql) => {
  const c = new DatabaseSync(DB, { readOnly: true });
  try { return c.prepare(sql).all(); } finally { c.close(); }
};
const one = (sql) => { const r = q(sql); return r[0] ? Object.values(r[0])[0] : undefined; };

const { db: seed } = build(TMP);
seed.close();
const seedConn = new DatabaseSync(DB, { readOnly: true });
const before = counts(seedConn);
seedConn.close();

console.log("\n  fixture schema is derived from the live database");
const tables = q("SELECT name AS t FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").length;
check("it has the live table count (20)", tables, 20);
check("message really has a FK to session with ON DELETE CASCADE",
  /REFERENCES\s+`?session`?\s*\(?`?id`?\)?\s*ON DELETE CASCADE/i.test(
    q("SELECT sql AS s FROM sqlite_master WHERE name='message'")[0].s), true);
check("workspace keys on id, so `directory` is NOT in the primary key",
  q("SELECT name FROM pragma_table_info('workspace') WHERE pk > 0").map((r) => r.name).join(","), "id");

console.log("\n  1. --check reports the divergence and refuses to act");
let r = run("--check");
if (r.code !== 1) console.log("  [tool output]\n" + r.out);
check("--check exits 1 when work is pending", r.code, 1);
check("--check flags the backslash spelling", /needs normalising/.test(r.out), true);
check("--check changed nothing", one("SELECT COUNT(*) c FROM project_directory"), 3);

console.log("\n  2. --apply");
r = run("--apply");
if (r.code !== 0) console.log("  [tool output]\n" + r.out);
const applyOut = r.out;               // kept: this is the run that made a backup
check("--apply exits 0", r.code, 0);
check("it rehearsed on a copy first", /rehearsal passed on a copy/.test(applyOut), true);

console.log("\n  3. the pA/pB case: a non-duplicate spelling must SURVIVE");
const pd = q("SELECT project_id, directory, time_created FROM project_directory ORDER BY project_id, directory");
check("pA collapsed to one canonical row", pd.filter((r) => r.project_id === "pA").map((r) => r.directory), [CANON]);
check("pB SURVIVED, renamed, not deleted - this is the row the tautology kills",
  pd.filter((r) => r.project_id === "pB").map((r) => r.directory), [CANON]);
check("project_directory went 3 -> 2, not 3 -> 1", one("SELECT COUNT(*) c FROM project_directory"), 2);
// WHICH row survives matters. A dedupe that deletes the canonical row and keeps
// the duplicate produces the same row COUNT and the same spelling, so every
// count-based assertion above still passes - while silently losing the original
// row's own data. pA's canonical row was created at t=4, its duplicate at t=5,
// so the survivor's time_created says which one it was.
check("the SURVIVOR is the row that already held the canonical spelling, not the duplicate",
  one(`SELECT time_created FROM project_directory WHERE project_id='pA' AND directory='${CANON}'`), 4);

console.log("\n  4. nothing was destroyed");
check("16 sessions still present", one("SELECT COUNT(*) c FROM session"), 16);
check("13 migration-rewritten sessions survived and were renamed",
  q("SELECT directory FROM session WHERE id LIKE 'ses_migrated_%'").map((r) => r.directory), Array(13).fill(CANON));
check("the 2 sessions opencode created were not disturbed",
  q("SELECT directory FROM session WHERE id LIKE 'ses_new_%'").map((r) => r.directory), [CANON, CANON]);
check("the unrelated session was left alone", one("SELECT directory FROM session WHERE id='ses_videos'"), OTHER);
check("the global '/' sentinel was left alone", one("SELECT worktree FROM project WHERE id='global'"), "/");
check("messages intact", one("SELECT COUNT(*) c FROM message"), before.get("message"));
check("parts intact", one("SELECT COUNT(*) c FROM part"), before.get("part"));
check("no orphan parts", one("SELECT COUNT(*) c FROM part p LEFT JOIN message m ON m.id=p.message_id WHERE m.id IS NULL"), 0);
check("the assertNonDestructive report named the declared delete",
  /project_directory: \d+ -> \d+ \(-1, all declared duplicates\)/.test(r.out), true);

console.log("\n  5. idempotent");
r = run("--apply");
check("a second --apply exits 0 with nothing to do", r.code, 0);
check("still 16 sessions", one("SELECT COUNT(*) c FROM session"), 16);

console.log("\n  6. a real backup is produced and it is restorable");
const backups = path.join(TMP, "backups");
check("it is a single self-contained file, with no -wal sibling",
  fs.readdirSync(backups).filter((f) => f.endsWith("-wal")).length, 0);
// Take the path from the run that actually did the work. A later no-op --apply
// creates no backup, and readdir also contains the scratch copies this test makes.
const m = /backup verified -> (.+)/.exec(applyOut);
check("the tool reported a backup path", !!m, true);
const bk = (m ? m[1] : "MISSING").trim();
check("it exists", fs.existsSync(bk), true);
const bkDb = new DatabaseSync(bk, { readOnly: true });
check("it passes integrity_check", Object.values(bkDb.prepare("PRAGMA integrity_check").get())[0], "ok");
const bkSessions = bkDb.prepare("SELECT COUNT(*) c FROM session").get().c;
const bkPd = bkDb.prepare("SELECT COUNT(*) c FROM project_directory").get().c;
bkDb.close();
check("it holds the full session count", bkSessions, 16);

console.log("\n  7. --restore is a true rollback, and it clears a stale WAL");
// The tool backs up BEFORE it transforms, so a restore returns the file to its
// pre-canonicalisation state. That is the correct semantic, and it is asserted
// here rather than assumed.
const livePd = one("SELECT COUNT(*) c FROM project_directory");
const dmg = new DatabaseSync(DB);
dmg.exec(`DELETE FROM project_directory WHERE project_id='pB'`);
dmg.close();
const damaged = one("SELECT COUNT(*) c FROM project_directory");
check("the live file really lost a row", damaged, livePd - 1);

// The stale WAL must be planted AFTER the last read, or SQLite consumes it on
// open and there is nothing left for the restore to clear.
fs.writeFileSync(DB + "-wal", Buffer.from("stale frames from the corrupted state"));
const had = fs.existsSync(DB + "-wal");

r = run("--restore", bk);
if (r.code !== 0) console.log("  [tool output]\n" + r.out);
check("--restore exits 0", r.code, 0);
check("a stale WAL was really present to clear", had, true);
check("it removed the stale -wal", /removed stale opencode\.db-wal/.test(r.out), true);
check("it verified the backup before writing", /backup verified: integrity_check ok/.test(r.out), true);
check("it verified the restored file", /restored .* integrity_check ok/.test(r.out), true);
check("the lost row is back", one("SELECT COUNT(*) c FROM project_directory"), bkPd);
check("and the rollback restored the PRE-transform state, backslash spelling and all",
  one(`SELECT COUNT(*) c FROM project_directory WHERE directory = '${MIGRATED}'`) > 0, true);
check("the stale WAL is gone from disk", fs.existsSync(DB + "-wal"), false);
check("no session was lost by the restore", one("SELECT COUNT(*) c FROM session"), 16);

console.log("\n  8. --restore refuses a corrupt backup");
const before_corrupt = one("SELECT COUNT(*) c FROM project_directory");
const corrupt = path.join(TMP, "opencode-corrupt.db");
fs.writeFileSync(corrupt, Buffer.alloc(200000, 0x41));
r = run("--restore", corrupt);
check("it refuses", r.code, 1);
check("and says why", /integrity_check|not a database/i.test(r.out), true);
check("the live file is untouched", one("SELECT COUNT(*) c FROM project_directory"), before_corrupt);

fs.rmSync(TMP, { recursive: true, force: true });
console.log(failures ? `\n  ${failures} FAILURE(S)\n` : "\n  all fixture checks passed\n");
process.exit(failures ? 1 : 0);
