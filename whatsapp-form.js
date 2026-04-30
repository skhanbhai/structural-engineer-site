/* ============================================================
   Panoptic - WhatsApp prefill mini-form
   Attaches to every form tagged with `.js-whatsapp-form`.
   Required: project type + postcode. Brief details optional.

   On submit:
     1. POSTs fire-and-forget to the Apps Script Web App with
        intent='whatsapp' so the enquiry is logged to the sheet.
     2. Opens wa.me synchronously in a new tab (same call stack as
        the click - no popup blocker, no lost user gesture).
     3. If the form sits inside a .wa-modal, briefly shows a status
        line and auto-closes the modal. Otherwise replaces the
        form with a success state for inline use (e.g. crack page).

   Also wires WhatsApp modal triggers (.qc-link[data-wa-modal-trigger])
   to open the modal accessibly.

   Analytics events fired (via window.PANOPTIC_ANALYTICS.track):
     - whatsapp_modal_open
     - whatsapp_logged_submit
     - whatsapp_opened
     - whatsapp_log_failed
   ============================================================ */

(function () {
  'use strict';

  var CONFIG = window.PANOPTIC_CONFIG || {};
  var SOURCE = window.PANOPTIC_SOURCE;
  var WHATSAPP_NUMBER = '447854598136';

  function track(name, params) {
    try {
      if (window.PANOPTIC_ANALYTICS && typeof window.PANOPTIC_ANALYTICS.track === 'function') {
        window.PANOPTIC_ANALYTICS.track(name, params || {});
      } else if (typeof window.gtag === 'function') {
        window.gtag('event', name, params || {});
      }
    } catch (_) {}
  }

  function readField(form, name) {
    var el = form.elements[name];
    if (!el) return '';
    return (el.value || '').trim();
  }

  function buildPrefillUrl(payload) {
    var lines = [
      "Hi Vijay, I'd like to enquire about a project.",
      '',
      'Project type: ' + (payload.projectType || ''),
      'Property postcode: ' + (payload.postcode || '')
    ];
    if (payload.message) lines.push('Brief details: ' + payload.message);
    return 'https://wa.me/' + WHATSAPP_NUMBER + '?text=' + encodeURIComponent(lines.join('\n'));
  }

  function setStatus(form, state, message) {
    var status = form.querySelector('.form-status');
    if (!status) return;
    status.textContent = message || '';
    status.setAttribute('data-state', state || '');
  }

  function validate(form) {
    var firstInvalid = null;
    var fields = form.querySelectorAll('input, select, textarea');
    fields.forEach(function (el) {
      if (el.name === '_honey' || el.type === 'hidden') return;
      var wrap = el.closest('.field') || el.closest('.checkbox-row');
      var existing = wrap ? wrap.querySelector('.field-error') : null;
      if (existing) existing.remove();
      el.removeAttribute('aria-invalid');

      if (!el.required && !el.value) return;

      var msg = '';
      if (el.required && !el.value.trim()) {
        msg = 'This field is required.';
      } else if (el.name === 'postcode' && el.value && !/^[A-Za-z]{1,2}\d[A-Za-z0-9]?\s?\d[A-Za-z]{2}$/.test(el.value.trim())) {
        msg = 'Enter a valid UK postcode.';
      }

      if (msg) {
        el.setAttribute('aria-invalid', 'true');
        if (wrap) {
          var err = document.createElement('div');
          err.className = 'field-error';
          err.textContent = msg;
          wrap.appendChild(err);
        }
        if (!firstInvalid) firstInvalid = el;
      }
    });
    return firstInvalid;
  }

  function postToWebhook(payload) {
    var url = CONFIG.webhookUrl;
    if (!url) {
      track('whatsapp_log_failed', { reason: 'no_webhook_url' });
      return Promise.resolve();
    }
    return fetch(url, {
      method:  'POST',
      mode:    'no-cors',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body:    JSON.stringify(payload)
    }).catch(function (err) {
      track('whatsapp_log_failed', { error: String(err) });
    });
  }

  function buildPayload(form) {
    var source = SOURCE ? SOURCE.get() : {};
    return {
      intent:           'whatsapp',
      projectType:      readField(form, 'projectType'),
      postcode:         readField(form, 'postcode'),
      message:          readField(form, 'message'),
      preferredContact: 'WhatsApp',
      source:           source,
      timestamp:        new Date().toISOString()
    };
  }

  // ---- Modal open/close ----------------------------------------------------

  var lastTrigger = null;

  function openModal(modal, trigger) {
    if (!modal) return;
    modal.hidden = false;
    modal.removeAttribute('aria-hidden');
    document.body.classList.add('no-scroll');
    lastTrigger = trigger || null;
    setTimeout(function () {
      var first = modal.querySelector('select, input:not([type="hidden"]):not([tabindex="-1"]), textarea');
      if (first) { try { first.focus(); } catch (_) {} }
    }, 50);
    track('whatsapp_modal_open', { page_path: window.location.pathname });
  }

  function closeModal(modal) {
    if (!modal) return;
    modal.hidden = true;
    modal.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('no-scroll');
    if (lastTrigger) { try { lastTrigger.focus(); } catch (_) {} }
  }

  // Shared entry point - any code on the page can open the modal by calling
  // window.openWhatsAppModal(triggerEl). Used internally by all click
  // delegations below and exposed for any future inline button.
  function openWhatsAppModal(trigger) {
    var modal = document.getElementById(
      (trigger && trigger.getAttribute && trigger.getAttribute('aria-controls')) || 'waModal'
    );
    if (!modal) return false;
    openModal(modal, trigger || null);
    return true;
  }
  window.openWhatsAppModal = openWhatsAppModal;

  function wireModals() {
    var modals = document.querySelectorAll('.wa-modal');
    if (!modals.length) return;

    // Delegate clicks at the document level so handlers cover dynamically
    // injected triggers and survive any framework reflow.
    document.addEventListener('click', function (e) {
      // Open modal: any element marked as a modal trigger.
      var trigger = e.target.closest && e.target.closest('[data-whatsapp-modal-trigger]');
      if (trigger) {
        e.preventDefault();
        e.stopPropagation();
        openWhatsAppModal(trigger);
        return;
      }

      // Close modal: backdrop, close button, anything inside a modal marked
      // with data-whatsapp-modal-close.
      var closer = e.target.closest && e.target.closest('[data-whatsapp-modal-close]');
      if (closer) {
        e.preventDefault();
        var modal = closer.closest('.wa-modal');
        if (modal) closeModal(modal);
        return;
      }

      // Belt-and-braces for the Contact page only: if any legacy WhatsApp
      // surface ends up in the DOM (cached anchor with [data-whatsapp],
      // direct wa.me href, etc.), intercept the click and route through
      // the modal so the log + prefilled message flow is consistent.
      var path = window.location && window.location.pathname || '';
      var isContact = /\/contact\.html$/.test(path) || /\/contact\/?$/.test(path);
      if (!isContact) return;
      var legacy = e.target.closest && e.target.closest('a[href*="wa.me"], a[href*="api.whatsapp.com"], [data-whatsapp]:not([data-whatsapp-modal-trigger])');
      if (legacy) {
        e.preventDefault();
        e.stopPropagation();
        openWhatsAppModal(legacy);
      }
    }, true); // capture phase so we win against any other page handlers

    document.addEventListener('keydown', function (e) {
      if (e.key !== 'Escape') return;
      modals.forEach(function (m) {
        if (!m.hidden) closeModal(m);
      });
    });
  }

  // ---- Form submission -----------------------------------------------------

  function submitForm(form, btn) {
    var honey = form.querySelector('input[name="_honey"]');
    if (honey && honey.value) return;

    var invalid = validate(form);
    if (invalid) {
      setStatus(form, 'error', 'Please fix the highlighted fields.');
      try { invalid.focus({ preventScroll: false }); } catch (_) { invalid.focus(); }
      return;
    }

    btn.disabled = true;

    var payload = buildPayload(form);
    var prefillUrl = buildPrefillUrl(payload);

    // Fire-and-forget log so the WhatsApp open below stays inside the
    // user-gesture stack and isn't blocked by the popup blocker. The
    // fetch reaches Apps Script even if the WhatsApp tab takes focus.
    postToWebhook(payload);
    track('whatsapp_logged_submit', {
      project_type: payload.projectType,
      postcode:     payload.postcode,
      page_path:    (payload.source && payload.source.page_path) || window.location.pathname
    });

    // Open WhatsApp synchronously in the same call stack as the click.
    var opened = window.open(prefillUrl, '_blank', 'noopener');
    if (!opened) {
      // Popup blocked - fall back to same-tab navigation.
      track('whatsapp_opened', { method: 'same_tab_fallback' });
      window.location.href = prefillUrl;
      return;
    }
    track('whatsapp_opened', { method: 'new_tab' });

    var modal = form.closest('.wa-modal');
    if (modal) {
      // Modal context - brief confirmation, then close.
      setStatus(form, 'success', 'WhatsApp opened in a new tab. We&rsquo;ve logged your enquiry.');
      setTimeout(function () {
        closeModal(modal);
        form.reset();
        setStatus(form, '', '');
        btn.disabled = false;
      }, 1500);
    } else {
      // Inline context - replace the form with a success state.
      form.innerHTML =
        '<div class="form-success" role="status" aria-live="polite">' +
          '<h3>Opening WhatsApp&hellip;</h3>' +
          '<p>If WhatsApp didn&rsquo;t open automatically, ' +
          '<a href="' + prefillUrl + '" target="_blank" rel="noopener">tap here</a> to send your message.</p>' +
        '</div>';
    }
  }

  function enhance(form) {
    form.setAttribute('novalidate', 'novalidate');

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var btn = form.querySelector('button[type="submit"]');
      if (!btn) return;
      submitForm(form, btn);
    });

    form.addEventListener('input', function (e) {
      var el = e.target;
      if (el && el.getAttribute && el.getAttribute('aria-invalid') === 'true') {
        var wrap = el.closest('.field') || el.closest('.checkbox-row');
        var existing = wrap ? wrap.querySelector('.field-error') : null;
        if (existing) existing.remove();
        el.removeAttribute('aria-invalid');
      }
    });
  }

  // ---- Modal template (single source of truth) ----------------------------
  // Injected on every page if not already present. Lets the floating FAB and
  // any [data-whatsapp-modal-trigger] open the same enquiry flow regardless
  // of which page they sit on, without duplicating the markup per page.
  var MODAL_TEMPLATE =
    '<div class="wa-modal" id="waModal" role="dialog" aria-modal="true" aria-labelledby="wa-modal-title" aria-hidden="true" hidden>' +
      '<div class="wa-modal-backdrop" data-whatsapp-modal-close tabindex="-1"></div>' +
      '<div class="wa-modal-panel" role="document">' +
        '<button type="button" class="wa-modal-close" aria-label="Close WhatsApp enquiry form" data-whatsapp-modal-close>' +
          '<span aria-hidden="true">&times;</span>' +
        '</button>' +
        '<h2 id="wa-modal-title">Open WhatsApp with your details ready to send.</h2>' +
        '<p class="wa-modal-sub">Project type and postcode are enough to start. Brief details are optional but help us reply with the right information.</p>' +
        '<form class="contact-form js-whatsapp-form" id="whatsappFormModal" aria-label="WhatsApp enquiry" novalidate>' +
          '<div class="form-honey" aria-hidden="true">' +
            '<label for="wa-modal-honey">Leave this field empty</label>' +
            '<input type="text" id="wa-modal-honey" name="_honey" tabindex="-1" autocomplete="off">' +
          '</div>' +
          '<div class="form-row">' +
            '<div class="field">' +
              '<label for="wa-modal-projectType">Project type *</label>' +
              '<select id="wa-modal-projectType" name="projectType" required>' +
                '<option value="">Select one&hellip;</option>' +
                '<option>Crack inspection / structural concern</option>' +
                '<option>Internal wall removal</option>' +
                '<option>Rear / side / wrap-around extension</option>' +
                '<option>Loft conversion</option>' +
                '<option>Architectural design</option>' +
                '<option>Planning support</option>' +
                '<option>Structural report / survey</option>' +
                '<option>Other / not sure</option>' +
              '</select>' +
            '</div>' +
          '</div>' +
          '<div class="form-row">' +
            '<div class="field">' +
              '<label for="wa-modal-postcode">Property postcode *</label>' +
              '<input type="text" id="wa-modal-postcode" name="postcode" required autocomplete="postal-code" autocapitalize="characters" spellcheck="false" placeholder="e.g. SW6 2AD">' +
            '</div>' +
          '</div>' +
          '<div class="form-row">' +
            '<div class="field">' +
              '<label for="wa-modal-message">Brief details (optional)</label>' +
              '<textarea id="wa-modal-message" name="message" placeholder="A sentence or two about the project."></textarea>' +
            '</div>' +
          '</div>' +
          '<button type="submit" class="btn btn-primary form-submit">' +
            'Open WhatsApp <span class="arrow" aria-hidden="true">&rarr;</span>' +
          '</button>' +
          '<div class="form-status" role="status" aria-live="polite"></div>' +
        '</form>' +
      '</div>' +
    '</div>';

  function ensureModalExists() {
    if (document.getElementById('waModal')) return;
    var holder = document.createElement('div');
    holder.innerHTML = MODAL_TEMPLATE;
    document.body.appendChild(holder.firstChild);
  }

  // Inject the modal first so the form inside is visible to enhance() and
  // the document-level click delegation has a target.
  ensureModalExists();
  document.querySelectorAll('.js-whatsapp-form').forEach(enhance);
  wireModals();
})();
