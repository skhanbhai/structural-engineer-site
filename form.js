/* ============================================================
   Panoptic — enquiry form handler
   Attaches to every form tagged with `.js-enquiry-form`.
   Validates, adds source attribution, posts to the configured
   endpoint, and renders success / error states in place.
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
      name:         composedName(form),
      email:        readField(form, 'email'),
      phone:        readField(form, 'phone'),
      postcode:     readField(form, 'postcode'),
      service:      readField(form, 'service') || readField(form, 'scope'),
      message:      readField(form, 'message'),
      project_type: readField(form, 'projectType'),
      timeline:     readField(form, 'timeline'),
      source:       source,
      timestamp:    new Date().toISOString()
    };
  }

  // Shape what gets sent to the email relay. FormSubmit renders the JSON
  // keys as rows in the email (via _template=table). Keep keys readable
  // and ordered by importance.
  function buildRelayBody(payload) {
    var s = payload.source || {};
    return {
      _subject:  'New website enquiry - ' + (payload.service || 'General') + ' - ' + (payload.name || 'Unknown'),
      _template: 'table',
      _captcha:  'false',

      name:         payload.name,
      email:        payload.email,
      phone:        payload.phone,
      postcode:     payload.postcode,
      service:      payload.service,
      project_type: payload.project_type,
      timeline:     payload.timeline,
      message:      payload.message,

      submitted_at:       payload.timestamp,
      page_url:           s.page_url,
      page_path:          s.page_path,
      referrer:           s.referrer,
      utm_source:         s.utm_source,
      utm_medium:         s.utm_medium,
      utm_campaign:       s.utm_campaign,
      utm_term:           s.utm_term,
      utm_content:        s.utm_content,
      first_landing_page: s.first_landing_page
    };
  }

  function setStatus(form, state, message) {
    var status = form.querySelector('.form-status');
    if (!status) return;
    status.textContent = message || '';
    status.setAttribute('data-state', state || '');
  }

  function renderSuccess(form) {
    var refDate = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    var refRand = Math.random().toString(36).slice(2, 6).toUpperCase();
    form.innerHTML =
      '<div class="form-success" role="status" aria-live="polite">' +
        '<h3>Thank you — your enquiry has been sent.</h3>' +
        '<p>We’ll reply within 48 hours. If it’s urgent, call <a href="tel:447854598136">07854 598136</a>.</p>' +
        '<p class="form-ref">Ref · ' + refDate + '-' + refRand + '</p>' +
      '</div>';
  }

  function sendWebhook(payload) {
    if (!CONFIG.webhookUrl) return null;
    // Google Apps Script web apps don't set CORS headers, so we send
    // no-cors and treat the response as fire-and-forget. Other
    // webhooks (Zapier, Make) that return CORS headers will also work.
    return fetch(CONFIG.webhookUrl, {
      method:  'POST',
      mode:    'no-cors',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body:    JSON.stringify(payload)
    }).catch(function () { /* non-blocking — don't break email on this */ });
  }

  function submitForm(form, btn) {
    // Honeypot — if a bot filled it in, pretend success and bail.
    var honey = form.querySelector('input[name="_honey"]');
    if (honey && honey.value) {
      renderSuccess(form);
      return;
    }

    if (!form.checkValidity()) {
      form.reportValidity();
      setStatus(form, 'error', 'Please fill in the required fields.');
      return;
    }

    btn.disabled = true;
    var originalLabel = btn.innerHTML;
    btn.innerHTML = 'Sending…';
    setStatus(form, 'pending', 'Sending…');

    var payload   = buildPayload(form);
    var relayBody = buildRelayBody(payload);

    // Optional webhook runs in parallel — does not block the email path.
    sendWebhook(payload);

    fetch(CONFIG.formEndpoint, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body:    JSON.stringify(relayBody)
    })
      .then(function (res) {
        if (!res.ok) throw new Error('Relay responded ' + res.status);
        return res.json().catch(function () { return {}; });
      })
      .then(function () {
        // GA4 conversion event — fires only if GA4 is enabled in config.
        if (window.PANOPTIC_ANALYTICS) {
          window.PANOPTIC_ANALYTICS.track('generate_lead', {
            form_id:       form.id || 'enquiry',
            service:       payload.service,
            page_path:     payload.source && payload.source.page_path,
            utm_source:    payload.source && payload.source.utm_source,
            utm_medium:    payload.source && payload.source.utm_medium,
            utm_campaign:  payload.source && payload.source.utm_campaign,
            currency:      'GBP',
            value:         0
          });
        }
        renderSuccess(form);
      })
      .catch(function () {
        btn.disabled = false;
        btn.innerHTML = originalLabel;
        setStatus(form, 'error',
          'Sorry — we couldn’t send that. Please try again, or email ' + (CONFIG.recipientEmail || '') + ' directly.');
      });
  }

  function enhance(form) {
    // Let us handle validation messaging ourselves so we can also show
    // inline status text, but still rely on native validity checks.
    form.setAttribute('novalidate', 'novalidate');

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var btn = form.querySelector('button[type="submit"]');
      if (!btn) return;
      submitForm(form, btn);
    });
  }

  document.querySelectorAll('.js-enquiry-form').forEach(enhance);
})();
