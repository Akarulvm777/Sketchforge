#!/usr/bin/env python3
"""Set the app version everywhere it must match: package.json "version", index.html (<title>, ?v= on its scripts and
style, the status bar text) and sw.js (CACHE). Only those exact places change (a plain text replace once changed the
Electron version too). Semantic versioning: bug fixes = patch, new features = minor (see CLAUDE.md).
Usage: python3 tools/bump_version.py 3.3.0   then add the `## 3.3: …` section to CHANGELOG.md and run npm test."""
import json, re, sys, pathlib
root = pathlib.Path(__file__).resolve().parent.parent
new = sys.argv[1] if len(sys.argv) > 1 else ''
if not re.fullmatch(r'\d+\.\d+\.\d+', new): sys.exit('usage: bump_version.py X.Y.Z')
pkg = root / 'package.json'; data = json.loads(pkg.read_text(encoding='utf-8')); old = data['version']
text = pkg.read_text(encoding='utf-8')
text, n = re.subn(r'("version"\s*:\s*")' + re.escape(old) + '"', r'\g<1>' + new + '"', text, count=1)
assert n == 1, 'package.json version not found'
pkg.write_text(text, encoding='utf-8', newline='\n')
idx = root / 'index.html'; h = idx.read_text(encoding='utf-8'); v = re.escape(old)
h, a = re.subn(r'<title>Inkvessa ' + v + '</title>', f'<title>Inkvessa {new}</title>', h)
h, b = re.subn(r'\?v=' + v + r'(["\'])', f'?v={new}\\1', h)
h, c = re.subn(r'Inkvessa v' + v + '<', f'Inkvessa v{new}<', h)
assert a == 1 and b >= 2 and c == 1, (a, b, c)
idx.write_text(h, encoding='utf-8', newline='\n')
sw = root / 'sw.js'; t = sw.read_text(encoding='utf-8')
t, d = re.subn(r"(const CACHE = 'sketchforge-v)" + v + "'", r'\g<1>' + new + "'", t)
assert d == 1, 'sw.js CACHE not found'
sw.write_text(t, encoding='utf-8', newline='\n')
print(f'{old} -> {new}: package.json, index.html ({b} ?v= links), sw.js. Now add the CHANGELOG section and run npm test.')
