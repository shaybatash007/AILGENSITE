<script>
/* ================= render ================= */
const hl=s=>esc(s).replace(/\*(.+?)\*/g,'<em>$1</em>');
const tel=p=>'tel:'+String(p).replace(/[^\d*+]/g,'');
function stageIcon(i,size=34){ // the symbol with one blade lit: the icon family of the four stages
 return `<svg viewBox="0 0 512 512" width="${size}" height="${size}" aria-hidden="true">${[0,1,2,3].map(j=>j===i?`<use href="#${j%2?'bB':'bG'}" transform="rotate(${90*j} 256 256)"/>`:`<use href="#blade" transform="rotate(${90*j} 256 256)" fill="none" stroke="currentColor" stroke-opacity=".35" stroke-width="18"/>`).join('')}</svg>`;}
function applyContent(){
 $('#heroKick').innerHTML=C.heroKick.split('·').map(s=>`<span>${esc(s.trim())}</span>`).join('');
 $('#h1').innerHTML=hl(C.heroLine); $('#heroSub').textContent=C.heroSub;
 $('#tickets').innerHTML=C.stats.map(([v,l])=>`<div><b>${esc(v)}</b><span>${esc(l)}</span></div>`).join('');
 $('#faqList').innerHTML=C.faq.map(([q,a],i)=>`<details${i===0?' open':''}><summary>${esc(q)}</summary><p>${esc(a)}</p></details>`).join('');
 $('#jobMail').textContent=C.jobsEmail;
 const cc=(lab,val,copy,he)=>`<div class="cc"><small>${lab}</small><span class="val${he?' he':''}">${esc(val)}</span>${copy?`<button class="mini" type="button" data-copyv="${esc(val)}">העתקה</button>`:''}</div>`;
 $('#ctCards').innerHTML=cc('מוקד',C.phone,1)+cc('טלפון',C.phone2,1)+cc('טלפון נוסף',C.phone3,1)+cc('אימייל',C.email,1)+cc('משרדי החברה',C.address,0,1)+cc('מיגון ומבנים טרומיים','יוסי 052-8077702 · פיני 050-7366632',0,1)+
  `<div class="soc"><a href="${esc(C.facebook)}" target="_blank" rel="noopener">פייסבוק ↗</a><a href="${esc(C.instagram)}" target="_blank" rel="noopener">אינסטגרם ↗</a></div>`;
 const r=C.testimonials.filter(t=>t.q&&t.q.trim()); $('#reviews').hidden=!r.length;
 $('#revs').innerHTML=r.map(t=>`<figure class="rev" style="margin:0"><q>${esc(t.q)}</q><b>${esc(t.n)}${t.p?`, <span style="font-weight:400;color:var(--steel)">${esc(t.p)}</span>`:''}</b></figure>`).join('');
 renderVids(); bindCopy();
}
function bindCopy(){ $$('[data-copyv],[data-copy]').forEach(b=>{ if(b._c)return; b._c=1; b.addEventListener('click',async()=>{const v=b.dataset.copyv||C.jobsEmail; try{await navigator.clipboard.writeText(v); b.textContent='הועתק';}catch(_){const el=b.previousElementSibling; const r=document.createRange(); r.selectNodeContents(el); getSelection().removeAllRanges(); getSelection().addRange(r); b.textContent='סומן';} setTimeout(()=>b.textContent='העתקה',1800);});}); }

/* hero: the symbol, built from four field photos */
function bladesSVG(){
 const imgs=['container','hero','stack','concrete'];
 const bb=[[126,14],[474,14],[126,199],[474,199]];
 const rot=(x,y,a)=>{const r=a*Math.PI/180,c=Math.cos(r),s=Math.sin(r);return [256+(x-256)*c-(y-256)*s,256+(x-256)*s+(y-256)*c];};
 $('#bladesSvg').innerHTML=[0,1,2,3].map(i=>{
  const pts=bb.map(([x,y])=>rot(x,y,90*i)), xs=pts.map(p=>p[0]), ys=pts.map(p=>p[1]);
  const x0=Math.min(...xs)-8,y0=Math.min(...ys)-8,w=Math.max(...xs)-x0+16,h=Math.max(...ys)-y0+16;
  const [lx,ly]=rot(214,112,90*i), g=i%2?'b':'g';
  return `<g class="bl" data-s="${i}" tabindex="0" role="button" aria-label="שלב ${i+1}: ${STAGES[i].k}">
   <g transform="rotate(${90*i} 256 256)"><g clip-path="url(#bclip)"><image href="img/${imgs[i]}.webp" x="${x0}" y="${y0}" width="${w}" height="${h}" preserveAspectRatio="xMidYMid slice" transform="rotate(${-90*i} 256 256)"/>
    <use href="#blade" fill="url(#t${g})" opacity=".42" style="mix-blend-mode:multiply"/></g><use href="#fold" clip-path="url(#bclip)" fill="url(#t${g}d)" opacity=".62"/></g>
   <text class="lbl" x="${lx}" y="${ly}" text-anchor="middle" dominant-baseline="middle">${String(i+1).padStart(2,'0')} ${STAGES[i].k}</text></g>`;}).join('');
 $$('#bladesSvg .bl').forEach(b=>{const go=()=>{setStage(+b.dataset.s,true); $('#circle').scrollIntoView({behavior:reduce()?'auto':'smooth'});}; b.addEventListener('click',go); b.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();go();}});});
}

/* the circle */
let stage=0, dotA=-90, autoT=null, userTouched=false;
function ringSVG(){
 const cx=260,cy=260,R=190, P=a=>[cx+R*Math.cos(a*Math.PI/180),cy+R*Math.sin(a*Math.PI/180)];
 const arcs=STAGES.map((s,i)=>{const a0=-135+90*i+4,a1=-45+90*i-4,[x0,y0]=P(a0),[x1,y1]=P(a1);return `<path class="seg" data-s="${i}" d="M${x0.toFixed(1)} ${y0.toFixed(1)}A${R} ${R} 0 0 1 ${x1.toFixed(1)} ${y1.toFixed(1)}" stroke="${s.c}"><title>${s.k}</title></path>`;}).join('');
 const labels=STAGES.map((s,i)=>{const a=-90+90*i, r=R+56, x=cx+r*Math.cos(a*Math.PI/180), y=cy+r*Math.sin(a*Math.PI/180);return `<text class="sn" x="${x}" y="${y-10}">0${i+1}</text><text class="sl" x="${x}" y="${y+10}">${s.k}</text>`;}).join('');
 $('#ring').innerHTML=`<svg viewBox="-80 -30 680 580" role="img" aria-label="המעגל: פינוי, מיחזור, השבחה, בנייה, וחזרה לפינוי">
  <defs><marker id="ah" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="5" markerHeight="5" orient="auto"><path d="M0 0L10 5L0 10z" fill="#C9F03A"/></marker></defs>
  <circle cx="260" cy="260" r="150" fill="none" stroke="rgba(255,255,255,.08)" stroke-dasharray="2 8"/>
  ${arcs}${labels}
  <g class="core"><text class="big" x="260" y="262"><tspan direction="ltr" unicode-bidi="isolate">90%+</tspan></text><text class="small" x="260" y="296">מהפסולת שמגיעה ממוחזרת</text></g>
  <circle class="dot" id="rdot" r="11" cx="260" cy="70"/></svg>`;
 $$('#ring .seg').forEach(s=>s.addEventListener('click',()=>{userTouched=true;setStage(+s.dataset.s,true);}));
}
function moveDot(target){
 let to=target; while(to<dotA)to+=360; if(to-dotA>359.9)to-=360;
 const from=dotA, t0=performance.now(), d=reduce()?0:Math.min(1100,280+(to-from)*6);
 const el=$('#rdot'), P=a=>[260+190*Math.cos(a*Math.PI/180),260+190*Math.sin(a*Math.PI/180)];
 const step=now=>{const k=d?Math.min(1,(now-t0)/d):1, e=1-Math.pow(1-k,3), a=from+(to-from)*e, [x,y]=P(a); el.setAttribute('cx',x.toFixed(1)); el.setAttribute('cy',y.toFixed(1)); if(k<1)requestAnimationFrame(step); else dotA=to%360;};
 requestAnimationFrame(step);
}
function setStage(i,fromUser){
 if(fromUser)userTouched=true; stage=i; const s=STAGES[i];
 $$('#ring .seg').forEach(p=>p.classList.toggle('on',+p.dataset.s===i));
 $$('#stageTabs button').forEach((b,j)=>{b.setAttribute('aria-selected',String(j===i)); b.tabIndex=j===i?0:-1;});
 $('#stagePanel').innerHTML=`<div><p class="eyebrow" style="color:${s.c==='#6DB553'?'#9ACB63':'#7FBEE6'}">שלב ${i+1} מתוך 4</p><h3>${esc(s.k)}: ${esc(s.t)}</h3><p>${esc(s.p)}</p><p class="fact">${esc(s.fact)}</p>
  <ul>${s.svcs.map(k=>`<li><a href="#s-${k}" data-svc="${k}">${esc(SVCS[k].t)}<span aria-hidden="true">←</span></a></li>`).join('')}</ul></div>
  <div class="ph"><img src="img/${s.img}.webp" alt="${esc(s.alt)}"><span class="tag">מהשטח</span></div>`;
 $$('#stagePanel [data-svc]').forEach(a=>a.addEventListener('click',e=>{e.preventDefault();openSvc(a.dataset.svc);}));
 moveDot(-90+90*i);
}
function stagesUI(){
 $('#stageTabs').innerHTML=STAGES.map((s,i)=>`<button type="button" role="tab" id="st${i}" aria-controls="stagePanel"><span class="mono">0${i+1}</span>${esc(s.k)}</button>`).join('');
 $$('#stageTabs button').forEach((b,i)=>{b.addEventListener('click',()=>setStage(i,true)); b.addEventListener('keydown',e=>{const d=e.key==='ArrowLeft'?1:e.key==='ArrowRight'?-1:0; if(d){e.preventDefault(); const n=(i+d+4)%4; setStage(n,true); $('#st'+n).focus();}});});
 setStage(0);
 new IntersectionObserver(es=>es.forEach(e=>{clearInterval(autoT); if(e.isIntersecting&&!reduce())autoT=setInterval(()=>{if(!userTouched)setStage((stage+1)%4);},5200);}),{threshold:.35}).observe($('#circle'));
}

/* services */
function renderServices(){
 $('#svcGroups').innerHTML=STAGES.map((s,i)=>`<div class="svc-group"><header>${stageIcon(i)}<h3>${esc(s.k)}: ${esc(s.t)}</h3><span class="mono">שלב ${i+1}/4</span></header><div class="svc-row">${Object.entries(SVCS).filter(([,v])=>v.s===i).map(([k,v])=>`<article class="svc" id="s-${k}"><div class="ph"><img src="img/${v.img}.webp" alt="${esc(PH[v.img]||v.t)}" loading="lazy"><span class="tag">מהשטח</span></div><div class="b"><h4>${esc(v.t)}</h4><p>${esc(v.sh)}</p><button type="button" data-svc="${k}" aria-haspopup="dialog">מה כולל</button></div></article>`).join('')}</div></div>`).join('');
 $$('#svcGroups [data-svc]').forEach(b=>b.addEventListener('click',()=>openSvc(b.dataset.svc)));
 $('#fSvc').innerHTML='<option value="">בחרו…</option>'+Object.values(SVCS).map(v=>`<option>${esc(v.t)}</option>`).join('')+'<option>אחר</option>';
}
let lastFocus=null;
function openSvc(k){
 const v=SVCS[k]; if(!v)return; lastFocus=document.activeElement;
 $('#svcDB').innerHTML=`<p class="eyebrow" style="color:var(--green)">${stageIcon(v.s,22)}שלב ${v.s+1}: ${esc(STAGES[v.s].k)}</p><h3 id="svcDT">${esc(v.t)}</h3>${v.body.map(p=>`<p>${esc(p)}</p>`).join('')}
  ${v.list?`<ul>${v.list.map(x=>`<li>${esc(x)}</li>`).join('')}</ul>`:''}
  ${v.who?`<div class="who">${v.who.map(([n,p])=>`<span>${esc(n)}: <bdi dir="ltr">${esc(p)}</bdi></span>`).join('')}</div>`:''}
  <div class="gal">${v.gal.map(g=>`<div class="ph"><img src="img/${g}.webp" alt="${esc(PH[g]||'')}" loading="lazy"><span class="tag">מהשטח</span></div>`).join('')}</div>
  <div class="acts"><button class="btn" type="button" data-lead="${k}">השאירו פרטים על ${esc(v.t.split(':')[0])}</button>${v.calc||v.s===0?`<button class="btn ghost" type="button" data-go="calc">מאזן פסולת</button>`:''}<a class="btn ghost" href="tel:*9084">מוקד <span class="mono" dir="ltr">*9084</span></a></div>`;
 const d=$('#svcD'); d.showModal(); d.querySelector('.dlg').scrollTop=0;
 $('[data-lead]',d).onclick=()=>{d.close(); $('#fSvc').value=v.t; $('#contact').scrollIntoView({behavior:reduce()?'auto':'smooth'}); setTimeout(()=>$('#fName').focus({preventScroll:true}),reduce()?0:700);};
 const g=$('[data-go]',d); if(g)g.onclick=()=>{d.close(); $('#calc').scrollIntoView({behavior:reduce()?'auto':'smooth'});};
}
$$('dialog').forEach(d=>{d.addEventListener('click',e=>{if(e.target===d||e.target.closest('[data-close]'))d.close();}); d.addEventListener('close',()=>{if(lastFocus&&lastFocus.focus)lastFocus.focus({preventScroll:true});});});

/* waste balance */
let SPEC='';
function calcUI(){
 $('#calcType').innerHTML=TYPES.map((t,i)=>`<div class="chip"><input type="radio" name="ct" id="ct${t.k}" value="${t.k}"${i===0?' checked':''}><label for="ct${t.k}"><b>${esc(t.t)}</b><span>${esc(t.s)}</span></label></div>`).join('');
 const R=$('#areaR'),N=$('#areaN'); R.value=N.value=2400;
 R.oninput=()=>{N.value=R.value;calc();SABABI.spin();}; N.oninput=()=>{R.value=Math.min(30000,Math.max(100,+N.value||0));calc();SABABI.spin();};
 $$('#calcF input').forEach(i=>i.addEventListener('input',()=>{calc(); SABABI.spin();})); calc();
 $('#calcSend').onclick=()=>{SPEC=calc(); const s=$('#fSpec'); s.hidden=false; s.textContent=SPEC; $('#fSvc').value=SVCS.permits.t; $('#contact').scrollIntoView({behavior:reduce()?'auto':'smooth'}); setTimeout(()=>$('#fName').focus({preventScroll:true}),reduce()?0:700);};
}
function calc(){
 const t=TYPES.find(x=>x.k===($('input[name=ct]:checked')||{}).value)||TYPES[0];
 $('#areaF').hidden=!!t.vol; $('#dimF').hidden=!t.vol;
 let base,basis,key;
 if(t.vol){const L=+$('#dL').value||0,W=+$('#dW').value||0,H=+$('#dH').value||0; base=L*W*H; basis=`<bdi dir="ltr">${nf(L)}×${nf(W)}×${nf(H)} = ${nf(base)}</bdi> מ"ק`; key='נפח × 0.4–0.5';}
 else{base=Math.max(0,+$('#areaN').value||0); basis=`<bdi dir="ltr">${nf(base)}</bdi> מ"ר`; key=`<bdi dir="ltr">${t.lo}–${t.hi}</bdi> ט׳ ל-100 מ"ר`;}
 const lo=t.vol?base*t.lo:base/100*t.lo, hi=t.vol?base*t.hi:base/100*t.hi, mid=(lo+hi)/2, bl=mid*.85, bh=mid*1.15, back=mid*.9;
 const max=bh*1.12||1, pct=v=>Math.max(0,Math.min(100,v/max*100));
 const no='TK-'+String(Math.abs([...(t.k+base)].reduce((a,c)=>a*31+c.charCodeAt(0)|0,7))%100000).padStart(5,'0');
 const today=new Date().toLocaleDateString('he-IL');
 $('#ticket').innerHTML=`<span class="stamp">אומדן</span><div class="th"><span>תעודת אומדן · מאזן פסולת</span><svg viewBox="0 0 512 512" aria-hidden="true"><use href="#sym"/></svg></div>
  <dl><dt>מספר</dt><dd>${no}</dd><dt>תאריך</dt><dd>${today}</dd><dt>סוג הפרויקט</dt><dd class="he">${esc(t.t)}</dd><dt>${t.vol?'נפח':'שטח בנוי'}</dt><dd>${basis}</dd><dt>מפתח</dt><dd class="he">${key}</dd><dt>טווח אומדן</dt><dd><bdi dir="ltr">${nf(lo)}–${nf(hi)}</bdi> ט׳</dd></dl>
  <div class="total"><small>כמות להצהרה בהיתר</small><b><bdi dir="ltr">~${nf(mid)}</bdi> ט׳</b>
   <div class="band" role="img" aria-label="טווח בטוח לפינוי בפועל: ${nf(bl)} עד ${nf(bh)} טון"><i style="inset-inline-start:${100-pct(bh)}%;inset-inline-end:${pct(bl)}%"></i><u style="inset-inline-end:calc(${pct(mid)}% - 1.5px)"></u></div>
   <div class="band-l"><span>0</span><span>±15%: ${nf(bl)}–${nf(bh)} ט׳</span></div></div>
  <div class="back">${stageIcon(3,26)}<span>אם הפסולת מגיעה למפעלי הקבוצה, יותר מ-${nf(back)} טון ממנה יכולים לחזור לבנייה (מעל 90% מיחזור).</span></div>
  ${t.k==='pub'?'<p class="fine" style="margin-top:10px">פסולת קלה בנפח גדול: מתאימות לה מכולות רמסע של 24–32 קוב.</p>':''}`;
 return `מאזן פסולת (${no}): ${t.t}, ${basis.replace(/<[^>]+>/g,'')}. אומדן ${nf(lo)}–${nf(hi)} טון, להצהרה כ-${nf(mid)} טון.`;
}

/* map */
function mapUI(){
 const W=256,H=410, X=lon=>(lon-34.40)*426, Y=lat=>(31.87-lat)*500;
 const coast=[[32.15,34.80],[32.08,34.765],[32.02,34.74],[31.95,34.70],[31.87,34.665],[31.80,34.63],[31.72,34.57],[31.67,34.54],[31.60,34.49],[31.52,34.43],[31.40,34.34],[31.30,34.25]];
 const cp=coast.map(([a,o])=>`${X(o).toFixed(1)},${Y(a).toFixed(1)}`).join(' ');
 const refs=[['באר שבע',31.25,34.79],['קריית גת',31.61,34.77]];
 $('#map').innerHTML=`<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="מפה סכמטית של חמשת המתקנים בדרום ובמרכז">
  <rect class="land" width="${W}" height="${H}"/><polygon class="sea" points="0,0 ${cp} 0,${H}"/><polyline class="coast" points="${cp}"/>
  <text class="ref" x="96" y="250" style="letter-spacing:.2em">הים התיכון</text>
  ${refs.map(([n,a,o])=>`<circle cx="${X(o)}" cy="${Y(a)}" r="3" fill="var(--steel)"/><text class="ref" x="${X(o)-7}" y="${Y(a)+4}">${n}</text>`).join('')}
  ${SITES.map((s,i)=>`<g class="pin" data-i="${i}" tabindex="-1"><circle cx="${X(s.lon)}" cy="${Y(s.lat)}" r="22" fill="transparent"/><circle class="o" cx="${X(s.lon)}" cy="${Y(s.lat)}" r="9" stroke="var(--surface)" stroke-width="3"/><text x="${X(s.lon)+(i===1||i===4?14:-14)}" y="${Y(s.lat)+(i===0?-4:i===1?12:5)}" text-anchor="${i===1||i===4?'end':'start'}">${s.n}</text></g>`).join('')}
 </svg><span class="tag sch">מפה סכמטית</span>`;
 $('#siteList').innerHTML=SITES.map((s,i)=>`<li><button type="button" data-i="${i}" aria-pressed="false"><span class="n">${i+1}</span><b>${esc(s.n)}</b><span>${esc(s.d)}</span></button></li>`).join('');
 const pick=i=>{$$('#siteList button').forEach(b=>b.setAttribute('aria-pressed',String(+b.dataset.i===i))); $$('#map .pin').forEach(p=>p.classList.toggle('on',+p.dataset.i===i));};
 $$('#siteList button').forEach(b=>b.addEventListener('click',()=>pick(+b.dataset.i))); $$('#map .pin').forEach(p=>p.addEventListener('click',()=>pick(+p.dataset.i)));
 pick(3);
}

/* projects + lightbox */
function renderVids(){
 const extra=(C.extraProjects||[]).filter(p=>p.kind==='yt'&&p.yt).map(p=>({id:p.yt,t:p.t,c:p.s||'',ext:1}));
 $('#vids').innerHTML=[...VIDS,...extra].map(v=>`<a class="vid" href="https://www.youtube.com/watch?v=${esc(v.id)}" target="_blank" rel="noopener"><div class="ph"><img src="${v.ext?`https://i.ytimg.com/vi/${esc(v.id)}/hqdefault.jpg`:`img/yt-${v.id}.webp`}" alt="" loading="lazy"><span class="play"><span><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14l11-7z" fill="#0B1B2E"/></svg></span></span><span class="tag">מהשטח · יוטיוב</span></div><b>${esc(v.t)}</b><small>${esc(v.c)} · לצפייה ביוטיוב ↗</small></a>`).join('');
 const photos=[...STRIP.map(k=>({src:`img/${k}.webp`,cap:PH[k]})),...(C.extraProjects||[]).filter(p=>p.kind==='real'&&p.photo).map(p=>({src:p.photo,cap:p.t}))];
 $('#strip').innerHTML=photos.map((p,i)=>`<button type="button" data-lb="${i}" aria-label="הגדלה: ${esc(p.cap)}"><div class="ph"><img src="${esc(p.src)}" alt="${esc(p.cap)}" loading="lazy"><span class="tag">מהשטח</span></div></button>`).join('');
 $$('#strip [data-lb]').forEach(b=>b.addEventListener('click',()=>{lastFocus=b; const p=photos[+b.dataset.lb]; $('#lbImg').src=p.src; $('#lbImg').alt=p.cap; $('#lbCap').textContent=p.cap+' · מהשטח'; $('#lb').showModal();}));
}

/* film (filled after the launch film is rendered) */
function filmUI(){ $('#pv').hidden=!PREVIEW; if(!FILM)return; const s=$('#film'); s.hidden=false; const v=$('#filmV'); v.poster=FILM.poster; v.src=FILM.src; $('#filmTxt').textContent=FILM.txt; $('#filmFacts').innerHTML=(FILM.facts||[]).map(([a,b])=>`<div><b>${esc(a)}</b><span>${esc(b)}</span></div>`).join(''); }

/* about */
function renderAbout(){
 $('#timeline').innerHTML=TL.map(([y,t,p])=>`<li><span class="y">${esc(y)}</span><div><b>${esc(t)}</b><p>${esc(p)}</p></div></li>`).join('');
 $('#values').innerHTML=VALUES.map(v=>`<span>${esc(v)}</span>`).join('');
 $('#cos').innerHTML=COS.map(([k,n,p])=>`<div class="co"><span class="mono">${esc(k)}</span><h4>${esc(n)}</h4><p>${esc(p)}</p></div>`).join('');
 $('#jobList').innerHTML=JOBS.map(j=>`<li>${esc(j)}</li>`).join('');
}

/* entry: four blades fly in and lock into the symbol, then the hero photos turn into place */
function entry(){
 const blades=$$('#bladesSvg .bl');
 const heroIn=()=>{ if(reduce())return; blades.forEach((b,i)=>b.animate([{transform:'rotate(-70deg) scale(.55)',opacity:0},{transform:'none',opacity:1}],{duration:900,delay:120+i*110,easing:'cubic-bezier(.2,.8,.2,1)',fill:'backwards'}));
  [$('#heroKick'),$('#h1'),$('#heroSub'),$('.hero .ctas')].forEach((e,i)=>e.animate([{opacity:0,transform:'translateY(18px)'},{opacity:1,transform:'none'}],{duration:700,delay:200+i*90,easing:'cubic-bezier(.2,.8,.2,1)',fill:'backwards'}));};
 let seen=false; try{seen=!!localStorage.getItem('tkSeen'); localStorage.setItem('tkSeen','1');}catch(_){}
 if(reduce()||seen){ heroIn(); SABABI.start(); return; }
 const o=document.createElement('div'); o.id='intro'; o.setAttribute('aria-hidden','true');
 o.innerHTML=`<svg viewBox="0 0 512 512">${[0,1,2,3].map(i=>`<g class="ib" style="transform-origin:256px 256px"><use href="#${i%2?'bB':'bG'}" transform="rotate(${90*i} 256 256)"/></g>`).join('')}</svg>`;
 document.body.appendChild(o); document.body.style.overflow='hidden';
 const dirs=[[0,-420],[420,0],[0,420],[-420,0]];
 const ibs=$$('.ib',o);
 ibs.forEach((g,i)=>g.animate([{transform:`translate(${dirs[i][0]}px,${dirs[i][1]}px) rotate(-120deg)`,opacity:0},{transform:'none',opacity:1}],{duration:760,delay:i*90,easing:'cubic-bezier(.16,.84,.2,1)',fill:'both'}));
 const svg=$('svg',o);
 setTimeout(()=>{svg.animate([{transform:'rotate(0)'},{transform:'rotate(180deg)'}],{duration:520,easing:'cubic-bezier(.6,0,.2,1)',fill:'forwards'});},1080);
 setTimeout(()=>{const a=$('.hdr .logo svg').getBoundingClientRect(), b=svg.getBoundingClientRect();
  const dx=a.left+a.width/2-(b.left+b.width/2), dy=a.top+a.height/2-(b.top+b.height/2), s=a.width/b.width;
  svg.animate([{transform:'rotate(180deg)'},{transform:`translate(${dx}px,${dy}px) scale(${s}) rotate(180deg)`}],{duration:620,easing:'cubic-bezier(.6,0,.2,1)',fill:'forwards'});
  o.animate([{background:getComputedStyle(o).backgroundColor},{background:'rgba(11,27,46,0)'}],{duration:620,easing:'ease-in',fill:'forwards'});
  heroIn();},1640);
 setTimeout(()=>{o.remove(); document.body.style.overflow=''; SABABI.start();},2300);
}
</script>
