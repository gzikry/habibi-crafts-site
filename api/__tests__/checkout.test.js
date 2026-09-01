import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { products } from '../lib/catalog.js';

describe('catalog contract', () => {
  it('exposes slug, price, and printful identifiers for live products', () => {
    const required = ['slug', 'price', 'printful_product_id', 'name'];
    for (const product of Object.values(products)) {
      for (const key of required) assert.ok(product[key] != null, `missing ${key} for ${product.name}`);
    }
  });
});
