import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { saleOpen } from '../lib/catalog.js';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync } from 'node:fs';
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
    assert.doesNotMatch(cart, /Opening soon/);
    assert.match(cart, /noindex,nofollow/);

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
    const coming = read(join(outDir, 'product-sit-el-kul.html'));
    assert.match(coming, /Email us/);
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
    assert.doesNotMatch(wrangler, /STRIPE_SECRET_KEY|sk_live_|sk_test_|PRINTFUL_API_TOKEN =/);
    const doc = read(join(root, 'docs/CLOUDFLARE-SETUP.md'));
    assert.match(doc, /APP_ORIGIN` is required/);
    assert.match(doc, /Zero Trust/);
    assert.match(doc, /HOLD_SLUGS/);
    assert.match(doc, /Create deployment/);
    assert.match(doc, /STRIPE_PUBLISHABLE_KEY/);
    assert.doesNotMatch(doc, /replaces the file/);
  });

  it('smoke script requires a preview URL and names the health and checkout routes', () => {
    const result = spawnSync('sh', ['scripts/preview-smoke.sh'], {
      cwd: root,
      encoding: 'utf8'
    });
    assert.equal(result.status, 2);
    const script = read(join(root, 'scripts/preview-smoke.sh'));
    assert.match(script, /\/api\/health/);
    assert.match(script, /\/api\/checkout/);
    assert.match(script, /checkout\.session\.completed|checkout_url/);
    assert.doesNotMatch(script, /sk_live_|sk_test_|whsec_|PRINTFUL_API_TOKEN=/);
  });
});
