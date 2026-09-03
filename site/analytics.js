(function () {
  var cfg = window.HABIBI_PUBLIC_CONFIG || {};

  function loadScript(src, attrs) {
    var script = document.createElement('script');
    script.src = src;
    script.async = true;
    if (attrs) {
      Object.keys(attrs).forEach(function (key) {
        script.setAttribute(key, attrs[key]);
      });
    }
    document.head.appendChild(script);
    return script;
  }

  window.plausible = window.plausible || function () {
    (plausible.q = plausible.q || []).push(arguments);
  };
  window.plausible.init = window.plausible.init || function (opts) {
    plausible.o = opts || {};
  };
  loadScript('https://plausible.io/js/pa-dYxqxpSPSHwyCPDu6afHh.js');
  window.plausible.init();

  var publisher = String(cfg.ADSENSE_PUBLISHER_ID || '').trim();
  var adsOn = cfg.ADSENSE_ENABLED === true && /^ca-pub-\d+$/.test(publisher);
  if (!adsOn) return;

  loadScript('https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=' + encodeURIComponent(publisher), {
    crossorigin: 'anonymous'
  });
})();
