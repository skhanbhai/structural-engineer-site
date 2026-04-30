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

  function wireModals() {
    var modals = document.querySelectorAll('.wa-modal');
    if (!modals.length) return;

    document.querySelectorAll('[data-wa-modal-trigger]').forEach(function (t) {
      t.addEventListener('click', function (e) {
        e.preventDefault();
        var targetId = t.getAttribute('aria-controls') || 'waModal';
        var modal = document.getElementById(targetId);
        openModal(modal, t);
      });
    });

    modals.forEach(function (modal) {
      modal.querySelectorAll('[data-wa-modal-close]').forEach(function (c) {
        c.addEventListener('click', function (e) {
          e.preventDefault();
          closeModal(modal);
        });
      });
    });

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

  document.querySelectorAll('.js-whatsapp-form').forEach(enhance);
  wireModals();
})();
