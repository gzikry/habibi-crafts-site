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

The build command does nothing on a production build of `main`. A preview build is any Cloudflare build whose `CF_PAGES_BRANCH` is not `main`, and any build with `HABIBI_PREVIEW=1`. Those builds noindex the pages.

`functions/api` is the Pages Functions directory. You do not copy those files by hand.

## Start a preview deployment

1. Push a branch other than `main`, or open the Pages project, then **Deployments**, then **Create deployment**, and choose that branch.
2. Cloudflare builds it as a Preview deployment. The production branch `main` is not a preview.
3. After it finishes, copy the branch URL. It looks like `https://<branch>.<project>.pages.dev`.

## Set the required preview origin

Non-secret preview values live in `wrangler.toml` under `[env.preview.vars]`. The dashboard does not replace those file values. `APP_ORIGIN` is required. Until you set it, a preview API call fails closed and does not send Stripe or CORS at habibicraftsco.com.

1. Open `wrangler.toml`.
2. Under `[env.preview.vars]`, add `APP_ORIGIN` set to the preview origin from the deployment, with no trailing slash.
3. Commit that line and push the preview branch so the next build picks it up.

`CHECKOUT_API_BASE` can stay empty. The preview build fills the browser config from `CF_PAGES_URL`, which exists only while the build is running.

## Add the secrets

In the Pages project, open **Settings**, then **Environment variables**. Add only these names to **Preview**, with **Encrypt** turned on. Do not put them in `wrangler.toml`, in `site/`, or in this document.

| Name | Where the value comes from |
| --- | --- |
| `STRIPE_SECRET_KEY` | Stripe test secret key |
| `STRIPE_WEBHOOK_SECRET` | Signing secret of the test webhook below |
| `STRIPE_PUBLISHABLE_KEY` | Stripe test publishable key. This is not the secret key. Store it here if the host needs it. The preview HTML leaves it empty because the browser is sent to Stripe Checkout and does not load Stripe.js. |
| `PRINTFUL_API_TOKEN` | The existing Printful token |

You can add the same four names to **Production** later. Production checkout stays off until you say so.

## Lock the preview deployments

Protect preview deployments from the Pages project. Do not create a self-hosted Access application on the `pages.dev` zone. You do not own that zone, so a handmade application there does not lock the preview, and the domain menu may not list it.

1. Open the Pages project.
2. Open **Settings**, then **General**.
3. Select **Enable access policy**.
4. This covers preview deployments only. It leaves `habibicraftsco.com` and the production `<project>.pages.dev` hostname open. Do not add those.
5. Open the Access application this created. Set one Allow policy for `habibicraftsco@gmail.com` with **One-time PIN**. Use another email if that is the inbox you read.

That Pages application is the lock. The only self-hosted application allowed on a `pages.dev` host is the webhook Bypass below, and only for the path `/api/webhook`.

## Let Stripe reach the webhook

Stripe cannot pass the preview login. After **Enable access policy** exists, add a separate Access application for `/api/webhook` with **Bypass**. Do not add that Bypass to the Pages preview application. A Bypass on the preview application opens the whole preview.

1. In **Zero Trust**, open **Access**, then **Applications**, then **Add an application**.
2. Choose **Self-hosted**. Name it Habibi preview webhook.
3. Set the public hostname to the one preview host you are testing, such as `<branch>.<project>.pages.dev`. Set the path to `/api/webhook` only. Do not choose the zone `pages.dev`, and do not leave the path empty. This is allowed only because Pages already created the preview application and this second application is the webhook path on that one host.
4. Add one policy. Name it Stripe webhook. Action **Bypass**. Include **Everyone**.
5. Save this application.

Cloudflare uses the application with the more specific path for `/api/webhook`, so Stripe can post `checkout.session.completed`. Every other preview URL still asks for the shop email. The public site is not in this application.

If the domain menu refuses that hostname, do not invent a zone and do not force the Bypass application. Leave it uncreated. Forward Stripe test events with the Stripe CLI while `wrangler pages dev` is serving the functions, so the events never pass through Access:

```sh
stripe listen --forward-to http://localhost:8788/api/webhook
```

The dashboard webhook can wait until the Bypass application exists.

The smoke script proves the bypass. An unsigned `POST /api/webhook` that returns HTTP 400 and `missing_stripe_signature` reached the function. HTTP 302 or 403 means Access still holds the path.

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

The command runs two groups.

Unauthenticated, every run:

- `POST /api/checkout` is blocked by Access and does not return a checkout URL.
- `POST /api/webhook` with no Stripe signature returns HTTP 400 and `missing_stripe_signature`.

Authenticated, when a Cloudflare Access credential is in the environment:

- `/api/health` reports checkout enabled.
- `/cart.html` says Check out.

If neither credential is set, the script prints `SKIPPED` and does not call `/api/health` or `/cart.html`.

Create a service token for those two checks:

1. In **Zero Trust**, open **Access**, then **Service credentials**, then **Service Tokens**.
2. Select **Create Service Token**. Name it Habibi preview smoke.
3. Copy the Client ID and the Client Secret. The secret is shown once. Do not commit either value.
4. Open the Access application that Pages created for the preview. Do not add this policy to the webhook Bypass application.
5. Add a policy. Name it Preview smoke. Action **Service Auth**. Include rule **Service Token**, and choose the token you just created. Leave the email Allow policy in place. Service Auth lets the script through. Everyone else still gets the one-time PIN.
6. Export the two values as `CF_ACCESS_CLIENT_ID` and `CF_ACCESS_CLIENT_SECRET`, then run the smoke script again. Or set `CF_AUTHORIZATION` to a `CF_Authorization` cookie from a browser that already passed the PIN.

A rejected token prints `Access rejected the service token or cookie` and exits 1. HTTP 400 `missing_stripe_signature` on the unsigned webhook is the proof that the Bypass path reached the function.

The preview pages send `noindex` and `robots.txt` disallows the whole host.

## What the preview sells

`LAUNCH_SLUGS` in `api/lib/catalog.js` is the launch set George chose. It includes Halawa, Early Light, Ya Aini, Baladi, Khalas Habibi, Ya Teta, Beit El Hobb, and the three dad hats. Those seven open products show **Add to bag** and `InStock` on a checkout-on preview.

`HOLD_SLUGS` is the subset of that launch list whose colorway and art are still being revised. Today it is the three dad hats. A product sells only when its slug is in `LAUNCH_SLUGS` and not in `HOLD_SLUGS`. The hats stay in the launch list so the shop still shows them, and they stay unsellable until you delete a hat from `HOLD_SLUGS`.

Every other product, and every held hat, shows **Coming soon** and stays `OutOfStock`. The bag catalog marks those rows not purchasable, so they cannot be added.

## Add the api host later

Do this only when you want `api.habibicraftsco.com`. Checkout on the public site still stays off until you say otherwise.

1. In Porkbun, open the DNS records for `habibicraftsco.com`.
2. Add a CNAME record. Set the host to `api`. Set the answer to `<project>.pages.dev`.
3. In Cloudflare Pages, open **Custom domains** and add `api.habibicraftsco.com`.
4. When you are ready to sell on the public site, set production `CHECKOUT_API_BASE` and `APP_ORIGIN` to `https://api.habibicraftsco.com` and follow the go-live list in `PRODUCTION.md`.
