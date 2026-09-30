#!/usr/bin/env python3
"""
Build the front page.

The page leads with the catalogue itself rather than with chrome: one clean,
borderless product grid with an editorial band set into it. The grid order
comes from rank-products.py, which ranks by units sold in Printful and falls
back to the curated catalogue order while there are no orders — so the page
looks the same today and starts reordering itself once the shop is selling.
Nothing on the page says the order means anything.

Reads:  site/product-catalog.json, pf-angles/manifest.json, product-rank.json
Writes: site/index.html
"""
import json, os
from root import money, repo_root, site_dir

WS = repo_root()
SITE = site_dir()
ANGLES = f'{WS}/pf-angles'
RANK = f'{WS}/product-rank.json'
BASE = 'https://habibicraftsco.com'
# Every local asset URL carries this, and it must be bumped on each deploy:
# Porkbun's CDN caches by full URL, so an unchanged URL keeps serving the
# bytes it cached first, even after the file is replaced.
ASSET_V = '10'

HERO_SLUGS = ['ya-aini', 'khalas-habibi', 'halawa']

# where the editorial band is set into the product grid
BAND_AFTER = 6


def esc(s):
    return (s.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')
             .replace('"', '&quot;'))




def frames_for(slug, manifest):
    import sys
    sys.path.insert(0, repo_root())
    from pfangles import order as order_angles
    angs = manifest.get(slug, {}).get('angles', [])
    if not angs:
        return []
    ordered = order_angles(angs)
    return [{'src': f"assets/angles/{a['file']}?v={ASSET_V}", 'label': a['angle']}
            for a in ordered]


def spin_block(slug, frames, name, kind, autospin=False):
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
                 aria-label="Rotate {esc(name)}">
        </div>''')
    else:
        slider = ('<div class="spin-controls" hidden>'
                  '<input class="spin-slider" type="range" data-spin-slider hidden></div>')
    hint = '<div class="spin-hint" data-spin-hint>Drag to rotate</div>' if multi else ''
    auto = ' data-autospin' if (autospin and multi) else ''
    return f'''<div class="spin hero-spin" data-spin data-kind="{kind}" data-frames="{esc(payload)}" data-alt="{esc(name)}"{auto}>
          {counter}
          <div class="spin-stage" data-spin-stage>
            <img data-spin-image class="mockup" src="{first}" alt="{esc(name)}" width="1200" height="1200" decoding="async" fetchpriority="high">
          </div>
          {hint}
          {slider}
        </div>'''


def pcard(p, frames, manifest):
    """Product-forward card: image, then name over price. No chrome."""
    fr = frames_for(p['slug'], manifest)
    src = fr[0]['src'] if fr else f"assets/mockups/{p['slug']}.png?v={ASSET_V}"
    return f'''<a class="pcard reveal" href="product-{p['slug']}.html" data-category="{p['category']}">
  <div class="pcard-media"><img class="mockup" src="{src}" alt="{esc(p['name'])}" width="800" height="800" loading="lazy" decoding="async"></div>
  <div class="pcard-title">{esc(p['name'])}</div>
  <div class="pcard-price">{money(p['price'])}</div>
</a>'''


def band():
    """Editorial panel set into the grid, as a collection page would carry."""
    return f'''<section class="band" aria-labelledby="band-heading">
  <div class="band-copy">
    <div class="band-kicker">Made to order</div>
    <h2 id="band-heading">Nothing is printed until you ask for it.</h2>
    <p>Every mug, shirt, and tote is made after the order comes in. It takes a few days longer than pulling something off a shelf, and it means we can carry this many designs without printing anything nobody wanted.</p>
    <a class="band-link" href="about.html">How it works</a>
  </div>
  <div class="band-media">
    <img class="mockup" src="assets/angles/gather-grow/handle-on-right.png?v={ASSET_V}" alt="Gather &amp; Grow tote" width="900" height="900" loading="lazy" decoding="async">
  </div>
</section>'''


def filter_bar():
    order = [('shop.html', 'All'), ('mugs.html', 'Mugs'), ('tees.html', 'Tees'),
             ('totes.html', 'Totes'), ('onesies.html', 'Onesies'), ('prints.html', 'Prints')]
    items = ''.join(f'<a class="filter-button" href="{h}">{esc(n)}</a>' for h, n in order)
    return f'<nav class="filter-bar" aria-label="Shop by collection">{items}</nav>'


def main():
    if os.environ.get('HABIBI_FULL_REBUILD') != '1':
        from prices import apply_launch_copy
        apply_launch_copy(SITE)
        print('patched launch prices into the existing pages')
        return
    catalog = json.load(open(f'{SITE}/product-catalog.json'))
    manifest_path = f'{ANGLES}/manifest.json'
    manifest = json.load(open(manifest_path)) if os.path.exists(manifest_path) else {}

    by_slug = {p['slug']: p for p in catalog}
    curated = [p['slug'] for p in catalog]

    # Sales rank when we have it, curated order otherwise. Ties keep the
    # curated sequence, so an empty order book changes nothing.
    order = curated
    if os.path.exists(RANK):
        ranked = json.load(open(RANK)).get('ranked') or []
        order = [s for s in ranked if s in by_slug] + [s for s in curated if s not in ranked]
    products = [by_slug[s] for s in order]

    hero = [by_slug[s] for s in HERO_SLUGS if s in by_slug]
    hero_name = hero[0]['name'] if hero else 'Ya Aini'
    hero_slug = hero[0]['slug'] if hero else 'ya-aini'
    hero_frames = frames_for(hero_slug, manifest)

    cards = [pcard(p, frames_for(p['slug'], manifest), manifest) for p in products]
    grid = cards[:BAND_AFTER] + [band()] + cards[BAND_AFTER:]

    ld = {"@context": "https://schema.org", "@graph": [
        {"@type": "Store", "@id": f"{BASE}/#store", "name": "Habibi Crafts Co",
         "url": f"{BASE}/", "logo": f"{BASE}/assets/logo.png",
         "image": f"{BASE}/assets/mockups/ya-aini.png",
         "description": "Mugs, tees, totes, onesies, and prints, made after you order them."},
        {"@type": "WebSite", "@id": f"{BASE}/#website", "url": f"{BASE}/",
         "name": "Habibi Crafts Co", "publisher": {"@id": f"{BASE}/#store"},
         "inLanguage": "en-US"},
        {"@type": "ItemList", "name": "Shop", "itemListElement": [
            {"@type": "ListItem", "position": i + 1,
             "url": f"{BASE}/product-{p['slug']}.html", "name": p['name']}
            for i, p in enumerate(products)]},
    ]}

    html = f'''<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="theme-color" content="#7d2e21">
<title>Habibi Crafts Co — mugs, tees, totes, onesies, prints</title>
<meta name="description" content="Mugs, tees, totes, onesies, and prints, made after you order them. Turn any piece to see it from every side.">
<meta name="robots" content="index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1">
<link rel="canonical" href="{BASE}/">
<meta property="og:type" content="website">
<meta property="og:site_name" content="Habibi Crafts Co">
<meta property="og:title" content="Habibi Crafts Co">
<meta property="og:description" content="Mugs, tees, totes, onesies, and prints, made after you order them.">
<meta property="og:url" content="{BASE}/">
<meta property="og:image" content="{BASE}/assets/mockups/ya-aini.png">
<meta property="og:image:alt" content="Ya Aini">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="Habibi Crafts Co">
<meta name="twitter:description" content="Mugs, tees, totes, onesies, and prints, made after you order them.">
<meta name="twitter:image" content="{BASE}/assets/mockups/ya-aini.png">
<meta name="twitter:image:alt" content="Ya Aini">
<link rel="icon" type="image/png" href="assets/logo.png">
<link rel="apple-touch-icon" href="assets/logo.png">
<link rel="preload" as="image" href="assets/angles/{hero_slug}/front-view.png?v={ASSET_V}">
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
    <a class="brand" href="index.html" aria-current="page"><img src="assets/logo-nav-white.png" alt="Habibi Crafts Co" width="213" height="93"></a>
    <a class="nav-bag" href="cart.html" aria-label="Bag — checkout isn’t open"><span class="nav-bag-label">Bag</span><span class="nav-bag-badge" hidden>0</span></a>
    <button class="menu-toggle" type="button" aria-expanded="false" aria-controls="primary-menu" aria-label="Open menu"><span></span></button>
    <div class="nav-links" id="primary-menu">
      <a href="shop.html">Shop</a>
      <a href="about.html">About</a>
      <a href="faq.html">FAQ</a>
    </div>
  </nav>
</header>
<main id="main">
  <section class="hero">
    <div class="shell hero-grid">
      <div class="hero-copy">
        <div class="eyebrow">Habibi Crafts Co · California</div>
        <h1>Words we grew up with, on things you reach for.</h1>
        <p class="lede">Mugs, tees, totes, onesies, and prints. Made one at a time, after you order.</p>
        <div class="actions">
          <a class="button" href="shop.html">Shop all</a>
          <a class="button secondary" href="about.html">About us</a>
        </div>
      </div>
      <div class="hero-viewer">
        {spin_block(hero_slug, hero_frames, hero_name, hero[0]['category'] if hero else 'mugs', autospin=True)}
        <p class="hero-viewer-note">Turn it around with the slider.</p>
      </div>
    </div>
  </section>

  <section class="section" id="shop" aria-labelledby="shop-heading">
    <div class="shell">
      <div class="shop-head">
        <h2 id="shop-heading">In the shop</h2>
        {filter_bar()}
      </div>
      <div class="grid-plain">{"".join(grid)}</div>
    </div>
  </section>

  <section class="section"><div class="shell">
    <div class="story-panel reveal">
      <div class="kicker">Why this exists</div>
      <h2>It started with the words.</h2>
      <p>Things we say at the door, at the table, on the way out. Eventually we put them on objects.</p>
      <a class="text-link" href="about.html">Read the story</a>
    </div>
  </div></section>
</main>
<footer class="site-footer">
  <div class="footer-grid">
    <div>
      <div class="footer-brand"><img src="assets/logo-nav-white.png" alt="Habibi Crafts Co" width="213" height="93"></div>
      <p class="footer-copy">Our small business. All kinds of crafts.</p>
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
</footer>
</body>
</html>
'''
    open(f'{SITE}/index.html', 'w').write(html)
    print(f'index.html written ({len(products)} products, hero {hero_slug}, '
          f'{len(hero_frames)} frames, band after {BAND_AFTER})')


if __name__ == '__main__':
    main()
