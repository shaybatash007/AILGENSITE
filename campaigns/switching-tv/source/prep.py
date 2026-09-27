#!/usr/bin/env python3
"""Prepare campaign assets: clean the render watermark, upscale key stills, extract footage frames."""
import os, subprocess
import cv2
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
M = os.path.join(HERE, '../../../switching-tv/m')
IMG = os.path.join(HERE, 'img')
WORK = os.path.join(HERE, 'work')
os.makedirs(IMG, exist_ok=True)
os.makedirs(WORK, exist_ok=True)

# The AI renders carry a small sparkle mark in the bottom-right corner: inpaint it away.
STILLS = {
    's_pool': (968, 968, 30),
    's_garden': (1152, 607, 28),
    's_cinema': (1152, 607, 28),
    's_trans': (1152, 607, 28),
    's_wall': (1152, 607, 28),
    's_poolnight': None,
    's_meira': None,
    's_pizza': None,
}


def sharpen(im, amount=0.6, sigma=1.2):
    blur = cv2.GaussianBlur(im, (0, 0), sigma)
    return cv2.addWeighted(im, 1 + amount, blur, -amount, 0)


for name, wm in STILLS.items():
    im = cv2.imread(f'{M}/{name}.jpg')
    if wm:
        x, y, r = wm
        mask = np.zeros(im.shape[:2], np.uint8)
        cv2.circle(mask, (x, y), r, 255, -1)
        im = cv2.inpaint(im, mask, 9, cv2.INPAINT_TELEA)
    # 2x Lanczos upscale with a gentle sharpen, so large on-screen use stays crisp
    up = cv2.resize(im, None, fx=2, fy=2, interpolation=cv2.INTER_LANCZOS4)
    up = sharpen(up, 0.5, 1.6)
    cv2.imwrite(f'{IMG}/{name}.jpg', up, [cv2.IMWRITE_JPEG_QUALITY, 93])
    print(name, up.shape[1], 'x', up.shape[0])

# Real installation footage: extract the chosen segments as 30 fps frames.
CLIPS = {  # name: (source, start, duration, width)
    'meira2': ('f_meira2.mp4', 1.0, 3.0, 720),
    'pizza': ('f_pizza.mp4', 3.2, 3.0, 1280),
    'meira': ('f_meira.mp4', 8.0, 3.0, 720),
}
for name, (src, ss, dur, w) in CLIPS.items():
    out = f'{WORK}/{name}'
    os.makedirs(out, exist_ok=True)
    subprocess.run(['ffmpeg', '-hide_banner', '-loglevel', 'error', '-y', '-ss', str(ss), '-t', str(dur),
                    '-i', f'{M}/{src}', '-vf', f'fps=30,scale={w}:-2:flags=lanczos,unsharp=5:5:0.6',
                    '-q:v', '3', f'{out}/%03d.jpg'], check=True)
    print(name, len(os.listdir(out)), 'frames')
