/**
 * Adversarial test for tools/safe-exec.mjs.
 *
 *   node tools/test-safe-exec.mjs       (npm run test:safe)
 *
 * Every case here is one that actually broke something: a dead child that froze
 * the agent shell, a grandchild holding the write end, a flood that filled the
 * disk, a .cmd shim that resolved to a bare node and did nothing, and the
 * documented `npm run safe -- <cmd>` form that crashed with a mangled file: URL.
 */
import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const TOOL = path.resolve("tools/safe-exec.mjs");
const TMP = path.join(os.tmpdir(), "opencode", "safe-test");
fs.rmSync(TMP, { recursive: true, force: true });
fs.mkdirSync(TMP, { recursive: true });

let failures = 0;
const check = (label, actual, expected) => {
  const pass = JSON.stringify(actual) === JSON.stringify(expected);
  if (!pass) failures++;
  console.log(`  ${pass ? "PASS" : "FAIL"}  ${label}${pass ? "" : `\n         expected ${JSON.stringify(expected)}\n         actual   ${JSON.stringify(actual)}`}`);
};

// Run safe-exec directly, not through npm, so these cases cannot be confounded
// by npm's own argument handling. The npm form is tested separately below.
function safe(args, timeout = 90000) {
  const t0 = Date.now();
  const r = spawnSync(process.execPath, [TOOL, ...args], { encoding: "utf8", timeout, windowsHide: true });
  return { code: r.status, out: (r.stdout || "") + (r.stderr || ""), ms: Date.now() - t0 };
}

console.log("\n  1. the documented invocation forms");
{
  const direct = safe(["--timeout", "10", "--", process.execPath, "-e", "console.log('hi')"]);
  check("with a literal --", [direct.code, /hi/.test(direct.out)], [0, true]);
  const bare = safe(["--timeout", "10", process.execPath, "-e", "console.log('hi')"]);
  check("without one (the npm form)", [bare.code, /hi/.test(bare.out)], [0, true]);
  // `node`, not the absolute path: the path contains a space and npm's own
  // argument passing through a shell splits it, which is an npm/shell quoting
  // issue rather than anything safe-exec controls.
  const npm = spawnSync("npm", ["run", "safe", "--", "node", "-e", "console.log('npm-form-ok')"],
    { encoding: "utf8", timeout: 90000, windowsHide: true, shell: true });
  check("through npm run safe -- (the form AGENTS.md documents)", npm.status === 0 && /npm-form-ok/.test((npm.stdout || "") + (npm.stderr || "")), true);
  if (npm.status !== 0) console.log(`         ${String((npm.stdout || "") + (npm.stderr || "")).split("\n").slice(0, 3).join("\n         ")}`);
  const help = safe(["--help"]);
  check("--help prints usage, not an ENOENT", [help.code, /safe-exec/.test(help.out)], [0, true]);
}

console.log("\n  2. it cannot be made to hang the caller");
{
  const a = safe(["--timeout", "8", "--", process.execPath, "-e", "setInterval(()=>{},1000)"]);
  check("a child that never exits returns 124", a.code, 124);
  check("  and does so near the deadline, not at some timeout of its own", a.ms < 20000, true);

  const b = safe(["--timeout", "8", "--", process.execPath, "-e",
    "const {spawn}=require('child_process');spawn(process.execPath,['-e','setInterval(()=>{},1000)'],{stdio:'inherit'});setInterval(()=>{},1000);"]);
  check("a grandchild holding the write end still returns 124", b.code, 124);
  check("  and near the deadline", b.ms < 20000, true);

  const c = safe(["--timeout", "8", "--", process.execPath, "-e", "process.on('SIGTERM',()=>{});setInterval(()=>{},1000)"]);
  check("a child that swallows SIGTERM still returns 124", c.code, 124);
}

console.log("\n  3. exit codes and failure modes");
{
  check("a failing command's own code is propagated", safe(["--timeout", "10", "--", process.execPath, "-e", "process.exit(7)"]).code, 7);
  check("a command that does not exist is 125", safe(["--timeout", "10", "--", "definitely-not-real-xyz"]).code, 125);
  const nested = safe(["--timeout", "20", "--", process.execPath, TOOL, "--timeout", "10", "--", process.execPath, "-e", "console.log('deep')"]);
  check("nested invocation works", [nested.code, /deep/.test(nested.out)], [0, true]);
  check("the timeout is clamped to a sane floor, not 0", safe(["--timeout", "1", "--", process.execPath, "-e", "console.log('floor')"]).code, 0);
}

console.log("\n  4. a .cmd shim resolves to node PLUS its script, not a bare node");
{
  const script = path.join(TMP, "shimtarget.mjs");
  fs.writeFileSync(script, "console.log('SHIM-RAN'); process.exit(3);\n");
  const shim = path.join(TMP, "mytool.cmd");
  fs.writeFileSync(shim, `@echo off\r\n"%~dp0shimtarget.mjs" %*\r\n`);
  const direct = spawnSync(process.execPath, [script], { encoding: "utf8", timeout: 30000 });
  check("the target runs standalone", [direct.status, /SHIM-RAN/.test(direct.stdout)], [3, true]);
  const viaShim = safe(["--timeout", "15", "--", shim]);
  check("through safe-exec it runs the target and reports its code", viaShim.code, 3);
  check("  and its output", /SHIM-RAN/.test(viaShim.out), true);

  // An npm-style shim: the entry point lives in a variable.
  const npmLike = path.join(TMP, "npmish.cmd");
  const cli = path.join(TMP, "npmish-cli.js");
  fs.writeFileSync(cli, "console.log('CLI-OK');\n");
  fs.writeFileSync(npmLike, `@echo off\r\nSET "MY_CLI_JS=${cli}"\r\n"%~dp0..\\..\\..\\Program Files\\nodejs\\node.exe" "%MY_CLI_JS%" %*\r\n`);
  const viaNpmish = safe(["--timeout", "15", "--", npmLike]);
  check("an npm-style shim (entry point in a variable) resolves", viaNpmish.code, 0);
  check("  and actually runs the CLI", /CLI-OK/.test(viaNpmish.out), true);
}

console.log("\n  5. output flooding is bounded in memory AND on disk");
{
  const spillDir = path.join(os.tmpdir(), "opencode", "safe-exec");
  const before = fs.existsSync(spillDir) ? fs.readdirSync(spillDir).length : 0;
  const f = safe(["--timeout", "30", "--quiet", "--", process.execPath, "-e",
    "for(let i=0;i<800000;i++)process.stdout.write('x'.repeat(200))"], 60000);
  // The child may finish (0) or hit the deadline (124). A crash (1) would mean
  // the sink broke the pipe rather than absorbing it, which is a real failure.
  check("it returns 0 or 124, never a crash", [0, 124].includes(f.code), true);
  if (![0, 124].includes(f.code)) console.log(`         got ${f.code}: ${f.out.split("\n").slice(0, 3).join(" | ")}`);
  const files = fs.existsSync(spillDir) ? fs.readdirSync(spillDir) : [];
  const written = files.reduce((n, x) => n + fs.statSync(path.join(spillDir, x)).size, 0);
  check("no spill file survives the run", files.length <= before, true);
  check("and the disk use is capped, not 160MB", written <= 70 * 1024 * 1024, true);
  check("it says it refused to write the rest", /refused to write|spill discarded/.test(f.out), true);

  const kept = safe(["--timeout", "30", "--keep", "--quiet", "--", process.execPath, "-e",
    "for(let i=0;i<20000;i++)process.stdout.write('y'.repeat(200))"], 60000);
  const after = fs.readdirSync(spillDir);
  check("--keep retains the spill file for debugging", after.length > before, true);
  for (const x of after.filter((n) => n.includes(String(process.pid)))) { try { fs.rmSync(path.join(spillDir, x)); } catch {} }
}

console.log("\n  6. output is capped before it reaches the caller");
{
  const j = safe(["--json", "--timeout", "15", "--", process.execPath, "-e", "console.log('z'.repeat(2*1024*1024))"]);
  const parsed = JSON.parse(j.out.slice(j.out.indexOf("{")));
  check("stdout is truncated to the in-memory cap", parsed.stdout.length < 600 * 1024, true);
}

fs.rmSync(TMP, { recursive: true, force: true });
void execFileSync;
console.log(failures ? `\n  ${failures} FAILURE(S)\n` : "\n  all safe-exec checks passed\n");
process.exit(failures ? 1 : 0);
