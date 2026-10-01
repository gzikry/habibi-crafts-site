import { execFileSync } from 'node:child_process';
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
      assert.doesNotMatch(html, /Printful/i);
      assert.doesNotMatch(html, /mailto:/i);
      assert.doesNotMatch(html, /data-checkout-enabled="true"/);
    }
    assert.match(read('site/order-confirmation.html'), /noindex/);
    assert.match(read('site/order-confirmation.html'), /Your order details will appear here/);
    assert.doesNotMatch(read('site/order-confirmation.html'), /sample layout|live order API|Static sample|HC-0000/i);
    assert.match(read('site/tracking.html'), /tracking note will/i);
  });

  it('PDP checkout control is browsing-mode, not a gray Notify me button', () => {
    const mug = read('site/product-ya-aini.html');
    const tee = read('site/product-khalas-habibi.html');
    const print = read('site/product-starlight.html');
    assert.match(mug, /data-add-bag/);
    assert.match(mug, /We're not taking orders yet\. You can still add things to your bag\./);
    assert.match(tee, /We're not taking orders yet\. You can still add things to your bag\./);
    assert.match(print, /We're not taking orders yet\./);
    assert.doesNotMatch(print, /add things to your bag/);
    assert.doesNotMatch(mug, /Opening soon/);
    assert.doesNotMatch(mug, /browse-mode/);
    assert.doesNotMatch(print, /browse-mode/);
    assert.doesNotMatch(mug, />Notify me</);
    assert.match(tee, /data-size-picker/);
    assert.match(tee, /aria-pressed="true"/);
    assert.match(read('site/product-ya-teta.html'), /data-size-picker/);
    assert.doesNotMatch(read('site/product-garden-gate.html'), /data-size-picker/);
    assert.doesNotMatch(read('site/product-garden-gate.html'), /data-add-bag/);
    assert.match(read('site/product-garden-gate.html'), /3-6m, 6-12m, 12-18m/);
    assert.match(read('site/checkout.js'), /Opening soon/);
    assert.match(read('site/cart.html'), /Opening soon/);
  });

  it('anchors the shop menu to the right edge of Shop', () => {
    const css = read('site/styles.css');
    const desktop = css.match(/\.nav-shop-menu\{[^}]+\}/);
    assert.ok(desktop, 'desktop shop menu rule');
    assert.match(desktop[0], /right:0/);
    assert.match(desktop[0], /left:auto/);
    const mobile = css.slice(css.indexOf('@media(max-width:900px)'));
    assert.match(mobile, /\.nav-shop-menu\{[^}]*position:static/);
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
    assert.doesNotMatch(home, /href="sweatshirts\.html"/);
    assert.doesNotMatch(home, /data-spin-counter/);
    assert.doesNotMatch(home, /data-spin-hint/);
    assert.match(home, /data-spin-slider/);
    assert.match(home, /Turn it around with the slider\./);
    assert.match(read('site/product-ya-aini.html'), /data-spin-counter/);
    assert.match(read('site/product-ya-aini.html'), /data-spin-hint/);
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
    const locked = execFileSync('git', ['show', '22f9dbc:site/about.html'], {
      cwd: root,
      encoding: 'utf8',
    });
    const aboveFooter = (html) => html.slice(0, html.indexOf('<footer class="site-footer">'));
    const footerBlock = (html) => {
      const start = html.indexOf('<footer class="site-footer">');
      const end = html.indexOf('</footer>', start) + '</footer>'.length;
      return html.slice(start, end);
    };
    assert.equal(aboveFooter(about), aboveFooter(locked));
    assert.equal(footerBlock(about), footerBlock(read('site/faq.html')));
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
    assert.match(home, /Crafts and gifts we'd want to give ourselves\./);
    assert.match(home, /What we make/);
    assert.doesNotMatch(home, /Why this exists/);
    assert.doesNotMatch(home, /This is our small business\./);
    assert.match(home, /footer-copy">All kinds of crafts\./);
    assert.equal(home.toLowerCase().split('our small business').length - 1, 1);
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
