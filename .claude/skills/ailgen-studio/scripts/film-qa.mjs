#!/usr/bin/env node
// Film QA: format, duration, audio present, integrated loudness (target -14 LUFS ±1) and true peak (<= -1 dBTP) for every film of a project.
//   node film-qa.mjs --project projects/<slug> [--files a.mp4,b.mp4] [--target -14] [--tol 1]
//   --fix   when a film is outside the target, re-encode only its audio (two-pass linear loudnorm, video stream copied) and measure again
// Default files: the film-*.mp4 renders in projects/<slug>/out/ . Writes projects/<slug>/qa/film-qa.json ({ok:true} only when every film passes). Needs ffmpeg only.
import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import { parseArgs, repoRoot } from './lib.mjs';
import { loudnormFilter } from '../engine/loudness.mjs';
const a = parseArgs(), ROOT = repoRoot();
if (!a.project) { console.error('usage: node film-qa.mjs --project projects/<slug> [--files ...]'); process.exit(2); }
const P = path.resolve(ROOT, a.project), target = +(a.target ?? -14), tol = +(a.tol ?? 1);
const files = a.files ? String(a.files).split(',').map(f => path.resolve(ROOT, f)) : fs.readdirSync(path.join(P, 'out')).filter(f => /^film-.*\.mp4$/.test(f)).map(f => path.join(P, 'out', f));
const ff = args => new Promise(res => { const c = spawn('ffmpeg', ['-hide_banner', '-nostats', ...args], { stdio: ['ignore', 'ignore', 'pipe'] }); let err = ''; c.stderr.on('data', d => err += d); c.on('close', () => res(err)); });
const measure = async f => {
  const info = await ff(['-i', f]);
  const dur = /Duration: (\d+):(\d+):([\d.]+)/.exec(info), vid = /Video: .*?, (\d{3,4})x(\d{3,4})/.exec(info), fps = /(\d+(?:\.\d+)?) fps/.exec(info);
  const hasAudio = /Audio: /.test(info);
  let lufs = null, tp = null;
  if (hasAudio) {
    const out = await ff(['-i', f, '-af', 'ebur128=peak=true', '-f', 'null', '-']);
    const sum = out.slice(out.lastIndexOf('Summary:'));
    lufs = +(/I:\s+(-?[\d.]+) LUFS/.exec(sum)?.[1] ?? NaN); tp = +(/Peak:\s+(-?[\d.]+) dBFS/.exec(sum)?.[1] ?? NaN);
  }
  const seconds = dur ? +(+dur[1] * 3600 + +dur[2] * 60 + +dur[3]).toFixed(2) : null;
  const row = { file: path.relative(ROOT, f), bytes: fs.statSync(f).size, seconds, width: vid ? +vid[1] : null, height: vid ? +vid[2] : null, fps: fps ? +fps[1] : null, hasAudio, lufs, truePeakDb: tp };
  row.ok = !!(row.hasAudio && row.width && row.seconds > 5 && Math.abs(lufs - target) <= tol && tp <= -1 && row.bytes > 500000);
  return row;
};
const rows = [];
for (const f of files) {
  let row = await measure(f);
  if (!row.ok && a.fix && row.hasAudio) {
    const tmp = f.replace(/\.mp4$/, '.fix.mp4');
    await ff(['-y', '-i', f, '-map', '0:v:0', '-map', '0:a:0', '-c:v', 'copy', '-af', await loudnormFilter(f, target, -1.5), '-c:a', 'aac', '-b:a', '256k', '-ar', '48000', '-movflags', '+faststart', tmp]);
    if (fs.existsSync(tmp) && fs.statSync(tmp).size > 100000) { fs.renameSync(tmp, f); row = await measure(f); row.fixed = true; }
  }
  rows.push(row); console.log((row.ok ? 'OK  ' : 'FAIL'), row.file, `${row.width}x${row.height} ${row.seconds}s ${row.lufs} LUFS TP ${row.truePeakDb} dB${row.fixed ? " (audio re-normalized)" : ""}`);
}
const res = { at: new Date().toISOString(), target, tolerance: tol, ok: rows.length > 0 && rows.every(r => r.ok), films: rows };
fs.mkdirSync(path.join(P, 'qa'), { recursive: true });
fs.writeFileSync(path.join(P, 'qa/film-qa.json'), JSON.stringify(res, null, 1));
console.log(res.ok ? 'film QA: PASS' : 'film QA: FAIL', '→ qa/film-qa.json');
process.exit(res.ok ? 0 : 1);
