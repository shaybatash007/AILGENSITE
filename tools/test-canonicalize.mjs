/**
 * Fixture test for tools/canonicalize-paths.mjs.
 *
 * The first version of that tool deleted 14 real sessions, because its dedupe
 * predicate `col = ? AND col != ?` was a tautology over the rows it matched. A
 * fixture that reproduces the live database's exact shape is the check that
 * would have caught it, so it exists, and it runs.
 *
 *   node tools/test-canonicalize.mjs   (npm run test:canon)
 */
import { DatabaseSync } from "node:sqlite";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const TMP = path.join(os.tmpdir(), "opencode", "canon-fixture");
const DB = path.join(TMP, "opencode.db");
const TOOL = path.resolve("tools/canonicalize-paths.mjs");

/* Measured on the pre-migration database: opencode writes FORWARD slashes on
   Windows. The backslash spelling is what tools/migrate-home.mjs introduced, and
   the mismatch between the two is what made the Web UI bind an empty project. */
const CANON = "C:/Users/shayb/projects/AILGENSITE";
const MIGRATED = "C:\\Users\\shayb\\projects\\AILGENSITE";

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
// Connections are opened and closed per call: an unclosed handle keeps the file
// locked on Windows and the teardown at the end of this script throws EBUSY.
const query = (sql) => {
  const c = new DatabaseSync(DB, { readOnly: true });
  try { return c.prepare(sql).all(); } finally { c.close(); }
};
const rows = (sql) => query(sql);
const one = (sql) => { const r = query(sql); return r[0] ? Object.values(r[0])[0] : undefined; };

fs.rmSync(TMP, { recursive: true, force: true });
fs.mkdirSync(TMP, { recursive: true });

const db = new DatabaseSync(DB);
db.exec(`
  CREATE TABLE project (id text PRIMARY KEY, worktree text NOT NULL, time_created integer NOT NULL);
  CREATE TABLE project_directory (project_id text NOT NULL, directory text NOT NULL, type text, strategy text, time_created integer NOT NULL,
    CONSTRAINT project_directory_pk PRIMARY KEY(project_id, directory));
  CREATE TABLE session (id text PRIMARY KEY, title text, directory text, project_id text, time_created integer NOT NULL);
  CREATE TABLE message (id text PRIMARY KEY, session_id text, body text);
  CREATE TABLE part (id text PRIMARY KEY, message_id text, text text);
  -- directory is part of the primary key, so renaming a spelling that is
     -- already present would violate it. No dedupe rule is declared for it.
  CREATE TABLE workspace (directory text NOT NULL, time_created integer NOT NULL, PRIMARY KEY (directory, time_created));
`);
db.exec(`INSERT INTO project VALUES ('global', '/', 1), ('d70c', '${CANON}', 2)`);
// opencode wrote this one; the migration added a second row for the same project
// under a different spelling. That pair is the only true duplicate in the file.
db.exec(`INSERT INTO project_directory VALUES ('d70c', '${CANON}', null, null, 3), ('d70c', '${MIGRATED}', null, null, 4)`);
// 13 sessions the migration rewrote to backslashes, 2 that opencode created after
// the move, and one unrelated session rooted in another directory.
for (let i = 0; i < 13; i++) db.exec(`INSERT INTO session VALUES ('ses_migrated_${i}', 'm${i}', '${MIGRATED}', 'd70c', ${100 + i})`);
db.exec(`INSERT INTO session VALUES ('ses_new_a', 'a', '${CANON}', 'd70c', 200), ('ses_new_b', 'b', '${CANON}', 'd70c', 201)`);
db.exec(`INSERT INTO session VALUES ('ses_videos', 'v', 'C:/Users/shayb/Videos', null, 202)`);
for (let i = 0; i < 13; i++) db.exec(`INSERT INTO message VALUES ('msg_${i}', 'ses_migrated_${i}', 'body ${i}')`);
for (let i = 0; i < 13; i++) db.exec(`INSERT INTO part VALUES ('part_${i}', 'msg_${i}', 'text ${i}')`);
db.close();

console.log("\n  1. --check reports the divergence and refuses to act");
let r = run("--check");
if (r.code !== 1) console.log("  [tool output]\n" + r.out);
check("--check exits 1 when work is pending", r.code, 1);
check("--check flags the backslash spelling", /needs normalising/.test(r.out), true);
check("--check leaves the Videos row canonical", /Videos.{0,30}canonical/.test(r.out.replace(/\n/g, " ")), true);
check("--check reports the rehearsal is not the thing that failed", /rehearsal/.test(r.out), false);

console.log("\n  2. --check changed nothing");
check("16 sessions still present", one("SELECT COUNT(*) c FROM session"), 16);
check("13 messages intact", one("SELECT COUNT(*) c FROM message"), 13);
check("13 parts intact", one("SELECT COUNT(*) c FROM part"), 13);
check("project_directory still 2 rows", one("SELECT COUNT(*) c FROM project_directory"), 2);

console.log("\n  3. --apply");
r = run("--apply");
if (r.code !== 0) console.log("  [tool output]\n" + r.out);
check("--apply exits 0", r.code, 0);
check("--apply rehearsed on a copy first", /rehearsal passed on a copy/.test(r.out), true);

console.log("\n  4. nothing was destroyed, and everything converged");
const sessions = rows("SELECT id, directory FROM session ORDER BY id");
check("every session survived (16)", sessions.length, 16);
check("all 13 migration-rewritten sessions survived and were renamed",
  sessions.filter((s) => s.id.startsWith("ses_migrated_")).map((s) => s.directory),
  Array(13).fill(CANON));
check("the 2 sessions opencode created were not disturbed",
  sessions.filter((s) => s.id.startsWith("ses_new_")).map((s) => s.directory), [CANON, CANON]);
check("the unrelated Videos session was left alone",
  sessions.find((s) => s.id === "ses_videos").directory, "C:/Users/shayb/Videos");
check("the global project's '/' sentinel was left alone", one("SELECT worktree FROM project WHERE id='global'"), "/");
check("the project worktree was already canonical and is unchanged", one("SELECT worktree FROM project WHERE id='d70c'"), CANON);
check("project_directory collapsed to exactly one row", one("SELECT COUNT(*) c FROM project_directory"), 1);
check("and it is the canonical spelling", one("SELECT directory FROM project_directory"), CANON);
check("messages intact", one("SELECT COUNT(*) c FROM message"), 13);
check("parts intact", one("SELECT COUNT(*) c FROM part"), 13);
console.log("         [dirs] " + JSON.stringify(rows("SELECT directory, COUNT(*) c FROM session GROUP BY directory")));
check("15 sessions now share one directory string",
  one(`SELECT COUNT(*) c FROM session WHERE directory = '${CANON}'`), 15);

console.log("\n  5. it is idempotent");
r = run("--apply");
check("a second --apply exits 0 with nothing to do", r.code, 0);
check("still 16 sessions", one("SELECT COUNT(*) c FROM session"), 16);

console.log("\n  6. an undeclared collision aborts instead of guessing");
const d6 = new DatabaseSync(DB);
d6.exec(`DELETE FROM workspace`);
d6.exec(`INSERT INTO workspace VALUES ('${CANON}', 1), ('${MIGRATED}', 2)`);
d6.close();
r = run("--apply");
if (r.code === 0) console.log("  [tool output]\n" + r.out);
check("it refuses", r.code, 1);
check("it says why", /no declared dedupe rule/.test(r.out), true);
check("and the live file is untouched", one(`SELECT COUNT(*) c FROM workspace WHERE directory = '${MIGRATED}'`), 1);
check("sessions still 16", one("SELECT COUNT(*) c FROM session"), 16);

console.log("\n  7. removing the collision lets the plain rename proceed");
const d7 = new DatabaseSync(DB);
d7.exec(`DELETE FROM workspace WHERE directory = '${CANON}'`);
d7.close();
r = run("--apply");
if (r.code !== 0) console.log("  [tool output]\n" + r.out);
check("it succeeds", r.code, 0);
check("the workspace row was renamed, not deleted", one(`SELECT COUNT(*) c FROM workspace WHERE directory = '${CANON}'`), 1);
check("sessions still 16 after the workspace fix", one("SELECT COUNT(*) c FROM session"), 16);

fs.rmSync(TMP, { recursive: true, force: true });
console.log(failures ? `\n  ${failures} FAILURE(S)\n` : "\n  all fixture checks passed\n");
process.exit(failures ? 1 : 0);
