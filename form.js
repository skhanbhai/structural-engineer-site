/* ============================================================
   Panoptic - main enquiry form handler
   Attaches to every form tagged with `.js-enquiry-form`.
   Validates, adds source attribution, posts to the Apps Script
   Web App with intent='form', and renders success / error
   states in place. The Apps Script is responsible for both the
   sheet append and the email send.

   GA4/GTM events: form_start (first focus into a field) and
   contact_form_submit (confirmed success only), both carrying
   form_route (quick_form / qualifier_form / form) so each enquiry
   route is measurable separately.
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

  // Which enquiry route a form belongs to, for per-route GA4/GTM reporting.
  // Landing pages tag their forms explicitly with data-form-route
  // (quick_form / qualifier_form); the checker contact form is recognised
  // even without the tag; everything else (e.g. the contact page) is 'form'.
  function formRoute(form) {
    return form.getAttribute('data-form-route') ||
           (form.hasAttribute('data-checker-contact') ? 'qualifier_form' : 'form');
  }

  function trackEvent(name, params) {
    try {
      if (window.PANOPTIC_ANALYTICS &&
          typeof window.PANOPTIC_ANALYTICS.trackEvent === 'function') {
        window.PANOPTIC_ANALYTICS.trackEvent(name, params || {});
      }
    } catch (_) {}
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
    // service (required) and projectType (optional) are intentionally kept
    // distinct in the payload - do not collapse one into the other.
    return {
      intent:       'form',
      name:         composedName(form),
      email:        readField(form, 'email'),
      phone:        readField(form, 'phone'),
      postcode:     readField(form, 'postcode'),
      service:      readField(form, 'service') || readField(form, 'scope'),
      projectType:  readField(form, 'projectType'),
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
        '<p>We normally reply within one working day. If it&rsquo;s urgent, call <a href="tel:447940540903">07940 540903</a>.</p>' +
        '<p class="form-ref">Ref &middot; ' + refDate + '-' + refRand + '</p>' +
      '</div>';
  }

  function debug(msg) {
    try {
      if (window.PANOPTIC_ANALYTICS && typeof window.PANOPTIC_ANALYTICS.debugLog === 'function') {
        window.PANOPTIC_ANALYTICS.debugLog(msg);
      }
    } catch (_) {}
  }

  // Tag a rejection with fallbackSafe so postToWebhook can decide whether
  // it's safe to retry via the direct Apps Script POST. We only set true
  // for failures that PROVE the body never reached Apps Script.
  function rejection(code, fallbackSafe) {
    var e = new Error(code);
    e.fallbackSafe = fallbackSafe === true;
    return e;
  }

  // Primary path: same-origin proxy at /api/contact. The Worker forwards
  // to Apps Script server-to-server, reads the {ok:true} response body,
  // and surfaces a real success/failure status so we can fire GA only on
  // confirmed success.
  function postToProxy(payload) {
    debug('Contact form submitted via /api/contact proxy');
    return fetch('/api/contact', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(payload)
    }).then(function (res) {
      // 404 / 405 are the only statuses that prove the Worker route did
      // not forward the body to Apps Script.
      if (res.status === 404 || res.status === 405) {
        throw rejection('proxy_route_unavailable_' + res.status, true);
      }
      if (!res.ok) {
        // 500, 502, 504, 524, etc. The Worker may already have sent the
        // request to Apps Script (this includes the Worker's own
        // upstream_status_* / upstream_bad_body / upstream_not_ok /
        // upstream_unreachable error codes, all returned as 502). Do NOT
        // repost - we cannot prove Apps Script did not already run.
        throw rejection('proxy_status_' + res.status, false);
      }
      return res.json().then(function (body) {
        if (body && body.ok === true) {
          debug('Contact proxy confirmed ok');
          return { confirmed: true };
        }
        // 2xx with body.ok !== true - shouldn't happen with the current
        // Worker, but if it ever does, Apps Script may have run.
        throw rejection('proxy_body_not_ok', false);
      }, function () {
        // 2xx with unparseable body. Apps Script likely ran.
        throw rejection('proxy_body_unparseable', false);
      });
    }, function () {
      // fetch() itself rejected (TypeError: offline, DNS, request blocked
      // by extension, etc). The request never reached Cloudflare, so it
      // never reached Apps Script either - safe to fall back.
      throw rejection('proxy_network_error', true);
    });
  }

  // Fallback: direct no-cors POST to Apps Script. We cannot read the
  // response, so we resolve with confirmed=false. The submission still
  // reaches Apps Script (sheet + email run); GA is suppressed because
  // we have no proof of success.
  function postDirectFallback(payload) {
    debug('Contact proxy failed, using direct Apps Script fallback');
    var url = CONFIG.webhookUrl;
    if (!url) return Promise.reject(new Error('no_webhook_url'));
    return fetch(url, {
      method:  'POST',
      mode:    'no-cors',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body:    JSON.stringify(payload)
    }).then(function () {
      debug('Direct fallback completed, GA contact_form_submit suppressed');
      return { confirmed: false };
    });
  }

  function postToWebhook(payload) {
    return postToProxy(payload).catch(function (err) {
      // Only retry via the direct Apps Script POST when we can prove the
      // proxy never delivered the body. Ambiguous failures propagate so
      // the user sees an error instead of triggering a duplicate.
      if (err && err.fallbackSafe === true) {
        return postDirectFallback(payload);
      }
      throw err;
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
      .then(function (result) {
        if (result && result.confirmed === true &&
            window.PANOPTIC_ANALYTICS &&
            typeof window.PANOPTIC_ANALYTICS.trackEvent === 'function') {
          window.PANOPTIC_ANALYTICS.trackEvent('contact_form_submit', {
            form_name:         'contact',
            form_route:        formRoute(form),
            form_id:           form.id || '',
            service:           payload.service,
            project_type:      payload.projectType,
            preferred_contact: payload.preferredContact,
            source_page:       payload.source && (payload.source.page_url || payload.source.page_path)
          });
        }
        // Confirmed-success hook for page-scoped conversion tracking. A page can
        // listen for this to fire its own GA4 event (e.g. rsj_form_submit_success).
        // Detail is deliberately minimal; pages decide what is safe to send on.
        if (result && result.confirmed === true) {
          try {
            document.dispatchEvent(new CustomEvent('panoptic:form-success', {
              detail: {
                formName:   'contact',
                formRoute:  formRoute(form),
                formId:     form.id || '',
                service:    payload.service,
                hasMessage: !!(payload.message && String(payload.message).trim()),
                postcode:   payload.postcode || ''
              }
            }));
          } catch (_) {}
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

    // form_start - first focus into any field, once per form per pageview.
    // For the checker qualifier this fires when the visitor reaches the
    // contact step (checker.js's tool_started covers earlier engagement).
    var started = false;
    form.addEventListener('focusin', function (e) {
      if (started) return;
      var el = e.target;
      if (!el || !el.matches || !el.matches('input, select, textarea')) return;
      if (el.name === '_honey') return;
      started = true;
      trackEvent('form_start', {
        form_route: formRoute(form),
        form_id:    form.id || ''
      });
    });

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
