#!/usr/bin/env node
/**
 * supervisor.mjs - the non-blocking process supervisor for the AILGEN workspace.
 *
 * WHY THIS EXISTS
 * ---------------
 * Launching a daemon from PowerShell with `Start-Process` and no stream
 * redirection makes the child inherit this process's console handles. That
 * child then spawns its own descendants (npx -> cmd -> node), and every one of
 * them keeps the write end of the caller's stdout pipe open. The caller waits
 * for EOF, EOF never comes, and the whole agent execution loop freezes until a
 * human intervenes. It happened twice on this machine.
 *
 * The fix is structural, not a matter of remembering flags: this file spawns
 * with explicit file-descriptor stdio, so a child can never hold a pipe that
 * belongs to the caller. `detached: true` also puts each service in its own
 * process group so the entire tree can be killed deterministically.
 *
 * A second, quieter bug is fixed here too. `Start-Process npx.cmd -PassThru`
 * returns the PID of the `cmd.exe` *wrapper*, not the server. Tracking that PID
 * means `-Stop` kills a wrapper and leaves the real listener orphaned - and it
 * looks like it worked. This file resolves the true owner of a port from
 * `netstat` and reconciles it against what we recorded.
 *
 * Everything here is deadline-bounded. There is no unbounded wait anywhere, and
 * a global watchdog force-exits the supervisor if a call overruns its budget,
 * so a wedged probe can never wedge the agent.
 *
 * Usage:
 *   node tools/supervisor.mjs start <name> --port 8000 --url http://127.0.0.1:8000/ -- npx serve -l tcp://127.0.0.1:8000
 *   node tools/supervisor.mjs stop <name>
 *   node tools/supervisor.mjs stop --all
 *   node tools/supervisor.mjs status
 *   node tools/supervisor.mjs gc          # kill untracked listeners on managed ports
 *   node tools/supervisor.mjs doctor       # non-zero exit if anything is unhealthy
 */

import { spawn, execFileSync } from "node:child_process";
import net from "node:net";
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

const ROOT = process.cwd();
const STATE_DIR = path.join(ROOT, ".launch");
const STATE_FILE = path.join(STATE_DIR, "state.json");
const LOG_DIR = path.join(STATE_DIR, "logs");

/* Hard global budget. If anything in this process overruns it, we bail loudly
   instead of hanging the caller. A supervisor that can hang is worse than none. */
let HARD_DEADLINE_MS = 45000;
const watchdog = setTimeout(() => {
  console.error(`FATAL: supervisor exceeded its ${HARD_DEADLINE_MS}ms hard deadline`);
  process.exit(4);
}, HARD_DEADLINE_MS);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const C = { g: "\x1b[32m", r: "\x1b[31m", y: "\x1b[33m", c: "\x1b[36m", d: "\x1b[90m", x: "\x1b[0m" };
const ok = (m) => console.log(`  ${C.g}OK${C.x}  ${m}`);
const bad = (m) => console.log(`  ${C.r}!!${C.x}  ${m}`);
const warn = (m) => console.log(`  ${C.y}--${C.x}  ${m}`);
const info = (m) => console.log(`  ${C.d}${m}${C.x}`);

/* ------------------------------------------------------------- state --- */
function readState() {
  try {
    const s = JSON.parse(fs.readFileSync(STATE_FILE, "utf8"));
    return s && typeof s === "object" && s.services ? s : { services: {} };
  } catch {
    return { services: {} };
  }
}
function writeState(s) {
  fs.mkdirSync(STATE_DIR, { recursive: true });
  fs.writeFileSync(STATE_FILE, JSON.stringify(s, null, 2));
}
function pidAlive(pid) {
  if (!pid) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (e) {
    return e.code === "EPERM";
  }
}

/* ------------------------------------------------- real port ownership --- */
/* The authoritative answer to "which process is serving this port". Parsed from
   netstat rather than PowerShell so the supervisor has no shell dependency and
   cannot itself be derailed by quoting. */
function portOwner(port) {
  let out = "";
  try {
    out = execFileSync("netstat", ["-ano", "-p", "TCP"], { encoding: "utf8", timeout: 5000, windowsHide: true });
  } catch {
    return null;
  }
  const want = `:${port}`;
  for (const line of out.split(/\r?\n/)) {
    const c = line.trim().split(/\s+/);
    if (c.length < 5) continue;
    if (!c[1].endsWith(want)) continue;
    if (!/LISTENING/i.test(c[3])) continue;
    const pid = parseInt(c[4], 10);
    if (Number.isFinite(pid)) return pid;
  }
  return null;
}

/* ----------------------------------------------------- bounded probes --- */
function probePort(port, timeoutMs = 1200) {
  return new Promise((resolve) => {
    let done = false;
    const finish = (v) => { if (!done) { done = true; resolve(v); } };
    const sock = new net.Socket();
    sock.setTimeout(timeoutMs);
    sock.once("connect", () => { sock.destroy(); finish(true); });
    sock.once("timeout", () => { sock.destroy(); finish(false); });
    sock.once("error", () => { sock.destroy(); finish(false); });
    sock.connect(port, "127.0.0.1");
  });
}

function probeHttp(url, timeoutMs = 2500) {
  return new Promise((resolve) => {
    let done = false;
    const finish =v => { if (!done) { done = true; resolve(v); } };
    let u;
    try { u = new URL(url); } catch { return finish(false); }
    const req = http.get(
      { hostname: u.hostname, port: u.port || 80, path: u.pathname + u.search, timeout: timeoutMs },
      (res) => {
        res.resume();                       // drain so the socket can close
        res.once("end", () => finish(res.statusCode > 0 && res.statusCode < 500));
        res.once("error", () => finish(false));
      }
    );
    // Abort the request itself, not just the socket, or a server that accepts
    // and then stalls keeps the event loop alive indefinitely.
    req.setTimeout(timeoutMs, () => { req.destroy(); finish(false); });
    req.on("error", () => finish(false));
  });
}

/* For a service with no port there is nothing to reconcile against, and the PID
   handed back by WMI belongs to the cmd.exe wrapper. The real process is found
   instead by a distinctive argument of its own: the .cmd runner is invisible in
   the child's command line, but the script it launches is not. */
function resolveRunnerPid(signature) {
  if (!signature) return null;
  // Injected into an already single-quoted PowerShell string, so it must not
  // contain one of its own. Quoting it here produced -like '*'x'*' , which
  // PowerShell silently parses as something else entirely and never matches.
  const sig = String(signature).replace(/'/g, "");
  // The skip list is not enough. The supervisor's own command line contains the
  // service's arguments, because it was told to launch them, so it matches
  // itself unless its own PID is excluded by name and by number.
  const ps =
    `$skip = @('cmd.exe','powershell.exe','pwsh.exe','conhost.exe','pwsh-preview.exe'); ` +
    `$c = Get-CimInstance Win32_Process | ` +
    `Where-Object { $skip -notcontains $_.Name -and $_.ProcessId -ne ${process.pid} ` +
    `-and $_.CommandLine -like '*${sig}*' } | ` +
    `Select-Object -First 1 -ExpandProperty ProcessId; Write-Output $c`;
  // WMI has created cmd.exe, but cmd.exe has not necessarily started node.exe
  // yet, so the first lookup can legitimately find nothing. Retry briefly.
  for (let attempt = 0; attempt < 6; attempt++) {
    try {
      const out = execFileSync("powershell.exe",
        ["-NoProfile", "-NonInteractive", "-Command", ps],
        { encoding: "utf8", timeout: 20000, windowsHide: true, stdio: ["ignore", "pipe", "pipe"] });
      const pid = parseInt(String(out).trim(), 10);
      if (Number.isFinite(pid) && pid > 0) return pid;
    } catch { /* retry */ }
    spawnSyncSleep(400);
  }
  return null;
}
function spawnSyncSleep(ms) {
  const end = Date.now() + ms;
  while (Date.now() < end) { /* deliberate short wait, bounded */ }
}

/* ---------------------------------------------------- detached create --- */
/* THE core fix, and the reason this file exists at all.
 *
 * On this machine the agent's shell runner does not return merely because the
 * foreground command finished - it waits for the whole process tree, and
 * refuses to unblock while any descendant is alive. Measured directly: a
 * detached child with file-descriptor stdio (so it held no pipe whatsoever)
 * still hung the runner for the full timeout. Redirecting streams, `unref()`,
 * `detached: true` and `windowsHide` are all necessary but NOT sufficient.
 *
 * The only reliable way to start a daemon from here is to have it created by
 * the WMI provider service, which makes it a child of the WMI host rather than
 * of the agent's shell. The runner's tree never contains it, so the runner
 * returns immediately. Verified: WMI Create returned in 0.19s while the
 * created process kept running.
 *
 * A generated .cmd wrapper gives us the child a working directory and a log
 * file, which we would otherwise lose by detaching from the console. */
/* Resolve a command to a real executable plus any leading arguments, so that
   no .cmd/.bat shim is ever launched. npm shims are two-line batch files that
   ultimately exec `node <some-cli.js> %*`; parsing that gives us a real
   node.exe invocation with no cmd.exe in the process tree. */
function resolveCommand(cmd) {
  // Already a real executable.
  if (/\.exe$/i.test(cmd)) return { exe: cmd, args: [] };

  // An absolute path to something executable.
  if (/[\\/]/.test(cmd) && fs.existsSync(cmd)) {
    if (/\.(cmd|bat)$/i.test(cmd)) return resolveShim(cmd);
    return { exe: cmd, args: [] };
  }

  // Bare name: scan PATH directly. `where` is a PowerShell alias for
  // Where-Object, so invoking it by that name silently filters to nothing; and
  // relying on an external binary here would put another process in the tree.
  // Walking PATH ourselves is deterministic and dependency-free.
  const exts = (process.env.PATHEXT || ".COM;.EXE;.BAT;.CMD")
    .split(";").map((e) => e.trim()).filter(Boolean);
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
  // npm shims vary: some inline %~dp0, most do `SET dp0=%~dp0` and then use
  // "%dp0%\...". Handle every form, or the resolved path stays a literal
  // "%dp0%\..." and silently fails the existence check.
  const unquote = (p) =>
    p.replace(/%~dp0/gi, dir)
     .replace(/%dp0%/gi, dir)
     .replace(/\$\{?dp0\}?/gi, dir)
     .replace(/\\"/g, "")
     .replace(/"/g, "");

  // Case 1: the shim delegates straight to a real .exe (the common case for
  // globally installed packages with a native binary). Prefer this: one process.
  for (const m of body.matchAll(/["']([^"']*?\.exe)["']/gi)) {
    const exe = path.isAbsolute(unquote(m[1])) ? unquote(m[1]) : path.resolve(dir, unquote(m[1]));
    if (fs.existsSync(exe)) return { exe, args: [] };
  }

  // Case 2: the shim delegates to a JS entry point, so node must run it.
  for (const m of body.matchAll(/["']([^"']*?\.(?:js|cjs|mjs))["']/gi)) {
    const js = path.isAbsolute(unquote(m[1])) ? unquote(m[1]) : path.resolve(dir, unquote(m[1]));
    if (fs.existsSync(js)) return { exe: process.execPath, args: [js] };
  }

  return null;
}

function psQuote(s) {
  return "'" + String(s).replace(/'/g, "''") + "'";
}

function createDetached(runnerCmdPath) {
  const ps =
    `$r = Invoke-CimMethod -ClassName Win32_Process -MethodName Create ` +
    `-Arguments @{ CommandLine = ${psQuote(`cmd.exe /d /c "${runnerCmdPath}"`)} }; ` +
    `Write-Output $r.ProcessId`;
  const out = execFileSync("powershell.exe",
    ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-Command", ps],
    { encoding: "utf8", timeout: 20000, windowsHide: true, stdio: ["ignore", "pipe", "pipe"] });
  const pid = parseInt(String(out).trim(), 10);
  if (!Number.isFinite(pid) || pid <= 0) throw new Error(`WMI create failed: ${String(out).trim()}`);
  return pid;
}

/* Write the per-service runner that the detached process executes. Kept as a
   real file rather than a constructed command line so quoting bugs become
   impossible and the exact launch can be read and re-run by hand. */
function writeRunner(name, exe, args, cwd) {
  const dir = path.join(STATE_DIR, "run");
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `${name}.cmd`);
  const out = path.join(LOG_DIR, `${name}.out.log`);
  const err = path.join(LOG_DIR, `${name}.err.log`);
  const q = (p) => `"${String(p).replace(/"/g, '""')}"`;
  const body = [
    "@echo off",
    `cd /d ${q(cwd)}`,
    `${q(exe)} ${args.map(q).join(" ")} 1>> ${q(out)} 2>> ${q(err)}`,
    "",
  ].join("\r\n");
  fs.writeFileSync(file, body, "utf8");
  return { file, out, err };
}
/* ------------------------------------------------------------ kill tree --- */
/* taskkill /T is required. Stop-Process on a parent leaves grandchildren - the
   npx -> cmd -> node chain - running and still holding the port. */
function killTree(pid) {
  if (!pid) return false;
  try {
    execFileSync("taskkill", ["/PID", String(pid), "/T", "/F"], { timeout: 8000, windowsHide: true, stdio: "ignore" });
    return true;
  } catch {
    try { process.kill(pid, "SIGKILL"); return true; } catch { return false; }
  }
}

function tailFile(p, n = 12) {
  try {
    return fs.readFileSync(p, "utf8").split(/\r?\n/).filter(Boolean).slice(-n).join("\n");
  } catch { return "(no log output)"; }
}

/* -------------------------------------------------------------- start --- */
async function start(name, { cmd, args, port, url, waitMs = 20000, noWait = false }) {
  if (!name || !cmd) { bad("start needs <name> and a command"); return 2; }
  fs.mkdirSync(LOG_DIR, { recursive: true });
  const out = path.join(LOG_DIR, `${name}.out.log`);
  const err = path.join(LOG_DIR, `${name}.err.log`);

  // Adopt a healthy existing service rather than starting a second one.
  if (port) {
    const owner = portOwner(port);
    if (owner) {
      const healthy = url ? await probeHttp(url) : await probePort(port);
      if (healthy) {
        const st = readState();
        st.services[name] = { ...(st.services[name] || {}), pid: owner, port, url: url || null, cmd, adopted: true, at: new Date().toISOString() };
        writeState(st);
        ok(`${name} already healthy on ${port} - adopted pid ${owner}`);
        return 0;
      }
      warn(`${name}: port ${port} busy (pid ${owner}) but not serving - killing the tree`);
      killTree(owner);
      await sleep(900);
    }
  }

  const outFd = fs.openSync(out, "a");
  const errFd = fs.openSync(err, "a");
  fs.closeSync(outFd);
  fs.closeSync(errFd);

  // Resolve to a real executable so no shell shim enters the process tree.
  const resolved = resolveCommand(cmd);
  if (!resolved) { bad(`cannot resolve an executable for "${cmd}"`); return 2; }

  let childPid;
  let runnerFile = null;
  try {
    const runner = writeRunner(name, resolved.exe, [...resolved.args, ...args], ROOT);
    runnerFile = runner.file;
    childPid = createDetached(runner.file);
  } catch (e) {
    bad(`failed to start ${name}: ${e.message}`);
    return 1;
  }
  // Record the real process where we can identify it, not the wrapper.
  if (runnerFile) {
    // A script argument is the most distinctive thing in the child's own command
    // line; a bare executable name like "node" is not.
    const sig = [...resolved.args, ...args].find((a) => /\.(mjs|js|cjs|json)$/i.test(a));
    const real = portOwner(port) || resolveRunnerPid(sig);
    if (real && real !== childPid) childPid = real;
  }

  const st = readState();
  st.services[name] = { pid: childPid, port: port || null, url: url || null, cmd, args, adopted: false, at: new Date().toISOString() };
  writeState(st);
  info(`spawned ${name} pid ${childPid}${port ? ` on ${port}` : ""}`);

  // A daemon that never listens on a port is legitimate - a migration watcher,
  // for instance, exists precisely to wait for a condition. Waiting for a port
  // that will never open would kill it as "not ready". `--no-wait` therefore
  // means "confirm it is alive and stay out of the way".
  if (noWait) {
    await sleep(1500);
    if (pidAlive(childPid)) { ok(`${name} running (pid ${childPid})`); return 0; }
    bad(`${name} exited within 1.5s of starting`);
    console.log(tailFile(err, 15));
    return 1;
  }

  // Bounded readiness wait. Fails fast with the child's own log tail, which is
  // the difference between an actionable error and a silent hang.
  const deadline = Date.now() + waitMs;
  while (Date.now() < deadline) {
    await sleep(400);
    if (port) {
      const listening = await probePort(port);
      if (listening) {
        const healthy = url ? await probeHttp(url) : true;
        if (healthy) {
          const real = portOwner(port) ?? childPid;
          const st2 = readState();
          st2.services[name].pid = real;
          writeState(st2);
          if (real !== childPid) {
            ok(`${name} ready on ${port} - real owner pid ${real} (wrapper was ${childPid})`);
          } else {
            ok(`${name} ready on ${port} (pid ${real})`);
          }
          return 0;
        }
      }
    } else if (!pidAlive(childPid)) {
      bad(`${name} exited immediately`);
      console.log(tailFile(err, 15));
      return 1;
    }
  }
  bad(`${name} did not become ready within ${waitMs}ms - killing the tree`);
  console.log(tailFile(err, 15));
  killTree(childPid);
  const st3 = readState();
  delete st3.services[name];
  writeState(st3);
  return 1;
}

/* --------------------------------------------------------------- stop --- */
async function stop(name) {
  const st = readState();
  const targets = name ? [name] : Object.keys(st.services);
  if (!targets.length) { info("nothing tracked"); return 0; }
  let badCount = 0;
  for (const n of targets) {
    const s = st.services[n];
    if (!s) { warn(`${n}: not tracked`); continue; }
    // Prefer the real port owner: it is the process that actually holds the
    // resource. The recorded pid may be a wrapper that already exited.
    const owner = s.port ? portOwner(s.port) : null;
    const pids = [...new Set([owner, s.pid].filter(Boolean))];
    let killed = false;
    for (const p of pids) { if (pidAlive(p)) { killTree(p); killed = true; } }
    if (killed) ok(`stopped ${n} (pids ${pids.join(", ")})`);
    else info(`${n}: already gone`);
    if (owner) { await sleep(400); const still = portOwner(s.port); if (still) { bad(`${n}: port ${s.port} still held by ${still}`); badCount++; } }
    delete st.services[n];
  }
  writeState(st);
  return badCount ? 1 : 0;
}

/* ------------------------------------------------------------- status --- */
async function status() {
  const st = readState();
  const names = Object.keys(st.services);
  console.log(`\n  AILGEN supervisor  ${C.d}${ROOT}${C.x}`);
  if (!names.length) { info("no services tracked"); console.log(""); return 0; }
  let badCount = 0;
  for (const n of names) {
    const s = st.services[n];
    const owner = s.port ? portOwner(s.port) : null;
    const healthy = s.port ? (s.url ? await probeHttp(s.url) : await probePort(s.port)) : pidAlive(s.pid);
    const drift = s.port && owner && s.pid && owner !== s.pid;
    const line = `${n.padEnd(12)} port ${String(s.port ?? "-").padEnd(6)} tracked ${String(s.pid ?? "-").padEnd(7)} owner ${String(owner ?? "-").padEnd(7)} ${healthy ? `${C.g}healthy${C.x}` : `${C.r}DOWN${C.x}`}`;
    console.log(`  ${line}`);
    if (!healthy) badCount++;
    if (drift) console.log(`  ${C.y}drift${C.x}      tracked pid ${s.pid} is not the port owner ${owner}`);
  }
  console.log("");
  return badCount ? 1 : 0;
}

/* ----------------------------------------------------------------- gc --- */
/* Kill listeners on managed ports that we are not tracking. This is the
   self-healing step that makes a crashed or force-killed run recoverable
   without a reboot, and it is what "zero orphans" means in practice. */
async function gc(ports) {
  const st = readState();
  const trackedPorts = new Set(Object.values(st.services).map((s) => s.port).filter(Boolean));
  const managed = [...new Set([...(ports || []), ...trackedPorts])];
  let killed = 0;
  for (const p of managed) {
    if (trackedPorts.has(p)) continue;
    const owner = portOwner(p);
    if (!owner) continue;
    bad(`port ${p} held by untracked pid ${owner} - killing the tree`);
    killTree(owner);
    killed++;
    await sleep(400);
    const still = portOwner(p);
    if (still) bad(`port ${p} STILL held by ${still} after taskkill /T`);
    else ok(`port ${p} released`);
  }
  if (!killed) ok("no orphaned listeners on managed ports");
  return killed ? 0 : 0;
}

/* --------------------------------------------------------------- main --- */
function parseArgs(argv) {
  const out = { _: [], flags: {} };
  let i = 2;
  while (i < argv.length) {
    const a = argv[i];
    if (a === "--") { out._.push(...argv.slice(i + 1)); break; }
    if (a.startsWith("--")) {
      const k = a.slice(2);
      const nxt = argv[i + 1];
      if (nxt && !nxt.startsWith("--")) { out.flags[k] = nxt; i += 2; }
      else { out.flags[k] = true; i++; }
    } else { out._.push(a); i++; }
  }
  return out;
}

async function main() {
  const a = parseArgs(process.argv);
  const cmd = a._[0];
  if (!cmd || cmd === "help" || a.flags.help) {
    console.log(fs.readFileSync(new URL(import.meta.url), "utf8").split("*/")[0].replace(/^\/\*\*?/, ""));
    clearTimeout(watchdog);
    return process.exit(0);
  }
  if (a.flags.deadline) HARD_DEADLINE_MS = Math.max(5000, parseInt(a.flags.deadline, 10));
  if (a.flags.ports) a.flags.ports = a.flags.ports.split(",").map((x) => parseInt(x, 10));

  let code = 0;
  switch (cmd) {
    case "start": {
      const name = a._[1];
      const argvCmd = a._.filter((x) => x !== "start" && x !== name);
      if (!argvCmd.length) { bad("start needs a command after --"); code = 2; break; }
      code = await start(name, {
        cmd: argvCmd[0],
        args: argvCmd.slice(1),
        port: a.flags.port ? parseInt(a.flags.port, 10) : null,
        url: a.flags.url || null,
        waitMs: a.flags["wait-ms"] ? parseInt(a.flags["wait-ms"], 10) : 20000, noWait: !!a.flags["no-wait"],
      });
      break;
    }
    case "stop": code = await stop(a.flags.all ? null : a._[1]); break;
    case "resolve": {
      for (const c of a._.slice(1)) {
        const r = resolveCommand(c);
        console.log(`  ${c} -> ${r ? `${r.exe}${r.args.length ? " " + r.args.join(" ") : ""}` : "UNRESOLVED"}`);
      }
      break;
    }
    case "status": code = await status(); break;
    case "gc": code = await gc(a.flags.ports || [8000, 4096]); break;
    case "doctor": {
      const s = await status();
      code = await gc(a.flags.ports || [8000, 4096]);
      code = code || s;
      break;
    }
    default: bad(`unknown command "${cmd}"`); code = 2;
  }
  clearTimeout(watchdog);
  return process.exit(code);
}

main().catch((e) => {
  console.error("supervisor crashed: " + (e?.stack || e));
  clearTimeout(watchdog);
  process.exit(3);
});
