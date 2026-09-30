#!/usr/bin/env node
/**
 * site-switch.mjs - the publish switch: the site is public, or it is closed. One state, every host.
 *
 *   npm run site:status      what the switch says, and what each address actually answers
 *   npm run site:on          publish (every surface on its own address, every link checked first)
 *   npm run site:off         close (every address shows a closed page; nothing of the site stays public)
 *
 * WHERE THE BUTTON IS
 * -------------------
 * The switch is the "pages" workflow. Three ways to press it, all the same button:
 *   - GitHub: Actions -> pages -> Run workflow -> on / off (also in the GitHub phone app). Only people with
 *     write access to the repository see it; nothing about it is on the site.
 *   - This computer: npm run site:on / site:off. With the GitHub CLI (gh) signed in, it presses the same
 *     workflow button; without it, it records the new state in site.state.json and pushes, and the push
 *     runs the same workflow.
 *   - A Claude session with access to the repository: "turn the site on / off" runs the same workflow.
 *
 * WHAT ON AND OFF MEAN
 * --------------------
 * site.state.json holds the state, so a later push never undoes a press: while it says off, every
 * deploy ships the closed page. On: each surface (surfaces.json) goes to its own Cloudflare Pages project
 * at the root of its own address (ailgen.pages.dev, ailgen-edencosmetic.pages.dev, ...), where every
 * root-absolute link resolves; tools/link-audit.mjs must pass first, or nothing ships. The GitHub Pages
 * copy becomes a forward to those addresses. Without Cloudflare secrets yet, GitHub Pages keeps the whole
 * site, as before. Off: every Cloudflare project answers 503 (temporarily unavailable, try again later,
 * never indexed) with a short closed page, and GitHub Pages shows the same page with noindex. The
 * projects and their names stay yours, so on brings back the same addresses.
 *
 * Commands used by the workflow: ci (decide the state), gh-pages <dir> (the GitHub Pages payload),
 * cloudflare (deploy every surface), closed <dir> [surface] (a closed payload, for a local look).
 */
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const root = process.cwd();
const [cmd = "status", ...rest] = process.argv.slice(2);
const STATE = path.join(root, "site.state.json");
const cfg = JSON.parse(fs.readFileSync(path.join(root, "surfaces.json"), "utf8"));
const win = process.platform === "win32";
const run = (bin, args, opt = {}) => spawnSync(bin, args, { encoding: "utf8", shell: win, ...opt });
const readState = () => { try { return JSON.parse(fs.readFileSync(STATE, "utf8")); } catch { return { state: "on" }; } };
const writeState = (state, by) => fs.writeFileSync(STATE, JSON.stringify({
  $comment: "The publish switch (tools/site-switch.mjs). on: the site is public on its addresses. off: every address shows a closed page. Change it with the switch, not by hand.",
  state, changedAt: new Date().toISOString(), by }, null, 2) + "\n");
const hostOf = s => (cfg.mode === "custom" && s.hostCustom) || s.hostFree;
const project = s => (cfg.cloudflare?.projects || {})[s.name] || s.name;
const repo = () => {
  const u = (run("git", ["remote", "get-url", "origin"]).stdout || "").trim();
  const m = u.match(/github\.com[/:]([^/]+)\/([^/.]+)(\.git)?$/i) || u.match(/\/git\/([^/]+)\/([^/.]+)/);
  return m ? { owner: m[1], name: m[2] } : { owner: "shaybatash007", name: "AILGENSITE" };
};
const ghPagesBase = () => { const r = repo(); return `https://${r.owner.toLowerCase()}.github.io/${r.name}/`; };
const branch = () => (run("git", ["rev-parse", "--abbrev-ref", "HEAD"]).stdout || "").trim() || "main";
const labelOf = s => s.label || s.name;

// the closed page: nothing of the site, nothing indexed, the same address when it opens again
const closedHtml = label => `<!doctype html>
<html lang="he" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow"><title>${label} · האתר אינו זמין כרגע</title>
<style>:root{color-scheme:light dark}body{margin:0;min-height:100svh;display:grid;place-items:center;background:#F8F4F0;color:#1E1A18;font:400 1.0625rem/1.6 system-ui,"Segoe UI",Arial,sans-serif}
@media (prefers-color-scheme:dark){body{background:#151211;color:#F3ECE6}}main{padding:24px;text-align:center}.m{letter-spacing:.2em;font-size:.8125rem;opacity:.6;margin:0 0 14px}
h1{font-size:clamp(1.6rem,4vw,2.3rem);font-weight:700;margin:0 0 8px}p{margin:0;opacity:.8}</style></head>
<body><main><p class="m">${label}</p><h1>האתר אינו זמין כרגע</h1><p>נחזור בקרוב.</p></main></body></html>
`;
// Cloudflare runs _worker.js for every request: 503 + Retry-After tells browsers and search engines the closure is temporary
const closedWorker = label => `export default { async fetch(req) {
  if (new URL(req.url).pathname === "/robots.txt") return new Response("User-agent: *\\nDisallow: /\\n", { headers: { "content-type": "text/plain" } });
  return new Response(${JSON.stringify(closedHtml(label))}, { status: 503, headers: { "content-type": "text/html; charset=utf-8", "retry-after": "86400", "x-robots-tag": "noindex", "cache-control": "no-store" } });
} };
`;
function closed(dir, label, worker) {
  fs.rmSync(dir, { recursive: true, force: true }); fs.mkdirSync(dir, { recursive: true });
  const html = closedHtml(label);
  fs.writeFileSync(path.join(dir, "index.html"), html);
  fs.writeFileSync(path.join(dir, "404.html"), html);
  fs.writeFileSync(path.join(dir, "robots.txt"), "User-agent: *\nDisallow: /\n");
  if (worker) fs.writeFileSync(path.join(dir, "_worker.js"), closedWorker(label));
}
// the GitHub Pages copy once the surfaces have their own addresses: every old path forwards to its new home
function moved(dir) {
  const map = cfg.surfaces.map(s => ({ prefix: "/" + (s.githubPagesPath || "").replace(/^\/|\/$/g, ""), host: hostOf(s) }))
    .sort((a, b) => b.prefix.length - a.prefix.length);
  const main = hostOf(cfg.surfaces.find(s => s.dir === ".") || cfg.surfaces[0]);
  const html = `<!doctype html>
<html lang="he" dir="rtl"><head><meta charset="utf-8"><meta name="robots" content="noindex">
<title>האתר עבר לכתובת חדשה</title><link rel="canonical" href="https://${main}/">
<meta http-equiv="refresh" content="3;url=https://${main}/">
<script>(function(){var m=${JSON.stringify(map)},p=location.pathname;for(var i=0;i<m.length;i++){var x=m[i].prefix;if(p===x||p.indexOf(x+"/")===0){location.replace("https://"+m[i].host+(p.slice(x.length)||"/")+location.search+location.hash);return;}}location.replace("https://${main}/");})();</script>
</head><body style="font:1rem system-ui;text-align:center;padding:40px">האתר עבר ל-<a href="https://${main}/">${main}</a></body></html>
`;
  fs.rmSync(dir, { recursive: true, force: true }); fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "index.html"), html); fs.writeFileSync(path.join(dir, "404.html"), html);
}
const hasCloudflare = () => !!(process.env.CLOUDFLARE_API_TOKEN && process.env.CLOUDFLARE_ACCOUNT_ID);
const out = (k, v) => { if (process.env.GITHUB_OUTPUT) fs.appendFileSync(process.env.GITHUB_OUTPUT, `${k}=${v}\n`); console.log(`  ${k}: ${v}`); };

if (cmd === "ci") {
  // the workflow: a pressed button (ACTION on/off) changes the recorded state; a push or a redeploy follows it
  const cur = readState().state === "off" ? "off" : "on", act = (process.env.ACTION || "").trim();
  const state = act === "on" || act === "off" ? act : cur;
  if (state !== cur) writeState(state, process.env.ACTOR || "workflow");
  out("state", state); out("changed", String(state !== cur)); out("cloudflare", String(hasCloudflare()));
  process.exit(0);
}
if (cmd === "gh-pages") {
  const dir = path.resolve(root, rest[0] || "_site"), state = readState().state;
  if (state === "off") { closed(dir, labelOf(cfg.surfaces[0]), false); console.log("  GitHub Pages: the closed page"); }
  else if (hasCloudflare()) { moved(dir); console.log("  GitHub Pages: forwards every path to its surface's own address"); }
  else { const r = run("node", ["tools/assemble-site.mjs", dir], { stdio: "inherit" }); if (r.status) process.exit(r.status); console.log("  GitHub Pages: the whole site (no Cloudflare secrets yet)"); }
  process.exit(0);
}
if (cmd === "cloudflare") {
  if (!hasCloudflare()) { console.log("  no CLOUDFLARE_API_TOKEN / CLOUDFLARE_ACCOUNT_ID: Cloudflare Pages skipped"); process.exit(0); }
  const state = readState().state; let failed = 0;
  for (const s of cfg.surfaces) {
    const name = project(s), dir = state === "off" ? path.join(root, "_closed", s.name) : path.join(root, "_surfaces", s.name);
    if (state === "off") closed(dir, labelOf(s), true);
    if (!fs.existsSync(dir)) { console.error(`  missing ${dir}: build the surfaces first`); failed++; continue; }
    // the project is created once; afterwards the create answers "already exists", which is fine
    run("npx", ["--yes", "wrangler@4", "pages", "project", "create", name, "--production-branch=main"], { stdio: "inherit" });
    const r = run("npx", ["--yes", "wrangler@4", "pages", "deploy", dir, `--project-name=${name}`, "--branch=main", "--commit-dirty=true"], { stdio: "inherit" });
    console.log(`  ${r.status ? "✗" : "✓"} ${s.name} → https://${hostOf(s)}/ (${state})`); if (r.status) failed++;
  }
  process.exit(failed ? 1 : 0);
}
if (cmd === "closed") {
  const s = cfg.surfaces.find(x => x.name === rest[1]) || cfg.surfaces[0];
  closed(path.resolve(root, rest[0] || "_closed"), labelOf(s), true); console.log("  closed page written"); process.exit(0);
}
if (cmd === "on" || cmd === "off") {
  const r = repo(), ref = branch(), actions = `https://github.com/${r.owner}/${r.name}/actions/workflows/pages.yml`;
  const gh = run("gh", ["auth", "status"]);
  if (!gh.error && gh.status === 0) {
    const w = run("gh", ["workflow", "run", "pages.yml", "--ref", ref, "-f", `action=${cmd}`], { stdio: "inherit" });
    if (!w.status) { console.log(`\n  the switch is pressed: ${cmd}. It runs here: ${actions}\n`); process.exit(0); }
  }
  // no GitHub CLI: record the state and push; the push runs the same workflow, which follows the recorded state
  if (readState().state === cmd) console.log(`  the switch already says ${cmd}; pushing runs the workflow again`);
  writeState(cmd, (run("git", ["config", "user.name"]).stdout || "local").trim());
  for (const a of [["add", "site.state.json"], ["commit", "-m", `site: ${cmd} (the switch)`, "--allow-empty"], ["push", "origin", `HEAD:${ref}`]]) {
    const g = run("git", a, { stdio: "inherit" }); if (g.status) { console.error(`  git ${a[0]} failed: nothing was switched on the hosts`); process.exit(1); }
  }
  console.log(`\n  the switch is pressed: ${cmd}. It runs here: ${actions}\n`); process.exit(0);
}
if (cmd === "status") {
  const st = readState();
  console.log(`\n  the switch says: ${st.state}${st.changedAt ? `   (since ${st.changedAt}${st.by ? `, ${st.by}` : ""})` : ""}\n`);
  const probe = async u => { try { const r = await fetch(u, { method: "GET", redirect: "manual", signal: AbortSignal.timeout(12000) }); return r.status; } catch { return "no answer"; } };
  for (const s of cfg.surfaces) console.log(`  ${s.name.padEnd(14)} https://${hostOf(s)}/   ${await probe(`https://${hostOf(s)}/`)}`);
  console.log(`  ${"github pages".padEnd(14)} ${ghPagesBase()}   ${await probe(ghPagesBase())}`);
  console.log(`\n  200 = public · 503 = closed by the switch · "no answer" = not created yet (Cloudflare account and secrets)\n`);
  process.exit(0);
}
console.error("usage: node tools/site-switch.mjs status | on | off"); process.exit(2);
