import json, sys
from PIL import Image, ImageDraw, ImageFont
m = json.load(open('mascot.json')); C = m['colors']
def draw(face, cell, bg):
    g = m['grid']; W, H = len(g[0]), len(g)
    im = Image.new('RGB', (W * cell + 2 * cell, H * cell + 2 * cell), bg); d = ImageDraw.Draw(im)
    for y, row in enumerate(g):
        for x, ch in enumerate(row):
            if ch != '.': d.rectangle([cell + x * cell, cell + y * cell, cell + (x + 1) * cell - 1, cell + (y + 1) * cell - 1], fill=C[ch])
    for x, y, w, h, k in m['faces'][face]:
        d.rectangle([cell + x * cell, cell + y * cell, cell + (x + w) * cell - 1, cell + (y + h) * cell - 1], fill=C[k])
    return im
faces = list(m['faces'].keys())
cell = 10
tiles = [draw(f, cell, '#F8EFEA') for f in faces]
w, h = tiles[0].size
cols = 4; rows = (len(tiles) + cols - 1) // cols
out = Image.new('RGB', (w * cols, h * rows + 130), '#F8EFEA')
d = ImageDraw.Draw(out)
for i, t in enumerate(tiles):
    out.paste(t, ((i % cols) * w, (i // cols) * h))
    d.text(((i % cols) * w + 8, (i // cols) * h + 6), faces[i], fill='#6B5A54')
y0 = h * rows + 10
for i, (c, bg) in enumerate([(2, '#F8EFEA'), (2, '#241A18'), (3, '#F8EFEA'), (1, '#F8EFEA')]):
    im = draw('idle', c, bg); out.paste(im, (16 + i * 120, y0)); d.text((16 + i * 120, y0 + im.size[1] + 2), '%dpx' % (im.size[0]), fill='#6B5A54')
out.save(sys.argv[1]); print(faces)
