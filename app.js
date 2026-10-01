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
})();
