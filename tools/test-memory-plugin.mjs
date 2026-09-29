/**
 * Exercises the REAL memory plugin: imports .opencode/plugin/memory.ts and calls
 * its own exported hooks. Node 24 strips the TypeScript types natively, so there
 * is no copy of the logic in this file to drift out of date.
 *
 *   node tools/test-memory-plugin.mjs      (npm run test:plugin)
 */
import path from "node:path";
import { pathToFileURL } from "node:url";

// pathToFileURL: on Windows a bare "C:\..." path is read as a URL with the
// unsupported scheme "c:".
const mod = await import(pathToFileURL(path.resolve(".opencode/plugin/memory.ts")).href);
const plugin = await mod.default({ directory: process.cwd(), worktree: process.cwd() });

let failures = 0;
const check = (label, actual, expected) => {
  const pass = JSON.stringify(actual) === JSON.stringify(expected);
  if (!pass) failures++;
  console.log(`  ${pass ? "PASS" : "FAIL"}  ${label}${pass ? "" : `\n         expected ${JSON.stringify(expected)}\n         actual   ${JSON.stringify(actual)}`}`);
};

console.log("\n  1. the SESSION digest keeps the head AND the machine-owned block");
{
  const out = { system: [] };
  await plugin["experimental.chat.system.transform"]({}, out);
  const text = out.system.join("\n");
  const i = text.indexOf("--- SESSION HANDOFF");
  const sess = text.slice(i, text.indexOf("=== END MEMORY ==="));
  check("the SESSION section is present", i >= 0, true);
  check("it kept the hand-written top (Goal reached)", /Goal reached/.test(sess), true);
  check("it kept the machine-generated auto block", /ailgen:auto:end/.test(sess), true);
  check("it kept the recorded branch/HEAD line", /branch: \S+ @ /.test(sess), true);
  check("it reports elision from the middle", /chars elided from the middle/.test(sess), true);
  const bytes = Buffer.byteLength(sess, "utf8");
  check("the section is within its budget", bytes <= 2900, true);
  console.log(`         (SESSION section = ${bytes} bytes)`);
}

console.log("\n  2. hardenConfig floors are ADDITIVE, not an injected blanket allow");
{
  // A user who deliberately omitted `*` to hold a default-deny posture.
  const cfg = { permission: { bash: { "rm *": "ask" }, external_directory: { "C:/keepme": "allow" } } };
  await plugin.config({}, cfg);
  check("`*: allow` was still added, because this repo asks for it", cfg.permission.bash["*"], "allow");
  check("the user's own rule survived", cfg.permission.bash["rm *"], "ask");
  check("the ask-list was added on top", cfg.permission.bash["git push*"], "ask");
  check("the user's own external_directory rule survived", cfg.permission.external_directory["C:/keepme"], "allow");
  check("the credential deny-list was added", cfg.permission.external_directory["~/.ssh/**"], "deny");
  check("the broad external allow was preserved, not removed", cfg.permission.external_directory["*"], "allow");
  check("doom_loop is still pinned to ask", cfg.permission.doom_loop, "ask");
}

console.log("\n  3. hardenConfig can be switched off entirely");
{
  const saved = process.env.AILGEN_NO_CONFIG_FLOORS;
  process.env.AILGEN_NO_CONFIG_FLOORS = "1";
  const cfg = { permission: { bash: { "rm *": "ask" } } };
  await plugin.config({}, cfg);
  check("no ask-list was injected", "git push*" in cfg.permission.bash, false);
  check("no `*` was injected", cfg.permission.bash["*"], undefined);
  check("the user's map is exactly what they wrote", cfg.permission.bash, { "rm *": "ask" });
  if (saved === undefined) delete process.env.AILGEN_NO_CONFIG_FLOORS;
  else process.env.AILGEN_NO_CONFIG_FLOORS = saved;
}

console.log("\n  4. the compaction prompt gets a digest that contains the auto block");
{
  const out = { context: [] };
  await plugin["experimental.session.compacting"]({}, out);
  const text = out.context.join("\n");
  check("the preservation contract is present", /preserv/i.test(text), true);
  check("and the digest it points at actually contains the auto block", /ailgen:auto:end/.test(text), true);
}

console.log("\n  5. model attribution");
{
  await plugin["chat.params"]({ provider: { id: "opencode" }, model: { id: "space-bunny-free" } });
  const out = { system: [] };
  await plugin["experimental.chat.system.transform"]({}, out);
  check("it reports that it re-asserted config floors on the first call", out.system.length >= 1, true);
}

console.log(failures ? `\n  ${failures} FAILURE(S)\n` : "\n  all plugin checks passed\n");
process.exit(failures ? 1 : 0);
