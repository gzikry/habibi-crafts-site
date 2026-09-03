import { cloudflareHandler, handleHealth } from '../../api/lib/handlers.js';

export const onRequest = cloudflareHandler(handleHealth);
