#!/usr/bin/env python3
"""Real-time screencast of a scripted visit -> MP4 at a constant 30 fps (from the levelup2 skill).
Import it and write the camera script:
    from rec import record, top_at, to
    def shot(pg):
        pg.wait_for_timeout(2500); top_at(pg, '#work'); pg.wait_for_timeout(1200); to(pg, '.proj .btn')
    record('http://127.0.0.1:8000/', 'out/portfolio-loop', shot)
Then cut moments with ffmpeg (see references/07-portfolio.md)."""
# rec.py — real-time screencast -> MP4 (constant 30fps, real frame durations)
import base64, os, subprocess, shutil
from playwright.sync_api import sync_playwright
CURSOR = """addEventListener('DOMContentLoaded',()=>{const c=document.createElement('div');
c.style.cssText='position:fixed;left:0;top:0;width:26px;height:26px;margin:-13px 0 0 -13px;border-radius:50%;border:1.5px solid rgba(COL,.95);background:rgba(COL,.12);pointer-events:none;z-index:2147483647;transition:transform .18s;opacity:0';
document.documentElement.appendChild(c);let x=-99,y=-99,tx=-99,ty=-99;
addEventListener('mousemove',e=>{tx=e.clientX;ty=e.clientY;c.style.opacity=1},true);
addEventListener('mousedown',()=>c.style.transform='scale(.7)',true);addEventListener('mouseup',()=>c.style.transform='',true);
(function f(){x+=(tx-x)*.35;y+=(ty-y)*.35;c.style.left=x+'px';c.style.top=y+'px';requestAnimationFrame(f)})()});"""
SMOOTH = "(y,ms)=>new Promise(r=>{const s=scrollY,t0=performance.now(),e=x=>x<.5?4*x*x*x:1-Math.pow(-2*x+2,3)/2;(function f(n){const k=Math.min(1,(n-t0)/ms);scrollTo(0,s+(y-s)*e(k));k<1?requestAnimationFrame(f):r()})(t0)})"
def top_at(pg, sel, px=110, ms=2000):
    y = pg.evaluate(f"document.querySelector('{sel}').getBoundingClientRect().top+scrollY-{px}")
    pg.evaluate(f"({SMOOTH})({y},{ms})")
def to(pg, sel, steps=32, pause=500, dx=.5, dy=.5):
    b = pg.query_selector(sel).bounding_box(); pg.mouse.move(b['x']+b['width']*dx, b['y']+b['height']*dy, steps=steps)
    if pause: pg.wait_for_timeout(pause)
def record(url, out, script, vp=(1440,900), scale=1, cursor=True, color='255,255,255'):
    d = out+'_frames'; shutil.rmtree(d, ignore_errors=True); os.makedirs(d); frames = []
    with sync_playwright() as p:
        b = p.chromium.launch(); pg = b.new_page(viewport={'width':vp[0],'height':vp[1]}, device_scale_factor=scale)
        if cursor: pg.add_init_script(CURSOR.replace('COL', color))
        cdp = pg.context.new_cdp_session(pg)
        def on(f):
            fn = f'{d}/{len(frames):05d}.jpg'; open(fn,'wb').write(base64.b64decode(f['data']))
            frames.append((fn, f['metadata']['timestamp']))
            cdp.send('Page.screencastFrameAck', {'sessionId': f['sessionId']})
        cdp.on('Page.screencastFrame', on)
        pg.goto(url, wait_until='commit')
        cdp.send('Page.startScreencast', {'format':'jpeg','quality':92,'maxWidth':vp[0]*scale,'maxHeight':vp[1]*scale})
        script(pg); cdp.send('Page.stopScreencast'); b.close()
    with open(out+'_list.txt','w') as f:
        for i,(fn,ts) in enumerate(frames):
            dur = (frames[i+1][1]-ts) if i+1 < len(frames) else .04
            f.write(f"file '{os.path.abspath(fn)}'\nduration {max(dur,.001):.4f}\n")
        f.write(f"file '{os.path.abspath(frames[-1][0])}'\n")
    subprocess.run(['ffmpeg','-y','-loglevel','error','-f','concat','-safe','0','-i',out+'_list.txt','-vf','fps=30,scale=trunc(iw/2)*2:trunc(ih/2)*2,format=yuv420p','-c:v','libx264','-crf','18','-movflags','+faststart',out+'.mp4'], check=True)
