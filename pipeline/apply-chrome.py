#!/usr/bin/env python3
"""Refresh shared chrome on hand-written pages from pipeline/chrome.py.

about.html is locked and is not touched. Generated pages get chrome from
the storefront builders instead.
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from chrome import footer, nav, trust
from storefront import share_image_alt
from root import site_dir

HAND = (
    'faq.html',
    'shipping.html',
    'contact.html',
    'privacy.html',
    'cart.html',
    'checkout.html',
    'tracking.html',
    'order-confirmation.html',
)
ROOT_HAND = ('404.html',)


def end_of_element(html, start):
    tag = html[start + 1:].split()[0].split('>')[0]
    depth = 0
    i = start
    open_token = '<' + tag
    close_token = '</' + tag
    while i < len(html):
        next_open = html.find(open_token, i)
        next_close = html.find(close_token, i)
        if next_close < 0:
            raise SystemExit(f'unclosed {tag}')
        if next_open != -1 and next_open < next_close:
            depth += 1
            i = next_open + len(open_token)
            continue
        depth -= 1
        end = html.find('>', next_close)
        if depth == 0:
            return end + 1
        i = end + 1
    raise SystemExit(f'scan failed for {tag}')


def replace_element(html, marker, new):
    start = html.find(marker)
    if start < 0:
        raise SystemExit(f'missing {marker}')
    end = end_of_element(html, start)
    return html[:start] + new + html[end:]


def refresh(path, prefix=''):
    html = path.read_text()
    html = replace_element(html, '<header class="site-header">', nav(prefix=prefix))
    html = replace_element(html, '<div class="trust-strip"', trust(prefix))
    html = replace_element(html, '<footer class="site-footer">', footer(prefix))
    html = html.replace('styles.css?v=20', 'styles.css?v=22')
    html = html.replace('styles.css?v=21', 'styles.css?v=22')
    html = html.replace('Habibi Crafts Co. Mugs, tees, totes, and more.', share_image_alt)
    html = html.replace('checkout.js?v=12', 'checkout.js?v=13')
    html = html.replace('bag.js?v=15', 'bag.js?v=16')
    path.write_text(html)
    print('chrome', path.name)


def main():
    site = site_dir()
    for name in HAND:
        refresh(site / name)
    for name in ROOT_HAND:
        refresh(site / name, prefix='/')


if __name__ == '__main__':
    main()
