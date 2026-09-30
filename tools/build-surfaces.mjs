#!/usr/bin/env node
/**
 * build-surfaces.mjs - build each surface as its own deployable unit.
 *
 *   node tools/build-surfaces.mjs            build all surfaces into _surfaces/
 *   node tools/build-surfaces.mjs --only edencosmetic
 *   node tools/build-surfaces.mjs --base-href    inject a <base> for path hosting
 *
 * WHY PER SURFACE, AND NOT ONE OUTPUT DIRECTORY
 * --------------------------------------------
 * 139 pages - 96 in edencosmetic, 43 in talorkaradi - carry root-absolute links
 * like /icon.svg and /products/... . The files those names point at live inside
 * each microsite's own directory, so those links resolve only when the surface
 * is the root of a hostname. Verified rather than assumed:
 *
 *   /AILGENSITE/icon.svg                 404
 *   /icon.svg                            404
 *   /AILGENSITE/edencosmetic/icon.svg    200
 *
 * A single output directory makes that permanently unfixable without editing the
 * markup, and editing the markup bakes in whatever host is current. Separate
 * output directories mean each surface can become its own host with no change to
 * the site, which is what makes the free-to-paid domain move a one-line change.
 *
 * WHAT --base-href DOES, AND WHY IT IS OPT-IN
 * -------------------------------------------
 * GitHub Pages serves this site at a PATH, not a root, so root-absolute links in
 * the two microsites cannot resolve there. A <base href> makes the browser
 * resolve them against a prefix, which is the standard remedy.
 *
 * It is opt-in because <base> changes the resolution of EVERY relative URL on the
 * page, not only the broken ones. That is a large blast radius for a cosmetic
 * fix, so it is applied only where it is measured to help and measured not to
 * break anything else. It is a bridge to the hostname, not a substitute for it.
 */
import fs from "node:fs";
import path from "node:path";

const argv = process.argv.slice(2);
const has = (f) => argv.includes(f);
const onlyIdx = argv.indexOf("--only");
const only = onlyIdx >= 0 ? argv[onlyIdx + 1] : null;
const C = { g: "\x1b[32m", y: "\x1b[33m", c: "\x1b[36m", d: "\x1b[90m", b: "\x1b[1m", r: "\x1b[31m", x: "\x1b[0x" };
const dim = (s) => `${C.d}${s}${C.x}`;

const root = process.cwd();
const cfgPath = path.join(root, "surfaces.json");
if (!fs.existsSync(cfgPath)) { console.error("  no surfaces.json - run from the site repository root"); process.exit(2); }
const cfg = JSON.parse(fs.readFileSync(cfgPath, "utf8"));
const OUT = path.join(root, "_surfaces");

/* The same blocklist the single-site build uses. A surface build must not be
   able to publish what a whole-site build would refuse. */
const NEVER_PUBLIC = [
  /(^|\/)\.env(\.|$)/i, /(^|\/)node_modules\//, /(^|\/)\.git\//,
  /(^|\/)opencode\.jsonc?$/, /(^|\/)memory\//, /(^|\/)tools\//,
  /(^|\/)AGENTS\.md$/, /(^|\/)\.opencode\//, /\.(pem|key|p12|pfx)$/i,
];

let grand = { files: 0, bytes: 0, html: 0, injected: 0 };
const report = [];

for (const s of cfg.surfaces) {
  if (only && s.name !== only) continue;
  const src = path.join(root, s.dir);
  if (!fs.existsSync(src)) { console.log(`  ${C.y}skip${C.x} ${s.name} - no ${s.dir}`); continue; }
  const out = path.join(OUT, s.name);
  fs.rmSync(out, { recursive: true, force: true });
  fs.mkdirSync(out, { recursive: true });

  const include = s.include || ["."];
  const excluded = new Set(s.exclude || []);
  let files = 0, bytes = 0, html = 0, injected = 0;
  const copied = [];

  const copyInto = (from, to) => {
    fs.mkdirSync(to, { recursive: true });
    for (const e of fs.readdirSync(from, { withFileTypes: true })) {
      if (e.name === "node_modules" || e.name === ".git" || e.name === "_surfaces") continue;
      const a = path.join(from, e.name), b = path.join(to, e.name);
      /* build inputs beside the surface (src/ fragments, build.sh) are not pages: surfaces.json "exclude" */
      if (excluded.has(path.relative(src, a).replace(/\\/g, "/"))) continue;
      if (e.isDirectory()) { copyInto(a, b); continue; }
      if (NEVER_PUBLIC.some((re) => re.test(path.relative(root, a).replace(/\\/g, "/")))) continue;
      fs.mkdirSync(path.dirname(b), { recursive: true });
      let buf = fs.readFileSync(a);
      if (has("--base-href") && /\.html$/i.test(e.name) && s.githubPagesPath && !s.hostCustom && s.dir !== ".") {
        const text = buf.toString("utf8");
        /* Only where a <base> is actually needed: the microsites, and only if
           the page has root-absolute links that cannot otherwise resolve. */
        if (/(?:href|src)\s*=\s*["']\/(?!\/)/i.test(text) && !/<base\s/i.test(text)) {
          const baseHref = `/${s.githubPagesPath}/${s.dir}/`;
          const tag = `<base href="${baseHref}">`;
          const patched = /<head[^>]*>/i.test(text)
            ? text.replace(/<head[^>]*>/i, (m) => `${m}\n    ${tag} <!-- injected by build-surfaces: this surface is hosted at a path, and its root-absolute links must still resolve. Remove once the surface has its own hostname. -->`)
            : `${tag}\n${text}`;
          buf = Buffer.from(patched, "utf8");
          injected++;
        }
      }
      fs.writeFileSync(b, buf);
      files++; bytes += buf.length; copied.push(b);
      if (/\.html$/i.test(e.name)) html++;
    }
  };

  for (const item of include) {
    const abs = item === "." ? src : path.join(src, item);
    if (!fs.existsSync(abs)) continue;
    if (fs.statSync(abs).isDirectory()) copyInto(abs, path.join(out, item));
    else {
      fs.mkdirSync(path.dirname(path.join(out, item)), { recursive: true });
      fs.writeFileSync(path.join(out, item), fs.readFileSync(abs));
      files++; bytes += fs.statSync(abs).size; copied.push(path.join(out, item));
      if (/\.html$/i.test(item)) html++;
    }
  }

  const host = cfg.mode === "custom" ? (s.hostCustom || s.hostFree) : s.hostFree;
  report.push({ name: s.name, files, bytes, html, injected, host, path: path.relative(root, out) });
  grand.files += files; grand.bytes += bytes; grand.html += html; grand.injected += injected;
}

console.log(`\n${C.b}surfaces${C.x} ${dim(`- mode: ${cfg.mode}`)}\n`);
for (const r of report) {
  console.log(`  ${C.c}${r.name.padEnd(16)}${C.x} ${String(r.files).padStart(5)} files  ${(r.bytes / 1048576).toFixed(1).padStart(7)} MB  ${String(r.html).padStart(3)} pages`);
  console.log(dim(`  ${" ".repeat(16)}   host  ${r.host}`));
  console.log(dim(`  ${" ".repeat(16)}   out   ${r.path}${r.injected ? `   (base href injected into ${r.injected} pages)` : ""}`));
}
console.log(`\n  ${C.b}${grand.files} files, ${(grand.bytes / 1048576).toFixed(1)} MB, ${grand.html} pages across ${report.length} surfaces${C.x}\n`);

if (only === undefined) {
  const summary = { mode: cfg.mode, builtAt: new Date().toISOString(), surfaces: report };
  fs.writeFileSync(path.join(OUT, "build.json"), JSON.stringify(summary, null, 2));
  console.log(dim(`  _surfaces/build.json written - the record of what shipped and where\n`));
}
process.exit(0);
