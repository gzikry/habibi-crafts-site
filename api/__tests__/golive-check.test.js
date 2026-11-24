import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { execFile, spawnSync } from 'node:child_process';
import { createServer } from 'node:http';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const SALE = [
  'halawa',
  'early-light',
  'ya-aini',
  'baladi',
  'khalas-habibi',
  'ya-teta',
  'beit-el-hobb'
];

function run(dir, live = false) {
  const args = ['scripts/golive-check', dir];
  if (live) args.push('--live');
  return spawnSync('python3', args, { cwd: root, encoding: 'utf8' });
}

function readyDir({ halawaPurchasable = true, halawaBag = true, closed = false } = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'habibi-golive-'));
  const catalog = SALE.map((slug) => ({
    slug,
    purchasable: slug === 'halawa' ? halawaPurchasable : true
  }));
  writeFileSync(join(dir, 'product-catalog.json'), `${JSON.stringify(catalog, null, 2)}\n`);
  for (const slug of SALE) {
    const bag = slug === 'halawa' && !halawaBag ? 'Coming soon' : 'Add to bag';
    writeFileSync(join(dir, `product-${slug}.html`), `<button>${bag}</button>`);
  }
  const copy = closed
    ? 'When we start taking orders, a tracking note will come after the carrier scans your parcel.'
    : 'Check out';
  writeFileSync(join(dir, 'tracking.html'), `<p>${copy}</p>`);
  writeFileSync(join(dir, 'public-config.js'), [
    'window.HABIBI_PUBLIC_CONFIG = {',
    '  CHECKOUT_ENABLED: true,',
    "  STRIPE_PUBLISHABLE_KEY: 'pk_test_example',",
    "  CHECKOUT_API_BASE: 'https://preview.example'",
    '};'
  ].join('\n'));
  return dir;
}

describe('golive check', () => {
  it('fails on restored closed copy without calling the network', () => {
    const result = run(readyDir({ closed: true }));
    assert.equal(result.status, 1);
    assert.match(result.stdout, /When we start taking orders/);
    assert.match(result.stdout, /offline: not calling the API/);
    assert.doesNotMatch(result.stdout, /requires a pk_ publishable key/);
  });

  it('fails on a bare FAQ answer and an Opening soon button in other markup', () => {
    const dir = readyDir();
    writeFileSync(join(dir, 'faq.html'), '<p>We\'re not taking orders yet.</p>');
    writeFileSync(join(dir, 'cart.html'), '<button class="button browse-mode" disabled>Opening soon</button>');
    writeFileSync(join(dir, 'shipping.html'), '<p>Opening\nsoon</p>');
    const result = run(dir);
    assert.equal(result.status, 1);
    assert.match(result.stdout, /We're not taking orders yet/);
    assert.match(result.stdout, /Opening soon/);
    assert.match(result.stdout, /shipping\.html/);
  });

  it('prints the key reminder only when the key or base is missing', () => {
    const dir = readyDir();
    writeFileSync(join(dir, 'public-config.js'), [
      'window.HABIBI_PUBLIC_CONFIG = {',
      '  CHECKOUT_ENABLED: true,',
      "  STRIPE_PUBLISHABLE_KEY: '',",
      "  CHECKOUT_API_BASE: ''",
      '};'
    ].join('\n'));
    const result = run(dir);
    assert.equal(result.status, 1);
    assert.match(result.stdout, /requires a pk_ publishable key and an https CHECKOUT_API_BASE/);
    assert.match(result.stdout, /publishable key is missing/);
    assert.match(result.stdout, /API base is missing/);
  });

  it('fails when halawa is not purchasable in the build catalog', () => {
    const result = run(readyDir({ halawaPurchasable: false }));
    assert.equal(result.status, 1);
    assert.match(result.stdout, /halawa is not purchasable:true in the build catalog/);
  });

  it('fails when the halawa PDP has no Add to bag', () => {
    const result = run(readyDir({ halawaBag: false }));
    assert.equal(result.status, 1);
    assert.match(result.stdout, /halawa PDP is missing Add to bag/);
  });

  it('passes offline, and --live hits the health URL', async () => {
    const dir = readyDir();
    const offline = run(dir);
    assert.equal(offline.status, 0, `${offline.stdout}\n${offline.stderr}`);
    assert.match(offline.stdout, /publishable key and API base are set/);
    assert.match(offline.stdout, /offline: not calling the API/);
    const server = createServer((req, res) => {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end('{"status":"ok"}');
    });
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    const port = server.address().port;
    writeFileSync(join(dir, 'public-config.js'), [
      'window.HABIBI_PUBLIC_CONFIG = {',
      '  CHECKOUT_ENABLED: true,',
      "  STRIPE_PUBLISHABLE_KEY: 'pk_test_example',",
      `  CHECKOUT_API_BASE: 'http://127.0.0.1:${port}'`,
      '};'
    ].join('\n'));
    try {
      const live = await new Promise((resolve) => {
        execFile('python3', ['scripts/golive-check', dir, '--live'], { cwd: root }, (error, stdout, stderr) => {
          resolve({ status: error && error.code ? error.code : 0, stdout, stderr });
        });
      });
      assert.equal(live.status, 0, `${live.stdout}\n${live.stderr}`);
      assert.match(live.stdout, /live: GET http:\/\/127\.0\.0\.1:/);
    } finally {
      await new Promise((resolve) => server.close(resolve));
    }
  });
});
