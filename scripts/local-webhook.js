import http from 'node:http';
import assert from 'node:assert/strict';

const URL = new URL(process.argv[1] || 'http://127.0.0.1:9999/api/webhook');
const payload = JSON.stringify({
  type: 'checkout.session.completed',
  data: {
    object: {
      metadata: { idempotency_key: 'local-1' },
      customer_email: 'test@example.com',
      shipping_details: { address: { address1: '123 Main St', city: 'LA', state: 'CA', country: 'US', postal_code: '90001' } },
      display_items: []
    }
  }
});
const response = await fetch(URL, { method: 'POST', headers: { 'content-type': 'application/json' }, body: payload });
assert.strictEqual(response.status, 200, 'webhook must return 200');
const text = await response.text();
assert.strictEqual(text, 'ok');
console.log('webhook', text);
