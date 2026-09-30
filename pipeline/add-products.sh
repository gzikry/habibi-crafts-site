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

ROOT="${HABIBI_ROOT:-$(cd "$(dirname "$0")/.." && pwd)}"
cd "$(dirname "$0")"

echo "== 1. sync catalogue from Printful =="
python3 sync-printful.py --write

echo
echo "== 2. collect viewing angles (skips what is already done) =="
echo "   rate limited: ~30s per new product"
python3 fetch-angles.py

echo
echo "== 3. publish frames + grid thumbnails into the site =="
python3 publish-assets.py

echo
echo "== 4. rank products for the front page =="
echo "   units sold per product; ties keep the curated order"
python3 rank-products.py

echo
echo "== 5. rebuild pages =="
python3 build-products.py
python3 build-shop.py
python3 build-home.py
python3 build-sitemap.py

echo
echo "== 6. check every asset carries one version =="
python3 check-asset-version.py

echo
echo "== 7. verify locally =="
echo "   start: (cd ${ROOT}/site && python3 -m http.server 8090)"
for t in verify-viewer verify-smooth verify-slider verify-label-sync verify-hover verify-viewer-size verify-visible; do
  printf '   %-22s ' "$t"
  node "$t.js" http://127.0.0.1:8090 2>&1 | tail -1
done

cat <<'EOF'

== 8. review before deploying ==
   - node shoot-newhome.js http://127.0.0.1:8090  then view shots/newhome-*.png
   - confirm the new product's design is fully visible in its grid thumbnail
     and that the viewer opens on a side where the artwork shows
   - product pages use Add to bag while checkout is off. Stickers and hats stay browse-only.

== 9. deploy ==
   - bump ASSET_V in ALL THREE builders (build-products, build-shop, build-home),
     then update the hand-written pages so they agree:
       python3 - <<'PY'
       import os,re
       S=os.path.abspath('site')
       for f in os.listdir(S):
           if f.endswith('.html'):
               p=os.path.join(S,f); s=open(p).read()
               open(p,'w').write(re.sub(r'\?v=\d+','?v=NEW',s))
       PY
   - run check-asset-version.py; it must pass before pushing
   - git push the branch you are on. Pushing main publishes the site.
   - watch the deploy-porkbun workflow, then:
       node verify-live.js
       node verify-assets.js
       node verify-smooth.js https://habibicraftsco.com
EOF
