
/* ================= catalog helpers ================= */
const ITEMS=CAT.items, BYID=new Map(ITEMS.map(x=>[x.i,x])), BYV=new Map(ITEMS.map(x=>[x.v,x])), BYH=new Map(ITEMS.map(x=>[x.h,x]));
const enc=encodeURI;
const pUrl=x=>'/products/'+enc(x.h)+'/', cUrl=h=>'/collections/'+enc(h)+'/';
const thumb=x=>'img/p/t/'+x.img+'.jpg', big=x=>'img/p/'+x.img+'.jpg';
const title=x=>x.dt||x.t;
const cheap=a=>a.slice().sort((p,q)=>p.p-q.p);
const waHref=t=>'https://wa.me/'+C.wa+'?text='+encodeURIComponent(t);
const FREE=CAT.freeShip;
const shipLine=(sum)=>sum<=0?'משלוח חינם בהזמנה מעל <b>'+money(FREE)+'</b>.':sum>=FREE?'<b>המשלוח חינם.</b> ההזמנה מעל '+money(FREE)+'.':'עוד <b>'+money(FREE-sum)+'</b> למשלוח חינם.';
const pct=sum=>Math.max(0,Math.min(100,sum/FREE*100));

/* Israel time, Friday afternoon to Saturday night: the store keeps Shabbat (approximate on purpose) */
function shabbat(){try{const p=new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Jerusalem',weekday:'short',hour:'numeric',hour12:false}).formatToParts(new Date());const wd=p.find(x=>x.type==='weekday').value,h=+p.find(x=>x.type==='hour').value%24;return(wd==='Fri'&&h>=15)||(wd==='Sat'&&h<21);}catch(_){return false;}}

/* ================= content (owner-editable) ================= */
const hl=s=>esc(s).replace(/\*(.+?)\*/g,'<em>$1</em>');
const same=(k)=>JSON.stringify(C[k])===JSON.stringify(DEF[k]);
function applyContent(){
 if(!same('heroLine'))$('[data-c=heroLine]').innerHTML=hl(C.heroLine);
 if(!same('heroSub'))$('[data-c=heroSub]').textContent=C.heroSub;
 if(!same('bar'))$('#barTxt').textContent=C.bar;
 if(!same('story'))$('#story').innerHTML=C.story.map(p=>'<p>'+p.map(esc).join('<br>')+'</p>').join('');
 if(!same('courseText'))$('[data-c=courseText]').textContent=C.courseText;
 renderFaq();
 const wa=waHref('שלום עדן, הגעתי מהאתר. '); $('#waLink').href=wa; $('#mWa').href=wa;
 $('#fN').textContent=ITEMS.length; $('#heroN').textContent=ITEMS.length; $('#allN').textContent=ITEMS.length;
 $('#yr').textContent=new Date().getFullYear();
}
function renderFaq(){
 const el=$('#faqList'); if(!el)return;
 if(same('faq')&&el.children.length)return;
 el.innerHTML=C.faq.map(([q,a],i)=>'<details'+(i===0?' open':'')+'><summary>'+esc(q)+'</summary><p>'+esc(a)+'</p></details>').join('');
}

/* ================= categories ================= */
const COVER={'הרמת-ריסים-וגבות':8479070290091,'דבקים-סיליקונים':8480545898667,'מוצרים-נלווים':8479577800875};
const COLORDER=['הרמת-ריסים-וגבות','דבקים-סיליקונים','מוצרים-נלווים','קורסים-והשתלמויות'];
function renderCats(){
 const cols=COLORDER.map(h=>CAT.cols.find(c=>c.h===h)).filter(Boolean);
 $('#catsList').innerHTML=cols.map(c=>{const soon=!c.n, x=BYID.get(COVER[c.h]);
  return '<li><a class="cat'+(soon?' soon':'')+'" href="'+cUrl(c.h)+'" data-col="'+esc(c.h)+'"><span class="im">'+(x?'<img src="'+thumb(x)+'" alt="" width="360" height="360" loading="lazy">':'<svg aria-hidden="true"><use href="#i-course"/></svg>')+'</span><span class="tx2"><b>'+esc(c.t)+'</b><span>'+(soon?'בקרוב, השאירי פרטים':bdi(c.n)+' מוצרים')+'</span><span class="go">'+(soon?'לרשימת ההמתנה':'לקולקציה')+' <svg aria-hidden="true"><use href="#i-arrow"/></svg></span></span></a></li>';}).join('');
 $$('#catsList a').forEach(a=>a.addEventListener('click',e=>{
  const h=a.dataset.col, c=CAT.cols.find(c=>c.h===h);
  if(!c.n){e.preventDefault(); location.hash='#courses'; $('#courses').scrollIntoView({behavior:reduce()?'auto':'smooth'}); return;}
  if(LIVE){e.preventDefault(); F.col=h; F.n=24; renderShop(); $('#shop').scrollIntoView({behavior:reduce()?'auto':'smooth'});}
 }));
}

/* ================= shop ================= */
const F={q:'',kind:'',brand:'',inStock:false,sort:'',col:'',n:24};
const KORDER=['set','step','pads','glue','tint','oxidant','clean','serum','tool'];
function filtered(){
 let a=ITEMS.slice();
 if(F.col){const c=CAT.cols.find(c=>c.h===F.col); const s=new Set(c?c.ids:[]); a=a.filter(x=>s.has(x.h));}
 if(F.kind)a=a.filter(x=>x.k===F.kind);
 if(F.brand)a=a.filter(x=>x.b===F.brand);
 if(F.inStock)a=a.filter(x=>x.a);
 if(F.q){const q=F.q.trim().toLowerCase(); a=a.filter(x=>(title(x)+' '+x.b+' '+x.d).toLowerCase().includes(q));}
 if(F.sort==='p1')a.sort((x,y)=>x.p-y.p); else if(F.sort==='p2')a.sort((x,y)=>y.p-x.p); else if(F.sort==='t')a.sort((x,y)=>title(x).localeCompare(title(y),'he'));
 else a.sort((x,y)=>(y.a-x.a)||(KORDER.indexOf(x.k)-KORDER.indexOf(y.k)));
 return a;
}
function card(x){
 const out=!x.a;
 return '<li><article class="pc"><button class="ph2" type="button" data-qv="'+x.i+'" aria-label="מבט מהיר: '+esc(title(x))+(out?', אזל':x.c?', מבצע':'')+'"><img src="'+thumb(x)+'" alt="'+esc(title(x))+'" width="360" height="360" loading="lazy" decoding="async">'+(out?'<span class="tagg out">אזל</span>':x.c?'<span class="tagg">מבצע</span>':'')+'</button>'
 +'<div class="bd"><p class="br">'+esc(x.b)+'</p><h3><a href="'+pUrl(x)+'" data-qv="'+x.i+'">'+esc(title(x))+'</a></h3><div class="row"><span class="pr">'+bdi(money(x.p))+(x.c?'<s>'+bdi(money(x.c))+'</s>':'')+'</span>'
 +(out?'<button class="add alt" type="button" data-notify="'+x.i+'">עדכנו אותי</button>':'<button class="add" type="button" data-add="'+x.i+'"><svg aria-hidden="true"><use href="#i-cart"/></svg>הוספה</button>')+'</div></div></article></li>';
}
function renderKinds(){
 const counts={}; ITEMS.forEach(x=>counts[x.k]=(counts[x.k]||0)+1);
 $('#kinds').innerHTML=[['','הכול',ITEMS.length],...KORDER.filter(k=>counts[k]).map(k=>[k,CAT.kinds[k],counts[k]])].map(([k,t,n])=>'<button class="kind" type="button" data-k="'+k+'" aria-pressed="'+(F.kind===k)+'">'+esc(t)+'<small>'+n+'</small></button>').join('');
 $$('#kinds .kind').forEach(b=>b.addEventListener('click',()=>{F.kind=b.dataset.k; F.n=24; renderShop();}));
}
function renderShop(){
 const a=filtered();
 $('#grid').innerHTML=a.slice(0,F.n).map(card).join('')||'<li class="empty" style="grid-column:1/-1;padding:30px 0">לא נמצאו מוצרים לסינון הזה. אפשר לנקות את החיפוש או לשאול את לוטי.</li>';
 const col=F.col&&CAT.cols.find(c=>c.h===F.col);
 $('#gCount').innerHTML='מציג '+bdi(Math.min(F.n,a.length))+' מתוך '+bdi(a.length)+' מוצרים'+(col?' · קולקציה: <b>'+esc(col.t)+'</b> <button class="lnk" type="button" id="clrCol">ניקוי</button>':'')+' · '+bdi(ITEMS.filter(x=>x.a).length)+' במלאי';
 const cc=$('#clrCol'); if(cc)cc.onclick=()=>{F.col='';F.n=24;renderShop();};
 $('#moreBtn').hidden=a.length<=F.n;
 $$('#kinds .kind').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.k===F.kind)));
}
function shopUI(){
 renderKinds();
 const brands=[...new Set(ITEMS.map(x=>x.b).filter(Boolean))].sort();
 $('#brand').innerHTML='<option value="">הכול</option>'+brands.map(b=>'<option>'+esc(b)+'</option>').join('');
 $('#q').addEventListener('input',e=>{F.q=e.target.value;F.n=24;renderShop();});
 $('#brand').addEventListener('change',e=>{F.brand=e.target.value;F.n=24;renderShop();});
 $('#sort').addEventListener('change',e=>{F.sort=e.target.value;renderShop();});
 $('#onlyIn').addEventListener('change',e=>{F.inStock=e.target.checked;F.n=24;renderShop();});
 $('#moreBtn').addEventListener('click',()=>{F.n+=24;renderShop();});
 $('#grid').addEventListener('click',e=>{
  const add=e.target.closest('[data-add]'); if(add){addToCart(BYID.get(+add.dataset.add)); return;}
  const nt=e.target.closest('[data-notify]'); if(nt){const x=BYID.get(+nt.dataset.notify); openLead({subject:'הזמנה',msg:'עדכנו אותי כשיהיה במלאי: '+title(x),source:'stock',spec:title(x)}); return;}
  const qv=e.target.closest('[data-qv]'); if(qv){ if(qv.tagName==='A'&&!LIVE&&!(e.metaKey||e.ctrlKey))return; e.preventDefault(); openQV(BYID.get(+qv.dataset.qv)); }
 });
 // brands
 const cnt={}; ITEMS.forEach(x=>{if(x.b)cnt[x.b]=(cnt[x.b]||0)+1;});
 $('#brandList').innerHTML=Object.entries(cnt).sort((a,b)=>b[1]-a[1]).map(([b,n])=>'<li><button type="button" data-b="'+esc(b)+'">'+esc(b)+'<small>'+bdi(n)+'</small></button></li>').join('');
 $$('#brandList button').forEach(b=>b.addEventListener('click',()=>{F.brand=b.dataset.b;F.kind='';F.col='';F.n=24;$('#brand').value=F.brand;renderShop();$('#shop').scrollIntoView({behavior:reduce()?'auto':'smooth'});}));
 renderShop();
}

/* ================= quick view ================= */
let qvItem=null,lastFocus=null;
function openQV(x){
 qvItem=x; lastFocus=document.activeElement;
 $('#qvImg').src=big(x); $('#qvImg').alt=title(x); $('#qvBrand').textContent=x.b||''; $('#qvT').textContent=title(x);
 $('#qvPrice').innerHTML=bdi(money(x.p))+(x.c?'<s>'+bdi(money(x.c))+'</s>':'');
 const av=$('#qvAvail'); av.textContent=x.a?'במלאי':'אזל מהמלאי'; av.classList.toggle('out',!x.a);
 const add=$('#qvAdd'); add.textContent=x.a?'הוספה לסל':'עדכנו אותי כשיחזור'; add.dataset.mode=x.a?'add':'notify';
 $('#qvAsk').href=waHref('שלום עדן, שאלה על: '+title(x)+' ('+money(x.p)+')');
 $('#qvDesc').innerHTML=x.d?x.d.split('\n').map(l=>'<p>'+esc(l)+'</p>').join(''):'<p class="fine">אין תיאור לעמוד הזה בחנות. אפשר לשאול את עדן בוואטסאפ.</p>';
 $('#qvSnap').textContent='מחיר ומלאי כפי שמופיעים בחנות ב-29.9.2026. התשלום בחנות.';
 const pg=$('#qvPage'); pg.hidden=LIVE; pg.href=pUrl(x);
 const d=$('#qv'); if(!d.open)d.showModal();
}
function qvUI(){
 const d=$('#qv');
 $('#qvX').onclick=()=>d.close();
 d.addEventListener('click',e=>{if(e.target===d)d.close();});
 d.addEventListener('close',()=>{lastFocus&&lastFocus.focus&&lastFocus.focus({preventScroll:true});});
 $('#qvAdd').onclick=()=>{ if(!qvItem)return; if($('#qvAdd').dataset.mode==='notify'){d.close();openLead({subject:'הזמנה',msg:'עדכנו אותי כשיהיה במלאי: '+title(qvItem),source:'stock',spec:title(qvItem)});} else {addToCart(qvItem);d.close();} };
}

/* ================= cart ================= */
let CART=[]; try{CART=JSON.parse(localStorage.getItem('edenCart')||'[]').filter(l=>BYV.has(l.v)&&l.q>0);}catch(_){CART=[];}
const saveCart=()=>{try{localStorage.setItem('edenCart',JSON.stringify(CART));}catch(_){}};
const cartLines=()=>CART.map(l=>({x:BYV.get(l.v),q:l.q})).filter(l=>l.x);
const cartSum=()=>cartLines().reduce((s,l)=>s+(l.x.a?l.x.p*l.q:0),0);
function addToCart(x,q=1,silent){
 if(!x||!x.a)return false;
 const l=CART.find(c=>c.v===x.v); if(l)l.q=Math.min(20,l.q+q); else CART.push({v:x.v,q:Math.min(20,q)});
 saveCart(); renderCart();
 if(!silent){ const b=$('#cartBtn'); b.animate&&!reduce()&&b.animate([{transform:'scale(1)'},{transform:'scale(1.25)'},{transform:'scale(1)'}],{duration:420}); LOT.say('נוסף לסל: <b>'+esc(title(x))+'</b>. '+shipLine(cartSum()),{state:'happy',key:'cart'}); }
 return true;
}
function cartLink(){return CAT.origin+'/cart/'+cartLines().filter(l=>l.x.a).map(l=>l.x.v+':'+l.q).join(',');}
function cartText(){const ls=cartLines().filter(l=>l.x.a); return 'שלום עדן, אני רוצה להזמין מהאתר:\n'+ls.map(l=>'• '+title(l.x)+(l.q>1?' ×'+l.q:'')+' – '+money(l.x.p*l.q)).join('\n')+'\nסה"כ מוצרים: '+money(cartSum());}
function renderCart(){
 const ls=cartLines(), sum=cartSum(), n=ls.reduce((s,l)=>s+l.q,0);
 const cc=$('#cartCnt'); cc.hidden=!n; cc.textContent=n; $('#cartBtn').setAttribute('aria-label','הסל שלי, '+n+' פריטים');
 $('#cartList').innerHTML=ls.length?ls.map(({x,q})=>'<li class="ci"><img src="'+thumb(x)+'" alt="" width="64" height="64"><div><b>'+esc(title(x))+'</b>'+(x.a?'<div class="q"><button type="button" data-q="-1" data-v="'+x.v+'" aria-label="הפחתה">−</button><span>'+q+'</span><button type="button" data-q="1" data-v="'+x.v+'" aria-label="הוספה">+</button></div>':'<div class="fine" style="color:var(--warn);font-weight:700">אזל, לא יועבר לחנות</div>')+'<button class="rm" type="button" data-rm="'+x.v+'">הסרה</button></div><span class="pr">'+bdi(x.a?money(x.p*q):'—')+'</span></li>').join('')
  :'<li class="empty">הסל ריק.<br><a href="#kit" data-close>בונה הערכה</a> או <a href="#shop" data-close>החנות</a>.</li>';
 $('#cTot').innerHTML=bdi(money(sum)); $('#cPg').style.width=pct(sum)+'%'; $('#cShip').innerHTML=shipLine(sum);
 const go=$('#cGo'); go.href=cartLink(); go.toggleAttribute('hidden',!ls.some(l=>l.x.a)); $('#cWa').href=waHref(cartText()); $('#cWa').toggleAttribute('hidden',!ls.some(l=>l.x.a)); $('#cClear').hidden=!ls.length;
 const sh=$('#shab'); if(shabbat()){sh.hidden=false;sh.textContent='החנות שומרת שבת (בקירוב, לפי שעון ישראל). אפשר להזמין בצאת השבת.';} else sh.hidden=true;
}
function openCart(o){
 const c=$('#cart'), s=$('#scrim'); c.classList.toggle('open',o); c.setAttribute('aria-hidden',String(!o)); c.inert=!o; s.hidden=!o; document.body.style.overflow=o?'hidden':'';
 if(o){lastFocus=document.activeElement; renderCart(); setTimeout(()=>$('#cartX').focus(),30);} else {lastFocus&&lastFocus.focus&&lastFocus.focus({preventScroll:true});}
}
function cartUI(){
 $('#cartBtn').onclick=()=>openCart(true); $('#cartX').onclick=()=>openCart(false); $('#scrim').onclick=()=>{openCart(false);openAgent&&openAgent(false);};
 $('#cart').addEventListener('keydown',e=>{if(e.key==='Escape')openCart(false);});
 $('#cartList').addEventListener('click',e=>{
  const q=e.target.closest('[data-q]'); if(q){const l=CART.find(c=>c.v===+q.dataset.v); if(l){l.q+=+q.dataset.q; if(l.q<=0)CART=CART.filter(c=>c!==l); saveCart(); renderCart();} return;}
  const r=e.target.closest('[data-rm]'); if(r){CART=CART.filter(c=>c.v!==+r.dataset.rm); saveCart(); renderCart(); return;}
  if(e.target.closest('[data-close]'))openCart(false);
 });
 $('#cClear').onclick=()=>{CART=[];saveCart();renderCart();};
 renderCart();
}

/* ================= the kit builder (the proof tool) ================= */
const KB={type:'lash',level:'start',pick:{},on:{}};
function kitCats(){return KIT[KB.type][KB.level];}
function kitOpts(cat){return cheap(ITEMS.filter(cat.f));}
function kitDefaults(keepOx){
 const cats=kitCats(); const prev={...KB.pick};
 KB.pick={}; KB.on={};
 cats.forEach(c=>{const o=kitOpts(c); const first=o.find(x=>x.a)||o[0]; if(first){KB.pick[c.k]=first.i; KB.on[c.k]=!!first.a;}});
 if(keepOx&&prev.tint&&KB.pick.tint){} // (a new tint re-picks the oxidant below)
 matchOxidant();
}
function matchOxidant(){
 if(KB.type!=='tint'||!KB.pick.tint)return;
 const t=BYID.get(KB.pick.tint), ox=kitOpts(kitCats().find(c=>c.k==='oxidant')).filter(x=>x.a);
 const m=ox.find(x=>t.b&&x.b===t.b)||ox[0]; if(m){KB.pick.oxidant=m.i; KB.on.oxidant=true;}
}
function kitSel(){return kitCats().map(c=>({c,x:BYID.get(KB.pick[c.k]),on:KB.on[c.k]})).filter(r=>r.x);}
function kitSum(){return kitSel().reduce((s,r)=>s+(r.on&&r.x.a?r.x.p:0),0);}
function kitText(){const rs=kitSel().filter(r=>r.on&&r.x.a); return 'שלום עדן, בניתי באתר רשימה ל'+KIT[KB.type].label+' ('+(KB.level==='start'?'מתחילה':'משלימה מלאי')+'):\n'+rs.map(r=>'• '+title(r.x)+' – '+money(r.x.p)).join('\n')+'\nסה"כ: '+money(kitSum())+'. אשמח לעזרה.';}
function renderKit(){
 const rs=kitSel();
 $('#kList').innerHTML=rs.length?rs.map(({c,x,on})=>{
  const opts=kitOpts(c);
  return '<li class="krow'+(on&&x.a?'':' off')+'" data-c="'+c.k+'"><input class="ck" type="checkbox" '+(on&&x.a?'checked':'')+(x.a?'':' disabled')+' aria-label="כלול: '+esc(c.t)+'"><img src="'+thumb(x)+'" alt="" width="76" height="76" loading="lazy"><div class="nm"><span class="cat2">'+esc(c.t)+'</span>'+(opts.length>1?'<select aria-label="בחירה אחרת ב'+esc(c.t)+'">'+opts.map(o=>'<option value="'+o.i+'"'+(o.i===x.i?' selected':'')+'>'+esc(title(o).slice(0,58))+' · '+money(o.p)+(o.a?'':' (אזל)')+'</option>').join('')+'</select>':'<b>'+esc(title(x))+'</b>')+(x.a?'':'<span class="out">אזל בחנות</span>')+'</div><span class="pr">'+bdi(x.a?money(x.p):'—')+'</span></li>';
 }).join(''):'<li class="krow empty">אין מוצרים לקטגוריה הזו כרגע.</li>';
 const sum=kitSum(); $('#kTot').innerHTML=bdi(money(sum)); $('#kPg').style.width=pct(sum)+'%'; $('#kShip').innerHTML=shipLine(sum);
 const has=rs.some(r=>r.on&&r.x.a); $('#kCart').disabled=!has; $('#kWa').setAttribute('aria-disabled',String(!has)); $('#kWa').href=waHref(kitText());
}
function kitUI(){
 kitDefaults(); renderKit();
 $$('input[name=kt]').forEach(r=>r.addEventListener('change',()=>{KB.type=r.value;kitDefaults();renderKit();LOT.state('look',1500);}));
 $$('input[name=kl]').forEach(r=>r.addEventListener('change',()=>{KB.level=r.value;kitDefaults();renderKit();}));
 $('#kList').addEventListener('change',e=>{
  const row=e.target.closest('.krow'); if(!row)return; const k=row.dataset.c;
  if(e.target.classList.contains('ck'))KB.on[k]=e.target.checked;
  else if(e.target.tagName==='SELECT'){KB.pick[k]=+e.target.value; KB.on[k]=!!BYID.get(KB.pick[k]).a; if(k==='tint')matchOxidant();}
  renderKit();
 });
 $('#kCart').onclick=()=>{ const rs=kitSel().filter(r=>r.on&&r.x.a); rs.forEach(r=>addToCart(r.x,1,true)); openCart(true); LOT.say('הרשימה בסל. '+shipLine(cartSum()),{state:'wink',key:'kit'}); liftHero(); };
 $('#kLead').onclick=()=>{ const rs=kitSel().filter(r=>r.on&&r.x.a); openLead({subject:'שאלה על מוצר',msg:'',source:'kit',spec:kitText(),attach:'מצורפת הרשימה מבונה הערכה ('+rs.length+' מוצרים, '+money(kitSum())+')'}); };
}

/* ================= hero: the lift (the signature) ================= */
let liftT=0,liftRaf=0;
function lashSVG(t){
 const n=17,B=u=>[(1-u)*(1-u)*18+2*(1-u)*u*200+u*u*382,(1-u)*(1-u)*118+2*(1-u)*u*54+u*u*118];
 let out='<path class="lid" d="M18 118 Q200 54 382 118"/>';
 for(let i=0;i<n;i++){
  const u=(i+.5)/n,[bx,by]=B(u),tx=2*(1-u)*(200-18)+2*u*(382-200),ty=2*(1-u)*(54-118)+2*u*(118-54),tl=Math.hypot(tx,ty),nx=ty/tl,ny=-tx/tl;
  const side=u<.5?-1:1, fan=(u-.5)*.9, dx=nx*Math.cos(fan)-ny*Math.sin(fan), dy=nx*Math.sin(fan)+ny*Math.cos(fan), L=26+30*Math.pow(Math.sin(Math.PI*u),.7);
  const cx=(tx/tl)*side, cy=(ty/tl)*side;
  const p=(a,b,k)=>[bx+dx*L*a+cx*L*b*k, by+dy*L*a+cy*L*b*k].map(v=>v.toFixed(1)).join(' ');
  out+='<path class="ls" d="M'+bx.toFixed(1)+' '+by.toFixed(1)+' C'+p(.38,0,t)+' '+p(.78,.10,t)+' '+p(1-.12*t,.42,t)+'"/>';
 }
 return out;
}
function setLift(t){liftT=t; const s=$('#lashes'); if(s)s.innerHTML=lashSVG(t);}
function liftHero(from=0,ms=1300){
 cancelAnimationFrame(liftRaf);
 if(reduce()){setLift(1);return;}
 const t0=performance.now(), ease=x=>1-Math.pow(1-x,3);
 (function f(now){const k=Math.min(1,(now-t0)/ms); setLift(from+(1-from)*ease(k)); if(k<1)liftRaf=requestAnimationFrame(f);})(t0);
}

/* ================= entry choreography: the mark writes itself, then the curl ================= */
function entry(){
 const d=document.documentElement, ld=$('#ld'), svg=$('.ldm',ld);
 svg.setAttribute('viewBox',SYM.vb.join(' '));
 svg.insertAdjacentHTML('beforeend','<g mask="url(#ringMask)"><path fill="currentColor" fill-rule="evenodd" d="'+SYM.ring+'"/></g><path class="lm-mono" fill="currentColor" fill-rule="evenodd" d="'+SYM.mono+'"/><path class="lm-lotus" fill="currentColor" fill-rule="evenodd" d="'+SYM.lotus+'"/>');
 setLift(0);
 const done=()=>{d.classList.remove('pre'); try{sessionStorage.setItem('edenSeen','1');}catch(_){} setTimeout(()=>liftHero(0,1300),d.classList.contains('noload')?250:350); LOT.born();};
 if(!d.classList.contains('pre')){ done(); return; }
 const r=$('#ringDraw'); r.animate&&r.animate([{strokeDashoffset:666},{strokeDashoffset:0}],{duration:900,easing:'cubic-bezier(.4,.1,.2,1)',fill:'forwards'});
 const ready=Promise.race([document.fonts&&document.fonts.ready,new Promise(r=>setTimeout(r,1500))]);
 Promise.all([ready,new Promise(r=>setTimeout(r,1750))]).then(done);
}

/* ================= chrome: header, reveal, nav spy, mobile bar ================= */
function chrome(){
 const hdr=$('#hdr'), mbar=$('#mbar');
 addEventListener('scroll',()=>{hdr.classList.toggle('scrolled',scrollY>30); mbar.classList.toggle('on',scrollY>innerHeight*.8&&scrollY<document.documentElement.scrollHeight-innerHeight*1.4);},{passive:true});
 const io=new IntersectionObserver(es=>es.forEach(e=>{if(e.isIntersecting){e.target.classList.add('on');io.unobserve(e.target);}}),{rootMargin:'0px 0px -8% 0px',threshold:.08});
 $$('.rv').forEach(el=>{ if(el.closest('.hero'))return; io.observe(el); });
 const spy=new IntersectionObserver(es=>es.forEach(e=>{if(e.isIntersecting){const id=e.target.id; $$('.nav a').forEach(a=>a.setAttribute('aria-current',String(a.getAttribute('href')==='#'+id)));}}),{rootMargin:'-45% 0px -50% 0px'});
 ['kit','shop','brands','film','about','courses','faq','contact'].forEach(id=>{const el=$('#'+id); el&&spy.observe(el);});
 const dr=$('#drawer'), bg=$('#burger');
 const openDr=o=>{dr.classList.toggle('open',o); dr.setAttribute('aria-hidden',String(!o)); dr.inert=!o; bg.setAttribute('aria-expanded',String(o)); document.body.style.overflow=o?'hidden':''; if(o)setTimeout(()=>$('#drawerX').focus(),30); else bg.focus({preventScroll:true});};
 bg.onclick=()=>openDr(true); $('#drawerX').onclick=()=>openDr(false);
 dr.addEventListener('click',e=>{if(e.target===dr||e.target.closest('a.dl'))openDr(false);});
 dr.addEventListener('keydown',e=>{if(e.key==='Escape')openDr(false);});
 window.openDr=openDr;
 $('#liftBtn').onclick=()=>{liftHero(0,1500);LOT.state('happy',1600);};
 $('#vis').addEventListener('pointerenter',()=>{if(liftT>.98&&!reduce())liftHero(.55,900);});
 // the shabbat notice
 if(shabbat()){ $('#barTxt').textContent='החנות שומרת שבת (בקירוב, לפי שעון ישראל). אפשר להזמין בצאת השבת. אפשר להמשיך לבנות סל.'; }
}
