import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const site = join(root, 'site');

const NOTE = "We're not taking orders yet. You can still add things to your bag.";
const NOTE_SHORT = "We're not taking orders yet.";
const HOLD = ['cart.html', 'checkout.html', 'order-confirmation.html', 'tracking.html'];
const SHOP_NEXT = "We're working on sweatshirts and a few other things. They'll show up here when they're ready.";
const THIN = [
  'sweatshirts.html',
  'long-sleeves.html',
  'beanies.html',
  'hoodies.html',
  'youth-tees.html',
  'coasters.html',
  'journals.html',
  'aprons.html',
];
const NO_NOTE = ['404.html', 'tracking.html', 'order-confirmation.html'];

function read(name) {
  return readFileSync(join(site, name), 'utf8');
}

function pages() {
  return readdirSync(site).filter((name) => name.endsWith('.html') && name !== 'about.html');
}

function visible(html) {
  return html.replace(/<script\b[\s\S]*?<\/script>/gi, '');
}

function metaAndLd(html) {
  const meta = html.match(/<meta\b[^>]*>/gi) || [];
  const ld = html.match(/<script type="application\/ld\+json">[\s\S]*?<\/script>/gi) || [];
  return meta.concat(ld).join('\n');
}

describe('storefront copy does not regress the live-site review', () => {
  it('allows one not-taking-orders note, and none on status pages', () => {
    const catalog = JSON.parse(readFileSync(join(site, 'product-catalog.json'), 'utf8'));
    const purchasable = new Set(catalog.filter((item) => item.purchasable === true).map((item) => item.slug));
    for (const name of pages()) {
      const html = read(name);
      const text = visible(html);
      const full = text.split(NOTE).length - 1;
      const shortOnly = text.split(NOTE_SHORT).length - 1 - full;
      assert.ok(full <= 1, `${name} has ${full} full order notes`);
      if (name.startsWith('product-')) {
        const slug = name.slice('product-'.length, -'.html'.length);
        assert.doesNotMatch(html, /Opening soon/, name);
        assert.doesNotMatch(html, /browse-mode/, name);
        assert.doesNotMatch(html, />Shop (Mugs|Tees|Totes|Onesies|Prints|Stickers|Hats)</, name);
        if (purchasable.has(slug)) {
          assert.equal(full, 1, name);
          assert.equal(shortOnly, 0, name);
          assert.match(html, /data-add-bag/, name);
        } else {
          assert.equal(full, 0, name);
          assert.equal(shortOnly, 1, name);
          assert.doesNotMatch(html, /data-add-bag/, name);
          assert.doesNotMatch(html, /data-size-picker/, name);
        }
      }
      if (NO_NOTE.includes(name)) {
        assert.equal(full, 0, name);
      }
    }
    const home = visible(read('index.html'));
    assert.equal(home.toLowerCase().split('our small business').length - 1, 1);
    assert.equal(home.split('class="pcard reveal"').length - 1, 4);
    for (const name of HOLD) {
      assert.doesNotMatch(read(name), /hold-kicker/, name);
    }
  });

  it('bans the old reassurance, timing, and coming-next lines', () => {
    for (const name of pages()) {
      const html = read(name);
      assert.doesNotMatch(html, /Nothing is charged/, name);
      assert.doesNotMatch(html, /Checkout isn.t open/i, name);
      assert.doesNotMatch(html, /Browsing only/, name);
      assert.doesNotMatch(html, /3-7|3–7|three to seven/, name);
      assert.doesNotMatch(html, /Coming next/, name);
      assert.doesNotMatch(html, /30-day print fix/, name);
      assert.doesNotMatch(metaAndLd(html), /—/, name);
      if (name !== 'index.html') {
        assert.doesNotMatch(html, /husband-and-wife/, name);
      }
    }
    assert.match(read('shop.html'), new RegExp(SHOP_NEXT.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
    const shopNotes = read('shop.html').split('Coming next').length - 1;
    assert.equal(shopNotes, 0);
  });

  it('keeps the eight thin pages out of the sitemap and redirects them', () => {
    const sitemap = readFileSync(join(site, 'sitemap.xml'), 'utf8');
    for (const name of THIN) {
      const html = read(name);
      assert.doesNotMatch(sitemap, new RegExp(name));
      assert.match(html, /noindex/);
      assert.match(html, /http-equiv="refresh" content="0; url=\/shop\.html"/);
      assert.match(html, /rel="canonical" href="https:\/\/habibicraftsco\.com\/shop\.html"/);
      assert.match(html, />Go to the shop</);
    }
  });

  it('uses the full orders line only next to Add to bag', () => {
    for (const name of pages()) {
      const html = read(name);
      const full = html.split(NOTE).length - 1;
      if (html.includes('data-add-bag')) {
        assert.equal(full, 1, name);
      } else {
        assert.equal(full, 0, name);
      }
    }
    const contact = read('contact.html');
    assert.equal(contact.split(NOTE).length - 1, 0);
    assert.equal(contact.split(NOTE_SHORT).length - 1, 0);
  });

  it('ships no empty meaning field', () => {
    const catalog = JSON.parse(readFileSync(join(site, 'product-catalog.json'), 'utf8'));
    for (const item of catalog) {
      assert.equal(Object.hasOwn(item, 'meaning'), false, item.slug);
    }
  });

  it('describes the share image as the wordmark on utility pages', () => {
    const alt = 'Habibi Crafts Co wordmark, established 2024';
    const named = [
      'cart.html',
      'checkout.html',
      'contact.html',
      'faq.html',
      'order-confirmation.html',
      'privacy.html',
      'shipping.html',
      'tracking.html',
      '404.html',
    ];
    for (const name of named) {
      const html = read(name);
      assert.equal(html.includes('Mugs, tees, totes, and more.'), false, name);
      assert.ok(html.includes(`content="${alt}"`), name);
    }
    assert.ok(read('about.html').includes('mugs, tees, totes, onesies, and prints'));
    assert.ok(read('index.html').includes('Mugs, tees, totes, onesies, prints, stickers, and dad hats'));
    assert.ok(read('shop.html').includes('Mugs, tees, totes, onesies, prints, stickers, and hats.'));
  });

  it('does not repeat a product on the home page', () => {
    const home = visible(read('index.html'));
    const slugs = [...home.matchAll(/<img\b[^>]*src="[^"]*(?:mockups|angles)\/([a-z0-9-]+)/g)].map((match) => match[1]);
    const dupes = slugs.filter((slug, i) => slugs.indexOf(slug) !== i);
    assert.deepEqual(dupes, []);
  });
});
