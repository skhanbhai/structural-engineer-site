/* ============================================================
   Panoptic - "Do I need a structural engineer?" checker
   One component, two deployment modes, attached to every
   element carrying [data-checker]:

     data-mode="standalone"
       Full discovery wizard (one question per screen, back
       button, progress). Ends on a tailored result screen with
       honest "you may not need an engineer" branches, quote +
       WhatsApp CTAs and a deep-linkable hash so results can be
       shared or revisited.

     data-mode="qualifier"
       Embedded on the ad landing pages in place of the long
       enquiry form. 3 steps max (project specifics -> property
       -> contact details), ALWAYS ends in a submission path -
       no dead ends for paid traffic. The contact step is the
       page's own static .js-enquiry-form (already enhanced by
       form.js), so validation, webhook delivery, GA gating and
       the success state are identical to every other enquiry.

   Container config (data attributes):
     data-project       preset project key (qualifier pages) -
                        wall | chimney | extension
     data-service       service string used in summaries
     data-event-prefix  page slug for analytics params

   Lead handoff: answers are serialised into a plain-English
   summary. Qualifier mode writes it to the hidden projectType
   field (form.js sends service and projectType distinctly);
   standalone mode pre-fills the page enquiry form's projectType
   + message and the WhatsApp prefill URL, so Vijay receives a
   pre-qualified enquiry either way.

   Analytics (all consent-gated via PANOPTIC_ANALYTICS):
     tool_started, tool_step, tool_result_shown, tool_cta_click
   ============================================================ */

(function () {
  'use strict';

  var WHATSAPP_NUMBER = '447940540903';

  /* -------------------------------------------------------------
     DISCLAIMER - single editable constant. Shown on every result
     screen and above the qualifier submit button.
     TODO: final wording to be approved by Vijay (and his PI
     insurer) before launch. Edit here only.
     ------------------------------------------------------------- */
  var DISCLAIMER =
    'Indicative guidance only. This is not structural advice, and not a ' +
    'substitute for an engineer’s assessment or calculations for ' +
    'your specific property.';

  // ---- Question bank --------------------------------------------------------

  var QUESTIONS = {
    project: {
      label: 'What are you planning?',
      summary: 'Project',
      options: [
        { value: 'wall',      label: 'Removing or altering a wall' },
        { value: 'knock',     label: 'Kitchen knock-through / open-plan' },
        { value: 'chimney',   label: 'Chimney breast removal' },
        { value: 'extension', label: 'Rear or side extension' },
        { value: 'loft',      label: 'Loft conversion' },
        { value: 'cracks',    label: 'Cracks or movement concern' },
        { value: 'other',     label: 'Something else' }
      ]
    },
    property: {
      label: 'What type of property is it?',
      summary: 'Property',
      options: [
        { value: 'terraced', label: 'Terraced house' },
        { value: 'semi',     label: 'Semi-detached house' },
        { value: 'detached', label: 'Detached house' },
        { value: 'flat',     label: 'Flat or maisonette' }
      ]
    },
    floor: {
      label: 'Which floor is the wall on?',
      summary: 'Floor',
      options: [
        { value: 'ground',   label: 'Ground floor' },
        { value: 'first',    label: 'First floor' },
        { value: 'upper',    label: 'Second floor or higher' },
        { value: 'basement', label: 'Basement' }
      ]
    },
    loadbearing: {
      label: 'Do you know if the wall is load-bearing?',
      summary: 'Load-bearing',
      options: [
        { value: 'yes',    label: 'Yes, it’s load-bearing' },
        { value: 'no',     label: 'No, it’s a light stud partition' },
        { value: 'unsure', label: 'Not sure' }
      ]
    },
    builder: {
      label: 'Has a builder or architect asked you for calculations?',
      summary: 'Calcs requested',
      options: [
        { value: 'yes',    label: 'Yes, they’ve asked for the calcs' },
        { value: 'notyet', label: 'Not yet / no builder involved' }
      ]
    },
    chimneyScope: {
      label: 'How much of the chimney breast is coming out?',
      summary: 'Scope',
      options: [
        { value: 'ground', label: 'Ground floor only' },
        { value: 'first',  label: 'First floor only' },
        { value: 'both',   label: 'Ground and first floor' },
        { value: 'full',   label: 'Everything, including the stack' }
      ]
    },
    stack: {
      label: 'Is the chimney stack above staying?',
      summary: 'Stack',
      options: [
        { value: 'staying', label: 'Yes, the stack stays' },
        { value: 'removed', label: 'No, the stack is going too' },
        { value: 'unsure',  label: 'Not sure' }
      ]
    },
    extType: {
      label: 'What kind of extension?',
      summary: 'Extension',
      options: [
        { value: 'rear', label: 'Rear extension' },
        { value: 'side', label: 'Side-return infill' },
        { value: 'wrap', label: 'Wraparound' }
      ]
    },
    rearWall: {
      label: 'Will the rear (or side) wall of the house be opened up?',
      summary: 'Opening rear wall',
      options: [
        { value: 'yes',    label: 'Yes, a wide opening or bifolds' },
        { value: 'no',     label: 'No, existing openings stay' },
        { value: 'unsure', label: 'Not sure yet' }
      ]
    },
    loftScope: {
      label: 'What kind of loft work?',
      summary: 'Loft work',
      options: [
        { value: 'conversion', label: 'Full conversion to a usable room' },
        { value: 'dormer',     label: 'Conversion with a dormer' },
        { value: 'storage',    label: 'Just boarding for light storage' }
      ]
    },
    crackWidth: {
      label: 'What best describes the cracks?',
      summary: 'Cracks',
      options: [
        { value: 'hairline', label: 'Hairline, thinner than a 5p coin' },
        { value: 'wider',    label: 'Wider, you could fit a coin in' },
        { value: 'growing',  label: 'Growing, spreading or doors sticking' }
      ]
    },
    timeline: {
      label: 'Where are you in the project?',
      summary: 'Timeline',
      options: [
        { value: 'researching', label: 'Just researching' },
        { value: 'planning',    label: 'Actively planning' },
        { value: 'booked',      label: 'Builder booked' },
        { value: 'started',     label: 'Work already started' }
      ]
    }
  };

  // Standalone flows: question keys per project branch (project asked first).
  var FLOWS = {
    wall:      ['project', 'property', 'floor', 'loadbearing', 'builder', 'timeline'],
    knock:     ['project', 'property', 'loadbearing', 'builder', 'timeline'],
    chimney:   ['project', 'property', 'chimneyScope', 'stack', 'timeline'],
    extension: ['project', 'property', 'extType', 'rearWall', 'timeline'],
    loft:      ['project', 'property', 'loftScope', 'timeline'],
    cracks:    ['project', 'property', 'crackWidth', 'timeline'],
    other:     ['project', 'property', 'timeline']
  };

  // Qualifier step 1 (project specifics) per preset project.
  var QUALIFIER_SPECIFICS = {
    wall:      ['floor', 'loadbearing', 'builder'],
    chimney:   ['chimneyScope', 'stack'],
    extension: ['extType', 'rearWall']
  };

  var PROJECT_NAMES = {
    wall: 'Wall removal / alteration', knock: 'Kitchen knock-through',
    chimney: 'Chimney breast removal', extension: 'Rear / side extension',
    loft: 'Loft conversion', cracks: 'Cracks / movement concern',
    other: 'Other project'
  };

  // ---- Results (standalone mode) --------------------------------------------

  function optionLabel(key, value) {
    var q = QUESTIONS[key];
    if (!q) return value;
    for (var i = 0; i < q.options.length; i++) {
      if (q.options[i].value === value) return q.options[i].label;
    }
    return value;
  }

  function summarise(answers, service) {
    var parts = [];
    if (answers.project) {
      parts.push('Project: ' + PROJECT_NAMES[answers.project]);
    } else if (service) {
      parts.push('Project: ' + service);
    }
    ['property', 'floor', 'loadbearing', 'builder', 'chimneyScope', 'stack',
     'extType', 'rearWall', 'loftScope', 'crackWidth', 'timeline'
    ].forEach(function (k) {
      if (answers[k]) {
        parts.push(QUESTIONS[k].summary + ': ' + plain(optionLabel(k, answers[k])));
      }
    });
    return parts.join(' · ');
  }

  // Compact the chatty prefixes ("Yes, ...") so summaries stay short.
  function plain(label) {
    return String(label).replace(/^(Yes|No|Not sure),\s*/i, function (m, p1) {
      return p1 + ': ';
    }).replace(/: $/, '');
  }

  function partyWallLikely(answers) {
    var attached = answers.property === 'terraced' || answers.property === 'semi' || answers.property === 'flat';
    if (!attached) return false;
    return answers.project === 'chimney' || answers.project === 'extension' || answers.project === 'loft';
  }

  function buildResult(answers) {
    var p = answers.project || 'other';
    var r = {
      type: p + '_engineer',
      verdict: 'An engineer is the right next step',
      title: '',
      body: [],
      needs: [],
      honest: false
    };

    // Contextual "read more" route into the matching service page (or the
    // on-page straight-answer for the honest branches). Rendered as a quiet
    // link under the CTAs; keeps the money pages one tap from every result.
    var READ_LINKS = {
      wall:      { href: 'rsj-steel-beam-calculations-london',              label: 'RSJ & steel beam calculations in London' },
      knock:     { href: 'rsj-steel-beam-calculations-london',              label: 'RSJ & steel beam calculations in London' },
      chimney:   { href: 'chimney-breast-removal-structural-engineer-london', label: 'Chimney breast removal, step by step' },
      extension: { href: 'extension-structural-engineer-london',            label: 'Structural engineering for extensions' },
      loft:      { href: 'services.html#lofts',                             label: 'Loft conversion structural design' }
    };
    var MAYBE_NOT_LINK = { href: '#when-you-may-not', label: 'When you may not need an engineer' };

    switch (p) {
      case 'wall':
      case 'knock':
        if (answers.loadbearing === 'no') {
          r.type = p + '_maybe_not';
          r.verdict = 'You may not need an engineer';
          r.title = 'A genuine stud partition may not need calculations.';
          r.body.push('If the wall really is a light, non-load-bearing stud partition, you may not need a structural engineer to remove it.');
          r.body.push('The catch: plenty of walls that look like stud partitions turn out to be carrying something: a bit of floor, a purlin strut, or the wall above. If you’d like certainty before anyone swings a hammer, send us a few photos and we’ll give you a quick view.');
          r.honest = true;
        } else {
          r.title = answers.loadbearing === 'yes'
            ? 'A load-bearing wall removal needs structural calculations.'
            : 'Treat the wall as load-bearing until it’s confirmed either way.';
          r.body.push('Removing or altering a wall that carries floor, roof or wall loads means a beam, usually an RSJ or steel, sized by an engineer, with the supports at each end checked.');
          if (answers.loadbearing === 'unsure') {
            r.body.push('Not sure is the most common answer, and the safest starting point. Photos, a floor plan or rough measurements are usually enough for us to tell you what the wall is doing.');
          }
          r.body.push('Building Control will normally want to see the calculations before signing the work off.');
          r.needs.push('Structural calculations', 'Building Control sign-off');
        }
        if (answers.builder === 'yes') {
          r.body.push('Since your builder has already asked for the calcs, that’s exactly what we provide: clear calculations they can price and build from.');
        }
        break;

      case 'chimney':
        r.title = 'Chimney breast removal needs an engineer’s design.';
        r.body.push('The masonry above a removed chimney breast, including any remaining breast and the stack, has to be properly supported. That support (steel beams or, where Building Control accepts them, gallows brackets) needs to be designed and justified with calculations.');
        if (answers.stack === 'staying' || answers.stack === 'unsure') {
          r.body.push('With the stack staying, the support design for what remains in the loft is the critical part. It’s the piece Building Control will look at hardest.');
        }
        if (answers.chimneyScope === 'full') {
          r.body.push('Taking everything out including the stack simplifies the support, but the roof needs making good and the work still needs Building Control sign-off.');
        }
        r.needs.push('Structural calculations', 'Building Control sign-off');
        break;

      case 'extension':
        r.title = 'An extension needs an engineer alongside your architect.';
        r.body.push('Extensions change how loads travel through the building: new beams, lintels, foundations and altered load paths all need structural calculations, usually working from your architect’s drawings.');
        if (answers.rearWall === 'yes') {
          r.body.push('Opening up the rear wall for a wide opening or bifolds typically means a steel, sometimes a goalpost frame, sized for the loads above, with padstones and foundations checked.');
        }
        r.needs.push('Structural calculations', 'Beam / foundation design', 'Building Control package');
        break;

      case 'loft':
        if (answers.loftScope === 'storage') {
          r.type = 'loft_maybe_not';
          r.verdict = 'You may not need an engineer';
          r.title = 'Light storage boarding may not need calculations.';
          r.body.push('Boarding a loft for genuinely light storage often doesn’t need an engineer.');
          r.body.push('One honest caution: ceiling joists in many houses were never designed to carry storage. If you’re planning to load it up, or might later turn it into a room, a quick check now is cheap insurance.');
          r.honest = true;
        } else {
          r.title = 'A loft conversion needs structural design.';
          r.body.push('Converting a loft means a new floor structure, usually new steels, and often trimming the roof, all of which need calculations for Building Control.');
          if (answers.loftScope === 'dormer') {
            r.body.push('A dormer adds roof alterations on top: the opening in the roof and the dormer structure itself both need to be designed.');
          }
          r.needs.push('Structural calculations', 'Building Control sign-off');
        }
        break;

      case 'cracks':
        if (answers.crackWidth === 'hairline') {
          r.type = 'cracks_maybe_not';
          r.verdict = 'Probably nothing to worry about';
          r.title = 'Hairline cracks are usually cosmetic.';
          r.body.push('Fine hairline cracking is common and usually down to seasonal movement or plaster shrinkage rather than a structural problem.');
          r.body.push('If a crack keeps reopening, gets wider, or you’d simply like peace of mind, our photo-first crack inspection is the low-fuss way to check: send photos and we’ll tell you honestly whether it needs a closer look.');
          r.honest = true;
        } else {
          r.type = 'cracks_inspect';
          r.verdict = 'Worth getting looked at';
          r.title = 'These cracks are worth a proper look.';
          r.body.push(answers.crackWidth === 'growing'
            ? 'Cracks that are growing or spreading, or doors and windows starting to stick, are the signs we take most seriously. They don’t automatically mean subsidence, but they do mean it’s worth understanding what’s moving and why.'
            : 'Cracks wide enough to fit a coin in are worth understanding properly. Most have straightforward causes, but that’s exactly what an inspection confirms.');
          r.body.push('Start with our photo-first crack inspection: send photos, and we’ll advise whether a site visit is needed. No unnecessary reports, no scare stories.');
          r.needs.push('Photo review', 'Crack inspection if needed');
        }
        r.crackRoute = true;
        break;

      default: // other
        r.type = 'other_advice';
        r.verdict = 'Tell us what you’re planning';
        r.title = 'Every project is different. Describe yours and we’ll advise.';
        r.body.push('If your project changes, removes or adds structure (walls, beams, floors, roofs, openings), the honest answer is: possibly, and it’s quick to find out. Send a short description with your postcode and we’ll tell you whether an engineer is needed and what the next step looks like.');
        break;
    }

    if (partyWallLikely(answers)) {
      r.needs.push('Party wall notice (likely)');
      r.body.push('Because the property is attached, the work may touch a shared wall, so a party wall notice to the neighbours is often needed. We’ll flag this clearly if it applies.');
    }
    if (answers.property === 'flat') {
      r.body.push('In a flat or maisonette, the freeholder’s consent (a licence to alter) is usually needed too, so it’s worth checking your lease early.');
    }
    if (READ_LINKS[p] && !r.crackRoute) {
      r.read = r.honest ? MAYBE_NOT_LINK : READ_LINKS[p];
    }

    if (answers.timeline === 'booked') {
      r.body.push('With a builder booked, the calculations are usually the item holding the start date, so it’s worth getting them moving now.');
    } else if (answers.timeline === 'started') {
      r.body.push('As work is already underway, it’s sensible to confirm the support in place is adequate sooner rather than later. We can often help at short notice, so mention this in your enquiry.');
    }

    return r;
  }

  // ---- Analytics -------------------------------------------------------------

  function track(name, params) {
    try {
      if (window.PANOPTIC_ANALYTICS &&
          typeof window.PANOPTIC_ANALYTICS.trackEvent === 'function') {
        window.PANOPTIC_ANALYTICS.trackEvent(name, params || {});
      }
    } catch (_) {}
  }

  // ---- Deep links (standalone only) -----------------------------------------

  function encodeAnswers(answers) {
    var parts = [];
    Object.keys(answers).forEach(function (k) {
      if (QUESTIONS[k] && answers[k]) parts.push(k + '.' + answers[k]);
    });
    return '#check=' + parts.join('~');
  }

  function decodeAnswers() {
    var h = window.location.hash || '';
    var m = h.match(/#check=([A-Za-z.~-]+)/);
    if (!m) return null;
    var answers = {};
    m[1].split('~').forEach(function (pair) {
      var kv = pair.split('.');
      var q = QUESTIONS[kv[0]];
      if (!q) return;
      for (var i = 0; i < q.options.length; i++) {
        if (q.options[i].value === kv[1]) { answers[kv[0]] = kv[1]; return; }
      }
    });
    return Object.keys(answers).length ? answers : null;
  }

  // ---- WhatsApp prefill -------------------------------------------------------

  function whatsappUrl(summary) {
    var msg = [
      'Hi Vijay, I used the “Do I need a structural engineer?” checker on your site.',
      '',
      summary,
      '',
      'My postcode is:',
      '',
      'I can send photos, plans or measurements here.'
    ].join('\n');
    return 'https://wa.me/' + WHATSAPP_NUMBER + '?text=' + encodeURIComponent(msg);
  }

  // ---- DOM helpers ------------------------------------------------------------

  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text) node.textContent = text;
    return node;
  }

  // ---- Widget ----------------------------------------------------------------

  function Checker(root) {
    this.root = root;
    this.mode = root.getAttribute('data-mode') === 'qualifier' ? 'qualifier' : 'standalone';
    this.presetProject = root.getAttribute('data-project') || '';
    this.service = root.getAttribute('data-service') || 'Structural engineering enquiry';
    this.eventPrefix = root.getAttribute('data-event-prefix') || this.mode;
    this.answers = {};
    this.started = false;
    this.stepIndex = 0;

    // Pre-answered questions from the page context (e.g. the rear-extension
    // PPC lander presets extType.rear so paid traffic skips that question).
    // Same key.value~key.value encoding as the share hash; invalid entries
    // are ignored.
    var preset = root.getAttribute('data-preset-answers') || '';
    if (preset) {
      var self0 = this;
      preset.split('~').forEach(function (pair) {
        var kv = pair.split('.');
        var q = QUESTIONS[kv[0]];
        if (!q) return;
        for (var i = 0; i < q.options.length; i++) {
          if (q.options[i].value === kv[1]) { self0.answers[kv[0]] = kv[1]; return; }
        }
      });
    }

    this.stage = root.querySelector('[data-checker-steps]');
    if (!this.stage) {
      this.stage = el('div', 'sec-checker-stage');
      this.stage.setAttribute('data-checker-steps', '');
      root.insertBefore(this.stage, root.firstChild);
    }
    this.contactForm = root.querySelector('[data-checker-contact]');
    if (this.contactForm) this.contactForm.hidden = true;

    if (this.mode === 'qualifier') {
      this.steps = this.qualifierSteps();
    }

    var deep = this.mode === 'standalone' ? decodeAnswers() : null;
    if (deep) {
      this.answers = deep;
      var flow = FLOWS[deep.project || 'other'] || FLOWS.other;
      var complete = flow.every(function (k) { return !!deep[k]; });
      if (complete) { this.renderResult(true); return; }
      // Partial deep link (e.g. a homepage answer chip): resume at the
      // first unanswered question instead of re-asking what's answered.
      for (var i = 0; i < flow.length; i++) {
        if (!deep[flow[i]]) { this.stepIndex = i; break; }
      }
    }
    this.render();
  }

  Checker.prototype.trackParams = function (extra) {
    var base = {
      mode: this.mode,
      tool_page: this.eventPrefix,
      project: this.answers.project || this.presetProject || ''
    };
    Object.keys(extra || {}).forEach(function (k) { base[k] = extra[k]; });
    return base;
  };

  Checker.prototype.markStarted = function () {
    if (this.started) return;
    this.started = true;
    track('tool_started', this.trackParams());
  };

  // -- Standalone: one question per screen -----------------------------------

  Checker.prototype.currentFlow = function () {
    return FLOWS[this.answers.project || (this.stepIndex === 0 ? 'other' : 'other')] || FLOWS.other;
  };

  Checker.prototype.render = function () {
    if (this.mode === 'qualifier') { this.renderQualifierStep(); return; }
    var flow = this.answers.project ? FLOWS[this.answers.project] : FLOWS.other;
    if (this.stepIndex >= flow.length) { this.renderResult(); return; }
    var key = flow[this.stepIndex];
    this.renderQuestionScreen(key, flow.length);
  };

  Checker.prototype.renderQuestionScreen = function (key, total) {
    var self = this;
    var q = QUESTIONS[key];
    this.stage.innerHTML = '';

    var head = el('div', 'sec-checker-head');
    // Until a project is chosen the branch length is unknown, so show no total.
    var progressLabel = this.answers.project
      ? 'Question ' + (this.stepIndex + 1) + ' of ' + total
      : 'Question ' + (this.stepIndex + 1);
    var progress = el('span', 'sec-checker-progress', progressLabel);
    head.appendChild(progress);
    var bar = el('div', 'sec-checker-bar');
    var fill = el('span', 'sec-checker-bar-fill');
    fill.style.width = Math.round((this.stepIndex / total) * 100) + '%';
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
      if (self.answers[key] === opt.value) b.classList.add('is-selected');
      b.addEventListener('click', function () {
        self.markStarted();
        var prevProject = self.answers.project;
        self.answers[key] = opt.value;
        // Changing project invalidates branch answers.
        if (key === 'project' && prevProject && prevProject !== opt.value) {
          var keep = { project: opt.value, property: self.answers.property, timeline: self.answers.timeline };
          self.answers = {};
          Object.keys(keep).forEach(function (k) { if (keep[k]) self.answers[k] = keep[k]; });
        }
        self.stepIndex += 1;
        track('tool_step', self.trackParams({ step: self.stepIndex, question: key, answer: opt.value }));
        self.render();
        self.focusHeading();
      });
      opts.appendChild(b);
    });
    this.stage.appendChild(opts);

    if (this.stepIndex > 0) this.stage.appendChild(this.backButton());
  };

  Checker.prototype.backButton = function () {
    var self = this;
    var back = el('button', 'sec-checker-back', '← Back');
    back.type = 'button';
    back.addEventListener('click', function () {
      self.stepIndex = Math.max(0, self.stepIndex - 1);
      self.render();
      self.focusHeading();
    });
    return back;
  };

  Checker.prototype.focusHeading = function () {
    var h = this.stage.querySelector('.sec-checker-q, .sec-checker-result h3');
    if (h) { try { h.focus({ preventScroll: false }); } catch (_) {} }
  };

  // -- Standalone: result screen ----------------------------------------------

  Checker.prototype.renderResult = function (fromDeepLink) {
    var self = this;
    var result = buildResult(this.answers);
    var summary = summarise(this.answers, this.service);

    if (!fromDeepLink) {
      try { history.replaceState(null, '', encodeAnswers(this.answers)); } catch (_) {}
    }
    track('tool_result_shown', this.trackParams({ result_type: result.type }));

    this.stage.innerHTML = '';
    var card = el('div', 'sec-checker-result');

    var verdict = el('span', 'sec-checker-verdict', result.verdict);
    if (result.honest) verdict.classList.add('is-honest');
    card.appendChild(verdict);

    var h = el('h3', null, result.title);
    h.setAttribute('tabindex', '-1');
    card.appendChild(h);

    result.body.forEach(function (para) {
      card.appendChild(el('p', 'sec-checker-body', para));
    });

    if (result.needs.length) {
      var needs = el('ul', 'sec-checker-needs');
      result.needs.forEach(function (n) { needs.appendChild(el('li', null, n)); });
      card.appendChild(needs);
    }

    var recap = el('p', 'sec-checker-recap', summary);
    card.appendChild(recap);

    var actions = el('div', 'sec-checker-actions');
    if (result.crackRoute) {
      var crackLink = el('a', 'btn btn-accent', 'See the crack inspection service ');
      crackLink.href = 'crack-inspection-london';
      crackLink.appendChild(arrowSpan());
      crackLink.addEventListener('click', function () {
        track('tool_cta_click', self.trackParams({ cta: 'crack_page', result_type: result.type }));
      });
      actions.appendChild(crackLink);
    } else {
      var quote = el('a', 'btn btn-accent', 'Get a quote for this project ');
      quote.href = '#enquiry';
      quote.appendChild(arrowSpan());
      quote.addEventListener('click', function () {
        self.prefillEnquiry(summary);
        track('tool_cta_click', self.trackParams({ cta: 'quote_form', result_type: result.type }));
      });
      actions.appendChild(quote);
    }

    var wa = el('a', 'btn btn-outline', 'Send photos on WhatsApp');
    wa.href = whatsappUrl(summary);
    wa.target = '_blank';
    wa.rel = 'noopener';
    wa.addEventListener('click', function () {
      track('tool_cta_click', self.trackParams({ cta: 'whatsapp', result_type: result.type }));
    });
    actions.appendChild(wa);
    card.appendChild(actions);

    if (result.read) {
      var readmore = el('p', 'sec-checker-readmore', 'Read more: ');
      var readLink = el('a', null, result.read.label + ' →');
      readLink.href = result.read.href;
      readLink.addEventListener('click', function () {
        track('tool_cta_click', self.trackParams({ cta: 'service_page', result_type: result.type }));
      });
      readmore.appendChild(readLink);
      card.appendChild(readmore);
    }

    card.appendChild(el('p', 'sec-checker-disclaimer', DISCLAIMER));

    var restart = el('button', 'sec-checker-back', '↻ Start again');
    restart.type = 'button';
    restart.addEventListener('click', function () {
      self.answers = {};
      self.stepIndex = 0;
      try { history.replaceState(null, '', window.location.pathname + window.location.search); } catch (_) {}
      self.render();
      self.focusHeading();
    });
    card.appendChild(restart);

    this.stage.appendChild(card);
    if (!fromDeepLink) this.focusHeading();
  };

  Checker.prototype.prefillEnquiry = function (summary) {
    var form = document.querySelector('#enquiry form.js-enquiry-form');
    if (!form) return;
    var msg = form.elements['message'];
    if (msg && !msg.value) {
      msg.value = 'From the checker: ' + summary + '\n\n';
    }
    var pt = form.elements['projectType'];
    if (pt && pt.type === 'hidden') pt.value = summary;
  };

  // -- Qualifier: 3 grouped steps ----------------------------------------------

  Checker.prototype.qualifierSteps = function () {
    var self = this;
    var answered = function (k) { return !self.answers[k]; };
    // Preset answers (data-preset-answers) remove their questions entirely;
    // a step left with no questions is dropped and the totals renumber.
    var specifics = (QUALIFIER_SPECIFICS[this.presetProject] || []).filter(answered);
    if (!specifics.length && !this.presetProject) specifics = ['project'];
    var steps = [];
    if (specifics.length) steps.push({ title: 'About the project', keys: specifics });
    var property = ['property', 'timeline'].filter(answered);
    if (property.length) steps.push({ title: 'The property', keys: property });
    steps.push({ title: 'Your details', keys: [], contact: true });
    return steps;
  };

  Checker.prototype.renderQualifierStep = function () {
    var self = this;
    var step = this.steps[this.stepIndex];
    this.stage.innerHTML = '';
    this.stage.hidden = false;
    if (this.contactForm) this.contactForm.hidden = true;

    var total = this.steps.length;
    var head = el('div', 'sec-checker-head');
    head.appendChild(el('span', 'sec-checker-progress',
      'Step ' + (this.stepIndex + 1) + ' of ' + total + ' · ' + step.title));
    var bar = el('div', 'sec-checker-bar');
    var fill = el('span', 'sec-checker-bar-fill');
    fill.style.width = Math.round((this.stepIndex / total) * 100) + '%';
    bar.appendChild(fill);
    head.appendChild(bar);
    this.stage.appendChild(head);

    if (step.contact) { this.renderContactStep(); return; }

    step.keys.forEach(function (key, i) {
      var q = QUESTIONS[key];
      var group = el('div', 'sec-checker-group');
      var h = el('h3', 'sec-checker-q', q.label);
      if (i === 0) h.setAttribute('tabindex', '-1');
      group.appendChild(h);
      var opts = el('div', 'sec-checker-options');
      q.options.forEach(function (opt) {
        var b = el('button', 'sec-checker-opt', opt.label);
        b.type = 'button';
        b.setAttribute('data-q', key);
        if (self.answers[key] === opt.value) b.classList.add('is-selected');
        b.addEventListener('click', function () {
          self.markStarted();
          self.answers[key] = opt.value;
          opts.querySelectorAll('.sec-checker-opt').forEach(function (o) {
            o.classList.toggle('is-selected', o === b);
          });
          group.classList.remove('is-missing');
        });
        opts.appendChild(b);
      });
      group.appendChild(opts);
      self.stage.appendChild(group);
    });

    var nav = el('div', 'sec-checker-nav');
    if (this.stepIndex > 0) {
      var back = el('button', 'sec-checker-back', '← Back');
      back.type = 'button';
      back.addEventListener('click', function () {
        self.stepIndex -= 1;
        self.renderQualifierStep();
        self.focusHeading();
      });
      nav.appendChild(back);
    }
    var next = el('button', 'btn btn-accent sec-checker-next', 'Continue ');
    next.type = 'button';
    next.appendChild(arrowSpan());
    next.addEventListener('click', function () {
      var missing = step.keys.filter(function (k) { return !self.answers[k]; });
      if (missing.length) {
        self.stage.querySelectorAll('.sec-checker-group').forEach(function (g, gi) {
          g.classList.toggle('is-missing', !self.answers[step.keys[gi]]);
        });
        var firstMissing = self.stage.querySelector('.sec-checker-group.is-missing .sec-checker-q');
        if (firstMissing) { try { firstMissing.focus(); } catch (_) {} }
        return;
      }
      self.stepIndex += 1;
      track('tool_step', self.trackParams({ step: self.stepIndex }));
      self.renderQualifierStep();
      self.focusHeading();
    });
    nav.appendChild(next);
    this.stage.appendChild(nav);
  };

  Checker.prototype.renderContactStep = function () {
    var self = this;
    var summary = summarise(this.answers, this.service);

    var h = el('h3', 'sec-checker-q', 'Nearly there. Where should we send the right next step?');
    h.setAttribute('tabindex', '-1');
    this.stage.appendChild(h);
    this.stage.appendChild(el('p', 'sec-checker-recap', summary));
    this.stage.appendChild(el('p', 'sec-checker-disclaimer', DISCLAIMER));

    if (this.steps.length > 1) {
      var back = el('button', 'sec-checker-back', '← Back');
      back.type = 'button';
      back.addEventListener('click', function () {
        self.stepIndex = self.steps.length - 2;
        self.renderQualifierStep();
        self.focusHeading();
      });
      this.stage.appendChild(back);
    }

    if (this.contactForm) {
      this.contactForm.hidden = false;
      var pt = this.contactForm.elements['projectType'];
      if (pt) pt.value = summary;
      var tl = this.contactForm.elements['timeline'];
      if (tl && tl.type === 'hidden') tl.value = plain(optionLabel('timeline', this.answers.timeline || ''));
      track('tool_step', this.trackParams({ step: this.steps.length, question: 'contact' }));
    }
  };

  function arrowSpan() {
    var s = el('span', 'arrow', '→');
    s.setAttribute('aria-hidden', 'true');
    return s;
  }

  // ---- Init ------------------------------------------------------------------

  function ready(fn) {
    if (document.readyState !== 'loading') fn();
    else document.addEventListener('DOMContentLoaded', fn, { once: true });
  }

  ready(function () {
    document.querySelectorAll('[data-checker]').forEach(function (rootEl) {
      try { new Checker(rootEl); } catch (_) {}
    });
  });
})();
