# Launching Someday (free + Plus)

The go-live checklist. The app is built and tested; this is the operator's
side. By default Someday is **free to use, with an optional paid tier,
Someday Plus**, sold through **Lemon Squeezy** as merchant of record (they
take the payment, charge the right VAT for the buyer's country, send the
receipt and issue the licence key). Nothing here touches the calculation
engine, and every step is reversible.

Everything a non-developer needs to change lives in one file:
**`horizon/src/config/product.ts`**.

---

## The short version

1. Create a Lemon Squeezy store and one product, *Someday Plus*, with two
   variants (Yearly subscription £49, Lifetime £129) and licence keys on (Step 1).
2. Paste the two checkout links, and optionally the store/product IDs, into
   `horizon/src/config/product.ts` (Step 2).
3. Fill in your real name and contact address in `legal.html` (Step 3 — required
   by UK consumer law before charging).
4. Buy a domain and point it at GitHub Pages (Steps 4–5). Optional but recommended.
5. Push to `main`. CI builds Horizon and deploys it (Step 6).
6. Buy a copy yourself and activate it (Step 7).

| Piece | Where | You do it? |
|---|---|---|
| Prices, checkout links, store/product IDs | `horizon/src/config/product.ts` | ✅ edit values |
| Store, product, variants, licence keys | lemonsqueezy.com dashboard | ✅ create, copy links |
| Trader identity (name, address) | `legal.html` | ⚠️ fill in (legally required) |
| Domain name | `CNAME` + `horizon/src/config/product.ts` | ✅ buy + set (optional) |
| Hosting + build | GitHub Pages via `.github/workflows/deploy.yml` | ✅ already set up |

---

## What is free and what is Plus

| Free | Plus |
|---|---|
| Onboarding, single or couple, no account | The adviser-ready PDF report |
| The answer, the Horizon chart, Poor/Base/Positive lenses | Year-by-year table and lifetime tax analysis |
| Monte Carlo confidence score and fan | Withdrawal-order comparison and the full Coach |
| Spending style and what-if sliders | Advanced mode: multiple schemes, protected tax-free cash, allowance taper, DB transfer values |
| Dates that matter, income mix, lifetime tax | Plan-structure (de-risking) controls and "is it worth it" |
| Scottish tax, public-sector scheme pensions (NHS, Teachers', LGPS, Civil Service…) and every correctness feature | Estate and inheritance-tax view |
| | "When to take it" comparison for each public-sector pension tranche |
| Top decision lever, stress-test headline, every assumption listed | All decision levers ranked, the full stress-test table |
| One plan saved on this device | Each April's tax-year refresh, for as long as Plus is active |

The gate lives in `horizon/src/lib/entitlement.ts` and `horizon/src/components/Plus.tsx`.
To move a feature between tiers, search `App.tsx` for `plus ?` / `<Locked`.

### Pricing rationale (October 2026)

UK consumer planners: Isaac £79.99/yr (or £7.99/mo), RetireEasy £60–80/yr,
EvolveMyRetirement about £50/yr. US tools: ProjectionLab $129/yr, Boldin $168/yr.
Someday has no cloud sync or account, so it sits just under the UK middle at
**£49 a year**, with **£129 lifetime** (about 2.6 years' worth) for people who
dislike subscriptions. Change either in `product.ts` and in Lemon Squeezy.

---

## Step 1 — Lemon Squeezy store and product

1. Sign up at lemonsqueezy.com and create a store (it needs your legal name and
   address for the receipts; payouts go to your bank).
2. **Products → New product**: name *Someday Plus*, type *Digital product*.
3. Under **Variants**, create two:
   - **Yearly** — pricing *Subscription*, £49, billed yearly.
   - **Lifetime** — pricing *Single payment*, £129.
4. On the product, turn on **Generate licence keys**. Set the **activation
   limit** to 3 (a phone, a tablet, a laptop). For the subscription variant
   leave *licence expires with subscription* on, so a lapsed plan stops working
   after the grace period.
5. Tax: enable **VAT collection** so Lemon Squeezy charges and remits the
   right rate per country. Prices in the app are described as *including VAT*.
6. Optional: on the receipt email, add a button linking to
   `https://YOUR-DOMAIN/?licence=[license_key]` if Lemon Squeezy's variables
   support it in your plan. The app activates automatically from that link.
   Without it, the customer pastes the key from the email — the app walks them through it.

## Step 2 — Paste the links into the app

For each variant, **Share → Checkout link** and copy the URL. Then in
`horizon/src/config/product.ts`:

```ts
annual:   { ..., checkoutUrl: 'https://YOUR-STORE.lemonsqueezy.com/checkout/buy/....' },
lifetime: { ..., checkoutUrl: 'https://YOUR-STORE.lemonsqueezy.com/checkout/buy/....' },
```

Until a link is filled in, that tier's button shows "Coming soon" and is
disabled, so nothing breaks before launch.

Optional hardening: set `lemonSqueezy.storeId` and `productIds` (both numbers
appear in the dashboard URL and in the licence API response). The app then
refuses keys issued by any other store or product.

Also set `supportEmail` and, if you buy a domain, use it consistently.

## Step 3 — Legal pages (required before charging)

Open `legal.html` and replace every bracketed field in section 2 ("Who you're
dealing with") and section 3 ("Who is the data controller"):

- `[YOUR NAME OR COMPANY]`
- `[YOUR TOWN/CITY]`
- `[YOUR CONTACT ADDRESS]`

UK consumer law (Consumer Contracts Regulations 2013) requires a trader's real
identity and geographic address to be shown before purchase. Lemon Squeezy is
the merchant of record, which carries most of the consumer-contract burden,
but the licence to use Plus is granted by you, so your identity still needs to
be there. The page already describes the free/Plus model, the licence check,
and the 14-day cancellation position. Read it once; have a solicitor look if
you want certainty.

### What the app sends, and when (for the privacy notice)

Nothing, unless the person buys Plus. Then, on activation and roughly weekly
afterwards, the app POSTs the licence key and a short device label ("Safari on
iPhone") to `api.lemonsqueezy.com`. No planning figures ever leave the device.
This is disclosed in the disclaimer screen, the Plus sheet and the privacy notice.

## Step 4 — Buy a domain (optional, recommended)

Any registrar. A `.co.uk` is typically £5–10/year and signals UK relevance.
`someday.money` is the name used in the config; change `supportEmail` and the
`CNAME` file if you pick another. If you skip this, the site works at
`https://stumacmar.github.io/Retire-Lens-2/`.

## Step 5 — Point the domain at GitHub Pages

Create a file called `CNAME` at the repo root containing only your domain
(e.g. `someday.money`). At your registrar add:

```
A      @    185.199.108.153
A      @    185.199.109.153
A      @    185.199.110.153
A      @    185.199.111.153
CNAME  www  stumacmar.github.io
```

Then in GitHub → Settings → Pages set the custom domain and tick *Enforce HTTPS*.

## Before launch — the preview gate

While you test, every page sits behind a passphrase screen (`horizon/public/gate.js`,
copied to the site root by the build) and carries a `noindex` tag plus a
`robots.txt` that keeps search engines out. The phrase is entered once per
device; a tester can be sent a link with `?gate=the-phrase` instead.

This is a courtesy gate on a static site, not security: anyone who reads the
page source can see the code. It keeps the public and the search engines out
until you are ready, which is what it is for.

- **Change the phrase:** `printf 'someday-gate:NEW PHRASE' | sha256sum`, paste
  the hash into `HASH` in `horizon/public/gate.js`, and update the phrase in
  `horizon/uat.mjs` (check 00c) so the sweep still passes.
- **Launch:** set `ENABLED = false` in `gate.js`, delete `horizon/public/robots.txt`,
  and remove the `noindex` meta tag from `horizon/index.html`, `app.html`,
  `story.html`, `guide.html` and `legal.html`.

## Step 6 — Ship it

**Do this once, first:** in GitHub → Settings → Pages → *Build and deployment*,
set **Source** to **GitHub Actions**. Until that is set, GitHub also runs its own
"build from branch" job on every push, which publishes the files committed in
the repo and can overwrite the real build. (CI keeps the committed copy of the
build in step with the source as a safety net, but the setting is the fix.)

Push to `main`. Two workflows run:

- **CI** — unit tests, stress test, then the Horizon UAT (120+ checks) and
  end-to-end sweep (140+ checks). The sweeps run both as a Plus customer and as
  a free user, so a gating mistake fails the build.
- **Deploy** — builds `horizon/` from source and publishes it to the site root
  (and `/horizon-app/` for old links).

## Step 7 — Test the real purchase

Lemon Squeezy has **Test mode** (toggle in the dashboard). In test mode, buy
Plus with the test card `4242 4242 4242 4242`, open the receipt, paste the key
into *Get Plus → Already have a licence key?* and confirm everything unlocks
and that *Remove from this device* works. Then switch the store to live mode
and copy the **live** checkout links into `product.ts` (test and live links differ).

---

## Operating it

- **Each April**: update the tax constants in `horizon/src/engine/engine.js`
  (`TAX_YEAR`, `TAX_DEFAULTS`, `SCOT_BANDS`) and `config/defaults.js`, run the
  tests, push. That refresh is the thing yearly customers are paying for.
- **Refunds**: issue them in Lemon Squeezy; it disables the key, and the app
  locks within a week (or at once on the next activation attempt).
- **"My key says activation limit reached"**: the customer can remove the key
  from an old device in the app; or raise the activation limit on the product;
  or deactivate an instance in the Lemon Squeezy order page.
- **Hand-issued access** (reviewers, friends): create a 100% discount code in
  Lemon Squeezy rather than special-casing the app. They get a real key.

## What the gate is, honestly

Someday has no server. The licence check is a genuine check against Lemon
Squeezy, so a refunded or lapsed key stops working. But the app runs in the
customer's browser, and anyone who edits their own browser storage can forge a
record. That is true of every client-side product and is the standard trade-off
for a privacy-first tool. The design goal is a fair gate for honest customers,
not a vault. If piracy ever matters, the next step is a small Cloudflare
Worker that signs licence responses, which is a day's work and changes nothing
for customers.
