#!/usr/bin/env node
/**
 * safe-exec.mjs - run one foreground command under a hard wall-clock limit.
 *
 * WHY
 * ---
 * This machine's agent shell runner does not return when the foreground
 * command finishes. It waits for the entire PROCESS TREE and will not unblock
 * while any descendant is alive (see memory/ENVIRONMENT.md, "Non-blocking
 * execution"). Measured: a child spawned with detached:true, windowsHide:true
 * and explicit file-descriptor stdio - inheriting no pipe at all - still froze
 * the runner to its full timeout.
 *
 * So "run it in the background and poll" is not available. What is available is
 * the opposite guarantee: we own the child's pipes, we own the clock, and we
 * kill the whole tree ourselves before this process is allowed to exit. A command
 * that hangs, daemonises, or leaves grandchildren holding a handle cannot hold
 * the caller: the deadline is enforced here, not hoped for by the shell.
 *
 * The three properties that make this deadlock-proof:
 *   1. We own both pipes. The child never inherits the caller's stdio, so a
 *      grandchild holding a write end cannot keep our reads open.
 *   2. The deadline is a timer we own, and expiry escalates to taskkill /T /F,
 *      not to a polite signal that a Windows console app may ignore.
 *   3. Output is bounded and spilled to a file, so a chatty command cannot make
 *      the caller wait on a multi-hundred-megabyte read.
 *
 * This is for FINITE work: builds, migrations, git, probes. It is deliberately
 * the wrong tool for a long-running service - start those with
 * tools/supervisor.mjs, which creates them through WMI so they never enter the
 * agent's process tree at all.
 *
 * USAGE
 *   node tools/safe-exec.mjs -- node tools/foo.mjs --check
 *   node tools/safe-exec.mjs --timeout 10 --cwd C:\x -- git status
 *
 * EXIT CODES
 *   0..255  the child's own exit code
 *   124     the deadline expired; the tree was killed
 *   125     the command could not be resolved or spawned
 *   126     bad usage
 */

import { spawn, execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

/* ------------------------------------------------------------------ args --- */
const argv = process.argv.slice(2);
let timeoutMs = 20000;
let cwd = process.cwd();
let json = false;
let quiet = false;
let keep = false;
let rest = [];

// `npm run safe -- <cmd>` hands us "<cmd>" with no literal "--" in between,
// because npm consumes the first one. So: a bare `--` takes the remainder, and
// otherwise everything that is not an option is the command. Treating a missing
// `--` as "no command" broke the one form AGENTS.md tells every agent to use.
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (a === "--") { rest = argv.slice(i + 1); break; }
  if (a === "--timeout" || a === "-t") { timeoutMs = seconds(argv[++i]); continue; }
  if (a === "--cwd" || a === "-C") { cwd = path.resolve(argv[++i]); continue; }
  if (a === "--json") { json = true; continue; }
  if (a === "--quiet" || a === "-q") { quiet = true; continue; }
  if (a === "--keep") { keep = true; continue; }
  if (a === "--help" || a === "-h") { usage(0); }
  if (a.startsWith("-") && a.length > 1) { rest = argv.slice(i); break; }  // unknown option: pass it through
  rest = argv.slice(i); break;
}

function seconds(v) {
  const n = parseFloat(String(v));
  if (!Number.isFinite(n) || n <= 0) usage(126, `--timeout needs a positive number of seconds, got ${JSON.stringify(v)}`);
  // Below 5s a cold node start does not even exit on a trivial script; above
  // 120s the caller has almost certainly forgotten it is bounded.
  return Math.min(120, Math.max(5, n)) * 1000;
}

function usage(code, msg) {
  if (!json) {
    // readFileSync on a path, never on a URL object. The old helper passed
    // `import.meta.url` (a URL) to new URL("." + u.pathname, ...), which on
    // Windows produced "file:\C:\..." and crashed with ENOENT instead of
    // printing the help text.
    const self = fileURLToPath(import.meta.url);
    const head = fs.readFileSync(self, "utf8").split("*/")[0].replace(/^\/\*\*?/, "");
    process.stdout.write(msg ? `${head}\nerror: ${msg}\n` : head);
  }
  process.exit(code);
}

/* -------------------------------------------------------------- resolver --- */
/* Launch a real executable, never a .cmd shim. An npm shim is a batch file that
   spawns another batch file which spawns node: three extra processes in the tree,
   each of which the runner then waits on. supervisor.mjs resolves the same way;
   this copy is deliberately independent so safe-exec stays usable while the
   supervisor is mid-edit or stopped. */
function resolveCommand(cmd) {
  if (/\.exe$/i.test(cmd)) return { exe: cmd, args: [] };

  if (/[\\/]/.test(cmd) && fs.existsSync(cmd)) {
    if (/\.(cmd|bat)$/i.test(cmd)) return resolveShim(cmd);
    return { exe: cmd, args: [] };
  }

  const exts = (process.env.PATHEXT || ".COM;.EXE;.BAT;.CMD").split(";").map((e) => e.trim()).filter(Boolean);
  const dirs = (process.env.PATH || "").split(";").map((d) => d.trim().replace(/^"|"$/g, "")).filter(Boolean);
  const names = /\.[a-z0-9]+$/i.test(cmd) ? [cmd] : [cmd, ...exts.map((e) => cmd + e)];

  for (const d of dirs) {
    for (const n of names) {
      const full = path.join(d, n);
      if (!fs.existsSync(full)) continue;
      if (/\.exe$/i.test(full)) return { exe: full, args: [] };
      if (/\.(cmd|bat)$/i.test(full)) {
        const r = resolveShim(full);
        if (r) return r;
      }
    }
  }
  return null;
}

function resolveShim(shimPath) {
  let body = "";
  try { body = fs.readFileSync(shimPath, "utf8"); } catch { return null; }
  const dir = path.dirname(shimPath);
  // cmd expands %~dp0 to the directory WITH a trailing separator. Substituting
  // the bare directory silently produced "...\sdbg2shimtarget.mjs", which never
  // exists, so every .cmd shim that used %~dp0 resolved to nothing and exited
  // 125. Consume the shim's own separator too, so %~dp0\foo is not doubled.
  const dirSep = dir.endsWith(path.sep) ? dir : dir + path.sep;
  const unquote = (p) =>
    p.replace(/%~dp0[\\/]?/gi, dirSep)
     .replace(/%dp0%[\\/]?/gi, dirSep)
     .replace(/\$\{?dp0\}?[\\/]?/gi, dirSep)
     .replace(/\\"/g, "")
     .replace(/"/g, "");

  // npm shims build the entry point in a variable first:
  //   SET "NPM_CLI_JS=C:\...\npm\bin\npm-cli.js"
  //   "%_prog%"  "%NPM_CLI_JS%"  %*
  // so resolve the assignments and expand them. Without this, `npm` and every
  // other npm-installed CLI was unresolvable and exited 125.
  const vars = new Map();
  for (const m of body.matchAll(/^[ \t]*set[ \t]+"?([A-Za-z_][A-Za-z0-9_]*)="?([^"\r\n]+?)"?[ \t]*$/gim)) {
    // FIRST definition wins. npm.cmd sets NPM_CLI_JS to a real path and then,
    // inside an IF block, reassigns it to %NPM_PREFIX_NPM_CLI_JS%, which is only
    // computed at runtime from a FOR variable. Taking the last definition
    // resolved npm to "%%F\node_modules\...\npm-cli.js", which does not exist.
    const k = m[1].toLowerCase();
    if (!vars.has(k)) vars.set(k, m[2].trim());
  }
  // Expand in ALTERNATING passes: substitute a variable, then fix %~dp0 in what
  // it produced. Doing unquote once up front left `%~dp0` sitting literally
  // inside the substituted value, so npm resolved to a path that does not exist
  // and the run fell through to the wrong file.
  const expand = (p) => {
    let out = String(p);
    for (let i = 0; i < 6; i++) {
      let next = out.replace(/%\(?([A-Za-z_][A-Za-z0-9_]*)\)?%/g, (full, k) => vars.get(k.toLowerCase()) ?? full);
      next = next
        .replace(/%~dp0[\\/]?/gi, dirSep)
        .replace(/%dp0%[\\/]?/gi, dirSep)
        .replace(/\$\{?dp0\}?[\\/]?/gi, dirSep);
      if (next === out) break;
      out = next;
    }
    return out.replace(/\\"/g, "").replace(/"/g, "");
  };
  const resolvePath = (p) => {
    const e = expand(p);
    return path.isAbsolute(e) ? e : path.resolve(dir, e);
  };

  // Which JS file is the ENTRY POINT? Not a guess: the shim's own last command
  // line says so. npm.cmd runs npm-prefix.js first (to compute a prefix) and
  // npm-cli.js second, so "first .js found in the file" runs the wrong program -
  // it printed the npm prefix and exited 0, which looks like success.
  const lines = body.split(/\r?\n/);
  const invocation = lines
    .map((l) => l.trim())
    .filter((l) => l && !/^(@|rem\b|::)/i.test(l))
    .filter((l) => !/^(set|if|for|goto|call|exit|shift|endlocal)\b/i.test(l))
    .filter((l) => /%\*/.test(l) || /"[^"]+"\s+"?[^"\s][^"]*"?/.test(l));
  const last = invocation[invocation.length - 1] || "";

  const fromInvocation = [];
  for (const m of last.matchAll(/"([^"]+)"/g)) {
    const tok = m[1];
    const direct = expand(tok);
    if (/\.(c?js|mjs)$/i.test(direct)) { const f = path.isAbsolute(direct) ? direct : path.resolve(dir, direct); if (fs.existsSync(f)) fromInvocation.push(f); continue; }
    const val = vars.get(tok.replace(/^%|\)$/g, "").toLowerCase());
    if (val) { const e = expand(val); if (/\.(c?js|mjs)$/i.test(e) && fs.existsSync(e)) fromInvocation.push(e); }
  }
  if (fromInvocation.length) return { exe: process.execPath, args: [fromInvocation[fromInvocation.length - 1]] };

  // Fall back to scanning, but prefer a file whose name says "cli".
  const js = [];
  const push = (p) => { const f = path.isAbsolute(p) ? p : path.resolve(dir, p); if (/\.(c?js|mjs)$/i.test(f) && fs.existsSync(f)) js.push(f); };
  for (const m of body.matchAll(/["']([^"']*?\.(?:js|cjs|mjs))["']/gim)) push(expand(m[1]));
  for (const [, v] of vars) push(expand(v));
  if (js.length) {
    const cli = js.find((f) => /cli\.(c?js|mjs)$/i.test(f));
    return { exe: process.execPath, args: [cli || js[js.length - 1]] };
  }

  // Only when the shim genuinely delegates to a native binary.
  for (const m of body.matchAll(/["']([^"']*?\.exe)["']/gim)) {
    const exe = resolvePath(m[1]);
    if (fs.existsSync(exe)) return { exe, args: [] };
  }
  return null;
}
/* ---------------------------------------------------------------- output --- */
/* A bounded sink. Past the cap we stop growing the buffer and spill the rest to
   a file, so neither memory nor the caller's context can be blown by a command
   that prints forever - which is exactly what happens right before a hang. */
const CAP = 512 * 1024;
/* Bounding memory is not enough. A child printing 40MB/s used to fill the disk:
 * 960MB written in 8 seconds before the deadline fired. Past SPILL_CAP the sink
 * stops writing and counts, and reports how much it refused. */
const SPILL_CAP = 64 * 1024 * 1024;
const SPILL_DIR = path.join(os.tmpdir(), "opencode", "safe-exec");

function makeSink(label) {
  let buf = [], size = 0, spill = null, file = null, spilled = 0, dropped = 0;
  const open = () => {
    if (!spill) {
      fs.mkdirSync(SPILL_DIR, { recursive: true });
      file = path.join(SPILL_DIR, `${label}-${process.pid}-${Date.now()}.log`);
      spill = fs.createWriteStream(file);
    }
    return spill;
  };
  return {
    push(chunk) {
      if (size < CAP) { buf.push(chunk); size += chunk.length; return; }
      if (spilled >= SPILL_CAP) { dropped += chunk.length; return; }
      if (!spill) { open(); for (const c of buf) spill.write(c); buf = []; }
      spilled += chunk.length;
      if (spilled > SPILL_CAP) { dropped += spilled - SPILL_CAP; spilled = SPILL_CAP; return; }
      spill.write(chunk);
    },
    flushSync() {
      if (!spill) return { text: Buffer.concat(buf).toString("utf8"), file: null, spilled: 0, dropped: 0 };
      try { spill.end(); } catch {}
      return { text: Buffer.concat(buf).toString("utf8"), file, spilled, dropped };
    },
    // Spill files are temp files. Leaving them accumulates without bound; the
    // caller's only reason to keep one is debugging, which is what --keep is.
    cleanup() {
      if (file && !keep) { try { fs.rmSync(file, { force: true }); } catch { /* ignore */ } return null; }
      return file;
    },
  };
}

/* ------------------------------------------------------------------ kill --- */
function killTree(pid) {
  if (!pid) return false;
  try {
    execFileSync("taskkill", ["/PID", String(pid), "/T", "/F"],
      { timeout: 8000, windowsHide: true, stdio: "ignore" });
    return true;
  } catch {
    try { process.kill(pid, "SIGKILL"); return true; } catch { return false; }
  }
}

/* ------------------------------------------------------------------ main --- */
if (!rest.length) usage(126, "no command given");
if (!fs.existsSync(cwd)) { process.stderr.write(`safe-exec: no such cwd: ${cwd}\n`); process.exit(125); }

const resolved = resolveCommand(rest[0]);
if (!resolved) {
  process.stderr.write(`safe-exec: cannot resolve an executable for ${JSON.stringify(rest[0])}\n`);
  process.exit(125);
}
const spawnArgs = [...resolved.args, ...rest.slice(1)];
const label = path.basename(resolved.exe).replace(/[^a-z0-9]+/gi, "-").toLowerCase();
const out = makeSink(label + "-out");
const err = makeSink(label + "-err");

const started = Date.now();
const header = () => `safe-exec: ${resolved.exe}${spawnArgs.length ? " " + spawnArgs.join(" ") : ""} (cwd ${cwd}, limit ${Math.round(timeoutMs / 1000)}s)`;
if (!quiet && !json) process.stderr.write(header() + "\n");

const child = spawn(resolved.exe, spawnArgs, {
  cwd,
  env: { ...process.env, FORCE_COLOR: "0", NO_COLOR: "1", CI: "1" },
  windowsHide: true,
  // Pipes we own. Never "inherit": an inheriting grandchild can hold the
  // caller's stdout open long after the child itself is gone.
  stdio: ["ignore", "pipe", "pipe"],
  detached: false,
});
child.stdout.on("data", (c) => out.push(c));
child.stderr.on("data", (c) => err.push(c));

let timedOut = false;
let settled = false;

const finish = new Promise((resolve) => {
  const settle = (code) => { if (settled) return; settled = true; resolve(code); };

  const timer = setTimeout(() => {
    timedOut = true;
    if (!quiet && !json) process.stderr.write(`safe-exec: DEADLINE EXCEEDED - killing pid ${child.pid} and its tree\n`);
    killTree(child.pid);
    // A taskkill that races the child's own exit leaves 'exit' un-fired for
    // some process shapes. Do not wait on it forever.
    setTimeout(() => {
      try { child.kill("SIGKILL"); } catch {}
      settle(124);
    }, 3000).unref();
  }, timeoutMs);
  timer.unref?.();

  child.on("error", (e) => {
    process.stderr.write(`safe-exec: spawn failed: ${e.message}\n`);
    clearTimeout(timer);
    settle(125);
  });

  child.on("close", (code, signal) => {
    clearTimeout(timer);
    if (signal && !timedOut) {
      process.stderr.write(`safe-exec: child died on ${signal}\n`);
      settle(125);
      return;
    }
    settle(timedOut ? 124 : (code ?? 0));
  });

  // Last-resort escape: nothing about this run may outlive the deadline plus a
  // small grace period, whatever the child did.
  setTimeout(() => { killTree(child.pid); settle(timedOut ? 124 : 125); },
    timeoutMs + 15000).unref();
});

const code = await finish;

const o = out.flushSync();
const e = err.flushSync();
const ms = Date.now() - started;
const oFile = out.cleanup();
const eFile = err.cleanup();

if (json) {
  process.stdout.write(JSON.stringify({
    command: resolved.exe, args: spawnArgs, cwd, code, timedOut, ms,
    exitCode: code, stdout: o.text, stderr: e.text,
    stdoutSpill: o.spilled ? oFile : null,
    stderrSpill: e.spilled ? eFile : null,
    stdoutDropped: o.dropped, stderrDropped: e.dropped,
  }, null, 2) + "\n");
} else {
  if (o.text) process.stdout.write(o.text);
  if (e.text) process.stderr.write(e.text);
  if (o.spilled) process.stderr.write(`safe-exec: stdout overflowed ${o.spilled} bytes${keep ? ` -> ${oFile}` : " (spill discarded; pass --keep to retain)"}\n`);
  if (e.spilled) process.stderr.write(`safe-exec: stderr overflowed ${e.spilled} bytes${keep ? ` -> ${eFile}` : " (spill discarded; pass --keep to retain)"}\n`);
  if (o.dropped) process.stderr.write(`safe-exec: refused to write ${o.dropped} more stdout bytes - the disk cap is ${SPILL_CAP}\n`);
  if (e.dropped) process.stderr.write(`safe-exec: refused to write ${e.dropped} more stderr bytes - the disk cap is ${SPILL_CAP}\n`);
  const verdict = timedOut ? "TIMEOUT (tree killed)" : code === 0 ? "ok" : `exit ${code}`;
  process.stderr.write(`safe-exec: ${verdict} in ${ms}ms\n`);
}

process.exit(code);
