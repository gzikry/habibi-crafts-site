import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const APPAREL = new Set(['tees', 'hats', 'baby']);
const PHRASE = {
  tees: 'tee, worn',
  hats: 'hat, worn',
  baby: 'onesie, worn',
};
const CARD_PAGE = {
  tees: 'tees.html',
  hats: 'hats.html',
  baby: 'onesies.html',
  totes: 'totes.html',
};

function read(rel) {
  return readFileSync(join(root, rel), 'utf8');
}

function esc(value) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function heroSrc(html) {
  const spin = html.match(/data-spin-image[^>]*\ssrc="([^"]+)"/);
  if (spin) return spin[1];
  const gallery = html.match(/class="product-gallery"[^>]*>\s*<img[^>]*\ssrc="([^"]+)"/);
  assert.ok(gallery, 'product page has a hero image');
  return gallery[1];
}

function cardSrc(html, slug) {
  const card = html.match(new RegExp(`href="product-${slug}\\.html"[\\s\\S]*?<img[^>]*\\ssrc="([^"]+)"`));
  assert.ok(card, `card for ${slug}`);
  return card[1];
}

const catalog = JSON.parse(read('site/product-catalog.json'));
const shop = read('site/shop.html');
const home = read('site/index.html');

describe('apparel PDPs show an on-model photo second', () => {
  for (const product of catalog) {
    if (!APPAREL.has(product.category)) continue;
    it(`${product.slug} has an on-model shot after the product image`, () => {
      const file = `site/assets/on-model/${product.slug}.jpg`;
      assert.equal(existsSync(join(root, file)), true, file);
      assert.equal(existsSync(join(root, `site/assets/on-model/${product.slug}.png`)), false);
      const html = read(`site/product-${product.slug}.html`);
      const hero = heroSrc(html);
      const photo = html.match(/<img class="shot-photo" src="([^"]+)" alt="([^"]+)" loading="lazy" decoding="async">/);
      assert.ok(photo, 'on-model image');
      assert.equal(html.indexOf(hero) < html.indexOf(photo[0]), true);
      assert.doesNotMatch(hero, /on-model/);
      const version = product.category === 'hats' ? '3' : '2';
      assert.equal(photo[1], `assets/on-model/${product.slug}.jpg?v=${version}`);
      assert.equal(photo[2], esc(`${product.name} ${PHRASE[product.category]}`));
      assert.doesNotMatch(photo[2], /Printful/i);
      assert.match(html, /<fieldset class="shot-switch">\s*<legend class="sr-only">Product photos<\/legend>/);
    });

    it(`${product.slug} cards keep the transparent product shot`, () => {
      for (const page of ['site/shop.html', `site/${CARD_PAGE[product.category]}`]) {
        const src = cardSrc(page === 'site/shop.html' ? shop : read(page), product.slug);
        assert.match(src, new RegExp(`assets/mockups/${product.slug}\\.png`));
        assert.doesNotMatch(src, /on-model/);
      }
    });
  }

  it('home grid and hero do not use an on-model photo', () => {
    assert.doesNotMatch(home, /assets\/on-model\//);
  });

  it('mugs, prints, and stickers have no on-model shot', () => {
    for (const product of catalog) {
      if (APPAREL.has(product.category) || product.category === 'totes') continue;
      assert.doesNotMatch(read(`site/product-${product.slug}.html`), /assets\/on-model\//);
    }
  });
});

describe('tote PDPs show only the product shot', () => {
  const toteSlugs = catalog.filter((product) => product.category === 'totes').map((product) => product.slug);

  for (const product of catalog) {
    if (product.category !== 'totes') continue;

    it(`${product.slug} has no on-model photo`, () => {
      const html = read(`site/product-${product.slug}.html`);
      assert.equal(html.includes('assets/on-model/'), false);
      assert.equal(html.includes('shot-switch'), false);
      assert.equal(html.includes('shot-photo'), false);
      assert.equal(existsSync(join(root, `site/assets/on-model/${product.slug}.jpg`)), false);
    });

    it(`${product.slug} cards keep the transparent product shot`, () => {
      for (const page of ['site/shop.html', `site/${CARD_PAGE[product.category]}`]) {
        const src = cardSrc(page === 'site/shop.html' ? shop : read(page), product.slug);
        assert.match(src, new RegExp(`assets/mockups/${product.slug}\\.png`));
        assert.doesNotMatch(src, /on-model/);
      }
    });
  }

  it('on-model directory has no tote files', () => {
    const names = readdirSync(join(root, 'site/assets/on-model'));
    for (const slug of toteSlugs) {
      assert.equal(names.includes(`${slug}.jpg`), false, slug);
    }
  });
});
