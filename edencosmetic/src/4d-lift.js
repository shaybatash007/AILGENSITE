/* ================= the lift: the signature section =================
   One closed eye, drawn live (Canvas 2D, seventy lashes, each its own curve). As the visitor scrolls, the lashes go through
   the treatment in the store's order: cleansing, the silicone, the glue, step 1, step 2, step 3, and tint for those who add
   it; beside each stage, what the store has for it (the kit builder's own filters). The lines quote the store's product
   texts; they are an order, not instructions. Reduced motion or no canvas: a plain list, and the eye drawn once, lifted. */
const LIFT=(()=>{
 const lashOnly=x=>!/להרמת גבות/.test(x.t)||/ריסים/.test(x.t);
 const STEPS=[
  {n:'ניקוי',t:'ניקוי יסודי של הריסים לפני הטיפול, בלי שומן ובלי איפור.',f:x=>x.k==='clean',kind:'clean',all:'לניקוי'},
  {n:'סיליקון',t:'הסיליקון מונח על העפעף. יש כמה מידות, לפי אורך הריסים.',f:x=>x.k==='pads'&&!/גבות/.test(x.t),kind:'pads',all:'בסיליקונים'},
  {n:'דבק',t:'דבק או בלאם מחזיקים את הריסים על הסיליקון, אחד אחד.',f:x=>x.k==='glue',kind:'glue',all:'בדבק ובלאם'},
  {n:'שלב 1',t:'יוצר לריסים תלתל חדש: השיער מתרכך ומוכן לשלב השני.',f:x=>x.k==='step'&&/שלב 1/.test(x.t)&&lashOnly(x),kind:'step',all:'בשלבים בודדים'},
  {n:'שלב 2',t:'מקבע את הסלסול החדש.',f:x=>x.k==='step'&&/שלב 2/.test(x.t)&&lashOnly(x),kind:'step',all:'בשלבים בודדים'},
  {n:'שלב 3',t:'השלב הסופי: סרום שמעניק לחות לריסים. הסיליקון יורד, והריסים נשארים מורמים.',f:x=>x.k==='step'&&/שלב 3/.test(x.t)&&lashOnly(x),kind:'step',all:'בשלבים בודדים'},
  {n:'צבע',t:'ולמי שמשלבת צביעה: צבע לריסים, וחמצן שמתאים לו.',f:x=>(x.k==='tint'&&/ריסים/.test(x.t))||x.k==='oxidant',kind:'tint',all:'בצבע'}
 ];
 const N=STEPS.length;
 let calm=0,heavy=0,sec,cv,ctx,W=0,H=0,dpr=1,k=1,ox=0,oy=0,pT=0,pD=0,raf=0,seen=false,pin=false,active=-1,t0=0,lastT=0,lashes=[],lower=[],bubbles=[];
 const sm=(a,b,x)=>{x=Math.min(1,Math.max(0,(x-a)/(b-a)));return x*x*(3-2*x);};
 const mixN=(a,b,t)=>a+(b-a)*t;
 const rnd=(s=>()=>(s=(s*16807)%2147483647)/2147483647)(20260930);
 // the eye, in a 1000 x 620 design space: the lash line (upper lid margin), the lower lid, the crease
 const bez=(p0,p1,p2,p3,u)=>{const v=1-u;return[v*v*v*p0[0]+3*v*v*u*p1[0]+3*v*u*u*p2[0]+u*u*u*p3[0],v*v*v*p0[1]+3*v*v*u*p1[1]+3*v*u*u*p2[1]+u*u*u*p3[1]];};
 const M=[[140,300],[330,408],[670,408],[860,282]], LOW=[[140,300],[330,424],[670,422],[860,282]], CR=[[180,246],[360,140],[650,132],[830,222]];
 const margin=u=>bez(...M,u), lowLid=u=>bez(...LOW,u), crease=u=>bez(...CR,u);
 function build(){
  lashes=[];
  const n=74;
  for(let i=0;i<n;i++){
   const u=.03+.95*(i+rnd()*.7)/n, s=u<.5?-1:1;
   const L=52+92*Math.pow(Math.sin(Math.PI*Math.pow(u,.82)),.85)+rnd()*14;
   const jit=(rnd()-.5)*.34, clump=Math.round(i/4);
   lashes.push({u,s,L,w:2.3+rnd()*1.1,jit,clump:(Math.sin(clump*2.3)*.14),ph:rnd()*6.28,dl:rnd()*.12,tone:rnd()*.14});
  }
  lower=[]; for(let i=0;i<26;i++){const u=.12+.8*(i+rnd()*.6)/26; lower.push({u,L:12+18*Math.sin(Math.PI*u)+rnd()*6,a:(u-.5)*.9+(rnd()-.5)*.2});}
  bubbles=[]; for(let i=0;i<34;i++)bubbles.push({u:rnd(),y:(rnd()-.35)*120,r:3+rnd()*9,sp:.6+rnd()*.8});
 }
 // the state of the treatment at stage position p (0..7)
 function state(p){
  return {clean:sm(.1,.85,p),pad:sm(1.05,1.75,p),glue:sm(2.02,2.45,p),flip:sm(2.3,2.98,p),lot1:sm(3.08,3.6,p),lot2:sm(4.08,4.62,p),
   lotOut:sm(5.02,5.36,p),padOut:sm(5.3,5.82,p),lift:sm(5.28,5.96,p),gloss:sm(5.55,6.1,p),tint:sm(6.08,6.8,p)};
 }
 function size(){
  const r=cv.getBoundingClientRect(); dpr=Math.min(devicePixelRatio||1,2);
  const w=Math.round(r.width*dpr),h=Math.round(r.height*dpr); if(!w||!h)return false;
  if(w!==W||h!==H){W=cv.width=w;H=cv.height=h;}
  k=Math.min(W/850,H/470); ox=W/2-500*k; oy=H/2-305*k; return true;
 }
 const cs=()=>{const g=getComputedStyle(document.documentElement);return k=>g.getPropertyValue(k).trim();};
 function draw(p,t){
  const S=state(p), c=ctx, col=cs(), dk=matchMedia('(prefers-color-scheme: dark)').matches&&!document.documentElement.classList.contains('a-contrast');
  c.setTransform(1,0,0,1,0,0); c.clearRect(0,0,W,H); c.setTransform(k,0,0,k,ox,oy);
  const ink=col('--ink')||'#241A18', petal=col('--petal')||'#E7C3B2';
  // a blush wash on the lid, between the crease and the lash line
  const g=c.createLinearGradient(0,150,0,410); g.addColorStop(0,'rgba(231,195,178,0)'); g.addColorStop(1,dk?'rgba(120,80,70,.32)':'rgba(231,195,178,.5)');
  c.beginPath(); for(let i=0;i<=40;i++){const q=crease(i/40); i?c.lineTo(q[0],q[1]):c.moveTo(q[0],q[1]);} for(let i=40;i>=0;i--){const q=margin(i/40); c.lineTo(q[0],q[1]);} c.fillStyle=g; c.fill();
  // the crease: a soft line
  c.lineCap='round'; c.lineJoin='round';
  c.beginPath(); for(let i=0;i<=48;i++){const q=crease(.06+.88*i/48); i?c.lineTo(q[0],q[1]):c.moveTo(q[0],q[1]);} c.strokeStyle=dk?'rgba(246,234,227,.3)':'rgba(36,26,24,.22)'; c.lineWidth=2; c.stroke();
  // the silicone: a lavender shield that slides onto the lid, and lifts off at the end
  const padA=S.pad*(1-S.padOut);
  if(padA>.002){
   const dy=-(1-S.pad)*70-S.padOut*50;
   const top=u=>{const m=margin(u);const h=(.18+.82*Math.pow(Math.sin(Math.PI*u),.7))*118;return[m[0],m[1]-h+dy];};
   const base=u=>{const m=margin(u);return[m[0],m[1]-4+dy];};
   c.save(); c.globalAlpha=padA;
   c.beginPath(); for(let i=0;i<=50;i++){const q=base(.02+.96*i/50); i?c.lineTo(q[0],q[1]):c.moveTo(q[0],q[1]);} for(let i=50;i>=0;i--){const q=top(.02+.96*i/50); c.lineTo(q[0],q[1]);} c.closePath();
   const pg=c.createLinearGradient(0,220+dy,0,410+dy); pg.addColorStop(0,'#CDBEF5'); pg.addColorStop(1,'#A693E8');
   c.fillStyle=pg; c.shadowColor='rgba(80,50,120,.22)'; c.shadowBlur=18; c.shadowOffsetY=8; c.fill(); c.shadowColor='transparent';
   // ridges and the glossy rim of the silicone
   c.lineWidth=1.4; for(let r=1;r<4;r++){c.beginPath(); for(let i=0;i<=40;i++){const u=.08+.84*i/40,a=base(u),b=top(u),f=r/4; const x=a[0]+(b[0]-a[0])*f,y=a[1]+(b[1]-a[1])*f; i?c.lineTo(x,y):c.moveTo(x,y);} c.strokeStyle='rgba(255,255,255,.2)'; c.stroke();}
   c.beginPath(); for(let i=0;i<=50;i++){const q=top(.04+.92*i/50); i?c.lineTo(q[0],q[1]+3):c.moveTo(q[0],q[1]+3);} c.strokeStyle='rgba(255,255,255,.7)'; c.lineWidth=2.4; c.stroke();
   // the glue: a thin wet line where the lashes will lie
   const gl=S.glue*(1-S.lotOut);
   if(gl>.01){ c.beginPath(); for(let i=0;i<=50;i++){const u=.06+.88*i/50,a=base(u),b=top(u); const x=a[0]+(b[0]-a[0])*.35,y=a[1]+(b[1]-a[1])*.35; i?c.lineTo(x,y):c.moveTo(x,y);} c.strokeStyle='rgba(255,255,255,'+(.55*gl)+')'; c.lineWidth=16; c.stroke(); c.strokeStyle='rgba(255,255,255,'+(.8*gl)+')'; c.lineWidth=2; c.stroke(); }
   c.restore();
  }
  // the lashes: each is integrated along its length; the root angle and the curl blend from natural, to on the silicone, to lifted
  const brown=[92,62,50], deep=dk?[246,234,227]:[26,17,18], nat=dk?[214,190,176]:brown;
  const lc=nat.map((v,i)=>Math.round(v+(deep[i]-v)*(dk?S.tint*.7+.2:S.tint*.85+.1)));
  const flipW=S.flip*1.6, liftW=S.lift;
  const pts=[];
  const lashPath=(l,shadow)=>{
   const m=margin(l.u), s=l.s;
   const fi=Math.min(1,Math.max(0,flipW-l.u*.6)), f=fi*fi*(3-2*fi);
   let li=Math.min(1,Math.max(0,liftW*1.14-l.dl)); li=1+2.4*Math.pow(li-1,3)+1.4*Math.pow(li-1,2);   // lifts, overshoots a little, settles
   const jit=l.jit*(1-.7*S.clean)+l.clump*(1-S.clean);
   const flutter=.014*Math.sin(t*1.3+l.ph)*(1-f)*(1-S.clean*.5);
   let pn=Math.PI/2-(l.u-.5)*1.15+jit*.5+flutter, pp=-Math.PI/2+(l.u-.5)*1.3+jit*.12, pl=-Math.PI/2+(l.u-.5)*1.5+jit*.12;
   if(l.u<.5){pp+=2*Math.PI;pl+=2*Math.PI;}
   const psi=mixN(mixN(pn,pp,f),pl,li), kk=mixN(mixN(-s*.35,-s*.25*Math.sin(Math.PI*f),f),(l.u-.5)*1.25,li), L=l.L*mixN(mixN(1,.86,f),1.04,li)*(1+.04*S.lot1*(1-S.lotOut)*(1-li));
   const n=16, ds=L/n; let x=m[0]+(shadow?5:0), y=m[1]+(shadow?6:0), a=psi; pts.length=0; pts.push([x,y,a]);
   for(let j=1;j<=n;j++){const q=j/n; a=psi+kk*Math.pow(q,1.6); const fs=1-.3*li*q*q; x+=Math.cos(a)*ds*fs; y+=Math.sin(a)*ds*fs; pts.push([x,y,a]);}
   c.beginPath();
   for(let j=0;j<=n;j++){const q=pts[j],w=l.w*Math.pow(1-j/n,.75)*.5+.18; c[j?'lineTo':'moveTo'](q[0]+Math.sin(q[2])*w,q[1]-Math.cos(q[2])*w);}
   for(let j=n;j>=0;j--){const q=pts[j],w=l.w*Math.pow(1-j/n,.75)*.5+.18; c.lineTo(q[0]-Math.sin(q[2])*w,q[1]+Math.cos(q[2])*w);}
   c.closePath();
  };
  // soft shadow of the lashes on the skin (or on the silicone)
  c.fillStyle=dk?'rgba(0,0,0,.25)':'rgba(90,50,40,.09)'; lashes.forEach(l=>{lashPath(l,true);c.fill();});
  lashes.forEach(l=>{lashPath(l,false); const tone=1-l.tone; c.fillStyle='rgba('+lc.map(v=>Math.round(v*tone+(dk?0:30)*(1-tone))).join(',')+',.94)'; c.fill();
   if(S.gloss>.01){ c.beginPath(); for(let j=2;j<pts.length-3;j++){const q=pts[j]; c[j>2?'lineTo':'moveTo'](q[0]-Math.sin(q[2])*.6,q[1]+Math.cos(q[2])*.6-.6);} c.strokeStyle='rgba(255,255,255,'+(.5*S.gloss)+')'; c.lineWidth=.8; c.stroke(); }
  });
  // the lotions: a cream band over the lashes on the silicone (step 1), then a blush one (step 2)
  const lot=Math.max(S.lot1,S.lot2)*(1-S.lotOut);
  if(lot>.01&&padA>.1){
   const tint2=S.lot2, band=(f)=>u=>{const m=margin(u);const h=(.18+.82*Math.pow(Math.sin(Math.PI*u),.7))*118;return[m[0],m[1]-4-h*f];};
   const b1=band(.22),b2=band(.62);
   c.beginPath(); for(let i=0;i<=50;i++){const q=b1(.1+.8*i/50); i?c.lineTo(q[0],q[1]):c.moveTo(q[0],q[1]);} for(let i=50;i>=0;i--){const q=b2(.1+.8*i/50); c.lineTo(q[0],q[1]);} c.closePath();
   const cr=[255,246,238], bl=[246,200,212], cc=cr.map((v,i)=>Math.round(v+(bl[i]-v)*tint2));
   const lg=c.createLinearGradient(140+((t*60)%400)-200,0,860+((t*60)%400)-200,0);
   lg.addColorStop(0,'rgba('+cc+','+(.42*lot)+')'); lg.addColorStop(.5,'rgba('+cc+','+(.62*lot)+')'); lg.addColorStop(1,'rgba('+cc+','+(.42*lot)+')');
   c.fillStyle=lg; c.fill();
  }
  // the lash line itself, over the roots; and the lower lid with its short lashes
  c.beginPath(); for(let i=0;i<=60;i++){const q=margin(i/60); i?c.lineTo(q[0],q[1]):c.moveTo(q[0],q[1]);} c.strokeStyle=ink; c.lineWidth=4.2; c.stroke();
  c.beginPath(); for(let i=0;i<=60;i++){const q=lowLid(.04+.92*i/60); i?c.lineTo(q[0],q[1]):c.moveTo(q[0],q[1]);} c.strokeStyle=dk?'rgba(246,234,227,.45)':'rgba(36,26,24,.4)'; c.lineWidth=1.6; c.stroke();
  c.fillStyle='rgba('+lc.join(',')+',.7)';
  lower.forEach(l=>{const m=lowLid(l.u),a=Math.PI/2-l.a; c.beginPath(); c.moveTo(m[0]-1,m[1]); c.quadraticCurveTo(m[0]+Math.cos(a)*l.L*.6,m[1]+Math.sin(a)*l.L*.6,m[0]+Math.cos(a-.15*Math.sign(l.a))*l.L,m[1]+Math.sin(a)*l.L); c.lineTo(m[0]+1,m[1]); c.fill();});
  // cleansing: foam that passes along the lashes and is gone
  if(S.clean>0&&S.clean<1){
   bubbles.forEach(b=>{const u=b.u*.9+.05,m=margin(u),f=Math.sin(Math.PI*S.clean),x=m[0]+(S.clean-.5)*160*b.sp,y=m[1]+60+b.y*.6; c.beginPath(); c.arc(x,y,b.r*(.6+.4*f),0,6.283);
    c.fillStyle='rgba(255,255,255,'+(.45*f)+')'; c.fill(); c.strokeStyle='rgba(255,255,255,'+(.85*f)+')'; c.lineWidth=1; c.stroke();});
  }
 }
 function frame(now){
  raf=0; const dt=Math.min(.25,(now-(lastT||now))/1000); lastT=now;
  if(!size()){ if(seen)raf=requestAnimationFrame(frame); return; }
  pD+=(pT-pD)*(1-Math.exp(-dt*7)); if(Math.abs(pT-pD)<.0004)pD=pT;
  const t1=performance.now(); draw(pD,(now-t0)/1000); sec.dataset.p=pD.toFixed(2);
  if(performance.now()-t1>30)heavy++; else heavy=Math.max(0,heavy-1);
  // at rest the lashes only breathe; a slow device lets them rest still until the next scroll
  calm=pD===pT?calm+1:0;
  if(seen&&!(calm>2&&heavy>4))raf=requestAnimationFrame(frame);
 }
 function progress(){
  if(!pin)return;
  const r=sec.getBoundingClientRect(), total=sec.offsetHeight-innerHeight;
  const q=Math.min(1,Math.max(0,-r.top/Math.max(1,total)));
  pT=q*N; const i=Math.min(N-1,Math.floor(q*N));
  if(i!==active){ active=i; $$('.lf-s',sec).forEach((li,j)=>li.classList.toggle('on',j===i)); $$('.lf-rail button',sec).forEach((b,j)=>{b.setAttribute('aria-current',String(j===i)); b.classList.toggle('done',j<i);}); }
  sec.style.setProperty('--lfp',q.toFixed(4));
 }
 const goTo=i=>{ const total=sec.offsetHeight-innerHeight; scrollTo({top:sec.getBoundingClientRect().top+scrollY+(i+.62)/N*total,behavior:reduce()?'auto':'smooth'}); };
 function render(){
  const chip=x=>{const cu=cutOf(x); return '<li><button class="lf-p" type="button" data-qv="'+x.i+'"><span class="lf-im'+(cu?'':' ph')+'"><img data-src="'+(cu||thumb(x))+'" alt="" width="64" height="64" decoding="async"></span><span class="lf-pt"><b>'+esc(title(x))+'</b><small>'+bdi(money(x.p))+(x.a?'':' · אזל')+'</small></span></button></li>';};
  $('#lfSteps').innerHTML=STEPS.map((s,i)=>{const all=ITEMS.filter(s.f).sort((a,b)=>(b.a-a.a)||(a.p-b.p)); const n=s.kind==='step'?ITEMS.filter(x=>x.k==='step').length:ITEMS.filter(x=>x.k===s.kind).length;
   return '<li class="lf-s'+(i?'':' on')+'" data-i="'+i+'"><p class="lf-no"><span class="lat">'+String(i+1).padStart(2,'0')+'</span><i>/ '+String(N).padStart(2,'0')+'</i></p><h3>'+esc(s.n)+'</h3><p class="lf-t">'+esc(s.t)+'</p>'
    +'<ul class="lf-ps">'+all.slice(0,3).map(chip).join('')+'</ul>'
    +'<p class="lf-go">'+(n>3?'<button class="lnk" type="button" data-kind="'+s.kind+'">עוד '+bdi(n-3)+' מוצרים '+esc(s.all)+'</button>':'')+(i===N-1?'<a class="btn pri sm" href="#kit">כל השלבים בערכה אחת</a>':'')+'</p></li>';}).join('');
  $('#lfRail').innerHTML=STEPS.map((s,i)=>'<button type="button" aria-current="'+(i===0)+'"><span class="lat">'+String(i+1).padStart(2,'0')+'</span><b>'+esc(s.n)+'</b></button>').join('');
  $$('#lfRail button').forEach((b,i)=>b.addEventListener('click',()=>goTo(i)));
  sec.addEventListener('click',e=>{
   const qv=e.target.closest('[data-qv]'); if(qv){openQV(BYID.get(+qv.dataset.qv)); return;}
   const kd=e.target.closest('[data-kind]'); if(kd){F.kind=kd.dataset.kind; F.col=''; F.n=24; renderShop(); $('#shop').scrollIntoView({behavior:reduce()?'auto':'smooth'});}
  });
  // keyboard: a control inside a stage that is not on screen brings its stage
  sec.addEventListener('focusin',e=>{ if(!pin)return; const li=e.target.closest('.lf-s'); if(li&&+li.dataset.i!==active)goTo(+li.dataset.i); });
 }
 function init(){
  sec=$('#lift'); cv=$('#lashC'); if(!sec||!cv)return;
  render(); build();
  const pics=()=>$$('img[data-src]',sec).forEach(i=>{i.src=i.dataset.src; i.removeAttribute('data-src');});
  const near=new IntersectionObserver(es=>{ if(es.some(e=>e.isIntersecting)){ pics(); near.disconnect(); } },{rootMargin:'0px 0px 160px 0px'}); near.observe(sec);
  ctx=cv.getContext('2d'); if(!ctx){sec.classList.add('flat');return;}
  pin=!reduce(); sec.classList.add(pin?'pin':'flat'); sec.style.setProperty('--lfN',N);
  if(!pin){ pT=pD=N; requestAnimationFrame(()=>{ if(size())draw(N,0); }); addEventListener('resize',()=>{ if(size())draw(N,0); },{passive:true}); return; }
  t0=performance.now(); progress();
  addEventListener('scroll',()=>{progress(); if(seen&&!raf){lastT=0;raf=requestAnimationFrame(frame);}},{passive:true}); addEventListener('resize',()=>{progress();},{passive:true});
  new IntersectionObserver(es=>es.forEach(e=>{seen=e.isIntersecting; if(seen&&!raf){lastT=0;raf=requestAnimationFrame(frame);} }),{rootMargin:'100px 0px'}).observe(sec);
  // Lotti steps aside while the eye is on screen (it would sit on the products)
  new IntersectionObserver(es=>es.forEach(e=>document.documentElement.classList.toggle('inlift',e.isIntersecting)),{rootMargin:'-20% 0px -20% 0px'}).observe(sec);
 }
 return {init};
})();
