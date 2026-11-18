# psd-tools PSD (groups, hidden, multiply, all compressions), a synthetic .clip and a .sut with a texture.
import io, os, random, sqlite3, struct
from PIL import Image, ImageDraw
from psd_tools import PSDImage
from psd_tools.api.layers import PixelLayer, Group
from psd_tools.constants import Compression, BlendMode
psd = PSDImage.new('RGB', (400, 300), color=0, depth=8)
PixelLayer.frompil(Image.new('RGBA', (400, 300), (255, 255, 255, 255)), psd, 'Paper', 0, 0, Compression.ZIP)
im = Image.new('RGBA', (120, 80), (0, 0, 0, 0)); ImageDraw.Draw(im).ellipse([5, 5, 115, 75], fill=(255, 0, 0, 255))
PixelLayer.frompil(im, psd, 'Red ball', 50, 50, Compression.RLE)
g = Group.new(psd, 'Folder')
PixelLayer.frompil(Image.new('RGBA', (100, 100), (0, 200, 0, 255)), g, 'Green box', 150, 250, Compression.ZIP_WITH_PREDICTION)
g.opacity = 128
hid = PixelLayer.frompil(Image.new('RGBA', (50, 50), (0, 0, 255, 255)), psd, 'Hidden blue', 200, 10, Compression.RAW); hid.visible = False
mul = PixelLayer.frompil(Image.new('RGBA', (200, 60), (255, 255, 0, 255)), psd, 'Yellow multiply', 20, 100, Compression.RLE); mul.blend_mode = BlendMode.MULTIPLY
psd.save('test_tools.psd')
# synthetic .clip: CSFCHUNK container with an SQLite database holding Canvas + CanvasPreview
im = Image.new('RGB', (400, 300), (255, 255, 255)); d = ImageDraw.Draw(im); random.seed(1)
for i in range(3000): d.point((random.randrange(400), random.randrange(300)), fill=(random.randrange(256), 0, 0))
d.ellipse([60, 60, 160, 120], fill=(255, 0, 0)); d.rectangle([250, 150, 349, 249], fill=(0, 0, 255))
b = io.BytesIO(); im.save(b, 'PNG'); png = b.getvalue()
for f in ('t.db', 'tex.sut'):
    if os.path.exists(f): os.remove(f)
c = sqlite3.connect('t.db')
c.execute('CREATE TABLE Canvas (_PW_ID INTEGER PRIMARY KEY AUTOINCREMENT, MainId INTEGER, CanvasUnit INTEGER, CanvasWidth REAL, CanvasHeight REAL, CanvasResolution REAL)')
c.execute('INSERT INTO Canvas (MainId, CanvasUnit, CanvasWidth, CanvasHeight, CanvasResolution) VALUES (1, 0, 800, 600, 350)')
c.execute('CREATE TABLE CanvasPreview (_PW_ID INTEGER PRIMARY KEY AUTOINCREMENT, MainId INTEGER, CanvasId INTEGER, ImageType INTEGER, ImageWidth INTEGER, ImageHeight INTEGER, ImageData BLOB)')
c.execute('INSERT INTO CanvasPreview (MainId, CanvasId, ImageType, ImageWidth, ImageHeight, ImageData) VALUES (1, 1, 1, 400, 300, ?)', (png,))
c.commit(); c.close()
db = open('t.db', 'rb').read()
chunk = lambda tag, data: tag + struct.pack('>Q', len(data)) + data
body = chunk(b'CHNKHead', b'\0' * 40) + chunk(b'CHNKExta', b'\0' * 64) + chunk(b'CHNKSQLi', db) + chunk(b'CHNKFoot', b'')
open('test.clip', 'wb').write(b'CSFCHUNK' + struct.pack('>Q', 24 + len(body)) + struct.pack('>Q', 24) + body)
# .sut brush with an embedded stripe texture
st = Image.new('RGB', (64, 64), 'white')
for x in range(64):
    if (x // 8) % 2 == 0:
        for y in range(64): st.putpixel((x, y), (0, 0, 0))
st.save('stripes.png'); b = io.BytesIO(); st.save(b, 'PNG')
c = sqlite3.connect('tex.sut')
c.execute('CREATE TABLE Node (_PW_ID INTEGER PRIMARY KEY, NodeName TEXT, NodeVariantID INTEGER)')
c.execute('CREATE TABLE Variant (_PW_ID INTEGER PRIMARY KEY, VariantID INTEGER, BrushSize REAL, Opacity INTEGER, BrushFlow INTEGER, BrushHardness INTEGER, AntiAlias INTEGER, BrushInterval INTEGER, TextureImage BLOB, TextureDensity INTEGER, TextureScale2 INTEGER, TextureReverseDensity INTEGER)')
c.execute("INSERT INTO Node (NodeName, NodeVariantID) VALUES ('Stripe test brush', 1)")
c.execute('INSERT INTO Variant (VariantID, BrushSize, Opacity, BrushFlow, BrushHardness, AntiAlias, BrushInterval, TextureImage, TextureDensity, TextureScale2, TextureReverseDensity) VALUES (1, 40, 100, 100, 100, 2, 10, ?, 100, 100, 0)', (b.getvalue(),))
c.commit(); c.close()
