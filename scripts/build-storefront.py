#!/usr/bin/env python3
"""Build the live 3-product storefront. No extra SKUs. No API tokens."""
from __future__ import annotations

import json
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SITE = ROOT / "site"

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
FILE = {
    "yalla-habibi-mug": "product-yalla-habibi-mug.html",
    "ha-onesie": "product-ha-onesie.html",
    "habibi-wall-sign": "product-habibi-wall-sign.html",
}


def esc(s: str) -> str:
    return s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;").replace('"', "&quot;")


def dumps(obj) -> str:
    return json.dumps(obj, ensure_ascii=False, separators=(",", ":"))


def head(title, description, canonical, extra_ld=None, og_image="https://habibicraftsco.com/assets/logo.png", og_type="website"):
    ld = "\n".join(f'<script type="application/ld+json">{dumps(item)}</script>' for item in (extra_ld or []))
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
<meta property="og:type" content="{og_type}">
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
<link rel="stylesheet" href="styles.css">
{ld}
<script defer src="analytics.js"></script>
<script defer src="app.js"></script>
</head>"""


def nav(current: str) -> str:
    def a(href, label, key):
        cur = ' aria-current="page"' if current == key else ""
        return f'<a href="{href}"{cur}>{label}</a>'

    return f"""<header class="site-header">
  <nav class="nav" aria-label="Primary navigation">
    <a class="brand" href="index.html"><img src="assets/logo-nav.png" alt="Habibi Crafts Co" width="237" height="110"></a>
    <button class="menu-toggle" type="button" aria-expanded="false" aria-controls="primary-menu" aria-label="Open menu"><span></span></button>
    <div class="nav-links" id="primary-menu">
      {a("index.html", "Home", "home")}
      {a("shop.html", "Shop", "shop")}
      {a("about.html", "Our story", "about")}
      {a("faq.html", "FAQ", "faq")}
      <a class="nav-cta" href="shop.html">See all 3 pieces</a>
    </div>
  </nav>
</header>"""


def footer() -> str:
    return """<footer class="site-footer">
  <div class="footer-grid">
    <div>
      <div class="footer-brand">Habibi Crafts Co</div>
      <p class="footer-copy">A mug, an onesie, and a print. The words from home.</p>
    </div>
    <div>
      <div class="footer-title">Shop</div>
      <div class="footer-links">
        <a href="shop.html">All 3 pieces</a>
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


def wrap(h, current, main):
    return f"""{h}
<body>
<a class="skip-link" href="#main">Skip to content</a>
{nav(current)}
<main id="main">
{main}
</main>
{footer()}
</body>
</html>
"""


def card(p):
    href = FILE[p["slug"]]
    return f"""<a class="product-card reveal" href="{href}" data-category="{esc(p['category'])}">
  <div class="product-media"><img src="{esc(p['image'])}" alt="{esc(p['alt'])}" loading="lazy" width="{p['imageW']}" height="{p['imageH']}"></div>
  <div class="product-copy">
    <div class="product-type">{esc(p['kind'])}</div>
    <div class="product-row"><h3>{esc(p['name'])}</h3><span class="price">{esc(p['priceLabel'])}</span></div>
    <p class="product-note">{esc(p['note'])}</p>
  </div>
</a>"""


def write(name, html):
    (SITE / name).write_text(html)
    print("wrote", name)


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
            "description": "A mug, an onesie, and a wall print. Arabic phrases from home.",
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
        head(
            "Habibi Crafts Co | A mug, an onesie, and a print",
            "Yalla Habibi mug $18, Ha print onesie $28, Habibi wall print $24. Phrases from home, on three things.",
            "https://habibicraftsco.com/",
            extra_ld=[home_ld],
        ),
        "home",
        f"""  <section class="hero">
    <div class="shell">
      <div class="eyebrow">Habibi Crafts Co · California</div>
      <h1>A little home,<br><em>carried forward.</em></h1>
      <p class="lede">Phrases we grew up with, put on a mug, an onesie, and a print.</p>
      <div class="actions"><a class="button" href="shop.html">See all 3 pieces</a><a class="button secondary" href="about.html">Our story</a></div>
    </div>
    <div class="hero-stage" aria-label="Yalla Habibi artwork"><img src="assets/mug-1.png" alt="Yalla Habibi typographic artwork" width="643" height="310" fetchpriority="high"><span class="hero-stage-note">Yalla Habibi · 11 oz mug · $18</span></div>
  </section>
  <section class="section" aria-labelledby="featured-heading"><div class="shell">
    <h2 id="featured-heading" class="sr-only">The three pieces</h2>
    <div class="product-grid">
{card(PRODUCTS[0])}
{card(PRODUCTS[1])}
{card(PRODUCTS[2])}
    </div>
  </div></section>
  <section class="section tight"><div class="shell story-panel reveal">
    <div class="kicker" style="color:#eab038">Why this exists</div>
    <h2>The phrases followed us. The products came later.</h2>
    <p>Yalla on the way out. Sahtein at the table. Khalas when the conversation is very much over. The shop starts there.</p>
    <a class="text-link" href="about.html">Read the story</a>
  </div></section>""",
    ),
)

shop_ld = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    "name": "Shop Habibi Crafts Co",
    "url": "https://habibicraftsco.com/shop.html",
    "mainEntity": {
        "@type": "ItemList",
        "numberOfItems": 3,
        "itemListElement": [
            {
                "@type": "ListItem",
                "position": i + 1,
                "url": f"https://habibicraftsco.com/{FILE[p['slug']]}",
                "name": p["name"],
            }
            for i, p in enumerate(PRODUCTS)
        ],
    },
}

write(
    "shop.html",
    wrap(
        head(
            "Shop | Habibi Crafts Co",
            "Yalla Habibi mug $18, Ha print onesie $28, Habibi wall print $24.",
            "https://habibicraftsco.com/shop.html",
            extra_ld=[shop_ld],
        ),
        "shop",
        f"""  <section class="page-hero"><div class="shell">
    <div class="eyebrow">The shop</div>
    <h1>Three pieces.</h1>
    <p class="lede">A mug, an onesie, and a print. Same names and prices as on the home page.</p>
  </div></section>
  <section class="section tight"><div class="shell">
    <div class="product-grid">
{card(PRODUCTS[0])}
{card(PRODUCTS[1])}
{card(PRODUCTS[2])}
    </div>
  </div></section>""",
    ),
)

# Unique extra blocks so product pages are not clones
EXTRAS = {
    "yalla-habibi-mug": '<p class="size-line">11 oz · white gloss</p>',
    "ha-onesie": '<p class="size-line">3–6 months · 6–12 months · 12–18 months</p>',
    "habibi-wall-sign": '<p class="size-line">12 × 16 inches · matte paper · no frame</p>',
}
RELATED_H2 = {
    "yalla-habibi-mug": "The onesie and the print.",
    "ha-onesie": "The mug and the print.",
    "habibi-wall-sign": "The mug and the onesie.",
}

for p in PRODUCTS:
    others = [x for x in PRODUCTS if x["slug"] != p["slug"]]
    related = "\n".join(card(x) for x in others)
    details = "".join(f'<div class="detail"><span>{esc(k)}</span><span>{esc(v)}</span></div>' for k, v in p["details"])
    fname = FILE[p["slug"]]
    og = f"https://habibicraftsco.com/{p['image']}"
    product_ld = {
        "@context": "https://schema.org",
        "@graph": [
            {
                "@type": "Product",
                "@id": f"https://habibicraftsco.com/{fname}#product",
                "name": p["name"],
                "image": [og],
                "description": p["blurb"],
                "brand": {"@type": "Brand", "name": "Habibi Crafts Co"},
                "offers": {
                    "@type": "Offer",
                    "url": f"https://habibicraftsco.com/{fname}",
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
                    {"@type": "ListItem", "position": 3, "name": p["name"], "item": f"https://habibicraftsco.com/{fname}"},
                ],
            },
        ],
    }
    write(
        fname,
        wrap(
            head(
                f"{p['name']} | Habibi Crafts Co",
                p["blurb"],
                f"https://habibicraftsco.com/{fname}",
                extra_ld=[product_ld],
                og_image=og,
                og_type="product",
            ),
            "shop",
            f"""  <div class="shell product-page">
    <div class="product-gallery"><img src="{esc(p['image'])}" alt="{esc(p['alt'])}" width="{p['imageW']}" height="{p['imageH']}" fetchpriority="high"></div>
    <div class="product-meta">
      <nav class="breadcrumbs" aria-label="Breadcrumb"><a href="index.html">Home</a> / <a href="shop.html">Shop</a> / {esc(p['kind'])}</nav>
      <div class="eyebrow">{esc(p['kind'])}</div>
      <h1>{esc(p['name'])}</h1>
      <p class="product-subtitle">{esc(p['note'])}</p>
      <div class="product-price">{esc(p['priceLabel'])}</div>
      {EXTRAS[p['slug']]}
      <p class="product-description">{esc(p['blurb'])}</p>
      <div class="actions" style="justify-content:flex-start"><button class="button" type="button" disabled>Notify me</button></div>
      <div class="details">{details}</div>
    </div>
  </div>
  <section class="section tight"><div class="shell">
    <div class="section-head"><div><h2>{esc(RELATED_H2[p['slug']])}</h2></div></div>
    <div class="product-grid two">
{related}
    </div>
  </div></section>""",
        ),
    )

write(
    "about.html",
    wrap(
        head(
            "Our story | Habibi Crafts Co",
            "It started with the words. Yalla, sahtein, khalas — then a mug, an onesie, and a print.",
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
      <h1>It started with the words.</h1>
      <p>Yalla when it is time to go. Sahtein before a meal. Khalas when everyone knows the conversation should have ended five minutes ago.</p>
    </div>
    <div class="about-block art"><img src="assets/logo.png" alt="Habibi Crafts Co logo" width="447" height="447"></div>
  </div></section>
  <article class="editorial shell">
    <h2>Small pieces of home, made useful.</h2>
    <p>The phrases come from family group chats, kitchen tables, and the way we actually talk. They are not slogans we found later. They were already there.</p>
    <p>They go on three things: the mug beside the coffee, an onesie for a new baby, a print by the door.</p>
    <p id="made-to-order">Each piece is printed after it’s ordered.</p>
  </article>""",
    ),
)

faqs = [
    ("What’s in the shop?", "Three pieces: the Yalla Habibi mug ($18), the Ha print onesie ($28), and the Habibi wall print ($24)."),
    ("What size is the mug?", "11 oz, white ceramic."),
    ("What sizes is the onesie?", "3–6 months, 6–12 months, and 12–18 months."),
    ("Is the print framed?", "No. 12 × 16 inches, matte paper."),
    ("What does Ha mean on the onesie?", "It’s a letter. Not a joke — a letter kids grow up seeing."),
]
faq_html = "".join(f'<details class="faq-item"><summary>{esc(q)}</summary><p>{esc(a)}</p></details>' for q, a in faqs)
write(
    "faq.html",
    wrap(
        head(
            "FAQ | Habibi Crafts Co",
            "The mug is $18, the onesie $28, the print $24. Sizes and a note about Ha.",
            "https://habibicraftsco.com/faq.html",
            extra_ld=[
                {
                    "@context": "https://schema.org",
                    "@type": "FAQPage",
                    "mainEntity": [
                        {"@type": "Question", "name": q, "acceptedAnswer": {"@type": "Answer", "text": a}} for q, a in faqs
                    ],
                }
            ],
        ),
        "faq",
        f"""  <section class="page-hero"><div class="shell">
    <div class="eyebrow">FAQ</div>
    <h1>Questions.</h1>
    <p class="lede">Three pieces, a few sizes. The longer version is on the story page.</p>
  </div></section>
  <section class="section tight"><div class="shell faq-list">{faq_html}</div></section>""",
    ),
)

write(
    "privacy.html",
    wrap(
        head(
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
    <p class="legal-updated">Last updated September 1, 2026</p>
    <h2>Current site status</h2>
    <p>Checkout, customer accounts, analytics, and advertising are currently disabled. This static storefront does not ask for payment details or create customer profiles.</p>
    <h2>Analytics</h2>
    <p>We plan to use Plausible Analytics to understand aggregate site traffic. Plausible is not active yet. If enabled, this page will be updated to describe the configuration in use.</p>
    <h2>Advertising</h2>
    <p>Google AdSense is not active. If advertising is added later, we will update this notice and add any consent controls required for the regions we serve before ads load.</p>
    <h2>Orders</h2>
    <p>Checkout and order fulfillment are not connected to this public storefront yet.</p>
    <h2>Changes</h2>
    <p>This notice will be revised before checkout or advertising launches. The updated date at the top will change when that happens.</p>
  </article>""",
    ),
)

(SITE / "404.html").write_text(
    """<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex">
<meta name="theme-color" content="#faf6ef">
<title>Page not found | Habibi Crafts Co</title>
<link rel="icon" type="image/png" href="/assets/logo.png">
<link rel="stylesheet" href="/styles.css">
<script defer src="/app.js"></script>
</head>
<body>
<a class="skip-link" href="#main">Skip to content</a>
<header class="site-header">
  <nav class="nav" aria-label="Primary navigation">
    <a class="brand" href="/"><img src="/assets/logo-nav.png" alt="Habibi Crafts Co" width="237" height="110"></a>
    <a class="nav-cta" href="/shop.html">See all 3 pieces</a>
  </nav>
</header>
<main id="main">
  <section class="page-hero"><div class="shell">
    <div class="eyebrow">404</div>
    <h1>This page isn’t here.</h1>
    <p class="lede">The shop is three pieces. You can start there.</p>
    <div class="actions"><a class="button" href="/">Go home</a><a class="button secondary" href="/shop.html">See all 3 pieces</a></div>
  </div></section>
</main>
</body>
</html>
"""
)
print("wrote 404.html")

urls = [
    ("https://habibicraftsco.com/", "1.0", "weekly"),
    ("https://habibicraftsco.com/shop.html", "0.9", "weekly"),
    ("https://habibicraftsco.com/about.html", "0.7", "monthly"),
    ("https://habibicraftsco.com/product-yalla-habibi-mug.html", "0.8", "weekly"),
    ("https://habibicraftsco.com/product-ha-onesie.html", "0.8", "weekly"),
    ("https://habibicraftsco.com/product-habibi-wall-sign.html", "0.8", "weekly"),
    ("https://habibicraftsco.com/privacy.html", "0.3", "yearly"),
    ("https://habibicraftsco.com/faq.html", "0.5", "monthly"),
]
lines = ['<?xml version="1.0" encoding="UTF-8"?>', '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">']
for loc, pri, freq in urls:
    lines.append(f"  <url><loc>{loc}</loc><lastmod>2026-09-01</lastmod><changefreq>{freq}</changefreq><priority>{pri}</priority></url>")
lines.append("</urlset>")
(SITE / "sitemap.xml").write_text("\n".join(lines) + "\n")
print("wrote sitemap.xml")
