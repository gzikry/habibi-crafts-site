(function () {
  var cfg = window.HABIBI_PUBLIC_CONFIG || {};
  var BAG_KEY = 'habibi-bag';
  if (typeof window.HABIBI_CHECKOUT_ENABLED !== 'boolean') {
    window.HABIBI_CHECKOUT_ENABLED = cfg.CHECKOUT_ENABLED === true;
  }
  var enabled =
    window.HABIBI_CHECKOUT_ENABLED === true &&
    cfg.CHECKOUT_ENABLED === true &&
    Boolean(cfg.CHECKOUT_API_BASE);

  function lock(button) {
    button.disabled = true;
    button.setAttribute('aria-disabled', 'true');
    button.setAttribute('data-checkout-enabled', 'false');
    button.classList.add('browse-mode');
    button.textContent = 'Browsing only · Checkout opens soon';
  }

  function readBag() {
    try {
      var parsed = JSON.parse(localStorage.getItem(BAG_KEY) || '[]');
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      return [];
    }
  }

  function checkoutBag(button) {
    if (!cfg.CHECKOUT_ENABLED || window.HABIBI_CHECKOUT_ENABLED !== true) return;
    var lines = readBag().filter(function (line) {
      return line && line.slug && line.quantity > 0;
    });
    if (!lines.length || !cfg.CHECKOUT_API_BASE) return;
    var total = 0;
    var items = lines.map(function (line) {
      var quantity = line.quantity;
      total += line.priceCents * quantity;
      return {
        slug: line.slug,
        size: line.size || 'default',
        quantity: quantity,
        price_cents: line.priceCents
      };
    });
    button.disabled = true;
    fetch(String(cfg.CHECKOUT_API_BASE).replace(/\/$/, '') + '/api/checkout', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        items: items,
        contact_email: '',
        idempotency_key: 'bag-' + Date.now(),
        total_amount_cents: total
      })
    }).then(function (response) {
      return response.json().then(function (body) {
        if (body.checkout_url) window.location = body.checkout_url;
        else lock(button);
      });
    }).catch(function () {
      lock(button);
    });
  }

  document.querySelectorAll('[data-checkout]').forEach(function (button) {
    if (!button.hasAttribute('data-bag-checkout') || !enabled) {
      lock(button);
      return;
    }
    button.disabled = false;
    button.removeAttribute('aria-disabled');
    button.classList.remove('browse-mode');
    button.setAttribute('data-checkout-enabled', 'true');
    button.textContent = 'Checkout';
    button.addEventListener('click', function () {
      checkoutBag(button);
    });
  });
})();
