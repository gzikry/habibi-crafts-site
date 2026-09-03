import http from 'node:http';
import { handleCheckout, handleCheckoutSession, handleHealth, handleWebhook } from '../api/lib/handlers.js';

const PORT = Number(process.env.PORT || 9999);

function toRequest(req, body) {
  const url = `http://127.0.0.1:${PORT}${req.url}`;
  const headers = req.headers;
  if (req.method === 'GET' || req.method === 'HEAD') return new Request(url, { method: req.method, headers });
  return new Request(url, { method: req.method, headers, body });
}

const server = http.createServer((req, res) => {
  const chunks = [];
  req.on('data', (chunk) => chunks.push(chunk));
  req.on('end', async () => {
    const body = Buffer.concat(chunks);
    const request = toRequest(req, body.length ? body : undefined);
    let response;
    try {
      if (req.url === '/api/health' || req.url.startsWith('/api/health?')) response = await handleHealth(request);
      else if (req.url.startsWith('/api/checkout-session')) response = await handleCheckoutSession(request);
      else if (req.url.startsWith('/api/checkout')) response = await handleCheckout(request);
      else if (req.url.startsWith('/api/webhook')) response = await handleWebhook(request);
      else response = new Response(JSON.stringify({ error: 'not found' }), { status: 404, headers: { 'content-type': 'application/json' } });
    } catch (error) {
      response = new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { 'content-type': 'application/json' } });
    }
    res.writeHead(response.status, Object.fromEntries(response.headers));
    res.end(Buffer.from(await response.arrayBuffer()));
  });
});

const shouldSelfTest = process.argv.includes('--once') || !process.env.KEEP_OPEN;

server.listen(PORT, '127.0.0.1', async () => {
  console.log(`local backend http://127.0.0.1:${PORT}`);
  if (!shouldSelfTest) return;
  const response = await fetch(`http://127.0.0.1:${PORT}/api/health`);
  const data = await response.json();
  console.log('health', data);
  const blocked = await fetch(`http://127.0.0.1:${PORT}/api/checkout`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      items: [{ slug: 'ya-aini', quantity: 1, price_cents: 1800 }],
      contact_email: 'buyer@example.com',
      idempotency_key: 'local'
    })
  });
  console.log('checkout_disabled', blocked.status, await blocked.json());
  server.close();
});
