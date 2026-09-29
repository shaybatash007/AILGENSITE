// Shared SEO helpers: text tokens for matching pages, and turning crawled blocks into clean article content.

const STOP = new Set('של את עם על או גם כל אל מן זה זו הם הן אבל לא כי אם מה איך למה בין עד לפי כמו וגם'.split(' '));

/** Title without the brand suffix ("... - קבוצת X", "... | X"). */
export const stem = t => (t || '').replace(/\s+[-|–·]\s+[^-|–·]*$/, '').replace(/[^\p{L}\p{N}\s]/gu, ' ');

/** Meaningful words of a title: no stop words, one leading Hebrew prefix letter removed. */
export const tokens = t => new Set(stem(t).split(/\s+/).map(w => w.replace(/^[והבלכמש](?=.{3,})/, '')).filter(w => w.length > 1 && !STOP.has(w)));

/** Share of the smaller set that the other contains (0..1). */
export const overlap = (x, y) => { if (!x.size || !y.size) return 0; let n = 0; for (const w of x) if (y.has(w)) n++; return n / Math.min(x.size, y.size); };

/** Path form used everywhere: decoded, lower-case, one trailing slash, no query or hash. */
export const pathOf = (u, base = 'https://x.invalid/') => { try { return decodeURIComponent(new URL(u, base).pathname).toLowerCase().replace(/\/?$/, '/'); } catch { return null; } };

// Text the crawler picks up from widgets and chrome, never article content.
const NOISE = /^(מאשר\/ת|הצהרת פרטיות|ESC|ניווט מקלדת|ביטול הבהובים|מונוכרום|ספיה|ניגודיות|שחור צהוב|היפוך צבעים|הדגשת|הצגת תיאור|הגדלת|הקטנת|איפוס|טען עוד|שליחה|כל השדות|קראתי ואני מאשר|שם מלא)/;

/**
 * Crawled page blocks → article blocks [{k:'h2'|'h3'|'p'|'ul', t|items}].
 * Keeps only the main region, drops widget text and duplicates, groups list items, and stops at the
 * first heading that starts a contact form (`stopAt`). Question-and-answer paragraphs are content and stay.
 */
export function cleanBlocks(blocks, { stopAt = /^(צרו איתנו קשר|השאירו פרטים)/, dropH1 = true } = {}) {
  const out = [], seen = new Set();
  for (const b of blocks) {
    if (b.region && b.region !== 'main') continue;
    const t = (b.text || '').replace(/\s+/g, ' ').trim();
    if (!t || NOISE.test(t) || b.kind === 'cta') continue;
    if (['h2', 'h3'].includes(b.kind) && stopAt.test(t)) break;
    if (b.kind === 'h1') { if (dropH1) continue; }
    if ((b.kind === 'td' || b.kind === 'th') && b.table !== undefined) {
      let tb = out.find(x => x.k === 'table' && x.id === b.table); if (!tb) { tb = { k: 'table', id: b.table, rows: [] }; out.push(tb); }
      (tb.rows[b.row] ||= [])[b.col] = t; continue;
    }
    const key = b.kind + '|' + t; if (seen.has(key)) continue; seen.add(key);
    if (b.kind === 'blockquote') { out.push({ k: 'quote', t }); continue; }
    if (b.kind === 'li') { const last = out[out.length - 1]; if (last && last.k === 'ul') last.items.push(t); else out.push({ k: 'ul', items: [t] }); }
    else if (['h1', 'h2', 'h3', 'p'].includes(b.kind)) out.push({ k: b.kind, t });
    else if (b.kind === 'h4') out.push({ k: 'h3', t });
  }
  while (out.length && ['h2', 'h3'].includes(out[out.length - 1].k)) out.pop(); // a heading whose content the crawler could not read (an accordion)
  return out;
}

export const wordCount = blocks => blocks.reduce((n, b) => n + (b.t ? b.t.split(/\s+/).length : b.items ? b.items.join(' ').split(/\s+/).length : (b.rows || []).flat().join(' ').split(/\s+/).length), 0);
