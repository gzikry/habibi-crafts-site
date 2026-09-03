const base = process.argv[2] || 'http://127.0.0.1:9999';
const payload = JSON.stringify({
  type: 'checkout.session.completed',
  data: {
    object: {
      metadata: { idempotency_key: 'local-1', cart: '[]' },
      payment_status: 'paid',
      customer_email: 'test@example.com'
    }
  }
});
const response = await fetch(`${base}/api/webhook`, {
  method: 'POST',
  headers: { 'content-type': 'application/json', 'stripe-signature': 't=1,v1=invalid' },
  body: payload
});
if (response.status === 200) {
  throw new Error('unsigned webhook must not return 200');
}
console.log('webhook_unsigned', response.status, await response.text());
