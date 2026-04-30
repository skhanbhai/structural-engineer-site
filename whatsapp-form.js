/* ============================================================
   Panoptic - WhatsApp prefill mini-form
   Attaches to every form tagged with `.js-whatsapp-form`.
   Required: project type + postcode. Brief details optional.
   On submit:
     1. POSTs to the Apps Script Web App with intent='whatsapp'
        so the enquiry is logged to the sheet (no email sent).
     2. Opens wa.me in a new tab with a prefilled message.
   ============================================================ */

(function () {
  'use strict';

  var CONFIG = window.PANOPTIC_CONFIG || {};
  var SOURCE = window.PANOPTIC_SOURCE;
  var WHATSAPP_NUMBER = '447854598136';

  function readField(form, name) {
    var el = form.elements[name];
    if (!el) return '';
    return (el.value || '').trim();
  }

  function buildPrefillUrl(payload) {
    var lines = [
      'Hi Vijay, I&rsquo;d like help with a residential project.',
      '',
      'Project type: ' + (payload.projectType || ''),
      'Postcode: ' + (payload.postcode || '')
    ];
    // Plain apostrophe in the actual prefill - we only used &rsquo; above by
    // accident of templating. Replace before encoding.
    lines[0] = "Hi Vijay, I'd like help with a residential project.";
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
    if (!url) return Promise.resolve();
    return fetch(url, {
      method:  'POST',
      mode:    'no-cors',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body:    JSON.stringify(payload)
    }).catch(function () { /* don't block WhatsApp open if logging fails */ });
  }

  function trackClick(label) {
    var params = {
      event_category: 'contact',
      event_label:    label,
      page_path:      window.location.pathname,
      page_title:     document.title
    };
    try {
      if (window.PANOPTIC_ANALYTICS && typeof window.PANOPTIC_ANALYTICS.track === 'function') {
        window.PANOPTIC_ANALYTICS.track('click_whatsapp', params);
      } else if (typeof window.gtag === 'function') {
        window.gtag('event', 'click_whatsapp', params);
      }
    } catch (_) {}
  }

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
    var originalLabel = btn.innerHTML;
    btn.innerHTML = 'Opening WhatsApp&hellip;';
    setStatus(form, 'pending', 'Logging your enquiry&hellip;');

    var source = SOURCE ? SOURCE.get() : {};
    // Allow a hidden input to pre-set projectType (e.g. on the crack page).
    var projectType = readField(form, 'projectType');
    var payload = {
      intent:           'whatsapp',
      projectType:      projectType,
      postcode:         readField(form, 'postcode'),
      message:          readField(form, 'message'),
      preferredContact: 'WhatsApp',
      source:           source,
      timestamp:        new Date().toISOString()
    };

    var prefillUrl = buildPrefillUrl(payload);

    postToWebhook(payload).then(function () {
      trackClick('whatsapp-form');
      window.open(prefillUrl, '_blank', 'noopener');
      form.innerHTML =
        '<div class="form-success" role="status" aria-live="polite">' +
          '<h3>Opening WhatsApp&hellip;</h3>' +
          '<p>If WhatsApp didn&rsquo;t open automatically, ' +
          '<a href="' + prefillUrl + '" target="_blank" rel="noopener">tap here</a> to send your message.</p>' +
        '</div>';
    });
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
})();
