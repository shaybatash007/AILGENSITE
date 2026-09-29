#!/usr/bin/env node
// Talor Karadi: the tables inside the old guides (the first crawl kept cell text but not rows).
//   node projects/talorkaradi/seo/tables.mjs      → projects/talorkaradi/seo/tables.json
// One polite request per guide page (1 s apart), plain HTML, no rendering. Each table is stored with the heading before it.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { ensureProxyEnv } from '../../../.claude/skills/ailgen-studio/scripts/lib.mjs';
ensureProxyEnv();
const HERE = path.dirname(fileURLToPath(import.meta.url));
const cfg = JSON.parse(fs.readFileSync(path.join(HERE, 'pages.json'), 'utf8'));
const guides = cfg.pages.filter(p => p.type === 'guide' || p.type === 'service');
const strip = h => h.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/g, '').replace(/<br\s*\/?>/g, ' ').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#0?39;/g, "'").replace(/&#8211;/g, '–').replace(/\s+/g, ' ').trim();
const out = {};
for (const g of guides) {
  const url = 'https://talorkaradi.co.il' + encodeURI(g.path);
  const r = await fetch(url, { headers: { 'user-agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36' } });
  const html = await r.text(); let last = '';
  const items = [];
  for (const m of html.matchAll(/<h[23][^>]*>([\s\S]*?)<\/h[23]>|<table[\s\S]*?<\/table>/g)) {
    if (m[0].startsWith('<table')) {
      const rows = [...m[0].matchAll(/<tr[\s\S]*?<\/tr>/g)].map(tr => [...tr[0].matchAll(/<t[hd][^>]*>([\s\S]*?)<\/t[hd]>/g)].map(c => strip(c[1]))).filter(r => r.length);
      if (rows.length > 1) items.push({ after: last, rows });
    } else last = strip(m[1]);
  }
  if (items.length) out[g.path] = items;
  console.log(g.path.slice(0, 40), items.length ? items.map(i => `${i.rows.length}x${i.rows[0].length} after "${i.after.slice(0, 30)}"`).join('; ') : '-');
  await new Promise(r => setTimeout(r, 1000));
}
fs.writeFileSync(path.join(HERE, 'tables.json'), JSON.stringify(out, null, 1));
