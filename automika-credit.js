/* ============================================================
   Automika agency credit banner (sitewide colophon)
   Single source of truth for the footer credit. Injects the
   shared am-credit banner directly AFTER </footer> on every
   page - same pattern as the shared WhatsApp modal in
   whatsapp-form.js, so the markup lives in exactly one place.

   The markup is the portable block from
   snippets/agency-credit-banner.html in the Fosters Electrics
   repo, unchanged. It sits after the footer, not inside it,
   because its background is a separate plate 12% darker than
   the footer above; nesting it in .site-footer would put a
   dark strip inside a lighter one. Styles: .am-credit in
   styles.css.

   Two things are deliberately Panoptic-specific rather than
   ported, because they are measurement, not design:
     - CREDIT_URL keeps the UTM-tagged case-study target below
       (the Fosters copy links to the Automika homepage).
     - The click still fires automika_credit_click through the
       consent-gated PANOPTIC_ANALYTICS wrapper.

   Link policy: followed (a genuine agency credit - do NOT add
   rel="nofollow"), brand-name anchor text only, UTM-tagged for
   measurement. Approved by Panoptic (Vijay) for the previous
   footer credit; re-confirm this banner variant with him.
   ============================================================ */

(function () {
  'use strict';

  // TODO Saqib: confirm final domain + target page. Current target is the
  // Panoptic case study on the Automika hub (strongest hub-and-spoke
  // pattern: relevance + a proof page for BNI prospects to land on).
  var CREDIT_URL =
    'https://www.automika.co.uk/work/panoptic-design/' +
    '?utm_source=panopticdesign&utm_medium=footer-credit&utm_campaign=hub-spoke';

  function track() {
    try {
      if (window.PANOPTIC_ANALYTICS &&
          typeof window.PANOPTIC_ANALYTICS.trackEvent === 'function') {
        window.PANOPTIC_ANALYTICS.trackEvent('automika_credit_click', {
          link_url:      CREDIT_URL,
          link_location: 'footer_credit'
        });
      }
    } catch (_) {}
  }

  function buildBanner() {
    var banner = document.createElement('div');
    banner.className = 'am-credit';
    banner.setAttribute('data-automika-credit-line', '');

    var inner = document.createElement('span');
    inner.className = 'am-credit__inner';

    var by = document.createElement('span');
    by.className = 'am-credit__by';
    by.textContent = 'Web Design & Development by';
    inner.appendChild(by);

    var mark = document.createElement('a');
    mark.className = 'am-credit__mark';
    mark.href   = CREDIT_URL;
    mark.target = '_blank';
    mark.rel    = 'noopener';
    mark.setAttribute('aria-label', 'Automika - Web Design & Development');
    mark.setAttribute('data-automika-credit-link', '');
    mark.appendChild(document.createTextNode('Automika'));

    // The stop carries Automika's accent. Hidden from assistive tech so the
    // link is announced from its aria-label, not as "Automika dot".
    var dot = document.createElement('span');
    dot.className = 'am-credit__dot';
    dot.setAttribute('aria-hidden', 'true');
    dot.textContent = '.';
    mark.appendChild(dot);

    mark.addEventListener('click', track);
    inner.appendChild(mark);

    banner.appendChild(inner);
    return banner;
  }

  function ready(fn) {
    if (document.readyState !== 'loading') fn();
    else document.addEventListener('DOMContentLoaded', fn, { once: true });
  }

  ready(function () {
    var footer = document.querySelector('.site-footer');
    if (!footer) return;
    if (document.querySelector('.am-credit')) return;

    // After the footer, as the last element of the page.
    footer.parentNode.insertBefore(buildBanner(), footer.nextSibling);
  });
})();
