#!/usr/bin/env node
// A static server that behaves like the production host: `_redirects` (301/302/410), `_headers`, `404.html` with a real
// 404 status, directory indexes. Use it to test a build before it is deployed, exactly as Cloudflare Pages / Netlify
// would serve it, and as the target of seo-verify.mjs.
//   node seo-serve.mjs <dir> [--port 8770]
//   import { startServer } from './seo-serve.mjs';  const s = await startServer({ dir }); ... s.url ... await s.close();
import fs from 'fs';
import path from 'path';
import http from 'http';
import zlib from 'zlib';
import { fileURLToPath } from 'url';

const TYPES = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json', '.xml': 'application/xml', '.txt': 'text/plain; charset=utf-8', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.gif': 'image/gif', '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.woff': 'font/woff', '.mp4': 'video/mp4', '.webm': 'video/webm', '.pdf': 'application/pdf' };
/** Normalised path used to match redirect rules: decoded, lower-case, one trailing slash. */
const norm = p => { try { return decodeURIComponent(p).toLowerCase().replace(/\/?$/, '/'); } catch { return p.toLowerCase().replace(/\/?$/, '/'); } };

function parseRedirects(dir) {
  const f = path.join(dir, '_redirects'); if (!fs.existsSync(f)) return new Map();
  const m = new Map();
  for (const line of fs.readFileSync(f, 'utf8').split('\n')) {
    const t = line.replace(/#.*$/, '').trim(); if (!t) continue;
    const [from, to, status] = t.split(/\s+/); if (!from || !to) continue;
    m.set(norm(from), { to, status: +status || 301 });
  }
  return m;
}
function parseHeaders(dir) {
  const f = path.join(dir, '_headers'); if (!fs.existsSync(f)) return [];
  const rules = []; let cur = null;
  for (const line of fs.readFileSync(f, 'utf8').split('\n')) {
    if (!line.trim() || line.trim().startsWith('#')) continue;
    if (!/^\s/.test(line)) { cur = { pattern: new RegExp('^' + line.trim().replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*') + '$'), headers: {} }; rules.push(cur); }
    else if (cur) { const i = line.indexOf(':'); if (i > 0) cur.headers[line.slice(0, i).trim().toLowerCase()] = line.slice(i + 1).trim(); }
  }
  return rules;
}

export function startServer({ dir, port = 0 }) {
  const root = path.resolve(dir), redirects = parseRedirects(root), headerRules = parseHeaders(root);
  const notFound = fs.existsSync(path.join(root, '404.html')) ? fs.readFileSync(path.join(root, '404.html')) : null;
  const server = http.createServer((req, res) => {
    const u = new URL(req.url, 'http://x'); let p = u.pathname;
    const send = (status, body, type, extra = {}) => {
      const h = { 'content-type': type || 'text/plain; charset=utf-8', ...extra };
      let pathForRules; try { pathForRules = decodeURIComponent(p); } catch { pathForRules = p; }
      for (const r of headerRules) if (r.pattern.test(pathForRules)) Object.assign(h, r.headers);
      // a real host compresses text: gzip it when the client accepts it, so performance numbers are honest
      if (req.method !== 'HEAD' && body && body.length > 1024 && /^(text\/|application\/(json|xml|javascript))|svg/.test(h['content-type']) && /gzip/.test(req.headers['accept-encoding'] || '')) { body = zlib.gzipSync(body, { level: 6 }); h['content-encoding'] = 'gzip'; h.vary = 'Accept-Encoding'; }
      res.writeHead(status, h); res.end(req.method === 'HEAD' ? undefined : body);
    };
    const rule = redirects.get(norm(p));
    if (rule) {
      if (rule.status === 410) return send(410, 'Gone');
      return send(rule.status, '', 'text/plain', { location: rule.to });
    }
    let file; try { file = path.join(root, decodeURIComponent(p)); } catch { return send(400, 'Bad request'); }
    if (!file.startsWith(root)) return send(403, 'Forbidden');
    if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
    if (fs.existsSync(file) && fs.statSync(file).isFile()) return send(200, fs.readFileSync(file), TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream');
    if (notFound) return send(404, notFound, TYPES['.html']);
    send(404, 'Not found');
  });
  return new Promise(resolve => server.listen(port, '127.0.0.1', () => {
    const { port: pr } = server.address();
    resolve({ url: `http://127.0.0.1:${pr}`, port: pr, redirects: redirects.size, close: () => new Promise(r => server.close(r)) });
  }));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const dir = process.argv[2], pi = process.argv.indexOf('--port');
  if (!dir) { console.error('usage: node seo-serve.mjs <dir> [--port 8770]'); process.exit(2); }
  const s = await startServer({ dir, port: pi > 0 ? +process.argv[pi + 1] : 8770 });
  console.log(`serving ${dir} at ${s.url} (${s.redirects} redirect rules)`);
}
