# RetireLens 4 — commercial wrapper setup

RetireLens 4 (the app at the site root) ships with a light "product wrapper":

- **A disclaimer gate** — visitors accept a short "not financial advice" notice
  once before using the planner. Always on. (`js/access.js`)
- **A donation ask** — an optional "pay what you think it's worth" link in the
  footer. Off until you add a link. (`config/product.js`)
- **A legal page** — disclaimer, terms and a UK GDPR privacy notice.
  (`legal.html`)

Everything you need to change lives in **`config/product.js`**. None of this
touches the calculation engine.

---

## 1. Turn on donations (optional)

Create a donations link — easiest are
[Buy Me a Coffee](https://buymeacoffee.com), [Ko-fi](https://ko-fi.com),
PayPal.me, or a Stripe donation Payment Link (all let supporters choose their
own amount). Paste it into `config/product.js`:

```js
donationLink: 'https://buymeacoffee.com/yourname',
```

The "Support this project ♥" link in the footer appears automatically once a
valid `https://` link is set. Until then it stays hidden, so nothing looks
broken.

## 2. Fill in your legal identity (required before you take any money)

Open `legal.html` and replace the bracketed placeholders in section 2
("Who you're dealing with"): your name/business, town, and a contact address.
UK consumer law requires a real trader identity and contact details to be shown
before purchase. Also confirm the support email.

The privacy notice (section 3) is a UK GDPR notice — fill in the controller
name/contact there too. If you process personal data commercially, check
whether you owe the ICO data-protection fee:
<https://ico.org.uk/for-organisations/data-protection-fee/>.

## 3. The disclaimer

The disclaimer gate is on by default and needs no setup. If you materially
change its wording, bump `disclaimerVersion` in `config/product.js` to make
every visitor re-accept.

Under browser automation (the E2E tests) the gate is skipped, so it never blocks
CI.

---

## Notes

- **No cookie banner is required** as shipped: the gate uses only strictly
  necessary local storage, and there are no analytics or ad trackers. If you add
  analytics later, add a compliant consent banner and update the privacy notice.
- **Payments** (if you ever switch from donations to a fixed fee) would go
  through a third party such as Stripe; you never store card details. The
  `access.js` code-unlock path exists for that case but is off by default
  (`model: 'donation'`, `paywallEnabled: false`).
- This wrapper is a general template, not legal advice. If you trade
  commercially, have `legal.html` reviewed by a solicitor.
