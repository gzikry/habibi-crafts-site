#!/usr/bin/env python3
"""Rebuild Garden Gate and Gather & Grow from assets already in git.

Reads the originals at 22f9dbc so a second run does not paint over itself.
Does not call any external API.
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
BEIGE = np.array([237.0, 228.0, 207.0])
SERIF = '/usr/share/fonts/truetype/noto/NotoSerif-Regular.ttf'


def original(rel: str) -> Image.Image:
    data = subprocess.check_output(['git', 'show', f'{BASE}:{rel}'])
    im = Image.open(io.BytesIO(data))
    if im.mode == 'P':
        im = im.convert('RGBA')
    return im.convert('RGBA')


def save(im: Image.Image, rel: str) -> None:
    path = ROOT / rel
    path.parent.mkdir(parents=True, exist_ok=True)
    im.save(path, 'PNG', optimize=True)
    print('wrote', rel, im.size)


def _arr(im: Image.Image) -> np.ndarray:
    return np.asarray(im.convert('RGBA'))


def _fabric_mask(rgb: np.ndarray) -> np.ndarray:
    return (rgb.mean(2) > 228) & (np.abs(rgb[:, :, 0] - rgb[:, :, 2]) < 18)


def _sister_fabric(primary: Image.Image, secondary: Image.Image) -> tuple[np.ndarray, np.ndarray]:
    a = _arr(primary)[:, :, :3].astype(np.float32)
    b = _arr(secondary)[:, :, :3].astype(np.float32)
    src = a.copy()
    use_b = ~_fabric_mask(a) & _fabric_mask(b)
    src[use_b] = b[use_b]
    hole = ~_fabric_mask(a) & ~_fabric_mask(b)
    return src, hole


def _continue_fabric(photo: np.ndarray, sister: np.ndarray | None, hole: np.ndarray | None, box, feather: int):
    """Fill a print rectangle with the surrounding garment, then the sister photo."""
    rgb = photo[:, :, :3].astype(np.float32)
    h, w = rgb.shape[:2]
    x0, y0, x1, y1 = box
    mask = np.zeros((h, w), bool)
    mask[y0:y1 + 1, x0:x1 + 1] = True
    ys, xs = np.mgrid[0:h, 0:w]
    dt = (ys - y0).astype(np.float32)
    db = (y1 - ys).astype(np.float32)
    dl = (xs - x0).astype(np.float32)
    dr = (x1 - xs).astype(np.float32)
    dist = np.minimum(
        np.minimum(np.maximum(dt, 0), np.maximum(db, 0)),
        np.minimum(np.maximum(dl, 0), np.maximum(dr, 0)),
    )
    ty = np.clip(y0 - 1 - (ys - y0), 0, h - 1)
    by = np.clip(y1 + 1 + (y1 - ys), 0, h - 1)
    lx = np.clip(x0 - 1 - (xs - x0), 0, w - 1)
    rx = np.clip(x1 + 1 + (x1 - xs), 0, w - 1)
    eps = 0.35
    wt = np.where(ty < y0, 1 / (np.maximum(dt, 0) + eps) ** 4, 0.0)
    wb = np.where(by > y1, 1 / (np.maximum(db, 0) + eps) ** 4, 0.0)
    wl = np.where(lx < x0, 1 / (np.maximum(dl, 0) + eps) ** 4, 0.0)
    wr = np.where(rx > x1, 1 / (np.maximum(dr, 0) + eps) ** 4, 0.0)
    wsum = wt + wb + wl + wr
    mirrored = (
        rgb[ty, xs] * wt[:, :, None]
        + rgb[by, xs] * wb[:, :, None]
        + rgb[ys, lx] * wl[:, :, None]
        + rgb[ys, rx] * wr[:, :, None]
    ) / (wsum[:, :, None] + 1e-8)
    if sister is None:
        inside = mirrored
    else:
        sib = sister.copy()
        if hole is not None:
            sib[hole] = mirrored[hole]
        t = np.clip(dist / float(feather), 0, 1)
        t = t * t * (3 - 2 * t)
        inside = mirrored * (1 - t[:, :, None]) + sib * t[:, :, None]
    out = rgb.copy()
    out[mask] = inside[mask]
    return out, mask


def _paint_ink(base: np.ndarray, rgb: np.ndarray, mask: np.ndarray) -> np.ndarray:
    dist = np.abs(rgb - BEIGE).sum(2)
    redder = (rgb[:, :, 0] - rgb[:, :, 1]) - (BEIGE[0] - BEIGE[1])
    darker = BEIGE[2] - rgb[:, :, 2]
    ink = mask & (dist > 26) & ((redder > 12) | (darker > 18))
    amount = np.where(ink, np.clip((dist - 20) / 75.0, 0, 1), 0.0)
    safe = np.maximum(amount, 0.18)
    ink_rgb = np.clip((rgb - (1 - amount)[:, :, None] * BEIGE) / safe[:, :, None], 0, 255)
    out = np.clip(ink_rgb * amount[:, :, None] + base * (1 - amount[:, :, None]), 0, 255)
    out[~mask] = rgb[~mask]
    return out


def _edge_ok(im: np.ndarray, box, name: str) -> None:
    x0, y0, x1, y1 = box
    lum = im.mean(2)
    gy = np.abs(lum[1:] - lum[:-1])
    top = gy[y0 - 1, x0:x1]
    fabric = gy[max(0, y0 - 28):y0 - 6, x0:x1]
    ratio = float(top.mean() / (fabric.mean() + 1e-6))
    print(f'  {name} top-edge ratio {ratio:.2f}')
    if ratio > 1.5:
        raise SystemExit(f'{name} still has a print-box edge ({ratio:.2f})')


def garden_gate() -> None:
    mock_box = (257, 130, 538, 451)
    front_box = (289, 146, 606, 507)
    back_box = (289, 97, 606, 458)

    photo = original('site/assets/mockups/garden-gate.png')
    yt = original('site/assets/mockups/ya-teta.png')
    am = original('site/assets/mockups/amoura.png')
    sister, hole = _sister_fabric(yt, am)
    rgb = _arr(photo)[:, :, :3].astype(np.float32)
    base, mask = _continue_fabric(rgb, sister, hole, mock_box, 36)
    final = _paint_ink(base, rgb, mask)
    _edge_ok(final, mock_box, 'mockup')
    out = _arr(photo).copy()
    out[:, :, :3] = final.astype(np.uint8)
    save(Image.fromarray(out), 'site/assets/mockups/garden-gate.png')

    photo = original('site/assets/angles/garden-gate/front-view.png')
    yt = original('site/assets/angles/ya-teta/front-view.png').resize((900, 900), Image.Resampling.LANCZOS)
    am = original('site/assets/angles/amoura/front-view.png').resize((900, 900), Image.Resampling.LANCZOS)
    sister, hole = _sister_fabric(yt, am)
    rgb = _arr(photo)[:, :, :3].astype(np.float32)
    base, mask = _continue_fabric(rgb, sister, hole, front_box, 36)
    final = _paint_ink(base, rgb, mask)
    _edge_ok(final, front_box, 'front')
    out = _arr(photo).copy()
    out[:, :, :3] = final.astype(np.uint8)
    save(Image.fromarray(out), 'site/assets/angles/garden-gate/front-view.png')

    # The sister back views are the same flat panel, so the back continues
    # this photo's own fabric instead of borrowing another print.
    photo = original('site/assets/angles/garden-gate/back-view.png')
    rgb = _arr(photo)[:, :, :3].astype(np.float32)
    base, mask = _continue_fabric(rgb, None, None, back_box, 1)
    final = _paint_ink(base, rgb, mask)
    _edge_ok(final, back_box, 'back')
    out = _arr(photo).copy()
    out[:, :, :3] = final.astype(np.uint8)
    save(Image.fromarray(out), 'site/assets/angles/garden-gate/back-view.png')


def _tote_blank() -> np.ndarray:
    slugs = ('halawa', 'sit-el-kul', 'early-light')
    arrs = [_arr(original(f'site/assets/mockups/{slug}.png')).astype(np.float32) for slug in slugs]
    a, b, c = arrs
    ab = np.abs(a[:, :, :3] - b[:, :, :3]).sum(2) < 12
    ac = np.abs(a[:, :, :3] - c[:, :, :3]).sum(2) < 12
    bc = np.abs(b[:, :, :3] - c[:, :, :3]).sum(2) < 12
    out = a.copy()
    out[bc & ~ab] = b[bc & ~ab]
    out[ac & ~ab & ~bc] = c[ac & ~ab & ~bc]
    leftover = ~(ab | ac | bc)
    print('  tote pixels with no agreed blank', int(leftover.sum()))
    if leftover.any():
        ys, xs = np.where(leftover)
        box = (int(xs.min()), int(ys.min()), int(xs.max()), int(ys.max()))
        filled, _mask = _continue_fabric(out[:, :, :3], None, None, box, 1)
        rgb = a[:, :, :3].copy()
        rgb[leftover] = filled[leftover]
        out = np.dstack([rgb, a[:, :, 3]])
    return out


def _sprig() -> Image.Image:
    art = _arr(original('site/assets/mockups/gather-grow.png')).astype(np.float32)
    blank = _arr(original('site/assets/mockups/halawa.png')).astype(np.float32)
    delta = np.abs(art[:, :, :3] - blank[:, :, :3]).sum(2)
    zone = np.zeros(delta.shape, bool)
    zone[520:670, 240:560] = True
    ink = zone & (delta > 25)
    if ink.sum() < 400:
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


def _gather_art(sprig: Image.Image) -> Image.Image:
    """Two centered lines, one size, sprig centered underneath. Transparent."""
    canvas = Image.new('RGBA', (640, 520), (0, 0, 0, 0))
    draw = ImageDraw.Draw(canvas)
    size = 86
    font = ImageFont.truetype(SERIF, size)
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


def gather_grow() -> None:
    blank = _tote_blank()
    art = _gather_art(_sprig())
    # The old print sits in this window on both the mockup and the matching angle.
    x0, y0, x1, y1 = 257, 367, 544, 654
    fitted = art.copy()
    fitted.thumbnail((x1 - x0 - 8, y1 - y0 - 8), Image.Resampling.LANCZOS)
    layer = Image.fromarray(np.clip(blank, 0, 255).astype(np.uint8), 'RGBA')
    layer.alpha_composite(
        fitted,
        (x0 + (x1 - x0 - fitted.width) // 2, y0 + (y1 - y0 - fitted.height) // 2),
    )
    # Mockup and handle-on-right are the same photograph at 22f9dbc.
    for rel in (
        'site/assets/mockups/gather-grow.png',
        'site/assets/angles/gather-grow/handle-on-right.png',
    ):
        save(layer, rel)


def main() -> None:
    garden_gate()
    gather_grow()


if __name__ == '__main__':
    main()
