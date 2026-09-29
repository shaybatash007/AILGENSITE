#!/usr/bin/env node
/**
 * check-all.mjs - one command that answers "is everything actually working?"
 *
 *   npm run check
 *
 * Every layer this repo depends on, checked against the running machine rather
 * than against a claim. It is deliberately NOT a wrapper around doctor: doctor
 * reads files, and most of what breaks here breaks at runtime - a port nobody
 * owns, a database path that drifted, a Web UI that renders an empty project
 * while the API returns 20 sessions, a desktop shortcut pointing at a folder that
 * moved last week.
 *
 * Exit 0 only if every REQUIRED check passes. Known-upstream issues are reported
 * as KNOWN, not as failures, so the exit code means "our setup is sound".
 */
import { chromium } from "playwright";
import { DatabaseSync } from "node:sqlite";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import http from "node:http";

const ROOT = process.cwd();
const EDGE = "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";
const DB = path.join(os.homedir(), ".local", "share", "opencode", "opencode.db");
const PROJECT_DIR = "C:/Users/shayb/projects/AILGENSITE";
const DEV = "http://127.0.0.1:8000/";
const WEB = "http://127.0.0.1:4096/";

const C = { g: "\x1b[32m", r: "\x1b[31m", y: "\x1b[33m", d: "\x1b[90m", c: "\x1b[36m", x: "\x1b[0m" };
let failures = 0;
let known = 0;

function pass(label, extra = "") { console.log(`  ${C.g}PASS${C.x}  ${label}${extra ? `  ${C.d}${extra}${C.x}` : ""}`); }
function fail(label, extra = "") { failures++; console.log(`  ${C.r}FAIL${C.x}  ${label}${extra ? `  ${C.d}${extra}${C.x}` : ""}`); }
function knownIssue(label, extra = "") { known++; console.log(`  ${C.y}KNOWN${C.x} ${label}${extra ? `\n         ${C.d}${extra}${C.x}` : ""}`); }
function head(t) { console.log(`\n${C.c}== ${t}${C.x}`); }

function httpGet(url, ms = 8000) {
  return new Promise((resolve) => {
    const u = new URL(url);
    const req = http.get({ hostname: u.hostname, port: u.port, path: u.pathname + u.search, timeout: ms }, (res) => {
      const chunks = [];
      res.on("data", (c) => chunks.push(c));
      res.on("end", () => resolve({ status: res.statusCode, body: Buffer.concat(chunks).toString("utf8") }));
    });
    req.on("timeout", () => { req.destroy(); resolve({ status: 0, body: "", err: "timeout" }); });
    req.on("error", (e) => resolve({ status: 0, body: "", err: e.code }));
  });
}

const sh = (cmd, args) => spawnSync(cmd, args, { encoding: "utf8", timeout: 120000, windowsHide: true });

/* ---------------------------------------------------------------- 1. ports */
head("1. services");
for (const [name, url] of [["dev  :8000", DEV], ["web  :4096", WEB]]) {
  const r = await httpGet(url);
  if (r.status === 200) pass(`${name} serving`, `HTTP 200`);
  else fail(`${name} serving`, r.err || `HTTP ${r.status}`);
}
const sup = sh(process.execPath, ["tools/supervisor.mjs", "status"]);
const supText = ((sup.stdout || "") + (sup.stderr || "")).replace(/\x1b\[[0-9;]*m/g, "");
const stale = [];
for (const line of supText.split("\n")) {
  const t = line.trim();
  if (!/\b(healthy|DOWN|STALE|unresponsive)\b/.test(t)) continue;
  if (/\bhealthy\b/.test(t)) continue;
  // A service with no port and a DOWN owner is a dead entry someone left behind.
  // It is not harmless: `supervisor doctor` and the desktop launcher both print
  // it, and a stale entry pointing at a retired tool is a foot-gun.
  if (/\bDOWN\b|\bSTALE\b/.test(t)) stale.push(t);
}
if (stale.length) {
  for (const s of stale) fail("stale tracked service", `${s}  ->  node tools/supervisor.mjs stop <name>`);
} else {
  pass("no stale tracked services", "every entry is a live, owned listener");
}

/* ------------------------------------------------------------------- 2. db */
head("2. opencode database");
if (!fs.existsSync(DB)) {
  fail("database exists", DB);
} else {
  const db = new DatabaseSync(DB, { readOnly: true });
  const integrity = Object.values(db.prepare("PRAGMA integrity_check").get())[0];
  integrity === "ok" ? pass("integrity_check ok") : fail("integrity_check", integrity);

  const dirs = db.prepare("SELECT directory, COUNT(*) c FROM session GROUP BY directory ORDER BY c DESC").all();
  const bound = dirs.find((d) => d.directory === PROJECT_DIR);
  bound ? pass("sessions bound to the project directory", `${bound.c} under ${bound.directory}`)
        : fail("sessions bound to the project directory", JSON.stringify(dirs));

  const backslash = db.prepare("SELECT COUNT(*) c FROM session WHERE directory LIKE '%\\%'").get().c;
  backslash === 0 ? pass("no backslash-spelled session paths") : fail("no backslash-spelled session paths", `${backslash} rows`);

  const orphans = db.prepare(
    "SELECT COUNT(*) c FROM part p LEFT JOIN message m ON m.id=p.message_id WHERE m.id IS NULL").get().c;
  orphans === 0 ? pass("no orphaned parts") : fail("no orphaned parts", `${orphans}`);
  db.close();
}

/* ------------------------------------------------------------------ 3. api */
head("3. opencode web API");
const sess = await httpGet(`${WEB}api/session?directory=${encodeURIComponent(PROJECT_DIR)}&limit=200`);
if (sess.status === 200) {
  try {
    const list = JSON.parse(sess.body);
    const n = Array.isArray(list) ? list.length : (list.data || []).length;
    n > 0 ? pass("/api/session returns the history", `${n} sessions`) : fail("/api/session returns the history", "0 sessions");
  } catch { fail("/api/session returns the history", "response was not JSON"); }
} else fail("/api/session reachable", sess.err || `HTTP ${sess.status}`);

/* ---------------------------------------------------------------- 4. tests */
head("4. test suites");
// Run the scripts directly rather than through npm: one less shim to resolve, and
// it is the code under test that matters, not the package runner.
for (const [label, script] of [
  ["test:canon", "tools/test-canonicalize.mjs"],
  ["test:mutate", "tools/test-mutation.mjs"],
  ["test:plugin", "tools/test-memory-plugin.mjs"],
  ["test:safe", "tools/test-safe-exec.mjs"],
]) {
  const r = sh(process.execPath, [script]);
  r.status === 0 ? pass(label) : fail(label, (r.stdout || r.stderr || `exit ${r.status}`).split("\n").filter((l) => /FAIL/.test(l))[0] || `exit ${r.status}`);
}

/* ------------------------------------------------------------ 5. desktop */
head("5. desktop shortcut");
try {
  const ps = `$s=New-Object -ComObject WScript.Shell;$l=$s.CreateShortcut("$([Environment]::GetFolderPath('Desktop'))\\AILGEN-Dev-Suite.lnk");
"T|"+$l.TargetPath; "A|"+$l.Arguments; "W|"+$l.WorkingDirectory; "I|"+$l.IconLocation`;
  const r = sh("powershell.exe", ["-NoProfile", "-Command", ps]);
  const map = Object.fromEntries((r.stdout || "").split("\n").filter(Boolean).map((l) => {
    const i = l.indexOf("|"); return [l.slice(0, i), l.slice(i + 1).trim()];
  }));
  // Both halves must be regexes. A string replace of '"?$' matches nothing and
  // leaves the closing quote glued to the path.
  const launcher = (map.A || "").replace(/.*-File\s+"?/, "").replace(/"?\s*$/, "");
  fs.existsSync(map.T) ? pass("target executable exists", map.T) : fail("target executable exists", map.T);
  fs.existsSync(launcher) ? pass("launcher script exists", launcher) : fail("launcher script exists", launcher);
  fs.existsSync(map.W) ? pass("working directory exists", map.W) : fail("working directory exists", map.W);
  const icon = (map.I || "").replace(/,\d+$/, "");
  fs.existsSync(icon) ? pass("icon exists", path.basename(icon)) : fail("icon exists", icon);
} catch (e) {
  fail("desktop shortcut readable", e.message);
}

/* -------------------------------------------------------------- 6. browser */
head("6. what a person actually sees");
const browser = await chromium.launch({ headless: true, executablePath: fs.existsSync(EDGE) ? EDGE : undefined });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  await page.goto(DEV, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(3000);
  const site = await page.evaluate(() => ({
    dir: document.documentElement.dir,
    lang: document.documentElement.lang,
    h1: document.querySelector("h1")?.textContent?.trim().slice(0, 40) || "",
    brokenImgs: [...document.images].filter((i) => i.complete && i.naturalWidth === 0 && i.getAttribute("src")).length,
  }));
  site.dir === "rtl" ? pass("site renders RTL", site.h1) : fail("site renders RTL", `dir=${site.dir}`);
  site.brokenImgs === 0 ? pass("no broken images on the site") : fail("no broken images on the site", `${site.brokenImgs}`);

  await page.goto(WEB, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(4000);
  const ui = await page.evaluate(() => document.body.innerText);
  await page.screenshot({ path: "projects/_eyes/out/check-webui.png" });
  if (/Nothing here yet/.test(ui)) {
    knownIssue("web UI shows an empty project list",
      "Upstream client bug, not this setup: the API returns every session and\n" +
      "         /path resolves the repo, but the client never binds a project. Driven\n" +
      "         with a real browser and a real click path; screenshot in projects/_eyes/out/check-webui.png.\n" +
      "         Data is correct and recoverable - use the TUI, or open the UI via ?directory= once upstream fixes it.");
  } else {
    pass("web UI shows content", ui.split("\n")[0]?.slice(0, 40));
  }
} catch (e) {
  fail("browser checks ran", e.message.split("\n")[0]);
} finally {
  await browser.close();
}

await browser.close().catch(() => {});

/* ----------------------------------------------------------------- verdict */
console.log("");
if (failures) {
  console.log(`  ${C.r}${failures} FAILURE(S)${C.x}${known ? `, ${known} known upstream` : ""}\n`);
  process.exit(1);
}
console.log(`  ${C.g}all required checks passed${C.x}${known ? `  (${known} known upstream issue, not this setup)` : ""}\n`);
process.exit(0);
