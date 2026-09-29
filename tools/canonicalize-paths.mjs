#!/usr/bin/env node
/**
 * canonicalize-paths.mjs - make every directory string in opencode.db agree.
 *
 * WHY
 * ---
 * opencode keys projects, sessions and directories by literal string. A
 * migration that writes "C:/Users/x" while the running opencode writes
 * "C:\Users\x" silently splits one history in two, and the Web UI then binds a
 * project with no sessions - the same empty view as before, but far more
 * confusing because the data is plainly present.
 *
 * This normalises every path column to the platform-native form.
 *
 * WHY IT IS BUILT THE WAY IT IS
 * -----------------------------
 * The first version of this file destroyed 14 sessions. Its "collapse the
 * duplicate" step was
 *
 *     DELETE FROM session WHERE directory = ? AND directory != ?
 *
 * which is not a dedupe at all: the second predicate is the constant the first
 * one was written to exclude, so the statement is true for every row it matches
 * and it deleted the entire non-canonical spelling - history, messages and all.
 * The following UPDATE then matched zero rows and reported success. 657
 * messages and 2,825 parts went with them, and the run that was mid-write
 * started throwing `Failed query: insert into "part"`, which is how the
 * disconnect was finally noticed.
 *
 * Two rules exist here so that cannot happen again:
 *
 *   1. REHEARSE FIRST. The exact transformation runs against a copy made with
 *      VACUUM INTO, and the live file is not opened for writing unless the copy
 *      produced the expected result.
 *   2. PROVE NON-DESTRUCTION. A row-count invariant runs over every table. Any
 *      table that loses a row must be explicitly declared as one that may lose
 *      rows, and the deleted rows are printed by primary key. Anything else is
 *      a hard abort.
 *
 * USAGE
 *   node tools/canonicalize-paths.mjs --check
 *   node tools/canonicalize-paths.mjs --apply
 */

import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const DB_DIR = path.join(os.homedir(), ".local", "share", "opencode");
// OPENCODE_DB exists so the rehearsal logic can be tested against a fixture.
// Nothing in the normal path sets it.
// OPENCODE_DB exists so the rehearsal logic can be tested against a fixture.
// Nothing in the normal path sets it. When it is set, backups and the rehearsal
// copy stay beside the fixture rather than polluting the real data directory.
const DB = process.env.OPENCODE_DB || path.join(DB_DIR, "opencode.db");
const SCRATCH_DIR = process.env.OPENCODE_DB ? path.dirname(DB) : DB_DIR;
const BACKUPS = process.env.OPENCODE_DB ? path.join(path.dirname(DB), "backups") : path.join(DB_DIR, "backups");

const argv = process.argv.slice(2);
const has = (f) => argv.includes(f);

const C = { g: "\x1b[32m", r: "\x1b[31m", d: "\x1b[90m", y: "\x1b[33m", x: "\x1b[0m" };
const ok = (m) => console.log(`  ${C.g}OK${C.x}  ${m}`);
const bad = (m) => { console.log(`  ${C.r}!!${C.x}  ${m}`); process.exitCode = 1; };
const info = (m) => console.log(`  ${C.d}${m}${C.x}`);

/* Path columns. Reading these is harmless; writing to a table not listed here is
   not attempted at all. */
const TABLES = [
  { table: "project", column: "worktree" },
  { table: "project_directory", column: "directory" },
  { table: "session", column: "directory" },
  { table: "workspace", column: "directory" },
];

/* The only renames that can create a true duplicate row, declared explicitly.
   `identity` is the set of columns that, together with the path column, make a
   row mean one thing. `session` is deliberately absent: session.directory is not
   unique, fifteen sessions sharing a directory is normal and correct, and no
   two of them are duplicates of each other. */
const DEDUPE = {
  "project_directory.directory": { identity: ["project_id"] },
};

/* The canonical spelling is whatever the running opencode writes, and on Windows
   that is FORWARD slashes. This is not a guess and not a style preference - it
   was measured on the pre-migration database, where opencode itself had written
   project.worktree, project_directory and all 14 sessions as
   "C:/mastercoding/AILGENSITE". The backslash spelling in this database was put
   there by tools/migrate-home.mjs, and the two spellings do not match, which is
   precisely why the Web UI binds a project with no sessions.

   Only real absolute paths are touched. The global project stores "/" as a
   sentinel, and rewriting that would break the one project that must never be
   scoped to a directory. */
const isRealPath = (p) => typeof p === "string" && /^[A-Za-z]:[\\/]/.test(p);
const canon = (p) => (isRealPath(p) ? p.replace(/\\/g, "/") : p);
const CANON_NAME = "forward slashes (what opencode writes)";

function survey(db) {
  const out = [];
  for (const { table, column } of TABLES) {
    let rows;
    try { rows = db.prepare(`SELECT ${column} d, COUNT(*) c FROM ${table} WHERE ${column} IS NOT NULL GROUP BY ${column}`).all(); }
    catch { continue; }
    for (const r of rows) {
      const canonical = canon(r.d);
      out.push({ table, column, value: r.d, count: r.c, canonical, needsFix: canonical !== r.d });
    }
  }
  return out;
}

function rowCounts(db) {
  const out = new Map();
  for (const { table } of db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").all()) {
    try { out.set(table, db.prepare(`SELECT COUNT(*) c FROM "${table}"`).get().c); }
    catch { /* a table we cannot count is a table we never write */ }
  }
  return out;
}

function primaryKey(db, table) {
  return db.prepare(`SELECT name FROM pragma_table_info('${table.replace(/'/g, "''")}') WHERE pk > 0 ORDER BY pk`).all().map((r) => r.name);
}

/* ------------------------------------------------------------ transform --- */
/* Applied identically to the rehearsal copy and to the live file. Everything it
   is allowed to do is visible in these twenty lines. */
function transform(db, offenders, log) {
  for (const r of offenders) {
    const key = `${r.table}.${r.column}`;
    // A rename can only collide when the path column is part of the row's
    // identity. session.directory is not: fifteen sessions sharing a directory
    // is normal, so nothing is ever compared, deleted or merged there.
    const pk = primaryKey(db, r.table);
    const pathInKey = pk.includes(r.column);

    if (pathInKey) {
      const canonicalRows = db.prepare(`SELECT COUNT(*) c FROM ${r.table} WHERE ${r.column} = ?`).get(r.canonical).c;
      if (canonicalRows > 0) {
        // A row already holds the canonical spelling, so renaming this one would
        // either violate the primary key or create a second row for the same
        // thing. The duplicate has to go, and only a declared rule may say so.
        const rule = DEDUPE[key];
        if (!rule) {
          throw new Error(
            `${key} is part of the primary key, already holds the canonical value ` +
            `${JSON.stringify(r.canonical)}, and has no declared dedupe rule. Refusing to guess.`);
        }
        const where = [`${r.column} = ?`, ...rule.identity.map((c) => `${c} IN (SELECT ${c} FROM ${r.table} WHERE ${r.column} = ?)`)].join(" AND ");
        const params = [r.value, ...rule.identity.map(() => r.canonical)];
        const victims = db.prepare(`SELECT ${pk.join(", ")} FROM ${r.table} WHERE ${where}`).all(...params);
        const del = db.prepare(`DELETE FROM ${r.table} WHERE ${where}`).run(...params);
        log(`${key}: ${del.changes} duplicate row(s) for ${JSON.stringify(victims.map((v) => pk.map((c) => v[c]).join("/")))}`);
      }
    }

    const up = db.prepare(`UPDATE ${r.table} SET ${r.column} = ? WHERE ${r.column} = ?`).run(r.canonical, r.value);
    if (up.changes) log(`${key}: ${up.changes} row(s) -> ${r.canonical}`);
  }
}

/* Non-destruction proof. The only rows allowed to disappear are the duplicates
   a declared dedupe rule named, and the transform logs those by primary key. */
function assertNonDestructive(before, after, deletedKeys) {
  const lost = [];
  for (const [table, n] of before) {
    if (after.get(table) === undefined) continue;
    const delta = n - after.get(table);
    if (delta === 0) continue;
    const key = table + ".directory";
    const allowed = deletedKeys.get(key);
    lost.push(`${table}: ${n} -> ${after.get(table)} (${delta > 0 ? "lost " + delta : "gained " + -delta}${allowed ? ", declared dedupe logged: " + allowed : ", UNDECLARED"})`);
    if (delta > 0 && !allowed) throw new Error("rows vanished from " + lost.join("; "));
  }
  return lost;
}

/* ------------------------------------------------------------------ main --- */
console.log("\n  path canonicalisation");
info(`  database: ${DB}`);
info(`  canonical form: ${CANON_NAME}`);

const probe = new DatabaseSync(DB, { readOnly: true });
const before = survey(probe);
const beforeCounts = rowCounts(probe);
probe.close();

console.log(`\n  ${"table.column".padEnd(28)} ${"rows".padEnd(7)} value`);
for (const r of before) {
  const flag = r.needsFix ? `${C.y}needs normalising${C.x}` : `${C.g}canonical${C.x}`;
  console.log(`  ${(r.table + "." + r.column).padEnd(28)} ${String(r.count).padEnd(7)} ${JSON.stringify(r.value)}  ${flag}`);
}

const offenders = before.filter((r) => r.needsFix);
if (!offenders.length) {
  console.log("\n");
  ok("every path is already canonical - nothing to do");
  process.exit(0);
}

if (!has("--apply")) {
  console.log(`\n  ${C.r}${offenders.length} spelling(s) would change.${C.x} Re-run with --apply.\n`);
  process.exit(1);
}

/* --- 1. rehearse on a copy ------------------------------------------------- */
console.log("");
const scratch = path.join(SCRATCH_DIR, "rehearsal.db");
for (const s of ["", "-wal", "-shm"]) { if (fs.existsSync(scratch + s)) fs.rmSync(scratch + s); }

const rehearsalLog = [];
let rehearsal;
try {
  const seed = new DatabaseSync(DB);
  try { seed.exec("PRAGMA wal_checkpoint(TRUNCATE)"); } catch { /* best effort */ }
  seed.exec(`VACUUM INTO '${scratch.replace(/'/g, "''")}'`);
  seed.close();

  rehearsal = new DatabaseSync(scratch);
  rehearsal.exec("BEGIN IMMEDIATE");
  try { transform(rehearsal, offenders, (m) => rehearsalLog.push(m)); rehearsal.exec("COMMIT"); }
  catch (e) { try { rehearsal.exec("ROLLBACK"); } catch { /* ignore */ } throw e; }
  rehearsal.close();
} catch (e) {
  try { fs.rmSync(scratch, { force: true }); } catch { /* ignore */ }
  for (const m of rehearsalLog) info("rehearsal: " + m);
  bad("rehearsal failed, live database untouched: " + e.message);
  process.exit(1);
}

const deletedKeys = new Map();
for (const m of rehearsalLog) {
  const mm = /^(.+?): \d+ duplicate row/.exec(m);
  if (mm) deletedKeys.set(mm[1], (deletedKeys.get(mm[1]) || "") + "; " + m);
  info("rehearsal: " + m);
}

try {
  const copy = new DatabaseSync(scratch, { readOnly: true });
  const afterCounts = rowCounts(copy);
  const report = assertNonDestructive(beforeCounts, afterCounts, deletedKeys);
  const still = survey(copy).filter((r) => r.needsFix);
  copy.close();
  for (const l of report) info("rehearsal: " + l);
  if (still.length) throw new Error(`${still.length} spelling(s) still non-canonical after the rehearsal`);
  ok(`rehearsal passed on a copy: ${offenders.length} spelling(s) normalised, no undeclared row lost`);
} catch (e) {
  try { fs.rmSync(scratch, { force: true }); } catch { /* ignore */ }
  bad("rehearsal verification failed, live database untouched: " + e.message);
  process.exit(1);
}

/* --- 2. back up the live file ---------------------------------------------- */
fs.mkdirSync(BACKUPS, { recursive: true });
const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const dest = path.join(BACKUPS, `opencode-${stamp}.db`);
{
  const seed = new DatabaseSync(DB);
  try { seed.exec("PRAGMA wal_checkpoint(TRUNCATE)"); } catch { /* best effort */ }
  seed.close();
  for (const s of ["", "-wal", "-shm"]) if (fs.existsSync(DB + s)) fs.copyFileSync(DB + s, dest + s);
}
ok(`backup -> ${dest}`);

/* --- 3. apply -------------------------------------------------------------- */
const db = new DatabaseSync(DB);
db.exec("PRAGMA busy_timeout = 8000");
const applied = [];
db.exec("BEGIN IMMEDIATE");
try {
  transform(db, offenders, (m) => applied.push(m));
  const afterCounts = rowCounts(db);
  const report = assertNonDestructive(beforeCounts, afterCounts, deletedKeys);
  if (survey(db).some((r) => r.needsFix)) throw new Error("some spellings remain after the update");
  db.exec("COMMIT");
  for (const l of report) info("live: " + l);
} catch (e) {
  try { db.exec("ROLLBACK"); } catch { /* ignore */ }
  bad("failed and rolled back, nothing changed: " + e.message);
  console.log(`  ${C.d}restore with:${C.x} Copy-Item '${dest}' '${DB}'`);
  db.close();
  try { fs.rmSync(scratch, { force: true }); } catch { /* ignore */ }
  process.exit(1);
}
try { db.exec("PRAGMA wal_checkpoint(TRUNCATE)"); } catch { /* ignore */ }
db.close();
try { fs.rmSync(scratch, { force: true }); } catch { /* ignore */ }

for (const m of applied) ok("live: " + m);

console.log("");
const after = survey(new DatabaseSync(DB, { readOnly: true }));
for (const r of after) {
  const flag = r.needsFix ? `${C.r}STILL NON-CANONICAL${C.x}` : `${C.g}ok${C.x}`;
  console.log(`  ${(r.table + "." + r.column).padEnd(28)} ${String(r.count).padEnd(7)} ${JSON.stringify(r.value)}  ${flag}`);
}
console.log("");
ok(`done; backup is ${path.basename(stamp ? dest : dest)}`);
info("restart opencode so it re-reads the database with the corrected paths");
