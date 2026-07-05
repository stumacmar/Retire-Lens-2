# Launching RetireLens as a paid product

This is your go-live checklist. The app is built and works today — the steps
below turn it into a website on your own domain that charges a small fee.
Everything a non-developer needs to change lives in **`config/product.js`**.

Nothing here touches the calculation engine. All steps are reversible.

---

## Overview

RetireLens is a 100% client-side static site (no server). That keeps it cheap,
fast and private, but it means the paywall is a **soft gate**: it's based on an
access code checked in the browser. This is the normal trade-off for indie
static tools. It's enough to support honest buyers and deter casual sharing.
If you later want hard enforcement, see *Hardening the paywall* at the end.

The pieces:

| Piece | Where | You do it? |
|---|---|---|
| Branding, price, email | `config/product.js` | ✅ edit values |
| Domain name | `CNAME` + `config/product.js` | ✅ buy + set |
| Payment | Stripe Payment Link | ✅ create, paste URL |
| Access codes | generated in-browser | ✅ mint, email to buyers |
| Hosting | GitHub Pages (already set up) | ✅ enable custom domain |
| Legal pages | `legal.html` | ⚠️ review wording |

---

## Step 1 — Set your product details

Open **`config/product.js`** and set:

```js
name: 'RetireLens',
domain: 'retirelens.co.uk',          // your domain
supportEmail: 'hello@retirelens.co.uk',
price: '£4.99',
```

These flow through the app, the gate, and the marketing pages automatically.

---

## Step 2 — Buy a domain

1. Buy your domain from any registrar (Namecheap, Cloudflare, GoDaddy, 123-Reg).
   `retirelens.co.uk` is pre-filled everywhere; change it if you pick another.
2. If you choose a different name, update **two** places:
   - `CNAME` (the single line — this is what GitHub Pages reads)
   - `config/product.js` → `domain`

A `.co.uk` is typically £5–10/year and signals UK relevance, which fits the
UK-only tax engine.

---

## Step 3 — Point the domain at GitHub Pages

At your registrar's DNS settings, add these records:

**Apex domain (`retirelens.co.uk`)** — four `A` records to GitHub's IPs:

```
A   @   185.199.108.153
A   @   185.199.109.153
A   @   185.199.110.153
A   @   185.199.111.153
```

**`www` subdomain** — one `CNAME` record:

```
CNAME   www   <your-github-username>.github.io
```

Then in GitHub → your repo → **Settings → Pages**:
- Source: *Deploy from a branch* is not used here — this repo deploys via the
  **Deploy to GitHub Pages** Action on push to `main`.
- Under *Custom domain*, enter `retirelens.co.uk` and save.
- Tick **Enforce HTTPS** once the certificate is issued (can take an hour).

The `CNAME` file in the repo root is copied into the deploy automatically, so
the custom domain sticks across deploys.

---

## Step 4 — Create your Stripe Payment Link

1. Create a free [Stripe](https://stripe.com) account.
2. **Products → Payment links → New**. Create a product "RetireLens — Lifetime
   access", price £4.99, one-time.
3. Under *After payment*, choose **Show confirmation page** and add a message
   like: *"Thanks! Your access code is below — enter it in the planner to
   unlock."* (You'll paste a code here per sale, or automate — see Step 5.)
4. Copy the payment link URL and paste it into `config/product.js`:

   ```js
   stripePaymentLink: 'https://buy.stripe.com/xxxxxxxx',
   ```

> **Fulfilment options.** The simplest launch is manual: when Stripe emails you
> a sale, reply with a fresh access code. To automate, use Stripe's
> confirmation page or a Zapier/Make automation that emails a code on
> `checkout.session.completed`. Codes are just strings — see Step 5.

---

## Step 5 — Mint access codes

Codes look like `RL-AB3K-7M` and are validated in the browser by a checksum, so
you can generate as many as you like without a code list in the source.

**Easiest way** — open the deployed site, open your browser's dev console
(F12 → Console) and run:

```js
__rlGenerateCode(10)   // returns 10 valid codes
```

Copy them somewhere safe and hand one to each buyer.

- Hand-issued codes (press, reviewers, refunds) can also be added to
  `extraValidCodes` in `config/product.js`.
- Changing `CODE_SALT` in `js/access.js` invalidates all previously issued
  codes — only do that if you need to reset.

---

## Step 6 — Turn the paywall on

In `config/product.js`:

```js
paywallEnabled: true,
```

While this is `false` (the default), the planner is fully open — good for
testing and for launch day before your Stripe link is ready. Flip it to `true`
when you're ready to charge. The disclaimer gate is always on regardless.

---

## Step 7 — Review the legal pages

`legal.html` contains a disclaimer, terms of use and a privacy policy written
for a UK, personal, non-commercial project. **Read them.** If you're trading
commercially, have a solicitor check them. At minimum:

- **Fill in your trader identity (required by law).** In `legal.html`, section
  2 → *"Who you're dealing with"*, replace `[YOUR NAME OR COMPANY]`,
  `[YOUR TOWN/CITY]` and `[YOUR CONTACT ADDRESS]` with your real details. UK
  consumer law (Consumer Contracts Regulations 2013) requires a genuine trader
  identity and contact address to be shown **before** purchase. Then set
  `traderIdentityComplete: true` in `config/product.js` as a reminder that it's done.
- Confirm the support email is correct.
- Confirm the "not FCA-regulated / not financial advice" wording matches how you
  market it.
- Confirm the cancellation/refund wording matches your Stripe setup. The terms
  state that buyers consent to immediate digital supply and waive the 14-day
  cancellation right — mirror that on your Stripe confirmation page.

Bump `disclaimerVersion` in `config/product.js` if you materially change the
disclaimer — it forces every user to re-accept.

---

## Step 8 — Ship it

```bash
git add -A
git commit -m "launch config"
git push
```

The Deploy Action publishes to GitHub Pages automatically. Visit your domain,
accept the disclaimer, and (if the paywall is on) test a code.

---

## Optional — make the landing page your homepage

Today the domain root shows the planner (`index.html`), with links to the
marketing page (`landing.html`), guide and legal in the footer. If you'd rather
visitors hit marketing first, rename in the repo: move `index.html` →
`app.html` and `landing.html` → `index.html`, then update the "Open the planner"
links in `index.html`/`guide.html`/`legal.html` to point at `app.html`. (Leave
this until after you've confirmed the basic flow works, and re-run the E2E tests
which currently expect the planner at `/`.)

---

## Hardening the paywall (optional, later)

The soft gate is fine to launch. If sharing becomes a problem, add a tiny
serverless check without moving the whole app off static hosting:

1. Store issued codes (or Stripe customer emails) in a serverless KV store.
2. Add a Netlify/Cloudflare Function `POST /validate` that checks a code and
   returns `{ valid: true }`.
3. In `js/access.js`, replace `isValidAccessCode` with a `fetch` to that
   function. Everything else stays the same.

This keeps hosting cheap while making codes individually revocable.
