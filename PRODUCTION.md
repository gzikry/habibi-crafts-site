# Production wiring — Habibi Crafts Co

Backend is ready so flipping live later is a flag/secret change, not a rewrite. **Checkout and ads stay off.** Do not enable them until George says so. Do not put secrets in `site/`, client JavaScript, or git.

## What is wired

| Piece | Default | Where |
| --- | --- | --- |
| Stripe Checkout Sessions | Off (`CHECKOUT_ENABLED=false`) | `api/checkout.js`, `functions/api/checkout.js` |
| Stripe webhook → Printful order | Signature required; no Printful call while checkout is off | `api/webhook.js` |
| Printful v1 store orders | `POST https://api.printful.com/orders` with `recipient` + `sync_variant_id` / `external_variant_id`, header `X-PF-Store-Id` | `api/lib/printful.js` |
| Catalog map (14 live SKUs) | Site slug → sync product + variant external ids | `api/catalog.json` |
| AdSense snippet | Off unless `ADSENSE_ENABLED` **and** a real `ADSENSE_PUBLISHER_ID` | `site/public-config.js`, `site/analytics.js` |
| `ads.txt` | Comment placeholder only — no invented `pub-` / `ca-pub` | `site/ads.txt` |
| Structured data | `OutOfStock` while checkout is off | existing product JSON-LD |
| Sitemap / robots | Already present | `site/sitemap.xml`, `site/robots.txt` |

Public copy never names Printful. Fulfillment language on the site stays “printed after you order.”

GitHub Pages still publishes only `site/` (see `.github/workflows/deploy.yml`). The `api/` and `functions/` trees are ignored by Pages.

## Flags and secrets

Put these in **hosting secrets**, not in the repo. Template: `.env.example`.

| Variable | Default | Notes |
| --- | --- | --- |
| `STRIPE_SECRET_KEY` | empty | Test-mode `sk_test_…` only until go-live |
| `STRIPE_WEBHOOK_SECRET` | empty | `whsec_…` from the Stripe webhook endpoint |
| `STRIPE_PUBLISHABLE_KEY` | empty | `pk_test_…` — public, but still do not commit it |
| `PRINTFUL_API_TOKEN` | empty | Lives on George’s machine / host secrets |
| `PRINTFUL_STORE_ID` | `18687336` | Not a secret. It lives in `wrangler.toml`, not in host secrets |
| `PRINTFUL_CONFIRM_ORDERS` | `false` | Not a secret. `wrangler.toml`. `false` = Printful **draft** (no fulfillment charge) |
| `ADSENSE_PUBLISHER_ID` | empty | Real `ca-pub-…` from Google only — do not invent one. Not a secret, but do not commit a guessed id |
| `ADSENSE_ENABLED` | `false` | Not a secret. `wrangler.toml`. Must stay false until AdSense is approved **and** George says ads are on |
| `CHECKOUT_ENABLED` | `false` | Not a secret. `wrangler.toml` and `site/public-config.js`. UI and `/api/checkout` stay disabled |
| `window.HABIBI_CHECKOUT_ENABLED` | `false` | Browser alias in `site/public-config.js`; must stay false with `CHECKOUT_ENABLED` |
| `APP_ORIGIN` | `https://habibicraftsco.com` | Not a secret. `wrangler.toml`. Stripe redirects + CORS |

Browser flags (not secrets) live in `site/public-config.js` and also default off. Flip that file and the matching non-secret values in `wrangler.toml` together when going live. Secrets stay in Cloudflare's secret store for the Pages project `habibi-crafts-api`.

## How George enables the API (same GitHub repo)

GitHub Pages cannot run Stripe webhooks. Use **Cloudflare Pages** against this same `gzikry/habibi-crafts-site` repo. Do not add a second GitHub remote. The click path, preview variable names, and the Stripe test webhook are in `docs/CLOUDFLARE-SETUP.md`.

1. In Cloudflare: Workers & Pages → Create → Pages → Connect to Git → `gzikry/habibi-crafts-site`.
2. Build output directory: `site`. Functions come from `/functions` (`wrangler.toml`).
3. Add only the secrets from the table above to the host: the Stripe keys and the Printful token. `CHECKOUT_ENABLED`, `ADSENSE_ENABLED`, `PRINTFUL_STORE_ID`, `PRINTFUL_CONFIRM_ORDERS`, and `APP_ORIGIN` are already non-secret values in `wrangler.toml`. Do not put those in the host secret list.
4. After the first deploy, note the `*.pages.dev` URL.
5. Optional: CNAME `api.habibicraftsco.com` to that Pages project (Porkbun DNS). Then set `site/public-config.js` → `CHECKOUT_API_BASE` to `https://api.habibicraftsco.com` when checkout is actually turned on.
6. In Stripe (test mode): Developers → Webhooks → Add endpoint  
   `https://<pages-or-api-host>/api/webhook`  
   Event: `checkout.session.completed`. Copy `whsec_…` into `STRIPE_WEBHOOK_SECRET`.
7. Leave checkout and ads off until George says otherwise.

`vercel.json` is leftover optional wiring. It is not required. Do not create a second GitHub repo just to host Vercel.

Local checks (no live Stripe/Printful calls):

```bash
npm test
node scripts/local-backend.js
```

Pull ignored store variants onto a machine that already has the token (GET only — does not publish or un-ignore):

```bash
# PRINTFUL_API_TOKEN must already be in the local environment
node scripts/printful-pull-variants.js
```

## What stays off until George says so

- Checkout buttons stay disabled and say Opening soon. `/api/checkout` returns 403 while the flag is off. `window.HABIBI_CHECKOUT_ENABLED` stays `false`.
- Product JSON-LD stays `OutOfStock` (does not claim `InStock` purchases).
- AdSense script does not load. `ads.txt` has no publisher id.
- Printful drafts stay ignored. This PR does not publish or un-ignore products.
- No live Stripe charges and no live Printful `POST /orders` from CI or the static site.

## Remaining manual steps

1. **Stripe:** test-mode keys in Cloudflare secrets; webhook URL (step 6 above); later, live keys only when checkout is approved. In the Dashboard, open Settings, then Customer emails, and turn on Successful payments. That is the receipt email. When a checkout request includes `contact_email`, the API also sets `payment_intent_data[receipt_email]`. If the preview Access app cannot accept the pages.dev hostname for `/api/webhook`, leave that Bypass uncreated and forward test events with `stripe listen --forward-to http://localhost:8788/api/webhook` while `wrangler pages dev` is running. The CLI prints a `whsec_` signing secret. Put that value in `STRIPE_WEBHOOK_SECRET` in `.dev.vars` for local dev, and in the preview environment's `STRIPE_WEBHOOK_SECRET` for a hosted preview. Do not commit it or write it into the build directory. The steps are in `docs/CLOUDFLARE-SETUP.md`.
2. **Printful:** paste the existing token into Cloudflare secrets. Run `printful-pull-variants.js` locally to fill `sync_variant_id` values, then set matching `external_variant_id`s on the ignored drafts if they are not set yet. Keep drafts ignored.
3. **AdSense:** apply / wait for approval. Put the exact `ads.txt` line Google gives you into `site/ads.txt`. Set `ADSENSE_PUBLISHER_ID` and only then flip `ADSENSE_ENABLED` in `wrangler.toml` for the Pages project `habibi-crafts-api` and in `site/public-config.js`.
4. **Go-live (later, explicit):** build the checkout-on pages into a directory that is not `site/`, then run `scripts/golive-check` on that directory. It does not flip the flag or write files. It is offline by default. It exits non-zero and prints one failure per line if that build still has closed-shop copy, if `public-config.js` is missing a publishable Stripe key or an API base, or if an on-sale product in that build is not purchasable or has no Add to bag. The health GET runs only with `--live`, and that call hits the real `CHECKOUT_API_BASE/api/health`. Only after it exits 0, set `CHECKOUT_ENABLED=true` in `wrangler.toml` and `site/public-config.js`, and set `CHECKOUT_API_BASE`. The go-live build rewrites `cart.html`, `checkout.html`, `faq.html`, `shipping.html`, `tracking.html`, every `product-*.html` page, and `product-catalog.json`. It does not need a separate cart-button copy edit. A later build with checkout off restores the closed-shop sentences and the committed purchasable flags. Only `LAUNCH_SLUGS` that are not in `HOLD_SLUGS` (`api/lib/catalog.js`) become purchasable and `InStock`. The three dad hats stay in `HOLD_SLUGS` until their colorway and art are finished. Remove a hat from `HOLD_SLUGS` when that hat is ready. Set `PRINTFUL_CONFIRM_ORDERS=true` only when drafts look right. Preview builds keep `PRINTFUL_CONFIRM_ORDERS` false. The committed checkout-off pages keep "We're not taking orders yet."
