(function(){
  var toggle=document.querySelector('.menu-toggle');
  var nav=document.querySelector('.nav-links');

  function setMenu(open){
    if(!toggle||!nav) return;
    toggle.setAttribute('aria-expanded',String(open));
    toggle.setAttribute('aria-label',open?'Close menu':'Open menu');
    nav.classList.toggle('open',open);
  }

  if(toggle&&nav){
    toggle.addEventListener('click',function(){
      setMenu(toggle.getAttribute('aria-expanded')!=='true');
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

  var reveals=document.querySelectorAll('.reveal');
  if(!('IntersectionObserver' in window)||window.matchMedia('(prefers-reduced-motion: reduce)').matches){
    reveals.forEach(function(el){el.classList.add('visible');});
  }else{
    var observer=new IntersectionObserver(function(entries){
      entries.forEach(function(entry){if(entry.isIntersecting){entry.target.classList.add('visible');observer.unobserve(entry.target);}});
    },{threshold:.12});
    reveals.forEach(function(el){observer.observe(el);});
  }
})();
