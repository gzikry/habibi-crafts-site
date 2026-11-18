import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { LIVE_SLUGS, products, resolveLineItem, saleOpen } from '../lib/catalog.js';

const EXPECTED = {
  'ya-aini': { default: [5471949732, 'habibi-mug-ya-aini-11oz'] },
  baladi: { default: [5471949745, 'habibi-mug-baladi-11oz'] },
  'ya-dunia': { default: [5471949753, 'habibi-mug-ya-dunia-11oz'] },
  jiran: { default: [5471949778, 'habibi-mug-jiran-11oz'] },
  maamoul: { default: [5471960297, 'habibi-mug-maamoul-11oz'] },
  'knafeh-club': { default: [5471977632, 'habibi-mug-knafeh-club-11oz'] },
  'khalas-habibi': {
    S: [5471960270, 'habibi-tee-khalas-habibi-natural-s'],
    M: [5471960271, 'habibi-tee-khalas-habibi-natural-m'],
    L: [5471960272, 'habibi-tee-khalas-habibi-natural-l'],
    XL: [5471960273, 'habibi-tee-khalas-habibi-natural-xl']
  },
  'ya-habayeb': {
    S: [5471977606, 'habibi-tee-ya-habayeb-natural-s'],
    M: [5471977608, 'habibi-tee-ya-habayeb-natural-m'],
    L: [5471977610, 'habibi-tee-ya-habayeb-natural-l'],
    XL: [5471977611, 'habibi-tee-ya-habayeb-natural-xl']
  },
  halawa: { default: [5526428371, 'habibi-tote-halawa-us-oyster'] },
  'sit-el-kul': { default: [5526428309, 'habibi-tote-sit-el-kul-us-oyster'] },
  'gather-grow': { default: [5526427676, 'habibi-tote-gather-grow-us-oyster'] },
  'early-light': { default: [5526428256, 'habibi-tote-early-light-us-oyster'] },
  'ya-teta': {
    '3-6m': [5471960286, 'habibi-baby-ya-teta-3-6m'],
    '6-12m': [5471960287, 'habibi-baby-ya-teta-6-12m'],
    '12-18m': [5471960288, 'habibi-baby-ya-teta-12-18m']
  },
  amoura: {
    '3-6m': [5471977620, 'habibi-baby-amoura-3-6m'],
    '6-12m': [5471977622, 'habibi-baby-amoura-6-12m'],
    '12-18m': [5471977623, 'habibi-baby-amoura-12-18m']
  },
  'beit-el-hobb': { default: [5471960294, 'habibi-poster-beit-el-hobb-12x16'] },
  'dar-el-hawa': { default: [5471977627, 'habibi-poster-dar-el-hawa-12x16'] },
  'habibi-crafts-hat': { default: [5506375453, 'habibi-hat-habibi-crafts-black'] },
  'make-something-hat': { default: [5506375454, 'habibi-hat-make-something-black'] },
  'leaf-season-hat': { default: [5506375455, 'habibi-hat-leaf-season-black'] }
};

describe('Printful sync variants', () => {
  it('gives every live variant a numeric sync id and a habibi external id', () => {
    assert.deepEqual(Object.keys(EXPECTED).sort(), [...LIVE_SLUGS].sort());
    for (const slug of LIVE_SLUGS) {
      const product = products[slug];
      const expectedSizes = EXPECTED[slug];
      assert.deepEqual(Object.keys(product.variants).sort(), Object.keys(expectedSizes).sort(), slug);
      for (const [size, variant] of Object.entries(product.variants)) {
        const [syncVariantId, externalVariantId] = expectedSizes[size];
        assert.equal(typeof variant.sync_variant_id, 'number', `${slug} ${size}`);
        assert.ok(Number.isInteger(variant.sync_variant_id), `${slug} ${size}`);
        assert.match(variant.external_variant_id, /^habibi-/, `${slug} ${size}`);
        assert.equal(variant.sync_variant_id, syncVariantId, `${slug} ${size}`);
        assert.equal(variant.external_variant_id, externalVariantId, `${slug} ${size}`);
        const line = resolveLineItem({ slug, size, quantity: 1 });
        if (!saleOpen(slug)) {
          assert.match(line.error, /not available for checkout/, `${slug} ${size}`);
          continue;
        }
        assert.equal(line.sync_variant_id, syncVariantId, `${slug} ${size}`);
        assert.equal(line.external_variant_id, externalVariantId, `${slug} ${size}`);
      }
    }
  });
});
