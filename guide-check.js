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
      secondary: { href: 'crack-inspection-london', label: 'How a crack inspection works' },
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
    },

    // Load-bearing wall guide. Feeds the RSJ page.
    wall: {
      service: 'RSJ / steel beam / load-bearing wall',
      secondary: { href: 'rsj-steel-beam-calculations-london', label: 'RSJ and beam calculations' },
      questions: [
        {
          key: 'type',
          label: 'What kind of wall is it?',
          summary: 'Wall',
          options: [
            { value: 'inside',   label: 'An inside wall between two rooms' },
            { value: 'outside',  label: 'An outside wall or one that used to be outside' },
            { value: 'chimney',  label: 'It has a chimney breast in it' }
          ]
        },
        {
          key: 'boards',
          label: 'Which way do the floorboards run in the room above?',
          summary: 'Boards above',
          when: function (a) { return a.type === 'inside'; },
          options: [
            { value: 'parallel', label: 'The same way as the wall' },
            { value: 'across',   label: 'Across the wall, at right angles' },
            { value: 'none',     label: 'There is no floor above, just the loft' },
            { value: 'unsure',   label: 'Cannot tell, there is carpet' }
          ]
        },
        {
          key: 'above',
          label: 'Is there a wall directly above it or anything in the loft landing on it?',
          summary: 'Above it',
          when: function (a) { return a.type === 'inside'; },
          options: [
            { value: 'yes',    label: 'Yes, a wall above or roof timbers on it' },
            { value: 'no',     label: 'No, nothing above it' },
            { value: 'unsure', label: 'Not sure' }
          ]
        }
      ],
      result: function (a) {
        var r = { body: [], honest: false };
        var timing = 'Design is a fixed fee. For a straightforward project allow about 3–4 weeks for the calculations and drawings, so for building work in spring it is worth starting in December or January.';

        if (a.type === 'outside') {
          r.type = 'wall_outside';
          r.verdict = 'Load-bearing';
          r.title = 'Outside walls are always structural.';
          r.body.push('Front, back and side walls carry the floors, the roof and the wind. Any new opening in one needs a beam or lintel sized by an engineer. A wall that used to be outside before an extension was built against it is almost always still structural.');
          r.body.push(timing);
          r.cta = 'Send photos for a quote ';
        } else if (a.type === 'chimney') {
          r.type = 'wall_chimney';
          r.verdict = 'A case of its own';
          r.title = 'A chimney breast carries the masonry above it.';
          r.body.push('Taking out a breast downstairs while the breast upstairs or the stack stays leaves that brickwork hanging. Gallows brackets or a beam then have to carry it and Building Control will want calculations.');
          r.body.push(timing);
          r.secondary = { href: 'chimney-breast-removal-structural-engineer-london', label: 'Chimney breast removal' };
        } else if (a.boards === 'parallel' || a.above === 'yes') {
          r.type = 'wall_loadbearing';
          r.verdict = 'Treat it as load-bearing';
          r.title = 'Something is very likely resting on it.';
          if (a.boards === 'parallel') r.body.push('Boards running the same way as the wall mean the joists cross it and may well land on it.');
          if (a.above === 'yes') r.body.push('A wall or roof timbers in line above it bring load straight down through it.');
          r.body.push('Taking it out means a steel beam sized by an engineer, with the supports at each end checked. Photos of both sides, the room above and the loft are usually enough for us to confirm it.');
          r.body.push(timing);
          r.cta = 'Send photos for a quote ';
        } else if ((a.boards === 'across' || a.boards === 'none') && a.above === 'no') {
          r.type = 'wall_maybe_not';
          r.honest = true;
          r.verdict = 'May well not be load-bearing';
          r.title = 'Joists alongside and nothing above usually means no.';
          r.body.push('Two things still catch people out. A joist can run over the top of a wall and lean on it in the middle of its span. Some walls carry little weight but stop the house racking sideways.');
          r.body.push('A photo of both sides and the room above usually settles it. If it is not load-bearing we will say so and you will not need us.');
        } else {
          r.type = 'wall_unsure';
          r.verdict = 'Treat it as load-bearing until checked';
          r.title = 'Not sure is the most common answer.';
          r.body.push('It is also the safest starting point. Lift a board in a cupboard upstairs or look in the loft if you can. Otherwise photos of both sides of the wall and the room above are usually enough for us to tell you what it is doing.');
          r.body.push(timing);
        }
        return r;
      }
    },

    // Chimney breast and Party Wall Act guide. Feeds the chimney page.
    chimney: {
      service: 'Chimney breast removal calculations',
      secondary: { href: 'chimney-breast-removal-structural-engineer-london', label: 'Chimney breast removal' },
      questions: [
        {
          key: 'whose',
          label: 'What is your situation?',
          summary: 'Situation',
          options: [
            { value: 'mine',      label: 'I want to remove a chimney breast' },
            { value: 'neighbour', label: 'My neighbour is removing theirs' },
            { value: 'done',      label: 'One was removed in the past and we are buying or selling' }
          ]
        },
        {
          key: 'wall',
          label: 'Which wall is the breast on?',
          summary: 'Wall',
          when: function (a) { return a.whose === 'mine'; },
          options: [
            { value: 'party',  label: 'The wall we share with next door' },
            { value: 'own',    label: 'A wall only we own' },
            { value: 'unsure', label: 'Not sure' }
          ]
        },
        {
          key: 'stack',
          label: 'What happens to the breast upstairs and the stack?',
          summary: 'Above it',
          when: function (a) { return a.whose === 'mine'; },
          options: [
            { value: 'staying', label: 'They stay. Only the lower part comes out' },
            { value: 'all',     label: 'Everything comes out, right up to the roof' },
            { value: 'unsure',  label: 'Not decided yet' }
          ]
        },
        {
          key: 'papers',
          label: 'Is there a Building Control completion certificate for it?',
          summary: 'Paperwork',
          when: function (a) { return a.whose === 'done'; },
          options: [
            { value: 'yes',    label: 'Yes, we have it' },
            { value: 'no',     label: 'No or we cannot find one' }
          ]
        }
      ],
      result: function (a) {
        var r = { body: [], honest: false };
        if (a.whose === 'neighbour') {
          r.type = 'chimney_neighbour';
          r.verdict = 'The Act protects you too';
          r.title = 'You should get notice at least two months before they start.';
          r.body.push('You can consent in writing or dissent, which brings in a surveyor to record the condition of your house. Where the work only benefits them, they normally pay for your surveyor.');
          r.body.push('If the stack is shared, ask to see the calculations for how it will be held up. If the work is already done, photograph your side of the wall, the loft and the stack now. New cracks near the breast are worth sending us.');
          r.cta = 'Send photos of your side ';
          r.honest = true;
          return r;
        }
        if (a.whose === 'done') {
          if (a.papers === 'yes') {
            r.type = 'chimney_done_cert';
            r.honest = true;
            r.verdict = 'Probably covered';
            r.title = 'A completion certificate is what buyers and lenders ask for.';
            r.body.push('Keep it with the house documents and give a copy to the solicitor. If a survey has still flagged cracking near where the breast was, send us the wording and a few photos.');
          } else {
            r.type = 'chimney_done_nocert';
            r.verdict = 'You will probably need a report';
            r.title = 'Without sign-off, a buyer or lender usually wants an engineer to look.';
            r.body.push('A chartered engineer inspects what is holding up the masonry above and says in writing whether it is adequate. Send photos of the area, the room above and the loft with any survey wording and we will tell you what the report needs to cover.');
            r.read = { href: 'evidence-of-movement-on-a-survey', label: 'What "evidence of movement" on a survey means' };
            r.cta = 'Send photos for a quote ';
          }
          return r;
        }

        // Removing your own breast.
        if (a.stack === 'all') {
          r.type = 'chimney_full';
          r.verdict = 'Simpler, still needs sign-off';
          r.title = 'With everything coming out, the design question largely disappears.';
          r.body.push('You still need Building Control approval and the roof made good. You may not need a full calculation pack. A few photos let us tell you which.');
        } else {
          r.type = 'chimney_support';
          r.verdict = 'Needs designed support';
          r.title = 'The masonry above has to be carried by something designed for it.';
          r.body.push('That is a steel beam or, where Building Control accepts them, gallows brackets. Building Control will want calculations for whichever it is.');
        }
        if (a.wall === 'party') {
          r.body.push('On a shared wall you serve a party structure notice at least two months before work starts. Getting the calculations done first makes the notice and the surveyor’s job far easier.');
        } else if (a.wall === 'own') {
          r.body.push('On a wall only you own, the Party Wall Act does not apply. Building Control approval still does.');
        } else {
          r.body.push('Photos of both sides of the wall, the loft and the stack from outside usually show whether the breast is on the party wall.');
        }
        r.body.push(a.wall === 'own'
          ? 'Allow about 3–4 weeks for the design on a straightforward job. For building work in spring it is worth starting in December or January.'
          : 'Allow about 3–4 weeks for the design on a straightforward job, plus two months for notice on a party wall. For building work in spring that means starting before Christmas.');
        r.cta = 'Send photos for a quote ';
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
    return this.visible().map(function (q) {
      return q.summary + ': ' + optionLabel(q, self.answers[q.key]);
    }).join(' · ');
  };

  // Questions that apply given the answers so far (a question with a
  // when(answers) function is skipped when it returns false).
  GuideCheck.prototype.visible = function () {
    var a = this.answers;
    return this.topic.questions.filter(function (q) { return !q.when || q.when(a); });
  };

  GuideCheck.prototype.focus = function () {
    var h = this.stage.querySelector('.sec-checker-q, .sec-checker-result h3');
    if (h) { try { h.focus({ preventScroll: true }); } catch (_) {} }
  };

  GuideCheck.prototype.render = function () {
    var qs = this.visible();
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
        // Drop answers to questions that no longer apply after this change.
        var keep = {};
        self.visible().forEach(function (vq) { if (self.answers[vq.key]) keep[vq.key] = self.answers[vq.key]; });
        self.answers = keep;
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
      r.cta || (r.honest ? 'Send a photo anyway ' : 'Send photos for a free first view '));
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

    // The honest result does not push the paid service.
    var svc = r.secondary || this.topic.secondary;
    if (!r.honest && svc) {
      var service = el('a', 'btn btn-outline', svc.label + ' ');
      service.href = svc.href;
      service.appendChild(arrowSpan());
      service.addEventListener('click', function () {
        track('guide_check_cta', self.params({ cta: 'service_page', result_type: r.type, href: svc.href }));
      });
      actions.appendChild(service);
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
