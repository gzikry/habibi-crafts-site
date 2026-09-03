function timingSafeEqual(a, b) {
  const left = String(a);
  const right = String(b);
  const max = Math.max(left.length, right.length);
  let mismatch = left.length === right.length ? 0 : 1;
  for (let i = 0; i < max; i += 1) {
    mismatch |= (left.charCodeAt(i) || 0) ^ (right.charCodeAt(i) || 0);
  }
  return mismatch === 0;
}

async function hmacSha256Hex(secret, payload) {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload));
  return [...new Uint8Array(signature)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

export async function verifyStripeSignature(rawBody, header, secret, nowSeconds = Math.floor(Date.now() / 1000)) {
  if (!secret) return { ok: false, reason: 'missing_webhook_secret' };
  if (!header) return { ok: false, reason: 'missing_stripe_signature' };

  const parts = String(header).split(',').map((part) => part.trim());
  let timestamp = '';
  const signatures = [];
  for (const part of parts) {
    const [key, ...rest] = part.split('=');
    const value = rest.join('=');
    if (key === 't') timestamp = value;
    if (key === 'v1') signatures.push(value);
  }
  if (!timestamp || !signatures.length) return { ok: false, reason: 'malformed_stripe_signature' };

  const age = Math.abs(nowSeconds - Number(timestamp));
  if (!Number.isFinite(Number(timestamp)) || age > 300) {
    return { ok: false, reason: 'stale_stripe_signature' };
  }

  const expected = await hmacSha256Hex(secret, `${timestamp}.${rawBody}`);
  if (!signatures.some((candidate) => timingSafeEqual(candidate, expected))) {
    return { ok: false, reason: 'invalid_stripe_signature' };
  }
  return { ok: true, timestamp };
}

export function encodeStripeCheckoutBody({ lineItems, successUrl, cancelUrl, customerEmail, metadata, idempotencyKey }) {
  const params = new URLSearchParams();
  params.set('mode', 'payment');
  params.set('success_url', successUrl);
  params.set('cancel_url', cancelUrl);
  params.set('billing_address_collection', 'required');
  params.append('shipping_address_collection[allowed_countries][0]', 'US');
  if (customerEmail) params.set('customer_email', customerEmail);
  if (idempotencyKey) params.set('client_reference_id', String(idempotencyKey).slice(0, 200));

  lineItems.forEach((item, index) => {
    params.set(`line_items[${index}][quantity]`, String(item.quantity));
    params.set(`line_items[${index}][price_data][currency]`, 'usd');
    params.set(`line_items[${index}][price_data][unit_amount]`, String(item.price));
    params.set(`line_items[${index}][price_data][product_data][name]`, item.name);
    params.set(`line_items[${index}][price_data][product_data][metadata][slug]`, item.slug);
    params.set(`line_items[${index}][price_data][product_data][metadata][size]`, item.size || '');
  });

  for (const [key, value] of Object.entries(metadata || {})) {
    if (value != null) params.set(`metadata[${key}]`, String(value));
  }
  return params;
}

export async function createCheckoutSession(body, config, fetchImpl = fetch) {
  if (!config.stripeSecretKey) throw new Error('STRIPE_SECRET_KEY is not set');
  const response = await fetchImpl('https://api.stripe.com/v1/checkout/sessions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.stripeSecretKey}`,
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`stripe session failed: ${text}`);
  }
  return response.json();
}

export async function retrieveCheckoutSession(sessionId, config, fetchImpl = fetch) {
  const url = new URL(`https://api.stripe.com/v1/checkout/sessions/${encodeURIComponent(sessionId)}`);
  url.searchParams.set('expand[]', 'line_items');
  const response = await fetchImpl(url, {
    headers: { Authorization: `Bearer ${config.stripeSecretKey}` }
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`stripe retrieve failed: ${text}`);
  }
  return response.json();
}

export { hmacSha256Hex };
