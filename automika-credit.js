/* ============================================================
   Automika agency credit strip (hub-and-spoke colophon)
   Single source of truth for the sitewide footer credit. Renders
   a slim strip as the bottom-most element of .site-footer on
   every page - same pattern as the shared WhatsApp modal in
   whatsapp-form.js, so the markup lives in exactly one place.

   Design intent: a quiet colophon, visually subordinate to all
   Panoptic content. No orange, no CTA styling, never near the
   enquiry forms. Desktop: credit left, quiet "build something
   like this" link right. Mobile: one centred line, one link.

   Link policy: followed (a genuine agency credit - do NOT add
   rel="nofollow"), brand-name anchor text only, UTM-tagged for
   measurement. Approved by Panoptic (Vijay) for the previous
   footer credit; re-confirm this strip variant with him.

   Click tracking fires automika_credit_click through the same
   consent-gated PANOPTIC_ANALYTICS wrapper as everything else.
   No new tracking scripts, no external requests.
   ============================================================ */

(function () {
  'use strict';

  // TODO Saqib: confirm final domain + target page. Current target is the
  // Panoptic case study on the Automika hub (strongest hub-and-spoke
  // pattern: relevance + a proof page for BNI prospects to land on).
  var CREDIT_URL =
    'https://www.automika.co.uk/work/panoptic-design/' +
    '?utm_source=panopticdesign&utm_medium=footer-credit&utm_campaign=hub-spoke';

  function track(location_) {
    try {
      if (window.PANOPTIC_ANALYTICS &&
          typeof window.PANOPTIC_ANALYTICS.trackEvent === 'function') {
        window.PANOPTIC_ANALYTICS.trackEvent('automika_credit_click', {
          link_url:      CREDIT_URL,
          link_location: location_
        });
      }
    } catch (_) {}
  }

  function buildStrip() {
    var strip = document.createElement('div');
    strip.className = 'automika-strip';
    strip.setAttribute('data-automika-credit-line', '');

    var left = document.createElement('p');
    left.className = 'automika-strip-credit';
    left.appendChild(document.createTextNode('Website & lead system by '));
    var brand = document.createElement('a');
    brand.className = 'automika-strip-brand';
    brand.href = CREDIT_URL;
    brand.target = '_blank';
    brand.rel = 'noopener';
    brand.textContent = 'Automika';
    brand.setAttribute('data-automika-credit-link', '');
    brand.addEventListener('click', function () { track('footer_credit'); });
    left.appendChild(brand);
    strip.appendChild(left);

    var cta = document.createElement('a');
    cta.className = 'automika-strip-cta';
    cta.href = CREDIT_URL;
    cta.target = '_blank';
    cta.rel = 'noopener';
    cta.textContent = 'Want a website that brings enquiries? →';
    cta.addEventListener('click', function () { track('footer_credit_cta'); });
    strip.appendChild(cta);

    return strip;
  }

  function ready(fn) {
    if (document.readyState !== 'loading') fn();
    else document.addEventListener('DOMContentLoaded', fn, { once: true });
  }

  ready(function () {
    var footer = document.querySelector('.site-footer');
    if (!footer) return;
    if (footer.querySelector('.automika-strip')) return;

    // Replace the legacy per-page credit paragraph where one exists so the
    // strip is never doubled; otherwise append as the footer's last element.
    var legacy = footer.querySelector('.automika-credit');
    var container = footer.querySelector('.container-wide') || footer;
    var strip = buildStrip();
    if (legacy && legacy.parentNode) {
      legacy.parentNode.replaceChild(strip, legacy);
    } else {
      container.appendChild(strip);
    }
  });
})();
