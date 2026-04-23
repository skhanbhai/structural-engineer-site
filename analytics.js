/* ============================================================
   Panoptic — analytics
   Injects Google Analytics 4 (gtag) when a measurement ID is set
   in site.config.js. Exposes PANOPTIC_ANALYTICS.track(name, params)
   for lightweight event tracking from form.js and elsewhere.
   ============================================================ */

(function () {
  'use strict';

  var CONFIG = window.PANOPTIC_CONFIG || {};
  var GA_ID  = CONFIG.ga4Id || '';

  // Initialise a shared dataLayer regardless so event calls queue up
  // before gtag loads and fire cleanly once it has.
  window.dataLayer = window.dataLayer || [];
  function gtag() { window.dataLayer.push(arguments); }
  window.gtag = window.gtag || gtag;

  if (GA_ID) {
    // Inject the gtag library asynchronously.
    var s = document.createElement('script');
    s.async = true;
    s.src = 'https://www.googletagmanager.com/gtag/js?id=' + encodeURIComponent(GA_ID);
    document.head.appendChild(s);

    gtag('js', new Date());
    gtag('config', GA_ID, {
      anonymize_ip: true,
      transport_type: 'beacon'
    });
  }

  function track(eventName, params) {
    if (!GA_ID) return;
    try { window.gtag('event', eventName, params || {}); } catch (_) {}
  }

  window.PANOPTIC_ANALYTICS = { track: track };
})();
