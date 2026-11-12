"""Geometry preview for dsh-ambient-gallery.

NOT a screenshot. It re-draws the rectangles returned by the real
placements() function (dumped to tools/_places.json by
tools/dump-places.mjs) so the arrangement can be eyeballed without a
browser. Photos here are flat placeholders; the shipped plug-in paints
canvas-generated art or the user's own pictures inside the same boxes.
"""

import json
import math
from PIL import Image, ImageDraw, ImageFilter

W, H = 1100, 680
BAND = (0.20, 0.80)
PALETTE = [
    ((111, 143, 181), (74, 100, 138)),
    ((181, 143, 111), (138, 100, 74)),
    ((127, 181, 160), (74, 138, 118)),
    ((181, 127, 156), (138, 74, 100)),
    ((143, 154, 181), (98, 108, 138)),
    ((192, 160, 111), (150, 120, 74)),
]

data = json.load(open("tools/_places.json", encoding="utf-8"))

page = Image.new("RGB", (W, H), "#f5f4f1")
draw = ImageDraw.Draw(page)

# Reading gutters outside the 20%–80% band, tinted so the band is obvious.
draw.rectangle([0, 0, int(W * BAND[0]), H], fill="#eceae6")
draw.rectangle([int(W * BAND[1]), 0, W, H], fill="#eceae6")

wall_top = H * 0.03
wall_h = H * 0.88
band_w = W * (BAND[1] - BAND[0])


def render(count):
    canvas = page.copy()
    d = ImageDraw.Draw(canvas)
    for index, p in enumerate(data[str(count)]):
        x = W * BAND[0] + band_w * p["left"] / 100
        y = wall_top + wall_h * p["top"] / 100
        w = band_w * p["width"] / 100
        h = wall_h * p["height"] / 100
        cx, cy = x + w / 2, y + h / 2

        # Hanging thread from the top of the wall.
        d.line([(cx, 0), (cx, y)], fill="#b9b5ae", width=1)

        # Photo tile: a gradient body, white border, soft shadow, own tilt.
        tile = Image.new("RGB", (max(2, int(w)), max(2, int(h))))
        td = ImageDraw.Draw(tile)
        top, bottom = PALETTE[index % len(PALETTE)]
        for row in range(tile.height):
            k = row / max(1, tile.height - 1)
            td.line(
                [(0, row), (tile.width, row)],
                fill=tuple(int(top[i] + (bottom[i] - top[i]) * k) for i in range(3)),
            )
        # A few abstract marks so each photo is distinguishable.
        for step in range(3):
            ox = tile.width * (0.2 + 0.28 * step)
            oy = tile.height * (0.3 + 0.18 * ((index + step) % 3))
            r = min(tile.width, tile.height) * 0.16
            td.ellipse([ox - r, oy - r, ox + r, oy + r], outline=(255, 255, 255), width=2)

        border = 5
        framed = Image.new("RGB", (tile.width + border * 2, tile.height + border * 2), "#ffffff")
        framed.paste(tile, (border, border))
        tilt = p["tilt"]
        framed = framed.rotate(tilt, expand=True, resample=Image.BICUBIC)

        shadow = Image.new("RGBA", (framed.width + 26, framed.height + 26), (0, 0, 0, 0))
        ImageDraw.Draw(shadow).rectangle(
            [13, 13, 13 + framed.width, 13 + framed.height], fill=(0, 0, 0, 70)
        )
        shadow = shadow.filter(ImageFilter.GaussianBlur(7))
        canvas.paste(
            shadow,
            (int(cx - framed.width / 2 - 13), int(cy - framed.height / 2 - 13)),
            shadow,
        )
        canvas.paste(framed, (int(cx - framed.width / 2), int(cy - framed.height / 2)))

    d.text((16, 14), f"{count} photos  ·  band 20%-80%  ·  geometry from real placements()", fill="#6b6862")
    return canvas


for count in (5, 8, 12):
    render(count).save(f"tools/_preview-{count}.png")
    print(f"tools/_preview-{count}.png")
