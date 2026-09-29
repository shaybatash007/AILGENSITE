#!/usr/bin/env node
/**
 * make-icon.mjs - render the AILGEN desktop icon and pack a multi-size .ico.
 *
 *   node tools/make-icon.mjs
 *
 * The mark echoes the site's own mascot: a dot-matrix "A" on deep navy with a
 * glowing amber core. Palette taken from index.html by frequency, not invented:
 *   #ffb23e amber   #f4f5fa off-white   #8fa0ff periwinkle
 *   #070b2e navy    #050822 deepest
 *
 * Rendered through Playwright rather than drawn by hand, because the browser is
 * the only rasteriser on this machine that is not blocked by WDAC, and because
 * HTML/SVG is reviewable. The .ico container is assembled here: Vista and later
 * accept PNG-compressed entries, so no BMP encoder is needed.
 *
 * 16x16 gets a simplified mark. A dot matrix that reads at 256px is mush at
 * 16px, and the small sizes are the ones a person actually sees on a desktop.
 */
import { chromium } from "playwright";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const EDGE = "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";
const ROOT = path.resolve(".");
const OUT_DIR = path.join(ROOT, "brand");

const AMBER = "#ffb23e";
const AMBER_HI = "#ffd27a";
const WHITE = "#f4f5fa";
const PERI = "#8fa0ff";

/* 7x9 filled A. Read at a glance, which is all a mask has to do. */
const A = [
  "...#...",
  "..###..",
  ".#####.",
  "##...##",
  "##...##",
  "#######",
  "##...##",
  "##...##",
  "##...##",
];

const svg = ({ size, simplified }) => {
  const s = 512;                       // render big, downscale on export
  const pad = simplified ? 96 : 116;
  const inner = s - pad * 2;
  const cell = inner / 9;
  const dot = cell * 0.72;
  const r = dot / 2;
  const startX = pad + (inner - cell * 7) / 2;
  const startY = pad;

  let dots = "";
  for (let y = 0; y < A.length; y++) {
    for (let x = 0; x < A[y].length; x++) {
      if (A[y][x] !== "#") continue;
      const cx = startX + x * cell + cell / 2;
      const cy = startY + y * cell + cell / 2;
      // The core: the middle of the counter, where the mascot glows.
      const isCore = y === 3 || y === 4 ? (x === 2 || x === 3 || x === 4) : (y === 2 && x === 3);
      dots += `<circle cx="${cx.toFixed(2)}" cy="${cy.toFixed(2)}" r="${r.toFixed(2)}"
        fill="${isCore ? `url(#core)` : `url(#body)`}" />`;
    }
  }

  // Simplified: a solid A, no dot matrix, for sizes where dots cannot read.
  const simple = simplified
    ? `<path d="M256 120 L392 392 L330 392 L256 250 L182 392 L120 392 Z" fill="url(#body)"/>
       <rect x="152" y="268" width="208" height="46" rx="23" fill="url(#core)"/>`
    : dots;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}" viewBox="0 0 ${s} ${s}">
    <defs>
      <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#0d1440"/>
        <stop offset="0.55" stop-color="#070b2e"/>
        <stop offset="1" stop-color="#050822"/>
      </linearGradient>
      <linearGradient id="body" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#ffffff"/>
        <stop offset="0.5" stop-color="${WHITE}"/>
        <stop offset="1" stop-color="${PERI}"/>
      </linearGradient>
      <radialGradient id="core" cx="0.5" cy="0.5" r="0.5">
        <stop offset="0" stop-color="#fff3d6"/>
        <stop offset="0.45" stop-color="${AMBER_HI}"/>
        <stop offset="1" stop-color="${AMBER}"/>
      </radialGradient>
      <radialGradient id="glow" cx="0.5" cy="0.5" r="0.5">
        <stop offset="0" stop-color="${AMBER}" stop-opacity="0.55"/>
        <stop offset="1" stop-color="${AMBER}" stop-opacity="0"/>
      </radialGradient>
      <linearGradient id="edge" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#4a5bd6" stop-opacity="0.85"/>
        <stop offset="0.5" stop-color="#4a5bd6" stop-opacity="0.15"/>
        <stop offset="1" stop-color="${AMBER}" stop-opacity="0.55"/>
      </linearGradient>
    </defs>
    <rect width="${s}" height="${s}" rx="112" fill="url(#bg)"/>
    <ellipse cx="256" cy="268" rx="190" ry="150" fill="url(#glow)"/>
    ${simple}
    <rect x="3" y="3" width="${s - 6}" height="${s - 6}" rx="109" fill="none"
          stroke="url(#edge)" stroke-width="6"/>
  </svg>`;
};

const html = (body) => `<!doctype html><html><head><meta charset="utf-8">
<style>html,body{margin:0;padding:0;background:transparent}svg{display:block}</style>
</head><body>${body}</body></html>`;

const browser = await chromium.launch({ headless: true, executablePath: fs.existsSync(EDGE) ? EDGE : undefined });
const page = await browser.newPage({ viewport: { width: 512, height: 512 }, deviceScaleFactor: 1 });

async function shoot(size, simplified) {
  await page.setContent(html(svg({ size, simplified })), { waitUntil: "load" });
  const buf = await page.screenshot({ omitBackground: true, type: "png" });
  // Resample to the target size by rendering at the target size directly, which
  // avoids a second image library entirely.
  return buf;
}

async function renderAt(px, simplified) {
  await page.setViewportSize({ width: px, height: px });
  await page.setContent(
    `<!doctype html><html><head><meta charset="utf-8"><style>
       html,body{margin:0;padding:0;background:transparent;width:${px}px;height:${px}px}
       svg{width:${px}px;height:${px}px;display:block}</style></head><body>
     ${svg({ size: px, simplified })}</body></html>`,
    { waitUntil: "load" });
  return page.screenshot({ omitBackground: true, type: "png" });
}

fs.mkdirSync(OUT_DIR, { recursive: true });

const SIZES = [16, 24, 32, 48, 64, 128, 256];
const entries = [];
for (const size of SIZES) {
  // Measured: the dot matrix turns to mush at 32px and 48px - it reads as a
  // blob with a bright spot, not as an A. The simplified mark reads cleanly, so
  // it covers everything at or below 48.
  const simplified = size <= 48;
  const png = await renderAt(size, simplified);
  const file = path.join(OUT_DIR, `icon-${size}.png`);
  fs.writeFileSync(file, png);
  entries.push({ size, png });
  console.log(`  rendered ${size}x${size}  ${(png.length / 1024).toFixed(1)} KB  ${simplified ? "(simplified)" : "(dot matrix)"}`);
}
void shoot;

// --- ICO container -----------------------------------------------------------
const count = entries.length;
const header = Buffer.alloc(6);
header.writeUInt16LE(0, 0);      // reserved
header.writeUInt16LE(1, 2);      // type: icon
header.writeUInt16LE(count, 4);

const dir = Buffer.alloc(16 * count);
let offset = 6 + 16 * count;
entries.forEach((e, i) => {
  const b = i * 16;
  dir.writeUInt8(e.size >= 256 ? 0 : e.size, b + 0);   // 0 means 256
  dir.writeUInt8(e.size >= 256 ? 0 : e.size, b + 1);
  dir.writeUInt8(0, b + 2);                            // palette
  dir.writeUInt8(0, b + 3);                            // reserved
  dir.writeUInt16LE(1, b + 4);                         // colour planes
  dir.writeUInt16LE(32, b + 6);                        // bits per pixel
  dir.writeUInt32LE(e.png.length, b + 8);
  dir.writeUInt32LE(offset, b + 12);
  offset += e.png.length;
});

const ico = Buffer.concat([header, dir, ...entries.map((e) => e.png)]);
const icoPath = path.join(OUT_DIR, "ailgen.ico");
fs.writeFileSync(icoPath, ico);
await browser.close();

console.log(`\n  ${icoPath}  ${(ico.length / 1024).toFixed(1)} KB  ${SIZES.join(", ")}`);
void os;
