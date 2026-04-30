/* ============================================================
   Panoptic - site configuration
   Single source of truth for analytics and the Apps Script
   webhook that handles enquiry sheet append + email.
   ============================================================ */

(function () {
  'use strict';

  // 1) Canonical production origin (no trailing slash).
  var SITE_URL = 'https://www.panopticdesign.co.uk';

  // 2) Apps Script Web App URL (deployed /exec endpoint).
  //    Handles sheet append + email (production: info@panopticdesign.co.uk
  //    only; no CC, no BCC). The recipient address lives INSIDE the Apps
  //    Script and is never embedded in this frontend code.
  var WEBHOOK_URL = 'https://script.google.com/macros/s/AKfycbzI0fgA5h9iRcma9bw4WBHW_hnndbdSWUv4dQO1XT5vFjbCSD_piHDWJ8aV2ziVsGA/exec';

  // 3) Public-facing fallback email shown to users only when a submission
  //    fails. NOT a delivery destination - delivery is fixed inside the
  //    Apps Script (production only, info@panopticdesign.co.uk).
  var PUBLIC_EMAIL = 'info@panopticdesign.co.uk';

  // 4) Google Analytics 4 measurement ID. The inline gtag.js tag in every
  //    page's <head> already loads gtag.js and runs gtag('config', ...);
  //    this constant lets analytics.js fire track() events through the
  //    same property and stays in sync if the ID ever changes.
  var GA4_MEASUREMENT_ID = 'G-ZMFX3LH88K';

  window.PANOPTIC_CONFIG = {
    siteUrl:     SITE_URL,
    webhookUrl:  WEBHOOK_URL,
    publicEmail: PUBLIC_EMAIL,
    ga4Id:       GA4_MEASUREMENT_ID
  };

  /* -------------------------------------------------------------
     The Apps Script is production-only. Recipient is hardcoded as
     EMAIL_RECIPIENT = info@panopticdesign.co.uk inside the script;
     there is no test branch, no test recipient, and no CC/BCC.
     To change the recipient later, edit EMAIL_RECIPIENT at the top
     of the Apps Script and redeploy a new version of the existing
     Web App (Manage deployments -> Edit -> New version -> Deploy).
     ------------------------------------------------------------- */
})();
