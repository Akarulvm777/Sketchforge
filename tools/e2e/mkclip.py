"""Makes small Clip Studio .clip files with the structures found in real files (checked 23/11/2026 against an
illustration and an animation from the user; those files are private and not in the repository).
  layers.clip : 600x400; Paper, a red square (Multiply, 50 %), a hidden green layer, a folder with a blue layer
                and a yellow layer clipped to it, a "Layer color" sketch, a layer moved by an offset.
  anim.clip   : 300x200, 24 fps, 48 frames; an animation folder with cels "A" (red), "B" (blue) and a folder cel
                "C" (green + small red square); clip 1 on frames 0..12 shows A at 0, B at 6; clip 2 on 20..30
                shows C (its own timing starts at 5); an audio layer with a 1 s beep (wav).
Usage: python3 mkclip.py OUT_DIR"""
import sys, os, struct, zlib, sqlite3, tempfile, io
from PIL import Image

def blocks_for(img):
    """img: RGBA PIL image → (attribute blob, external data with one record per 256x256 tile)"""
    W, H = img.size; bx, by = (W + 255) // 256, (H + 255) // 256
    out = b''
    for t in range(bx * by):
        tile = img.crop(((t % bx) * 256, (t // bx) * 256, (t % bx) * 256 + 256, (t // bx) * 256 + 256))
        r, g, b, a = tile.split()
        if a.getbbox() is None:
            body = struct.pack('>5I', t, 0, 256, 256, 0)
        else:
            raw = a.tobytes() + Image.merge('RGBA', (b, g, r, a)).tobytes()  # alpha plane, then BGRA
            z = zlib.compress(raw)
            body = struct.pack('>5I', t, len(raw), 256, 256, 1) + struct.pack('>I', len(z) + 4) + struct.pack('<I', len(z)) + z
        name = 'BlockDataBeginChunk'.encode('utf-16-be')
        rec = struct.pack('>I', len(name) // 2) + name + body
        out += struct.pack('>I', len(rec) + 4) + rec
    out += struct.pack('>I', 11) + 'BlockStatus'.encode('utf-16-be')  # the trailer real files have
    pname = 'Parameter'.encode('utf-16-be')
    attr = struct.pack('>4I', 16, 102, 42, 0) + struct.pack('>I', 9) + pname + struct.pack('>4I', bx * 256, by * 256, bx, by) + b'\0' * 32
    return attr, out

def binc(strings, records):
    """the small object format of TrackActionMixer2: header, string table, then [key][type][value] records"""
    d = b'cmt 0110binc' + b'\xd7\xb7\x01\xd7' + struct.pack('<I', len(strings))
    for s in strings: d += bytes([len(s)]) + s.encode('latin1')
    for r in records: d += r
    return d

def make(path, W, H, layers, root_children, timeline=None, tracks=(), sound=None):
    """layers: dict id → dict(name, type, folder, vis, opacity, comp, clip, next, first, img, ox, oy, color)"""
    tmp = tempfile.mktemp(suffix='.db'); c = sqlite3.connect(tmp); ext = []
    c.execute('create table Canvas (_PW_ID INTEGER PRIMARY KEY, MainId, CanvasWidth, CanvasHeight, CanvasResolution, CanvasRootFolder)')
    c.execute('insert into Canvas values (1, 1, ?, ?, 72.0, 1)', (float(W), float(H)))
    c.execute('create table Layer (_PW_ID INTEGER PRIMARY KEY, MainId, LayerName, LayerType, LayerClip, LayerMasking, LayerOffsetX, LayerOffsetY, LayerRenderOffscrOffsetX, LayerRenderOffscrOffsetY, LayerOpacity, LayerComposite, LayerFolder, LayerVisibility, LayerNextIndex, LayerFirstChildIndex, LayerUuid, LayerRenderMipmap, LayerLayerMaskMipmap, DrawColorEnable, DrawColorMainRed, DrawColorMainGreen, DrawColorMainBlue, DrawColorSubRed, DrawColorSubGreen, DrawColorSubBlue)')
    c.execute('create table Mipmap (_PW_ID INTEGER PRIMARY KEY, MainId, LayerId, MipmapCount, BaseMipmapInfo)')
    c.execute('create table MipmapInfo (_PW_ID INTEGER PRIMARY KEY, MainId, LayerId, ThisScale, Offscreen, NextIndex)')
    c.execute('create table Offscreen (_PW_ID INTEGER PRIMARY KEY, MainId, LayerId, Attribute, BlockData)')
    c.execute('create table CanvasPreview (_PW_ID INTEGER PRIMARY KEY, MainId, CanvasId, ImageType, ImageWidth, ImageHeight, ImageData)')
    pv = io.BytesIO(); Image.new('RGB', (W, H), 'white').save(pv, 'PNG')
    c.execute('insert into CanvasPreview values (1, 1, 1, 1, ?, ?, ?)', (W, H, pv.getvalue()))
    c.execute('create table TimeLine (_PW_ID INTEGER PRIMARY KEY, MainId, FrameRate, StartFrame, EndFrame)')
    c.execute('create table Track (_PW_ID INTEGER PRIMARY KEY, MainId, TrackKind, LayerUuidWithTrack, TrackActionMixer2)')
    if timeline: c.execute('insert into TimeLine values (1, 1, ?, ?, ?)', timeline)
    c.execute('insert into Layer (MainId, LayerName, LayerType, LayerFolder, LayerVisibility, LayerOpacity, LayerComposite, LayerFirstChildIndex, LayerNextIndex) values (1, "", 256, 1, 1, 256, 0, ?, 0)', (root_children,))
    for lid, L in layers.items():
        mip = 0
        if L.get('img') is not None:
            attr, data = blocks_for(L['img']); eid = 'extrnlid%032X' % (0xABC000 + lid); ext.append((eid, data))
            c.execute('insert into Offscreen (MainId, LayerId, Attribute, BlockData) values (?, ?, ?, ?)', (1000 + lid, lid, attr, eid.encode()))
            c.execute('insert into MipmapInfo (MainId, LayerId, ThisScale, Offscreen, NextIndex) values (?, ?, 100.0, ?, 0)', (2000 + lid, lid, 1000 + lid))
            c.execute('insert into Mipmap (MainId, LayerId, MipmapCount, BaseMipmapInfo) values (?, ?, 1, ?)', (3000 + lid, lid, 2000 + lid)); mip = 3000 + lid
        col = L.get('color')
        c.execute('insert into Layer values (NULL, ?,?,?,?,0, 0,0, ?,?, ?,?,?,?, ?,?, ?, ?, 0, ?, ?,?,?, ?,?,?)',
                  (lid, L['name'], L.get('type', 1), L.get('clip', 0), L.get('ox', 0), L.get('oy', 0), L.get('opacity', 256), L.get('comp', 0),
                   L.get('folder', 0), L.get('vis', 1), L.get('next', 0), L.get('first', 0), '%010x-0000-0000-0000-%010x' % (lid, lid), mip,
                   1 if col else 0, *(col or (None,) * 6)))
    for tid, (lid, clips) in enumerate(tracks, 1):
        S = ['null', 'Double', 'Double[]', 'String[]', 'TimeClip', 'Start', 'End', 'MotionClip', 'Frame', 'Tag']
        recs = []
        for ts, te, ls, le, frames, tags in clips:
            for s, e in ((ts, te), (ls, le)):
                recs.append(struct.pack('<2Id', S.index('Start'), 8, s)); recs.append(struct.pack('<2Id', S.index('End'), 8, e))
            recs.append(struct.pack('<3I', S.index('Frame'), 14, len(frames)) + struct.pack('<%dd' % len(frames), *frames))
            for t in tags:
                if t not in S: S.append(t)
            recs.append(struct.pack('<3I', S.index('Tag'), 17, len(tags)) + struct.pack('<%dI' % len(tags), *[S.index(t) for t in tags]))
        d = binc(S, recs); eid = 'extrnlid%032X' % (0xDEF000 + tid); ext.append((eid, struct.pack('<I', len(d)) + zlib.compress(d)))
        uuid = bytes.fromhex('%010x' % lid + '0' * 12 + '%010x' % lid)
        c.execute('insert into Track (MainId, TrackKind, LayerUuidWithTrack, TrackActionMixer2) values (?, 2000, ?, ?)', (tid, uuid, eid.encode()))
    if sound:  # an audio layer's file: CanvasItem (Audio) → CanvasItemBinary → external data
        c.execute('create table CanvasItem (_PW_ID INTEGER PRIMARY KEY, MainId, ItemType, ItemCaption, ItemFileExtension, ItemBinaryMainIndex)')
        c.execute('create table CanvasItemBinary (_PW_ID INTEGER PRIMARY KEY, MainId, ItemId, ItemBinaryData)')
        eid = 'extrnlid%032X' % 0x50D; ext.append((eid, sound))
        c.execute("insert into CanvasItem values (1, 1, 'Audio', 'beep', 'wav', 1)")
        c.execute('insert into CanvasItemBinary values (1, 1, 1, ?)', (eid.encode(),))
    c.commit(); c.close(); db = open(tmp, 'rb').read(); os.remove(tmp)
    body = b'CHNKHead' + struct.pack('>Q', 40) + b'\0' * 40
    for eid, data in ext:
        e = struct.pack('>Q', len(eid)) + eid.encode() + struct.pack('>Q', len(data)) + data
        body += b'CHNKExta' + struct.pack('>Q', len(e)) + e
    body += b'CHNKSQLi' + struct.pack('>Q', len(db)) + db + b'CHNKFoot' + struct.pack('>Q', 0)
    open(path, 'wb').write(b'CSFCHUNK' + struct.pack('>Q', 24 + len(body)) + b'\0' * 8 + body)

def rect(W, H, box, color):
    im = Image.new('RGBA', (W, H)); im.paste(Image.new('RGBA', (box[2] - box[0], box[3] - box[1]), color), box[:2]); return im

if __name__ == '__main__':
    out = sys.argv[1] if len(sys.argv) > 1 else '.'; os.makedirs(out, exist_ok=True)
    W, H = 600, 400
    BLUE32 = [int(v / 255 * 4294967295) for v in (40, 120, 230)]
    layers = {
        10: dict(name='Paper', type=1584, next=11),
        11: dict(name='Red multiply', img=rect(W, H, (50, 50, 150, 150), (255, 0, 0, 255)), comp=2, opacity=128, next=12),
        12: dict(name='Green hidden', img=rect(W, H, (200, 50, 300, 150), (0, 255, 0, 255)), vis=0, next=13),
        13: dict(name='Shapes', folder=1, first=14, next=16),
        14: dict(name='Blue', img=rect(W, H, (350, 50, 450, 150), (0, 0, 255, 255)), next=15),
        15: dict(name='Yellow clipped', img=rect(W, H, (400, 0, 600, 200), (255, 255, 0, 255)), clip=1),
        16: dict(name='Sketch', img=rect(W, H, (50, 250, 150, 350), (0, 0, 0, 255)), color=BLUE32 + [4294967295] * 3, next=17),
        17: dict(name='Moved', img=rect(W, H, (0, 0, 50, 50), (255, 0, 255, 255)), ox=500, oy=300),
    }
    make(os.path.join(out, 'layers.clip'), W, H, layers, 10)
    W, H = 300, 200
    alayers = {
        10: dict(name='Paper', type=1584, next=20),
        20: dict(name='Animation folder', folder=17, first=21),
        21: dict(name='A', img=rect(W, H, (10, 10, 60, 60), (255, 0, 0, 255)), next=22),
        22: dict(name='B', img=rect(W, H, (100, 10, 150, 60), (0, 0, 255, 255)), next=23),
        23: dict(name='C', folder=1, first=24),
        24: dict(name='green', img=rect(W, H, (10, 100, 60, 150), (0, 200, 0, 255)), next=25),
        25: dict(name='dot', img=rect(W, H, (20, 110, 30, 120), (255, 0, 0, 255))),
        26: dict(name='beep', type=8720),
    }
    alayers[20]['next'] = 26
    import wave, math
    wb = io.BytesIO(); w = wave.open(wb, 'wb'); w.setnchannels(1); w.setsampwidth(2); w.setframerate(8000)
    w.writeframes(b''.join(struct.pack('<h', int(8000 * math.sin(i / 8000 * 2 * math.pi * 440))) for i in range(8000))); w.close()
    make(os.path.join(out, 'anim.clip'), W, H, alayers, 10, timeline=(24.0, 0.0, 48.0),
         tracks=[(20, [(0.0, 12.0, 0.0, 12.0, [0.0, 6.0], ['A', 'B']), (20.0, 30.0, 5.0, 15.0, [5.0], ['C'])])], sound=wb.getvalue())
    print('clip files in', out)
