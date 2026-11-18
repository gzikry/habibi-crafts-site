(function () {
  var cfg = window.HABIBI_PUBLIC_CONFIG || {};
  if (typeof window.HABIBI_CHECKOUT_ENABLED !== 'boolean') {
    window.HABIBI_CHECKOUT_ENABLED = cfg.CHECKOUT_ENABLED === true;
  }
  var enabled =
    window.HABIBI_CHECKOUT_ENABLED === true &&
    cfg.CHECKOUT_ENABLED === true &&
    Boolean(cfg.CHECKOUT_API_BASE);
  var SUCCESS = 'Thank you, your order is in. Your receipt is on its way by email.';
  var CANCELLED = "Checkout cancelled. Your bag is saved for when you're ready.";
  var UNCONFIRMED = "We couldn't confirm your order yet. If your payment went through, your receipt will arrive by email. Your bag is still here.";

  function lock(button) {
    button.disabled = true;
    button.setAttribute('aria-disabled', 'true');
    button.setAttribute('data-checkout-enabled', 'false');
    button.classList.add('browse-mode');
    button.textContent = 'Opening soon';
  }

  function fail(button) {
    button.disabled = false;
    button.removeAttribute('aria-disabled');
    button.classList.remove('browse-mode');
    button.textContent = 'Check out';
    var host = button.parentNode || document.querySelector('main');
    if (!host || !host.appendChild) return;
    var note = host.querySelector('[data-checkout-error]');
    if (!note) {
      note = document.createElement('p');
      note.className = 'checkout-note';
      note.setAttribute('role', 'status');
      note.setAttribute('data-checkout-error', '');
      host.appendChild(note);
    }
    note.textContent = 'Something went wrong. Please try again.';
  }

  function openButton(button) {
    button.disabled = false;
    button.removeAttribute('aria-disabled');
    button.classList.remove('browse-mode');
    button.setAttribute('data-checkout-enabled', 'true');
    if (button.textContent === 'Opening soon') button.textContent = 'Check out';
  }

  function stripCheckoutParams() {
    if (!window.history || !window.history.replaceState || !window.location) return;
    var url = new URL(window.location.href);
    if (!url.searchParams.has('checkout') && !url.searchParams.has('session_id')) return;
    url.searchParams.delete('checkout');
    url.searchParams.delete('session_id');
    window.history.replaceState({}, '', url.pathname + url.search + url.hash);
  }

  function showNotice(kind, message) {
    var main = document.querySelector('main');
    if (!main || main.querySelector('[data-checkout-return]')) return;
    var shell = document.createElement('div');
    shell.className = 'shell';
    var wrap = document.createElement('div');
    wrap.className = 'hold-panel';
    wrap.setAttribute('data-checkout-return', kind);
    var note = document.createElement('p');
    note.className = 'lede';
    note.setAttribute('role', 'status');
    wrap.appendChild(note);
    var dismiss = document.createElement('button');
    dismiss.type = 'button';
    dismiss.className = 'bag-remove';
    dismiss.textContent = 'Dismiss';
    dismiss.addEventListener('click', function () {
      if (shell.parentNode) shell.parentNode.removeChild(shell);
      if (!main.hasAttribute('tabindex')) main.setAttribute('tabindex', '-1');
      if (main.focus) main.focus();
    });
    wrap.appendChild(dismiss);
    shell.appendChild(wrap);
    main.insertBefore(shell, main.firstChild);
    setTimeout(function () {
      note.textContent = message;
    }, 0);
  }

  function clearBag() {
    localStorage.setItem('habibi-bag', '[]');
    if (window.HabibiBag && window.HabibiBag.clear) window.HabibiBag.clear();
  }

  function handleReturn() {
    var params = new URLSearchParams(window.location.search);
    var checkoutState = params.get('checkout');
    if (checkoutState !== 'success' && checkoutState !== 'cancelled') return;
    if (checkoutState === 'cancelled') {
      showNotice('cancelled', CANCELLED);
      stripCheckoutParams();
      return;
    }
    var sessionId = params.get('session_id');
    if (!sessionId) {
      showNotice('unconfirmed', UNCONFIRMED);
      stripCheckoutParams();
      return;
    }
    var base = String(cfg.CHECKOUT_API_BASE).replace(/\/$/, '');
    var controller = new AbortController();
    var timer = setTimeout(function () {
      controller.abort();
    }, 9000);
    fetch(base + '/api/checkout-session?session_id=' + encodeURIComponent(sessionId), {
      signal: controller.signal
    })
      .then(function (response) {
        return response.json().then(function (body) {
          return { ok: response.ok, body: body };
        });
      })
      .then(function (result) {
        clearTimeout(timer);
        if (result.ok && result.body && result.body.payment_status === 'paid') {
          clearBag();
          showNotice('success', SUCCESS);
        } else {
          showNotice('unconfirmed', UNCONFIRMED);
        }
        stripCheckoutParams();
      })
      .catch(function () {
        clearTimeout(timer);
        showNotice('unconfirmed', UNCONFIRMED);
        stripCheckoutParams();
      });
  }

  if (enabled) handleReturn();

  document.querySelectorAll('[data-checkout]').forEach(function (button) {
    if (!enabled) {
      lock(button);
      return;
    }
    openButton(button);
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
          if (response.ok && body && body.checkout_url) window.location = body.checkout_url;
          else fail(button);
        }, function () {
          fail(button);
        });
      }).catch(function () {
        fail(button);
      });
    });
  });
})();
