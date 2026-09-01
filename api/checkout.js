import { config } from './lib/config.js';
import { products } from './lib/catalog.js';
import { validateCheckoutInput } from './lib/validator.js';

function buildRedirectResponse(checkoutUrl) {
  return new Response(JSON.stringify({ checkout_url: checkoutUrl }), {
    status: 200,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store' }
  });
}

export default async function handler(request) {
  if (request.method !== 'POST') {
    return new Response('method not allowed', { status: 405 });
  }

  if (!config.stripeSecretKey) {
    return new Response('stripe not configured', { status: 500 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return new Response('invalid json', { status: 400 });
  }

  const errors = validateCheckoutInput(body);
  if (errors.length) {
    return new Response(JSON.stringify({ errors }), { status: 400, headers: { 'content-type': 'application/json' } });
  }

  const resolved = [];
  for (const raw of body.items) {
    const product = products[raw.slug];
    if (!product) return new Response(`unknown product ${raw.slug}`, { status: 400 });
    if (product.price !== raw.price_cents) return new Response(`price mismatch ${raw.slug}`, { status: 409 });
    resolved.push({
      price_data: {
        currency: 'usd',
        product_data: { name: product.name, metadata: { slug: raw.slug, backend_source: 'habibi-api' } },
        unit_amount: product.price
      },
      quantity: raw.quantity || 1
    });
  }

  const checkoutUrl = new URL('/api/checkout-session', request.url);
  checkoutUrl.search = '';
  checkoutUrl.hash = '';

  const stripeResponse = await fetch('https://api.stripe.com/v1/checkout/sessions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.stripeSecretKey}`,
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: new URLSearchParams({
      mode: 'payment',
      success_url: `${config.appOrigin}/?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${config.appOrigin}/?checkout=cancelled`,
      shipping_address_collection: JSON.stringify({ allowed_countries: ['US'] }),
      line_items: JSON.stringify(resolved),
      metadata: { idempotency_key: body.idempotency_key }
    })
  });

  if (!stripeResponse.ok) {
    const text = await stripeResponse.text();
    return new Response(`stripe session failed: ${text}`, { status: 502 });
  }

  const session = await stripeResponse.json();
  return buildRedirectResponse(session.url);
}
