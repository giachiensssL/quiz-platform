import re
from pathlib import Path
import cv2, numpy as np
from rapidocr_onnxruntime import RapidOCR

root = Path('..') / 'monhoc' / '_tmdt_zip'
files = sorted(root.glob('*.jpg'))
ocr = RapidOCR()
lesson_re = re.compile(r'B\S*I\s*(\d+)', re.IGNORECASE)
opt_re = re.compile(r'^\s*([ABCD])[\.:]?\s*', re.IGNORECASE)

def ratio(img, quad):
    pts=np.array(quad,dtype=np.float32)
    x1=max(int(pts[:,0].min())-2,0); x2=min(int(pts[:,0].max())+2,img.shape[1]-1)
    y1=max(int(pts[:,1].min())-2,0); y2=min(int(pts[:,1].max())+2,img.shape[0]-1)
    if x2<=x1 or y2<=y1: return 0
    hsv=cv2.cvtColor(img[y1:y2,x1:x2],cv2.COLOR_BGR2HSV)
    m=cv2.inRange(hsv, np.array([15,70,140],dtype=np.uint8), np.array([45,255,255],dtype=np.uint8))
    return m.mean()/255.0

def cy(quad):
    return float(np.array(quad,dtype=np.float32)[:,1].mean())

def lx(quad):
    return float(np.array(quad,dtype=np.float32)[:,0].min())

for th in [0.08,0.12,0.16,0.2,0.24,0.28]:
    counts={}; lesson=None
    for f in files:
        img=cv2.imdecode(np.fromfile(str(f),dtype=np.uint8),cv2.IMREAD_COLOR)
        res,_=ocr(img)
        if not res: continue
        rows=sorted(res,key=lambda it:(cy(it[0]),lx(it[0])))
        for quad,text,conf in rows:
            t=' '.join(str(text).replace('\n',' ').split())
            m=lesson_re.search(t)
            if m:
                lesson=int(m.group(1)); counts.setdefault(lesson,[]); continue
            om=opt_re.match(t)
            if lesson and om and ratio(img,quad)>=th:
                counts[lesson].append(om.group(1).upper())
    total=sum(len(v) for v in counts.values())
    print('TH',th,'total',total,'per', {k:len(v) for k,v in sorted(counts.items())})
