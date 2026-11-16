/* ============================================================
   Panoptic - in-guide quick check
   A three-question triage that sits in the middle of a guide,
   at the point where the reader is deciding "is this me?".

   Why it exists: guides answer "is this normal?" and the answer
   is usually yes, so readers leave reassured. This catches the
   worried minority and the readers with a deadline (a sale, a
   survey, an insurance claim) and hands them to the page's own
   WhatsApp mini-form with their answers already written in.
   The enquiry is then logged to the sheet like any other.

   Markup (one per guide, placed after the "what to do" or
   "warning signs" section):

     <div class="sec-checker guide-check"
          data-guide-check="crack"
          data-guide="plaster"
          data-form="#whatsappFormPlaster">
       <div data-guide-check-stage></div>
       <noscript>...link to #send-photos...</noscript>
     </div>

   data-guide-check  topic key in TOPICS below (add new topics there)
   data-guide        short slug used in analytics and the summary
   data-form         selector of the page's .js-whatsapp-form

   Analytics (consent-gated via PANOPTIC_ANALYTICS):
     guide_check_started, guide_check_step,
     guide_check_result, guide_check_cta
   ============================================================ */

(function () {
  'use strict';

  var DISCLAIMER =
    'Indicative guidance only. This is not structural advice and not a ' +
    'substitute for an engineer’s assessment of your property.';

  // ---- Topics -----------------------------------------------------------------
  // Each topic: an ordered list of questions and a result(answers) function
  // returning { type, verdict, title, body[], honest, read? }.
  // To add a topic for a future guide, add an entry here and drop the markup in.

  var REASON = {
    key: 'reason',
    label: 'Why are you looking into it?',
    summary: 'Reason',
    options: [
      { value: 'peace',     label: 'Peace of mind about my own home' },
      { value: 'sale',      label: 'A purchase, a sale or a survey report' },
      { value: 'insurance', label: 'Thinking about an insurance claim' },
      { value: 'works',     label: 'Building work nearby or in the house' }
    ]
  };

  function reasonParagraphs(answers, r) {
    switch (answers.reason) {
      case 'sale':
        r.body.push('If a sale or a mortgage depends on it, the buyer, solicitor or lender will usually want a written view from a chartered engineer. Send the survey wording with your photos and we will tell you what the report needs to cover.');
        r.read = { href: 'evidence-of-movement-on-a-survey', label: 'What "evidence of movement" on a survey means' };
        break;
      case 'insurance':
        r.body.push('Before you claim, it helps to know the likely cause, because that decides whether a policy covers it. Tell your insurer before any repairs are done.');
        r.read = { href: 'does-home-insurance-cover-cracked-walls', label: 'Does home insurance cover cracked walls?' };
        break;
      case 'works':
        r.body.push('Cracks that appear after building work are worth recording now with dated photos and a pencil mark at each end. If the work is next door, that record matters for any party wall discussion later.');
        break;
    }
  }

  var TOPICS = {
    crack: {
      service: 'Crack inspection / suspected movement',
      questions: [
        {
          key: 'width',
          label: 'How wide is the crack?',
          summary: 'Width',
          options: [
            { value: 'hairline', label: 'Hairline, thinner than a 5p coin' },
            { value: 'wider',    label: 'Wider, you could fit a coin in' },
            { value: 'growing',  label: 'Getting bigger or doors are sticking' }
          ]
        },
        {
          key: 'shape',
          label: 'Where is it and which way does it run?',
          summary: 'Pattern',
          options: [
            { value: 'joint',    label: 'Along a joint, a corner or the ceiling line' },
            { value: 'diagonal', label: 'Diagonal from the corner of a door or window' },
            { value: 'outside',  label: 'Stepped or straight through outside brickwork' },
            { value: 'unsure',   label: 'Not sure' }
          ]
        },
        REASON
      ],
      result: function (a) {
        var r = { body: [], honest: false };
        var cosmetic = a.width === 'hairline' && a.shape === 'joint';

        if (cosmetic) {
          r.type = 'crack_cosmetic';
          r.honest = true;
          r.verdict = 'Very likely cosmetic';
          r.title = 'That is the classic drying and shrinkage pattern.';
          r.body.push('Hairline cracks along joints, corners and the ceiling line are what plaster and timber do as they dry out. They are a decorating job, not a building problem.');
          r.body.push('Mark each end in pencil, date it and look again in three months. If it has gone past the marks or come back after filling, send us a photo.');
        } else {
          r.type = a.width === 'growing' ? 'crack_active' : 'crack_look';
          r.verdict = 'Worth a photo';
          if (a.width === 'growing') {
            r.title = 'A crack that is growing is the one to look at.';
            r.body.push('Cracks that are getting bigger or doors and windows starting to stick are the signs we take most seriously. They do not automatically mean subsidence but they do mean something is still moving.');
          } else if (a.shape === 'diagonal' || a.shape === 'outside') {
            r.title = 'That pattern usually means the wall moved, not just the plaster.';
            r.body.push('Diagonal cracks from the corner of an opening and cracks through outside brickwork tend to follow movement in the masonry behind. Most have a straightforward cause such as a lintel or old settlement. A photo is usually enough to tell which.');
          } else if (a.width === 'wider') {
            r.title = 'A crack you can fit a coin in is worth understanding.';
            r.body.push('Most wider cracks still have a simple cause. A wide shot of the wall and a close-up with a coin for scale usually tells us whether it needs a visit.');
          } else {
            r.title = 'Hard to call without seeing it.';
            r.body.push('A hairline crack is usually cosmetic but where it sits and which way it runs matter more than its width. A wide shot and a close-up will settle it.');
          }
          r.body.push('Send photos and a chartered engineer will give you a free first view. Most of what we are sent does not need a site visit.');
        }

        reasonParagraphs(a, r);
        if (cosmetic && (a.reason === 'sale' || a.reason === 'insurance')) {
          r.honest = false;
          r.verdict = 'Probably cosmetic. You may still need it in writing';
          r.type = 'crack_cosmetic_' + a.reason;
        }
        return r;
      }
    }
  };

  // ---- Helpers ---------------------------------------------------------------

  function track(name, params) {
    try {
      if (window.PANOPTIC_ANALYTICS && typeof window.PANOPTIC_ANALYTICS.trackEvent === 'function') {
        window.PANOPTIC_ANALYTICS.trackEvent(name, params || {});
      }
    } catch (_) {}
  }

  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text) node.textContent = text;
    return node;
  }

  function arrowSpan() {
    var s = el('span', 'arrow', '→');
    s.setAttribute('aria-hidden', 'true');
    return s;
  }

  function optionLabel(q, value) {
    for (var i = 0; i < q.options.length; i++) {
      if (q.options[i].value === value) return q.options[i].label;
    }
    return value;
  }

  // ---- Widget ----------------------------------------------------------------

  function GuideCheck(root) {
    this.root = root;
    this.topic = TOPICS[root.getAttribute('data-guide-check')];
    if (!this.topic) return;
    this.guide = root.getAttribute('data-guide') || '';
    this.formSelector = root.getAttribute('data-form') || '.js-whatsapp-form';
    this.stage = root.querySelector('[data-guide-check-stage]') || root;
    this.answers = {};
    this.step = 0;
    this.started = false;
    this.render();
  }

  GuideCheck.prototype.params = function (extra) {
    var p = { guide: this.guide, topic: this.root.getAttribute('data-guide-check') };
    Object.keys(extra || {}).forEach(function (k) { p[k] = extra[k]; });
    return p;
  };

  GuideCheck.prototype.summary = function () {
    var self = this;
    return this.topic.questions.map(function (q) {
      return q.summary + ': ' + optionLabel(q, self.answers[q.key]);
    }).join(' · ');
  };

  GuideCheck.prototype.focus = function () {
    var h = this.stage.querySelector('.sec-checker-q, .sec-checker-result h3');
    if (h) { try { h.focus({ preventScroll: true }); } catch (_) {} }
  };

  GuideCheck.prototype.render = function () {
    var qs = this.topic.questions;
    if (this.step >= qs.length) { this.renderResult(); return; }
    var self = this;
    var q = qs[this.step];
    this.stage.innerHTML = '';

    var head = el('div', 'sec-checker-head');
    head.appendChild(el('span', 'sec-checker-progress', 'Question ' + (this.step + 1) + ' of ' + qs.length));
    var bar = el('div', 'sec-checker-bar');
    var fill = el('span', 'sec-checker-bar-fill');
    fill.style.width = Math.round((this.step / qs.length) * 100) + '%';
    bar.appendChild(fill);
    head.appendChild(bar);
    this.stage.appendChild(head);

    var h = el('h3', 'sec-checker-q', q.label);
    h.setAttribute('tabindex', '-1');
    this.stage.appendChild(h);

    var opts = el('div', 'sec-checker-options');
    q.options.forEach(function (opt) {
      var b = el('button', 'sec-checker-opt', opt.label);
      b.type = 'button';
      if (self.answers[q.key] === opt.value) b.classList.add('is-selected');
      b.addEventListener('click', function () {
        if (!self.started) { self.started = true; track('guide_check_started', self.params()); }
        self.answers[q.key] = opt.value;
        self.step += 1;
        track('guide_check_step', self.params({ step: self.step, question: q.key, answer: opt.value }));
        self.render();
        self.focus();
      });
      opts.appendChild(b);
    });
    this.stage.appendChild(opts);

    if (this.step > 0) {
      var back = el('button', 'sec-checker-back', '← Back');
      back.type = 'button';
      back.addEventListener('click', function () { self.step -= 1; self.render(); self.focus(); });
      this.stage.appendChild(back);
    }
  };

  GuideCheck.prototype.renderResult = function () {
    var self = this;
    var r = this.topic.result(this.answers);
    var summary = this.summary();
    track('guide_check_result', this.params({ result_type: r.type, reason: this.answers.reason || '' }));

    this.stage.innerHTML = '';
    var card = el('div', 'sec-checker-result');
    var verdict = el('span', 'sec-checker-verdict', r.verdict);
    if (r.honest) verdict.classList.add('is-honest');
    card.appendChild(verdict);
    var h = el('h3', null, r.title);
    h.setAttribute('tabindex', '-1');
    card.appendChild(h);
    r.body.forEach(function (p) { card.appendChild(el('p', 'sec-checker-body', p)); });
    card.appendChild(el('p', 'sec-checker-recap', summary));

    var actions = el('div', 'sec-checker-actions');
    var send = el('a', r.honest ? 'btn btn-outline' : 'btn btn-accent',
      r.honest ? 'Send a photo anyway ' : 'Send photos for a free first view ');
    send.appendChild(arrowSpan());
    var form = document.querySelector(this.formSelector);
    send.href = form && form.closest('section[id]') ? '#' + form.closest('section[id]').id : '#send-photos';
    send.addEventListener('click', function (e) {
      track('guide_check_cta', self.params({ cta: 'whatsapp_form', result_type: r.type }));
      if (!form) return;
      e.preventDefault();
      self.prefill(form, summary);
    });
    actions.appendChild(send);

    // The honest (cosmetic) result does not push the paid service.
    if (!r.honest) {
      var crack = el('a', 'btn btn-outline', 'How a crack inspection works ');
      crack.href = 'crack-inspection-london';
      crack.appendChild(arrowSpan());
      crack.addEventListener('click', function () {
        track('guide_check_cta', self.params({ cta: 'crack_page', result_type: r.type }));
      });
      actions.appendChild(crack);
    }
    card.appendChild(actions);

    // Skip a "read next" link that points back at the guide being read.
    var here = window.location.pathname.replace(/\.html$/, '').replace(/^\//, '');
    if (r.read && r.read.href !== here) {
      var more = el('p', 'sec-checker-readmore', 'Read next: ');
      var a = el('a', null, r.read.label + ' →');
      a.href = r.read.href;
      a.addEventListener('click', function () {
        track('guide_check_cta', self.params({ cta: 'read_next', result_type: r.type, href: r.read.href }));
      });
      more.appendChild(a);
      card.appendChild(more);
    }

    card.appendChild(el('p', 'sec-checker-disclaimer', DISCLAIMER));
    var again = el('button', 'sec-checker-back', '↻ Start again');
    again.type = 'button';
    again.addEventListener('click', function () { self.answers = {}; self.step = 0; self.render(); self.focus(); });
    card.appendChild(again);

    this.stage.appendChild(card);
    this.focus();
  };

  // Write the answers into the page's WhatsApp mini-form (logged to the sheet
  // by whatsapp-form.js on submit), then take the reader to its postcode field.
  GuideCheck.prototype.prefill = function (form, summary) {
    var msg = form.elements['message'];
    if (msg) {
      var line = 'Quick check: ' + summary;
      if (!msg.value || msg.value.indexOf('Quick check:') === 0) msg.value = line;
    }
    var section = form.closest('section') || form;
    try { section.scrollIntoView({ behavior: 'smooth', block: 'start' }); } catch (_) { section.scrollIntoView(); }
    var pc = form.elements['postcode'];
    if (pc) setTimeout(function () { try { pc.focus({ preventScroll: true }); } catch (_) {} }, 450);
  };

  function ready(fn) {
    if (document.readyState !== 'loading') fn();
    else document.addEventListener('DOMContentLoaded', fn, { once: true });
  }

  ready(function () {
    document.querySelectorAll('[data-guide-check]').forEach(function (root) {
      try { new GuideCheck(root); } catch (_) {}
    });
  });
})();
