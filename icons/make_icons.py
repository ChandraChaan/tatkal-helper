"""Generate simple PNG icons without Pillow: teal rounded square with a white 'T'."""
import struct, zlib, os

def png(width, height, pixels):
    raw = b''.join(b'\x00' + bytes(row) for row in pixels)
    def chunk(tag, data):
        c = struct.pack('>I', len(data)) + tag + data
        return c + struct.pack('>I', zlib.crc32(tag + data) & 0xffffffff)
    return (b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', struct.pack('>IIBBBBB', width, height, 8, 6, 0, 0, 0))
            + chunk(b'IDAT', zlib.compress(raw, 9)) + chunk(b'IEND', b''))

def make(size):
    bg = (14, 116, 144)      # teal
    fg = (255, 255, 255)
    r = size * 0.22
    rows = []
    for y in range(size):
        row = []
        for x in range(size):
            # rounded square mask
            cx = min(max(x + 0.5, r), size - r); cy = min(max(y + 0.5, r), size - r)
            inside = (x + 0.5 - cx) ** 2 + (y + 0.5 - cy) ** 2 <= r * r
            if not inside:
                row += [0, 0, 0, 0]; continue
            # letter T: top bar and stem
            bar = size * 0.24 <= y < size * 0.38 and size * 0.22 <= x < size * 0.78
            stem = size * 0.38 <= y < size * 0.80 and size * 0.43 <= x < size * 0.57
            c = fg if (bar or stem) else bg
            row += [c[0], c[1], c[2], 255]
        rows.append(row)
    return png(size, size, rows)

here = os.path.dirname(os.path.abspath(__file__))
for s in (16, 32, 48, 128):
    with open(os.path.join(here, f'icon{s}.png'), 'wb') as f:
        f.write(make(s))
print('icons written')
