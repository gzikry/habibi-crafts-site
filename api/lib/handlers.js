import { readConfig } from './config.js';
import { decodeCartMetadata, encodeCartMetadata, resolveLineItem } from './catalog.js';
import { corsHeaders, json, text } from './http.js';
import { createPrintfulOrder } from './printful.js';
import {
  createCheckoutSession,
  encodeStripeCheckoutBody,
  retrieveCheckoutSession,
  verifyStripeSignature
} from './stripe.js';
import { shippingFromStripeSession, validateCheckoutInput, validateShipping } from './validator.js';

function envFrom(requestEnv) {
  return readConfig(requestEnv || process.env);
}

function originHeaders(config) {
  return corsHeaders(config.appOrigin);
}

export async function handleHealth(request, requestEnv) {
  const config = envFrom(requestEnv);
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: originHeaders(config) });
  if (request.method !== 'GET') return text('method not allowed', 405, originHeaders(config));
  return json(
    {
      status: 'ok',
      checkout_enabled: config.checkoutEnabled,
      adsense_enabled: config.adsenseEnabled,
      printful_store_id: config.printfulStoreId || null
    },
    200,
    originHeaders(config)
  );
}

export async function handleCheckout(request, requestEnv, fetchImpl = fetch) {
  const config = envFrom(requestEnv);
  const headers = originHeaders(config);
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers });
  if (request.method !== 'POST') return text('method not allowed', 405, headers);

  if (!config.checkoutEnabled) {
    return json({ error: 'checkout_disabled', checkout_enabled: false }, 403, headers);
  }
  if (!config.stripeSecretKey) {
    return json({ error: 'stripe_not_configured' }, 500, headers);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'invalid_json' }, 400, headers);
  }

  const errors = validateCheckoutInput(body);
  if (errors.length) return json({ errors }, 400, headers);

  const resolved = [];
  let computedTotal = 0;
  for (const raw of body.items) {
    const item = resolveLineItem(raw);
    if (item.error) return json({ error: item.error }, item.status || 400, headers);
    computedTotal += item.price * item.quantity;
    resolved.push(item);
  }
  if (typeof body.total_amount_cents === 'number' && body.total_amount_cents !== computedTotal) {
    return json({ error: 'total mismatch' }, 409, headers);
  }

  const stripeBody = encodeStripeCheckoutBody({
    lineItems: resolved,
    successUrl: `${config.appOrigin}/?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
    cancelUrl: `${config.appOrigin}/?checkout=cancelled`,
    customerEmail: body.contact_email,
    idempotencyKey: body.idempotency_key,
    metadata: {
      idempotency_key: body.idempotency_key,
      cart: encodeCartMetadata(resolved)
    }
  });

  try {
    const session = await createCheckoutSession(stripeBody, config, fetchImpl);
    return json({ checkout_url: session.url, id: session.id }, 200, headers);
  } catch (error) {
    return json({ error: error.message }, 502, headers);
  }
}

export async function handleCheckoutSession(request, requestEnv, fetchImpl = fetch) {
  const config = envFrom(requestEnv);
  const headers = originHeaders(config);
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers });
  if (request.method !== 'GET') return text('method not allowed', 405, headers);
  if (!config.checkoutEnabled) {
    return json({ error: 'checkout_disabled', checkout_enabled: false }, 403, headers);
  }

  const url = new URL(request.url);
  const sessionId = url.searchParams.get('session_id');
  if (!sessionId) return json({ error: 'session_id is required' }, 400, headers);
  if (!config.stripeSecretKey) return json({ error: 'stripe_not_configured' }, 500, headers);

  try {
    const session = await retrieveCheckoutSession(sessionId, config, fetchImpl);
    return json(
      {
        id: session.id,
        payment_status: session.payment_status,
        status: session.status
      },
      200,
      headers
    );
  } catch (error) {
    return json({ error: error.message }, 502, headers);
  }
}

function customerFromSession(session) {
  return {
    name: session.customer_details?.name || session.shipping_details?.name || 'Customer',
    email: session.customer_details?.email || session.customer_email || ''
  };
}

export async function fulfillPaidSession(session, config, fetchImpl = fetch) {
  const cart = decodeCartMetadata(session.metadata?.cart);
  const items = [];
  for (const raw of cart) {
    const item = resolveLineItem(raw);
    if (item.error) throw new Error(item.error);
    items.push(item);
  }
  if (!items.length) throw new Error('cart metadata missing from Stripe session');

  const shipping = shippingFromStripeSession(session);
  const shippingErrors = validateShipping(shipping);
  if (shippingErrors.length) throw new Error(shippingErrors.join(', '));

  return createPrintfulOrder(
    {
      items,
      shipping,
      customer: customerFromSession(session),
      externalId: session.metadata?.idempotency_key || session.id
    },
    config,
    fetchImpl
  );
}

export async function handleWebhook(request, requestEnv, fetchImpl = fetch) {
  const config = envFrom(requestEnv);
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: originHeaders(config) });
  if (request.method !== 'POST') return text('method not allowed', 405);

  if (!config.stripeWebhookSecret) return text('webhook not configured', 500);

  const rawBody = await request.text();
  const signature = request.headers.get('stripe-signature') || '';
  const verified = await verifyStripeSignature(rawBody, signature, config.stripeWebhookSecret);
  if (!verified.ok) return text(verified.reason, 400);

  let event;
  try {
    event = JSON.parse(rawBody);
  } catch {
    return text('invalid json', 400);
  }

  const type = event.type || '';
  if (type !== 'checkout.session.completed') return text('ignored', 200);

  if (!config.checkoutEnabled) {
    return json({ status: 'ignored', reason: 'checkout_disabled' }, 200);
  }
  if (!config.printfulApiToken) return text('printful not configured', 500);

  const session = event.data?.object || {};
  if (session.payment_status && session.payment_status !== 'paid') {
    return json({ status: 'ignored', reason: 'unpaid' }, 200);
  }

  try {
    const result = await fulfillPaidSession(session, config, fetchImpl);
    return json({ status: 'ok', printful: { id: result?.result?.id || result?.id || null } }, 200);
  } catch (error) {
    return text(`printful failed: ${error.message}`, 502);
  }
}

export function vercelHandler(handle) {
  return async function handler(request, context) {
    const env = context?.env || process.env;
    return handle(request, env);
  };
}

export function cloudflareHandler(handle) {
  return async function onRequest(context) {
    return handle(context.request, context.env);
  };
}
