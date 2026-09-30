import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { formatCents, shippingProgress } from '../../site/bag.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

function read(rel) {
  return readFileSync(join(root, rel), 'utf8');
}

const BANNED_IDS = ['471226874', '471225102', '462540360', '462532459'];
const BANNED_PRICE = /(?:\$18|\$32|\$34|\$28|\$30)(?!\.\d)|\$24(?!\.)|\$6(?!\.)/;

describe('launch prices', () => {
  it('formats cents with two decimal places', () => {
    assert.equal(formatCents(2499), '$24.99');
    assert.equal(formatCents(599), '$5.99');
    assert.equal(formatCents(1499), '$14.99');
    assert.equal(shippingProgress(3899), '$0.01 to free US shipping');
    assert.equal(shippingProgress(3900), 'Free US shipping');
  });

  it('keeps server and storefront prices on the same cents', () => {
    const api = JSON.parse(read('api/catalog.json'));
    const site = JSON.parse(read('site/product-catalog.json'));
    const bySlug = Object.fromEntries(site.map((entry) => [entry.slug, entry]));
    for (const [slug, product] of Object.entries(api.products)) {
      assert.equal(bySlug[slug].purchasable, true, slug);
      assert.equal(bySlug[slug].price, product.price, slug);
    }
    for (const entry of site) {
      if (!entry.purchasable) assert.equal(api.products[entry.slug], undefined, entry.slug);
    }
    assert.equal(api.products['ya-aini'].price, 1499);
    assert.equal(api.products['khalas-habibi'].price, 2499);
    assert.equal(api.products.halawa.price, 3199);
    assert.equal(api.products['ya-teta'].price, 2799);
    assert.equal(api.products['beit-el-hobb'].price, 2399);
    assert.equal(bySlug['craft-club-sticker'].price, 599);
    assert.equal(bySlug['habibi-crafts-hat'].price, 2999);
    assert.equal(bySlug['craft-club-sticker'].purchasable, false);
    assert.equal(bySlug['habibi-crafts-hat'].purchasable, false);
  });

  it('drops retired tote ids and whole-dollar prices from the customer files', () => {
    const files = ['api/catalog.json', 'site/product-catalog.json', 'site/catalog.js'];
    for (const name of readdirSync(join(root, 'site'))) {
      if (name.endsWith('.html')) files.push(`site/${name}`);
    }
    for (const rel of files) {
      const text = read(rel);
      for (const id of BANNED_IDS) assert.equal(text.includes(id), false, `${rel} ${id}`);
      if (rel.endsWith('.html') || rel.endsWith('.js')) {
        assert.equal(BANNED_PRICE.test(text), false, rel);
      }
    }
    const tee = read('site/product-khalas-habibi.html');
    assert.match(tee, /\$24\.99/);
    assert.match(tee, /"price":"24\.99"/);
    const faq = read('site/faq.html');
    const answer = 'Mugs $14.99. Tees $24.99. Totes $31.99. Onesies $27.99. Prints $23.99. Stickers $5.99. Dad hats $29.99. Free US shipping on orders $39 and up. $6.99 flat below that.';
    assert.equal(faq.includes(answer), true);
    assert.match(read('site/shipping.html'), /Free US shipping on orders \$39 and up\. \$6\.99 flat below that\./);
    assert.match(read('site/shop.html'), /Free US shipping on orders \$39 and up\. \$6\.99 flat below that\./);
  });
});
