import catalogJson from '../catalog.json' with { type: 'json' };

export const catalog = catalogJson;

export const products = Object.fromEntries(
  Object.entries(catalog.products).map(([key, value]) => [key, { ...value, slug: key }])
);

export const LIVE_SLUGS = [
  'ya-aini',
  'baladi',
  'ya-dunia',
  'jiran',
  'maamoul',
  'knafeh-club',
  'khalas-habibi',
  'ya-habayeb',
  'halawa',
  'sit-el-kul',
  'ya-teta',
  'amoura',
  'beit-el-hobb',
  'dar-el-hawa'
];

export function resolveVariant(product, size) {
  if (!product?.variants) return null;
  const key = size || product.default_variant || 'default';
  return product.variants[key] || null;
}

export function resolveLineItem(raw) {
  const slug = raw?.slug;
  const product = products[slug];
  if (!product) return { error: `unknown product ${slug || ''}` };
  const variant = resolveVariant(product, raw.size);
  if (!variant) return { error: `unknown variant for ${slug}` };
  const quantity = Number(raw.quantity || 1);
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 20) {
    return { error: `invalid quantity for ${slug}` };
  }
  if (raw.price_cents != null && raw.price_cents !== product.price) {
    return { error: `price mismatch ${slug}`, status: 409 };
  }
  return {
    slug,
    name: product.name,
    price: product.price,
    quantity,
    size: raw.size || product.default_variant || 'default',
    external_id: product.external_id,
    sync_product_id: product.sync_product_id,
    sync_variant_id: variant.sync_variant_id || null,
    external_variant_id: variant.external_variant_id,
    catalog_variant_id: variant.catalog_variant_id
  };
}

export function encodeCartMetadata(items) {
  return JSON.stringify(
    items.map((item) => ({
      slug: item.slug,
      quantity: item.quantity,
      size: item.size
    }))
  );
}

export function decodeCartMetadata(raw) {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}
