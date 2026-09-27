#!/usr/bin/env node
// Meter a studio run: wall time, model time, tool time, tokens and cost per phase, read from the
// Claude Code session transcript (every API call logs its `usage`) and the project's phase marks.
//
//   node meter.mjs --marks projects/<slug>/meter.jsonl [--transcript file.jsonl] [--json out.json] [--md out.md]
//   node meter.mjs --mark projects/<slug>/meter.jsonl --phase 3-site --ev start [--note "..."]
//   node meter.mjs --all                      # the whole session, split by day
//
// Marks file: one JSON per line {t, phase, ev: "start"|"end", note}. A phase runs from its start to its
// end (or to the next start). Prices: $ per million tokens, from the claude-api skill (models table
// cached 2026-06-24; cache writes 1.25x input for 5 min, 2x for 1 h). Confirm on the pricing page
// before quoting to a client.
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { parseArgs } from './lib.mjs';

const PRICES = {
  'claude-opus-5-5':  { in: 4,  out: 20, read: 0.20 },
  'claude-opus-5':    { in: 5,  out: 25, read: 0.50 },
  'claude-fable-5-1': { in: 10, out: 50, read: 0.25 },
  'claude-sonnet-5':  { in: 2,  out: 10, read: 0.20 },
  'claude-haiku-4-5': { in: 1,  out: 5,  read: 0.10 },
};
const price = (model = '') => {
  const k = Object.keys(PRICES).sort((a, b) => b.length - a.length).find(k => model.startsWith(k));
  return PRICES[k] || PRICES['claude-opus-5-5'];
};

const a = parseArgs(process.argv.slice(2));

if (a.mark) {                                   // append a mark and exit
  const rec = { t: new Date().toISOString(), phase: a.phase || '?', ev: a.ev || 'start' };
  if (a.note) rec.note = a.note;
  fs.appendFileSync(a.mark, JSON.stringify(rec) + '\n');
  console.log(JSON.stringify(rec));
  process.exit(0);
}

function newestTranscript() {
  const dir = path.join(os.homedir(), '.claude', 'projects', process.cwd().replace(/[^A-Za-z0-9]/g, '-'));
  const files = fs.existsSync(dir) ? fs.readdirSync(dir).filter(f => f.endsWith('.jsonl')) : [];
  if (!files.length) throw new Error('no transcript in ' + dir + ' (pass --transcript)');
  return path.join(dir, files.map(f => [f, fs.statSync(path.join(dir, f)).mtimeMs]).sort((x, y) => y[1] - x[1])[0][0]);
}
const file = a.transcript || newestTranscript();

// ---- read the transcript: one row per API call (dedupe streamed lines by message id) ----
const calls = new Map(), events = [];
for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
  if (!line) continue;
  let d; try { d = JSON.parse(line); } catch { continue; }
  const t = Date.parse(d.timestamp || '');
  if (!t) continue;
  const m = d.message;
  if (d.type === 'assistant' && m && m.usage) {
    const id = m.id || d.uuid;
    let c = calls.get(id);
    if (!c) { c = { t, model: m.model, u: m.usage, tools: [] }; calls.set(id, c); }
    c.tEnd = t;
    for (const b of m.content || []) if (b.type === 'tool_use') c.tools.push(b.name);
    events.push({ t, kind: 'assistant', id });
  } else if (d.type === 'user' && m) {
    const content = Array.isArray(m.content) ? m.content : [];
    const isTool = content.some(b => b.type === 'tool_result');
    events.push({ t, kind: isTool ? 'tool_result' : 'human' });
  }
}
events.sort((x, y) => x.t - y.t);

// time attribution: gap before an assistant line = model time; before a tool result = tool time;
// before a human message = waiting for the person (not counted as work)
const spans = [];
for (let i = 1; i < events.length; i++) {
  const gap = events[i].t - events[i - 1].t;
  const kind = events[i].kind === 'assistant' ? 'model' : events[i].kind === 'tool_result' ? 'tool' : 'wait';
  spans.push({ t: events[i].t, kind, ms: gap });
}

function sum(from, to) {
  const r = { calls: 0, input: 0, write5m: 0, write1h: 0, read: 0, output: 0, thinking: 0, cost: 0,
    modelMs: 0, toolMs: 0, waitMs: 0, tools: {}, maxContext: 0 };
  for (const c of calls.values()) {
    if (c.t < from || c.t >= to) continue;
    const u = c.u, p = price(c.model);
    const w1h = u.cache_creation?.ephemeral_1h_input_tokens ?? 0;
    const w5m = u.cache_creation?.ephemeral_5m_input_tokens ?? Math.max(0, (u.cache_creation_input_tokens || 0) - w1h);
    r.calls++; r.input += u.input_tokens || 0; r.write5m += w5m; r.write1h += w1h;
    r.read += u.cache_read_input_tokens || 0; r.output += u.output_tokens || 0;
    r.thinking += u.output_tokens_details?.thinking_tokens || 0;
    r.maxContext = Math.max(r.maxContext, (u.input_tokens || 0) + (u.cache_creation_input_tokens || 0) + (u.cache_read_input_tokens || 0));
    r.cost += ((u.input_tokens || 0) * p.in + w5m * p.in * 1.25 + w1h * p.in * 2 +
      (u.cache_read_input_tokens || 0) * p.read + (u.output_tokens || 0) * p.out) / 1e6;
    for (const n of c.tools) r.tools[n] = (r.tools[n] || 0) + 1;
  }
  for (const s of spans) {
    if (s.t < from || s.t >= to) continue;
    const ms = Math.min(s.ms, s.t - from); // only the part of the gap inside this window
    // a gap longer than 30 min inside a phase is someone away, not work
    if (s.kind === 'wait' || ms > 30 * 60e3) r.waitMs += ms;
    else if (s.kind === 'model') r.modelMs += ms; else r.toolMs += ms;
  }
  r.wallMs = to - from;
  r.avgContext = r.calls ? Math.round((r.input + r.write5m + r.write1h + r.read) / r.calls) : 0;
  return r;
}

// ---- windows ----
let windows = [];
if (a.all) {
  const byDay = {};
  for (const c of calls.values()) { const d = new Date(c.t).toISOString().slice(0, 10); (byDay[d] ||= []).push(c.t); }
  windows = Object.entries(byDay).sort().map(([d, ts]) => ({ phase: d, from: Math.min(...ts), to: Math.max(...ts) + 1 }));
} else {
  if (!a.marks) throw new Error('--marks <meter.jsonl> or --all');
  const marks = fs.readFileSync(a.marks, 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l))
    .map(m => ({ ...m, ts: Date.parse(m.t) })).sort((x, y) => x.ts - y.ts);
  const starts = marks.filter(m => m.ev === 'start');
  for (let i = 0; i < starts.length; i++) {
    const s = starts[i];
    const end = marks.find(m => m.ev === 'end' && m.phase === s.phase && m.ts >= s.ts);
    const next = starts[i + 1];
    const to = end ? end.ts : next ? next.ts : Date.now();
    windows.push({ phase: s.phase, note: s.note, from: s.ts, to });
  }
}
if (a.from) windows = windows.filter(w => w.from >= Date.parse(a.from));

const rows = windows.map(w => ({ ...w, ...sum(w.from, w.to) }));
const total = rows.reduce((t, r) => {
  for (const k of ['calls', 'input', 'write5m', 'write1h', 'read', 'output', 'thinking', 'cost', 'modelMs', 'toolMs', 'waitMs', 'wallMs'])
    t[k] = (t[k] || 0) + r[k];
  t.maxContext = Math.max(t.maxContext || 0, r.maxContext);
  return t;
}, { phase: 'TOTAL' });

// ---- output ----
const min = ms => (ms / 60e3).toFixed(1);
const k = n => n >= 1e6 ? (n / 1e6).toFixed(2) + 'M' : n >= 1e3 ? (n / 1e3).toFixed(0) + 'K' : String(n);
const head = ['phase', 'wall min', 'model min', 'tool min', 'wait min', 'calls', 'avg ctx', 'max ctx', 'cache read', 'cache write', 'output', 'cost $'];
const line = r => [r.phase, min(r.wallMs), min(r.modelMs), min(r.toolMs), min(r.waitMs), r.calls,
  k(r.avgContext || (r.calls ? Math.round((r.input + r.write5m + r.write1h + r.read) / r.calls) : 0)), k(r.maxContext),
  k(r.read), k(r.write5m + r.write1h), k(r.output), r.cost.toFixed(2)];
const md = ['| ' + head.join(' | ') + ' |', '|' + head.map(() => '---').join('|') + '|',
  ...rows.map(r => '| ' + line(r).join(' | ') + ' |'), '| ' + line(total).map((v, i) => i ? `**${v}**` : '**סה״כ**').join(' | ') + ' |'].join('\n');
console.log(md);
const topTools = {};
rows.forEach(r => Object.entries(r.tools).forEach(([n, c]) => topTools[n] = (topTools[n] || 0) + c));
console.log('\ntools:', Object.entries(topTools).sort((x, y) => y[1] - x[1]).map(([n, c]) => `${n} ${c}`).join(', '));
console.log('transcript:', file);
if (a.json) fs.writeFileSync(a.json, JSON.stringify({ transcript: path.basename(file), prices: PRICES, rows, total, tools: topTools }, null, 2));
if (a.md) fs.writeFileSync(a.md, md + '\n');
