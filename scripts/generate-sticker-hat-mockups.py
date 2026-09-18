#!/usr/bin/env python3
"""Listing mockups for stickers and dad hats. Cream ground, maroon lettering."""
from __future__ import annotations

import math
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont

OUT = Path(__file__).resolve().parents[1] / "site" / "assets" / "mockups"
SIZE = 1200
BG = (243, 230, 212)
CREAM = (250, 246, 239)
MAROON = (125, 46, 33)
CHARCOAL = (36, 27, 20)
MUTED = (83, 76, 69)
NAVY = (42, 48, 58)
FOREST = (62, 74, 52)
HAT_MAROON = (110, 42, 32)

SERIF = "/usr/share/fonts/truetype/croscore/Tinos-Bold.ttf"
SERIF_REG = "/usr/share/fonts/truetype/croscore/Tinos-Regular.ttf"
SANS = "/usr/share/fonts/truetype/macos/Inter-SemiBold.ttf"
SANS_REG = "/usr/share/fonts/truetype/macos/Inter-Regular.ttf"


def font(path, size):
    return ImageFont.truetype(path, size)


def canvas():
    return Image.new("RGB", (SIZE, SIZE), BG)


def paste_shadow(base: Image.Image, sprite: Image.Image, xy, blur=28, opacity=70, offset=(18, 28)):
    shadow = Image.new("RGBA", base.size, (0, 0, 0, 0))
    layer = Image.new("RGBA", sprite.size, (0, 0, 0, 0))
    mask = sprite.split()[-1] if sprite.mode == "RGBA" else Image.new("L", sprite.size, 255)
    black = Image.new("RGBA", sprite.size, (40, 28, 18, opacity))
    layer.paste(black, (0, 0), mask)
    ox, oy = xy
    dx, dy = offset
    shadow.paste(layer, (ox + dx, oy + dy), layer)
    shadow = shadow.filter(ImageFilter.GaussianBlur(blur))
    out = base.convert("RGBA")
    out = Image.alpha_composite(out, shadow)
    out.paste(sprite, xy, sprite)
    return out.convert("RGB")


def centered_text(draw, xy, lines, fnt, fill, tracking=0):
    cx, cy = xy
    heights = []
    widths = []
    for line in lines:
        bbox = draw.textbbox((0, 0), line, font=fnt)
        widths.append(bbox[2] - bbox[0])
        heights.append(bbox[3] - bbox[1])
    gap = int(fnt.size * 0.18)
    total_h = sum(heights) + gap * (len(lines) - 1)
    y = cy - total_h / 2
    for line, w, h in zip(lines, widths, heights):
        draw.text((cx - w / 2, y - h * 0.12), line, font=fnt, fill=fill)
        y += h + gap


def make_sticker(name: str, shape: str, lines: list[str], path: Path):
    base = canvas()
    W, H = 620, 620
    sticker = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(sticker)
    pad = 28
    if shape == "circle":
        d.ellipse((pad, pad, W - pad, H - pad), fill=CREAM + (255,))
        d.ellipse((pad + 10, pad + 10, W - pad - 10, H - pad - 10), outline=MAROON + (40,), width=3)
    elif shape == "rect":
        d.rounded_rectangle((pad, pad + 40, W - pad, H - pad - 40), radius=48, fill=CREAM + (255,))
        d.rounded_rectangle((pad + 10, pad + 50, W - pad - 10, H - pad - 50), radius=40, outline=MAROON + (40,), width=3)
    else:
        d.ellipse((pad - 10, pad + 50, W - pad + 10, H - pad - 30), fill=CREAM + (255,))
        d.ellipse((pad, pad + 60, W - pad, H - pad - 40), outline=MAROON + (40,), width=3)

    fnt = font(SERIF, 72 if max(len(x) for x in lines) < 10 else 58)
    centered_text(d, (W / 2, H / 2 + (8 if shape != "leaf" else 4)), lines, fnt, MAROON)

    if shape == "leaf":
        # small leaf mark, not a brand mark — just a seasonal cue
        leaf = [(W / 2, 118), (W / 2 + 22, 148), (W / 2, 178), (W / 2 - 22, 148)]
        d.polygon(leaf, fill=MAROON)

    sticker = sticker.filter(ImageFilter.SMOOTH)
    xy = ((SIZE - W) // 2, (SIZE - H) // 2 - 10)
    out = paste_shadow(base, sticker, xy, blur=32, opacity=55, offset=(10, 22))
    out.save(path, "PNG", optimize=True)


def _tone(color, delta):
    return tuple(max(0, min(255, c + delta)) for c in color)


def hat_sprite(color, lines, accent=CREAM):
    """Front dad hat: rounded crown, a thin visor in front, lettering on the panel."""
    W, H = 860, 620
    im = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    dark = _tone(color, -28)
    light = _tone(color, 26)
    mid = _tone(color, 10)

    # thin visor in front of the crown — a brim, not a plate
    d.ellipse((70, 395, 790, 525), fill=dark)
    d.ellipse((110, 412, 750, 500), fill=_tone(color, -8))

    # crown
    d.rounded_rectangle((130, 70, 730, 430), radius=210, fill=color)
    d.rectangle((130, 250, 730, 430), fill=color)
    d.ellipse((130, 70, 730, 360), fill=color)

    # opening curve at the brow
    d.arc((160, 300, 700, 470), 200, 340, fill=dark, width=4)

    # front panel
    d.rounded_rectangle((270, 130, 590, 390), radius=86, fill=light)
    d.line((270, 185, 270, 370), fill=dark, width=2)
    d.line((590, 185, 590, 370), fill=dark, width=2)

    # top button
    d.ellipse((400, 78, 460, 134), fill=dark)
    d.ellipse((412, 90, 448, 122), fill=light)

    # eyelets
    for x, y in ((200, 160), (644, 160)):
        d.ellipse((x, y, x + 16, y + 16), fill=dark)
        d.ellipse((x + 4, y + 4, x + 12, y + 12), fill=mid)

    fnt = font(SERIF, 40 if max(len(x) for x in lines) > 10 else 46)
    tmp = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    td = ImageDraw.Draw(tmp)
    centered_text(td, (W / 2, 260), lines, fnt, accent)
    im = Image.alpha_composite(im, tmp)
    return im


def make_hat(name: str, color, lines, path: Path):
    base = canvas()
    sprite = hat_sprite(color, lines)
    xy = ((SIZE - sprite.size[0]) // 2, 240)
    out = paste_shadow(base, sprite, xy, blur=36, opacity=60, offset=(8, 26))
    out.save(path, "PNG", optimize=True)


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    make_sticker("Craft Club", "circle", ["CRAFT", "CLUB"], OUT / "craft-club-sticker.png")
    make_sticker("Make Something", "rect", ["MAKE", "SOMETHING"], OUT / "make-something-sticker.png")
    make_sticker("Leaf Season", "leaf", ["LEAF", "SEASON"], OUT / "leaf-season-sticker.png")
    make_hat("Habibi Crafts", CHARCOAL, ["HABIBI", "CRAFTS"], OUT / "habibi-crafts-hat.png")
    make_hat("Make Something", HAT_MAROON, ["MAKE", "SOMETHING"], OUT / "make-something-hat.png")
    make_hat("Leaf Season", FOREST, ["LEAF", "SEASON"], OUT / "leaf-season-hat.png")
    print("wrote 6 mockups in", OUT)


if __name__ == "__main__":
    main()
