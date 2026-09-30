#!/usr/bin/env python3
"""Real product cutouts: the product's own pixels, with only the background made transparent.

    python3 cutout.py --in photo.jpg --out cut.webp [--tol 20] [--feather 1.2] [--q 90] [--manifest cutouts.json] [--id name]

Rule of the visual system (references/12-visual-production.md): product pixels are never generated or repainted.
A cutout only adds an alpha channel. The background is the near-white region connected to the image border (a flood
fill); enclosed white parts of the product stay opaque. The edge gets a short alpha ramp. The script then proves it:
inside the product mask, the decoded output is compared with the source (PSNR). Lossy compression alone keeps it above 32 dB;
a repainted or regenerated product falls far below (typically under 25 dB). Photos that do not sit on a clean light background are reported as unsuitable
and are not cut (they stay as square photos on the site).
"""
import argparse, json, os, sys
import numpy as np
from PIL import Image
from scipy import ndimage

ap = argparse.ArgumentParser()
ap.add_argument('--in', dest='src', required=True); ap.add_argument('--out', required=True)
ap.add_argument('--tol', type=float, default=20); ap.add_argument('--feather', type=float, default=1.2)
ap.add_argument('--q', type=int, default=92); ap.add_argument('--manifest'); ap.add_argument('--id')
ap.add_argument('--max', type=int, default=900, help='longest side of the output')
a = ap.parse_args()

im = Image.open(a.src).convert('RGB')
rgb = np.asarray(im).astype(np.float32)
h, w, _ = rgb.shape
# how far a pixel is from paper white: the darkest channel's distance, plus a little for colour
dist = 255 - rgb.min(axis=2) + 0.35 * (rgb.max(axis=2) - rgb.min(axis=2))
cand = dist < a.tol
lab, n = ndimage.label(cand)
border = set(np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))) - {0}
bg = np.isin(lab, list(border))
obj = ~bg
# drop specks: keep components larger than 0.2% of the frame
ol, on = ndimage.label(obj)
sizes = ndimage.sum(obj, ol, range(1, on + 1)) if on else []
keep = np.zeros_like(obj)
for i, s in enumerate(sizes, 1):
    if s > 0.002 * h * w: keep |= ol == i
obj = ndimage.binary_fill_holes(keep)

report = {'id': a.id or os.path.splitext(os.path.basename(a.src))[0], 'src': a.src, 'out': a.out}
border_bg = bg[0].mean(), bg[-1].mean(), bg[:, 0].mean(), bg[:, -1].mean()
report['borderBackground'] = round(float(min(border_bg)), 3)
report['objectShare'] = round(float(obj.mean()), 3)
if min(border_bg) < 0.6 or obj.mean() < 0.02 or obj.mean() > 0.92:
    report['suitable'] = False
    report['why'] = 'the photo does not sit on a clean light background (or the product fills the frame)'
    print(json.dumps(report, ensure_ascii=False))
    if a.manifest:
        os.makedirs(os.path.dirname(os.path.abspath(a.manifest)), exist_ok=True)
        m = json.load(open(a.manifest)) if os.path.exists(a.manifest) else {'cutouts': {}}
        m['cutouts'][report['id']] = report; json.dump(m, open(a.manifest, 'w'), ensure_ascii=False, indent=1)
    sys.exit(3)

# soft edge: alpha ramps over `feather` px inside the object boundary (alpha only; RGB untouched)
inside = ndimage.distance_transform_edt(obj)
alpha = np.clip((inside - 0.5) / max(a.feather, 0.01), 0, 1)
ys, xs = np.where(obj)
pad = 6
y0, y1, x0, x1 = max(0, ys.min() - pad), min(h, ys.max() + pad + 1), max(0, xs.min() - pad), min(w, xs.max() + pad + 1)
rgba = np.dstack([rgb, alpha * 255]).astype(np.uint8)[y0:y1, x0:x1]
out = Image.fromarray(rgba, 'RGBA')
scale = min(1.0, a.max / max(out.size))
if scale < 1: out = out.resize((round(out.size[0] * scale), round(out.size[1] * scale)), Image.LANCZOS)
os.makedirs(os.path.dirname(os.path.abspath(a.out)), exist_ok=True)
out.save(a.out, 'WEBP', quality=a.q, method=6) if a.out.endswith('.webp') else out.save(a.out)

# integrity: decode the output, compare the product's pixels (fully opaque region) with the source at the same scale
dec = np.asarray(Image.open(a.out).convert('RGBA')).astype(np.float32)
ref = Image.fromarray(np.asarray(im)[y0:y1, x0:x1])
if scale < 1: ref = ref.resize(out.size, Image.LANCZOS)
ref = np.asarray(ref).astype(np.float32)
core = dec[:, :, 3] > 250
mse = float(((dec[:, :, :3][core] - ref[core]) ** 2).mean()) if core.any() else 0.0
psnr = 99.0 if mse == 0 else 10 * np.log10(255 ** 2 / mse)
report.update({'suitable': True, 'size': list(out.size), 'bytes': os.path.getsize(a.out), 'psnr': round(float(psnr), 1), 'pixelsKept': bool(psnr >= 32)})
print(json.dumps(report, ensure_ascii=False))
if a.manifest:
    os.makedirs(os.path.dirname(os.path.abspath(a.manifest)), exist_ok=True)
    m = json.load(open(a.manifest)) if os.path.exists(a.manifest) else {'cutouts': {}}
    m['cutouts'][report['id']] = report; json.dump(m, open(a.manifest, 'w'), ensure_ascii=False, indent=1)
sys.exit(0 if report['pixelsKept'] else 4)
