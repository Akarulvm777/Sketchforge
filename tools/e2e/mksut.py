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
        'BrushSpraySize INTEGER', 'BrushSprayDensity INTEGER', 'BrushRotationEffectorInSpray INTEGER', 'BrushRotationRandomInSpray INTEGER', 'BrushHueChange INTEGER', 'BrushChangePatternColor INTEGER', 'BrushUseWaterEdge INTEGER', 'GradationData BLOB', 'BrushRotation INTEGER']
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
import struct
def eff(bits, mn=0, curve=None):  # real effector layout: header, input bits @8 (16 = pressure), minimum % @12, then curve blocks
    b = struct.pack('>IIIII', 0x30, 0x1f0, bits, mn, 0) + bytes(28)
    if curve: b += struct.pack('>III', 12, len(curve), 16) + b''.join(struct.pack('>dd', x, y) for x, y in curve)
    return b
eff_pressure = eff(16)
sut('ink_pen.sut', [('Inking pen', dict(Opacity=100, BrushSize=8, BrushSizeEffector=eff_pressure, BrushFlow=100, BrushHardness=100, BrushInterval=8, AntiAlias=2))])
tips = b'HDR\0' + png('star') + b'SEP\0' + png('circle', (220, 40, 160, 255)) + b'SEP\0' + png('square')
sut('stars_deco.sut', [('Sparkle stars', dict(Opacity=100, BrushSize=120, BrushFlow=100, BrushHardness=100, BrushInterval=30, BrushUsePatternImage=1, BrushPatternImageArray=tips,
    BrushPatternOrderType=3, BrushUseSpray=1, BrushSpraySize=40, BrushSprayDensity=4, BrushRotationEffectorInSpray=129, BrushRotationRandomInSpray=100, BrushHueChange=30, BrushChangePatternColor=1))])
sut('sunset_gradient.sut', [('Sunset gradation', dict(Opacity=100, GradationData=b'\x00\x01gradient-data'))])
sut('soft_blur.sut', [('Soft blur', dict(Opacity=100, BrushSize=60, BrushFlow=50, BrushHardness=20, BrushInterval=10))])
sut('hard_eraser.sut', [('Hard eraser', dict(Opacity=100, BrushSize=30, BrushFlow=100, BrushHardness=100, BrushInterval=8))])
sut('spray.sut', [('Fine spray', dict(Opacity=100, BrushSize=50, BrushFlow=30, BrushHardness=10, BrushInterval=10, BrushUseSpray=1, BrushSpraySize=100, BrushSprayDensity=40))])
sut('watercolor.sut', [('Wet watercolor', dict(Opacity=80, BrushSize=40, BrushFlow=40, BrushHardness=40, BrushInterval=10, BrushUseWaterEdge=1))])
sut('fill.sut', [('Refer other layers', dict(Opacity=100))])
sut('set_two.sut', [('Pencil 2B', dict(Opacity=100, BrushSize=6, BrushFlow=80, BrushHardness=70, BrushInterval=10)), ('Flower lace', dict(Opacity=100, BrushSize=30, BrushFlow=100, BrushHardness=100, BrushInterval=90, BrushUsePatternImage=1, BrushPatternImageArray=b'X' + png('circle')))])
# real Clip Studio structures: a gradient with GradationData stops (NodeInputOp 52), and a pen whose tip and texture are
# materials (MaterialFile = tar archive with thumbnail/thumbnail.png; the setting names it in UTF-16LE)
import struct, tarfile
def grad_blob(stops):
    head = struct.pack('>III', 24, 28, len(stops)) + struct.pack('>III', 16, 1, 3)
    body = b''.join(bytes([r] * 4 + [g] * 4 + [b] * 4 + [255] * 4) + struct.pack('>III', 16, int(p * 0x8000), 0) for p, (r, g, b) in stops)
    return head + body + bytes(40)
def sut_raw(name, node_sql, var_cols, nodes, mats=()):
    p = os.path.join(out, name)
    if os.path.exists(p): os.remove(p)
    db = sqlite3.connect(p)
    db.execute('CREATE TABLE Node (_PW_ID INTEGER PRIMARY KEY, NodeName TEXT, NodeVariantID INTEGER, NodeInputOp INTEGER)')
    db.execute('CREATE TABLE Variant (' + var_cols + ')')
    db.execute('CREATE TABLE MaterialFile (_PW_ID INTEGER PRIMARY KEY, OriginalPath TEXT, FileData BLOB, CatalogPath TEXT)')
    for i, (nm, op, v) in enumerate(nodes, 1):
        db.execute('INSERT INTO Node (NodeName, NodeVariantID, NodeInputOp) VALUES (?, ?, ?)', (nm, i, op))
        keys = ['VariantID'] + list(v); db.execute(f'INSERT INTO Variant ({",".join(keys)}) VALUES ({",".join("?" * len(keys))})', [i] + list(v.values()))
    for cat, pngdata in mats:
        tb = io.BytesIO()
        with tarfile.open(fileobj=tb, mode='w', format=tarfile.USTAR_FORMAT) as t:
            for fn, data in (('catalog.zip', b'x'), ('thumbnail/thumbnail.png', pngdata)):
                ti = tarfile.TarInfo(fn); ti.size = len(data); t.addfile(ti, io.BytesIO(data))
        db.execute('INSERT INTO MaterialFile (OriginalPath, FileData, CatalogPath) VALUES (?, ?, ?)', (cat + ':data:material_0.layer', tb.getvalue(), cat))
    db.commit(); db.close()
sut_raw('real_gradient.sut', '', 'VariantID INTEGER PRIMARY KEY, Opacity INTEGER, GradationData BLOB, GradationShapeKind INTEGER',
        [('Venice sky', 52, dict(Opacity=100, GradationData=grad_blob([(0, (61, 6, 37)), (0.306, (69, 61, 170)), (0.747, (233, 133, 145)), (1, (249, 229, 176))]), GradationShapeKind=0))])
def ref(cat): return bytes(16) + (cat + ':data:material_0.layer').encode('utf-16-le') + bytes(8)
def heart_png():  # a white heart in a cloud of dark dots: dark = ink in Clip Studio materials
    im = Image.new('RGBA', (120, 120), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
    for y in range(4, 116, 6):
        for x in range(4, 116, 6): d.ellipse([x, y, x + 3, y + 3], fill=(0, 0, 0, 255))
    d.ellipse([30, 34, 62, 66], fill=(255, 255, 255, 255)); d.ellipse([58, 34, 90, 66], fill=(255, 255, 255, 255)); d.polygon([(32, 56), (88, 56), (60, 92)], fill=(255, 255, 255, 255))
    b = io.BytesIO(); im.save(b, 'PNG'); return b.getvalue()
def grid_png():
    im = Image.new('RGBA', (120, 120), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
    for k in range(0, 120, 12): d.line([(k, 0), (k, 119)], fill=(0, 0, 0, 255)); d.line([(0, k), (119, k)], fill=(0, 0, 0, 255))
    b = io.BytesIO(); im.save(b, 'PNG'); return b.getvalue()
TIP, TEX = '.:01:74:7153550f42-bf4d-7483-1ef4-a89f02062d', '.:99:62:21e7883a15-234c-4c87-ba44-90faff304c'
sut_raw('material_pen.sut', '', 'VariantID INTEGER PRIMARY KEY, Opacity INTEGER, BrushSize REAL, BrushFlow INTEGER, BrushHardness INTEGER, BrushInterval REAL, BrushUsePatternImage INTEGER, BrushPatternImageArray BLOB, TextureImage BLOB, TextureDensity INTEGER, TextureScale2 REAL, BrushChangePatternColor INTEGER, BrushHueChange INTEGER, BrushUseWaterColor INTEGER',
        [('4カケペンm', 10, dict(Opacity=100, BrushSize=25, BrushFlow=100, BrushHardness=1, BrushInterval=10, BrushUsePatternImage=1, BrushPatternImageArray=ref(TIP), TextureImage=ref(TEX), TextureDensity=80, TextureScale2=100, BrushChangePatternColor=0, BrushHueChange=178, BrushUseWaterColor=0)),
         ('ハートと光', 10, dict(Opacity=100, BrushSize=45, BrushFlow=100, BrushHardness=100, BrushInterval=100, BrushUsePatternImage=1, BrushPatternImageArray=ref(TIP), TextureImage=None, TextureDensity=50, TextureScale2=100, BrushChangePatternColor=0, BrushHueChange=0, BrushUseWaterColor=0))],
        mats=[(TIP, heart_png()), (TEX, grid_png())])
# colour mixing, blending mode, pressure curve + minimum, thin start, a setting Sketchforge does not use (ink stickiness)
def inout(size_amount):  # start / end targets: (id, on, amount) entries, 1001 = size
    ents = [(1001, 1 if size_amount else 0, size_amount), (1021, 0, 0)]
    return struct.pack('>IIII', 12, len(ents), 12, 0x70) + bytes(8) + b''.join(struct.pack('>III', *e) for e in ents)
MIXCOLS = ('VariantID INTEGER PRIMARY KEY, Opacity INTEGER, CompositeMode INTEGER, BrushSize REAL, BrushSizeEffector BLOB, BrushFlow INTEGER, BrushFlowEffector BLOB, BrushHardness INTEGER, BrushInterval REAL, '
           'BrushUseWaterColor INTEGER, BrushWaterColor INTEGER, BrushMixColor INTEGER, BrushMixAlpha INTEGER, BrushMixColorExtension INTEGER, BrushUseIn INTEGER, BrushInLength REAL, BrushInOutTarget BLOB, '
           'Stickness INTEGER, BrushThickness INTEGER')
sut_raw('real_settings.sut', '', MIXCOLS, [
    ('Thick paint', 10, dict(Opacity=100, CompositeMode=0, BrushSize=40, BrushSizeEffector=eff(16, 31), BrushFlow=60, BrushFlowEffector=eff(16), BrushHardness=100, BrushInterval=10,
        BrushUseWaterColor=1, BrushWaterColor=1, BrushMixColor=35, BrushMixAlpha=40, BrushMixColorExtension=47, BrushUseIn=0, BrushInLength=20, BrushInOutTarget=inout(0), Stickness=0, BrushThickness=100)),
    ('Multiply liner', 11, dict(Opacity=100, CompositeMode=2, BrushSize=10, BrushSizeEffector=eff(16, 35, [(0, 0), (0.78, 0.25), (1, 1)]), BrushFlow=100, BrushFlowEffector=eff(0), BrushHardness=100, BrushInterval=10,
        BrushUseWaterColor=0, BrushWaterColor=0, BrushMixColor=50, BrushMixAlpha=50, BrushMixColorExtension=10, BrushUseIn=1, BrushInLength=12, BrushInOutTarget=inout(100), Stickness=20, BrushThickness=100))])
with zipfile.ZipFile(os.path.join(out, 'pack.zip'), 'w', zipfile.ZIP_DEFLATED) as z:
    for f in ('ink_pen.sut', 'spray.sut', 'set_two.sut'): z.write(os.path.join(out, f), 'My brushes/' + f)
print('sut files in', out)
