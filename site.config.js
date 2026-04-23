/* ============================================================
   Panoptic — site configuration
   Single place to change where enquiries go, enable GA4,
   and (later) enable Google Sheets / Zapier / Apps Script logging.
   ============================================================ */

(function () {
  'use strict';

  // 1) Canonical production origin (no trailing slash).
  //    This is the host used for canonical URLs, OG tags and sitemap.
  //    Static HTML meta tags also hardcode this value — if the host
  //    ever changes, do a single find-and-replace across the site
  //    for "https://www.panopticdesign.co.uk".
  var SITE_URL = 'https://www.panopticdesign.co.uk';

  // 2) Who receives new enquiry emails.
  //    To switch to the client's inbox later, change this one value.
  var RECIPIENT_EMAIL = 'skhanbhai@hotmail.com';

  // 3) Google Analytics 4 measurement ID (e.g. "G-XXXXXXXXXX").
  //    Leave as '' to disable analytics. When set, analytics.js
  //    injects gtag on every page and form.js fires a generate_lead
  //    event on successful submission.
  var GA4_MEASUREMENT_ID = '';

  // 4) Optional: send the same enquiry payload to a webhook in parallel
  //    (Google Apps Script Web App URL, Zapier catch-hook, Make.com, etc.)
  //    Leave as '' to disable.
  var WEBHOOK_URL = '';

  // ---- Derived values. No need to edit below this line. ----

  // FormSubmit.co is used as the no-backend email relay. It is zero-signup:
  // the first submission to a new address triggers an activation email —
  // click the link in it once and future submissions deliver straight through.
  var FORM_ENDPOINT = 'https://formsubmit.co/ajax/' + encodeURIComponent(RECIPIENT_EMAIL);

  window.PANOPTIC_CONFIG = {
    siteUrl:        SITE_URL,
    recipientEmail: RECIPIENT_EMAIL,
    formEndpoint:   FORM_ENDPOINT,
    webhookUrl:     WEBHOOK_URL,
    ga4Id:          GA4_MEASUREMENT_ID
  };

  /* -------------------------------------------------------------
     Switching to Vijay's email later
     -------------------------------------------------------------
     Change RECIPIENT_EMAIL above to the new address. The first
     submission to the new address will send an activation email
     from FormSubmit — click the link in it once and it's live.

     Adding Google Sheets logging later
     -------------------------------------------------------------
     1. Open the target Google Sheet → Extensions → Apps Script.
     2. Paste a doPost(e) that parses JSON.parse(e.postData.contents)
        and appends a row to the active sheet.
     3. Deploy as a Web App (Anyone, execute as you).
     4. Copy the /exec URL into WEBHOOK_URL above.

     Enabling analytics later
     -------------------------------------------------------------
     1. Create a GA4 property in analytics.google.com.
     2. Copy the Measurement ID (G-XXXXXXXXXX).
     3. Paste it into GA4_MEASUREMENT_ID above.
     ------------------------------------------------------------- */
})();
