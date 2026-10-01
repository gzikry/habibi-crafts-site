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


def charcoal_wordmark(white: Image.Image) -> Image.Image:
    """Nav wordmark is white on transparent. Recolor the ink and keep the alpha."""
    mark = white.convert("RGBA")
    pixels = mark.load()
    width, height = mark.size
    for y in range(height):
        for x in range(width):
            _r, _g, _b, alpha = pixels[x, y]
            pixels[x, y] = (CHARCOAL[0], CHARCOAL[1], CHARCOAL[2], alpha)
    bbox = mark.getbbox()
    return mark.crop(bbox) if bbox else mark


def tracked_glyphs(text: str, font, fill, tracking: int) -> Image.Image:
    """Draw tracked type and crop to the ink, so trailing spacing is not part of the width."""
    scratch = ImageDraw.Draw(Image.new("RGBA", (1, 1)))
    widths = []
    for char in text:
        box = scratch.textbbox((0, 0), char, font=font)
        widths.append(box[2] - box[0])
    line = scratch.textbbox((0, 0), text, font=font)
    total = sum(widths) + tracking * max(len(text) - 1, 0)
    image = Image.new("RGBA", (total + 64, (line[3] - line[1]) + 64), (0, 0, 0, 0))
    draw = ImageDraw.Draw(image)
    x = 32
    y = 32 - line[1]
    for char, char_w in zip(text, widths):
        draw.text((x, y), char, font=font, fill=fill)
        x += char_w + tracking
    bbox = image.getbbox()
    return image.crop(bbox) if bbox else image


def ink_bands(im: Image.Image, threshold: int = 16):
    """Split a transparent wordmark into its lines and crop each to its glyphs."""
    alpha = im.getchannel("A")
    width, height = im.size
    px = alpha.load()
    hits = []
    for y in range(height):
        hits.append(any(px[x, y] > threshold for x in range(width)))
    bands = []
    start = None
    for y, hit in enumerate(hits + [False]):
        if hit and start is None:
            start = y
        elif not hit and start is not None:
            band = im.crop((0, start, width, y))
            bbox = band.getbbox()
            if bbox:
                bands.append((band.crop(bbox), start + bbox[1]))
            start = None
    return bands


def write_og_share(logo: Image.Image, dest: Path) -> None:
    """Cream card with the wordmark and a small ESTD 2024 line, optically centered.

    The wordmark is drawn on a 2x canvas and downsampled so the edges stay sharp.
    """
    del logo  # The opaque plate sits behind logo.png. The nav mark is already transparent.
    scale = 2
    w, h = 1200 * scale, 630 * scale
    canvas = Image.new("RGBA", (w, h), CREAM)
    mark = charcoal_wordmark(Image.open(ASSETS / "logo-nav-white.png"))
    fitted = ImageOps.contain(mark, (920 * scale, 300 * scale), Image.Resampling.LANCZOS)
    date_font = ImageFont.truetype(SANS, 26 * scale)
    established = tracked_glyphs("ESTD 2024", date_font, MUTED, 8 * scale)
    # Close the gap the tagline used to occupy, then center the pair.
    gap = 28 * scale
    block_h = fitted.height + gap + established.height
    top = (h - block_h) // 2
    for band, y0 in ink_bands(fitted):
        canvas.alpha_composite(band, ((w - band.width) // 2, top + y0))
    canvas.alpha_composite(established, ((w - established.width) // 2, top + fitted.height + gap))
    final = canvas.resize((1200, 630), Image.Resampling.LANCZOS)
    final.convert("RGB").save(dest, "PNG", optimize=True)


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
