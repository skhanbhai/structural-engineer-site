/* ============================================================
   Panoptic — source / attribution capture
   Reads UTM parameters from the URL, persists them per session,
   and records the first landing page (once, in localStorage).
   Exposes PANOPTIC_SOURCE.get() → payload used by form.js.
   ============================================================ */

(function () {
  'use strict';

  var UTM_KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content'];
  var SESSION_KEY = 'panoptic_utms';
  var FIRST_LANDING_KEY = 'panoptic_first_landing';

  function safe(fn, fallback) {
    try { return fn(); } catch (_) { return fallback; }
  }

  function readUtmsFromUrl() {
    var params = new URLSearchParams(window.location.search);
    var found = null;
    for (var i = 0; i < UTM_KEYS.length; i++) {
      var v = params.get(UTM_KEYS[i]);
      if (v) {
        found = found || {};
        found[UTM_KEYS[i]] = v;
      }
    }
    return found;
  }

  function getStoredUtms() {
    return safe(function () {
      var raw = window.sessionStorage.getItem(SESSION_KEY);
      return raw ? JSON.parse(raw) : null;
    }, null);
  }

  function storeUtms(utms) {
    safe(function () {
      window.sessionStorage.setItem(SESSION_KEY, JSON.stringify(utms));
    });
  }

  function getFirstLanding() {
    return safe(function () {
      return window.localStorage.getItem(FIRST_LANDING_KEY) || '';
    }, '');
  }

  function ensureFirstLanding() {
    safe(function () {
      if (!window.localStorage.getItem(FIRST_LANDING_KEY)) {
        var path = window.location.pathname + (window.location.search || '');
        window.localStorage.setItem(FIRST_LANDING_KEY, path);
      }
    });
  }

  // On page load: capture any fresh UTMs into session storage and
  // record the first landing page if we haven't yet.
  var freshUtms = readUtmsFromUrl();
  if (freshUtms) storeUtms(freshUtms);
  ensureFirstLanding();

  function getSourcePayload() {
    var utms = getStoredUtms() || {};
    return {
      page_url:           window.location.href,
      page_path:          window.location.pathname,
      referrer:           document.referrer || '',
      utm_source:         utms.utm_source   || '',
      utm_medium:         utms.utm_medium   || '',
      utm_campaign:       utms.utm_campaign || '',
      utm_term:           utms.utm_term     || '',
      utm_content:        utms.utm_content  || '',
      first_landing_page: getFirstLanding()
    };
  }

  window.PANOPTIC_SOURCE = { get: getSourcePayload };
})();
