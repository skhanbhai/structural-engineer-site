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

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // Permanent 301: legacy .html URL → clean canonical URL.
    // Keeps GSC happy now that crack-inspection-london.html is no longer the canonical.
    if (url.pathname === '/crack-inspection-london.html') {
      url.pathname = '/crack-inspection-london';
      return Response.redirect(url.toString(), 301);
    }
    if (url.pathname === '/rsj-steel-beam-calculations-london.html') {
      url.pathname = '/rsj-steel-beam-calculations-london';
      return Response.redirect(url.toString(), 301);
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
