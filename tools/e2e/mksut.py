"""Clip Studio-like sub tool files (.sut = SQLite) of every kind, for suttest (python3 mksut.py OUT)."""
import io, os, sqlite3, sys, zipfile
from PIL import Image, ImageDraw
out = os.path.join(sys.argv[1] if len(sys.argv) > 1 else '/tmp/sf-e2e', 'sut'); os.makedirs(out, exist_ok=True)
def png(shape, colour=None, size=64):
    im = Image.new('RGBA', (size, size), (0, 0, 0, 0)); d = ImageDraw.Draw(im); c = colour or (0, 0, 0, 255)
    if shape == 'star': d.polygon([(32, 2), (40, 24), (62, 24), (44, 38), (52, 62), (32, 48), (12, 62), (20, 38), (2, 24), (24, 24)], fill=c)
    elif shape == 'circle': d.ellipse([6, 6, 58, 58], fill=c)
    else: d.rectangle([12, 12, 52, 52], fill=c)
    b = io.BytesIO(); im.save(b, 'PNG'); return b.getvalue()
COLS = ['VariantID INTEGER PRIMARY KEY', 'Opacity INTEGER', 'BrushSize REAL', 'BrushSizeEffector BLOB', 'BrushFlow INTEGER', 'BrushHardness INTEGER', 'BrushInterval INTEGER',
        'AntiAlias INTEGER', 'FlickerReduction INTEGER', 'BrushUsePatternImage INTEGER', 'BrushPatternImageArray BLOB', 'BrushPatternOrderType INTEGER', 'BrushUseSpray INTEGER',
        'BrushSpraySize INTEGER', 'BrushSprayDensity INTEGER', 'BrushRotationRandom INTEGER', 'BrushHueChange INTEGER', 'BrushUseWaterEdge INTEGER', 'GradationData BLOB', 'BrushRotation INTEGER']
def sut(name, tools):
    p = os.path.join(out, name)
    if os.path.exists(p): os.remove(p)
    db = sqlite3.connect(p)
    db.execute('CREATE TABLE Node (_PW_ID INTEGER PRIMARY KEY, NodeName TEXT, NodeVariantID INTEGER)')
    db.execute('CREATE TABLE Variant (' + ', '.join(COLS) + ')')
    for i, (nm, v) in enumerate(tools, 1):
        db.execute('INSERT INTO Node (NodeName, NodeVariantID) VALUES (?, ?)', (nm, i))
        keys = ['VariantID'] + list(v); db.execute(f'INSERT INTO Variant ({",".join(keys)}) VALUES ({",".join("?" * len(keys))})', [i] + list(v.values()))
    db.commit(); db.close(); return p
eff_pressure = bytes(12) + (16).to_bytes(4, 'big')
sut('ink_pen.sut', [('Inking pen', dict(Opacity=100, BrushSize=8, BrushSizeEffector=eff_pressure, BrushFlow=100, BrushHardness=100, BrushInterval=8, AntiAlias=2))])
tips = b'HDR\0' + png('star') + b'SEP\0' + png('circle', (220, 40, 160, 255)) + b'SEP\0' + png('square')
sut('stars_deco.sut', [('Sparkle stars', dict(Opacity=100, BrushSize=40, BrushFlow=100, BrushHardness=100, BrushInterval=80, BrushUsePatternImage=1, BrushPatternImageArray=tips,
    BrushPatternOrderType=1, BrushUseSpray=1, BrushSpraySize=150, BrushSprayDensity=24, BrushRotationRandom=100, BrushHueChange=30))])
sut('sunset_gradient.sut', [('Sunset gradation', dict(Opacity=100, GradationData=b'\x00\x01gradient-data'))])
sut('soft_blur.sut', [('Soft blur', dict(Opacity=100, BrushSize=60, BrushFlow=50, BrushHardness=20, BrushInterval=10))])
sut('hard_eraser.sut', [('Hard eraser', dict(Opacity=100, BrushSize=30, BrushFlow=100, BrushHardness=100, BrushInterval=8))])
sut('spray.sut', [('Fine spray', dict(Opacity=100, BrushSize=50, BrushFlow=30, BrushHardness=10, BrushInterval=10, BrushUseSpray=1, BrushSpraySize=100, BrushSprayDensity=40))])
sut('watercolor.sut', [('Wet watercolor', dict(Opacity=80, BrushSize=40, BrushFlow=40, BrushHardness=40, BrushInterval=10, BrushUseWaterEdge=1))])
sut('fill.sut', [('Refer other layers', dict(Opacity=100))])
sut('set_two.sut', [('Pencil 2B', dict(Opacity=100, BrushSize=6, BrushFlow=80, BrushHardness=70, BrushInterval=10)), ('Flower lace', dict(Opacity=100, BrushSize=30, BrushFlow=100, BrushHardness=100, BrushInterval=90, BrushUsePatternImage=1, BrushPatternImageArray=b'X' + png('circle')))])
with zipfile.ZipFile(os.path.join(out, 'pack.zip'), 'w', zipfile.ZIP_DEFLATED) as z:
    for f in ('ink_pen.sut', 'spray.sut', 'set_two.sut'): z.write(os.path.join(out, f), 'My brushes/' + f)
print('sut files in', out)
