(function () {
  'use strict';

  // Mobile nav toggle. Uses .no-scroll on <body> so we can lock scroll while
  // the menu is open without overwriting any inline style.
  var toggle = document.getElementById('menuToggle');
  var mobileNav = document.getElementById('mobileNav');
  if (toggle && mobileNav) {
    var closeNav = function () {
      mobileNav.classList.remove('is-open');
      toggle.setAttribute('aria-expanded', 'false');
      document.body.classList.remove('no-scroll');
    };
    toggle.addEventListener('click', function () {
      var open = mobileNav.classList.toggle('is-open');
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
      document.body.classList.toggle('no-scroll', open);
    });
    mobileNav.querySelectorAll('a').forEach(function (a) {
      a.addEventListener('click', closeNav);
    });
    // Close on Escape for keyboard users.
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && mobileNav.classList.contains('is-open')) closeNav();
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

  // Enquiry form submission is handled in form.js.
})();
