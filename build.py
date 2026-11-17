#!/usr/bin/env python3
"""Concatenate parts/p*.js (sorted by filename) into app.js, then syntax-check with node."""
import glob, os, subprocess, sys
root = os.path.dirname(os.path.abspath(__file__))
parts = sorted(glob.glob(os.path.join(root, 'parts', 'p*.js')))
if not parts:
    sys.exit('no parts found in parts/')
src = '\n'.join(open(p, encoding='utf-8').read() for p in parts)
out = os.path.join(root, 'app.js')
open(out, 'w', encoding='utf-8', newline='\n').write(src)
print('built', len(src), 'bytes from', [os.path.basename(p) for p in parts])
r = subprocess.run(['node', '--check', out], capture_output=True, text=True)
print(r.stderr or 'syntax OK')
sys.exit(r.returncode)
