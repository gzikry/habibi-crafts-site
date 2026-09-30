#!/usr/bin/env python3
"""
Collect every viewing angle Printful's mockup generator returns for each
staged Habibi Crafts product.

Mug blanks give three angles (Handle on Right, Handle on Left, Front view);
apparel gives front and back. That small set is what powers the angle viewer.

Product spec is read from printful-sync.json (written by sync-printful.py), so
a new product needs no edit here — its catalogue id, variant ids, placement
and print-area size all come from Printful.

Source images: Printful keeps the ORIGINAL uploaded URL in each file's
metadata, and the generator can fetch that. Its own CDN copy 403s for the
generator, so read `meta['url']` rather than building a cdn.printful.com path.

Rate limit: ~1 create-task per 30s, so this paces itself and is resumable.

Run:  python3 fetch-angles.py            # all, skipping done
      python3 fetch-angles.py ya-aini    # one slug
Output: workspace/pf-angles/<slug>/<angle>.png + manifest.json
"""
import json, os, re, sys, time, urllib.error, urllib.request

WS = '/Users/georgezikry/.hermes/profiles/habibicrafts/workspace'
ENV = '/Users/georgezikry/.hermes/profiles/habibicrafts/.env'
OUT = f'{WS}/pf-angles'
STORE = '18687336'
UA = ('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 '
      '(KHTML, like Gecko) Chrome/120.0 Safari/537.36')

# slug: (store_product_id, catalog_product_id, [variant_id], placement, (area_w, area_h))
# Built from printful-spec.json so new products need no edit here.
def load_jobs():
    # printful-spec.json, not printful-sync.json: the latter is the storefront
    # catalogue and carries no catalogue ids or print areas.
    path = f'{WS}/printful-spec.json'
    if not os.path.exists(path):
        raise SystemExit(f'{path} missing — run sync-printful.py --write first')
    spec = json.load(open(path))
    jobs = {}
    for slug, e in spec.items():
        # one representative variant: the same angle set comes back for any
        # size, so asking for every variant just burns rate limit
        jobs[slug] = (e['printful_id'], e['cat_product'],
                      [e.get('mockup_variant') or e['variant_ids'][0]],
                      e['placement'], (e['area_width'], e['area_height']))
    return jobs


JOBS = load_jobs()


def log(m):
    print(m, flush=True)


def token():
    for line in open(ENV):
        if line.startswith('PRINTFUL_API_TOKEN='):
            return line.split('=', 1)[1].strip()
    raise SystemExit('PRINTFUL_API_TOKEN missing')


TOKEN = token()


def pf(method, path, payload=None, retries=5, pace=True):
    for a in range(retries):
        data = json.dumps(payload).encode() if payload else None
        req = urllib.request.Request(f'https://api.printful.com{path}', data=data, method=method)
        req.add_header('Authorization', f'Bearer {TOKEN}')
        req.add_header('X-PF-Store-Id', STORE)
        req.add_header('Content-Type', 'application/json')
        try:
            with urllib.request.urlopen(req, timeout=90) as r:
                out = json.loads(r.read().decode())
            if pace and method == 'POST':
                time.sleep(32)                      # under the create-task limit
            return out
        except urllib.error.HTTPError as e:
            body = e.read().decode()
            if e.code == 429 and a < retries - 1:
                m = re.search(r'after (\d+) seconds', body)
                wait = (int(m.group(1)) + 6) if m else (40 + a * 12)
                log(f'    429 -> sleep {wait}s')
                time.sleep(wait)
                continue
            log(f'    HTTP {e.code}: {body[:160]}')
            return None
        except Exception as e:
            log(f'    ERR {e}')
            time.sleep(8)
    return None


def slugify(s):
    return re.sub(r'-+', '-', re.sub(r'[^a-z0-9]+', '-', (s or '').lower())).strip('-')


def download(url, dest):
    req = urllib.request.Request(url, headers={'User-Agent': UA})
    with urllib.request.urlopen(req, timeout=90) as r:
        data = r.read()
    if data[:4] != b'\x89PNG':
        raise ValueError('not PNG')
    open(dest, 'wb').write(data)
    return len(data)


def source_url(pid, placement):
    """Printful keeps the original upload URL; its own CDN copy 403s the generator."""
    cur = pf('GET', f'/store/products/{pid}', pace=False)['result']
    best = None
    for v in cur['sync_variants']:
        for f in v['files']:
            if f['type'] == 'preview':
                continue
            meta = pf('GET', f"/files/{f['id']}", pace=False)['result']
            if best is None or (meta.get('width') or 0) > (best.get('width') or 0):
                best = meta
    return best.get('url') if best else None


def main():
    os.makedirs(OUT, exist_ok=True)
    mpath = f'{OUT}/manifest.json'
    manifest = json.load(open(mpath)) if os.path.exists(mpath) else {}
    todo = sys.argv[1:] or list(JOBS)

    for slug in todo:
        if slug not in JOBS:
            log(f'{slug:<16} unknown, skip'); continue
        if manifest.get(slug, {}).get('angles'):
            log(f'{slug:<16} done ({len(manifest[slug]["angles"])} frames)'); continue

        pid, cat, variants, placement, (aw, ah) = JOBS[slug]
        src = source_url(pid, placement)
        if not src:
            log(f'{slug:<16} no source url'); continue

        log(f'{slug:<16} requesting angles (cat {cat})')
        r = pf('POST', f'/mockup-generator/create-task/{cat}', {
            'variant_ids': variants, 'format': 'png', 'width': 1200,
            'files': [{'placement': placement, 'image_url': src,
                       'position': {'area_width': aw, 'area_height': ah,
                                    'width': aw, 'height': ah, 'top': 0, 'left': 0}}],
        })
        if not r or not r.get('result'):
            log('    no task'); continue
        key = r['result']['task_key']

        result = None
        for _ in range(30):
            time.sleep(4)
            d = pf('GET', f'/mockup-generator/task?task_key={key}', pace=False)
            st = (d or {}).get('result', {}).get('status')
            if st == 'completed':
                result = d['result']; break
            if st == 'failed':
                log(f'    task failed: {(d or {}).get("result",{}).get("error")}'); break
        if not result:
            log('    no result'); continue

        d = os.path.join(OUT, slug); os.makedirs(d, exist_ok=True)
        angles = []
        seen = set()
        for mk in result.get('mockups', []):
            # Printful's first mockup is the default view. It is NOT always a
            # mug's handle side — for a shirt it is the front — so label it
            # from the product family, not a hardcoded mug term.
            default_title = 'Front view' if cat == 19 else 'Front'
            views = [{'title': default_title, 'url': mk['mockup_url']}]
            views += [{'title': e.get('title') or e.get('option'), 'url': e.get('url')}
                      for e in mk.get('extra', []) if e.get('url')]
            for v in views:
                name = slugify(v['title'])
                # the same view can be returned twice (e.g. two 'Back'
                # entries); keeping both shows a duplicate in the viewer
                if not name or name in seen:
                    continue
                seen.add(name)
                dest = os.path.join(d, f'{name}.png')
                try:
                    n = download(v['url'], dest)
                    angles.append({'angle': v['title'], 'file': f'{slug}/{name}.png', 'bytes': n})
                    log(f'    {v["title"]:<18} {n:>8} B')
                except Exception as e:
                    log(f'    dl fail {v["title"]}: {e}')
        manifest[slug] = {'product_id': pid, 'angles': angles}
        json.dump(manifest, open(mpath, 'w'), indent=2)

    ok = sum(1 for v in manifest.values() if v.get('angles'))
    frames = sum(len(v['angles']) for v in manifest.values())
    log(f'\nDONE — {ok} products, {frames} frames')


if __name__ == '__main__':
    main()
