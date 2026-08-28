// Add IDs here when ready. Empty values keep analytics disabled.
window.HABIBI_ANALYTICS = { plausibleDomain: '', googleMeasurementId: '' };
(function(c){
  if (c.plausibleDomain) {
    var s=document.createElement('script'); s.defer=true; s.dataset.domain=c.plausibleDomain; s.src='https://plausible.io/js/script.js'; document.head.appendChild(s);
  }
  if (c.googleMeasurementId) {
    var g=document.createElement('script'); g.async=true; g.src='https://www.googletagmanager.com/gtag/js?id='+encodeURIComponent(c.googleMeasurementId); document.head.appendChild(g);
    window.dataLayer=window.dataLayer||[]; function gtag(){dataLayer.push(arguments);} window.gtag=gtag; gtag('js',new Date()); gtag('config',c.googleMeasurementId,{anonymize_ip:true});
  }
})(window.HABIBI_ANALYTICS);
