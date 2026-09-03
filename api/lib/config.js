// Server-side configuration. Secrets come from the host environment only.
// Never import this file from site/ or any browser bundle.

function env(source, key, fallback = '') {
  const value = source?.[key];
  return value == null || value === '' ? fallback : String(value);
}

function flag(source, key, defaultValue = false) {
  const raw = source?.[key];
  if (raw == null || raw === '') return defaultValue;
  const normalized = String(raw).trim().toLowerCase();
  if (['1', 'true', 'yes', 'on'].includes(normalized)) return true;
  if (['0', 'false', 'no', 'off'].includes(normalized)) return false;
  return defaultValue;
}

export function readConfig(source = process.env) {
  return {
    stripeSecretKey: env(source, 'STRIPE_SECRET_KEY'),
    stripeWebhookSecret: env(source, 'STRIPE_WEBHOOK_SECRET'),
    stripePublishableKey: env(source, 'STRIPE_PUBLISHABLE_KEY'),
    printfulApiToken: env(source, 'PRINTFUL_API_TOKEN'),
    printfulStoreId: env(source, 'PRINTFUL_STORE_ID', '18687336'),
    adsensePublisherId: env(source, 'ADSENSE_PUBLISHER_ID'),
    checkoutEnabled: flag(source, 'CHECKOUT_ENABLED', false),
    adsenseEnabled: flag(source, 'ADSENSE_ENABLED', false),
    printfulConfirmOrders: flag(source, 'PRINTFUL_CONFIRM_ORDERS', false),
    appOrigin: env(source, 'APP_ORIGIN', 'https://habibicraftsco.com')
  };
}

export const config = readConfig();
