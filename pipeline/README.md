# Storefront page-builder pipeline

These scripts generate the storefront pages under `site/` from Printful. They
were previously kept only in the habibicrafts Hermes workspace on the Mac
(`~/.hermes/profiles/habibicrafts/workspace/`), outside git. They are committed
here verbatim so the pipeline is versioned alongside the site.

Entry point: `add-products.sh` runs, in order:

1. `sync-printful.py --write` - rebuild `site/product-catalog.json` from Printful
2. `fetch-angles.py` - collect mockup angle frames into `pf-angles/`
3. `publish-assets.py` - publish frames and grid thumbnails into `site/assets/`
4. `rank-products.py` - order products for the front page by units sold
5. `build-products.py`, `build-shop.py`, `build-home.py`, `build-sitemap.py` - write the pages
6. `check-asset-version.py` - verify every asset reference carries one `ASSET_V`

`pfangles.py` is the shared angle-ordering helper imported by the three builders.

## Notes

- Paths come from the script location. `HABIBI_ROOT` overrides the repo root.
- No secrets are stored here. Sync, fetch, and rank read `PRINTFUL_API_TOKEN` from
  the environment, or from the file named by `HABIBI_ENV_FILE`. Do not commit that file.
- `site/product-catalog.json` stores `price` in cents. Builders print `$24.99` from that number.
- Catalogue product 367 is a tote. Sync ids 471226874, 471225102, 462540360, and 462532459 are retired and skipped.
- Steps 7-9 of `add-products.sh` call local verification scripts (`verify-*.js`,
  `shoot-newhome.js`) that are not part of this commit.
- Working prices (`pricing.json`) are not included; no builder reads it.
