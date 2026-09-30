
/* ================= Lotti: born from the ring and the lotus of the logo. Manners: <= 6 tips per visit, >= 11 s apart, each once, quiet for a week, reduced motion safe ================= */
const LOT=(()=>{
 const el=$('#lotti'), btn=$('#lbtn'), bub=$('#lb'), menu=$('#lm');
 const W=LOTTI.grid[0].length, H=LOTTI.grid.length, COL=LOTTI.colors;
 const rects=(list)=>list.map(([x,y,w,h,k])=>'<rect x="'+x+'" y="'+y+'" width="'+w+'" height="'+h+'" fill="'+COL[k]+'"/>').join('');
 const body=(()=>{let s='';LOTTI.grid.forEach((row,y)=>{let x=0;while(x<row.length){const ch=row[x];let n=1;while(row[x+n]===ch)n++;if(ch!=='.')s+='<rect x="'+x+'" y="'+y+'" width="'+n+'" height="1" fill="'+COL[ch]+'"/>';x+=n;}});return s;})();
 const faces={}; Object.keys(LOTTI.faces).forEach(k=>faces[k]=rects(LOTTI.faces[k]));
 const svg=(f)=>'<svg viewBox="0 0 '+W+' '+H+'" shape-rendering="crispEdges" aria-hidden="true" focusable="false">'+body+'<g class="face">'+faces[f]+'</g></svg>';
 let base=shabbat()?'shabbat':'idle', cur=base, tips=+(sessionStorage.getItem('edenTips')||0), last=0, said=new Set(), idleT=0, backT=0, bubT=0, alive=false;
 const lsGet=k=>{try{return localStorage.getItem(k);}catch(_){return null;}}, lsSet=(k,v)=>{try{localStorage.setItem(k,v);}catch(_){}};
 const muted=()=>+(lsGet('edenLottiMuted')||0)>Date.now(), hidden=()=>lsGet('edenLottiHide')==='1'||C.lottiOn===false;
 const g=()=>btn.querySelector('.face');
 function paint(f){cur=f; if(g())g().innerHTML=faces[f]||faces.idle;}
 function state(f,ms){ if(!alive||!faces[f])return; paint(f); clearTimeout(backT); if(ms)backT=setTimeout(()=>paint(base),ms); if(!reduce()&&(f==='happy'||f==='wink')){btn.classList.remove('hop');void btn.offsetWidth;btn.classList.add('hop');} }
 const busy=()=>{const a=document.activeElement; return (a&&/^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName)&&a.type!=='checkbox'&&a.type!=='radio')||document.querySelector('dialog[open]')||$('#cart').classList.contains('open')||$('#agent').classList.contains('open')||$('#adm').classList.contains('open');};
 function show(html,ms){ clearTimeout(bubT); bub.innerHTML=html; bub.hidden=false; bubT=setTimeout(()=>{bub.hidden=true;},ms||Math.min(9000,3800+html.length*45)); }
 /* a tip obeys the manners; opts.force is for answers to something the visitor just did */
 function say(html,o={}){
  if(!alive||hidden()||el.hidden)return false;
  if(!o.force){
   if(muted()||tips>=6||Date.now()-last<11000||busy())return false;
   if(o.key&&said.has(o.key))return false;
   tips++; sessionStorage.setItem('edenTips',String(tips)); last=Date.now();
  }
  if(o.key)said.add(o.key);
  show(html); if(o.state)state(o.state,1800); if(o.point)point(o.point);
  return true;
 }
 function point(target){
  const t=typeof target==='string'?$(target):target; if(!t||reduce()||hidden())return;
  const a=btn.getBoundingClientRect(), b=t.getBoundingClientRect(); if(!b.width||b.top<innerHeight*.08||b.top>innerHeight*.8||innerWidth<981)return; // point only at what is already on screen, and not on a phone
  const x1=a.left+a.width/2,y1=a.top+a.height/3,x2=Math.min(innerWidth-8,Math.max(8,b.left+b.width/2)),y2=Math.min(innerHeight-8,Math.max(8,b.top+Math.min(40,b.height/2)));
  const bm=$('#beam'); $('#beamP',bm).setAttribute('d','M'+x1+' '+y1+' Q'+((x1+x2)/2)+' '+(Math.min(y1,y2)-60)+' '+x2+' '+y2); bm.hidden=false;
  const p=$('#beamP',bm); p.animate&&p.animate([{strokeDashoffset:80,opacity:0},{opacity:.9},{strokeDashoffset:0,opacity:0}],{duration:1800});
  t.classList.add('pointed'); setTimeout(()=>{t.classList.remove('pointed'); bm.hidden=true;},2000);
 }
 function blink(){ if(!alive||reduce())return; if(cur===base&&base==='idle'){paint('blink');setTimeout(()=>{if(cur==='blink')paint(base);},130);} clearTimeout(blink.t); blink.t=setTimeout(blink,2400+Math.random()*3600); }
 function idle(){ clearTimeout(idleT); if(base==='shabbat')return; idleT=setTimeout(()=>{ if(!alive||reduce())return; paint('think'); say('צריכה עזרה? אפשר לשאול אותי, או לבנות ערכה בשלוש בחירות.',{key:'help'}); idleT=setTimeout(()=>{paint('sleep');},43000); },22000); }
 function wake(){ if(!alive)return; if(cur==='think'||cur==='sleep')paint(base); idle(); }
 function born(){
  if(hidden()){alive=false;return;} el.hidden=false;
  btn.innerHTML=svg(base); $('#agentAv').innerHTML=svg('happy'); alive=true; paint(base);
  const first=!sessionStorage.getItem('edenBorn'); sessionStorage.setItem('edenBorn','1');
  if(first&&!reduce()&&el.animate){ // she comes out of the lotus of the logo and finds her corner
   const lo=$('.logo svg').getBoundingClientRect(), me=el.getBoundingClientRect();
   const dx=(lo.left+lo.width*.8)-(me.left+me.width/2), dy=(lo.top+lo.height*.25)-(me.top+me.height/2);
   el.animate([{transform:'translate('+dx+'px,'+dy+'px) scale(.2)',opacity:0},{transform:'translate('+dx*.3+'px,'+(dy*.3-40)+'px) scale(.8)',opacity:1,offset:.55},{transform:'none',opacity:1}],{duration:1100,easing:'cubic-bezier(.3,1.2,.4,1)'});
  }
  // manners: the greeting waits until the visitor has left the first screen (it never covers the headline or the products)
  const hello=()=>{ if(base==='shabbat')say('שבת שלום. אפשר לבנות סל, וההזמנות נפתחות בצאת השבת.',{key:'hello',force:true}); else say(C.lottiHello||'היי, אני לוטי. אם תרצי, אבנה איתך ערכה או אעשה סיור קצר במותגים.',{key:'hello',state:'happy',force:true}); };
  const top=$('#top'); if(top&&'IntersectionObserver' in window){ const io=new IntersectionObserver(es=>{ if(!es[0].isIntersecting){ io.disconnect(); setTimeout(hello,700); } },{threshold:.15}); io.observe(top); } else setTimeout(hello,1300);
  blink(); idle();
 }
 function menuOpen(o){ menu.hidden=!o; btn.setAttribute('aria-expanded',String(o)); if(o){bub.hidden=true; menu.querySelector('button').focus();} }
 btn.addEventListener('click',()=>{menuOpen(menu.hidden); wake();});
 document.addEventListener('click',e=>{if(!menu.hidden&&!e.target.closest('#lotti'))menuOpen(false);});
 menu.addEventListener('keydown',e=>{if(e.key==='Escape'){menuOpen(false);btn.focus();}});
 menu.addEventListener('click',e=>{
  const b=e.target.closest('[data-l]'); if(!b)return; const a=b.dataset.l; menuOpen(false);
  if(a==='kit'){ $('#kit').scrollIntoView({behavior:reduce()?'auto':'smooth'}); setTimeout(()=>point('#kList'),700); }
  else if(a==='tour'){ tour(); }
  else if(a==='ask'){ openAgent(true); }
  else if(a==='quiet'){ lsSet('edenLottiMuted',String(Date.now()+7*864e5)); show('בסדר. אשתוק לשבוע. אפשר לקרוא לי מהתפריט.',3200); paint('sleep'); }
  else if(a==='hide'){ lsSet('edenLottiHide','1'); el.hidden=true; alive=false; }
 });
 $('#lottiBack').addEventListener('click',()=>{ try{localStorage.removeItem('edenLottiHide');localStorage.removeItem('edenLottiMuted');}catch(_){} C.lottiOn=true; if(el.hidden||!alive){born();} say('חזרתי.',{force:true,state:'happy'}); });
 ['pointerdown','keydown','scroll','touchstart'].forEach(ev=>addEventListener(ev,wake,{passive:true}));
 /* context tips, each once */
 function tipsOnView(){
  const map={kit:['בונה הערכה: שלוש לחיצות ויש רשימה, סכום, ומה חסר למשלוח חינם.','#kList'],shop:['אפשר לסנן לפי מותג או להציג רק מה שבמלאי.','#kinds'],film:['החנות ב-29 שניות, עם פסקול. אפשר להפעיל עם צליל או בלי.','#filmV'],courses:['כרגע אין קורס פתוח להרשמה. אפשר להצטרף לרשימה, ועדן תחזור אלייך.','#courseForm']};
  const io=new IntersectionObserver(es=>es.forEach(e=>{ if(e.isIntersecting){const m=map[e.target.id]; if(m&&say(m[0],{key:'view-'+e.target.id,state:'look',point:m[1]}))io.unobserve(e.target);} }),{threshold:.35});
  Object.keys(map).forEach(id=>{const s=$('#'+id); s&&io.observe(s);});
 }
/* the brand tour: Lotti walks the shelf, one brand at a time, with the facts on its panel (registry: official sources) */
 function tour(){
  const panels=$$('#brandList .bp'); if(!panels.length)return;
  let i=0, box=$('#ltour'); if(!box){ box=document.createElement('div'); box.id='ltour'; box.className='ltour'; box.setAttribute('role','dialog'); box.setAttribute('aria-label','סיור במותגים'); document.body.appendChild(box); }
  const prevFocus=document.activeElement; bub.hidden=true; menu.hidden=true;
  const end=()=>{ panels.forEach(p=>p.classList.remove('lit')); box.hidden=true; paint(base); prevFocus&&prevFocus.focus&&prevFocus.focus({preventScroll:true}); };
  const show=()=>{
   const p=panels[i], key=p.dataset.bk, b=BRANDS.list.find(x=>x.key===key), house=!b;
   panels.forEach(x=>x.classList.toggle('lit',x===p)); p.scrollIntoView({behavior:reduce()?'auto':'smooth',block:'center',inline:'center'});
   const list=house?BRANDS.house.ids.map(id=>BYID.get(id)).filter(Boolean):brandItems(b), inS=list.filter(x=>x.a).length;
   const name=house?'הבחירה של עדן':b.name, line=house?'סיליקונים, מסרקים וכלים בלי שם מותג, שעדן בחרה לחנות.':(b.about||'');
   box.innerHTML='<p class="lt-n"><b>'+esc(name)+'</b>'+(b&&b.origin?' · '+esc(b.origin):'')+'</p>'+(line?'<p>'+esc(line)+'</p>':'')+'<p class="lt-f">'+(list.length===1?'מוצר אחד':bdi(list.length)+' מוצרים')+' בחנות, '+(inS?bdi(inS)+' במלאי':list.length===1?'אזל כרגע':'אזלו כרגע')+'.</p>'
    +'<div class="lt-a"><a class="btn pri" href="'+p.getAttribute('href')+'">'+(house?'לסיליקונים ולכלים':b.page?'לעמוד המותג':'לעמוד המוצר')+'</a><button type="button" class="btn out" data-t="next">'+(i<panels.length-1?'המותג הבא':'סיום')+'</button><button type="button" class="lnk" data-t="end">סגירה</button></div><p class="lt-c">'+(i+1)+' מתוך '+panels.length+'</p>';
   box.hidden=false; paint('look'); setTimeout(()=>box.querySelector('[data-t=next]').focus({preventScroll:true}),reduce()?0:450);
  };
  box.onclick=e=>{ const t=e.target.closest('[data-t]'); if(!t)return; if(t.dataset.t==='end'||i>=panels.length-1)end(); else {i++;show();} };
  box.onkeydown=e=>{ if(e.key==='Escape')end(); };
  show();
 }
 return {born,say,state,point,tour,avatar:()=>svg('happy'),tipsOnView,get alive(){return alive;}};
})();
