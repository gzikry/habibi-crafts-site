// Integrations stay off until the matching account is ready.
window.HABIBI_INTEGRATIONS = {
  plausible: {
    enabled: false,
    domain: 'habibicraftsco.com',
    scriptUrl: 'https://plausible.io/js/script.js'
  },
  adsense: {
    enabled: false,
    client: ''
  }
};
(function(config){
  if(config.plausible.enabled && config.plausible.domain){
    var plausible=document.createElement('script');
    plausible.defer=true;
    plausible.dataset.domain=config.plausible.domain;
    plausible.src=config.plausible.scriptUrl;
    document.head.appendChild(plausible);
  }
  if(config.adsense.enabled && /^ca-pub-\d+$/.test(config.adsense.client)){
    var ads=document.createElement('script');
    ads.async=true;
    ads.crossOrigin='anonymous';
    ads.src='https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client='+encodeURIComponent(config.adsense.client);
    document.head.appendChild(ads);
  }
})(window.HABIBI_INTEGRATIONS);
