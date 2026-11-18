import zlib, struct, sys
w, h = 100, 60  # non-square on purpose: must be fitted into the icon box
rows = b''
for y in range(h):
    rows += b'\x00' + b''.join(bytes((255, 40, 40, 255)) if (x - 50) ** 2 + (y - 30) ** 2 < 28 ** 2 else bytes((0, 0, 0, 0)) for x in range(w))
def chunk(t, d): return struct.pack('>I', len(d)) + t + d + struct.pack('>I', zlib.crc32(t + d) & 0xffffffff)
open(sys.argv[1], 'wb').write(b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', struct.pack('>IIBBBBB', w, h, 8, 6, 0, 0, 0)) + chunk(b'IDAT', zlib.compress(rows)) + chunk(b'IEND', b''))
