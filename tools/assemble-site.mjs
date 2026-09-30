#!/usr/bin/env node
/**
 * assemble-site.mjs - build the publish set from the manifest.
 *
 *   node tools/assemble-site.mjs <out-dir>
 *
 * WHY THIS IS A FILE AND NOT A SCRIPT EMBEDDED IN THE WORKFLOW
 * ------------------------------------------------------------
 * The first version had this logic inline in pages.yml, and it failed on the
 * first real run with `ENOENT: copyfile 'assets/ailgen-admin.jpg'`. The cause was
 * one missing line: copyFileSync does not create the destination directory, and
 * nothing before it had.
 *
 * The worse half of that failure is that it could not have been caught by
 * reviewing. The inline version was only ever executed by GitHub, on a runner,
 * after a push - so the first person to learn whether it worked was the public
 * internet. A dry run that only walks and stats cannot exercise a copy, because
 * a copy is the thing that fails.
 *
 * So the assembly is a file, it is executable locally, and `publish.mjs build`
 * runs this exact file before anything is pushed. The workflow and the local
 * check now execute the same code rather than two copies of the same intent.
 */
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const out = path.resolve(root, process.argv[2] || "_site");
const manifestPath = path.join(root, "publish.manifest.json");
if (!fs.existsSync(manifestPath)) {
  console.error(`  no ${manifestPath} - run from the site repository root`);
  process.exit(2);
}
const m = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
const entries = [m.entry, ...(m.files || []), ...(m.directories || [])].filter(Boolean);

/* Second, independent check. The manifest is a decision; this is the enforcement
   of it. Both must be wrong to leak something, because the thing being protected
   - the agent's own configuration and notes - is not recoverable by deleting a
   file after a search engine has indexed the URL. */
const NEVER_PUBLIC = [
  /(^|\/)\.env(\.|$)/i, /(^|\/)node_modules\//, /(^|\/)\.git\//,
  /(^|\/)opencode\.jsonc?$/, /(^|\/)memory\//, /(^|\/)tools\//,
  /(^|\/)AGENTS\.md$/, /(^|\/)\.opencode\//, /\.(pem|key|p12|pfx)$/i,
];

let files = 0, bytes = 0;
const copied = [];

function copyInto(srcDir, destDir) {
  fs.mkdirSync(destDir, { recursive: true });            // <- the line that was missing
  for (const e of fs.readdirSync(srcDir, { withFileTypes: true })) {
    if (e.name === "node_modules" || e.name === ".git") continue;
    const a = path.join(srcDir, e.name), b = path.join(destDir, e.name);
    if (e.isDirectory()) copyInto(a, b);
    else {
      fs.mkdirSync(path.dirname(b), { recursive: true });
      fs.copyFileSync(a, b);
      files++; bytes += fs.statSync(a).size; copied.push(b);
    }
  }
}

fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });

for (const e of entries) {
  const abs = path.join(root, e);
  if (!fs.existsSync(abs)) { console.log(`  skip (missing): ${e}`); continue; }
  const dest = path.join(out, e);
  if (fs.statSync(abs).isDirectory()) { copyInto(abs, dest); console.log(`  dir   ${e}`); }
  else {
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(abs, dest);
    files++; bytes += fs.statSync(abs).size; copied.push(dest);
    console.log(`  file  ${e}`);
  }
}

const leaks = copied.filter((f) => {
  const rel = path.relative(out, f).replace(/\\/g, "/");
  return NEVER_PUBLIC.some((re) => re.test(rel));
});
if (leaks.length) {
  console.error(`\n  REFUSING: ${leaks.length} file(s) in the publish set match the blocklist:`);
  for (const l of leaks.slice(0, 10)) console.error(`    ${path.relative(out, l)}`);
  process.exit(1);
}

console.log(`\n  ${files} files, ${(bytes / 1048576).toFixed(1)} MB -> ${out}`);
console.log(`  blocklist clear\n`);
process.exit(0);
