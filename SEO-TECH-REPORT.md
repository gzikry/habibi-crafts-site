# Habibi Crafts Co — technical SEO report

**Date:** 2026-09-18  
**Live origin:** Porkbun Static Hosting (`server: openresty`, `x-service: pixie-sh`) via GitHub Connect on the `porkbun` branch  
**Repo deploy:** `site/` from `main` → GitHub Pages workflow **and** `deploy-porkbun.yml` (this is the live host)  
**Checkout:** still **off**. Product Offer JSON-LD stays `OutOfStock`. `site/public-config.js` `CHECKOUT_ENABLED: false`.

This pass does **not** claim rankings or indexation. Google decides those.

## Live before (probed 2026-09-18)

| Check | Result |
| --- | --- |
| HTTPS / HTTP→HTTPS | 301 `Location: https://habibicraftsco.com/` |
| `robots.txt` | Allows crawl; sitemap URL present |
| `sitemap.xml` | 32 URLs, all 200; `lastmod` stuck at 2026-09-15 |
| Custom `404.html` | File exists at `/404.html` (200) |
| Unknown path | HTTP 404, **150-byte OpenResty stub**, not `404.html` |
| `/favicon.ico` | 404 (same stub). HTML icons pointed at `assets/logo.png` |
| `www` → apex | 301 `Location: //habibicraftsco.com/...` (protocol-relative) |
| HTML security headers | None on HTTPS (`Strict-Transport-Security`, `X-Content-Type-Options`, `Referrer-Policy`, `X-Frame-Options`) |
| OG default image | `assets/mockups/ya-aini.png` **800×800** |
| Product schema | Present; Offer `OutOfStock` |
| `terms.html` | 404; footer does not link it (left unlinked) |

Porkbun Static Hosting does **not** honor `.htaccess`, Netlify `_headers`, or Cloudflare `_headers`. Those files would be published as public URLs on the `porkbun` branch, so they are **not** in `site/`.

Global URL Rewrite (Porkbun SPA fallback) rewrites missing paths to a file with **200**. Do **not** point it at `index.html` or `404.html` — that creates soft 404s.

## What this PR changes (repo-owned)

Verified locally after the edit (python `http.server` on `site/`). Live Porkbun will pick these up after merge to `main` (GitHub Connect publishes the `porkbun` branch).

| Item | Before | After | Live after merge? |
| --- | --- | --- | --- |
| `/favicon.ico` | Missing | Real ICO (16/32/48) at `site/favicon.ico`; HTML also keeps PNG + 180px apple-touch | **Yes** — static file |
| Apple touch icon | Logo PNG | `site/assets/apple-touch-icon.png` (180×180) | **Yes** |
| Unknown-path 404 **body** | Host stub | Branded `404.html` still in repo, `noindex` | **File yes; wiring no** — see George steps |
| Unknown-path 404 **status** | 404 (stub) | Still needs host `error_page` | **Host-only** |
| `www` Location | `//habibicraftsco.com/...` | Unchanged in repo (pixie-sh canonical redirect) | **Host-only** |
| Security headers | None on HTTPS | HTML `<meta name="referrer" content="strict-origin-when-cross-origin">` on every page | **Referrer yes; HSTS / nosniff / frame-ancestors host-only** |
| Sitemap `lastmod` | 2026-09-15 | 2026-09-18; still 32 public URLs; no `404.html`, `baby.html`, or thank-you | **Yes** |
| Default OG share | 800×800 mug | `assets/og-share.png` **1200×630** on home, shop, about, FAQ, shipping, contact, privacy, 404 | **Yes** |
| Product OG | 800×800 mockup | Unchanged (product-specific); width/height declared | **Yes** |
| Store / Organization JSON-LD | Store only | Store+Organization; CA / US; no invented `sameAs`; **no SearchAction** (no site search) | **Yes** |
| Product JSON-LD | Offer `OutOfStock` | Still `OutOfStock`; added `url`, `sku`, `seller` | **Yes** |
| `baby.html` duplicate | Indexed canonical on itself; filters linked here | `noindex,follow` + canonical to `onesies.html`; internal Onesies links now `onesies.html` | **Yes** |

Checkout buttons remain `disabled` / “Notify me”. No Printful name in customer HTML. No designer/brand “inspired by” copy. No Terms page (nothing to link; a legal stub without review is not worth indexing).

Regenerate share/favicon assets with:

```bash
python3 scripts/generate-seo-assets.py
```

(`Pillow` required on the machine that runs it. Generated files are committed.)

## Residual host-panel / support steps (George)

No DNS clicks, Search Console login, or spend from this agent. After this PR is merged and Porkbun has published:

### 1. Custom 404 (required for a clean Google 404)

Porkbun pixie-sh does not serve `404.html` for unknown paths today.

Message to Porkbun support (paste as-is):

> Live site is Static Hosting / GitHub Connect for habibicraftsco.com. Unknown URLs return the default OpenResty 150-byte 404. `404.html` is already at the site root. Please set `error_page 404 /404.html;` (or equivalent) so missing paths **serve that file with HTTP status 404**. Do not rewrite missing paths to `index.html` or return 200.

Verify after they confirm:

```bash
curl -sI https://habibicraftsco.com/this-page-does-not-exist
# expect: HTTP/2 404
curl -s https://habibicraftsco.com/this-page-does-not-exist | head
# expect: Habibi Crafts Co branded page, not <center>openresty</center>
```

GitHub Pages *would* do this automatically (`site/404.html`), but production traffic is Porkbun, not Pages.

### 2. Absolute `www` → apex HTTPS redirect (required)

Today: `https://www.habibicraftsco.com/shop.html` → `Location: //habibicraftsco.com/shop.html`.

Ask Porkbun to emit **`https://habibicraftsco.com` + path**, not protocol-relative `//`. Do not URL-forward the apex. Do not enable Wildcard Forwarding.

Verify:

```bash
curl -sI https://www.habibicraftsco.com/shop.html
# expect: 301 Location: https://habibicraftsco.com/shop.html
```

### 3. HTTPS security headers (nice-to-have)

Ask Porkbun to add on HTML responses (must not block `spin.js` or first-party assets):

- `Strict-Transport-Security: max-age=31536000; includeSubDomains`
- `X-Content-Type-Options: nosniff`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `X-Frame-Options: SAMEORIGIN` (or `Content-Security-Policy: frame-ancestors 'self'`)

Skip a tight CSP for now — JSON-LD is inline. Do not add `preload` on HSTS until the www redirect in step 2 is absolute https.

Porkbun hosting requires Porkbun nameservers, so putting Cloudflare in front is not a free local fix.

### 4. Google Search Console (when George is ready — no login from this agent)

“Ready to index” while checkout is off means: HTTPS, canonical apex, crawlable HTML, sitemap of public pages, products marked unavailable (not buyable). It does **not** mean the shop is open.

1. [Google Search Console](https://search.google.com/search-console) → Add property → URL prefix `https://habibicraftsco.com` (or Domain property if you prefer DNS verification).
2. Verify with the DNS TXT record Google shows (Porkbun DNS). Wait until it verifies.
3. Sitemaps → submit `https://habibicraftsco.com/sitemap.xml`.
4. URL Inspection → request indexing for `/` and `/shop.html` only after the www redirect and 404 wiring look right. Requesting index on a host that still serves stub 404s is fine for real pages; it does not fix the 404 bug.
5. Optional: Bing Webmaster Tools, same sitemap.

Do not expect product rich results for buyable offers until checkout is on **and** Offer availability is switched to `InStock` (later, explicit George Action).

### 5. After merge, sanity curl (no panel)

```bash
curl -sI https://habibicraftsco.com/favicon.ico          # 200 image/x-icon or image/vnd.microsoft.icon
curl -sI https://habibicraftsco.com/assets/og-share.png  # 200, image/png
curl -s https://habibicraftsco.com/sitemap.xml | grep lastmod | head
curl -s https://habibicraftsco.com/product-ya-aini.html | grep OutOfStock
```

## Out of scope (intentionally)

- Enabling checkout, ads, or claiming rankings
- `terms.html` stub
- Fake social `sameAs` or SearchAction
- Switching live DNS off Porkbun
