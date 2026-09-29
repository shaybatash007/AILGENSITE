# Traces the client's real logo (intake/media/078-logo.png, 800x500) into clean vector paths.
#   python3 trace-logo.py  →  brand/logo-full.svg, brand/symbol.svg (ring + EC monogram + lotus), brand/wordmark.svg
# The mark is not redrawn: the outline is the client's own, upscaled 6x, smoothed and fitted with cubic curves.
import cv2, numpy as np, json, os, sys
from PIL import Image
HERE = os.path.dirname(os.path.abspath(__file__)); SRC = os.path.join(HERE, '..', 'intake', 'media', '078-logo.png')
im = Image.open(SRC).convert('RGBA'); W, H = im.size
S = 6
bg = Image.new('RGBA', im.size, (255, 255, 255, 255)); bg.alpha_composite(im)
g = np.array(bg.convert('L'), dtype=np.float32)
big = cv2.resize(g, (W * S, H * S), interpolation=cv2.INTER_CUBIC)
big = cv2.GaussianBlur(big, (0, 0), 2.4)
# two thresholds: hairlines of the ring and lotus need a generous one, the wordmark's soft shadow a strict one
split = 312 * S
m1 = (big < 196).astype(np.uint8) * 255; m1[split:] = 0
m2 = (big < 150).astype(np.uint8) * 255; m2[:split] = 0
cnts = list(cv2.findContours(m1, cv2.RETR_CCOMP, cv2.CHAIN_APPROX_NONE)[0]) + list(cv2.findContours(m2, cv2.RETR_CCOMP, cv2.CHAIN_APPROX_NONE)[0])

def smooth(pts, k=9):
    n = len(pts); pts = pts.astype(np.float64)
    if n < 12: return pts
    ker = np.ones(k) / k; out = np.zeros_like(pts)
    for d in (0, 1):
        ext = np.concatenate([pts[-k:, d], pts[:, d], pts[:k, d]])
        out[:, d] = np.convolve(ext, ker, mode='same')[k:-k]
    return out

def path(pts, eps):
    c = cv2.approxPolyDP(pts.astype(np.float32).reshape(-1, 1, 2), eps, True).reshape(-1, 2).astype(np.float64)
    n = len(c)
    if n < 3: return ''
    f = lambda v: ('%.2f' % v).rstrip('0').rstrip('.')
    d = 'M%s %s' % (f(c[0][0] / S), f(c[0][1] / S))
    for i in range(n):                       # Catmull-Rom to cubic Bezier through the simplified points
        p0, p1, p2, p3 = c[(i - 1) % n], c[i], c[(i + 1) % n], c[(i + 2) % n]
        c1 = p1 + (p2 - p0) / 6; c2 = p2 - (p3 - p1) / 6
        d += 'C%s %s %s %s %s %s' % (f(c1[0] / S), f(c1[1] / S), f(c2[0] / S), f(c2[1] / S), f(p2[0] / S), f(p2[1] / S))
    return d + 'Z'

groups = {'symbol': [], 'word': []}
for i, c in enumerate(cnts):
    pts = c.reshape(-1, 2)
    if cv2.contourArea(c) < 18 * S * S * 0.08 and len(pts) < 40: continue   # specks
    x, y, w, h = cv2.boundingRect(c)
    cy = (y + h / 2) / S
    (groups['symbol'] if cy < 312 else groups['word']).append(pts)
def bounds(gs):
    a = np.concatenate(gs); return a[:, 0].min() / S, a[:, 1].min() / S, a[:, 0].max() / S, a[:, 1].max() / S
def svg(gs, box, fill='#000', pad=4, cls=''):
    x0, y0, x1, y1 = box; vb = (x0 - pad, y0 - pad, x1 - x0 + 2 * pad, y1 - y0 + 2 * pad)
    d = ''.join(path(smooth(p, 15), 1.8) for p in gs)
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="%.1f %.1f %.1f %.1f"%s><path fill="%s" fill-rule="evenodd" d="%s"/></svg>\n' % (vb + (cls, fill, d)), vb
sb, wb = bounds(groups['symbol']), bounds(groups['word'])
allb = (min(sb[0], wb[0]), sb[1], max(sb[2], wb[2]), wb[3])
os.makedirs(HERE, exist_ok=True)
open(os.path.join(HERE, 'symbol.svg'), 'w').write(svg(groups['symbol'], sb)[0])
open(os.path.join(HERE, 'wordmark.svg'), 'w').write(svg(groups['word'], wb)[0])
full, vb = svg(groups['symbol'] + groups['word'], allb)
open(os.path.join(HERE, 'logo-full.svg'), 'w').write(full)
json.dump({'symbol': sb, 'word': wb, 'all': allb, 'contours': {k: len(v) for k, v in groups.items()}}, open(os.path.join(HERE, 'trace.json'), 'w'))
# the symbol split into its parts, so a site can animate the ring, the monogram and the lotus one after another
def cls(p):
    x0, y0, x1, y1 = p[:, 0].min() / S, p[:, 1].min() / S, p[:, 0].max() / S, p[:, 1].max() / S
    if x1 - x0 < 12 and y1 - y0 < 12: return 'speck'   # a broken piece of the ring's hairline: dropped
    if x1 - x0 > 190: return 'ring'
    if (x0 + x1) / 2 > 425 and (y0 + y1) / 2 < 175: return 'lotus'
    return 'mono'
parts = {'ring': [], 'mono': [], 'lotus': []}
for p in groups['symbol']:
    k = cls(p)
    if k != 'speck': parts[k].append(path(smooth(p, 15), 1.8))
vbx = svg(groups['symbol'], sb)[1]
json.dump({'viewBox': [round(v, 1) for v in vbx], 'parts': {k: ''.join(v) for k, v in parts.items()}, 'counts': {k: len(v) for k, v in parts.items()}}, open(os.path.join(HERE, 'symbol-parts.json'), 'w'))
print('symbol', [round(v, 1) for v in sb], 'word', [round(v, 1) for v in wb], {k: len(v) for k, v in groups.items()})
