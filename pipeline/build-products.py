#!/usr/bin/env python3
"""
Generate the product pages with the spin viewer wired in.

Reads:
  site/product-catalog.json   (slug, name, category, price, copy, product id)
  workspace/pf-angles/manifest.json  (angle frames per slug)

Writes:
  site/product-<slug>.html

Keeping this generator means the 20 product pages stay consistent when
prices, copy, or angle frames change — edit the JSON, re-run, done.
"""
import json, os, re, sys
import sys as _sys
_sys.path.insert(0, '/Users/georgezikry/.hermes/profiles/habibicrafts/workspace')
from pfangles import order as order_angles

SITE = '/Users/georgezikry/.hermes/profiles/habibicrafts/workspace/habibi-crafts-site/site'
ANGLES = '/Users/georgezikry/.hermes/profiles/habibicrafts/workspace/pf-angles'
BASE = 'https://habibicraftsco.com'
# Every local asset URL carries this, and it must be bumped on each deploy:
# Porkbun's CDN caches by full URL, so an unchanged URL keeps serving the
# bytes it cached first, even after the file is replaced.
ASSET_V = '10'


CAT_META = {
    'mugs':    ('Mug',    'mugs.html',    'Mugs',    '$18', '11 oz · white glossy',
                [('Size', '11 oz'), ('Finish', 'White glossy'), ('Material', 'Ceramic')]),
    'tees':    ('Tee',    'tees.html',    'Tees',    '$32', 'Unisex · S through XL',
                [('Sizes', 'S, M, L, XL'), ('Fit', 'Unisex'), ('Print', 'Front')]),
    'totes':   ('Tote',   'totes.html',   'Totes',   '$34', 'Cotton · one size',
                [('Size', 'One size'), ('Material', 'Cotton'), ('Print', 'Front')]),
    'baby':    ('Onesie', 'onesies.html', 'Onesies', '$28', '3–6m · 6–12m · 12–18m',
                [('Sizes', '3–6m, 6–12m, 12–18m'), ('Color', 'White'), ('Print', 'Front')]),
    'prints':  ('Print',  'prints.html',  'Prints',  '$24', '12 × 16 in · matte',
                [('Size', '12 × 16 in'), ('Paper', 'Matte'), ('Frame', 'Not included')]),
}


def esc(s):
    return (s.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')
             .replace('"', '&quot;'))




def frames_for(slug, manifest):
    angs = manifest.get(slug, {}).get('angles', [])
    if not angs:
        return []
    ordered = order_angles(angs)
    return [{'src': f"assets/angles/{a['file']}?v={ASSET_V}", 'label': a['angle']}
            for a in ordered]


def head(title, desc, slug, kind_label, canonical):
    og = f'{BASE}/assets/mockups/{slug}.png'
    ld = {
        "@context": "https://schema.org",
        "@graph": [
            {"@type": "Product",
             "@id": f"{BASE}/product-{slug}.html#product",
             "name": title,
             "description": desc,
             "image": og,
             "brand": {"@type": "Brand", "name": "Habibi Crafts Co"},
             "offers": {"@type": "Offer",
                        "url": f"{BASE}/product-{slug}.html",
                        "priceCurrency": "USD",
                        "price": CAT_META[kind_label][3].lstrip('$') + '.00',
                        "availability": "https://schema.org/OutOfStock",
                        "itemCondition": "https://schema.org/NewCondition"}},
            {"@type": "BreadcrumbList", "itemListElement": [
                {"@type": "ListItem", "position": 1, "name": "Home", "item": f"{BASE}/"},
                {"@type": "ListItem", "position": 2, "name": "Shop", "item": f"{BASE}/shop.html"},
                {"@type": "ListItem", "position": 3, "name": CAT_META[kind_label][2],
                 "item": f"{BASE}/{CAT_META[kind_label][1]}"},
                {"@type": "ListItem", "position": 4, "name": title,
                 "item": f"{BASE}/product-{slug}.html"}]}
        ]
    }
    return f'''<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="theme-color" content="#7d2e21">
<title>{esc(title)} | Habibi Crafts Co</title>
<meta name="description" content="{esc(desc)}">
<meta name="robots" content="index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1">
<link rel="canonical" href="{canonical}">
<meta property="og:type" content="product">
<meta property="og:site_name" content="Habibi Crafts Co">
<meta property="og:title" content="{esc(title)} | Habibi Crafts Co">
<meta property="og:description" content="{esc(desc)}">
<meta property="og:url" content="{canonical}">
<meta property="og:image" content="{og}">
<meta property="og:image:alt" content="{esc(title)}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="{esc(title)} | Habibi Crafts Co">
<meta name="twitter:description" content="{esc(desc)}">
<meta name="twitter:image" content="{og}">
<meta name="twitter:image:alt" content="{esc(title)}">
<link rel="icon" type="image/png" href="assets/logo.png">
<link rel="apple-touch-icon" href="assets/logo.png">
<link rel="stylesheet" href="styles.css?v={ASSET_V}">
<script type="application/ld+json">{json.dumps(ld, separators=(",", ":"))}</script>
<script src="public-config.js?v={ASSET_V}"></script>
<script defer src="analytics.js?v={ASSET_V}"></script>
<script defer src="checkout.js?v={ASSET_V}"></script>
<script defer src="spin.js?v={ASSET_V}"></script>
<script defer src="app.js?v={ASSET_V}"></script>
</head>
<body>
<a class="skip-link" href="#main">Skip to content</a>
<header class="site-header">
  <nav class="nav" aria-label="Primary navigation">
    <a class="brand" href="index.html"><img src="assets/logo-nav-white.png" alt="Habibi Crafts Co" width="213" height="93"></a>
    <button class="menu-toggle" type="button" aria-expanded="false" aria-controls="primary-menu" aria-label="Open menu"><span></span></button>
    <div class="nav-links" id="primary-menu">
      <a href="shop.html" aria-current="page">Shop</a>
      <a href="about.html">About</a>
      <a href="faq.html">FAQ</a>
    </div>
  </nav>
</header>'''


def viewer(slug, frames, title, kind, autospin=False):
    """Progressive-enhancement angle viewer: a plain img that JS upgrades.

    The control is a range slider, not dots: it reads as a scrubber the
    shopper drags to turn the product, and it is a single tab stop with
    proper aria-valuetext rather than N unlabelled buttons.
    """
    first = frames[0]['src'] if frames else f'assets/mockups/{slug}.png?v={ASSET_V}'
    payload = json.dumps(frames, separators=(',', ':')) if len(frames) > 1 else ''
    multi = len(frames) > 1

    label = frames[0].get('label') if frames else ''
    counter = (f'<div class="spin-counter" data-spin-counter>{esc(label)}</div>'
               if multi and label else
               '<div class="spin-counter" data-spin-counter hidden></div>' if multi else '')

    if multi:
        slider = (f'''<div class="spin-controls">
        <span class="spin-end" aria-hidden="true">360°</span>
        <input class="spin-slider" type="range" data-spin-slider
               min="0" max="{len(frames)-1}" step="1" value="0"
               aria-label="Rotate {esc(title)}">
      </div>''')
    else:
        slider = ('<div class="spin-controls" data-spin-controls hidden>'
                  '<input class="spin-slider" type="range" data-spin-slider hidden></div>')

    hint = ('<div class="spin-hint" data-spin-hint>Drag to rotate</div>' if multi else '')
    auto = ' data-autospin' if (autospin and multi) else ''

    return f'''    <div class="spin" data-spin data-kind="{kind}" data-frames="{esc(payload)}" data-alt="{esc(title)}"{auto}>
      {counter}
      <div class="spin-stage" data-spin-stage>
        <img data-spin-image class="mockup" src="{first}" alt="{esc(title)}" width="1200" height="1200" decoding="async">
      </div>
      {hint}
      {slider}
    </div>'''


def related(catalog, slug, kind, n=3):
    others = [p for p in catalog if p['category'] == kind and p['slug'] != slug][:n]
    if not others:
        return ''
    cards = []
    for p in others:
        cards.append(f'''<a class="product-card reveal" href="product-{p['slug']}.html" data-category="{p['category']}">
  <div class="product-media"><img class="mockup" src="assets/mockups/{p['slug']}.png?v=8" alt="{esc(p['name'])}" width="800" height="800" loading="lazy" decoding="async"></div>
  <div class="product-copy">
    <div class="product-row"><h3>{esc(p['name'])}</h3><span class="price">${p['price']}</span></div>
  </div>
</a>''')
    label = CAT_META[kind][2]
    return f'''
  <section class="section tight"><div class="shell">
    <div class="section-head"><h2>More {label.lower()}</h2><a class="text-link" href="{CAT_META[kind][1]}">Shop {label.lower()}</a></div>
    <div class="product-grid">{"".join(cards)}</div>
  </div></section>'''


def footer():
    return '''
<footer class="site-footer">
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
  <div class="footer-bottom"><span>© 2026 Habibi Crafts Co</span><span>California</span></div>
</footer>
</body>
</html>
'''


def main():
    catalog = json.load(open(f'{SITE}/product-catalog.json'))
    man_path = f'{ANGLES}/manifest.json'
    manifest = json.load(open(man_path)) if os.path.exists(man_path) else {}
    built, missing = [], []

    for p in catalog:
        slug = p['slug']
        kind = p['category']
        cat, cat_page, cat_name, price, size_line, details = CAT_META[kind]
        entry = manifest.get(slug, {})
        angs = entry.get('angles', [])
        frames = frames_for(slug, manifest)
        if not frames:
            missing.append(slug)

        subtitle = p.get('subtitle', '')
        # Meta description = name + the same human line shown on the page.
        desc = f"{p['name']} — {subtitle}" if subtitle else p['name']
        canonical = f"{BASE}/product-{slug}.html"

        html = '\n'.join([
            head(p['name'], desc, slug, kind, canonical),
            '<main id="main">',
            '  <div class="shell product-page">',
            viewer(slug, frames, p['name'], kind),
            '''    <div class="product-meta">
      <nav class="breadcrumbs" aria-label="Breadcrumb"><a href="index.html">Home</a> / <a href="shop.html">Shop</a> / <a href="''' + cat_page + '''">''' + cat_name + '''</a></nav>
      <div class="eyebrow">''' + cat + '''</div>
      <h1>''' + esc(p['name']) + '''</h1>
      <p class="product-subtitle">''' + esc(subtitle) + '''</p>
      <div class="product-price">''' + price + '''</div>
      <p class="size-line">''' + size_line + '''</p>
      <div class="actions"><button class="button" type="button" disabled data-checkout data-product-slug="''' + slug + '''" aria-disabled="true">Notify me</button></div>
      <div class="detail-list">
        <h2>Details</h2>
        <dl>''' + ''.join(
            f'<div><dt>{esc(k)}</dt><dd>{esc(v)}</dd></div>' for k, v in details
        ) + '''</dl>
      </div>
      <p class="product-blurb">Printed and shipped when you order it. Most orders leave the workshop in two to five days.</p>
    </div>''',
            '  </div>',
            related(catalog, slug, kind),
            '</main>',
            footer(),
        ])
        open(f'{SITE}/product-{slug}.html', 'w').write(html)
        built.append(slug)

    print(f'Built {len(built)} product pages')
    if missing:
        print(f'No angle frames yet (falling back to static mockup): {", ".join(missing)}')


if __name__ == '__main__':
    main()
