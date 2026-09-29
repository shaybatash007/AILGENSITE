/**
 * Mutation harness for tools/test-canonicalize.mjs.
 *
 *   node tools/test-mutation.mjs        (npm run test:mutate)
 *
 * A regression test that cannot fail is not a test. The first fixture shipped
 * with this tool PASSED while the original 14-session bug was reintroduced into
 * the tool, the tool's own assertion reported "no undeclared row lost", and a
 * real row was still deleted. Nobody knew, because nothing ever checked whether
 * the fixture reacts to the bug.
 *
 * Mutations come in two kinds, and the distinction is the whole point:
 *
 *   BUGS change what the tool DOES. A correct fixture must catch these alone,
 *   because with correct behaviour the damage is visible in the data.
 *
 *   MECHANISMS are the safety nets. Removing one changes nothing observable
 *   while the tool still behaves - so a mechanism cannot be tested in
 *   isolation. Each is therefore paired with a BUG that violates the invariant
 *   it exists to catch, and the pair must fail. Testing them alone is a
 *   category error, and an earlier version of this file did exactly that and
 *   reported seven surviving "mutations" that were really seven untestable
 *   ideas.
 *
 * Every mutation is applied to a throwaway COPY. The repo's own tool is never
 * modified.
 */
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const ROOT = process.cwd();
const WORK = path.join(os.tmpdir(), "opencode", "canon-mutants");
const TOOL = path.join(WORK, "tools", "canonicalize-paths.mjs");

/* --- BUGS: a correct fixture must catch each of these on its own ------------- */
const BUGS = [
  {
    name: "the ORIGINAL bug: dedupe DELETE predicate is a tautology",
    // `col = ? AND col != ?` excludes exactly what `col = ?` selects, so it is
    // true for every row it matches. This predicate deleted 14 sessions,
    // 675 messages and 2,825 parts.
    edits: [
      [/\$\{c\} IN \(SELECT \$\{c\} FROM \$\{r\.table\} WHERE \$\{r\.column\} = \?\)/g, "1 = 1"],
      [/const params = \[r\.value, \.\.\.rule\.identity\.map\(\(\) => r\.canonical\)\];/,
        "const params = [r.value];"],
    ],
  },
  {
    name: "dedupe DELETE with no identity restriction at all",
    edits: [
      [/\$\{c\} IN \(SELECT \$\{c\} FROM \$\{r\.table\} WHERE \$\{r\.column\} = \?\)/g, "1 = 1"],
    ],
  },
  {
    name: "dedupe deletes the CANONICAL row and keeps the duplicate",
    edits: [
      [/const params = \[r\.value, \.\.\.rule\.identity\.map\(\(\) => r\.canonical\)\];/,
        "const params = [r.canonical, ...rule.identity.map(() => r.value)];"],
    ],
  },
  {
    name: "the UPDATE loses its WHERE clause",
    edits: [
      [/const up = db\.prepare\(`UPDATE \$\{r\.table\} SET \$\{r\.column\} = \? WHERE \$\{r\.column\} = \?`\)/,
        "const up = db.prepare(`UPDATE ${r.table} SET ${r.column} = ?`)"],
    ],
  },
  {
    name: "pathInKey forced true, so a non-unique column is treated as unique",
    edits: [[/const pathInKey = pk\.includes\(r\.column\);/, "const pathInKey = true;"]],
  },
  {
    name: "an extra undeclared DELETE after the declared dedupe",
    edits: [
      [/const up = db\.prepare\(`UPDATE \$\{r\.table\} SET \$\{r\.column\} = \? WHERE \$\{r\.column\} = \?`\)/,
        "db.prepare(`DELETE FROM ${r.table} WHERE ${r.column} != ?`).run(r.canonical);\n    const up = db.prepare(`UPDATE ${r.table} SET ${r.column} = ? WHERE ${r.column} = ?`)"],
    ],
  },
  {
    // Found by the verifier, not by me: row-count-neutral corruption. Every
    // count-based assertion in the fixture stayed true while every message body
    // and part body was overwritten, and the tool printed success throughout.
    name: "a silent content wipe that leaves the row counts identical",
    edits: [
      [/const up = db\.prepare\(`UPDATE \$\{r\.table\} SET \$\{r\.column\} = \? WHERE \$\{r\.column\} = \?`\)/,
        "for (const t of ['message','part']) { try { db.exec(`UPDATE ${t} SET data = '{}' WHERE 1=1`) } catch {} }\n    const up = db.prepare(`UPDATE ${r.table} SET ${r.column} = ? WHERE ${r.column} = ?`)"],
    ],
  },
  {
    name: "a content wipe that only touches the LIVE run, not the rehearsal",
    edits: [
      [/liveRun = transform\(db, offenders\);/,
        "liveRun = transform(db, offenders);\n  for (const t of ['message','part']) { try { db.exec(`UPDATE ${t} SET data = '{}' WHERE 1=1`) } catch {} }"],
    ],
  },
];

/* --- MECHANISMS: each is only meaningful paired with the bug it guards ------- */
const MECHANISMS = [
  {
    mechanism: "assertNonDestructive compares exact counts",
    weaken: [[/if \(delta !== declared\) \{[\s\S]*?\n    \}/, "if (delta > 0 && !declared) { /* truthiness */ }"]],
    bug: "an extra undeclared DELETE after the declared dedupe",
    bugEdits: BUGS[5].edits,
  },
  {
    mechanism: "the non-destruction check is present at all",
    weaken: [[/const report = assertNonDestructive\(beforeCounts, afterCounts, liveRun\.deletes, "live"\);/,
      'const report = ["live: assertion removed"];']],
    bug: "an extra undeclared DELETE after the declared dedupe",
    bugEdits: BUGS[5].edits,
  },
  {
    mechanism: "a table that cannot be counted aborts instead of being skipped",
    weaken: [[/if \(now === undefined\) \{[\s\S]*?\n    \}/, "if (now === undefined) continue;"]],
    bug: "an extra undeclared DELETE after the declared dedupe",
    bugEdits: BUGS[5].edits,
  },
  {
    mechanism: "the live run is checked against the rehearsal's delete count",
    weaken: [[/for \(const \[t, n\] of rehearsalRun\.deletes\) \{[\s\S]*?\n  \}/,
      "for (const [t, n] of []) { /* cross-check removed */ }"]],
    bug: "an extra undeclared DELETE after the declared dedupe",
    bugEdits: BUGS[5].edits,
  },
];

let failures = 0;
const say = (ok, label, extra = "") =>
  console.log(`  ${ok ? "PASS" : "FAIL"}  ${label}${extra ? "\n         " + extra : ""}`);

fs.rmSync(WORK, { recursive: true, force: true });
fs.mkdirSync(path.join(WORK, "tools"), { recursive: true });
for (const f of ["canonicalize-paths.mjs", "test-canonicalize.mjs", "fixture.mjs"]) {
  fs.copyFileSync(path.join(ROOT, "tools", f), path.join(WORK, "tools", f));
}
const PRISTINE = fs.readFileSync(TOOL, "utf8");

function fixtureExitCode() {
  try {
    execFileSync(process.execPath, ["tools/test-canonicalize.mjs"],
      { cwd: WORK, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
    return 0;
  } catch (e) { return e.status ?? 1; }
}

function applyEdits(src, edits) {
  let out = src;
  for (const [find, replace] of edits) {
    if (!find.test(out)) return null;
    out = out.replace(find, replace);
  }
  return out === src ? null : out;
}

console.log("\n  0. the pristine tool passes the fixture");
say(fixtureExitCode() === 0, "pristine tool -> fixture passes");

console.log("\n  1. BUG mutations - each must make the fixture fail on its own");
BUGS.forEach((mut, i) => {
  const mutated = applyEdits(PRISTINE, mut.edits);
  if (!mutated) { say(false, `bug ${i + 1}: ${mut.name}`, "the pattern did not apply - update the harness"); failures++; return; }
  fs.writeFileSync(TOOL, mutated);
  const code = fixtureExitCode();
  say(code !== 0, `bug ${i + 1}: ${mut.name}`,
    code === 0 ? "the fixture STILL PASSED - the fixture is blind to this" : `fixture exited ${code}`);
  if (code === 0) failures++;
});

console.log("\n  2. MECHANISM x BUG pairs - weakening a safety net must become visible");
console.log("     (a mechanism alone changes nothing observable, so only the pair can be caught)");
MECHANISMS.forEach((pair, i) => {
  let src = applyEdits(PRISTINE, pair.weaken);
  if (!src) { say(false, `pair ${i + 1}: weaken "${pair.mechanism}"`, "pattern did not apply"); failures++; return; }
  src = applyEdits(src, pair.bugEdits);
  if (!src) { say(false, `pair ${i + 1}: add bug "${pair.bug}"`, "pattern did not apply"); failures++; return; }
  fs.writeFileSync(TOOL, src);
  const code = fixtureExitCode();
  say(code !== 0, `pair ${i + 1}: "${pair.mechanism}" + "${pair.bug}"`,
    code === 0 ? "SURVIVED - that safety net is untested and could be removed silently" : `fixture exited ${code}`);
  if (code === 0) failures++;
});

fs.writeFileSync(TOOL, PRISTINE);
say(fixtureExitCode() === 0, "the repo tool is byte-identical to the pristine copy after the run");

fs.rmSync(WORK, { recursive: true, force: true });
const total = BUGS.length + MECHANISMS.length + 1;
console.log(failures
  ? `\n  ${failures} of ${total} checks failed\n`
  : `\n  all ${total} checks passed: the fixture reacts to every destructive class it claims to guard\n`);
process.exit(failures ? 1 : 0);
