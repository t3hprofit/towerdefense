# Usage: python3 tools/make-icons.py icons
# Generates the PWA icons with Pillow: dark tile, cyan hex, pink glyph.
from PIL import Image, ImageDraw, ImageFilter
import math, sys
out = sys.argv[1]
def make(size):
    im = Image.new('RGBA', (size, size), (6, 6, 13, 255))
    d = ImageDraw.Draw(im)
    # subtle grid
    step = size // 8
    for i in range(0, size, step):
        d.line([(i, 0), (i, size)], fill=(0, 240, 255, 22), width=max(1, size // 256))
        d.line([(0, i), (size, i)], fill=(0, 240, 255, 22), width=max(1, size // 256))
    cx = cy = size / 2; R = size * 0.36
    pts = [(cx + R * math.cos(math.pi / 6 + k * math.pi / 3), cy + R * math.sin(math.pi / 6 + k * math.pi / 3)) for k in range(6)]
    glow = Image.new('RGBA', (size, size), (0, 0, 0, 0)); gd = ImageDraw.Draw(glow)
    gd.polygon(pts, outline=(0, 240, 255, 255), width=max(2, size // 24))
    glow = glow.filter(ImageFilter.GaussianBlur(size / 28))
    im.alpha_composite(glow)
    d.polygon(pts, fill=(12, 12, 24, 255), outline=(0, 240, 255, 255), width=max(2, size // 40))
    # pink triangle "turret" glyph
    r2 = size * 0.17
    tri = [(cx, cy - r2 * 1.1), (cx + r2, cy + r2 * 0.8), (cx - r2, cy + r2 * 0.8)]
    g2 = Image.new('RGBA', (size, size), (0, 0, 0, 0)); g2d = ImageDraw.Draw(g2)
    g2d.polygon(tri, fill=(255, 42, 109, 255)); g2 = g2.filter(ImageFilter.GaussianBlur(size / 40)); im.alpha_composite(g2)
    d.polygon(tri, fill=(255, 42, 109, 255))
    # yellow scan bar
    d.rectangle([size * 0.2, size * 0.82, size * 0.8, size * 0.84], fill=(252, 238, 10, 220))
    return im.convert('RGB')
for s, name in [(512, 'icon-512.png'), (192, 'icon-192.png'), (180, 'apple-touch-icon.png')]:
    make(s).save(f'{out}/{name}', optimize=True)
print('icons written')
