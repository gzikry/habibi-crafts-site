#!/usr/bin/env python3
"""Regenerate storefront pages into a temp directory and diff them against site/."""
import subprocess
import sys
import tempfile
from pathlib import Path

from root import angles_dir, repo_root, site_dir

ROOT = repo_root()
SITE = site_dir()
BUILDERS = (
    'build-shop.py',
    'build-home.py',
    'build-products.py',
    'build-sitemap.py',
)


def main():
    notes = []
    if not (angles_dir() / 'manifest.json').exists():
        notes.append(
            'pf-angles/manifest.json is not in the repo. Frames come from '
            'pipeline/frame-snapshot.json. A manifest from sync still drops retired tote backs.'
        )
    if not (ROOT / 'product-rank.json').exists():
        notes.append(
            'product-rank.json is not in the repo. The home grid stays in catalog order.'
        )
    for note in notes:
        print(note)

    failed = False
    with tempfile.TemporaryDirectory() as tmp:
        out = Path(tmp)
        for name in BUILDERS:
            subprocess.check_call([sys.executable, str(ROOT / 'pipeline' / name), '--out', str(out)])
        generated = sorted(p for p in out.iterdir() if p.is_file())
        for built in generated:
            live = SITE / built.name
            if not live.exists() or built.read_bytes() != live.read_bytes():
                failed = True
                print(f'differs: {built.name}')
        print(f'{len(generated)} generated files' + ('' if not failed else ', with diffs'))
    if failed:
        sys.exit(1)
    print('builder output matches site/')


if __name__ == '__main__':
    main()
