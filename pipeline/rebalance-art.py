#!/usr/bin/env python3
"""Write the rebalanced Gather & Grow art for a future tote re-mock.

The sprite is transparent maroon type plus the sprig taken from the
22f9dbc tote. This script does not composite onto a product photo.
There is no blank tote in the repo, so the live mockup stays untouched.
"""
from __future__ import annotations

import io
import subprocess
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
BASE = '22f9dbc'
MAROON = (125, 46, 33, 255)
SERIF = '/usr/share/fonts/truetype/noto/NotoSerif-Regular.ttf'
ART = ROOT / 'pipeline' / 'art' / 'gather-grow.png'


def original(rel: str) -> Image.Image:
    data = subprocess.check_output(['git', 'show', f'{BASE}:{rel}'])
    im = Image.open(io.BytesIO(data))
    if im.mode == 'P':
        im = im.convert('RGBA')
    return im.convert('RGBA')


def _sprig() -> Image.Image:
    art = np.asarray(original('site/assets/mockups/gather-grow.png')).astype(np.float32)
    blank = np.asarray(original('site/assets/mockups/halawa.png')).astype(np.float32)
    delta = np.abs(art[:, :, :3] - blank[:, :, :3]).sum(2)
    zone = np.zeros(delta.shape, bool)
    zone[520:670, 240:560] = True
    ink = zone & (delta > 25)
    if int(ink.sum()) < 400:
        raise SystemExit('sprig did not separate from the tote')
    ys, xs = np.where(ink)
    amount = np.clip(delta / 80.0, 0, 1)
    amount = np.where(ink, amount, 0)
    sprite = np.zeros_like(art, dtype=np.uint8)
    sprite[:, :, 0] = MAROON[0]
    sprite[:, :, 1] = MAROON[1]
    sprite[:, :, 2] = MAROON[2]
    sprite[:, :, 3] = (amount * 255).astype(np.uint8)
    pad = 2
    crop = sprite[ys.min() - pad:ys.max() + pad + 1, xs.min() - pad:xs.max() + pad + 1]
    return Image.fromarray(crop)


def gather_art(sprig: Image.Image) -> Image.Image:
    """Two centered lines, one size, sprig centered underneath. Transparent."""
    canvas = Image.new('RGBA', (640, 520), (0, 0, 0, 0))
    draw = ImageDraw.Draw(canvas)
    font = ImageFont.truetype(SERIF, 86)
    lines = ('GATHER &', 'GROW')
    gap = 8
    boxes = [draw.textbbox((0, 0), line, font=font) for line in lines]
    widths = [box[2] - box[0] for box in boxes]
    heights = [box[3] - box[1] for box in boxes]
    block_w = max(widths)
    y = 10
    for line, box, width, height in zip(lines, boxes, widths, heights):
        x = (canvas.width - width) // 2 - box[0]
        draw.text((x, y - box[1]), line, font=font, fill=MAROON)
        y += height + gap
    mark = sprig.copy()
    mark.thumbnail((int(block_w * 0.46), 180), Image.Resampling.LANCZOS)
    canvas.alpha_composite(mark, ((canvas.width - mark.width) // 2, y + 6))
    bbox = canvas.getbbox()
    return canvas.crop(bbox)


def main() -> None:
    art = gather_art(_sprig())
    ART.parent.mkdir(parents=True, exist_ok=True)
    art.save(ART, 'PNG', optimize=True)
    print('wrote', ART.relative_to(ROOT), art.size)


if __name__ == '__main__':
    main()
