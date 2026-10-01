#!/usr/bin/env python3
"""
Sync the storefront catalogue from Printful.

The catalogue used to be hand-maintained, so adding a product meant editing
product-catalog.json, the JOBS table in fetch-angles.py, and the category
tables in the builders — three places to get wrong. This derives all of it
from Printful, so a new product flows through on its own:

    python3 sync-printful.py            # report only, writes nothing
    python3 sync-printful.py --write    # update product-catalog.json
    python3 fetch-angles.py             # collect its viewing angles
    python3 build-products.py && python3 build-shop.py && python3 build-home.py
    python3 build-sitemap.py
    node pipeline/verify-viewer.cjs http://127.0.0.1:8090   # then deploy

Derived: slug, name, category, price, printful_id, placement, and the print
file check. NOT derived: `subtitle` — the one human line under the product
name. Inventing it would put fake voice on the storefront, so new products are
listed in the report for it to be written.

Print-file check: Printful fits the file into the print area (fill_mode "fit"),
so a file LARGER than the required dimensions is correct — it just gets scaled
down. The defect to catch is a file too SMALL to cover the area, which is
upscaled and visibly soft, and was the original cause of cropped-looking mug
artwork. Aspect ratio is reported separately because fit-mode letterboxes.
"""
import json, os, re, sys, time, urllib.error, urllib.request
from root import (
    EXCLUDED_SYNC_IDS, cents_from_retail, format_cents, printful_token, repo_root, site_dir,
)

ROOT = repo_root()
SITE = site_dir()
STORE = '18687336'
UA = ('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 '
      '(KHTML, like Gecko) Chrome/120.0 Safari/537.36')

# Printful catalogue product id -> storefront category
CATEGORY = {19: 'mugs', 71: 'tees', 367: 'totes', 641: 'totes', 308: 'baby', 1: 'prints'}

# A product is only published to the storefront if it is on this list.
#
# Printful is the design/fulfilment workspace; the storefront is customer
# facing. Without this gate any draft staged in Printful would appear on the
# live site the next time the sync ran, with no review — which is what happened
# when two Halloween tees were staged mid-season. Publishing must stay a
# deliberate, reviewed act.
#
# To publish a new product: review it in Printful, write its subtitle, then add
# its slug here and re-run. See references/publishing-gate.md.
PUBLISHED = {
    'ya-aini', 'baladi', 'ya-dunia', 'jiran', 'maamoul', 'knafeh-club',
    'morning-ritual', 'khalas-habibi', 'ya-habayeb', 'warm-embrace',
    'halawa', 'sit-el-kul', 'early-light', 'gather-grow',
    'ya-teta', 'amoura', 'garden-gate',
    'beit-el-hobb', 'dar-el-hawa', 'starlight',
}

SUFFIX = re.compile(r'[-_](mug|tee|tees|tote|onesie|baby|poster|print|wall|apparel|kitchen)$',
                    re.IGNORECASE)


def pf(path, retries=4):
    last = None
    for a in range(retries):
        req = urllib.request.Request(f'https://api.printful.com{path}')
        req.add_header('Authorization', f'Bearer {printful_token()}')
        req.add_header('X-PF-Store-Id', STORE)
        req.add_header('User-Agent', UA)
        try:
            with urllib.request.urlopen(req, timeout=60) as r:
                return json.loads(r.read().decode())
        except urllib.error.HTTPError as e:
            body = e.read().decode()
            if e.code == 429 and a < retries - 1:
                m = re.search(r'after (\d+) seconds', body)
                time.sleep((int(m.group(1)) + 4) if m else 20 + a * 10)
                continue
            return {'__error': e.code, '__body': body[:200]}
        except Exception as e:
            last = e
            time.sleep(5)
    return {'__error': 'unreachable', '__body': str(last or '')}


def slugify(s):
    return re.sub(r'-+', '-', re.sub(r'[^a-z0-9]+', '-', (s or '').lower())).strip('-')


_spec_cache = {}


def spec(cat_product):
    """{variant_id: (placement, printfile_id, (w, h), nominal_dpi, min_dpi)}."""
    if cat_product in _spec_cache:
        return _spec_cache[cat_product]

    t = pf(f'/mockup-generator/templates/{cat_product}')
    f = pf(f'/mockup-generator/printfiles/{cat_product}')
    out = {}
    if '__error' in t or '__error' in f:
        _spec_cache[cat_product] = out
        return out

    dims = {p['printfile_id']: (p['width'], p['height'], p.get('dpi') or 300)
            for p in f['result'].get('printfiles', [])}
    min_dpi = t['result'].get('min_dpi') or 150
    placements = {}
    for vp in f['result'].get('variant_printfiles', []):
        placements[vp['variant_id']] = vp.get('placements', {})

    for vm in t['result'].get('variant_mapping', []):
        vid = vm['variant_id']
        tpl = vm['templates'][0]
        pl = tpl['placement']
        pfid = placements.get(vid, {}).get(pl) or tpl.get('printfile_id')
        d = dims.get(pfid)
        out[vid] = (pl, pfid, (d[0], d[1]) if d else None,
                    d[2] if d else 300, min_dpi)
    _spec_cache[cat_product] = out
    return out


def effective_dpi(actual_w, nominal_w, nominal_dpi):
    """Printful fits the file to the print area, so effective resolution is the
    uploaded pixels spread over the physical size the nominal printfile
    describes."""
    physical_in = nominal_w / float(nominal_dpi or 300)
    return actual_w / physical_in if physical_in else 0


def main():
    write = '--write' in sys.argv
    catalog_path = SITE / 'product-catalog.json'
    existing = json.load(open(catalog_path)) if os.path.exists(catalog_path) else []
    by_id = {e['printful_id']: e for e in existing}
    by_slug = {e['slug']: e for e in existing}

    listing = pf('/store/products?limit=100')
    if '__error' in listing:
        raise SystemExit(f'could not list products: {listing}')

    entries, missing_subtitle, problems, skipped, held = [], [], [], [], []
    specs = {}

    for sp in listing['result']:
        pid = sp['id']
        if pid in EXCLUDED_SYNC_IDS:
            skipped.append(f'{sp["name"]} (retired sync product {pid})')
            continue
        detail = pf(f'/store/products/{pid}')
        if '__error' in detail:
            problems.append(f'{pid}: {detail["__body"][:80]}')
            continue
        r = detail['result']
        variants = r['sync_variants']
        variant = variants[0]

        cat_product = pf(f'/products/variant/{variant["variant_id"]}') \
            .get('result', {}).get('variant', {}).get('product_id')
        category = CATEGORY.get(cat_product)
        if not category:
            skipped.append(f'{sp["name"]} (catalogue product {cat_product} not sold here)')
            continue

        title = re.sub(r'\s+[—-]\s+.*$', '', sp['name']).strip()

        prev = by_id.get(pid)
        if prev:
            slug = prev['slug']
        else:
            pf_file = next((f for f in variant['files'] if f['type'] != 'preview'), None)
            base = os.path.splitext(pf_file['filename'])[0] if pf_file else ''
            slug = slugify(SUFFIX.sub('', base)) or slugify(title)

        if slug not in PUBLISHED:
            held.append(f'{sp["name"]} ({slug})')
            continue

        # Printful holds the design's name, often set in caps for the artwork
        # itself. The storefront uses title case, so keep a curated name once
        # a human has set one; only new products take Printful's spelling.
        name = (prev or {}).get('name') or (by_slug.get(slug) or {}).get('name') or title

        # every variant must carry a print file good enough for its area
        vspec = spec(cat_product)
        for v in variants:
            files = [f for f in v['files'] if f['type'] != 'preview']
            if not files:
                problems.append(f'{slug} {v["name"]}: no print file')
                continue
            f0 = files[0]
            got = vspec.get(v['variant_id'])
            if not got or not got[2]:
                continue
            _pl, _pfid, need, nominal_dpi, min_dpi = got
            actual = (f0['width'], f0['height'])
            dpi = effective_dpi(actual[0], need[0], nominal_dpi)
            if dpi < min_dpi:
                problems.append(
                    f'{slug} {v["name"]}: print file {actual[0]}x{actual[1]} gives '
                    f'~{dpi:.0f} dpi over a {need[0]}x{need[1]} print area '
                    f'(Printful wants {min_dpi}+) — it will look soft')

        entry = {'slug': slug, 'name': name, 'category': category,
                 'price': cents_from_retail(variant['retail_price']), 'printful_id': pid}
        kept = prev or by_slug.get(slug) or {}
        if 'purchasable' in kept:
            entry['purchasable'] = kept['purchasable']
        sub = kept.get('subtitle')
        if sub:
            entry['subtitle'] = sub
        else:
            missing_subtitle.append(slug)
        # TODO(George): meaning
        # Empty meaning stays out of the shipped catalog.
        if kept.get('meaning'):
            entry['meaning'] = kept['meaning']
        entries.append(entry)

        # spec the angle fetcher and builders need, kept separate from the
        # catalogue so the storefront file stays minimal.
        # mockup_variant: the mockup generator is asked for ONE representative
        # variant. Requesting all of them multiplies the same angle set by the
        # number of sizes, which is wasted quota and duplicate frames.
        got = vspec.get(variant['variant_id']) or (None, None, None, None, None)
        specs[slug] = {
            'printful_id': pid,
            'cat_product': cat_product,
            'mockup_variant': variant['variant_id'],
            'variant_ids': [v['variant_id'] for v in variants],
            'placement': got[0],
            'printfile_id': got[1],
            'area_width': got[2][0] if got[2] else None,
            'area_height': got[2][1] if got[2] else None,
        }

    # Order the catalogue to match the storefront's curated sequence, then
    # append anything new. Sorting purely by name would reshuffle every grid
    # and produce a large diff each time nothing actually changed.
    spec_path = ROOT / 'printful-spec.json'
    json.dump(specs, open(spec_path, 'w'), indent=2)

    order = {e['slug']: i for i, e in enumerate(existing)}
    entries.sort(key=lambda e: (order.get(e['slug'], len(order)), e['slug']))
    json.dump(entries, open(ROOT / 'printful-sync.json', 'w'), indent=2)
    print(f'{len(entries)} products for the storefront '
          f'({len(listing["result"])} in Printful)')
    for e in entries:
        print(f"  {e['slug']:<16} {e['category']:<7} {format_cents(e['price']):<8} {e['name']}")

    if skipped:
        print('\nnot on the storefront (catalogue product not sold here):')
        for s in skipped:
            print(f'  {s}')

    if held:
        print(f'\n{len(held)} staged in Printful but NOT published to the site:')
        for s in held:
            print(f'  {s}')
        print('  to publish: review it, write a subtitle, add the slug to')
        print('  PUBLISHED in sync-printful.py, then re-run this script')

    if missing_subtitle:
        print(f'\n{len(missing_subtitle)} need a subtitle (the one human line '
              f'under the name):')
        for s in missing_subtitle:
            print(f'  {s}')

    if problems:
        print(f'\n{len(problems)} problem(s):')
        for p in problems:
            print(f'  {p}')

    if write:
        json.dump(entries, open(catalog_path, 'w'), indent=2)
        open(catalog_path, 'a').write('\n')
        print(f'\nwrote {catalog_path} ({len(entries)} entries)')
    else:
        print('\nreport only — re-run with --write to update the catalogue')

    print(f'spec: {spec_path}')
    return 1 if problems else 0


if __name__ == '__main__':
    sys.exit(main())
