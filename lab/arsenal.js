/* AILGEN Lab · the arsenal: every model the lab can call, profiled (lab/arsenal.json, built by cloud/lab/arsenal/build.mjs).
   The director's view: which tool for which job, ranked by independent measurements; how strict each tool's filter is (stars:
   ★★★ = the least filtered); the junk pool (old, dominated or unrunnable models, each with its rule and its replacement); and the
   full profile of any model: lineage, power, weakness, Hebrew, tips, orchestration gotchas, measurements and sources.
   paid.js and unified/ui.js import the same data, so a model's stars and junk verdict read the same everywhere. */
const L = window.LAB, $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)], esc = L.esc;
const store = { get(k) { try { return localStorage.getItem(k); } catch { return null; } }, set(k, v) { try { localStorage.setItem(k, v); } catch {} } };

export const ARS = await fetch('arsenal.json').then(r => r.json()).catch(() => null);
export const MOD = ARS ? ARS.models : {};
const SECTOR_OF = { text: 'text', image: 'image', video: 'video', voice: 'voice', listen: 'listen', music: 'music', embed: 'utility', classify: 'utility', vision: 'utility', translate: 'utility', other: 'utility' };
const SECTORS = [['text', 'טקסט'], ['image', 'תמונה'], ['video', 'וידאו'], ['voice', 'הקראה'], ['listen', 'תמלול'], ['music', 'מוזיקה'], ['utility', 'כלי עזר']];
const TIER = { top: 'מובחרים', mid: 'בינוניים', low: 'חלשים וזולים', free: 'חינם', junk: 'מאגר הפסולת' };
const CONF = { high: 'ביטחון גבוה', medium: 'ביטחון בינוני', low: 'ביטחון נמוך' };
export const STAR_NAME = { 3: 'הכי פחות מצונזר', 2: 'מתירני', 1: 'פתוח מעט', 0: 'קשוח' };
const usd = v => v == null ? '—' : v === 0 ? 'חינם ($0)' : '$' + (v >= 1 ? v.toFixed(2) : v >= 0.01 ? v.toFixed(3) : v.toPrecision(2));

/* ---------- small pieces the other tabs use ---------- */
export function starsHTML(id, { all = false } = {}) {
  const m = MOD[id]; if (!m || !m.stars) return '';
  const n = m.stars.n;
  if (n == null) return all ? '<span class="stars s-na" title="סינון התוכן לא נמדד עדיין">לא נמדד</span>' : '';
  if (n === 0) return all ? `<span class="stars s0" title="${esc(m.stars.why || '')}">קשוח</span>` : '';
  return `<span class="stars s${n}" title="${esc(STAR_NAME[n] + ' · ' + (m.stars.why || ''))}" aria-label="${n} כוכבים: ${esc(STAR_NAME[n])}">${'★'.repeat(n)}</span>`;
}
export const isJunk = id => MOD[id]?.verdict === 'junk';
export function measureLine(m) {
  const q = m.measured || {}, parts = [];
  if (q.aa) parts.push(`מדד AA ${q.aa.index}`);
  if (q.cw) parts.push(`כתיבה #${q.cw.rank}`);
  if (q.t2i) parts.push(`תמונה #${q.t2i.rank}`); else if (q.edit) parts.push(`עריכה #${q.edit.rank}`);
  if (q.t2v) parts.push(`וידאו #${q.t2v.rank}`); else if (q.i2v) parts.push(`תמונה→וידאו #${q.i2v.rank}`); else if (q.vedit) parts.push(`עריכת וידאו #${q.vedit.rank}`);
  if (q.tts) parts.push(`קול #${q.tts.rank}`);
  if (q.stt) parts.push(`${q.stt.wer}% שגיאות`);
  return parts.slice(0, 2).join(' · ');
}
const name = id => MOD[id]?.name || id.split('/').pop();
const jobName = (sector, j) => (ARS.jobs[`${sector}:${j}`] || Object.values(ARS.jobs).find(x => x.job === j) || {}).text || j;

/* ---------- the profile ---------- */
export function profileHTML(id) {
  const m = MOD[id]; if (!m) return '';
  const fam = ARS.families[m.fam] || {}, q = m.measured || {}, sec = SECTOR_OF[m.sector] || m.sector;
  const rows = [];
  if (q.aa) rows.push(['מדד האינטליגנציה (Artificial Analysis)', `${q.aa.index}${q.aa.estimated ? ' (הערכה)' : ''}`, q.aa.nonHallucination != null ? `עמידות להזיות ${q.aa.nonHallucination}${q.aa.tokensPerSecond ? ` · ${q.aa.tokensPerSecond} טוקנים לשנייה` : ''}` : '']);
  if (q.cw) rows.push(['כתיבה יצירתית (EQ-Bench)', `#${q.cw.rank} · ${q.cw.elo}`, `סלופ ${q.cw.slop} (נמוך = פחות ניסוחי AI)`]);
  if (q.speech) rows.push(['פתיחות לדיבור שנוי במחלוקת (SpeechMap)', `${q.speech.complete}% מלא`, `התחמקות ${q.speech.evasive}% · סירוב ${q.speech.denial}%`]);
  if (q.speechAlt) rows.push(['SpeechMap, המצב השני', `${q.speechAlt.complete}% מלא`, `סירוב ${q.speechAlt.denial}%`]);
  for (const [k, t] of [['t2i', 'ארנת טקסט לתמונה'], ['edit', 'ארנת עריכת תמונה'], ['t2v', 'ארנת טקסט לווידאו'], ['i2v', 'ארנת תמונה לווידאו'], ['vedit', 'ארנת עריכת וידאו'], ['tts', 'ארנת הקראה']])
    if (q[k]) rows.push([t + ' (Artificial Analysis)', `#${q[k].rank} · ${q[k].elo}`, q[k].votes ? `${Number(q[k].votes).toLocaleString('he-IL')} הצבעות` : '']);
  if (q.stt) rows.push(['שיעור שגיאות בתמלול (Artificial Analysis)', `${q.stt.wer}%`, `מקום ${q.stt.rank}`]);
  if (q.music) rows.push(['ארנת מוזיקה (Artificial Analysis)', [q.music.instrumental != null ? `אינסטרומנטלי ${q.music.instrumental}` : '', q.music.vocals != null ? `שירה ${q.music.vocals}` : ''].filter(Boolean).join(' · '), '']);
  const cal = m.stars?.calibration;
  const st = m.stars || {};
  const head = `<div class="ph">${starsHTML(id, { all: true })}<span class="tchip t-${esc(m.tier)}">${esc(TIER[m.tier] || m.tier)}</span>${m.keepBy ? '<span class="tchip kexc" title="נשאר למרות כלל: יכולת ייחודית, מסנן פתוח יותר, או רצפת מחיר">נשאר בחריגה</span>' : ''}${m.paid ? '' : '<span class="tchip t-free">Workers AI חינם</span>'}${m.released ? `<span class="pdate">יצא ${esc(m.released)}</span>` : ''}<span class="pprice">עבודה טיפוסית: <b>${esc(usd(m.price?.usd))}</b>${m.price?.unit ? ` <small>(${esc(m.price.unit)})</small>` : ''}</span></div>`;
  const junk = m.verdict === 'junk' ? `<div class="pjunk"><b>במאגר הפסולת · ${esc(m.rule)} ${esc(ARS.rules[m.rule]?.name || '')}</b><p>${esc(m.why)}</p>${m.instead.length ? `<p class="pinst">במקומו: ${m.instead.map(r => `<button type="button" class="plink" data-prof="${esc(r)}" dir="ltr">${esc(name(r))}</button>`).join(' ')}</p>` : ''}<p class="hint">${esc(ARS.rules[m.rule]?.text || '')}</p></div>` : '';
  const dl = [['השושלת', m.lineage], ['הכוח', m.power], ['החולשה', m.weak], ['עברית', m.hebrew]].filter(([, v]) => v);
  return `<section class="prof">${head}${junk}
   ${dl.length ? `<dl class="pdl">${dl.map(([k, v]) => `<dt>${k}</dt><dd>${esc(v)}</dd>`).join('')}
    <dt>מסנן תוכן</dt><dd>${st.n == null ? 'לא נמדד עדיין. ' : esc(STAR_NAME[st.n]) + '. '}${esc(st.why || '')} <span class="hint">(${esc(CONF[st.conf] || '')}${st.basis?.length ? ' · ' + esc(st.basis.map(b => ({ speechmap: 'SpeechMap', lab: 'כיול המעבדה', schema: 'מסמך המודל', documented: 'מדיניות מתועדת' }[b] || b)).join(', ')) : ''})</span></dd></dl>` : ''}
   ${cal && cal.labels ? `<details class="pcal"><summary>כיול המעבדה: ${cal.score != null ? `${cal.score}/${cal.max}` : `${cal.delivered}/${cal.of}`}</summary><ul>${Object.entries(cal.labels).map(([p, v]) => `<li><b>${esc(p)}</b>: ${esc({ full: 'ענה במלואו', soft: 'ריכך', refused: 'סירב', none: 'לא ענה', delivered: 'נמסרה', softened: 'רוככה', blocked: 'נחסמה' }[v] || v)}</li>`).join('')}</ul></details>` : ''}
   ${m.jobs.length ? `<p class="pjobs"><span>טוב ל:</span>${m.jobs.map(j => `<span class="jchip">${esc(jobName(sec, j))}</span>`).join('')}</p>` : ''}
   ${m.tips.length ? `<h4>איך לכוון אותו</h4><ul class="pl">${m.tips.map(t => `<li>${esc(t)}</li>`).join('')}</ul>` : ''}
   ${m.gotchas.length ? `<h4>מלכודות בזרימה</h4><ul class="pl warn">${m.gotchas.map(t => `<li>${esc(t)}</li>`).join('')}</ul>` : ''}
   ${rows.length ? `<h4>מדידות בלתי תלויות</h4><table class="tbl pmeas"><tbody>${rows.map(([a, b, c]) => `<tr><th scope="row">${esc(a)}</th><td class="n">${esc(b)}</td><td>${esc(c)}</td></tr>`).join('')}</tbody></table>` : ''}
   <details class="pfam"><summary>היצרן: ${esc(fam.name || m.maker)}${fam.country ? ' · ' + esc(fam.country) : ''}</summary><p>${esc(fam.roots || '')}</p>${fam.filter ? `<p><b>מסנן:</b> ${esc(fam.filter)}</p>` : ''}${fam.hebrew ? `<p><b>עברית:</b> ${esc(fam.hebrew)}</p>` : ''}${fam.via ? `<p class="hint">איך מגיעים אליו: ${esc(fam.via)}</p>` : ''}</details>
   <p class="psrc">מקורות: ${m.sources.map(s => ARS.sources[s] ? `<a href="${esc(ARS.sources[s].url)}" target="_blank" rel="noopener">${esc(ARS.sources[s].title)}</a>` : '').filter(Boolean).join(' · ')}${m.docs ? ` · <a href="${esc(m.docs)}" target="_blank" rel="noopener">התיעוד של היצרן</a>` : ''}</p>
  </section>`;
}

/* ---------- the arsenal tab ---------- */
let SECT = store.get('arSect') || 'text', JOB = store.get('arJob') || '';
function rowHTML(m) {
  return `<button type="button" class="arow${m.verdict === 'junk' ? ' j' : ''}" data-prof="${esc(m.id)}">
   <span class="an"><b dir="ltr">${esc(m.name)}</b><small>${esc(m.maker)}${m.paid ? '' : ' · חינם'}</small></span>
   <span class="as">${starsHTML(m.id)}</span>
   <span class="at"><span class="tchip t-${esc(m.tier)}">${esc(TIER[m.tier] || m.tier)}</span></span>
   <span class="am">${esc(measureLine(m))}</span>
   <span class="ap">${esc(usd(m.price?.usd))}</span>
   <span class="aw">${esc((m.verdict === 'junk' ? m.why : m.power || '').slice(0, 150))}</span>
  </button>`;
}
function render() {
  if (!ARS) { $('#arBody').innerHTML = '<p class="err">הארסנל לא נטען.</p>'; return; }
  const q = $('#arQ').value.trim().toLowerCase(), loose = $('#arLoose').checked, junk = $('#arJunk').checked;
  $('#arSeg').innerHTML = SECTORS.map(([id, t]) => `<button type="button" role="tab" data-s="${id}" aria-selected="${id === SECT}">${t} <small>${Object.values(MOD).filter(m => (SECTOR_OF[m.sector] || m.sector) === id && m.verdict === 'keep').length}</small></button>`).join('');
  const jobs = Object.values(ARS.jobs).filter(j => j.sector === SECT && j.models.length);
  if (JOB && !jobs.some(j => j.job === JOB)) JOB = '';
  $('#arJobs').innerHTML = `<button type="button" data-j="" aria-pressed="${!JOB}">כל המודלים</button>` + jobs.map(j => `<button type="button" data-j="${esc(j.job)}" aria-pressed="${j.job === JOB}">${esc(j.text)}</button>`).join('');
  const inSect = m => (SECTOR_OF[m.sector] || m.sector) === SECT;
  const hay = m => (m.id + ' ' + m.name + ' ' + m.maker + ' ' + (m.power || '') + ' ' + (m.why || '')).toLowerCase();
  let list;
  if (JOB) {
    const j = ARS.jobs[`${SECT}:${JOB}`];
    list = j.models.map(id => MOD[id]).filter(m => (!loose || (m.stars?.n ?? 0) >= 1) && (!q || hay(m).includes(q)));
    $('#arBody').innerHTML = `<p class="slead">${esc(j.text)}: ${list.length} מודלים, מהחזק לחלש לפי ${esc({ aa: 'מדד האינטליגנציה', cw: 'הכתיבה היצירתית', t2i: 'ארנת התמונה', edit: 'ארנת העריכה', t2v: 'ארנת הווידאו', i2v: 'ארנת תמונה לווידאו', vedit: 'ארנת עריכת הווידאו', tts: 'ארנת הקול', stt: 'שיעור השגיאות', music: 'ארנת המוזיקה', cheap: 'המחיר לעבודה', ctx: 'אורך ההקשר', loose: 'פתיחות המסנן' }[j.by] || j.by)}.</p>
     <div class="alist">${list.map(rowHTML).join('') || '<p class="empty">אין מודלים שמתאימים.</p>'}</div>`;
  } else {
    const keep = Object.values(MOD).filter(m => inSect(m) && m.verdict === 'keep' && (!loose || (m.stars?.n ?? 0) >= 1) && (!q || hay(m).includes(q)));
    const order = { top: 0, mid: 1, low: 2, free: 3 }, qv = m => m.measured?.aa?.index ?? (m.measured?.t2i?.elo ?? m.measured?.t2v?.elo ?? m.measured?.tts?.elo ?? 0) / 25;
    keep.sort((a, b) => order[a.tier] - order[b.tier] || qv(b) - qv(a));
    const bin = Object.values(MOD).filter(m => inSect(m) && m.verdict === 'junk' && (!q || hay(m).includes(q)));
    $('#arBody').innerHTML = `<div class="alist">${keep.map(rowHTML).join('') || '<p class="empty">אין מודלים שמתאימים.</p>'}</div>
     ${bin.length ? `<details class="abin"${junk ? ' open' : ''}><summary>מאגר הפסולת בתחום הזה <span>${bin.length}</span></summary><p class="hint">נשארים להרצה כשבוחרים אותם במפורש; לא מופיעים בספריית הזרימות ובבחירות של הבמאי.</p>
      ${['R1', 'R2', 'R3', 'R4'].map(r => { const l = bin.filter(m => m.rule === r); return l.length ? `<h3>${r} · ${esc(ARS.rules[r].name)} <small>${l.length}</small></h3><p class="hint">${esc(ARS.rules[r].text)}</p><div class="alist">${l.map(rowHTML).join('')}</div>` : ''; }).join('')}</details>` : ''}`;
  }
  $$('#arBody [data-prof]').forEach(b => b.onclick = () => openProfile(b.dataset.prof));
}
export function openProfile(id) {
  const m = MOD[id]; if (!m) return;
  const d = $('#arDlg');
  $('#arDlgP').textContent = `${m.maker} · ${TIER[m.tier] || m.tier}`;
  $('#arDlgT').textContent = m.name; $('#arDlgId').textContent = m.id;
  const runnable = m.live !== false;
  $('#arDlgB').innerHTML = profileHTML(id) + (runnable ? `<div class="actions"><button class="go" type="button" id="arRun">${m.paid ? 'פתיחה להרצה' : 'לנסות במעבדה'}</button></div>` : '');
  $$('#arDlgB [data-prof]').forEach(b => b.onclick = () => openProfile(b.dataset.prof));
  const run = $('#arRun');
  if (run) run.onclick = () => { d.close(); m.paid ? window.LABPAID?.open(id) : L.openWith?.(id); };
  if (!d.open) d.showModal();
  d.querySelector('.sheetbody').scrollTop = 0;
}

if (ARS && $('#p-arsenal')) {
  const c = ARS.count;
  $('#arLead').textContent = `${c.total} מודלים, כל מה שהמעבדה יכולה להריץ. ${c.keep} בארסנל ו-${c.junk} במאגר הפסולת. לכל מודל פרופיל מלא: מאיפה הוא בא, במה הוא הכי חזק, איפה הוא נופל, עברית, איך לכוון אותו, ומדידות בלתי תלויות. הכוכבים מסמנים את הפחות מצונזרים: ★★★ הכי פחות.`;
  $('#arRules').innerHTML = `<h3>הכוכבים</h3><ul>${ARS.stars.scale.map(s => `<li><b>${s.n ? '★'.repeat(s.n) : 'בלי כוכב'}</b> ${esc(s.text)}</li>`).join('')}</ul><p class="hint">${esc(ARS.stars.text)}</p><p class="hint">${esc(ARS.stars.media)}</p>
   <h3>מאגר הפסולת</h3><ul>${['R1', 'R2', 'R3', 'R4', 'K'].map(r => `<li><b>${r} · ${esc(ARS.rules[r].name)}</b> ${esc(ARS.rules[r].text)} ${r !== 'K' ? `<small>(${c.byRule[r] || 0})</small>` : `<small>(${c.keptByException})</small>`}</li>`).join('')}</ul><p class="hint">${esc(ARS.rules.typical.text)}</p>
   <p class="hint">נבנה ${esc(ARS.built.slice(0, 10))} · מחקר ${esc(ARS.researched)} · לוחות: Artificial Analysis ${esc(ARS.boards.aaLLM)}, SpeechMap ${esc(ARS.boards.speechmap)}, EQ-Bench ${esc(ARS.boards.eqbench)}${ARS.boards.lab ? ' · כיול המעבדה ' + esc(ARS.boards.lab.slice(0, 10)) : ''}</p>`;
  $('#arSeg').addEventListener('click', e => { const b = e.target.closest('[data-s]'); if (!b) return; SECT = b.dataset.s; JOB = ''; store.set('arSect', SECT); store.set('arJob', ''); render(); });
  $('#arJobs').addEventListener('click', e => { const b = e.target.closest('[data-j]'); if (!b) return; JOB = b.dataset.j; store.set('arJob', JOB); render(); });
  ['#arQ', '#arLoose', '#arJunk'].forEach(s => $(s).addEventListener('input', render));
  $('#arDlg').addEventListener('click', e => { if (e.target === $('#arDlg')) $('#arDlg').close(); });
  render();
}
window.LABARSENAL = { MOD, openProfile, starsHTML, profileHTML, isJunk };
