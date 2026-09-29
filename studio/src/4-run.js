<script>
/* ---------- static sections ---------- */
function renderStatic(){
 $('#getsList').innerHTML=GETS.map(([t,p,ic])=>`<div class="get"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ic}</svg><h3>${esc(t)}</h3><p>${esc(p)}</p></div>`).join('');
 $('#steps').innerHTML=STAGES.map(([t,s,w],i)=>`<li><span class="n">0${i+1}</span><b>${esc(t)}</b><p>${esc(s)}</p><span class="who">${esc(w)}</span></li>`).join('');
 $('#faqList').innerHTML=FAQ.map(([q,a],i)=>`<details${i===0?' open':''}><summary>${esc(q)}</summary><p>${esc(a)}</p></details>`).join('');
 const MARK={'קבוצת טלאור כראדי':a=>`<image href="img/tk-symbol.svg" x="38" y="4" width="44" height="44"/>`,'סוויצ׳ינג TV':a=>`<rect x="30" y="14" width="60" height="40" rx="6" fill="none" stroke="${a}" stroke-width="3"/><rect x="35" y="19" width="50" height="30" rx="3" fill="none" stroke="${a}" stroke-width="1.2" opacity=".6"/><rect x="72" y="42" width="5" height="5" fill="${a}"/>`,'AILGEN':a=>`<g transform="translate(46 12) scale(.29)"><polygon points="0,100 38,0 58,0 96,100 75,100 48,29 21,100" fill="#EEF0FB"/><rect x="40" y="67" width="16" height="16" fill="${a}"/></g>`,'עדן קוסמטיקס':a=>`<image href="img/ed-symbol.svg" x="42" y="6" width="36" height="36"/>`,'VERMEIL':a=>`<circle cx="60" cy="34" r="20" fill="none" stroke="${a}" stroke-width="2.5"/><circle cx="60" cy="34" r="14" fill="none" stroke="${a}" stroke-width="1" opacity=".7"/><text x="60" y="39" text-anchor="middle" font-family="Frank Ruhl Libre,serif" font-size="14" font-weight="700" fill="${a}">V</text>`};
 $('#cases').innerHTML=CASES.map(([n,inp,p,tags,url,acc,bg])=>`<article class="case"><div class="shot" style="background:${bg};display:grid;place-items:center"><svg viewBox="0 0 120 80" width="60%" aria-hidden="true">${MARK[n](acc)}<text x="60" y="72" text-anchor="middle" font-family="IBM Plex Mono" font-size="7.5" fill="${acc}">${esc(inp)}</text></svg></div><div class="b"><h3>${esc(n)}</h3><p>${esc(p)}</p><div class="tags">${tags.map(t=>`<span>${esc(t)}</span>`).join('')}</div><a class="go" href="${url}" target="_blank" rel="noopener">לאתר החי ↗</a></div></article>`).join('');
 renderMeter();
}
function renderPlans(){
 $('#planList').innerHTML=C.plans.map(p=>`<div class="plan${p.hot?' hot':''}"><h3>${esc(p.n)}</h3><div class="pr"><bdi dir="ltr">₪${esc(p.price)}</bdi> <small>חד פעמי</small></div><div class="mo">+ <bdi dir="ltr">₪${esc(p.mo)}</bdi> לחודש</div><ul>${p.items.map(i=>`<li>${esc(i)}</li>`).join('')}</ul><a class="btn" href="#order" data-plan="${esc(p.k)}">בוחרים ב"${esc(p.n)}"</a></div>`).join('');
 $('#planNote').textContent=C.planNote;
 $('#oPlan').innerHTML=C.plans.map((p,i)=>`<button type="button" class="opt" data-v="${esc(p.k)}" aria-pressed="${p.hot}">${esc(p.n)} · <bdi dir="ltr">₪${esc(p.price)}</bdi></button>`).join('');
 $$('#oPlan .opt').forEach(b=>b.onclick=()=>$$('#oPlan .opt').forEach(x=>x.setAttribute('aria-pressed',String(x===b))));
 $$('[data-plan]').forEach(a=>a.addEventListener('click',()=>$$('#oPlan .opt').forEach(x=>x.setAttribute('aria-pressed',String(x.dataset.v===a.dataset.plan)))));
}
function renderMeter(){
 const m=RUN.metrics; if(!m){$('#proof h3').hidden=true;$('#meterNote').hidden=true;return;}
 $('#meterNote').textContent=m.note;
 $('#meter').innerHTML=m.tiles.map(([v,l])=>`<div><b>${esc(v)}</b><span>${esc(l)}</span></div>`).join('');
 $('#phase').innerHTML=`<table><thead><tr>${m.head.map(h=>`<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${m.rows.map(r=>`<tr>${r.map((c,i)=>`<td${i?' class="n"':''}>${esc(c)}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
}

/* ---------- the pipeline board ---------- */
const out=()=>$('#out'), log=()=>$('#log');
function stageList(state){ $('#stages').innerHTML=STAGES.map(([t,s],i)=>`<li class="${state[i]||''}"><span class="st">${state[i]==='done'?'✓':i+1}</span><span><b>${esc(t)}</b><small>${esc(s)}</small></span><span class="tm" id="tm${i}">${state[i]==='done'&&RUNMODE==='example'?esc(RUN.times[i]):''}</span></li>`).join(''); }
let RUNMODE='example', running=false;
function logLine(k,t){ const p=document.createElement('p'); p.innerHTML=`<span class="k">${esc(k)}</span> ${esc(t)}`; log().appendChild(p); log().scrollTop=log().scrollHeight; }
function card(cls,title,html,label){ const d=document.createElement('div'); d.className='card '+cls; d.innerHTML=`<h4>${esc(title)}${label?` <span class="lbl ${label==='הדמיה'?'demo':''}" style="float:left">${esc(label)}</span>`:''}</h4>${html}`; out().appendChild(d); return d; }
const swatches=(pal,names)=>`<div class="sw">${pal.map((c,i)=>`<span style="background:${c}"><em>${esc(names?names[i]:c)}</em></span>`).join('')}</div><div style="height:18px"></div>`;

/* the real run: Talor Karadi (every card is a real output of the studio) */
const EXAMPLE=[
 [['brief','קלט: קישור · עסק: מיחזור, בנייה, בטון (B2B) · רוח: הנדסי וירוק'],()=>card('c3 brief','קריאת מצב',`<b>קבוצת טלאור כראדי</b><p>מיחזור פסולת בניין, הריסות, בטון, הנדסה ומיגון. קהל: קבלנים ויזמים. הרעיון: <strong style="color:#fff">המעגל נסגר</strong>.</p>`,'מהשטח')],
 [['intake','30 עמודים · 82 תמונות · 5 סרטוני יוטיוב · טלפונים, כתובות, נוסחאות'],()=>card('c3','איסוף',`<div class="spec"><b dir="ltr" style="text-align:right">30 · 82 · 5</b><small>עמודים · תמונות · סרטונים, ב-3:01 דקות, בנימוס (השהיה בין בקשות)</small></div><p style="color:var(--mist);font-size:13.5px;margin-top:8px">כל מספר נכנס לדף עובדות עם העמוד שממנו הגיע.</p>`,'מהשטח')],
 [['brand','סמל שורטט מחדש בווקטור · פלטה עם בדיקת ניגודיות · Rubik + IBM Plex Mono'],()=>{card('c2 icon','סמל ואייקון',`<div class="ic" style="background:#0B1B2E;padding:12px"><img src="img/tk-symbol.svg" alt="הסמל של טלאור כראדי בווקטור"></div><small style="color:var(--mist);font:500 12px var(--mono)">ארבעה להבים = ארבעה שלבים</small>`,'מהשטח'); card('c4','פלטה ופונטים',swatches(['#0B1B2E','#F4F5F0','#1E7A38','#9ACB63','#2560A8','#C9F03A'],['night','paper','green','leaf','blue','hi-vis'])+`<div class="spec" style="margin-top:8px"><b style="font-family:Rubik,var(--body);font-weight:800">מה שיוצא מהאתר, חוזר לבנות.</b><small>Rubik 800 · IBM Plex Mono לנתונים (כמו תעודת שקילה)</small></div>`,'מהשטח');}],
 [['site','אתר: כניסה מהלוגו · המעגל · 9 שירותים · מאזן פסולת · מפת מתקנים · פרויקטים'],()=>{card('c4','אתר',`<div class="shot"><img src="img/tk-site.webp" alt="מסך הפתיחה של האתר החדש של טלאור כראדי"><span class="lbl">צילום מסך אמיתי</span></div>`); card('c2','כלי הוכחה',`<div class="shot" style="aspect-ratio:auto;height:100%;min-height:140px"><img src="img/tk-calc.webp" alt="מחשבון מאזן הפסולת"><span class="lbl">מאזן פסולת</span></div>`);}],
 [['seo','SEO: 60 כתובות ישנות → 41 נשארות באותה כתובת ו-19 מקבלות 301 · 21 מדריכים · JSON-LD · מפת אתר'],()=>card('c3','SEO והגירה',`<div class="spec"><b dir="ltr" style="text-align:right">100%</b><small>מהכתובות הישנות שומרות על הערך שלהן. 0 ממצאים חמורים בבדיקה האוטומטית</small></div><p style="color:var(--mist);font-size:13.5px;margin-top:8px">לפני התיקון: כתובת אחת, h1 ריק ב-HTML, בלי מפת אתר.</p>`,'מהשטח')],
 [['admin','מרכז בקרה: פניות · תוכן · שאלות · פרויקטים · המלצות · מוקד דיגיטלי'],()=>{card('c2 icon','הדמות: סבבי',`<div class="ic" style="background:#F4F5F0;width:96px;height:110px">${sbSVG('happy')}</div><small style="color:var(--mist);font:500 12px var(--mono)">נולד מהלהבים · 8 מצבים</small>`,'דמות'); card('c4','מרכז בקרה וסוכן',`<div style="display:flex;flex-wrap:wrap;gap:8px">${['פניות עם סטטוס','מקור הפנייה (טופס / מאזן / מוקד)','עריכת טקסטים ומספרים','שאלות נפוצות','פרויקטים מיוטיוב ומהשטח','המלצות אמיתיות בלבד','מוקד דיגיטלי עם ידע נוסף'].map(t=>`<span class="lbl" style="background:rgba(63,82,224,.3)">${t}</span>`).join('')}</div>`);}],
 [['film','סרטון 29 שניות · סצנת חתימה: פסולת → מערבולת → מיגונית → לוגו · סבבי · 9:16 ו-4:5'],()=>card('c6','סרטון השקה',`<video controls playsinline preload="none" poster="img/tk-film-poster.jpg" src="img/tk-film.mp4" style="width:100%;max-height:420px;border-radius:10px;background:#000;margin-bottom:10px"></video><div class="story" id="exStory">${FILMSTRIP.map(([src,t])=>`<div style="background:#0B1B2E url(${src}) center/cover"><small style="background:rgba(7,11,46,.7);padding:2px 4px;border-radius:4px">${esc(t)}</small></div>`).join('')}</div>`,'מהשטח')],
 [['domain','דומיין קיים: talorkaradi.co.il · CNAME www + A @ · HTTPS אוטומטי'],()=>card('c3 dom','דומיין',`<div>talorkaradi.co.il<span>קיים, מחברים</span></div><div>www → CNAME<span>לספק האחסון</span></div><div>HTTPS<span>אוטומטי</span></div>`)],
 [['qa','אפס שגיאות · 390px בלי גלילה לצד · מקלדת · הפחתת תנועה · תוויות "מהשטח"'],()=>card('c3','בקרה',`<div style="display:grid;gap:6px;font-size:14px">${['אפס שגיאות בקונסול','נייד 390px בלי גלילה לצדדים','ניווט מקלדת ודיאלוגים','הפחתת תנועה','כל תמונה מסומנת','כל מספר עם מקור'].map(t=>`<span>✓ ${t}</span>`).join('')}</div>`)]];
const FILMSTRIP=[['img/tk-m1.webp','פתיחה'],['img/tk-m2.webp','חלקיקים'],['img/tk-m3.webp','מערבולת'],['img/tk-m4.webp','חומר נקי'],['img/tk-m5.webp','מיגונית'],['img/tk-m6.webp','המעגל נסגר'],['img/tk-f7.webp','סבבי']];

function showExample(){ RUNMODE='example'; stageList(STAGES.map(()=> 'done')); out().innerHTML=''; log().innerHTML='';
 EXAMPLE.forEach(([[k,t],f])=>{logLine(k,t); f();});
 $('#bTitle').textContent=RUN.host; $('#bClock').textContent='ריצה מלאה · נמדדה';
 $('#bFoot').innerHTML='כל כרטיס כאן הוא תוצר אמיתי של הסטודיו מהריצה על talorkaradi.co.il. הזמנים בצד: זמן אמיתי לכל שלב. <a href="https://claude.ai/artifact/7aj1NcY14KNP9ygLgadNYL" target="_blank" rel="noopener" style="color:#FFB23E">לאתר החי ↗</a>'; }
async function replayExample(){
 if(running)return; running=true; RUNMODE='example'; const st=STAGES.map(()=>''); out().innerHTML=''; log().innerHTML=''; const t0=performance.now();
 const clock=setInterval(()=>$('#bClock').textContent=((performance.now()-t0)/1000).toFixed(1)+'s · הדמיה מואצת',100);
 for(let i=0;i<EXAMPLE.length;i++){ st[i]='run'; stageList(st); const [[k,t],f]=EXAMPLE[i]; logLine(k,'…'); await sleep(650); log().lastChild.remove(); logLine(k,t); f(); await sleep(520); st[i]='done'; stageList(st); }
 clearInterval(clock); $('#bClock').textContent='ריצה מלאה · נמדדה'; running=false;
}

/* a new business, from an idea or a name: Claude drafts the brand live (sample), or the spirit matrix offline */
let sample=null;
async function brandSpec(mode,input){
 const prompt=`אתה מנוע המיתוג של סטודיו AILGEN. לקוח ${mode==='name'?'נתן רק שם של עסק':'תיאר רעיון לעסק'}: "${input.slice(0,600)}".
החזר JSON בלבד, בעברית, במבנה הזה בדיוק:
{"name":"שם העסק","type":"סוג העסק במילים ספורות","spirit":"הרוח ב-2–3 מילים","idea":"הרעיון של המותג כתמונה, משפט אחד","claim":"כותרת ראשית לאתר, עד 8 מילים","sub":"משפט משנה לאתר, עד 22 מילים","palette":{"bg":"#hex","ink":"#hex","accent":"#hex","accent2":"#hex"},"display":"פונט כותרות","body":"פונט טקסט","motif":"אחד מ: pixels, particles, light, ink, iris, wipe, spin","mascot":"כן / לא, ומשפט למה","tool":"כלי ההוכחה באתר: שם ומה הוא עושה, משפט אחד","toolCta":"כפתור של הכלי, 2–3 מילים","sections":["6 שמות סקשנים קצרים"],"film":["7 סצנות לסרטון של 26 שניות, כל אחת עד 7 מילים"],"domains":["3 הצעות דומיין לטיניות, בלי www"]}
כללים: הפונטים רק מתוך: ${FONTS_OK.join(', ')}. ניגודיות ink על bg לפחות 7:1. בלי המלצות, מספרים או לקוחות מומצאים. בלי קלישאות כמו "מהפכה" או "העתיד כבר כאן".`;
 if(sample){ try{ const j=await sample.json(prompt,{modelTier:'quick'}); if(j&&j.palette&&j.claim)return {...j,source:'claude'}; }catch(_){} }
 const sp=SPIRITS.find(s=>s.re.test(input))||DEFAULT_SPIRIT, nm=mode==='name'?input.trim():(input.split(/[,.]/)[0].slice(0,28));
 return {name:nm,type:sp.type,spirit:sp.spirit,idea:'הדבר הכי אמיתי בעסק, כתמונה אחת שחוזרת בכל מקום',claim:`${nm}. בדיוק מה שחיפשתם.`,sub:'כאן תופיע הטענה החזקה ביותר שאפשר להוכיח, מתוך המספרים והלקוחות האמיתיים של העסק.',palette:{bg:sp.pal[0],ink:sp.pal[1],accent:sp.pal[2],accent2:sp.pal[3]},display:sp.fonts[0],body:sp.fonts[1],motif:sp.motif,mascot:sp.mascot,tool:sp.tool,toolCta:'נסו עכשיו',sections:sp.sections,film:['הרגע של הלקוח','הגילוי: הלוגו','ההוכחה במספר','מה מקבלים','מילים של לקוח','למה אנחנו','קריאה לפעולה'],domains:[],source:'matrix'};
}
function loadFont(f){ if(!FONTS_OK.includes(f))return; const id='gf-'+f.replace(/\s/g,''); if(document.getElementById(id))return; const l=document.createElement('link'); l.id=id; l.rel='stylesheet'; l.href=`https://fonts.googleapis.com/css2?family=${f.replace(/\s/g,'+')}:wght@400;700&display=swap`; document.head.appendChild(l); }
const hexOk=h=>/^#[0-9a-f]{6}$/i.test(h||'');
async function runNew(mode,input){
 if(running)return; running=true; RUNMODE='new'; const st=STAGES.map(()=>''); out().innerHTML=''; log().innerHTML=''; const t0=performance.now();
 $('#bTitle').textContent=input.slice(0,60); $('#bFoot').textContent='';
 const clock=setInterval(()=>$('#bClock').textContent=((performance.now()-t0)/1000).toFixed(1)+'s',100);
 const step=async(i,k,t,ms=500)=>{st[i]='run'; stageList(st); logLine(k,t); await sleep(ms);};
 const done=i=>{st[i]='done'; stageList(st);};
 await step(0,'brief',mode==='name'?'קלט: שם בלבד. מחקר קטגוריה ותחרות':'קלט: רעיון בכתיבה. מזהים סוג עסק ורוח');
 const specP=brandSpec(mode,input);
 await step(1,'research',sample?'Claude מנסח את התדריך…':'בלי Claude בתצוגה הזו: טבלת הרוח של הסטודיו',400);
 const s=await specP; done(0); done(1);
 const P=s.palette||{}; ['bg','ink','accent','accent2'].forEach((k,i)=>{if(!hexOk(P[k]))P[k]=DEFAULT_SPIRIT.pal[i];});
 const disp=FONTS_OK.includes(s.display)?s.display:'Heebo', bod=FONTS_OK.includes(s.body)?s.body:'Heebo'; loadFont(disp); loadFont(bod);
 const lab=s.source==='claude'?'הדמיה':'הדמיה';
 card('c3 brief','תדריך',`<b>${esc(s.name)}</b><p>${esc(s.type)} · ${esc(s.spirit)}</p><p>${esc(s.idea)}</p>`,lab);
 await step(2,'brand',`פלטה, פונטים (${disp} + ${bod}), סמל ראשוני`);
 const ini=(s.name||'?').trim()[0]||'?';
 card('c2 icon','אייקון ראשוני',`<div class="ic" style="background:${P.ink}"><svg viewBox="0 0 88 88" width="88" height="88" aria-hidden="true"><rect x="14" y="14" width="60" height="60" rx="${s.motif==='pixels'?6:30}" fill="${P.accent}"/><rect x="50" y="50" width="16" height="16" fill="${P.accent2}"/><text x="40" y="54" text-anchor="middle" font-family="${esc(disp)}" font-size="34" font-weight="700" fill="${P.bg}">${esc(ini)}</text></svg></div><small style="color:var(--mist);font:500 12px var(--mono)">הסמל הסופי נולד מהלוגו שלכם</small>`,lab);
 card('c4','פלטה ופונטים',swatches([P.bg,P.ink,P.accent,P.accent2],['bg','ink','accent','accent2'])+`<div class="spec" style="margin-top:8px"><b style="font-family:'${esc(disp)}',var(--body)">${esc(s.claim)}</b><small>${esc(disp)} · ${esc(bod)} · מוטיב: ${esc(s.motif)}</small></div>`,lab);
 done(2);
 await step(3,'site',`אתר: ${(s.sections||[]).slice(0,6).join(' · ')}`,600);
 card('c4','אתר',`<div class="mock" style="background:${P.bg};color:${P.ink};font-family:'${esc(bod)}',var(--body)"><div class="mn"><i style="background:${P.accent}"></i>${esc(s.name)}<span>${(s.sections||[]).slice(0,4).map(x=>`<em style="font-style:normal">${esc(x)}</em>`).join('')}</span></div><div class="mh"><div><b style="font-family:'${esc(disp)}',var(--display)">${esc(s.claim)}</b><p>${esc(s.sub)}</p><u style="background:${P.accent};color:${P.bg}">${esc(s.toolCta||'דברו איתנו')}</u></div><div class="tool" style="background:${P.ink};color:${P.bg}"><b style="font-size:12px">${esc((s.tool||'').split(':')[0])}</b><p style="opacity:.85">${esc(s.tool)}</p></div></div></div>`,lab);
 card('c2','כלי הוכחה',`<p style="font-size:14.5px;line-height:1.5">${esc(s.tool)}</p><p style="color:var(--mist);font-size:13px;margin-top:8px">כל תוצאה של הכלי מגיעה כפנייה למרכז הבקרה.</p>`,lab);
 done(3); await step(4,'seo','ארכיטקטורת כתובות: כל שירות ומדריך בכתובת משלו',350);
 card('c3','כתובות וחיפוש',`<div style="display:grid;gap:6px;font-size:14px"><span dir="ltr">/</span>${(s.sections||[]).slice(0,6).map(x=>`<span>/${esc(x)}/</span>`).join('')}</div><p style="color:var(--mist);font-size:13px;margin-top:8px">לכל כתובת: title, description, h1, canonical ו-JSON-LD, ומפת אתר ו-robots מהיום הראשון.</p>`,lab);
 done(4); await step(5,'admin','מרכז בקרה ומוקד דיגיטלי מחוברים',350); done(5);
 await step(6,'film',`סרטון: ${(s.film||[]).length} סצנות · מוטיב ${s.motif}`,500);
 card('c6','סטוריבורד לסרטון',`<div class="story">${(s.film||[]).slice(0,7).map((t,i)=>`<div style="background:${i%2?P.ink:P.accent};color:${i%2?P.bg:P.ink}"><small>0${i+1}</small>${esc(t)}</div>`).join('')}</div>`,lab);
 done(6); await step(7,'domain','הצעות לדומיין',300);
 const doms=(s.domains||[]).filter(d=>/^[a-z0-9.-]+\.[a-z.]+$/i.test(d)).slice(0,3);
 card('c3 dom','דומיין',(doms.length?doms:['(יוצע בשלב ההזמנה)']).map(d=>`<div>${esc(d)}<span>זמינות תיבדק בהזמנה</span></div>`).join(''),lab);
 done(7); await step(8,'qa','שערי איכות: אדם בודק לפני פרסום',300);
 card('c3','מה קורה עכשיו',`<p style="font-size:14.5px;line-height:1.55">בהזמנה אמיתית, הסטודיו מריץ את כל השלבים עד הסוף: לוגו אמיתי, אתר חי, סרטון מרונדר. זו טיוטה ראשונה שנוצרה עכשיו.</p>`);
 done(8); clearInterval(clock);
 $('#bClock').textContent=((performance.now()-t0)/1000).toFixed(1)+'s · '+(s.source==='claude'?'נוצר עכשיו עם Claude':'טבלת הרוח (בלי Claude)');
 $('#bFoot').textContent=s.source==='claude'?'התדריך, הפלטה, הפונטים והסטוריבורד נוצרו עכשיו על ידי Claude, מהקלט שלכם. בהזמנה אמיתית הכול נבנה עד הסוף.':'Claude לא זמין בתצוגה הזו, אז הסטודיו השתמש בטבלת הרוח שלו לפי סוג העסק. בהזמנה אמיתית הכול נבנה מהעסק שלכם.';
 $('#oIn').value=input; running=false;
}

/* launcher */
let mode='url';
$$('.seg button').forEach(b=>b.addEventListener('click',()=>{ mode=b.dataset.m; $$('.seg button').forEach(x=>x.setAttribute('aria-selected',String(x===b)));
 const url=mode==='url'; $('#lIn').hidden=!url&&mode==='idea'; $('#lIdea').hidden=mode!=='idea'; $('#lIn').dir=url?'ltr':'rtl';
 $('#lIn').value=url?'https://talorkaradi.co.il/':''; $('#lIn').placeholder=mode==='name'?'למשל: "אור ים"':'';
 $('#lHint').textContent=url?'הדגמה על אתר אמיתי: טלאור כראדי. הריצה המלאה נמדדה, והתוצרים למטה אמיתיים.':mode==='idea'?'Claude ינסח תדריך, פלטה, פונטים, אתר וסטוריבורד, כאן ועכשיו.':'רק שם. הסטודיו יחקור את הקטגוריה ויציע רוח, צבעים ורעיון.';
 const ex=$('#lEx'); ex.hidden=url; ex.innerHTML=(mode==='idea'?['בית קפה קטן בחיפה, קפה מיוחד וחם, סטודנטים וזוגות','קליניקה לפיזיותרפיה ספורטיבית בתל אביב','חנות פרחים שמרכיבה זרים לפי מצב רוח']:['אור ים','נגריית העמק','סטודיו פילאטיס ליה']).map(t=>`<button type="button">${esc(t)}</button>`).join('');
 $$('button',ex).forEach(x=>x.onclick=()=>{ if(mode==='idea')$('#lIdea').value=x.textContent; else $('#lIn').value=x.textContent; });
}));
$('#launch').addEventListener('submit',async e=>{ e.preventDefault();
 const v=(mode==='idea'?$('#lIdea').value:$('#lIn').value).trim();
 $('#demo').scrollIntoView({behavior:still()?'auto':'smooth',block:'start'});
 if(mode==='url'){ if(!v||/talorkaradi/i.test(v))return replayExample();
  $('#oIn').value=v; await replayExample(); logLine('note','סריקה של אתר אמיתי רצה במנוע של הסטודיו, מחוץ לדפדפן. הקישור שלכם הועבר לטופס ההזמנה.'); return; }
 if(!v){ const f=mode==='idea'?$('#lIdea'):$('#lIn'); f.focus(); return; }
 $('#lGo').disabled=true; try{ await runNew(mode,v); } finally{ $('#lGo').disabled=false; } });
</script>
