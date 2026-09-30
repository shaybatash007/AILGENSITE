<script>
/* ================= EDEN COSMETICS · content model (every fact from edencosmetic.co.il, see projects/edencosmetic/brief.md) ================= */
const $=(s,r=document)=>r.querySelector(s), $$=(s,r=document)=>[...r.querySelectorAll(s)];
/* a range like 4–5 turns into 5–4 inside Hebrew text (the dash is a neutral): LRMs around it keep the order */
const rng=s=>String(s).replace(/(\d)([–-])(\d)/g,'$1\u200E$2\u200E$3');
const esc=s=>rng(String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])));
const reduce=()=>matchMedia('(prefers-reduced-motion: reduce)').matches||document.documentElement.classList.contains('a-still');
const rid=()=>Math.random().toString(36).slice(2,10)+Date.now().toString(36).slice(-4);
const nf=n=>Math.round(n).toLocaleString('he-IL');
const money=n=>'₪'+nf(n);
const bdi=t=>'<bdi>'+esc(t)+'</bdi>';
/* Hebrew counts: one is written as a word (מוצר אחד), two and more as a number */
const nP=(n,one,many)=>n===1?one:n+' '+many;
const nProd=n=>nP(n,'מוצר אחד','מוצרים');
const toRange=(a,b)=>a===b?money(a):money(a)+' עד '+money(b);
document.documentElement.classList.add('js');
try{JSON.parse(localStorage.getItem('edenA11y')||'[]').forEach(c=>document.documentElement.classList.add(c));}catch(_){}
/* LIVE = the hosted live version with its own database (no product pages behind it); the static export links to the real pages */
const LIVE=!!(window.claude&&window.claude.use);

const DEF={
 heroLine:'ציוד מקצועי להרמת ריסים *וגבות*',
 heroSub:'ממי שמטפלת ומדריכה בתחום. ערכות, סיליקונים, דבקים וצבעים משבעה מותגים מקצועיים, ורשימה מוכנה לכל טיפול.',
 bar:'משלוח חינם בהזמנה מעל ₪499 · האתר שומר שבת, אפשר להזמין בצאת השבת',
 story:[['אני עדן נחמני בעלת המותג','מלווה נשים לעסוק ביופי – בביטחון ובתשוקה.'],['את דרכי התחלתי מתוך אהבה לאסתטיקה','עם הזמן – הפכתי את התחום למקצוע, ואת המקצוע – לשליחות.'],['היום אני עוסקת בטיפולים אישיים, הדרכות מקצועיות, קורסים והשתלמויות בתחום עיצוב גבות, הרמת ריסים והרמת גבות.'],['אני מאמינה בשיטה ברורה, טבעית ופרקטית – כזו שמביאה תוצאות נקיות, הרמוניות ומותאמות אישית.'],['אז אם את שואפת לתוצאה מדויקת או רוצה לרכוש ידע מקצועי ברמה הגבוהה ביותר, את מוזמנת ליצור קשר, לתאם טיפול או להצטרף לקורס הבא.']],
 courseText:'עדן מלמדת הרמת ריסים, הרמת גבות ועיצוב גבות. כרגע אין קורס פתוח להרשמה. אפשר להצטרף לרשימה, ועדן תחזור אלייך כשייפתח הקורס הבא.',
 phone:'052-545-3602', phoneRaw:'0525453602', wa:'972525453602', email:'Edencosmetics29@gmail.com', instagram:'https://www.instagram.com/edennahmani1',
 faq:[
  ['כמה זמן לוקח המשלוח?','האספקה באמצעות חברת שליחויות חיצונית: 4–5 ימי עסקים לבית או לעסק, וליישובים מרוחקים עד 2 ימי עסקים נוספים. ימי המשלוח לא כוללים את יום ההזמנה, שישי, שבת וערבי חג.'],
  ['מתי המשלוח חינם?','בהזמנה מעל ₪499. מחירי המוצרים באתר כוללים מע"מ ואינם כוללים משלוח, שמתווסף בקופה כשההזמנה מתחת לסכום.'],
  ['אפשר לאסוף בעצמי?','כן, מנתיבות, בתיאום מראש בלבד: 052-545-3602.'],
  ['אפשר להחזיר או להחליף?','אפשר עד 14 ימים (לא עסקים) מקבלת המוצר, כל עוד לא נפתח, ארוז באריזתו המקורית ולא נעשה בו שימוש. עלות המשלוח על הלקוחה. החזר כספי לכרטיס האשראי בניכוי 7% דמי ביטול (משלוח מסירה והחזרה אינם מוחזרים). להחזרה מתקשרים ל-052-545-3602 לתיאום שליח.'],
  ['האתר שומר שבת?','כן. אפשר לבצע הזמנות בצאת השבת.'],
  ['מה קורה אם מוצר שהזמנתי אזל?','לפי מדיניות החנות, ייצרו איתך קשר ויציעו ביטול העסקה ללא דמי ביטול, או מוצר חלופי. מוצרים שאזלו מסומנים "אזל" באתר, ואפשר לבחור "עדכנו אותי".'],
  ['המוצרים חדשים ומקוריים?','לפי מדיניות החנות: כל המוצרים המוצעים באתר הם מקוריים, חדשים, באריזתם המקורית, ללא פגם, אלא אם צוין אחרת בהבלטה בכותרת המכירה ובתיאור המוצר.'],
  ['יש קורסים והשתלמויות?','עדן מלמדת הרמת ריסים, הרמת גבות ועיצוב גבות. כרגע אין קורס פתוח להרשמה, ולכן אין מועדים או מחיר. אפשר להצטרף לרשימת ההמתנה באתר.'],
  ['איך משלמים ומי יכולה לקנות?','הסל והתשלום בחנות. הרכישה מותנית בגיל 18 ומעלה ובכרטיס אשראי ישראלי תקף.'],
 ],
 privacy:'', a11yText:'',
 agentOn:true, agentNotes:'', lottiOn:true, lottiHello:'', courseInterest:[]
};
let C=structuredClone(DEF);

/* the builder: which categories of the store belong to which treatment. Labels are the store's own words; there are no instructions here. */
const step=n=>x=>x.k==='step'&&new RegExp('שלב '+n).test(x.t);
const KIT={
 lash:{label:'הרמת ריסים',start:[
   {k:'set',t:'ערכה',f:x=>x.k==='set'},{k:'pads',t:'סיליקונים',f:x=>x.k==='pads'&&!/גבות/.test(x.t)},{k:'glue',t:'דבק / בלאם',f:x=>x.k==='glue'},{k:'clean',t:'ניקוי',f:x=>x.k==='clean'},
   {k:'tool',t:'כלים',f:x=>/מוט הרמה|מסרק להפרדת|סרט דבק|בייביבראש/.test(x.t)}],
  restock:[{k:'s1',t:'שלב 1',f:step(1)},{k:'s2',t:'שלב 2',f:step(2)},{k:'s3',t:'שלב 3',f:step(3)},{k:'pads',t:'סיליקונים',f:x=>x.k==='pads'&&!/גבות/.test(x.t)},{k:'glue',t:'דבק / בלאם',f:x=>x.k==='glue'},{k:'clean',t:'ניקוי',f:x=>x.k==='clean'},{k:'tool',t:'כלים',f:x=>/מוט הרמה|מסרק להפרדת|סרט דבק|בייביבראש/.test(x.t)}]},
 brow:{label:'הרמת גבות',start:[
   {k:'set',t:'ערכה',f:x=>x.k==='set'},{k:'pads',t:'סיליקון לגבות',f:x=>x.k==='pads'&&/גבות/.test(x.t)},{k:'tool',t:'כלים',f:x=>/מסרקונים להרמת גבות|ניילון נצמד/.test(x.t)},{k:'clean',t:'ניקוי',f:x=>x.k==='clean'}],
  restock:[{k:'s1',t:'שלב 1',f:step(1)},{k:'s2',t:'שלב 2',f:step(2)},{k:'s3',t:'שלב 3',f:step(3)},{k:'pads',t:'סיליקון לגבות',f:x=>x.k==='pads'&&/גבות/.test(x.t)},{k:'tool',t:'כלים',f:x=>/מסרקונים להרמת גבות|ניילון נצמד/.test(x.t)},{k:'clean',t:'ניקוי',f:x=>x.k==='clean'}]},
 tint:{label:'צביעה',start:[
   {k:'tint',t:'צבע',f:x=>x.k==='tint'},{k:'oxidant',t:'חמצן',f:x=>x.k==='oxidant'},{k:'tool',t:'כלים',f:x=>/כוסית קטנה|מברשת זוויתית/.test(x.t)},{k:'clean',t:'ניקוי',f:x=>x.k==='clean'}],
  restock:[{k:'tint',t:'צבע',f:x=>x.k==='tint'},{k:'oxidant',t:'חמצן',f:x=>x.k==='oxidant'},{k:'tool',t:'כלים',f:x=>/כוסית קטנה|מברשת זוויתית/.test(x.t)}]}
};
