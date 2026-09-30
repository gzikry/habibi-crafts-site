(function () {
  var cfg = window.HABIBI_PUBLIC_CONFIG || {};
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

  document.querySelectorAll('[data-checkout]').forEach(function (button) {
    if (!enabled) {
      lock(button);
      return;
    }
    button.setAttribute('data-checkout-enabled', 'true');
    button.addEventListener('click', function () {
      if (!cfg.CHECKOUT_ENABLED || window.HABIBI_CHECKOUT_ENABLED !== true) return;
      var items;
      if (button.hasAttribute('data-bag-checkout')) {
        var bag = window.HabibiBag;
        items = bag && bag.checkoutItems ? bag.checkoutItems() : [];
      } else {
        var slug = button.getAttribute('data-product-slug');
        if (!slug) return;
        items = [{ slug: slug, quantity: 1 }];
      }
      if (!items.length || !cfg.CHECKOUT_API_BASE) return;
      var payload = {
        items: items,
        contact_email: '',
        idempotency_key: 'ui-' + Date.now()
      };
      if (items.every(function (item) { return typeof item.price_cents === 'number'; })) {
        payload.total_amount_cents = items.reduce(function (sum, item) {
          return sum + item.price_cents * item.quantity;
        }, 0);
      }
      button.disabled = true;
      fetch(String(cfg.CHECKOUT_API_BASE).replace(/\/$/, '') + '/api/checkout', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload)
      }).then(function (response) {
        return response.json().then(function (body) {
          if (body.checkout_url) window.location = body.checkout_url;
          else lock(button);
        });
      }).catch(function () {
        lock(button);
      });
    });
  });
})();
