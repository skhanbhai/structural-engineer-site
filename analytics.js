/* ============================================================
   Panoptic - analytics shim
   GA4 (gtag.js) is loaded by cookies.js only after the user
   accepts analytics cookies. This file keeps a stable
   window.PANOPTIC_ANALYTICS.track() entry point that other
   scripts call without needing to know about the gate.

   - Before consent / on rejection: track() is a no-op.
   - After acceptance: track() forwards to window.gtag.
   ============================================================ */

(function () {
  'use strict';

  // Ensure the gtag stub exists so calls before GA loads don't throw.
  // (cookies.js will load real gtag.js after consent.)
  window.dataLayer = window.dataLayer || [];
  if (typeof window.gtag !== 'function') {
    window.gtag = function () { window.dataLayer.push(arguments); };
  }

  function track(eventName, params) {
    if (!window.__panopticGAloaded) return; // dropped pre-consent
    try { window.gtag('event', eventName, params || {}); } catch (_) {}
  }

  window.PANOPTIC_ANALYTICS = { track: track };
})();
