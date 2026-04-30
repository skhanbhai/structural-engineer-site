/* ============================================================
   Panoptic - analytics
   The official Google tag (gtag.js) is loaded inline at the top of
   every page's <head>, which sets up dataLayer + window.gtag and
   runs the initial gtag('config', ...) for our GA4 property.

   This file:
     - guards against any double-init (dataLayer / gtag stubs are
       only created if the inline tag hasn't already done so)
     - skips re-injecting gtag.js when it's already present
     - exposes window.PANOPTIC_ANALYTICS.track() as a thin wrapper
       around window.gtag('event', ...) for form.js / whatsapp.js
   ============================================================ */

(function () {
  'use strict';

  var CONFIG = window.PANOPTIC_CONFIG || {};
  var GA_ID  = CONFIG.ga4Id || '';

  // Stubs - safe even if the inline tag has already created them.
  window.dataLayer = window.dataLayer || [];
  if (typeof window.gtag !== 'function') {
    window.gtag = function () { window.dataLayer.push(arguments); };
  }

  // Only inject gtag.js if it isn't already on the page (the inline tag
  // in <head> takes care of it under normal conditions). This branch is a
  // safety net for older HTML that hasn't been updated yet.
  var hasGtagScript = !!document.querySelector('script[src*="googletagmanager.com/gtag/js"]');
  if (GA_ID && !hasGtagScript) {
    var s = document.createElement('script');
    s.async = true;
    s.src = 'https://www.googletagmanager.com/gtag/js?id=' + encodeURIComponent(GA_ID);
    document.head.appendChild(s);
    window.gtag('js', new Date());
    window.gtag('config', GA_ID);
  }

  function track(eventName, params) {
    try { window.gtag('event', eventName, params || {}); } catch (_) {}
  }

  window.PANOPTIC_ANALYTICS = { track: track };
})();
