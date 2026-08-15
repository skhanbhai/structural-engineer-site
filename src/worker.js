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
  'do-i-need-a-structural-engineer'
]);

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

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
        return Response.redirect(url.toString(), 301);
      }
      // 404.html is deliberately absent: it is the not_found_handling target
      // and must keep serving its body rather than redirecting.
      if (CLEAN_URL_PAGES.has(slug)) {
        url.pathname = '/' + slug;
        return Response.redirect(url.toString(), 301);
      }
    }

    if (url.pathname === '/api/contact') {
      return handleContact(request);
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
