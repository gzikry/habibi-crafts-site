# Habibi Crafts Co — backend contract

See **[PRODUCTION.md](PRODUCTION.md)** for flags, secrets, and how to attach Cloudflare Pages Functions to this same GitHub repo.

## Local simulation

```bash
npm test
node scripts/local-backend.js
```

## Endpoints

- `GET /api/health`
- `POST /api/checkout` — 403 while `CHECKOUT_ENABLED` is false
- `GET /api/checkout-session?session_id=`
- `POST /api/webhook` — Stripe signature required; Printful order only after a paid `checkout.session.completed` **and** checkout enabled

## Environment variables

Listed in `.env.example` and `PRODUCTION.md`. Defaults: `CHECKOUT_ENABLED=false`, `ADSENSE_ENABLED=false`, `PRINTFUL_STORE_ID=18687336`.
