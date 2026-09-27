import json,sys
from PIL import Image, ImageDraw
m=json.load(open('sababi.json')); C=m['colors']
def draw(face,cell,bg):
    g=m['grid']; W=len(g[0]); H=len(g)
    im=Image.new('RGB',(W*cell+2*cell,H*cell+2*cell),bg); d=ImageDraw.Draw(im)
    for y,row in enumerate(g):
        for x,ch in enumerate(row):
            if ch!='.': d.rectangle([cell+x*cell,cell+y*cell,cell+(x+1)*cell-1,cell+(y+1)*cell-1],fill=C[ch])
    for x,y,w,h,k in m['faces'][face]:
        d.rectangle([cell+x*cell,cell+y*cell,cell+(x+w)*cell-1,cell+(y+h)*cell-1],fill=C[k])
    return im
faces=list(m['faces'].keys())
tiles=[draw(f,10,'#F4F5F0') for f in faces]
w,h=tiles[0].size
out=Image.new('RGB',(w*4,h*2+80),'#0B1B2E')
for i,t in enumerate(tiles): out.paste(t,((i%4)*w,(i//4)*h))
small=draw('idle',2,'#F4F5F0'); out.paste(small,(10,h*2+10))
small2=draw('idle',2,'#0B1B2E'); out.paste(small2,(80,h*2+10))
out.save(sys.argv[1]); print(faces)
