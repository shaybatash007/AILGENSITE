#!/usr/bin/env python3
"""Brand colour grade for generated plates: pull an image gently toward the concept palette, and prove it.

    python3 grade.py --in plate.png --out plate-graded.png --palette "#F8EFEA,#F0D3C3,#E7C3B2,#BF7F7F" [--strength .35] [--json]
    python3 grade.py --swatch "#1F1A1B,#D8262E,#F2EDE6" --out refs/field-thuya.png      a colour-swatch reference image

A statistics transfer in CIE Lab (Reinhard): the image's per-channel mean and spread move part of the way (strength) toward
the palette's, weighted by how much of each palette colour the concept uses (the order given, first = most). Lightness keeps
most of its own structure; hue and chroma move more. The report is the median ΔE from each pixel to its nearest palette
colour, before and after. Only generated plates are graded: product photos and cutouts are never touched (their pixels are
the product, references/12-visual-production.md).
"""
import argparse, json
import numpy as np
from PIL import Image

ap = argparse.ArgumentParser()
ap.add_argument('--in', dest='src'); ap.add_argument('--out', required=True)
ap.add_argument('--palette', default=''); ap.add_argument('--strength', type=float, default=0.35)
ap.add_argument('--swatch', default=''); ap.add_argument('--json', action='store_true')
a = ap.parse_args()

hexs = lambda s: [h.strip() for h in s.split(',') if h.strip()]
rgb = lambda h: [int(h[i:i + 2], 16) / 255 for i in (1, 3, 5)]

def to_lab(c):
    c = np.where(c > .04045, ((c + .055) / 1.055) ** 2.4, c / 12.92)
    xyz = c @ np.array([[.4124, .3576, .1805], [.2126, .7152, .0722], [.0193, .1192, .9505]]).T / np.array([.95047, 1, 1.08883])
    f = np.where(xyz > .008856, np.cbrt(xyz), 7.787 * xyz + 16 / 116)
    return np.stack([116 * f[..., 1] - 16, 500 * (f[..., 0] - f[..., 1]), 200 * (f[..., 1] - f[..., 2])], -1)

def to_rgb(L):
    fy = (L[..., 0] + 16) / 116; fx = fy + L[..., 1] / 500; fz = fy - L[..., 2] / 200
    f = np.stack([fx, fy, fz], -1); xyz = np.where(f ** 3 > .008856, f ** 3, (f - 16 / 116) / 7.787) * np.array([.95047, 1, 1.08883])
    c = xyz @ np.array([[3.2406, -1.5372, -.4986], [-.9689, 1.8758, .0415], [.0557, -.2040, 1.0570]]).T
    c = np.where(c > .0031308, 1.055 * np.clip(c, 0, None) ** (1 / 2.4) - .055, 12.92 * c)
    return np.clip(c, 0, 1)

if a.swatch:
    # a reference image of the colours only: bands in the given order and proportion (first colour largest)
    cols = hexs(a.swatch); w, h = 512, 512; im = Image.new('RGB', (w, h)); px = im.load()
    weights = np.array([2 ** -i for i in range(len(cols))]); edges = np.cumsum(weights / weights.sum()) * h
    for y in range(h):
        k = int(np.searchsorted(edges, y, side='right')); col = tuple(int(v * 255) for v in rgb(cols[min(k, len(cols) - 1)]))
        for x in range(w): px[x, y] = col
    im.save(a.out); print(json.dumps({'swatch': a.out, 'colours': cols})); raise SystemExit(0)

pal = np.array([rgb(h) for h in hexs(a.palette)]); P = to_lab(pal)
im = Image.open(a.src).convert('RGB'); A = np.asarray(im).astype(np.float32) / 255; L = to_lab(A)
wts = np.array([2 ** -i for i in range(len(P))]); wts /= wts.sum()
tm = (P * wts[:, None]).sum(0); ts = np.sqrt(((P - tm) ** 2 * wts[:, None]).sum(0)) + np.array([6.0, 2.0, 2.0])  # a palette has little spread; keep some
m = L.reshape(-1, 3).mean(0); s = L.reshape(-1, 3).std(0) + 1e-6
k = a.strength * np.array([0.6, 1.0, 1.0])  # lightness keeps more of its own structure than hue and chroma
new_s = s * (1 - k) + np.minimum(s, ts * 3) * k
G = (L - m) / s * new_s + (m * (1 - k) + tm * k)
out = to_rgb(G)
def de(Lab):
    d = np.sqrt(((Lab.reshape(-1, 1, 3)[::7] - P[None]) ** 2).sum(-1)).min(1); return round(float(np.median(d)), 1)
rep = {'in': a.src, 'out': a.out, 'strength': a.strength, 'deltaE_before': de(L), 'deltaE_after': de(G)}
Image.fromarray((out * 255 + .5).astype(np.uint8)).save(a.out, quality=94) if a.out.lower().endswith(('.jpg', '.jpeg')) else Image.fromarray((out * 255 + .5).astype(np.uint8)).save(a.out)
print(json.dumps(rep))
