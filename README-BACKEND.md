# Habibi Crafts Co — backend contract

## Local simulation

```bash
npm test
node scripts/local-backend.js
```

## Endpoints

- `GET /api/health`
- `POST /api/checkout`
- `POST /api/webhook`
- `GET /api/checkout-session`

## Required environment variables

- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `PRINTFUL_API_TOKEN`
- `PRINTFUL_STORE_ID`
- `APP_ORIGIN`
