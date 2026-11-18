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

const RECEIVED = 'Order received, thank you. A confirmation email is on its way.';
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
      child.parentNode = this;
      const index = this.children.indexOf(ref);
      if (index < 0) this.children.push(child);
      else this.children.splice(index, 0, child);
      return child;
    },
    addEventListener(type, fn) {
      (this.listeners[type] ||= []).push(fn);
    },
    click() {
      if (this.disabled) return;
      for (const fn of this.listeners.click || []) fn();
    }
  };
  el.classList = {
    add(name) {
      el.className = `${el.className} ${name}`.trim();
    }
  };
  el.querySelector = (selector) => queryAll(el, selector)[0] || null;
  el.querySelectorAll = (selector) => queryAll(el, selector);
  return el;
}

function matches(el, selector) {
  if (selector === 'main') return el.tag === 'main';
  if (selector === '[data-checkout]') return el.hasAttribute('data-checkout');
  if (selector === '[data-checkout-return]') return el.hasAttribute('data-checkout-return');
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

function bootCheckout({ enabled, search, buttonDisabled = true }) {
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
  const main = createElement('main');
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
  const location = { search, href: `https://habibicraftsco.com/${search}` };
  const window = {
    HABIBI_PUBLIC_CONFIG: {
      CHECKOUT_ENABLED: enabled,
      CHECKOUT_API_BASE: enabled ? 'https://habibicraftsco.com' : ''
    },
    HABIBI_CHECKOUT_ENABLED: enabled,
    HabibiBag: {
      checkoutItems() {
        return [{ slug: 'ya-aini', size: 'default', quantity: 1, price_cents: 1499 }];
      }
    },
    location
  };
  const context = {
    window,
    document,
    localStorage,
    URLSearchParams,
    fetch(url, init) {
      fetched.push({ url, init });
      return Promise.resolve({
        json: () => Promise.resolve({ checkout_url: 'https://checkout.stripe.com/c/pay/cs_test' })
      });
    }
  };
  vm.createContext(context);
  vm.runInContext(checkoutSource, context);
  return { store, button, main, fetched, location };
}

describe('checkout client', () => {
  it('leaves the bag and the page alone while checkout is off', () => {
    const page = bootCheckout({ enabled: false, search: '?checkout=success&session_id=cs_test' });
    assert.equal(page.store[BAG_KEY], STORED_BAG);
    assert.equal(page.main.querySelector('[data-checkout-return]'), null);
    assert.equal(page.button.textContent, 'Opening soon');
    assert.equal(page.button.disabled, true);
    page.button.click();
    assert.equal(page.fetched.length, 0);
  });

  it('omits contact_email so Stripe Checkout collects it', async () => {
    const page = bootCheckout({ enabled: true, search: '', buttonDisabled: false });
    page.button.click();
    await Promise.resolve();
    assert.equal(page.fetched.length, 1);
    const payload = JSON.parse(page.fetched[0].init.body);
    assert.equal('contact_email' in payload, false);
    assert.equal(payload.items[0].slug, 'ya-aini');
    assert.match(payload.idempotency_key, /^ui-/);
  });

  it('clears the bag and confirms the order after checkout=success', () => {
    const page = bootCheckout({
      enabled: true,
      search: '?checkout=success&session_id=cs_test'
    });
    assert.equal(page.store[BAG_KEY], '[]');
    const note = page.main.querySelector('[data-checkout-return]');
    assert.equal(note.textContent, RECEIVED);
    assert.equal(note.getAttribute('role'), 'status');
  });

  it('keeps the bag when checkout is cancelled', () => {
    const page = bootCheckout({ enabled: true, search: '?checkout=cancelled' });
    assert.equal(page.store[BAG_KEY], STORED_BAG);
    assert.equal(page.main.querySelector('[data-checkout-return]'), null);
  });
});
