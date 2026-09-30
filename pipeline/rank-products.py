#!/usr/bin/env python3
"""
Rank products for the front page.

The front page shows the catalogue in an order that will become sales order
once the shop is taking orders. Nothing on the page says why the order is what
it is — it is simply the order products appear in.

Ranking comes from Printful orders:

    GET /orders  ->  items[].sync_variant_id  ->  product  ->  quantity sold

`sync_variant_id` is per size/colour, so units from every variant of a product
are summed. With no orders yet, every product ties at zero and the curated
order in product-catalog.json stands, which is the behaviour we want: the page
looks identical today and starts reordering itself once real orders exist.

Output: workspace/product-rank.json
  {"generated": "...", "orders_seen": N, "ranked": [slug, ...], "units": {}}
"""
import json, os, sys, time, urllib.error, urllib.request
from datetime import datetime, timezone

WS = '/Users/georgezikry/.hermes/profiles/habibicrafts/workspace'
ENV = '/Users/georgezikry/.hermes/profiles/habibicrafts/.env'
SITE = f'{WS}/habibi-crafts-site/site'
STORE = '18687336'
UA = ('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 '
      '(KHTML, like Gecko) Chrome/120.0 Safari/537.36')
OUT = f'{WS}/product-rank.json'


def token():
    for line in open(ENV):
        if line.startswith('PRINTFUL_API_TOKEN='):
            return line.split('=', 1)[1].strip()
    raise SystemExit('PRINTFUL_API_TOKEN missing in profile .env')


TOKEN = token()


def pf(path, retries=3):
    for a in range(retries):
        req = urllib.request.Request(f'https://api.printful.com{path}')
        req.add_header('Authorization', f'Bearer {TOKEN}')
        req.add_header('X-PF-Store-Id', STORE)
        req.add_header('User-Agent', UA)
        try:
            with urllib.request.urlopen(req, timeout=45) as r:
                return json.loads(r.read().decode())
        except urllib.error.HTTPError as e:
            if e.code == 429 and a < retries - 1:
                time.sleep(15 + a * 10)
                continue
            return {'__error': e.code, '__body': e.read().decode()[:200]}
        except Exception:
            time.sleep(4)
    return {'__error': 'unreachable'}


def sync_variant_map():
    """sync_variant_id -> product slug, so order lines can be attributed."""
    listing = pf('/store/products?limit=100')
    if '__error' in listing:
        raise SystemExit(f'cannot list products: {listing}')
    catalog = {e['printful_id']: e['slug']
               for e in json.load(open(f'{SITE}/product-catalog.json'))}
    out = {}
    for sp in listing['result']:
        slug = catalog.get(sp['id'])
        if not slug:
            continue
        d = pf(f'/store/products/{sp["id"]}')
        if '__error' in d:
            continue
        for v in d['result']['sync_variants']:
            out[v['id']] = slug
    return out


def main():
    catalog = json.load(open(f'{SITE}/product-catalog.json'))
    curated = [e['slug'] for e in catalog]

    try:
        vmap = sync_variant_map()
    except SystemExit as e:
        print(f'warning: {e}; falling back to curated order', file=sys.stderr)
        vmap = {}

    units = {s: 0 for s in curated}
    orders_seen = 0

    d = pf('/orders?limit=100')
    if '__error' in d:
        print(f'warning: GET /orders -> {d.get("__error")}; using curated order')
    else:
        orders_seen = len(d.get('result') or [])
        for o in d.get('result') or []:
            # only count orders that actually went through
            if (o.get('status') or '').lower() in ('draft', 'failed', 'canceled', 'cancelled'):
                continue
            detail = pf(f'/orders/{o["id"]}')
            if '__error' in detail:
                continue
            for item in detail['result'].get('items', []):
                slug = vmap.get(item.get('sync_variant_id'))
                if slug:
                    units[slug] = units.get(slug, 0) + (item.get('quantity') or 0)

    # Most units first; ties keep the curated order, so with no sales the page
    # is byte-identical to what it was before this existed.
    ranked = sorted(curated, key=lambda s: (-units.get(s, 0), curated.index(s)))

    payload = {
        'generated': datetime.now(timezone.utc).isoformat(timespec='seconds'),
        'orders_seen': orders_seen,
        'ranked': ranked,
        'units': {s: units.get(s, 0) for s in curated},
    }
    json.dump(payload, open(OUT, 'w'), indent=2)

    sold = {s: units.get(s, 0) for s in curated if units.get(s, 0)}
    print(f'{orders_seen} order(s) seen; {sum(sold.values())} units attributable')
    if sold:
        for slug, n in sorted(sold.items(), key=lambda kv: -kv[1]):
            print(f'  {slug:<16} {n}')
    else:
        print('no sales yet — curated order stands')
    print(f'rank: {", ".join(ranked[:6])}{" ..." if len(ranked) > 6 else ""}')
    print(f'wrote {OUT}')


if __name__ == '__main__':
    main()
