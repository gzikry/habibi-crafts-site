// Server-side configuration sourced from environment variables only.
export const config = {
  stripeSecretKey: process.env.STRIPE_SECRET_KEY || '',
  stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET || '',
  printfulApiToken: process.env.PRINTFUL_API_TOKEN || '',
  printfulStoreId: process.env.PRINTFUL_STORE_ID || '',
  appOrigin: process.env.APP_ORIGIN || 'https://habibicraftsco.com',
  publishableKey: process.env.STRIPE_PUBLISHABLE_KEY || ''
};
