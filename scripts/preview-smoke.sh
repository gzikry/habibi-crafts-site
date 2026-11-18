#!/bin/sh
# Hit a Cloudflare Pages preview. Pass the preview origin, with no trailing path.
# Example: scripts/preview-smoke.sh https://<branch>.<project>.pages.dev
set -eu

if [ "$#" -ne 1 ]; then
  echo "usage: scripts/preview-smoke.sh https://<preview>.pages.dev" >&2
  exit 2
fi

base=$(printf '%s' "$1" | sed 's:/*$::')

echo "GET ${base}/api/health"
health=$(curl -fsS "${base}/api/health")
printf '%s\n' "$health"
printf '%s' "$health" | grep -q '"status":"ok"'
printf '%s' "$health" | grep -q '"checkout_enabled":true'

echo "GET ${base}/cart.html"
cart=$(curl -fsS "${base}/cart.html")
printf '%s' "$cart" | grep -q 'Check out'

echo "POST ${base}/api/checkout (Access must block this)"
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

echo "POST ${base}/api/webhook without a signature"
webhook_body=$(mktemp)
webhook_code=$(curl -sS -o "$webhook_body" -w '%{http_code}' -X POST -H 'content-type: application/json' -d '{"type":"checkout.session.completed"}' "${base}/api/webhook")
echo "HTTP ${webhook_code}"
printf '%s\n' "$(cat "$webhook_body")"
test "$webhook_code" = "400"
grep -q 'missing_stripe_signature' "$webhook_body"
rm -f "$webhook_body"
