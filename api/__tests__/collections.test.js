import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const site = join(root, 'site');

const CURATED = [
  ['cozy-warm-minimalism', 'Warm Minimalism & Coffee Table Goods', 'Crewneck sweatshirts'],
  ['literary-and-desk', 'Reading Nook & Desk Companions', 'Hardcover journals'],
  ['kitchen-and-hosting', 'Kitchen, Tea & Hosting Table', 'Aprons'],
  ['stickers-and-caps', 'Stickers & Embroidered Dad Hats', 'Beanies'],
];

function read(rel) {
  return readFileSync(join(root, rel), 'utf8');
}

function jsonLd(html) {
  const blocks = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)];
  return blocks.map((match) => JSON.parse(match[1]));
}

describe('curated collections', () => {
  it('publishes an index and four collection pages with structured data', () => {
    const index = read('site/collections/index.html');
    const indexLd = jsonLd(index);
    assert.ok(indexLd.some((node) => node['@type'] === 'CollectionPage'));
    assert.ok(indexLd.some((node) => node['@type'] === 'BreadcrumbList'));
    assert.match(index, /next on the workbench/i);
    assert.match(index, /Hoodies are not in the collection/);
    assert.doesNotMatch(index, /data-add-bag/);
    assert.doesNotMatch(index, /Printful/i);
    assert.doesNotMatch(index, /Arabic-inspired|Arabic-only|crescent/i);
    assert.doesNotMatch(index, /CHECKOUT_ENABLED" content="true"|data-checkout-enabled="true"/);

    for (const [slug, title, bench] of CURATED) {
      const html = read(`site/collections/${slug}/index.html`);
      const data = jsonLd(html);
      const page = data.find((node) => node['@type'] === 'CollectionPage');
      const crumbs = data.find((node) => node['@type'] === 'BreadcrumbList');
      assert.ok(page, slug);
      assert.equal(page.name, title);
      assert.equal(page.url, `https://habibicraftsco.com/collections/${slug}/`);
      assert.equal(page.mainEntity['@type'], 'ItemList');
      assert.ok(page.mainEntity.itemListElement.length > 0, slug);
      assert.ok(crumbs, slug);
      assert.equal(crumbs.itemListElement[0].name, 'Home');
      assert.equal(crumbs.itemListElement[1].name, 'Collections');
      assert.equal(crumbs.itemListElement[2].name, title);
      assert.match(html, /In the collection/);
      assert.match(html, /Next on the workbench/);
      assert.match(html, new RegExp(bench));
      assert.match(html, /href="\/product-[a-z0-9-]+\.html"/);
      assert.doesNotMatch(html, /data-add-bag/);
      assert.doesNotMatch(html, /schema\.org\/InStock/);
      assert.doesNotMatch(html, /Printful/i);
      assert.doesNotMatch(html, /Arabic-inspired|Arabic-only/i);
    }
  });

  it('keeps sticker and hat prices on the live cents, and crewnecks as a plan', () => {
    const caps = read('site/collections/stickers-and-caps/index.html');
    assert.match(caps, /\$5\.99/);
    assert.match(caps, /\$29\.99/);
    assert.doesNotMatch(caps, /\$6(?!\.)/);
    assert.doesNotMatch(caps, /\$30(?!\.)/);
    const cozy = read('site/collections/cozy-warm-minimalism/index.html');
    assert.match(cozy, /\$44–\$48/);
    assert.match(cozy, /Not for sale yet/);
    assert.doesNotMatch(cozy, /data-add-bag/);
  });

  it('lists the collection URLs in the sitemap and leaves thin type pages out', () => {
    const sitemap = read('site/sitemap.xml');
    assert.match(sitemap, /<loc>https:\/\/habibicraftsco\.com\/collections\/<\/loc>/);
    for (const [slug] of CURATED) {
      assert.match(sitemap, new RegExp(`<loc>https://habibicraftsco\\.com/collections/${slug}/</loc>`));
    }
    for (const name of ['hoodies.html', 'sweatshirts.html', 'beanies.html', 'coasters.html', 'journals.html', 'aprons.html']) {
      assert.equal(sitemap.includes(name), false, name);
    }
  });

  it('filters the shop by type with counts and an empty hoodie state', () => {
    const catalog = JSON.parse(read('site/product-catalog.json'));
    const counts = {};
    for (const product of catalog) counts[product.category] = (counts[product.category] || 0) + 1;
    const shop = read('site/shop.html');
    const pills = [
      ['all', 'All', catalog.length],
      ['mugs', 'Mugs', counts.mugs],
      ['tees', 'Tees', counts.tees],
      ['totes', 'Tote Bags', counts.totes],
      ['baby', 'Onesies', counts.baby],
      ['prints', 'Prints', counts.prints],
      ['stickers', 'Stickers', counts.stickers],
      ['hats', 'Embroidered Hats', counts.hats],
      ['hoodies', 'Hoodies', 0],
    ];
    for (const [key, label, count] of pills) {
      assert.match(
        shop,
        new RegExp(`data-filter="${key}"[^>]*>${label} <span class="filter-count">${count}</span>`),
        key,
      );
    }
    assert.match(shop, /id="hoodies"/);
    assert.match(shop, /No hoodies are in the collection/);
    assert.match(shop, /data-shop-kind="hoodies"/);
    assert.doesNotMatch(shop.slice(shop.indexOf('id="hoodies"'), shop.indexOf('data-shop-next')), /class="product-card/);
    assert.match(shop, /We're working on sweatshirts and a few other things/);
    assert.match(read('site/index.html'), /href="collections\/cozy-warm-minimalism\/"/);
    assert.match(read('site/public-config.js'), /CHECKOUT_ENABLED:\s*false/);
  });
});
