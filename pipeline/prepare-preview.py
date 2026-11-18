#!/usr/bin/env python3
"""Cloudflare Pages build step.

Without HABIBI_PREVIEW=1 this leaves the tree alone, so a production Pages
build still publishes the committed site/.

With HABIBI_PREVIEW=1 it rebuilds generated pages into --out. The default
output is site/, and that default is allowed only when CF_PAGES=1.
"""
import json
import os
import shutil
import subprocess
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from root import repo_root, site_dir
from chrome import preview_requested
from storefront import checkout_enabled, for_sale

INDEX_ROBOTS = 'index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1'
BUILDERS = (
    'build-shop.py',
    'build-home.py',
    'build-products.py',
    'build-sitemap.py',
)
CART_BEFORE = (
    '<button class="button browse-mode" type="button" disabled '
    'data-checkout data-bag-checkout aria-disabled="true">Opening soon</button>'
)
CART_AFTER = (
    '<button class="button" type="button" data-checkout data-bag-checkout>Check out</button>'
)


def env_on(name):
    return os.environ.get(name, '').strip().lower() in {'1', 'true', 'yes', 'on'}


def api_base():
    raw = os.environ.get('CHECKOUT_API_BASE', '').strip() or os.environ.get('CF_PAGES_URL', '').strip()
    return raw.rstrip('/')


def public_config(enabled, base):
    flag = 'true' if enabled else 'false'
    return (
        'window.HABIBI_PUBLIC_CONFIG = {\n'
        f'  CHECKOUT_ENABLED: {flag},\n'
        '  ADSENSE_ENABLED: false,\n'
        "  ADSENSE_PUBLISHER_ID: '',\n"
        "  STRIPE_PUBLISHABLE_KEY: '',\n"
        f'  CHECKOUT_API_BASE: {json.dumps(base)}\n'
        '};\n'
        f'window.HABIBI_CHECKOUT_ENABLED = {flag};\n'
    )


def output_dir():
    if '--out' in sys.argv:
        return Path(sys.argv[sys.argv.index('--out') + 1]).resolve()
    return site_dir()


def copy_site(dest):
    if dest.exists():
        shutil.rmtree(dest)
    shutil.copytree(site_dir(), dest)


def run_builders(out):
    root = repo_root()
    for name in BUILDERS:
        subprocess.check_call([sys.executable, str(root / 'pipeline' / name), '--out', str(out)])


def patch_html(out, enabled):
    for path in out.rglob('*.html'):
        text = path.read_text()
        text = text.replace(f'content="{INDEX_ROBOTS}"', 'content="noindex,nofollow"')
        text = text.replace('content="noindex,follow"', 'content="noindex,nofollow"')
        if enabled and path.name == 'cart.html':
            if CART_BEFORE in text:
                text = text.replace(CART_BEFORE, CART_AFTER, 1)
            elif 'Check out' not in text:
                raise SystemExit(f'cart checkout button missing in {path}')
        path.write_text(text)


def patch_catalog(out):
    path = out / 'product-catalog.json'
    catalog = json.loads(path.read_text())
    if checkout_enabled():
        for product in catalog:
            product['purchasable'] = for_sale(product)
    path.write_text(json.dumps(catalog, indent=2) + '\n')


def main():
    if not preview_requested():
        print('Not a preview build. Leaving site/ unchanged.')
        return
    out = output_dir()
    site = site_dir()
    if out == site and os.environ.get('CF_PAGES') != '1':
        raise SystemExit('Refusing to rewrite site/ outside Cloudflare. Pass --out.')
    if out != site:
        copy_site(out)
    run_builders(out)
    enabled = checkout_enabled()
    (out / 'public-config.js').write_text(public_config(enabled, api_base()))
    patch_html(out, enabled)
    patch_catalog(out)
    (out / 'robots.txt').write_text('User-agent: *\nDisallow: /\n')
    (out / '_headers').write_text('/*\n  X-Robots-Tag: noindex, nofollow\n')
    print(f'preview build wrote {out}')


if __name__ == '__main__':
    main()
