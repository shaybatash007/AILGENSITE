#!/usr/bin/env python3
"""Extract a brand palette from a logo, a screenshot or any image, and check contrast.

    python3 palette.py intake/media/001-logo.png intake/shots/home-desktop.png --out palette.json [--k 6]

For each image: dominant colours (k-means in Lab-ish space, weighted by pixel count), then a merged
palette with suggested roles (background, ink, accent) and the WCAG contrast of the key pairs.
The roles are a starting point for brand-dna, not a decision: a designer confirms them.
"""
import argparse
import json
import sys

import numpy as np
from PIL import Image


def load(path, size=220):
    """Load an image as an (N, 3) float array of opaque pixels, downscaled for speed."""
    im = Image.open(path)
    if im.mode in ('P', 'LA', 'L'):
        im = im.convert('RGBA')
    im.thumbnail((size, size))
    a = np.asarray(im.convert('RGBA'), dtype=np.float32)
    px = a[..., :3].reshape(-1, 3)
    alpha = a[..., 3].reshape(-1)
    return px[alpha > 200]


def kmeans(px, k, iters=18, seed=7):
    """Plain k-means with k-means++ seeding. Returns (centres, counts)."""
    rng = np.random.default_rng(seed)
    if len(px) <= k:
        return px, np.ones(len(px))
    c = [px[rng.integers(len(px))]]
    for _ in range(1, k):
        d = np.min(((px[:, None, :] - np.array(c)[None]) ** 2).sum(-1), axis=1)
        c.append(px[rng.choice(len(px), p=d / d.sum())] if d.sum() else px[rng.integers(len(px))])
    c = np.array(c)
    for _ in range(iters):
        lab = np.argmin(((px[:, None, :] - c[None]) ** 2).sum(-1), axis=1)
        for j in range(k):
            m = px[lab == j]
            if len(m):
                c[j] = m.mean(0)
    counts = np.bincount(lab, minlength=k)
    return c, counts


def hexc(rgb):
    return '#' + ''.join(f'{int(round(v)):02X}' for v in rgb)


def luminance(rgb):
    s = np.asarray(rgb, dtype=float) / 255
    s = np.where(s <= 0.03928, s / 12.92, ((s + 0.055) / 1.055) ** 2.4)
    return 0.2126 * s[0] + 0.7152 * s[1] + 0.0722 * s[2]


def contrast(a, b):
    la, lb = sorted([luminance(a), luminance(b)], reverse=True)
    return round((la + 0.05) / (lb + 0.05), 2)


def saturation(rgb):
    mx, mn = max(rgb) / 255, min(rgb) / 255
    return 0 if mx == 0 else (mx - mn) / mx


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('images', nargs='+')
    ap.add_argument('--k', type=int, default=6)
    ap.add_argument('--out')
    a = ap.parse_args()

    per, merged = {}, []
    for path in a.images:
        try:
            px = load(path)
        except Exception as e:  # unreadable or unsupported file: report and continue
            print(f'skip {path}: {e}', file=sys.stderr)
            continue
        if not len(px):
            continue
        c, n = kmeans(px, a.k)
        order = np.argsort(-n)
        cols = [{'hex': hexc(c[i]), 'share': round(float(n[i] / n.sum()), 3)} for i in order if n[i]]
        per[path] = cols
        merged += [(c[i], float(n[i] / n.sum())) for i in order if n[i]]

    if not merged:
        sys.exit('no readable images')
    # roles: background = most common light-or-dark field, ink = strongest contrast to it,
    # accent = the most saturated colour with a meaningful share
    merged.sort(key=lambda x: -x[1])
    bg = merged[0][0]
    ink = max(merged, key=lambda x: contrast(x[0], bg))[0]
    far = lambda c: np.linalg.norm(np.asarray(c) - bg) > 90 and np.linalg.norm(np.asarray(c) - ink) > 90
    # small shares count: a brand accent is often a tiny detail of the logo (a dot, a window, a bar)
    accents = sorted([m for m in merged if m[1] > 0.002 and saturation(m[0]) > 0.35 and far(m[0])], key=lambda x: -saturation(x[0]) * (0.3 + x[1]))
    accent = accents[0][0] if accents else ink
    roles = {
        'background': hexc(bg), 'ink': hexc(ink), 'accent': hexc(accent),
        'contrast': {'ink_on_background': contrast(ink, bg), 'accent_on_background': contrast(accent, bg),
                     'background_on_accent': contrast(bg, accent), 'ink_on_accent': contrast(ink, accent)},
        'notes': 'WCAG AA needs 4.5 for body text and 3 for large text and UI. Adjust lightness, not hue, to pass.',
    }
    out = {'images': per, 'suggested': roles}
    txt = json.dumps(out, indent=2, ensure_ascii=False)
    if a.out:
        open(a.out, 'w').write(txt + '\n')
    print(txt)


if __name__ == '__main__':
    main()
