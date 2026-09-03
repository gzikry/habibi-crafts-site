const base = process.argv[2] || 'http://127.0.0.1:9999';
const health = await fetch(`${base}/api/health`);
if (health.status !== 200) {
  throw new Error(`health endpoint must return 200, got ${health.status}`);
}
const data = await health.json();
if (data.status !== 'ok') throw new Error('health status must be ok');
if (data.checkout_enabled !== false) throw new Error('CHECKOUT_ENABLED must default false');
console.log('health', data);

const checkout = await fetch(`${base}/api/checkout`, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({
    items: [{ slug: 'ya-aini', quantity: 1, price_cents: 1800 }],
    contact_email: 'buyer@example.com',
    idempotency_key: 'local-checkout'
  })
});
if (checkout.status !== 403) throw new Error(`checkout must stay 403 while disabled, got ${checkout.status}`);
console.log('checkout_disabled', await checkout.json());
