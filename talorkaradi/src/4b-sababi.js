<script>
/* ================= סבבי: the mascot, born from the four blades of the logo ================= */
const SB={"name": "סבבי", "grid": ["........................", ".......HHHHHHHHHH.......", "......hhhhhHHhhhhh......", ".....hhhhhhHHhhhhhh.....", "...hhhhhhhhhhhhhhhhhh...", ".....gGGGGG..bbbbbb.....", "....ggGGGGG.bbbbbbbb....", "...gggGGGGGbbbbbbbbbb...", "...ggggGGG.bbbbbBBBBB...", "..gggggGGKKKKKKBBBBBBB..", "..gggggGKKKKKKKKBBBBBB..", "...gggggKKKKKKKKBBBBBB..", ".B..gggKKKKKKKKKK..BBBB.", ".BB..ggKKKKKKKKKKgg..BB.", ".BBBB..KKKKKKKKKKggg..B.", "..BBBBBBKKKKKKKKggggg...", "..BBBBBBKKKKKKKKGggggg..", "..BBBBBBBKKKKKKGGggggg..", "...BBBBBbbbbb.GGGgggg...", "...bbbbbbbbbbGGGGGggg...", "....bbbbbbbb.GGGGGgg....", ".....bbbbbb..GGGGGg.....", "......bbbb..GGGGGg......", "........KK.GGGKK........", "........KK....KK........", ".......hhh....hhh......."], "colors": {"K": "#0B1B2E", "g": "#9ACB63", "G": "#2E8B3E", "b": "#7FBEE6", "B": "#2560A8", "h": "#C9F03A", "H": "#A8CC1E", "r": "#FF5A4E", "w": "#FFFFFF"}, "faces": {"idle": [[9, 11, 2, 2, "h"], [13, 11, 2, 2, "h"], [10, 15, 4, 1, "h"]], "blink": [[9, 12, 2, 1, "h"], [13, 12, 2, 1, "h"], [10, 15, 4, 1, "h"]], "look": [[8, 11, 2, 2, "h"], [12, 11, 2, 2, "h"], [10, 15, 3, 1, "h"]], "happy": [[8, 12, 1, 1, "h"], [9, 11, 2, 1, "h"], [11, 12, 1, 1, "h"], [12, 12, 1, 1, "h"], [13, 11, 2, 1, "h"], [15, 12, 1, 1, "h"], [9, 14, 6, 1, "h"], [10, 15, 4, 1, "h"]], "think": [[9, 10, 2, 1, "h"], [13, 10, 2, 1, "h"], [9, 15, 1, 1, "h"], [11, 15, 1, 1, "h"], [13, 15, 1, 1, "h"]], "sleep": [[9, 12, 2, 1, "h"], [13, 12, 2, 1, "h"], [11, 15, 2, 1, "h"]], "surprised": [[9, 10, 2, 3, "h"], [13, 10, 2, 3, "h"], [11, 14, 2, 2, "h"]], "love": [[8, 11, 1, 1, "r"], [10, 11, 1, 1, "r"], [8, 12, 3, 1, "r"], [9, 13, 1, 1, "r"], [13, 11, 1, 1, "r"], [15, 11, 1, 1, "r"], [13, 12, 3, 1, "r"], [14, 13, 1, 1, "r"], [10, 15, 4, 1, "h"]]}, "cell": 11, "hub": [11.5, 13.0, 4.9]};
function sababiSVG(){
 const g=SB.grid, cx=SB.hub[0], cy=SB.hub[1], hr=SB.hub[2]; let wheel='', hub='', rest='';
 const px=(x,y,c,w=1,h=1)=>`<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${c}"/>`;
 g.forEach((row,y)=>[...row].forEach((ch,x)=>{ if(ch==='.')return; const c=SB.colors[ch], r=Math.hypot(x-cx,y-cy);
  if('gGbB'.includes(ch)&&y>=5&&y<=22) wheel+=px(x,y,c); else if(ch==='K'&&r<=hr+.2) hub+=px(x,y,c); else rest+=px(x,y,c); }));
 const faces=Object.entries(SB.faces).map(([k,cells])=>`<g class="f f-${k}">${cells.map(([x,y,w,h,ck])=>px(x,y,SB.colors[ck],w,h)).join('')}</g>`).join('');
 const zz=`<g class="zz">${px(21,-4,'#0B1B2E',3,1)}${px(22,-3,'#0B1B2E')}${px(21,-2,'#0B1B2E',3,1)}${px(25,-7,'#0B1B2E',2,1)}${px(25,-6,'#0B1B2E')}${px(25,-5,'#0B1B2E',2,1)}</g>`;
 return `<svg viewBox="-1 -8 28 35" aria-hidden="true"><g class="wheel" style="transform-origin:${cx+.5}px ${cy+.5}px">${wheel}</g>${hub}${rest}${faces}${zz}</svg>`;
}
const SABABI=(()=>{
 const el=$('#sb'), btn=$('#sbBtn'), bub=$('#sbBub'), txt=$('#sbTxt'), acts=$('#sbActs'), menu=$('#sbMenu'), beam=$('#sbBeam');
 btn.innerHTML=sababiSVG(); $$('.sb-mini').forEach(m=>m.innerHTML=sababiSVG());
 const LS='sbPrefs', SS='sbSeen';
 let prefs={}; try{prefs=JSON.parse(localStorage.getItem(LS)||'{}')}catch(_){}
 let seen=[]; try{seen=JSON.parse(sessionStorage.getItem(SS)||'[]')}catch(_){}
 const save=()=>{try{localStorage.setItem(LS,JSON.stringify(prefs));sessionStorage.setItem(SS,JSON.stringify(seen))}catch(_){}};
 let alive=false,last=0,count=0,hideT=0,mood='idle',idleT=0,sleepT=0,walkT=0;
 const enabled=()=>C.sababiOn!==false&&!prefs.hidden;
 const quiet=()=>prefs.mutedUntil&&Date.now()<prefs.mutedUntil;
 const set=s=>{mood=s;el.dataset.st=s;};
 set('idle');
 (function blinkLoop(){setTimeout(()=>{if(mood==='idle'){set('blink');setTimeout(()=>{if(mood==='blink')set('idle');},140);}blinkLoop();},2400+Math.random()*3600);})();
 function wake(){clearTimeout(idleT);clearTimeout(sleepT);if(!alive)return;if(mood==='think'||mood==='sleep')set('idle');
  idleT=setTimeout(()=>{if(bub.hidden&&menu.hidden)set('think');},23000);sleepT=setTimeout(()=>{if(bub.hidden&&menu.hidden)set('sleep');},68000);}
 function show(){if(!enabled())return;el.hidden=false;requestAnimationFrame(()=>el.classList.add('on'));alive=true;wake();}
 function hideBubble(){bub.classList.remove('on');clearTimeout(hideT);setTimeout(()=>{if(!bub.classList.contains('on'))bub.hidden=true;},320);if(mood!=='sleep')set('idle');}
 function busy(){return document.querySelector('#adm.open,.drawer.open,dialog[open]');}
 function say(id,text,opt={}){
  if(!alive||!enabled())return false;
  if(!opt.force){ if(quiet())return false; if(id&&seen.includes(id))return false; if(Date.now()-last<11000||count>=6)return false; if(busy())return false;
   const a=document.activeElement; if(a&&/INPUT|TEXTAREA|SELECT/.test(a.tagName))return false; }
  menu.hidden=true; btn.setAttribute('aria-expanded','false');
  txt.textContent=text; acts.innerHTML='';
  (opt.actions||[]).forEach(([label,fn])=>{const b=document.createElement('button');b.type='button';b.textContent=label;b.onclick=()=>{hideBubble();fn();};acts.appendChild(b);});
  bub.hidden=false; requestAnimationFrame(()=>bub.classList.add('on'));
  const md=opt.mood||'happy'; set(md); setTimeout(()=>{if(mood===md)set('idle');},opt.hold||1400);
  if(opt.target)setTimeout(()=>beacon(opt.target),350);
  if(id&&!seen.includes(id)){seen.push(id);save();} last=Date.now(); if(!opt.force)count++;
  clearTimeout(hideT); const hold=()=>{hideT=setTimeout(()=>{if(bub.matches(':hover,:focus-within'))hold();else hideBubble();},Math.min(opt.ms||8500,innerWidth<620?5200:99999));}; hold();
  return true;
 }
 function beacon(target){ // it points by sending its light: a small blade flies to the target and lights it
  const t=typeof target==='string'?document.querySelector(target):target; if(!t||reduce())return;
  const a=btn.getBoundingClientRect(), r=t.getBoundingClientRect(); if(r.bottom<0||r.top>innerHeight)return;
  const sx=a.left+a.width*.5, sy=a.top+a.height*.5, tx=r.left+r.width/2, ty=r.top+Math.min(r.height/2,48), dx=tx-sx, dy=ty-sy;
  set('happy'); beam.style.left=sx+'px'; beam.style.top=sy+'px'; beam.hidden=false;
  const T=(x,y,s=1,rot=0)=>`translate(calc(${x}px - 50%),calc(${y}px - 50%)) scale(${s}) rotate(${rot}deg)`;
  const an=beam.animate([{transform:T(0,0,.6,0)},{transform:T(dx*.5,dy*.5-Math.min(140,Math.abs(dx)*.3+60),1.2,360),offset:.45},{transform:T(dx,dy,1.4,720),offset:.7},{transform:T(dx,dy,.1,900),opacity:0}],{duration:2000,easing:'cubic-bezier(.3,.7,.2,1)'});
  setTimeout(()=>t.classList.add('sb-lit'),800); setTimeout(()=>t.classList.remove('sb-lit'),2900);
  an.onfinish=()=>{beam.hidden=true;};
 }
 function greet(){const sm=innerWidth<620;
  const msg=(C.sababiHello||'').trim()||(sm?'היי, אני סבבי. צריכים כיוון? לחצו עליי.':'היי, אני סבבי. נולדתי מארבעת הלהבים של הלוגו, ואני סובב את המעגל. צריכים כיוון באתר? לחצו עליי.');
  say('hello',msg,{force:true,mood:'happy',ms:sm?4200:7500});}
 function birth(){ // born from the hero symbol: one spark leaves the blades and becomes סבבי in the corner
  if(!enabled())return; const first=!seen.includes('hello'); el.hidden=false; const dock=btn.getBoundingClientRect();
  const hs=$('#bladesSvg').getBoundingClientRect(), p={x:hs.left+hs.width/2,y:hs.top+hs.height/2};
  if(first&&!reduce()&&hs.bottom>0){
   el.classList.add('pre-born','on');
   const d=document.createElement('i'); d.className='sb-seed'; d.setAttribute('aria-hidden','true'); d.style.left=p.x+'px'; d.style.top=p.y+'px'; document.body.appendChild(d);
   const dx=dock.left+dock.width*.5-p.x, dy=dock.top+dock.height*.45-p.y;
   d.animate([{transform:'translate(-50%,-50%) scale(1) rotate(0)'},{transform:`translate(calc(${dx*.45}px - 50%),calc(${dy*.45-160}px - 50%)) scale(1.6) rotate(540deg)`,offset:.45},{transform:`translate(calc(${dx}px - 50%),calc(${dy}px - 50%)) scale(1) rotate(900deg)`}],{duration:1500,easing:'cubic-bezier(.45,0,.2,1)'}).onfinish=()=>{d.remove();el.classList.remove('pre-born');alive=true;wake();set('happy');setTimeout(greet,450);};
  } else { show(); if(first)setTimeout(greet,500); }
 }
 const go=sel=>{const t=document.querySelector(sel); t&&t.scrollIntoView({behavior:reduce()?'auto':'smooth'});};
 const TIPS=[
  ['#circle','circle',()=>'זה המעגל. כל להב אצלי הוא שלב בעבודה. לחצו על שלב ותראו מה קורה בו.','#ring'],
  ['#calc','calc',()=>'כמה פסולת להצהיר בהיתר? סוג הפרויקט והשטח, ואני מסתובב ומחשב.','#ticket',[['לחשב עכשיו',()=>{go('#calc');setTimeout(()=>$('#areaN').focus({preventScroll:true}),600);}]],'spin'],
  ['#sites','sites',()=>'5 מתקנים. הבית שלי הוא אשל הנשיא: 50 דונם, והמעגל כולו במקום אחד.','#map'],
  ['#film','film',()=>'זה הסרט שלנו, 29 שניות. חפשו אותי בסוף.','#filmV'],
  ['#faq','faq',()=>'לא מצאתם תשובה? המוקד הדיגיטלי עונה מיד, על בסיס המידע באתר.','#advIn',[['לשאול עכשיו',()=>{go('#faq');setTimeout(()=>$('#advIn').focus({preventScroll:true}),600);}]]],
  ['#contact','form',()=>'שם וטלפון מספיקים. את כל השאר נשאל בשיחה.','#fName']];
 const tio=new IntersectionObserver(es=>es.forEach(e=>{const tip=TIPS.find(t=>document.querySelector(t[0])===e.target); if(!tip)return; clearTimeout(e.target.__sbT);
   if(e.isIntersecting&&e.intersectionRatio>=.25)e.target.__sbT=setTimeout(()=>say(tip[1],tip[2](),{target:tip[3],actions:tip[4],mood:tip[5]||'happy',hold:tip[5]?2400:1400}),1300);}),{threshold:[0,.25,.5]});
 addEventListener('scroll',()=>{if(!alive||reduce())return; el.dataset.walk=''; clearTimeout(walkT); walkT=setTimeout(()=>{delete el.dataset.walk;},260); wake();},{passive:true});
 ['pointermove','keydown','touchstart'].forEach(ev=>addEventListener(ev,wake,{passive:true}));
 function toggleMenu(open){const o=open??menu.hidden; menu.hidden=!o; btn.setAttribute('aria-expanded',String(o));
  if(o){hideBubble();set('happy');setTimeout(()=>{if(mood==='happy')set('idle');},900);setTimeout(()=>{const f=menu.querySelector('button');f&&f.focus();},30);} }
 btn.addEventListener('click',()=>{wake();toggleMenu();});
 menu.addEventListener('click',e=>{const b=e.target.closest('button[data-go]'); if(!b)return; toggleMenu(false); btn.focus({preventScroll:true}); const g=b.dataset.go;
  if(g==='mute'){prefs.mutedUntil=Date.now()+7*864e5;save();say(null,'בסדר, אני בשקט לשבוע. אם תצטרכו, אני כאן בפינה.',{force:true,mood:'blink',ms:4500});return;}
  if(g==='hide'){prefs.hidden=true;save();el.classList.remove('on');setTimeout(()=>{el.hidden=true;},450);$('#sbBack').hidden=false;return;}
  if(g==='adv'){go('#faq');setTimeout(()=>$('#advIn').focus({preventScroll:true}),800);return;}
  go(g); });
 $('#sbX').onclick=()=>{hideBubble();btn.focus({preventScroll:true});};
 addEventListener('keydown',e=>{if(e.key!=='Escape')return; if(!menu.hidden){toggleMenu(false);btn.focus({preventScroll:true});} else if(!bub.hidden)hideBubble();});
 document.addEventListener('click',e=>{if(!menu.hidden&&!e.target.closest('#sb'))toggleMenu(false);});
 $('#sbBack').onclick=()=>{prefs.hidden=false;prefs.mutedUntil=0;save();$('#sbBack').hidden=true;show();say(null,'חזרתי. המעגל ממשיך.',{force:true,ms:3000});};
 if(prefs.hidden)$('#sbBack').hidden=false;
 function confetti(){if(reduce())return; const a=btn.getBoundingClientRect();
  for(let i=0;i<16;i++){const c=document.createElement('i'); c.className='sb-conf'; c.style.left=(a.left+a.width/2)+'px'; c.style.top=(a.top+a.height*.35)+'px'; c.style.background=['#9ACB63','#3FA3DC','#C9F03A','#2560A8'][i%4]; document.body.appendChild(c);
   const ang=-Math.PI/2+(Math.random()-.5)*2.4, v=70+Math.random()*100;
   c.animate([{transform:'translate(0,0) rotate(0)'},{transform:`translate(${Math.cos(ang)*v}px,${Math.sin(ang)*v}px) rotate(200deg)`,offset:.45},{transform:`translate(${Math.cos(ang)*v*1.25}px,${Math.sin(ang)*v+90}px) rotate(400deg)`,opacity:0}],{duration:1150,easing:'cubic-bezier(.2,.75,.15,1)'}).onfinish=()=>c.remove();}}
 let spinT=0;
 return {
  start(){ setTimeout(birth,reduce()?150:500); TIPS.forEach(t=>{const n=document.querySelector(t[0]); n&&tio.observe(n);}); },
  celebrate(){if(!alive||!enabled())return; say(null,'קיבלנו. המעגל התחיל, ונחזור אליכם בהקדם.',{force:true,mood:'love',hold:2400,ms:6500}); confetti();},
  spin(){if(!alive||!enabled())return; clearTimeout(spinT); set('spin'); spinT=setTimeout(()=>{if(mood==='spin')set('idle');},1100);},
  glance(){if(!alive||mood==='sleep')return; set('look'); setTimeout(()=>{if(mood==='look')set('idle');},1500);}
 };
})();
</script>
