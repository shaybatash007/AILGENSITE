// Eden Cosmetics: real interactions with assertions (run by scripts/site-qa.mjs --scenario).
export default async function (pg, T) {
  const txt = async s => (await pg.textContent(s) || '').replace(/\s+/g, ' ').trim();
  const num = s => +String(s).replace(/[^\d]/g, '');
  const rows = () => pg.$$eval('#kList .krow', r => r.length);

  // ---- the kit builder (the proof tool)
  await pg.evaluate(() => document.getElementById('kit').scrollIntoView());
  await pg.waitForTimeout(500);
  const r0 = await rows(); T.check('kit: lash/start lists ≥ 4 real categories', r0 >= 4, r0);
  const tot0 = num(await txt('#kTot')); T.check('kit: total is a real sum > 0', tot0 > 0, tot0);
  const ship0 = await txt('#kShip'); T.check('kit: shipping line mentions the ₪499 threshold or free shipping', /499|חינם/.test(ship0), ship0);
  const pg0 = await pg.$eval('#kPg', e => parseFloat(e.style.width)); T.check('kit: progress bar matches total / 499', Math.abs(pg0 - Math.min(100, tot0 / 499 * 100)) < 1.5, pg0 + ' vs ' + tot0);
  // untick the first row: total drops
  await pg.click('#kList .krow:first-child .ck'); const tot1 = num(await txt('#kTot')); T.check('kit: unticking a row lowers the total', tot1 < tot0, tot0 + ' -> ' + tot1);
  await pg.click('#kList .krow:first-child .ck');
  // swap a product through the select
  const sel = await pg.$('#kList .krow select');
  if (sel) { const opts = await sel.$$eval('option', o => o.map(x => x.value)); await sel.selectOption(opts[opts.length - 1]); const tot2 = num(await txt('#kTot')); T.check('kit: choosing another product changes the total', tot2 !== tot0, tot0 + ' -> ' + tot2); }
  // treatments
  await pg.check('input[name=kt][value=brow]'); T.check('kit: brow lists rows', (await rows()) >= 3, await rows());
  await pg.check('input[name=kt][value=tint]');
  const tintTxt = await pg.$$eval('#kList .krow', r => r.map(x => x.textContent).join(' | '));
  T.check('kit: tint lists a tint and an oxidant (חמצן)', /צבע/.test(tintTxt) && /חמצן/.test(tintTxt), tintTxt.slice(0, 120));
  const oxOk = await pg.evaluate(() => { const t = KB.pick.tint && BYID.get(KB.pick.tint), o = KB.pick.oxidant && BYID.get(KB.pick.oxidant); return !!(t && o && t.a && o.a && (!t.b || o.b === t.b || !ITEMS.some(x => x.k === 'oxidant' && x.a && x.b === t.b))); });
  T.check('kit: the default oxidant is in stock and of the tint\'s brand', oxOk);
  await pg.check('input[name=kt][value=lash]'); await pg.check('input[name=kl][value=restock]');
  const restock = await pg.$$eval('#kList .krow .cat2', e => e.map(x => x.textContent)); T.check('kit: restock has single steps and no kit', restock.some(x => /שלב/.test(x)) && !restock.includes('ערכה'), restock.join(','));
  await pg.check('input[name=kl][value=start]');
  const notOut = await pg.evaluate(() => kitSel().filter(r => r.on).every(r => r.x.a)); T.check('kit: every ticked default is in stock', notOut);
  // hand-off
  const wa = await pg.getAttribute('#kWa', 'href'); T.check('kit: WhatsApp link carries the list', /^https:\/\/wa\.me\/972525453602\?text=/.test(wa) && decodeURIComponent(wa).includes('•'), wa.slice(0, 80));
  await pg.click('#kCart'); await pg.waitForTimeout(500);
  T.check('cart: the drawer opens after adding the kit', await pg.$eval('#cart', e => e.classList.contains('open')));
  const cartN = num(await txt('#cartCnt')); T.check('cart: badge counts the kit items', cartN >= 4, cartN);
  const go = await pg.getAttribute('#cGo', 'href'); T.check('cart: hand-off goes to the store cart permalink', /^https:\/\/edencosmetic\.co\.il\/cart\/\d+:\d+(,\d+:\d+)+$/.test(go), go);
  T.check('cart: focus is inside the drawer', await pg.evaluate(() => !!document.activeElement.closest('#cart')));
  await pg.keyboard.press('Escape'); await pg.waitForTimeout(500); T.check('cart: Escape closes it', !(await pg.$eval('#cart', e => e.classList.contains('open'))));
  await pg.reload(); await pg.waitForTimeout(2600); T.check('cart: survives a reload', num(await txt('#cartCnt')) === cartN, await txt('#cartCnt'));

  // ---- the shop
  await pg.evaluate(() => document.getElementById('shop').scrollIntoView());
  const all = await pg.$$eval('#grid .pc', c => c.length); T.check('shop: first page shows 24 cards', all === 24, all);
  await pg.fill('#q', 'THUYA'); await pg.waitForTimeout(200); const th = await pg.$$eval('#grid .pc', c => c.length); T.check('shop: search narrows the list', th > 0 && th < 24, th);
  await pg.fill('#q', ''); await pg.selectOption('#brand', 'ZOLA'); const zo = await pg.$$eval('#grid .pc', c => c.length); T.check('shop: brand filter (ZOLA = 4)', zo === 4, zo);
  await pg.selectOption('#brand', ''); await pg.check('#onlyIn'); const ins = await pg.evaluate(() => filtered().every(x => x.a)); T.check('shop: in-stock filter hides sold-out', ins);
  await pg.uncheck('#onlyIn'); await pg.selectOption('#sort', 'p1'); const prices = await pg.evaluate(() => filtered().map(x => x.p)); T.check('shop: sort by price ascending', prices.every((p, i) => !i || prices[i - 1] <= p));
  await pg.selectOption('#sort', ''); await pg.click('#kinds .kind[data-k=pads]'); const pads = await pg.$$eval('#grid .pc', c => c.length); T.check('shop: kind chip filters silicones (12)', pads === 12, pads);
  await pg.click('#kinds .kind[data-k=""]');
  await pg.click('#moreBtn'); const more = await pg.$$eval('#grid .pc', c => c.length); T.check('shop: "more" adds 24', more === 48, more);
  // quick view
  await pg.click('#grid .pc:first-child .ph2'); await pg.waitForTimeout(300);
  T.check('quick view: opens with title, price and description', (await pg.$eval('#qv', e => e.open)) && (await txt('#qvT')).length > 3 && /₪/.test(await txt('#qvPrice')));
  await pg.keyboard.press('Escape'); await pg.waitForTimeout(200); T.check('quick view: Escape closes it', !(await pg.$eval('#qv', e => e.open)));
  // add from the grid
  const before = num(await txt('#cartCnt')); await pg.click('#grid .pc:not(:has(.tagg.out)) .add >> nth=0'); await pg.waitForTimeout(300); T.check('shop: add from a card raises the cart count', num(await txt('#cartCnt')) === before + 1, before + ' -> ' + await txt('#cartCnt'));
  // a sold-out product must not be addable
  const outCard = await pg.evaluate(() => { F.inStock = false; F.n = 99; F.kind = ''; F.brand = ''; F.q = ''; renderShop(); const c = [...document.querySelectorAll('#grid .pc')].find(x => x.querySelector('.tagg.out')); return c ? { add: !!c.querySelector('[data-add]'), notify: !!c.querySelector('[data-notify]') } : null; });
  T.check('shop: a sold-out product offers "עדכנו אותי", not "הוספה"', outCard && !outCard.add && outCard.notify, JSON.stringify(outCard));
  await pg.click('#grid .pc:has(.tagg.out) [data-notify] >> nth=0'); await pg.waitForTimeout(700);
  T.check('notify: opens the contact form with the product prefilled', /עדכנו אותי/.test(await pg.inputValue('#fMsg')) && (await pg.evaluate(() => LEADCTX.source)) === 'stock');

  // ---- forms (static export: no database, so the WhatsApp fallback must appear, never a dead end)
  await pg.fill('#fName', ''); await pg.fill('#fPhone', '12'); await pg.click('#leadForm [type=submit]'); T.check('form: invalid input shows an error and keeps the form', /שם|טלפון/.test(await txt('#fNote')) && await pg.$eval('#fNote', e => e.classList.contains('err')));
  await pg.fill('#fName', 'בדיקה'); await pg.fill('#fPhone', '0501234567'); await pg.click('#leadForm [type=submit]'); T.check('form: consent is required', /פרטיות/.test(await txt('#fNote')));
  await pg.check('#fAgree'); await pg.click('#leadForm [type=submit]'); await pg.waitForTimeout(400);
  const fb = await pg.$eval('#fNote', e => e.innerHTML); T.check('form: with no database the note offers a WhatsApp link with the message', /wa\.me/.test(fb), fb.slice(0, 120));
  await pg.evaluate(() => document.getElementById('courses').scrollIntoView());
  await pg.fill('#cName', 'בדיקה'); await pg.fill('#cPhone', '0501234567'); await pg.check('#cAgree'); await pg.click('#courseForm [type=submit]'); await pg.waitForTimeout(300);
  T.check('courses: the waiting-list form has the same fallback', /wa\.me/.test(await pg.$eval('#cNote', e => e.innerHTML)));

  // ---- the assistant (fallback answers, facts only)
  await pg.click('#lbtn'); await pg.click('#lm [data-l=ask]'); await pg.waitForTimeout(300); T.check('agent: opens from Lotti\'s menu', await pg.$eval('#agent', e => e.classList.contains('open')));
  await pg.fill('#advIn', 'מתי המשלוח חינם?'); await pg.press('#advIn', 'Enter'); await pg.waitForTimeout(1200);
  const ans = await pg.$$eval('#advBody .bb.ai', b => b[b.length - 1].textContent); T.check('agent: answers the free-shipping question from the policy (₪499)', /499/.test(ans), ans.slice(0, 100));
  await pg.click('#advChips button >> nth=3'); await pg.waitForTimeout(1200);
  const ans2 = await pg.$$eval('#advBody .bb.ai', b => b[b.length - 1].textContent); T.check('agent: says the truth about courses (the collection is empty)', /ריקה|אין תאריכים/.test(ans2), ans2.slice(0, 100));
  await pg.fill('#advIn', 'כמה עולה קורס?'); await pg.press('#advIn', 'Enter'); await pg.waitForTimeout(1200);
  const ans3 = await pg.$$eval('#advBody .bb.ai', b => b[b.length - 1].textContent); T.check('agent: never invents a course price', !/₪\s?\d{3,}/.test(ans3) || /אין/.test(ans3), ans3.slice(0, 100));
  await pg.keyboard.press('Escape'); await pg.waitForTimeout(200); T.check('agent: Escape closes it', !(await pg.$eval('#agent', e => e.classList.contains('open'))));

  // ---- accessibility
  await pg.click('#a11yBtn'); await pg.click('#a11y [data-a=a-contrast]'); T.check('a11y: high contrast toggles a class', await pg.evaluate(() => document.documentElement.classList.contains('a-contrast')));
  await pg.click('#a11y [data-a=a-big]'); await pg.reload(); await pg.waitForTimeout(2600);
  T.check('a11y: choices persist after a reload', await pg.evaluate(() => document.documentElement.classList.contains('a-contrast') && document.documentElement.classList.contains('a-big')));
  await pg.click('#a11yBtn'); await pg.click('#a11yReset'); T.check('a11y: reset clears them', await pg.evaluate(() => !document.documentElement.classList.contains('a-contrast')));
  await pg.keyboard.press('Escape');
  // legal dialogs
  await pg.click('footer [data-legal=privacy]'); await pg.waitForTimeout(500); const lg = await txt('#lgTxt'); T.check('legal: the privacy draft opens with the owner\'s contact', /עדן קוסמטיקס/.test(lg) && /טיוטה/.test(lg), lg.slice(0, 60)); await pg.keyboard.press('Escape');
  await pg.click('footer [data-legal=a11y]'); await pg.waitForTimeout(500); T.check('legal: the accessibility statement opens and names the coordinator', /עדן נחמני/.test(await txt('#lgTxt'))); await pg.keyboard.press('Escape');

  // ---- owner-only console stays hidden
  T.check('admin: the owner console button is hidden from visitors', (await pg.$eval('#admBtn', e => getComputedStyle(e).display)) === 'none');

  // ---- Lotti's manners
  const tips = await pg.evaluate(() => +sessionStorage.getItem('edenTips') || 0); T.check('Lotti: at most 6 tips in the visit', tips <= 6, tips);
  await pg.evaluate(() => { document.getElementById('lbtn').click(); }); await pg.click('#lm [data-l=quiet]');
  const muted = await pg.evaluate(() => +localStorage.getItem('edenLottiMuted') > Date.now() + 6 * 864e5); T.check('Lotti: "quiet for a week" is remembered', muted);
  await pg.evaluate(() => { document.getElementById('lbtn').click(); }); await pg.click('#lm [data-l=hide]'); T.check('Lotti: "hide" removes her', await pg.$eval('#lotti', e => e.hidden));
  await pg.click('#lottiBack'); T.check('Lotti: the footer link brings her back', !(await pg.$eval('#lotti', e => e.hidden)));

  // ---- the film section
  const film = await pg.evaluate(() => { const v = document.getElementById('filmV'); const s = document.getElementById('film'); return { video: !!v, poster: !!v?.getAttribute('poster'), src: v?.querySelector('source')?.getAttribute('src') || '', transcript: (s?.querySelector('details.tr p')?.textContent || '').length, label: /תמונות מוצר מהחנות/.test(s?.textContent || ''), heroLink: document.querySelector('.tlink')?.getAttribute('href') || '', ld: /VideoObject/.test(document.querySelector('script[type="application/ld+json"]')?.textContent || '') }; });
  T.check('film: a video with a poster, controls and no autoplay', film.video && film.poster && await pg.$eval('#filmV', e => e.controls && !e.autoplay), JSON.stringify(film));
  T.check('film: a text transcript and the honesty label are next to it', film.transcript > 300 && film.label, film.transcript);
  T.check('film: the hero links to it and the page declares a VideoObject', film.heroLink === '#film' && film.ld, film.heroLink + ' ' + film.ld);
  const fr = await pg.evaluate(async () => { const r = await fetch('m/film-web.mp4', { method: 'HEAD' }); return r.status + ' ' + r.headers.get('content-type'); }); T.check('film: the file is served as video/mp4', /^200 video\/mp4/.test(fr), fr);

  // ---- SEO surface of the home page
  const h = await pg.evaluate(() => ({ title: document.title, desc: document.querySelector('meta[name=description]')?.content || '', canon: document.querySelector('link[rel=canonical]')?.href || '', ld: [...document.querySelectorAll('script[type="application/ld+json"]')].length, links: document.querySelectorAll('footer a[href^="/"]').length }));
  T.check('seo: title 30–65 chars, description 70–160', h.title.length >= 30 && h.title.length <= 65 && h.desc.length >= 70 && h.desc.length <= 160, h.title.length + '/' + h.desc.length);
  T.check('seo: canonical and JSON-LD present', !!h.canon && h.ld >= 1, JSON.stringify(h));
  T.check('seo: the footer carries static links to collections, guides, brands and policies', h.links >= 15, h.links);
}
