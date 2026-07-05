/**
 * RetireLens - Independent Reference Model (accuracy oracle)
 *
 * A deliberately SEPARATE, from-scratch implementation of the core UK
 * retirement maths. It shares NO code with engine/ — that's the point. It is
 * used by tests/beta-cross-check.js to independently re-derive the engine's
 * outputs and flag any discrepancy.
 *
 * It mirrors the same documented UK rules the engine claims to implement:
 *  - Income tax: Personal Allowance with £100k taper, England/Wales/NI bands.
 *  - Accumulation: annual compounding with mid-year contribution growth.
 *  - Marginal PCLS: 25% of each pension withdrawal is tax-free, up to an
 *    entitlement of min(25% of the pot at retirement, the £268,275 LSA).
 *
 * All rates are passed in (from config) so a rate change can't silently
 * desync the oracle from the engine.
 */

// ── Independent UK income tax ───────────────────────────────

export function refPersonalAllowance(taxableGross, cfg) {
  const pa = cfg.personalAllowance;
  const threshold = cfg.personalAllowanceTaperThreshold;
  const rate = cfg.personalAllowanceTaperRate;
  if (taxableGross <= threshold) return pa;
  const reduction = Math.floor((taxableGross - threshold) * rate);
  return Math.max(0, pa - reduction);
}

export function refIncomeTaxOnTaxable(taxable, bands) {
  if (taxable <= 0) return 0;
  let remaining = taxable;
  let prev = 0;
  let tax = 0;
  for (const band of bands) {
    if (remaining <= 0) break;
    const width = band.threshold - prev;
    const inBand = Math.min(remaining, width);
    if (inBand > 0) tax += inBand * band.rate;
    remaining -= inBand;
    prev = band.threshold;
  }
  return tax;
}

/**
 * Tax + net for a given TAXABLE gross income (SP + DB + taxable pension + other).
 * Tax-free money (ISA, PCLS) must be added to net separately by the caller.
 */
export function refTaxFromGross(taxableGross, cfg) {
  const pa = refPersonalAllowance(taxableGross, cfg);
  const taxable = Math.max(0, taxableGross - pa);
  const tax = refIncomeTaxOnTaxable(taxable, cfg.bands);
  return { personalAllowance: pa, tax, net: taxableGross - tax };
}

// ── Independent accumulation ────────────────────────────────

/**
 * Final pot after accumulation, compounding annually with a mid-year
 * contribution factor (contributions earn ~half a year of growth).
 */
export function refAccumulate({ startPot, annualContribution, years, netGrowthRate }) {
  let bal = startPot;
  const contribFactor = 1 + netGrowthRate / 2;
  for (let i = 0; i < years; i++) {
    bal = bal * (1 + netGrowthRate) + annualContribution * contribFactor;
  }
  return bal;
}

// ── Independent marginal-PCLS tax tracker ───────────────────

/**
 * Given the pot at retirement, returns a stateful helper that, fed each year's
 * GROSS pension withdrawal, returns the taxable portion after applying 25%
 * marginal PCLS up to the remaining entitlement.
 */
export function makePclsTracker(potAtRetirement, { pclsRate = 0.25, lsaCap = 268275 } = {}) {
  let remaining = Math.min(potAtRetirement * pclsRate, lsaCap);
  return {
    remaining: () => remaining,
    taxablePortion(grossPensionWithdrawal) {
      if (grossPensionWithdrawal <= 0 || remaining <= 0) return grossPensionWithdrawal;
      const taxFree = Math.min(grossPensionWithdrawal * pclsRate, remaining);
      remaining -= taxFree;
      return grossPensionWithdrawal - taxFree;
    },
  };
}
