#!/usr/bin/env node
/**
 * inspect.mjs - component-level inspection of a rendered page.
 *
 * A full-page screenshot tells you something is wrong somewhere. This names the
 * place: it enumerates the page's top-level components, and for each one reports
 * what it is, how big it is, whether it is on screen, and which of the audit
 * rules it violates. Then any single component can be captured and audited in
 * isolation, so a review of "the projects section" is one cheap pass rather than
 * a full page audit followed by hunting.
 *
 * Everything runs against a real browser through the same rules the audit uses,
 * so a component cannot pass here and fail there.
 *
 * USAGE
 *   node tools/inspect.mjs --url http://127.0.0.1:8000/ --list
 *   node tools/inspect.mjs --url http://127.0.0.1:8000/ --component "#work"
 *   node tools/inspect.mjs --url http://127.0.0.1:8000/ --report
 */

import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";

const OUT = path.resolve("projects/_eyes/out");

const argv = process.argv.slice(2);
const flag = (n, d) => { const i = argv.indexOf(n); return i >= 0 && argv[i + 1] ? argv[i + 1] : d; };
const has = (n) => argv.includes(n);

const C = { g: "\x1b[32m", r: "\x1b[31m", y: "\x1b[33m", c: "\x1b[36m", d: "\x1b[90m", b: "\x1b[1m", x: "\x1b[0m" };
const ok = (m) => console.log(`  ${C.g}OK${C.x}  ${m}`);
const bad = (m) => console.log(`  ${C.r}!!${C.x}  ${m}`);
const warn = (m) => console.log(`  ${C.y}--${C.x}  ${m}`);
const info = (m) => console.log(`  ${C.d}${m}${C.x}`);

const URL = flag("--url", "http://127.0.0.1:8000/");

/* Enumerate in the page. Landmarks and sectioning elements are the right unit
   here: they are what a person means by "part of the page", unlike a div soup
   that only exists to carry a class. */
function enumerate() {
  const HEB = /[\u0590-\u05FF\uFB1D-\uFB4F]/;
  const vis = (el) => {
    const cs = getComputedStyle(el);
    if (cs.display === "none" || cs.visibility === "hidden" || parseFloat(cs.opacity) === 0) return false;
    const r = el.getBoundingClientRect();
    return r.width > 1 && r.height > 1;
  };
  const label = (el) =>
    (el.getAttribute("aria-label") || el.getAttribute("data-c") || el.id ||
      (el.className && typeof el.className === "string" ? "." + el.className.trim().split(/\s+/)[0] : "") ||
      el.tagName.toLowerCase());

  const out = [];
  document.querySelectorAll("header,main,section,footer,nav,aside,article,form,[role=region]").forEach((el, i) => {
    if (!vis(el)) return;
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    const links = el.querySelectorAll("a").length;
    const buttons = el.querySelectorAll("button").length;
    const images = el.querySelectorAll("img").length;
    const headings = [...el.querySelectorAll("h1,h2,h3,h4,h5,h6")]
      .filter(vis).map((h) => +h.tagName[1]);
    const text = (el.innerText || "").replace(/\s+/g, " ").trim();
    let issues = [];
    if (!headings.length) issues.push("no heading inside");
    else if (headings[0] > 2) issues.push(`first heading is h${headings[0]}`);
    if (el.scrollWidth > el.clientWidth + 2 && cs.overflowX === "hidden")
      issues.push("clips its own content horizontally");
    const tiny = [...el.querySelectorAll("a,button")].filter((b) => {
      if (!vis(b)) return false;
      const br = b.getBoundingClientRect();
      return br.width < 44 || br.height < 44;
    }).length;
    if (tiny) issues.push(`${tiny} control(s) under 44px`);
    const broken = [...el.querySelectorAll("img")].filter((im) => vis(im) && im.complete && im.naturalWidth === 0).length;
    if (broken) issues.push(`${broken} broken image(s)`);
    if (text.length < 12 && !images) issues.push("no text content");

    out.push({
      i,
      sel: el.tagName.toLowerCase() + (el.id ? "#" + el.id : "") +
        (typeof el.className === "string" && el.className.trim() ? "." + el.className.trim().split(/\s+/)[0] : ""),
      label: String(label(el)).slice(0, 60),
      box: { w: Math.round(r.width), h: Math.round(r.height) },
      docY: Math.round(r.top + window.scrollY),
      counts: { links, buttons, images, headings: headings.length },
      rtl: cs.direction,
      text: text.slice(0, 90),
      issues,
    });
  });
  return out;
}

function auditScope() {
  // The same RTL and image rules the page audit uses, applied to one subtree.
  const HEB = /[\u0590-\u05FF]/;
  const UNI = (s) => /[\u2066-\u2069]/.test(s);
  const insideIsolate = (el) => {
    let cur = el.parentElement;
    while (cur && cur.nodeType === 1) {
      const c = getComputedStyle(cur);
      if (["isolate", "isolate-override", "plaintext"].includes(c.unicodeBidi)) return true;
      cur = cur.parentElement;
    }
    return false;
  };
  const root = arguments[0];
  const findings = [];
  const own = (el) => Array.from(el.childNodes).filter((n) => n.nodeType === 3).map((n) => n.nodeValue).join("").trim();
  root.querySelectorAll("*").forEach((el) => {
    const cs = getComputedStyle(el);
    if (cs.display === "none" || cs.visibility === "hidden") return;
    const r = el.getBoundingClientRect();
    if (r.width < 1 || r.height < 1) return;
    const t = own(el);
    if (HEB.test(t) && cs.direction === "ltr" && !insideIsolate(el) && !UNI(t))
      findings.push({ severity: "FAIL", rule: "rtl/hebrew-in-ltr-box", text: t.slice(0, 50) });
    if (HEB.test(t) && /[A-Za-z]{2,}/.test(t) && !UNI(t) && cs.unicodeBidi === "normal" && cs.display.includes("flex"))
      findings.push({ severity: "INFO", rule: "rtl/mixed-content-flex", text: t.slice(0, 50) });
    if (el.tagName === "IMG" && el.complete && el.naturalWidth === 0)
      findings.push({ severity: "FAIL", rule: "media/failed-to-load", text: (el.currentSrc || "").slice(-60) });
  });
  return findings;
}

async function main() {
  if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });
  const slug = URL.replace(/^https?:\/\//, "").replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").slice(0, 50);
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: "he-IL" });
  await ctx.addInitScript(() => {
    window.__cls = 0;
    try { new PerformanceObserver((l) => { for (const e of l.getEntries()) if (!e.hadRecentInput) window.__cls += e.value; })
      .observe({ type: "layout-shift", buffered: true }); } catch {}
  });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e.message).slice(0, 160)));
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text().slice(0, 160)); });

  await page.goto(URL, { waitUntil: "load", timeout: 45000 });
  await page.waitForTimeout(7000);   // the intro is timed; judging it early is wrong
  try { await page.evaluate(() => document.fonts?.ready); } catch {}

  const components = await page.evaluate(enumerate);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(400);

  console.log(`\n  ${C.b}components${C.x}  ${C.d}${URL}${C.x}`);
  console.log(`  ${"idx".padEnd(4)}${"selector".padEnd(26)}${"size".padEnd(14)}${"y".padEnd(8)}${"dir".padEnd(6)}issues`);

  let flagged = 0;
  for (const c of components) {
    const size = `${c.box.w}x${c.box.h}`;
    const issues = c.issues.length ? c.issues.join("; ") : "";
    if (c.issues.length) flagged++;
    const colour = c.issues.some((i) => i.startsWith("broken") || i.startsWith("clips")) ? C.r : c.issues.length ? C.y : C.g;
    console.log(`  ${String(c.i).padEnd(4)}${c.sel.slice(0, 25).padEnd(26)}${size.padEnd(14)}${String(c.docY).padEnd(8)}${c.rtl.padEnd(6)}${colour}${issues}${C.x}`);
  }
  console.log(`\n  ${components.length} component(s), ${flagged} with findings`);

  if (errors.length) {
    warn(`${errors.length} runtime error(s) on this page:`);
    errors.slice(0, 5).forEach((e) => console.log(`      ${e}`));
  }

  // Drill into one component.
  const sel = flag("--component", null);
  if (sel) {
    const el = await page.$(sel);
    if (!el) { bad(`no element matches "${sel}"`); await browser.close(); return 1; }
    const file = path.join(OUT, `component-${slug}-${sel.replace(/[^a-z0-9]+/gi, "_").slice(0, 30)}.png`);
    await el.scrollIntoViewIfNeeded();
    await page.waitForTimeout(600);
    await el.screenshot({ path: file });
    ok(`captured ${sel} -> ${path.relative(process.cwd(), file)}`);

    const findings = await page.evaluate(auditScope, el);
    const fails = findings.filter((f) => f.severity === "FAIL");
    const infos = findings.filter((f) => f.severity === "INFO");
    console.log(`\n  ${C.b}within ${sel}${C.x}`);
    if (!findings.length) ok("no rule findings in this component");
    for (const f of [...fails, ...infos]) {
      const tag = f.severity === "FAIL" ? C.r + "FAIL" : C.d + "INFO";
      console.log(`  ${tag}${C.x} [${f.rule}] ${f.text}`);
    }
    if (fails.length) bad(`${fails.length} failure(s) in this component`);
  }

  if (has("--report")) {
    const rf = path.join(OUT, `components-${slug}.json`);
    fs.writeFileSync(rf, JSON.stringify({ url: URL, at: new Date().toISOString(), components, errors }, null, 2));
    ok(`report -> ${path.relative(process.cwd(), rf)}`);
  }

  await browser.close();
  return 0;
}

process.exit(await main());
