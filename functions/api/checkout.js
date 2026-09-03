import { cloudflareHandler, handleCheckout } from '../../api/lib/handlers.js';

export const onRequest = cloudflareHandler(handleCheckout);
