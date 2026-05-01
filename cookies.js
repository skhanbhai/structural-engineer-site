/* ============================================================
   Panoptic - cookie consent + GA4 gating
   GA4 (gtag.js) is NOT loaded until the user accepts analytics
   cookies. Choice is persisted in localStorage. A "Cookie settings"
   footer link re-opens the banner so the user can change choice.
   ============================================================ */

(function () {
  'use strict';

  var GA4_ID = (window.PANOPTIC_CONFIG && window.PANOPTIC_CONFIG.ga4Id) || 'G-ZMFX3LH88K';
  var STORAGE_KEY = 'panoptic-consent';

  var BANNER_TEMPLATE =
    '<div class="cookie-banner" id="cookieBanner" role="region" aria-label="Cookie consent" hidden>' +
      '<div class="cookie-banner-inner">' +
        '<p class="cookie-banner-text">' +
          'We use cookies to understand how people use this website and improve future enquiries. ' +
          'You can accept or reject analytics cookies. Essential cookies are always active. ' +
          '<a href="cookie-policy.html">Read more</a>.' +
        '</p>' +
        '<div class="cookie-banner-actions">' +
          '<button type="button" class="btn btn-ghost cookie-reject">Reject analytics</button>' +
          '<button type="button" class="btn btn-primary cookie-accept">Accept analytics</button>' +
        '</div>' +
      '</div>' +
    '</div>';

  function loadGA() {
    if (window.__panopticGAloaded) return;
    window.__panopticGAloaded = true;
    window.dataLayer = window.dataLayer || [];
    window.gtag = window.gtag || function () { window.dataLayer.push(arguments); };
    var s = document.createElement('script');
    s.async = true;
    s.src = 'https://www.googletagmanager.com/gtag/js?id=' + encodeURIComponent(GA4_ID);
    document.head.appendChild(s);
    window.gtag('js', new Date());
    window.gtag('config', GA4_ID);
  }

  function getConsent() {
    try { return localStorage.getItem(STORAGE_KEY); } catch (_) { return null; }
  }
  function setConsent(value) {
    try { localStorage.setItem(STORAGE_KEY, value); } catch (_) {}
  }

  function ensureBanner() {
    var existing = document.getElementById('cookieBanner');
    if (existing) return existing;
    var wrap = document.createElement('div');
    wrap.innerHTML = BANNER_TEMPLATE;
    document.body.appendChild(wrap.firstChild);
    return document.getElementById('cookieBanner');
  }
  function showBanner() {
    var b = ensureBanner();
    b.hidden = false;
    document.body.classList.add('has-cookie-banner');
  }
  function hideBanner() {
    var b = document.getElementById('cookieBanner');
    if (b) b.hidden = true;
    document.body.classList.remove('has-cookie-banner');
  }

  function init() {
    document.addEventListener('click', function (e) {
      if (!e.target || !e.target.closest) return;
      var settings = e.target.closest('[data-cookie-settings]');
      if (settings) { e.preventDefault(); showBanner(); return; }
      if (e.target.classList && e.target.classList.contains('cookie-accept')) {
        setConsent('accepted'); hideBanner(); loadGA();
      } else if (e.target.classList && e.target.classList.contains('cookie-reject')) {
        setConsent('rejected'); hideBanner();
      }
    });

    var consent = getConsent();
    if (consent === 'accepted') loadGA();
    else if (consent !== 'rejected') showBanner();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }

  window.PANOPTIC_COOKIES = { showBanner: showBanner, getConsent: getConsent };
})();
