import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const OPEN = [
  'halawa',
  'early-light',
  'ya-aini',
  'baladi',
  'khalas-habibi',
  'ya-teta',
  'beit-el-hobb'
];

const RUNNER = `
import json, os, sys
from pathlib import Path

os.environ['PRINTFUL_API_TOKEN'] = 'stub'
import urllib.request

CAT = {'mugs': 19, 'tees': 71, 'totes': 367, 'baby': 308, 'prints': 1}

def main():
    mode = sys.argv[1]
    tree = Path(os.environ['HABIBI_ROOT'])
    catalog = json.loads((tree / 'site' / 'product-catalog.json').read_text())
    listing = []
    routes = {}
    for i, product in enumerate(catalog):
        pid = product.get('printful_id')
        if not isinstance(pid, int):
            continue
        listing.append({'id': pid, 'name': product['name']})
        vid = 700000 + i
        cents = int(product['price'])
        routes[f'/store/products/{pid}'] = {'result': {'sync_variants': [{
            'variant_id': vid,
            'retail_price': f'{cents // 100}.{cents % 100:02d}',
            'name': 'Default',
            'files': [{
                'type': 'default',
                'filename': product['slug'] + '.png',
                'width': 2400,
                'height': 2400,
            }],
        }]}}
        routes[f'/products/variant/{vid}'] = {
            'result': {'variant': {'product_id': CAT[product['category']]}}
        }
    if mode == 'add':
        pid = 999001
        vid = 799001
        listing.append({'id': pid, 'name': 'QA Extra'})
        routes[f'/store/products/{pid}'] = {'result': {'sync_variants': [{
            'variant_id': vid,
            'retail_price': '14.99',
            'name': 'Default',
            'files': [{
                'type': 'default',
                'filename': 'qa-extra.png',
                'width': 2400,
                'height': 2400,
            }],
        }]}}
        routes[f'/products/variant/{vid}'] = {'result': {'variant': {'product_id': 19}}}
    routes['/store/products?limit=100'] = {'result': listing}

    class Resp:
        def __init__(self, payload):
            self.payload = json.dumps(payload).encode()
        def read(self):
            return self.payload
        def __enter__(self):
            return self
        def __exit__(self, *args):
            return False

    def urlopen(req, timeout=60):
        path = req.full_url.split('api.printful.com', 1)[1]
        if path in routes:
            return Resp(routes[path])
        if path.startswith('/mockup-generator/'):
            return Resp({'__error': 'stub', '__body': 'stub'})
        raise SystemExit('unexpected Printful path ' + path)

    urllib.request.urlopen = urlopen
    import importlib.util
    sys.path.insert(0, os.path.join(os.environ['HABIBI_REPO'], 'pipeline'))
    path = os.path.join(os.environ['HABIBI_REPO'], 'pipeline', 'sync-printful.py')
    spec = importlib.util.spec_from_file_location('sync_printful', path)
    sync_printful = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(sync_printful)
    if mode == 'add':
        sync_printful.PUBLISHED = set(sync_printful.PUBLISHED) | {'qa-extra'}
    sys.argv = ['sync-printful.py', '--write']
    return sync_printful.main()

if __name__ == '__main__':
    raise SystemExit(main())
`;

function read(path) {
  return readFileSync(path, 'utf8');
}

function catalog(dir) {
  return JSON.parse(read(join(dir, 'site/product-catalog.json')));
}

function tree() {
  const dir = mkdtempSync(join(tmpdir(), 'habibi-sync-'));
  execFileSync('mkdir', ['-p', join(dir, 'pipeline'), join(dir, 'api/lib'), join(dir, 'site')]);
  execFileSync('cp', [join(root, 'site/product-catalog.json'), join(dir, 'site/product-catalog.json')]);
  execFileSync('cp', [join(root, 'site/public-config.js'), join(dir, 'site/public-config.js')]);
  execFileSync('cp', [join(root, 'pipeline/frame-snapshot.json'), join(dir, 'pipeline/frame-snapshot.json')]);
  execFileSync('cp', [join(root, 'api/lib/catalog.js'), join(dir, 'api/lib/catalog.js')]);
  return dir;
}

function offEnv(dir) {
  const env = { ...process.env, HABIBI_ROOT: dir, HABIBI_REPO: root, PRINTFUL_API_TOKEN: 'stub' };
  delete env.HABIBI_PREVIEW;
  delete env.CHECKOUT_ENABLED;
  delete env.CF_PAGES;
  delete env.CF_PAGES_BRANCH;
  return env;
}

function sync(dir, mode) {
  const runner = join(dir, 'run_sync.py');
  writeFileSync(runner, RUNNER);
  return execFileSync('python3', [runner, mode], {
    cwd: root,
    env: offEnv(dir),
    encoding: 'utf8'
  });
}

function build(dir, out, env) {
  execFileSync('python3', ['pipeline/build-products.py', '--out', out], {
    cwd: root,
    env
  });
}

function openCheckout(dir) {
  const configPath = join(dir, 'site/public-config.js');
  const original = read(configPath);
  writeFileSync(
    configPath,
    original
      .replace('CHECKOUT_ENABLED: false', 'CHECKOUT_ENABLED: true')
      .replace('HABIBI_CHECKOUT_ENABLED = false', 'HABIBI_CHECKOUT_ENABLED = true')
  );
  return original;
}

describe('catalog sync', () => {
  it('keeps closed_purchasable through a stubbed sync and leaves hat and sticker rows unchanged', () => {
    const dir = tree();
    const before = catalog(dir);
    const output = sync(dir, 'keep');
    const after = catalog(dir);
    assert.match(output, /warning: habibi-crafts-hat has no printful_id; left unchanged/);
    assert.match(output, /warning: craft-club-sticker has no printful_id; left unchanged/);
    assert.equal(after.length, before.length);
    for (const product of before) {
      const kept = after.find((entry) => entry.slug === product.slug);
      assert.equal(kept.closed_purchasable, product.closed_purchasable, product.slug);
      if (!Object.hasOwn(product, 'printful_id')) {
        assert.deepEqual(kept, product);
      }
    }
  });

  it('adds a product with no prior keys, then a go-live build still rolls back closed', () => {
    const dir = tree();
    const before = catalog(dir);
    sync(dir, 'add');
    const synced = catalog(dir);
    const added = synced.find((product) => product.slug === 'qa-extra');
    assert.ok(added);
    assert.equal(added.purchasable, false);
    assert.equal(added.closed_purchasable, false);
    assert.equal(before.some((product) => product.slug === 'qa-extra'), false);
    for (const product of before) {
      const kept = synced.find((entry) => entry.slug === product.slug);
      assert.equal(kept.closed_purchasable, product.closed_purchasable, product.slug);
      assert.equal(kept.description, product.description, product.slug);
    }

    const env = offEnv(dir);
    const off1 = join(dir, 'off1');
    const off2 = join(dir, 'off2');
    build(dir, off1, env);
    const originalConfig = openCheckout(dir);
    build(dir, join(dir, 'site'), env);
    const live = catalog(dir);
    assert.deepEqual(
      live.filter((product) => product.purchasable === true).map((product) => product.slug).sort(),
      [...OPEN].sort()
    );
    assert.equal(live.find((product) => product.slug === 'qa-extra').purchasable, false);
    assert.equal(live.find((product) => product.slug === 'qa-extra').closed_purchasable, false);
    writeFileSync(join(dir, 'site/public-config.js'), originalConfig);
    build(dir, off2, env);
    const first = JSON.parse(read(join(off1, 'product-catalog.json')));
    const second = JSON.parse(read(join(off2, 'product-catalog.json')));
    assert.deepEqual(second, first);
    const closed = second.find((product) => product.slug === 'qa-extra');
    assert.equal(closed.purchasable, false);
    assert.equal(closed.closed_purchasable, false);
    assert.doesNotMatch(read(join(off2, 'product-qa-extra.html')), /Add to bag/);
    for (const product of before) {
      const kept = second.find((entry) => entry.slug === product.slug);
      assert.equal(kept.purchasable, product.closed_purchasable, product.slug);
      assert.equal(kept.description, product.description, product.slug);
    }
  });

  it('keeps a product closed when closed_purchasable is missing, even with no purchasable key', () => {
    const dir = tree();
    const products = catalog(dir);
    const jiran = products.find((product) => product.slug === 'jiran');
    const starlight = products.find((product) => product.slug === 'starlight');
    jiran.purchasable = true;
    delete jiran.closed_purchasable;
    delete starlight.purchasable;
    delete starlight.closed_purchasable;
    writeFileSync(join(dir, 'site/product-catalog.json'), `${JSON.stringify(products, null, 2)}\n`);
    const env = offEnv(dir);
    const off1 = join(dir, 'off1');
    const off2 = join(dir, 'off2');
    build(dir, off1, env);
    const first = JSON.parse(read(join(off1, 'product-catalog.json')));
    assert.equal(first.find((product) => product.slug === 'jiran').purchasable, false);
    assert.equal(Object.hasOwn(first.find((product) => product.slug === 'jiran'), 'closed_purchasable'), false);
    assert.equal(first.find((product) => product.slug === 'starlight').purchasable, false);
    const originalConfig = openCheckout(dir);
    build(dir, join(dir, 'site'), env);
    const live = catalog(dir);
    assert.equal(live.find((product) => product.slug === 'jiran').purchasable, false);
    assert.equal(live.find((product) => product.slug === 'starlight').purchasable, false);
    assert.equal(live.filter((product) => product.purchasable === true).length, OPEN.length);
    writeFileSync(join(dir, 'site/public-config.js'), originalConfig);
    build(dir, off2, env);
    assert.deepEqual(
      JSON.parse(read(join(off2, 'product-catalog.json'))),
      first
    );
  });
});
