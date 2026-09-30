#!/usr/bin/env bash
# Add new Printful products to the storefront, end to end.
#
# Every step is idempotent, so this is safe to re-run at any point:
#   - sync reads Printful and only rewrites the catalogue if something changed
#   - fetch-angles skips products whose frames are already collected
#   - publish-assets regenerates from pf-angles, the source of truth
#
# Usage: ./add-products.sh
# Stop after the sync to write subtitles for anything new, then re-run.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
if [ -n "${HABIBI_ROOT:-}" ]; then
  ROOT="$HABIBI_ROOT"
fi
cd "$ROOT"

echo "== 1. sync catalogue from Printful =="
python3 pipeline/sync-printful.py --write

echo
echo "== 2. collect viewing angles (skips what is already done) =="
echo "   rate limited: ~30s per new product"
python3 pipeline/fetch-angles.py

echo
echo "== 3. publish frames + grid thumbnails into the site =="
python3 pipeline/publish-assets.py

echo
echo "== 4. rank products for the front page =="
echo "   units sold per product; ties keep the curated order"
python3 pipeline/rank-products.py

echo
echo "== 5. rebuild pages =="
python3 pipeline/build-products.py
python3 pipeline/build-shop.py
python3 pipeline/build-home.py
python3 pipeline/build-sitemap.py

echo
echo "== 6. check every asset carries one version =="
python3 pipeline/check-asset-version.py

echo
echo "== 7. verify locally =="
echo "   start: (cd site && python3 -m http.server 8090)"
for t in verify-viewer verify-smooth verify-slider verify-label-sync verify-hover verify-viewer-size verify-visible; do
  printf '   %-22s ' "$t"
  node "pipeline/$t.js" http://127.0.0.1:8090 2>&1 | tail -1
done

cat <<'EOF'

== 8. review before deploying ==
   - node shoot-newhome.js http://127.0.0.1:8090  then view shots/newhome-*.png
   - confirm the new product's design is fully visible in its grid thumbnail
     and that the viewer opens on a side where the artwork shows
   - product pages use "Notify me" while checkout is off

== 9. deploy ==
   - bump ASSET_V in ALL THREE builders (build-products, build-shop, build-home),
     then update the hand-written pages so they agree:
       python3 - <<'PY'
       import os,re
       S='site'
       for f in os.listdir(S):
           if f.endswith('.html'):
               p=os.path.join(S,f); s=open(p).read()
               open(p,'w').write(re.sub(r'\?v=\d+','?v=NEW',s))
       PY
   - run check-asset-version.py; it must pass before pushing
   - commit the reviewed pages on a branch. Do not push to main from this script.
   - watch the deploy-porkbun workflow, then:
       node verify-live.js
       node verify-assets.js
       node verify-smooth.js https://habibicraftsco.com
EOF
