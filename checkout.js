(function () {
  var cfg = window.HABIBI_PUBLIC_CONFIG || {};
  var enabled = cfg.CHECKOUT_ENABLED === true && Boolean(cfg.CHECKOUT_API_BASE);

  function lock(button) {
    button.disabled = true;
    button.setAttribute('aria-disabled', 'true');
    button.setAttribute('data-checkout-enabled', 'false');
  }

  document.querySelectorAll('[data-checkout]').forEach(function (button) {
    if (!enabled) {
      lock(button);
      return;
    }
    button.setAttribute('data-checkout-enabled', 'true');
    button.addEventListener('click', function () {
      if (!cfg.CHECKOUT_ENABLED) return;
      var slug = button.getAttribute('data-product-slug');
      if (!slug || !cfg.CHECKOUT_API_BASE) return;
      button.disabled = true;
      fetch(String(cfg.CHECKOUT_API_BASE).replace(/\/$/, '') + '/api/checkout', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          items: [{ slug: slug, quantity: 1 }],
          contact_email: '',
          idempotency_key: 'ui-' + Date.now()
        })
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
