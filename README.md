# Habibi Crafts Co — Storefront

Arabic-inspired print-on-demand goods (mugs, onesies, signs), powered by Printful.

**Status:** design phase — static mockup of homepage + product page. Domain + Printful wiring pending.

## Stack (planned)
- Static HTML/CSS/JS (no build step) — deployable anywhere (GitHub Pages, Vercel, Netlify, Cloudflare Pages)
- Printful API for products, fulfillment & shipping
- Design source of truth: Canva ("Habibi Crafts Co Logo", "Yalla Habibi Mug", "habibi", "Ha")

## Structure
```
assets/       Brand + product art exported from Canva
site/         Current approved storefront design
  index.html  Homepage + product page (single file, JS page-switching)
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
