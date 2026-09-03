import { handleWebhook, vercelHandler } from './lib/handlers.js';

export default vercelHandler(handleWebhook);
