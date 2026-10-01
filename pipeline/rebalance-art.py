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
    """Key out only the flat beige print box. The garment stays as it was."""
    from collections import deque

    src = im.convert('RGBA')
    px = src.load()
    w, h = src.size
    samples = []
    for y in range(h // 3, 2 * h // 3, 2):
        for x in range(w // 3, 2 * w // 3, 2):
            r, g, b, a = px[x, y]
            if a > 220 and (r - b) > 16 and r > 200 and abs(r - g) < 18 and g > b:
                samples.append((r, g, b))
    if not samples:
        raise SystemExit('beige panel not found')
    buckets = {}
    for sample in samples:
        key = tuple(channel // 4 * 4 for channel in sample)
        buckets[key] = buckets.get(key, 0) + 1
    ref = max(buckets, key=buckets.get)
    tolerance = 28

    def near(color):
        return color[3] > 220 and sum(abs(color[i] - ref[i]) for i in range(3)) <= tolerance

    seen = bytearray(w * h)
    best_pts = None
    box = None
    for y in range(h):
        for x in range(w):
            index = y * w + x
            if seen[index]:
                continue
            if not near(px[x, y]):
                seen[index] = 1
                continue
            queue = deque([(x, y)])
            seen[index] = 1
            pts = []
            while queue:
                cx, cy = queue.popleft()
                pts.append((cx, cy))
                for nx, ny in ((cx - 1, cy), (cx + 1, cy), (cx, cy - 1), (cx, cy + 1)):
                    if nx < 0 or ny < 0 or nx >= w or ny >= h:
                        continue
                    nxt = ny * w + nx
                    if seen[nxt]:
                        continue
                    seen[nxt] = 1
                    if near(px[nx, ny]):
                        queue.append((nx, ny))
            if best_pts is None or len(pts) > len(best_pts):
                best_pts = pts
                xs = [point[0] for point in pts]
                ys = [point[1] for point in pts]
                box = (min(xs), min(ys), max(xs), max(ys))
    x0, y0, x1, y1 = box
    ring = []
    for y in range(max(0, y0 - 14), min(h, y1 + 15)):
        for x in range(max(0, x0 - 14), min(w, x1 + 15)):
            if x0 <= x <= x1 and y0 <= y <= y1:
                continue
            r, g, b, a = px[x, y]
            if a < 230:
                continue
            if abs(r - g) < 10 and abs(g - b) < 10 and r > 220:
                ring.append((r, g, b))
    if len(ring) < 20:
        raise SystemExit('onesie fabric not found')
    fabric = tuple(sorted(channel[i] for channel in ring)[len(ring) // 2] for i in range(3))

    mask = Image.new('L', (w, h), 0)
    mp = mask.load()
    for y in range(y0, y1 + 1):
        for x in range(x0, x1 + 1):
            if near(px[x, y]):
                mp[x, y] = 255
    rim = mask.filter(ImageFilter.MaxFilter(5))
    rp = rim.load()
    for y in range(max(0, y0 - 4), min(h, y1 + 5)):
        for x in range(max(0, x0 - 4), min(w, x1 + 5)):
            if mp[x, y] or rp[x, y] == 0:
                continue
            r, g, b, a = px[x, y]
            if a < 200:
                continue
            dist = sum(abs((r, g, b)[i] - ref[i]) for i in range(3))
            if dist < 48 and (r - b) > 8:
                mp[x, y] = 180
    soft = mask.filter(ImageFilter.GaussianBlur(1.15))
    sp = soft.load()
    out = src.copy()
    op = out.load()

    def ink_amount(color):
        dist = sum(abs(color[i] - ref[i]) for i in range(3))
        redder = (color[0] - color[1]) - (ref[0] - ref[1])
        darker = ref[2] - color[2]
        if dist < 20 and redder < 10:
            return 0.0
        if redder < 12 and darker < 14:
            return 0.0
        return max(0.0, min(1.0, max(redder / 70, darker / 90, dist / 160)))

    for y in range(h):
        for x in range(w):
            coverage = sp[x, y] / 255
            if coverage < 0.02:
                continue
            r, g, b, a = px[x, y]
            amount = ink_amount((r, g, b))
            if amount <= 0:
                repl = fabric
            else:
                ink = _unkey((r, g, b), ref, amount)
                repl = tuple(int(ink[i] * amount + fabric[i] * (1 - amount)) for i in range(3))
            mixed = tuple(int(repl[i] * coverage + (r, g, b)[i] * (1 - coverage)) for i in range(3))
            op[x, y] = mixed + (a,)

    _assert_clean(px, op, w, h, box)
    return out


def _assert_clean(src, out, w, h, box):
    x0, y0, x1, y1 = box
    for y in range(h):
        run = 0
        for x in range(w):
            if out[x, y][3] != src[x, y][3]:
                raise SystemExit(f'alpha changed at {x},{y}')
            outside = not (x0 - 6 <= x <= x1 + 6 and y0 - 6 <= y <= y1 + 6)
            if outside and out[x, y] != src[x, y]:
                raise SystemExit(f'garment changed at {x},{y}')
            if x == 0 or x == w - 1:
                continue
            lum = sum(out[x, y][:3]) / 3
            left = sum(out[x - 1, y][:3]) / 3
            right = sum(out[x + 1, y][:3]) / 3
            if lum + 18 < left and lum + 18 < right and lum + 12 < sum(src[x, y][:3]) / 3:
                run += 1
            else:
                if run > 30:
                    raise SystemExit(f'alpha seam on row {y}')
                run = 0


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
