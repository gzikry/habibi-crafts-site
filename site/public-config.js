/* Public, non-secret flags only. Defaults keep checkout and ads off.
   When George flips live: set these AND the matching host env vars. */
window.HABIBI_PUBLIC_CONFIG = {
  CHECKOUT_ENABLED: false,
  ADSENSE_ENABLED: false,
  ADSENSE_PUBLISHER_ID: '',
  STRIPE_PUBLISHABLE_KEY: '',
  CHECKOUT_API_BASE: ''
};
