#!/usr/bin/env python3
"""Rebuild a few product images from the assets already in git.

Reads the originals at 22f9dbc so a second run does not paint over itself.
Does not call any external API.
"""
from __future__ import annotations

import io
import subprocess
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parents[1]
BASE = '22f9dbc'
MAROON = (125, 46, 33, 255)
PAPER = (248, 244, 236, 255)


def original(rel: str) -> Image.Image:
    data = subprocess.check_output(['git', 'show', f'{BASE}:{rel}'])
    return Image.open(io.BytesIO(data)).convert('RGBA')


def save(im: Image.Image, rel: str) -> None:
    path = ROOT / rel
    path.parent.mkdir(parents=True, exist_ok=True)
    im.save(path, 'PNG', optimize=True)
    print('wrote', rel, im.size)


def knock_beige(im: Image.Image) -> Image.Image:
    """Replace the chest panel with the onesie fabric and keep the print."""
    src = im.convert('RGBA')
    px = src.load()
    w, h = src.size
    warm = [[False] * w for _ in range(h)]
    for y in range(h):
        row = warm[y]
        for x in range(w):
            r, g, b, a = px[x, y]
            if a < 200:
                continue
            if r > 110 and g < 150 and b < 140 and r > g + 12:
                continue
            if (r - b) >= 12 and r > 200 and b < 230 and g < 242:
                row[x] = True
    rows = [y for y in range(h) if sum(warm[y]) > w * 0.18]
    cols = [x for x in range(w) if sum(warm[y][x] for y in range(h)) > h * 0.12]
    if not rows or not cols:
        raise SystemExit('beige panel not found')
    y0, y1 = rows[0], rows[-1]
    x0, x1 = cols[0], cols[-1]
    beige_samples = []
    for y in range(y0, y1 + 1, 3):
        for x in range(x0, x1 + 1, 3):
            if warm[y][x]:
                beige_samples.append(px[x, y][:3])
    beige = tuple(sorted(c[i] for c in beige_samples)[len(beige_samples) // 2] for i in range(3))
    out = src.copy()
    op = out.load()
    for y in range(y0, y1 + 1):
        left = _fabric(px, x0 - 8, y, w)
        right = _fabric(px, x1 + 8, y, w)
        span = max(1, x1 - x0)
        for x in range(x0, x1 + 1):
            r, g, b, a = px[x, y]
            if a < 200:
                continue
            t = (x - x0) / span
            fabric = tuple(int(left[i] * (1 - t) + right[i] * t) for i in range(3))
            amount = _ink_amount((r, g, b), beige)
            if amount <= 0:
                op[x, y] = fabric + (a,)
                continue
            ink = _unkey((r, g, b), beige, amount)
            mixed = tuple(int(ink[i] * amount + fabric[i] * (1 - amount)) for i in range(3))
            op[x, y] = mixed + (255,)
    # The first pass leaves a warm fringe where the type was blended into the
    # old panel. Re-composite that fringe over the white fabric.
    fabric = (247, 247, 247)
    for y in range(max(0, y0 - 2), min(h, y1 + 3)):
        for x in range(max(0, x0 - 2), min(w, x1 + 3)):
            r, g, b, a = op[x, y]
            if a < 200:
                continue
            core = r > 100 and r > g + 28 and b < 130 and g < 150
            if core:
                continue
            if (r - b) < 8 and abs(r - g) < 10:
                continue
            amount = _ink_amount((r, g, b), beige)
            if amount <= 0:
                op[x, y] = fabric + (a,)
                continue
            mixed = tuple(int(MAROON[i] * amount + fabric[i] * (1 - amount)) for i in range(3))
            op[x, y] = mixed + (255,)
    return out


def _fabric(px, x, y, w):
    x = min(max(x, 0), w - 1)
    r, g, b, a = px[x, y]
    if a > 200 and abs(r - g) < 14 and abs(g - b) < 14:
        return (r, g, b)
    return (246, 246, 246)


def _ink_amount(color, beige):
    dist = sum(abs(color[i] - beige[i]) for i in range(3))
    if dist < 22:
        return 0.0
    blue_drop = max(0, beige[2] - color[2])
    redder = max(0, (color[0] - color[1]) - (beige[0] - beige[1]))
    if blue_drop < 8 and redder < 8:
        return 0.0
    return max(0.0, min(1.0, max(blue_drop / 80, dist / 140)))


def _unkey(color, beige, amount):
    if amount < 0.08:
        return color
    return tuple(max(0, min(255, int((color[i] - (1 - amount) * beige[i]) / amount))) for i in range(3))


def portrait_print(im: Image.Image, size: int) -> Image.Image:
    src = im.convert('RGBA')
    px = src.load()
    w, h = src.size
    opaque = []
    for y in range(0, h, 2):
        for x in range(0, w, 2):
            if px[x, y][3] > 200:
                opaque.append((x, y))
    if not opaque:
        raise SystemExit('print has no paper')
    xs = [p[0] for p in opaque]
    ys = [p[1] for p in opaque]
    x0, x1 = min(xs), max(xs)
    y0, y1 = min(ys), max(ys)
    paper_samples = []
    for y in range(y0, y1, 4):
        for x in range(x0, x1, 4):
            r, g, b, a = px[x, y]
            if a > 220 and r > 210 and g > 200 and b > 180 and abs(r - g) < 20:
                paper_samples.append((r, g, b))
    paper = tuple(sorted(c[i] for c in paper_samples)[len(paper_samples) // 2] for i in range(3))
    ink = Image.new('RGBA', (x1 - x0 + 1, y1 - y0 + 1), (0, 0, 0, 0))
    ip = ink.load()
    minx, miny, maxx, maxy = ink.size[0], ink.size[1], 0, 0
    found = False
    for y in range(y0, y1 + 1):
        for x in range(x0, x1 + 1):
            r, g, b, a = px[x, y]
            if a < 200:
                continue
            dist = sum(abs((r, g, b)[i] - paper[i]) for i in range(3))
            if dist < 26:
                continue
            if r > 180 and g > 160 and b > 140:
                continue
            amount = min(1.0, dist / 90)
            color = _unkey((r, g, b), paper, max(amount, 0.15))
            ip[x - x0, y - y0] = color + (int(255 * amount),)
            found = True
            minx = min(minx, x - x0)
            miny = min(miny, y - y0)
            maxx = max(maxx, x - x0)
            maxy = max(maxy, y - y0)
    if not found:
        raise SystemExit('print ink not found')
    sprite = ink.crop((minx, miny, maxx + 1, maxy + 1))
    canvas = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    card_h = int(size * 0.72)
    card_w = int(card_h * 12 / 16)
    left = (size - card_w) // 2
    top = (size - card_h) // 2
    shadow = Image.new('RGBA', (card_w + 28, card_h + 28), (0, 0, 0, 0))
    ImageDraw.Draw(shadow).rounded_rectangle((10, 14, card_w + 10, card_h + 14), radius=8, fill=(40, 32, 24, 70))
    shadow = shadow.filter(ImageFilter.GaussianBlur(10))
    canvas.alpha_composite(shadow, (left - 10, top - 6))
    card = Image.new('RGBA', (card_w, card_h), PAPER)
    ImageDraw.Draw(card).rounded_rectangle((0, 0, card_w - 1, card_h - 1), radius=2, outline=(230, 222, 208, 255))
    pad = int(card_w * 0.12)
    fitted = sprite.copy()
    fitted.thumbnail((card_w - pad * 2, card_h - pad * 2), Image.Resampling.LANCZOS)
    card.alpha_composite(fitted, ((card_w - fitted.width) // 2, (card_h - fitted.height) // 2))
    canvas.alpha_composite(card, (left, top))
    return canvas


def main():
    for rel in (
        'site/assets/angles/garden-gate/front-view.png',
        'site/assets/angles/garden-gate/back-view.png',
        'site/assets/mockups/garden-gate.png',
    ):
        save(knock_beige(original(rel)), rel)

    prints = ('starlight', 'beit-el-hobb', 'dar-el-hawa')
    for slug in prints:
        angle = f'site/assets/angles/{slug}/handle-on-right.png'
        mock = f'site/assets/mockups/{slug}.png'
        src = original(angle)
        save(portrait_print(src, 900), angle)
        save(portrait_print(src, 800), mock)

if __name__ == '__main__':
    main()
