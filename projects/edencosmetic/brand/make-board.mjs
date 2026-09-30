#!/usr/bin/env node
// The brand board: logo, symbol at every size, clear space, the curl, palette with contrast, type, icons.
//   node make-board.mjs → brand/board.html + brand/board.png (1600 px wide)
import { fileURLToPath } from 'url';
import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';
const HERE = path.dirname(fileURLToPath(import.meta.url)), PROJ = path.join(HERE, '..'), ROOT = path.join(PROJ, '..', '..');
const bj = JSON.parse(fs.readFileSync(path.join(PROJ, 'brand.json'), 'utf8')), P = bj.palette, icons = JSON.parse(fs.readFileSync(path.join(HERE, 'icons.json'), 'utf8'));
const parts = JSON.parse(fs.readFileSync(path.join(HERE, 'symbol-parts.json'), 'utf8'));
const vb = parts.viewBox.join(' ');
const partSvg = (d, fill = P.ink, w = 120) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb}" width="${w}"><path fill="${fill}" fill-rule="evenodd" d="${d}"/></svg>`;
const curl = t => `M0 0 C 0 ${(-14 - 4 * t).toFixed(1)} ${(8 * t).toFixed(1)} ${(-30 - 2 * t).toFixed(1)} ${(28 * t).toFixed(1)} ${(-40 + 8 * t).toFixed(1)}`;
const lashes = [0, .2, .45, .7, 1].map(t => `<figure><svg viewBox="-8 -46 46 52" width="92"><path d="M-8 0 H38" stroke="${P.line}" stroke-width="1.6"/><path d="${curl(t)}" fill="none" stroke="${P.accent}" stroke-width="2.6" stroke-linecap="round"/></svg><figcaption>${['ישר', 'מתחיל', 'מתרומם', 'כמעט', 'מעוקל'][[0, .2, .45, .7, 1].indexOf(t)]}</figcaption></figure>`).join('');
const sw = (k, use) => `<div class="sw"><i style="background:${P[k]}"></i><b>${k}</b><code>${P[k]}</code><span>${use}</span></div>`;
const html = `<!doctype html><html lang="he" dir="rtl"><meta charset="utf-8"><title>לוח מותג: עדן קוסמטיקס</title>
<link rel="stylesheet" href="../fonts/fonts.css">
<style>
:root{--ink:${P.ink};--paper:${P.paper};--blush:${P.blush};--accent:${P.accent};--line:${P.line};--mute:${P.mute}}
*{box-sizing:border-box}body{margin:0;background:var(--paper);color:var(--ink);font:400 17px/1.6 'Assistant',sans-serif;width:1600px}
h1,h2,h3{font-family:'Frank Ruhl Libre',serif;margin:0;font-weight:700;letter-spacing:-.01em}
header{display:flex;justify-content:space-between;align-items:center;padding:56px 72px 40px;border-bottom:1px solid var(--line)}
header h1{font-size:52px;line-height:1.1}header p{margin:10px 0 0;color:var(--mute);font-size:18px}
.lat{font-family:'Cinzel',serif;letter-spacing:.2em;text-transform:uppercase;font-size:13px;color:var(--accent);font-weight:700}
section{padding:44px 72px;border-bottom:1px solid var(--line)}section h2{font-size:34px;margin:8px 0 20px}
.row{display:flex;gap:28px;align-items:stretch;flex-wrap:wrap}
.card{background:#fff;border:1px solid var(--line);border-radius:22px;padding:28px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px}
.card.dark{background:var(--ink);border-color:var(--ink)}.card img{display:block}
.sizes{display:flex;align-items:flex-end;gap:26px}.sizes figure,.lashes figure,.parts figure{margin:0;text-align:center;font-size:13px;color:var(--mute)}
.lashes{display:flex;gap:22px}.parts{display:flex;gap:26px}
.sw{width:222px;background:#fff;border:1px solid var(--line);border-radius:18px;padding:14px;display:grid;gap:4px}.sw i{display:block;height:74px;border-radius:12px;border:1px solid rgba(0,0,0,.08)}.sw b{font-family:'Frank Ruhl Libre',serif;font-size:19px}.sw code{font-size:13px;color:var(--mute);direction:ltr;text-align:right}.sw span{font-size:13.5px;line-height:1.4}
.ct{display:grid;grid-template-columns:repeat(4,1fr);gap:8px 24px;margin-top:20px;font-size:14.5px}.ct div{display:flex;justify-content:space-between;border-bottom:1px solid var(--line);padding:5px 0}.ct b{direction:ltr}
.type{display:grid;grid-template-columns:repeat(3,1fr);gap:22px}.type .card{align-items:flex-start;justify-content:flex-start}
.ig{display:grid;grid-template-columns:repeat(12,1fr);gap:12px}.ig figure{margin:0;background:#fff;border:1px solid var(--line);border-radius:16px;padding:12px 6px 8px;text-align:center;font-size:12px;color:var(--mute)}.ig figure.d{background:var(--ink);color:#c9b8b1;border-color:var(--ink)}.ig img{width:44px;height:44px;display:block;margin:0 auto 4px}
.note{color:var(--mute);font-size:14.5px;max-width:1100px}
footer{padding:26px 72px 40px;color:var(--mute);font-size:14px;display:flex;justify-content:space-between}
</style>
<body id="board">
<header><div><div class="lat">Brand system · v1</div><h1>עדן קוסמטיקס</h1><p>ציוד מקצועי להרמת ריסים וגבות · הלוגו הוא של הלקוחה (מעקב וקטורי מהקובץ באתר), המערכת סביבו נבנתה בסטודיו</p></div><img src="../img/logo-light.png" width="330"></header>

<section><div class="lat">01 · הלוגו</div><h2>סמל, מילים, ומה קורה כשהוא קטן</h2>
<div class="row">
 <div class="card" style="width:520px"><img src="../img/logo-light.png" width="440"><span class="note">גרסה לרקע בהיר</span></div>
 <div class="card dark" style="width:520px"><img src="../img/logo-dark.png" width="440"><span class="note" style="color:#c9b8b1">גרסה לרקע כהה</span></div>
 <div class="card" style="flex:1;min-width:400px"><div class="sizes">${[200, 112, 64, 40, 24].map(w => `<figure>${partSvg([parts.parts.ring, parts.parts.mono, parts.parts.lotus].join(''), P.ink, w)}${w}px</figure>`).join('')}</div><span class="note">הסמל נשאר קריא עד 24px. מתחת לזה: פאביקון ה-EC בלבד.</span></div>
</div>
<div class="row" style="margin-top:24px">
 <div class="card" style="flex:1"><div class="parts">${[['ring', 'הטבעת: נכתבת'], ['mono', 'EC: עולה'], ['lotus', 'הלוטוס: נפתח']].map(([k, t]) => `<figure>${partSvg(parts.parts[k], P.ink, 150)}${t}</figure>`).join('')}</div><span class="note">שלושה חלקים נפרדים בקובץ (symbol-parts.json), כדי שהטעינה תפתח אותם בזה אחר זה.</span></div>
 <div class="card" style="width:420px"><div style="display:flex;gap:18px;align-items:center"><img src="../../../edencosmetic/icon.svg" width="120"><img src="../../../edencosmetic/img/apple-touch-icon.png" width="80"><img src="../../../edencosmetic/img/favicon-32.png" width="32"></div><span class="note">סט הפאביקון: icon.svg, 512, 180, 32</span></div>
</div></section>

<section><div class="lat">02 · החתימה</div><h2>העיקול</h2>
<div class="row"><div class="card lashes" style="flex:1;flex-direction:row;gap:22px">${lashes}</div>
<div style="flex:1;min-width:420px"><p style="font-size:20px;margin:0 0 10px">קו ישר שמתרומם ונהיה קימור. כמו ריס אחרי הרמה, וכמו הזנב של ה-E שהופך ל-C.</p><p class="note">בכל אייקון יש קו אחד באקסנט הוורוד שמתחיל ישר ומתעגל. הוא מפריד בין אזורים באתר, נטען יחד עם הסמל, נמצא בעיניים של לוטי, ובסרט הוא שורת ריסים שמתרוממת.</p></div></div></section>

<section><div class="lat">03 · צבעים</div><h2>תפקידים, לא שמות</h2>
<div class="row">${[['paper', 'רקע'], ['blush', 'לוחות רכים'], ['petal', 'עומק רך'], ['rose', 'גרפיקה בלבד (2.8:1)'], ['accent', 'פעולה ראשית, העיקול, קישורים'], ['cocoa', 'טקסט משני'], ['ink', 'טקסט, רקע כהה'], ['line', 'קווי מתאר']].map(([k, u]) => sw(k, u)).join('')}</div>
<div class="row" style="margin-top:14px">${[['real', 'תווית "מהשטח"'], ['render', 'תווית "הדמיה"'], ['concept', 'תווית "קונספט"'], ['demo', 'תווית "נתוני הדגמה"']].map(([k, u]) => sw(k, u)).join('')}</div>
<div class="ct">${Object.entries(P.contrast).map(([k, v]) => `<div><span>${k}</span><b>${v}:1</b></div>`).join('')}</div>
<p class="note" style="margin-top:14px">${P.note}</p></section>

<section><div class="lat">04 · אותיות</div><h2>סריף אלגנטי, טקסט נקי, אותיות לטיניות מרווחות</h2>
<div class="type">
 <div class="card"><div class="lat">Frank Ruhl Libre · 500 / 700 / 900</div><h3 style="font-size:56px;line-height:1.1">הרמה שנראית טבעית</h3><p class="note">כותרות ומחירים. <span style="font-family:'Frank Ruhl Libre';font-weight:700;font-size:26px">₪330 · ₪8 · ₪499</span></p></div>
 <div class="card"><div class="lat">Assistant · 300 / 400 / 600 / 700</div><p style="font-size:22px;margin:0">ערכה להרמת ריסים וגבות, שלושה שלבים. במלאי, משלוח חינם מעל ₪499.</p><p class="note">טקסט רץ, כפתורים, טפסים. קריא גם בגדלים קטנים.</p></div>
 <div class="card"><div class="lat">Cinzel · 500 / 700</div><h3 style="font-family:'Cinzel';font-weight:700;letter-spacing:.22em;font-size:34px">EDEN COSMETICS</h3><p class="note">רק לטינית: השם, תוויות בהירות. כמו האותיות בלוגו.</p></div>
</div></section>

<section><div class="lat">05 · אייקונים</div><h2>24 אייקונים, רשת 24px, קו 1.6, עיקול אחד בכל אחד</h2>
<div class="ig">${Object.entries(icons).map(([n, v]) => `<figure><img src="../img/i-${n}.svg">${v.label}</figure>`).join('')}</div>
<div class="ig" style="margin-top:12px">${Object.entries(icons).slice(0, 12).map(([n, v]) => `<figure class="d"><img src="../img/i-${n}-white.svg">${n}</figure>`).join('')}</div></section>

<footer><span>נגזר מ-${'brand.json'} · 29.9.2026</span><span>לוגו: הלקוחה · מערכת: AILGEN Studio</span></footer>
</body></html>`;
fs.writeFileSync(path.join(HERE, 'board.html'), html);
const r = spawnSync(process.execPath, [path.join(ROOT, '.claude/skills/ailgen-studio/scripts/shot.mjs'), path.join(HERE, 'board.html'), path.join(HERE, 'board.png'), '--w', '1600', '--h', '900', '--full'], { encoding: 'utf8' });
console.log(r.stdout.trim() || r.stderr);
