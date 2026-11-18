import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { saleOpen } from '../lib/catalog.js';
import { execFile, execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, readdirSync } from 'node:fs';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const INDEX_ROBOTS = 'index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1';
const OPEN = [
  'halawa',
  'early-light',
  'ya-aini',
  'baladi',
  'khalas-habibi',
  'ya-teta',
  'beit-el-hobb'
];

function read(path) {
  return readFileSync(path, 'utf8');
}

describe('preview build', () => {
  it('leaves the committed site alone when HABIBI_PREVIEW is unset', () => {
    const before = read(join(root, 'site/public-config.js'));
    const out = execFileSync('python3', ['pipeline/prepare-preview.py'], {
      cwd: root,
      encoding: 'utf8',
      env: { ...process.env, HABIBI_PREVIEW: '' }
    });
    assert.match(out, /Leaving site\/ unchanged/);
    assert.equal(read(join(root, 'site/public-config.js')), before);
    assert.match(before, /CHECKOUT_ENABLED:\s*false/);
    assert.match(before, /HABIBI_CHECKOUT_ENABLED\s*=\s*false/);
  });

  it('builds a noindex preview that sells only the open launch set', () => {
    const outDir = mkdtempSync(join(tmpdir(), 'habibi-preview-'));
    execFileSync('python3', ['pipeline/prepare-preview.py', '--out', outDir], {
      cwd: root,
      env: {
        ...process.env,
        HABIBI_PREVIEW: '1',
        CHECKOUT_ENABLED: 'true',
        CHECKOUT_API_BASE: 'https://preview.example'
      }
    });

    const config = read(join(outDir, 'public-config.js'));
    assert.match(config, /CHECKOUT_ENABLED:\s*true/);
    assert.match(config, /HABIBI_CHECKOUT_ENABLED\s*=\s*true/);
    assert.match(config, /https:\/\/preview\.example/);
    assert.doesNotMatch(config, /sk_live_|sk_test_|pk_live_|pk_test_|whsec_/);
    assert.match(read(join(root, 'site/public-config.js')), /CHECKOUT_ENABLED:\s*false/);

    assert.match(read(join(outDir, 'robots.txt')), /Disallow: \//);
    assert.match(read(join(outDir, '_headers')), /X-Robots-Tag: noindex, nofollow/);

    const aboutSrc = read(join(root, 'site/about.html'));
    const aboutOut = read(join(outDir, 'about.html'));
    assert.equal(aboutOut, aboutSrc.replaceAll(INDEX_ROBOTS, 'noindex,nofollow'));

    for (const slug of OPEN) {
      const page = read(join(outDir, `product-${slug}.html`));
      assert.match(page, /Add to bag/, slug);
      assert.match(page, /schema\.org\/InStock/, slug);
      assert.doesNotMatch(page, /schema\.org\/OutOfStock/, slug);
      assert.doesNotMatch(page, /Coming soon/, slug);
      assert.match(page, /noindex,nofollow/, slug);
    }

    for (const slug of ['jiran', 'sit-el-kul', 'habibi-crafts-hat', 'make-something-hat', 'leaf-season-hat']) {
      const page = read(join(outDir, `product-${slug}.html`));
      assert.match(page, /Coming soon/, slug);
      assert.match(page, /schema\.org\/OutOfStock/, slug);
      assert.doesNotMatch(page, /schema\.org\/InStock/, slug);
      assert.doesNotMatch(page, /data-add-bag/, slug);
      assert.match(page, /noindex,nofollow/, slug);
    }

    const cart = read(join(outDir, 'cart.html'));
    assert.match(cart, /data-checkout data-bag-checkout>Check out</);
    assert.match(cart, /<p class="lede">Review your bag, then check out\.<\/p>/);
    assert.doesNotMatch(cart, /Opening soon/);
    assert.doesNotMatch(cart, /not taking orders/i);
    assert.doesNotMatch(cart, /Yes\. Add a piece from the shop/);
    assert.match(cart, /noindex,nofollow/);
    const checkout = read(join(outDir, 'checkout.html'));
    assert.match(checkout, /<p class="lede">Checkout opens from your bag\.<\/p>/);
    assert.equal(checkout.split('Checkout opens from your bag.').length - 1, 1);
    assert.match(checkout, /Stripe collects the card/);
    assert.doesNotMatch(checkout, /Yes\. Add a piece from the shop/);
    const tracking = read(join(outDir, 'tracking.html'));
    assert.doesNotMatch(tracking, /nothing to look up today/i);
    assert.match(tracking, /Your email has the tracking link, with the order number and the carrier\./);
    assert.doesNotMatch(read(join(outDir, 'shipping.html')), /Yes\. Add a piece from the shop/);

    const catalog = JSON.parse(read(join(outDir, 'product-catalog.json')));
    const bySlug = Object.fromEntries(catalog.map((product) => [product.slug, product]));
    for (const product of catalog) {
      assert.equal(product.purchasable, saleOpen(product.slug), product.slug);
    }
    assert.equal(bySlug['ya-aini'].purchasable, true);
    assert.equal(bySlug.jiran.purchasable, false);
    assert.equal(bySlug['sit-el-kul'].purchasable, false);
    assert.equal(bySlug['habibi-crafts-hat'].purchasable, false);
    assert.equal(bySlug['make-something-hat'].purchasable, false);
    assert.equal(bySlug['leaf-season-hat'].purchasable, false);
    const yaAini = read(join(outDir, 'product-ya-aini.html'));
    assert.doesNotMatch(yaAini, /We're not taking orders yet/);
    assert.match(yaAini, /<li>Preview<\/li>/);
    const tote = read(join(outDir, 'product-sit-el-kul.html'));
    assert.match(tote, /Want one\? <a href="mailto:habibicraftsco@gmail.com">Email us<\/a>/);
    assert.doesNotMatch(tote, /Add to bag/);
    assert.doesNotMatch(tote, /Want a name on it/);
    const halawa = read(join(outDir, 'product-halawa.html'));
    assert.match(halawa, /Add to bag/);
    assert.doesNotMatch(halawa, /Want one\?/);
    assert.doesNotMatch(halawa, /Email us/);
    const early = read(join(outDir, 'product-early-light.html'));
    assert.match(early, /Add to bag/);
    assert.doesNotMatch(early, /Want one\?/);
    const sticker = read(join(outDir, 'product-leaf-season-sticker.html'));
    assert.match(sticker, /Want one\?/);
    const other = read(join(outDir, 'product-warm-embrace.html'));
    assert.match(other, /Questions\? <a href="mailto:habibicraftsco@gmail.com">Email us<\/a>/);
    assert.doesNotMatch(other, /Want a name on it/);
    assert.doesNotMatch(other, /Want one\?/);
    const banned = [
      /not taking orders/i,
      /does not collect payment/i,
      /when we start taking orders/i,
      /nothing to look up today/i,
      /Opening soon/
    ];
    function walk(dir) {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const path = join(dir, entry.name);
        if (entry.isDirectory()) walk(path);
        else if (/\.(html|js|json|txt|xml|css)$/i.test(entry.name)) {
          const text = read(path);
          for (const pattern of banned) assert.doesNotMatch(text, pattern, path);
        }
      }
    }
    walk(outDir);
    const faq = read(join(outDir, 'faq.html'));
    assert.doesNotMatch(faq, /We're not taking orders yet/);
    assert.match(faq, /Yes\. Add a piece from the shop to your bag and check out\./);
    assert.match(read(join(root, 'site/faq.html')), /We're not taking orders yet/);
    assert.doesNotMatch(read(join(root, 'site/index.html')), /<li>Preview<\/li>/);
    const committed = JSON.parse(read(join(root, 'site/product-catalog.json')));
    const committedHat = committed.find((product) => product.slug === 'habibi-crafts-hat');
    assert.equal(committedHat.purchasable, true);
  });

  it('treats a non-main Cloudflare branch as a preview even without HABIBI_PREVIEW', () => {
    const outDir = mkdtempSync(join(tmpdir(), 'habibi-cf-preview-'));
    const env = { ...process.env };
    delete env.HABIBI_PREVIEW;
    delete env.CHECKOUT_ENABLED;
    env.CF_PAGES = '1';
    env.CF_PAGES_BRANCH = 'feature-preview';
    execFileSync('python3', ['pipeline/prepare-preview.py', '--out', outDir], {
      cwd: root,
      env
    });
    assert.match(read(join(outDir, 'product-ya-aini.html')), /noindex,nofollow/);
    assert.match(read(join(outDir, 'robots.txt')), /Disallow: \//);
    assert.match(read(join(outDir, 'index.html')), /<li>Preview<\/li>/);
    assert.match(read(join(root, 'site/public-config.js')), /CHECKOUT_ENABLED:\s*false/);
  });

  it('the product builder writes purchasable from the sale rule', () => {
    const outDir = mkdtempSync(join(tmpdir(), 'habibi-builder-'));
    const env = { ...process.env, HABIBI_PREVIEW: '1' };
    delete env.CHECKOUT_ENABLED;
    execFileSync('python3', ['pipeline/build-products.py', '--out', outDir], {
      cwd: root,
      env
    });
    const catalog = JSON.parse(read(join(outDir, 'product-catalog.json')));
    for (const product of catalog) {
      assert.equal(product.purchasable, saleOpen(product.slug), product.slug);
    }
    assert.equal(catalog.find((product) => product.slug === 'ya-aini').purchasable, true);
    assert.equal(catalog.find((product) => product.slug === 'jiran').purchasable, false);
    assert.equal(catalog.find((product) => product.slug === 'habibi-crafts-hat').purchasable, false);
  });

  it('a preview build turns checkout on when CHECKOUT_ENABLED is unset', () => {
    const outDir = mkdtempSync(join(tmpdir(), 'habibi-default-on-'));
    const env = { ...process.env, HABIBI_PREVIEW: '1' };
    delete env.CHECKOUT_ENABLED;
    execFileSync('python3', ['pipeline/prepare-preview.py', '--out', outDir], {
      cwd: root,
      env
    });
    const cart = read(join(outDir, 'cart.html'));
    assert.match(cart, />Check out</);
    assert.doesNotMatch(cart, /Opening soon/);
    const config = read(join(outDir, 'public-config.js'));
    assert.match(config, /CHECKOUT_ENABLED:\s*true/);
    assert.match(read(join(root, 'site/public-config.js')), /CHECKOUT_ENABLED:\s*false/);
  });

  it('does not treat main as a preview even when HABIBI_PREVIEW is set', () => {
    const out = execFileSync('python3', ['-c', `
import os, sys
os.environ['HABIBI_PREVIEW'] = '1'
os.environ['CF_PAGES_BRANCH'] = 'main'
sys.path.insert(0, 'pipeline')
from chrome import preview_requested
assert preview_requested() is False
os.environ['CF_PAGES'] = '1'
assert preview_requested() is False
os.environ['CF_PAGES_BRANCH'] = 'feature-preview'
assert preview_requested() is True
print('ok')
`], { cwd: root, encoding: 'utf8' });
    assert.match(out, /ok/);
  });

  it('refuses a production parity check when preview env vars are set', () => {
    const result = spawnSync('python3', ['pipeline/check-builder-parity.py'], {
      cwd: root,
      encoding: 'utf8',
      env: { ...process.env, HABIBI_PREVIEW: '1', CHECKOUT_ENABLED: 'true' }
    });
    assert.equal(result.status, 2);
    assert.match(`${result.stdout}\n${result.stderr}`, /refusing preview env/);
  });

  it('documents preview vars in wrangler and requires APP_ORIGIN', () => {
    const wrangler = read(join(root, 'wrangler.toml'));
    assert.match(wrangler, /\[env\.preview\.vars\]/);
    assert.match(wrangler, /HABIBI_PREVIEW = "1"/);
    assert.match(wrangler, /CHECKOUT_ENABLED = "true"/);
    assert.match(wrangler, /non-main Cloudflare branch is a preview/);
    assert.doesNotMatch(wrangler, /does nothing unless HABIBI_PREVIEW=1/);
    assert.doesNotMatch(wrangler, /STRIPE_SECRET_KEY|sk_live_|sk_test_|PRINTFUL_API_TOKEN =/);
    const doc = read(join(root, 'docs/CLOUDFLARE-SETUP.md'));
    assert.match(doc, /APP_ORIGIN` is required/);
    assert.match(doc, /Enable access policy/);
    assert.match(doc, /Settings\*\*, then \*\*General\*\*/);
    assert.match(doc, /Zero Trust/);
    assert.match(doc, /\/api\/webhook/);
    assert.match(doc, /Bypass/);
    assert.match(doc, /only for the path `\/api\/webhook`/);
    assert.match(doc, /stripe listen --forward-to/);
    assert.match(doc, /proves the bypass/);
    assert.match(doc, /Service Auth/);
    assert.match(doc, /Create Service Token/);
    assert.match(doc, /CF_ACCESS_CLIENT_ID/);
    assert.match(doc, /CF_AUTHORIZATION/);
    assert.match(doc, /HOLD_SLUGS/);
    assert.match(doc, /Create deployment/);
    assert.match(doc, /STRIPE_PUBLISHABLE_KEY/);
    assert.doesNotMatch(doc, /replaces the file/);
    assert.doesNotMatch(doc, /Set the application domain/);
  });

  it('smoke script requires a preview URL and names the health and checkout routes', () => {
    const result = spawnSync('sh', ['scripts/preview-smoke.sh'], {
      cwd: root,
      encoding: 'utf8'
    });
    assert.equal(result.status, 2);
    const script = read(join(root, 'scripts/preview-smoke.sh'));
    assert.match(script, /\/api\/health/);
    assert.match(script, /\/cart\.html/);
    assert.match(script, /Check out/);
    assert.match(script, /Access did not block \/api\/checkout/);
    assert.match(script, /missing_stripe_signature/);
    assert.match(script, /SKIPPED authenticated checks/);
    assert.match(script, /Access rejected the service token or cookie/);
    assert.match(script, /CF_ACCESS_CLIENT_ID/);
    assert.match(script, /CF_AUTHORIZATION/);
    assert.doesNotMatch(script, /sk_live_|sk_test_|whsec_|PRINTFUL_API_TOKEN=/);
    const healthAt = script.indexOf('GET ${base}/api/health');
    const checkoutAt = script.indexOf('POST ${base}/api/checkout');
    assert.ok(checkoutAt > 0 && checkoutAt < healthAt);
  });

  it('gives cart and checkout their own ledes and limits the FAQ answer to faq.html', () => {
    const out = execFileSync('python3', ['-c', `
import sys
sys.path.insert(0, 'pipeline')
from chrome import open_shop_html
cart = '<h1>Your bag</h1>\\n    <p class="lede">We\\'re not taking orders yet.</p>'
cart_out = open_shop_html(cart, 'cart.html')
assert 'Review your bag, then check out.' in cart_out
assert 'Yes. Add a piece' not in cart_out
checkout = '<h1>Checkout</h1>\\n    <p class="lede">We\\'re not taking orders yet.</p>'
checkout_out = open_shop_html(checkout, 'checkout.html')
assert 'Checkout opens from your bag.' in checkout_out
assert 'Yes. Add a piece' not in checkout_out
phrase = "<p>We're not taking orders yet.</p>"
assert phrase == open_shop_html(phrase, 'shipping.html')
faq = open_shop_html(phrase, 'faq.html')
assert 'Yes. Add a piece from the shop to your bag and check out.' in faq
print('ok')
`], { cwd: root, encoding: 'utf8' });
    assert.match(out, /ok/);
  });

  it('skips authenticated smoke checks unless an Access credential is set', async () => {
    const hits = [];
    const server = createServer((req, res) => {
      const chunks = [];
      req.on('data', (chunk) => chunks.push(chunk));
      req.on('end', () => {
        hits.push({
          method: req.method,
          url: req.url,
          client: req.headers['cf-access-client-id'] || '',
          cookie: req.headers.cookie || ''
        });
        if (req.url === '/api/checkout') {
          res.writeHead(403, { 'content-type': 'text/html' });
          res.end('<html>Cloudflare Access</html>');
          return;
        }
        if (req.url === '/api/webhook') {
          res.writeHead(400, { 'content-type': 'application/json' });
          res.end('{"error":"missing_stripe_signature"}');
          return;
        }
        if (req.url === '/api/health') {
          res.writeHead(200, { 'content-type': 'application/json' });
          res.end('{"status":"ok","checkout_enabled":true}');
          return;
        }
        if (req.url === '/cart.html') {
          res.writeHead(200, { 'content-type': 'text/html' });
          res.end('<button>Check out</button>');
          return;
        }
        res.writeHead(404);
        res.end('no');
      });
    });
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    const port = server.address().port;
    const baseEnv = { ...process.env };
    delete baseEnv.CF_ACCESS_CLIENT_ID;
    delete baseEnv.CF_ACCESS_CLIENT_SECRET;
    delete baseEnv.CF_AUTHORIZATION;
    function runSmoke(env) {
      return new Promise((resolve) => {
        execFile('sh', ['scripts/preview-smoke.sh', `http://127.0.0.1:${port}`], {
          cwd: root,
          env
        }, (error, stdout, stderr) => {
          resolve({ status: error && error.code ? error.code : 0, stdout, stderr });
        });
      });
    }
    try {
      const skipped = await runSmoke(baseEnv);
      assert.equal(skipped.status, 0, `${skipped.stdout}\n${skipped.stderr}`);
      assert.match(skipped.stdout, /SKIPPED authenticated checks/);
      assert.deepEqual(hits.map((hit) => hit.url), ['/api/checkout', '/api/webhook']);
      hits.length = 0;
      const authed = await runSmoke({
        ...baseEnv,
        CF_ACCESS_CLIENT_ID: 'preview-id',
        CF_ACCESS_CLIENT_SECRET: 'preview-secret'
      });
      assert.equal(authed.status, 0, `${authed.stdout}\n${authed.stderr}`);
      assert.deepEqual(hits.map((hit) => hit.url), ['/api/checkout', '/api/webhook', '/api/health', '/cart.html']);
      assert.equal(hits[0].client, '');
      assert.equal(hits[2].client, 'preview-id');
      assert.equal(hits[3].client, 'preview-id');
    } finally {
      await new Promise((resolve) => server.close(resolve));
    }
  });

  it('says when Access rejects the smoke token', async () => {
    const server = createServer((req, res) => {
      req.resume();
      if (req.url === '/api/checkout') {
        res.writeHead(403, { 'content-type': 'text/html' });
        res.end('<html>Cloudflare Access</html>');
        return;
      }
      if (req.url === '/api/webhook') {
        res.writeHead(400, { 'content-type': 'application/json' });
        res.end('{"error":"missing_stripe_signature"}');
        return;
      }
      res.writeHead(401, { 'content-type': 'text/plain' });
      res.end('unauthorized');
    });
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    const port = server.address().port;
    const env = { ...process.env, CF_ACCESS_CLIENT_ID: 'bad-id', CF_ACCESS_CLIENT_SECRET: 'bad-secret' };
    delete env.CF_AUTHORIZATION;
    try {
      const result = await new Promise((resolve) => {
        execFile('sh', ['scripts/preview-smoke.sh', `http://127.0.0.1:${port}`], {
          cwd: root,
          env
        }, (error, stdout, stderr) => {
          resolve({ status: error && error.code ? error.code : 0, stdout, stderr });
        });
      });
      assert.equal(result.status, 1, `${result.stdout}\n${result.stderr}`);
      assert.match(`${result.stdout}\n${result.stderr}`, /Access rejected the service token or cookie for \/api\/health \(HTTP 401\)/);
    } finally {
      await new Promise((resolve) => server.close(resolve));
    }
  });
});
