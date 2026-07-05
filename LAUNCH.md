# Launching RetireLens (free, with donations)

This is your go-live checklist. The app is built and works today. By **default
it is free to use, with a "pay what you think it's worth" donation ask** — no
paywall. Everything a non-developer needs to change lives in
**`config/product.js`**.

Nothing here touches the calculation engine. All steps are reversible.

> Prefer to charge a fixed fee instead of asking for donations? That's fully
> supported — skip to *Optional: charge a fixed fee (paywall)* near the end.

---

## The short version (free + donations)

1. Set your details in `config/product.js` (Step 1).
2. Buy a domain and point it at GitHub Pages (Steps 2–3).
3. Add a donations link — Buy Me a Coffee / Ko-fi / PayPal (Step 4a).
4. Fill in your real name/contact in `legal.html` (Step 7 — required by law even
   for a free site, because the host keeps server logs).
5. Push. Done.

The pieces:

| Piece | Where | You do it? |
|---|---|---|
| Branding, email, donation link | `config/product.js` | ✅ edit values |
| Domain name | `CNAME` + `config/product.js` | ✅ buy + set |
| Donations (default) | Buy Me a Coffee / Ko-fi / PayPal | ✅ create, paste URL |
| Hosting | GitHub Pages (already set up) | ✅ enable custom domain |
| Legal + controller identity | `legal.html` | ⚠️ fill in + review |
| Fixed-fee paywall (optional) | Stripe + access codes | ⏭️ only if charging |

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

> ⏭️ **Steps 4–6 are only for the fixed-fee paywall.** If you're launching
> free-with-donations (the default), skip to **Step 7** and see the
> *Donations* section below for the one thing you need to add.

## Optional (paywall only) · Step 4 — Create your Stripe Payment Link

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

### Data protection / UK GDPR

RetireLens is privacy-friendly by design: your users' financial figures are
processed entirely in their browser and never reach you. That removes most of
the usual data-protection burden, but once you take payments you do handle
*some* personal data (buyers' payment/contact details, server logs). Before
charging:

- **Fill in the controller details** in the `legal.html` privacy notice
  (section 3 → "Who is the data controller") — same real name/contact as your
  trader identity.
- **Check whether you must pay the ICO data protection fee.** Most UK
  businesses that process personal data for their own commercial purposes must
  register with the ICO and pay an annual fee (typically £40–£60). Use the
  ICO's short self-assessment: <https://ico.org.uk/for-organisations/data-protection-fee/>.
- **Rely on Stripe's built-in compliance for payments.** Stripe acts as its own
  controller/processor, provides a Data Processing Agreement, and handles card
  data (PCI) and international-transfer safeguards. You don't store card details.
- **No cookie banner is required** as shipped: the app uses only strictly
  necessary local storage and runs no analytics, ads, or third-party trackers
  (Chart.js and the Inter font are self-hosted, so there are no third-party
  requests at all). If you later add analytics, you must add a compliant
  consent banner and update the privacy notice.
- **Handle rights requests** sent to your support email within one month. Local
  planning data is erased by the user via "Reset & Start Over"; you only need to
  action requests about data you actually hold (e.g. payment records).

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

## Site structure (already set up)

- `index.html` — the **homepage**: your story, features, how-it-works and the
  donation ask. This is what visitors see at your domain root.
- `app.html` — the **planner** itself (with the disclaimer gate).
- `guide.html`, `legal.html` — how-to and legal pages.

All the links, the deploy workflow, and the E2E tests already point at these.

## Donations ("pay what you think it's worth")

The default model is **free to use, with a donation ask** — no paywall. To turn
the donate button on:

1. Create a donations link — the easiest are
   [Buy Me a Coffee](https://buymeacoffee.com), [Ko-fi](https://ko-fi.com),
   PayPal.me, or a Stripe donation Payment Link. All let supporters choose their
   own amount.
2. Paste it into `config/product.js` → `donationLink`. Tweak `donationHeadline`
   and `donationBlurb` if you like — your story is already there.

Until a link is set, the donate button simply opens the planner, so nothing
looks broken. The homepage and the planner footer both surface the ask.

To charge a fixed fee instead of asking for donations, set `model: 'paywall'`
and `paywallEnabled: true` in `config/product.js` and follow steps 4–6 above.

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
