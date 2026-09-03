export function validateCheckoutInput(body) {
  const errors = [];
  if (!body?.items?.length) errors.push('items are required');
  if (!/^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/.test(body?.contact_email || '')) {
    errors.push('valid contact_email is required');
  }
  if (!body?.idempotency_key) errors.push('idempotency_key is required');
  if (typeof body?.total_amount_cents === 'number' && body.total_amount_cents < 0) {
    errors.push('total_amount_cents must be a non-negative number');
  }
  return errors;
}

export function shippingFromStripeSession(session) {
  const details = session?.shipping_details || session?.collected_information?.shipping_details || {};
  const address = details.address || session?.customer_details?.address || {};
  return {
    name: details.name || session?.customer_details?.name || '',
    address1: address.line1 || address.address1 || '',
    address2: address.line2 || address.address2 || '',
    city: address.city || '',
    state: address.state || address.state_code || '',
    country: address.country || address.country_code || '',
    postal_code: address.postal_code || address.zip || ''
  };
}

export function validateShipping(shipping) {
  const errors = [];
  if (!shipping?.address1) errors.push('shipping.address1 is required');
  if (!shipping?.city) errors.push('shipping.city is required');
  if (!shipping?.state) errors.push('shipping.state is required');
  if (!shipping?.country || String(shipping.country).length !== 2) {
    errors.push('shipping.country must be 2-letter code');
  }
  if (!shipping?.postal_code) errors.push('shipping.postal_code is required');
  return errors;
}
