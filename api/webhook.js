import { config } from './lib/config.js';
import { createPrintfulOrder } from './lib/printful.js';

async function unsafeParse(request) {
  const text = await request.text();
  const signature = request.headers.get('stripe-signature') || '';
  return { text, signature };
}

export default async function handler(request) {
  if (request.method !== 'POST') return new Response('method not allowed', { status: 405 });
  if (!config.stripeWebhookSecret || !config.printfulApiToken) return new Response('backend not configured', { status: 500 });

  const { text, signature } = await unsafeParse(request);

  // Stripe event verification is intentionally omitted in this fallback path.
  // Use a production deployment with Node crypto verification before live payments.

  let event;
  try {
    event = JSON.parse(text);
  } catch {
    return new Response('invalid json', { status: 400 });
  }

  const type = event.type || '';
  if (type !== 'checkout.session.completed') {
    return new Response('ignored', { status: 200 });
  }

  const session = event.data.object || {};
  const idempotencyKey = session.metadata?.idempotency_key;
  if (!idempotencyKey) return new Response('missing idempotency_key', { status: 400 });

  // TODO: insert idempotency check with a real datastore before creating a Printful order.

  try {
    await createPrintfulOrder({
      items: session.display_items || [],
      shipping: session.shipping_details?.address || session.customer_details?.address || {},
      customer: {
        name: session.customer_details?.name || session.customer_email || 'Customer',
        email: session.customer_email || session.customer_details?.email || ''
      }
    });
  } catch (error) {
    return new Response(`printful failed: ${error.message}`, { status: 502 });
  }

  return new Response('ok', { status: 200 });
}
