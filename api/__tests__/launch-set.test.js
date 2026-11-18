import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { HOLD_SLUGS, LAUNCH_SLUGS, LIVE_SLUGS, products, saleOpen } from '../lib/catalog.js';
import { handleCheckout } from '../lib/handlers.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const storefront = JSON.parse(readFileSync(join(root, 'site/product-catalog.json'), 'utf8'));
const storefrontSlugs = new Set(storefront.map((product) => product.slug));

const OPEN = [
  'halawa',
  'early-light',
  'ya-aini',
  'baladi',
  'khalas-habibi',
  'ya-teta',
  'beit-el-hobb'
];

function checkoutRequest(slug) {
  return new Request('https://example.com/api/checkout', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      items: [{ slug, quantity: 1, price_cents: products[slug].price }],
      idempotency_key: `launch-${slug}`,
      total_amount_cents: products[slug].price
    })
  });
}

describe('launch set', () => {
  it('lists the ten launch products and holds the three hats', () => {
    assert.deepEqual(LAUNCH_SLUGS, [...OPEN, ...HOLD_SLUGS]);
    assert.deepEqual(HOLD_SLUGS, [
      'habibi-crafts-hat',
      'make-something-hat',
      'leaf-season-hat'
    ]);
    for (const slug of LAUNCH_SLUGS) {
      assert.ok(LIVE_SLUGS.includes(slug), slug);
      assert.ok(products[slug], slug);
      assert.ok(storefrontSlugs.has(slug), slug);
    }
    for (const slug of OPEN) assert.equal(saleOpen(slug), true, slug);
    for (const slug of HOLD_SLUGS) assert.equal(saleOpen(slug), false, slug);
    assert.equal(saleOpen('jiran'), false);
    assert.equal(saleOpen('sit-el-kul'), false);
  });

  it('refuses every slug while checkout is off', async () => {
    for (const slug of ['ya-aini', 'jiran', 'habibi-crafts-hat']) {
      const response = await handleCheckout(checkoutRequest(slug), {
        STRIPE_SECRET_KEY: 'sk_test_x',
        CHECKOUT_ENABLED: 'false'
      });
      assert.equal(response.status, 403, slug);
      const body = await response.json();
      assert.equal(body.checkout_enabled, false);
    }
  });

  it('sells the open launch set and refuses everything else when checkout is on', async () => {
    const env = {
      STRIPE_SECRET_KEY: 'sk_test_x',
      CHECKOUT_ENABLED: 'true',
      APP_ORIGIN: 'https://habibicraftsco.com'
    };
    const fetchImpl = async () => new Response(
      JSON.stringify({ id: 'cs_test_launch', url: 'https://checkout.stripe.com/c/pay/cs_test_launch' }),
      { status: 200, headers: { 'content-type': 'application/json' } }
    );
    for (const slug of OPEN) {
      const response = await handleCheckout(checkoutRequest(slug), env, fetchImpl);
      assert.equal(response.status, 200, slug);
    }
    for (const slug of ['jiran', 'sit-el-kul', ...HOLD_SLUGS]) {
      let called = false;
      const response = await handleCheckout(checkoutRequest(slug), env, async () => {
        called = true;
        return new Response('nope', { status: 500 });
      });
      assert.equal(response.status, 400, slug);
      const body = await response.json();
      assert.match(body.error, new RegExp(`not available for checkout ${slug}`));
      assert.equal(called, false, slug);
    }
  });
});
