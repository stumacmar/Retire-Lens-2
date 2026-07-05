/**
 * RetireLens - Plain-English glossary
 *
 * One place that turns pension jargon into words a normal person understands.
 * The UI shows `label` in place of the jargon and `tip` on hover / in a help
 * bubble. Engine code and data keys are unchanged — this is purely how things
 * are WORDED for the person using the tool. No acronyms on screen.
 */

export const GLOSSARY = Object.freeze({
  pcls:            { label: 'Tax-free cash',            tip: 'The 25% of your pension you can take without paying tax (up to £268,275).' },
  taxFreeCash:     { label: 'Tax-free cash',            tip: 'The 25% of your pension you can take without paying tax (up to £268,275).' },
  ufpls:           { label: 'Tax-free slice each time', tip: 'Each pension withdrawal is 25% tax-free and 75% taxable, taken as you go.' },
  crystallise:     { label: 'Start taking your pension', tip: 'Moving pension money so you can begin withdrawing it.' },
  uncrystallised:  { label: 'Not yet touched',          tip: "Pension money you haven't started drawing from yet." },
  db:              { label: 'Company / final-salary pension', tip: 'A guaranteed income for life from an employer scheme.' },
  dc:              { label: 'Personal / pot-based pension',   tip: 'A pot of money you invest and draw down (for example a SIPP).' },
  sipp:            { label: 'Personal pension',          tip: 'A pot-based pension you invest and draw an income from.' },
  drawdown:        { label: 'Taking an income',          tip: 'Living off your savings and pensions instead of paying in.' },
  decumulation:    { label: 'Spending phase',            tip: 'The retirement years when you draw on what you saved.' },
  accumulation:    { label: 'Saving-up phase',           tip: "The years before retirement when you're paying in." },
  pa:              { label: 'Tax-free allowance',        tip: 'Income you can receive each year before paying any tax (£12,570).' },
  paTaper:         { label: 'Allowance clawback',        tip: 'Your tax-free allowance shrinks once income tops £100,000.' },
  marginalRate:    { label: 'Tax on your next £1',       tip: "The rate you'd pay on a little more income." },
  isa:             { label: 'Tax-free savings (ISA)',    tip: 'Savings or investments where growth and withdrawals are tax-free.' },
  statePension:    { label: 'State Pension',             tip: 'The government pension, starting at your State Pension age (usually 67).' },
  lsa:             { label: 'Tax-free cash limit',       tip: 'The overall cap on tax-free lump sums: £268,275.' },
  tripleLock:      { label: 'State Pension increases',   tip: 'Yearly rises that keep the State Pension ahead of prices.' },
  escalation:      { label: 'Yearly increase',           tip: 'How a company pension grows each year.' },
  guaranteedIncome:{ label: 'Income for life',           tip: 'Pensions that pay a set amount regardless of markets (State + company).' },
  premiumBonds:    { label: 'Premium Bonds (cash)',      tip: 'NS&I savings with prize draws instead of interest; treated as cash.' },
  cash:            { label: 'Cash savings',              tip: 'Money in the bank or Premium Bonds — outside pensions and ISAs. Spending it is tax-free.' },
  goGo:            { label: 'Active years',              tip: 'Early retirement, when spending is usually highest.' },
  slowGo:          { label: 'Slower years',              tip: 'Spending naturally eases, often from around 75.' },
  noGo:            { label: 'Quiet years',               tip: 'Mostly at home, often from around 82, when spending falls further.' },
  guardrails:      { label: 'Spending adjustments',      tip: 'Spend a little less after bad market years, a little more after good ones.' },
  nominal:         { label: "Future £",                  tip: 'Pounds of the day, including inflation.' },
  real:            { label: "Today's £",                 tip: "Stripped of inflation, so figures compare to money today." },
  sequenceRisk:    { label: 'Bad-timing risk',           tip: 'A market fall just after you retire hurts more than one later on.' },
});

/** Convenience: get the plain label for a jargon key (falls back to the key). */
export function plain(term) {
  return GLOSSARY[term]?.label || term;
}
/** Convenience: get the one-line explanation for a jargon key. */
export function explain(term) {
  return GLOSSARY[term]?.tip || '';
}
