"""Audit every saved browser frame for dimensions, blank frames and exact repeats."""
import argparse, hashlib, json
from pathlib import Path
import numpy as np
from PIL import Image
p=argparse.ArgumentParser();p.add_argument('directory');p.add_argument('--frames',type=int,default=720);p.add_argument('--fps',type=int,default=24);p.add_argument('--width',type=int,default=1280);p.add_argument('--height',type=int,default=720);args=p.parse_args()
root=Path(args.directory);records=[];hashes=set();decoded_hashes=set();previous=None;failures=[]
cuts={round(t*args.fps) for t in (8,14,20,25)}
for i in range(args.frames):
 path=root/f'frame-{i:04}.png'
 if not path.exists():failures.append(f'Missing {path.name}');continue
 data=path.read_bytes();digest=hashlib.sha256(data).hexdigest();hashes.add(digest)
 im=Image.open(path).convert('RGB');decoded_hashes.add(hashlib.sha256(im.tobytes()).hexdigest());small=np.asarray(im.resize((96,54)),dtype=float)
 if im.size!=(args.width,args.height):failures.append(f'{path.name} dimensions {im.size}')
 if small.std()<2:failures.append(f'{path.name} effectively blank')
 records.append({'frame':i,'luminance':float(small.mean()),'std':float(small.std()),'difference':float(np.abs(small-previous).mean()) if previous is not None else None,'sha256':digest})
 previous=small
if len(decoded_hashes)!=args.frames:failures.append(f'Only {len(decoded_hashes)} distinct decoded frames of {args.frames}')
motion=[r['difference'] for r in records if r['difference'] is not None and r['frame'] not in cuts]
threshold=max(10.0,float(np.median(motion))*8) if motion else 10.0
jumps=[r['frame'] for r in records if r['difference'] is not None and r['frame'] not in cuts and r['difference']>threshold]
if jumps:failures.append(f'Unexplained motion jumps at {jumps}')
report={'frames':len(records),'expectedFrames':args.frames,'fps':args.fps,'durationSeconds':args.frames/args.fps,'dimensions':[args.width,args.height],'uniqueFrames':len(hashes),'uniqueDecodedFrames':len(decoded_hashes),'expectedCutFrames':sorted(cuts),'motionJumpThreshold':threshold,'motionJumpFrames':jumps,'failures':failures,'records':records}
(root/'frames-verification.json').write_text(json.dumps(report,indent=2))
print(json.dumps({k:v for k,v in report.items() if k!='records'},indent=2))
raise SystemExit(bool(failures))
