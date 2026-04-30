/* ============================================================
   Panoptic - site configuration
   Single source of truth for analytics and the Apps Script
   webhook that handles enquiry sheet append + email.
   ============================================================ */

(function () {
  'use strict';

  // 1) Canonical production origin (no trailing slash).
  var SITE_URL = 'https://www.panopticdesign.co.uk';

  // 2) Apps Script Web App URL.
  //    Handles sheet append + email per CURRENT_MODE (server-side).
  //    Email recipients (skhanbhai@hotmail.com / info@panopticdesign.co.uk)
  //    live INSIDE the Apps Script and are never embedded in this code.
  //    After deploying the script, paste the /exec URL here.
  var WEBHOOK_URL = '';  // e.g. 'https://script.google.com/macros/s/AKfyc.../exec'

  // 3) Public-facing fallback email shown to users only when a submission
  //    fails. NOT a delivery destination - delivery is controlled by
  //    CURRENT_MODE inside the Apps Script.
  var PUBLIC_EMAIL = 'info@panopticdesign.co.uk';

  // 4) Google Analytics 4 measurement ID (e.g. "G-XXXXXXXXXX").
  //    Leave as '' to disable analytics.
  var GA4_MEASUREMENT_ID = '';

  window.PANOPTIC_CONFIG = {
    siteUrl:     SITE_URL,
    webhookUrl:  WEBHOOK_URL,
    publicEmail: PUBLIC_EMAIL,
    ga4Id:       GA4_MEASUREMENT_ID
  };

  /* -------------------------------------------------------------
     Switching modes (testing -> production)
     -------------------------------------------------------------
     The CURRENT_MODE flag lives inside the Apps Script, NOT here.
     To flip from testing to production, edit the CURRENT_MODE
     constant at the top of the script and redeploy a new version
     of the existing Web App (Manage deployments -> Edit -> New
     version -> Deploy). No website redeploy is required.
     ------------------------------------------------------------- */
})();
