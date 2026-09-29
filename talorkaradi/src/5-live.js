<script>
/* ================= legal ================= */
let LEGAL=null;
$$('[data-legal]').forEach(b=>b.addEventListener('click',async()=>{lastFocus=b; const k=b.dataset.legal, d=$('#lg');
 $('#lgT').textContent=k==='privacy'?'מדיניות פרטיות':'הצהרת נגישות'; $('#lgTxt').textContent='טוען…'; if(!d.open)d.showModal();
 if(!LEGAL){try{LEGAL=await (await fetch('legal.json')).json();}catch(_){LEGAL={};}}
 const own=k==='privacy'?C.privacy:C.a11yText; $('#lgTxt').textContent=(own&&own.trim())||LEGAL[k]||'המסמך אינו זמין כרגע. אפשר לפנות אלינו במוקד ‎*9084.';}));

/* ================= the digital dispatcher (agent) ================= */
let sample=null, hist=[], busyA=false;
const body=$('#advBody'), ain=$('#advIn');
function bb(cls,text){const b=document.createElement('div'); b.className='bb '+cls; b.textContent=text; body.appendChild(b); body.scrollTop=body.scrollHeight; return b;}
bb('ai','שלום, כאן המוקד הדיגיטלי של טלאור כראדי. אפשר לשאול על מכולות, הסכם להיתר וטופס 4, מיחזור, בטון, הריסות או מיגון.');
function advPrompt(){
 const svcs=Object.values(SVCS).map(v=>`${v.t}: ${v.body.join(' ')} ${v.list?('כולל: '+v.list.join(', ')+'.'):''}`).join('\n');
 const faq=C.faq.map(([q,a])=>`ש: ${q} ת: ${a}`).join('\n');
 return `אתה המוקד הדיגיטלי של קבוצת טלאור כראדי בע"מ: פינוי ומיחזור פסולת בניין, הריסות, בטון מובא, הנדסה אזרחית ומיגון, תשתיות ושיקום קרקע. הקהל: קבלנים, יזמים, מנהלי עבודה ורשויות.
עובדות שמותר להשתמש בהן בלבד:
- מאז 2008 (עבודות עפר), מפעל המיחזור הראשון ב-2015, הבעלים ליאור כראדי. כ-4 חברות בת.
- 5 מתקנים: ${SITES.map(s=>s.n+' ('+s.d+')').join('; ')}.
- מעל 1,000 מכולות, כ-40 משאיות, "אחת תמורת אחת". מעל 90% מהפסולת שמגיעה ממוחזרת. כ-50,000 מ"ק בטון בחודש.
- נוסחאות אומדן פסולת: רגילה 25–30 טון ל-100 מ"ר; מתועשת 10–12; ציבור/משרדים 15–20; הריסה נפח×0.4–0.5. פער מעל 15%–20% בין הצהרה לפינוי מעורר בעיה בטופס 4. באתר יש כלי "מאזן פסולת".
שירותים:
${svcs}
שאלות נפוצות:
${faq}
טלפונים: מוקד ${C.phone}, ${C.phone2}, ${C.phone3}. מיגון: יוסי 052-8077702, פיני 050-7366632. אימייל ${C.email}. משרדים: ${C.address}.
${C.agentNotes?'מידע נוסף מהקבוצה: '+C.agentNotes:''}
כללים: ענה בעברית, קצר וענייני, עד 4 משפטים, בשפה של אנשי שטח. אל תמציא מחירים, זמני אספקה, לקוחות, אישורים או הבטחות שלא מופיעים למעלה; כשחסר מידע, אמור שהמוקד ייתן תשובה מדויקת. שאל שאלה אחת ממוקדת כשזה עוזר (סוג פרויקט, מיקום, היקף). כשמתאים, הפנה למאזן הפסולת או להשארת פרטים. אם המבקר ביקש שיחזרו אליו ומסר שם וטלפון, קרא לכלי create_lead ואשר שהפרטים התקבלו.`;}
const leadTool={name:'create_lead',description:'שומר פנייה של מבקר שביקש שיחזרו אליו. לקרוא רק כשיש שם וטלפון.',inputSchema:{type:'object',properties:{name:{type:'string'},phone:{type:'string'},need:{type:'string',description:'תקציר הצורך: שירות, מיקום, היקף'}},required:['name','phone']},
 async execute(i){try{await saveLead({name:String(i.name).slice(0,80),phone:String(i.phone).slice(0,30),co:'',svc:'',where:'',msg:String(i.need||'').slice(0,600),spec:'',source:'ai'});return{ok:true};}catch(e){return{ok:false,reason:'השמירה אינה זמינה כרגע'};}}};
const FALLBACK=[
 [/היתר|טופס ?4|הסכם|אישור הטמנה/,'להיתר צריך הסכם התקשרות עם קבלן מורשה לפינוי פסולת. אנחנו מספקים אותו, ממליצים על כמויות ותדירות, ובסוף מלווים עם האישור לטופס 4. כמה מ"ר בנוי יש בפרויקט? אפשר גם לחשב במאזן הפסולת למעלה.'],
 [/מכול|פינוי|אחת תמורת/,'יש לנו מעל 1,000 מכולות וכ-40 משאיות. בפינוי "אחת תמורת אחת" המשאית פורקת מכולה ריקה לפני שהיא לוקחת את המלאה. איפה האתר ומה היקף העבודה?'],
 [/חומר|סומסום|עדש|חול|ממוחזר|מצע/,'ממפעל השטיפה יוצאים סומסום שטוף, עדש שטוף וחול שטוף, לחומרי מילוי, מצעים, תשתיות וייצור בטון. הם גם עוזרים בתקן 5281. לאיזה שימוש אתם צריכים?'],
 [/בטון|יציקה|משאבה/,'טלאור בטון מייצרת כ-50,000 מ"ק בטון בחודש, עם מעבדות ניידות ומשאבות לכל גובה. להזמנה חייגו ‎*9084 או השאירו פרטים, ונחזור אליכם.'],
 [/הריס|בית ספר|שכונה/,'אנחנו מבצעים הריסות גם בלב שכונות צפופות וליד מוסדות, עם תיאום מול העירייה, המשטרה והרשויות, והפחתת אבק ורעש. מה המבנה ואיפה הוא?'],
 [/מיגונ|ממ"?ד|ממ"?מ|מיגון/,'טלאור הנדסה מייצרת ומתקינה מיגוניות, ממ"דים וממ"מים, עם ISO 9001 ואישורי פיקוד העורף. לפרטים: יוסי 052-8077702 או פיני 050-7366632.'],
 [/.*/,'אשמח לעזור. ספרו לי מה הפרויקט (בנייה, הריסה, בטון, מיגון) ואיפה הוא. לתשובה מיידית אפשר גם לחייג למוקד ‎*9084.']];
async function ask(q){
 if(busyA||!q.trim())return; busyA=true; $('#advF button').disabled=true; bb('me',q); hist.push({role:'user',content:q}); ain.value='';
 const b=bb('ai',''); b.innerHTML='<span class="typing" aria-label="המוקד מקליד"><i></i><i></i><i></i></span>';
 try{ if(!sample||C.agentOn===false)throw new Error('nosample');
  const turns=hist.map((m,i)=>i===0?{role:'user',content:advPrompt()+'\n\n---\nהודעת המבקר: '+m.content}:m);
  const r=await sample(turns,{cache:false,modelTier:'quick',tools:[leadTool],onText:u=>{b.textContent=u.text;body.scrollTop=body.scrollHeight;}});
  b.textContent=r.text; hist.push({role:'assistant',content:r.text});
 }catch(e){ const a=FALLBACK.find(([re])=>re.test(q))[1]; await new Promise(r=>setTimeout(r,600)); b.textContent=a; hist.push({role:'assistant',content:a}); }
 SABABI.glance(); busyA=false; $('#advF button').disabled=false; body.scrollTop=body.scrollHeight;
}
$('#advF').addEventListener('submit',e=>{e.preventDefault();ask(ain.value);});
$$('#advChips button').forEach(c=>c.addEventListener('click',()=>ask(c.textContent)));

/* ================= leads ================= */
let db=null,user=null,uid=null,isOwner=false;
const cl=window.claude&&window.claude.use?window.claude:null;
/* traffic attribution: where a lead came from (first touch, kept 30 days, refreshed by a new campaign), saved with the lead so the owner can see what search and each page bring in */
const ATTR=(()=>{try{const K='tkAttr',now=Date.now(),q=new URLSearchParams(location.search),host=location.hostname.replace(/^www\./,'');
 let ref=''; try{ref=document.referrer?new URL(document.referrer).hostname.replace(/^www\./,''):'';}catch(_){} if(ref===host)ref='';
 const fresh={t:now,ref,land:q.get('from')||location.pathname,utm:['utm_source','utm_medium','utm_campaign'].map(k=>q.get(k)||'').join('|').replace(/^\|+$/,'')};
 let a=null; try{a=JSON.parse(localStorage.getItem(K)||'null');}catch(_){}
 if(!a||now-a.t>30*864e5||(fresh.utm&&fresh.utm!==a.utm)||(fresh.ref&&!a.ref&&!a.utm)){a=fresh; try{localStorage.setItem(K,JSON.stringify(a));}catch(_){}}
 return a;}catch(e){return null;}})();
const srcKind=a=>{if(!a)return'direct'; const u=(a.utm||'').toLowerCase(),r=a.ref||''; if(/cpc|paid|ppc/.test(u))return'paid'; if(u)return'campaign'; if(/google|bing|duckduckgo|yahoo|ecosia/.test(r))return'organic'; if(/facebook|instagram|linkedin|t\.co|whatsapp|youtube/.test(r))return'social'; return r?'referral':'direct';};
const KIND={organic:'חיפוש אורגני',paid:'מודעה ממומנת',social:'רשתות חברתיות',campaign:'קמפיין',referral:'אתר מפנה',direct:'כניסה ישירה'};
async function saveLead(l){ if(!db||!uid)throw new Error('offline'); const ref=db.doc('leads/'+uid); const s=await ref.get(); const items=(s.exists&&s.data().items)||[]; items.push({id:rid(),at:Date.now(),status:'new',note:'',attr:ATTR?{kind:srcKind(ATTR),ref:ATTR.ref,land:ATTR.land,utm:ATTR.utm}:null,...l}); await ref.set({items,updatedAt:Date.now()}); }
$('#leadForm').addEventListener('submit',async e=>{
 e.preventDefault(); const note=$('#fNote'); note.classList.remove('err'); const name=$('#fName').value.trim(), phone=$('#fPhone').value.trim();
 const bad=(m,el)=>{note.textContent=m; note.classList.add('err'); el.focus();};
 if(!name)return bad('איך לפנות אליכם? מלאו שם.',$('#fName'));
 if(phone.replace(/\D/g,'').length<9)return bad('מספר הטלפון קצר מדי. בדקו אותו ונסו שוב.',$('#fPhone'));
 if(!$('#fAgree').checked)return bad('כדי שנוכל לשמור את הפנייה, סמנו את האישור למדיניות הפרטיות.',$('#fAgree'));
 const l={name,phone,co:$('#fCo').value.trim(),svc:$('#fSvc').value,where:$('#fWhere').value.trim(),msg:$('#fMsg').value.trim(),spec:$('#fSpec').hidden?'':SPEC,source:!$('#fSpec').hidden&&SPEC?'calc':'form'};
 const btn=e.target.querySelector('[type=submit]'); btn.disabled=true; note.textContent='שולח…';
 try{ await saveLead(l);
  const f=e.target; [...f.children].forEach(c=>c.hidden=true);
  const d=document.createElement('div'); d.className='sent'; d.setAttribute('role','status'); d.tabIndex=-1;
  d.innerHTML=`<svg viewBox="0 0 512 512" aria-hidden="true"><use href="#sym"/></svg><h3>קיבלנו. המעגל התחיל.</h3><p>נחזור אליכם בהקדם. אם דחוף, המוקד זמין ב-<bdi dir="ltr">${esc(C.phone)}</bdi>.</p>`;
  f.appendChild(d); d.focus(); SABABI.celebrate();
  if(!reduce())$('svg',d).animate([{transform:'rotate(-180deg) scale(.4)',opacity:0},{transform:'none',opacity:1}],{duration:900,easing:'cubic-bezier(.2,.8,.2,1)'});
 }catch(_){ const t=`שלום, אני ${name} (${phone})${l.co?', '+l.co:''}. ${l.svc?l.svc+'. ':''}${l.where?'אתר: '+l.where+'. ':''}${l.msg} ${l.spec}`.trim();
  note.innerHTML=`לא הצלחנו לשמור את הפנייה בתצוגה הזו. חייגו למוקד <bdi dir="ltr">${esc(C.phone)}</bdi>, או שלחו את הפרטים ל-<bdi dir="ltr">${esc(C.email)}</bdi>:<br><span style="display:block;margin-top:8px;padding:10px;border-radius:10px;background:var(--paper);user-select:all">${esc(t)}</span>`; }
 btn.disabled=false;
});

/* ================= chrome ================= */
const hdr=$('#hdr'), mbar=$('#mbar');
addEventListener('scroll',()=>{hdr.classList.toggle('scrolled',scrollY>40); mbar.classList.toggle('on',scrollY>innerHeight*.7&&scrollY<document.documentElement.scrollHeight-innerHeight*1.5);},{passive:true});
const spy=new IntersectionObserver(es=>es.forEach(e=>{if(e.isIntersecting){const id=e.target.id; $$('.nav a').forEach(a=>a.setAttribute('aria-current',String(a.getAttribute('href')==='#'+id)));}}),{rootMargin:'-45% 0px -50% 0px'});
['circle','services','calc','sites','projects','about','faq','contact'].forEach(id=>spy.observe($('#'+id)));
function trap(box,e){ if(e.key!=='Tab')return; const f=$$('a[href],button:not([disabled]),input,select,textarea,[tabindex="0"]',box).filter(x=>x.offsetParent); if(!f.length)return; const a=f[0],z=f[f.length-1]; if(e.shiftKey&&document.activeElement===a){e.preventDefault();z.focus();} else if(!e.shiftKey&&document.activeElement===z){e.preventDefault();a.focus();} }
const dr=$('#drawer'), bg=$('#burger');
const openDr=o=>{dr.classList.toggle('open',o); dr.setAttribute('aria-hidden',String(!o)); dr.inert=!o; bg.setAttribute('aria-expanded',String(o)); document.body.style.overflow=o?'hidden':''; if(o)setTimeout(()=>$('#drawerX').focus(),30); else bg.focus({preventScroll:true});};
bg.onclick=()=>openDr(true); $('#drawerX').onclick=()=>openDr(false); dr.addEventListener('click',e=>{if(e.target===dr||e.target.closest('a.dl'))openDr(false);});
dr.addEventListener('keydown',e=>{trap($('.in',dr),e); if(e.key==='Escape')openDr(false);});
const A=$('#a11y'), AB=$('#a11yBtn');
const openA=o=>{A.classList.toggle('open',o); AB.setAttribute('aria-expanded',String(o)); if(o)setTimeout(()=>A.querySelector('button').focus(),20);};
AB.onclick=()=>openA(!A.classList.contains('open'));
$('#mA11y').onclick=()=>{openDr(false); openA(true);};
const saveA=()=>{try{localStorage.setItem('tkA11y',JSON.stringify($$('[data-a]',A).filter(b=>b.getAttribute('aria-pressed')==='true').map(b=>b.dataset.a)));}catch(_){}};
$$('[data-a]',A).forEach(b=>{b.setAttribute('aria-pressed',String(document.documentElement.classList.contains(b.dataset.a))); b.onclick=()=>{const on=document.documentElement.classList.toggle(b.dataset.a); b.setAttribute('aria-pressed',String(on)); saveA();};});
$('#a11yReset').onclick=()=>{$$('[data-a]',A).forEach(b=>{document.documentElement.classList.remove(b.dataset.a);b.setAttribute('aria-pressed','false');}); saveA();};
A.addEventListener('keydown',e=>{if(e.key==='Escape'){openA(false);AB.focus();}});
document.addEventListener('click',e=>{if(A.classList.contains('open')&&!e.target.closest('#a11y,#a11yBtn,#mA11y'))openA(false);});
$('#yr').textContent=new Date().getFullYear();

/* ================= admin ================= */
let LEADS=[],tab='ov',leadFilter='all',subs=[],pendingDel=null;
const ST={new:'חדש',work:'בטיפול',quote:'הצעה נשלחה',won:'נסגר',lost:'לא רלוונטי'};
const fmt=ts=>new Date(ts).toLocaleString('he-IL',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'});
const SRC={form:['מהטופס',''],ai:['מהמוקד הדיגיטלי','ai'],calc:['ממאזן הפסולת','calc']};
function setNew(){const n=LEADS.filter(l=>l.status==='new').length; ['#newCount','#newCount2'].forEach(s=>{const e=$(s); e.hidden=!n; e.textContent=n;});}
function openAdmin(){$('#adm').classList.add('open'); document.body.style.overflow='hidden';
 if(!subs.length&&db){subs.push(db.collection('leads').onSnapshot(s=>{LEADS=s.docs.flatMap(d=>((d.data()||{}).items||[]).map(it=>({...it,_d:d.id}))).sort((a,b)=>b.at-a.at); setNew(); if(['ov','leads'].includes(tab))renderAdmin();},()=>{}));}
 renderAdmin(); setTimeout(()=>$('#adm .tab.on').focus(),30);}
function closeAdmin(){$('#adm').classList.remove('open'); document.body.style.overflow=''; if(location.hash==='#admin')history.replaceState(null,'',location.pathname); $('#admBtn').focus({preventScroll:true});}
$$('#adm .tab').forEach(t=>t.addEventListener('click',()=>{if(t.dataset.t==='close')return closeAdmin(); tab=t.dataset.t; $$('#adm .tab').forEach(x=>x.classList.toggle('on',x===t)); renderAdmin();}));
$('#adm').addEventListener('keydown',e=>{if(e.key==='Escape')closeAdmin();});
async function updLead(d,id,patch,remove){const ref=db.doc('leads/'+d); const s=await ref.get(); const dt=s.data()||{}; let items=dt.items||[]; items=remove?items.filter(i=>i.id!==id):items.map(i=>i.id===id?{...i,...patch}:i); await ref.set({...dt,items,updatedAt:Date.now()});}
function leadCard(l){const [sl,sc]=SRC[l.source]||SRC.form; const k=l._d+'|'+l.id; return `<div class="box"><div class="lead-row">
 <div><b>${esc(l.name)}</b>${l.co?` · ${esc(l.co)}`:''} <span style="color:var(--steel);font-size:13px">${fmt(l.at)}</span><br><span class="badge ${sc}">${sl}</span>${l.svc?`<span class="badge">${esc(l.svc)}</span>`:''}${l.where?`<span class="badge">${esc(l.where)}</span>`:''}${l.attr?`<span class="badge" title="מקור ההגעה">${KIND[l.attr.kind]||''}${l.attr.land&&l.attr.land!=='/'?` · ${esc(decodeURIComponent(l.attr.land).slice(0,40))}`:''}</span>`:''}</div>
 <div><span class="mono" dir="ltr">${esc(l.phone)}</span><br><button class="mini" type="button" data-copyv="${esc(l.phone)}">העתקת טלפון</button></div>
 <div><select data-st="${k}" aria-label="סטטוס">${Object.entries(ST).map(([v,t])=>`<option value="${v}" ${l.status===v?'selected':''}>${t}</option>`).join('')}</select></div>
 <div>${pendingDel===k?`<span class="confirm">למחוק? <button class="mini warn" data-delok="${k}" type="button">כן</button><button class="mini" data-delno type="button">לא</button></span>`:`<button class="mini warn" data-del="${k}" type="button">מחיקה</button>`}</div>
 ${l.spec?`<p class="msg"><b>ממאזן הפסולת:</b> ${esc(l.spec)}</p>`:''}${l.msg?`<p class="msg">${esc(l.msg)}</p>`:''}
 <textarea data-note="${k}" placeholder="הערות פנימיות…" style="grid-column:1/-1;min-height:56px" aria-label="הערות פנימיות">${esc(l.note)}</textarea></div></div>`;}
async function saveSite(msgEl){ msgEl&&(msgEl.textContent='שומר…'); try{await db.doc('data/site').set(JSON.parse(JSON.stringify(C))); applyContent(); msgEl&&(msgEl.textContent='נשמר ופורסם באתר.');}catch(e){msgEl&&(msgEl.textContent='השמירה נכשלה. ודאו שיש לכם הרשאת עריכה ונסו שוב.');} }
function renderAdmin(){
 const m=$('#admMain'); if(!db){m.innerHTML='<h2>מרכז הבקרה</h2><p class="empty">מסד הנתונים אינו זמין בתצוגה הזו.</p>';return;}
 if(tab==='ov'||tab==='leads'){
  const c=k=>LEADS.filter(l=>l.status===k).length;
  const list=tab==='ov'?LEADS.slice(0,4):LEADS.filter(l=>leadFilter==='all'||l.status===leadFilter);
  m.innerHTML=tab==='ov'?`<h2>סקירה</h2><p class="sub">כל מה שקורה באתר, במבט אחד.</p><div class="kpis"><div class="kpi hot"><b>${c('new')}</b><span>פניות חדשות</span></div><div class="kpi"><b>${c('work')+c('quote')}</b><span>בטיפול והצעות</span></div><div class="kpi"><b>${c('won')}</b><span>נסגרו</span></div><div class="kpi"><b>${LEADS.filter(l=>l.source==='calc').length}</b><span>הגיעו עם מאזן פסולת</span></div></div><p class="sub">מקורות הפניות: ${Object.entries(LEADS.reduce((m,l)=>{const k=l.attr?l.attr.kind:'direct';m[k]=(m[k]||0)+1;return m;},{})).map(([k,n])=>`${KIND[k]} ${n}`).join(' · ')||'עדיין אין'}</p><h3 style="font-size:24px;margin:6px 0 12px">פניות אחרונות</h3>${list.map(leadCard).join('')||'<p class="empty">עדיין אין פניות. כשמישהו ימלא טופס, ישתמש במאזן הפסולת או ידבר עם המוקד הדיגיטלי, זה יופיע כאן.</p>'}`
   :`<h2>פניות</h2><p class="sub">מהטופס, ממאזן הפסולת ומהמוקד הדיגיטלי, במקום אחד.</p><div style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:16px">${[['all','הכל'],...Object.entries(ST)].map(([k,v])=>`<button class="mini" type="button" aria-pressed="${leadFilter===k}" data-f="${k}" style="${leadFilter===k?'border-color:var(--green);color:var(--green)':''}">${v} (${k==='all'?LEADS.length:c(k)})</button>`).join('')}</div>${list.map(leadCard).join('')||'<p class="empty">אין פניות בסינון הזה.</p>'}`;
  $$('[data-f]',m).forEach(b=>b.onclick=()=>{leadFilter=b.dataset.f;renderAdmin();});
  $$('[data-st]',m).forEach(s=>s.onchange=()=>{const [d,id]=s.dataset.st.split('|');updLead(d,id,{status:s.value});});
  $$('[data-note]',m).forEach(t=>t.onchange=()=>{const [d,id]=t.dataset.note.split('|');updLead(d,id,{note:t.value});});
  $$('[data-del]',m).forEach(b=>b.onclick=()=>{pendingDel=b.dataset.del;renderAdmin();});
  $$('[data-delno]',m).forEach(b=>b.onclick=()=>{pendingDel=null;renderAdmin();});
  $$('[data-delok]',m).forEach(b=>b.onclick=()=>{const [d,id]=b.dataset.delok.split('|');pendingDel=null;updLead(d,id,null,true);});
  bindCopy();
 }
 if(tab==='content'){
  const f=(k,l,ta)=>`<div><label for="k_${k}">${l}</label>${ta?`<textarea id="k_${k}" data-k="${k}">${esc(C[k])}</textarea>`:`<input id="k_${k}" data-k="${k}" value="${esc(C[k])}">`}</div>`;
  m.innerHTML=`<h2>תוכן ופרטי קשר</h2><p class="sub">כל שינוי שנשמר כאן מתעדכן באתר מיד.</p><div class="cform">
   <div class="box cform"><b>פתיחה</b>${f('heroKick','שורת תחומים (מופרדים ב-·)')}${f('heroLine','כותרת ראשית (הדגשה בין כוכביות *כך*)')}${f('heroSub','טקסט משנה',1)}</div>
   <div class="box cform"><b>מספרים (תעודות השקילה)</b>${C.stats.map((s,i)=>`<div style="display:grid;grid-template-columns:1fr 2fr;gap:8px"><input data-sn="${i}.0" value="${esc(s[0])}" aria-label="מספר ${i+1}"><input data-sn="${i}.1" value="${esc(s[1])}" aria-label="תיאור ${i+1}"></div>`).join('')}</div>
   <div class="box cform"><b>פרטי קשר</b>${f('phone','מוקד')}${f('phone2','טלפון')}${f('phone3','טלפון נוסף')}${f('email','אימייל')}${f('jobsEmail','אימייל למשרות')}${f('address','כתובת המשרדים')}${f('facebook','פייסבוק')}${f('instagram','אינסטגרם')}</div>
   <div class="box cform"><b>מסמכים (ריק = הטיוטה שבאתר)</b>${f('privacy','מדיניות פרטיות',1)}${f('a11yText','הצהרת נגישות',1)}</div>
   <div class="savebar"><button class="btn" id="cSave" type="button">שמירה ופרסום</button><span id="cMsg" class="fnote" role="status"></span></div></div>`;
  $('#cSave').onclick=()=>{$$('[data-k]',m).forEach(el=>C[el.dataset.k]=el.value); $$('[data-sn]',m).forEach(el=>{const [i,j]=el.dataset.sn.split('.'); C.stats[+i][+j]=el.value;}); saveSite($('#cMsg'));};
 }
 if(tab==='reviews'){
  m.innerHTML=`<h2>המלצות</h2><p class="sub">רק המלצות אמיתיות של לקוחות, באישור שלהם. כשיש לפחות אחת, יופיע באתר אזור המלצות.</p><div class="cform">${C.testimonials.map((t,i)=>`<div class="box cform"><textarea data-t="${i}.q" aria-label="ההמלצה">${esc(t.q)}</textarea><div style="display:grid;grid-template-columns:1fr 1fr auto;gap:8px"><input data-t="${i}.n" value="${esc(t.n)}" aria-label="שם"><input data-t="${i}.p" value="${esc(t.p)}" aria-label="חברה או תפקיד"><button class="mini warn" type="button" data-tdel="${i}">הסרה</button></div></div>`).join('')||'<p class="empty">עדיין אין המלצות.</p>'}</div><div class="savebar"><button class="mini" id="tAdd" type="button">הוספת המלצה</button><button class="btn" id="tSave" type="button">שמירה ופרסום</button><span id="tMsg" class="fnote" role="status"></span></div>`;
  const col=()=>$$('[data-t]',m).forEach(el=>{const [i,k]=el.dataset.t.split('.'); C.testimonials[+i][k]=el.value;});
  $('#tAdd').onclick=()=>{col();C.testimonials.push({q:'',n:'',p:''});renderAdmin();};
  $$('[data-tdel]',m).forEach(b=>b.onclick=()=>{col();C.testimonials.splice(+b.dataset.tdel,1);renderAdmin();});
  $('#tSave').onclick=()=>{col(); C.testimonials=C.testimonials.filter(t=>t.q.trim()); saveSite($('#tMsg'));};
 }
 if(tab==='projects'){
  C.extraProjects=C.extraProjects||[];
  m.innerHTML=`<h2>פרויקטים</h2><p class="sub">הוסיפו סרטון מיוטיוב או צילום אמיתי מאתר עבודה. הפרויקטים הקיימים באתר נשארים תמיד.</p><div class="cform">${C.extraProjects.map((p,i)=>`<div class="box cform"><div style="display:grid;grid-template-columns:1fr 1fr;gap:8px"><input data-p="${i}.t" value="${esc(p.t)}" aria-label="כותרת"><input data-p="${i}.s" value="${esc(p.s||'')}" aria-label="לקוח או תיאור"></div>${p.photo?`<img src="${esc(p.photo)}" alt="" style="max-width:220px;border-radius:10px">`:`<span class="mono">youtube: ${esc(p.yt)}</span>`}<button class="mini warn" type="button" data-pdel="${i}">הסרה</button></div>`).join('')}
   <div class="box cform"><b>סרטון מיוטיוב</b><input id="pYt" placeholder="קישור, למשל https://youtu.be/…"><input id="pYtT" placeholder="כותרת"><input id="pYtS" placeholder="לקוח (לא חובה)"><button class="mini" id="pYtAdd" type="button">הוספה</button></div>
   <div class="box cform"><b>צילום אמיתי מהשטח</b><input type="file" id="pImg" accept="image/*"><input id="pImgT" placeholder="כותרת"><button class="mini" id="pImgAdd" type="button">העלאה והוספה</button><span id="pMsg" class="fnote" role="status"></span></div>
   <div class="savebar"><button class="btn" id="pSave" type="button">שמירה ופרסום</button><span id="pMsg2" class="fnote" role="status"></span></div></div>`;
  const col=()=>$$('[data-p]',m).forEach(el=>{const [i,k]=el.dataset.p.split('.'); C.extraProjects[+i][k]=el.value;});
  $$('[data-pdel]',m).forEach(b=>b.onclick=()=>{col();C.extraProjects.splice(+b.dataset.pdel,1);renderAdmin();});
  $('#pYtAdd').onclick=()=>{col(); const v=$('#pYt').value.trim(); const id=(v.match(/(?:v=|youtu\.be\/|shorts\/)([\w-]{11})/)||[])[1]||(/^[\w-]{11}$/.test(v)?v:''); if(!id){$('#pMsg2').textContent='לא זיהינו קישור תקין לסרטון.';return;} C.extraProjects.push({kind:'yt',yt:id,t:$('#pYtT').value.trim()||'פרויקט',s:$('#pYtS').value.trim()}); renderAdmin();};
  $('#pImgAdd').onclick=async()=>{const f=$('#pImg').files[0]; if(!f){$('#pMsg').textContent='בחרו תמונה.';return;} $('#pMsg').textContent='מעלה…'; try{const As=await cl.use('assets'); if(!As)throw 0; const up=await As.upload(f); col(); C.extraProjects.push({kind:'real',photo:up.url,t:$('#pImgT').value.trim()||'פרויקט',s:''}); renderAdmin();}catch(_){$('#pMsg').textContent='ההעלאה לא זמינה בתצוגה הזו.';}};
  $('#pSave').onclick=()=>{col(); saveSite($('#pMsg2'));};
 }
 if(tab==='faq'){
  m.innerHTML=`<h2>שאלות נפוצות</h2><p class="sub">השאלות באתר. המוקד הדיגיטלי עונה על פיהן.</p><div class="cform">${C.faq.map((q,i)=>`<div class="box cform"><input data-q="${i}.0" value="${esc(q[0])}" aria-label="שאלה"><textarea data-q="${i}.1" aria-label="תשובה">${esc(q[1])}</textarea><button class="mini warn" type="button" data-qdel="${i}">הסרה</button></div>`).join('')}</div><div class="savebar"><button class="mini" id="qAdd" type="button">הוספת שאלה</button><button class="btn" id="qSave" type="button">שמירה ופרסום</button><span id="qMsg" class="fnote" role="status"></span></div>`;
  const col=()=>$$('[data-q]',m).forEach(el=>{const [i,k]=el.dataset.q.split('.'); C.faq[+i][+k]=el.value;});
  $('#qAdd').onclick=()=>{col();C.faq.push(['','']);renderAdmin();};
  $$('[data-qdel]',m).forEach(b=>b.onclick=()=>{col();C.faq.splice(+b.dataset.qdel,1);renderAdmin();});
  $('#qSave').onclick=()=>{col(); C.faq=C.faq.filter(q=>q[0].trim()); saveSite($('#qMsg'));};
 }
 if(tab==='agent'){
  m.innerHTML=`<h2>המוקד הדיגיטלי וסבבי</h2><p class="sub">עונה למבקרים בעברית על בסיס המידע באתר, ושומר פניות כשמבקשים שיחזרו.</p><div class="cform">
   <div class="box" style="display:flex;justify-content:space-between;gap:10px;align-items:center"><div><b>המוקד פעיל</b><br><span class="fnote">כשהוא כבוי, המבקרים מקבלים תשובות קבועות מהאתר</span></div><label style="display:flex;gap:8px;align-items:center"><input type="checkbox" id="aOn" style="width:22px;height:22px" ${C.agentOn!==false?'checked':''}> פעיל</label></div>
   <div class="box"><label for="aNotes">ידע נוסף למוקד</label><textarea id="aNotes" style="min-height:160px" placeholder="למשל: שעות פעילות, אזורי שירות, זמני אספקה, מבצעים…">${esc(C.agentNotes)}</textarea></div>
   <div class="box" style="display:flex;justify-content:space-between;gap:10px;align-items:center"><div><b>סבבי, הדמות של האתר</b><br><span class="fnote">מכוון מבקרים, לכל היותר 6 פעמים בביקור</span></div><label style="display:flex;gap:8px;align-items:center"><input type="checkbox" id="sOn" style="width:22px;height:22px" ${C.sababiOn!==false?'checked':''}> פעיל</label></div>
   <div class="box"><label for="sHello">משפט הפתיחה של סבבי (ריק = ברירת מחדל)</label><input id="sHello" value="${esc(C.sababiHello)}" placeholder="היי, אני סבבי…"></div>
   <div class="savebar"><button class="btn" id="aSave" type="button">שמירה</button><span id="aMsg" class="fnote" role="status"></span></div></div>`;
  $('#aSave').onclick=()=>{C.agentOn=$('#aOn').checked;C.agentNotes=$('#aNotes').value;C.sababiOn=$('#sOn').checked;C.sababiHello=$('#sHello').value.trim();saveSite($('#aMsg'));};
 }
}
$('#admBtn').addEventListener('click',openAdmin);

/* ================= init ================= */
bladesSVG(); applyContent(); ringSVG(); stagesUI(); renderServices(); calcUI(); mapUI(); renderAbout(); filmUI(); entry();
if(cl){
 cl.use('db').then(d=>{db=d; if(!db)return; db.doc('data/site').onSnapshot(s=>{ if(s.exists){ const d=s.data()||{}; C={...structuredClone(DEF),...d}; ['stats','faq'].forEach(k=>{if(!Array.isArray(C[k])||!C[k].length)C[k]=structuredClone(DEF[k]);}); C.testimonials=Array.isArray(C.testimonials)?C.testimonials:[]; if(!$('#adm').classList.contains('open'))applyContent(); } },()=>{}); });
 cl.use('user').then(async u=>{user=u; if(!u)return; try{uid=await u.id(); isOwner=await u.isOwner();}catch(_){}
  if(isOwner){$('#admBtn').style.display='inline-flex'; if(location.hash==='#admin')openAdmin();}});
 cl.use('sample').then(s=>{sample=s;});
}
</script>
</body>
</html>
