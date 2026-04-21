(function () {
  'use strict';

  // Mobile nav toggle
  var toggle = document.getElementById('menuToggle');
  var mobileNav = document.getElementById('mobileNav');
  if (toggle && mobileNav) {
    toggle.addEventListener('click', function () {
      var open = mobileNav.classList.toggle('is-open');
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
      document.body.style.overflow = open ? 'hidden' : '';
    });
    mobileNav.querySelectorAll('a').forEach(function (a) {
      a.addEventListener('click', function () {
        mobileNav.classList.remove('is-open');
        toggle.setAttribute('aria-expanded', 'false');
        document.body.style.overflow = '';
      });
    });
  }

  // Sticky header — add class on scroll
  var header = document.getElementById('siteHeader');
  if (header) {
    var onScroll = function () {
      if (window.scrollY > 8) header.classList.add('is-scrolled');
      else header.classList.remove('is-scrolled');
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }

  // Reveal-on-scroll
  var revealables = document.querySelectorAll('.reveal');
  if (revealables.length && 'IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) {
          e.target.classList.add('is-in');
          io.unobserve(e.target);
        }
      });
    }, { threshold: 0.1, rootMargin: '0px 0px -60px 0px' });
    revealables.forEach(function (el) { io.observe(el); });
  } else {
    revealables.forEach(function (el) { el.classList.add('is-in'); });
  }

  // Project filter chips
  var chips = document.querySelectorAll('.filter-row .chip');
  var rows = document.querySelectorAll('#projectsTable .project-row');
  if (chips.length && rows.length) {
    chips.forEach(function (chip) {
      chip.addEventListener('click', function () {
        chips.forEach(function (c) { c.classList.remove('is-active'); });
        chip.classList.add('is-active');
        var filter = chip.getAttribute('data-filter');
        rows.forEach(function (row) {
          var type = row.getAttribute('data-type') || '';
          if (filter === 'all' || type === filter) {
            row.style.display = '';
          } else {
            row.style.display = 'none';
          }
        });
      });
    });
  }

  // Contact form — basic client-side feedback only
  var form = document.getElementById('enquiryForm');
  if (form) {
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var btn = form.querySelector('button[type="submit"]');
      if (!btn) return;
      btn.disabled = true;
      btn.innerHTML = 'Sending…';
      setTimeout(function () {
        form.innerHTML = '<div style="padding: 2rem 0; text-align: center;">' +
          '<h3 style="margin-bottom: 1rem;">Thank you — your enquiry has been sent.</h3>' +
          '<p style="color: var(--graphite);">We&rsquo;ll reply within 48 hours with a scoped proposal.</p>' +
          '<p style="font-family: var(--ff-mono); font-size: 0.72rem; letter-spacing: 0.1em; text-transform: uppercase; color: var(--muted); margin-top: 2rem;">Ref · ' + new Date().toISOString().slice(0,10).replace(/-/g,'') + '-' + Math.random().toString(36).slice(2,6).toUpperCase() + '</p>' +
          '</div>';
      }, 600);
    });
  }
})();
