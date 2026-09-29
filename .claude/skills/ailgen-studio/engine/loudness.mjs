// Two-pass EBU R128 loudness: measure first, then apply the exact linear gain. Single-pass loudnorm (dynamic mode) overshoots on
// short, dynamic tracks (measured on Eden: -12.6 LUFS, -0.8 dBTP against a -14 / -1.5 target); the linear second pass lands within 0.3 LU.
import { spawn } from 'child_process';
const run = (args) => new Promise(res => { const c = spawn('ffmpeg', ['-hide_banner', '-nostats', ...args], { stdio: ['ignore', 'ignore', 'pipe'] }); let err = ''; c.stderr.on('data', d => err += d); c.on('close', () => res(err)); });
export async function loudnormFilter(src, I = -14, TP = -1.5, LRA = 11) {
  const err = await run(['-i', src, '-vn', '-af', `loudnorm=I=${I}:TP=${TP}:LRA=${LRA}:print_format=json`, '-f', 'null', '-']);
  const m = /\{[^{}]*"input_i"[^{}]*\}/s.exec(err);
  if (!m) return `loudnorm=I=${I}:TP=${TP}:LRA=${LRA}`;
  const j = JSON.parse(m[0]);
  return `loudnorm=I=${I}:TP=${TP}:LRA=${LRA}:measured_I=${j.input_i}:measured_TP=${j.input_tp}:measured_LRA=${j.input_lra}:measured_thresh=${j.input_thresh}:offset=${j.target_offset}:linear=true`;
}
