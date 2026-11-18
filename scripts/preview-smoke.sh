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

echo "POST ${base}/api/checkout"
payload='{"items":[{"slug":"ya-aini","quantity":1,"price_cents":1499}],"idempotency_key":"preview-smoke","total_amount_cents":1499}'
body=$(curl -sS -w '\n%{http_code}' -H 'content-type: application/json' -d "$payload" "${base}/api/checkout")
code=$(printf '%s' "$body" | tail -n 1)
json=$(printf '%s' "$body" | sed '$d')
printf '%s\n' "$json"
echo "HTTP ${code}"
test "$code" = "200"
printf '%s' "$json" | grep -q '"checkout_url"'
