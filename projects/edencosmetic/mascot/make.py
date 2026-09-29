# לוטי (Lotti): the Eden Cosmetics mascot, born from the logo's ring and lotus.
# Body = the ring of the logo as a round, open-at-the-lower-left outline holding a blush disc; the lotus sits at the upper
# right exactly where it does in the logo; the face lives on the disc; the eyes are lashes, drawn as the brand's curl in
# the accent colour. Two little rose shoes. The same grid serves the site (SVG rects) and the film (canvas).
import math, json
W, H = 24, 27
cx, cy, R = 11.0, 14.2, 10.2
g = [['.'] * W for _ in range(H)]
def put(x, y, ch):
    if 0 <= x < W and 0 <= y < H: g[y][x] = ch
for y in range(H):
    for x in range(W):
        dx, dy = x + .5 - cx, y + .5 - cy
        r = math.hypot(dx, dy)
        ang = math.degrees(math.atan2(dy, dx))          # 0 = right, 90 = down
        gap = 118 <= ang <= 158                          # the ring is open at the lower left, like the logo's
        if r <= R - 1.0:
            # disc: highlight top-left, base, soft shade bottom-right
            t = (dx * -0.6 + dy * -0.8) / R
            g[y][x] = 'b' if t > 0.42 else ('s' if t < -0.55 else 'p')
        elif r <= R + .35 and not gap:
            g[y][x] = 'K'
# lotus: three petals at the upper right of the ring (the logo's position): accent centre, rose sides, a hairline of ink between them
ox, oy = 16, 0
rows = ["....A....", "...AcA...", "..AcRcA..", "A.AcRcA.A", "ARAAcAARA", ".ARRARRA.", "..AAAAA.."]
for j, row in enumerate(rows):
    for i, ch in enumerate(row):
        if ch != '.': put(ox + i, oy + j, ch)
# shoes
for x in (8, 9, 13, 14): put(x, 25, 'K')
for x in (7, 8, 9, 10, 12, 13, 14, 15): put(x, 26, 'A')
grid = [''.join(r) for r in g]
colors = {"K": "#241A18", "b": "#F8E4D8", "p": "#EBC9B8", "s": "#DDAE9C", "A": "#964F58", "R": "#BF7F7F", "c": "#D98C8C", "w": "#FFFFFF", "F": "#E9A23B"}
# face: the eyes carry the brand's curl. A flick rises from the outer corner of each eye and turns, in the accent colour (A); ink (K) for the rest.
def mir(x): return 21 - x
def flick(dy=0, form="wing"):
    # the brand's curl at the outer corner of each eye: straight (lift0), curled (wing), curled further (lift1)
    L = {"flat": [(6, 12), (6, 11), (6, 10), (6, 9)],
         "wing": [(6, 12), (5, 11), (5, 10), (6, 9)],
         "big":  [(6, 12), (5, 11), (4, 10), (4, 9), (5, 8), (6, 8)]}[form]
    pts = [(x, y + dy) for x, y in L]
    return [[x, y, 1, 1, "A"] for x, y in pts] + [[mir(x), y, 1, 1, "A"] for x, y in pts]
eye = lambda x, y=13, h=3: [[x, y, 2, h, "K"], [x, y, 1, 1, "w"]]
eyes = lambda dx=0, dy=0: eye(7 + dx, 13 + dy) + eye(13 + dx, 13 + dy)
arcUp = [(6, 15), (7, 14), (8, 14), (9, 15)]        # happy, closed eye
arcDn = [(6, 14), (7, 15), (8, 15), (9, 14)]        # sleeping, closed eye
px = lambda pts, k="K": [[x, y, 1, 1, k] for x, y in pts]
both = lambda pts, k="K": px(pts, k) + px([(mir(x), y) for x, y in pts], k)
cheeks = [[5, 17, 2, 1, "c"], [15, 17, 2, 1, "c"]]
smile = [[8, 17, 1, 1, "K"], [9, 18, 4, 1, "K"], [13, 17, 1, 1, "K"]]
heart = lambda x: [[x + 1, 12, 1, 1, "A"], [x + 3, 12, 1, 1, "A"], [x, 13, 5, 1, "A"], [x + 1, 14, 3, 1, "A"], [x + 2, 15, 1, 1, "A"]]
faces = {
 "idle":  flick() + eyes() + cheeks + smile,
 "blink": flick(2) + [[7, 15, 2, 1, "K"], [13, 15, 2, 1, "K"]] + cheeks + smile,
 "look":  flick() + eyes(1, 0) + cheeks + [[10, 18, 3, 1, "K"]],
 "happy": flick(-1) + both(arcUp) + cheeks + [[7, 17, 1, 1, "K"], [8, 18, 6, 1, "K"], [14, 17, 1, 1, "K"], [9, 19, 4, 1, "K"]],
 "think": flick(-1) + eyes(1, -1) + cheeks + [[10, 19, 2, 1, "K"], [1, 5, 1, 1, "A"], [3, 3, 1, 1, "A"], [5, 1, 2, 2, "A"]],
 "sleep": flick(3) + both(arcDn) + cheeks + [[9, 18, 4, 1, "K"], [1, 1, 4, 1, "A"], [3, 2, 1, 1, "A"], [2, 3, 1, 1, "A"], [1, 4, 4, 1, "A"]],
 "shabbat": flick(3) + both(arcDn) + cheeks + smile + [[2, 0, 1, 2, "F"], [2, 2, 1, 1, "K"], [1, 3, 3, 4, "w"], [3, 3, 1, 4, "p"]],
 "oops":  flick(-1) + eye(7, 12, 4) + eye(13, 12, 4) + cheeks + [[10, 19, 2, 2, "K"]],
 "wink":  flick() + eye(7) + px([(12, 15), (13, 14), (14, 14), (15, 15)]) + cheeks + [[7, 17, 1, 1, "K"], [8, 18, 5, 1, "K"], [13, 17, 1, 1, "K"]],
 "love":  flick() + heart(6) + heart(12) + cheeks + smile,
 "lift0": flick(0, "flat") + [[7, 15, 2, 1, "K"], [13, 15, 2, 1, "K"]] + cheeks + [[9, 18, 4, 1, "K"]],
 "lift1": flick(-1, "big") + both(arcUp) + cheeks + smile,
}
json.dump({"name": "לוטי", "en": "Lotti", "bornFrom": "the ring and the lotus of the logo", "grid": grid, "colors": colors, "faces": faces, "cell": 11,
           "states": {"idle": "default", "blink": "every 2.4-6 s", "look": "something changed nearby", "happy": "success, a hop", "think": "after 22 s idle",
                      "sleep": "after 65 s idle", "shabbat": "Friday afternoon to Saturday night (the store keeps Shabbat)", "oops": "out of stock, an error",
                      "wink": "a kit was built", "love": "a lead was sent", "lift0": "brand state: the lift, start", "lift1": "brand state: the lift, end"},
           "manners": ["<= 6 tips per visit, >= 11 s apart, each once", "quiet for a week / hide, remembered (mutedUntil)", "reduced motion: no walking, no beam, no lift", "never while the visitor types or a dialog is open"]},
          open('mascot.json', 'w'), ensure_ascii=False, indent=1)
print('\n'.join(grid))
