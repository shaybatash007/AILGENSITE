
/* ================= legal ================= */
let LEGAL=null;
function legalUI(){
 $$('[data-legal]').forEach(b=>b.addEventListener('click',async()=>{
  lastFocus=b; const k=b.dataset.legal, d=$('#lg');
  $('#lgT').textContent=k==='privacy'?'פרטיות באתר':'הצהרת נגישות'; $('#lgTxt').textContent='טוען…'; if(!d.open)d.showModal();
  if(!LEGAL){try{LEGAL=await (await fetch('legal.json')).json();}catch(_){LEGAL={};}}
  const own=k==='privacy'?C.privacy:C.a11yText; $('#lgTxt').textContent=(own&&own.trim())||LEGAL[k]||'המסמך אינו זמין כרגע. אפשר לפנות אלינו: '+C.phone+' · '+C.email;
 }));
 $('#lgX').onclick=()=>$('#lg').close();
 $('#lg').addEventListener('click',e=>{if(e.target===$('#lg'))$('#lg').close();});
}

/* ================= the digital assistant (Lotti) ================= */
let sample=null, hist=[], busyA=false;
const abody=$('#advBody'), ain=$('#advIn');
function bb(cls,text){const b=document.createElement('div'); b.className='bb '+cls; b.textContent=text; abody.appendChild(b); abody.scrollTop=abody.scrollHeight; return b;}
bb('ai','היי, אני לוטי, המדריכה של החנות. אפשר לשאול אותי על הערכות, המותגים, הסיליקונים, הצבעים, המשלוח וההחזרות. אני עונה לפי מה שכתוב באתר, ועל כל השאר עדן עונה בוואטסאפ.');
function openAgent(o){
 const a=$('#agent'); a.classList.toggle('open',o); a.setAttribute('aria-hidden',String(!o)); a.inert=!o;
 if(o){lastFocus=document.activeElement; setTimeout(()=>ain.focus(),40);} else if(lastFocus&&lastFocus.focus)lastFocus.focus({preventScroll:true});
}
const range=(k)=>{const a=ITEMS.filter(x=>x.k===k); return a.length?{n:a.length,min:Math.min(...a.map(x=>x.p)),max:Math.max(...a.map(x=>x.p)),out:a.filter(x=>!x.a).length}:{n:0,min:0,max:0,out:0};};
/* copy-skip:start · the agent's instructions and tool schema are read by the model, not by visitors */
function advPrompt(){
 const list=ITEMS.map(x=>title(x)+' | '+money(x.p)+' | '+(x.a?'במלאי':'אזל')+(x.b?' | '+x.b:'')).join('\n');
 const faq=C.faq.map(([q,a])=>'ש: '+q+' ת: '+a).join('\n');
 return 'את לוטי, המדריכה של עדן קוסמטיקס: חנות מקוונת לציוד מקצועי להרמת ריסים וגבות (הבעלים, עדן נחמני, מטפלת ומדריכה בתחום). הקהל: מטפלות, מתלמדות ולקוחות פרטיות.\n'
 +'עובדות שמותר להשתמש בהן בלבד:\n- '+ITEMS.length+' מוצרים. מחירים ומלאי מהחנות; הסכום הסופי מוצג בקופה של החנות.\n- המותגים (רק העובדות האלה, מהאתר הרשמי של כל מותג): '+BRANDS.list.map(b=>b.name+(b.origin?' ('+b.origin+')':'')+(b.about?': '+b.about:'')+' · '+brandItems(b).length+' מוצרים בחנות').join(' | ')+'.\n- משלוח חינם מעל '+money(FREE)+'. המחירים כוללים מע"מ ואינם כוללים משלוח. אספקה 4–5 ימי עסקים, ליישובים מרוחקים עד 2 ימי עסקים נוספים. איסוף עצמי מנתיבות בתיאום מראש. החנות שומרת שבת.\n- החזרות והחלפות עד 14 ימים, מוצר שלא נפתח, באריזה מקורית; החזר בניכוי 7% דמי ביטול. קורסים: אין כרגע קורס פתוח להרשמה, ולכן אין תאריכים או מחירים; יש רשימת המתנה באתר.\n- קשר: וואטסאפ וטלפון '+C.phone+', אימייל '+C.email+'.\nהמוצרים (שם | מחיר | מלאי | מותג):\n'+list+'\nשאלות נפוצות:\n'+faq+'\n'+(C.agentNotes?'מידע נוסף מעדן: '+C.agentNotes+'\n':'')
 +'כללים: עני בעברית, בלשון נקבה, קצר, עד 4 משפטים. אל תכתבי מונחי הפקה או מערכת (צילום מצב, קטלוג, תצוגה מקדימה, טיוטה). אל תמציאי מחירים, מפרט, הוראות שימוש, זמני מריחה, טענות רפואיות, מתנות או הבטחות שלא מופיעים למעלה. כשחסר מידע אמרי שעדן תענה בוואטסאפ '+C.phone+'. הציעי את בונה הערכה כשמישהי מחפשת מה לקנות. שאלי שאלה ממוקדת אחת כשזה עוזר. אם ביקשו שיחזרו אליהן, קראי ל-create_lead רק כשיש שם וטלפון.';
}
const leadTool={name:'create_lead',description:'שומר פנייה של מבקרת שביקשה שיחזרו אליה. לקרוא רק כשיש שם וטלפון.',inputSchema:{type:'object',properties:{name:{type:'string'},phone:{type:'string'},need:{type:'string',description:'תקציר הצורך'}},required:['name','phone']},
 async execute(i){try{await saveLead({name:String(i.name).slice(0,80),phone:String(i.phone).slice(0,30),svc:'שאלה',msg:String(i.need||'').slice(0,600),spec:'',source:'ai'});return{ok:true};}catch(e){return{ok:false,reason:'השמירה אינה זמינה כרגע'};}}};
/* copy-skip:end */
const FALLBACK=[
 [/משלוח|שליח|מתי מגיע|אספקה|כמה ימים/,()=>'האספקה באמצעות חברת שליחויות: 4–5 ימי עסקים לבית או לעסק, וליישובים מרוחקים עד 2 ימי עסקים נוספים (לא כולל יום ההזמנה, שישי, שבת וערבי חג). משלוח חינם בהזמנה מעל '+money(FREE)+'.'],
 [/חינם|499|מע"?מ/,()=>'משלוח חינם בהזמנה מעל '+money(FREE)+'. המחירים כוללים מע"מ ואינם כוללים משלוח, שמתווסף בקופה כשההזמנה מתחת לסכום.'],
 [/איסוף|נתיבות|לאסוף/,()=>'אפשר לאסוף מנתיבות, בתיאום מראש בלבד: '+C.phone+'.'],
 [/החזר|החלפ|ביטול|להחזיר/,()=>'החלפות והחזרות עד 14 ימים (לא עסקים) מקבלת המוצר, כל עוד לא נפתח, באריזתו המקורית ולא נעשה בו שימוש. עלות המשלוח על הלקוחה. החזר בניכוי 7% דמי ביטול. לתיאום שליח: '+C.phone+'.'],
 [/שבת/,()=>'החנות שומרת שבת. אפשר לבצע הזמנות בצאת השבת.'],
 [/מלאי|אזל|זמין|חסר/,()=>'כרגע '+ITEMS.filter(x=>x.a).length+' מוצרים במלאי ו-'+ITEMS.filter(x=>!x.a).length+' שאזלו (מסומנים "אזל"). על מוצר שאזל אפשר לבחור "עדכנו אותי". אם מוצר שהזמנת אזל, לפי מדיניות החנות תוצע לך ביטול ללא דמי ביטול או מוצר חלופי.'],
 [/קורס|השתלמות|הדרכה|ללמוד/,()=>'עדן מלמדת הרמת ריסים, הרמת גבות ועיצוב גבות. כרגע אין קורס פתוח להרשמה, ולכן אין מועדים או מחיר. אפשר להצטרף לרשימה באתר, ועדן תחזור אלייך כשייפתח הקורס הבא.'],
 [/מותג|מותגים|מאיפה|תוצרת|איטל|ספרד|אוסטר|אוקראינ|my lamination|למינציה|staleks|סטאלקס/i,()=>'על המדף '+BRANDS.list.length+' מותגים: '+BRANDS.list.map(b=>b.name+(b.origin?' ('+b.origin+')':'')+', '+nProd(brandItems(b).length)).join('; ')+'. לכל מותג יש מקום משלו במדף המותגים באתר.'],
 [/ערכ|מתחיל|מה צריך|מה לקנות|להתחיל/,()=>{const s=range('set');return 'בחנות '+s.n+' ערכות וסטים להרמת ריסים וגבות, '+toRange(s.min,s.max)+'. בונה הערכה מרכיב רשימה של מוצרים מהחנות לפי הטיפול, ולפי אם את מתחילה או משלימה מלאי, עם סכום ומה חסר למשלוח חינם.';}],
 [/סיליקון|מידה|מידות/,()=>{const s=range('pads');return 'בחנות '+s.n+' סוגי סיליקונים, '+toRange(s.min,s.max)+', בצורות וצבעים שונים. מספר המידות מצוין בשם כל מוצר (למשל 5, 6, 8 או 10 מידות).';}],
 [/צבע|חמצן|thuya|טויה|refecto|nikk|ניק/i,()=>{const t=range('tint'),o=range('oxidant');return 'בחנות '+t.n+' צבעים לריסים וגבות ('+toRange(t.min,t.max)+') ו-'+o.n+' סוגי חמצן ('+toRange(o.min,o.max)+'), ממותגים כמו THUYA, RefectoCil, NIKK MOLE ו-My lamination. חלק מהם אזלו כרגע. בבונה הערכה, "צביעה", החמצן מותאם למותג.';}],
 [/דבק|בלאם|zola|קודי|kodi/i,()=>{const s=range('glue');return 'בחנות '+s.n+' מוצרי דבק ובלאם (ZOLA Lami Balm ו-Kodi), '+toRange(s.min,s.max)+'. '+(s.out?(s.out===1?'אחד מהם אזל כרגע.':s.out+' מהם אזלו כרגע.'):'כולם במלאי.');}],
 [/תשלום|לשלם|אשראי|גיל/,()=>'הסל והתשלום בחנות. הרכישה מותנית בגיל 18 ומעלה ובכרטיס אשראי ישראלי תקף.'],
 [/וואטסאפ|טלפון|לדבר|נציג|עדן|מייל/,()=>'אפשר לכתוב לעדן בוואטסאפ או להתקשר: '+C.phone+', או במייל '+C.email+'.'],
 [/.*/,()=>'אשמח לעזור. אפשר לשאול על ערכות, סיליקונים, צבעים, משלוח והחזרות, או לבנות רשימה בבונה הערכה. לשאלה שאינה כאן, עדן עונה בוואטסאפ: '+C.phone+'.']];
async function ask(q){
 if(busyA||!q.trim())return; busyA=true; $('#advF button').disabled=true; bb('me',q); hist.push({role:'user',content:q}); ain.value='';
 const b=bb('ai',''); b.innerHTML='<span class="typing" aria-label="לוטי מקלידה"><i></i><i></i><i></i></span>';
 try{ if(!sample||C.agentOn===false)throw new Error('nosample');
  const turns=hist.map((m,i)=>i===0?{role:'user',content:advPrompt()+'\n\n---\nהודעת המבקרת: '+m.content}:m);
  const r=await sample(turns,{cache:false,modelTier:'quick',tools:[leadTool],onText:u=>{b.textContent=u.text;abody.scrollTop=abody.scrollHeight;}});
  b.textContent=rng(r.text); hist.push({role:'assistant',content:r.text});
 }catch(e){ const a=FALLBACK.find(([re])=>re.test(q))[1](); await new Promise(r=>setTimeout(r,550)); b.textContent=rng(a); hist.push({role:'assistant',content:a}); }
 LOT.state('happy',1500); busyA=false; $('#advF button').disabled=false; abody.scrollTop=abody.scrollHeight;
}
function agentUI(){
 $('#advF').addEventListener('submit',e=>{e.preventDefault();ask(ain.value);});
 $$('#advChips button').forEach(c=>c.addEventListener('click',()=>ask(c.textContent)));
 $('#agentX').onclick=()=>openAgent(false);
 $('#agent').addEventListener('keydown',e=>{if(e.key==='Escape')openAgent(false);});
}

/* ================= leads ================= */
let db=null,user=null,uid=null,isOwner=false;
const cl=window.claude&&window.claude.use?window.claude:null;
/* traffic attribution: where a lead came from (first touch, kept 30 days, refreshed by a new campaign), saved with the lead so the owner sees what search and each page bring */
const ATTR=(()=>{try{const K='edenAttr',now=Date.now(),q=new URLSearchParams(location.search),host=location.hostname.replace(/^www\./,'');
 let ref=''; try{ref=document.referrer?new URL(document.referrer).hostname.replace(/^www\./,''):'';}catch(_){} if(ref===host)ref='';
 const fresh={t:now,ref,land:q.get('from')||location.pathname,utm:['utm_source','utm_medium','utm_campaign'].map(k=>q.get(k)||'').join('|').replace(/^\|+$/,'')};
 let a=null; try{a=JSON.parse(localStorage.getItem(K)||'null');}catch(_){}
 if(!a||now-a.t>30*864e5||(fresh.utm&&fresh.utm!==a.utm)||(fresh.ref&&!a.ref&&!a.utm)){a=fresh; try{localStorage.setItem(K,JSON.stringify(a));}catch(_){}}
 return a;}catch(e){return null;}})();
const srcKind=a=>{if(!a)return'direct'; const u=(a.utm||'').toLowerCase(),r=a.ref||''; if(/cpc|paid|ppc/.test(u))return'paid'; if(u)return'campaign'; if(/google|bing|duckduckgo|yahoo|ecosia/.test(r))return'organic'; if(/facebook|instagram|linkedin|t\.co|whatsapp|youtube|tiktok/.test(r))return'social'; return r?'referral':'direct';};
const KIND={organic:'חיפוש אורגני',paid:'מודעה ממומנת',social:'רשתות חברתיות',campaign:'קמפיין',referral:'אתר מפנה',direct:'כניסה ישירה'};
async function saveLead(l){ if(!db||!uid)throw new Error('offline'); const ref=db.doc('leads/'+uid); const s=await ref.get(); const items=(s.exists&&s.data().items)||[]; items.push({id:rid(),at:Date.now(),status:'new',note:'',attr:ATTR?{kind:srcKind(ATTR),ref:ATTR.ref,land:ATTR.land,utm:ATTR.utm}:null,...l}); await ref.set({items,updatedAt:Date.now()}); }
let LEADCTX={source:'form',spec:''};
function openLead(o){
 LEADCTX={source:o.source||'form',spec:o.spec||''};
 if(o.subject)$('#fSubj').value=o.subject; if(o.msg!==undefined)$('#fMsg').value=o.msg;
 const at=$('#fAttach'); at.hidden=!o.attach; at.textContent=o.attach||'';
 $('#contact').scrollIntoView({behavior:reduce()?'auto':'smooth'}); setTimeout(()=>$('#fName').focus({preventScroll:true}),500);
}
function sentUI(form,text,who){
 [...form.children].forEach(c=>c.hidden=true);
 const d=document.createElement('div'); d.className='sent'; d.setAttribute('role','status'); d.tabIndex=-1;
 d.innerHTML='<svg aria-hidden="true"><use href="#i-check"/></svg><h3>'+esc(text)+'</h3><p>עדן תחזור אלייך. אם דחוף: וואטסאפ או טלפון <bdi dir="ltr">'+esc(C.phone)+'</bdi>.</p>';
 form.appendChild(d); d.focus(); LOT.state('love',2600); LOT.say('נשלח. עדן תחזור אלייך.',{force:true});
}
function fallbackNote(note,name,phone,text){
 const t='שלום, אני '+name+' ('+phone+'). '+text;
 note.innerHTML='הפנייה מוכנה. לשליחה לעדן: <a href="'+esc(waHref(t))+'" target="_blank" rel="noopener">פתיחת וואטסאפ עם ההודעה</a>, או בטלפון <bdi dir="ltr">'+esc(C.phone)+'</bdi>.';
}
function formUI(){
 const guard=(note,name,phone,agree,nameEl,phoneEl,agreeEl)=>{const bad=(m,el)=>{note.textContent=m;note.classList.add('err');el.focus();return true;}; note.classList.remove('err');
  if(!name)return bad('איך לפנות אלייך? מלאי שם.',nameEl); if(phone.replace(/\D/g,'').length<9)return bad('מספר הטלפון קצר מדי. בדקי אותו ונסי שוב.',phoneEl); if(!agree)return bad('כדי שנוכל לשמור את הפנייה, סמני את האישור למדיניות הפרטיות.',agreeEl); return false;};
 $('#leadForm').addEventListener('submit',async e=>{
  e.preventDefault(); const note=$('#fNote'), name=$('#fName').value.trim(), phone=$('#fPhone').value.trim();
  if(guard(note,name,phone,$('#fAgree').checked,$('#fName'),$('#fPhone'),$('#fAgree')))return;
  const l={name,phone,svc:$('#fSubj').value,msg:$('#fMsg').value.trim(),spec:LEADCTX.spec||'',source:LEADCTX.spec&&LEADCTX.source!=='form'?LEADCTX.source:'form'};
  const btn=e.target.querySelector('[type=submit]'); btn.disabled=true; note.textContent='שולחת…';
  try{await saveLead(l); sentUI(e.target,'קיבלנו. תודה!');}catch(_){fallbackNote(note,name,phone,l.svc+'. '+l.msg+' '+l.spec);}
  btn.disabled=false;
 });
 $('#courseForm').addEventListener('submit',async e=>{
  e.preventDefault(); const note=$('#cNote'), name=$('#cName').value.trim(), phone=$('#cPhone').value.trim();
  if(guard(note,name,phone,$('#cAgree').checked,$('#cName'),$('#cPhone'),$('#cAgree')))return;
  const l={name,phone,svc:'קורס',msg:'מתעניינת ב: '+$('#cWhat').value,spec:'',source:'course'};
  const btn=e.target.querySelector('[type=submit]'); btn.disabled=true; note.textContent='שולחת…';
  try{await saveLead(l); sentUI(e.target,'נרשמת לרשימת ההמתנה.');}catch(_){fallbackNote(note,name,phone,'אני מעוניינת בקורס: '+$('#cWhat').value+'.');}
  btn.disabled=false;
 });
}

/* ================= courses the owner publishes (empty today: the store's collection has none) ================= */
function renderCourses(){
 const box=$('#courses .tx'); let list=$('#courseList'); if(!C.courseItems||!C.courseItems.length){if(list)list.remove();return;}
 if(!list){list=document.createElement('ul'); list.id='courseList'; list.className='ct'; box.appendChild(list);}
 list.innerHTML=C.courseItems.map(c=>'<li><svg aria-hidden="true"><use href="#i-course"/></svg><span><b>'+esc(c.t)+'</b>'+(c.d?' · '+esc(c.d):'')+(c.p?' · '+esc(c.p):'')+(c.u?' · <a href="'+esc(c.u)+'" rel="noopener">פרטים</a>':'')+'</span></li>').join('');
}

/* ================= accessibility ================= */
function a11yUI(){
 const A=$('#a11y'), AB=$('#a11yBtn');
 const openA=o=>{A.classList.toggle('open',o); AB.setAttribute('aria-expanded',String(o)); if(o)setTimeout(()=>A.querySelector('button').focus(),20);};
 AB.onclick=()=>openA(!A.classList.contains('open'));
 $('#mA11y').onclick=()=>{openDr(false); openA(true);};
 const save=()=>{try{localStorage.setItem('edenA11y',JSON.stringify($$('[data-a]',A).filter(b=>b.getAttribute('aria-pressed')==='true').map(b=>b.dataset.a)));}catch(_){}};
 $$('[data-a]',A).forEach(b=>{b.setAttribute('aria-pressed',String(document.documentElement.classList.contains(b.dataset.a))); b.onclick=()=>{const on=document.documentElement.classList.toggle(b.dataset.a); b.setAttribute('aria-pressed',String(on)); save(); if(b.dataset.a==='a-still'&&on)setLift(1);};});
 $('#a11yReset').onclick=()=>{$$('[data-a]',A).forEach(b=>{document.documentElement.classList.remove(b.dataset.a);b.setAttribute('aria-pressed','false');}); save();};
 A.addEventListener('keydown',e=>{if(e.key==='Escape'){openA(false);AB.focus();}});
 document.addEventListener('click',e=>{if(A.classList.contains('open')&&!e.target.closest('#a11y,#a11yBtn,#mA11y,[data-legal=a11y]'))openA(false);});
}

/* ================= owner console ================= */
let LEADS=[],tab='ov',leadFilter='all',subs=[],pendingDel=null;
const ST={new:'חדש',work:'בטיפול',quote:'נשלחה הצעה',won:'נסגר',lost:'לא רלוונטי'};
const SRC={form:['מהטופס',''],kit:['מבונה הערכה','kit'],ai:['מלוטי','ai'],course:['רשימת קורסים','course'],stock:['עדכנו אותי','stock']};
const fmt=ts=>new Date(ts).toLocaleString('he-IL',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'});
function setNew(){const n=LEADS.filter(l=>l.status==='new').length; const e=$('#newCount'); e.hidden=!n; e.textContent=n;}
function openAdmin(){$('#adm').hidden=false; $('#adm').classList.add('open'); document.body.style.overflow='hidden';
 if(!subs.length&&db){subs.push(db.collection('leads').onSnapshot(s=>{LEADS=s.docs.flatMap(d=>((d.data()||{}).items||[]).map(it=>({...it,_d:d.id}))).sort((a,b)=>b.at-a.at); setNew(); if(['ov','leads','src','courses'].includes(tab))renderAdmin();},()=>{}));}
 renderAdmin(); setTimeout(()=>$('#adm .tab.on').focus(),30);}
function closeAdmin(){$('#adm').classList.remove('open'); $('#adm').hidden=true; document.body.style.overflow=''; if(location.hash==='#admin')history.replaceState(null,'',location.pathname); $('#admBtn').focus({preventScroll:true});}
async function updLead(d,id,patch,remove){const ref=db.doc('leads/'+d); const s=await ref.get(); const dt=s.data()||{}; let items=dt.items||[]; items=remove?items.filter(i=>i.id!==id):items.map(i=>i.id===id?{...i,...patch}:i); await ref.set({...dt,items,updatedAt:Date.now()});}
function leadCard(l){const [sl,sc]=SRC[l.source]||SRC.form; const k=l._d+'|'+l.id; return '<div class="box"><div class="lead-row">'
 +'<div><b>'+esc(l.name)+'</b> <span class="fine">'+fmt(l.at)+'</span><br><span class="badge">'+sl+'</span>'+(l.svc?'<span class="badge">'+esc(l.svc)+'</span>':'')+(l.attr?'<span class="badge" title="מקור ההגעה">'+(KIND[l.attr.kind]||'')+(l.attr.land&&l.attr.land!=='/'?' · '+esc(String(l.attr.land).slice(0,40)):'')+'</span>':'')+'</div>'
 +'<div><span class="mono" dir="ltr">'+esc(l.phone)+'</span><br><a class="mini" target="_blank" rel="noopener" href="https://wa.me/'+esc(String(l.phone).replace(/\D/g,'').replace(/^0/,'972'))+'">וואטסאפ</a></div>'
 +'<div><select data-st="'+k+'" aria-label="סטטוס">'+Object.entries(ST).map(([v,t])=>'<option value="'+v+'"'+(l.status===v?' selected':'')+'>'+t+'</option>').join('')+'</select></div>'
 +'<div>'+(pendingDel===k?'<span class="confirm">למחוק? <button class="mini warn" data-delok="'+k+'" type="button">כן</button><button class="mini" data-delno type="button">לא</button></span>':'<button class="mini warn" data-del="'+k+'" type="button">מחיקה</button>')+'</div>'
 +(l.spec?'<p class="msg"><b>מצורף:</b> '+esc(l.spec)+'</p>':'')+(l.msg?'<p class="msg">'+esc(l.msg)+'</p>':'')
 +'<textarea data-note="'+k+'" placeholder="הערות פנימיות…" style="grid-column:1/-1;min-height:56px" aria-label="הערות פנימיות">'+esc(l.note)+'</textarea></div></div>';}
async function saveSite(msgEl){ msgEl&&(msgEl.textContent='שומרת…'); try{await db.doc('data/site').set(JSON.parse(JSON.stringify(C))); applyContent(); renderCourses(); msgEl&&(msgEl.textContent='נשמר ופורסם באתר.');}catch(e){msgEl&&(msgEl.textContent='השמירה נכשלה. ודאי שיש הרשאת עריכה ונסי שוב.');} }
function renderAdmin(){
 const m=$('#admMain'); if(!db){m.innerHTML='<h2>מרכז הבקרה</h2><p class="empty">מסד הנתונים אינו זמין בתצוגה הזו.</p>';return;}
 const c=k=>LEADS.filter(l=>l.status===k).length;
 if(tab==='ov'||tab==='leads'){
  const list=tab==='ov'?LEADS.slice(0,4):LEADS.filter(l=>leadFilter==='all'||l.status===leadFilter);
  m.innerHTML=tab==='ov'?'<h2>סקירה</h2><p class="sub">מה קורה באתר, במבט אחד.</p><div class="kpis"><div class="kpi hot"><b>'+c('new')+'</b><span>פניות חדשות</span></div><div class="kpi"><b>'+(c('work')+c('quote'))+'</b><span>בטיפול והצעות</span></div><div class="kpi"><b>'+c('won')+'</b><span>נסגרו</span></div><div class="kpi"><b>'+LEADS.filter(l=>l.source==='course').length+'</b><span>ברשימת הקורסים</span></div><div class="kpi"><b>'+LEADS.filter(l=>l.source==='stock').length+'</b><span>"עדכנו אותי"</span></div></div><h3>אחרונות</h3>'+(list.map(leadCard).join('')||'<p class="empty">עדיין אין פניות.</p>')
   :'<h2>פניות</h2><p class="sub">מהטופס, מבונה הערכה, מלוטי, מרשימת הקורסים ומ"עדכנו אותי", במקום אחד.</p><div style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:16px">'+[['all','הכול'],...Object.entries(ST)].map(([k,v])=>'<button class="mini" type="button" aria-pressed="'+(leadFilter===k)+'" data-f="'+k+'" style="'+(leadFilter===k?'border-color:var(--accent);color:var(--accent)':'')+'">'+v+'</button>').join('')+'</div>'+(list.map(leadCard).join('')||'<p class="empty">אין פניות בסינון הזה.</p>');
  $$('[data-f]',m).forEach(b=>b.onclick=()=>{leadFilter=b.dataset.f;renderAdmin();});
  $$('[data-st]',m).forEach(s=>s.onchange=()=>{const [d,id]=s.dataset.st.split('|');updLead(d,id,{status:s.value});});
  $$('[data-note]',m).forEach(t=>t.onchange=()=>{const [d,id]=t.dataset.note.split('|');updLead(d,id,{note:t.value});});
  $$('[data-del]',m).forEach(b=>b.onclick=()=>{pendingDel=b.dataset.del;renderAdmin();});
  $$('[data-delno]',m).forEach(b=>b.onclick=()=>{pendingDel=null;renderAdmin();});
  $$('[data-delok]',m).forEach(b=>b.onclick=()=>{const [d,id]=b.dataset.delok.split('|');pendingDel=null;updLead(d,id,null,true);});
 }
 if(tab==='src'){
  const by={}; LEADS.forEach(l=>{const k=l.attr?l.attr.kind:'direct'; by[k]=(by[k]||0)+1;}); const land={}; LEADS.forEach(l=>{const k=l.attr&&l.attr.land?l.attr.land:'/'; land[k]=(land[k]||0)+1;});
  m.innerHTML='<h2>מקורות</h2><p class="sub">מאיפה הגיעו הפניות: מנוע חיפוש, מודעות, רשתות, הפניה או כניסה ישירה, ואיזה עמוד הביא אותן. נשמר עם כל פנייה בדפדפן של הגולשת עד 30 יום.</p><div class="kpis">'+Object.entries(KIND).map(([k,v])=>'<div class="kpi"><b>'+(by[k]||0)+'</b><span>'+v+'</span></div>').join('')+'</div><h3>עמודי כניסה</h3><table class="tbl"><tr><th>עמוד</th><th>פניות</th></tr>'+(Object.entries(land).sort((a,b)=>b[1]-a[1]).map(([k,v])=>'<tr><td>'+esc(k)+'</td><td>'+v+'</td></tr>').join('')||'<tr><td colspan="2" class="empty">אין עדיין נתונים.</td></tr>')+'</table>';
 }
 if(tab==='content'){
  const f=(k,l,ta)=>'<div><label for="k_'+k+'">'+l+'</label>'+(ta?'<textarea id="k_'+k+'" data-k="'+k+'">'+esc(C[k])+'</textarea>':'<input id="k_'+k+'" data-k="'+k+'" value="'+esc(C[k])+'">')+'</div>';
  m.innerHTML='<h2>תוכן ופרטי קשר</h2><p class="sub">שינוי שנשמר כאן מתעדכן באתר מיד. מחירים ומלאי נערכים ב-Shopify.</p><div class="cform"><div class="box"><b>פתיחה</b>'+f('heroLine','כותרת ראשית (הדגשה בין כוכביות *כך*)')+f('heroSub','טקסט משנה',1)+f('bar','פס ההכרזה')+'</div><div class="box"><b>עדן</b><label for="k_story">הסיפור (פסקאות מופרדות בשורה ריקה, שורות בתוך פסקה בירידת שורה)</label><textarea id="k_story" style="min-height:220px">'+esc(C.story.map(p=>p.join('\n')).join('\n\n'))+'</textarea></div><div class="box"><b>פרטי קשר</b>'+f('phone','טלפון (להצגה)')+f('phoneRaw','טלפון (ספרות)')+f('wa','וואטסאפ (קידומת 972)')+f('email','אימייל')+f('instagram','אינסטגרם')+'</div><div class="box"><b>מסמכים (ריק = הטיוטה שבאתר)</b>'+f('privacy','מדיניות פרטיות',1)+f('a11yText','הצהרת נגישות',1)+'</div><div class="savebar"><button class="btn pri" id="cSave" type="button">שמירה ופרסום</button><span id="cMsg" class="fnote" role="status"></span></div></div>';
  $('#cSave').onclick=()=>{$$('[data-k]',m).forEach(el=>C[el.dataset.k]=el.value); C.story=$('#k_story').value.split(/\n\s*\n/).map(p=>p.split('\n').map(s=>s.trim()).filter(Boolean)).filter(p=>p.length); saveSite($('#cMsg'));};
 }
 if(tab==='faq'){
  m.innerHTML='<h2>שאלות ותשובות</h2><p class="sub">השאלות באתר. לוטי עונה על פיהן.</p><div class="cform">'+C.faq.map((q,i)=>'<div class="box"><input data-q="'+i+'.0" value="'+esc(q[0])+'" aria-label="שאלה"><textarea data-q="'+i+'.1" aria-label="תשובה">'+esc(q[1])+'</textarea><button class="mini warn" type="button" data-qdel="'+i+'">מחיקה</button></div>').join('')+'<button class="mini" id="qAdd" type="button">הוספת שאלה</button><div class="savebar"><button class="btn pri" id="qSave" type="button">שמירה ופרסום</button><span id="qMsg" class="fnote" role="status"></span></div></div>';
  const col=()=>$$('[data-q]',m).forEach(el=>{const [i,k]=el.dataset.q.split('.'); C.faq[+i][+k]=el.value;});
  $('#qAdd').onclick=()=>{col();C.faq.push(['','']);renderAdmin();};
  $$('[data-qdel]',m).forEach(b=>b.onclick=()=>{col();C.faq.splice(+b.dataset.qdel,1);renderAdmin();});
  $('#qSave').onclick=()=>{col(); C.faq=C.faq.filter(q=>q[0].trim()); saveSite($('#qMsg'));};
 }
 if(tab==='courses'){
  C.courseItems=C.courseItems||[]; const cl2=LEADS.filter(l=>l.source==='course');
  m.innerHTML='<h2>קורסים</h2><p class="sub">אין קורסים בחנות כרגע, לכן האתר אומר את זה. כשתהיה תוכנית, מוסיפים אותה כאן והיא מופיעה באתר במקום ההודעה. רשימת ההמתנה למטה.</p><div class="cform">'+C.courseItems.map((x,i)=>'<div class="box"><input data-x="'+i+'.t" value="'+esc(x.t)+'" placeholder="שם הקורס" aria-label="שם"><input data-x="'+i+'.d" value="'+esc(x.d||'')+'" placeholder="תאריך ומקום" aria-label="תאריך"><input data-x="'+i+'.p" value="'+esc(x.p||'')+'" placeholder="מחיר (כפי שהוא בחנות)" aria-label="מחיר"><input data-x="'+i+'.u" value="'+esc(x.u||'')+'" placeholder="קישור לחנות" aria-label="קישור" dir="ltr"><button class="mini warn" type="button" data-xdel="'+i+'">מחיקה</button></div>').join('')+'<button class="mini" id="xAdd" type="button">הוספת קורס</button><div class="savebar"><button class="btn pri" id="xSave" type="button">שמירה ופרסום</button><span id="xMsg" class="fnote" role="status"></span></div></div><h3>רשימת המתנה ('+cl2.length+')</h3>'+(cl2.map(leadCard).join('')||'<p class="empty">אין עדיין נרשמות.</p>');
  const col=()=>$$('[data-x]',m).forEach(el=>{const [i,k]=el.dataset.x.split('.'); C.courseItems[+i][k]=el.value;});
  $('#xAdd').onclick=()=>{col();C.courseItems.push({t:'',d:'',p:'',u:''});renderAdmin();};
  $$('[data-xdel]',m).forEach(b=>b.onclick=()=>{col();C.courseItems.splice(+b.dataset.xdel,1);renderAdmin();});
  $('#xSave').onclick=()=>{col(); C.courseItems=C.courseItems.filter(x=>x.t.trim()); saveSite($('#xMsg'));};
 }
 if(tab==='products'){
  m.innerHTML='<h2>מוצרים</h2><p class="sub">צילום מצב של החנות מ-'+CAT.snap+' ('+ITEMS.length+' מוצרים, '+ITEMS.filter(x=>x.a).length+' במלאי). מחיר, מלאי ותיאור נערכים ב-Shopify, והאתר מתעדכן בסנכרון הבא של הקטלוג.</p><button class="mini" id="pCopy" type="button">העתקת הרשימה</button><table class="tbl" style="margin-top:12px"><tr><th>מוצר</th><th>מותג</th><th>מחיר</th><th>מלאי</th></tr>'+ITEMS.map(x=>'<tr><td>'+esc(title(x))+'</td><td>'+esc(x.b)+'</td><td>'+bdi(money(x.p))+'</td><td>'+(x.a?'במלאי':'אזל')+'</td></tr>').join('')+'</table>';
  $('#pCopy').onclick=async()=>{try{await navigator.clipboard.writeText(ITEMS.map(x=>[title(x),x.b,x.p,x.a?'במלאי':'אזל'].join('\t')).join('\n')); $('#pCopy').textContent='הועתק';}catch(_){$('#pCopy').textContent='ההעתקה נחסמה';}};
 }
 if(tab==='agent'){
  m.innerHTML='<h2>לוטי והסוכנת</h2><p class="sub">עונה למבקרות בעברית לפי המידע באתר בלבד, ושומרת פניות כשמבקשים שיחזרו.</p><div class="cform"><div class="box" style="display:flex;justify-content:space-between;gap:10px;align-items:center"><div><b>הסוכנת פעילה</b><br><span class="fnote">כשהיא כבויה, המבקרות מקבלות תשובות קבועות מהאתר</span></div><label style="display:flex;gap:8px;align-items:center"><input type="checkbox" id="aOn" style="width:22px;height:22px" '+(C.agentOn!==false?'checked':'')+'> פעילה</label></div><div class="box"><label for="aNotes">ידע נוסף לסוכנת</label><textarea id="aNotes" style="min-height:160px" placeholder="למשל: שעות מענה, מבצעים, מתי מגיעה סחורה…">'+esc(C.agentNotes)+'</textarea></div><div class="box" style="display:flex;justify-content:space-between;gap:10px;align-items:center"><div><b>לוטי, הדמות של האתר</b><br><span class="fnote">מכוונת מבקרות, לכל היותר 6 פעמים בביקור</span></div><label style="display:flex;gap:8px;align-items:center"><input type="checkbox" id="lOn" style="width:22px;height:22px" '+(C.lottiOn!==false?'checked':'')+'> פעילה</label></div><div class="box"><label for="lHello">משפט הפתיחה של לוטי (ריק = ברירת מחדל)</label><input id="lHello" value="'+esc(C.lottiHello)+'" placeholder="היי, אני לוטי…"></div><div class="savebar"><button class="btn pri" id="aSave" type="button">שמירה</button><span id="aMsg" class="fnote" role="status"></span></div></div>';
  $('#aSave').onclick=()=>{C.agentOn=$('#aOn').checked;C.agentNotes=$('#aNotes').value;C.lottiOn=$('#lOn').checked;C.lottiHello=$('#lHello').value.trim();saveSite($('#aMsg'));};
 }
}
function adminUI(){
 $('#admBtn').addEventListener('click',openAdmin);
 $$('#adm .tab').forEach(t=>t.addEventListener('click',()=>{if(t.dataset.t==='close')return closeAdmin(); tab=t.dataset.t; $$('#adm .tab').forEach(x=>x.classList.toggle('on',x===t)); renderAdmin();}));
 $('#adm').addEventListener('keydown',e=>{if(e.key==='Escape')closeAdmin();});
}

/* ================= init ================= */
/* after load, when the main thread is idle: work that makes the page richer but is not needed for its first paint */
const later=f=>{const go=()=>('requestIdleCallback' in window?requestIdleCallback(f,{timeout:1800}):setTimeout(f,300)); if(document.readyState==='complete')go(); else addEventListener('load',go,{once:true});};
function init(){
 applyContent(); renderCourses(); renderCats(); shopUI(); heroTicket(); applyVisuals(); LIFT.init(); MOTION.init(); later(()=>ATL.init()); qvUI(); cartUI(); kitUI(); formUI(); legalUI(); agentUI(); a11yUI(); adminUI(); chrome();
 $('#agentAv').innerHTML=''; entry(); LOT.tipsOnView();
 if(cl){
  cl.use('db').then(d=>{db=d; if(!db)return; db.doc('data/site').onSnapshot(s=>{ if(s.exists){ const d=s.data()||{}; C={...structuredClone(DEF),...d}; ['faq','story'].forEach(k=>{if(!Array.isArray(C[k])||!C[k].length)C[k]=structuredClone(DEF[k]);}); if(!$('#adm').classList.contains('open')){applyContent();renderCourses();} } },()=>{}); });
  cl.use('user').then(async u=>{user=u; if(!u)return; try{uid=await u.id(); isOwner=await u.isOwner();}catch(_){}
   if(isOwner){$('#admBtn').style.display='inline-flex'; if(location.hash==='#admin')openAdmin();}});
  cl.use('sample').then(s=>{sample=s;});
 }
}
init();
</script>
</body>
</html>
