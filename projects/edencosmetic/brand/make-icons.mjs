#!/usr/bin/env node
// Eden Cosmetics icon family. 24 px grid, one stroke weight (1.6), round caps and joins, and the signature in every
// icon: THE CURL, one stroke in the accent colour that starts straight and turns, like a lash lifting.
//   node make-icons.mjs  →  ../img/i-<name>.svg (ink + rose, for light grounds)
//                           ../img/i-<name>-white.svg (white + blush, for the film and dark grounds)
//                           icons.json (name → { ink, curl } path data, used to build the site's inline sprite)
import { fileURLToPath } from 'url';
import fs from 'fs';
import path from 'path';
const HERE = path.dirname(fileURLToPath(import.meta.url)), OUT = path.join(HERE, '..', 'img');
fs.mkdirSync(OUT, { recursive: true });
const INK = '#241A18', ROSE = '#964F58', WHITE = '#FFFFFF', BLUSH = '#E9B8B2';

// name: [ink path data, curl path data, label]
const I = {
  lash:     ['M2.6 13 C6.5 8.6 17.5 8.6 21.4 13 C17.5 17.4 6.5 17.4 2.6 13Z M12 10.6 a2.4 2.4 0 1 0 .01 0', 'M6.5 9.4 C5.6 7.6 5 6 5 4.3 M12 8.1 C12 6.2 12.3 4.8 13 3.4 M17.5 9.4 C18.6 8 19.4 6.6 19.6 5', 'ריסים'],
  brow:     ['M3 16 C7 9.5 15.5 7.5 21 11.6 C15.5 11.6 8 13 3 16Z', 'M6 19.6 h4.2 a3.6 3.6 0 0 0 3.6 -3.6', 'גבות'],
  tint:     ['M12 3.3 C12 3.3 5.4 10.4 5.4 14.6 a6.6 6.6 0 0 0 13.2 0 C18.6 10.4 12 3.3 12 3.3Z', 'M9.3 14.8 c.2 2.2 1.5 3.4 3.4 3.6', 'צבע'],
  glue:     ['M8 10.4 h8 v8.7 a2 2 0 0 1 -2 2 h-4 a2 2 0 0 1 -2 -2Z M10 10.4 V7.4 h4 v3 M11 7.4 V3.4 h2 v4', 'M9.6 16.6 h2.6 a2.4 2.4 0 0 0 2.4 -2.4', 'דבק'],
  pad:      ['M3.2 15 C5.5 9.6 18.5 9.6 20.8 15 C17.6 17.2 6.4 17.2 3.2 15Z', 'M12 7.4 c0 -2 1.2 -3.4 3.4 -3.6', 'סיליקון'],
  tweezers: ['M4.5 20 L16.2 4.6 L19.9 8.2 L6.6 21.2 Z', 'M14.6 10.6 c1.6 -.4 2.8 .1 3.6 1.4', 'פינצטה'],
  wand:     ['M4.4 19.8 L12.6 11.6 M12.6 11.6 l4.6 -4.6 M11 9.2 l3.8 3.8 M13.6 6.6 l3.8 3.8 M16.2 4 l3.8 3.8', 'M17.2 7 c1.6 -1.6 3 -2.2 4.4 -2', 'מסרק'],
  course:   ['M2.6 9.4 L12 5 L21.4 9.4 L12 13.8Z M6.6 11.6 V15.4 C6.6 17 9 18.4 12 18.4 C15 18.4 17.4 17 17.4 15.4 V11.6', 'M21.4 9.4 V14.2 a2.2 2.2 0 0 1 -2.2 2.2', 'קורסים'],
  gift:     ['M4 11.2 H20 V20.4 H4Z M3 7.6 H21 V11.2 H3Z M12 7.6 V20.4', 'M12 7.6 C9.2 7.6 7.4 6.2 7.4 4.8 A1.8 1.8 0 0 1 12 5.6', 'מתנה'],
  truck:    ['M2.4 6.4 H14 V16.4 H2.4Z M14 9.4 H18 L21.6 13 V16.4 H14 M7 18.6 a1.9 1.9 0 1 0 .01 0 M17.4 18.6 a1.9 1.9 0 1 0 .01 0', 'M5 10.2 h4 a2.6 2.6 0 0 1 2.6 2.6', 'משלוח'],
  cart:     ['M3 4.2 H5.6 L7.9 14.4 H18 L20.2 7 H6.4 M9.2 18.6 a1.4 1.4 0 1 0 .01 0 M16.8 18.6 a1.4 1.4 0 1 0 .01 0', 'M9.6 11 h3.6 a2.4 2.4 0 0 0 2.4 -2.4', 'סל'],
  phone:    ['M6.6 3.4 h3 l1.6 4 -2.1 1.4 a11 11 0 0 0 5.2 5.2 l1.4 -2.1 4 1.6 v3 a2 2 0 0 1 -2.2 2 A16.4 16.4 0 0 1 4.6 5.6 a2 2 0 0 1 2 -2.2Z', 'M14.6 4.4 a5 5 0 0 1 5 5', 'טלפון'],
  whatsapp: ['M12 3.4 a8.6 8.6 0 1 1 -4.5 15.9 L3.4 20.6 l1.3 -4 A8.6 8.6 0 0 1 12 3.4Z', 'M9.2 9 c.2 3 2.6 5.4 5.7 5.8', 'וואטסאפ'],
  search:   ['M10.6 4 a6.6 6.6 0 1 0 .01 0', 'M15.4 15.4 L19.4 19.4 q.9 .9 2 .4', 'חיפוש'],
  heart:    ['M12 20.6 C4.6 15 3 11.6 3 8.8 A4.6 4.6 0 0 1 12 7.2 A4.6 4.6 0 0 1 21 8.8 C21 11.6 19.4 15 12 20.6Z', 'M6.4 9.4 c.1 -1.8 1.2 -2.7 2.6 -2.8', 'אהבתי'],
  clock:    ['M12 3.4 a8.6 8.6 0 1 0 .01 0 M12 7.2 V12', 'M12 12 h3 a2.6 2.6 0 0 1 2.6 2.6', 'שעות'],
  shield:   ['M12 3 L19.6 6 V11.6 C19.6 16 16.6 19.6 12 21 C7.4 19.6 4.4 16 4.4 11.6 V6Z', 'M8.6 12.2 l2.4 2.4 C12.6 12.6 14.2 11.2 16 10.2', 'אחריות'],
  mail:     ['M3.4 6 H20.6 V18 H3.4Z', 'M3.8 7.2 Q12 15 20.2 7.2', 'מייל'],
  menu:     ['M4 7 H20 M4 12 H20', 'M4 17 H14 a3 3 0 0 0 3 -3', 'תפריט'],
  close:    ['M6 6 L18 18', 'M18 6 q-6 2 -12 12', 'סגירה'],
  arrow:    ['M4 12 H19.6', 'M13.6 6.4 Q18.6 7.6 20 12 Q18.6 16.4 13.6 17.6', 'המשך'],
  check:    ['M12 3.6 a8.4 8.4 0 1 0 .01 0', 'M8 12.2 l2.6 2.6 C12.2 12.4 14 10.8 16.2 9.8', 'אושר'],
  lotus:    ['M12 20 C6.6 17.6 4.6 12 6.6 7 C9.4 8.6 11.2 11.2 12 14 C12.8 11.2 14.6 8.6 17.4 7 C19.4 12 17.4 17.6 12 20Z', 'M12 14 C12 10 12.6 7 14.4 4.2', 'לוטוס'],
  spark:    ['M12 3.4 L13.6 9 L19.2 10.6 L13.6 12.2 L12 17.8 L10.4 12.2 L4.8 10.6 L10.4 9Z', 'M18 16.4 h1.6 a1.6 1.6 0 0 0 1.6 -1.6', 'חדש'],
};

const svg = (ink, curl, cInk, cCurl) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.6"><path d="${ink}" stroke="${cInk}"/><path d="${curl}" stroke="${cCurl}"/></svg>\n`;
const meta = {};
for (const [name, [ink, curl, label]] of Object.entries(I)) {
  fs.writeFileSync(path.join(OUT, `i-${name}.svg`), svg(ink, curl, INK, ROSE));
  fs.writeFileSync(path.join(OUT, `i-${name}-white.svg`), svg(ink, curl, WHITE, BLUSH));
  meta[name] = { ink, curl, label };
}
fs.writeFileSync(path.join(HERE, 'icons.json'), JSON.stringify(meta));
// a contact sheet to look at: 96 px and the real 24 px size, light and dark
const cell = (n, dark) => `<figure><img src="../img/i-${n}${dark ? '-white' : ''}.svg" width="72" height="72"><img src="../img/i-${n}${dark ? '-white' : ''}.svg" width="24" height="24"><figcaption>${n}</figcaption></figure>`;
const sheet = d => `<div style="background:${d ? '#241A18' : '#F8EFEA'};color:${d ? '#fff' : '#241A18'};display:flex;flex-wrap:wrap;gap:6px;padding:16px">${Object.keys(I).map(n => cell(n, d)).join('')}</div>`;
fs.writeFileSync(path.join(HERE, 'icons-sheet.html'), `<!doctype html><meta charset="utf-8"><style>body{margin:0;font:11px sans-serif}figure{margin:0;width:100px;display:flex;flex-direction:column;align-items:center;gap:6px}figcaption{opacity:.7}</style>${sheet(false)}${sheet(true)}`);
console.log(Object.keys(I).length + ' icons →', OUT);
