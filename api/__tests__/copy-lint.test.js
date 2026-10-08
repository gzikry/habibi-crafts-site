import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import namedEntities from './named-entities.json' with { type: 'json' };

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
        const outsideFooter = html.replace(
          'Habibi Crafts Co is a husband-and-wife craft and gift shop in California.',
          '',
        );
        assert.doesNotMatch(outsideFooter, /husband-and-wife/, name);
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
    const amoura = catalog.find((item) => item.slug === 'amoura');
    assert.equal(Object.hasOwn(amoura, 'description'), false);
    assert.match(read('product-amoura.html'), /Amoura\. Baby onesie\./);
    assert.doesNotMatch(read('product-amoura.html'), /cutie/i);
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
    for (const name of [...named, 'index.html', 'shop.html']) {
      const html = read(name);
      const alts = [...html.matchAll(/image:alt" content="([^"]*)"/g)].map((match) => match[1]);
      assert.ok(alts.length >= 1, name);
      for (const value of alts) assert.equal(value, alt, name);
      assert.equal(html.includes('Mugs, tees, totes, and more.'), false, name);
    }
    assert.ok(read('about.html').includes('mugs, tees, totes, onesies, and prints'));
    assert.ok(read('index.html').includes('Mugs, tees, totes, onesies, prints, stickers, and dad hats'));
    assert.equal(read('shop.html').includes('Mugs, tees, totes, onesies, prints, stickers, and hats.'), false);
    assert.ok(read('shop.html').includes('dad hats'));
  });

  it('does not repeat the hat subtitle in the details rows', () => {
    for (const name of ['product-habibi-crafts-hat.html', 'product-make-something-hat.html', 'product-leaf-season-hat.html']) {
      const html = read(name);
      assert.match(html, /<p class="product-subtitle">Unstructured dad hat, one size adjustable<\/p>/);
      assert.doesNotMatch(html, /<dt>Style<\/dt>/);
      assert.doesNotMatch(html, /<dt>Fit<\/dt>/);
      assert.match(html, /<dt>Color<\/dt><dd>Black<\/dd>/);
    }
  });

  it('keeps the hat fit line on the hats intro only', () => {
    const line = 'Black dad hats, unstructured and adjustable, one size.';
    const hats = read('hats.html');
    assert.equal(hats.split(line).length - 1, 1);
    assert.match(hats, /<p class="lede">Black dad hats, unstructured and adjustable, one size\. \$29\.99\.<\/p>/);
    assert.equal(hats.includes('Black. Unstructured dad hat, one size adjustable.'), false);
    assert.doesNotMatch(hats, /<meta[^>]+Black dad hats, unstructured/);
    assert.equal(read('shop.html').includes(line), false);
    assert.match(read('shop.html'), /id="hats-heading">Hats<\/h2><p>Black dad hats\.<\/p>/);
  });

  it('does not repeat a product on the home page', () => {
    const home = visible(read('index.html'));
    const slugs = [...home.matchAll(/<img\b[^>]*src="[^"]*(?:mockups|angles)\/([a-z0-9-]+)/g)].map((match) => match[1]);
    const dupes = slugs.filter((slug, i) => slugs.indexOf(slug) !== i);
    assert.deepEqual(dupes, []);
  });
});

function plain(value) {
  return value
    .replace(/<[^>]+>/g, ' ')
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(parseInt(code, 16)))
    .replace(/&([A-Za-z][A-Za-z0-9]+);/g, (entity, name) => (
      Object.hasOwn(namedEntities, name) ? namedEntities[name] : entity
    ))
    .replace(/\s+/g, ' ')
    .trim();
}

function faqPages(html) {
  const pages = [];
  for (const match of html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) {
    const data = JSON.parse(match[1]);
    const nodes = data['@graph'] || [data];
    for (const node of nodes) {
      const type = node['@type'];
      const types = Array.isArray(type) ? type : [type];
      if (types.includes('FAQPage')) pages.push(node);
    }
  }
  return pages;
}

function visibleFaq(html) {
  const pairs = new Map();
  const pattern = /<details class="faq-item"[^>]*>\s*<summary>([\s\S]*?)<\/summary>([\s\S]*?)<\/details>/g;
  for (const match of html.matchAll(pattern)) {
    pairs.set(plain(match[1]), plain(match[2]));
  }
  return pairs;
}

describe('FAQ structured data matches the visible answers', () => {
  it('copies each FAQPage question and answer from the page', () => {
    const names = readdirSync(site).filter((name) => name.endsWith('.html'));
    let seen = 0;
    for (const name of names) {
      const html = read(name);
      const pages = faqPages(html);
      if (pages.length === 0) continue;
      seen += pages.length;
      const shown = visibleFaq(html);
      assert.ok(shown.size > 0, name);
      for (const page of pages) {
        for (const question of page.mainEntity) {
          const nameText = plain(question.name);
          assert.equal(shown.has(nameText), true, `${name}: ${nameText}`);
          assert.equal(plain(question.acceptedAnswer.text), shown.get(nameText), `${name}: ${nameText}`);
        }
      }
    }
    assert.ok(seen > 0, 'expected at least one FAQPage');
  });
});
