<script>
/* ---------- orders ---------- */
let db=null,uid=null,isOwner=false;
const cl=window.claude&&window.claude.use?window.claude:null;
async function saveOrder(o){ if(!db||!uid)throw new Error('offline'); const ref=db.doc('orders/'+uid); const s=await ref.get(); const items=(s.exists&&s.data().items)||[]; items.push({id:rid(),at:Date.now(),status:'new',note:'',...o}); await ref.set({items,updatedAt:Date.now()}); }
$$('#oDom .opt').forEach(b=>b.onclick=()=>$$('#oDom .opt').forEach(x=>x.setAttribute('aria-pressed',String(x===b))));
$('#ordForm').addEventListener('submit',async e=>{
 e.preventDefault(); const note=$('#oNote'); note.classList.remove('err');
 const bad=(m,el)=>{note.textContent=m; note.classList.add('err'); el.focus();};
 const name=$('#oName').value.trim(), phone=$('#oPhone').value.trim(), mail=$('#oMail').value.trim(), inp=$('#oIn').value.trim();
 if(!inp)return bad('כתבו קישור, רעיון או שם, כדי שנדע ממה מתחילים.',$('#oIn'));
 if(!name)return bad('איך לפנות אליכם? מלאו שם.',$('#oName'));
 if(phone.replace(/\D/g,'').length<9)return bad('מספר הטלפון קצר מדי. בדקו אותו ונסו שוב.',$('#oPhone'));
 if(mail&&!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(mail))return bad('כתובת האימייל לא נראית תקינה.',$('#oMail'));
 if(!$('#oAgree').checked)return bad('כדי שנוכל לשמור את ההזמנה, סמנו את האישור.',$('#oAgree'));
 const plan=($$('#oPlan .opt').find(b=>b.getAttribute('aria-pressed')==='true')||{}).dataset?.v||'';
 const dom=($$('#oDom .opt').find(b=>b.getAttribute('aria-pressed')==='true')||{}).dataset?.v||'';
 const o={name,phone,mail,input:inp.slice(0,1200),plan,domMode:dom,domain:$('#oDomain').value.trim().slice(0,120)};
 const btn=e.target.querySelector('[type=submit]'); btn.disabled=true; note.textContent='שולח…';
 try{ await saveOrder(o); const f=e.target; [...f.children].forEach(c=>c.hidden=true);
  const d=document.createElement('div'); d.className='sent'; d.setAttribute('role','status'); d.tabIndex=-1;
  d.innerHTML=`<svg viewBox="0 0 96 100" width="70" height="72" style="color:var(--ink)" aria-hidden="true"><use href="#mk"/></svg><h3>ההזמנה התקבלה.</h3><p>תוך יום עסקים תקבלו תוכנית עבודה וקישור לתשלום.</p>`;
  f.appendChild(d); d.focus();
 }catch(_){ const t=`הזמנה ל-AILGEN: ${name}, ${phone}${mail?', '+mail:''}. חבילה: ${plan}. קלט: ${inp}. דומיין: ${dom} ${o.domain}`;
  note.innerHTML=`לא הצלחנו לשמור את ההזמנה בתצוגה הזו.${C.email||C.phone?` שלחו לנו את הפרטים${C.email?` ל-<bdi dir="ltr">${esc(C.email)}</bdi>`:''}${C.phone?` או בטלפון <bdi dir="ltr">${esc(C.phone)}</bdi>`:''}:`:' העתיקו את הפרטים ונסו שוב מאוחר יותר:'}<span style="display:block;margin-top:8px;padding:10px;border-radius:10px;background:var(--paper);user-select:all">${esc(t)}</span>`; }
 btn.disabled=false;
});

/* ---------- control center ---------- */
let ORD=[],tab='orders',subs=[],pendingDel=null;
const OST={new:'חדשה',plan:'תוכנית נשלחה',paid:'שולם',prod:'בייצור',review:'בתיקונים',live:'באוויר',lost:'לא רלוונטי'};
const fmt=ts=>new Date(ts).toLocaleString('he-IL',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'});
function openAdmin(){$('#adm').classList.add('open'); document.body.style.overflow='hidden';
 if(!subs.length&&db){subs.push(db.collection('orders').onSnapshot(s=>{ORD=s.docs.flatMap(d=>((d.data()||{}).items||[]).map(it=>({...it,_d:d.id}))).sort((a,b)=>b.at-a.at); if(tab==='orders')renderAdmin();},()=>{}));}
 renderAdmin(); setTimeout(()=>$('#adm .tab.on').focus(),30);}
function closeAdmin(){$('#adm').classList.remove('open'); document.body.style.overflow=''; $('#admBtn').focus({preventScroll:true});}
$$('#adm .tab').forEach(t=>t.addEventListener('click',()=>{if(t.dataset.t==='close')return closeAdmin(); tab=t.dataset.t; $$('#adm .tab').forEach(x=>x.classList.toggle('on',x===t)); renderAdmin();}));
$('#adm').addEventListener('keydown',e=>{if(e.key==='Escape')closeAdmin();});
async function updOrd(d,id,patch,remove){const ref=db.doc('orders/'+d); const s=await ref.get(); const dt=s.data()||{}; let items=dt.items||[]; items=remove?items.filter(i=>i.id!==id):items.map(i=>i.id===id?{...i,...patch}:i); await ref.set({...dt,items,updatedAt:Date.now()});}
async function saveSite(el){ el.textContent='שומר…'; try{await db.doc('data/site').set(JSON.parse(JSON.stringify(C))); renderPlans(); el.textContent='נשמר ופורסם.';}catch(_){el.textContent='השמירה נכשלה. ודאו שיש לכם הרשאת עריכה.';} }
function renderAdmin(){
 const m=$('#admMain'); if(!db){m.innerHTML='<h2>מרכז הבקרה</h2><p class="empty">מסד הנתונים אינו זמין בתצוגה הזו.</p>';return;}
 if(tab==='orders'){
  const c=k=>ORD.filter(o=>o.status===k).length, planName=k=>(C.plans.find(p=>p.k===k)||{}).n||k, priceOf=k=>+(String((C.plans.find(p=>p.k===k)||{}).price||'0').replace(/\D/g,''));
  const pipe=ORD.filter(o=>['paid','prod','review','live'].includes(o.status)).reduce((a,o)=>a+priceOf(o.plan),0);
  m.innerHTML=`<h2>הזמנות</h2><p class="sub">כל הזמנה מהעמוד, עם הקלט, החבילה והדומיין.</p>
   <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:20px">${[['new','חדשות'],['paid','שולמו'],['prod','בייצור'],['live','באוויר']].map(([k,l])=>`<div class="box" style="margin:0"><b style="font:600 30px var(--mono)">${c(k)}</b><br><span>${l}</span></div>`).join('')}</div>
   <p class="sub">הכנסות מהזמנות ששולמו: <b dir="ltr">₪${pipe.toLocaleString('he-IL')}</b> (לפני מע"מ, לפי המחירון הנוכחי)</p>
   ${ORD.map(o=>{const k=o._d+'|'+o.id; return `<div class="box"><div class="orow"><div><b>${esc(o.name)}</b> <span style="color:var(--mute);font-size:13px">${fmt(o.at)}</span><br><span class="badge">${esc(planName(o.plan))}</span><span class="badge">${esc({new:'דומיין חדש',own:'דומיין קיים',later:'דומיין: אחר כך'}[o.domMode]||'')} ${esc(o.domain)}</span></div>
    <div><span dir="ltr" style="font-family:var(--mono)">${esc(o.phone)}</span><br><span dir="ltr" style="font-size:14px">${esc(o.mail)}</span></div>
    <div><select data-st="${k}" aria-label="סטטוס">${Object.entries(OST).map(([v,t])=>`<option value="${v}" ${o.status===v?'selected':''}>${t}</option>`).join('')}</select></div>
    <div>${pendingDel===k?`<span class="confirm">למחוק? <button class="mini warn" data-delok="${k}" type="button">כן</button><button class="mini" data-delno type="button">לא</button></span>`:`<button class="mini warn" data-del="${k}" type="button">מחיקה</button>`}</div>
    <p class="msg"><b>קלט:</b> ${esc(o.input)}</p><textarea data-note="${k}" placeholder="הערות פנימיות…" style="grid-column:1/-1;min-height:56px" aria-label="הערות">${esc(o.note)}</textarea></div></div>`;}).join('')||'<p class="empty">עדיין אין הזמנות.</p>'}`;
  $$('[data-st]',m).forEach(s=>s.onchange=()=>{const [d,id]=s.dataset.st.split('|');updOrd(d,id,{status:s.value});});
  $$('[data-note]',m).forEach(t=>t.onchange=()=>{const [d,id]=t.dataset.note.split('|');updOrd(d,id,{note:t.value});});
  $$('[data-del]',m).forEach(b=>b.onclick=()=>{pendingDel=b.dataset.del;renderAdmin();});
  $$('[data-delno]',m).forEach(b=>b.onclick=()=>{pendingDel=null;renderAdmin();});
  $$('[data-delok]',m).forEach(b=>b.onclick=()=>{const [d,id]=b.dataset.delok.split('|');pendingDel=null;updOrd(d,id,null,true);});
 }
 if(tab==='plans'){
  m.innerHTML=`<h2>חבילות ומחירים</h2><p class="sub">מה שנשמר כאן מתעדכן בעמוד מיד.</p><div class="cform">${C.plans.map((p,i)=>`<div class="box cform"><div style="display:grid;grid-template-columns:2fr 1fr 1fr auto;gap:8px;align-items:end"><div><label for="pn${i}">שם</label><input id="pn${i}" data-p="${i}.n" value="${esc(p.n)}"></div><div><label for="pp${i}">מחיר (₪)</label><input id="pp${i}" data-p="${i}.price" value="${esc(p.price)}" dir="ltr"></div><div><label for="pm${i}">חודשי (₪)</label><input id="pm${i}" data-p="${i}.mo" value="${esc(p.mo)}" dir="ltr"></div><label style="display:flex;gap:6px;align-items:center;font-weight:600"><input type="radio" name="hot" data-hot="${i}" ${p.hot?'checked':''} style="width:20px;min-height:20px"> מודגש</label></div><label for="pi${i}">מה כלול (שורה לכל פריט)</label><textarea id="pi${i}" data-items="${i}">${esc(p.items.join('\n'))}</textarea></div>`).join('')}
   <div class="box cform"><label for="pNote">הערה מתחת למחירים</label><input id="pNote" value="${esc(C.planNote)}"><label for="pMail">אימייל לגיבוי כשהשמירה לא זמינה</label><input id="pMail" value="${esc(C.email)}" dir="ltr"><label for="pPhone">טלפון לגיבוי</label><input id="pPhone" value="${esc(C.phone)}" dir="ltr"></div>
   <div class="savebar"><button class="btn" id="pSave" type="button">שמירה ופרסום</button><span id="pMsg" class="fnote" role="status"></span></div></div>`;
  $('#pSave').onclick=()=>{ $$('[data-p]',m).forEach(el=>{const [i,k]=el.dataset.p.split('.'); C.plans[+i][k]=el.value.trim();}); $$('[data-items]',m).forEach(el=>C.plans[+el.dataset.items].items=el.value.split('\n').map(s=>s.trim()).filter(Boolean)); $$('[data-hot]',m).forEach(el=>C.plans[+el.dataset.hot].hot=el.checked); C.planNote=$('#pNote').value; C.email=$('#pMail').value.trim(); C.phone=$('#pPhone').value.trim(); saveSite($('#pMsg')); };
 }
}
$('#admBtn').addEventListener('click',openAdmin);

/* ---------- chrome ---------- */
addEventListener('scroll',()=>$('#hdr').classList.toggle('scrolled',scrollY>40),{passive:true});
$('#yr').textContent=new Date().getFullYear();
$('#stillBtn').onclick=()=>{const on=document.documentElement.classList.toggle('a-still'); $('#stillBtn').setAttribute('aria-pressed',String(on));};
const A11Y=`הצהרת נגישות · AILGEN

העמוד נבנה לפי התקן הישראלי ת"י 5568 והנחיות WCAG 2.1 ברמה AA: ניווט מלא במקלדת עם קישור "דלג לתוכן", סימון פוקוס ברור, מבנה כותרות תקין, תוויות לכל שדה, ניגודיות שנבדקה, כיבוד הגדרת "הפחתת תנועה", וכפתור לעצירת אנימציות בתחתית העמוד.

נתקלתם בבעיה? נשמח לתקן. כתבו לנו דרך טופס ההזמנה בעמוד.`;
$('#a11yS').onclick=()=>{$('#lgT').textContent='הצהרת נגישות'; $('#lgTxt').textContent=A11Y; $('#lg').showModal();};
$('#lg').addEventListener('click',e=>{if(e.target.id==='lg'||e.target.closest('[data-close]'))$('#lg').close();});

/* hero particles: the AILGEN motif, quiet */
(function(){ const c=$('#pcv'), g=c.getContext('2d'); let w,h,P=[];
 const size=()=>{w=c.width=c.offsetWidth*devicePixelRatio; h=c.height=c.offsetHeight*devicePixelRatio; P=Array.from({length:Math.round(w*h/26000)},()=>({x:Math.random()*w,y:Math.random()*h,v:.15+Math.random()*.5,r:(Math.random()*1.6+.4)*devicePixelRatio,a:Math.random()<.08}));};
 size(); addEventListener('resize',size);
 const draw=()=>{ g.clearRect(0,0,w,h); for(const p of P){ if(!still()){p.y-=p.v*devicePixelRatio; if(p.y<-5){p.y=h+5;p.x=Math.random()*w;}} g.fillStyle=p.a?'rgba(255,178,62,.9)':'rgba(174,180,216,.45)'; g.fillRect(p.x,p.y,p.a?p.r*2.2:p.r,p.a?p.r*2.2:p.r);} requestAnimationFrame(draw); };
 draw(); })();

/* ---------- init ---------- */
renderStatic(); renderPlans(); renderFlow(); showExample();
if(cl){
 cl.use('db').then(d=>{db=d; if(!db)return; db.doc('data/site').onSnapshot(s=>{ if(s.exists){ const d=s.data()||{}; C={...structuredClone(DEF),...d}; if(!Array.isArray(C.plans)||!C.plans.length)C.plans=structuredClone(DEF.plans); renderPlans(); } },()=>{}); });
 cl.use('user').then(async u=>{ if(!u)return; try{uid=await u.id(); isOwner=await u.isOwner();}catch(_){} if(isOwner)$('#admBtn').style.display='inline-flex'; });
 cl.use('sample').then(s=>{sample=s;});
}
</script>
</body>
</html>
