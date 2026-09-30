/* ================= motion: one system for the whole page =================
   Headings rise word by word from behind a line; the brand cards tilt toward the pointer with a glare of their own
   material; the collections reveal their product beside the pointer; Eden's sentence fills with ink as it is read; the
   lotus of the logo draws itself behind her story; buttons lean toward the pointer. Pointer effects only with a fine
   pointer; nothing moves with reduced motion (the text is simply there). */
const MOTION=(()=>{
 const fine=()=>matchMedia('(hover:hover) and (pointer:fine)').matches;
 // a heading's words, each in its own mask (the text stays one string for readers: aria-label on the heading)
 function words(el){
  if(!el||el.dataset.w)return; el.dataset.w='1';
  const walk=n=>{ [...n.childNodes].forEach(c=>{
   if(c.nodeType===3){ const parts=c.textContent.split(/(\s+)/); const f=document.createDocumentFragment();
    parts.forEach(p=>{ if(!p)return; if(/^\s+$/.test(p)){f.appendChild(document.createTextNode(p));return;} const m=document.createElement('span'); m.className='wm1'; const i=document.createElement('span'); i.textContent=p; m.appendChild(i); f.appendChild(m); });
    c.replaceWith(f);
   } else if(c.nodeType===1&&!/^(svg|SVG|BDI)$/.test(c.tagName)&&!c.classList.contains('swash')) walk(c);
  }); };
  walk(el);
  $$('.wm1>span',el).forEach((s,i)=>s.style.setProperty('--wi',i));
 }
 function headings(){
  const hs=$$('.sh h2, .lf-h h2, #about h2, #courses h2, #contact h2');
  hs.forEach(words);
  const io=new IntersectionObserver(es=>es.forEach(e=>{ if(e.isIntersecting){ const h=e.target; h.classList.add('wup'); io.unobserve(h); setTimeout(()=>h.classList.add('wdone'),1100+55*$$('.wm1',h).length); } }),{rootMargin:'0px 0px -12% 0px'});
  hs.forEach(h=>io.observe(h));
 }
 // the brand cards: tilt toward the pointer, a glare that follows it, the product drifts the other way
 function brands(){
  const list=$('#brandList'); if(!list)return;
  let cur=null,raf=0,tx=0,ty=0;
  const apply=()=>{ raf=0; if(!cur)return; cur.style.setProperty('--rx',(-ty*7).toFixed(2)+'deg'); cur.style.setProperty('--ry',(tx*9).toFixed(2)+'deg'); cur.style.setProperty('--gx',((tx+1)*50).toFixed(1)+'%'); cur.style.setProperty('--gy',((ty+1)*50).toFixed(1)+'%'); cur.style.setProperty('--px',(-tx*10).toFixed(1)+'px'); cur.style.setProperty('--py',(-ty*8).toFixed(1)+'px'); };
  list.addEventListener('pointermove',e=>{ if(e.pointerType!=='mouse')return; const a=e.target.closest('.bp'); if(!a)return;
   if(a!==cur){ if(cur)leave(cur); cur=a; a.classList.add('tilt'); }
   const r=a.getBoundingClientRect(); tx=((e.clientX-r.left)/r.width-.5)*2; ty=((e.clientY-r.top)/r.height-.5)*2; if(!raf)raf=requestAnimationFrame(apply); });
  const leave=a=>{ a.classList.remove('tilt'); ['--rx','--ry','--px','--py'].forEach(k=>a.style.removeProperty(k)); };
  list.addEventListener('pointerleave',()=>{ if(cur)leave(cur); cur=null; });
 }
 // the collections: the product of the row under the pointer floats beside it, leaning with the pointer's speed
 function cats(){
  const list=$('#catsList'); if(!list)return;
  const fl=document.createElement('div'); fl.className='cfloat'; fl.setAttribute('aria-hidden','true'); fl.innerHTML='<img alt="" width="380" height="380" decoding="async">';
  $('#cats').appendChild(fl); list.classList.add('float');
  const img=$('img',fl); let x=0,y=0,tx=0,ty=0,vx=0,on=false,raf=0,src='';
  const tick=()=>{ raf=0; const k=.16; const nx=x+(tx-x)*k, ny=y+(ty-y)*k; vx=nx-x; x=nx; y=ny;
   fl.style.transform='translate3d('+x.toFixed(1)+'px,'+y.toFixed(1)+'px,0) rotate('+Math.max(-14,Math.min(14,vx*.6)).toFixed(2)+'deg)';
   if(on||Math.abs(tx-x)>.5)raf=requestAnimationFrame(tick); };
  list.addEventListener('pointermove',e=>{ if(e.pointerType!=='mouse')return; const a=e.target.closest('.cat'); const s=a&&$('.pv img',a); const r=$('#cats').getBoundingClientRect();
   tx=e.clientX-r.left; ty=e.clientY-r.top; if(!on){x=tx;y=ty;}
   if(s){ const big=s.getAttribute('src').replace('-380.webp','.webp'); if(big!==src){src=big; img.src=big;} on=true; fl.classList.add('on'); }
   if(!raf)raf=requestAnimationFrame(tick); });
  list.addEventListener('pointerleave',()=>{ on=false; fl.classList.remove('on'); });
 }
 // Eden's sentence fills with ink word by word while it crosses the screen
 function pull(){
  const q=$('#about .pull p'); if(!q)return; words(q); const ws=$$('.wm1>span',q); if(!ws.length)return;
  q.closest('.pull').classList.add('ink');
  let raf=0;
  const set=()=>{ raf=0; const r=q.getBoundingClientRect(), vh=innerHeight; const p=Math.min(1,Math.max(0,(vh*.86-r.top)/(vh*.5)));
   ws.forEach((w,i)=>{ const a=Math.min(1,Math.max(0,p*ws.length-i)); w.style.opacity=(.16+.84*a).toFixed(3); }); };
  addEventListener('scroll',()=>{ if(!raf)raf=requestAnimationFrame(set); },{passive:true}); set();
 }
 // the lotus of the logo, drawn behind the story as it scrolls into view
 function lotus(){
  const ab=$('#about'); if(!ab||!SYM||!SYM.lotus)return;
  ab.insertAdjacentHTML('afterbegin','<svg class="lotusline" aria-hidden="true"><path pathLength="1" d="'+SYM.lotus+'"/></svg>');
  const sv=$('.lotusline',ab), p=$('path',sv), bb=p.getBBox(), m=bb.width*.06;
  sv.setAttribute('viewBox',[bb.x-m,bb.y-m,bb.width+2*m,bb.height+2*m].map(v=>v.toFixed(1)).join(' '));
  let raf=0;
  const set=()=>{ raf=0; const r=ab.getBoundingClientRect(), vh=innerHeight; const k=Math.min(1,Math.max(0,(vh*.95-r.top)/(vh*.8))); p.style.strokeDashoffset=(1-k).toFixed(4); p.style.fillOpacity=Math.max(0,(k-.75)/.25*.55).toFixed(3); };
  addEventListener('scroll',()=>{ if(!raf)raf=requestAnimationFrame(set); },{passive:true}); set();
 }
 // primary buttons lean a little toward the pointer
 function magnets(){
  $$('.btn.pri, .play i').forEach(b=>{
   b.addEventListener('pointermove',e=>{ if(e.pointerType!=='mouse')return; const r=b.getBoundingClientRect(); b.style.translate=((e.clientX-r.left-r.width/2)*.18).toFixed(1)+'px '+((e.clientY-r.top-r.height/2)*.28).toFixed(1)+'px'; });
   b.addEventListener('pointerleave',()=>{ b.style.translate=''; });
  });
 }
 function init(){
  if(reduce()){ document.documentElement.classList.add('m-still'); return; }
  headings(); pull(); lotus();
  const sg=$('.ft-sign'); if(sg){ const io=new IntersectionObserver(es=>es.forEach(e=>{ if(e.isIntersecting){ sg.classList.add('on'); io.disconnect(); } }),{threshold:.6}); io.observe(sg); }
  if(fine()){ brands(); cats(); magnets(); }
 }
 return {init,words};
})();
