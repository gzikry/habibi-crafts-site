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

function specificity(selector) {
  const nots = [];
  const stripped = selector.replace(/:not\(([^)]+)\)/g, (_, inner) => {
    nots.push(inner);
    return '';
  });
  let ids = (stripped.match(/#[\w-]+/g) || []).length;
  let attrs = (stripped.match(/\.[\w-]+/g) || []).length;
  attrs += (stripped.match(/\[[^\]]+\]/g) || []).length;
  attrs += (stripped.match(/:[\w-]+/g) || []).length;
  let types = (stripped.match(/(^|[\s>+~])[a-zA-Z][\w-]*/g) || []).length;
  for (const inner of nots) {
    const [innerIds, innerAttrs, innerTypes] = specificity(inner);
    ids += innerIds;
    attrs += innerAttrs;
    types += innerTypes;
  }
  return [ids, attrs, types];
}

function matches(selector, state) {
  const withoutNot = selector.replace(/:not\([^)]+\)/g, '');
  if (withoutNot.includes('::') || /[ >+~]/.test(withoutNot)) return false;
  const nots = [];
  const base = selector.replace(/:not\(([^)]+)\)/g, (_, inner) => {
    nots.push(inner.trim());
    return '';
  });
  for (const inner of nots) {
    if (matches(inner, state)) return false;
  }
  const tokens = base.match(/#[\w-]+|\.[\w-]+|\[[^\]]+\]|:[a-zA-Z-]+|[a-zA-Z][\w-]*/g) || [];
  if (!tokens.length) return false;
  const consumed = base.replace(/#[\w-]+|\.[\w-]+|\[[^\]]+\]|:[a-zA-Z-]+|[a-zA-Z][\w-]*/g, '');
  if (consumed.trim() !== '') return false;
  for (const token of tokens) {
    if (token.startsWith('#')) {
      if (token.slice(1) !== state.id) return false;
    } else if (token.startsWith('.')) {
      if (!state.classes.has(token.slice(1))) return false;
    } else if (token === '[hidden]') {
      if (!state.hidden) return false;
    } else if (token === ':target') {
      if (!state.target) return false;
    } else if (token === 'section') {
      if (state.tag !== 'section') return false;
    } else {
      return false;
    }
  }
  return true;
}

function authorDisplay(css, state) {
  const rules = [];
  const re = /([^{}]+)\{([^{}]*)\}/g;
  css = css.replace(/\/\*[\s\S]*?\*\//g, '');
  let match;
  let index = 0;
  while ((match = re.exec(css))) {
    const display = match[2].match(/(?:^|;)\s*display\s*:\s*([^;]+)/);
    if (!display) continue;
    const important = display[1].includes('!important');
    const value = display[1].replace('!important', '').trim();
    for (const part of match[1].split(',')) {
      const selector = part.trim();
      if (!selector || selector.startsWith('@')) continue;
      rules.push({ selector, display: value, important, index: index++ });
    }
  }
  let winner = null;
  for (const rule of rules) {
    if (!matches(rule.selector, state)) continue;
    if (!winner) {
      winner = rule;
      continue;
    }
    const spec = specificity(rule.selector);
    const best = specificity(winner.selector);
    const cmp = spec[0] - best[0] || spec[1] - best[1] || spec[2] - best[2];
    const wins = (rule.important && !winner.important)
      || (rule.important === winner.important && (cmp > 0 || (cmp === 0 && rule.index > winner.index)));
    if (wins) winner = rule;
  }
  return winner ? winner.display : 'visible-default';
}

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
    button('hoodies', 'Hoodies'),
  ];
  const sections = [
    section('mugs', 'section tight shop-section'),
    section('hoodies', 'section tight shop-section workbench-panel is-parked'),
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

describe('collection bag and hoodie filter', () => {
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

  it('hides hoodies after shop.html#hoodies when the filter switches to Mugs or All', () => {
    const css = read('site/styles.css');
    const hoodieClasses = new Set(['section', 'tight', 'shop-section', 'workbench-panel', 'is-parked']);
    const parked = {
      tag: 'section',
      id: 'hoodies',
      classes: hoodieClasses,
      target: true,
      hidden: false,
    };
    assert.equal(authorDisplay(css, parked), 'block', 'no-JS #hoodies still opens');

    const shop = bootShop('#hoodies');
    const hoodies = shop.sections[1];
    const mugs = shop.sections[0];
    assert.equal(hoodies.hidden, false);
    assert.equal(hoodies.classList.contains('is-parked'), false);

    for (const kind of ['mugs', 'all']) {
      shop.click(kind);
      assert.equal(hoodies.hidden, true, kind);
      assert.equal(hoodies.classList.contains('is-parked'), true, kind);
      assert.equal(mugs.hidden, false, kind);
      assert.equal(authorDisplay(css, {
        tag: 'section',
        id: 'hoodies',
        classes: hoodieClasses,
        target: true,
        hidden: true,
      }), 'none', kind);
    }
    assert.deepEqual(shop.urls, ['#mugs', 'shop.html']);
  });
});
