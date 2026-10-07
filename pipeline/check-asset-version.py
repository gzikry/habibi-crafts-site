#!/usr/bin/env python3
"""Every script and stylesheet reference must use pipeline.chrome.SCRIPT_V.

Image URLs may carry their own ?v= because frames were published at different
times. They still have to be versioned.
"""
import os
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from chrome import SCRIPT_V
from root import repo_root, site_dir

ROOT = repo_root()
SITE = site_dir()
PIPE = ROOT / 'pipeline'
BUILDERS = (
    'build-products.py', 'build-shop.py', 'build-home.py', 'build-sitemap.py',
    'storefront.py', 'chrome.py',
)

failures = []

for name in BUILDERS:
    text = (PIPE / name).read_text()
    for asset in SCRIPT_V:
        for hit in re.findall(rf'{re.escape(asset)}\?v=(\d+)', text):
            failures.append(f'{name}: {asset} has a hardcoded ?v={hit}')

print('SCRIPT_V ' + ', '.join(f'{k}={v}' for k, v in SCRIPT_V.items()))

for filename in sorted(os.listdir(SITE)):
    if not filename.endswith('.html'):
        continue
    html = (SITE / filename).read_text()
    style_hits = re.findall(r'styles\.css\?v=(\d+)', html)
    expected_style = SCRIPT_V['styles.css']
    # Redirect stubs have no stylesheet. Every real page has to carry the current key.
    if 'rel="stylesheet"' in html or 'site-header' in html:
        if style_hits != [expected_style]:
            failures.append(
                f'{filename}: styles.css?v={",".join(style_hits) or "missing"}, expected {expected_style}'
            )
    for asset, expected in SCRIPT_V.items():
        if asset == 'styles.css':
            continue
        for found in re.findall(rf'{re.escape(asset)}\?v=(\d+)', html):
            if found != expected:
                failures.append(f'{filename}: {asset}?v={found}, expected {expected}')
    for match in re.finditer(
        r'(?:src|href)="(assets/(?:mockups|angles|on-model)/[^"?]+\.png|assets/on-model/[^"?]+\.jpg)"',
        html,
    ):
        failures.append(f'{filename}: unversioned image {match.group(1)}')

if failures:
    print(f'\n{len(failures)} problem(s):')
    for item in failures[:20]:
        print(f'  {item}')
    sys.exit(1)

print('script and stylesheet versions match, and images are versioned')
