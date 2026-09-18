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


def write_ico(mark: Image.Image, dest: Path) -> None:
    square_on_cream(mark, 256, pad_ratio=0.14).save(
        dest, format="ICO", sizes=[(16, 16), (32, 32), (48, 48)]
    )


def write_apple_touch(mark: Image.Image, dest: Path) -> None:
    square_on_cream(mark, 180, pad_ratio=0.14).save(dest, "PNG", optimize=True)


def write_og_share(logo: Image.Image, mug: Image.Image, dest: Path) -> None:
    w, h = 1200, 630
    logo_rgba = logo.convert("RGBA")
    panel = logo_rgba.getpixel((0, 0))[:3] + (255,)
    canvas = Image.new("RGBA", (w, h), CREAM)
    draw = ImageDraw.Draw(canvas)

    draw.rectangle((0, 0, 640, h), fill=panel)
    draw.rectangle((0, 0, w, 16), fill=MAROON)
    draw.rectangle((0, h - 16, w, h), fill=MAROON)

    wordmark = ImageOps.contain(logo_rgba, (520, 360), Image.Resampling.LANCZOS)
    canvas.alpha_composite(wordmark, (60, 70))

    serif = ImageFont.truetype(SERIF, 28)
    sans = ImageFont.truetype(SANS, 20)
    draw.text((80, 430), "A husband-and-wife shop", font=serif, fill=CHARCOAL)
    draw.text((80, 468), "in California.", font=serif, fill=CHARCOAL)
    draw.text((80, 520), "Mugs, tees, totes, onesies, and prints.", font=sans, fill=MUTED)

    mug_rgba = mug.convert("RGBA")
    mug_fit = ImageOps.contain(mug_rgba, (500, 500), Image.Resampling.LANCZOS)
    canvas.alpha_composite(mug_fit, (w - mug_fit.width - 28, (h - mug_fit.height) // 2))

    canvas.convert("RGB").save(dest, "PNG", optimize=True)


def main() -> None:
    logo = Image.open(ASSETS / "logo.png")
    mark = trim_logo(logo)
    mug = Image.open(ASSETS / "mockups" / "ya-aini.png")

    write_ico(mark, SITE / "favicon.ico")
    write_apple_touch(mark, ASSETS / "apple-touch-icon.png")
    write_og_share(logo, mug, ASSETS / "og-share.png")
    print("wrote", SITE / "favicon.ico")
    print("wrote", ASSETS / "apple-touch-icon.png")
    print("wrote", ASSETS / "og-share.png")


if __name__ == "__main__":
    main()
