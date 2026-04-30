/* ============================================================
   Panoptic — WhatsApp enquiry route
   Injects a floating mobile WhatsApp button, hydrates any
   in-page WhatsApp CTAs (links carrying [data-whatsapp]) with
   the canonical wa.me URL, and tracks clicks safely whether or
   not GA4 is loaded.
   ============================================================ */

(function () {
  'use strict';

  var WHATSAPP_NUMBER = '447854598136';
  var WHATSAPP_MESSAGE = 'Hi Vijay, I found you through Panoptic Design. I need help with: cracks / wall removal / structural calculations / other. My postcode is:';
  var WHATSAPP_URL = 'https://wa.me/' + WHATSAPP_NUMBER + '?text=' + encodeURIComponent(WHATSAPP_MESSAGE);

  function trackClick(label) {
    var params = {
      event_category: 'contact',
      event_label: label || (typeof window !== 'undefined' && window.location ? window.location.pathname : ''),
      page_path: typeof window !== 'undefined' && window.location ? window.location.pathname : '',
      page_title: typeof document !== 'undefined' ? document.title : ''
    };
    try {
      if (window.PANOPTIC_ANALYTICS && typeof window.PANOPTIC_ANALYTICS.track === 'function') {
        window.PANOPTIC_ANALYTICS.track('click_whatsapp', params);
      } else if (typeof window.gtag === 'function') {
        window.gtag('event', 'click_whatsapp', params);
      }
    } catch (_) {}
  }

  function hydrateCtas() {
    var links = document.querySelectorAll('[data-whatsapp]');
    for (var i = 0; i < links.length; i++) {
      var a = links[i];
      if (!a.getAttribute('href')) a.setAttribute('href', WHATSAPP_URL);
      a.setAttribute('target', '_blank');
      a.setAttribute('rel', 'noopener');
      (function (el) {
        el.addEventListener('click', function () {
          trackClick(el.getAttribute('data-whatsapp') || el.getAttribute('href'));
        });
      })(a);
    }
  }

  function injectFloatingButton() {
    if (document.querySelector('.whatsapp-fab')) return;

    var a = document.createElement('a');
    a.className = 'whatsapp-fab';
    a.href = WHATSAPP_URL;
    a.target = '_blank';
    a.rel = 'noopener';
    a.setAttribute('aria-label', 'Message Panoptic Design on WhatsApp');
    a.setAttribute('data-whatsapp', 'floating');

    a.innerHTML =
      '<span class="whatsapp-fab-icon" aria-hidden="true">' +
        '<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" focusable="false">' +
          '<path d="M19.11 4.91A9.82 9.82 0 0 0 12.04 2C6.6 2 2.18 6.42 2.18 11.86c0 1.74.46 3.43 1.32 4.92L2.1 22l5.36-1.4a9.85 9.85 0 0 0 4.58 1.13h.01c5.43 0 9.85-4.42 9.85-9.86 0-2.63-1.02-5.1-2.79-6.96zM12.04 20.1h-.01a8.18 8.18 0 0 1-4.17-1.14l-.3-.18-3.18.83.85-3.1-.2-.32a8.16 8.16 0 0 1-1.25-4.33c0-4.52 3.68-8.2 8.21-8.2 2.19 0 4.25.85 5.8 2.4a8.13 8.13 0 0 1 2.4 5.81c0 4.52-3.68 8.23-8.15 8.23zm4.5-6.16c-.25-.12-1.46-.72-1.69-.8-.23-.08-.39-.12-.56.12s-.64.8-.78.97c-.14.16-.29.18-.54.06-.25-.12-1.04-.38-1.99-1.22-.74-.66-1.23-1.47-1.38-1.72-.14-.25-.02-.38.11-.5.11-.11.25-.29.37-.43.12-.14.16-.25.25-.41.08-.16.04-.31-.02-.43-.06-.12-.56-1.34-.76-1.84-.2-.49-.41-.42-.56-.43h-.48c-.16 0-.43.06-.66.31s-.86.84-.86 2.05.88 2.39 1 2.55c.12.16 1.74 2.66 4.22 3.73.59.25 1.05.4 1.41.51.59.19 1.13.16 1.55.1.47-.07 1.46-.6 1.66-1.17.21-.58.21-1.07.14-1.17-.06-.1-.22-.16-.47-.28z"/>' +
        '</svg>' +
      '</span>' +
      '<span class="whatsapp-fab-label">WhatsApp</span>';

    a.addEventListener('click', function () { trackClick('floating'); });
    document.body.appendChild(a);
  }

  function ready(fn) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', fn, { once: true });
    } else {
      fn();
    }
  }

  ready(function () {
    injectFloatingButton();
    hydrateCtas();
  });

  window.PANOPTIC_WHATSAPP = {
    url: WHATSAPP_URL,
    number: WHATSAPP_NUMBER,
    message: WHATSAPP_MESSAGE,
    track: trackClick
  };
})();
