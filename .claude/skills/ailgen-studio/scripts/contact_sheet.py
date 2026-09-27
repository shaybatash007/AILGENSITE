#!/usr/bin/env python3
"""Tile frames or screenshots into one contact sheet for review.
    python3 contact_sheet.py "out/review/f_*.png" sheet.png [cols]"""
import sys, glob
from PIL import Image, ImageDraw
pat, out = sys.argv[1], sys.argv[2]; cols = int(sys.argv[3]) if len(sys.argv) > 3 else 5
fs = sorted(glob.glob(pat)); ims = [Image.open(f) for f in fs]
tw = 270; th = int(ims[0].height * tw / ims[0].width)
ims = [i.resize((tw, th)) for i in ims]
rows = (len(ims) + cols - 1) // cols
sheet = Image.new('RGB', (cols * (tw + 6), rows * (th + 20)), '#222'); d = ImageDraw.Draw(sheet)
for i, (im, f) in enumerate(zip(ims, fs)):
    x, y = (i % cols) * (tw + 6) + 3, (i // cols) * (th + 20) + 3; sheet.paste(im, (x, y)); d.text((x + 4, y + th + 2), f.split('_')[-1][:-4], fill='white')
sheet.save(out)
