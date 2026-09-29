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
   not attempted at all. session.path is included because it IS a path column and
   the tool claims to cover every one - it is surveyed so its shape is visible
   and asserted, even though its stored values are not drive-absolute and are
   therefore left alone. */
const TABLES = [
  { table: "project", column: "worktree" },
  { table: "project_directory", column: "directory" },
  { table: "session", column: "directory" },
  { table: "session", column: "path" },
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
  const uncountable = [];
  // name AS table: the column in sqlite_master is `name`. Selecting `table`
  // yields undefined, and the old `catch {}` swallowed it - which is how the
  // entire non-destruction assertion managed to be vacuous while reporting
  // "no undeclared row lost". An empty `before` map checks nothing.
  for (const { tbl } of db.prepare("SELECT name AS tbl FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").all()) {
    const table = tbl;
    try { out.set(table, db.prepare(`SELECT COUNT(*) c FROM "${table}"`).get().c); }
    catch (e) { uncountable.push(`${table} (${e.message})`); }
  }
  if (out.size === 0) uncountable.push("no tables were counted at all - the before-map is empty, so any assertion over it is vacuous");
  return { counts: out, uncountable };
}

function primaryKey(db, table) {
  return db.prepare(`SELECT name FROM pragma_table_info('${table.replace(/'/g, "''")}') WHERE pk > 0 ORDER BY pk`).all().map((r) => r.name);
}

/* ------------------------------------------------------------ transform --- */
/* Applied identically to the rehearsal copy and to the live file. Everything it
   is allowed to do is visible in these lines, and it reports exactly how many
   rows it removed per table so the assertion can hold it to that number. */
function transform(db, offenders) {
  const log = [];
  const deletes = new Map(); // table -> rows this tool intentionally removed
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
        // The identity restriction is load-bearing, not decoration: it bounds the
        // victim set to rows that duplicate a canonical row for the SAME entity.
        // Without it this is `DELETE ... WHERE col = ?`, which is the bug that
        // destroyed 14 sessions. tools/test-mutation.mjs proves it.
        const where = [`${r.column} = ?`, ...rule.identity.map((c) => `${c} IN (SELECT ${c} FROM ${r.table} WHERE ${r.column} = ?)`)].join(" AND ");
        const params = [r.value, ...rule.identity.map(() => r.canonical)];
        const victims = db.prepare(`SELECT ${pk.join(", ")} FROM ${r.table} WHERE ${where}`).all(...params);
        const del = db.prepare(`DELETE FROM ${r.table} WHERE ${where}`).run(...params);
        if (del.changes) {
          deletes.set(r.table, (deletes.get(r.table) || 0) + del.changes);
          log.push(`${key}: removed ${del.changes} declared duplicate row(s) ${JSON.stringify(victims.map((v) => pk.map((c) => v[c]).join("/")))}`);
        }
      }
    }

    const up = db.prepare(`UPDATE ${r.table} SET ${r.column} = ? WHERE ${r.column} = ?`).run(r.canonical, r.value);
    if (up.changes) log.push(`${key}: ${up.changes} row(s) -> ${r.canonical}`);
  }
  return { log, deletes };
}

/* Non-destruction proof.
   The delta must equal the declared delete count EXACTLY. Treating the allowance
   as a truthy flag is the second version of the same bug: one declared duplicate
   plus 998 undeclared ones would pass, because a non-empty string is truthy. */
function assertNonDestructive(before, after, deletes, where) {
  const report = [];
  for (const [table, n] of before) {
    const now = after.get(table);
    if (now === undefined) {
      throw new Error(
        `${where}: table "${table}" could not be counted after the transform, so it is no longer ` +
        `covered by the non-destruction check. Refusing to continue - an unchecked table is an ` +
        `unbounded one.`);
    }
    const delta = n - now;
    if (delta === 0) continue;
    if (delta < 0) { report.push(`${table}: ${n} -> ${now} (+${-delta})`); continue; }

    const declared = deletes.get(table) || 0;
    if (declared === 0) {
      throw new Error(`${where}: ${table} lost ${delta} row(s) and no dedupe rule declared any`);
    }
    if (delta !== declared) {
      throw new Error(
        `${where}: ${table} lost ${delta} row(s) but only ${declared} were declared duplicates. ` +
        `The transform removed ${delta - declared} undeclared row(s).`);
    }
    report.push(`${table}: ${n} -> ${now} (-${delta}, all declared duplicates)`);
  }
  for (const table of deletes.keys()) {
    if (!before.has(table)) throw new Error(`${where}: transform deleted from ${table}, absent from the before-count`);
  }
  return report;
}

/* --------------------------------------------------------------- backup --- */
/* A copy is not a backup until it has been opened and checked. The previous
   version reported OK for a copyFileSync of a live 123MB database, and its
   rollback hint copied one of three files - so restoring replayed a stale -wal
   over the recovered file and reinstated the corruption. Both are fixed here:
   VACUUM INTO produces a single self-contained file, and the restore deletes
   the target's -wal/-shm before writing. */
function verifiedBackup(dest) {
  for (const s of ["", "-wal", "-shm"]) { if (fs.existsSync(dest + s)) fs.rmSync(dest + s, { force: true }); }
  const seed = new DatabaseSync(DB);
  try { seed.exec("PRAGMA wal_checkpoint(TRUNCATE)"); } catch { /* best effort */ }
  seed.exec(`VACUUM INTO '${dest.replace(/'/g, "''")}'`);
  seed.close();
  const chk = new DatabaseSync(dest, { readOnly: true });
  const integrity = Object.values(chk.prepare("PRAGMA integrity_check").get())[0];
  const sessions = chk.prepare("SELECT COUNT(*) c FROM session").get().c;
  chk.close();
  if (integrity !== "ok") { try { fs.rmSync(dest, { force: true }); } catch { /* ignore */ } throw new Error(`backup failed integrity_check: ${integrity}`); }
  return { integrity, sessions };
}

const restoreBlock = (file) => [
  `node "${path.resolve(fileURLPath(), 'canonicalize-paths.mjs')}" --restore "${file}"`,
  `# or by hand - the -wal/-shm MUST go first, or SQLite replays stale frames:`,
  `Remove-Item '${DB}-wal','${DB}-shm' -Force -ErrorAction SilentlyContinue`,
  `Copy-Item '${file}' '${DB}' -Force`,
].join("\n     ");

function fileURLPath() { return process.argv[1] || "tools/canonicalize-paths.mjs"; }

/* ------------------------------------------------------------------ main --- */
/* --- 0. restore mode: a tested escape hatch, not a printed suggestion ------- */
const restoreIdx = argv.indexOf("--restore");
if (restoreIdx !== -1) {
  const file = argv[restoreIdx + 1];
  if (!file || !fs.existsSync(file)) { bad("--restore needs the path of a backup file"); process.exit(126); }

  const src = new DatabaseSync(file, { readOnly: true });
  const srcIntegrity = Object.values(src.prepare("PRAGMA integrity_check").get())[0];
  const srcSessions = src.prepare("SELECT COUNT(*) c FROM session").get().c;
  src.close();
  if (srcIntegrity !== "ok") { bad(`refusing to restore: the backup itself fails integrity_check (${srcIntegrity})`); process.exit(1); }
  ok(`backup verified: integrity_check ok, ${srcSessions} session(s)`);

  // The single most important line in this file. A stale -wal left next to the
  // restored file is replayed over it on the next open, which silently
  // reinstates the state the backup was taken to escape.
  for (const s of ["-wal", "-shm"]) {
    if (fs.existsSync(DB + s)) { fs.rmSync(DB + s, { force: true }); info(`removed stale ${path.basename(DB + s)}`); }
  }
  fs.copyFileSync(file, DB);
  const after = new DatabaseSync(DB, { readOnly: true });
  const ok2 = Object.values(after.prepare("PRAGMA integrity_check").get())[0];
  const nowSessions = after.prepare("SELECT COUNT(*) c FROM session").get().c;
  after.close();
  if (ok2 !== "ok") { bad(`restore produced a file that fails integrity_check (${ok2})`); process.exit(1); }
  ok(`restored ${DB} - integrity_check ok, ${nowSessions} session(s) (was ${srcSessions} in the backup)`);
  info("restart opencode so it re-reads the restored database");
  process.exit(0);
}

console.log("\n  path canonicalisation");
info(`  database: ${DB}`);
info(`  canonical form: ${CANON_NAME}`);

const probe = new DatabaseSync(DB, { readOnly: true });
const before = survey(probe);
const beforeRowCounts = rowCounts(probe);
probe.close();
if (beforeRowCounts.uncountable.length) {
  bad(`cannot count: ${beforeRowCounts.uncountable.join("; ")} - no table is left unchecked`);
  process.exit(1);
}
const beforeCounts = beforeRowCounts.counts;

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

let rehearsalRun;
try {
  const seed = new DatabaseSync(DB);
  try { seed.exec("PRAGMA wal_checkpoint(TRUNCATE)"); } catch { /* best effort */ }
  seed.exec(`VACUUM INTO '${scratch.replace(/'/g, "''")}'`);
  seed.close();

  const rehearsal = new DatabaseSync(scratch);
  rehearsal.exec("BEGIN IMMEDIATE");
  try { rehearsalRun = transform(rehearsal, offenders); rehearsal.exec("COMMIT"); }
  catch (e) { try { rehearsal.exec("ROLLBACK"); } catch { /* ignore */ } throw e; }
  rehearsal.close();
} catch (e) {
  try { fs.rmSync(scratch, { force: true }); } catch { /* ignore */ }
  bad("rehearsal failed, live database untouched: " + e.message);
  process.exit(1);
}

for (const m of rehearsalRun.log) info("rehearsal: " + m);

try {
  const copy = new DatabaseSync(scratch, { readOnly: true });
  const afterCounts = rowCounts(copy).counts;
  const report = assertNonDestructive(beforeCounts, afterCounts, rehearsalRun.deletes, "rehearsal");
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

/* --- 2. back up the live file, and prove the backup is restorable ---------- */
fs.mkdirSync(BACKUPS, { recursive: true });
const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const dest = path.join(BACKUPS, `opencode-${stamp}.db`);
try {
  const b = verifiedBackup(dest);
  ok(`backup verified -> ${dest}`);
  info(`  integrity_check ${b.integrity}, ${b.sessions} session(s), single self-contained file`);
} catch (e) {
  try { fs.rmSync(scratch, { force: true }); } catch { /* ignore */ }
  bad(`backup unusable (${e.message}) - live database untouched`);
  process.exit(1);
}

/* --- 3. apply -------------------------------------------------------------- */
const db = new DatabaseSync(DB);
db.exec("PRAGMA busy_timeout = 8000");
let liveRun;
db.exec("BEGIN IMMEDIATE");
try {
  liveRun = transform(db, offenders);
  const afterCounts = rowCounts(db).counts;
  // Asserted against the LIVE run's own delete count, then cross-checked against
  // the rehearsal. Reusing the rehearsal's permission for the live write is how
  // an extra deletion on the real database would slip through.
  const report = assertNonDestructive(beforeCounts, afterCounts, liveRun.deletes, "live");
  if (survey(db).some((r) => r.needsFix)) throw new Error("some spellings remain after the update");
  for (const [t, n] of rehearsalRun.deletes) {
    if ((liveRun.deletes.get(t) || 0) !== n) throw new Error(`live run deleted ${liveRun.deletes.get(t) || 0} row(s) from ${t}; the rehearsal deleted ${n}`);
  }
  db.exec("COMMIT");
  for (const l of report) info("live: " + l);
} catch (e) {
  try { db.exec("ROLLBACK"); } catch { /* ignore */ }
  bad("failed and rolled back, nothing changed: " + e.message);
  console.log(`  ${C.d}restore with:${C.x}\n     ${restoreBlock(dest)}`);
  db.close();
  try { fs.rmSync(scratch, { force: true }); } catch { /* ignore */ }
  process.exit(1);
}
try { db.exec("PRAGMA wal_checkpoint(TRUNCATE)"); } catch { /* ignore */ }
db.close();
try { fs.rmSync(scratch, { force: true }); } catch { /* ignore */ }

for (const m of liveRun.log) ok("live: " + m);

console.log("");
const afterProbe = new DatabaseSync(DB, { readOnly: true });
const after = survey(afterProbe);
const integrity = Object.values(afterProbe.prepare("PRAGMA integrity_check").get())[0];
afterProbe.close();
for (const r of after) {
  const flag = r.needsFix ? `${C.r}STILL NON-CANONICAL${C.x}` : `${C.g}ok${C.x}`;
  console.log(`  ${(r.table + "." + r.column).padEnd(28)} ${String(r.count).padEnd(7)} ${JSON.stringify(r.value)}  ${flag}`);
}
if (integrity !== "ok") bad(`the live database now fails integrity_check: ${integrity}`);
console.log("");
ok(`done; verified backup is ${path.basename(dest)} (integrity_check ${integrity})`);
info(`restore it with: node tools/canonicalize-paths.mjs --restore "${dest}"`);
info("restart opencode so it re-reads the database with the corrected paths");
if (has("--prune")) info("prune is a manual operation: review the backups directory before deleting anything");
