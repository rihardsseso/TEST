import numpy as np
from PIL import Image, ImageDraw
W,H=1581,1186; cx,cy=W/2,H/2
def inter(a,b,c,d):
    l1=np.cross([*a,1],[*b,1]); l2=np.cross([*c,1],[*d,1]); p=np.cross(l1,l2); return p[:2]/p[2]
# along-wall lines: eave/wall-top and wall base
vp1=inter((160,490),(1550,340),(165,700),(1450,835))
# perpendicular ground line: side row of foundation stones
vp2=inter((830,910),(920,860),(0,vp1[1]),(1,vp1[1]))
f=np.sqrt(-((vp1[0]-cx)*(vp2[0]-cx)+(vp1[1]-cy)*(vp2[1]-cy)))
print('vp1',vp1,'vp2',vp2,'f px',f,'focal36',36*f/W,'hfov',np.degrees(2*np.arctan(cx/f)))
d1=np.array([vp1[0]-cx,-(vp1[1]-cy),f]);d1/=np.linalg.norm(d1)   # world -X in cam coords (x right,y up,z fwd)
d2=np.array([vp2[0]-cx,-(vp2[1]-cy),f]);d2/=np.linalg.norm(d2)   # world +Z
X=-d1; Z=d2; Y=np.cross(Z,X)  # left-handed: Y = Z x X
R=np.stack([X,Y,Z])  # rows: world axes in cam coords -> cam->world: v_w = R @ v_c
print('Y axis',Y)
camh=160.0
# wall base point at image centre column
yb=700+(835-700)/(1450-165)*(cx-165)
ray=np.array([0,-(yb-cy),f]); rw=R@ray
t=-camh/rw[1]; P=np.array([0,camh,0])+t*rw
camZ=-P[2]  # wall plane at Z=0
cam=np.array([0,camh,camZ])
print('cam pos',cam)
fwd=R@np.array([0,0,1]); right=R@np.array([1,0,0]); up=R@np.array([0,1,0])
print('right',right,'up',up,'fwd',fwd, 'heading deg',np.degrees(np.arctan2(fwd[0],fwd[2])))
def proj(p):
    v=R.T@(np.array(p)-cam); return (cx+f*v[0]/v[2], cy-f*v[1]/v[2])
im=Image.open('maja.jpg').convert('RGB'); d=ImageDraw.Draw(im)
for x in range(-1500,1001,100): d.line([proj((x,0,0)),proj((x,400,0))],fill=(0,255,255),width=2)
for y in range(0,401,50): d.line([proj((-1500,y,0)),proj((1000,y,0))],fill=(0,255,255),width=2)
for x in range(-1500,1001,100): d.line([proj((x,0,0)),proj((x,0,max(-500,cam[2]+50+x*0.62)))],fill=(255,0,255),width=2)
for z in range(-500,1,100):
    xmax=min(1000, (z-cam[2])*fwd[2]/(-fwd[0])-50 if fwd[0]<0 else 1000)
    d.line([proj((-1500,0,z)),proj((xmax,0,z))],fill=(255,0,255),width=2)
d.line([(0,vp1[1]),(W,vp1[1])],fill=(255,255,0),width=2)
im.save('parbaude_rezgis.jpg')
