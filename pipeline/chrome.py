import json
from pathlib import Path

BASE = 'https://habibicraftsco.com'

# Per-file cache keys on the live pages. bag.js is an ES module, so the tag
# is type=module. A deferred classic script cannot load it.
SCRIPT_V = {
    'styles.css': '18',
    'public-config.js': '11',
    'analytics.js': '10',
    'bag.js': '15',
    'checkout.js': '12',
    'spin.js': '11',
    'app.js': '12',
}

SHOP_LINKS = (
    ('shop.html', 'All'),
    ('mugs.html', 'Mugs'),
    ('tees.html', 'Tees'),
    ('totes.html', 'Totes'),
    ('onesies.html', 'Onesies'),
    ('prints.html', 'Prints'),
    ('stickers.html', 'Stickers'),
    ('hats.html', 'Hats'),
)

SOON_LINKS = (
    ('sweatshirts.html', 'Sweatshirts'),
    ('long-sleeves.html', 'Long sleeves'),
    ('beanies.html', 'Beanies'),
    ('hoodies.html', 'Hoodies'),
    ('youth-tees.html', 'Youth tees'),
    ('coasters.html', 'Coasters'),
    ('journals.html', 'Journals'),
    ('aprons.html', 'Aprons'),
)


def esc(s):
    return (s.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')
             .replace('"', '&quot;'))


def output_dir(default):
    import sys
    if '--out' in sys.argv:
        return Path(sys.argv[sys.argv.index('--out') + 1])
    return default


def scripts(include_spin=True):
    v = SCRIPT_V
    lines = [
        f'<script src="public-config.js?v={v["public-config.js"]}"></script>',
        f'<script defer src="analytics.js?v={v["analytics.js"]}"></script>',
        f'<script type="module" src="bag.js?v={v["bag.js"]}"></script>',
        f'<script defer src="checkout.js?v={v["checkout.js"]}"></script>',
    ]
    if include_spin:
        lines.append(f'<script defer src="spin.js?v={v["spin.js"]}"></script>')
    lines.append(f'<script defer src="app.js?v={v["app.js"]}"></script>')
    return '\n'.join(lines)


def icons():
    return '''<link rel="icon" href="/favicon.ico" sizes="any">
<link rel="icon" type="image/png" href="/assets/logo.png">
<link rel="apple-touch-icon" href="/assets/apple-touch-icon.png">
<meta name="referrer" content="strict-origin-when-cross-origin">'''


def stylesheet():
    return f'<link rel="stylesheet" href="styles.css?v={SCRIPT_V["styles.css"]}">'


def json_ld(data, ensure_ascii=True):
    return ('<script type="application/ld+json">'
            + json.dumps(data, separators=(',', ':'), ensure_ascii=ensure_ascii)
            + '</script>')


def nav(home=False, shop=False):
    brand = ' aria-current="page"' if home else ''
    summary = ' aria-current="page"' if shop else ''
    return f'''<header class="site-header">
  <nav class="nav" aria-label="Primary navigation">
    <a class="brand" href="index.html"{brand}><img src="assets/logo-nav-white.png" alt="Habibi Crafts Co" width="213" height="93"></a>
    <div class="nav-end">
      <a class="nav-bag" href="cart.html" aria-label="Bag — checkout isn’t open"><span class="nav-bag-mark"><svg class="nav-bag-icon" viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round" stroke-linecap="round"><path d="M6.4 8h11.2l1.1 12.2A1.2 1.2 0 0 1 17.5 21.5H6.5a1.2 1.2 0 0 1-1.2-1.3L6.4 8z"/><path d="M9 8V6.8A3 3 0 0 1 15 6.8V8"/></svg><span class="nav-bag-badge" hidden>0</span></span><span class="nav-bag-label">Bag</span></a>
      <button class="menu-toggle" type="button" aria-expanded="false" aria-controls="primary-menu" aria-label="Open menu"><span></span></button>
    </div>
    <div class="nav-links" id="primary-menu">
      <a class="nav-mobile-only" href="shop.html">Shop all</a>
      <details class="nav-shop">
        <summary{summary}>Shop</summary>
        <div class="nav-shop-menu">
        <span class="nav-shop-label">In the shop</span>
        <a href="shop.html">All</a>
        <a href="mugs.html">Mugs</a>
        <a href="tees.html">Tees</a>
        <a href="totes.html">Totes</a>
        <a href="onesies.html">Onesies</a>
        <a href="prints.html">Prints</a>
        <a href="stickers.html">Stickers</a>
        <a href="hats.html">Hats</a>
        <span class="nav-shop-label">Coming next</span>
        <a href="sweatshirts.html">Sweatshirts</a>
        <a href="long-sleeves.html">Long sleeves</a>
        <a href="beanies.html">Beanies</a>
        <a href="hoodies.html">Hoodies</a>
        <a href="youth-tees.html">Youth tees</a>
        <a href="coasters.html">Coasters</a>
        <a href="journals.html">Journals</a>
        <a href="aprons.html">Aprons</a>
        </div>
      </details>
      <a href="about.html">About</a>
      <a href="faq.html">FAQ</a>
      <a class="nav-mobile-only" href="shipping.html">Shipping</a>
      <a class="nav-mobile-only" href="contact.html">Contact</a>
    </div>
  </nav>
</header>'''


TRUST = '''<div class="trust-strip" role="note">
  <div class="shell">
    <ul class="trust-chips">
      <li>Made to order</li>
      <li>Ships in the US</li>
      <li><a href="shipping.html">30-day print fix</a></li>
      <li>Small shop</li>
    </ul>
  </div>
</div>'''


FOOTER = '''<footer class="site-footer">
  <div class="footer-grid">
    <div>
      <a class="footer-brand" href="index.html"><img src="assets/logo-nav-white.png" alt="Habibi Crafts Co" width="213" height="93"></a>
      <p class="footer-copy">Our small business. All kinds of crafts.</p>
    </div>
    <div>
      <div class="footer-title">Shop</div>
      <div class="footer-links">
        <a href="shop.html">All</a>
        <a href="mugs.html">Mugs</a>
        <a href="tees.html">Tees</a>
        <a href="totes.html">Totes</a>
        <a href="onesies.html">Onesies</a>
        <a href="prints.html">Prints</a>
        <a href="stickers.html">Stickers</a>
        <a href="hats.html">Hats</a>
      </div>
    </div>
    <div>
      <div class="footer-title">Coming next</div>
      <div class="footer-links">
        <a href="sweatshirts.html">Sweatshirts</a>
        <a href="long-sleeves.html">Long sleeves</a>
        <a href="beanies.html">Beanies</a>
        <a href="hoodies.html">Hoodies</a>
        <a href="youth-tees.html">Youth tees</a>
        <a href="coasters.html">Coasters</a>
        <a href="journals.html">Journals</a>
        <a href="aprons.html">Aprons</a>
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


def filter_bars(current):
    def buttons(links, soon=False):
        bits = []
        for href, label in links:
            cur = ' aria-current="page"' if href == current else ''
            cls = 'filter-button soon' if soon else 'filter-button'
            bits.append(f'<a class="{cls}" href="{href}"{cur}>{label}</a>')
        return ''.join(bits)
    shop = f'<nav class="filter-bar" aria-label="Shop by collection">{buttons(SHOP_LINKS)}</nav>'
    soon = f'<nav class="filter-bar filter-soon" aria-label="Coming next">{buttons(SOON_LINKS, soon=True)}</nav>'
    return shop + soon


def page_open(head_html, home=False, shop=False):
    return '\n'.join([
        head_html,
        '<body>',
        '<a class="skip-link" href="#main">Skip to content</a>',
        nav(home=home, shop=shop),
        TRUST,
    ])


def page_close(main_html, blank_before_footer=False):
    gap = '\n\n' if blank_before_footer else '\n'
    return main_html + '\n</main>' + gap + FOOTER + '\n</body>\n</html>\n'
