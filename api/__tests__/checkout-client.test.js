import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const checkoutSource = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), '../../site/checkout.js'),
  'utf8'
);

const RECEIVED = 'Thank you, your order is in. Your receipt is on its way by email.';
const UNCONFIRMED = "We couldn't confirm your order yet. If your payment went through, your receipt will arrive by email. Your bag is still here.";
const CANCELLED = "Checkout cancelled. Your bag is saved for when you're ready.";
const CLOSED = "We're not taking orders yet.";
const OPEN_FAQ = 'Yes. Add a piece from the shop to your bag and check out.';
const BAG_KEY = 'habibi-bag';
const STORED_BAG = JSON.stringify([{ slug: 'ya-aini', size: 'default', quantity: 1 }]);

function createElement(tag) {
  const el = {
    tag,
    disabled: false,
    textContent: '',
    className: '',
    attrs: {},
    children: [],
    parentNode: null,
    listeners: {},
    get firstChild() {
      return this.children[0] || null;
    },
    setAttribute(name, value) {
      this.attrs[name] = String(value);
    },
    getAttribute(name) {
      return Object.prototype.hasOwnProperty.call(this.attrs, name) ? this.attrs[name] : null;
    },
    hasAttribute(name) {
      return Object.prototype.hasOwnProperty.call(this.attrs, name);
    },
    appendChild(child) {
      child.parentNode = this;
      this.children.push(child);
      return child;
    },
    insertBefore(child, ref) {
      const status = queryAll(child, '[role=status]')[0];
      child.statusTextAtInsert = status ? status.textContent : '';
      child.parentNode = this;
      const index = this.children.indexOf(ref);
      if (index < 0) this.children.push(child);
      else this.children.splice(index, 0, child);
      return child;
    },
    removeChild(child) {
      const index = this.children.indexOf(child);
      if (index >= 0) this.children.splice(index, 1);
      child.parentNode = null;
      return child;
    },
    removeAttribute(name) {
      delete this.attrs[name];
    },
    addEventListener(type, fn) {
      (this.listeners[type] ||= []).push(fn);
    },
    click() {
      if (this.disabled) return;
      for (const fn of this.listeners.click || []) fn();
    },
    focus() {
      this.focused = true;
    }
  };
  el.classList = {
    add(name) {
      el.className = `${el.className} ${name}`.trim();
    },
    remove(name) {
      el.className = el.className.split(/\s+/).filter((part) => part && part !== name).join(' ');
    }
  };
  el.querySelector = (selector) => queryAll(el, selector)[0] || null;
  el.querySelectorAll = (selector) => queryAll(el, selector);
  return el;
}

function matches(el, selector) {
  if (selector === 'main') return el.tag === 'main';
  if (selector === 'p') return el.tag === 'p';
  if (selector === '.lede') return String(el.className).split(/\s+/).includes('lede');
  if (selector === '[data-checkout]') return el.hasAttribute('data-checkout');
  if (selector === '[data-checkout-return]') return el.hasAttribute('data-checkout-return');
  if (selector === '[role=status]') return el.getAttribute('role') === 'status';
  if (selector === 'button') return el.tag === 'button';
  return false;
}

function queryAll(root, selector) {
  const found = [];
  for (const child of root.children || []) {
    if (matches(child, selector)) found.push(child);
    found.push(...queryAll(child, selector));
  }
  return found;
}

function bootCheckout({ enabled, search, path = '/cart.html', buttonDisabled = true, paymentStatus = 'paid' }) {
  const store = { [BAG_KEY]: STORED_BAG };
  const localStorage = {
    getItem(key) {
      return Object.prototype.hasOwnProperty.call(store, key) ? store[key] : null;
    },
    setItem(key, value) {
      store[key] = String(value);
    },
    removeItem(key) {
      delete store[key];
    }
  };
  const lede = createElement('p');
  lede.className = 'lede';
  lede.textContent = CLOSED;
  const faq = createElement('p');
  faq.textContent = CLOSED;
  const main = createElement('main');
  main.appendChild(lede);
  main.appendChild(faq);
  const button = createElement('button');
  button.disabled = buttonDisabled;
  button.textContent = 'Opening soon';
  button.className = 'button browse-mode';
  button.setAttribute('data-checkout', '');
  button.setAttribute('data-bag-checkout', '');
  button.setAttribute('aria-disabled', 'true');
  const document = {
    children: [main, button],
    createElement,
    querySelector(selector) {
      return queryAll(this, selector)[0] || null;
    },
    querySelectorAll(selector) {
      return queryAll(this, selector);
    }
  };
  const fetched = [];
  const replaced = [];
  const timers = [];
  const location = { search, href: `https://habibicraftsco.com${path}${search}` };
  const cleared = { called: false };
  const window = {
    HABIBI_PUBLIC_CONFIG: {
      CHECKOUT_ENABLED: enabled,
      CHECKOUT_API_BASE: enabled ? 'https://habibicraftsco.com' : ''
    },
    HABIBI_CHECKOUT_ENABLED: enabled,
    HabibiBag: {
      checkoutItems() {
        return [{ slug: 'ya-aini', size: 'default', quantity: 1, price_cents: 1499 }];
      },
      clear() {
        cleared.called = true;
        store[BAG_KEY] = '[]';
      }
    },
    location,
    history: {
      replaceState(_state, _title, url) {
        replaced.push(String(url));
      }
    }
  };
  const context = {
    window,
    document,
    localStorage,
    URL,
    URLSearchParams,
    encodeURIComponent,
    AbortController,
    setTimeout(fn, delay) {
      if (delay >= 1000) {
        const handle = { fn, delay, cleared: false };
        timers.push(handle);
        return handle;
      }
      return setTimeout(fn, delay);
    },
    clearTimeout(handle) {
      if (handle && typeof handle === 'object') {
        handle.cleared = true;
        return;
      }
      clearTimeout(handle);
    },
    fetch(url, init) {
      fetched.push({ url: String(url), init });
      if (String(url).includes('/api/checkout-session')) {
        if (paymentStatus === 'throw') return Promise.reject(new Error('network'));
        if (paymentStatus === 'hang') {
          return new Promise((_resolve, reject) => {
            const signal = init && init.signal;
            const fail = () => reject(Object.assign(new Error('aborted'), { name: 'AbortError' }));
            if (!signal) return;
            if (signal.aborted) fail();
            else signal.addEventListener('abort', fail);
          });
        }
        return Promise.resolve({
          ok: paymentStatus !== 'http',
          json: () => Promise.resolve({ id: 'cs_test', payment_status: paymentStatus, status: 'complete' })
        });
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ checkout_url: 'https://checkout.stripe.com/c/pay/cs_test' })
      });
    }
  };
  vm.createContext(context);
  vm.runInContext(checkoutSource, context);
  return { store, button, main, lede, faq, fetched, location, replaced, cleared, timers };
}

function statusNode(main) {
  const wrap = main.querySelector('[data-checkout-return]');
  if (!wrap) return null;
  return wrap.querySelector('[role=status]');
}

function flush() {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

async function settle() {
  await flush();
  await flush();
}

describe('checkout client', () => {
  it('leaves the bag and the closed copy alone while checkout is off', () => {
    const page = bootCheckout({ enabled: false, search: '?checkout=success&session_id=cs_test' });
    assert.equal(page.store[BAG_KEY], STORED_BAG);
    assert.equal(page.main.querySelector('[data-checkout-return]'), null);
    assert.equal(page.lede.textContent, CLOSED);
    assert.equal(page.faq.textContent, CLOSED);
    assert.equal(page.button.textContent, 'Opening soon');
    assert.equal(page.button.disabled, true);
    assert.deepEqual(page.replaced, []);
    page.button.click();
    assert.equal(page.fetched.length, 0);
  });

  it('drops the closed cart copy when checkout is on', () => {
    const page = bootCheckout({ enabled: true, search: '' });
    assert.equal(page.lede.textContent, '');
    assert.equal(page.faq.textContent, OPEN_FAQ);
    assert.equal(page.button.textContent, 'Check out');
    assert.equal(page.button.disabled, false);
    assert.equal(page.store[BAG_KEY], STORED_BAG);
  });

  it('omits contact_email so Stripe Checkout collects it', async () => {
    const page = bootCheckout({ enabled: true, search: '' });
    page.button.click();
    await flush();
    const post = page.fetched.find((call) => String(call.url).endsWith('/api/checkout'));
    const payload = JSON.parse(post.init.body);
    assert.equal('contact_email' in payload, false);
    assert.equal(payload.items[0].slug, 'ya-aini');
    assert.match(payload.idempotency_key, /^ui-/);
  });

  it('clears the bag only after a paid session and then strips the return params', async () => {
    const page = bootCheckout({
      enabled: true,
      path: '/',
      search: '?checkout=success&session_id=cs_test'
    });
    assert.equal(page.store[BAG_KEY], STORED_BAG);
    await settle();
    assert.equal(page.store[BAG_KEY], '[]');
    assert.equal(page.cleared.called, true);
    const shell = page.main.children[0];
    assert.equal(shell.className, 'shell');
    assert.equal(shell.statusTextAtInsert, '');
    const wrap = shell.querySelector('[data-checkout-return]');
    assert.equal(wrap.className, 'hold-panel');
    const note = statusNode(page.main);
    assert.equal(note.className, 'lede');
    assert.equal(note.textContent, RECEIVED);
    assert.equal(note.getAttribute('role'), 'status');
    assert.deepEqual(page.replaced, ['/']);
    const dismiss = wrap.querySelector('button');
    dismiss.click();
    assert.equal(page.main.querySelector('[data-checkout-return]'), null);
    assert.equal(page.main.getAttribute('tabindex'), '-1');
    assert.equal(page.main.focused, true);
  });

  it('keeps the bag and explains when the payment cannot be confirmed', async () => {
    const missing = bootCheckout({ enabled: true, path: '/', search: '?checkout=success' });
    await settle();
    assert.equal(missing.store[BAG_KEY], STORED_BAG);
    assert.equal(missing.fetched.length, 0);
    assert.equal(statusNode(missing.main).textContent, UNCONFIRMED);
    assert.deepEqual(missing.replaced, ['/']);

    const unpaid = bootCheckout({
      enabled: true,
      path: '/',
      search: '?checkout=success&session_id=cs_unpaid',
      paymentStatus: 'unpaid'
    });
    await settle();
    assert.equal(unpaid.store[BAG_KEY], STORED_BAG);
    assert.equal(unpaid.cleared.called, false);
    assert.equal(statusNode(unpaid.main).textContent, UNCONFIRMED);
    assert.equal(unpaid.fetched[0].url, 'https://habibicraftsco.com/api/checkout-session?session_id=cs_unpaid');
    assert.deepEqual(unpaid.replaced, ['/']);

    const failed = bootCheckout({
      enabled: true,
      path: '/',
      search: '?checkout=success&session_id=cs_down',
      paymentStatus: 'throw'
    });
    await settle();
    assert.equal(failed.store[BAG_KEY], STORED_BAG);
    assert.equal(statusNode(failed.main).textContent, UNCONFIRMED);
    assert.deepEqual(failed.replaced, ['/']);
  });

  it('shows the unconfirmed notice when the session check times out', async () => {
    const page = bootCheckout({
      enabled: true,
      path: '/',
      search: '?checkout=success&session_id=cs_slow',
      paymentStatus: 'hang'
    });
    assert.equal(page.timers.length, 1);
    assert.ok(page.timers[0].delay >= 8000 && page.timers[0].delay <= 10000);
    assert.equal(page.fetched[0].init.signal.aborted, false);
    page.timers[0].fn();
    await settle();
    assert.equal(page.fetched[0].init.signal.aborted, true);
    assert.equal(page.store[BAG_KEY], STORED_BAG);
    assert.equal(page.cleared.called, false);
    assert.equal(statusNode(page.main).textContent, UNCONFIRMED);
    assert.equal(page.main.children[0].className, 'shell');
    assert.deepEqual(page.replaced, ['/']);
  });

  it('keeps the bag on cancel, shows the saved-bag note, and strips the param', async () => {
    const page = bootCheckout({ enabled: true, search: '?checkout=cancelled' });
    await settle();
    assert.equal(page.store[BAG_KEY], STORED_BAG);
    assert.equal(page.cleared.called, false);
    const note = statusNode(page.main);
    assert.equal(note.textContent, CANCELLED);
    assert.equal(page.main.children[0].className, 'shell');
    assert.equal(page.main.children[0].statusTextAtInsert, '');
    assert.equal(page.fetched.length, 0);
    assert.deepEqual(page.replaced, ['/cart.html']);
  });
});
