#!/usr/bin/env python3
"""
Every versioned asset reference must derive from one constant.

Porkbun's CDN caches by full URL, so each asset carries ?v=N and the number has
to move with the code. That only works if the builders interpolate the
constant everywhere. A hardcoded ?v=8 in the stylesheet and script tags meant
the browser kept a cached spin.js and styles.css while the images moved on, so
a fixed viewer shipped but the old one stayed live.

Run before deploying: python3 check-asset-version.py
"""
import os, re, sys
from root import repo_root, site_dir

ROOT = repo_root()
SITE = site_dir()
PIPE = ROOT / 'pipeline'
BUILDERS = ('build-products.py', 'build-shop.py', 'build-home.py')

# references that must use the constant
ASSETS = ('styles.css', 'app.js', 'spin.js', 'checkout.js', 'bag.js', 'analytics.js',
          'public-config.js')

failures = []

# --- the builders must not contain a literal version -----------------------
versions = {}
for g in BUILDERS:
    s = open(PIPE / g).read()
    m = re.search(r"^ASSET_V = '(\d+)'", s, re.M)
    if not m:
        failures.append(f'{g}: no ASSET_V constant')
        continue
    versions[g] = m.group(1)
    for asset in ASSETS:
        for hit in re.findall(rf'{re.escape(asset)}\?v=(\d+)', s):
            failures.append(f'{g}: {asset} has a hardcoded ?v={hit} '
                            f'(must be ?v={{ASSET_V}})')

if len(set(versions.values())) > 1:
    failures.append(f'builders disagree on the version: {versions}')

expected = next(iter(versions.values()), None)
print(f'ASSET_V = {expected} in {", ".join(versions)}')

# --- the built pages must all agree, at the same version -------------------
seen = {}
for f in sorted(os.listdir(SITE)):
    if not f.endswith('.html'):
        continue
    html = open(os.path.join(SITE, f)).read()
    for asset in ASSETS:
        for v in re.findall(rf'{re.escape(asset)}\?v=(\d+)', html):
            seen.setdefault(v, []).append(f'{f}:{asset}')

if len(seen) > 1:
    for v, where in sorted(seen.items()):
        if v != expected:
            sample = ', '.join(sorted(set(where))[:3])
            failures.append(f'{len(where)} reference(s) at ?v={v}, expected {expected} '
                            f'(e.g. {sample})')

for v, where in sorted(seen.items()):
    print(f'  built pages: {len(where):>4} reference(s) at ?v={v}')

# --- image URLs must be versioned too --------------------------------------
for f in sorted(os.listdir(SITE)):
    if not f.endswith('.html'):
        continue
    html = open(os.path.join(SITE, f)).read()
    for m in re.finditer(r'(?:src|href)="(assets/(?:mockups|angles)/[^"]+\.png)"', html):
        failures.append(f'{f}: unversioned image {m.group(1)}')

if failures:
    print(f'\n{len(failures)} problem(s):')
    for x in failures[:15]:
        print(f'  {x}')
    sys.exit(1)

print('\nall asset references carry one consistent version')
