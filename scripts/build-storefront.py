#!/usr/bin/env python3
"""Generate static Habibi Crafts Co pages from the public catalog. No API tokens."""
from __future__ import annotations

import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SITE = ROOT / "site"

import subprocess

catalog = json.loads(
    subprocess.check_output(
        [
            "node",
            "-e",
            "const fs=require('fs'); const s=fs.readFileSync('site/catalog.js','utf8').replace('window.HABIBI_CATALOG','globalThis.HABIBI_CATALOG'); eval(s); process.stdout.write(JSON.stringify(globalThis.HABIBI_CATALOG))",
        ],
        cwd=ROOT,
    )
)
PRODUCTS = catalog["products"]
BY_SLUG = {p["slug"]: p for p in PRODUCTS}

GROUPS = [
    ("mugs", "Mugs", "$18", "11 oz white glossy. Six designs."),
    ("tees", "Tees", "$32", "Unisex, S through XL."),
    ("totes", "Totes", "$34", "Cotton. One size."),
    ("baby", "Onesies", "$28", "White. 3–6m, 6–12m, 12–18m."),
    ("prints", "Prints", "$24", "12 × 16 matte. Frame not included."),
]

FILTERS = [("all", "All"), ("mugs", "Mugs"), ("tees", "Tees"), ("totes", "Totes"), ("baby", "Baby"), ("prints", "Prints")]


def esc(s: str) -> str:
    return (
        s.replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
        .replace('"', "&quot;")
    )


def json_ld(obj) -> str:
    return json.dumps(obj, ensure_ascii=False, separators=(",", ":"))


def page_head(title, description, canonical, extra_meta="", extra_ld=None, og_image="https://habibicraftsco.com/assets/logo.png"):
    ld = extra_ld or []
    ld_tags = "\n".join(f'<script type="application/ld+json">{json_ld(item)}</script>' for item in ld)
    return f"""<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="theme-color" content="#faf6ef">
<title>{esc(title)}</title>
<meta name="description" content="{esc(description)}">
<meta name="robots" content="index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1">
<link rel="canonical" href="{esc(canonical)}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="Habibi Crafts Co">
<meta property="og:title" content="{esc(title)}">
<meta property="og:description" content="{esc(description)}">
<meta property="og:url" content="{esc(canonical)}">
<meta property="og:image" content="{esc(og_image)}">
<meta property="og:image:alt" content="Habibi Crafts Co">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="{esc(title)}">
<meta name="twitter:description" content="{esc(description)}">
<meta name="twitter:image" content="{esc(og_image)}">
<link rel="icon" type="image/png" href="assets/logo.png">
<link rel="stylesheet" href="styles.css?v=nav-white">
{extra_meta}{ld_tags}
<script defer src="analytics.js"></script>
<script defer src="app.js"></script>
</head>"""


def nav(current: str, prefix: str = "") -> str:
    def link(href, label, key):
        cur = ' aria-current="page"' if current == key else ""
        return f'<a href="{prefix}{href}"{cur}>{label}</a>'

    return f"""<header class="site-header">
  <nav class="nav" aria-label="Primary navigation">
    <a class="brand" href="{prefix}index.html"><img src="{prefix}assets/logo-nav-white.png" alt="Habibi Crafts Co" width="213" height="93"></a>
    <button class="menu-toggle" type="button" aria-expanded="false" aria-controls="primary-menu" aria-label="Open menu"><span></span></button>
    <div class="nav-links" id="primary-menu">
      {link("index.html", "Home", "home")}
      {link("shop.html", "Shop", "shop")}
      {link("about.html", "Our story", "about")}
      {link("faq.html", "FAQ", "faq")}
      <a class="nav-cta" href="{prefix}shop.html">See the shop</a>
    </div>
  </nav>
</header>"""


def footer() -> str:
    return """<footer class="site-footer">
  <div class="footer-grid">
    <div>
      <div class="footer-brand">Habibi Crafts Co</div>
      <p class="footer-copy">A husband-and-wife shop. Personalized mugs, plus other gifts.</p>
    </div>
    <div>
      <div class="footer-title">Shop</div>
      <div class="footer-links">
        <a href="shop.html">All 14 pieces</a>
        <a href="about.html">Our story</a>
        <a href="faq.html">FAQ</a>
      </div>
    </div>
    <div>
      <div class="footer-title">Information</div>
      <div class="footer-links">
        <a href="privacy.html">Privacy</a>
        <a href="sitemap.xml">Sitemap</a>
        <a href="about.html#made-to-order">How it’s printed</a>
      </div>
    </div>
  </div>
  <div class="footer-bottom"><span>© 2026 Habibi Crafts Co</span><span>California</span></div>
</footer>"""


def type_card(p, extra_class=""):
    cls = f"type-card {extra_class}".strip()
    return f"""<div class="{cls}" data-kind="{esc(p['category'])}" aria-hidden="true">
  <span class="type-card-phrase">{esc(p['name'])}</span>
  <span class="type-card-kind">{esc(p['kind'])} · {esc(p['priceLabel'])}</span>
</div>"""


def product_card(p):
    return f"""<a class="product-card reveal" href="product-{esc(p['slug'])}.html" data-category="{esc(p['category'])}">
  <div class="product-media">{type_card(p)}</div>
  <div class="product-copy">
    <div class="product-type">{esc(p['kind'])}</div>
    <div class="product-row"><h3>{esc(p['name'])}</h3><span class="price">{esc(p['priceLabel'])}</span></div>
    <p class="product-note">{esc(p['note'])}</p>
  </div>
</a>"""


def wrap(head, current, main, prefix=""):
    return f"""{head}
<body>
<a class="skip-link" href="#main">Skip to content</a>
{nav(current, prefix)}
<main id="main">
{main}
</main>
{footer()}
</body>
</html>
"""


def write(name: str, html: str):
    path = SITE / name
    path.write_text(html)
    print("wrote", path.relative_to(ROOT))


# --- index ---
home_groups = []
for key, title, price, blurb in GROUPS:
    items = [p for p in PRODUCTS if p["category"] == key]
    cards = "\n".join(product_card(p) for p in items)
    grid_cls = "product-grid two" if len(items) < 3 else "product-grid"
    home_groups.append(
        f"""<section class="section tight" id="home-{key}" aria-labelledby="home-{key}-heading">
  <div class="shell">
    <div class="section-head">
      <div>
        <div class="kicker">{esc(price)}</div>
        <h2 id="home-{key}-heading">{esc(title)}</h2>
        <p>{esc(blurb)}</p>
      </div>
      <a class="text-link" href="shop.html#{esc(key)}">Shop {esc(title.lower())}</a>
    </div>
    <div class="{grid_cls}">{cards}</div>
  </div>
</section>"""
    )

home_ld = {
    "@context": "https://schema.org",
    "@graph": [
        {
            "@type": "Store",
            "@id": "https://habibicraftsco.com/#store",
            "name": "Habibi Crafts Co",
            "url": "https://habibicraftsco.com/",
            "logo": "https://habibicraftsco.com/assets/logo.png",
            "image": "https://habibicraftsco.com/assets/logo.png",
            "description": "A husband-and-wife shop for personalized mugs and gifts — weddings, bachelor and bachelorette parties, and everyday.",
        },
        {
            "@type": "WebSite",
            "@id": "https://habibicraftsco.com/#website",
            "url": "https://habibicraftsco.com/",
            "name": "Habibi Crafts Co",
            "publisher": {"@id": "https://habibicraftsco.com/#store"},
            "inLanguage": "en-US",
        },
    ],
}

write(
    "index.html",
    wrap(
        page_head(
            "Habibi Crafts Co | Personalized mugs and gifts",
            "A husband-and-wife shop for personalized mugs and gifts — weddings, bachelor and bachelorette parties, and everyday. California.",
            "https://habibicraftsco.com/",
            extra_ld=[home_ld],
        ),
        "home",
        f"""  <section class="hero">
    <div class="shell">
      <div class="eyebrow">Habibi Crafts Co · California</div>
      <h1>Personalized mugs,<br><em>and other gifts.</em></h1>
      <p class="lede">A husband-and-wife shop. Weddings, bachelor and bachelorette parties, and the rest of the week.</p>
      <div class="actions"><a class="button" href="shop.html">See the shop</a><a class="button secondary" href="about.html">Our story</a></div>
    </div>
    <div class="hero-stage" aria-label="Habibi Crafts Co mark"><img src="assets/logo.png" alt="Habibi Crafts Co logo" width="447" height="447"><span class="hero-stage-note">14 pieces · mugs, tees, totes, onesies, prints</span></div>
  </section>
{chr(10).join(home_groups)}
  <section class="section tight"><div class="shell story-panel reveal">
    <div class="kicker" style="color:#eab038">Why this exists</div>
    <h2>Two of us. A small shop.</h2>
    <p>Personalized mugs, plus tees, totes, onesies, and prints. Printed after you order. Other crafts as we add them.</p>
    <a class="text-link" href="about.html">Read the story</a>
  </div></section>""",
    ),
)

# --- shop ---
filter_btns = "".join(
    f'<button class="filter-button" data-filter="{k}" aria-pressed="{"true" if k=="all" else "false"}">{lab}</button>'
    for k, lab in FILTERS
)
shop_cards = "\n".join(product_card(p) for p in PRODUCTS)
shop_ld = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    "name": "Shop Habibi Crafts Co",
    "url": "https://habibicraftsco.com/shop.html",
    "mainEntity": {
        "@type": "ItemList",
        "numberOfItems": len(PRODUCTS),
        "itemListElement": [
            {
                "@type": "ListItem",
                "position": i + 1,
                "url": f"https://habibicraftsco.com/product-{p['slug']}.html",
                "name": p["name"],
            }
            for i, p in enumerate(PRODUCTS)
        ],
    },
}

write(
    "shop.html",
    wrap(
        page_head(
            "Shop | Habibi Crafts Co",
            "Six mugs at $18, two tees at $32, two totes at $34, two onesies at $28, two prints at $24.",
            "https://habibicraftsco.com/shop.html",
            extra_ld=[shop_ld],
        ),
        "shop",
        f"""  <section class="page-hero"><div class="shell">
    <div class="eyebrow">The shop</div>
    <h1>Fourteen pieces.</h1>
    <p class="lede">Personalized mugs, tees, totes, onesies, and prints. Same prices on every page.</p>
  </div></section>
  <section class="section tight"><div class="shell">
    <div class="filter-bar" role="group" aria-label="Filter by type">{filter_btns}</div>
    <div class="product-grid" id="catalog">{shop_cards}</div>
  </div></section>""",
    ),
)

# --- product pages ---
for p in PRODUCTS:
    siblings = [x for x in PRODUCTS if x["category"] == p["category"] and x["slug"] != p["slug"]]
    related = "\n".join(product_card(x) for x in siblings)
    related_h2 = {
        "mugs": "The other mugs.",
        "tees": "The other tee.",
        "totes": "The other tote.",
        "baby": "The other onesie.",
        "prints": "The other print.",
    }[p["category"]]
    related_grid = "product-grid two" if len(siblings) < 3 else "product-grid"
    details = "".join(f'<div class="detail"><span>{esc(k)}</span><span>{esc(v)}</span></div>' for k, v in p["details"])
    crumb_label = next(t for k, t, *_ in GROUPS if k == p["category"])
    extra = ""
    if p["category"] == "tees":
        extra = '<p class="size-line">S · M · L · XL</p>'
    elif p["category"] == "baby":
        extra = '<p class="size-line">3–6 months · 6–12 months · 12–18 months</p>'
    elif p["category"] == "totes":
        extra = '<p class="size-line">One size · cotton</p>'
    elif p["category"] == "prints":
        extra = '<p class="size-line">12 × 16 inches · matte paper · no frame</p>'
    elif p["category"] == "mugs":
        extra = '<p class="size-line">11 oz · white glossy</p>'

    product_ld = {
        "@context": "https://schema.org",
        "@graph": [
            {
                "@type": "Product",
                "@id": f"https://habibicraftsco.com/product-{p['slug']}.html#product",
                "name": p["name"],
                "description": p["blurb"],
                "brand": {"@type": "Brand", "name": "Habibi Crafts Co"},
                "offers": {
                    "@type": "Offer",
                    "url": f"https://habibicraftsco.com/product-{p['slug']}.html",
                    "priceCurrency": "USD",
                    "price": f"{p['price']:.2f}",
                    "availability": "https://schema.org/OutOfStock",
                    "itemCondition": "https://schema.org/NewCondition",
                },
            },
            {
                "@type": "BreadcrumbList",
                "itemListElement": [
                    {"@type": "ListItem", "position": 1, "name": "Home", "item": "https://habibicraftsco.com/"},
                    {"@type": "ListItem", "position": 2, "name": "Shop", "item": "https://habibicraftsco.com/shop.html"},
                    {
                        "@type": "ListItem",
                        "position": 3,
                        "name": p["name"],
                        "item": f"https://habibicraftsco.com/product-{p['slug']}.html",
                    },
                ],
            },
        ],
    }

    write(
        f"product-{p['slug']}.html",
        wrap(
            page_head(
                f"{p['name']} {p['kind']} | Habibi Crafts Co",
                p["blurb"],
                f"https://habibicraftsco.com/product-{p['slug']}.html",
                extra_ld=[product_ld],
            ).replace('property="og:type" content="website"', 'property="og:type" content="product"'),
            "shop",
            f"""  <div class="shell product-page">
    <div class="product-gallery">{type_card(p, "type-card-lg")}</div>
    <div class="product-meta">
      <nav class="breadcrumbs" aria-label="Breadcrumb"><a href="index.html">Home</a> / <a href="shop.html">Shop</a> / {esc(crumb_label)}</nav>
      <div class="eyebrow">{esc(p['kind'])}</div>
      <h1>{esc(p['name'])}</h1>
      <p class="product-subtitle">{esc(p['note'])}</p>
      <div class="product-price">{esc(p['priceLabel'])}</div>
      {extra}
      <p class="product-description">{esc(p['blurb'])}</p>
      <div class="actions" style="justify-content:flex-start"><button class="button" type="button" disabled>Notify me</button></div>
      <div class="details">{details}</div>
    </div>
  </div>
  <section class="section tight"><div class="shell">
    <div class="section-head"><div><div class="kicker">Also in {esc(crumb_label.lower())}</div><h2>{esc(related_h2)}</h2></div></div>
    <div class="{related_grid}">{related}</div>
  </div></section>""",
        ),
    )

# --- about ---
write(
    "about.html",
    wrap(
        page_head(
            "Our story | Habibi Crafts Co",
            "Husband-and-wife shop. Personalized mugs and gifts for weddings, bachelor and bachelorette parties, and everyday. Printed to order.",
            "https://habibicraftsco.com/about.html",
            extra_ld=[
                {
                    "@context": "https://schema.org",
                    "@type": "AboutPage",
                    "name": "Our story — Habibi Crafts Co",
                    "url": "https://habibicraftsco.com/about.html",
                    "about": {"@id": "https://habibicraftsco.com/#store"},
                    "inLanguage": "en-US",
                }
            ],
        ),
        "about",
        """  <section class="section"><div class="shell about-hero">
    <div class="about-block">
      <div class="kicker">Our story</div>
      <h1>Two of us. A small shop.</h1>
      <p>Husband and wife. We design this together — personalized mugs, plus other pieces for weddings, bachelor and bachelorette parties, and ordinary days.</p>
    </div>
    <div class="about-block art"><img src="assets/logo.png" alt="Habibi Crafts Co logo" width="447" height="447"></div>
  </div></section>
  <article class="editorial shell">
    <h2>A name on the mug.</h2>
    <p>That’s the specialty. Tees, totes, onesies, and prints sit next to it. For a wedding party, a bachelor weekend, or the person who will actually use the thing.</p>
    <p id="made-to-order">We design the pieces. Each one is printed after you order. Not a handmade studio, and no leftover stock.</p>
    <p>Thanks for supporting a small business. If it ends up at the table, that’s the point.</p>
  </article>""",
    ),
)

# --- faq ---
faqs = [
    ("What do you sell?", "Personalized mugs, tees, totes, baby onesies, and 12 × 16 prints. Fourteen pieces right now. Other crafts later."),
    ("How much are they?", "Mugs $18. Tees $32. Totes $34. Onesies $28. Prints $24. Same number on the shop page and the product page."),
    ("What size is the mug?", "11 oz, white glossy ceramic."),
    ("What sizes are the tees?", "Unisex S, M, L, and XL."),
    ("What about the onesies?", "White. 3–6 months, 6–12 months, and 12–18 months."),
    ("Are the prints framed?", "No. 12 × 16 inches, matte paper. You bring the frame."),
    ("Are they handmade?", "No. Each piece is printed after it’s ordered."),
    ("What does Sit El Kul mean?", "The woman who outranks the room. Said with affection."),
    ("And Ya Aini?", "A person you care about. Literally “my eye.”"),
    ("Who is this for?", "Wedding parties, bachelor and bachelorette weekends, and anyone who wants a mug with a name on it."),
]
faq_html = "".join(
    f"<details class=\"faq-item\"><summary>{esc(q)}</summary><p>{esc(a)}</p></details>" for q, a in faqs
)
faq_ld = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "mainEntity": [
        {"@type": "Question", "name": q, "acceptedAnswer": {"@type": "Answer", "text": a}} for q, a in faqs
    ],
}
write(
    "faq.html",
    wrap(
        page_head(
            "FAQ | Habibi Crafts Co",
            "Sizes, prices, and what the names mean. Mugs $18, tees $32, totes $34, onesies $28, prints $24.",
            "https://habibicraftsco.com/faq.html",
            extra_ld=[faq_ld],
        ),
        "faq",
        f"""  <section class="page-hero"><div class="shell">
    <div class="eyebrow">FAQ</div>
    <h1>Questions.</h1>
    <p class="lede">Sizes, prices, and a few of the names. If you want the longer version, that’s the story page.</p>
  </div></section>
  <section class="section tight"><div class="shell faq-list">{faq_html}</div></section>""",
    ),
)

# --- privacy ---
write(
    "privacy.html",
    wrap(
        page_head(
            "Privacy | Habibi Crafts Co",
            "Privacy information for Habibi Crafts Co, including the current analytics and advertising status of the storefront.",
            "https://habibicraftsco.com/privacy.html",
            extra_ld=[
                {
                    "@context": "https://schema.org",
                    "@type": "WebPage",
                    "name": "Privacy — Habibi Crafts Co",
                    "url": "https://habibicraftsco.com/privacy.html",
                    "isPartOf": {"@id": "https://habibicraftsco.com/#website"},
                }
            ],
        ),
        "",
        """  <article class="legal-shell">
    <div class="kicker">Site information</div>
    <h1>Privacy</h1>
    <p class="legal-updated">Last updated September 2, 2026</p>
    <h2>Current site status</h2>
    <p>Checkout, customer accounts, analytics, and advertising are currently disabled. This static storefront does not ask for payment details or create customer profiles.</p>
    <h2>Analytics</h2>
    <p>We plan to use Plausible Analytics to understand aggregate site traffic. Plausible is not active yet. If enabled, this page will be updated to describe the configuration in use.</p>
    <h2>Advertising</h2>
    <p>Google AdSense is not active. If advertising is added later, we will update this notice and add any consent controls required for the regions we serve before ads load.</p>
    <h2>Orders</h2>
    <p>Stripe checkout and order fulfillment are not connected to this public storefront yet.</p>
    <h2>Changes</h2>
    <p>This notice will be revised before checkout or advertising launches. The updated date at the top will change when that happens.</p>
  </article>""",
    ),
)

# --- 404 uses root-absolute paths ---
four = """<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex">
<meta name="theme-color" content="#faf6ef">
<title>Page not found | Habibi Crafts Co</title>
<link rel="icon" type="image/png" href="/assets/logo.png">
<link rel="stylesheet" href="/styles.css?v=nav-white">
<script defer src="/app.js"></script>
</head>
<body>
<a class="skip-link" href="#main">Skip to content</a>
<header class="site-header">
  <nav class="nav" aria-label="Primary navigation">
    <a class="brand" href="/"><img src="/assets/logo-nav-white.png" alt="Habibi Crafts Co" width="213" height="93"></a>
    <a class="nav-cta" href="/shop.html">See the shop</a>
  </nav>
</header>
<main id="main">
  <section class="page-hero"><div class="shell">
    <div class="eyebrow">404</div>
    <h1>This page isn’t here.</h1>
    <p class="lede">It may have moved. The shop is still on this site.</p>
    <div class="actions"><a class="button" href="/">Go home</a><a class="button secondary" href="/shop.html">See the shop</a></div>
  </div></section>
</main>
</body>
</html>
"""
write("404.html", four)

# --- sitemap ---
urls = [
    ("https://habibicraftsco.com/", "1.0", "weekly"),
    ("https://habibicraftsco.com/shop.html", "0.9", "weekly"),
    ("https://habibicraftsco.com/about.html", "0.7", "monthly"),
    ("https://habibicraftsco.com/faq.html", "0.6", "monthly"),
    ("https://habibicraftsco.com/privacy.html", "0.3", "yearly"),
]
for p in PRODUCTS:
    urls.append((f"https://habibicraftsco.com/product-{p['slug']}.html", "0.8", "weekly"))
body = ["<?xml version=\"1.0\" encoding=\"UTF-8\"?>", '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">']
for loc, pri, freq in urls:
    body.append(
        f"  <url><loc>{loc}</loc><lastmod>2026-09-02</lastmod><changefreq>{freq}</changefreq><priority>{pri}</priority></url>"
    )
body.append("</urlset>")
(SITE / "sitemap.xml").write_text("\n".join(body) + "\n")
print("wrote site/sitemap.xml")
