import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

function read(rel) {
  return readFileSync(join(root, rel), 'utf8');
}

describe('public flags stay off and invent no secrets', () => {
  it('public-config defaults checkout and ads off with an empty publisher id', () => {
    const source = read('site/public-config.js');
    assert.match(source, /CHECKOUT_ENABLED:\s*false/);
    assert.match(source, /ADSENSE_ENABLED:\s*false/);
    assert.match(source, /ADSENSE_PUBLISHER_ID:\s*''/);
    assert.doesNotMatch(source, /ca-pub-\d/);
    assert.doesNotMatch(source, /sk_live_|sk_test_|pk_live_|whsec_/);
  });

  it('ads.txt is a comment placeholder without a publisher id', () => {
    const ads = read('site/ads.txt');
    assert.match(ads, /placeholder/i);
    assert.doesNotMatch(ads, /pub-\d{10,}/);
    assert.doesNotMatch(ads, /ca-pub-\d/);
  });

  it('analytics.js only loads AdSense when both the flag and publisher id are set', () => {
    const source = read('site/analytics.js');
    assert.match(source, /ADSENSE_ENABLED/);
    assert.match(source, /ADSENSE_PUBLISHER_ID/);
    assert.match(source, /pagead2\.googlesyndication\.com/);
    assert.doesNotMatch(source, /ca-pub-\d{10,}/);
  });

  it('.env.example lists every production variable and commits no secrets', () => {
    const example = read('.env.example');
    for (const key of [
      'STRIPE_SECRET_KEY',
      'STRIPE_WEBHOOK_SECRET',
      'STRIPE_PUBLISHABLE_KEY',
      'PRINTFUL_API_TOKEN',
      'PRINTFUL_STORE_ID=18687336',
      'ADSENSE_PUBLISHER_ID',
      'CHECKOUT_ENABLED=false',
      'ADSENSE_ENABLED=false'
    ]) {
      assert.match(example, new RegExp(key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
    }
    assert.doesNotMatch(example, /sk_live_|pk_live_|whsec_[A-Za-z0-9]|ca-pub-\d/);
  });

  it('customer-facing html does not name Printful', () => {
    const privacy = read('site/privacy.html');
    const faq = read('site/faq.html');
    const index = read('site/index.html');
    assert.doesNotMatch(privacy, /Printful/i);
    assert.doesNotMatch(faq, /Printful/i);
    assert.doesNotMatch(index, /Printful/i);
    assert.match(index, /print after you order/i);
  });

  it('product structured data stays OutOfStock while checkout is off', () => {
    const page = read('site/product-ya-aini.html');
    assert.match(page, /schema\.org\/OutOfStock/);
    assert.doesNotMatch(page, /schema\.org\/InStock/);
  });
});
