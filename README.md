# Habibi Crafts Co — Storefront

Arabic-inspired print-on-demand goods (mugs, onesies, signs), powered by Printful.

**Status:** storefront foundation live; checkout, Printful, analytics, and custom domain wiring pending.

## Current storefront foundation
- SEO title, description, canonical URL, Open Graph/Twitter cards, favicon, and Store JSON-LD
- `site/robots.txt` and `site/sitemap.xml` for crawler discovery
- Stripe checkout placeholder in the product flow (no live payment processing yet)
- Analytics loader with empty Plausible and Google Analytics IDs; tracking stays disabled until configured

## Planned integrations
- Stripe Checkout or Payment Links for secure payments (server-side secret handling required)
- Printful API for catalog, product sync, mockups, fulfillment, and shipping
- Plausible and/or Google Analytics 4 after the domain and measurement IDs are confirmed
- Google Search Console verification and sitemap submission after launch

## Analytics wiring
Set the IDs in `site/index.html` only when ready:
```js
window.HABIBI_ANALYTICS = {
  plausibleDomain: 'your-domain.example',
  googleMeasurementId: 'G-XXXXXXXXXX'
};
```
Do not place Stripe secret keys or Printful tokens in this static site. Those belong in a server-side integration or protected GitHub Actions secret.

## Stack (planned)
- Static HTML/CSS/JS (no build step) — deployable anywhere (GitHub Pages, Vercel, Netlify, Cloudflare Pages)
- Printful API for products, fulfillment & shipping
- Design source of truth: Canva ("Habibi Crafts Co Logo", "Yalla Habibi Mug", "habibi", "Ha")

## Structure
```
assets/       Source brand + product art exported from Canva
site/         Published storefront artifact
  assets/     Published copies of the web images
  index.html  Homepage + product page (single file, JS page-switching)
  robots.txt  Crawler directives
  sitemap.xml Search-engine sitemap
sketches/     Earlier design variants kept for reference
```

## Run locally
```bash
open site/index.html        # macOS
# or serve it:
python3 -m http.server -d site 8080
```

## Roadmap
- [x] Design direction approved (warm artisanal × modern)
- [ ] Split into real multi-page site / add cart
- [ ] Sync products from Printful
- [ ] Buy domain + wire DNS
- [ ] Deploy

---
© Habibi Crafts Co · Estd 2024 · Yalla!
