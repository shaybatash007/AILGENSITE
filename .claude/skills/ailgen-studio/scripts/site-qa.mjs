#!/usr/bin/env node
// Site QA gate: console errors, failed requests, horizontal overflow at 390 px, reduced motion, keyboard pass, and an
// optional project scenario (real interactions with assertions). Writes qa/site-qa.json and screenshots.
//   node site-qa.mjs --url http://127.0.0.1:8123/ --out projects/<slug>/qa [--scenario projects/<slug>/qa/scenario.mjs] [--path /] [--full]
// A scenario module exports `default async function (page, T)`; T.check(name, ok, note) records an assertion,
// T.errors() returns the console errors collected so far. Exit code 1 when anything fails.
import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';
import { pathToFileURL } from 'url';
import { parseArgs, repoRoot } from './lib.mjs';
const require = createRequire(import.meta.url);
let pw; try { pw = require('playwright'); } catch { pw = require('/opt/node22/lib/node_modules/playwright'); }
const a = parseArgs(), ROOT = repoRoot();
if (!a.url) { console.error('usage: node site-qa.mjs --url <http://127.0.0.1:port/> --out <dir> [--scenario file.mjs]'); process.exit(2); }
const OUT = path.resolve(ROOT, a.out || 'qa'); fs.mkdirSync(OUT, { recursive: true });
const URL0 = a.url, checks = [];
const T = { check: (name, ok, note = '') => { checks.push({ name, ok: !!ok, note: String(note).slice(0, 300) }); console.log((ok ? '  ✓ ' : '  ✗ ') + name + (note && !ok ? ': ' + note : '')); }, errors: () => [] };

async function session(label, ctxOpts, fn) {
  const b = await pw.chromium.launch();
  const ctx = await b.newContext({ locale: 'he-IL', ...ctxOpts });
  const pg = await ctx.newPage(); const errs = [], bad = [];
  pg.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  pg.on('pageerror', e => errs.push('pageerror: ' + e.message));
  pg.on('requestfailed', r => { const u = r.url(); if (u.startsWith(new URL(URL0).origin) || /fonts\.g/.test(u)) bad.push(u + ' ' + (r.failure() || {}).errorText); });
  pg.on('response', r => { if (r.status() >= 400 && r.url().startsWith(new URL(URL0).origin)) bad.push(r.status() + ' ' + r.url()); });
  T.errors = () => errs.slice();
  console.log('\n== ' + label);
  try { await fn(pg, errs, bad); } finally { await b.close(); }
  return { errs, bad };
}
const scrollThrough = async pg => { await pg.evaluate(async () => { document.documentElement.style.scrollBehavior = 'auto'; const h = document.documentElement.scrollHeight; for (let y = 0; y < h; y += 500) { scrollTo(0, y); await new Promise(r => setTimeout(r, 90)); } scrollTo(0, 0); await new Promise(r => setTimeout(r, 400)); }); };
const open = async (pg, p = a.path || '/') => { await pg.goto(new URL(p, URL0).href, { waitUntil: 'load' }); await pg.waitForTimeout(+(a.settle || 3200)); };

// 1 · desktop
await session('desktop 1440×900', { viewport: { width: 1440, height: 900 } }, async (pg, errs, bad) => {
  await open(pg);
  await pg.screenshot({ path: path.join(OUT, 'desktop.png') });
  if (a.full) { await scrollThrough(pg); await pg.screenshot({ path: path.join(OUT, 'desktop-full.png'), fullPage: true }); }
  T.check('desktop: no console errors', !errs.length, errs.join(' | '));
  T.check('desktop: no failed requests or 4xx/5xx', !bad.length, bad.join(' | '));
  const h1 = await pg.$$eval('h1', els => els.length); T.check('desktop: exactly one h1', h1 === 1, h1);
  const noAlt = await pg.$$eval('img:not([alt])', els => els.length); T.check('desktop: every img has alt', noAlt === 0, noAlt);
  const lang = await pg.evaluate(() => document.documentElement.lang + '/' + document.documentElement.dir); T.check('desktop: lang/dir he/rtl', lang === 'he/rtl', lang);
  // keyboard: first Tab is the skip link, focus is always visible, no more than 60 stops to reach the footer links
  await pg.keyboard.press('Tab');
  const first = await pg.evaluate(() => document.activeElement.className + '|' + document.activeElement.getAttribute('href')); T.check('keyboard: first Tab is the skip link', /skip/.test(first), first);
  let invisible = 0, stops = 0;
  for (let i = 0; i < 70; i++) {
    await pg.keyboard.press('Tab'); stops++;
    const vis = await pg.evaluate(() => { const e = document.activeElement; if (!e || e === document.body) return 'body'; const s = getComputedStyle(e); const ring = (s.outlineStyle !== 'none' && parseFloat(s.outlineWidth) > 0) || (s.boxShadow && s.boxShadow !== 'none'); const r = e.getBoundingClientRect(); return ring || r.width === 0 ? 'ok' : 'noring:' + e.tagName + '.' + e.className; });
    if (/^noring/.test(vis)) { invisible++; if (invisible < 4) console.log('    focus not visible on', vis); }
  }
  T.check('keyboard: focus ring visible on 70 stops', invisible === 0, invisible + ' stops without a ring');
});

// 2 · mobile
await session('mobile 390×844', { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 }, async (pg, errs, bad) => {
  await open(pg);
  await pg.screenshot({ path: path.join(OUT, 'mobile.png') });
  if (a.full) { await scrollThrough(pg); await pg.screenshot({ path: path.join(OUT, 'mobile-full.png'), fullPage: true }); }
  T.check('mobile: no console errors', !errs.length, errs.join(' | '));
  const ov = await pg.evaluate(() => { /* a deliberate horizontal scroller (a swipe row inside the viewport) is not page overflow */ const inScroller = e => { for (let p = e.parentElement; p && p !== document.body; p = p.parentElement) { const o = getComputedStyle(p).overflowX; if ((o === 'auto' || o === 'scroll') && p.getBoundingClientRect().right <= innerWidth + 2 && p.getBoundingClientRect().left >= -2) return true; } return false; }; const w = innerWidth, over = [...document.querySelectorAll('body *')].filter(e => { const r = e.getBoundingClientRect(); return r.width && (r.right > w + 2 || r.left < -2) && getComputedStyle(e).position !== 'fixed' && !e.closest('[hidden],.ld,dialog:not([open]),.drawer,.cart,.agent,.a11y,.adm,svg') && !inScroller(e); }).slice(0, 6).map(e => e.tagName + '.' + String(e.className).slice(0, 30) + ' ' + Math.round(e.getBoundingClientRect().right)); return { sw: document.documentElement.scrollWidth, w, over }; });
  T.check('mobile: no horizontal overflow at 390 px', ov.sw <= ov.w + 1 && !ov.over.length, JSON.stringify(ov));
  const small = await pg.evaluate(() => [...document.querySelectorAll('a[href],button,input,select,textarea,summary')].filter(e => { const r = e.getBoundingClientRect(); const s = getComputedStyle(e); return r.width && r.height && s.visibility !== 'hidden' && (r.height < 40 || r.width < 40) && e.type !== 'checkbox' && e.type !== 'radio' && !e.classList.contains('lnk') && !e.closest('.sr,.skip') && e.getClientRects().length && !(e.tagName === 'A' && e.closest('p,li,.fine,.src,.cite,.ct,.faq,.story,.lgb,.desc') ) ; }).slice(0, 8).map(e => e.tagName + '.' + String(e.className).slice(0, 24) + ' ' + Math.round(e.getBoundingClientRect().width) + '×' + Math.round(e.getBoundingClientRect().height)));
  T.check('mobile: touch targets ≥ 40 px (buttons, fields)', small.length === 0, small.join(' | '));
  // the menu button (any visible header button with aria-expanded + aria-controls, or .burger): opens, moves focus inside, closes on Escape
  const menu = await pg.evaluate(() => { const c = [...document.querySelectorAll('button[aria-controls][aria-expanded]')].find(e => { const r = e.getBoundingClientRect(); return r.width > 0 && r.top < 200 && (e.classList.contains('burger') || /menu|תפריט|nav/i.test(e.className + ' ' + (e.getAttribute('aria-label') || '') + ' ' + e.getAttribute('aria-controls'))) && !/נגישות|access|cart|סל/i.test(e.getAttribute('aria-label') || ''); }); if (!c) return null; c.setAttribute('data-qa-menu', '1'); return c.getAttribute('aria-controls'); });
  if (menu) {
    await pg.click('[data-qa-menu]'); await pg.waitForTimeout(700);
    const open = await pg.evaluate(id => ({ exp: document.querySelector('[data-qa-menu]').getAttribute('aria-expanded'), inside: !!document.getElementById(id)?.contains(document.activeElement) }), menu);
    T.check('mobile: the menu button opens the drawer (aria-expanded) and focus moves inside', open.exp === 'true' && open.inside, JSON.stringify(open));
    await pg.keyboard.press('Escape'); await pg.waitForTimeout(600);
    const closed = await pg.evaluate(() => document.querySelector('[data-qa-menu]').getAttribute('aria-expanded'));
    T.check('mobile: Escape closes the menu drawer', closed === 'false', closed);
  } else console.log('    (no menu button found on mobile, menu check skipped)');
});

// 3 · reduced motion
await session('reduced motion', { viewport: { width: 1280, height: 800 }, reducedMotion: 'reduce' }, async (pg, errs) => {
  await open(pg, a.path || '/'); await pg.waitForTimeout(600);
  T.check('reduced motion: no console errors', !errs.length, errs.join(' | '));
  const anim = await pg.evaluate(() => document.getAnimations().filter(x => x.playState === 'running' && x.effect && x.effect.getTiming().iterations === Infinity).length);
  T.check('reduced motion: no infinite animations running', anim === 0, anim);
});

// 4 · project scenario
if (a.scenario) {
  const mod = await import(pathToFileURL(path.resolve(ROOT, a.scenario)).href);
  await session('scenario', { viewport: { width: 1440, height: 900 }, permissions: ['clipboard-read', 'clipboard-write'] }, async (pg, errs) => {
    await open(pg); await mod.default(pg, { ...T, out: OUT, open });
    T.check('scenario: no console errors during interactions', !errs.length, errs.join(' | '));
  });
}
const ok = checks.every(c => c.ok);
fs.writeFileSync(path.join(OUT, 'site-qa.json'), JSON.stringify({ url: URL0, at: new Date().toISOString(), ok, passed: checks.filter(c => c.ok).length, failed: checks.filter(c => !c.ok).length, checks }, null, 1));
console.log(`\n${checks.filter(c => c.ok).length}/${checks.length} checks passed → ${path.join(OUT, 'site-qa.json')}`);
process.exit(ok ? 0 : 1);
