#!/usr/bin/env node
/**
 * migrate-home.mjs - move the AILGEN repository into $HOME and repoint opencode's
 * database at it, so the opencode Web UI can finally bind this project.
 *
 * WHY A SEPARATE TOOL
 * -------------------
 * The repo cannot be moved while any opencode process is running. Windows returns
 * EBUSY for a rename of a directory that is a live process's working directory,
 * and the agent performing the move is itself an opencode process rooted in that
 * directory. Measured, not assumed:
 *
 *     rename dir held by another process -> EBUSY: resource busy or locked
 *     after killing the holder            -> RENAME SUCCEEDED
 *
 * So this ships as a tool the user runs once, from a normal terminal, with
 * opencode closed. Everything it does is rehearsed by --check first, and every
 * destructive step is preceded by a backup.
 *
 * WHAT IT CHANGES
 * ---------------
 *   1. moves  C:\mastercoding\AILGENSITE  ->  %USERPROFILE%\projects\AILGENSITE
 *   2. repoints every absolute path in opencode.db from the old root to the new
 *
 * The repointing is the part that actually matters. opencode keys projects and
 * sessions by their directory *string*, so moving the folder without rewriting
 * those strings produces a brand-new, empty project - which is exactly what a
 * junction produces, and why the Web UI kept showing "nothing here yet".
 *
 * USAGE
 *   node tools/migrate-home.mjs --check     # validate, change nothing
 *   node tools/migrate-home.mjs --apply     # do it (opencode must be closed)
 *   node tools/migrate-home.mjs --rollback  //tools/migrate-home.mjs <stamp>
 */

import { DatabaseSync } from "node:sqlite";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

const OLD_ROOT = "C:/mastercoding/AILGENSITE";
const NEW_ROOT = path.join(os.homedir(), "projects", "AILGENSITE").replace(/\\/g, "/");
const DB_DIR = path.join(os.homedir(), ".local", "share", "opencode");
const DB = path.join(DB_DIR, "opencode.db");
const BACKUP_DIR = path.join(DB_DIR, "backups");

const argv = process.argv.slice(2);
const has = (f) => argv.includes(f);
const val = (f) => { const i = argv.indexOf(f); return i >= 0 ? argv[i + 1] : null; };

const C = { g: "\x1b[32m", r: "\x1b[31m", y: "\x1b[33m", c: "\x1b[36m", d: "\x1b[90m", x: "\x1b[0m" };
const ok = (m) => console.log(`  ${C.g}OK${C.x}  ${m}`);
const bad = (m) => { console.log(`  ${C.r}!!${C.x}  ${m}`); process.exitCode = 1; };
const warn = (m) => console.log(`  ${C.y}--${C.x}  ${m}`);
const info = (m) => console.log(`  ${C.d}${m}${C.x}`);

/* ------------------------------------------------------ preconditions --- */
function opencodeProcesses() {
  let out = "";
  try {
    out = execFileSync("tasklist", ["/FI", "IMAGENAME eq opencode.exe", "/FO", "CSV", "/NH"],
      { encoding: "utf8", timeout: 8000, windowsHide: true, stdio: ["ignore", "pipe", "pipe"] });
  } catch { return []; }
  return out.split(/\r?\n/).filter((l) => l.includes("opencode.exe")).map((l) => l.split(",")[1]?.replace(/"/g, ""));
}

function portOwners() {
  const res = {};
  let out = "";
  try {
    out = execFileSync("netstat", ["-ano", "-p", "TCP"], { encoding: "utf8", timeout: 8000, windowsHide: true, stdio: ["ignore", "pipe", "pipe"] });
  } catch { return res; }
  for (const line of out.split(/\r?\n/)) {
    const c = line.trim().split(/\s+/);
    if (c.length < 5 || !/LISTENING/i.test(c[3])) continue;
    const m = c[1].match(/:(\d+)$/);
    if (m) res[m[1]] = c[4];
  }
  return res;
}

/* Every table that stores an absolute path keyed to a project. Missing one is
   how a migration silently half-works: the project appears but its sessions
   vanish, or the sessions appear under a project that no longer resolves. */
const PATH_TABLES = [
  { table: "project", column: "worktree" },
  { table: "project_directory", column: "directory" },
  { table: "session", column: "directory" },
  { table: "workspace", column: "directory" },
];

function plan(db) {
  const rows = [];
  for (const { table, column } of PATH_TABLES) {
    let exists = true;
    try { db.prepare(`SELECT ${column} FROM ${table} LIMIT 1`).all(); }
    catch { exists = false; }
    if (!exists) { rows.push({ table, column, count: null, note: "table or column absent" }); continue; }
    const before = db.prepare(`SELECT COUNT(*) c FROM ${table} WHERE ${column} = ?`).get(OLD_ROOT).c;
    const other = db.prepare(`SELECT COUNT(*) c FROM ${table} WHERE ${column} IS NOT NULL AND ${column} != ?`).get(OLD_ROOT).c;
    rows.push({ table, column, count: before, other });
  }
  return rows;
}

function show(rows, label) {
  console.log(`\n  ${label}`);
  console.log(`  ${"table.column".padEnd(30)} ${"rows at old root".padEnd(18)} other rows`);
  for (const r of rows) {
    console.log(`  ${(r.table + "." + r.column).padEnd(30)} ${String(r.count).padEnd(18)} ${r.other ?? "-"}`);
  }
}

function backup() {
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const dest = path.join(BACKUP_DIR, `opencode-${stamp}.db`);
  // Fold the WAL into the main file first, or the backup is missing whatever has
  // not yet been checkpointed and the restore is silently incomplete.
  const db = new DatabaseSync(DB);
  try { db.exec("PRAGMA wal_checkpoint(TRUNCATE)"); } catch { /* not fatal */ }
  db.close();
  for (const suffix of ["", "-wal", "-shm"]) {
    const src = DB + suffix;
    if (fs.existsSync(src)) fs.copyFileSync(src, dest + suffix);
  }
  ok(`database backed up -> ${dest}`);
  return dest;
}

function migrate() {
  const db = new DatabaseSync(DB);
  try {
    db.exec("PRAGMA foreign_keys=ON");
    db.exec("BEGIN IMMEDIATE");
    let total = 0;
    for (const { table, column } of PATH_TABLES) {
      try {
        const info = db.prepare(`SELECT COUNT(*) c FROM ${table} WHERE ${column} = ?`).get(OLD_ROOT);
        if (!info.c) continue;
        db.prepare(`UPDATE ${table} SET ${column} = ? WHERE ${column} = ?`).run(NEW_ROOT, OLD_ROOT);
        total += info.c;
        ok(`${table}.${column}: ${info.c} row(s) repointed`);
      } catch (e) {
        warn(`${table}.${column}: skipped (${e.message})`);
      }
    }
    db.exec("COMMIT");
    try { db.exec("PRAGMA wal_checkpoint(TRUNCATE)"); } catch { /* ignore */ }
    ok(`${total} row(s) repointed to ${NEW_ROOT}`);
  } catch (e) {
    try { db.exec("ROLLBACK"); } catch { /* ignore */ }
    bad("migration failed and was rolled back: " + e.message);
    throw e;
  } finally {
    db.close();
  }
}

function verify() {
  const db = new DatabaseSync(DB, { readOnly: true });
  let good = true;
  try {
    for (const { table, column } of PATH_TABLES) {
      let left;
      try { left = db.prepare(`SELECT COUNT(*) c FROM ${table} WHERE ${column} = ?`).get(OLD_ROOT).c; }
      catch { continue; }
      const now = db.prepare(`SELECT COUNT(*) c FROM ${table} WHERE ${column} = ?`).get(NEW_ROOT).c;
      const mark = left === 0 ? `${C.g}ok${C.x}` : `${C.r}${left} LEFT${C.x}`;
      console.log(`  ${(table + "." + column).padEnd(30)} old=${String(left).padEnd(4)} new=${String(now).padEnd(4)} ${mark}`);
      if (left !== 0) good = false;
    }
    const sessions = db.prepare("SELECT COUNT(*) c FROM session").get().c;
    const attached = db.prepare("SELECT COUNT(*) c FROM session WHERE directory = ?").get(NEW_ROOT).c;
    console.log(`\n  sessions total ${sessions}, attached to the new root ${attached}`);
    if (attached === 0) { bad("no sessions are attached to the new root - the Web UI would show an empty project"); good = false; }
  } finally {
    db.close();
  }
  return good;
}

function rollback(stamp) {
  const dest = path.join(BACKUP_DIR, `opencode-${stamp}.db`);
  if (!fs.existsSync(dest)) { bad(`no such backup: ${dest}`); return 1; }
  const oldRoot = path.join("C:", "mastercoding", "AILGENSITE");
  const newDir = path.join(os.homedir(), "projects", "AILGENSITE");
  if (fs.existsSync(newDir) && !fs.existsSync(oldRoot)) {
    fs.renameSync(newDir, oldRoot);
    ok(`repo moved back -> ${oldRoot}`);
  }
  for (const suffix of ["", "-wal", "-shm"]) {
    if (fs.existsSync(dest + suffix)) { fs.copyFileSync(dest + suffix, DB + suffix); ok(`restored opencode.db${suffix}`); }
  }
  return verify() ? 0 : 1;
}

/* ---------------------------------------------------------------- main --- */
function main() {
  console.log(`\n  AILGEN -> $HOME migration`);
  info(`  old: ${OLD_ROOT}`);
  info(`  new: ${NEW_ROOT}`);

  if (has("--rollback")) {
    const stamp = val("--rollback");
    if (!stamp) { bad("--rollback needs the backup stamp"); return 1; }
    console.log("");
    return rollback(stamp);
  }

  const apply = has("--apply");

  if (!fs.existsSync(DB)) { bad(`opencode database not found: ${DB}`); return 1; }
  if (!fs.existsSync(OLD_ROOT.replace(/\//g, "\\"))) {
    if (fs.existsSync(NEW_ROOT.replace(/\//g, "\\"))) { ok("repository is already at the new location"); }
    else { bad(`source repository not found: ${OLD_ROOT}`); return 1; }
  }
  if (fs.existsSync(NEW_ROOT.replace(/\//g, "\\")) && !apply) {
    warn(`${NEW_ROOT} already exists`);
  }

  const db = new DatabaseSync(DB, { readOnly: true });
  const rows = plan(db);
  db.close();
  show(rows, "current database state");

  const owners = portOwners();
  const live = ["8000", "4096"].filter((p) => owners[p]);
  const procs = opencodeProcesses();

  console.log("");
  if (procs.length) {
    bad(`opencode is still running (pid ${procs.join(", ")})`);
    bad("close every opencode window and terminal first, then run this again.");
    bad("A rename will fail with EBUSY while a process is rooted in the folder.");
    return 1;
  }
  if (live.length) {
    bad(`ports still held: ${live.map((p) => `${p} (pid ${owners[p]})`).join(", ")}`);
    bad("run: node tools/supervisor.mjs stop --all");
    return 1;
  }
  ok("no opencode process is running and both managed ports are free");

  if (!apply) {
    console.log(`\n  ${C.y}DRY RUN - nothing was changed.${C.x}`);
    console.log(`  To perform the migration, close opencode and run:`);
    console.log(`    node tools/migrate-home.mjs --apply`);
    console.log("");
    return 0;
  }

  console.log("");
  const stamp = backup();
  try {
    if (fs.existsSync(OLD_ROOT.replace(/\//g, "\\"))) {
      fs.mkdirSync(path.dirname(NEW_ROOT.replace(/\//g, "\\")), { recursive: true });
      fs.renameSync(OLD_ROOT.replace(/\//g, "\\"), NEW_ROOT.replace(/\//g, "\\"));
      ok(`repository moved -> ${NEW_ROOT}`);
    }
  } catch (e) {
    bad(`move failed: ${e.code} ${e.message}`);
    bad(`database was not modified; backup is at ${stamp}`);
    return 1;
  }

  migrate();
  console.log("");
  const good = verify();
  console.log("");
  if (good) {
    ok("migration complete");
    info(`rollback: node tools/migrate-home.mjs --rollback ${path.basename(stamp, ".db").replace(/^opencode-/, "")}`);
    info("now start opencode from the new path so the CLI and the Web UI agree");
    return 0;
  }
  bad("verification failed - roll back with the command above");
  return 1;
}

process.exit(main());
