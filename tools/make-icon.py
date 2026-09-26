"""Draw the app icon.

    python tools/make-icon.py

Writes icons/icon-512.png, icon-192.png and icon-180.png. Needs Pillow; it is a
one-off design tool, not part of the app, so nothing the app ships depends on it.

The icon is the breath dial holding the day grid: eight segments around the
outside, six of them lit, and four day boxes inside with today in honey. Colours
are the app's own tokens from css/styles.css.

Geometry is written as fractions of the icon square and drawn at 2048px, then
downsampled, so one definition renders every size sharply. Two rules the drawing
has to respect:

  * Nothing may reach past 0.40 of the width from the centre. The manifest
    declares the 512 icon "maskable", and a maskable icon is only guaranteed the
    middle 80% — art outside that circle can be cropped off on Android.
  * Every pixel stays fully opaque. A translucent pixel is a hole once iOS masks
    the icon to its rounded square.
"""
import math
import os
from PIL import Image, ImageDraw

W = 2048  # working canvas, downsampled to each output size

SPRUCE = (47, 95, 88)       # --spruce, the ground
MIST = (127, 182, 166)      # --mist, the day boxes
MIST_SOFT = (228, 240, 235) # --mist-soft, the lit breath segments
HONEY = (193, 133, 43)      # --honey, today

SIZES = (512, 192, 180)


def px(v):
    return v * W


def rgba(c):
    return (c[0], c[1], c[2], 255)


def mix(a, b, t):
    """Blend a toward b. A dim segment is a real colour, never a translucent
    one, so it cannot leave a hole in the icon."""
    return tuple(round(a[i] + (b[i] - a[i]) * t) for i in range(3))


def box(cx, cy, r):
    return [px(cx - r), px(cy - r), px(cx + r), px(cy + r)]


def dot(d, cx, cy, r, colour):
    d.ellipse(box(cx, cy, r), fill=rgba(colour))


def arc(d, cx, cy, rc, w, a0, a1, colour):
    """Arc with round caps, given its centreline radius. PIL strokes inward from
    the bounding box, so the box is drawn at rc + w/2 and the caps sit on rc."""
    d.arc(box(cx, cy, rc + w / 2), a0, a1, fill=rgba(colour), width=int(px(w)))
    for a in (a0, a1):
        dot(d, cx + rc * math.cos(math.radians(a)),
            cy + rc * math.sin(math.radians(a)), w / 2, colour)


def tile(img, cx, cy, size, colour, corner=.30):
    """A rounded square, composited from its own layer."""
    s = int(px(size))
    t = Image.new('RGBA', (s, s), (0, 0, 0, 0))
    ImageDraw.Draw(t).rounded_rectangle([0, 0, s - 1, s - 1],
                                        radius=int(s * corner), fill=rgba(colour))
    img.alpha_composite(t, (int(px(cx)) - s // 2, int(px(cy)) - s // 2))


def draw(img, d):
    dim = mix(SPRUCE, MIST_SOFT, .24)
    seg, gap = 45.0, 12.0
    for i in range(8):                       # the breath: six of eight lit
        a0 = -90 + i * seg + gap / 2
        arc(d, .5, .5, .368, .046, a0, a0 + seg - gap, MIST_SOFT if i < 6 else dim)

    cell, gutter = .148, .040                # the days: today in honey
    step = (cell + gutter) / 2
    for i in range(4):
        tile(img, .5 + (i % 2 - .5) * 2 * step, .5 + (i // 2 - .5) * 2 * step,
             cell, HONEY if i == 3 else MIST)


def render(size):
    img = Image.new('RGBA', (W, W), rgba(SPRUCE))
    draw(img, ImageDraw.Draw(img))
    return img.resize((size, size), Image.LANCZOS)


def main():
    root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    out = os.path.join(root, 'icons')
    for size in SIZES:
        img = render(size)
        if min(p[3] for p in img.convert('RGBA').getdata()) != 255:
            raise SystemExit(f'icon-{size} has translucent pixels')
        path = os.path.join(out, f'icon-{size}.png')
        img.save(path)
        print('wrote', os.path.relpath(path, root))


if __name__ == '__main__':
    main()
