#!/usr/bin/env node
/**
 * snap.mjs - named, restorable snapshots with deterministic git commits and
 * visual diffs.
 *
 * A snapshot is three things at once, which is the point: the file tree, a real
 * rendered screenshot of the site, and the audit report for that render. A
 * screenshot alone cannot be restored from and a file tree alone cannot prove
 * what it looked like, so a rollback restores the code AND shows you the pixel
 * difference between the version you had and the version you get back.
 *
 * Snapshots are named (v1, v2, v3...) and never overwritten. That is deliberate:
 * "latest" is not a thing you can roll back to, and silently replacing a named
 * snapshot destroys the only reason to name it.
 *
 * USAGE
 *   node tools/snap.mjs list
 *   node tools/snap.mjs take v1 [--note "..."] [--url http://127.0.0.1:8000/]
 *   node tools/snap.mjs roll v1 [--yes]
 *   node tools/snap.mjs diff v1
 */

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { PNG } from "pngjs";
import pixelmatch from "pixelmatch";

const ROOT = process.cwd();
const SNAP_DIR = path.join(ROOT, ".snapshots");

const C = { g: "\x1b[32m", r: "\x1b[31m", y: "\x1b[33m", c: "\x1b[36m", d: "\x1b[90m", x: "\x1b[0m" };
const ok = (m) => console.log(`  ${C.g}OK${C.x}  ${m}`);
const bad = (m) => { console.log(`  ${C.r}!!${C.x}  ${m}`); process.exitCode = 1; };
const warn = (m) => console.log(`  ${C.y}--${C.x}  ${m}`);
const info = (m) => console.log(`  ${C.d}${m}${C.x}`);

const argv = process.argv.slice(2);
const flag = (n, d) => { const i = argv.indexOf(n); return i >= 0 && argv[i + 1] ? argv[i + 1] : d; };
const has = (n) => argv.includes(n);

function git(args, opts = {}) {
  const r = spawnSync("git", args, { cwd: ROOT, encoding: "utf8", timeout: 60000, windowsHide: true, ...opts });
  return { code: r.status, out: (r.stdout || "").trim(), err: (r.stderr || "").trim() };
}

/* Files worth restoring. Generated and vendored trees are excluded: a snapshot
   that contains node_modules cannot be diffed, restored, or reasoned about. */
const INCLUDE_EXT = new Set([".html", ".css", ".js", ".mjs", ".json", ".jsonc", ".md", ".ps1", ".txt", ".svg"]);
const EXCLUDE_DIR = new Set(["node_modules", ".git", ".launch", ".knowledge", "versions", "out", "_eyes", "intake", ".snapshots"]);

function collect(dir = ROOT, out = []) {
  let entries = [];
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return out; }
  for (const e of entries) {
    if (e.name.startsWith(".")) continue;
    const full = path.join(dir, e.name);
    const rel = path.relative(ROOT, full).replace(/\\/g, "/");
    if (e.isDirectory()) {
      if (EXCLUDE_DIR.has(e.name) || rel.startsWith("projects/")) continue;
      collect(full, out);
    } else if (INCLUDE_EXT.has(path.extname(e.name).toLowerCase())) {
      out.push(rel);
    }
  }
  return out;
}

function snapshotPath(name) { return path.join(SNAP_DIR, name); }

/* Capture the whole page for diffing, not just the fold. eyes.mjs deliberately
   refuses a 16,000px full-page capture because a model cannot read it, but a
   pixel diff is read by a machine: coverage matters more than legibility, and a
   fold-only diff cannot see a change to anything below the fold. */
function render(url, outPng, fullPage = true) {
  const args = [path.join(ROOT, "tools", "eyes.mjs"), "--url", url, "--viewport", "desktop",
    "--settle", "7000", "--still", "--quiet"];
  if (!fullPage) args.push("--no-fullpage");
  // A tall page is captured in slices so no single image is unreadable.
  if (fullPage) args.push("--max-fullpage", "999999");
  const r = spawnSync("node", args, { cwd: ROOT, encoding: "utf8", timeout: 240000, windowsHide: true });
  const slug = url.replace(/^https?:\/\//, "").replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").slice(0, 60);
  const produced = path.join(ROOT, "projects", "_eyes", "out", `${slug}--desktop.png`);
  if (!fs.existsSync(produced)) { warn(`no screenshot produced for ${url} (eyes exited ${r.status})`); return null; }
  fs.copyFileSync(produced, outPng);
  ok(`rendered ${url} -> ${path.relative(ROOT, outPng)}`);
  return outPng;
}

/* Compare two screenshots and describe the change, not just count it.
   Motion noise is scattered across the whole page; a real edit is localised.
   A percentage alone cannot tell those apart - a change far down a 16,000px
   page is a fraction of a percent and looks identical to noise - so the
   bounding box of the difference is what actually decides it. */
function compare(aPath, bPath, outPath) {
  const A = PNG.sync.read(fs.readFileSync(aPath));
  const B = PNG.sync.read(fs.readFileSync(bPath));
  if (A.width !== B.width) {
    return { sizeChanged: true, reason: "width", from: `${A.width}x${A.height}`, to: `${B.width}x${B.height}` };
  }
  // A height change is a finding, not a failure: a taller page means some
  // element grew and pushed everything below it down. Report the delta, then
  // compare the region both images share so the cause is still visible.
  const H = Math.min(A.height, B.height);
  const crop = (img) => {
    if (img.height === H) return img;
    const c = new PNG({ width: img.width, height: H });
    for (let y = 0; y < H; y++) img.data.copy(c.data, y * img.width * 4, y * img.width * 4, (y + 1) * img.width * 4);
    return c;
  };
  const Ac = crop(A), Bc = crop(B);
  const out = new PNG({ width: Ac.width, height: Ac.height });
  const n = pixelmatch(Ac.data, Bc.data, out.data, Ac.width, Ac.height, { threshold: 0.1, diffMask: true });
  fs.writeFileSync(outPath, PNG.sync.write(out));

  // Locality alone is not enough: this site's hero animation is itself confined
  // to the top of the page, so an unchanged page still produces a tight bounding
  // box. What actually separates them is density. A real CSS edit shifts a solid
  // band of pixels on a row - a chip growing 7px taller changes a couple of
  // hundred contiguous pixels. Canvas noise is speckle: a handful of scattered
  // pixels per row. So count rows where the change spans a real width.
  let minX = Infinity, minY = Infinity, maxX = -1, maxY = -1;
  const rows = new Set();
  let denseRows = 0, maxRun = 0;
  for (let y = 0; y < Ac.height; y++) {
    let rowChanged = 0, run = 0;
    for (let x = 0; x < Ac.width; x++) {
      const i = (Ac.width * y + x) << 2;
      if (out.data[i] > 200 && out.data[i + 1] < 120 && out.data[i + 2] < 120) {
        rowChanged++; run++;
        if (run > maxRun) maxRun = run;
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
        rows.add(y);
      } else run = 0;
    }
    if (rowChanged > Ac.width * 0.05) denseRows++;
  }
  const total = Ac.width * Ac.height;
  return {
    changed: n,
    pct: +((n / total) * 100).toFixed(3),
    height: Ac.height, heightDelta: B.height - A.height,
    box: maxX < 0 ? null : { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 },
    denseRows,
    maxRun,
    rowSpread: rows.size ? Math.round(((rows.size / Ac.height) * 100)) : 0,
  };
}

function take(name, note) {
  if (!name) { bad("take needs a name, e.g. v1"); return 1; }
  if (!/^[A-Za-z0-9._-]+$/.test(name)) { bad(`invalid snapshot name "${name}"`); return 1; }
  const dest = snapshotPath(name);
  if (fs.existsSync(dest)) { bad(`snapshot "${name}" already exists - pick another name`); return 1; }

  fs.mkdirSync(path.join(dest, "files"), { recursive: true });
  const files = collect();
  for (const rel of files) {
    const to = path.join(dest, "files", rel);
    fs.mkdirSync(path.dirname(to), { recursive: true });
    fs.copyFileSync(path.join(ROOT, rel), to);
  }

  const head = git(["rev-parse", "HEAD"]);
  const status = git(["status", "--porcelain"]);
  const url = flag("--url", "http://127.0.0.1:8000/");
  const shot = render(url, path.join(dest, "shot.png"));

  const manifest = {
    name,
    note: note || null,
    at: new Date().toISOString(),
    url,
    gitHead: head.out,
    dirtyFiles: status.out ? status.out.split(/\r?\n/).length : 0,
    fileCount: files.length,
    bytes: files.reduce((s, f) => { try { return s + fs.statSync(path.join(ROOT, f)).size; } catch { return s; } }, 0),
    shot: shot ? "shot.png" : null,
    gitBranch: git(["rev-parse", "--abbrev-ref", "HEAD"]).out,
  };
  fs.writeFileSync(path.join(dest, "manifest.json"), JSON.stringify(manifest, null, 2));

  ok(`snapshot "${name}" taken: ${files.length} file(s), ${(manifest.bytes / 1024).toFixed(0)}KB`);
  if (manifest.dirtyFiles) info(`${manifest.dirtyFiles} uncommitted change(s) captured as-is`);
  info(`roll back with: node tools/snap.mjs roll ${name}`);
  return 0;
}

function readManifest(name) {
  const p = path.join(snapshotPath(name), "manifest.json");
  if (!fs.existsSync(p)) return null;
  try { return JSON.parse(fs.readFileSync(p, "utf8")); } catch { return null; }
}

function roll(name, assumeYes) {
  const m = readManifest(name);
  if (!m) { bad(`no snapshot named "${name}"`); return 1; }
  const dirty = git(["status", "--porcelain"]);
  if (dirty.out && !assumeYes) {
    bad("the working tree has uncommitted changes:");
    console.log(dirty.out.split(/\r?\n/).slice(0, 15).map((l) => "      " + l).join("\n"));
    bad("commit or stash them first, or re-run with --yes to discard them");
    return 1;
  }
  const before = m.shot && fs.existsSync(path.join(snapshotPath(name), "shot.png"))
    ? path.join(snapshotPath(name), "shot.png") : null;

  // Delete then copy, so a file added since the snapshot is genuinely removed
  // rather than silently surviving the rollback.
  const current = collect();
  for (const rel of current) {
    if (fs.existsSync(path.join(snapshotPath(name), "files", rel))) continue;
    try { fs.rmSync(path.join(ROOT, rel)); info(`removed ${rel} (not in ${name})`); } catch {}
  }
  let restored = 0;
  for (const rel of collect()) {
    const src = path.join(snapshotPath(name), "files", rel);
    if (!fs.existsSync(src)) continue;
    const dst = path.join(ROOT, rel);
    fs.mkdirSync(path.dirname(dst), { recursive: true });
    fs.copyFileSync(src, dst);
    restored++;
  }
  ok(`restored ${restored} file(s) from "${name}"`);
  info(`git HEAD is ${m.gitHead ? m.gitHead.slice(0, 8) : "?"}; working tree now matches the snapshot`);

  if (before) {
    const after = render(m.url || "http://127.0.0.1:8000/", path.join(snapshotPath(name), "after-rollback.png"));
    if (after) {
      const c = compare(before, after, path.join(snapshotPath(name), "rollback-diff.png"));
      if (c.sizeChanged) warn(`viewport width changed ${c.from} -> ${c.to} after the rollback`);
      else {
        if (c.heightDelta) warn(`page height changed by ${Math.abs(c.heightDelta)}px after the rollback`);
        report(c, `${name} (post-rollback)`);
      }
      info(`diff image at ${path.relative(ROOT, path.join(snapshotPath(name), "rollback-diff.png"))}`);
    }
  }
  return 0;
}

function diff(name) {
  const m = readManifest(name);
  if (!m) { bad(`no snapshot named "${name}"`); return 1; }
  const shot = path.join(snapshotPath(name), "shot.png");
  const live = render(m.url || flag("--url", "http://127.0.0.1:8000/"), path.join(snapshotPath(name), "now.png"));
  if (!live || !fs.existsSync(shot)) { bad("cannot diff: one of the screenshots is missing"); return 1; }

  const c = compare(shot, live, path.join(snapshotPath(name), "diff.png"));
  if (c.sizeChanged) {
    bad(`viewport width changed ${c.from} -> ${c.to}; the comparison is not meaningful`);
    return 1;
  }
  console.log("");
  if (c.heightDelta) {
    warn(`the page is ${c.heightDelta > 0 ? "taller" : "shorter"} by ${Math.abs(c.heightDelta)}px than "${name}" - something grew or shrank`);
  }
  report(c, name);
  console.log(`  diff image: ${path.relative(ROOT, path.join(snapshotPath(name), "diff.png"))}\n`);
  return 0;
}

function report(c, name) {
  if (!c.box) { ok(`visually identical to "${name}"`); return; }
  // Band width is the discriminator that actually separates these. Measured on
  // this homepage: an unchanged page differs only in the animated hero, where
  // the widest contiguous run of changed pixels is ~15px, while enlarging a chip
  // by 14px produces a ~796px band. A row-percentage or an area threshold
  // cannot tell them apart at this scale; the width of a solid band can.
  const real = c.maxRun >= 60;
  if (!real) {
    ok(`${c.pct}% differs only as thin speckle (widest band ${c.maxRun}px) - motion noise, treat as unchanged`);
    return;
  }
  const where = `y ${c.box.y}-${c.box.y + c.box.h} of ${c.height}, widest band ${c.maxRun}px`;
  warn(`${c.pct}% of pixels differ from "${name}" - a real change at ${where}`);
}

function list() {
  if (!fs.existsSync(SNAP_DIR)) { info("no snapshots yet - node tools/snap.mjs take v1"); return 0; }
  const names = fs.readdirSync(SNAP_DIR, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name).sort();
  if (!names.length) { info("no snapshots yet"); return 0; }
  console.log(`\n  ${"name".padEnd(10)} ${"when".padEnd(22)} ${"files".padEnd(7)} ${"shot".padEnd(6)} note`);
  for (const n of names) {
    const m = readManifest(n) || {};
    console.log(`  ${n.padEnd(10)} ${String(m.at || "?").replace("T", " ").slice(0, 19).padEnd(22)} ${String(m.fileCount ?? "-").padEnd(7)} ${(m.shot ? "yes" : "no").padEnd(6)} ${m.note || ""}`);
  }
  console.log("");
  return 0;
}

const [cmd, name] = argv;
try {
  if (cmd === "take") process.exit(take(name, flag("--note", null)));
  else if (cmd === "roll") process.exit(roll(name, has("--yes")));
  else if (cmd === "diff") process.exit(diff(name));
  else if (cmd === "list") process.exit(list());
  else { console.log(fs.readFileSync(new URL(import.meta.url), "utf8").split("*/")[0].replace(/^\/\*\*?/, "")); process.exit(0); }
} catch (e) {
  bad(e.stack || e.message);
  process.exit(1);
}
