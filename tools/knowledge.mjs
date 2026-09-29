#!/usr/bin/env node
/**
 * knowledge.mjs - a local retrieval index over this workspace.
 *
 * WHY
 * ---
 * An agent working here repeatedly needs the same small set of facts: where the
 * brand colours live, which decision forbade something, which script owns a
 * port. Answering that with grep means reading five files and spending the
 * answer in context. This indexes the code, the memory layer and the
 * architecture notes once, then answers from SQLite, so the answer costs a few
 * lines instead of five file reads.
 *
 * This is deliberately an index and not a vector store. It needs no model, no
 * network, and no embeddings to be maintained, which means it is always current
 * with the working tree and can never be stale in a way that silently changes an
 * answer. FTS5 with the unicode61 tokenizer handles Hebrew and Latin together.
 *
 * USAGE
 *   node tools/knowledge.mjs build            # (re)index; incremental
 *   node tools/knowledge.mjs query "bidi"     # ranked results
 *   node tools/knowledge.mjs stats
 *   node tools/knowledge.mjs rebuild
 */

import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const ROOT = process.cwd();
const DB_DIR = path.join(ROOT, ".knowledge");
const DB_FILE = path.join(DB_DIR, "knowledge.db");

const C = { g: "\x1b[32m", r: "\x1b[31m", y: "\x1b[33m", c: "\x1b[36m", d: "\x1b[90m", x: "\x1b[0m" };
const ok = (m) => console.log(`  ${C.g}OK${C.x}  ${m}`);
const bad = (m) => console.log(`  ${C.r}!!${C.x}  ${m}`);
const info = (m) => console.log(`  ${C.d}${m}${C.x}`);

/* What is worth indexing. Anything generated, vendored, or enormous is excluded
   on purpose: node_modules and the screenshot output would dwarf the signal. */
const SOURCES = [
  { glob: "index.html", kind: "site", label: "homepage" },
  { glob: "AGENTS.md", kind: "rules", label: "agent operating rules" },
  { glob: "CLAUDE.md", kind: "rules", label: "repo conventions" },
  { glob: "opencode.json", kind: "config", label: "project config" },
  { dir: "memory", exts: [".md"], kind: "memory", label: "memory layer" },
  { dir: "scripts", exts: [".ps1"], kind: "script", label: "powershell scripts" },
  { dir: "tools", exts: [".mjs", ".js"], kind: "script", label: "node tools" },
  { dir: ".opencode/agent", exts: [".md"], kind: "agent", label: "subagents" },
  { dir: "projects", exts: [".html", ".css", ".js"], kind: "project", label: "project sources", maxBytes: 400000 },
];

function walk(dir, exts, out = [], root = dir) {
  let entries = [];
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return out; }
  for (const e of entries) {
    if (e.name.startsWith(".") && e.name !== ".opencode") continue;
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (["node_modules", "out", "versions", "_eyes", "intake", "media", "shots"].includes(e.name)) continue;
      walk(full, exts, out, root);
    } else if (!exts || exts.includes(path.extname(e.name).toLowerCase())) {
      out.push(full);
    }
  }
  return out;
}

/* Split a large document into retrievable chunks. Whole-file indexing is
   useless for a 200KB homepage: a query for one section must not return the
   other forty. Chunk on headings where possible, and fall back to size. */
function chunk(relPath, label, kind, text, size) {
  const chunks = [];
  const lines = text.split(/\r?\n/);
  const max = 1800;

  if (size > max * 2 && /\.html?$|CLAUDE|AGENTS|\.md$/i.test(relPath)) {
    let buf = [];
    let start = 1;
    let head = "";
    const flush = (endLine) => {
      if (buf.length) {
        chunks.push({ head, body: buf.join("\n"), start, end: endLine });
        buf = []; head = "";
      }
    };
    for (let i = 0; i < lines.length; i++) {
      const l = lines[i];
      const isHead = /^\s{0,3}(<section|<header|<footer|<main|<h1|<h2|##\s|#\s)/i.test(l);
      if (isHead && buf.length && buf.join("\n").length > 400) {
        flush(i);
        start = i + 1;
      }
      if (isHead) head = l.replace(/<[^>]+>/g, " ").replace(/[#*\s]+/g, " ").trim().slice(0, 120);
      buf.push(l);
      if (buf.join("\n").length > max * 2) { flush(i + 1); start = i + 2; }
    }
    flush(lines.length);
  } else {
    for (let i = 0; i < lines.length; i += max / 60) {
      chunks.push({ head: path.basename(relPath), body: lines.slice(i, i + max / 60).join("\n"), start: i + 1, end: i + max / 60 });
    }
  }
  return chunks.map((c) => ({ ...c, relPath, label, kind }));
}

function hash(s) { return crypto.createHash("sha1").update(s).digest("hex"); }

function openDb() {
  fs.mkdirSync(DB_DIR, { recursive: true });
  const db = new DatabaseSync(DB_FILE);
  db.exec(`CREATE VIRTUAL TABLE IF NOT EXISTS doc USING fts5(
    relpath, label, kind, head, body,
    tokenize = "unicode61 remove_diacritics 2"
  )`);
  db.exec(`CREATE TABLE IF NOT EXISTS meta (k TEXT PRIMARY KEY, v TEXT)`);
  return db;
}

function build({ full = false } = {}) {
  const db = openDb();
  let files = 0, chunks = 0, bytes = 0, skipped = 0;

  try { db.exec("BEGIN IMMEDIATE"); } catch {}

  for (const s of SOURCES) {
    let list = [];
    if (s.glob) {
      const p = path.join(ROOT, s.glob);
      if (fs.existsSync(p)) list = [p];
    } else {
      list = walk(path.join(ROOT, s.dir), s.exts);
    }
    for (const file of list) {
      let st;
      try { st = fs.statSync(file); } catch { continue; }
      if (s.maxBytes && st.size > s.maxBytes) { skipped++; continue; }
      if (st.size > 2_000_000) { skipped++; continue; }
      let text;
      try { text = fs.readFileSync(file, "utf8"); } catch { continue; }
      if (!text.trim()) continue;

      const rel = path.relative(ROOT, file).replace(/\\/g, "/");
      const h = hash(text);

      if (!full) {
        const prev = db.prepare("SELECT v FROM meta WHERE k = ?").get(`h:${rel}`);
        if (prev && prev.v === h) continue;
        try { db.prepare("DELETE FROM doc WHERE relpath = ?").run(rel); } catch {}
      }

      const cs = chunk(rel, s.label, s.kind, text, st.size);
      const ins = db.prepare("INSERT INTO doc (relpath, label, kind, head, body) VALUES (?,?,?,?,?)");
      for (const c of cs) { ins.run(c.relPath, c.label, c.kind, c.head, c.body); chunks++; }
      try { db.prepare("INSERT OR REPLACE INTO meta (k,v) VALUES (?,?)").run(`h:${rel}`, h); } catch {}
      files++; bytes += st.size;
    }
  }

  db.prepare("INSERT OR REPLACE INTO meta (k,v) VALUES (?,?)").run("built", new Date().toISOString());
  try { db.exec("COMMIT"); } catch {}
  db.close();

  ok(`indexed ${files} file(s) into ${chunks} chunk(s), ${(bytes / 1024).toFixed(0)}KB`);
  if (skipped) info(`${skipped} file(s) skipped as too large or generated`);
  info(`index: ${path.relative(ROOT, DB_FILE)}`);
}

function query(q) {
  if (!fs.existsSync(DB_FILE)) { bad("no index yet - run: node tools/knowledge.mjs build"); return 1; }
  const db = openDb();
  // FTS5 needs the query sanitised: a bare user phrase containing - or " is a
  // syntax error, and a tool that dies on punctuation is a tool nobody uses.
  const cleaned = q.replace(/["'^*()]/g, " ").split(/\s+/).filter((w) => w.length > 1);
  if (!cleaned.length) { bad("nothing searchable in the query"); db.close(); return 1; }
  const match = cleaned.map((w) => `"${w}"`).join(" OR ");

  let rows = [];
  try {
    rows = db.prepare(
      `SELECT relpath, label, kind, head, snippet(doc, 4, '<b>', '</b>', ' ... ', 18) AS snip, bm25(doc) AS score
       FROM doc WHERE doc MATCH ? ORDER BY score LIMIT 8`
    ).all(match);
  } catch (e) {
    bad(`query failed: ${e.message}`); db.close(); return 1;
  }
  db.close();

  if (!rows.length) { info(`no match for "${q}"`); return 0; }
  console.log(`\n  ${q}  ${C.d}(${rows.length} result(s))${C.x}\n`);
  for (const r of rows) {
    const score = r.score.toFixed(2);
    console.log(`  ${C.c}${r.relpath}${C.x}  ${C.d}[${r.kind}]${C.x}  ${score}`);
    if (r.head) console.log(`      ${C.d}${r.head.slice(0, 100)}${C.x}`);
    console.log(`      ${r.snip.replace(/<\/?b>/g, "\x1b[1m").replace(/\x1b\[1m\x1b\[0m/g, "\x1b[0m")}`);
    console.log("");
  }
  return 0;
}

function stats() {
  if (!fs.existsSync(DB_FILE)) { bad("no index yet"); return 1; }
  const db = openDb();
  console.log(`\n  knowledge index  ${path.relative(ROOT, DB_FILE)}  ${(fs.statSync(DB_FILE).size / 1024).toFixed(0)}KB`);
  for (const r of db.prepare("SELECT kind, COUNT(*) c FROM doc GROUP BY kind ORDER BY c DESC").all())
    console.log(`  ${String(r.kind).padEnd(10)} ${r.c} chunk(s)`);
  const f = db.prepare("SELECT COUNT(DISTINCT relpath) c FROM doc").get().c;
  const b = db.prepare("SELECT v FROM meta WHERE k='built'").get();
  console.log(`  files indexed: ${f}   built: ${b ? b.v : "?"}\n`);
  db.close();
  return 0;
}

const [cmd, ...rest] = process.argv.slice(2);
try {
  if (cmd === "build") process.exit(build());
  else if (cmd === "rebuild") process.exit(build({ full: true }));
  else if (cmd === "query") process.exit(query(rest.join(" ")));
  else if (cmd === "stats") process.exit(stats());
  else { console.log(fs.readFileSync(new URL(import.meta.url), "utf8").split("*/")[0].replace(/^\/\*\*?/, "")); process.exit(0); }
} catch (e) {
  bad(e.message);
  process.exit(1);
}
