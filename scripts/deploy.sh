#!/usr/bin/env bash
# Deploy the site, then prove the enquiry path still reaches the Worker.
#
# Why this exists: on 15 Aug 2026 a run_worker_first change left
# /api/contact off the list. The asset layer then answered every form POST
# with a 405, form.js fell back to the unconfirmed direct POST, and the lead
# still landed in the sheet, so nothing looked broken. But that fallback never
# redirects to /thank-you, so no form enquiry counted as a Google Ads
# conversion for ~11 weeks.
#
# The check sends deliberately invalid JSON. The Worker rejects it with a 400
# before forwarding anything, so it never creates a sheet row, emails anyone
# or fires a conversion. Any other status means the route is broken.
#
# Usage: scripts/deploy.sh            (run from anywhere)

set -euo pipefail

SITE="https://www.panopticdesign.co.uk"
cd "$(dirname "$0")/.."

npx -y wrangler@4 deploy

echo
echo "Checking the live enquiry route..."

fail=0

status=$(curl -s -o /dev/null -w '%{http_code}' -X POST \
  -H 'Content-Type: application/json' --data 'not-json' \
  "$SITE/api/contact")
if [ "$status" = "400" ]; then
  echo "  ok   POST /api/contact reaches the Worker (400 on bad JSON)"
else
  echo "  FAIL POST /api/contact returned $status, expected 400."
  echo "       Forms will still save leads but will NOT redirect to /thank-you"
  echo "       or count as Google Ads conversions. Check run_worker_first."
  fail=1
fi

thanks=$(curl -s "$SITE/thank-you")
if printf '%s' "$thanks" | grep -q 'GTM-NFZB3T47'; then
  echo "  ok   /thank-you serves the GTM container"
else
  echo "  FAIL /thank-you is missing GTM-NFZB3T47, so the Ads conversion tag cannot fire."
  fail=1
fi

if [ "$fail" -ne 0 ]; then
  echo
  echo "Deploy is live but the enquiry tracking is broken."
  echo "Roll back with: npx wrangler@4 rollback"
  exit 1
fi

echo
echo "Deploy verified."
