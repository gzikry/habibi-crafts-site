var KEY = 'habibi-bag';
export var FREE_AT = 3900;
export var SHIPPING_CENTS = 699;

export function formatCents(cents) {
  var negative = cents < 0;
  var n = Math.abs(cents);
  var text = '$' + Math.floor(n / 100) + '.' + String(n % 100).padStart(2, '0');
  return negative ? '-' + text : text;
}

export function shippingProgress(cents) {
  if (cents >= FREE_AT) return "You've got free US shipping";
  return 'Add ' + formatCents(FREE_AT - cents) + ' for free US shipping';
}

export function shippingCharge(cents) {
  if (cents >= FREE_AT) return 'Shipping Free';
  return 'Shipping ' + formatCents(SHIPPING_CENTS);
}

function boot() {
  var bySlug = {};
  var state = [];

  function save() {
    localStorage.setItem(KEY, JSON.stringify(state));
    badge();
    render();
  }

  function count() {
    return state.reduce(function (sum, line) { return sum + line.quantity; }, 0);
  }

  function subtotal() {
    return state.reduce(function (sum, line) {
      var product = bySlug[line.slug];
      return sum + (product ? product.price * line.quantity : 0);
    }, 0);
  }

  function checkoutItems() {
    return state.map(function (line) {
      return {
        slug: line.slug,
        size: line.size,
        quantity: line.quantity,
        price_cents: bySlug[line.slug].price
      };
    });
  }

  function badge() {
    var n = count();
    Array.prototype.forEach.call(document.querySelectorAll('.nav-bag-badge'), function (el) {
      el.textContent = String(n);
      el.hidden = n < 1;
    });
  }

  function selectedSize(from) {
    var scope = from && from.closest('main') || document;
    var pressed = scope.querySelector('[data-size-picker] [data-size][aria-pressed="true"]');
    return pressed ? pressed.getAttribute('data-size') : 'default';
  }

  function add(slug, size) {
    var product = bySlug[slug];
    if (!product || product.purchasable !== true) return false;
    size = size || 'default';
    var found = state.find(function (line) { return line.slug === slug && line.size === size; });
    if (found) {
      if (found.quantity < 20) found.quantity += 1;
    } else {
      state.push({ slug: slug, size: size, quantity: 1 });
    }
    save();
    return true;
  }

  function render() {
    var root = document.querySelector('[data-bag]');
    if (!root) return;
    var lines = root.querySelector('[data-bag-lines]');
    var empty = root.querySelector('[data-bag-empty]');
    var summary = root.querySelector('[data-bag-summary]');
    var sub = root.querySelector('[data-bag-subtotal]');
    var progress = root.querySelector('[data-bag-progress]');
    if (!lines) return;
    lines.textContent = '';
    if (!state.length) {
      if (empty) empty.hidden = false;
      if (summary) summary.hidden = true;
      return;
    }
    if (empty) empty.hidden = true;
    if (summary) summary.hidden = false;
    state.forEach(function (line, index) {
      var product = bySlug[line.slug];
      var row = document.createElement('div');
      row.className = 'bag-line';
      var img = document.createElement('img');
      img.src = product.image || ('assets/mockups/' + line.slug + '.png');
      img.alt = '';
      img.width = 72;
      img.height = 72;
      var copy = document.createElement('div');
      copy.className = 'bag-line-copy';
      var title = document.createElement('h2');
      title.textContent = product.name;
      var meta = document.createElement('p');
      var sizeText = line.size && line.size !== 'default' ? line.size + ' · ' : '';
      meta.textContent = sizeText + formatCents(product.price);
      var qty = document.createElement('div');
      qty.className = 'bag-qty';
      var minus = document.createElement('button');
      minus.type = 'button';
      minus.className = 'bag-qty-btn';
      minus.textContent = '−';
      minus.setAttribute('aria-label', 'Decrease ' + product.name);
      minus.disabled = line.quantity <= 1;
      minus.addEventListener('click', function () {
        if (line.quantity > 1) {
          line.quantity -= 1;
          save();
        }
      });
      var amount = document.createElement('span');
      amount.textContent = String(line.quantity);
      var plus = document.createElement('button');
      plus.type = 'button';
      plus.className = 'bag-qty-btn';
      plus.textContent = '+';
      plus.setAttribute('aria-label', 'Increase ' + product.name);
      plus.disabled = line.quantity >= 20;
      plus.addEventListener('click', function () {
        if (line.quantity < 20) {
          line.quantity += 1;
          save();
        }
      });
      var remove = document.createElement('button');
      remove.type = 'button';
      remove.className = 'bag-remove';
      remove.textContent = 'Remove';
      remove.addEventListener('click', function () {
        state.splice(index, 1);
        save();
      });
      qty.append(minus, amount, plus, remove);
      copy.append(title, meta, qty);
      var lineTotal = document.createElement('p');
      lineTotal.className = 'bag-line-total';
      lineTotal.textContent = formatCents(product.price * line.quantity);
      row.append(img, copy, lineTotal);
      lines.append(row);
    });
    var cents = subtotal();
    if (sub) sub.textContent = 'Subtotal ' + formatCents(cents);
    var ship = root.querySelector('[data-bag-shipping]');
    if (ship) ship.textContent = shippingCharge(cents);
    if (progress) {
      var label = progress.querySelector('[data-bag-progress-label]');
      var bar = progress.querySelector('[data-bag-progress-bar]');
      var free = cents >= FREE_AT;
      progress.classList.toggle('is-free', free);
      if (label) label.textContent = shippingProgress(cents);
      if (bar) {
        var pct = Math.max(0, Math.min(100, (cents / FREE_AT) * 100));
        bar.style.width = pct + '%';
      }
    }
  }

  function wireAdd() {
    Array.prototype.forEach.call(document.querySelectorAll('[data-checkout][data-product-slug]'), function (checkout) {
      var slug = checkout.getAttribute('data-product-slug');
      var product = bySlug[slug];
      if (!product || product.purchasable !== true) return;
      if (checkout.previousElementSibling && checkout.previousElementSibling.hasAttribute('data-add-bag')) return;
      var button = document.createElement('button');
      button.type = 'button';
      button.className = 'button';
      button.setAttribute('data-add-bag', '');
      button.textContent = 'Add to bag';
      var addedTimer = 0;
      button.addEventListener('click', function () {
        if (!add(slug, selectedSize(checkout))) return;
        button.textContent = 'Added';
        var note = button.parentNode.querySelector('[data-added-note]');
        if (!note) {
          note = document.createElement('p');
          note.className = 'added-note';
          note.setAttribute('data-added-note', '');
          var link = document.createElement('a');
          link.href = 'cart.html';
          link.textContent = 'View bag';
          note.append('Added to your bag. ', link);
          checkout.insertAdjacentElement('afterend', note);
        }
        clearTimeout(addedTimer);
        addedTimer = setTimeout(function () {
          button.textContent = 'Add to bag';
        }, 2000);
      });
      checkout.parentNode.insertBefore(button, checkout);
    });
  }

  window.HabibiBag = {
    checkoutItems: checkoutItems,
    formatCents: formatCents,
    shippingProgress: shippingProgress,
    subtotal: subtotal
  };

  fetch('product-catalog.json')
    .then(function (response) { return response.json(); })
    .then(function (catalog) {
      catalog.forEach(function (product) { bySlug[product.slug] = product; });
      var raw = [];
      try { raw = JSON.parse(localStorage.getItem(KEY) || '[]'); } catch (e) { raw = []; }
      if (!Array.isArray(raw)) raw = [];
      state = raw.filter(function (line) {
        var product = bySlug[line.slug];
        var quantity = Number(line.quantity);
        return product && product.purchasable === true &&
          Number.isInteger(quantity) && quantity >= 1 && quantity <= 20 &&
          typeof line.size === 'string';
      }).map(function (line) {
        return { slug: line.slug, size: line.size, quantity: line.quantity };
      });
      localStorage.setItem(KEY, JSON.stringify(state));
      wireAdd();
      badge();
      render();
    });
}

if (typeof document !== 'undefined') boot();
