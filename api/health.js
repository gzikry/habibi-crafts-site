import { handleHealth, vercelHandler } from './lib/handlers.js';

export default vercelHandler(handleHealth);
