"""Assemble the live storefront pages from the catalog and frame snapshot.

pf-angles/manifest.json and product-rank.json are optional. When they are
absent, frames come from pipeline/frame-snapshot.json and the home grid
keeps catalog order. A manifest, when present, supplies angle names and
drops the retired tote backs.
"""
import json
import re
from datetime import date

from pfangles import order as order_angles
from root import angles_dir, cents_decimal, format_cents, repo_root, site_dir, without_retired_back
from chrome import (
    BASE, ORDERS_NOTE, ORDERS_NOTE_SHORT, SHARE_IMAGE_ALT, SHIP_LINE, SHOP_NEXT, THIN_PAGES,
    esc, filter_bars, icons, json_ld, page_close, page_open, scripts, stylesheet,
)

# Hand-written pages use this for og-share.png. Home and shop keep their own alts.
share_image_alt = SHARE_IMAGE_ALT

ROOT = repo_root()
SITE = site_dir()
SNAPSHOT = json.loads((ROOT / 'pipeline' / 'frame-snapshot.json').read_text())

# kind, file, section id, heading, shop blurb, category lede, card type, shop-link word
TYPE_DESC = {
    'mugs': '11 oz ceramic mug',
    'tees': 'Unisex cotton tee',
    'totes': 'Cotton tote',
    'baby': 'Baby onesie',
    'prints': '12 x 16 matte print, frame not included',
    'stickers': 'Vinyl sticker',
    'hats': 'Unstructured dad hat, one size adjustable',
}
CATS = [
    ('mugs', 'mugs.html', 'mugs', 'Mugs',
     TYPE_DESC['mugs'] + '.', TYPE_DESC['mugs'] + '. {price}.', 'Mug', 'mugs'),
    ('tees', 'tees.html', 'tees', 'Tees',
     TYPE_DESC['tees'] + '.', TYPE_DESC['tees'] + '. {price}.', 'Tee', 'tees'),
    ('totes', 'totes.html', 'totes', 'Totes',
     TYPE_DESC['totes'] + '.', TYPE_DESC['totes'] + '. {price}.', 'Tote', 'totes'),
    ('baby', 'onesies.html', 'baby', 'Onesies',
     TYPE_DESC['baby'] + '.', TYPE_DESC['baby'] + '. {price}.', 'Onesie', 'onesies'),
    ('prints', 'prints.html', 'prints', 'Prints',
     TYPE_DESC['prints'] + '.', TYPE_DESC['prints'] + '. {price}.', 'Print', 'prints'),
    ('stickers', 'stickers.html', 'stickers', 'Stickers',
     TYPE_DESC['stickers'] + '.', TYPE_DESC['stickers'] + '. {price}.', 'Sticker', 'stickers'),
    ('hats', 'hats.html', 'hats', 'Hats',
     'Black dad hats.', 'Black. ' + TYPE_DESC['hats'] + '. {price}.', 'Dad hat', 'hats'),
]

# Photos are black caps. One color until another is actually photographed.
HAT_COLOR = {
    'habibi-crafts-hat': 'Black',
    'leaf-season-hat': 'Black',
    'make-something-hat': 'Black',
}

# TODO(George): meaning
# Transliterated names keep meaning: null until George writes the line.
# An empty meaning is not rendered.
NAMED_SLUGS = {
    'ya-aini', 'baladi', 'ya-dunia', 'jiran', 'maamoul', 'knafeh-club',
    'khalas-habibi', 'ya-habayeb', 'halawa', 'sit-el-kul', 'ya-teta', 'amoura',
    'beit-el-hobb', 'dar-el-hawa',
}

HERO_SLUGS = ['ya-aini', 'khalas-habibi', 'halawa']
# Hero, gift tiles, and this row use different products.
HOME_ROW = ['ya-dunia', 'khalas-habibi', 'gather-grow', 'ya-teta']
NL_KINDS = {'stickers', 'hats'}


def load_manifest():
    path = angles_dir() / 'manifest.json'
    if path.exists():
        return json.load(open(path))
    return None


def frame_version(file):
    for rows in SNAPSHOT['frames'].values():
        for row in rows:
            if row['file'] == file:
                return row['v']
    for row in SNAPSHOT['posters'].values():
        if row['file'] == file:
            return row['v']
    return '10'


def frames_for(slug, manifest):
    if manifest and manifest.get(slug, {}).get('angles'):
        ordered = order_angles(without_retired_back(slug, manifest[slug]['angles']))
        out = []
        for angle in ordered:
            file = angle['file']
            if '/' not in file:
                file = f'{slug}/{file}'
            out.append({
                'src': f'assets/angles/{file}?v={frame_version(file)}',
                'label': angle['angle'],
            })
        return out
    return [
        {'src': f"assets/angles/{row['file']}?v={row['v']}", 'label': row['label']}
        for row in SNAPSHOT['frames'].get(slug, [])
    ]


def poster_for(slug, frames):
    if frames:
        return frames[0]['src']
    row = SNAPSHOT['posters'].get(slug)
    if row:
        return f"assets/angles/{row['file']}?v={row['v']}"
    return None


def mockup(slug):
    return f"assets/mockups/{slug}.png?v={SNAPSHOT['mockups'][slug]}"


def prices(catalog):
    out = {}
    for kind, *_rest in CATS:
        cents = {p['price'] for p in catalog if p['category'] == kind}
        if len(cents) != 1:
            raise SystemExit(f'{kind} prices diverged: {sorted(cents)}')
        out[kind] = format_cents(next(iter(cents)))
    return out


def item_list(products):
    return {'@type': 'ItemList', 'itemListElement': [
        {'@type': 'ListItem', 'position': i + 1,
         'url': f'{BASE}/product-{p["slug"]}.html', 'name': p['name']}
        for i, p in enumerate(products)
    ]}


def art_alt(p):
    if p['category'] == 'hats':
        return f"{p['name']}, black dad hat"
    return p['name']


def product_card(p, frames):
    preview = ''
    if len(frames) > 1:
        srcs = [frame['src'] for frame in frames[1:]]
        preview = ' data-preview="' + esc(json.dumps(srcs, separators=(',', ':'))) + '"'
    kind = p['category']
    type_name = next(row[6] for row in CATS if row[0] == kind)
    return f'''<a class="product-card reveal" href="product-{p['slug']}.html" data-category="{kind}"{preview}>
  <div class="product-media"><img class="mockup" src="{mockup(p['slug'])}" alt="{esc(art_alt(p))}" width="800" height="800" loading="lazy" decoding="async"></div>
  <div class="product-copy">
    <div class="product-type">{type_name}</div>
    <div class="product-row"><h3>{esc(p['name'])}</h3><span class="price">{format_cents(p['price'])}</span></div>
  </div>
</a>'''


def join_cards(kind, cards):
    return ('\n' if kind in NL_KINDS else '').join(cards)


def collection_head(title, desc, canonical, ld, og_image, og_w, og_h, og_alt, include_spin=True, ensure_ascii=True):
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
<meta property="og:image:width" content="{og_w}">
<meta property="og:image:height" content="{og_h}">
<meta property="og:locale" content="en_US">
<meta property="og:image:alt" content="{esc(og_alt)}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="{esc(title)}">
<meta name="twitter:description" content="{esc(desc)}">
<meta name="twitter:image" content="{og_image}">
<meta name="twitter:image:alt" content="{esc(og_alt)}">
{icons()}
{stylesheet()}
{json_ld(ld, ensure_ascii)}
{scripts(include_spin)}
</head>'''


def shop_next_line():
    return f'''<section class="section tight"><div class="shell">
    <p class="lede">{SHOP_NEXT}</p>
  </div></section>'''


def write_thin_pages(out_dir):
    """Static-host redirect. These files stay out of the sitemap."""
    for filename, label in THIN_PAGES:
        html = f'''<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>{esc(label)} | Habibi Crafts Co</title>
<meta name="robots" content="noindex,follow">
<meta http-equiv="refresh" content="0; url=/shop.html">
<link rel="canonical" href="{BASE}/shop.html">
</head>
<body>
<p><a href="/shop.html">Go to the shop</a></p>
</body>
</html>
'''
        (out_dir / filename).write_text(html)
    print(f'{len(THIN_PAGES)} thin pages')


def write_shop(out_dir, manifest=None):
    if manifest is None:
        manifest = load_manifest()
    catalog = json.load(open(SITE / 'product-catalog.json'))
    priced = prices(catalog)
    desc = (
        f"Mugs {priced['mugs']}, tees {priced['tees']}, "
        f"totes {priced['totes']}, onesies {priced['baby']}, prints {priced['prints']}, "
        f"stickers {priced['stickers']}, dad hats {priced['hats']}. Made after you order."
    )
    ld = {
        '@context': 'https://schema.org', '@type': 'CollectionPage',
        'name': 'Shop Habibi Crafts Co', 'url': f'{BASE}/shop.html',
        'mainEntity': item_list(catalog),
    }
    head = collection_head(
        'Shop | Habibi Crafts Co', desc, f'{BASE}/shop.html', ld,
        f'{BASE}/assets/og-share.png', '1200', '630',
        'Habibi Crafts Co. Mugs, tees, totes, onesies, prints, stickers, and hats.',
    )
    sections = []
    for kind, filename, section_id, label, blurb, _lede, _type_name, word in CATS:
        items = [p for p in catalog if p['category'] == kind]
        text = blurb.format(price=priced[kind])
        cards = join_cards(kind, [product_card(p, frames_for(p['slug'], manifest)) for p in items])
        grid = 'product-grid' if len(items) > 2 else 'product-grid two'
        block = f'''<section class="section tight shop-section" id="{section_id}" aria-labelledby="{section_id}-heading">
  <div class="shell">
    <div class="section-head">
      <div><h2 id="{section_id}-heading">{label}</h2><p>{esc(text)}</p></div>
      <a class="text-link" href="{filename}">Shop {word}</a>
    </div>
    <div class="{grid}">{cards}</div>
  </div>
</section>'''
        sections.append(block)
    body = []
    for block in sections:
        if 'id="stickers"' in block and body:
            body.append('')
        body.append(block)
    body.append(shop_next_line())
    main = f'''<main id="main">
  <section class="catalog-head"><div class="shell">
    <h1>The shop</h1>
    <p class="lede">Everything in the shop. Free US shipping on orders $39 and up. $6.99 flat below that.</p>
    {filter_bars('shop.html')}
  </div></section>
''' + '\n'.join(body)
    html = page_open(head, shop=True) + '\n' + page_close(main)
    (out_dir / 'shop.html').write_text(html)

    for kind, filename, _section_id, label, _blurb, lede, _type_name, _word in CATS:
        items = [p for p in catalog if p['category'] == kind]
        visible = lede.format(price=priced[kind])
        # The hats intro keeps the fit line. Search and social text should not repeat it.
        meta = f'Dad hats, one size. {priced[kind]}.' if kind == 'hats' else visible
        cat_ld = {
            '@context': 'https://schema.org', '@type': 'CollectionPage',
            'name': f'{label} | Habibi Crafts Co', 'url': f'{BASE}/{filename}',
            'mainEntity': item_list(items),
        }
        og = f'{BASE}/assets/mockups/{items[0]["slug"]}.png'
        bare = kind in ('stickers', 'hats')
        og_alt = items[0]['name'] if kind in ('stickers', 'hats', 'baby') else 'Habibi Crafts Co'
        head = collection_head(
            f'{label} | Habibi Crafts Co', meta, f'{BASE}/{filename}', cat_ld,
            og, '800', '800', og_alt, include_spin=not bare, ensure_ascii=not bare,
        )
        cards = join_cards(kind, [product_card(p, frames_for(p['slug'], manifest)) for p in items])
        grid = 'product-grid' if len(items) > 2 else 'product-grid two'
        main = f'''<main id="main">
  <section class="catalog-head"><div class="shell">
    <h1>{label}</h1>
    <p class="lede">{esc(visible)}</p>
    {filter_bars(filename)}
  </div></section>
  <section class="section tight"><div class="shell">
    <div class="{grid}">{cards}</div>
  </div></section>'''
        html = page_open(head, shop=True) + '\n' + page_close(main)
        (out_dir / filename).write_text(html)
    write_thin_pages(out_dir)
    print(f'shop.html + {len(CATS)} category pages')


def pcard(p, src):
    kind = p['category']
    type_name = next(row[6] for row in CATS if row[0] == kind)
    return f'''<a class="pcard reveal" href="product-{p['slug']}.html" data-category="{kind}">
  <div class="pcard-media"><img class="mockup" src="{src}" alt="{esc(art_alt(p))}" width="800" height="800" loading="lazy" decoding="async"></div>
  <div class="pcard-type">{type_name}</div>
  <div class="pcard-row"><div class="pcard-title">{esc(p['name'])}</div><div class="pcard-price">{format_cents(p['price'])}</div></div>
</a>'''


def hero_spin(product, frames):
    payload = esc(json.dumps(frames, separators=(',', ':')))
    first = frames[0]
    name = product['name']
    return f'''        <div class="spin hero-spin" data-spin data-kind="{product['category']}" data-frames="{payload}" data-alt="{esc(name)}">
          <div class="spin-stage" data-spin-stage>
            <img data-spin-image class="mockup" src="{first['src']}" alt="{esc(name)}" width="1200" height="1200" decoding="async" fetchpriority="high">
          </div>
          <div class="spin-controls">
          <span class="spin-end" aria-hidden="true">360°</span>
          <input class="spin-slider" type="range" data-spin-slider
                 min="0" max="{len(frames) - 1}" step="1" value="0"
                 aria-label="Rotate {esc(name)}">
        </div>
        </div>'''


def gift_card(href, kind, src, title, line):
    return f'''        <a class="gift-card reveal" href="{href}" data-kind="{kind}">
          <div class="gift-media"><img class="mockup" src="{src}" alt="" width="800" height="800" loading="lazy" decoding="async"></div>
          <div class="gift-copy"><h3>{title}</h3><p>{line}</p></div>
        </a>'''


def write_home(out_dir, manifest=None):
    if manifest is None:
        manifest = load_manifest()
    catalog = json.load(open(SITE / 'product-catalog.json'))
    priced = prices(catalog)
    by_slug = {p['slug']: p for p in catalog}
    order = [p['slug'] for p in catalog]
    rank_path = ROOT / 'product-rank.json'
    if rank_path.exists():
        ranked = json.load(open(rank_path)).get('ranked') or []
        order = [s for s in ranked if s in by_slug] + [s for s in order if s not in ranked]
    products = [by_slug[s] for s in order]
    hero = by_slug[HERO_SLUGS[0]]
    hero_frames = frames_for(hero['slug'], manifest)

    def src_for(p):
        framed = frames_for(p['slug'], manifest)
        poster = poster_for(p['slug'], framed)
        return poster or mockup(p['slug'])

    row = ''.join(pcard(by_slug[slug], src_for(by_slug[slug])) for slug in HOME_ROW)
    ld = {'@context': 'https://schema.org', '@graph': [
        {'@type': ['Store', 'Organization'], '@id': f'{BASE}/#store',
         'name': 'Habibi Crafts Co', 'url': f'{BASE}/',
         'logo': f'{BASE}/assets/logo.png',
         'image': f'{BASE}/assets/og-share.png',
         'description': 'A husband-and-wife craft and gift shop in California. Mugs, tees, totes, onesies, prints, stickers, and dad hats, made after you order.',
         'address': {'@type': 'PostalAddress', 'addressRegion': 'CA', 'addressCountry': 'US'},
         'areaServed': {'@type': 'Country', 'name': 'US'}},
        {'@type': 'WebSite', '@id': f'{BASE}/#website', 'url': f'{BASE}/',
         'name': 'Habibi Crafts Co', 'publisher': {'@id': f'{BASE}/#store'},
         'inLanguage': 'en-US'},
        {'@type': 'ItemList', 'name': 'Shop', 'itemListElement': item_list(products)['itemListElement']},
    ]}
    title = 'Habibi Crafts Co'
    desc = 'A husband-and-wife craft and gift shop in California. Mugs, tees, totes, onesies, prints, stickers, and dad hats, made after you order.'
    og_desc = desc
    og_alt = 'Habibi Crafts Co. Mugs, tees, totes, onesies, prints, stickers, and hats.'
    preload = hero_frames[0]['src']
    head = f'''<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="theme-color" content="#7d2e21">
<title>{esc(title)}</title>
<meta name="description" content="{esc(desc)}">
<meta name="robots" content="index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1">
<link rel="canonical" href="{BASE}/">
<meta property="og:type" content="website">
<meta property="og:site_name" content="Habibi Crafts Co">
<meta property="og:title" content="Habibi Crafts Co">
<meta property="og:description" content="{esc(og_desc)}">
<meta property="og:url" content="{BASE}/">
<meta property="og:image" content="{BASE}/assets/og-share.png">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:locale" content="en_US">
<meta property="og:image:alt" content="{esc(og_alt)}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="Habibi Crafts Co">
<meta name="twitter:description" content="{esc(og_desc)}">
<meta name="twitter:image" content="{BASE}/assets/og-share.png">
<meta name="twitter:image:alt" content="{esc(og_alt)}">
{icons()}
<link rel="preload" as="image" href="{preload}">
{stylesheet()}
{json_ld(ld)}
{scripts(True)}
</head>'''
    gifts = '\n'.join([
        gift_card('mugs.html', 'mugs', src_for(by_slug['baladi']), 'Mugs', TYPE_DESC['mugs']),
        gift_card('tees.html', 'tees', src_for(by_slug['ya-habayeb']), 'Tees', TYPE_DESC['tees']),
        gift_card('totes.html', 'totes', src_for(by_slug['halawa']), 'Totes', TYPE_DESC['totes']),
        gift_card('onesies.html', 'baby', src_for(by_slug['amoura']), 'Onesies', TYPE_DESC['baby']),
        gift_card('prints.html', 'prints', src_for(by_slug['beit-el-hobb']), 'Prints', TYPE_DESC['prints']),
        gift_card('stickers.html', 'stickers', mockup('leaf-season-sticker'), 'Stickers', TYPE_DESC['stickers']),
        gift_card('hats.html', 'hats', mockup('leaf-season-hat'), 'Hats', 'Unstructured dad hat, black, one size'),
    ])
    main = f'''<main id="main">
  <section class="hero">
    <div class="shell hero-grid">
      <div class="hero-copy">
        <div class="eyebrow">Habibi Crafts Co · California</div>
        <h1>Our small business</h1>
        <p class="lede">Crafts and gifts we'd want to give ourselves.</p>
        <div class="actions">
          <a class="button" href="shop.html">Shop all</a>
          <a class="button secondary" href="about.html">About</a>
        </div>
      </div>
      <div class="hero-viewer">
{hero_spin(hero, hero_frames)}
        <p class="hero-viewer-note">Turn it around with the slider.</p>
      </div>
    </div>
  </section>

  <section class="section tight gift-paths" aria-labelledby="gift-heading">
    <div class="shell">
      <div class="section-head">
        <h2 id="gift-heading">What we make</h2>
        <a class="text-link" href="shop.html">See everything</a>
      </div>
      <div class="gift-grid">
{gifts}
      </div>
    </div>
  </section>


  <section class="section" id="shop" aria-labelledby="shop-heading">
    <div class="shell">
      <div class="section-head">
        <h2 id="shop-heading">In the shop</h2>
        <a class="text-link" href="shop.html">See everything</a>
      </div>
      <div class="grid-plain">{row}</div>
    </div>
  </section>'''
    html = page_open(head, home=True) + '\n' + page_close(main)
    (out_dir / 'index.html').write_text(html)
    print(f'index.html ({len(products)} products)')


def details_for(p):
    kind = p['category']
    ship = ('Timing', SHIP_LINE)
    if kind == 'mugs':
        rows = [('Size', '11 oz'), ('Finish', 'White glossy'), ('Material', 'Ceramic'),
                ('Care', 'Dishwasher and microwave safe'), ship]
    elif kind == 'tees':
        rows = [('Sizes', 'S, M, L, XL'), ('Fit', 'Unisex'), ('Material', 'Cotton'),
                ('Print', 'Front'), ('Care', 'Wash cold, inside out, tumble dry low'), ship]
    elif kind == 'totes':
        rows = [('Size', 'One size'), ('Material', 'Cotton'), ('Print', 'Front'),
                ('Care', 'Wash cold, tumble dry low'), ship]
    elif kind == 'baby':
        rows = [('Sizes', '3-6m, 6-12m, 12-18m'), ('Color', 'White'), ('Material', 'Cotton'),
                ('Print', 'Front'), ('Care', 'Machine wash cold, tumble dry low'), ship]
    elif kind == 'prints':
        rows = [('Size', '12 x 16 in'), ('Paper', 'Matte'), ('Frame', 'Not included'),
                ('Care', 'Keep dry'), ship]
    elif kind == 'stickers':
        rows = [('Size', 'About 3 in'), ('Material', 'Vinyl'), ('Finish', 'Kiss-cut'),
                ('Care', 'Spot clean'), ship]
    else:
        rows = [('Style', 'Dad hat'), ('Fit', 'One size, adjustable'),
                ('Color', HAT_COLOR[p['slug']]), ('Care', 'Spot clean'), ship]
    return ''.join(f'<div><dt>{esc(k)}</dt><dd>{esc(v)}</dd></div>' for k, v in rows)


def size_block(p):
    # Chips only belong next to Add to bag. Details still lists the sizes.
    if p.get('purchasable') is not True:
        return ''
    kind = p['category']
    if kind == 'tees':
        sizes = [('S', 'S'), ('M', 'M'), ('L', 'L'), ('XL', 'XL')]
    elif kind == 'baby':
        sizes = [('3-6m', '3-6m'), ('6-12m', '6-12m'), ('12-18m', '12-18m')]
    else:
        return ''
    buttons = []
    for i, (value, label) in enumerate(sizes):
        pressed = 'true' if i == 0 else 'false'
        buttons.append(
            f'          <button type="button" class="size-option" data-size="{value}" aria-pressed="{pressed}">{label}</button>'
        )
    return f'''<div class="size-picker" data-size-picker>
        <p class="size-picker-label" id="size-{p['slug']}">Size</p>
        <div class="size-options" role="group" aria-labelledby="size-{p['slug']}">
{chr(10).join(buttons)}
        </div>
      </div>'''


def viewer_for(p, frames):
    name = art_alt(p)
    kind = p['category']
    poster = poster_for(p['slug'], frames)
    if not frames and poster:
        return f'''    <div class="spin" data-spin data-kind="{kind}" data-frames="" data-alt="{esc(name)}">
      
      <div class="spin-stage" data-spin-stage>
        <img data-spin-image class="mockup" src="{poster}" alt="{esc(name)}" width="1200" height="1200" decoding="async">
      </div>
      
      <div class="spin-controls" data-spin-controls hidden><input class="spin-slider" type="range" data-spin-slider hidden></div>
    </div>'''
    if not frames:
        return f'''    <div class="product-gallery" data-kind="{kind}">
      <img class="mockup" src="{mockup(p['slug'])}" alt="{esc(name)}" width="1200" height="1200" decoding="async">
    </div>'''
    payload = esc(json.dumps(frames, separators=(',', ':')))
    first = frames[0]['src']
    if len(frames) == 1:
        return f'''    <div class="spin" data-spin data-kind="{kind}" data-frames="{payload}" data-alt="{esc(name)}">
      <div class="spin-stage" data-spin-stage>
        <img data-spin-image class="mockup" src="{first}" alt="{esc(name)}" width="1200" height="1200" decoding="async">
      </div>
    </div>'''
    return f'''    <div class="spin" data-spin data-kind="{kind}" data-frames="{payload}" data-alt="{esc(name)}">
      <div class="spin-counter" data-spin-counter>{esc(frames[0]['label'])}</div>
      <div class="spin-stage" data-spin-stage>
        <img data-spin-image class="mockup" src="{first}" alt="{esc(name)}" width="1200" height="1200" decoding="async">
      </div>
      <div class="spin-hint" data-spin-hint>Drag to rotate</div>
      <div class="spin-controls">
        <span class="spin-end" aria-hidden="true">360°</span>
        <input class="spin-slider" type="range" data-spin-slider
               min="0" max="{len(frames) - 1}" step="1" value="0"
               aria-label="Rotate {esc(name)}">
      </div>
    </div>'''


def related(catalog, p):
    kind = p['category']
    others = [item for item in catalog if item['category'] == kind and item['slug'] != p['slug']][:3]
    if not others:
        return ''
    label, word, filename = next((row[3], row[7], row[1]) for row in CATS if row[0] == kind)
    cards = join_cards(kind, [product_card(item, []) for item in others])
    grid = 'product-grid two' if kind in NL_KINDS else 'product-grid'
    return f'''  <section class="section tight"><div class="shell">
    <div class="section-head"><h2>More {word}</h2></div>
    <div class="{grid}">{cards}</div>
  </div></section>'''


def product_ld(p, desc, filename, label):
    slug = p['slug']
    url = f'{BASE}/product-{slug}.html'
    product = {
        '@type': 'Product', '@id': f'{url}#product', 'name': p['name'],
        'description': desc, 'image': f'{BASE}/assets/mockups/{slug}.png',
        'brand': {'@type': 'Brand', 'name': 'Habibi Crafts Co'},
        'offers': {'@type': 'Offer', 'url': url, 'priceCurrency': 'USD',
                   'price': cents_decimal(p['price']),
                   'availability': 'https://schema.org/OutOfStock',
                   'itemCondition': 'https://schema.org/NewCondition'},
        'url': url, 'sku': slug,
        'seller': {'@type': 'Organization', '@id': f'{BASE}/#store',
                   'name': 'Habibi Crafts Co', 'url': f'{BASE}/'},
    }
    if p['category'] == 'hats':
        product['color'] = HAT_COLOR[slug]
    # TODO(George): meaning
    meaning = p.get('meaning')
    if meaning:
        product['alternateName'] = meaning
    return {
        '@context': 'https://schema.org',
        '@graph': [
            product,
            {'@type': 'BreadcrumbList', 'itemListElement': [
                {'@type': 'ListItem', 'position': 1, 'name': 'Home', 'item': f'{BASE}/'},
                {'@type': 'ListItem', 'position': 2, 'name': 'Shop', 'item': f'{BASE}/shop.html'},
                {'@type': 'ListItem', 'position': 3, 'name': label, 'item': f'{BASE}/{filename}'},
                {'@type': 'ListItem', 'position': 4, 'name': p['name'], 'item': url},
            ]},
        ],
    }


def write_products(out_dir, manifest=None):
    if manifest is None:
        manifest = load_manifest()
    catalog = json.load(open(SITE / 'product-catalog.json'))
    built = 0
    for p in catalog:
        kind = p['category']
        meta = next(row for row in CATS if row[0] == kind)
        filename, label = meta[1], meta[3]
        frames = frames_for(p['slug'], manifest)
        gallery = not frames and p['slug'] not in SNAPSHOT['posters']
        subtitle = TYPE_DESC[kind]
        desc = f"{p['name']}. {subtitle}."
        url = f"{BASE}/product-{p['slug']}.html"
        if p.get('purchasable') is True:
            actions = (
                f'<div class="actions"><button class="button" type="button" data-add-bag '
                f'data-product-slug="{p["slug"]}">Add to bag</button></div>'
            )
            note = ORDERS_NOTE
        else:
            actions = ''
            note = ORDERS_NOTE_SHORT
        charge = f'<p class="checkout-note">{note}</p>'
        buy_parts = [part for part in (size_block(p), actions, charge) if part]
        buy = '\n      '.join(buy_parts)
        eyebrow = meta[6] if kind != 'hats' else 'Dad hat'
        if kind == 'baby':
            eyebrow = 'Onesie'
        head = f'''<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="theme-color" content="#7d2e21">
<title>{esc(p['name'])} | Habibi Crafts Co</title>
<meta name="description" content="{esc(desc)}">
<meta name="robots" content="index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1">
<link rel="canonical" href="{url}">
<meta property="og:type" content="product">
<meta property="og:site_name" content="Habibi Crafts Co">
<meta property="og:title" content="{esc(p['name'])} | Habibi Crafts Co">
<meta property="og:description" content="{esc(desc)}">
<meta property="og:url" content="{url}">
<meta property="og:image" content="{BASE}/assets/mockups/{p['slug']}.png">
<meta property="og:image:width" content="800">
<meta property="og:image:height" content="800">
<meta property="og:locale" content="en_US">
<meta property="og:image:alt" content="{esc(art_alt(p))}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="{esc(p['name'])} | Habibi Crafts Co">
<meta name="twitter:description" content="{esc(desc)}">
<meta name="twitter:image" content="{BASE}/assets/mockups/{p['slug']}.png">
<meta name="twitter:image:alt" content="{esc(art_alt(p))}">
{icons()}
{stylesheet()}
{json_ld(product_ld(p, desc, filename, label), ensure_ascii=False)}
{scripts(include_spin=not gallery)}
</head>'''
        gap = '\n' if gallery else '\n\n'
        main = f'''<main id="main">
  <div class="shell product-page">
{viewer_for(p, frames)}
    <div class="product-meta">
      <nav class="breadcrumbs" aria-label="Breadcrumb"><a href="index.html">Home</a> / <a href="shop.html">Shop</a> / <a href="{filename}">{label}</a></nav>
      <div class="eyebrow">{eyebrow}</div>
      <h1>{esc(p['name'])}</h1>
      <p class="product-subtitle">{esc(subtitle)}</p>
      <div class="product-price">{format_cents(p['price'])}</div>
      {buy}
      <div class="detail-list">
        <h2>Details</h2>
        <dl>{details_for(p)}</dl>
      </div>
      <p class="product-trust-links"><a href="shipping.html">Shipping &amp; timing</a> · <a href="faq.html">Sizes &amp; care</a></p>
    </div>
  </div>{gap}{related(catalog, p)}'''
        html = page_open(head, shop=True) + '\n' + page_close(main, blank_before_footer=not gallery)
        (out_dir / f'product-{p["slug"]}.html').write_text(html)
        built += 1
    print(f'Built {built} product pages')


SITEMAP_CORE = [
    ('index.html', 'weekly', '1.0'),
    ('shop.html', 'weekly', '0.9'),
    ('mugs.html', 'weekly', '0.8'),
    ('tees.html', 'weekly', '0.8'),
    ('totes.html', 'weekly', '0.8'),
    ('onesies.html', 'weekly', '0.8'),
    ('prints.html', 'weekly', '0.8'),
    ('stickers.html', 'weekly', '0.8'),
    ('hats.html', 'weekly', '0.8'),
    ('about.html', 'monthly', '0.6'),
    ('faq.html', 'monthly', '0.5'),
    ('shipping.html', 'monthly', '0.4'),
    ('privacy.html', 'yearly', '0.3'),
    ('contact.html', 'yearly', '0.3'),
]


def xml_escape(s):
    return s.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')


def existing_lastmod():
    path = SITE / 'sitemap.xml'
    if not path.exists():
        return {}
    return dict(re.findall(r'<loc>([^<]+)</loc>\s*<lastmod>([^<]+)</lastmod>', path.read_text()))


def write_sitemap(out_dir):
    catalog = json.load(open(SITE / 'product-catalog.json'))
    known = existing_lastmod()
    today = date.today().isoformat()
    urls = []
    for name, freq, prio in SITEMAP_CORE:
        if not (SITE / name).exists():
            continue
        loc = BASE + '/' if name == 'index.html' else f'{BASE}/{name}'
        last = known.get(loc, today)
        urls.append(f'''  <url>
    <loc>{loc}</loc>
    <lastmod>{last}</lastmod>
    <changefreq>{freq}</changefreq>
    <priority>{prio}</priority>
  </url>''')
    for p in catalog:
        name = f"product-{p['slug']}.html"
        if not (SITE / name).exists():
            continue
        loc = f'{BASE}/{name}'
        last = known.get(loc, today)
        urls.append(f'''  <url>
    <loc>{loc}</loc>
    <lastmod>{last}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.7</priority>
    <image:image>
      <image:loc>{BASE}/assets/mockups/{p['slug']}.png</image:loc>
      <image:title>{xml_escape(p['name'])} | Habibi Crafts Co</image:title>
    </image:image>
  </url>''')
    xml = ('<?xml version="1.0" encoding="UTF-8"?>\n'
           '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"\n'
           '        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">\n'
           + '\n'.join(urls) + '\n</urlset>\n')
    (out_dir / 'sitemap.xml').write_text(xml)
    (out_dir / 'robots.txt').write_text(
        f'User-agent: *\nAllow: /\n\nSitemap: {BASE}/sitemap.xml\n'
    )
    print(f'sitemap.xml: {xml.count("<url>")} urls')
