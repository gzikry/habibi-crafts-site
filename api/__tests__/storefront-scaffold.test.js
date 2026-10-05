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
      assert.equal(html.split('mailto:habibicraftsco@gmail.com').length - 1, 1);
      assert.doesNotMatch(html.replaceAll('mailto:habibicraftsco@gmail.com', ''), /mailto:/i);
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

  it('locks George 2026-10-05 About copy verbatim', () => {
    const about = read('site/about.html');
    const mainBlock = (html) => {
      const start = html.indexOf('<main id="main">');
      const end = html.indexOf('</main>', start) + '</main>'.length;
      return html.slice(start, end);
    };
    const footerBlock = (html) => {
      const start = html.indexOf('<footer class="site-footer">');
      const end = html.indexOf('</footer>', start) + '</footer>'.length;
      return html.slice(start, end);
    };
    const lock = read('LOCKED-STOREFRONT-COPY.md');
    const fenced = lock.match(/```text\n([\s\S]*?)\n```/);
    assert.ok(fenced, 'About lock file has a text block');
    const paragraphs = fenced[1].split('\n\n').map((part) => part.trim()).filter(Boolean);
    const main = mainBlock(about);
    let cursor = 0;
    for (const paragraph of paragraphs) {
      const at = main.indexOf(paragraph, cursor);
      assert.ok(at > cursor, paragraph.slice(0, 40));
      cursor = at + paragraph.length;
    }
    assert.match(main, /Welcome to Habibi Crafts Co!/);
    assert.doesNotMatch(main, /Habibi Crafts Co !/);
    assert.doesNotMatch(main, />Our small business\.</);
    assert.doesNotMatch(main, /We’re a husband and wife\. This is our small business\./);
    const faq = read('site/faq.html');
    assert.equal(footerBlock(about), footerBlock(faq));
    const styleKey = faq.match(/styles\.css\?v=\d+/)[0];
    assert.match(about, new RegExp(styleKey.replace('?', '\\?')));
    assert.match(about, /"mainEntity":\{"@id":"https:\/\/habibicraftsco\.com\/#store"\}/);
    assert.match(about, /A husband-and-wife craft shop\. Personalized mugs and other pieces for weddings, parties, and celebrations\./);
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

  it('offers a name on mug pages only', () => {
    const line = '<p class="checkout-note">Want a name on it? <a href="mailto:habibicraftsco@gmail.com">Email us</a>.</p>';
    const mugs = [
      'product-ya-aini.html',
      'product-baladi.html',
      'product-ya-dunia.html',
      'product-jiran.html',
      'product-maamoul.html',
      'product-knafeh-club.html',
      'product-morning-ritual.html',
    ];
    for (const name of mugs) {
      const html = read(`site/${name}`);
      const metaStart = html.indexOf('<div class="product-meta">');
      const details = html.indexOf('<div class="detail-list">', metaStart);
      const meta = html.slice(metaStart, details);
      assert.equal(meta.split(line).length - 1, 1, name);
      const noteAt = meta.indexOf('class="checkout-note"');
      const inviteAt = meta.indexOf(line);
      assert.ok(noteAt >= 0 && inviteAt > noteAt, name);
    }
    for (const name of ['product-khalas-habibi.html', 'product-halawa.html', 'product-starlight.html', 'product-garden-gate.html', 'about.html', 'mugs.html']) {
      assert.doesNotMatch(read(`site/${name}`), /Want a name on it/);
    }
    assert.match(read('site/styles.css'), /\.checkout-note a\{text-decoration:underline;text-underline-offset:3px\}/);
  });

  it('contact publishes the shop email', () => {
    const contact = read('site/contact.html');
    assert.doesNotMatch(contact, /haven.t posted a public email yet/i);
    assert.match(contact, /only website is habibicraftsco\.com/);
    const main = contact.slice(contact.indexOf('<main'), contact.indexOf('</main>'));
    assert.equal(main.split('only website is habibicraftsco.com').length - 1, 1);
    assert.match(main, /How to reach us[\s\S]*Email us at <a href="mailto:habibicraftsco@gmail\.com">habibicraftsco@gmail\.com<\/a>\./);
    assert.match(main, /How to reach us[\s\S]*only website is habibicraftsco\.com/);
    assert.equal(main.split('mailto:habibicraftsco@gmail.com').length - 1, 1);
    assert.doesNotMatch(main.slice(main.indexOf('Where we are')), /only website is habibicraftsco/);
    assert.match(contact, /not affiliated with other businesses that have similar names/);
    assert.match(contact, /"mainEntity":\{"@id":"https:\/\/habibicraftsco\.com\/#store"\}/);
    assert.match(contact, /<body class="page-contact">/);
    assert.match(read('site/styles.css'), /\.page-contact \.footer-note\{display:none\}/);
    assert.match(read('site/styles.css'), /\.footer-about,\.footer-note\{[^}]*text-wrap:pretty/);
    assert.match(read('site/styles.css'), /\.policy p\{[^}]*text-wrap:pretty/);
    assert.match(contact, /"email":"habibicraftsco@gmail\.com"/);
    assert.doesNotMatch(contact.replaceAll('habibicraftsco@gmail.com', ''), /@[a-z0-9.-]+\.[a-z]{2,}/i);
    assert.match(contact, /faq\.html/);
    assert.match(contact, /shipping\.html/);
  });
});
