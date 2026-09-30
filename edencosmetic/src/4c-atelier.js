/* ================= the atelier: the first screen, drawn live on the GPU (WebGL2, no library) =================
   Honed stone on a work table under a low window sun: an olive branch beyond the corner throws soft, swaying shadows (a near
   branch crisp, a far one blurred), light thrown back from water moves in a patch of caustics, a bar of the window frame
   crosses the light. The products lie in the light and cast their own shadows; the pointer moves the sun and every shadow
   follows. The products are the store's own photos (the images the page already loaded), drawn at full light, pixels
   untouched. It starts after the page has loaded; without a GPU (software GL), without WebGL2, or when frames stay slow, the
   still plate and the DOM cutouts with their own shadows remain; reduced motion draws one still frame. An approved
   photograph (applyVisuals) takes the place of the drawn stone. */
const ATL=(()=>{
 const VS='#version 300 es\nvoid main(){vec2 p=vec2(gl_VertexID==1?3.:-1.,gl_VertexID==2?3.:-1.);gl_Position=vec4(p,0.,1.);}';
 const FOL=`
float seg(vec2 p,vec2 a,vec2 b){vec2 pa=p-a,ba=b-a;float t=clamp(dot(pa,ba)/dot(ba,ba),0.,1.);return length(pa-ba*t);}
// a leaf: an almond with a pointed tip, as a signed distance (negative inside)
float leaf(vec2 p,float len,float wid){float x=clamp(p.x/len,-1.,1.);float w=wid*(1.-x*x)*(1.-.28*x);return max(abs(p.y)-w,abs(p.x)-len);}
// an olive branch between the sun and the stone: a curved twig with leaves in pairs, each fluttering on its own
float branch(vec2 v,vec2 a,vec2 c,vec2 b,float sc,float seed,float t,out float dTwig){
 float d=1e3;dTwig=1e3;vec2 q=a;
 if(seg(v,a,b)>.2*sc)return 1e3;   // far from this branch: nothing to measure
 for(int i=1;i<=7;i++){float k=float(i)/7.;vec2 p=mix(mix(a,c,k),mix(c,b,k),k);dTwig=min(dTwig,seg(v,q,p));q=p;}
 dTwig-=.0028*sc;
 for(int i=0;i<22;i++){
  float k=.16+.84*float(i)/22.,r=h1(vec2(float(i),seed));
  vec2 p=mix(mix(a,c,k),mix(c,b,k),k),tg=normalize(mix(c-a,b-c,k));
  float side=mod(float(i),2.)<.5?1.:-1.;
  float ang=atan(tg.y,tg.x)+side*(.55+.35*r)+.12*sin(t*(1.1+r)+r*6.)+.06*sin(t*2.3+r*9.);
  float len=(.034+.022*r)*sc*(1.-.35*k*k),wid=len*.2;
  vec2 dir=vec2(cos(ang),sin(ang));
  vec2 ctr=p+dir*(len*1.05);
  vec2 lp=v-ctr;lp=vec2(dot(lp,dir),dot(lp,vec2(-dir.y,dir.x)));
  d=min(d,leaf(lp,len,wid));
 }
 return min(d,dTwig);
}
// the foliage: a near branch (crisp) and a far one (soft), swaying with a slow breeze; returns the shadow, 0 light .. 1 blocked
float plant(vec2 v,vec2 sd){
 float t=T*MOVE;
 float g=fbm(vec2(t*.05,1.3))-.5;
 vec2 o=-SUN*vec2(.05,.04);
 vec2 sw=vec2(sin(t*.31),cos(t*.27))*.012+g*.035;
 float tw;
 float dn=branch(v,vec2(-.14,-.08)+o*.4,vec2(.16,-.01)+o+sw*.5,vec2(.46,.2)+o+sw,1.1,1.,t,tw);
 float dn2=branch(v,vec2(.14,.0)+o+sw*.5,vec2(.24,-.05)+o+sw*.7,vec2(.36,-.06)+o+sw,.85,13.,t*1.1+4.,tw);
 float dn3=branch(v,vec2(-.16,.78)+o*.5,vec2(-.02,.66)+o+sw*.6,vec2(.1,.7)+o+sw,.9,21.,t*.9+1.,tw);
 float df=branch(v,vec2(-.1,.5)+o*.6,vec2(.05,.38)+o*1.4+sw*.8,vec2(.2,.24)+o*1.4+sw*1.3,1.4,7.,t*.8+2.,tw);
 float df2=branch(v,vec2(.95,-.12)+o*.6,vec2(.9,.05)+o*1.4+sw*.8,vec2(1.02,.2)+o*1.4+sw*1.2,1.6,29.,t*.7+5.,tw);
 dn=min(dn,min(dn2,dn3)); df=min(df,df2);
 float near=1.-ss(-.0035,.0035+.004*length(v),dn);
 float farS=1.-ss(-.018,.018,df);
 return max(near*.8,farS*.5);
}
`;
 const NOISE=`
float h1(vec2 p){p=fract(p*vec2(123.34,456.21));p+=dot(p,p+45.32);return fract(p.x*p.y);}
vec2 h2(vec2 p){float n=h1(p);return vec2(n,h1(p+n*17.13+3.7));}
float vn(vec2 p){vec2 i=floor(p),f=fract(p);vec2 u=f*f*(3.-2.*f);return mix(mix(h1(i),h1(i+vec2(1,0)),u.x),mix(h1(i+vec2(0,1)),h1(i+vec2(1,1)),u.x),u.y);}
float fbm(vec2 p){float s=0.,a=.5;for(int i=0;i<5;i++){s+=a*vn(p);p=mat2(1.6,1.2,-1.2,1.6)*p+11.7;a*=.5;}return s;}
float ss(float a,float b,float x){return smoothstep(a,b,x);}`;
 // pass 1, once per size: the stone itself (r mineral cloud, g vein and shell flecks, ba surface slope)
 const FS_STONE=`#version 300 es
precision highp float;out vec4 o;uniform vec2 R;uniform float DPR;${NOISE}
float hgt(vec2 p){return .55*fbm(p*5.)+.25*fbm(p*22.+3.1)+.12*vn(p*110.)+.08*vn(p*330.);}
void main(){
 vec2 css=vec2(gl_FragCoord.x,R.y-gl_FragCoord.y)/DPR,p=css/900.;
 float cloud=fbm(p*1.5+2.3);
 float w=fbm(p*2.1+7.);
 float ridge=1.-abs(fbm(p*vec2(1.1,3.2)+vec2(w*1.4,w*.4))*2.-1.);
 float vein=smoothstep(.9,.985,ridge);
 float fleck=smoothstep(.972,.992,vn(p*300.+w))*.9+smoothstep(.95,.99,vn(p*90.+4.))*.25;
 float e=.0009,hC=hgt(p),hX=hgt(p+vec2(e,0.)),hY=hgt(p+vec2(0.,e));
 vec2 g=clamp(vec2(hX-hC,hY-hC)/e*.01,-1.,1.);
 o=vec4(cloud,clamp(vein*.75+fleck*.5,0.,1.),g*.5+.5);
}`;
 // pass 2, every frame at a third of the size: the foliage shadow (soft by nature, so the lower resolution never shows)
 const FS_LEAF=`#version 300 es
precision highp float;out vec4 o;uniform vec2 R,SUN;uniform float DPR,T,MOVE,SC;uniform vec4 POOL;${NOISE}${FOL}
void main(){vec2 css=vec2(gl_FragCoord.x,R.y-gl_FragCoord.y)*SC/DPR;vec2 v=(css-POOL.xy)/POOL.z;
 vec2 sd=normalize(vec2(.8,.62)+SUN*vec2(.22,.18));o=vec4(plant(v,sd),0.,0.,1.);}`;
 // pass 3, every frame: light, shadows, caustics, the products
 const FS=`#version 300 es
precision highp float;precision highp sampler2DArray;out vec4 o;
uniform vec2 R,SUN;uniform float DPR,T,SUNK,DARK,MOVE;
uniform vec4 POOL;uniform vec3 A0,A1,A2,SC,AC;
uniform sampler2D ST,LF;uniform sampler2DArray PT;
uniform int NP;uniform vec4 PR[8],PF[8],PA[8];uniform float PL;
${NOISE}
mat2 rot(float a){float c=cos(a),s=sin(a);return mat2(c,-s,s,c);}
float vor(vec2 p,float t){vec2 g=floor(p),f=fract(p);float d1=8.,d2=8.;
 for(int j=-1;j<=1;j++)for(int i=-1;i<=1;i++){vec2 b=vec2(i,j),r=b+.5+.42*sin(t+6.2831*h2(g+b))-f;float d=dot(r,r);if(d<d1){d2=d1;d1=d;}else if(d<d2)d2=d;}
 return sqrt(d2)-sqrt(d1);}
float caus(vec2 p,float t){p+=.45*vec2(vn(p*.7+t*.12),vn(p*.7-t*.1+7.));
 float a=1.-ss(0.,.3,vor(p,t*.5)),b=1.-ss(0.,.26,vor(p*1.53+3.1,-t*.43));
 return pow(a,3.)*.55+pow(b,3.2)*.35+pow(a*b,1.5)*.9;}
// light thrown back from water somewhere beyond the table: a soft patch of moving caustics
vec3 pond(vec2 v,float t){
 vec2 c=vec2(.2,.62);vec2 e=(v-c)*vec2(1.,1.7);
 float m=(1.-ss(.05,.2,length(e)))*(.55+.45*fbm(v*6.+t*.05));
 if(m<.002)return vec3(0.);
 vec2 cp=rot(-.6)*(v*vec2(13.,19.));
 return vec3(caus(cp,t),caus(cp*1.02+.005,t),caus(cp*1.04+.01,t))*m;
}
// a point on the stone, in a product's own image coordinates (the product is laid at an angle)
vec2 loc(vec2 css,vec4 r,float a){vec2 d=css-r.xy;float c=cos(a),s=sin(a);return vec2(c*d.x+s*d.y,-s*d.x+c*d.y)/r.zw+.5;}
float inside(vec2 l){return step(0.,l.x)*step(l.x,1.)*step(0.,l.y)*step(l.y,1.);}
vec3 knee(vec3 c){return mix(c,.9+.1*(1.-exp(-(c-.9)/.1)),step(.9,c));}
void main(){
 vec2 fp=vec2(gl_FragCoord.x,R.y-gl_FragCoord.y),css=fp/DPR;
 vec4 st=texture(ST,gl_FragCoord.xy/R);
 // the stone: a warm limestone, its mineral cloud, veins and shell flecks
 vec3 alb=mix(A0,A1,ss(.25,.8,st.r));
 alb=mix(alb,A2,st.g*.5);
 vec3 n=normalize(vec3(-(st.ba*2.-1.)*.42,1.));
 // the sun: low, from beyond the upper corner of the light; the pointer moves it
 vec2 sd=normalize(vec2(.8,.62)+SUN*vec2(.22,.18));
 vec3 Ld=normalize(vec3(-sd*.95,.62));
 float ndl=max(dot(n,Ld),0.)/Ld.z;
 // the sun falls across the whole table from beyond the upper corner of the flat lay; the far side (the words) sits in a softer light
 vec2 u=(css-POOL.xy)/POOL.zw;
 vec2 w=u-SUN*vec2(.03,.025);
 float edge1=w.x+w.y*.35;
 float win=1.-ss(.95,1.55,edge1);
 win*=ss(-.35,.05,w.y+.2*w.x);
 // one bar of the window frame, far off, crosses the light as a soft diagonal
 float bar=1.-ss(.0,.02+.03*w.y,abs(w.x-.08-w.y*.42)-.012);
 win*=1.-.55*bar*ss(-.1,.3,w.y);
 // the plant, in the light's own square coordinates
 vec2 v=(css-POOL.xy)/POOL.z;
 float pls=texture(LF,gl_FragCoord.xy/R).r;
 float lit=win*(1.-pls)*SUNK;
 vec3 cs=pond(v,T*MOVE*.55+3.)*win*(1.-pls)*SUNK;
 // the products' own shadows: each blocks the sun a little beyond its edge, softer the higher it is held
 float occ=0.,ao=0.;
 for(int i=0;i<8;i++){if(i>=NP)break;
  vec4 r=PR[i],f=PF[i];float lift=PA[i].x,al=PA[i].y,an=PA[i].z,ht=PA[i].w;
  // a flat product throws a short shadow; one held above the stone (while it is laid down) a longer, softer one
  vec2 off=sd*(ht*1.35+30.*lift)*clamp(min(r.z,r.w)/110.,.6,1.5);
  vec2 l1=loc(css-off,r,an),l0=loc(css-sd*1.4,r,an);
  float texpx=PL*f.z/r.z;
  if(l1.x>-.4&&l1.x<1.4&&l1.y>-.4&&l1.y<1.4){
   float lod=log2(max(1.,(2.5+.45*ht+26.*lift)*texpx));
   float a1=textureLod(PT,vec3(f.xy+clamp(l1,0.,1.)*f.zw,float(i)),lod).a*inside(l1);
   occ=max(occ,a1*al*(.97-.4*lift));
   float a0=textureLod(PT,vec3(f.xy+clamp(l0,0.,1.)*f.zw,float(i)),log2(max(1.,3.*texpx))).a*inside(l0);
   ao=max(ao,a0*al*(1.-lift));
  }}
 lit*=1.-occ;
 vec3 amb=AC*(.92+.08*n.z)*(1.-.42*ao)*mix(1.04,.93,ss(0.,1.4,length(u)));
 vec3 col=alb*(amb+SC*lit*ndl);
 // the lit side of every shadow edge warms up, the way a low sun does
 float edge=pls*(1.-pls)*4.*win;
 col+=alb*SC*vec3(.16,.05,-.02)*edge*SUNK;
 col+=cs*SC*vec3(1.,.97,.9)*mix(.75,.3,DARK);
 col*=1.-.16*dot(fp/R-.5,fp/R-.5);
 col=knee(col);
 vec3 c=pow(max(col,0.),vec3(1./2.2));
 // the products on top, as photographed: full light, pixels untouched; shade only where a leaf passes over them
 for(int i=0;i<8;i++){if(i>=NP)break;
  vec4 r=PR[i],f=PF[i];float al=PA[i].y;vec2 l=loc(css,r,PA[i].z);
  if(l.x>=0.&&l.x<=1.&&l.y>=0.&&l.y<=1.&&al>0.){
   float lod=max(0.,log2(PL*f.z/(r.z*DPR))-.4);
   vec4 p=textureLod(PT,vec3(f.xy+l*f.zw,float(i)),lod);
   float lf=1.-.18*pls*win*SUNK;
   c=c*(1.-p.a*al)+p.rgb*al*lf;
  }}
 c+=(h1(fp+fract(T*MOVE*7.13)*91.)-.5)*.014;
 o=vec4(c,1.);
}`;
 let gl=null,cv=null,P=null,S=null,L=null,UL={},leafTex=null,leafFbo=null,LW=0,LH=0,U={},stoneTex=null,fbo=null,arr=null,W=0,H=0,dpr=1,raf=0,vis=true,on=false,still=false;
 let soft=false,items=[],t0=0,sun=[0,0],sunT=[0,0],sunK=0,hero=null,stage=null,slow=0,frames=0,quality=1,PLs=1024,lastT=0,started=0;
 const lin=h=>{const m=/^#?([0-9a-f]{6})$/i.exec(String(h).trim()); if(!m)return[.9,.85,.8]; const n=parseInt(m[1],16); return[n>>16,n>>8&255,n&255].map(v=>Math.pow(v/255,2.2));};
 const mix=(a,b,k)=>a.map((v,i)=>v+(b[i]-v)*k);
 // compile and link without asking for the result (asking waits for the GPU); the result is read once, in link()
 function src(fs){
  const sh=(t,s)=>{const x=gl.createShader(t); gl.shaderSource(x,s); gl.compileShader(x); return x;};
  const v=sh(gl.VERTEX_SHADER,VS),f=sh(gl.FRAGMENT_SHADER,fs),p=gl.createProgram(); gl.attachShader(p,v); gl.attachShader(p,f); gl.linkProgram(p); p._s=[v,f]; return p;
 }
 function link(p){ if(!gl.getProgramParameter(p,gl.LINK_STATUS))throw new Error(gl.getProgramInfoLog(p)||p._s.map(s=>gl.getShaderInfoLog(s)).join(' ')); return p; }
 // the stone: rendered once into a texture at the canvas size
 function stone(){
  if(stoneTex)gl.deleteTexture(stoneTex); if(fbo)gl.deleteFramebuffer(fbo);
  stoneTex=gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D,stoneTex);
  gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA8,W,H,0,gl.RGBA,gl.UNSIGNED_BYTE,null);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
  fbo=gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER,fbo); gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,stoneTex,0);
  gl.viewport(0,0,W,H); gl.useProgram(S); gl.uniform2f(gl.getUniformLocation(S,'R'),W,H); gl.uniform1f(gl.getUniformLocation(S,'DPR'),dpr);
  gl.drawArrays(gl.TRIANGLES,0,3); gl.bindFramebuffer(gl.FRAMEBUFFER,null);
 }
 // the products: every cutout in its own layer of one texture array, premultiplied, with mipmaps for soft shadows
 async function products(){
  const imgs=$$('.cut',stage).slice(0,8);
  const need=Math.max(...imgs.map(el=>el.offsetWidth*Math.min(devicePixelRatio||1,2)));
  PLs=need>560?1024:512;
  arr=gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D_ARRAY,arr);
  gl.texStorage3D(gl.TEXTURE_2D_ARRAY,Math.floor(Math.log2(PLs))+1,gl.RGBA8,PLs,PLs,imgs.length);
  const c=document.createElement('canvas'); c.width=c.height=PLs; const x=c.getContext('2d');
  gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL,true);
  items=[];
  for(let i=0;i<imgs.length;i++){
   const el=imgs[i], im=el;
   try{ if(!im.complete||!im.naturalWidth)await im.decode(); }catch(_){return false;}
   const pad=PLs*.04, k=Math.min((PLs-2*pad)/im.naturalWidth,(PLs-2*pad)/im.naturalHeight), w=im.naturalWidth*k, h=im.naturalHeight*k, x0=(PLs-w)/2, y0=(PLs-h)/2;
   x.clearRect(0,0,PLs,PLs); x.drawImage(im,x0,y0,w,h);
   gl.texSubImage3D(gl.TEXTURE_2D_ARRAY,0,0,0,i,PLs,PLs,1,gl.RGBA,gl.UNSIGNED_BYTE,c);
   items.push({el,f:[x0/PLs,y0/PLs,w/PLs,h/PLs],lift:1,al:0,d:+(el.dataset.d||i*.12),ht:+(el.dataset.ht||7)});
  }
  gl.generateMipmap(gl.TEXTURE_2D_ARRAY);
  gl.texParameteri(gl.TEXTURE_2D_ARRAY,gl.TEXTURE_MIN_FILTER,gl.LINEAR_MIPMAP_LINEAR); gl.texParameteri(gl.TEXTURE_2D_ARRAY,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D_ARRAY,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D_ARRAY,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
  return true;
 }
 // the foliage shadow target: a third of the canvas (soft shadows need no more)
 const LS=3;
 function leafTarget(){
  LW=Math.max(2,Math.ceil(W/LS)); LH=Math.max(2,Math.ceil(H/LS));
  if(leafTex)gl.deleteTexture(leafTex); if(leafFbo)gl.deleteFramebuffer(leafFbo);
  leafTex=gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D,leafTex);
  gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA8,LW,LH,0,gl.RGBA,gl.UNSIGNED_BYTE,null);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
  leafFbo=gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER,leafFbo); gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,leafTex,0);
  gl.bindFramebuffer(gl.FRAMEBUFFER,null);
 }
 function size(){
  const r=cv.getBoundingClientRect(), max=matchMedia('(max-width:700px)').matches?1.75:2;
  dpr=Math.min(devicePixelRatio||1,max)*quality;
  const w=Math.max(2,Math.round(r.width*dpr)), h=Math.max(2,Math.round(r.height*dpr));
  if(w!==W||h!==H){W=cv.width=w;H=cv.height=h;stone();leafTarget();}
 }
 function colors(){
  const cs=getComputedStyle(document.documentElement), g=k=>cs.getPropertyValue(k);
  const dk=matchMedia('(prefers-color-scheme: dark)').matches&&!document.documentElement.classList.contains('a-contrast');
  const paper=lin(g('--paper')),blush=lin(g('--blush')),petal=lin(g('--petal'));
  gl.useProgram(P);
  gl.uniform3fv(U.A0,mix(paper,blush,dk?.35:.12)); gl.uniform3fv(U.A1,mix(paper,blush,dk?.7:.4)); gl.uniform3fv(U.A2,dk?mix(petal,paper,.2):mix(petal,blush,.3));
  gl.uniform3fv(U.SC,dk?[1.1,.78,.56]:[.56,.45,.32]); gl.uniform3fv(U.AC,dk?[.8,.72,.8]:[.79,.74,.76]);
  gl.uniform1f(U.DARK,dk?1:0);
 }
 function draw(now){
  raf=0; if(!on)return;
  const t=(now-t0)/1000, dt=Math.min(.05,(now-(lastT||now))/1000); lastT=now;
  size();
  // the sun eases toward the pointer (a critically damped follow); on touch screens it drifts on its own
  const k=1-Math.exp(-dt*3.2); sun[0]+=(sunT[0]-sun[0])*k; sun[1]+=(sunT[1]-sun[1])*k;
  if(!hero.matches(':hover')&&!still){sunT[0]=Math.sin(t*.11)*.35; sunT[1]=Math.cos(t*.083)*.25;}
  sunK=still?1:sunK+(1-sunK)*(1-Math.exp(-dt*1.6));
  const cr=cv.getBoundingClientRect(), sr=stage.getBoundingClientRect();
  const mob=cr.width<701;
  const pool=[sr.left-cr.left-sr.width*(mob?.1:.22),sr.top-cr.top-sr.height*(mob?.12:.28),sr.width*(mob?1.2:1.5),sr.height*(mob?1.2:1.45)];
  // the foliage shadow first, into its small target
  gl.bindFramebuffer(gl.FRAMEBUFFER,leafFbo); gl.viewport(0,0,LW,LH); gl.useProgram(L);
  gl.uniform2f(UL.R,LW,LH); gl.uniform1f(UL.SC,W/LW); gl.uniform1f(UL.DPR,dpr); gl.uniform1f(UL.T,t); gl.uniform1f(UL.MOVE,still?0:1); gl.uniform2f(UL.SUN,sun[0],sun[1]); gl.uniform4f(UL.POOL,...pool);
  gl.drawArrays(gl.TRIANGLES,0,3); gl.bindFramebuffer(gl.FRAMEBUFFER,null);
  gl.viewport(0,0,W,H); gl.useProgram(P);
  gl.activeTexture(gl.TEXTURE2); gl.bindTexture(gl.TEXTURE_2D,leafTex); gl.uniform1i(U.LF,2);
  gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D,stoneTex); gl.uniform1i(U.ST,0);
  gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D_ARRAY,arr); gl.uniform1i(U.PT,1);
  gl.uniform2f(U.R,W,H); gl.uniform1f(U.DPR,dpr); gl.uniform1f(U.T,t); gl.uniform1f(U.MOVE,still?0:1); gl.uniform1f(U.SUNK,sunK); gl.uniform1f(U.PL,PLs);
  gl.uniform2f(U.SUN,sun[0],sun[1]);
  gl.uniform4f(U.POOL,...pool);
  const pr=[],pf=[],pa=[];
  items.forEach(it=>{const r=it.el.getBoundingClientRect(), a=(parseFloat(getComputedStyle(it.el).rotate)||0)*Math.PI/180;
   pr.push(r.left+r.width/2-cr.left,r.top+r.height/2-cr.top,it.el.offsetWidth,it.el.offsetHeight); pf.push(...it.f);
   const e=still?1:Math.min(1,Math.max(0,(t-started-it.d)/1.25)), s=1-Math.pow(1-e,3);
   it.lift=1-s; it.al=Math.min(1,e*2.4); pa.push(it.lift,it.al,a,it.ht);});
  const np=window.__atlPlate?0:items.length; gl.uniform1i(U.NP,np); if(np){gl.uniform4fv(U.PR,pr); gl.uniform4fv(U.PF,pf); gl.uniform4fv(U.PA,pa);}
  gl.drawArrays(gl.TRIANGLES,0,3);
  // adaptive quality: a slow GPU drops the resolution, never the scene
  if(!still&&dt>0){frames++; slow+=dt>1/34?1:0; if(frames===45){ if(slow>18){ if(quality>.6)quality=Math.max(.6,quality-.2); else { still=true; } } frames=0; slow=0; }}
  if(still){on=false;return;}
  if(vis)raf=requestAnimationFrame(draw);
 }
 function start(){ if(on||!gl)return; on=true; lastT=0; raf=requestAnimationFrame(draw); }
 function stop(){ on=false; cancelAnimationFrame(raf); raf=0; }
 async function init(){
  hero=$('#top'); stage=$('#stage'); if(!hero||!stage||hero.classList.contains('photo'))return;
  cv=document.createElement('canvas'); cv.className='atl'; cv.setAttribute('aria-hidden','true');
  try{ gl=cv.getContext('webgl2',{antialias:false,alpha:false,premultipliedAlpha:false,powerPreference:'high-performance'}); }catch(_){gl=null;}
  if(!gl)return;
  // a renderer without a GPU (software GL) gets one still frame: the same picture, no work in the background
  try{ const di=gl.getExtension('WEBGL_debug_renderer_info'); const rn=di?String(gl.getParameter(di.UNMASKED_RENDERER_WEBGL)):''; soft=/swiftshader|llvmpipe|software|basic render|softpipe/i.test(rn); }catch(_){}
  if(soft&&!/[?&]gl=1/.test(location.search)&&!window.__atlForce){ gl.getExtension('WEBGL_lose_context')?.loseContext(); gl=null; hero.dataset.atl='soft'; return; }
  const par=gl.getExtension('KHR_parallel_shader_compile');
  let pend;
  try{ pend=[FS,FS_STONE,FS_LEAF].map(src); }catch(e){ gl=null; return; }
  if(par){ const done=p=>gl.getProgramParameter(p,par.COMPLETION_STATUS_KHR); let n=0; while(!pend.every(done)&&n++<120) await new Promise(r=>setTimeout(r,25)); }
  try{ [P,S,L]=pend.map(link); }catch(e){ console.warn('atelier:',e.message); gl=null; return; }
  ['R','SUN','DPR','T','SUNK','DARK','MOVE','POOL','A0','A1','A2','SC','AC','ST','LF','PT','NP','PL'].forEach(k=>U[k]=gl.getUniformLocation(P,k));
  ['R','SUN','DPR','T','MOVE','SC','POOL'].forEach(k=>UL[k]=gl.getUniformLocation(L,k));
  U.PR=gl.getUniformLocation(P,'PR[0]'); U.PF=gl.getUniformLocation(P,'PF[0]'); U.PA=gl.getUniformLocation(P,'PA[0]');
  hero.prepend(cv);
  if(!(await products())){ cv.remove(); gl=null; return; }
  still=reduce(); hero.dataset.atl=still?'still':'live';
  colors(); matchMedia('(prefers-color-scheme: dark)').addEventListener('change',colors);
  t0=performance.now();
  // the products are laid down one by one once the page is revealed (the loader, on a first visit)
  const go=()=>{started=(performance.now()-t0)/1000+.15; hero.classList.add('gl');};
  if(document.documentElement.classList.contains('pre')){ const mo=new MutationObserver(()=>{ if(!document.documentElement.classList.contains('pre')){mo.disconnect();go();} }); mo.observe(document.documentElement,{attributes:true,attributeFilter:['class']}); } else go();
  hero.addEventListener('pointermove',e=>{ if(e.pointerType!=='mouse'||still)return; const r=hero.getBoundingClientRect(); sunT[0]=((e.clientX-r.left)/r.width-.5)*2; sunT[1]=((e.clientY-r.top)/r.height-.5)*2; });
  new IntersectionObserver(es=>es.forEach(e=>{vis=e.isIntersecting; if(vis&&!still)start(); else if(!vis)stop();}),{threshold:0}).observe(hero);
  document.addEventListener('visibilitychange',()=>{ if(document.hidden)stop(); else if(vis&&!still)start(); });
  addEventListener('resize',()=>{ if(still){on=true;draw(performance.now());} },{passive:true});
  start();
 }
 return {init,start,stop,colors:()=>gl&&colors()};
})();
