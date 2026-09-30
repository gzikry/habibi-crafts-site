#!/usr/bin/env python3
"""
Build shop.html and the five category pages from product-catalog.json.

Keeps the whole catalogue consistent: one data file, one generator, so adding
a product updates the shop grid, the category grid, and the JSON-LD ItemList
together. Product cards carry their angle frames so app.js can preview them
on hover.
"""
import json, os
from pfangles import order as order_angles
from root import angles_dir, format_cents, site_dir, without_retired_back


SITE = site_dir()
ANGLES = angles_dir()
BASE = 'https://habibicraftsco.com'
# Every local asset URL carries this, and it must be bumped on each deploy:
# Porkbun's CDN caches by full URL, so an unchanged URL keeps serving the
# bytes it cached first, even after the file is replaced.
ASSET_V = '10'


CATS = [
    ('mugs',    'Mugs',    '11 oz white glossy. {price}.',                   'Six to choose from.'),
    ('tees',    'Tees',    'Unisex, S through XL. {price}.',                 'Printed on the front.'),
    ('totes',   'Totes',   'Cotton, one size. {price}.',                     'One size, cotton.'),
    ('baby',    'Onesies', 'White, 3–18 months. {price}.',                   '3 to 18 months.'),
    ('prints',  'Prints',  '12 × 16 matte. {price}.',                        '12 × 16, matte. Frame not included.'),
]


def category_price(catalog, kind):
    cents = {p['price'] for p in catalog if p['category'] == kind}
    if len(cents) != 1:
        raise SystemExit(f'{kind} prices diverged: {sorted(cents)}')
    return format_cents(next(iter(cents)))


def esc(s):
    return (s.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')
             .replace('"', '&quot;'))




def frames_for(slug, manifest):
    angs = without_retired_back(slug, manifest.get(slug, {}).get('angles', []))
    if not angs:
        return []
    ordered = order_angles(angs)
    return [{'src': f"assets/angles/{a['file']}?v={ASSET_V}", 'label': a['angle']}
            for a in ordered]


def card(p, manifest):
    """Product card. Hover previews the extra angles via a tiny data attribute."""
    frames = frames_for(p['slug'], manifest)
    preview = ''
    if len(frames) > 1:
        preview = ' data-preview="' + esc(json.dumps([f['src'] for f in frames[1:]], separators=(',', ':'))) + '"'
    return f'''<a class="product-card reveal" href="product-{p['slug']}.html" data-category="{p['category']}"{preview}>
  <div class="product-media"><img class="mockup" src="assets/mockups/{p['slug']}.png?v=8" alt="{esc(p['name'])}" width="800" height="800" loading="lazy" decoding="async"></div>
  <div class="product-copy">
    <div class="product-row"><h3>{esc(p['name'])}</h3><span class="price">{format_cents(p['price'])}</span></div>
  </div>
</a>'''


def nav(current, prefix=''):
    def cls(href):
        return ' aria-current="page"' if href == current else ''
    return f'''<header class="site-header">
  <nav class="nav" aria-label="Primary navigation">
    <a class="brand" href="index.html"><img src="assets/logo-nav-white.png" alt="Habibi Crafts Co" width="213" height="93"></a>
    <button class="menu-toggle" type="button" aria-expanded="false" aria-controls="primary-menu" aria-label="Open menu"><span></span></button>
    <div class="nav-links" id="primary-menu">
      <a href="shop.html"{cls('shop.html')}>Shop</a>
      <a href="about.html"{cls('about.html')}>About</a>
      <a href="faq.html"{cls('faq.html')}>FAQ</a>
    </div>
  </nav>
</header>'''


def foot():
    return '''<footer class="site-footer">
  <div class="footer-grid">
    <div>
      <div class="footer-brand">Habibi Crafts Co</div>
      <p class="footer-copy">Mugs, tees, totes, onesies, and prints.</p>
    </div>
    <div>
      <div class="footer-title">Shop</div>
      <div class="footer-links">
        <a href="shop.html">Shop</a>
        <a href="mugs.html">Mugs</a>
        <a href="tees.html">Tees</a>
        <a href="totes.html">Totes</a>
        <a href="onesies.html">Onesies</a>
        <a href="prints.html">Prints</a>
      </div>
    </div>
    <div>
      <div class="footer-title">Info</div>
      <div class="footer-links">
        <a href="about.html">About</a>
        <a href="faq.html">FAQ</a>
        <a href="shipping.html">Shipping</a>
        <a href="privacy.html">Privacy</a>
        <a href="contact.html">Contact</a>
      </div>
    </div>
  </div>
  <div class="footer-bottom"><span>&copy; 2026 Habibi Crafts Co</span><span>California</span></div>
</footer>'''


def head(title, desc, canonical, og_image, ld):
    return f'''<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="theme-color" content="#7d2e21">
<title>{esc(title)}</title>
<meta name="description" content="{esc(desc)}">
<meta name="robots" content="index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1">
<link rel="canonical" href="{canonical}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="Habibi Crafts Co">
<meta property="og:title" content="{esc(title)}">
<meta property="og:description" content="{esc(desc)}">
<meta property="og:url" content="{canonical}">
<meta property="og:image" content="{og_image}">
<meta property="og:image:alt" content="Habibi Crafts Co">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="{esc(title)}">
<meta name="twitter:description" content="{esc(desc)}">
<meta name="twitter:image" content="{og_image}">
<meta name="twitter:image:alt" content="Habibi Crafts Co">
<link rel="icon" type="image/png" href="assets/logo.png">
<link rel="apple-touch-icon" href="assets/logo.png">
<link rel="stylesheet" href="styles.css?v={ASSET_V}">
<script type="application/ld+json">{json.dumps(ld, separators=(",", ":"))}</script>
<script src="public-config.js?v={ASSET_V}"></script>
<script defer src="analytics.js?v={ASSET_V}"></script>
<script defer src="bag.js?v={ASSET_V}"></script>
<script defer src="checkout.js?v={ASSET_V}"></script>
<script defer src="spin.js?v={ASSET_V}"></script>
<script defer src="app.js?v={ASSET_V}"></script>
</head>
<body>
<a class="skip-link" href="#main">Skip to content</a>'''


def filter_bar(current):
    order = [('shop.html', 'All')] + [(f'{c}.html', n) for c, n, _, _ in CATS]
    items = []
    for href, label in order:
        cur = ' aria-current="page"' if href == current else ''
        items.append(f'<a class="filter-button" href="{href}"{cur}>{label}</a>')
    return f'<nav class="filter-bar" aria-label="Shop by collection">{"".join(items)}</nav>'


def item_list(products):
    return {"@type": "ItemList", "itemListElement": [
        {"@type": "ListItem", "position": i + 1,
         "url": f"{BASE}/product-{p['slug']}.html", "name": p['name']}
        for i, p in enumerate(products)]}


def main():
    catalog = json.load(open(SITE / 'product-catalog.json'))
    manifest_path = ANGLES / 'manifest.json'
    manifest = json.load(open(manifest_path)) if os.path.exists(manifest_path) else {}
    priced = []
    for kind, label, meta, blurb in CATS:
        priced.append((kind, label, meta.format(price=category_price(catalog, kind)), blurb))

    # ---- shop.html: every product, grouped by category ----
    groups = []
    for kind, label, _, blurb in priced:
        items = [p for p in catalog if p['category'] == kind]
        if not items:
            continue
        groups.append(f'''<section class="section tight shop-section" id="{kind}" aria-labelledby="{kind}-heading">
  <div class="shell">
    <div class="section-head">
      <div><h2 id="{kind}-heading">{esc(label)}</h2><p>{esc(blurb)}</p></div>
      <a class="text-link" href="{kind}.html">Shop {label.lower()}</a>
    </div>
    <div class="product-grid{'' if len(items) > 2 else ' two'}">{"".join(card(p, manifest) for p in items)}</div>
  </div>
</section>''')

    shop_ld = {"@context": "https://schema.org", "@type": "CollectionPage",
               "name": "Shop Habibi Crafts Co", "url": f"{BASE}/shop.html",
               "mainEntity": item_list(catalog)}
    shop = '\n'.join([
        head('Shop | Habibi Crafts Co',
             'Made after you order. Free US shipping on orders $39 and up. $6.99 flat below that.',
             f'{BASE}/shop.html', f'{BASE}/assets/mockups/ya-aini.png', shop_ld),
        nav('shop.html'),
        '<main id="main">',
        f'''  <section class="catalog-head"><div class="shell">
    <h1>The shop</h1>
    <p class="lede">Everything we make, in one place. Free US shipping on orders $39 and up. $6.99 flat below that.</p>
    {filter_bar('shop.html')}
  </div></section>''',
        '\n'.join(groups),
        '</main>',
        foot(),
        '</body>\n</html>\n',
    ])
    open(SITE / 'shop.html', 'w').write(shop)

    # ---- category pages ----
    for kind, label, meta, blurb in priced:
        items = [p for p in catalog if p['category'] == kind]
        ld = {"@context": "https://schema.org", "@type": "CollectionPage",
              "name": f"{label} — Habibi Crafts Co", "url": f"{BASE}/{kind}.html",
              "mainEntity": item_list(items)}
        grid_cls = 'product-grid' if len(items) > 2 else 'product-grid two'
        page = '\n'.join([
            head(f'{label} | Habibi Crafts Co', meta,
                 f'{BASE}/{kind}.html', f'{BASE}/assets/mockups/{items[0]["slug"]}.png', ld),
            nav('shop.html'),
            '<main id="main">',
            f'''  <section class="catalog-head"><div class="shell">
    <h1>{esc(label)}</h1>
    <p class="lede">{esc(meta)}</p>
    {filter_bar(f'{kind}.html')}
  </div></section>''',
            f'''  <section class="section tight"><div class="shell">
    <div class="{grid_cls}">{"".join(card(p, manifest) for p in items)}</div>
  </div></section>''',
            '</main>',
            foot(),
            '</body>\n</html>\n',
        ])
        open(SITE / f'{kind}.html', 'w').write(page)

    print(f'shop.html + {len(CATS)} category pages written from {len(catalog)} products')


if __name__ == '__main__':
    main()
