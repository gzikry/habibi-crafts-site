#!/usr/bin/env node
// GET-only helper. Lists ignored store products and prints slug → sync_variant_id.
// Does not PUT, publish, un-ignore, or create orders.

import { writeFileSync } from 'node:fs';
import { products } from '../api/lib/catalog.js';
import { readConfig } from '../api/lib/config.js';
import { fetchStoreProduct } from '../api/lib/printful.js';

const config = readConfig();
if (!config.printfulApiToken) {
  console.error('PRINTFUL_API_TOKEN is not set. Export it in this shell only — do not put it in git.');
  process.exit(1);
}

const writePath = process.argv.includes('--write')
  ? new URL('../api/catalog.variants.generated.json', import.meta.url)
  : null;

const mapping = {};
for (const product of Object.values(products)) {
  const payload = await fetchStoreProduct(product.sync_product_id, config);
  const syncProduct = payload.result?.sync_product || payload.result || {};
  const variants = payload.result?.sync_variants || [];
  mapping[product.slug] = {
    sync_product_id: product.sync_product_id,
    external_id: product.external_id,
    is_ignored: syncProduct.is_ignored ?? null,
    variants: variants.map((variant) => ({
      sync_variant_id: variant.id,
      catalog_variant_id: variant.variant_id || variant.product?.variant_id || null,
      size: variant.size || null,
      sku: variant.sku || null,
      external_id: variant.external_id || null,
      is_ignored: variant.is_ignored ?? null
    }))
  };
  console.log(product.slug, mapping[product.slug]);
}

if (writePath) {
  writeFileSync(writePath, `${JSON.stringify(mapping, null, 2)}\n`);
  console.log('wrote', writePath.pathname);
}
console.log('Done. Drafts were not published or un-ignored.');
