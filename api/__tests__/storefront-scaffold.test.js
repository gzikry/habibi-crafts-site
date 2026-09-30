import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

function read(rel) {
  return readFileSync(join(root, rel), 'utf8');
}

describe('commerce scaffold stays off and chrome is branded', () => {
  it('exposes branded cart and checkout holders, not 404 pages', () => {
    for (const name of ['cart.html', 'checkout.html', 'order-confirmation.html', 'tracking.html']) {
      const path = join(root, 'site', name);
      assert.equal(existsSync(path), true, name);
      const html = read(`site/${name}`);
      assert.match(html, /site-header/);
      assert.match(html, /Habibi Crafts Co/);
      assert.match(html, /isn.t open/i);
      assert.doesNotMatch(html, /Printful/i);
      assert.doesNotMatch(html, /mailto:/i);
      assert.doesNotMatch(html, /data-checkout-enabled="true"/);
    }
    assert.match(read('site/order-confirmation.html'), /noindex/);
    assert.match(read('site/order-confirmation.html'), /Your order details will appear here/);
    assert.doesNotMatch(read('site/order-confirmation.html'), /sample layout|live order API|Static sample/i);
    assert.match(read('site/tracking.html'), /tracking note will/i);
  });

  it('PDP checkout control is browsing-mode, not a gray Notify me button', () => {
    const mug = read('site/product-ya-aini.html');
    const tee = read('site/product-khalas-habibi.html');
    assert.match(mug, /Browsing only · Checkout opens soon/);
    assert.match(mug, /Nothing is charged/);
    assert.match(mug, /browse-mode/);
    assert.doesNotMatch(mug, />Notify me</);
    assert.match(tee, /data-size-picker/);
    assert.match(tee, /aria-pressed="true"/);
    assert.match(read('site/product-ya-teta.html'), /data-size-picker/);
    assert.match(read('site/checkout.js'), /Browsing only · Checkout opens soon/);
  });

  it('header bag and mobile shop list are on the home chrome', () => {
    const home = read('site/index.html');
    assert.match(home, /class="nav-bag"/);
    assert.match(home, /href="cart\.html"/);
    assert.match(home, /Shop all/);
    assert.match(home, /nav-mobile-only" href="shipping\.html"/);
    assert.match(home, /nav-mobile-only" href="contact\.html"/);
    assert.match(home, /href="stickers\.html"/);
    assert.match(home, /href="hats\.html"/);
    assert.match(home, /href="sweatshirts\.html"/);
  });

  it('FAQ does not promise a thank-you card in every box', () => {
    const faq = read('site/faq.html');
    assert.match(faq, /Not every box/);
    assert.match(faq, /Apparel, totes, and hats may include a small thank-you card/);
    assert.match(faq, /Mugs, stickers, and prints get a packing-slip note only/);
    assert.doesNotMatch(faq, /Printful/i);
  });

  it('locks George 2026-09-02 About copy verbatim', () => {
    const about = read('site/about.html');
    assert.match(about, /LOCKED George 2026-09-02/);
    assert.match(about, />Our small business\.</);
    assert.match(about, /We’re a husband and wife\. This is our small business\./);
    assert.match(about, /We make all kinds of crafts — gifts for weddings, bachelor and bachelorette parties, and everyday\./);
    assert.match(about, /What’s in the shop now is just the start\. More as we add it\./);
    assert.match(about, /We design the pieces\. They’re printed after you order\./);
    assert.match(about, /Thanks for supporting our small business\./);
    assert.doesNotMatch(about, /Thanks for stopping by/);
    assert.doesNotMatch(about, /labor of love|handcrafted|thrilled/i);
    const home = read('site/index.html');
    assert.match(home, />Our small business</);
    assert.match(home, /whoever you’re shopping for/);
    assert.match(home, /Why this exists/);
    assert.match(home, /This is our small business\./);
    assert.match(home, /footer-copy">Our small business\. All kinds of crafts\./);
    assert.match(home, /footer-brand[\s\S]*logo-nav-white\.png/);
    assert.match(read('site/404.html'), /footer-brand[\s\S]*logo-nav-white\.png/);
    assert.match(read('site/cart.html'), /footer-brand[\s\S]*logo-nav-white\.png/);
    assert.match(read('scripts/build-storefront.py'), /LOCKED George 2026-09-02/);
  });

  it('contact does not invent an email address', () => {
    const contact = read('site/contact.html');
    assert.match(contact, /haven.t posted a public email yet/i);
    assert.doesNotMatch(contact, /mailto:/);
    assert.doesNotMatch(contact, /@[a-z0-9.-]+\.[a-z]{2,}/i);
    assert.match(contact, /faq\.html/);
    assert.match(contact, /shipping\.html/);
  });
});
