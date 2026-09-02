(function(){
  var toggle=document.querySelector('.menu-toggle');
  var nav=document.querySelector('.nav-links');
  if(toggle&&nav){
    toggle.addEventListener('click',function(){
      var open=toggle.getAttribute('aria-expanded')==='true';
      toggle.setAttribute('aria-expanded',String(!open));
      nav.classList.toggle('open',!open);
    });
    nav.addEventListener('click',function(e){
      if(e.target.closest('a')){toggle.setAttribute('aria-expanded','false');nav.classList.remove('open');}
    });
  }

  var header=document.querySelector('.site-header');
  if(header){
    var lastScroll=0;
    var ticking=false;
    function updateHeader(){
      var scrollY=window.pageYOffset||document.documentElement.scrollTop;
      header.classList.toggle('scrolled',scrollY>10);
      ticking=false;
    }
    window.addEventListener('scroll',function(){
      lastScroll=window.pageYOffset||document.documentElement.scrollTop;
      if(!ticking){requestAnimationFrame(updateHeader);ticking=true;}}
    ,{passive:true});
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
