# סבבי (Sababi): the Talor Karadi mascot, born from the four blades of the logo.
# Body = the pinwheel (four swirling blades, green/blue alternating, light at the hub side, deep at the tail),
# face = the navy hub where eyes are drawn in hi-vis lime, a hi-vis hard hat, two legs with lime boots.
import math, json
W, H = 24, 26
cx, cy, R = 11.5, 13.0, 10.6
grid = [['.'] * W for _ in range(H)]
for y in range(H):
    for x in range(W):
        dx, dy = x - cx, y - cy
        r = math.hypot(dx, dy)
        if r > R: continue
        if r <= 4.9:
            grid[y][x] = 'K'; continue
        th = math.atan2(dy, dx) - 0.95 * (r / R)          # the swirl: angle twists with radius (like the logo)
        q = int(((th + math.pi * 2.25) % (2 * math.pi)) // (math.pi / 2))
        edge = ((th + math.pi * 2.25) % (math.pi / 2)) / (math.pi / 2)
        if edge < 0.10: continue                           # the white gap between blades
        deep = edge > 0.55                                  # the fold: the second half of each blade is deeper
        grid[y][x] = ('G' if deep else 'g') if q % 2 == 0 else ('B' if deep else 'b')
# hard hat over the top of the wheel
for y in range(0, 5):
    for x in range(W):
        dx = x - cx
        if y == 4 and abs(dx) <= 8.5: grid[y][x] = 'h'      # brim
        elif y in (1, 2, 3) and abs(dx) <= 6.5 - (3 - y) * 0.9: grid[y][x] = 'h' if y > 1 else 'H'
        if y in (2, 3) and abs(dx) < 0.6: grid[y][x] = 'H'  # ridge
# legs + boots
for y in range(23, 26):
    for x in (8, 9, 14, 15):
        grid[y][x] = 'K' if y < 25 else 'h'
    for x in (7, 16):
        if y == 25: grid[y][x] = 'h'
rows = [''.join(r) for r in grid]
colors = {"K": "#0B1B2E", "g": "#9ACB63", "G": "#2E8B3E", "b": "#7FBEE6", "B": "#2560A8", "h": "#C9F03A", "H": "#A8CC1E", "r": "#FF5A4E", "w": "#FFFFFF"}
L = 'h'
faces = {
 "idle":  [[9,11,2,2,L],[13,11,2,2,L],[10,15,4,1,L]],
 "blink": [[9,12,2,1,L],[13,12,2,1,L],[10,15,4,1,L]],
 "look":  [[8,11,2,2,L],[12,11,2,2,L],[10,15,3,1,L]],
 "happy": [[8,12,1,1,L],[9,11,2,1,L],[11,12,1,1,L],[12,12,1,1,L],[13,11,2,1,L],[15,12,1,1,L],[9,14,6,1,L],[10,15,4,1,L]],
 "think": [[9,10,2,1,L],[13,10,2,1,L],[9,15,1,1,L],[11,15,1,1,L],[13,15,1,1,L]],
 "sleep": [[9,12,2,1,L],[13,12,2,1,L],[11,15,2,1,L]],
 "surprised": [[9,10,2,3,L],[13,10,2,3,L],[11,14,2,2,L]],
 "love":  [[8,11,1,1,"r"],[10,11,1,1,"r"],[8,12,3,1,"r"],[9,13,1,1,"r"],[13,11,1,1,"r"],[15,11,1,1,"r"],[13,12,3,1,"r"],[14,13,1,1,"r"],[10,15,4,1,L]]
}
json.dump({"name": "סבבי", "grid": rows, "colors": colors, "faces": faces, "cell": 11, "hub": [cx, cy, 4.9]}, open('sababi.json', 'w'), ensure_ascii=False, indent=1)
print('\n'.join(rows))
