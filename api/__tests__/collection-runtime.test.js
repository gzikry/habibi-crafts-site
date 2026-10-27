import { spawnSync } from 'node:child_process';
import vm from 'node:vm';
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

function read(rel) {
  return readFileSync(join(root, rel), 'utf8');
}

const CURATED = [
  'cozy-warm-minimalism',
  'literary-and-desk',
  'kitchen-and-hosting',
  'stickers-and-caps',
];

function classList(initial) {
  const set = new Set(initial.split(/\s+/).filter(Boolean));
  return {
    add(token) { set.add(token); },
    contains(token) { return set.has(token); },
    toggle(token, force) {
      const on = force === undefined ? !set.has(token) : force;
      if (on) set.add(token);
      else set.delete(token);
    },
  };
}

function button(kind, label) {
  const attrs = { 'data-filter': kind, 'aria-pressed': 'false' };
  return {
    attrs,
    firstChild: { nodeValue: `${label} ` },
    getAttribute(name) { return attrs[name] ?? null; },
    setAttribute(name, value) { attrs[name] = value; },
    removeAttribute(name) { delete attrs[name]; },
    closest(sel) { return sel === '[data-filter]' ? this : null; },
  };
}

function section(kind, className) {
  const attrs = { 'data-shop-kind': kind };
  const node = {
    attrs,
    hidden: false,
    classList: classList(className),
    getAttribute(name) { return attrs[name] ?? null; },
    querySelectorAll(sel) {
      if (sel === '.reveal' || sel === '.product-card') return [];
      return [];
    },
  };
  return node;
}

function bootShop(hash) {
  const filters = [
    button('all', 'All'),
    button('mugs', 'Mugs'),
    button('tees', 'Tees'),
  ];
  const sections = [
    section('mugs', 'section tight shop-section'),
    section('tees', 'section tight shop-section'),
  ];
  const status = { textContent: '' };
  const urls = [];
  const bar = {
    _filters: filters,
    querySelectorAll(sel) { return sel === '[data-filter]' ? filters : []; },
    querySelector(sel) {
      const found = sel.match(/^\[data-filter="([^"]+)"\]$/);
      return found ? filters.find((item) => item.getAttribute('data-filter') === found[1]) || null : null;
    },
    contains(node) { return filters.includes(node); },
    addEventListener(type, fn) { if (type === 'click') this._onClick = fn; },
  };
  const document = {
    querySelector(sel) {
      if (sel === '[data-catalog-filters]') return bar;
      if (sel === '[data-filter-status]') return status;
      if (sel === '[data-shop-next]') return null;
      const kind = sel.match(/^\[data-shop-kind="([^"]+)"\]$/);
      if (kind) return sections.find((item) => item.getAttribute('data-shop-kind') === kind[1]) || null;
      return null;
    },
    querySelectorAll(sel) {
      if (sel === '[data-shop-kind]') return sections;
      return [];
    },
    addEventListener() {},
  };
  const history = {
    replaceState(_state, _title, url) { urls.push(url); },
  };
  const sandbox = {
    document,
    history,
    window: {
      location: { hash },
      history,
      matchMedia() { return { matches: false }; },
      addEventListener() {},
    },
    console,
  };
  vm.runInNewContext(read('site/app.js'), sandbox, { filename: 'site/app.js' });
  return {
    sections,
    urls,
    click(kind) {
      const target = filters.find((item) => item.getAttribute('data-filter') === kind);
      bar._onClick({ target, preventDefault() {} });
    },
  };
}

describe('collection bag and shop filters', () => {
  it('loads the bag catalog from the site root on collection pages', () => {
    const pages = [
      'site/collections/index.html',
      ...CURATED.map((slug) => `site/collections/${slug}/index.html`),
    ];
    for (const rel of pages) {
      const html = read(rel);
      assert.match(html, /<script type="module" src="\/bag\.js\?v=\d+"><\/script>/, rel);
    }

    const run = spawnSync(process.execPath, [
      '--experimental-vm-modules',
      '--input-type=module',
      '-e',
      `
        import vm from 'node:vm';
        import { readFileSync } from 'node:fs';
        import { join } from 'node:path';
        const root = process.env.ROOT;
        const catalog = JSON.parse(readFileSync(join(root, 'site/product-catalog.json'), 'utf8'));
        const badge = { hidden: true, textContent: '0' };
        const fetched = [];
        const storage = {
          raw: JSON.stringify([{ slug: 'ya-aini', size: 'default', quantity: 2 }]),
          getItem() { return this.raw; },
          setItem(_key, value) { this.raw = value; },
        };
        const sandbox = {
          document: {
            querySelector() { return null; },
            querySelectorAll(sel) { return sel === '.nav-bag-badge' ? [badge] : []; },
          },
          localStorage: storage,
          fetch(url) {
            fetched.push(String(url));
            return Promise.resolve({ json: async () => catalog });
          },
          console,
        };
        sandbox.window = sandbox;
        const mod = new vm.SourceTextModule(readFileSync(join(root, 'site/bag.js'), 'utf8'), {
          context: vm.createContext(sandbox),
        });
        await mod.link(() => { throw new Error('bag.js should not import'); });
        await mod.evaluate();
        await new Promise((resolve) => setTimeout(resolve, 0));
        const pages = [
          'https://habibicraftsco.com/collections/',
          'https://habibicraftsco.com/collections/cozy-warm-minimalism/',
          'https://habibicraftsco.com/collections/literary-and-desk/',
          'https://habibicraftsco.com/collections/kitchen-and-hosting/',
          'https://habibicraftsco.com/collections/stickers-and-caps/',
        ];
        const resolved = pages.map((page) => new URL(fetched[0], page).href);
        console.log(JSON.stringify({
          fetched,
          resolved,
          hidden: badge.hidden,
          text: badge.textContent,
          subtotal: sandbox.HabibiBag.subtotal(),
        }));
      `,
    ], {
      cwd: root,
      env: { ...process.env, ROOT: root },
      encoding: 'utf8',
    });
    assert.equal(run.status, 0, run.stderr || run.stdout);
    const payload = JSON.parse(run.stdout.trim().split('\n').filter((line) => line.startsWith('{')).at(-1));
    assert.deepEqual(payload.fetched, ['/product-catalog.json']);
    assert.deepEqual(payload.resolved, [
      'https://habibicraftsco.com/product-catalog.json',
      'https://habibicraftsco.com/product-catalog.json',
      'https://habibicraftsco.com/product-catalog.json',
      'https://habibicraftsco.com/product-catalog.json',
      'https://habibicraftsco.com/product-catalog.json',
    ]);
    assert.equal(payload.hidden, false);
    assert.equal(payload.text, '2');
    assert.equal(payload.subtotal, 2998);
  });

  it('shows only the selected live shop type, and All shows every section', () => {
    const shopHtml = read('site/shop.html');
    assert.doesNotMatch(shopHtml, /data-filter="hoodies"/);
    assert.doesNotMatch(shopHtml, /id="hoodies"/);

    const shop = bootShop('#mugs');
    const mugs = shop.sections[0];
    const tees = shop.sections[1];
    assert.equal(mugs.hidden, false);
    assert.equal(tees.hidden, true);

    shop.click('all');
    assert.equal(mugs.hidden, false);
    assert.equal(tees.hidden, false);

    shop.click('tees');
    assert.equal(mugs.hidden, true);
    assert.equal(tees.hidden, false);
    assert.deepEqual(shop.urls, ['shop.html', '#tees']);
  });
});
