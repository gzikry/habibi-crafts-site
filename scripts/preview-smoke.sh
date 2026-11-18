#!/bin/sh
# Hit a Cloudflare Pages preview. Pass the preview origin, with no trailing path.
# Unauthenticated checks always run. Authenticated checks run when a Cloudflare
# Access service token or CF_Authorization cookie is in the environment.
# Example: scripts/preview-smoke.sh https://<branch>.<project>.pages.dev
set -eu

if [ "$#" -ne 1 ]; then
  echo "usage: scripts/preview-smoke.sh https://<preview>.pages.dev" >&2
  exit 2
fi

base=$(printf '%s' "$1" | sed 's:/*$::')

echo "POST ${base}/api/checkout (Access must block this, no Access credential)"
payload='{"items":[{"slug":"ya-aini","quantity":1,"price_cents":1499}],"idempotency_key":"preview-smoke","total_amount_cents":1499}'
checkout_body=$(mktemp)
checkout_code=$(curl -sS -o "$checkout_body" -w '%{http_code}' -H 'content-type: application/json' -d "$payload" "${base}/api/checkout")
echo "HTTP ${checkout_code}"
if grep -q '"checkout_url"' "$checkout_body"; then
  echo 'Access did not block /api/checkout' >&2
  rm -f "$checkout_body"
  exit 1
fi
blocked=0
case "$checkout_code" in
  302|401|403) blocked=1 ;;
esac
if grep -Eq 'cloudflareaccess|Cloudflare Access' "$checkout_body"; then
  blocked=1
fi
rm -f "$checkout_body"
if [ "$blocked" != "1" ]; then
  echo "expected Access to block /api/checkout, got HTTP ${checkout_code}" >&2
  exit 1
fi

echo "POST ${base}/api/webhook without a signature (no Access credential)"
webhook_body=$(mktemp)
webhook_code=$(curl -sS -o "$webhook_body" -w '%{http_code}' -X POST -H 'content-type: application/json' -d '{"type":"checkout.session.completed"}' "${base}/api/webhook")
echo "HTTP ${webhook_code}"
printf '%s\n' "$(cat "$webhook_body")"
test "$webhook_code" = "400"
grep -q 'missing_stripe_signature' "$webhook_body"
rm -f "$webhook_body"

if [ -n "${CF_ACCESS_CLIENT_ID:-}" ] || [ -n "${CF_ACCESS_CLIENT_SECRET:-}" ]; then
  if [ -z "${CF_ACCESS_CLIENT_ID:-}" ] || [ -z "${CF_ACCESS_CLIENT_SECRET:-}" ]; then
    echo "Set both CF_ACCESS_CLIENT_ID and CF_ACCESS_CLIENT_SECRET." >&2
    exit 2
  fi
  echo "Authenticated checks with the Access service token"
  auth_curl() {
    curl "$@" \
      -H "CF-Access-Client-Id: ${CF_ACCESS_CLIENT_ID}" \
      -H "CF-Access-Client-Secret: ${CF_ACCESS_CLIENT_SECRET}"
  }
elif [ -n "${CF_AUTHORIZATION:-}" ]; then
  echo "Authenticated checks with the CF_Authorization cookie"
  auth_curl() {
    curl "$@" -H "Cookie: CF_Authorization=${CF_AUTHORIZATION}"
  }
else
  echo "Skipping authenticated checks (/api/health and /cart.html Check out). Set CF_ACCESS_CLIENT_ID and CF_ACCESS_CLIENT_SECRET, or CF_AUTHORIZATION."
  exit 0
fi

echo "GET ${base}/api/health"
health=$(auth_curl -fsS "${base}/api/health")
printf '%s\n' "$health"
printf '%s' "$health" | grep -q '"status":"ok"'
printf '%s' "$health" | grep -q '"checkout_enabled":true'

echo "GET ${base}/cart.html"
cart=$(auth_curl -fsS "${base}/cart.html")
printf '%s' "$cart" | grep -q 'Check out'
