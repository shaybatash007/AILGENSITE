// Shared helpers for the studio scripts: Playwright loading, proxy-aware networking, CLI args.
import { createRequire } from 'module';
import { spawnSync } from 'child_process';
import fs from 'fs';
import path from 'path';

/**
 * Load Playwright from the project, the global npm root, or the known cloud path.
 * @returns {import('playwright')}
 */
export function loadPlaywright() {
  const roots = [process.cwd() + '/', '/opt/node22/lib/node_modules/'];
  const g = spawnSync('npm', ['root', '-g'], { encoding: 'utf8' });
  if (g.status === 0 && g.stdout.trim()) roots.push(g.stdout.trim() + '/');
  for (const r of roots) {
    try { return createRequire(r)('playwright'); } catch { /* try the next root */ }
  }
  throw new Error('Playwright not found. Install it with: npm i -g playwright && npx playwright install chromium');
}

/**
 * When the machine sits behind an HTTPS proxy (a cloud sandbox), Node's fetch only uses it if
 * NODE_USE_ENV_PROXY=1 is set at startup. Re-run this script once with the flag, keeping TLS on.
 * Returns true when the current process should exit because a child took over.
 */
export function ensureProxyEnv() {
  if (!process.env.HTTPS_PROXY || process.env.NODE_USE_ENV_PROXY === '1') return false;
  const r = spawnSync(process.execPath, ['--no-warnings', ...process.argv.slice(1)], {
    stdio: 'inherit', env: { ...process.env, NODE_USE_ENV_PROXY: '1' },
  });
  process.exit(r.status ?? 1);
}

/**
 * Serve every browser request through Node's fetch. Used only behind a proxy, where the headless
 * browser does not trust the proxy CA but Node does (NODE_EXTRA_CA_CERTS). TLS stays verified.
 * @param {import('playwright').BrowserContext} ctx
 */
export async function routeThroughNode(ctx) {
  if (!process.env.HTTPS_PROXY) return;
  await ctx.route('**/*', async route => {
    const req = route.request();
    if (!/^https?:/.test(req.url())) return route.continue();
    try {
      const headers = { ...req.headers() };
      delete headers['accept-encoding'];
      // Playwright intercepts only the first hop of a redirect, so follow redirects here
      const r = await fetch(req.url(), { method: req.method(), headers, body: req.postDataBuffer() || undefined, redirect: 'follow' });
      let body = Buffer.from(await r.arrayBuffer());
      const h = {};
      r.headers.forEach((v, k) => { if (!['content-encoding', 'content-length', 'transfer-encoding'].includes(k)) h[k] = v; });
      // speculative prefetch (e.g. WordPress speculation rules) runs outside this handler and would
      // fail on the proxy certificate, so drop those hints from HTML documents
      if (/text\/html/.test(h['content-type'] || '')) {
        let html = body.toString('utf8')
          .replace(/<script[^>]*type=["']?speculationrules["']?[^>]*>[\s\S]*?<\/script>/gi, '')
          .replace(/<link[^>]*rel=["']?(?:prefetch|prerender)["']?[^>]*>/gi, '');
        // after a redirect the document keeps its first URL: pin relative links to the final one
        if (r.redirected && r.url !== req.url() && !/<base\s/i.test(html)) html = html.replace(/<head[^>]*>/i, m => `${m}<base href="${r.url}">`);
        body = Buffer.from(html);
      }
      await route.fulfill({ status: r.status, headers: h, body });
    } catch {
      await route.abort().catch(() => {});
    }
  });
}

/**
 * Parse `--key value` and `--flag` arguments. Positional arguments land in `_`.
 * @param {string[]} argv
 */
/**
 * Cloudflare's key reaches a script one of two ways: CLOUDFLARE_API_TOKEN in the environment, or an API credential
 * stored in the cloud environment's settings for api.cloudflare.com, which the environment adds to each request itself
 * (the script never sees it). Without the variable no Authorization header is sent, so the stored one is used.
 */
export const cloudflareAuth = () => { const t = process.env.CLOUDFLARE_API_TOKEN || process.env.CF_API_TOKEN; return t ? { authorization: `Bearer ${t}` } : {}; };
/** Does the account answer Workers AI? With the variable set, assume yes; otherwise ask once (a free model listing). */
export async function cloudflareReach(acc) {
  if (!acc) return false;
  if (process.env.CLOUDFLARE_API_TOKEN || process.env.CF_API_TOKEN) return true;
  try { return (await fetch(`https://api.cloudflare.com/client/v4/accounts/${acc}/ai/models/search?per_page=1`, { signal: AbortSignal.timeout(10000) })).ok; } catch { return false; }
}

export function parseArgs(argv = process.argv.slice(2)) {
  const out = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const k = a.slice(2), v = argv[i + 1];
      if (v === undefined || v.startsWith('--')) out[k] = true; else { out[k] = v; i++; }
    } else out._.push(a);
  }
  return out;
}

/** Find the repository root (the folder that holds .git), starting from `from`. */
export function repoRoot(from = process.cwd()) {
  let d = path.resolve(from);
  while (d !== path.dirname(d)) {
    if (fs.existsSync(path.join(d, '.git'))) return d;
    d = path.dirname(d);
  }
  return path.resolve(from);
}

/** URL-safe slug from any text (keeps latin letters and digits). */
export function slugify(s) {
  return String(s).toLowerCase().normalize('NFKD').replace(/[^\w\s-]/g, '').trim().replace(/[\s_]+/g, '-').replace(/-+/g, '-').slice(0, 48) || 'project';
}

/** Write JSON with stable formatting. */
export function writeJSON(file, data) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(data, null, 2) + '\n');
}
