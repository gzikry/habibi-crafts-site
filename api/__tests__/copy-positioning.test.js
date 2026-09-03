import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

function read(rel) {
  return readFileSync(join(root, rel), 'utf8');
}

function publicHtml() {
  return readdirSync(join(root, 'site'))
    .filter((name) => name.endsWith('.html'))
    .map((name) => read(`site/${name}`))
    .join('\n');
}

const STALE_POSITIONING = [
  /arabic-inspired/i,
  /arabic-only/i,
  /arabic phrases/i,
  /arabic gifts/i,
  /Baby Habibis/,
  /phrases we say at home/i,
  /phrases heard at home/i
];

describe('public copy is not Arabic-only', () => {
  it('active html, metadata, and generator drop stale Arabic-inspired positioning', () => {
    const corpus = [publicHtml(), read('scripts/build-storefront.py'), read('site/catalog.js')].join('\n');
    for (const pattern of STALE_POSITIONING) {
      assert.doesNotMatch(corpus, pattern);
    }
  });

  it('home, about, shop, footer, and FAQ say Middle Eastern and non–Middle Eastern crafts', () => {
    const index = read('site/index.html');
    const about = read('site/about.html');
    const shop = read('site/shop.html');
    const faq = read('site/faq.html');
    const inclusive = /Middle Eastern crafts, and crafts that aren’t/;
    assert.match(index, inclusive);
    assert.match(index, /name="description" content="[^"]*Middle Eastern crafts, and crafts that aren’t/);
    assert.match(about, /We make all kinds of crafts — Middle Eastern and not/);
    assert.match(about, /Not one style and not one culture/);
    assert.match(shop, inclusive);
    assert.match(faq, inclusive);
    assert.match(faq, /Anyone shopping for a craft or a gift/);
  });

  it('keeps approved product names and checkout-off language', () => {
    const index = read('site/index.html');
    const faq = read('site/faq.html');
    assert.match(index, /Ya Aini/);
    assert.match(index, /Khalas Habibi/);
    assert.match(faq, /Checkout isn’t open/);
    assert.match(read('site/public-config.js'), /CHECKOUT_ENABLED:\s*false/);
  });
});
