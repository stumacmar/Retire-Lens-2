/**
 * Someday · product & commercial configuration (single source of truth).
 *
 * Free + Plus. The free tier answers the question honestly; Plus sells depth,
 * the adviser-ready report, and the yearly tax-year refresh. Licences are sold
 * by Lemon Squeezy (merchant of record: they handle VAT, receipts, refunds and
 * issue the licence key). The app validates the key against Lemon Squeezy's
 * public licence API — the ONLY network request Someday ever makes, and it
 * carries nothing but the key and a device label. See LAUNCH.md.
 *
 * Everything an operator needs to change before going live is in this file.
 */
export const PRODUCT = Object.freeze({
  name: 'Someday',
  plusName: 'Someday Plus',
  supportEmail: 'hello@someday.money',
  legalUrl: 'legal.html',

  // ── Pricing ──────────────────────────────────────────────────────────
  // Researched October 2026 against the UK consumer market: Isaac £79.99/yr,
  // RetireEasy £60–80/yr, EvolveMyRetirement ~£50/yr; US tools $129–168/yr.
  // Someday has no cloud sync or account, so it sits just under the UK middle.
  // Paste each variant's Lemon Squeezy checkout link ("Share" → "Checkout
  // link") into `checkoutUrl`. While a link is empty its button is disabled
  // and the tier shows "coming soon", so nothing breaks before launch.
  plans: Object.freeze({
    annual: Object.freeze({
      id: 'annual',
      label: 'Yearly',
      price: '£49',
      per: 'a year',
      blurb: 'Every April’s tax-year update included. Cancel any time.',
      checkoutUrl: '',          // e.g. 'https://someday.lemonsqueezy.com/checkout/buy/xxxxxxxx-...'
    }),
    lifetime: Object.freeze({
      id: 'lifetime',
      label: 'Lifetime',
      price: '£129',
      per: 'once',
      blurb: 'Pay once, keep it for good — updates included.',
      checkoutUrl: '',          // e.g. 'https://someday.lemonsqueezy.com/checkout/buy/yyyyyyyy-...'
    }),
  }),

  // ── Lemon Squeezy licence check ──────────────────────────────────────
  // Optional guards. When set, a key is only honoured if it was issued by
  // THIS store / one of THESE products (both numbers are in the LS dashboard
  // URL and in the licence API response). 0 / empty = accept any valid key.
  lemonSqueezy: Object.freeze({
    storeId: 0,
    productIds: Object.freeze([] as number[]),
    apiBase: 'https://api.lemonsqueezy.com/v1/licenses',
  }),

  // ── Licence policy ───────────────────────────────────────────────────
  licence: Object.freeze({
    revalidateDays: 7,   // quietly re-check an activated key this often (when online)
    graceDays: 30,       // keep Plus working offline for this long since the last good check
  }),

  // ── Legal ────────────────────────────────────────────────────────────
  disclaimerVersion: '2026-10',   // bump to ask every user to accept again
});

export type PlanId = keyof typeof PRODUCT.plans;

/** Only honour https:// checkout links (guards against a pasted javascript: URL). */
export function safeCheckoutUrl(id: PlanId): string {
  const u = PRODUCT.plans[id].checkoutUrl || '';
  return /^https:\/\//i.test(u) ? u : '';
}

/** True once at least one checkout link has been configured. */
export function checkoutConfigured(): boolean {
  return (Object.keys(PRODUCT.plans) as PlanId[]).some(id => !!safeCheckoutUrl(id));
}
