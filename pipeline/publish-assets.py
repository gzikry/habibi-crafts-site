#!/usr/bin/env python3
"""
Publish Printful angle frames into the storefront.

Two things happen here, both previously done by hand:

  1. angle frames -> site/assets/angles/<slug>/   (quantised PNG, 900px)
  2. the first frame of each -> site/assets/mockups/<slug>.png  (800px)

The thumbnails are derived from the same frames the viewer uses, so a product
can never show one angle in the grid and a different one when you turn it.

Frame order matters: frame 0 is what the grid and the viewer open on, and it
must be a view where the artwork is actually visible. Printful names angles
inconsistently (mugs: "Front view"/"Handle on Left"/"Handle on Right"; totes
and tees: "Front"/"Back"), and a blank "Back" must never be frame 0.

Run:  python3 publish-assets.py
Output: modified files under site/assets/, printed report
"""
import json, os, shutil, subprocess, sys

WS = '/Users/georgezikry/.hermes/profiles/habibicrafts/workspace'
SRC = f'{WS}/pf-angles'
SITE = f'{WS}/habibi-crafts-site/site'
ANGLES = f'{SITE}/assets/angles'
MOCKUPS = f'{SITE}/assets/mockups'

ANGLE_PX = 900       # viewer frames
THUMB_PX = 800       # grid thumbnails
ANGLE_COLORS = 220   # palette size; keeps frames small without visible loss

# Grid thumbnails are flattened onto --sand (#f0e7d8) rather than left
# transparent. The product cards already paint that colour behind the image,
# so a flattened thumbnail is identical on the page — but the file also has to
# survive being opened, shared, or picked up by a shopping feed, where a
# transparent PNG on a white viewer reads as a product floating on nothing.
SAND = '#f0e7d8'


def rank(angle):
    """Sort key placing the printed side first.

    A blank back must never be frame 0 — the grid would show an empty product.
    """
    a = (angle or '').lower()
    if 'front' in a:                       # 'Front' and 'Front view'
        return 0
    if 'back' in a:                        # blank on most blanks
        return 9
    if any(k in a for k in ('handle', 'left', 'right', 'side')):
        return 1
    return 2


def ordered(entry):
    return sorted(entry.get('angles', []),
                  key=lambda a: (rank(a['angle']), a['angle'].lower()))


def magick(args):
    r = subprocess.run(['magick'] + args, capture_output=True, text=True)
    if r.returncode:
        raise RuntimeError(f'magick {" ".join(args)}: {r.stderr.strip()[:200]}')


def main():
    manifest_path = f'{SRC}/manifest.json'
    if not os.path.exists(manifest_path):
        raise SystemExit(f'{manifest_path} missing — run fetch-angles.py first')
    manifest = json.load(open(manifest_path))

    catalog = json.load(open(f'{SITE}/product-catalog.json'))
    slugs = [e['slug'] for e in catalog]

    os.makedirs(ANGLES, exist_ok=True)
    os.makedirs(MOCKUPS, exist_ok=True)

    published, missing, unchanged = 0, [], 0

    for slug in slugs:
        frames = ordered(manifest.get(slug, {}))
        if not frames:
            missing.append(slug)
            continue

        dest_dir = f'{ANGLES}/{slug}'
        os.makedirs(dest_dir, exist_ok=True)

        # stale frames from an earlier run would linger and be listed in the
        # data-frames attribute, so clear the directory first
        for old in os.listdir(dest_dir):
            if old.endswith('.png'):
                os.remove(f'{dest_dir}/{old}')

        for f in frames:
            src = f'{SRC}/{f["file"]}'
            if not os.path.exists(src):
                continue
            name = os.path.basename(f['file'])
            dest = f'{dest_dir}/{name}'
            magick([src, '-resize', f'{ANGLE_PX}x{ANGLE_PX}', '-strip',
                    '-colors', str(ANGLE_COLORS), '-define', 'png:compression-level=9',
                    dest])

        # grid thumbnail = the first frame, i.e. the same view the viewer opens
        # on, flattened onto the card colour so the file stands alone
        first = f'{SRC}/{frames[0]["file"]}'
        thumb = f'{MOCKUPS}/{slug}.png'
        magick([first, '-resize', f'{THUMB_PX}x{THUMB_PX}', '-strip',
                '-background', SAND, '-flatten',
                '-colors', '128', '-define', 'png:compression-level=9', thumb])
        published += 1

    print(f'published {published} products ({len(slugs) - len(missing)}/{len(slugs)})')
    if missing:
        print(f'\nno angle frames yet — grid falls back to the static mockup:')
        for s in missing:
            print(f'  {s}')

    sizes = subprocess.run(['du', '-sh', ANGLES, MOCKUPS],
                           capture_output=True, text=True).stdout.strip()
    print(f'\n{sizes}')
    return 1 if missing else 0


if __name__ == '__main__':
    sys.exit(main())
