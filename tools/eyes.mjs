#!/usr/bin/env node
/**
 * eyes.mjs - the AILGEN "eyes" tool.
 *
 * A model with a screenshot can see what is present. That is not enough:
 * the expensive defects are the ones that are ABSENT (a clipped element, an
 * overflowing column, an image that never loaded, a contrast failure, Hebrew
 * text laid out LTR). This tool gives three layers in one pass:
 *
 *   1. PIXELS  - real Chromium screenshots (what the human sees)
 *   2. STATE   - computed styles, geometry, layout shifts, console/network
 *   3. RULES   - deterministic audits (overflow, RTL, a11y, contrast, diff)
 *
 * Every finding has a severity: FAIL gates, WARN informs, INFO records.
 * Exits non-zero on FAIL so it can guard a commit like scripts/doctor.ps1.
 *
 * Usage:
 *   node tools/eyes.mjs --url http://127.0.0.1:8000/ [--responsive]
 *   node tools/eyes.mjs --url <u> --baseline          # pixel-diff vs last run
 *   node tools/eyes.mjs --url <u> --update-baseline   # accept current as truth
 *   node tools/eyes.mjs --url <u> --viewport mobile   # one size
 */

import { fileURLToPath } from 'url';
import { chromium } from "playwright";
import { PNG } from "pngjs";
import pixelmatch from "pixelmatch";
import fs from "node:fs";
import path from "node:path";

const VIEWPORTS = {
  mobile: { width: 390, height: 844, dsf: 2, label: "iPhone-ish 390x844" },
  tablet: { width: 820, height: 1180, dsf: 2, label: "tablet 820x1180" },
  desktop: { width: 1440, height: 900, dsf: 1, label: "desktop 1440x900" },
  wide: { width: 1920, height: 1080, dsf: 1, label: "wide 1920x1080" },
};

const OUT_ROOT = path.resolve("projects/_eyes/out");
const BASELINE_ROOT = path.resolve("projects/_eyes/baseline");
const IGNORE_FILE = path.resolve("projects/_eyes/ignore.json");

/* Intentional design is not a defect. A ghosted watermark headline, a
   deliberately dimmed label, a known-dark footer - these are choices, and a
   tool that cannot be told "this one is on purpose" will get muted and then
   ignored entirely. ignore.json downgrades or drops findings by rule, with a
   reason that has to be written down. */
function loadIgnores() {
  if (!fs.existsSync(IGNORE_FILE)) return [];
  try {
    const raw = JSON.parse(fs.readFileSync(IGNORE_FILE, "utf8"));
    return Array.isArray(raw) ? raw : raw.ignore ?? [];
  } catch (e) {
    console.error(`WARN ignore/unreadable: ${IGNORE_FILE} (${e.message})`);
    return [];
  }
}

function matchesIgnore(f, ig) {
  if (ig.rule && ig.rule !== f.rule) return false;
  if (ig.message && !f.message.includes(ig.message)) return false;
  if (ig.max && f.rule.startsWith("color/") && (f.detail?.ratio ?? 99) <= ig.max) return false;
  return true;
}

function applyIgnores(findings, ignores) {
  if (!ignores.length) return findings;
  const out = [];
  for (const f of findings) {
    // A finding may bundle many offenders. Filter inside the bundle first, so
    // one intentional ghost headline does not excuse a genuinely bad one.
    if (Array.isArray(f.detail) && f.detail.length) {
      const kept = f.detail.filter((d) => !ignores.some((ig) => {
        if (ig.rule && ig.rule !== f.rule) return false;
        const hay = `${d.el || ""} ${d.text || ""}`;
        return ig.selector ? hay.includes(ig.selector) : true;
      }));
      if (kept.length === 0) continue;
      if (kept.length < f.detail.length) {
        out.push({ ...f, detail: kept, message: `${kept.length} of ${f.detail.length} offender(s) after ignoring intentional cases` });
        continue;
      }
    }
    if (!ignores.some((ig) => matchesIgnore(f, ig))) out.push(f);
  }
  return out;
}

/* ------------------------------------------------------------------ args */
function parseArgs(argv) {
  const a = {
    url: null,
    viewport: "desktop",
    responsive: false,
    fullPage: true,
    baseline: false,
    updateBaseline: false,
    waitUntil: "load",
    settle: 900,
    timeout: 45000,
    selector: null,
    clip: null,
    segments: 0,
    maxFullPage: 4000,
    still: false,
    json: false,
    quiet: false,
  };
  for (let i = 2; i < argv.length; i++) {
    const k = argv[i];
    const next = () => argv[++i];
    if (k === "--url") a.url = next();
    else if (k === "--viewport") a.viewport = next();
    else if (k === "--responsive") a.responsive = true;
    else if (k === "--no-fullpage") a.fullPage = false;
    else if (k === "--baseline") a.baseline = true;
    else if (k === "--update-baseline") { a.baseline = true; a.updateBaseline = true; }
    else if (k === "--wait-until") a.waitUntil = next();
    else if (k === "--settle") a.settle = Number(next());
    else if (k === "--timeout") a.timeout = Number(next());
    else if (k === "--selector") a.selector = next();
    else if (k === "--segments") a.segments = Number(next());
    else if (k === "--max-fullpage") a.maxFullPage = Number(next());
    else if (k === "--still") a.still = true;
    else if (k === "--json") a.json = true;
    else if (k === "--quiet") a.quiet = true;
    else if (k === "--help" || k === "-h") a.help = true;
  }
  return a;
}

/* ------------------------------------------------------- in-page audit */
/* Runs inside the browser. Must be fully self-contained: no outer scope. */
function pageAudit() {
  const findings = [];
  const add = (severity, rule, message, detail) =>
    findings.push({ severity, rule, message, detail: detail ?? null });

  const HEBREW = /[\u0590-\u05FF\uFB1D-\uFB4F]/;
  const isVisible = (el) => {
    const cs = getComputedStyle(el);
    if (cs.display === "none" || cs.visibility === "hidden" || parseFloat(cs.opacity) === 0) return false;
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  };

  /* -- colour maths ------------------------------------------------- */
  const parseColor = (str) => {
    if (!str) return null;
    const m = str.match(/rgba?\(([^)]+)\)/);
    if (!m) return null;
    const p = m[1].split(",").map((x) => parseFloat(x));
    return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 };
  };
  const over = (fg, bg) => ({
    r: fg.r * fg.a + bg.r * (1 - fg.a),
    g: fg.g * fg.a + bg.g * (1 - fg.a),
    b: fg.b * fg.a + bg.b * (1 - fg.a),
    a: 1,
  });
  const lum = (c) => {
    const f = (v) => {
      v /= 255;
      return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    };
    return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b);
  };
  const ratio = (a, b) => {
    const l1 = lum(a), l2 = lum(b);
    return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
  };
  /* Composite every translucent background layer from the element outwards,
     stopping at the first fully opaque ancestor. Compositing order matters:
     layers collected nearest-first must be applied farthest-first, and the
     opaque ancestor is the backdrop - not white. Getting this wrong invents a
     light background under dark text and reports a phantom contrast failure. */
  const effBg = (el) => {
    const layers = [];
    let cur = el;
    let base = null;
    while (cur && cur.nodeType === 1) {
      const c = parseColor(getComputedStyle(cur).backgroundColor);
      if (c && c.a > 0) {
        if (base === null && c.a >= 0.999) { base = { r: c.r, g: c.g, b: c.b, a: 1 }; break; }
        layers.push(c);
      }
      cur = cur.parentElement;
    }
    if (base === null) base = { r: 255, g: 255, b: 255, a: 1 };
    let out = base;
    for (let i = layers.length - 1; i >= 0; i--) out = over(layers[i], out);
    return out;
  };

  const sel = (el) => {
    if (!el) return "?";
    if (el.id) return "#" + el.id;
    const t = (el.tagName || "").toLowerCase();
    if (t === "body" || t === "html") return t;
    const cls = (el.className && typeof el.className === "string")
      ? "." + el.className.trim().split(/\s+/).slice(0, 2).join(".") : "";
    return t + cls;
  };
  const txt = (el) => (el.textContent || "").replace(/\s+/g, " ").trim().slice(0, 80);

  /* -- 1. document-level: the single most common "missing part" bug -- */
  const de = document.documentElement;
  const vw = window.innerWidth;
  const hOverflow = de.scrollWidth - vw;
  if (hOverflow > 2) {
    add("FAIL", "layout/horizontal-overflow",
      `Document scrolls ${hOverflow}px wider than the viewport`,
      { scrollWidth: de.scrollWidth, viewport: vw });
    // name the worst offenders
    const culprits = [];
    document.querySelectorAll("body *").forEach((el) => {
      if (!isVisible(el)) return;
      const r = el.getBoundingClientRect();
      if (r.right > vw + 2 || r.left < -2) {
        culprits.push({ el: sel(el), right: Math.round(r.right), left: Math.round(r.left), w: Math.round(r.width) });
      }
    });
    culprits.sort((a, b) => b.right - a.right);
    add("FAIL", "layout/offenders",
      `${culprits.length} element(s) extend outside the viewport`,
      culprits.slice(0, 12));
  }

  /* -- 2. clipped text: content that exists but is not visible ------- */
  const clipped = [];
  document.querySelectorAll("body *").forEach((el) => {
    if (!isVisible(el)) return;
    if (el.children.length > 0) return;
    const t = txt(el);
    if (!t) return;
    const cs = getComputedStyle(el);
    const hides = cs.overflow === "hidden" || cs.overflowX === "hidden" ||
      cs.overflowY === "hidden" || cs.textOverflow === "ellipsis";
    if (hides && el.scrollWidth > el.clientWidth + 2) {
      clipped.push({ el: sel(el), text: t, scrollW: el.scrollWidth, clientW: el.clientWidth, ellipsis: cs.textOverflow === "ellipsis" });
    }
    if (hides && el.scrollHeight > el.clientHeight + 2 && cs.overflowY === "hidden") {
      clipped.push({ el: sel(el), text: t, kind: "vertical-clip", scrollH: el.scrollHeight, clientH: el.clientHeight });
    }
  });
  const realClips = clipped.filter((c) => !c.ellipsis || c.scrollW > c.clientW + 12);
  if (realClips.length) {
    add("FAIL", "layout/clipped-text",
      `${realClips.length} text element(s) are cut off by their container`,
      realClips.slice(0, 12));
  }

  /* -- 3. images that did not actually load -------------------------- */
  const badImgs = [];
  document.querySelectorAll("img").forEach((img) => {
    const r = img.getBoundingClientRect();
    // Alt text is a DOM concern: flag it even while hidden.
    if (img.getAttribute("alt") === null) {
      badImgs.push({ el: sel(img), src: (img.currentSrc || img.src || "").slice(-90), reason: "missing-alt" });
      return;
    }
    // Load state only matters for something the user can actually see; a hidden
    // placeholder legitimately has no src until script fills it in.
    if (!isVisible(img)) return;
    if (img.complete && img.naturalWidth === 0) {
      badImgs.push({ el: sel(img), src: (img.currentSrc || img.src || "").slice(-90), reason: "failed-to-load" });
    } else if (r.width < 2 || r.height < 2) {
      badImgs.push({ el: sel(img), src: (img.currentSrc || img.src || "").slice(-90), reason: "zero-size" });
    }
  });
  badImgs.forEach((b) => {
    add(b.reason === "missing-alt" ? "WARN" : "FAIL", "media/" + b.reason, `img ${b.reason}: ${b.el}`, b);
  });

  /* -- 4. RTL / Hebrew correctness (mission-critical here) ----------- */
  // Unicode bidi isolates: FSI/LRI/RLI ... PDI. Text set through textContent
  // cannot carry markup, so these are the only way to isolate a Latin run
  // inside Hebrew in JS-driven copy. Their presence means the author already
  // did the correct thing, and flagging it would be a false positive.
  const UNI_ISOLATE_OPEN = /[\u2066-\u2068]/;
  const UNI_ISOLATE_CLOSE = /\u2069/;
  const hasUniIsolate = (s) => {
    const o = s.search(UNI_ISOLATE_OPEN);
    return o >= 0 && s.indexOf("\u2069", o) > o;
  };
  /* An element sitting inside a deliberate LTR *isolate* is handled correctly:
     a browser URL bar is legitimately LTR while holding a Hebrew label, and
     `unicode-bidi:isolate` is the standard way to contain that. Only flag
     Hebrew in an LTR box that is NOT isolated. */
  const insideLtrIsolate = (el) => {
    let cur = el.parentElement;
    while (cur && cur.nodeType === 1) {
      const c = getComputedStyle(cur);
      if (c.unicodeBidi === "isolate" || c.unicodeBidi === "isolate-override" ||
          c.unicodeBidi === "plaintext") return true;
      cur = cur.parentElement;
    }
    return false;
  };

  const htmlDir = de.getAttribute("dir") || document.body.getAttribute("dir");
  if (!htmlDir) add("FAIL", "rtl/no-dir", "<html> has no dir attribute; direction is guessable");
  else if (!/^rtl$/i.test(htmlDir)) add("WARN", "rtl/doc-dir", `<html dir="${htmlDir}"> on a Hebrew-first site`);

  const ltrHebrew = [], leftAlignedHebrew = [], mixedNoBidi = [];
  document.querySelectorAll("body *").forEach((el) => {
    if (!isVisible(el)) return;
    const own = Array.from(el.childNodes)
      .filter((n) => n.nodeType === 3)
      .map((n) => n.nodeValue)
      .join(" ")
      .trim();
    if (!HEBREW.test(own)) return;
    const cs = getComputedStyle(el);
    if (cs.direction === "ltr" && !insideLtrIsolate(el)) ltrHebrew.push({ el: sel(el), text: own.slice(0, 60) });
    if (cs.textAlign === "left" || cs.textAlign === "start") {
      // "start" is correct in RTL, "left" is only wrong when direction is rtl
      if (cs.textAlign === "left") leftAlignedHebrew.push({ el: sel(el), text: own.slice(0, 60) });
    }
    // Advisory only. Chromium's bidi algorithm already places the neutral
    // characters between a Hebrew run and a single Latin token correctly -
    // verified by A/B screenshot on this site's "לראות את ה-AI בפעולה": the
    // hyphen renders on the same side with and without isolation. Adding
    // <bdi> there changed nothing visually and introduced gaps around the
    // Latin run. So this is a risk to review, not a defect, and forcing
    // isolation on it makes the typography worse. Reported as INFO.
    const hasLatin = /[A-Za-z]{2,}/.test(own) && HEBREW.test(own);
    const isolatedByMarkup = el.querySelector("bdi,[dir],[style*='unicode-bidi']") &&
      HEBREW.test(own) && /[A-Za-z]{2,}/.test(own);
    if (hasLatin && !hasUniIsolate(own) && !isolatedByMarkup &&
        cs.unicodeBidi === "normal" && cs.display.includes("flex")) {
      mixedNoBidi.push({
        el: sel(el), text: own.replace(/[\u2066-\u2069]/g, "").slice(0, 60),
        note: "advisory: check the render before changing anything",
      });
    }
  });
  if (ltrHebrew.length) add("FAIL", "rtl/hebrew-in-ltr-box",
    `${ltrHebrew.length} Hebrew text block(s) computed direction:ltr`, ltrHebrew.slice(0, 10));
  if (leftAlignedHebrew.length) add("WARN", "rtl/text-align-left",
    `${leftAlignedHebrew.length} Hebrew block(s) hard-aligned left`, leftAlignedHebrew.slice(0, 10));
  if (mixedNoBidi.length) add("INFO", "rtl/mixed-content-flex",
    `${mixedNoBidi.length} flex container(s) mix Hebrew and Latin without unicode-bidi (advisory, not a proven defect)`,
    mixedNoBidi.slice(0, 10));

  /* -- 5. accessibility structure ------------------------------------ */
  if (!de.getAttribute("lang")) add("WARN", "a11y/no-lang", "<html> has no lang attribute");
  if (document.querySelectorAll("h1").length === 0) add("FAIL", "a11y/no-h1", "page has no <h1>");
  else if (document.querySelectorAll("h1").length > 1)
    add("WARN", "a11y/multiple-h1", `${document.querySelectorAll("h1").length} <h1> elements`);

  const hs = [...document.querySelectorAll("h1,h2,h3,h4,h5,h6")]
    .filter(isVisible).map((h) => +h.tagName[1]);
  for (let i = 1; i < hs.length; i++) {
    if (hs[i] - hs[i - 1] > 1) {
      add("WARN", "a11y/heading-skip", `heading level jumps h${hs[i - 1]} -> h${hs[i]}`, { index: i });
      break;
    }
  }

  const nameless = [];
  document.querySelectorAll("a,button,[role=button],input[type=submit],input[type=button]").forEach((el) => {
    if (!isVisible(el)) return;
    const name = (el.getAttribute("aria-label") || el.getAttribute("title") || txt(el) ||
      el.querySelector("img")?.alt || "").trim();
    if (!name) nameless.push({ el: sel(el), href: (el.getAttribute("href") || "").slice(0, 60) });
  });
  if (nameless.length) add("FAIL", "a11y/no-accessible-name",
    `${nameless.length} control(s) with no accessible name`, nameless.slice(0, 10));

  const unlabeledInputs = [];
  document.querySelectorAll("input:not([type=hidden]),select,textarea").forEach((el) => {
    if (!isVisible(el)) return;
    const has = el.getAttribute("aria-label") || el.getAttribute("aria-labelledby") ||
      el.id && document.querySelector(`label[for="${CSS.escape(el.id)}"]`) ||
      el.closest("label");
    if (!has) unlabeledInputs.push({ el: sel(el), type: el.type });
  });
  if (unlabeledInputs.length) add("WARN", "a11y/unlabeled-input",
    `${unlabeledInputs.length} form control(s) without a label`, unlabeledInputs.slice(0, 10));

  const ids = new Map();
  document.querySelectorAll("[id]").forEach((el) => ids.set(el.id, (ids.get(el.id) || 0) + 1));
  const dupes = [...ids.entries()].filter(([, c]) => c > 1);
  if (dupes.length) add("FAIL", "a11y/duplicate-id",
    `${dupes.length} duplicated id(s)`, dupes.slice(0, 10).map(([id, c]) => ({ id, count: c })));

  /* -- 6. touch targets ---------------------------------------------- */
  /* Measure the REAL hit area, not the border box. A control can have a small
     box and a large tappable region (padding, an absolutely positioned layer,
     a pseudo-element), and a rule that only reads getBoundingClientRect
     reports a working control as broken. elementFromPoint at the edges of a
     44x44 box centred on the control is the honest measurement. */
  if (vw <= 820) {
    const small = [];
    document.querySelectorAll("a,button,input,select,textarea,[role=button]").forEach((el) => {
      if (!isVisible(el)) return;
      const r = el.getBoundingClientRect();
      if (r.width >= 44 && r.height >= 44) return;
      // An inline link inside running text is exempt: WCAG 2.5.8 excludes
      // targets in a sentence. A standalone control is not exempt.
      const inlineInText = (() => {
        if (el.tagName !== "A" && !["BUTTON"].includes(el.tagName)) return false;
        const p = el.parentElement;
        if (!p) return false;
        const pt = (p.textContent || "").replace(el.textContent || "", "").trim();
        return pt.length > 0; // real text continues around the link
      })();
      let edgesHit = 0, edgesTested = 0;
      const half = 22;
      const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
      for (const [x, y] of [[cx - half, cy], [cx + half, cy], [cx, cy - half], [cx, cy + half]]) {
        if (x < 0 || y < 0 || x > vw || y > window.innerHeight) continue;
        edgesTested++;
        const hit = document.elementFromPoint(x, y);
        // Only the control itself or one of its descendants counts. An
        // ancestor would swallow the tap, so it must NOT pass.
        if (hit && (hit === el || el.contains(hit))) edgesHit++;
      }
      const effective = edgesTested > 0 && edgesHit === edgesTested;
      if (inlineInText) return;
      if (!effective) {
        small.push({
          el: sel(el), text: txt(el), w: Math.round(r.width), h: Math.round(r.height),
          hitEdges: `${edgesHit}/${edgesTested}`,
        });
      }
    });
    if (small.length) add("WARN", "a11y/tap-target",
      `${small.length} control(s) with a real hit area under 44x44 on a touch viewport`, small.slice(0, 12));
  }

  /* -- 7. contrast ---------------------------------------------------- */
  const lowContrast = [];
  document.querySelectorAll("body *").forEach((el) => {
    if (!isVisible(el)) return;
    if (el.children.length > 0) return;
    const t = txt(el);
    if (!t) return;
    const cs = getComputedStyle(el);
    const fg = parseColor(cs.color);
    if (!fg) return;
    const bg = effBg(el);
    const c = ratio(fg.a < 1 ? over(fg, bg) : fg, bg);
    const fs = parseFloat(cs.fontSize);
    const bold = parseInt(cs.fontWeight, 10) >= 700;
    const large = fs >= 24 || (fs >= 18.66 && bold);
    const need = large ? 3 : 4.5;
    if (c < need) {
      lowContrast.push({ el: sel(el), text: t, ratio: +c.toFixed(2), need, fontSize: fs, color: cs.color, bg: `rgb(${Math.round(bg.r)},${Math.round(bg.g)},${Math.round(bg.b)})` });
    }
  });
  if (lowContrast.length) {
    add("FAIL", "color/contrast",
      `${lowContrast.length} text node(s) below WCAG AA contrast`, lowContrast.slice(0, 15));
  }

  /* -- 8. invisible click targets (present but unusable) ------------- */
  const ghosts = [];
  document.querySelectorAll("a,button").forEach((el) => {
    if (!isVisible(el)) return;
    const cs = getComputedStyle(el);
    if (parseFloat(cs.opacity) < 0.1) {
      ghosts.push({ el: sel(el), opacity: cs.opacity, text: txt(el) });
    }
  });
  if (ghosts.length) add("WARN", "ui/ghost-target",
    `${ghosts.length} interactive element(s) are effectively invisible`, ghosts.slice(0, 10));

  /* -- 9. splash / intro gate ----------------------------------------
     A timed intro that has not finished looks exactly like an empty, broken
     page. Measuring the fold tells the agent to re-shoot rather than to
     report a design that is actually fine. */
  const vh0 = window.innerHeight;
  const foldEls = [...document.querySelectorAll("body *")].filter((el) => {
    if (!isVisible(el)) return false;
    const r = el.getBoundingClientRect();
    return r.top < vh0 && r.bottom > 0 && r.width > 0 && r.height > 0;
  });
  const foldTextLen = foldEls.reduce((s, el) => s + txt(el).length, 0);
  const foldInfo = {
    textLen: foldTextLen,
    elements: foldEls.length,
    docHeight: de.scrollHeight,
    viewportHeight: vh0,
  };
  if (foldInfo.docHeight > vh0 * 2 && foldTextLen < 60) {
    add("WARN", "capture/possible-intro",
      `First ${vh0}px contains almost no text (${foldTextLen} chars) while the document is ${de.scrollHeight}px tall. ` +
      `This is usually an unfinished intro animation - re-run with --settle 7000 before judging the design.`,
      foldInfo);
  }

  return {
    findings,
    fold: foldInfo,
    stats: {
      title: document.title,
      lang: de.getAttribute("lang"),
      dir: htmlDir,
      viewport: { w: vw, h: window.innerHeight },
      document: { scrollW: de.scrollWidth, scrollH: de.scrollHeight },
      counts: {
        elements: document.querySelectorAll("body *").length,
        images: document.querySelectorAll("img").length,
        links: document.querySelectorAll("a").length,
        buttons: document.querySelectorAll("button").length,
        forms: document.querySelectorAll("form").length,
        headings: hs.length,
      },
      cls: window.__cls ?? null,
      perf: {
        loadMs: Math.round(performance.getEntriesByType("navigation")[0]?.duration ?? 0),
        domContentLoaded: Math.round(performance.getEntriesByType("navigation")[0]?.domContentLoadedEventEnd ?? 0),
        requests: performance.getEntriesByType("resource").length,
        transferKB: Math.round(performance.getEntriesByType("resource")
          .reduce((s, r) => s + (r.transferSize || 0), 0) / 1024),
      },
    },
  };
}

/* Freeze motion so two captures of an unchanged page are pixel-identical.
   Without this a visual diff is dominated by whatever is animating: on this
   site's homepage a 1px CSS change measured 1.28% different pixels, essentially
   all of it the animated dot-matrix hero, which buries the real regression. */
function stillStyles() {
  return `
    *, *::before, *::after {
      animation-play-state: paused !important;
      animation-duration: 0s !important;
      animation-delay: 0s !important;
      transition-duration: 0s !important;
      transition-delay: 0s !important;
    }
    html { scroll-behavior: auto !important; }
  `;
}

/* CLS must be observed from before first paint. */
function initScript() {
  window.__cls = 0;
  try {
    new PerformanceObserver((l) => {
      for (const e of l.getEntries()) if (!e.hadRecentInput) window.__cls += e.value;
    }).observe({ type: "layout-shift", buffered: true });
  } catch { /* unsupported */ }
}

/* ------------------------------------------------------------------ main */
async function run() {
  const a = parseArgs(process.argv);
  if (a.help || !a.url) {
    console.log(fs.readFileSync(new URL(import.meta.url), "utf8").split("*/")[0].replace(/^\/\*\*?/, ""));
    process.exit(a.help ? 0 : 1);
  }
  if (!/^https?:\/\//.test(a.url)) {
    console.error(`FAIL url/invalid: "${a.url}" needs an http(s):// scheme`);
    process.exit(2);
  }

  const names = a.responsive ? ["mobile", "tablet", "desktop"] : [a.viewport];
  for (const n of names) if (!VIEWPORTS[n]) {
    console.error(`FAIL arg/viewport: unknown "${n}". known: ${Object.keys(VIEWPORTS).join(", ")}`);
    process.exit(2);
  }

  const slug = a.url.replace(/^https?:\/\//, "").replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").slice(0, 60) || "page";
  fs.mkdirSync(OUT_ROOT, { recursive: true });

  const browser = await chromium.launch({ args: ["--font-render-hinting=none"] });
  const report = {
    url: a.url,
    at: new Date().toISOString(),
    viewports: {},
    console: { errors: [], warnings: [], logs: 0 },
    network: { failed: [], badStatus: [] },
    diff: null,
    exit: 0,
  };

  for (const name of names) {
    const vp = VIEWPORTS[name];
    const ctx = await browser.newContext({
      viewport: { width: vp.width, height: vp.height },
      deviceScaleFactor: vp.dsf,
      isMobile: name === "mobile",
      // Tablets are touch devices in reality. Without this, every
      // @media (pointer:coarse) rule goes unexercised at the tablet width and
      // the audit reports defects that a real tablet would not have.
      hasTouch: name === "mobile" || name === "tablet",
      // Emulate reduced motion for a still frame. This is the standards-based
      // mechanism and it asks the page to stop animating, which also stops a
      // requestAnimationFrame canvas loop - injecting animation:none cannot,
      // because canvas is painted by script, not by CSS. A page that honours
      // prefers-reduced-motion then produces identical pixels twice, which is
      // what makes a visual diff meaningful instead of mostly noise.
      reducedMotion: a.still ? "reduce" : "no-preference",
      locale: "he-IL",
    });
    await ctx.addInitScript(initScript);
    const page = await ctx.newPage();

    const onConsole = (m) => {
      const t = m.type();
      const text = m.text().slice(0, 300);
      if (t === "error") report.console.errors.push({ vp: name, text });
      else if (t === "warning") report.console.warnings.push({ vp: name, text });
      else report.console.logs++;
    };
    const onError = (e) => report.console.errors.push({ vp: name, text: "pageerror: " + String(e.message).slice(0, 300) });
    const onFailed = (r) => report.network.failed.push({ vp: name, url: r.url().slice(0, 140), reason: r.failure()?.errorText });
    const onResp = (r) => { if (r.status() >= 400) report.network.badStatus.push({ vp: name, status: r.status(), url: r.url().slice(0, 140) }); };
    page.on("console", onConsole);
    page.on("pageerror", onError);
    page.on("requestfailed", onFailed);
    page.on("response", onResp);

    let audit = { findings: [], stats: null };
    let navError = null;
    try {
      await page.goto(a.url, { waitUntil: a.waitUntil, timeout: a.timeout });
      await page.waitForTimeout(a.settle);
      try { await page.evaluate(() => document.fonts?.ready); } catch { /* ignore */ }
      if (a.selector) await page.waitForSelector(a.selector, { timeout: 10000 });
      await page.waitForTimeout(250);
      if (a.still) {
        // Applied after the settle so the intro has actually played, then the
        // page is given a moment to repaint at its final resting state.
        await page.addStyleTag({ content: stillStyles() });
        await page.waitForTimeout(600);
      }
      audit = await page.evaluate(pageAudit);
    } catch (e) {
      navError = String(e.message).slice(0, 400);
    }

    let shotPath = null, diffPath = null, shotErr = null, truncated = null;
    const extraShots = [];
    let fullPage = a.fullPage;
    try {
      // A 20,000px full-page PNG is downscaled into illegibility by the vision
      // model. Above the threshold, capture the fold, and optionally walk the
      // page in viewport-sized segments, which stay readable.
      if (fullPage && !a.selector) {
        const docH = audit.stats?.document?.scrollH ?? 0;
        if (docH > a.maxFullPage) {
          fullPage = false;
          truncated = {
            reason: `document is ${docH}px tall; a single full-page capture would be illegible to the model`,
            captured: "viewport fold",
            maxFullPage: a.maxFullPage,
          };
        }
      }

      const file = path.join(OUT_ROOT, `${slug}--${name}.png`);
      if (a.selector) {
        const el = await page.$(a.selector);
        if (!el) throw new Error(`selector not found: ${a.selector}`);
        await el.screenshot({ path: file });
      } else {
        await page.screenshot({ path: file, fullPage });
        if (!fullPage && a.segments > 0) {
          const vh = audit.stats?.viewport?.h ?? 900;
          const docH = audit.stats?.document?.scrollH ?? 0;
          const step = Math.max(1, Math.floor(a.segments));
          for (let i = 1; i <= step; i++) {
            const y = Math.min(i * vh, Math.max(0, docH - vh));
            if (y <= 0) break;
            await page.evaluate((yy) => window.scrollTo(0, yy), y);
            await page.waitForTimeout(350);
            const f2 = path.join(OUT_ROOT, `${slug}--${name}-seg${i}.png`);
            await page.screenshot({ path: f2, fullPage: false });
            extraShots.push(f2);
            await page.evaluate(() => window.scrollTo(0, 0));
          }
        }
      }
      shotPath = file;

      if (a.baseline) {
        fs.mkdirSync(BASELINE_ROOT, { recursive: true });
        const base = path.join(BASELINE_ROOT, `${slug}--${name}.png`);
        if (a.updateBaseline || !fs.existsSync(base)) {
          fs.copyFileSync(file, base);
          report.diff = { vp: name, status: "baseline-written", path: base };
        } else {
          const A = PNG.sync.read(fs.readFileSync(base));
          const B = PNG.sync.read(fs.readFileSync(file));
          if (A.width !== B.width || A.height !== B.height) {
            report.diff = { vp: name, status: "size-changed", baseline: `${A.width}x${A.height}`, current: `${B.width}x${B.height}` };
          } else {
            const out = new PNG({ width: A.width, height: A.height });
            const n = pixelmatch(A.data, B.data, out.data, A.width, A.height, { threshold: 0.1 });
            const total = A.width * A.height;
            const pct = +((n / total) * 100).toFixed(3);
            diffPath = path.join(OUT_ROOT, `${slug}--${name}--diff.png`);
            fs.writeFileSync(diffPath, PNG.sync.write(out));
            report.diff = { vp: name, status: pct > 0.1 ? "CHANGED" : "identical", changedPixels: n, pct, diffPath };
          }
        }
      }
    } catch (e) {
      shotErr = String(e.message).slice(0, 300);
    }

    report.viewports[name] = {
      label: vp.label, size: `${vp.width}x${vp.height}@${vp.dsf}x`,
      navError, shotError: shotErr, screenshot: shotPath, segments: extraShots, truncated,
      findings: audit.findings, stats: audit.stats,
    };
    await ctx.close();
  }
  await browser.close();

  /* -- console/network -> findings ----------------------------------- */
  for (const e of report.console.errors) report.viewports[Object.keys(report.viewports)[0]]?.findings.push({
    severity: "FAIL", rule: "runtime/console-error", message: e.text.slice(0, 200), detail: e,
  });
  for (const f of report.network.failed) report.viewports[Object.keys(report.viewports)[0]]?.findings.push({
    severity: "FAIL", rule: "runtime/request-failed", message: `request failed: ${f.url}`, detail: f,
  });
  for (const b of report.network.badStatus) report.viewports[Object.keys(report.viewports)[0]]?.findings.push({
    severity: "FAIL", rule: "runtime/http-status", message: `HTTP ${b.status} ${b.url}`, detail: b,
  });
  if (report.console.warnings.length) report.viewports[Object.keys(report.viewports)[0]]?.findings.push({
    severity: "WARN", rule: "runtime/console-warning",
    message: `${report.console.warnings.length} console warning(s)`, detail: report.console.warnings.slice(0, 10),
  });

  /* -- verdict -------------------------------------------------------- */
  const ignores = loadIgnores();
  let ignored = [];
  if (ignores.length) {
    for (const [name, v] of Object.entries(report.viewports)) {
      const before = (v.findings ?? []).length;
      const kept = applyIgnores(v.findings, ignores);
      ignored.push(...(v.findings ?? []).filter((f) => !kept.includes(f)).map((f) => ({ vp: name, rule: f.rule, message: f.message })));
      v.findings = kept;
      v.ignored = before - kept.length;
    }
  }

  let fails = 0, warns = 0;
  for (const v of Object.values(report.viewports)) {
    for (const f of v.findings ?? []) f.severity === "FAIL" ? fails++ : f.severity === "WARN" ? warns++ : 0;
  }
  report.verdict = { fails, warns, ignored: ignored.length, exit: fails > 0 ? 1 : 0 };

  const reportFile = path.join(OUT_ROOT, `${slug}--report.json`);
  fs.writeFileSync(reportFile, JSON.stringify(report, null, 2));

  if (a.json) { console.log(JSON.stringify(report, null, 2)); }
  else if (!a.quiet) { printHuman(report, reportFile); }

  process.exit(report.verdict.exit);
}

function printHuman(r, reportFile) {
  const C = { FAIL: "\x1b[31mFAIL\x1b[0m", WARN: "\x1b[33mWARN\x1b[0m", INFO: "\x1b[36mINFO\x1b[0m" };
  console.log(`\nurl     ${r.url}`);
  console.log(`report  ${reportFile}`);
  for (const [name, v] of Object.entries(r.viewports)) {
    console.log(`\n--- ${name}  ${v.size}  ${v.label} ---`);
    if (v.navError) { console.log(`  ${C.FAIL} navigation failed: ${v.navError}`); continue; }
    const s = v.stats;
    if (s) {
      console.log(`  title="${s.title}"  lang=${s.lang}  dir=${s.dir}`);
      console.log(`  doc ${s.document.scrollW}x${s.document.scrollH}  viewport ${s.viewport.w}x${s.viewport.h}`);
      console.log(`  elems=${s.counts.elements} img=${s.counts.images} a=${s.counts.links} btn=${s.counts.buttons} h=${s.counts.headings}`);
      if (s.cls != null) console.log(`  CLS=${s.cls.toFixed(4)}`);
      console.log(`  perf load=${s.perf.loadMs}ms dcl=${s.perf.domContentLoaded}ms reqs=${s.perf.requests} transfer=${s.perf.transferKB}KB`);
    }
    for (const f of v.findings ?? []) {
      console.log(`  ${C[f.severity] || f.severity} [${f.rule}] ${f.message}`);
    }
    if (v.truncated) console.log(`  ${C.INFO} [capture/segmented] ${v.truncated.reason}; captured ${v.truncated.captured}`);
    console.log(`  screenshot: ${v.screenshot}`);
    (v.segments ?? []).forEach((s, i) => console.log(`    segment ${i + 1}: ${s}`));
    if (v.shotError) console.log(`  ${C.FAIL} screenshot failed: ${v.shotError}`);
  }
  if (r.diff) console.log(`\ndiff    ${r.diff.status}${r.diff.pct != null ? ` ${r.diff.pct}% of pixels (${r.diff.changedPixels})` : ""}${r.diff.diffPath ? "\n        " + r.diff.diffPath : ""}${r.diff.path ? "\n        " + r.diff.path : ""}`);
  console.log(`\nverdict ${r.verdict.fails} FAIL, ${r.verdict.warns} WARN${r.verdict.ignored ? `, ${r.verdict.ignored} ignored` : ""}  -> exit ${r.verdict.exit}`);
}

/* --------------------------------------------- reusable library export */
/* Lets an agent drive the browser directly in one inline script instead of
   shelling out per action. Same power as the MCP server, zero MCP round-trips. */
export async function eyes(opts = {}) {
  const browser = await chromium.launch();
  try {
    const ctx = await browser.newContext({
      viewport: opts.viewport ?? { width: 1440, height: 900 },
      deviceScaleFactor: opts.dsf ?? 1,
      locale: opts.locale ?? "he-IL",
    });
    const page = await ctx.newPage();
    if (opts.url) await page.goto(opts.url, { waitUntil: opts.waitUntil ?? "networkidle" });
    return { page, context: ctx, browser };
  } catch (e) {
    await browser.close();
    throw e;
  }
}
export { pageAudit, initScript, VIEWPORTS };

const isMain = process.argv[1] &&
  path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url).replace(/^\/([A-Za-z]:)/, "$1"));
if (isMain) {
  run().catch((e) => {
    console.error("eyes.mjs crashed: " + (e?.stack || e));
    process.exit(3);
  });
}
