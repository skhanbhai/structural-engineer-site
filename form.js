/* ============================================================
   Panoptic - main enquiry form handler
   Attaches to every form tagged with `.js-enquiry-form`.
   Validates, adds source attribution, posts to the Apps Script
   Web App with intent='form', and renders success / error
   states in place. The Apps Script is responsible for both the
   sheet append and the email send.
   ============================================================ */

(function () {
  'use strict';

  var CONFIG = window.PANOPTIC_CONFIG || {};
  var SOURCE = window.PANOPTIC_SOURCE;

  function readField(form, name) {
    var el = form.elements[name];
    if (!el) return '';
    if (el.length && el.tagName !== 'SELECT') {
      for (var i = 0; i < el.length; i++) {
        if (el[i].checked) return el[i].value;
      }
      return '';
    }
    return (el.value || '').trim();
  }

  function composedName(form) {
    var single = readField(form, 'name');
    if (single) return single;
    var first = readField(form, 'firstName');
    var last  = readField(form, 'lastName');
    return (first + ' ' + last).trim();
  }

  function buildPayload(form) {
    var source = SOURCE ? SOURCE.get() : {};
    return {
      intent:       'form',
      name:         composedName(form),
      email:        readField(form, 'email'),
      phone:        readField(form, 'phone'),
      postcode:     readField(form, 'postcode'),
      service:      readField(form, 'service') || readField(form, 'scope'),
      projectType:  readField(form, 'projectType') || readField(form, 'service') || readField(form, 'scope'),
      timeline:     readField(form, 'timeline'),
      message:      readField(form, 'message'),
      preferredContact: 'Email',
      source:       source,
      timestamp:    new Date().toISOString()
    };
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
      } else if (el.type === 'email' && el.value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(el.value.trim())) {
        msg = 'Enter a valid email address.';
      } else if (el.type === 'checkbox' && el.required && !el.checked) {
        msg = 'Please tick to confirm.';
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

  function renderSuccess(form) {
    var refDate = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    var refRand = Math.random().toString(36).slice(2, 6).toUpperCase();
    form.innerHTML =
      '<div class="form-success" role="status" aria-live="polite">' +
        '<h3>Thank you - your enquiry has been sent.</h3>' +
        '<p>We&rsquo;ll reply within 48 hours. If it&rsquo;s urgent, call <a href="tel:447854598136">07854 598136</a>.</p>' +
        '<p class="form-ref">Ref &middot; ' + refDate + '-' + refRand + '</p>' +
      '</div>';
  }

  // POST to the Apps Script Web App. Apps Script does not return CORS
  // headers, so we send no-cors and treat a resolved fetch as success.
  // We can't read the response body, but the request reaches the script.
  function postToWebhook(payload) {
    var url = CONFIG.webhookUrl;
    if (!url) return Promise.reject(new Error('Webhook URL not configured'));
    return fetch(url, {
      method:  'POST',
      mode:    'no-cors',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body:    JSON.stringify(payload)
    });
  }

  function submitForm(form, btn) {
    // Honeypot - if a bot filled it in, pretend success and bail.
    var honey = form.querySelector('input[name="_honey"]');
    if (honey && honey.value) {
      renderSuccess(form);
      return;
    }

    var invalid = validate(form);
    if (invalid) {
      setStatus(form, 'error', 'Please fix the highlighted fields.');
      try { invalid.focus({ preventScroll: false }); } catch (_) { invalid.focus(); }
      return;
    }

    btn.disabled = true;
    var originalLabel = btn.innerHTML;
    btn.innerHTML = 'Sending&hellip;';
    setStatus(form, 'pending', 'Sending&hellip;');

    var payload = buildPayload(form);

    postToWebhook(payload)
      .then(function () {
        if (window.PANOPTIC_ANALYTICS) {
          window.PANOPTIC_ANALYTICS.track('generate_lead', {
            form_id:      form.id || 'enquiry',
            service:      payload.service,
            page_path:    payload.source && payload.source.page_path,
            utm_source:   payload.source && payload.source.utm_source,
            utm_medium:   payload.source && payload.source.utm_medium,
            utm_campaign: payload.source && payload.source.utm_campaign,
            currency:     'GBP',
            value:        0
          });
        }
        renderSuccess(form);
      })
      .catch(function () {
        btn.disabled = false;
        btn.innerHTML = originalLabel;
        setStatus(form, 'error',
          'Sorry - we couldn&rsquo;t send that. Please try again, or email ' +
          (CONFIG.publicEmail || 'info@panopticdesign.co.uk') + ' directly.');
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

  document.querySelectorAll('.js-enquiry-form').forEach(enhance);
})();
