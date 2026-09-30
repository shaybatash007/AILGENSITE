#!/usr/bin/env python3
"""AI matting for product photos the flood fill cannot cut: white on white, glass, products shot in a setting.

    python3 matte.py --in photo.jpg --out img/cut/p/x.webp [--model birefnet-general] [--max 560] [--manifest cutouts.json --id p-x]

Free and open: rembg (MIT) running BiRefNet (MIT) on the CPU; the first run downloads the model (~1 GB, cached in
~/.rembg). Same rule as cutout.py (references/12-visual-production.md): the model decides only the alpha channel. The RGB
pixels are the store photo's own, and the script proves it (PSNR of the opaque core against the source, ≥ 32 dB), so the
product is never repainted. The report goes into the cutouts manifest with method "birefnet"; every AI matte is reviewed
on a light and a dark background before it is used (a stray hand, a box lid or a shadow can survive the matte).
"""
import argparse, json, os, sys
import numpy as np
from PIL import Image

ap = argparse.ArgumentParser()
ap.add_argument('--in', dest='src', required=True); ap.add_argument('--out', required=True)
ap.add_argument('--model', default='birefnet-general'); ap.add_argument('--max', type=int, default=560)
ap.add_argument('--q', type=int, default=90); ap.add_argument('--lossless', action='store_true', help='for saturated packaging that lossy WebP cannot hold above 32 dB'); ap.add_argument('--manifest'); ap.add_argument('--id')
a = ap.parse_args()

from rembg import remove, new_session  # imported late: the model download happens only when it is needed
im = Image.open(a.src).convert('RGB'); rgb = np.asarray(im)
mask = np.asarray(remove(im, session=new_session(a.model), only_mask=True).convert('L')).astype(np.float32) / 255
mask[mask < 0.04] = 0  # speckle below 4% is background
ys, xs = np.where(mask > 0.5)
report = {'id': a.id or os.path.splitext(os.path.basename(a.src))[0], 'src': a.src, 'out': a.out, 'method': a.model.split('-')[0], 'model': a.model}
if not len(ys) or (mask > 0.5).mean() > 0.95:
    report.update({'suitable': False, 'why': 'the matte found no product, or the product fills the frame'})
else:
    h, w = mask.shape; pad = 6
    y0, y1, x0, x1 = max(0, ys.min() - pad), min(h, ys.max() + pad + 1), max(0, xs.min() - pad), min(w, xs.max() + pad + 1)
    out = Image.fromarray(np.dstack([rgb, (mask * 255 + .5).astype(np.uint8)])[y0:y1, x0:x1], 'RGBA')
    s = min(1.0, a.max / max(out.size))
    if s < 1: out = out.resize((round(out.size[0] * s), round(out.size[1] * s)), Image.LANCZOS)
    os.makedirs(os.path.dirname(os.path.abspath(a.out)), exist_ok=True)
    out.save(a.out, 'WEBP', quality=a.q, method=6, lossless=a.lossless)
    small = out.copy(); small.thumbnail((320, 320), Image.LANCZOS); small.save(a.out.replace('.webp', '-320.webp'), 'WEBP', quality=a.q, method=6, lossless=a.lossless)
    # integrity: the opaque core of the decoded file against the source at the same scale
    dec = np.asarray(Image.open(a.out).convert('RGBA')).astype(np.float32)
    ref = Image.fromarray(rgb[y0:y1, x0:x1]); ref = ref.resize(out.size, Image.LANCZOS) if s < 1 else ref
    ref = np.asarray(ref).astype(np.float32); core = dec[:, :, 3] > 250
    mse = float(((dec[:, :, :3][core] - ref[core]) ** 2).mean()) if core.any() else 0.0
    psnr = 99.0 if mse == 0 else 10 * np.log10(255 ** 2 / mse)
    report.update({'suitable': True, 'size': list(out.size), 'bytes': os.path.getsize(a.out), 'psnr': round(float(psnr), 1), 'pixelsKept': bool(psnr >= 32), 'whiteOnWhite': False, 'review': None})
print(json.dumps(report, ensure_ascii=False))
if a.manifest:
    m = json.load(open(a.manifest)) if os.path.exists(a.manifest) else {'cutouts': {}}
    prev = m['cutouts'].get(report['id'])
    if prev and prev.get('method') != report['method']: report['replaces'] = {k: prev.get(k) for k in ('suitable', 'whiteOnWhite', 'psnr', 'why') if k in prev}
    m['cutouts'][report['id']] = report; json.dump(m, open(a.manifest, 'w'), ensure_ascii=False, indent=1)
sys.exit(0 if report.get('pixelsKept') else 4)
