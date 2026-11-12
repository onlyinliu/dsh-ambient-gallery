"""Render assets/icon-180.png for dsh-ambient-gallery.

This is a raster sibling of `icon.svg`, not an independent drawing: the same
five-pane mosaic, the same gradients, the same white video glyph. `icon.svg`
is the canonical mark (crisp at every size); this PNG exists because the plugin
marketplace wants a square raster thumbnail that survives a plain <img> fetch.

Geometry is expressed in the SVG's own 64x64 coordinate space and scaled up,
so editing one file and re-running this script keeps the two in step.
"""

import math

from PIL import Image, ImageDraw

SIZE = 180
SCALE = 4          # supersample, then LANCZOS down to SIZE
S = SIZE * SCALE
U = S / 64.0       # one SVG user unit in device pixels


def scatter(rect, top_left, bottom_right, direction="v"):
    """Rasterise one linear gradient through a rectangle (with alpha)."""
    x, y, w, h = [v * U for v in rect]
    w, h = max(1, int(round(w))), max(1, int(round(h)))

    if direction == "v":
        grad = Image.new("RGB", (1, h))
        for row in range(h):
            t = row / max(1, h - 1)
            grad.putpixel((0, row), lerp(top_left, bottom_right, t))
        art = grad.resize((w, h))
    else:
        grad = Image.new("RGB", (w, 1))
        for col in range(w):
            t = col / max(1, w - 1)
            grad.putpixel((col, 0), lerp(top_left, bottom_right, t))
        art = grad.resize((w, h))
    return art.convert("RGBA")


def lerp(a, b, t):
    return (
        round(a[0] + (b[0] - a[0]) * t),
        round(a[1] + (b[1] - a[1]) * t),
        round(a[2] + (b[2] - a[2]) * t),
    )


def diag_field(size, stops):
    """Two-stop diagonal gradient covering the whole tile (the SVG bg)."""
    art = Image.new("RGB", (size, size))
    px = art.load()
    for yy in range(size):
        for xx in range(size):
            t = ((xx / size) + (yy / size)) / 2.0
            if t <= stops[1][0]:
                local = t / max(1e-6, stops[1][0])
                px[xx, yy] = lerp(stops[0][1], stops[1][1], local)
            else:
                local = (t - stops[1][0]) / max(1e-6, 1.0 - stops[1][0])
                px[xx, yy] = lerp(stops[1][1], stops[2][1], local)
    return art


def rounded_mask(w, h, radius, size):
    mask = Image.new("L", size, 0)
    ImageDraw.Draw(mask).rounded_rectangle(
        (0, 0, w - 1, h - 1), radius=radius, fill=255
    )
    return mask


def main():
    # The SVG's background field: #2B3A67 -> #3E5C8A -> #6C4E86, diagonal.
    canvas = diag_field(
        S,
        [(0.0, (0x2B, 0x3A, 0x67)), (0.55, (0x3E, 0x5C, 0x8A)), (1.0, (0x6C, 0x4E, 0x86))],
    ).convert("RGBA")

    # (x, y, w, h, rx, top-colour, bottom-colour, alpha) mirroring icon.svg.
    panes = [
        (11.0, 12.0, 18.0, 14.0, 3.4, (0x8F, 0xB8, 0xE8), (0x5A, 0x7F, 0xC0), 0.95),
        (32.0, 12.0, 21.0, 14.0, 3.4, (0xE7, 0xB6, 0xA0), (0xB7, 0x7C, 0x9E), 0.87),
        (11.0, 29.5, 12.0, 11.0, 3.0, (0x7F, 0xD4, 0xC1), (0x4F, 0x9F, 0xB4), 0.86),
        (26.0, 29.5, 27.0, 11.0, 3.0, (0x8F, 0xB8, 0xE8), (0x5A, 0x7F, 0xC0), 0.59),
        (11.0, 43.5, 42.0, 9.5, 3.0, (0xE7, 0xB6, 0xA0), (0xB7, 0x7C, 0x9E), 0.48),
    ]

    for x, y, w, h, rx, top, bottom, alpha in panes:
        pw, ph = max(1, int(round(w * U))), max(1, int(round(h * U)))
        art = scatter((x, y, w, h), top, bottom, "v")
        if alpha < 1.0:
            art.putalpha(int(round(255 * alpha)))
        layer = Image.new("RGBA", (pw, ph), (0, 0, 0, 0))
        layer.paste(art, (0, 0), art)
        canvas.paste(
            layer,
            (int(round(x * U)), int(round(y * U))),
            rounded_mask(pw, ph, int(round(rx * U)), (pw, ph)),
        )

    # White video glyph: rounded frame + play triangle, as in icon.svg.
    d = ImageDraw.Draw(canvas)
    white = (255, 255, 255)
    stroke = max(2, int(round(2.6 * U)))

    fx, fy, fw, fh = 38.4 * U, 29.7 * U, 9.1 * U, 9.8 * U
    d.rounded_rectangle((fx, fy, fx + fw, fy + fh), radius=2.2 * U, outline=white, width=stroke)

    # Play glyph. The SVG path is `M47.5 32.8l5.4-3.1v9.6l-5.4-3.1z`, i.e. the
    # polygon (47.5,32.8) (52.9,29.7) (52.9,39.3) (47.5,36.2) — copy it point
    # for point; hand-rounding it into "a triangle" is what put the apex in the
    # wrong place.
    tri = [
        (47.5 * U, 32.8 * U),
        (52.9 * U, 29.7 * U),
        (52.9 * U, 39.3 * U),
        (47.5 * U, 36.2 * U),
    ]
    d.polygon(tri, fill=white)

    # Round the outer tile to the SVG's rx=15/64 and trim the border.
    out = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    inset = int(round(2 * U))
    body = canvas.crop((inset, inset, S - inset, S - inset))
    mask = rounded_mask(body.width, body.height, int(round(15 * U)), body.size)
    out.paste(body, (inset, inset), mask)

    out = out.resize((SIZE, SIZE), Image.LANCZOS)
    out.save("assets/icon-180.png", optimize=True)
    print("wrote assets/icon-180.png", out.size)


if __name__ == "__main__":
    main()
