#!/usr/bin/env python3
"""Print a PSD file's header and layer records as they are in the file (no PSD library).

    python3 tools/e2e/psdinfo.py file.psd
Used by psdtest when a PSD made by ImageMagick does not open as expected, to show what that ImageMagick wrote.
"""
import struct, sys


def info(path):
    d = open(path, 'rb').read()
    sig, ver = d[:4], struct.unpack('>H', d[4:6])[0]
    ch, h, w, depth, mode = struct.unpack('>HIIHH', d[12:26])
    out = [f'{sig.decode(errors="replace")} v{ver} {w}x{h} channels {ch} depth {depth} mode {mode} ({len(d)} bytes)']
    o = 26
    o += 4 + struct.unpack('>I', d[o:o + 4])[0]          # colour mode data
    o += 4 + struct.unpack('>I', d[o:o + 4])[0]          # image resources
    big = ver == 2
    lm_len = struct.unpack('>Q' if big else '>I', d[o:o + (8 if big else 4)])[0]; o += 8 if big else 4
    li_len = struct.unpack('>Q' if big else '>I', d[o:o + (8 if big else 4)])[0]; o += 8 if big else 4
    out.append(f'layer & mask {lm_len} bytes, layer info {li_len} bytes')
    if not li_len:
        return out
    n = struct.unpack('>h', d[o:o + 2])[0]; o += 2
    out.append(f'{n} layers')
    for _ in range(abs(n)):
        t, l, b, r, nc = struct.unpack('>iiiiH', d[o:o + 18]); o += 18
        chans = []
        for _ in range(nc):
            cid = struct.unpack('>h', d[o:o + 2])[0]
            clen = struct.unpack('>Q' if big else '>I', d[o + 2:o + (10 if big else 6)])[0]
            chans.append(f'{cid}:{clen}'); o += 10 if big else 6
        bsig, bkey = d[o:o + 4], d[o + 4:o + 8]; opac, clip, flags = d[o + 8], d[o + 9], d[o + 10]; o += 12
        extra = struct.unpack('>I', d[o:o + 4])[0]; e = o + 4
        mlen = struct.unpack('>I', d[e:e + 4])[0]; e += 4 + mlen
        rlen = struct.unpack('>I', d[e:e + 4])[0]; e += 4 + rlen
        name = d[e + 1:e + 1 + d[e]].decode('latin-1')
        out.append(f'  "{name}" top {t} left {l} bottom {b} right {r} ({r - l}x{b - t}) channels {" ".join(chans)} blend {bsig}{bkey} opacity {opac} flags {flags} mask {mlen}')
        o += 4 + extra
    return out


if __name__ == '__main__':
    for f in sys.argv[1:]:
        print('\n'.join(info(f)))
