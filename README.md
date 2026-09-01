# Habibi Crafts Co — Storefront

Static storefront for Arabic-inspired products fulfilled through Printful.

**Status:** Apple-inspired multi-page storefront deployed from `main`. Checkout, Plausible, AdSense, and live Printful ordering remain disabled.

## Public domain

- Custom domain: `https://habibicraftsco.com/`
- GitHub repository: `gzikry/habibi-crafts-site`
- GitHub Pages publishes the `site/` directory from `main` through `.github/workflows/deploy.yml`
- DNS and TLS must be verified separately from a successful Pages deployment

## Storefront

- Responsive home, shop, about, privacy, 404, and three product preview pages
- Shared design system in `site/styles.css`
- Mobile menu, product filtering, and reduced-motion-aware reveal behavior in `site/app.js`
- Checkout language is intentionally disabled until Stripe and Printful order routing are ready
- Working launch prices shown: mug $18, onesie $28, 12 × 16 wall print $24

## SEO foundation

Each indexable page has a unique title, description, canonical URL, Open Graph/Twitter metadata, and page-specific JSON-LD. Product pages use `OutOfStock` until checkout opens. `site/robots.txt` points to `site/sitemap.xml`, which contains only intended public pages.

After DNS and HTTPS are stable:

1. Add `https://habibicraftsco.com` as a Google Search Console domain/URL-prefix property.
2. Verify ownership using the DNS record Google provides.
3. Submit `https://habibicraftsco.com/sitemap.xml`.
4. Request indexing for the home page and shop page.
5. Add Bing Webmaster Tools and submit the same sitemap.

## Plausible and AdSense

`site/analytics.js` contains inert configuration for both services.

### Plausible

After the site is added to Plausible, set:

```js
plausible: {
  enabled: true,
  domain: 'habibicraftsco.com',
  scriptUrl: 'https://plausible.io/js/script.js'
}
```

Confirm the exact script URL from the Plausible dashboard before enabling it.

### Google AdSense

Do not enable AdSense until Google provides the real publisher ID and the privacy/consent requirements are decided. Then set:

```js
adsense: {
  enabled: true,
  client: '' // replace with the exact publisher ID from Google
}
```

Add the exact `ads.txt` line from AdSense at that time. Never publish a placeholder publisher ID. Product pages and useful editorial content should remain the primary experience; ad placements must not block product discovery or mimic navigation.

## Security boundary

This repository is public. Never put Stripe secret keys, Printful tokens, or private credentials in `site/`, client JavaScript, or git. Payment and fulfillment need a server-side or protected serverless integration.

## Local QA

```bash
python3 -m http.server 8080 -d site
```

Check `/`, `/shop.html`, all product pages, `/privacy.html`, `/robots.txt`, `/sitemap.xml`, `/assets/logo.png`, and an unknown path for the 404 page behavior.
