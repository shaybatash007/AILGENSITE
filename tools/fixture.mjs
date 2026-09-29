/**
 * Shared fixture for tools/test-canonicalize.mjs and tools/test-mutation.mjs.
 *
 * The schema is read from the LIVE database's sqlite_master, not hand-written.
 * The previous hand-written fixture had 5 tables against the live 20, gave
 * message/part no foreign keys (so no ON DELETE CASCADE), and modelled
 * workspace with `directory` in the primary key when the live table keys on
 * `id`. Every one of those gaps hid the exact failure the fixture existed to
 * catch, so the schema is now derived rather than imagined.
 *
 *   build(dir) -> { db, path }  a populated throwaway database
 */
import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

/* opencode writes forward slashes on Windows; migrate-home.mjs wrote backslashes. */
export const CANON = "C:/Users/shayb/projects/AILGENSITE";
export const MIGRATED = "C:\\Users\\shayb\\projects\\AILGENSITE";
export const OTHER = "C:/Users/shayb/Videos";

export function liveSchema() {
  const live = path.join(os.homedir(), ".local", "share", "opencode", "opencode.db");
  const src = new DatabaseSync(live, { readOnly: true });
  const ddl = src.prepare(
    "SELECT name, sql FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name"
  ).all();
  src.close();
  return ddl;
}

export function build(dir) {
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, "opencode.db");
  const db = new DatabaseSync(file);

  for (const { sql } of liveSchema()) db.exec(sql);

  const now = 1790666000000;
  const exec = (q) => db.prepare(q).run();

  // Two projects. The point of the second one is B3 in test-mutation: a project
  // whose only row is the NON-canonical spelling. It is not a duplicate of
  // anything, so the identity restriction must save it. The original bug class
  // deleted it.
  exec(`INSERT INTO project (id, worktree, time_created, time_updated, sandboxes)
        VALUES ('global', '/', 1, 1, '[]')`);
  exec(`INSERT INTO project (id, worktree, time_created, time_updated, sandboxes)
        VALUES ('pA', '${CANON}', 2, 2, '[]')`);
  exec(`INSERT INTO project (id, worktree, time_created, time_updated, sandboxes)
        VALUES ('pB', '${MIGRATED}', 3, 3, '[]')`);
  // pA carries BOTH spellings (a true duplicate pair); pB carries only the
  // backslash one (not a duplicate of anything).
  exec(`INSERT INTO project_directory (project_id, directory, time_created) VALUES ('pA', '${CANON}', 4)`);
  exec(`INSERT INTO project_directory (project_id, directory, time_created) VALUES ('pA', '${MIGRATED}', 5)`);
  exec(`INSERT INTO project_directory (project_id, directory, time_created) VALUES ('pB', '${MIGRATED}', 6)`);

  // 13 sessions the migration rewrote, 2 opencode created after the move, 1 unrelated.
  const session = (id, title, directory, t, project_id) =>
    db.prepare(`INSERT INTO session (id, title, slug, directory, project_id, version, time_created, time_updated)
                VALUES (?, ?, ?, ?, ?, '1.18.33', ?, ?)`).run(id, title, id, directory, project_id, t, t);
  for (let i = 0; i < 13; i++) session(`ses_migrated_${i}`, `m${i}`, MIGRATED, now + i, 'pA');
  session('ses_new_a', 'a', CANON, now + 20, 'pA');
  session('ses_new_b', 'b', CANON, now + 21, 'pA');
  session('ses_videos', 'v', OTHER, now + 22, 'pA');

  // A real subtree under real FKs, so a cascade is possible and testable.
  const message = db.prepare(`INSERT INTO message (id, session_id, time_created, time_updated, data) VALUES (?, ?, ?, ?, '{}')`);
  const part = db.prepare(`INSERT INTO part (id, message_id, session_id, time_created, time_updated, data) VALUES (?, ?, ?, ?, ?, '{}')`);
  for (let i = 0; i < 13; i++) {
    message.run(`msg_${i}`, `ses_migrated_${i}`, now + i, now + i);
    for (let j = 0; j < 3; j++) part.run(`part_${i}_${j}`, `msg_${i}`, `ses_migrated_${i}`, now + i, now + i);
  }

  db.exec("PRAGMA foreign_keys = ON");
  return { db, path: file };
}

export function counts(db) {
  const out = new Map();
  for (const { tbl } of db.prepare("SELECT name AS tbl FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").all()) {
    out.set(tbl, db.prepare(`SELECT COUNT(*) c FROM "${tbl}"`).get().c);
  }
  return out;
}

export function dirOf(db, sql) {
  return db.prepare(sql).all();
}
