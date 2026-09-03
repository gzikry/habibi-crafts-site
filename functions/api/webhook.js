import { cloudflareHandler, handleWebhook } from '../../api/lib/handlers.js';

export const onRequest = cloudflareHandler(handleWebhook);
