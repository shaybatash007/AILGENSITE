#!/usr/bin/env node
// AILGEN Lab · AI UNIFIED from the command line: how the agent (Claude) builds, prices, runs and keeps the same flows the owner sees
// in the lab (ailgen-lab.pages.dev, tab "זרימות"). The flow engine is the page's own (lab/unified/engine.js); every model call goes
// through the lab's /api/run, so the budget, the ledger and the price before and after are the lab's; the composer is ffmpeg here
// (MP4) instead of the browser's recorder; flows and runs are saved in the lab's KV marked by: "agent", so the owner sees them.
//
//   node cloud/lab/unified.mjs templates                         the ready flows (ids for <ref>)
//   node cloud/lab/unified.mjs flows | runs [--flow id]          what is saved in the lab
//   node cloud/lab/unified.mjs get <id> [--out f.json]           a saved flow as JSON
//   node cloud/lab/unified.mjs save <ref> [--id x] [--name ".."] [--set ...]   save a flow (a template, a file, or a saved id) to the lab
//   node cloud/lab/unified.mjs check|estimate <ref> [--set ...]  problems, and the price before anything runs
//   node cloud/lab/unified.mjs run <ref> [--set node.key=value ...] [--max-usd N] [--yes] [--out dir] [--no-record]
//   node cloud/lab/unified.mjs call <model> '<json input>' [--yes]   one model, one call
//   node cloud/lab/unified.mjs models [--sector video] [--tier top] [--q veo]
//   node cloud/lab/unified.mjs budget [--set 100]
// <ref>: a saved flow id, a template id, or a .json file. --set brief.text="..." sets a node's value: text for a text input, url
// (a link or a local file) for a media input, model for a model node, and any other key goes into the model's request.
// Access: LAB_PASSCODE from the environment (never pasted into a chat); LAB_URL (default https://ailgen-lab.pages.dev);
// --local talks to `node cloud/dev.mjs serve lab --port 8791 --key test` instead. A paid run needs --yes: the plan and its price
// are printed first, and the run stops at --max-usd (default: 1.5 × the estimate).
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { ensureProxyEnv } from '../../.claude/skills/ailgen-studio/scripts/lib.mjs';
if (ensureProxyEnv()) process.exit(0);

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const { createEngine, layout, slim, FREE_OUT, freeRunnable, KIND_NAME } = await import(path.join(ROOT, 'lab/unified/engine.js'));
const { TEMPLATES } = await import(path.join(ROOT, 'lab/unified/templates.js'));
const { estimate: priceOf, label } = await import(path.join(ROOT, 'lab/price.js'));

const argv = process.argv.slice(2), has = k => argv.includes(k);
const flag = k => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : undefined; };
const sets = argv.flatMap((a, i) => a === '--set' ? [argv[i + 1]] : []);
const pos = argv.filter((a, i) => !a.startsWith('--') && !(i && argv[i - 1].startsWith('--') && !['--yes', '--local', '--no-record'].includes(argv[i - 1])));
const [cmd, ref, extra] = pos;
const LOCAL = has('--local'), LAB = LOCAL ? 'http://localhost:8791' : (process.env.LAB_URL || 'https://ailgen-lab.pages.dev').replace(/\/$/, '');
const KEY = LOCAL ? 'test' : process.env.LAB_PASSCODE || '';
const die = m => { console.error('  ✗ ' + m); process.exit(1); };
const usd = v => v == null ? '?' : '$' + (v < 0.01 ? v.toFixed(4) : v < 1 ? v.toFixed(3) : v.toFixed(2));

/* ---------- the catalog, as the page has it ---------- */
const PAID = JSON.parse(fs.readFileSync(path.join(ROOT, 'lab/paid.json'), 'utf8'));
const FREEJ = JSON.parse(fs.readFileSync(path.join(ROOT, 'lab/models.json'), 'utf8'));
const CATALOG = new Map();
for (const g of PAID.groups) for (const [tier, list] of Object.entries(g.tiers)) list.forEach((m, rank) => CATALOG.set(m.id, { ...m, group: g.id, tier, rank }));
for (const m of FREEJ.models) if (!m.paid && freeRunnable(m)) CATALOG.set(m.name, { id: m.name, name: m.name.replace(/^@cf\//, ''), free: true, how: m.how, reasoning: m.reasoning, out: FREE_OUT[m.how], tier: 'free', group: FREE_OUT[m.how] });

/* ---------- the lab's API ---------- */
async function post(route, body) {
  if (!KEY) die(`no passcode: set LAB_PASSCODE in this environment (the lab's own passcode; it is never pasted into a chat), or use --local`);
  const r = await fetch(`${LAB}/api/${route}`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-lab-key': KEY }, body: JSON.stringify(body) }).catch(e => ({ ok: false, status: 0, json: async () => ({ error: String(e.message) }) }));
  if (r.status === 401 || r.status === 423) die(`the lab refused the passcode (${r.status})`);
  return r.json().catch(() => ({ error: 'bad answer ' + r.status }));
}
const mimeOf = (p, fallback) => ({ png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp', gif: 'image/gif', mp4: 'video/mp4', webm: 'video/webm', mov: 'video/quicktime', mp3: 'audio/mpeg', wav: 'audio/wav', ogg: 'audio/ogg', m4a: 'audio/mp4', flac: 'audio/flac' })[String(p).split('?')[0].split('.').pop().toLowerCase()] || fallback || 'application/octet-stream';
async function bytes(v) {
  if (v.startsWith('data:')) return { buf: Buffer.from(v.slice(v.indexOf(',') + 1), 'base64'), type: v.slice(5, v.indexOf(';')) };
  if (/^https?:\/\//.test(v)) { const r = await fetch(v); if (!r.ok) throw new Error(`download ${r.status}: ${v}`); return { buf: Buffer.from(await r.arrayBuffer()), type: (r.headers.get('content-type') || mimeOf(v)).split(';')[0] }; }
  return { buf: fs.readFileSync(v), type: mimeOf(v) };
}
const dataURI = async v => { const b = await bytes(v); return `data:${b.type};base64,${b.buf.toString('base64')}`; };

/* ---------- the composer: ffmpeg, the same node the page records in the browser ---------- */
const SIZE = { '9:16': [1080, 1920], '16:9': [1920, 1080], '1:1': [1080, 1080], '4:5': [1080, 1350] };
const durationOf = f => { try { execFileSync('ffmpeg', ['-hide_banner', '-i', f], { stdio: 'pipe' }); } catch (e) { const m = String(e.stderr).match(/Duration: (\d+):(\d+):([\d.]+)/); if (m) return +m[1] * 3600 + +m[2] * 60 + +m[3]; } return 0; };
async function composeFF({ visuals = [], voice, music }, d = {}, on = () => {}) {
  if (!visuals.length) throw new Error('nothing to compose');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'unified-')), [W, H] = SIZE[d.aspect] || SIZE['9:16'];
  const save = async (it, name) => { const b = await bytes(it.value), f = path.join(dir, name + '.' + (b.type.split('/')[1] || 'bin').replace('mpeg', 'mp3').replace('quicktime', 'mov')); fs.writeFileSync(f, b.buf); return f; };
  on({ progress: 'downloading' });
  const vis = []; for (const [i, it] of visuals.entries()) { const f = await save(it, 'v' + i); vis.push({ f, kind: it.kind, dur: it.kind === 'video' ? Math.min(durationOf(f) || 4, d.maxVideoSeconds || 60) : +d.imageSeconds || 3 }); }
  const vo = voice ? await save(voice, 'voice') : null, mu = music ? await save(music, 'music') : null, voDur = vo ? durationOf(vo) : 0;
  let total = vis.reduce((a, v) => a + v.dur, 0);
  if (vo && voDur + 0.6 > total) { const imgs = vis.filter(v => v.kind === 'image'); if (imgs.length) imgs.forEach(v => { v.dur += (voDur + 0.6 - total) / imgs.length; }); else vis[vis.length - 1].hold = voDur + 0.6 - total; total = voDur + 0.6; }
  const args = ['-hide_banner', '-loglevel', 'error', '-y'], fil = [];
  vis.forEach(v => { if (v.kind === 'image') args.push('-loop', '1', '-t', String(v.dur), '-i', v.f); else args.push('-t', String(v.dur), '-i', v.f); });
  vis.forEach((v, i) => fil.push(`[${i}:v]scale=${W}:${H}:force_original_aspect_ratio=increase,crop=${W}:${H},setsar=1,fps=30,format=yuv420p${v.hold ? `,tpad=stop_mode=clone:stop_duration=${v.hold.toFixed(2)}` : ''}${v.kind === 'image' ? `,zoompan=z='min(zoom+0.0006,1.06)':d=1:s=${W}x${H}:fps=30` : ''}[v${i}]`));
  fil.push(`${vis.map((_, i) => `[v${i}]`).join('')}concat=n=${vis.length}:v=1:a=0,fade=t=out:st=${Math.max(0, total - 0.5).toFixed(2)}:d=0.5[vout]`);
  let n = vis.length; const mix = [];
  if (vo) { args.push('-i', vo); fil.push(`[${n}:a]adelay=300|300,aresample=48000[a${n}]`); mix.push(`[a${n}]`); n++; }
  if (mu) { args.push('-stream_loop', '-1', '-i', mu); fil.push(`[${n}:a]volume=${d.musicVolume ?? (vo ? 0.22 : 0.8)},aresample=48000,afade=t=out:st=${Math.max(0, total - 1.2).toFixed(2)}:d=1.2[a${n}]`); mix.push(`[a${n}]`); n++; }
  if (mix.length) fil.push(`${mix.join('')}amix=inputs=${mix.length}:normalize=0:duration=longest[aout]`);
  const out = path.join(dir, 'film.mp4');
  args.push('-filter_complex', fil.join(';'), '-map', '[vout]', ...(mix.length ? ['-map', '[aout]', '-c:a', 'aac', '-b:a', '192k'] : []), '-t', total.toFixed(2), '-c:v', 'libx264', '-preset', 'medium', '-crf', '19', '-movflags', '+faststart', out);
  on({ progress: 'ffmpeg' }); execFileSync('ffmpeg', args, { stdio: 'pipe' });
  return { kind: 'video', value: out, local: true, path: out, seconds: +total.toFixed(1), size: fs.statSync(out).size };
}

const engine = createEngine({
  catalog: { get: id => CATALOG.get(id) },
  schemaOf: async m => JSON.parse(fs.readFileSync(path.join(ROOT, 'lab/schemas', m.slug + '.json'), 'utf8')),
  call: (model, input, o) => post('run', { model, input, kind: o.kind || '', route: o.route, ...(o.hint ? { hint: o.hint } : {}) }),
  compose: composeFF, toDataURI: dataURI, toBase64: async v => (await bytes(v)).buf.toString('base64'),
});

/* ---------- flows: a template, a file, or a saved id ---------- */
async function resolve(r) {
  if (!r) die('which flow? a template id, a saved flow id, or a .json file');
  let f;
  if (fs.existsSync(r)) f = JSON.parse(fs.readFileSync(r, 'utf8'));
  else if (TEMPLATES.find(t => t.id === r)) f = JSON.parse(JSON.stringify(TEMPLATES.find(t => t.id === r)));
  else { const g = await post('flows', { op: 'get', id: r }); if (!g.flow) die(`no flow "${r}" (${g.error || 'not found'})`); f = g.flow; }
  for (const s of sets) {
    const m = String(s).match(/^([\w-]+)\.([\w-]+)=([\s\S]*)$/); if (!m) die(`--set ${s}: write node.key=value`);
    const n = f.nodes.find(x => x.id === m[1]); if (!n) die(`--set: no node "${m[1]}" (nodes: ${f.nodes.map(x => x.id).join(', ')})`);
    let v = m[3]; try { if (/^[[{"]|^-?\d+(\.\d+)?$|^(true|false|null)$/.test(v)) v = JSON.parse(v); } catch {}
    n.data = n.data || {};
    if (n.type === 'input.text' && m[2] === 'text') n.data.text = String(v);
    else if (n.type === 'input.media' && m[2] === 'url') n.data.urls = [/^(https?:|data:)/.test(v) ? v : await dataURI(path.resolve(String(v)))];
    else if (n.type === 'model' && !['model', 'expectSeconds', 'system', 'max', 'width', 'height', 'title'].includes(m[2])) n.data.input = { ...(n.data.input || {}), [m[2]]: v };
    else n.data[m[2]] = v;
  }
  if (f.nodes.some(n => n.x == null)) { layout(f); const max = Math.max(...f.nodes.map(n => n.x)); f.nodes.forEach(n => { n.x = max - n.x + 40; }); }
  return f;
}
const nameOf = (f, id) => { const n = f.nodes.find(x => x.id === id); return n ? n.title || (n.type === 'model' ? (CATALOG.get(n.data.model) || {}).name || n.data.model : n.type) : id; };
async function plan(f) {
  const c = await engine.check(f);
  if (!c.ok) { console.log('  problems:'); c.errors.forEach(e => console.log(`   - ${e.node ? nameOf(f, e.node) + ': ' : ''}${e.msg}`)); return null; }
  const e = await engine.estimate(f);
  console.log(`  ${f.name || f.id} · ${f.nodes.length} nodes · ${f.edges.length} wires`);
  for (const id of c.order) { const n = f.nodes.find(x => x.id === id), p = e.per[id]; console.log(`   ${id.padEnd(12)} ${(n.type === 'model' ? (CATALOG.get(n.data.model) || {}).id || '?' : n.type).padEnd(42)} ${p ? (p.kind === 'free' ? 'free' : p.kind === 'pinned' ? 'pinned' : (p.kind === 'upTo' ? '≤' : '≈') + usd(p.usd)) + (p.runs > 1 ? ` (${p.runs}×)` : '') : ''}`); }
  console.log(`  total ${e.upTo ? '≤' : '≈'}${usd(e.total)}${e.unknown ? ` + ${e.unknown} nodes without a price` : ''}`);
  return e;
}

/* ---------- commands ---------- */
if (cmd === 'templates') { for (const t of TEMPLATES) { const e = await engine.estimate(t); console.log(`  ${t.id.padEnd(24)} ${usd(e.total).padStart(8)}  ${t.name} · ${t.about}`); } }
else if (cmd === 'flows') { const r = await post('flows', { op: 'list' }); if (r.kv === false) die(r.hint); for (const x of r.flows) console.log(`  ${x.id.padEnd(22)} ${String(x.updated || '').slice(0, 16)}  ${x.by === 'agent' ? '[Claude] ' : ''}${x.name} (${x.nodes})`); }
else if (cmd === 'runs') { const r = await post('flows', { op: 'runs', flow: flag('--flow'), limit: +flag('--limit') || 30 }); for (const x of r.runs || []) console.log(`  ${new Date(x.at).toISOString().slice(0, 16)}  ${usd(x.usd).padStart(8)}  ${x.status.padEnd(8)} ${x.by === 'agent' ? '[Claude] ' : ''}${x.name}  ${x.key}`); }
else if (cmd === 'get') { const r = await post('flows', { op: 'get', id: ref }); if (!r.flow) die(r.error); const s = JSON.stringify(r.flow, null, 1); if (flag('--out')) { fs.writeFileSync(flag('--out'), s); console.log('  → ' + flag('--out')); } else console.log(s); }
else if (cmd === 'save') {
  const f = await resolve(ref); delete f.template; if (flag('--id')) f.id = flag('--id'); else if (TEMPLATES.find(t => t.id === f.id)) f.id = f.id + '-' + Date.now().toString(36);
  if (flag('--name')) f.name = flag('--name');
  const r = await post('flows', { op: 'save', flow: f, by: 'agent' }); if (!r.ok) die(r.hint || r.error);
  console.log(`  saved "${f.name}" as ${r.id} · open it in the lab: ${LAB}/#unified → זרימות וריצות`);
}
else if (cmd === 'check' || cmd === 'estimate') { const f = await resolve(ref); if (!(await plan(f))) process.exit(1); }
else if (cmd === 'run') {
  const f = await resolve(ref), e = await plan(f); if (!e) process.exit(1);
  if ((e.total > 0 || e.unknown) && !has('--yes')) { console.log('  a paid run: add --yes to run it (the run stops at --max-usd, default 1.5 × the estimate)'); process.exit(2); }
  const cap = flag('--max-usd') != null ? +flag('--max-usd') : e.total ? Math.max(0.5, +(e.total * 1.5).toFixed(2)) : null;
  console.log(`  running · cap ${cap == null ? 'none' : usd(cap)}`);
  const t0 = Date.now();
  const r = await engine.run(f, { maxUsd: cap, on: ev => { if (ev.type !== 'node') return; const n = nameOf(f, ev.id);
    if (ev.status === 'running') { if (!ev.progress) console.log(`   … ${n}`); }
    else if (ev.status === 'done') console.log(`   ✓ ${n}: ${(ev.items || []).length} ${ev.reused ? '(reused)' : ''} ${ev.cost ? usd(ev.cost) : ''} ${ev.ms ? (ev.ms / 1000).toFixed(1) + 's' : ''}`);
    else console.log(`   ✗ ${n}: ${ev.error}${ev.hint ? ' · ' + ev.hint : ''}`); } });
  console.log(`  ${r.stopped ? 'stopped: ' + r.stopped : r.errors.length ? 'finished with errors' : 'done'} · spent ${usd(r.spent)} · ${((Date.now() - t0) / 1000).toFixed(0)}s`);
  // the outputs, downloaded next to each other (projects/*/out is never committed)
  const dir = flag('--out') || path.join(ROOT, 'projects/_unified/out', `${f.id}-${new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)}`);
  fs.mkdirSync(dir, { recursive: true });
  for (const [i, it] of r.outputs.entries()) {
    const base = path.join(dir, `${String(i + 1).padStart(2, '0')}-${it.kind}`);
    if (it.kind === 'text') fs.writeFileSync(base + '.txt', String(it.value));
    else if (it.local) fs.copyFileSync(it.path, base + path.extname(it.path));
    else { try { const b = await bytes(it.value); fs.writeFileSync(base + '.' + (b.type.split('/')[1] || 'bin').replace('mpeg', 'mp3'), b.buf); } catch (er) { fs.writeFileSync(base + '.url', it.value); } }
  }
  fs.writeFileSync(path.join(dir, 'run.json'), JSON.stringify({ flow: f, results: slim(r.results), spent: r.spent, stopped: r.stopped, errors: r.errors }, null, 1));
  console.log(`  outputs → ${path.relative(ROOT, dir)} (${r.outputs.length})`);
  if (!has('--no-record')) { const rec = await post('flows', { op: 'record', run: { flow: f, results: slim(r.results), spent: r.spent, stopped: r.stopped, errors: r.errors, outputs: r.outputs.map(o => o.local ? { kind: o.kind, value: `[file] ${path.relative(ROOT, dir)}` } : o), by: 'agent' } }); console.log(rec.ok ? '  recorded in the lab (היסטוריית ריצות)' : '  not recorded: ' + (rec.hint || rec.error)); }
  process.exit(r.errors.length || r.stopped ? 3 : 0);
}
else if (cmd === 'call') {
  const m = CATALOG.get(ref); if (!m) die(`no model "${ref}" (node cloud/lab/unified.mjs models --q ...)`);
  let input; try { input = JSON.parse(extra || '{}'); } catch (er) { die('input is not JSON: ' + er.message); }
  const e = m.free ? { usd: 0, kind: 'free' } : priceOf(m, input);
  console.log(`  ${m.id} · ${m.free ? 'free' : label(e)}`);
  if (!m.free && !has('--yes')) { console.log('  a paid call: add --yes'); process.exit(2); }
  const j = await post('run', { model: m.id, input, route: m.free ? 'free' : 'credits' });
  console.log(JSON.stringify({ ok: j.ok, kind: j.kind, text: j.text, image: j.image, video: j.video, audio: typeof j.audio === 'string' ? j.audio.slice(0, 120) : undefined, cost: j.cost, error: j.error, hint: j.hint, why: j.why }, null, 1));
}
else if (cmd === 'models') {
  const q = (flag('--q') || '').toLowerCase(), sector = flag('--sector'), tier = flag('--tier');
  const std = { text: { messages: [{ role: 'user', content: 'x'.repeat(4000) }], max_tokens: 1000 }, image: { prompt: 'x', aspect_ratio: '1:1' }, video: { prompt: 'x', duration: 5, resolution: '720p', generate_audio: false }, voice: { text: 'x'.repeat(1000) }, music: { prompt: 'x', music_length_ms: 60000 } };
  for (const m of CATALOG.values()) {
    if ((sector && m.group !== sector) || (tier && m.tier !== tier) || (q && !(m.id + ' ' + m.name + ' ' + (m.note || '')).toLowerCase().includes(q))) continue;
    const e = m.free ? null : priceOf(m, std[m.group] || {}, { seconds: 60 });
    console.log(`  ${m.id.padEnd(44)} ${String(m.tier).padEnd(4)} ${(KIND_NAME[m.out] || m.out || '').padEnd(6)} ${m.free ? 'free' : label(e)}  ${m.note || ''}`);
  }
}
else if (cmd === 'budget') { const r = await post('budget', flag('--set') != null ? { set: +flag('--set') } : {}); console.log(r.ledger ? `  spent ${usd(r.spent)} of ${usd(r.budget)} · left ${usd(r.left)} · ${r.calls} paid calls` : '  the ledger is not bound: no running total'); for (const m of (r.byModel || []).slice(0, 12)) console.log(`   ${m.model.padEnd(44)} ${usd(m.usd).padStart(8)} · ${m.calls}`); }
else { console.log(fs.readFileSync(fileURLToPath(import.meta.url), 'utf8').split('\n').slice(1, 22).map(l => l.replace(/^\/\/ ?/, '')).join('\n')); process.exit(cmd ? 1 : 0); }
