/* ============================================================
   Panoptic - Cloudflare Worker entry
   Serves the static site through the ASSETS binding and adds
   one API route:

     POST /api/contact
       Forwards the JSON body to the Apps Script Web App
       (server-to-server, no browser CORS), parses Apps Script's
       JSON response, and surfaces {ok:true} ONLY when Apps
       Script confirmed success. Anything else returns 502.

   This is what allows form.js to fire the GA4
   contact_form_submit event on real success only.

   All other paths fall through to env.ASSETS.fetch.
   ============================================================ */

const APPS_SCRIPT_URL =
  'https://script.google.com/macros/s/AKfycbzI0fgA5h9iRcma9bw4WBHW_hnndbdSWUv4dQO1XT5vFjbCSD_piHDWJ8aV2ziVsGA/exec';

const JSON_HEADERS = {
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'no-store'
};

// Every page whose .html form must 301 to its extensionless URL.
// Keep in sync with assets.run_worker_first in wrangler.jsonc.
const CLEAN_URL_PAGES = new Set([
  'about',
  'services',
  'contact',
  'projects',
  'process',
  'privacy',
  'cookie-policy',
  'project-detail',
  'thank-you',
  'crack-inspection-london',
  'rsj-steel-beam-calculations-london',
  'chimney-breast-removal-structural-engineer-london',
  'extension-structural-engineer-london',
  'rear-extension-structural-engineer-london',
  'side-return-extension-structural-engineer-london',
  'do-i-need-a-structural-engineer',
  'does-home-insurance-cover-cracked-walls',
  'is-it-subsidence-or-settlement'
]);

// The one hostname/scheme every public URL must resolve to.
//
// The apex and plain http both served 200 with no redirect, so every page
// existed at four crawlable URLs (http/https x apex/www). The canonical tag
// pointed at https://www from all four, so Google was consolidating them, but
// on a site whose pages already sit in "Discovered - currently not indexed"
// that is four times the crawl surface for no benefit.
//
// Only these two hostnames are normalised. *.workers.dev is deliberately left
// alone so preview deploys stay directly testable.
const CANONICAL_HOST = 'www.panopticdesign.co.uk';
const APEX_HOST      = 'panopticdesign.co.uk';

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // Handled before any redirect so a POST is never answered with a 301 —
    // clients are allowed to drop the body when they follow one.
    if (url.pathname === '/api/contact') {
      return handleContact(request);
    }

    // Accumulate every correction, then emit ONE 301. Redirecting host and
    // path separately would chain two hops, and Google discards a little
    // signal at each one.
    let mustRedirect = false;

    // Permanent 301: apex → www, http → https.
    if (url.hostname === APEX_HOST) {
      url.hostname = CANONICAL_HOST;
      mustRedirect = true;
    }
    if (url.protocol === 'http:' && url.hostname === CANONICAL_HOST) {
      url.protocol = 'https:';
      mustRedirect = true;
    }

    // Permanent 301: legacy .html URL → clean canonical URL.
    //
    // These only run because assets.run_worker_first lists the .html paths in
    // wrangler.jsonc. Assets are matched BEFORE the Worker by default, and the
    // asset layer's html_handling ("auto-trailing-slash") answers .html with a
    // 307 Temporary — which tells Google to keep indexing the .html URL, so both
    // forms stayed in the index and split their own authority. A 301 is what
    // actually consolidates them. Adding a page here means adding its .html path
    // to run_worker_first too, or the redirect silently reverts to a 307.
    const htmlPage = url.pathname.match(/^\/([a-z0-9-]+)\.html$/);
    if (htmlPage) {
      const slug = htmlPage[1];
      if (slug === 'index') {
        url.pathname = '/';
        mustRedirect = true;
      } else if (CLEAN_URL_PAGES.has(slug)) {
        // 404.html is deliberately absent: it is the not_found_handling target
        // and must keep serving its body rather than redirecting.
        url.pathname = '/' + slug;
        mustRedirect = true;
      }
    }

    // Permanent 301: /page/ and /index → clean canonical URL.
    //
    // Same 307 problem as the .html forms above, missed the first time round.
    // html_handling ("auto-trailing-slash") answers /privacy/ and /index with a
    // 307 Temporary, so every page had a THIRD crawlable URL that Google was
    // told to keep in the index. Cheap to discover (one stray footer link, one
    // backlink, one sitemap typo) and it competes with the clean URL.
    //
    // Matched by the "/*/" and "/index" globs in run_worker_first — anything
    // that is not a real page falls through to ASSETS untouched.
    const slashPage = url.pathname.match(/^\/([a-z0-9-]+)\/$/);
    if (url.pathname === '/index' || (slashPage && slashPage[1] === 'index')) {
      url.pathname = '/';
      mustRedirect = true;
    } else if (slashPage && CLEAN_URL_PAGES.has(slashPage[1])) {
      url.pathname = '/' + slashPage[1];
      mustRedirect = true;
    }

    if (mustRedirect) {
      return Response.redirect(url.toString(), 301);
    }
    return env.ASSETS.fetch(request);
  }
};

async function handleContact(request) {
  if (request.method !== 'POST') {
    return json({ ok: false, error: 'method_not_allowed' }, 405);
  }

  let bodyText;
  try {
    bodyText = await request.text();
    JSON.parse(bodyText); // validate shape; we forward the original text
  } catch (_) {
    return json({ ok: false, error: 'bad_json' }, 400);
  }

  let upstream;
  try {
    upstream = await fetch(APPS_SCRIPT_URL, {
      method:   'POST',
      headers:  { 'Content-Type': 'text/plain;charset=utf-8' },
      body:     bodyText,
      redirect: 'follow'
    });
  } catch (_) {
    return json({ ok: false, error: 'upstream_unreachable' }, 502);
  }

  if (!upstream.ok) {
    return json({ ok: false, error: 'upstream_status_' + upstream.status }, 502);
  }

  let parsed;
  try {
    parsed = await upstream.json();
  } catch (_) {
    return json({ ok: false, error: 'upstream_bad_body' }, 502);
  }

  if (parsed && parsed.ok === true) {
    return json({ ok: true });
  }
  return json({ ok: false, error: 'upstream_not_ok' }, 502);
}

function json(payload, status) {
  return new Response(JSON.stringify(payload), {
    status:  status || 200,
    headers: JSON_HEADERS
  });
}
