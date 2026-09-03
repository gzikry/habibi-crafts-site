#!/usr/bin/env python3
"""Generate static Habibi Crafts Co pages from the public catalog. No API tokens."""
from __future__ import annotations

import json
from pathlib import Path
import subprocess

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
BY_SLUG = {p["slug"]: p for p in PRODUCTS}

# (category key, heading, price, spec line, collection filename)
GROUPS = [
    ("mugs", "Mugs", "$18", "11 oz white glossy.", "mugs.html"),
    ("tees", "Tees", "$32", "Unisex, S through XL.", "tees.html"),
    ("totes", "Totes", "$34", "Cotton. One size.", "totes.html"),
    ("baby", "Onesies", "$28", "White. 3–6m, 6–12m, 12–18m.", "onesies.html"),
    ("prints", "Prints", "$24", "12 × 16 matte. Frame not included.", "prints.html"),
]

# Live featured pieces only. Do not add unpublished drafts.
FEATURED_SLUGS = (
    "ya-aini",
    "knafeh-club",
    "khalas-habibi",
    "halawa",
    "ya-teta",
    "beit-el-hobb",
)

ASSET_V = "catalog"
SITEMAP_LASTMOD = "2026-09-03"


def esc(s: str) -> str:
    return (
        s.replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
        .replace('"', "&quot;")
    )


def json_ld(obj) -> str:
    return json.dumps(obj, ensure_ascii=False, separators=(",", ":"))


def group_for(category: str):
    return next(g for g in GROUPS if g[0] == category)


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
<link rel="stylesheet" href="styles.css?v={ASSET_V}">
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
      {link("shop.html", "Shop", "shop")}
      {link("about.html", "About", "about")}
      {link("faq.html", "FAQ", "faq")}
    </div>
  </nav>
</header>"""


def footer(prefix: str = "") -> str:
    kind_links = "\n        ".join(f'<a href="{prefix}{page}">{title}</a>' for _, title, _, _, page in GROUPS)
    return f"""<footer class="site-footer">
  <div class="footer-grid">
    <div>
      <div class="footer-brand">Habibi Crafts Co</div>
      <p class="footer-copy">A husband-and-wife shop.</p>
    </div>
    <div>
      <div class="footer-title">Shop</div>
      <div class="footer-links">
        <a href="{prefix}shop.html">Shop</a>
        {kind_links}
      </div>
    </div>
    <div>
      <div class="footer-title">Info</div>
      <div class="footer-links">
        <a href="{prefix}about.html">About</a>
        <a href="{prefix}faq.html">FAQ</a>
        <a href="{prefix}shipping.html">Shipping</a>
        <a href="{prefix}privacy.html">Privacy</a>
        <a href="{prefix}contact.html">Contact</a>
      </div>
    </div>
  </div>
  <div class="footer-bottom"><span>© 2026 Habibi Crafts Co</span><span>California</span></div>
</footer>"""


def kind_bar(current: str) -> str:
    items = [("all", "All", "shop.html")] + [(key, title, page) for key, title, _, _, page in GROUPS]
    links = []
    for key, label, href in items:
        cur = ' aria-current="page"' if current == key else ""
        links.append(f'<a class="filter-button" href="{esc(href)}"{cur}>{esc(label)}</a>')
    return f'<nav class="filter-bar" aria-label="Shop by collection">{"".join(links)}</nav>'


def mockup_src(p) -> str:
    """Local PNG under site/assets/mockups/. Rebuilds must keep using these files, not a live CDN."""
    return p.get("image") or f"assets/mockups/{p['slug']}.png"


def mockup_img(p, *, alt: str, lazy: bool = False) -> str:
    loading = ' loading="lazy"' if lazy else ""
    return (
        f'<img class="mockup" src="{esc(mockup_src(p))}?v={ASSET_V}" alt="{esc(alt)}" '
        f'width="800" height="800"{loading} decoding="async">'
    )


def product_card(p, *, show_type: bool = False):
    type_html = f'\n    <div class="product-type">{esc(p["kind"])}</div>' if show_type else ""
    return f"""<a class="product-card reveal" href="product-{esc(p['slug'])}.html" data-category="{esc(p['category'])}">
  <div class="product-media">{mockup_img(p, alt=p["name"], lazy=True)}</div>
  <div class="product-copy">{type_html}
    <div class="product-row"><h3>{esc(p['name'])}</h3><span class="price">{esc(p['priceLabel'])}</span></div>
  </div>
</a>"""


def kind_card(key, title, page):
    preview = next(p for p in PRODUCTS if p["category"] == key)
    return f"""<a class="kind-card reveal" href="{esc(page)}" data-kind="{esc(key)}">
  <div class="kind-card-media">{mockup_img(preview, alt="", lazy=True)}</div>
  <div class="kind-card-copy">
    <h3>{esc(title)}</h3>
  </div>
</a>"""


def catalog_section(key, title, price, blurb, page, *, heading_id: str, link_to_collection: bool):
    items = [p for p in PRODUCTS if p["category"] == key]
    cards = "\n".join(product_card(p) for p in items)
    grid_cls = "product-grid two" if len(items) < 3 else "product-grid"
    link = f'\n      <a class="text-link" href="{esc(page)}">Shop {esc(title.lower())}</a>' if link_to_collection else ""
    return f"""<section class="section tight shop-section" id="{esc(heading_id)}" aria-labelledby="{esc(heading_id)}-heading">
  <div class="shell">
    <div class="section-head">
      <div>
        <div class="kicker">{esc(price)}</div>
        <h2 id="{esc(heading_id)}-heading">{esc(title)}</h2>
        <p>{esc(blurb)}</p>
      </div>{link}
    </div>
    <div class="{grid_cls}">{cards}</div>
  </div>
</section>"""


def item_list_ld(url: str, name: str, products):
    return {
        "@context": "https://schema.org",
        "@type": "CollectionPage",
        "name": name,
        "url": url,
        "mainEntity": {
            "@type": "ItemList",
            "itemListElement": [
                {
                    "@type": "ListItem",
                    "position": i + 1,
                    "url": f"https://habibicraftsco.com/product-{p['slug']}.html",
                    "name": p["name"],
                }
                for i, p in enumerate(products)
            ],
        },
    }


def wrap(head, current, main, prefix=""):
    return f"""{head}
<body>
<a class="skip-link" href="#main">Skip to content</a>
{nav(current, prefix)}
<main id="main">
{main}
</main>
{footer(prefix)}
</body>
</html>
"""


def write(name: str, html: str):
    path = SITE / name
    path.write_text(html)
    print("wrote", path.relative_to(ROOT))


# --- index ---
home_kinds = "\n".join(kind_card(key, title, page) for key, title, _, _, page in GROUPS)
home_featured = "\n".join(product_card(BY_SLUG[slug]) for slug in FEATURED_SLUGS)

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
            "description": "A husband-and-wife shop in California.",
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
            "Habibi Crafts Co",
            "A husband-and-wife shop. Mugs, tees, totes, onesies, and prints.",
            "https://habibicraftsco.com/",
            extra_ld=[home_ld],
            og_image="https://habibicraftsco.com/assets/mockups/ya-aini.png",
        ),
        "home",
        f"""  <section class="shop-intro">
    <div class="shell">
      <h1>Habibi Crafts Co</h1>
      <p class="lede">We’re a husband-and-wife shop.</p>
    </div>
  </section>
  <section class="section tight" id="shop-by-collection" aria-labelledby="shop-by-collection-heading">
    <div class="shell">
      <div class="section-head">
        <h2 id="shop-by-collection-heading">Shop by collection</h2>
        <a class="text-link" href="shop.html">See everything</a>
      </div>
      <div class="kind-grid">{home_kinds}</div>
    </div>
  </section>
  <section class="section tight" id="from-the-shop" aria-labelledby="from-the-shop-heading">
    <div class="shell">
      <div class="section-head">
        <h2 id="from-the-shop-heading">From the shop</h2>
        <a class="text-link" href="shop.html">See everything</a>
      </div>
      <div class="product-grid">{home_featured}</div>
    </div>
  </section>
  <section class="section tight" id="shop-note"><div class="shell shop-note reveal">
    <p>Once we open, pieces print after you order. We’ll keep adding.</p>
    <a class="text-link" href="about.html">About</a>
  </div></section>""",
    ),
)

# --- shop ---
shop_sections = "\n".join(
    catalog_section(key, title, price, blurb, page, heading_id=key, link_to_collection=True)
    for key, title, price, blurb, page in GROUPS
)

write(
    "shop.html",
    wrap(
        page_head(
            "Shop | Habibi Crafts Co",
            "Mugs, tees, totes, onesies, and prints. We’ll keep adding.",
            "https://habibicraftsco.com/shop.html",
            extra_ld=[item_list_ld("https://habibicraftsco.com/shop.html", "Shop Habibi Crafts Co", PRODUCTS)],
            og_image="https://habibicraftsco.com/assets/mockups/ya-aini.png",
        ),
        "shop",
        f"""  <section class="catalog-head"><div class="shell">
    <h1>The shop</h1>
    <p class="lede">We’ll keep adding.</p>
    {kind_bar("all")}
  </div></section>
{shop_sections}""",
    ),
)

# --- collection pages ---
for key, title, price, blurb, page in GROUPS:
    items = [p for p in PRODUCTS if p["category"] == key]
    cards = "\n".join(product_card(p) for p in items)
    grid_cls = "product-grid two" if len(items) < 3 else "product-grid"
    write(
        page,
        wrap(
            page_head(
                f"{title} | Habibi Crafts Co",
                f"{blurb} {price}.",
                f"https://habibicraftsco.com/{page}",
                extra_ld=[item_list_ld(f"https://habibicraftsco.com/{page}", f"{title} — Habibi Crafts Co", items)],
                og_image=f"https://habibicraftsco.com/{mockup_src(items[0])}",
            ),
            "shop",
            f"""  <section class="catalog-head"><div class="shell">
    <h1>{esc(title)}</h1>
    <p class="lede">{esc(blurb)} {esc(price)}.</p>
    {kind_bar(key)}
  </div></section>
  <section class="section tight"><div class="shell">
    <div class="{grid_cls}">{cards}</div>
  </div></section>""",
        ),
    )

# --- product pages ---
for p in PRODUCTS:
    siblings = [x for x in PRODUCTS if x["category"] == p["category"] and x["slug"] != p["slug"]]
    related = "\n".join(product_card(x) for x in siblings)
    related_h2 = {
        "mugs": "More mugs",
        "tees": "More tees",
        "totes": "More totes",
        "baby": "More onesies",
        "prints": "More prints",
    }[p["category"]]
    related_grid = "product-grid two" if len(siblings) < 3 else "product-grid"
    key, crumb_label, _, _, collection_page = group_for(p["category"])
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
                "image": f"https://habibicraftsco.com/{mockup_src(p)}",
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
                        "name": crumb_label,
                        "item": f"https://habibicraftsco.com/{collection_page}",
                    },
                    {
                        "@type": "ListItem",
                        "position": 4,
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
                f"{p['name']} | Habibi Crafts Co",
                p["blurb"],
                f"https://habibicraftsco.com/product-{p['slug']}.html",
                extra_ld=[product_ld],
                og_image=f"https://habibicraftsco.com/{mockup_src(p)}",
            ).replace('property="og:type" content="website"', 'property="og:type" content="product"'),
            "shop",
            f"""  <div class="shell product-page">
    <div class="product-gallery" data-kind="{esc(p['category'])}">{mockup_img(p, alt=p["name"])}</div>
    <div class="product-meta">
      <nav class="breadcrumbs" aria-label="Breadcrumb"><a href="index.html">Home</a> / <a href="shop.html">Shop</a> / <a href="{esc(collection_page)}">{esc(crumb_label)}</a></nav>
      <h1>{esc(p['name'])}</h1>
      <div class="product-price">{esc(p['priceLabel'])}</div>
      {extra}
      <div class="actions" style="justify-content:flex-start"><button class="button" type="button" disabled>Notify me</button></div>
    </div>
  </div>
  <section class="section tight"><div class="shell">
    <div class="section-head"><h2>{esc(related_h2)}</h2><a class="text-link" href="{esc(collection_page)}">Shop {esc(crumb_label.lower())}</a></div>
    <div class="{related_grid}">{related}</div>
  </div></section>""",
        ),
    )

# --- about ---
write(
    "about.html",
    wrap(
        page_head(
            "About | Habibi Crafts Co",
            "We’re a husband and wife, and this is our shop.",
            "https://habibicraftsco.com/about.html",
            extra_ld=[
                {
                    "@context": "https://schema.org",
                    "@type": "AboutPage",
                    "name": "About — Habibi Crafts Co",
                    "url": "https://habibicraftsco.com/about.html",
                    "about": {"@id": "https://habibicraftsco.com/#store"},
                    "inLanguage": "en-US",
                }
            ],
        ),
        "about",
        """  <section class="policy-head"><div class="shell">
    <h1>About</h1>
    <p class="lede">We’re a husband and wife, and this is our shop.</p>
  </div></section>
  <article class="editorial shell">
    <p>Thanks for stopping by.</p>
  </article>""",
    ),
)

# --- faq ---
faqs = [
    ("What is Habibi Crafts Co?", "A husband-and-wife shop."),
    ("What do you sell?", "Mugs, tees, totes, onesies, and prints. We’ll keep adding."),
    ("Can I order?", "Not yet. Checkout isn’t open."),
    ("How are the pieces made?", "We design them. Once checkout opens, each piece prints after you order."),
    ("What size is the mug?", "11 oz, white glossy."),
    ("What sizes are the tees?", "Unisex S, M, L, and XL."),
    ("What about the onesies?", "White. 3–6 months, 6–12 months, and 12–18 months."),
    ("What about the totes?", "Cotton. One size."),
    ("Are the prints framed?", "No. 12 × 16 inches, matte paper. Frame not included."),
    ("How much are they?", "Mugs $18. Tees $32. Totes $34. Onesies $28. Prints $24."),
    ("What do the names mean?", "They’re just names. We don’t translate them."),
    ("How does shipping work?", "We’re not taking orders yet. When we open, pieces print after you order, then they ship. Details will be on the shipping page."),
    ("How do I reach you?", "We haven’t posted a public email or phone yet. When we do, it will be on the contact page."),
]
faq_html = "".join(
    f'<details class="faq-item"><summary>{esc(q)}</summary><p>{esc(a)}</p></details>' for q, a in faqs
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
            "Sizes, checkout, and how pieces are made.",
            "https://habibicraftsco.com/faq.html",
            extra_ld=[faq_ld],
        ),
        "faq",
        f"""  <section class="policy-head"><div class="shell">
    <h1>FAQ</h1>
    <p class="lede">Sizes, checkout, and how pieces are made.</p>
  </div></section>
  <section class="section tight"><div class="shell faq-list">{faq_html}</div></section>""",
    ),
)

# --- shipping ---
write(
    "shipping.html",
    wrap(
        page_head(
            "Shipping | Habibi Crafts Co",
            "Checkout isn’t open yet. When we start taking orders, pieces print after you order, then they ship.",
            "https://habibicraftsco.com/shipping.html",
            extra_ld=[
                {
                    "@context": "https://schema.org",
                    "@type": "WebPage",
                    "name": "Shipping — Habibi Crafts Co",
                    "url": "https://habibicraftsco.com/shipping.html",
                    "isPartOf": {"@id": "https://habibicraftsco.com/#website"},
                }
            ],
        ),
        "",
        """  <article class="legal-shell">
    <h1>Shipping</h1>
    <p class="legal-updated">Last updated September 3, 2026</p>
    <h2>Orders</h2>
    <p>We are not taking orders yet. Checkout is closed.</p>
    <h2>When we open</h2>
    <p>Pieces will print after you order, then they will ship. We will post timing, rates, and where we ship when checkout opens. We do not have those details yet.</p>
    <h2>Returns</h2>
    <p>We will publish a return policy when we start taking orders.</p>
  </article>""",
    ),
)

# --- contact ---
write(
    "contact.html",
    wrap(
        page_head(
            "Contact | Habibi Crafts Co",
            "We’re a husband-and-wife shop. We haven’t posted a public way to reach us yet.",
            "https://habibicraftsco.com/contact.html",
            extra_ld=[
                {
                    "@context": "https://schema.org",
                    "@type": "ContactPage",
                    "name": "Contact — Habibi Crafts Co",
                    "url": "https://habibicraftsco.com/contact.html",
                    "about": {"@id": "https://habibicraftsco.com/#store"},
                    "inLanguage": "en-US",
                }
            ],
        ),
        "",
        """  <section class="policy-head"><div class="shell">
    <h1>Contact</h1>
    <p class="lede">We’re a husband-and-wife shop.</p>
  </div></section>
  <article class="editorial shell">
    <p>We haven’t posted a public email, phone, or address yet. When we have a way to reach us, it will be here.</p>
    <p>For sizes and how pieces are made, see the <a class="text-link" href="faq.html">FAQ</a>.</p>
  </article>""",
    ),
)

# --- privacy ---
write(
    "privacy.html",
    wrap(
        page_head(
            "Privacy | Habibi Crafts Co",
            "A short note on this shop site. Checkout is not open. We do not collect payment information.",
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
    <h1>Privacy</h1>
    <p class="legal-updated">Last updated September 3, 2026</p>
    <h2>This site</h2>
    <p>This is a static shop site on GitHub Pages. The host may log visits the way any web host does.</p>
    <h2>Orders</h2>
    <p>Checkout is not open. We are not collecting payment details, accounts, or customer lists.</p>
    <h2>Analytics</h2>
    <p>We use Plausible to see aggregate page views. It does not use marketing cookies, and we do not show a cookie banner because we are not setting those cookies.</p>
    <h2>Ads and lists</h2>
    <p>There are no ads on this site. We do not sell lists. We do not have a customer list to sell.</p>
    <h2>Changes</h2>
    <p>We will update this page if checkout, ads, or how we measure traffic changes.</p>
  </article>""",
    ),
)

# --- 404 uses root-absolute paths ---
four_head = f"""<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex">
<meta name="theme-color" content="#faf6ef">
<title>Page not found | Habibi Crafts Co</title>
<link rel="icon" type="image/png" href="/assets/logo.png">
<link rel="stylesheet" href="/styles.css?v={ASSET_V}">
<script defer src="/app.js"></script>
</head>"""
write(
    "404.html",
    wrap(
        four_head,
        "",
        """  <section class="catalog-head"><div class="shell">
    <h1>This page isn’t here.</h1>
    <p class="lede">It may have moved. The shop is still on this site.</p>
    <div class="actions"><a class="button" href="/">Go home</a><a class="button secondary" href="/shop.html">Shop</a></div>
  </div></section>""",
        prefix="/",
    ),
)

# --- sitemap ---
urls = [
    ("https://habibicraftsco.com/", "1.0", "weekly"),
    ("https://habibicraftsco.com/shop.html", "0.9", "weekly"),
]
for _, _, _, _, page in GROUPS:
    urls.append((f"https://habibicraftsco.com/{page}", "0.85", "weekly"))
urls.extend(
    [
        ("https://habibicraftsco.com/about.html", "0.7", "monthly"),
        ("https://habibicraftsco.com/faq.html", "0.6", "monthly"),
        ("https://habibicraftsco.com/shipping.html", "0.5", "monthly"),
        ("https://habibicraftsco.com/contact.html", "0.5", "monthly"),
        ("https://habibicraftsco.com/privacy.html", "0.3", "yearly"),
    ]
)
for p in PRODUCTS:
    urls.append((f"https://habibicraftsco.com/product-{p['slug']}.html", "0.8", "weekly"))
body = ['<?xml version="1.0" encoding="UTF-8"?>', '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">']
for loc, pri, freq in urls:
    body.append(
        f"  <url><loc>{loc}</loc><lastmod>{SITEMAP_LASTMOD}</lastmod><changefreq>{freq}</changefreq><priority>{pri}</priority></url>"
    )
body.append("</urlset>")
(SITE / "sitemap.xml").write_text("\n".join(body) + "\n")
print("wrote site/sitemap.xml")
