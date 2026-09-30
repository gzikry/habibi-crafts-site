#!/usr/bin/env python3
"""Regenerate sitemap.xml from the pages that actually exist.

Listing only real files keeps the sitemap honest: a URL in here is a URL that
returns 200. Product pages include an image entry so the artwork can surface
in image search.
"""
import json, os
from datetime import date
from root import site_dir

SITE = site_dir()
BASE = 'https://habibicraftsco.com'
TODAY = date.today().isoformat()

# (filename, changefreq, priority)
CORE = [
    ('index.html',    'weekly',  '1.0'),
    ('shop.html',     'weekly',  '0.9'),
    ('mugs.html',     'weekly',  '0.8'),
    ('tees.html',     'weekly',  '0.8'),
    ('totes.html',    'weekly',  '0.8'),
    ('onesies.html',  'weekly',  '0.8'),
    ('prints.html',   'weekly',  '0.8'),
    ('about.html',    'monthly', '0.6'),
    ('faq.html',      'monthly', '0.5'),
    ('shipping.html', 'monthly', '0.4'),
    ('privacy.html',  'yearly',  '0.3'),
    ('contact.html',  'yearly',  '0.3'),
]


def xml_escape(s):
    """Escape for XML text content. '&' must be first or it double-escapes."""
    return (s.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;'))


def main():
    catalog = json.load(open(f'{SITE}/product-catalog.json'))

    urls = []
    for name, freq, prio in CORE:
        if not os.path.exists(f'{SITE}/{name}'):
            continue
        loc = BASE + '/' if name == 'index.html' else f'{BASE}/{name}'
        urls.append(f'''  <url>
    <loc>{loc}</loc>
    <lastmod>{TODAY}</lastmod>
    <changefreq>{freq}</changefreq>
    <priority>{prio}</priority>
  </url>''')

    for p in catalog:
        name = f"product-{p['slug']}.html"
        if not os.path.exists(f'{SITE}/{name}'):
            continue
        urls.append(f'''  <url>
    <loc>{BASE}/{name}</loc>
    <lastmod>{TODAY}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.7</priority>
    <image:image>
      <image:loc>{BASE}/assets/mockups/{p['slug']}.png</image:loc>
      <image:title>{xml_escape(p['name'])} — Habibi Crafts Co</image:title>
    </image:image>
  </url>''')

    xml = ('<?xml version="1.0" encoding="UTF-8"?>\n'
           '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"\n'
           '        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">\n'
           + '\n'.join(urls) + '\n</urlset>\n')
    open(f'{SITE}/sitemap.xml', 'w').write(xml)

    n_urls = xml.count('<url>')
    n_imgs = xml.count('<image:image>')
    print(f'sitemap.xml: {n_urls} urls, {n_imgs} images')

    # robots.txt should point at the real sitemap
    robots = f'''User-agent: *
Allow: /

Sitemap: {BASE}/sitemap.xml
'''
    open(f'{SITE}/robots.txt', 'w').write(robots)
    print('robots.txt updated')


if __name__ == '__main__':
    main()
