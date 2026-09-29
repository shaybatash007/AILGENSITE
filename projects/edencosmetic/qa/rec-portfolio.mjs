// Real-time screencasts of the Eden Cosmetics site for the AILGEN portfolio (rec.mjs: CDP screencast at a constant 30 fps).
//   python3 -m http.server 8123 --directory edencosmetic &   then   node projects/edencosmetic/qa/rec-portfolio.mjs [desk kit shop lotti mobile]
// Output: projects/edencosmetic/out/portfolio/edencosmetic-<name>.mp4 (not committed; the encoded copies go to assets/).
import { record, topAt, to } from '../../../.claude/skills/ailgen-studio/scripts/rec.mjs';
import fs from 'fs';
const URL0 = process.env.EDEN_URL || 'http://127.0.0.1:8123/', OUT = 'projects/edencosmetic/out/portfolio';
fs.mkdirSync(OUT, { recursive: true });
const want = process.argv.slice(2), on = n => !want.length || want.includes(n);
const COLOR = '150,79,88';
const click = async (pg, sel, pause = 600) => { await to(pg, sel, { steps: 26, pause: 250 }); await pg.click(sel); await pg.waitForTimeout(pause); };

if (on('desk')) console.log(await record(URL0, OUT + '/edencosmetic-desk', async pg => {
  await pg.waitForTimeout(4200);                                   // the loader writes the mark, the hero settles
  for (const [s, w] of [['#cats', 1300], ['#kit', 1500], ['#shop', 1500], ['#film', 1600], ['#about', 1500], ['#ship', 1200]]) { await topAt(pg, s, 110, 1700); await pg.waitForTimeout(w); }
}, { vp: [1440, 900], color: COLOR }));

if (on('kit')) console.log(await record(URL0, OUT + '/edencosmetic-kit', async pg => {
  await pg.waitForTimeout(2600); await topAt(pg, '#kit', 100, 1500); await pg.waitForTimeout(1400);
  await click(pg, 'label:has(input[name=kt][value=brow])', 1400);
  await click(pg, 'label:has(input[name=kt][value=tint])', 1400);
  await click(pg, 'label:has(input[name=kt][value=lash])', 900);
  await click(pg, 'label:has(input[name=kl][value=restock])', 1400);
  await click(pg, 'label:has(input[name=kl][value=start])', 1000);
  await click(pg, '#kList .krow:nth-child(2) .ck', 1100); await click(pg, '#kList .krow:nth-child(2) .ck', 900);
  await click(pg, '#kCart', 2200);
  await pg.keyboard.press('Escape'); await pg.waitForTimeout(900);
}, { vp: [1440, 900], color: COLOR }));

if (on('shop')) console.log(await record(URL0, OUT + '/edencosmetic-shop', async pg => {
  await pg.waitForTimeout(2600); await topAt(pg, '#shop', 100, 1500); await pg.waitForTimeout(900);
  await to(pg, '#q', { steps: 24, pause: 250 }); await pg.click('#q'); await pg.keyboard.type('THUYA', { delay: 150 }); await pg.waitForTimeout(1300);
  await pg.fill('#q', ''); await pg.waitForTimeout(400);
  await pg.selectOption('#brand', 'ZOLA'); await pg.waitForTimeout(1300); await pg.selectOption('#brand', ''); await pg.waitForTimeout(500);
  await click(pg, '#kinds .kind[data-k=pads]', 1500); await click(pg, '#kinds .kind[data-k=""]', 700);
  await click(pg, '#grid .pc:first-child .ph2', 1900); await pg.keyboard.press('Escape'); await pg.waitForTimeout(700);
  await click(pg, '#grid .pc:not(:has(.tagg.out)) .add >> nth=0', 1400);
}, { vp: [1440, 900], color: COLOR }));

if (on('lotti')) console.log(await record(URL0, OUT + '/edencosmetic-lotti', async pg => {
  await pg.waitForTimeout(3600);
  await topAt(pg, '#kit', 100, 1700); await pg.waitForTimeout(3200);   // she points at the builder
  await topAt(pg, '#courses', 100, 1700); await pg.waitForTimeout(2800);
  await click(pg, '#lbtn', 900); await click(pg, '#lm [data-l=ask]', 900);
  await pg.click('#advIn'); await pg.keyboard.type('מתי המשלוח חינם?', { delay: 70 }); await pg.keyboard.press('Enter'); await pg.waitForTimeout(2600);
  await pg.keyboard.type('יש קורסים?', { delay: 80 }); await pg.keyboard.press('Enter'); await pg.waitForTimeout(3000);
}, { vp: [1440, 900], color: COLOR }));

if (on('mobile')) console.log(await record(URL0, OUT + '/edencosmetic-mobile', async pg => {
  await pg.waitForTimeout(3600);
  await click(pg, '#burger', 1600); await pg.keyboard.press('Escape'); await pg.waitForTimeout(700);
  await topAt(pg, '#kit', 70, 1600); await pg.waitForTimeout(1800);
  await topAt(pg, '#shop', 70, 1600); await pg.waitForTimeout(1600);
  await topAt(pg, '#film', 70, 1600); await pg.waitForTimeout(1400);
}, { vp: [390, 844], scale: 1, cursor: false }));
