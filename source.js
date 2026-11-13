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

  // Google Ads auto-tagging stamps gclid (or gbraid/wbraid on iOS app and
  // web-to-app journeys) - never UTMs. Without these the sheet cannot tell a
  // paid click from an organic one, which makes reconciling enquiries against
  // the Ads conversion count guesswork.
  var CLICK_ID_KEYS = ['gclid', 'gbraid', 'wbraid'];
  var CLICK_ID_SESSION_KEY = 'panoptic_click_ids';

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

  function readClickIdsFromUrl() {
    var params = new URLSearchParams(window.location.search);
    var found = null;
    for (var i = 0; i < CLICK_ID_KEYS.length; i++) {
      var v = params.get(CLICK_ID_KEYS[i]);
      if (v) {
        found = found || {};
        found[CLICK_ID_KEYS[i]] = v;
      }
    }
    return found;
  }

  function getStoredClickIds() {
    return safe(function () {
      var raw = window.sessionStorage.getItem(CLICK_ID_SESSION_KEY);
      return raw ? JSON.parse(raw) : null;
    }, null);
  }

  function storeClickIds(ids) {
    safe(function () {
      window.sessionStorage.setItem(CLICK_ID_SESSION_KEY, JSON.stringify(ids));
    });
  }

  // document.referrer on the enquiry page is usually our own site, so it
  // says nothing about where the visitor came from. Record the external
  // referrer and entry page once, on the first page of the session.
  var SESSION_ENTRY_KEY = 'panoptic_session_entry';

  function externalReferrer() {
    var ref = document.referrer || '';
    if (!ref) return '';
    var host = safe(function () { return new URL(ref).hostname; }, '');
    if (!host || host === window.location.hostname) return '';
    return ref;
  }

  function ensureSessionEntry() {
    safe(function () {
      if (window.sessionStorage.getItem(SESSION_ENTRY_KEY)) return;
      window.sessionStorage.setItem(SESSION_ENTRY_KEY, JSON.stringify({
        path:     window.location.pathname,
        referrer: externalReferrer()
      }));
    });
  }

  function getSessionEntry() {
    return safe(function () {
      var raw = window.sessionStorage.getItem(SESSION_ENTRY_KEY);
      return raw ? JSON.parse(raw) : null;
    }, null) || {};
  }

  // One word per enquiry for the sheet's Channel column. Order matters:
  // a click id beats everything and gemini.google.com must be caught before
  // the generic google match.
  function classifyChannel(gclid, utms, referrer) {
    if (gclid) return 'paid';
    var medium = String(utms.utm_medium || '').toLowerCase();
    var src    = String(utms.utm_source || '').toLowerCase();
    if (/^(cpc|ppc|paid)/.test(medium)) return 'paid';
    if (medium === 'gbp') return 'google_business_profile';
    if (medium === 'email') return 'email';
    var host = safe(function () { return new URL(referrer).hostname; }, '');
    if (!host && src) return 'tagged_link';
    if (!host) return 'direct';
    if (/(chatgpt\.com|openai\.com|perplexity\.ai|claude\.ai|gemini\.google|copilot\.microsoft)/.test(host)) return 'ai_assistant';
    if (/(^|\.)(google\.|bing\.|duckduckgo\.|yahoo\.|ecosia\.|search\.brave\.)/.test(host) ||
        referrer.indexOf('android-app://com.google') === 0) return 'organic';
    if (/(facebook\.|instagram\.|linkedin\.|t\.co$|twitter\.|x\.com$|nextdoor\.)/.test(host)) return 'social';
    return 'referral';
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
  var freshClickIds = readClickIdsFromUrl();
  if (freshClickIds) storeClickIds(freshClickIds);
  ensureFirstLanding();
  ensureSessionEntry();

  function getSourcePayload() {
    var utms     = getStoredUtms()     || {};
    var clickIds = getStoredClickIds() || {};
    var gclid    = clickIds.gclid || clickIds.gbraid || clickIds.wbraid || '';
    var entry    = getSessionEntry();
    return {
      channel:              classifyChannel(gclid, utms, entry.referrer || ''),
      session_landing_page: entry.path || '',
      landing_referrer:     entry.referrer || '',
      page_url:           window.location.href,
      page_path:          window.location.pathname,
      referrer:           document.referrer || '',
      utm_source:         utms.utm_source   || '',
      utm_medium:         utms.utm_medium   || '',
      utm_campaign:       utms.utm_campaign || '',
      utm_term:           utms.utm_term     || '',
      utm_content:        utms.utm_content  || '',
      first_landing_page: getFirstLanding(),
      gclid:              gclid,
      // 'paid' whenever Ads auto-tagging stamped a click id on any page this
      // session - the one field to read when reconciling the sheet against the
      // Ads conversion count.
      traffic_type:       gclid ? 'paid' : 'organic_or_direct'
    };
  }

  window.PANOPTIC_SOURCE = { get: getSourcePayload };
})();
