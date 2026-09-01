import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
export const catalog = JSON.parse(readFileSync(join(__dirname, '..', 'catalog.json'), 'utf8'));
export const products = Object.fromEntries(
  Object.entries(catalog.products).map(([key, value]) => [key, { ...value, slug: key }])
);
