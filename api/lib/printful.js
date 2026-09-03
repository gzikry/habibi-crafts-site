// Printful Orders API v1 — current as of developers.printful.com/docs/#tag/Orders-API
// Create: POST https://api.printful.com/orders?confirm=&update_existing=
// Confirm later: POST https://api.printful.com/orders/{id}/confirm
// Existing store products use sync_variant_id or external_variant_id (method A).
// Do not POST live orders from tests or from a disabled checkout.

const PRINTFUL_ORDERS_URL = 'https://api.printful.com/orders';

export function printfulHeaders(config) {
  const headers = {
    Authorization: `Bearer ${config.printfulApiToken}`,
    'Content-Type': 'application/json'
  };
  if (config.printfulStoreId) headers['X-PF-Store-Id'] = String(config.printfulStoreId);
  return headers;
}

export function buildPrintfulItem(line) {
  const item = {
    quantity: line.quantity,
    name: line.name,
    retail_price: (line.price / 100).toFixed(2)
  };
  if (line.external_id) item.external_id = line.external_id;
  // Prefer the store sync variant. Fall back to the external variant id we assign
  // on ignored drafts (habibi-mug-ya-aini, habibi-tee-khalas-habibi-m, …).
  if (line.sync_variant_id) item.sync_variant_id = Number(line.sync_variant_id);
  else if (line.external_variant_id) item.external_variant_id = line.external_variant_id;
  else throw new Error(`missing Printful variant mapping for ${line.slug || line.name}`);
  return item;
}

export function buildPrintfulOrderPayload({ items, shipping, customer, externalId }) {
  return {
    external_id: String(externalId).slice(0, 32),
    shipping: 'STANDARD',
    recipient: {
      name: customer.name || shipping.name || 'Customer',
      email: customer.email || '',
      address1: shipping.address1,
      address2: shipping.address2 || '',
      city: shipping.city,
      state_code: shipping.state,
      country_code: shipping.country,
      zip: shipping.postal_code
    },
    items: items.map(buildPrintfulItem)
  };
}

export async function createPrintfulOrder({ items, shipping, customer, externalId }, config, fetchImpl = fetch) {
  if (!config.printfulApiToken) throw new Error('PRINTFUL_API_TOKEN is not set');
  const payload = buildPrintfulOrderPayload({ items, shipping, customer, externalId });
  const url = new URL(PRINTFUL_ORDERS_URL);
  // Default confirm=false so a mistaken live webhook cannot charge Printful.
  url.searchParams.set('confirm', config.printfulConfirmOrders ? 'true' : 'false');
  url.searchParams.set('update_existing', 'true');

  const response = await fetchImpl(url, {
    method: 'POST',
    headers: printfulHeaders(config),
    body: JSON.stringify(payload)
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Printful order failed: ${response.status} ${text}`);
  }
  return response.json();
}

export async function fetchStoreProducts(config, { status = 'ignored', fetchImpl = fetch } = {}) {
  const url = new URL('https://api.printful.com/store/products');
  url.searchParams.set('limit', '100');
  if (status) url.searchParams.set('status', status);
  const response = await fetchImpl(url, { headers: printfulHeaders(config) });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Printful store products failed: ${response.status} ${text}`);
  }
  return response.json();
}

export async function fetchStoreProduct(syncProductId, config, fetchImpl = fetch) {
  const response = await fetchImpl(`https://api.printful.com/store/products/${syncProductId}`, {
    headers: printfulHeaders(config)
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Printful store product ${syncProductId} failed: ${response.status} ${text}`);
  }
  return response.json();
}
