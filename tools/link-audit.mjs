#!/usr/bin/env node
/**
 * link-audit.mjs - every link on every page, checked the way the host will serve it.
 *
 *   node tools/build-surfaces.mjs && node tools/link-audit.mjs            audit _surfaces/*
 *   node tools/link-audit.mjs --json _surfaces/link-audit.json            also write the findings
 *
 * Each surface in _surfaces/ is served at the ROOT of its own local server, with the host's rules
 * (_redirects, _headers, 404.html; the studio's seo-serve.mjs behaves like Cloudflare Pages). Every
 * href, src, srcset, poster and CSS url() in every HTML page is resolved against the page's own URL and
 * requested. A link to another surface's host (surfaces.json: hostFree / hostCustom) is requested from
 * that surface's local server, so cross-surface links are checked too. Links to other sites are counted,
 * not fetched. A 301 that lands on a 200 is fine; a 404, a redirect chain longer than one, or a loop is not.
 * Exit 1 on any broken link: the publish switch refuses to go live with one.
 */
import fs from "node:fs";
import path from "node:path";
import { startServer } from "../.claude/skills/ailgen-studio/scripts/seo-serve.mjs";

const argv = process.argv.slice(2);
const jsonAt = argv.indexOf("--json") >= 0 ? argv[argv.indexOf("--json") + 1] : null;
const root = process.cwd();
const cfg = JSON.parse(fs.readFileSync(path.join(root, "surfaces.json"), "utf8"));
const OUT = path.join(root, "_surfaces");
const surfaces = cfg.surfaces.filter(s => fs.existsSync(path.join(OUT, s.name)));
if (!surfaces.length) { console.error("  no _surfaces/ - run node tools/build-surfaces.mjs first"); process.exit(2); }

// one local server per surface, each at its own root
const servers = {};
for (const s of surfaces) servers[s.name] = await startServer({ dir: path.join(OUT, s.name) });
const hostOf = {};   // hostname -> surface name
for (const s of surfaces) for (const h of [s.hostFree, s.hostCustom]) if (h) hostOf[h] = s.name;

const walk = d => fs.readdirSync(d, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]);
const attrs = /\b(?:href|src|poster|data-src)\s*=\s*["']([^"']+)["']|\bsrcset\s*=\s*["']([^"']+)["']|url\(\s*["']?([^"')]+)["']?\s*\)/gi;
const cache = new Map();
async function check(surface, pathname) {
  const key = surface + " " + pathname;
  if (cache.has(key)) return cache.get(key);
  const p = (async () => {
    let url = servers[surface].url + pathname, hops = 0;
    for (;;) {
      const r = await fetch(url, { redirect: "manual" }).catch(e => ({ status: 0, error: e.message }));
      if (r.status >= 300 && r.status < 400 && r.headers.get("location")) {
        if (++hops > 1) return { ok: false, status: r.status, why: "redirect chain" };
        const loc = new URL(r.headers.get("location"), url);
        if (loc.origin !== new URL(url).origin) return { ok: true, status: r.status, why: "redirects off-site" };
        url = loc.href; continue;
      }
      return { ok: r.status === 200, status: r.status, hops };
    }
  })();
  cache.set(key, p); return p;
}

const broken = [], external = new Map(); let pages = 0, links = 0;
for (const s of surfaces) {
  const dir = path.join(OUT, s.name);
  for (const f of walk(dir).filter(f => /\.html$/i.test(f))) {
    pages++;
    const rel = path.relative(dir, f).replace(/\\/g, "/");
    const pageUrl = "https://" + (s.hostCustom || s.hostFree) + "/" + rel.replace(/(^|\/)index\.html$/, "$1");
    const html = fs.readFileSync(f, "utf8").replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "");   // script code builds its own links at run time
    const base = (html.match(/<base\s+href\s*=\s*["']([^"']+)["']/i) || [])[1];
    const found = new Set();
    for (const m of html.matchAll(attrs)) {
      const vals = m[2] ? m[2].split(",").map(x => x.trim().split(/\s+/)[0]) : [m[1] || m[3]];
      vals.forEach(v => v && found.add(v.trim()));
    }
    for (const v of found) {
      if (/^(#|mailto:|tel:|javascript:|data:|about:|sms:|whatsapp:)/i.test(v) || v.includes("${") || v.includes("'+")) continue;
      let u; try { u = new URL(v, base ? new URL(base, pageUrl) : pageUrl); } catch { continue; }
      if (!/^https?:$/.test(u.protocol)) continue;
      const target = hostOf[u.hostname];
      if (!target) { external.set(u.hostname, (external.get(u.hostname) || 0) + 1); continue; }
      links++;
      const r = await check(target, u.pathname + u.search);
      if (!r.ok) broken.push({ surface: s.name, page: rel, link: v, resolved: target + " " + decodeURI(u.pathname), status: r.status, why: r.why || "" });
    }
  }
}
for (const s of Object.values(servers)) s.close?.();

const bySurface = {};
broken.forEach(b => (bySurface[b.surface] = bySurface[b.surface] || []).push(b));
console.log(`\n  link audit · ${surfaces.length} surfaces · ${pages} pages · ${links} internal links checked · ${[...external.values()].reduce((a, b) => a + b, 0)} links to other sites (not fetched)`);
for (const s of surfaces) {
  const b = bySurface[s.name] || [];
  console.log(`  ${b.length ? "✗" : "✓"} ${s.name.padEnd(14)} ${b.length} broken`);
  const seen = new Set();
  b.filter(x => !seen.has(x.resolved) && seen.add(x.resolved)).slice(0, 12).forEach(x => console.log(`      ${x.status} ${x.resolved}   (${x.page}: ${x.link}${x.why ? ", " + x.why : ""})`));
}
if (jsonAt) fs.writeFileSync(path.resolve(root, jsonAt), JSON.stringify({ at: new Date().toISOString(), pages, links, broken, external: Object.fromEntries(external) }, null, 1));
process.exit(broken.length ? 1 : 0);
