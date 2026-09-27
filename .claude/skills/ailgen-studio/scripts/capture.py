#!/usr/bin/env python3
"""Capture every region and interactive element of a page, desktop and mobile (from the levelup skill).
    python3 capture.py http://127.0.0.1:8000/ cap/
Serve the site locally (python3 -m http.server) so no proxy or certificate is involved."""
# capture.py  URL  OUT_DIR
import sys, os, json
from playwright.sync_api import sync_playwright
URL, OUT = sys.argv[1], (sys.argv[2] if len(sys.argv) > 2 else "cap")
os.makedirs(OUT, exist_ok=True)
REGIONS = "header, main > section, footer, dialog[open]"
ELEMS = "a.btn, button, .chip, .card, input, textarea, summary, [role=tab]"
VPS = {"d": {"width": 1440, "height": 900}, "m": {"width": 390, "height": 844}}
index = []
with sync_playwright() as p:
    b = p.chromium.launch()
    for vk, vp in VPS.items():
        pg = b.new_page(viewport=vp); pg.goto(URL); pg.wait_for_timeout(4500)
        H = pg.evaluate("document.documentElement.scrollHeight")
        for y in range(0, H, int(vp["height"] * .6)):
            pg.evaluate(f"scrollTo(0,{y})"); pg.wait_for_timeout(220)
        pg.evaluate("scrollTo(0,0)"); pg.wait_for_timeout(600)
        pg.screenshot(path=f"{OUT}/{vk}_first.png")
        for i, r in enumerate(pg.query_selector_all(REGIONS)):
            if not r.is_visible(): continue
            r.scroll_into_view_if_needed(); pg.wait_for_timeout(900)
            name = (r.get_attribute("id") or r.evaluate("e=>e.tagName")).lower()
            f = f"{OUT}/{vk}_r{i:02d}_{name}.png"; r.screenshot(path=f)
            index.append({"vp": vk, "region": name, "file": f})
        if vk == "d":
            for j, e in enumerate(pg.query_selector_all(ELEMS)[:150]):
                if not e.is_visible(): continue
                e.scroll_into_view_if_needed(); base = f"{OUT}/e{j:03d}"
                e.screenshot(path=base + "_default.png")
                e.hover(); pg.wait_for_timeout(350); e.screenshot(path=base + "_hover.png")
                e.focus(); pg.wait_for_timeout(150); e.screenshot(path=base + "_focus.png")
                index.append({"element": j, "file": base})
    b.close()
json.dump(index, open(f"{OUT}/index.json", "w"), ensure_ascii=False, indent=1)
