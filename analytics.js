/* ============================================================
   Panoptic - analytics
   GA4 (gtag.js) is loaded by cookies.js only AFTER the user
   accepts analytics cookies. This file owns:

     1. trackEvent(name, params) - safe wrapper that auto-injects
        page_path, gates on consent, and never throws if GA is
        blocked or hasn't loaded.
     2. Document-level click delegation that fires:
          - whatsapp_click  (wa.me / api.whatsapp.com / [data-whatsapp])
          - phone_click     (tel: links)
          - email_click     (mailto: links)
     3. Page-view events for the priority pages:
          - contact_page_view            (/contact, /contact.html)
          - crack_inspection_page_view   (/cracking, /crack-inspection-london[.html])
          - rsj_calculations_page_view   (/rsj-steel-beam-calculations-london[.html])
     4. A debug flag for verifying events in the browser console.

   Debug mode:
     - URL ?panoptic_debug=1     (persists to localStorage)
     - localStorage panoptic_debug=1
     - window.PANOPTIC_DEBUG=true
   When on, logs "GA4 base tag loaded" and every fired event.

   Event names (mark these as Key events in GA4):
     contact_form_submit, whatsapp_click, phone_click, email_click,
     contact_page_view, crack_inspection_page_view
   Standard (non-key) page-view event:
     rsj_calculations_page_view
   ============================================================ */

(function () {
  'use strict';

  // ---- Debug flag ---------------------------------------------------------

  function readDebugFlag() {
    try {
      var u = new URLSearchParams(window.location.search);
      if (u.get('panoptic_debug') === '1') {
        try { localStorage.setItem('panoptic_debug', '1'); } catch (_) {}
        return true;
      }
      if (u.get('panoptic_debug') === '0') {
        try { localStorage.removeItem('panoptic_debug'); } catch (_) {}
      }
      if (window.PANOPTIC_DEBUG === true) return true;
      return (function () {
        try { return localStorage.getItem('panoptic_debug') === '1'; }
        catch (_) { return false; }
      })();
    } catch (_) { return false; }
  }
  var DEBUG = readDebugFlag();

  function debugLog() {
    if (!DEBUG) return;
    try { console.log.apply(console, ['[panoptic-ga]'].concat([].slice.call(arguments))); }
    catch (_) {}
  }

  // ---- gtag stub so calls before GA loads don't throw ---------------------

  window.dataLayer = window.dataLayer || [];
  if (typeof window.gtag !== 'function') {
    window.gtag = function () { window.dataLayer.push(arguments); };
  }

  // ---- trackEvent ---------------------------------------------------------

  function currentPath() {
    try { return window.location.pathname || '/'; } catch (_) { return ''; }
  }

  function trackEvent(eventName, params) {
    if (!eventName) return;
    var merged = Object.assign({ page_path: currentPath() }, params || {});

    // Strip null/undefined/empty strings so GA4 doesn't carry noisy params.
    Object.keys(merged).forEach(function (k) {
      var v = merged[k];
      if (v === null || v === undefined || v === '') delete merged[k];
    });

    if (!window.__panopticGAloaded) {
      debugLog('event suppressed (no consent yet): ' + eventName, merged);
      return;
    }
    try { window.gtag('event', eventName, merged); } catch (_) {}
    debugLog('GA4 event fired: ' + eventName, merged);
  }

  // Backwards-compat alias for older callers that used track().
  function track(eventName, params) { trackEvent(eventName, params); }

  // ---- Link click delegation ---------------------------------------------
  //
  // Capture phase so we win against any other page-level handlers (notably
  // whatsapp-form.js, which calls stopPropagation() when it routes contact-
  // page WhatsApp clicks through the modal). Registering here in capture
  // phase guarantees we record the click before the navigation/modal opens.

  function detectLocation(el) {
    if (!el || !el.closest) return '';
    var hit = el.closest('[data-track-location]');
    if (hit) return hit.getAttribute('data-track-location') || '';

    if (el.closest('header, .site-header, .topbar')) return 'header';
    if (el.closest('footer, .site-footer')) return 'footer';
    if (el.closest('.mobile-nav, .mobile-menu, .nav-mobile, [data-mobile-menu]')) return 'mobile_menu';
    if (el.closest('.whatsapp-fab, [data-whatsapp-modal-trigger="floating"]')) return 'floating_fab';
    if (el.closest('.wa-modal')) return 'whatsapp_modal';
    if (el.closest('.quick-contact, .qc, .contact-info, .quick-contact-row')) return 'contact_quick_links';
    if (el.closest('section[id="cta"], .cta, .hero, [data-section="hero"]')) return 'hero_cta';
    return '';
  }

  function digits(value) {
    return String(value || '').replace(/[^\d+]/g, '');
  }

  function looksLikeWhatsApp(href) {
    if (!href) return false;
    return /(^|\/\/)(wa\.me|api\.whatsapp\.com|web\.whatsapp\.com)\b/i.test(href);
  }

  document.addEventListener('click', function (e) {
    if (!e || !e.target || !e.target.closest) return;

    // 1) WhatsApp triggers - covers direct wa.me/whatsapp.com anchors,
    //    [data-whatsapp] CTAs, and the modal-trigger buttons in the header,
    //    mobile menu, contact page, and floating FAB. whatsapp-form.js will
    //    additionally fire whatsapp_modal_open for trigger-button paths -
    //    that's a separate event, not a duplicate of whatsapp_click.
    var waEl = e.target.closest(
      'a[href*="wa.me"], a[href*="whatsapp.com"], ' +
      'a[data-whatsapp], [data-whatsapp-modal-trigger]'
    );
    if (waEl) {
      var href = waEl.getAttribute('href') || '';
      var isWa = looksLikeWhatsApp(href) ||
                 waEl.hasAttribute('data-whatsapp') ||
                 waEl.hasAttribute('data-whatsapp-modal-trigger');
      if (isWa) {
        trackEvent('whatsapp_click', {
          link_url:      href || 'modal:waModal',
          link_location: detectLocation(waEl)
        });
      }
    }

    // 2) tel: links
    var telEl = e.target.closest('a[href^="tel:"]');
    if (telEl) {
      var telHref = telEl.getAttribute('href') || '';
      trackEvent('phone_click', {
        phone_number:  digits(telHref.replace(/^tel:/i, '')),
        link_location: detectLocation(telEl)
      });
    }

    // 3) mailto: links
    var mailEl = e.target.closest('a[href^="mailto:"]');
    if (mailEl) {
      var mailHref = mailEl.getAttribute('href') || '';
      var addr = mailHref.replace(/^mailto:/i, '').split('?')[0].trim();
      trackEvent('email_click', {
        email_address: addr,
        link_location: detectLocation(mailEl)
      });
    }
  }, true);

  // ---- Page-view events ---------------------------------------------------

  function normalisedPath() {
    var p = currentPath().toLowerCase();
    if (p.length > 1) p = p.replace(/\/+$/, '');
    return p;
  }

  var CONTACT_PATHS   = ['/contact', '/contact.html'];
  var CRACK_PATHS     = ['/cracking', '/cracking.html', '/crack-inspection-london', '/crack-inspection-london.html'];
  var RSJ_PATHS       = ['/rsj-steel-beam-calculations-london', '/rsj-steel-beam-calculations-london.html'];
  var CHIMNEY_PATHS   = ['/chimney-breast-removal-structural-engineer-london', '/chimney-breast-removal-structural-engineer-london.html'];
  var EXTENSION_PATHS = ['/extension-structural-engineer-london', '/extension-structural-engineer-london.html'];
  var REAR_EXT_PATHS  = ['/rear-extension-structural-engineer-london', '/rear-extension-structural-engineer-london.html'];
  var CHECKER_PATHS   = ['/do-i-need-a-structural-engineer', '/do-i-need-a-structural-engineer.html'];

  var pageViewSent = false;
  function firePageView() {
    if (pageViewSent) return;
    var p = normalisedPath();
    if (CONTACT_PATHS.indexOf(p) !== -1) {
      trackEvent('contact_page_view', { page_path: currentPath() });
      pageViewSent = true;
    } else if (CRACK_PATHS.indexOf(p) !== -1) {
      trackEvent('crack_inspection_page_view', { page_path: currentPath() });
      pageViewSent = true;
    } else if (RSJ_PATHS.indexOf(p) !== -1) {
      trackEvent('rsj_calculations_page_view', { page_path: currentPath() });
      pageViewSent = true;
    } else if (CHIMNEY_PATHS.indexOf(p) !== -1) {
      trackEvent('chimney_removal_page_view', { page_path: currentPath() });
      pageViewSent = true;
    } else if (REAR_EXT_PATHS.indexOf(p) !== -1) {
      trackEvent('rear_extension_page_view', { page_path: currentPath() });
      pageViewSent = true;
    } else if (EXTENSION_PATHS.indexOf(p) !== -1) {
      trackEvent('extension_calculations_page_view', { page_path: currentPath() });
      pageViewSent = true;
    } else if (CHECKER_PATHS.indexOf(p) !== -1) {
      trackEvent('checker_page_view', { page_path: currentPath() });
      pageViewSent = true;
    }
  }

  // Fire immediately if GA is already loaded (returning visitor who accepted),
  // and again when consent lands mid-session (panoptic:ga-ready dispatched by
  // cookies.js).
  if (window.__panopticGAloaded) firePageView();
  window.addEventListener('panoptic:ga-ready', firePageView);

  // ---- Public surface ----------------------------------------------------

  window.PANOPTIC_ANALYTICS = {
    trackEvent: trackEvent,
    track:      track,        // legacy alias - existing callers still work
    debugLog:   debugLog,
    isDebug:    function () { return DEBUG; }
  };

  debugLog('analytics.js initialised', { path: currentPath(), consent: !!window.__panopticGAloaded });
})();
