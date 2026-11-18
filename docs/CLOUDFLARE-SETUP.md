# Set up the Cloudflare preview

You do these steps in Cloudflare, Stripe, Printful, and Porkbun. The git repo stays free of keys. The live site at habibicraftsco.com keeps checkout off.

The Stripe account is not chosen yet. Use whichever Stripe account you decide on, and use its test mode. Do not paste a key into a file in this repo.

## Turn on two-factor authentication

1. Open [dash.cloudflare.com](https://dash.cloudflare.com) and sign in.
2. Select the user icon, then **My Profile**.
3. Open **Authentication**.
4. Select **Set up** under **Two-Factor Authentication** and finish the prompt.

## Create the Pages project

1. In the dashboard, open **Workers & Pages**.
2. Select **Create**.
3. Select **Pages**, then **Connect to Git**.
4. Choose **GitHub** and authorize Cloudflare for the `gzikry` account if it asks.
5. Select the repository `gzikry/habibi-crafts-site`. Do not create a second repository.
6. Select **Begin setup**.

## Set the build

On the setup screen:

1. Set **Production branch** to `main`.
2. Set **Framework preset** to **None**.
3. Set **Build command** to `python3 pipeline/prepare-preview.py`.
4. Set **Build output directory** to `site`.
5. Leave the root directory as the repository root.
6. Select **Save and Deploy**.

The build command does nothing when `HABIBI_PREVIEW` is unset, so the production deployment publishes the committed site with checkout off. A preview deployment sets that variable and rebuilds the preview pages in the build workspace.

`functions/api` is the Pages Functions directory. You do not copy those files by hand.

## Set preview variables

1. Open the Pages project.
2. Open **Settings**, then **Environment variables**.
3. Add each name below to the **Preview** environment. Leave **Encrypt** off for these. They are not secrets.

| Name | Preview value |
| --- | --- |
| `HABIBI_PREVIEW` | `1` |
| `CHECKOUT_ENABLED` | `true` |
| `CHECKOUT_API_BASE` | Leave empty on the first build. The build uses `CF_PAGES_URL`. After you have the branch URL, you may set this to `https://<branch>.<project>.pages.dev` with no trailing slash. |
| `APP_ORIGIN` | The same preview origin, with no trailing slash. |
| `PRINTFUL_STORE_ID` | `18687336` |
| `PRINTFUL_CONFIRM_ORDERS` | `false` |
| `ADSENSE_ENABLED` | `false` |

`wrangler.toml` already sets `PRINTFUL_STORE_ID` and `PRINTFUL_CONFIRM_ORDERS` to those values. A dashboard value for the same name replaces the file for that environment.

Do not add `HABIBI_PREVIEW` to **Production**. Leave production `CHECKOUT_ENABLED` unset, or set it to `false`.

## Add the secrets

On the same **Environment variables** screen, add these to **Preview** with **Encrypt** turned on. Paste the values from Stripe and Printful. Do not put them in git, in `site/`, or in this document.

| Name | Where the value comes from |
| --- | --- |
| `STRIPE_SECRET_KEY` | Stripe test secret key |
| `STRIPE_WEBHOOK_SECRET` | Signing secret of the test webhook below |
| `STRIPE_PUBLISHABLE_KEY` | Stripe test publishable key. The preview pages leave this blank. The secret is for the host only. |
| `PRINTFUL_API_TOKEN` | The existing Printful token |

You can add the same four names to **Production** later. Production checkout stays off until you say so.

Select **Save**. Open **Deployments** and retry the preview deployment so the build sees the new names.

## Point Stripe at the preview

1. In Stripe, turn on **Test mode**.
2. Open **Developers**, then **Webhooks**.
3. Select **Add endpoint**.
4. Set the endpoint URL to `https://<preview>.pages.dev/api/webhook`. Use the preview origin from the Pages deployment, not habibicraftsco.com.
5. Select the event `checkout.session.completed`.
6. Create the endpoint, reveal the signing secret, and store it as `STRIPE_WEBHOOK_SECRET`.
7. Store the test secret key as `STRIPE_SECRET_KEY`.

## Keep Printful in draft

`PRINTFUL_CONFIRM_ORDERS` stays `false`. A paid test checkout can create a Printful draft. It does not confirm the order or charge fulfillment. The store id is `18687336`.

## Check the preview

From this repo, after the preview deployment is green:

```sh
scripts/preview-smoke.sh https://<branch>.<project>.pages.dev
```

The command calls `/api/health` and then creates one test Checkout Session for Ya Aini. Health must report checkout enabled. The create call must return a checkout URL.

The preview pages send `noindex` and `robots.txt` disallows the whole host.

## What the preview sells

The open launch set is Halawa, Early Light, Ya Aini, Baladi, Khalas Habibi, Ya Teta, and Beit El Hobb. Those pages show **Add to bag** and `InStock` on a preview build.

The three dad hats are in the launch list and also in `HOLD_SLUGS` in `api/lib/catalog.js`, because their colorway and art are still being revised. A preview shows **Coming soon** for the hats, and the API refuses them. Delete a hat from `HOLD_SLUGS` when that hat is ready to sell.

Every other product shows **Coming soon** and stays `OutOfStock`.

## Add the api host later

Do this only when you want `api.habibicraftsco.com`. Checkout on the public site still stays off until you say otherwise.

1. In Porkbun, open the DNS records for `habibicraftsco.com`.
2. Add a CNAME record. Set the host to `api`. Set the answer to `<project>.pages.dev`.
3. In Cloudflare Pages, open **Custom domains** and add `api.habibicraftsco.com`.
4. When you are ready to sell on the public site, set production `CHECKOUT_API_BASE` and `APP_ORIGIN` to `https://api.habibicraftsco.com` and follow the go-live list in `PRODUCTION.md`.
