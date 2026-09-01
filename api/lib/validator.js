export function validateCheckoutInput(body) {
  const errors = [];
  if (!body?.items?.length) errors.push('items are required');
  if (!/^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/.test(body?.contact_email || '')) errors.push('valid contact_email is required');
  if (!body?.shipping?.address1) errors.push('shipping.address1 is required');
  if (!body?.shipping?.city) errors.push('shipping.city is required');
  if (!body?.shipping?.state) errors.push('shipping.state is required');
  if (!body?.shipping?.country || body.shipping.country.length !== 2) errors.push('shipping.country must be 2-letter code');
  if (!body?.shipping?.postal_code) errors.push('shipping.postal_code is required');
  if (typeof body?.total_amount_cents !== 'number' || body.total_amount_cents < 0) errors.push('total_amount_cents must be a non-negative number');
  if (!body?.idempotency_key) errors.push('idempotency_key is required');
  return errors;
}
