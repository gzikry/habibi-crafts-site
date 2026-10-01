#!/usr/bin/env python3
"""Build root favicon.ico, apple-touch-icon, and 1200x630 OG share image.

Uses only files already in site/assets. No network, no product copy claims.
"""
from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageDraw, ImageFont, ImageOps

ROOT = Path(__file__).resolve().parents[1]
SITE = ROOT / "site"
ASSETS = SITE / "assets"

CREAM = (250, 246, 239, 255)
CHARCOAL = (36, 27, 20, 255)
MAROON = (125, 46, 33, 255)
MUTED = (83, 76, 69, 255)
SERIF = "/usr/share/fonts/truetype/noto/NotoSerif-Regular.ttf"
SANS = "/usr/share/fonts/truetype/noto/NotoSans-Regular.ttf"


def trim_logo(im: Image.Image, bg_threshold: int = 18) -> Image.Image:
    """Crop near-solid padding around the wordmark."""
    rgba = im.convert("RGBA")
    corner = rgba.getpixel((0, 0))
    mask = Image.new("L", rgba.size, 0)
    px = rgba.load()
    m = mask.load()
    w, h = rgba.size
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if a < 8:
                continue
            if abs(r - corner[0]) + abs(g - corner[1]) + abs(b - corner[2]) > bg_threshold:
                m[x, y] = 255
    bbox = mask.getbbox()
    if not bbox:
        return rgba
    pad = 12
    left = max(0, bbox[0] - pad)
    top = max(0, bbox[1] - pad)
    right = min(w, bbox[2] + pad)
    bottom = min(h, bbox[3] + pad)
    return rgba.crop((left, top, right, bottom))


def square_on_cream(mark: Image.Image, size: int, pad_ratio: float = 0.16) -> Image.Image:
    canvas = Image.new("RGBA", (size, size), CREAM)
    inner = int(size * (1 - 2 * pad_ratio))
    fitted = ImageOps.contain(mark, (inner, inner), Image.Resampling.LANCZOS)
    x = (size - fitted.width) // 2
    y = (size - fitted.height) // 2
    canvas.alpha_composite(fitted, (x, y))
    return canvas


def write_ico(white_mark: Image.Image, dest: Path) -> None:
    """Header-colored tile so the tab icon is visible at 16px."""
    src = ImageOps.contain(white_mark.convert("RGBA"), (220, 96), Image.Resampling.LANCZOS)
    hi = Image.new("RGBA", (256, 256), MAROON)
    hi.alpha_composite(src, ((256 - src.width) // 2, (256 - src.height) // 2))
    hi.save(dest, format="ICO", sizes=[(16, 16), (32, 32), (48, 48)])


def write_apple_touch(mark: Image.Image, dest: Path) -> None:
    square_on_cream(mark, 180, pad_ratio=0.14).save(dest, "PNG", optimize=True)


def crop_wordmark(logo: Image.Image) -> Image.Image:
    """Drop the unverified date line under the wordmark."""
    im = logo.convert("RGBA")
    _w, h = im.size
    return im.crop((0, 0, _w, int(h * 270 / 447)))


def write_og_share(logo: Image.Image, dest: Path) -> None:
    w, h = 1200, 630
    canvas = Image.new("RGBA", (w, h), CREAM)
    mark = trim_logo(crop_wordmark(logo))
    fitted = ImageOps.contain(mark, (780, 250), Image.Resampling.LANCZOS)
    draw = ImageDraw.Draw(canvas)
    serif = ImageFont.truetype(SERIF, 64)
    sans = ImageFont.truetype(SANS, 36)
    title = "Habibi Crafts Co"
    line = "Mugs, tees, totes, and more."

    def text_width(text, font):
        box = draw.textbbox((0, 0), text, font=font)
        return box[2] - box[0]

    gap = 36
    title_h = 76
    line_h = 48
    block_h = fitted.height + gap + title_h + 18 + line_h
    top = (h - block_h) // 2
    canvas.alpha_composite(fitted, ((w - fitted.width) // 2, top))
    y = top + fitted.height + gap
    draw.text(((w - text_width(title, serif)) // 2, y), title, font=serif, fill=CHARCOAL)
    y += title_h + 8
    rule_w = 72
    draw.rectangle(((w - rule_w) // 2, y, (w + rule_w) // 2, y + 3), fill=MAROON)
    y += 18
    draw.text(((w - text_width(line, sans)) // 2, y), line, font=sans, fill=MUTED)
    canvas.convert("RGB").save(dest, "PNG", optimize=True)


def main() -> None:
    logo = Image.open(ASSETS / "logo.png")
    mark = trim_logo(logo)
    white = Image.open(ASSETS / "logo-nav-white.png")

    write_ico(white, SITE / "favicon.ico")
    write_apple_touch(mark, ASSETS / "apple-touch-icon.png")
    write_og_share(logo, ASSETS / "og-share.png")
    print("wrote", SITE / "favicon.ico")
    print("wrote", ASSETS / "apple-touch-icon.png")
    print("wrote", ASSETS / "og-share.png")


if __name__ == "__main__":
    main()
