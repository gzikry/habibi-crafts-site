import { cloudflareHandler, handleCheckoutSession } from '../../api/lib/handlers.js';

export const onRequest = cloudflareHandler(handleCheckoutSession);
