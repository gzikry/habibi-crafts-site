import json
import os
import re

from root import money, site_dir

CENTS_BY_CATEGORY = {
    'mugs': 1499,
    'tees': 2499,
    'totes': 3199,
    'baby': 2799,
    'prints': 2399,
    'stickers': 599,
    'hats': 2999,
}

TOTE_SYNC_IDS = {
    'gather-grow': 476520279,
    'early-light': 476520353,
    'sit-el-kul': 476520375,
    'halawa': 476520396,
}

PURCHASABLE = {
    'ya-aini', 'baladi', 'ya-dunia', 'jiran', 'maamoul', 'knafeh-club',
    'khalas-habibi', 'ya-habayeb',
    'halawa', 'sit-el-kul', 'early-light', 'gather-grow',
    'ya-teta', 'amoura',
    'beit-el-hobb', 'dar-el-hawa',
}

WHOLE_DOLLAR_TO_CENTS = (
    (18, '14.99'),
    (32, '24.99'),
    (34, '31.99'),
    (28, '27.99'),
    (30, '29.99'),
    (24, '23.99'),
    (6, '5.99'),
)


def display_prices():
    rules = []
    for old, label in WHOLE_DOLLAR_TO_CENTS:
        rules.append((re.compile(r'\$' + str(old) + r'(?!\.\d)'), '$' + label))
    return rules

OFFER_PRICES = [
    ('"18.00"', '"14.99"'),
    ('"32.00"', '"24.99"'),
    ('"34.00"', '"31.99"'),
    ('"28.00"', '"27.99"'),
    ('"24.00"', '"23.99"'),
    ('"6.00"', '"5.99"'),
    ('"30.00"', '"29.99"'),
]

SHIPPING_TAILS = [
    ('Shipping will be calculated when checkout opens.',
     'Free US shipping on orders $39 and up. $6.99 flat below that.'),
    ('Shipping is added at checkout.',
     'Free US shipping on orders $39 and up. $6.99 flat below that.'),
    ('Prices include the piece; shipping will be added when checkout opens.',
     'Free US shipping on orders $39 and up. $6.99 flat below that.'),
    ('Calculated at checkout based on what\'s in the order and where it\'s going. Multiple pieces in one order ship together.',
     'Free US shipping on orders $39 and up. $6.99 flat below that. Multiple pieces in one order ship together.'),
]

BUTTON = re.compile(
    r'<div class="actions"><button class="button browse-mode" type="button" disabled data-checkout '
    r'data-product-slug="([^"]+)" aria-disabled="true">Browsing only · Checkout opens soon</button></div>'
)


def apply_display(text):
    for pattern, replacement in display_prices():
        text = pattern.sub(replacement, text)
    for old, new in OFFER_PRICES:
        text = text.replace(old, new)
    for old, new in SHIPPING_TAILS:
        text = text.replace(old, new)
    return text


def tote_copy(text, filename):
    if filename in {
        'product-halawa.html', 'product-sit-el-kul.html',
        'product-early-light.html', 'product-gather-grow.html',
    }:
        text = text.replace('Cotton tote.', 'Organic cotton tote, Oyster.')
        text = text.replace('Cotton · one size', 'Organic cotton · Oyster · one size')
        text = text.replace(
            '<div><dt>Material</dt><dd>Cotton</dd></div>',
            '<div><dt>Material</dt><dd>Organic cotton</dd></div><div><dt>Color</dt><dd>Oyster</dd></div>',
        )
    if filename == 'totes.html':
        text = text.replace('Cotton, one size.', 'Organic cotton, Oyster, one size.')
    if filename == 'shop.html':
        text = text.replace('One size, cotton.', 'Organic cotton, Oyster, one size.')
    for slug in TOTE_SYNC_IDS:
        text = re.sub(
            rf'(assets/mockups/{slug}\.png\?v=)\d+',
            r'\g<1>12',
            text,
        )
        text = re.sub(
            rf'(assets/angles/{slug}/handle-on-right\.png\?v=)\d+',
            r'\g<1>12',
            text,
        )
    return text


def buy_button(match):
    slug = match.group(1)
    if slug not in PURCHASABLE:
        return match.group(0)
    cents = {
        'ya-aini': 1499, 'baladi': 1499, 'ya-dunia': 1499, 'jiran': 1499,
        'maamoul': 1499, 'knafeh-club': 1499,
        'khalas-habibi': 2499, 'ya-habayeb': 2499,
        'halawa': 3199, 'sit-el-kul': 3199, 'early-light': 3199, 'gather-grow': 3199,
        'ya-teta': 2799, 'amoura': 2799,
        'beit-el-hobb': 2399, 'dar-el-hawa': 2399,
    }[slug]
    return (
        f'<div class="actions"><button class="button" type="button" data-add-to-bag '
        f'data-product-slug="{slug}" data-price-cents="{cents}">Add to bag</button></div>'
    )


def patch_catalog_js(path):
    text = open(path).read()
    for old, label in WHOLE_DOLLAR_TO_CENTS:
        cents = int(label.replace('.', ''))
        text = text.replace(f'price: {old},', f'price: {cents},')
        text = text.replace(f'priceLabel: "${old}"', f'priceLabel: "${label}"')
    text = text.replace('Cotton · One size', 'Organic cotton · Oyster')
    text = text.replace('note: "Cotton tote."', 'note: "Organic cotton tote, Oyster."')
    text = text.replace('blurb: "Cotton tote."', 'blurb: "Organic cotton tote, Oyster."')
    open(path, 'w').write(text)


def patch_product_catalog(path):
    with open(path) as handle:
        catalog = json.load(handle)
    for entry in catalog:
        entry['price'] = CENTS_BY_CATEGORY[entry['category']]
        if entry['slug'] in TOTE_SYNC_IDS:
            entry['printful_id'] = TOTE_SYNC_IDS[entry['slug']]
            entry['subtitle'] = 'Organic cotton tote, Oyster.'
    with open(path, 'w') as handle:
        json.dump(catalog, handle, indent=2)
        handle.write('\n')


def apply_launch_copy(site=None):
    site = site or site_dir()
    patch_product_catalog(os.path.join(site, 'product-catalog.json'))
    patch_catalog_js(os.path.join(site, 'catalog.js'))
    for name in sorted(os.listdir(site)):
        if not name.endswith('.html'):
            continue
        path = os.path.join(site, name)
        text = open(path).read()
        updated = tote_copy(BUTTON.sub(buy_button, apply_display(text)), name)
        if updated != text:
            open(path, 'w').write(updated)
    print(f'launch prices applied under {site}. example {money(2499)}')


if __name__ == '__main__':
    apply_launch_copy()
