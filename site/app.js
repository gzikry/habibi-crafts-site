(function(){
  var toggle=document.querySelector('.menu-toggle');
  var nav=document.querySelector('.nav-links');

  function setMenu(open){
    if(!toggle||!nav) return;
    toggle.setAttribute('aria-expanded',String(open));
    toggle.setAttribute('aria-label',open?'Close menu':'Open menu');
    nav.classList.toggle('open',open);
  }

  function revealMobileShop(open){
    if(!nav||!open) return;
    if(!window.matchMedia('(max-width:900px)').matches) return;
    var shop=nav.querySelector('.nav-shop');
    if(shop) shop.open=true;
  }

  if(toggle&&nav){
    toggle.addEventListener('click',function(){
      var open=toggle.getAttribute('aria-expanded')!=='true';
      setMenu(open);
      revealMobileShop(open);
    });
    nav.addEventListener('click',function(e){
      if(e.target.closest('a')) setMenu(false);
    });
    document.addEventListener('keydown',function(e){
      if(e.key==='Escape') setMenu(false);
    });
    document.addEventListener('click',function(e){
      if(toggle.getAttribute('aria-expanded')!=='true') return;
      if(e.target.closest('.nav')) return;
      setMenu(false);
    });
  }

  var header=document.querySelector('.site-header');
  if(header){
    var ticking=false;
    function updateHeader(){
      var scrollY=window.pageYOffset||document.documentElement.scrollTop;
      header.classList.toggle('scrolled',scrollY>10);
      ticking=false;
    }
    window.addEventListener('scroll',function(){
      if(!ticking){requestAnimationFrame(updateHeader);ticking=true;}
    },{passive:true});
    updateHeader();
  }

  // Reveal-on-scroll. Content is visible by default in CSS; we only opt into
  // the hidden state once we know JS can reveal it again, so a broken script
  // can never leave products invisible.
  //
  // A scroll-driven check is used rather than IntersectionObserver: the
  // observer samples at frame boundaries and skips elements during a fast
  // fling, leaving cards permanently hidden. A direct rect test is exact and
  // only runs over the handful of .reveal nodes on the page.
  var reveals = document.querySelectorAll('.reveal');
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  if (reveals.length && !reduceMotion) {
    document.documentElement.classList.add('js-reveal');

    var pending = Array.prototype.slice.call(reveals);
    var queued = false;

    var sweep = function () {
      queued = false;
      var vh = window.innerHeight || document.documentElement.clientHeight;
      var still = [];
      for (var i = 0; i < pending.length; i++) {
        var el = pending[i];
        var r = el.getBoundingClientRect();
        // reveal once any part has entered the viewport (or passed above it)
        if (r.top < vh - 30 && r.bottom > -200) {
          el.classList.add('visible');
        } else {
          still.push(el);
        }
      }
      pending = still;
      if (!pending.length) {
        window.removeEventListener('scroll', onScroll);
        window.removeEventListener('resize', onScroll);
      }
    };

    var onScroll = function () {
      if (queued) return;
      queued = true;
      requestAnimationFrame(sweep);
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    sweep();
    window.addEventListener('load', onScroll);
    setTimeout(sweep, 600);
    setTimeout(sweep, 1800);
  }

  // Grid hover preview: cycle a product card through its other angles while
  // the pointer is over it, so the shop grid hints at the 360 viewer on the
  // product page without loading a viewer per card.
  if(window.matchMedia('(hover:hover)').matches && !reduceMotion){
    Array.prototype.forEach.call(document.querySelectorAll('.product-card[data-preview]'),function(card){
      var img=card.querySelector('img.mockup');
      if(!img) return;
      var extra;
      try{ extra=JSON.parse(card.getAttribute('data-preview')||'[]'); }catch(e){ return; }
      if(!extra.length) return;

      var base=img.getAttribute('src');
      var timer=null, i=0;

      var start=function(){
        if(timer) return;
        timer=setInterval(function(){
          i=(i+1)%extra.length;
          img.setAttribute('src',extra[i]);
        },900);
      };
      var stop=function(){
        if(timer){clearInterval(timer);timer=null;}
        i=0;
        img.setAttribute('src',base);
      };

      card.addEventListener('mouseenter',start);
      card.addEventListener('mouseleave',stop);
      card.addEventListener('focusin',start);
      card.addEventListener('focusout',stop);
    });
  }

  Array.prototype.forEach.call(document.querySelectorAll('[data-size-picker]'),function(picker){
    picker.addEventListener('click',function(e){
      var btn=e.target.closest('[data-size]');
      if(!btn||!picker.contains(btn)) return;
      Array.prototype.forEach.call(picker.querySelectorAll('[data-size]'),function(option){
        option.setAttribute('aria-pressed',option===btn?'true':'false');
      });
    });
  });

  var BAG_KEY = 'habibi-bag';
  var FREE_AT = 3900;
  var FLAT_SHIP = 699;
  var MAX_QTY = 20;

  function money(cents) {
    var n = Math.abs(Number(cents) || 0);
    return '$' + Math.floor(n / 100) + '.' + String(n % 100).padStart(2, '0');
  }

  function readBag() {
    try {
      var parsed = JSON.parse(localStorage.getItem(BAG_KEY) || '[]');
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      return [];
    }
  }

  function writeBag(lines) {
    localStorage.setItem(BAG_KEY, JSON.stringify(lines));
    paintBadge();
    paintBagPage();
  }

  function bagCount(lines) {
    return lines.reduce(function (sum, line) { return sum + (line.quantity || 0); }, 0);
  }

  function paintBadge() {
    var n = bagCount(readBag());
    Array.prototype.forEach.call(document.querySelectorAll('.nav-bag-badge'), function (badge) {
      badge.textContent = String(n);
      badge.hidden = n === 0;
    });
    Array.prototype.forEach.call(document.querySelectorAll('.nav-bag'), function (link) {
      link.setAttribute('aria-label', n ? ('Bag, ' + n + (n === 1 ? ' item' : ' items')) : 'Bag — checkout isn’t open');
    });
  }

  function esc(value) {
    return String(value).replace(/[&<>"']/g, function (ch) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch];
    });
  }

  function paintBagPage() {
    var root = document.getElementById('bag-lines');
    if (!root) return;
    var lines = readBag();
    var empty = document.getElementById('bag-empty');
    var summary = document.getElementById('bag-summary');
    var title = document.getElementById('bag-title');
    var subtotalEl = document.getElementById('bag-subtotal');
    var shippingEl = document.getElementById('bag-shipping');
    if (!lines.length) {
      root.hidden = true;
      root.innerHTML = '';
      if (empty) empty.hidden = false;
      if (summary) summary.hidden = true;
      if (title) title.textContent = 'Your bag is empty.';
      return;
    }
    var subtotal = 0;
    root.hidden = false;
    if (empty) empty.hidden = true;
    if (summary) summary.hidden = false;
    if (title) title.textContent = 'Your bag';
    root.innerHTML = lines.map(function (line, index) {
      subtotal += line.priceCents * line.quantity;
      var size = line.size && line.size !== 'default' ? '<p class="bag-size">' + esc(line.size) + '</p>' : '';
      return (
        '<article class="bag-line">' +
          '<img src="assets/mockups/' + esc(line.slug) + '.png" alt="" width="72" height="72">' +
          '<div><h2>' + esc(line.name || line.slug) + '</h2>' + size +
            '<p class="bag-each">' + money(line.priceCents) + '</p></div>' +
          '<div class="bag-actions">' +
            '<div class="bag-qty">' +
              '<button type="button" data-bag-qty="-1" data-bag-index="' + index + '" aria-label="Fewer">−</button>' +
              '<span>' + line.quantity + '</span>' +
              '<button type="button" data-bag-qty="1" data-bag-index="' + index + '" aria-label="More">+</button>' +
            '</div>' +
            '<button type="button" class="bag-remove" data-bag-remove="' + index + '">Remove</button>' +
          '</div>' +
        '</article>'
      );
    }).join('');
    if (subtotalEl) subtotalEl.textContent = 'Subtotal ' + money(subtotal);
    if (shippingEl) {
      if (subtotal >= FREE_AT) shippingEl.textContent = 'Free US shipping.';
      else shippingEl.textContent = 'Standard US shipping ' + money(FLAT_SHIP) + '. Add ' + money(FREE_AT - subtotal) + ' for free US shipping.';
    }
  }

  function addLine(slug, size, priceCents, name) {
    var lines = readBag();
    var found = lines.find(function (line) { return line.slug === slug && line.size === size; });
    if (found) found.quantity = Math.min(MAX_QTY, found.quantity + 1);
    else lines.push({ slug: slug, size: size, quantity: 1, priceCents: priceCents, name: name });
    writeBag(lines);
  }

  document.addEventListener('click', function (event) {
    var add = event.target.closest('[data-add-to-bag]');
    if (add) {
      var meta = add.closest('.product-meta') || document;
      var pressed = meta.querySelector('[data-size][aria-pressed="true"]');
      var heading = meta.querySelector('h1');
      addLine(
        add.getAttribute('data-product-slug'),
        pressed ? pressed.getAttribute('data-size') : 'default',
        Number(add.getAttribute('data-price-cents')),
        heading ? heading.textContent.trim() : add.getAttribute('data-product-slug')
      );
      var previous = add.textContent;
      add.textContent = 'Added';
      window.setTimeout(function () { add.textContent = previous; }, 900);
      return;
    }
    var qty = event.target.closest('[data-bag-qty]');
    if (qty) {
      var lines = readBag();
      var line = lines[Number(qty.getAttribute('data-bag-index'))];
      if (!line) return;
      line.quantity += Number(qty.getAttribute('data-bag-qty'));
      if (line.quantity < 1) lines.splice(lines.indexOf(line), 1);
      else if (line.quantity > MAX_QTY) line.quantity = MAX_QTY;
      writeBag(lines);
      return;
    }
    var remove = event.target.closest('[data-bag-remove]');
    if (remove) {
      var next = readBag();
      next.splice(Number(remove.getAttribute('data-bag-remove')), 1);
      writeBag(next);
    }
  });

  paintBadge();
  paintBagPage();
})();
