import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { LIVE_SLUGS, catalog, encodeCartMetadata, products, resolveLineItem } from '../lib/catalog.js';
import { readConfig } from '../lib/config.js';
import { fulfillPaidSession, handleCheckout, handleHealth, handleWebhook } from '../lib/handlers.js';
import { buildPrintfulItem, buildPrintfulOrderPayload, printfulHeaders } from '../lib/printful.js';
import { encodeStripeCheckoutBody, hmacSha256Hex, verifyStripeSignature } from '../lib/stripe.js';
import { validateCheckoutInput } from '../lib/validator.js';

const LIVE_SYNC_IDS = {
  'ya-aini': 462528261,
  baladi: 462528274,
  'ya-dunia': 462528282,
  jiran: 462528284,
  maamoul: 462532463,
  'knafeh-club': 462540373,
  'khalas-habibi': 462532457,
  'ya-habayeb': 462540352,
  halawa: 462532459,
  'sit-el-kul': 462540360,
  'ya-teta': 462532461,
  amoura: 462540363,
  'beit-el-hobb': 462532462,
  'dar-el-hawa': 462540368
};

describe('catalog contract', () => {
  it('wires exactly the 14 live products with external ids and sync product ids', () => {
    assert.deepEqual(Object.keys(products), LIVE_SLUGS);
    assert.equal(catalog.printful_store_id, '18687336');
    for (const slug of LIVE_SLUGS) {
      const product = products[slug];
      assert.equal(product.sync_product_id, LIVE_SYNC_IDS[slug]);
      assert.equal(product.printful_product_id, LIVE_SYNC_IDS[slug]);
      assert.match(product.external_id, /^habibi-(mug|tee|tote|onesie|print)-/);
      assert.ok(product.price > 0);
      assert.ok(product.variants);
      const variant = product.variants[product.default_variant];
      assert.ok(variant.external_variant_id);
      assert.ok(variant.catalog_variant_id);
    }
  });

  it('does not list unpublished fall SKUs', () => {
    const dumped = JSON.stringify(catalog).toLowerCase();
    assert.equal(dumped.includes('sweater weather'), false);
    assert.equal(Object.keys(products).some((slug) => slug.includes('sweater')), false);
  });

  it('resolves tee and onesie sizes', () => {
    const tee = resolveLineItem({ slug: 'khalas-habibi', size: 'L', quantity: 1, price_cents: 3200 });
    assert.equal(tee.external_variant_id, 'habibi-tee-khalas-habibi-l');
    const onesie = resolveLineItem({ slug: 'ya-teta', size: '3-6m', quantity: 2 });
    assert.equal(onesie.external_variant_id, 'habibi-onesie-ya-teta-3-6m');
    assert.equal(onesie.quantity, 2);
  });
});

describe('config flags', () => {
  it('defaults checkout and ads off and keeps the Printful store id', () => {
    const config = readConfig({});
    assert.equal(config.checkoutEnabled, false);
    assert.equal(config.adsenseEnabled, false);
    assert.equal(config.printfulConfirmOrders, false);
    assert.equal(config.printfulStoreId, '18687336');
    assert.equal(config.stripeSecretKey, '');
  });

  it('does not invent publisher ids or Stripe keys', () => {
    const config = readConfig({});
    assert.equal(config.adsensePublisherId, '');
    assert.equal(config.stripePublishableKey, '');
    assert.equal(config.stripeWebhookSecret, '');
    assert.equal(config.printfulApiToken, '');
  });
});

describe('Printful v1 order payload', () => {
  it('uses recipient + external_variant_id and the current /orders endpoint', () => {
    const payload = buildPrintfulOrderPayload({
      items: [
        {
          slug: 'ya-aini',
          name: 'Ya Aini',
          price: 1800,
          quantity: 1,
          external_id: 'habibi-mug-ya-aini',
          external_variant_id: 'habibi-mug-ya-aini'
        }
      ],
      shipping: {
        name: 'Test Buyer',
        address1: '123 Main St',
        city: 'Los Angeles',
        state: 'CA',
        country: 'US',
        postal_code: '90001'
      },
      customer: { name: 'Test Buyer', email: 'buyer@example.com' },
      externalId: 'local-test-1'
    });
    assert.equal(payload.recipient.email, 'buyer@example.com');
    assert.equal(payload.recipient.state_code, 'CA');
    assert.equal(payload.items[0].external_variant_id, 'habibi-mug-ya-aini');
    assert.equal(payload.items[0].retail_price, '18.00');
    assert.equal('recipients' in payload, false);
    assert.equal('product_id' in payload.items[0], false);
    assert.equal('files' in payload.items[0], false);
  });

  it('prefers sync_variant_id when the local pull has filled it in', () => {
    const item = buildPrintfulItem({
      name: 'Ya Aini',
      price: 1800,
      quantity: 1,
      sync_variant_id: 999001,
      external_variant_id: 'habibi-mug-ya-aini'
    });
    assert.equal(item.sync_variant_id, 999001);
    assert.equal('external_variant_id' in item, false);
  });

  it('sends X-PF-Store-Id for account-level tokens', () => {
    const headers = printfulHeaders({ printfulApiToken: 'token', printfulStoreId: '18687336' });
    assert.equal(headers['X-PF-Store-Id'], '18687336');
    assert.match(headers.Authorization, /^Bearer /);
  });
});

describe('Stripe helpers', () => {
  it('encodes Checkout Sessions as form fields, not JSON blobs', () => {
    const body = encodeStripeCheckoutBody({
      lineItems: [{ slug: 'ya-aini', name: 'Ya Aini', price: 1800, quantity: 1, size: 'default' }],
      successUrl: 'https://habibicraftsco.com/?checkout=success',
      cancelUrl: 'https://habibicraftsco.com/?checkout=cancelled',
      customerEmail: 'buyer@example.com',
      idempotencyKey: 'abc',
      metadata: { cart: '[]' }
    });
    assert.equal(body.get('mode'), 'payment');
    assert.equal(body.get('line_items[0][price_data][unit_amount]'), '1800');
    assert.equal(body.get('shipping_address_collection[allowed_countries][0]'), 'US');
    assert.equal(body.has('line_items'), false);
  });

  it('accepts a valid Stripe-Signature and rejects a bad one', async () => {
    const secret = 'whsec_test';
    const raw = '{"type":"checkout.session.completed"}';
    const timestamp = 1_700_000_000;
    const v1 = await hmacSha256Hex(secret, `${timestamp}.${raw}`);
    const good = await verifyStripeSignature(raw, `t=${timestamp},v1=${v1}`, secret, timestamp);
    assert.equal(good.ok, true);
    const bad = await verifyStripeSignature(raw, `t=${timestamp},v1=deadbeef`, secret, timestamp);
    assert.equal(bad.ok, false);
  });
});

describe('HTTP handlers', () => {
  it('health reports checkout and ads off by default', async () => {
    const response = await handleHealth(new Request('https://example.com/api/health', { method: 'GET' }), {});
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.checkout_enabled, false);
    assert.equal(body.adsense_enabled, false);
  });

  it('rejects checkout while CHECKOUT_ENABLED is false', async () => {
    const response = await handleCheckout(
      new Request('https://example.com/api/checkout', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          items: [{ slug: 'ya-aini', quantity: 1, price_cents: 1800 }],
          contact_email: 'buyer@example.com',
          idempotency_key: 'abc',
          total_amount_cents: 1800
        })
      }),
      { STRIPE_SECRET_KEY: 'sk_test_x', CHECKOUT_ENABLED: 'false' }
    );
    assert.equal(response.status, 403);
    const body = await response.json();
    assert.equal(body.checkout_enabled, false);
  });

  it('does not call Stripe when checkout is disabled', async () => {
    let called = false;
    const fetchImpl = async () => {
      called = true;
      return new Response('nope', { status: 500 });
    };
    await handleCheckout(
      new Request('https://example.com/api/checkout', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          items: [{ slug: 'ya-aini', quantity: 1, price_cents: 1800 }],
          contact_email: 'buyer@example.com',
          idempotency_key: 'abc'
        })
      }),
      { STRIPE_SECRET_KEY: 'sk_test_x' },
      fetchImpl
    );
    assert.equal(called, false);
  });

  it('creates a Checkout Session only when checkout is enabled (mocked Stripe)', async () => {
    const fetchImpl = async (url, init) => {
      assert.match(String(url), /checkout\/sessions/);
      assert.equal(init.headers.Authorization, 'Bearer sk_test_x');
      assert.match(init.body.toString(), /line_items%5B0%5D%5Bprice_data%5D%5Bunit_amount%5D=1800/);
      return new Response(JSON.stringify({ id: 'cs_test_1', url: 'https://checkout.stripe.com/c/pay/cs_test_1' }), {
        status: 200,
        headers: { 'content-type': 'application/json' }
      });
    };
    const response = await handleCheckout(
      new Request('https://example.com/api/checkout', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          items: [{ slug: 'ya-aini', quantity: 1, price_cents: 1800 }],
          contact_email: 'buyer@example.com',
          idempotency_key: 'abc',
          total_amount_cents: 1800
        })
      }),
      { STRIPE_SECRET_KEY: 'sk_test_x', CHECKOUT_ENABLED: 'true', APP_ORIGIN: 'https://habibicraftsco.com' },
      fetchImpl
    );
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.checkout_url, 'https://checkout.stripe.com/c/pay/cs_test_1');
  });

  it('rejects webhooks without a valid signature and never hits Printful', async () => {
    let called = false;
    const fetchImpl = async () => {
      called = true;
      return new Response('{}', { status: 200 });
    };
    const response = await handleWebhook(
      new Request('https://example.com/api/webhook', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'stripe-signature': 't=1,v1=nope' },
        body: JSON.stringify({ type: 'checkout.session.completed', data: { object: {} } })
      }),
      { STRIPE_WEBHOOK_SECRET: 'whsec_test', PRINTFUL_API_TOKEN: 'pf_x', CHECKOUT_ENABLED: 'true' },
      fetchImpl
    );
    assert.equal(response.status, 400);
    assert.equal(called, false);
  });

  it('does not submit a Printful order when checkout is still disabled', async () => {
    const secret = 'whsec_test';
    const payload = JSON.stringify({
      type: 'checkout.session.completed',
      data: { object: { id: 'cs_test', payment_status: 'paid', metadata: { cart: '[]' } } }
    });
    const timestamp = Math.floor(Date.now() / 1000);
    const v1 = await hmacSha256Hex(secret, `${timestamp}.${payload}`);
    let called = false;
    const fetchImpl = async () => {
      called = true;
      return new Response('{}', { status: 200 });
    };
    const response = await handleWebhook(
      new Request('https://example.com/api/webhook', {
        method: 'POST',
        headers: { 'stripe-signature': `t=${timestamp},v1=${v1}` },
        body: payload
      }),
      { STRIPE_WEBHOOK_SECRET: secret, PRINTFUL_API_TOKEN: 'pf_x', CHECKOUT_ENABLED: 'false' },
      fetchImpl
    );
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.reason, 'checkout_disabled');
    assert.equal(called, false);
  });

  it('after a verified paid session, posts to Printful v1 /orders (mocked)', async () => {
    const session = {
      id: 'cs_test_paid',
      payment_status: 'paid',
      metadata: {
        idempotency_key: 'order-1',
        cart: encodeCartMetadata([{ slug: 'ya-aini', quantity: 1, size: 'default' }])
      },
      customer_details: { name: 'Ada', email: 'ada@example.com' },
      shipping_details: {
        name: 'Ada',
        address: { line1: '1 Test Ave', city: 'LA', state: 'CA', country: 'US', postal_code: '90001' }
      }
    };
    const fetchImpl = async (url, init) => {
      const target = String(url);
      assert.match(target, /https:\/\/api\.printful\.com\/orders/);
      assert.match(target, /confirm=false/);
      assert.equal(init.headers['X-PF-Store-Id'], '18687336');
      const body = JSON.parse(init.body);
      assert.equal(body.recipient.address1, '1 Test Ave');
      assert.equal(body.items[0].external_variant_id, 'habibi-mug-ya-aini');
      return new Response(JSON.stringify({ result: { id: 77 } }), {
        status: 200,
        headers: { 'content-type': 'application/json' }
      });
    };
    const result = await fulfillPaidSession(
      session,
      readConfig({
        PRINTFUL_API_TOKEN: 'pf_x',
        PRINTFUL_STORE_ID: '18687336',
        PRINTFUL_CONFIRM_ORDERS: 'false'
      }),
      fetchImpl
    );
    assert.equal(result.result.id, 77);
  });
});

describe('checkout validator', () => {
  it('requires email, items, and idempotency key', () => {
    const errors = validateCheckoutInput({});
    assert.ok(errors.includes('items are required'));
    assert.ok(errors.includes('valid contact_email is required'));
    assert.ok(errors.includes('idempotency_key is required'));
  });
});
