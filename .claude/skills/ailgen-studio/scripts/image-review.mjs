#!/usr/bin/env node
// The visual system, step 2: check, review, approve and publish generated candidates (imagegen.mjs, videogen.mjs).
//   node image-review.mjs --project projects/<slug> --check              automatic checks on every candidate (writes into its sidecar)
//   node image-review.mjs --project projects/<slug> --sheet              one contact sheet per concept for the vision review (visual/review/)
//   node image-review.mjs --project projects/<slug> --frames <video.mp4>     six frames of a generated video, for its review
//   node image-review.mjs --project projects/<slug> --verdict <file> approve|reject --why "..." [--by claude|owner] [--pick]
//   node image-review.mjs --project projects/<slug> --publish --site <folder>   approved picks → web sizes + <site>/img/v/manifest.json
// Automatic checks (a candidate that fails one is never shown for approval): the aspect ratio asked for (±2%), a real image
// (not blank or flat), brand palette distance (mean ΔE of its dominant colours to the concept palette), no near-black or
// neon clipping, and never a stub. The vision review then answers the rubric in references/12-visual-production.md
// (relevance, taste, no product / logo / text / face / result, fits the page). The owner has the last word: --by owner.
import { fileURLToPath } from 'url';
import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';
import { parseArgs, repoRoot } from './lib.mjs';
const a = parseArgs(), ROOT = repoRoot();
if (!a.project) { console.error('usage: node image-review.mjs --project projects/<slug> (--check | --sheet | --verdict <file> approve|reject --why ".." | --publish --site <folder>)'); process.exit(2); }
const PROJ = path.resolve(ROOT, a.project), VIS = path.join(PROJ, 'visual'), CFG = JSON.parse(fs.readFileSync(path.join(VIS, 'concepts.json'), 'utf8'));
const walk = d => fs.existsSync(d) ? fs.readdirSync(d, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]) : [];
const cands = (withVideo) => walk(path.join(VIS, 'candidates')).filter(f => (withVideo ? /\.(png|jpe?g|mp4)$/ : /\.(png|jpe?g)$/).test(f)).map(f => ({ file: f, meta: JSON.parse(fs.readFileSync(f.replace(/\.\w+$/, '.json'), 'utf8')) }));
const save = (c) => fs.writeFileSync(c.file.replace(/\.\w+$/, '.json'), JSON.stringify(c.meta, null, 1));
const py = (code, args) => { const r = spawnSync((process.env.PYTHON || (process.platform === 'win32' ? 'python' : 'python3')), ['-c', code, ...args], { encoding: 'utf8' }); if (r.status) throw new Error(r.stderr.slice(-400)); return r.stdout; };

const CHECK = `
import sys, json, numpy as np
from PIL import Image
f, ratio, pal = sys.argv[1], sys.argv[2], json.loads(sys.argv[3])
im = Image.open(f).convert('RGB'); w, h = im.size
rw, rh = map(float, ratio.split(':')); ar = (w / h) / (rw / rh)
a = np.asarray(im.resize((160, int(160 * h / w)))).reshape(-1, 3).astype(float) / 255
def lab(c):
    c = np.where(c > .04045, ((c + .055) / 1.055) ** 2.4, c / 12.92)
    xyz = c @ np.array([[.4124, .3576, .1805], [.2126, .7152, .0722], [.0193, .1192, .9505]]).T / np.array([.95047, 1, 1.08883])
    f = np.where(xyz > .008856, np.cbrt(xyz), 7.787 * xyz + 16 / 116)
    return np.stack([116 * f[:, 1] - 16, 500 * (f[:, 0] - f[:, 1]), 200 * (f[:, 1] - f[:, 2])], 1)
L = lab(a); P = lab(np.array([[int(p[i:i+2], 16) / 255 for i in (1, 3, 5)] for p in pal]))
d = np.sqrt(((L[:, None] - P[None]) ** 2).sum(2)).min(1)
sat = (a.max(1) - a.min(1))
print(json.dumps({'w': w, 'h': h, 'ratioOk': bool(abs(ar - 1) < .02), 'std': round(float(a.std()), 3), 'deltaE': round(float(np.median(d)), 1), 'neon': round(float((sat > .85).mean()), 3), 'black': round(float((a.max(1) < .06).mean()), 3)}))
`;
function checks(c) {
  const conceptPal = Object.values(CFG.palette);
  const brandLook = c.meta.brand ? (JSON.parse(fs.readFileSync(path.join(PROJ, 'brands.json'), 'utf8')).brands.find(b => b.key === c.meta.brand) || {}).look : null;
  const pal = brandLook ? [brandLook.field, brandLook.accent, brandLook.soft, brandLook.ink] : conceptPal;
  const m = JSON.parse(py(CHECK, [c.file, c.meta.ratio, JSON.stringify(pal)]));
  const fails = [];
  if (!m.ratioOk) fails.push('aspect ratio is not ' + c.meta.ratio);
  if (m.std < 0.03) fails.push('blank or flat image');
  if (m.deltaE > 28) fails.push(`off-palette (median ΔE ${m.deltaE})`);
  if (m.neon > 0.05) fails.push('neon clipping');
  if (m.black > 0.25 && !brandLook) fails.push('too dark for the house style');
  if (c.meta.provider === 'stub') fails.push('stub (code-drawn test plate)');
  return { ...m, pass: !fails.length, fails };
}

if (a.check) {
  let n = 0, pass = 0;
  for (const c of cands()) { c.meta.checks = checks(c); save(c); n++; if (c.meta.checks.pass) pass++; console.log(`${c.meta.checks.pass ? '✓' : '✗'} ${path.relative(ROOT, c.file)}  ΔE ${c.meta.checks.deltaE}${c.meta.checks.fails.length ? '  · ' + c.meta.checks.fails.join(', ') : ''}`); }
  console.log(`${pass} of ${n} candidates pass the automatic checks`);
}

if (a.sheet) {
  const out = path.join(VIS, 'review'); fs.mkdirSync(out, { recursive: true });
  const by = {}; for (const c of cands()) (by[c.meta.concept + (c.meta.brand ? '-' + c.meta.brand : '')] ||= []).push(c);
  for (const [k, list] of Object.entries(by)) {
    const files = list.map(c => c.file), labels = list.map(c => `${c.meta.ratio} ${String(c.meta.model || '').replace(/^.*\//, '').slice(0, 22)} ${path.basename(c.file).slice(-6)} ${c.meta.checks ? (c.meta.checks.pass ? 'ok' : 'FAIL') : ''}`);
    py(`
import sys, json
from PIL import Image, ImageDraw
files, labels, out = json.loads(sys.argv[1]), json.loads(sys.argv[2]), sys.argv[3]
T = 420; cols = min(4, len(files)); rows = (len(files) + cols - 1) // cols
sheet = Image.new('RGB', (cols * (T + 10) + 10, rows * (T + 40) + 10), '#EDE6E1'); d = ImageDraw.Draw(sheet)
for i, (f, l) in enumerate(zip(files, labels)):
    im = Image.open(f).convert('RGB'); im.thumbnail((T, T)); x = 10 + (i % cols) * (T + 10); y = 10 + (i // cols) * (T + 40)
    sheet.paste(im, (x, y)); d.text((x, y + T + 8), l, fill='#241A18')
sheet.save(out, quality=86)`, [JSON.stringify(files), JSON.stringify(labels), path.join(out, k + '.jpg')]);
    console.log('sheet', path.relative(ROOT, path.join(out, k + '.jpg')), `(${list.length})`);
  }
}

if (a.frames) {
  // a video's review sheet: six frames across its length
  const f = path.resolve(ROOT, a.frames), out = path.join(VIS, 'review'); fs.mkdirSync(out, { recursive: true });
  const dur = +spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', f], { encoding: 'utf8' }).stdout.trim() || 8;
  const sheet = path.join(out, path.basename(f).replace(/\.mp4$/, '-frames.jpg'));
  spawnSync('ffmpeg', ['-y', '-v', 'error', '-i', f, '-vf', `fps=${(6 / dur).toFixed(3)},scale=420:-2,tile=3x2:padding=8:color=0xEDE6E1`, '-frames:v', '1', sheet]);
  console.log('frames', path.relative(ROOT, sheet), `(${dur.toFixed(1)} s)`);
}

if (a.verdict) {
  const file = path.resolve(ROOT, a.verdict), v = a._[0];
  if (!['approve', 'reject'].includes(v)) { console.error('verdict is approve or reject'); process.exit(2); }
  const c = cands(true).find(x => x.file === file); if (!c) { console.error('not a candidate: ' + a.verdict); process.exit(2); }
  if (v === 'approve' && !/\.mp4$/.test(file)) { c.meta.checks = c.meta.checks || checks(c); if (!c.meta.checks.pass && !a.override) { console.error('cannot approve: fails ' + c.meta.checks.fails.join(', ')); process.exit(5); } }
  c.meta.review = { verdict: v, why: a.why || '', by: a.by || 'claude', at: new Date().toISOString() };
  c.meta.status = v === 'approve' ? 'approved' : 'rejected'; if (a.pick) c.meta.pick = true; save(c);
  console.log(`${v}d ${path.relative(ROOT, file)}${a.pick ? ' (picked for the site)' : ''}`);
}

if (a.publish) {
  if (!a.site) { console.error('--publish needs --site <folder>'); process.exit(2); }
  const SITE = path.resolve(ROOT, a.site), OUT = path.join(SITE, 'img/v'); fs.mkdirSync(OUT, { recursive: true });
  const manFile = path.join(OUT, 'manifest.json'), man = fs.existsSync(manFile) ? JSON.parse(fs.readFileSync(manFile, 'utf8')) : { images: {}, videos: {} };
  const picks = cands().filter(c => c.meta.status === 'approved' && c.meta.pick).filter(c => {
    // an approval never overrides the automatic checks: a stub or a failed check is not published (--allow-test for pipeline tests only)
    const ok = c.meta.provider !== 'stub' && (!c.meta.checks || c.meta.checks.pass);
    if (!ok && !a['allow-test']) console.log('  skipped (stub or failed checks):', path.relative(ROOT, c.file));
    return ok || a['allow-test'];
  });
  for (const c of picks) {
    const key = c.meta.concept + (c.meta.brand ? '-' + c.meta.brand : ''), r = c.meta.ratio.replace(':', 'x'), concept = CFG.concepts.find(x => x.id === c.meta.concept);
    // the brand grade (scripts/grade.py): a gentle pull toward the concept palette, measured; plates only, never product pixels
    let srcFile = c.file, grade = null;
    if (CFG.grade && CFG.grade.strength > 0 && CFG.palette) {
      const g = path.join(VIS, '.graded', path.basename(c.file).replace(/\.\w+$/, '.png')); fs.mkdirSync(path.dirname(g), { recursive: true });
      const pal = [...new Set([...(concept && concept.palette ? concept.palette : []), ...Object.values(CFG.palette)])].join(',');
      const out = spawnSync((process.env.PYTHON || (process.platform === 'win32' ? 'python' : 'python3')), [path.join(path.dirname(fileURLToPath(import.meta.url)), 'grade.py'), '--in', c.file, '--out', g, '--palette', pal, '--strength', String(CFG.grade.strength)], { encoding: 'utf8' });
      if (out.status) { console.error('grade failed:', out.stderr.slice(-300)); process.exit(1); }
      grade = JSON.parse(out.stdout.trim().split('\n').pop()); srcFile = g; console.log(`  graded ${path.basename(c.file)}: ΔE to palette ${grade.deltaE_before} → ${grade.deltaE_after}`);
    }
    const sizes = JSON.parse(py(`
import sys, json
from PIL import Image
src, out, base = sys.argv[1], sys.argv[2], sys.argv[3]
im = Image.open(src).convert('RGB'); res = []
for w in (640, 1280, 1920):
    if w > im.size[0] and w != 640: continue
    im2 = im.copy(); im2.thumbnail((w, 10000), Image.LANCZOS)
    p = f"{out}/{base}-{w}.webp"; im2.save(p, 'WEBP', quality=82, method=6); res.append({'w': im2.size[0], 'h': im2.size[1], 'src': p})
print(json.dumps(res))`, [srcFile, OUT, `${key}-${r}`]));
    (man.images[key] ||= {})[c.meta.ratio] = { srcset: sizes.map(s => ({ src: 'img/v/' + path.basename(s.src), w: s.w })), w: sizes[sizes.length - 1].w, h: sizes[sizes.length - 1].h,
      label: concept ? concept.label : null, provenance: { provider: c.meta.provider, model: c.meta.model, at: c.meta.at, synthid: !!c.meta.synthid, promptHash: c.meta.promptHash, review: c.meta.review, grade: grade && { strength: grade.strength, deltaE: [grade.deltaE_before, grade.deltaE_after] } } };
    console.log('published', key, c.meta.ratio, sizes.map(s => s.w).join('/'));
  }
  man.updated = new Date().toISOString(); man.disclosure = CFG.disclosure || null;
  fs.writeFileSync(manFile, JSON.stringify(man, null, 1));
  console.log(`manifest: ${Object.keys(man.images).length} image concepts, ${Object.keys(man.videos || {}).length} videos → ${path.relative(ROOT, manFile)}`);
}
