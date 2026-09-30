// Drives the Eden home page through every dynamic state a visitor can reach, so copy-harvest.mjs sees the text of each.
// Each step is independent: a missing element skips that step and never stops the harvest.
export default async function (pg, snap, { mobile }) {
  const step = async (name, fn) => { try { await fn(); await pg.waitForTimeout(350); await snap(name); } catch (e) { /* the state is not reachable in this layout */ } };
  const click = async sel => { const el = await pg.$(sel); if (!el) throw new Error('no ' + sel); await el.click({ force: true }); };
  const esc = () => pg.keyboard.press('Escape');

  // kit builder: every treatment × level
  for (const t of ['lash', 'brow', 'tint']) for (const l of ['start', 'restock'])
    await step(`kit ${t}/${l}`, async () => { await pg.check(`input[name=kt][value=${t}]`, { force: true }); await pg.check(`input[name=kl][value=${l}]`, { force: true }); });
  // shop: filters and an empty result
  await step('shop filtered, empty', async () => { await pg.fill('#q', 'zzzz'); });
  await step('shop reset', async () => { await pg.fill('#q', ''); await pg.check('#onlyIn', { force: true }); });
  // quick view: in stock, out of stock
  await step('quick view in stock', async () => { await click('#grid [data-qv]'); });
  await esc();
  await step('quick view out of stock', async () => { await pg.uncheck('#onlyIn', { force: true }); const id = await pg.evaluate(() => (CAT.items.find(x => !x.a) || {}).i); await pg.evaluate(i => openQV(BYID.get(i)), id); });
  await esc();
  // cart: empty, then with a product
  await step('cart empty', async () => { await click('#cartBtn'); });
  await esc();
  await step('cart with a product', async () => { await pg.evaluate(() => { addToCart(CAT.items.find(x => x.a), 1, true); openCart(true); }); });
  await step('cart cleared', async () => { await click('#cClear'); });
  await esc();
  // Lotti: menu, then the agent and each suggested question
  await step('lotti menu', async () => { await click('#lbtn'); });
  await esc();
  await step('agent open', async () => { await pg.evaluate(() => openAgent(true)); });
  const chips = await pg.$$eval('#advChips button', b => b.map(x => x.textContent));
  for (const c of chips) await step('agent: ' + c, async () => { await pg.evaluate(t => { const b = [...document.querySelectorAll('#advChips button')].find(x => x.textContent === t); b && b.click(); }, c); await pg.waitForTimeout(1600); });
  await step('agent: free question', async () => { await pg.fill('#advIn', 'יש משלוח לאילת?'); await pg.press('#advIn', 'Enter'); await pg.waitForTimeout(1800); });
  await pg.evaluate(() => openAgent(false));
  // Lotti's brand tour: every panel
  await step('tour 1', async () => { await pg.evaluate(() => LOT.tour()); });
  for (let i = 2; i <= 8; i++) await step('tour ' + i, async () => { await pg.click('#ltour [data-t=next]', { force: true }); });
  await esc();
  // accessibility panel and legal dialogs
  await step('a11y panel', async () => { await click('#a11yBtn'); });
  await esc();
  for (const k of ['privacy', 'a11y']) { await step('legal ' + k, async () => { await pg.evaluate(k => document.querySelector(`[data-legal="${k}"]`).click(), k); }); await esc(); }
  // forms: submit empty (validation messages), then the lead dialog from a product
  await step('course form empty submit', async () => { await pg.evaluate(() => document.querySelector('#courseForm').requestSubmit()); });
  await step('lead form empty submit', async () => { await pg.evaluate(() => document.querySelector('#leadForm').requestSubmit()); });
  if (mobile) { await step('drawer', async () => { await click('#burger'); }); await esc(); }
}
