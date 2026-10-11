/**
 * Someday engine.
 * Modelled on the Marshall Retirement Model workbook: central assumptions,
 * Bear/Base/Bull scenarios, nominal figures with an inflation assumption,
 * income layering in drawdown. Deliberate improvements over the workbook,
 * all surfaced in the UI:
 *   1. Tax is computed per partner, allocated by marginal rate, so both
 *      personal allowances and basic bands are used before anyone pays 40%.
 *   2. State pensions are today's money indexed from the start year.
 *   3. Life event and inheritance amounts are today's money, indexed to
 *      their year, matching every other money input.
 * All logic is pure and deterministic; the Monte Carlo takes a seed.
 * No em dashes anywhere. All figures nominal unless stated.
 */

export function createEngine() {

  // ── Tax constants (editable via assumptions) ─────────────────────────
  // UK tax year 2026/27. Personal allowance and rUK thresholds are frozen
  // to April 2031 (Autumn Budget 2025). Review every April: TAX_YEAR below
  // is what the app and the report display.
  const TAX_YEAR = '2026/27';
  const TAX_DEFAULTS = {
    taxYear: TAX_YEAR,
    region: 'ruk',              // 'ruk' (England/Wales/NI) | 'scotland'
    personalAllowance: 12570,
    basicRate: 0.20,
    higherRate: 0.40,
    additionalRate: 0.45,
    higherThreshold: 50270,     // gross income where 40% starts
    additionalThreshold: 125140,
    taperStart: 100000,         // PA tapers £1 per £2 above this
    pclsCap: 268275,            // lifetime tax-free cash cap
    isaAnnualAllowance: 20000,
  };

  // Scottish income tax 2026/27 (non-savings), bands in TAXABLE income above
  // the allowance. Published gross ranges assume a full PA of 12,570:
  // Starter 19% to 16,537 · Basic 20% to 29,526 · Intermediate 21% to 43,662
  // Higher 42% to 75,000 · Advanced 45% to 125,140 · Top 48% above.
  // (Scottish Budget 2026-27: starter and basic thresholds up 7.4%; higher,
  // advanced and top frozen.) The top-rate edge, like the rUK additional-rate
  // edge, is statutory in taxable income (125,140), where the taper has
  // already removed the PA.
  const SCOT_BANDS = [
    { upTo: 3967,     rate: 0.19 },
    { upTo: 16956,    rate: 0.20 },
    { upTo: 31092,    rate: 0.21 },
    { upTo: 62430,    rate: 0.42 },
    { upTo: 125140,   rate: 0.45 },
    { upTo: Infinity, rate: 0.48 },
  ];

  // ── Default assumptions: the Marshall workbook, February 2026 ────────
  function defaults() {
    return {
      startYear: 2026,
      retireYear: 2030,
      horizonAge: 90,           // "drawdown to age" for partner A

      partnerA: {
        name: 'Stuart',
        birthYear: 1970,
        spAge: 67,
        spAmount: 12548,        // today's money, per year
        pension: 570000,        // SIPP current value
        isa: 46600,
        monthlyPension: 3125,   // monthly SIPP contribution to retirement
        monthlyIsa: 0,
        db: 0,
        dbStartYear: 2030,
        dbIndexed: false,
        pclsTaken: 0,           // tax-free cash already taken (reduces the cap)
        crystallised: 0,        // pot already accessed; pays no further TFC
        tfcRate: 0.25,          // blended tax-free entitlement on untouched funds
        income: 0,              // annual income, for the allowance-taper warning
        dbTransferValue: 0,     // CETV if quoted (display/report only)
        pots: [],               // optional scheme list (UI aggregates into the above)
        dbSchemes: [],          // public-sector scheme tranches
        stopYear: null,         // own stop-work year if later than the household's
        deathAge: null,         // plan for this partner to this age (survivor phase after)
        pensionAccessAge: null, // protected pension age, if any (default 55 / 57 by birth year)
        contribGrossUp: false,  // monthlyPension entered net of basic-rate relief
        dbSurvivorPct: 0.5,     // share of the company DB paid to a surviving partner
      },
      partnerB: {
        name: 'Carol',
        birthYear: 1963,
        spAge: 67,
        spAmount: 12548,
        pension: 46000,         // SASS current value
        isa: 46600,
        monthlyPension: 100,    // £1,200 per year
        monthlyIsa: 0,
        db: 5000,               // defined benefit, per year
        dbStartYear: 2030,
        dbIndexed: false,       // workbook drawdown holds DB flat
        pclsTaken: 0,
        crystallised: 0,
        tfcRate: 0.25,
        income: 0,
        dbTransferValue: 0,
        pots: [],
        dbSchemes: [],
        stopYear: null,
        deathAge: null,
        pensionAccessAge: null,
        contribGrossUp: false,
        dbSurvivorPct: 0.5,
      },

      growth: 0.07,             // the live slider rate
      growthBear: 0.04,
      growthBase: 0.07,         // the named Base scenario, chip target
      growthBull: 0.10,
      inflation: 0.02,
      mcMean: 0.07,             // (legacy; the simulation centres on the lens rate)
      mcSd: 0.12,
      mcPaths: 1000,
      mcSeed: 42,
      mcPreRetirement: true,    // returns are random through the saving years too
      fee: 0,                   // annual charges, taken off every return (workbook: none)
      equityShare: 1,           // share of the pot that takes the stress-path equity returns
      riskPreset: null,         // 'cautious' | 'balanced' | 'adventurous' | null (custom)
      household: 'couple',      // 'couple' | 'single'
      survivorSpend: 0.75,      // spending after one partner dies, as a share of the couple's
      schemaVersion: 2,

      // Property, tracked for net worth and estate.
      house: 750000,
      houseGrowth: 0.03,
      cash: 0,
      cashGrowth: 0,           // interest on cash / Premium Bonds (its own fixed rate)

      // Income need. targetNet and every spending line are today's money.
      targetNet: 60000,
      spendingPlanOn: false,
      spending: defaultSpending(),
      // Age-phased reductions: from a chosen age, cut spending by a chosen %
      phase1Age: 75, phase1Cut: 0.10, phase1On: false,
      phase2Age: 82, phase2Cut: 0.20, phase2On: false,

      strategy: 'sippfirst',    // 'sippfirst' | 'isafirst' | 'pafirst'
      pclsMode: 'none',         // 'none' | 'upfront' | 'phased'

      // How the money is run, chosen up front. null means not yet chosen, so
      // the app asks once. Purely a record of the choice: the maths follows
      // from `architecture` below.
      approach: null,           // null | 'traditional' | 'derisking'

      // ── Retirement architecture (optional overlay, default OFF) ────────
      // Models a real plan architecture rather than one blended growth rate:
      //   · a gilt ladder holding N years of net need (the "envelopes")
      //   · a growth engine (global equity + gold/diversifiers)
      //   · an annual conveyor-belt top-up of the ladder from the engine
      //   · mechanical spending rules driven by a funded ratio
      //   · a planned annuity review, care costs, house as last-resort
      // With on:false every figure is identical to the simple model.
      architecture: {
        on: false,
        // Sleeves. Real returns; the growth lens shifts them together.
        equityReal: 0.05,       // global all-world equity, real
        equitySd: 0.16,
        goldReal: 0.01,         // gold / diversifiers, real
        goldSd: 0.14,
        goldPct: 0.15,          // share of the growth engine
        giltReal: 0.015,        // index-linked gilts held to maturity, real
        // The ladder (envelopes) and the conveyor belt
        ladderYears: 7,
        refill: 'whenUp',       // 'whenUp' | 'always'
        refillMin: 0,           // top up only if the engine returned above this
        // Mechanical spending rules
        rulesOn: true,
        longevityAge: 95,       // conservative denominator for the funded ratio
        cutBelow: 0.90, cutBy: 0.10,
        raiseAbove: 1.25, raiseBy: 0.05, raiseLagYears: 2,
        floorMult: 0.75, capMult: 1.25,
        // Planned annuity review
        annuityOn: false, annuityYear: 2037, annuityAmount: 150000,
        annuityRate: 0.06, annuityIndexed: true,
        // Care
        careOn: false, careFromAge: 85, careAnnual: 45000, careYears: 4,
        // House parachute (downsize / release, once)
        parachuteOn: false, parachuteBelow: 0.75, parachuteFrom: 80, parachuteFraction: 0.5,
        // Deterministic stress path applied to the growth engine
        stressPath: 'none',     // 'none' | 'japan' | 'gfc' | 'stagflation'
        // How much a lean year hurts, for the worth-it verdict. Standard
        // constant-relative-risk-aversion: 2 relaxed, 4 typical, 8 cautious.
        riskAversion: 4,
      },

      // Inheritance as a first-class assumption. Amount is today's money.
      inherit: { on: false, year: 2035, amount: 100000, invest: true },

      // One-off life events. Amounts are today's money, indexed to the year.
      lifeEvents: [],

      tax: { ...TAX_DEFAULTS, indexation: 'cpi', indexFrom: 2031 },
      iht: {
        nilRateBand: 325000,
        residenceNRB: 175000,
        couple: true,
        rate: 0.40,
        pensionsInEstateFrom: 2027,  // announced change, toggleable
        includePensions: true,
      },
    };
  }

  // ── Fresh start: what a NEW visitor sees ──────────────────────────────
  // Same shape as defaults(), but with no personal data — generic names and
  // zeroed pots/savings/property — so nobody lands on someone else's plan.
  // defaults() stays the Marshall workbook, which the test suites pin to.
  function freshStart() {
    const P = defaults();
    P.partnerA = { ...P.partnerA, name: 'You',     pension: 0, isa: 0, monthlyPension: 0, monthlyIsa: 0, db: 0 };
    P.partnerB = { ...P.partnerB, name: 'Partner', pension: 0, isa: 0, monthlyPension: 0, monthlyIsa: 0, db: 0 };
    P.house = 0; P.houseGrowth = 0.03; P.cash = 0; P.cashGrowth = 0.02;
    P.targetNet = 43100;   // PLSA 2024 "Moderate" for a couple — an honest starting point
    P.inherit = { on: false, year: 2035, amount: 0, invest: true };
    P.lifeEvents = [];
    // New plans assume spending naturally eases in later life (the workbook
    // fixture keeps these off so its parity figures are unchanged).
    P.phase1On = true; P.phase1Cut = 0.15;   // from age 75, spend 15% less
    P.phase2On = true; P.phase2Cut = 0.25;   // from age 82, spend 25% less
    // Tax-free cash a slice at a time is the better default for most people;
    // a realistic all-in charge; stress paths hit a 70% equity share.
    P.pclsMode = 'phased';
    P.fee = 0.005;
    P.equityShare = 0.7;
    P.riskPreset = 'balanced';
    return P;
  }

  // A plausible, generic example couple for the opt-in "see an example" peek.
  // Not the Marshall workbook, not anyone real — just illustrative round numbers.
  function example() {
    const P = freshStart();
    P.partnerA = { ...P.partnerA, name: 'Alex', birthYear: 1968, pension: 320000, isa: 40000, monthlyPension: 800, monthlyIsa: 0, db: 0 };
    P.partnerB = { ...P.partnerB, name: 'Sam',  birthYear: 1970, pension: 110000, isa: 25000, monthlyPension: 300, monthlyIsa: 0, db: 0 };
    P.retireYear = 2032; P.horizonAge = 92;
    P.cash = 20000; P.cashGrowth = 0.02;
    P.house = 380000;
    P.targetNet = 40000;
    return P;
  }

  function defaultSpending() {
    // Suite of monthly headings, all today's money, all editable.
    return [
      { key: 'council',    label: 'Council tax',                 monthly: 250 },
      { key: 'utilities',  label: 'Utilities and energy',        monthly: 300 },
      { key: 'groceries',  label: 'Groceries',                   monthly: 650 },
      { key: 'transport',  label: 'Cars, fuel and travel',       monthly: 350 },
      { key: 'insurance',  label: 'Insurance',                   monthly: 200 },
      { key: 'health',     label: 'Health and dental',           monthly: 150 },
      { key: 'phone',      label: 'Phone, broadband, subs',      monthly: 120 },
      { key: 'eatingout',  label: 'Eating out and takeaways',    monthly: 350 },
      { key: 'holidays',   label: 'Holidays',                    monthly: 700 },
      { key: 'leisure',    label: 'Hobbies and leisure',         monthly: 300 },
      { key: 'clothing',   label: 'Clothing',                    monthly: 130 },
      { key: 'gifts',      label: 'Gifts and family',            monthly: 300 },
      { key: 'misc',       label: 'Everything else',             monthly: 200 },
    ];
  }

  // ── Small helpers ─────────────────────────────────────────────────────
  const clamp0 = (x) => Math.max(0, x);
  const ageIn = (p, year) => year - p.birthYear;
  const num = (v, d) => { const n = Number(v); return Number.isFinite(n) ? n : (d == null ? 0 : d); };
  const SCHEMA_VERSION = 2;
  // State Pension age under current legislation, by birth year: 66 for those
  // born before 6 April 1960, 67 for those born 1960 to 1976 (the rise runs
  // 2026 to 2028), 68 for those born on or after 6 April 1977.
  const spaFor = (birthYear) => num(birthYear, 1970) <= 1960 ? 66 : num(birthYear, 1970) <= 1976 ? 67 : 68;
  const spAgeOf = (who) => num(who && who.spAge) > 0 ? num(who.spAge) : spaFor(who && who.birthYear);
  // Normal minimum pension age for personal and workplace pensions: 55 now,
  // 57 from 6 April 2028 (born 6 April 1973 on; by year here). A protected
  // pension age can be entered per person.
  const nmpaFor = (who) => num(who && who.pensionAccessAge) > 0
    ? num(who.pensionAccessAge) : (num(who && who.birthYear, 1970) >= 1973 ? 57 : 55);
  const isSingle = (P) => P.household === 'single' || !!(P.partnerB && P.partnerB.absent);
  const stopYearOf = (P, who) => Math.max(P.retireYear, num(who && who.stopYear) > 0 ? num(who.stopYear) : P.retireYear);
  const feeOf = (P) => Math.min(0.05, Math.max(0, num(P.fee)));
  const equityShareOf = (P) => P.equityShare == null ? 1 : Math.min(1, Math.max(0, num(P.equityShare, 1)));
  const tfcRateOf = (who) => Math.min(1, Math.max(0, who.tfcRate == null ? 0.25 : num(who.tfcRate)));
  const contribGross = (who) => num(who.monthlyPension) * 12 * (who.contribGrossUp ? 1.25 : 1);
  const deathAgeOf = (who) => num(who && who.deathAge) > 0 ? num(who.deathAge) : null;
  // A partner is in the plan until the end of the year they reach their
  // death age, if one is set. Nobody is removed at the horizon age.
  const aliveIn = (who, year) => !(who && who.absent)
    && (deathAgeOf(who) == null || year <= who.birthYear + deathAgeOf(who));
  const lastYearOf = (P, who) => {
    const d = deathAgeOf(who), h = who.birthYear + P.horizonAge;
    return d == null ? h : Math.min(h, who.birthYear + d);
  };
  // The plan runs to the later of the two horizons (or death years), so a
  // couple is never modelled as ending when the older partner reaches it,
  // and the survivor's years are always covered.
  const planEndYear = (P) => {
    const a = lastYearOf(P, P.partnerA);
    const hasB = !isSingle(P) && P.partnerB && P.partnerB.birthYear > 1900;
    return Math.max(P.retireYear, a, hasB ? lastYearOf(P, P.partnerB) : a);
  };
  // Single-person plans carry an absent partner B: no pots, no income, no
  // allowance, never alive in the simulation. Everything else is unchanged.
  function normalisePlan(P) {
    if (P.household !== 'single' || (P.partnerB && P.partnerB.absent && !P.partnerB.pension && !P.partnerB.isa)) return P;
    const b = P.partnerB || {};
    return { ...P, partnerB: { ...b, absent: true, name: b.name || 'Partner',
      birthYear: P.partnerA.birthYear, spAge: 0, spAmount: 0,
      pension: 0, isa: 0, monthlyPension: 0, monthlyIsa: 0, db: 0, dbSchemes: [],
      pclsTaken: 0, crystallised: 0, income: 0, deathAge: null, stopYear: null } };
  }
  // One lump sum allowance per person (£268,275) across scheme automatic
  // lump sums, commutation and personal-pension tax-free cash. The excess
  // is taxed as income.
  const lumpAfterLsa = (lump, used, cap) => {
    const allowed = clamp0(cap - used);
    const free = Math.min(lump, allowed);
    return { free, excess: lump - free, used: used + free };
  };
  const inflFactor = (P, year) => Math.pow(1 + P.inflation, year - P.startYear);

  function spendingAnnual(P) {
    if (!P.spendingPlanOn) return P.targetNet;
    return P.spending.reduce((s, r) => s + (Number(r.monthly) || 0), 0) * 12;
  }

  function phaseFactor(P, ageA) {
    // Step-downs are TOTAL reductions from the full retirement spend, not
    // compounding cuts. At the later age you spend `phase2Cut` less than your
    // baseline (marginal from baseline), not `phase2Cut` less than the already
    // reduced phase-1 level. The deepest applicable tier wins.
    let cut = 0;
    if (P.phase1On && ageA >= P.phase1Age) cut = P.phase1Cut;
    if (P.phase2On && ageA >= P.phase2Age) cut = Math.max(cut, P.phase2Cut);
    return 1 - cut;
  }

  /** Net spending target for a calendar year, nominal. */
  function targetForYear(P, year) {
    return spendingAnnual(P) * inflFactor(P, year) * phaseFactor(P, ageIn(P.partnerA, year));
  }

  /** Life events plus the inheritance assumption, as one list.
   *  Amounts are today's money; nominal() indexes them to the event year. */
  function effectiveEvents(P) {
    const evs = [...(P.lifeEvents || [])];
    if (P.inherit && P.inherit.on && Number(P.inherit.amount) > 0) {
      evs.push({
        year: Number(P.inherit.year), label: 'Inheritance',
        amount: Number(P.inherit.amount), kind: 'income',
        invest: !!P.inherit.invest, _inherit: true,
      });
    }
    return evs;
  }
  const eventNominal = (P, ev) => (Number(ev.amount) || 0) * inflFactor(P, ev.year);

  // ── Defined-benefit pensions ──────────────────────────────────────────
  // Two kinds live side by side. The simple fields (db, dbStartYear,
  // dbIndexed) describe a company pension as a flat annual amount. The
  // `dbSchemes` list describes public-sector tranches properly: a legacy
  // final-salary slice unreduced at 60 or 65 and a 2015 career-average slice
  // unreduced at State Pension age, each taken at a chosen age with the
  // scheme's early-retirement reduction (or late uplift), an automatic lump
  // sum where the scheme pays one, optional commutation of pension for cash
  // at the scheme's rate within the HMRC 25% limit, and ongoing accrual while
  // still working. All public-sector pensions are CPI-linked in deferment and
  // in payment, so in today's money a tranche holds its value.
  //
  // Factors are planning approximations of each scheme's published tables
  // (which vary by exact age in years and months and are revised): the
  // report states them as assumptions. Minimum pension age is 55, rising to
  // 57 on 6 April 2028 for most schemes; the uniformed services are exempt.
  const DB_SCHEMES = Object.freeze({
    nhs1995:  { label: 'NHS 1995 Section',           family: 'NHS',          npa: 60,    accrual: 1 / 80, revalReal: 0,      autoLump: 3, commuteRate: 12, earlyRate: 0.045, lateRate: 0,     minAge: 55, legacy: true },
    nhs2008:  { label: 'NHS 2008 Section',           family: 'NHS',          npa: 65,    accrual: 1 / 60, revalReal: 0,      autoLump: 0, commuteRate: 12, earlyRate: 0.045, lateRate: 0.05,  minAge: 55, legacy: true },
    nhs2015:  { label: 'NHS 2015 Scheme',            family: 'NHS',          npa: 'spa', accrual: 1 / 54, revalReal: 0.015,  autoLump: 0, commuteRate: 12, earlyRate: 0.046, lateRate: 0.05,  minAge: 55 },
    tps60:    { label: 'Teachers’ final salary (NPA 60)', family: 'Teachers', npa: 60,    accrual: 1 / 80, revalReal: 0,      autoLump: 3, commuteRate: 12, earlyRate: 0.045, lateRate: 0,     minAge: 55, legacy: true },
    tps65:    { label: 'Teachers’ final salary (NPA 65)', family: 'Teachers', npa: 65,    accrual: 1 / 60, revalReal: 0,      autoLump: 0, commuteRate: 12, earlyRate: 0.045, lateRate: 0.05,  minAge: 55, legacy: true },
    tpsCare:  { label: 'Teachers’ career average (2015)', family: 'Teachers', npa: 'spa', accrual: 1 / 57, revalReal: 0.016,  autoLump: 0, commuteRate: 12, earlyRate: 0.045, lateRate: 0.05,  minAge: 55 },
    lgps80:   { label: 'LGPS pre-2008 (80ths + lump sum)', family: 'LGPS',   npa: 65,    accrual: 1 / 80, revalReal: 0,      autoLump: 3, commuteRate: 12, earlyRate: 0.045, lateRate: 0.05,  minAge: 55, legacy: true },
    lgps60:   { label: 'LGPS 2008–2014 (60ths)',      family: 'LGPS',         npa: 65,    accrual: 1 / 60, revalReal: 0,      autoLump: 0, commuteRate: 12, earlyRate: 0.045, lateRate: 0.05,  minAge: 55, legacy: true },
    lgpsCare: { label: 'LGPS career average (2014)',  family: 'LGPS',         npa: 'spa', accrual: 1 / 49, revalReal: 0,      autoLump: 0, commuteRate: 12, earlyRate: 0.045, lateRate: 0.05,  minAge: 55 },
    csClassic:{ label: 'Civil Service classic',       family: 'Civil Service', npa: 60,   accrual: 1 / 80, revalReal: 0,      autoLump: 3, commuteRate: 12, earlyRate: 0.05,  lateRate: 0,     minAge: 55, legacy: true },
    csPremium:{ label: 'Civil Service premium',       family: 'Civil Service', npa: 60,   accrual: 1 / 60, revalReal: 0,      autoLump: 0, commuteRate: 12, earlyRate: 0.05,  lateRate: 0,     minAge: 55, legacy: true },
    csNuvos:  { label: 'Civil Service nuvos',         family: 'Civil Service', npa: 65,   accrual: 0.023,  revalReal: 0,      autoLump: 0, commuteRate: 12, earlyRate: 0.05,  lateRate: 0.05,  minAge: 55, legacy: true },
    csAlpha:  { label: 'Civil Service alpha (2015)',  family: 'Civil Service', npa: 'spa', accrual: 0.0232, revalReal: 0,     autoLump: 0, commuteRate: 12, earlyRate: 0.043, lateRate: 0.05,  minAge: 55 },
    police15: { label: 'Police 2015 (CARE)',          family: 'Police',       npa: 60,    accrual: 1 / 55.3, revalReal: 0.0125, autoLump: 0, commuteRate: 12, earlyRate: 0.044, lateRate: 0.05, minAge: 55, uniformed: true },
    fire15:   { label: 'Firefighters 2015 (CARE)',    family: 'Fire',         npa: 60,    accrual: 1 / 59.7, revalReal: 0.01, autoLump: 0, commuteRate: 12, earlyRate: 0.044, lateRate: 0.05,  minAge: 55, uniformed: true },
    afps15:   { label: 'Armed Forces 2015 (CARE)',    family: 'Armed Forces', npa: 60,    accrual: 1 / 47, revalReal: 0.01,   autoLump: 0, commuteRate: 12, earlyRate: 0.044, lateRate: 0.05,  minAge: 55, uniformed: true },
    custom:   { label: 'Other defined-benefit scheme', family: 'Other',       npa: 65,    accrual: 1 / 60, revalReal: 0,      autoLump: 0, commuteRate: 12, earlyRate: 0.05,  lateRate: 0,     minAge: 55 },
  });
  const DB_SCHEMES_ASOF = '2026-10';

  const schemeOf = (t) => DB_SCHEMES[t && t.scheme] || DB_SCHEMES.custom;
  const trancheNpa = (who, t) => {
    if (t.npa) return Number(t.npa);
    const s = schemeOf(t);
    return s.npa === 'spa' ? who.spAge : s.npa;
  };
  // The minimum age a tranche can be taken from, for the birth year given.
  // 57 from 6 April 2028 (birth year 1973 on, by year only); uniformed
  // services stay at 55.
  const trancheMinAge = (who, t) => {
    const s = schemeOf(t);
    if (s.uniformed || t.protectedAge) return s.minAge || 55;
    return who.birthYear >= 1973 ? 57 : 55;
  };
  // HMRC: total tax-free lump sum ≤ 25% of the capital value (20 × the
  // post-commutation pension + the lump sum). Solving for the most pension
  // that can be given up at `rate` : 1 with an automatic lump of a × pension:
  //   c_max = pension × (20 − 3a) / (3·rate + 20)
  const maxCommute = (pension, autoMult, rate) =>
    clamp0(pension * (20 - 3 * autoMult) / (3 * rate + 20));

  const tranchesOf = (who) => Array.isArray(who && who.dbSchemes)
    ? who.dbSchemes.filter(t => t && ((Number(t.pension) || 0) > 0 || (t.accruing && (Number(t.salary) || 0) > 0)))
    : [];

  // Everything about one tranche, in today's money unless stated.
  function trancheBenefits(P, who, t) {
    const s = schemeOf(t);
    const npa = trancheNpa(who, t);
    const minAge = trancheMinAge(who, t);
    const takeAge = Math.max(minAge, Math.round(Number(t.takeAge) || npa));
    const takeYear = who.birthYear + takeAge;
    const margin = t.revalReal != null ? Number(t.revalReal) : (s.revalReal || 0);
    const accrual = t.accrual != null ? Number(t.accrual) : (s.accrual || 0);
    // Accrual while still working: each year adds accrual × pay, and the
    // built-up amount revalues at CPI plus the scheme margin until service
    // ends (the plan's stop-work year, or the take year if earlier). Once
    // deferred, revaluation is CPI only — flat in today's money.
    let accrued = Number(t.pension) || 0;
    const stopYear = Math.min(P.retireYear, takeYear);
    if (t.accruing && accrual > 0 && (Number(t.salary) || 0) > 0) {
      for (let y = P.startYear; y < stopYear; y++) accrued = accrued * (1 + margin) + accrual * Number(t.salary);
    }
    const early = Math.max(0, npa - takeAge), late = Math.max(0, takeAge - npa);
    const r = t.earlyRate != null ? Number(t.earlyRate) : s.earlyRate;
    const u = t.lateRate != null ? Number(t.lateRate) : (s.lateRate || 0);
    const factor = early > 0 ? Math.pow(1 - r, early) : Math.pow(1 + u, late);
    const basePension = accrued * factor;
    const autoMult = t.autoLump != null ? Number(t.autoLump) : (s.autoLump || 0);
    const rate = t.commuteRate != null ? Number(t.commuteRate) : (s.commuteRate || 12);
    const cMax = maxCommute(basePension, autoMult, rate);
    const commute = cMax * Math.min(1, Math.max(0, Number(t.commutePct) || 0));
    const pension = basePension - commute;
    const lump = autoMult * basePension + rate * commute;
    const indexed = t.indexed == null ? true : !!t.indexed;
    return { id: t.id, scheme: t.scheme || 'custom', label: t.label || s.label, family: s.family, survivorPct: t.survivorPct,
      npa, minAge, takeAge, takeYear, accrued, early, late, factor, basePension, pension,
      lump, lumpMin: autoMult * basePension, lumpMax: autoMult * basePension + rate * cMax,
      commute, cMax, autoMult, rate, indexed, legacy: !!s.legacy };
  }

  // Precomputed per partner: nominal DB income and tax-free lump sums by year.
  function dbSchedule(P, who) {
    const tranches = tranchesOf(who).map(t => trancheBenefits(P, who, t));
    const incomeAt = (year) => {
      const infl = inflFactor(P, year);
      let v = (who.db && year >= who.dbStartYear) ? who.db * (who.dbIndexed ? infl : 1) : 0;
      for (const b of tranches) {
        if (year >= b.takeYear) v += b.pension * (b.indexed ? infl : inflFactor(P, b.takeYear));
      }
      return v;
    };
    const lumpAt = (year) => {
      let v = 0;
      for (const b of tranches) if (b.takeYear === year && b.lump > 0) v += b.lump * inflFactor(P, year);
      return v;
    };
    // Survivor's pension after the member's death: a share of the pension
    // in payment (public-sector schemes pay roughly half; the share is
    // editable per tranche), on the pre-commutation amount.
    const survivorAt = (year) => {
      const infl = inflFactor(P, year);
      const simplePct = who.dbSurvivorPct == null ? 0.5 : Math.min(1, Math.max(0, Number(who.dbSurvivorPct) || 0));
      let v = (who.db && year >= who.dbStartYear) ? who.db * simplePct * (who.dbIndexed ? infl : 1) : 0;
      for (const b of tranches) {
        if (year < b.takeYear) continue;
        const pct = b.survivorPct == null ? 0.5 : Math.min(1, Math.max(0, Number(b.survivorPct) || 0));
        v += b.basePension * pct * (b.indexed ? infl : inflFactor(P, b.takeYear));
      }
      return v;
    };
    return { tranches, incomeAt, lumpAt, survivorAt };
  }
  const hasAnyDb = (who) => (Number(who && who.db) || 0) > 0 || tranchesOf(who).length > 0;

  // Plus: what taking a tranche at each possible age does to the whole plan.
  function compareDbTiming(P, whoKey, trancheId) {
    const who = P[whoKey];
    const idx = (who.dbSchemes || []).findIndex(t => t && t.id === trancheId);
    if (idx < 0) return null;
    const t = who.dbSchemes[idx];
    const b0 = trancheBenefits(P, who, t);
    const out = [];
    // Only ages still ahead of the member: the past is not an option. The
    // range always covers the planned age and the scheme's normal age.
    const from = Math.max(b0.minAge, P.startYear - who.birthYear);
    const to = Math.max(from, b0.npa, b0.takeAge, Math.min(b0.npa + 3, P.horizonAge - 5));
    if (to - from > 25) return null;
    for (let age = from; age <= to; age++) {
      const q = { ...P, [whoKey]: { ...who, dbSchemes: who.dbSchemes.map((x, i) => i === idx ? { ...x, takeAge: age } : x) } };
      const b = trancheBenefits(q, q[whoKey], q[whoKey].dbSchemes[idx]);
      const dd = drawdown(q);
      const horizonYear = planEndYear(P);
      out.push({ age, year: who.birthYear + age, pension: b.pension, lump: b.lump, factor: b.factor,
        endWealthReal: dd.endWealth / inflFactor(P, horizonYear), exhaustedAgeA: dd.exhaustedAgeA,
        lifetimeTaxReal: dd.lifetimeTaxReal != null ? dd.lifetimeTaxReal : dd.lifetimeTax });
    }
    if (!out.length) return null;
    return { tranche: b0, options: out };
  }

  // ── Income tax, single person ────────────────────────────────────────
  // Thresholds are frozen to April 2031 and then, by default, index with the
  // plan's inflation assumption (indexation 'cpi'); 'frozen' holds them for
  // the whole plan. The lump sum allowance and the ISA allowance stay fixed.
  // Only the region and the indexation choice are read from a saved plan;
  // every constant comes from this file, so an old plan never carries an
  // old tax year with it.
  function taxFor(P, year) {
    const saved = P.tax || {};
    const T = { ...TAX_DEFAULTS, region: saved.region === 'scotland' ? 'scotland' : 'ruk',
      indexation: saved.indexation === 'frozen' ? 'frozen' : 'cpi',
      indexFrom: num(saved.indexFrom) > 2000 ? num(saved.indexFrom) : 2031 };
    const y = year == null ? P.startYear : year;
    const k = (T.indexation === 'frozen' || y < T.indexFrom) ? 1
      : Math.pow(1 + num(P.inflation), y - (T.indexFrom - 1));
    if (k === 1) return { ...T, year: y, scotBands: SCOT_BANDS };
    return { ...T, year: y,
      personalAllowance: T.personalAllowance * k, higherThreshold: T.higherThreshold * k,
      additionalThreshold: T.additionalThreshold * k, taperStart: T.taperStart * k,
      scotBands: SCOT_BANDS.map(b => ({ upTo: b.upTo * k, rate: b.rate })) };
  }

  function personalAllowanceFor(gross, T) {
    T = T || TAX_DEFAULTS;
    const lost = clamp0(gross - T.taperStart) / 2;
    return clamp0(T.personalAllowance - lost);
  }

  /** Tax on one person's gross non-savings income. */
  function taxOn(gross, T) {
    T = T || TAX_DEFAULTS;
    const pa = personalAllowanceFor(gross, T);
    const taxable = clamp0(gross - pa);
    if (T.region === 'scotland') {
      let tax = 0, prev = 0;
      for (const b of (T.scotBands || SCOT_BANDS)) {
        tax += clamp0(Math.min(taxable, b.upTo) - prev) * b.rate;
        if (taxable <= b.upTo) break;
        prev = b.upTo;
      }
      return tax;
    }
    // rUK bands are measured in taxable income: basic to 37,700, higher to
    // 125,140, additional above. The taper alters the allowance, not the
    // band edges, which is what creates the 60 pence zone.
    const basicBand = T.higherThreshold - T.personalAllowance;      // 37700
    const higherBandTop = T.additionalThreshold;                    // 125140 taxable
    const inBasic = Math.min(taxable, basicBand);
    const inHigher = clamp0(Math.min(taxable, higherBandTop) - basicBand);
    const inAdditional = clamp0(taxable - higherBandTop);
    return inBasic * T.basicRate + inHigher * T.higherRate + inAdditional * T.additionalRate;
  }

  /** Gross band edges for the marginal-rate allocator, per region. */
  function bandEdgesFor(T) {
    if (T.region === 'scotland') {
      // Gross edges derived from the taxable-income bands, so they roll with them.
      const edges = (T.scotBands || SCOT_BANDS)
        .filter(b => Number.isFinite(b.upTo) && T.personalAllowance + b.upTo < T.taperStart)
        .map(b => T.personalAllowance + b.upTo);
      return [T.personalAllowance, ...edges, T.taperStart, T.additionalThreshold];
    }
    return [T.personalAllowance, T.higherThreshold, T.taperStart, T.additionalThreshold];
  }

  /** Gross ceiling for "fill the cheap bands" strategies: the point where
   *  the marginal rate first exceeds ~21% (rUK 40% edge; Scottish 42% edge). */
  function basicCeilFor(T) {
    return T.region === 'scotland' ? T.personalAllowance + (T.scotBands || SCOT_BANDS)[2].upTo : T.higherThreshold;
  }
  /** Gross pension draw needed so that draw minus tax nets `net`, given
   *  the person already has `baseGross` of taxable income. */
  function grossForNet(net, baseGross, T) {
    T = T || TAX_DEFAULTS;
    if (net <= 0) return 0;
    let lo = net, hi = net * 2.2 + 200000;
    const baseTax = taxOn(baseGross, T);
    for (let i = 0; i < 60; i++) {
      const mid = (lo + hi) / 2;
      const netOut = mid - (taxOn(baseGross + mid, T) - baseTax);
      if (netOut < net) lo = mid; else hi = mid;
    }
    return (lo + hi) / 2;
  }

  /** Marginal rate for one extra pound. */
  function marginalRate(gross, T) {
    T = T || TAX_DEFAULTS;
    return taxOn(gross + 1, T) - taxOn(gross, T);
  }

  // ── Retirement architecture ──────────────────────────────────────────
  // Historic real equity sequences, APPROXIMATE and illustrative — they are
  // for stress-testing the shape of a bad start, not for precise history.
  const STRESS_PATHS = {
    japan: [-0.38, 0.02, -0.25, 0.09, 0.08, 0.01, -0.06, -0.20, -0.06, 0.58,
            -0.25, -0.19, -0.18, 0.24, 0.09, 0.03, 0.02, -0.42, 0.06, -0.01],
    gfc: [-0.37, 0.26, 0.14, -0.01, 0.15, 0.29, 0.10, -0.02, 0.08, 0.20],
    stagflation: [-0.10, -0.34, -0.57, 1.00, -0.05, 0.40, 0.03, 0.05],
    crashflat: [-0.30, 0, 0, 0, 0],   // a 30% fall, then five flat real years
  };

  // Old saved plans have no architecture block; merge over the defaults.
  let ARCH_DEFAULTS = null;
  function archOf(P) {
    if (!ARCH_DEFAULTS) ARCH_DEFAULTS = defaults().architecture;
    return { ...ARCH_DEFAULTS, ...(P.architecture || {}) };
  }

  // Envelope sizing: the exact net amount needed after guaranteed income,
  // for each of the next N years, in nominal terms.
  function ladderTarget(AR, needNow, inflation) {
    let t = 0;
    for (let k = 0; k < AR.ladderYears; k++) t += needNow * Math.pow(1 + inflation, k);
    return t;
  }

  // Funded ratio: everything you have, over everything you still need, both
  // discounted at the ladder's real rate to a conservative longevity age.
  function fundedRatio(AR, { wealthReal, spendReal, guaranteedNetReal, ageA }) {
    const n = Math.max(1, AR.longevityAge - ageA);
    const r = Math.max(0.001, AR.giltReal);
    const af = (1 - Math.pow(1 + r, -n)) / r;          // annuity factor
    const needPV = clamp0(spendReal) * af;
    const havePV = clamp0(wealthReal) + clamp0(guaranteedNetReal) * af;
    return needPV > 1 ? havePV / needPV : 99;
  }

  // One year of the architecture: spend from the envelopes first (never sell
  // the growth engine into a fallen market), grow each sleeve on its own
  // return, then run the conveyor belt back up to target.
  function sleeveYear(sleeve, draw, rGrowth, rGilt, target, AR) {
    let ladder = sleeve.ladder, growth = sleeve.growth;
    const fromLadder = Math.min(ladder, draw);
    ladder -= fromLadder;
    growth = clamp0(growth - (draw - fromLadder));
    ladder *= (1 + rGilt);
    growth *= (1 + rGrowth);
    if (AR.refill === 'always' || rGrowth > AR.refillMin) {
      const move = Math.min(clamp0(target - ladder), growth);
      ladder += move; growth -= move;
    }
    return { ladder, growth, total: ladder + growth };
  }

  // Nominal sleeve returns for a given real-return shift (the growth lens).
  function sleeveRates(AR, P, lensShift) {
    const engineReal = AR.equityReal * (1 - AR.goldPct) + AR.goldReal * AR.goldPct;
    return {
      gilt: (1 + AR.giltReal + lensShift) * (1 + P.inflation) - 1,
      growth: (1 + engineReal + lensShift) * (1 + P.inflation) - 1,
    };
  }

  // ── Accumulation: start year to the first stop-work year ─────────────
  // Mid-year convention on contributions. Reproduces the workbook's
  // future-value formulas to within about one percent, and stays honest
  // when contributions change or life events land before retirement.
  // opts.returnAt(year) supplies a per-year return (the Monte Carlo); the
  // annual fee comes off every return.
  function accumulate(P, growthOverride, opts) {
    opts = opts || {};
    P = normalisePlan(P);
    const fee = feeOf(P);
    const gFlat = (growthOverride == null ? P.growth : growthOverride) - fee;
    const rateAt = opts.returnAt ? (y) => num(opts.returnAt(y), gFlat + fee) - fee : () => gFlat;
    const years = [];
    const warnings = [];
    const A = P.partnerA, B = P.partnerB;
    let a = { pension: num(A.pension), isa: num(A.isa), uncrys: clamp0(num(A.pension) - num(A.crystallised)) };
    let b = { pension: num(B.pension), isa: num(B.isa), uncrys: clamp0(num(B.pension) - num(B.crystallised)) };
    let cash = num(P.cash);
    const events = effectiveEvents(P);
    const DBA = dbSchedule(P, A), DBB = dbSchedule(P, B);
    const cap = taxFor(P, P.startYear).pclsCap;
    // Lump sum allowance used so far per person (prior tax-free cash counts).
    let lsaUsedA = num(A.pclsTaken), lsaUsedB = num(B.pclsTaken);
    // A scheme lump sum taken before stopping work lands in cash; the part
    // over the lump sum allowance is taxed, at 40% while still earning.
    const bookLump = (yr) => {
      const lA = DBA.lumpAt(yr), lB = DBB.lumpAt(yr);
      if (lA > 0) { const r = lumpAfterLsa(lA, lsaUsedA, cap); lsaUsedA = r.used; cash += r.free + r.excess * 0.6; }
      if (lB > 0) { const r = lumpAfterLsa(lB, lsaUsedB, cap); lsaUsedB = r.used; cash += r.free + r.excess * 0.6; }
    };
    if (P.startYear < P.retireYear) bookLump(P.startYear);

    for (let y = P.startYear; y < P.retireYear; y++) {
      const g = rateAt(y);
      const contribHalf = 1 + g / 2;
      // (From the stop-work year on, the drawdown loop books lump sums instead.)
      if (y + 1 < P.retireYear) bookLump(y + 1);
      // Pension contributions stop at 75 (no tax relief after that birthday).
      const cA = ageIn(A, y) < 75 ? contribGross(A) * contribHalf : 0;
      const cB = ageIn(B, y) < 75 ? contribGross(B) * contribHalf : 0;
      a.pension = a.pension * (1 + g) + cA;
      a.uncrys = a.uncrys * (1 + g) + cA;
      a.isa = a.isa * (1 + g) + num(A.monthlyIsa) * 12 * contribHalf;
      b.pension = b.pension * (1 + g) + cB;
      b.uncrys = b.uncrys * (1 + g) + cB;
      b.isa = b.isa * (1 + g) + num(B.monthlyIsa) * 12 * contribHalf;
      cash = cash * (1 + num(P.cashGrowth));   // cash earns its own fixed rate
      // Pre-retirement life events, today's money indexed to the year
      for (const ev of events) {
        if (ev.year !== y) continue;
        const amt = eventNominal(P, ev);
        if (ev.kind === 'earned') continue;
        if (ev.kind === 'cost') {
          // Costs come from cash, then ISA A, then ISA B. Pensions are not
          // accessible before retirement; an unfunded remainder is a warning.
          let rem = amt;
          const fromCash = Math.min(cash, rem); cash -= fromCash; rem -= fromCash;
          const fromA = Math.min(a.isa, rem); a.isa -= fromA; rem -= fromA;
          const fromB = Math.min(b.isa, rem); b.isa -= fromB; rem -= fromB;
          if (rem > 1) warnings.push(
            'Life event "' + (ev.label || 'cost') + '" in ' + y + ' needs ' +
            Math.round(rem) + ' more than the accessible savings held then.');
        } else {
          // Windfalls arrive mid-year and earn half a year of growth
          if (ev.invest) a.isa += amt * contribHalf; else cash += amt;
        }
      }
      years.push({
        year: y + 1,
        pensionA: a.pension, isaA: a.isa, uncrysA: a.uncrys,
        pensionB: b.pension, isaB: b.isa, uncrysB: b.uncrys,
        cash, gia: 0,
        house: num(P.house) * Math.pow(1 + num(P.houseGrowth), y + 1 - P.startYear),
      });
    }
    const last = { ...(years[years.length - 1] || {
      year: P.startYear, pensionA: a.pension, isaA: a.isa, uncrysA: a.uncrys,
      pensionB: b.pension, isaB: b.isa, uncrysB: b.uncrys, cash, gia: 0,
      house: num(P.house),
    }), lsaUsedA, lsaUsedB };
    return { years, atRetirement: last, warnings };
  }

  // ── One withdrawal routine for both engines ──────────────────────────
  // The deterministic plan and every Monte Carlo path fund a year through
  // this same code: cash, the general account, ISAs, phased or upfront
  // tax-free cash, the chosen withdrawal order, and marginal-rate allocation
  // across the couple. S holds the pots and is mutated; the draws are
  // returned. S.canA / S.canB gate the pensions (minimum pension age, still
  // working, or no longer alive).
  function fundYear(S, P, T, need, baseA, baseB) {
    const canA = S.canA !== false, canB = S.canB !== false;
    if (S.gia == null) S.gia = 0;
    let grossA = 0, grossB = 0, tfcA = 0, tfcB = 0, isaDraw = 0, cashDraw = 0, giaDraw = 0;
    let isaDrawA = 0, isaDrawB = 0;
    // Outside the pensions: cash first, then the general account (its
    // growth is taxable, so it goes before the ISAs), then the ISAs.
    const drawIsa = (amt) => {
      let rem = amt;
      const c = Math.min(S.cash, rem); S.cash -= c; cashDraw += c; rem -= c;
      const gd = Math.min(S.gia, rem); S.gia -= gd; giaDraw += gd; rem -= gd;
      const fa = Math.min(S.isaA, rem); S.isaA -= fa; rem -= fa; isaDrawA += fa;
      const fb = Math.min(S.isaB, rem); S.isaB -= fb; rem -= fb; isaDrawB += fb;
      isaDraw += fa + fb;
      return amt - rem;
    };

    // Serve `wantNet` of net income from one partner's pension, honouring
    // an optional gross ceiling. Returns net served.
    const serveFrom = (who, wantNet, grossCeil) => {
      const isA = who === 'A';
      if (isA ? !canA : !canB) return 0;
      const pot = isA ? S.potA : S.potB;
      if (pot <= 0.01 || wantNet <= 0.01) return 0;
      const base = (isA ? baseA : baseB) + (isA ? grossA : grossB);
      const uncrys = isA ? S.uncrysA : S.uncrysB;
      const rate = isA ? S.rateA : S.rateB;
      const pclsLeft = clamp0(T.pclsCap - (isA ? S.pclsUsedA : S.pclsUsedB));
      const phased = P.pclsMode === 'phased' && pclsLeft > 0 && uncrys > 0.01 && rate > 0;
      const ceil = grossCeil == null ? Infinity : clamp0(grossCeil - base);
      if (ceil <= 0.01) return 0;
      if (phased) {
        const tfFor = (gr) => Math.min(Math.min(gr, uncrys) * rate, pclsLeft);
        let lo = 0, hi = Math.min(pot, wantNet * 2 + 100000);
        for (let i = 0; i < 50; i++) {
          const mid = (lo + hi) / 2;
          const tf = tfFor(mid);
          const taxable = mid - tf;
          const net = tf + taxable - (taxOn(base + taxable, T) - taxOn(base, T));
          if (net < wantNet) lo = mid; else hi = mid;
        }
        let gross = Math.min((lo + hi) / 2, pot);
        // Respect the ceiling on the taxable part
        if (gross - tfFor(gross) > ceil) {
          gross = Math.min(gross, ceil / 0.75);
        }
        const tf = tfFor(gross);
        const taxable = gross - tf;
        const net = tf + taxable - (taxOn(base + taxable, T) - taxOn(base, T));
        if (isA) { S.pclsUsedA += tf; tfcA += tf; grossA += taxable; S.potA -= gross; S.uncrysA = clamp0(S.uncrysA - gross); }
        else { S.pclsUsedB += tf; tfcB += tf; grossB += taxable; S.potB -= gross; S.uncrysB = clamp0(S.uncrysB - gross); }
        return net;
      }
      let gross = Math.min(grossForNet(wantNet, base, T), pot, ceil);
      const net = gross - (taxOn(base + gross, T) - taxOn(base, T));
      if (isA) { grossA += gross; S.potA -= gross; S.uncrysA = clamp0(S.uncrysA - gross); }
      else { grossB += gross; S.potB -= gross; S.uncrysB = clamp0(S.uncrysB - gross); }
      return net;
    };

    // Marginal-rate-ordered allocation: repeatedly serve from whichever
    // partner has the cheaper next pound, up to the next band edge, so
    // free allowances are always consumed before anyone pays basic rate
    // and both basic bands before anyone pays higher rate.
    const bandEdges = bandEdgesFor(T);
    const nextEdge = (gross) => {
      for (const e of bandEdges) if (gross < e - 0.01) return e;
      return Infinity;
    };
    const drawPensionNet = (netWanted, grossCeilCap) => {
      let served = 0;
      for (let guard = 0; guard < 24 && netWanted - served > 0.5; guard++) {
        const gA = baseA + grossA, gB = baseB + grossB;
        const candidates = [];
        if (canA && S.potA > 0.01) candidates.push({ who: 'A', m: marginalRate(gA, T), g: gA });
        if (canB && S.potB > 0.01) candidates.push({ who: 'B', m: marginalRate(gB, T), g: gB });
        if (!candidates.length) break;
        candidates.sort((x, y) => x.m - y.m || y.g - x.g);
        const pick = candidates[0];
        const edge = Math.min(nextEdge(pick.g), grossCeilCap == null ? Infinity : grossCeilCap);
        if (edge - pick.g <= 0.01) {
          // This partner is at the ceiling; try the other, else stop
          if (candidates.length > 1) {
            const other = candidates[1];
            const oEdge = Math.min(nextEdge(other.g), grossCeilCap == null ? Infinity : grossCeilCap);
            if (oEdge - other.g <= 0.01) break;
            const got = serveFrom(other.who, netWanted - served, oEdge);
            if (got <= 0.01) break;
            served += got;
            continue;
          }
          break;
        }
        const got = serveFrom(pick.who, netWanted - served, edge);
        if (got <= 0.01) {
          // Could not serve at this edge (empty pot slice); lift the edge
          const got2 = serveFrom(pick.who, netWanted - served, grossCeilCap);
          if (got2 <= 0.01) break;
          served += got2;
          continue;
        }
        served += got;
      }
      return served;
    };

    if (P.strategy === 'isafirst') {
      const fromIsa = drawIsa(need);
      const rem = need - fromIsa;
      if (rem > 0.01) drawPensionNet(rem, null);
    } else if (P.strategy === 'pafirst') {
      // Fill only the tax-free personal allowances from pensions, then
      // ISA, then pensions again at whatever rate is left.
      const paNet = drawPensionNet(need, T.personalAllowance);
      let rem = need - paNet;
      if (rem > 0.01) {
        const fromIsa = drawIsa(rem);
        rem -= fromIsa;
        if (rem > 0.01) drawPensionNet(rem, null);
      }
    } else {
      // sippfirst: pensions up to the cheap-band ceiling (rUK 40% edge,
      // Scottish 42% edge), ISA for the excess, then pensions again only
      // if the ISA runs dry.
      const basicNet = drawPensionNet(need, basicCeilFor(T));
      let rem = need - basicNet;
      if (rem > 0.01) {
        const fromIsa = drawIsa(rem);
        rem -= fromIsa;
        if (rem > 0.01) rem -= drawPensionNet(rem, null);
      }
    }
    const served = tfcA + tfcB + isaDraw + cashDraw + giaDraw
      + grossA - (taxOn(baseA + grossA, T) - taxOn(baseA, T))
      + grossB - (taxOn(baseB + grossB, T) - taxOn(baseB, T));
    return { grossA, grossB, tfcA, tfcB, isaDraw, isaDrawA, isaDrawB, cashDraw, giaDraw, served };
  }

  // ── Shared simulation context ────────────────────────────────────────
  // Everything a path needs that does not change from path to path: the
  // normalised plan, a per-year tax table, scheme schedules, ages and gates.
  function prepare(P) {
    const Pn = normalisePlan(P);
    const A = Pn.partnerA, B = Pn.partnerB;
    const taxCache = new Map();
    const taxAt = (year) => {
      let t = taxCache.get(year);
      if (!t) { t = taxFor(Pn, year); taxCache.set(year, t); }
      return t;
    };
    const AR = archOf(Pn);
    return {
      P: Pn, A, B, taxAt, AR, archOn: !!AR.on, single: isSingle(Pn),
      events: effectiveEvents(Pn),
      DBA: dbSchedule(Pn, A), DBB: dbSchedule(Pn, B),
      endYear: planEndYear(Pn),
      rateA: tfcRateOf(A), rateB: tfcRateOf(B),
      nmpaA: nmpaFor(A), nmpaB: nmpaFor(B),
      stopA: stopYearOf(Pn, A), stopB: stopYearOf(Pn, B),
      spAgeA: spAgeOf(A), spAgeB: spAgeOf(B),
      fee: feeOf(Pn),
      stress: STRESS_PATHS[AR.stressPath] || null,
      gamma: Math.max(0, AR.riskAversion == null ? 4 : num(AR.riskAversion, 4)),
      survivorSpend: Pn.survivorSpend == null ? 0.75 : Math.min(1, Math.max(0.2, num(Pn.survivorSpend, 0.75))),
    };
  }

  // Real stress-path returns are equity sequences; a plain plan applies
  // them to its equity share and holds the rest at a modest real return.
  const blendReal = (eqReal, eqShare) => eqShare * eqReal + (1 - eqShare) * 0.01;

  // ── One simulated retirement, year by year ───────────────────────────
  // The deterministic plan and every Monte Carlo path run through this one
  // function; only the return provider differs. acc holds the pots at the
  // first stop-work year; ret(i, year) gives the year's nominal returns net
  // of fees: r for the blended pot, rGrowth for the architecture's growth
  // engine and rGilt for its ladder. want is 'rows' (the plan), 'track'
  // (a Monte Carlo path whose wealth is charted) or 'lite'.
  function runPath(X, acc, ret, want) {
    const { P, A, B, taxAt, AR, archOn, events, DBA, DBB, endYear, rateA, rateB, single } = X;
    const couple = !single;
    const rows = want === 'rows' ? [] : null;
    const track = want === 'track' ? [] : null;
    let potA = acc.pensionA, potB = acc.pensionB;
    let isaA = acc.isaA, isaB = acc.isaB;
    let cash = acc.cash || 0, gia = acc.gia || 0;
    // Only the uncrystallised (never-accessed) part of a pot can still pay
    // tax-free cash, and the lifetime cap is reduced by anything already taken.
    let uncrysA = acc.uncrysA != null ? acc.uncrysA : potA;
    let uncrysB = acc.uncrysB != null ? acc.uncrysB : potB;
    let pclsUsedA = acc.lsaUsedA != null ? acc.lsaUsedA : num(A.pclsTaken);
    let pclsUsedB = acc.lsaUsedB != null ? acc.lsaUsedB : num(B.pclsTaken);
    // Upfront tax-free cash is taken in the first year the partner can
    // access the pension, after any scheme lump sum of that year.
    let upfrontA = P.pclsMode === 'upfront', upfrontB = P.pclsMode === 'upfront' && couple;
    let lifetimeTax = 0, lifetimeTaxReal = 0;
    let exhaustedYear = null, shortfallYear = null, shortfallTotal = 0, shortfallTotalReal = 0;
    let sleeve = null, spendMult = 1, raiseStreak = 0;
    let annuityToday = 0, annuityBought = false;
    let parachuteUsed = false, parachuteYear = null, lastRatio = null;
    let goneA = false, goneB = !couple, inheritedTotal = 0;
    const st = { spend: 0, years: 0, worstRatio: 1, leanYears: 0, utilSum: 0, utilN: 0,
      solvent: [], okFull: true, okRules: true, minCoverage: 1, failIndex: null };
    const gamma = X.gamma, SPEND_FLOOR = 2000;

    for (let year = P.retireYear, i = 0; year <= endYear; year++, i++) {
      const T = taxAt(year);
      const infl = inflFactor(P, year);
      const ageA = ageIn(A, year), ageB = ageIn(B, year);
      const aliveA = aliveIn(A, year), aliveB = couple && aliveIn(B, year);
      const eventLabels = [];
      let inherited = 0;
      // A death passes the estate to the survivor at the start of the next
      // year: ISAs and cash stay in the household; a pension pot inherited
      // from a death before 75 is drawn tax-free (held like an ISA here),
      // after 75 it is taxable when drawn, so it joins the survivor's pot.
      if (!aliveA && !goneA) {
        goneA = true; eventLabels.push((A.name || 'Partner A') + ' dies');
        if (aliveB) { inherited = potA + isaA; if (deathAgeOf(A) < 75) isaB += potA; else potB += potA; isaB += isaA; }
        potA = 0; isaA = 0; uncrysA = 0;
      }
      if (!aliveB && !goneB) {
        goneB = true; eventLabels.push((B.name || 'Partner B') + ' dies');
        if (aliveA) { inherited = potB + isaB; if (deathAgeOf(B) < 75) isaA += potB; else potA += potB; isaA += isaB; }
        potB = 0; isaB = 0; uncrysB = 0;
      }
      inheritedTotal += inherited;
      // Money parked outside the ISA moves in at the allowance, per person.
      if (year > P.retireYear && gia > 0) {
        const mA = aliveA ? Math.min(gia, T.isaAnnualAllowance) : 0; gia -= mA; isaA += mA;
        const mB = aliveB ? Math.min(gia, T.isaAnnualAllowance) : 0; gia -= mB; isaB += mB;
      }
      // Household investable wealth before this year's draws (the sleeves
      // track the same money, split by asset rather than by wrapper).
      const investStart = potA + potB + isaA + isaB + gia;

      // A partner still working after the household's first stop year:
      // pay is taxed, contributions continue, their pots are left alone.
      // Net-pay contributions come off before tax; relief-at-source ones
      // are paid from net pay and grossed up in the pot.
      const workingA = aliveA && year < X.stopA, workingB = aliveB && year < X.stopB;
      const salaryA = workingA ? num(A.income) * infl : 0, salaryB = workingB ? num(B.income) * infl : 0;
      const contribA = workingA && ageA < 75 ? contribGross(A) : 0;
      const contribB = workingB && ageB < 75 ? contribGross(B) : 0;
      const isaContribA = workingA ? num(A.monthlyIsa) * 12 : 0;
      const isaContribB = workingB ? num(B.monthlyIsa) * 12 : 0;
      const taxablePayA = A.contribGrossUp ? salaryA : clamp0(salaryA - contribA);
      const taxablePayB = B.contribGrossUp ? salaryB : clamp0(salaryB - contribB);
      const payCostA = (A.contribGrossUp ? contribA * 0.8 : 0) + isaContribA;
      const payCostB = (B.contribGrossUp ? contribB * 0.8 : 0) + isaContribB;
      // The pension pots can be drawn from normal minimum pension age, and
      // not by a partner who is still working.
      const canA = aliveA && !workingA && ageA >= X.nmpaA;
      const canB = aliveB && !workingB && ageB >= X.nmpaB;
      const ageRef = aliveA ? ageA : ageB;   // the rules key off the older alive partner

      // Planned annuity review: convert part of A's pot into guaranteed,
      // taxable income for life. Bought at the start of the year.
      if (archOn && AR.annuityOn && !annuityBought && year >= AR.annuityYear && canA) {
        const cost = Math.min(clamp0(AR.annuityAmount) * infl, potA);
        potA -= cost; uncrysA = clamp0(uncrysA - cost);
        annuityToday = (cost * AR.annuityRate) / infl;   // held in today's money
        annuityBought = true;
      }
      const annuityNom = annuityBought && aliveA
        ? annuityToday * (AR.annuityIndexed ? infl : inflFactor(P, AR.annuityYear)) : 0;

      // Guaranteed income per partner, nominal. A scheme pension pays its
      // survivor share to the other partner after a death.
      const dbA = aliveA ? DBA.incomeAt(year) : 0;
      const dbB = aliveB ? DBB.incomeAt(year) : 0;
      const survToB = !aliveA && aliveB ? DBA.survivorAt(year) : 0;
      const survToA = !aliveB && aliveA && couple ? DBB.survivorAt(year) : 0;
      const spA = aliveA && ageA >= X.spAgeA ? num(A.spAmount) * infl : 0;
      const spB = aliveB && ageB >= X.spAgeB ? num(B.spAmount) * infl : 0;

      // Earned income after stopping work (part-time), taxable to the earner.
      let earnedA = 0, earnedB = 0;
      for (const ev of events) {
        if (ev.year !== year || ev.kind !== 'earned') continue;
        const amt = eventNominal(P, ev);
        if ((ev.who === 'B' && aliveB) || !aliveA) earnedB += amt; else earnedA += amt;
      }
      const baseA = dbA + spA + annuityNom + earnedA + taxablePayA + survToA;   // taxable base income
      const baseB = dbB + spB + earnedB + taxablePayB + survToB;
      const taxBaseA = taxOn(baseA, T), taxBaseB = taxOn(baseB, T);
      const guaranteedNet = baseA + baseB - taxBaseA - taxBaseB - payCostA - payCostB;

      // Scheme lump sums first, then any upfront personal tax-free cash, so
      // the lump sum allowance is used in the order the money arrives. The
      // excess over the allowance is taxed as income on top of the base.
      const lumpA = aliveA ? DBA.lumpAt(year) : 0, lumpB = aliveB ? DBB.lumpAt(year) : 0;
      const dbLump = lumpA + lumpB;
      let lumpTax = 0;
      if (lumpA > 0) { const r = lumpAfterLsa(lumpA, pclsUsedA, T.pclsCap); pclsUsedA = r.used; const tx = taxOn(baseA + r.excess, T) - taxBaseA; cash += lumpA - tx; lumpTax += tx; }
      if (lumpB > 0) { const r = lumpAfterLsa(lumpB, pclsUsedB, T.pclsCap); pclsUsedB = r.used; const tx = taxOn(baseB + r.excess, T) - taxBaseB; cash += lumpB - tx; lumpTax += tx; }
      // Upfront: crystallise everything, take the tax-free cash within the
      // allowance; up to the ISA allowance goes into the ISA at once and the
      // rest waits in the general account, fed in each year ("bed and ISA").
      let tfcUpA = 0, tfcUpB = 0;
      if (upfrontA && canA) {
        upfrontA = false;
        tfcUpA = Math.min(uncrysA * rateA, clamp0(T.pclsCap - pclsUsedA));
        const inIsa = Math.min(tfcUpA, T.isaAnnualAllowance);
        potA -= tfcUpA; isaA += inIsa; gia += tfcUpA - inIsa; pclsUsedA += tfcUpA; uncrysA = 0;
      }
      if (upfrontB && canB) {
        upfrontB = false;
        tfcUpB = Math.min(uncrysB * rateB, clamp0(T.pclsCap - pclsUsedB));
        const inIsa = Math.min(tfcUpB, T.isaAnnualAllowance);
        potB -= tfcUpB; isaB += inIsa; gia += tfcUpB - inIsa; pclsUsedB += tfcUpB; uncrysB = 0;
      }

      // This year's net need. After a death the survivor needs less (one
      // State Pension, one allowance, one set of costs). The mechanical
      // rules scale it by a multiplier that only moves on a funded-ratio
      // trigger (see end of loop).
      const survivorFactor = couple && aliveA !== aliveB ? X.survivorSpend : 1;
      const planTarget = targetForYear(P, year) * survivorFactor;
      const target = planTarget * spendMult;
      let eventCost = 0, eventIncome = 0, eventInvested = 0;
      // Care: a late-life cost block, funded like any other spending.
      let careCost = 0;
      if (archOn && AR.careOn && ageRef >= AR.careFromAge && ageRef < AR.careFromAge + AR.careYears) {
        careCost = clamp0(AR.careAnnual) * infl;
        eventCost += careCost;
        eventLabels.push('care');
      }
      for (const ev of events) {
        if (ev.year !== year) continue;
        const amt = eventNominal(P, ev);
        eventLabels.push(ev.label || ev.kind);
        if (ev.kind === 'earned') continue;   // already in the taxable base
        if (ev.kind === 'cost') eventCost += amt;
        else if (ev.invest) eventInvested += amt;
        else eventIncome += amt;
      }
      // Guaranteed income beyond the year's need is banked, never lost.
      const gap = target + eventCost - eventIncome - guaranteedNet;
      const need = clamp0(gap);
      const banked = clamp0(-gap);
      cash += banked;

      // Funding, through the shared routine
      const S = { potA, potB, isaA, isaB, cash, gia, uncrysA, uncrysB, pclsUsedA, pclsUsedB, rateA, rateB, canA, canB };
      const F = fundYear(S, P, T, need, baseA, baseB);
      ({ potA, potB, isaA, isaB, cash, gia, uncrysA, uncrysB, pclsUsedA, pclsUsedB } = S);
      const { grossA, grossB, tfcA, tfcB, isaDraw, isaDrawA, isaDrawB, cashDraw, giaDraw } = F;
      const shortfall = clamp0(need - F.served);

      const taxA = taxOn(baseA + grossA, T);
      const taxB = taxOn(baseB + grossB, T);
      const totalTax = taxA + taxB + lumpTax;
      lifetimeTax += totalTax;
      lifetimeTaxReal += totalTax / infl;
      // Net income available this year. Lump sums arrive in cash net of
      // their own tax, so only the income tax is deducted here.
      const netIncome = baseA + baseB + grossA + grossB + tfcA + tfcB - taxA - taxB
        + isaDraw + cashDraw + giaDraw + eventIncome - payCostA - payCostB;
      if (shortfall > 1) {
        shortfallTotal += shortfall; shortfallTotalReal += shortfall / infl;
        if (shortfallYear == null) shortfallYear = year;
      }

      // What the year actually paid for, in today's money. A year trimmed
      // by the rules counts as reduced spending, exactly like a year the
      // pots could not fund; otherwise a strategy that cuts spending would
      // score as a "success" for cutting it.
      const deliveredReal = clamp0(target - shortfall) / infl;
      const planReal = planTarget / infl;
      const ratio = planReal > 1 ? deliveredReal / planReal : 1;
      st.spend += deliveredReal; st.years++;
      if (ratio < st.worstRatio) st.worstRatio = ratio;
      if (ratio < 0.99) { st.leanYears++; st.okFull = false; }
      const cu = Math.max(SPEND_FLOOR, deliveredReal);
      st.utilSum += gamma === 1 ? Math.log(cu) : Math.pow(cu, 1 - gamma) / (1 - gamma);
      st.utilN++;
      if (shortfall > 1) {
        st.okRules = false;
        if (st.failIndex == null) st.failIndex = i;
        const covered = clamp0(target - shortfall) / Math.max(1, target);
        if (covered < st.minCoverage) st.minCoverage = covered;
        st.solvent.push(false);
      } else st.solvent.push(true);

      // Growth. Simple model: one rate. Architecture: the ladder funds the
      // year's draws and earns the gilt rate; only the growth engine takes
      // the market. The blended household return is then applied to each
      // wrapper, so tax accounting is untouched and totals reconcile.
      const R = ret(i, year);
      let gYear = R.r;
      let ladderNow = 0, engineNow = 0;
      if (archOn) {
        const investAfter = potA + potB + isaA + isaB + gia;
        const drawn = clamp0(investStart - investAfter);
        const tgt = ladderTarget(AR, need, P.inflation);
        if (!sleeve) {
          const L = Math.min(investStart, tgt);
          sleeve = { ladder: L, growth: clamp0(investStart - L) };
        } else {
          // Resync to the wrappers (windfalls and rounding land there).
          const tot = sleeve.ladder + sleeve.growth;
          const k = tot > 1 ? investStart / tot : 1;
          sleeve = { ladder: sleeve.ladder * k, growth: sleeve.growth * k };
        }
        const next = sleeveYear(sleeve, drawn, R.rGrowth, R.rGilt, tgt, AR);
        sleeve = { ladder: next.ladder, growth: next.growth };
        ladderNow = next.ladder; engineNow = next.growth;
        gYear = investAfter > 1 ? (next.total / investAfter) - 1 : 0;
      }
      potA = clamp0(potA * (1 + gYear)); potB = clamp0(potB * (1 + gYear));
      uncrysA = clamp0(uncrysA * (1 + gYear)); uncrysB = clamp0(uncrysB * (1 + gYear));
      isaA = clamp0(isaA * (1 + gYear)); isaB = clamp0(isaB * (1 + gYear));
      gia = clamp0(gia * (1 + gYear));
      cash = clamp0(cash * (1 + num(P.cashGrowth)));   // cash grows at its own fixed rate
      // Mid-year money: invested windfalls and this year's contributions
      // earn half a year of growth.
      const half = 1 + gYear / 2;
      if (eventInvested > 0) { if (aliveA) isaA += eventInvested * half; else isaB += eventInvested * half; }
      if (contribA > 0) { potA += contribA * half; uncrysA += contribA * half; }
      if (contribB > 0) { potB += contribB * half; uncrysB += contribB * half; }
      if (isaContribA > 0) isaA += isaContribA * half;
      if (isaContribB > 0) isaB += isaContribB * half;

      let wealth = potA + potB + isaA + isaB + cash + gia;

      // The written rules: measure the funded ratio, then act on it.
      let ratioF = null, ruleMove = null;
      if (archOn && AR.rulesOn) {
        ratioF = fundedRatio(AR, {
          wealthReal: wealth / infl,
          spendReal: target / infl,
          guaranteedNetReal: guaranteedNet / infl,
          ageA: ageRef,
        });
        if (ratioF < AR.cutBelow) {
          const nextM = Math.max(AR.floorMult, spendMult * (1 - AR.cutBy));
          if (nextM < spendMult - 1e-9) ruleMove = 'cut';
          spendMult = nextM; raiseStreak = 0;
        } else if (ratioF > AR.raiseAbove) {
          // A lag on the upward "treat" rule, so one good year cannot raise it.
          raiseStreak++;
          if (raiseStreak >= AR.raiseLagYears) {
            const nextM = Math.min(AR.capMult, spendMult * (1 + AR.raiseBy));
            if (nextM > spendMult + 1e-9) ruleMove = 'raise';
            spendMult = nextM; raiseStreak = 0;
          }
        } else raiseStreak = 0;
        lastRatio = ratioF;

        // The house is a parachute, not core funding: released once, late,
        // and only if the plan is genuinely off track.
        if (AR.parachuteOn && !parachuteUsed && ageRef >= AR.parachuteFrom && ratioF < AR.parachuteBelow) {
          const houseVal = num(P.house) * Math.pow(1 + num(P.houseGrowth), year - P.startYear);
          const release = clamp0(houseVal * AR.parachuteFraction);
          if (release > 0) {
            cash += release; wealth += release;
            parachuteUsed = true; parachuteYear = year;
            eventLabels.push('house released');
          }
        }
      }
      if (exhaustedYear == null && wealth < 100 && shortfall > 1) exhaustedYear = year;
      if (track) track.push(wealth);

      if (rows) rows.push({
        year, ageA, ageB, aliveA, aliveB,
        dbA: dbA + survToA, dbB: dbB + survToB, spA, spB,
        guaranteed: baseA + baseB,
        salaryA, salaryB, contribA, contribB,
        grossA, grossB, tfcA: tfcA + tfcUpA, tfcB: tfcB + tfcUpB, tfcUpfront: tfcUpA + tfcUpB,
        taxA, taxB, tax: totalTax,
        isaDraw, isaDrawA, isaDrawB, cashDraw, giaDraw, dbLump, lumpTax, earnedA, earnedB,
        eventCost, eventInflow: eventIncome + eventInvested, eventLabels, inherited,
        target, planTarget, netIncome, banked, shortfall,
        potA, potB, isaA, isaB, cash, gia, wealth,
        marginalA: marginalRate(baseA + grossA, T),
        marginalB: marginalRate(baseB + grossB, T),
        personalAllowance: T.personalAllowance,
        // Architecture (null / 0 when the overlay is off)
        fundedRatio: ratioF, spendMult, ruleMove,
        ladder: ladderNow, engine: engineNow,
        careCost, annuity: annuityNom, blendedGrowth: gYear,
      });
    }
    return {
      rows, track, st,
      lifetimeTax, lifetimeTaxReal,
      exhaustedYear, shortfallYear, shortfallTotal, shortfallTotalReal, inheritedTotal,
      endWealth: potA + potB + isaA + isaB + cash + gia,
      endPots: { potA, potB, isaA, isaB, cash, gia },
      architecture: archOn ? {
        on: true, spendMultFinal: spendMult, fundedRatioFinal: lastRatio,
        annuityIncomeToday: annuityToday, parachuteYear,
        ladderFinal: sleeve ? sleeve.ladder : 0, engineFinal: sleeve ? sleeve.growth : 0,
      } : { on: false },
    };
  }

  // ── Drawdown: retirement to horizon, year by year ─────────────────────
  // Income layering as the workbook: DB, then each state pension as it
  // activates, then pension draws for the shortfall, ISA for any remainder.
  // Pension draws are allocated across the couple by marginal rate, so free
  // personal allowance is always used before anyone pays basic rate, and
  // both basic bands are used before anyone pays higher rate.
  function drawdown(P, opts) {
    opts = opts || {};
    const X = prepare(P);
    P = X.P;
    const g = opts.growth == null ? P.growth : opts.growth;
    const fee = X.fee;
    const acc = opts.startPots || accumulate(P, g).atRetirement;
    const RATES = sleeveRates(X.AR, P, X.archOn ? (g - P.growthBase) : 0);
    // A named sequence of real returns replayed from the year work stops
    // (stress tests on a plain plan; the architecture has its own path).
    const path = !X.archOn && opts.returnPath ? opts.returnPath : null;
    const eq = equityShareOf(P);
    const ret = (i) => {
      let r = g - fee;
      if (path && i < path.length) r = (1 + blendReal(path[i], eq)) * (1 + P.inflation) - 1 - fee;
      let rGrowth = RATES.growth - fee;
      if (X.archOn && X.stress && i < X.stress.length) rGrowth = (1 + X.stress[i]) * (1 + P.inflation) - 1 - fee;
      return { r, rGrowth, rGilt: RATES.gilt - fee };
    };
    const out = runPath(X, acc, ret, 'rows');
    const ageA = (y) => y == null ? null : y - P.partnerA.birthYear;
    return {
      rows: out.rows, lifetimeTax: out.lifetimeTax, lifetimeTaxReal: out.lifetimeTaxReal,
      exhaustedYear: out.exhaustedYear, exhaustedAgeA: ageA(out.exhaustedYear),
      shortfallYear: out.shortfallYear, shortfallAgeA: ageA(out.shortfallYear),
      shortfallTotal: out.shortfallTotal, shortfallTotalReal: out.shortfallTotalReal,
      inheritedTotal: out.inheritedTotal,
      endWealth: out.endWealth, endPots: out.endPots,
      startPots: acc,
      architecture: out.architecture,
    };
  }
  // ── Strategy comparison (the Tax Optimisation tab) ────────────────────
  function compareStrategies(P) {
    const out = [];
    for (const s of [
      { id: 'sippfirst', label: 'Pensions to basic rate, ISA for excess' },
      { id: 'pafirst', label: 'Pensions to free allowances only, then ISA' },
      { id: 'isafirst', label: 'ISA first, defer pensions' },
    ]) {
      const Q = { ...P, strategy: s.id };
      const r = drawdown(Q);
      out.push({
        id: s.id, label: s.label,
        // Today's money, the same figure the rest of the app shows.
        lifetimeTax: r.lifetimeTaxReal,
        lifetimeTaxNominal: r.lifetimeTax,
        endWealth: r.endWealth,
        exhaustedAgeA: r.exhaustedAgeA,
      });
    }
    return out;
  }

  // ── Stress tests. Comparisons are in today's money so scenarios with
  //    different inflation assumptions stay comparable. ─────────────────
  function stressTests(P) {
    const horizonYear = planEndYear(P);
    const realEnd = (Q, r) => r.endWealth / Math.pow(1 + Q.inflation, horizonYear - Q.startYear);
    const base = drawdown(P);
    const baseReal = realEnd(P, base);
    const tests = [];
    const run = (label, note, mutate, startPotsFn, extraOpts) => {
      const Q = JSON.parse(JSON.stringify(P));
      if (mutate) mutate(Q);
      const o = { ...(extraOpts || {}) };
      if (startPotsFn) o.startPots = startPotsFn(Q);
      const r = drawdown(Q, Object.keys(o).length ? o : undefined);
      const real = realEnd(Q, r);
      tests.push({
        label, note,
        endWealthReal: real,
        delta: real - baseReal,
        exhaustedAgeA: r.exhaustedAgeA,
        holds: r.exhaustedAgeA == null,
      });
    };
    // Sequence-of-returns risk made concrete: approximate historic real-return
    // paths replayed from the year work stops. A plan with the architecture
    // overlay replays them through its own sleeves; a plain plan through its
    // single blended pot.
    const seq = (label, note, key) => {
      const arch = !!archOf(P).on;
      run(label, note,
        arch ? (Q) => { Q.architecture = { ...Q.architecture, stressPath: key }; } : null,
        null, arch ? null : { returnPath: STRESS_PATHS[key] });
    };
    seq('2008 strikes the day you stop', 'A 37% fall in year one, then the recovery that followed (2008–2017 shape)', 'gfc');
    seq('A Japan-style lost two decades', 'Twenty years of mostly falling markets from the day you stop (1990–2009 shape)', 'japan');
    seq('1970s stagflation', 'Three savage real-terms years, a rebound, then grinding inflation (1972–1979 shape)', 'stagflation');
    seq('A 30% fall, then five flat years', 'The crash without the bounce: markets drop as you stop and go nowhere for five years', 'crashflat');
    run('Growth 2% below base', 'Sustained lower returns through both phases',
      (Q) => { Q.growth = P.growth - 0.02; });
    run('Growth at bear rate', 'The workbook bear scenario',
      (Q) => { Q.growth = P.growthBear; });
    run('Retire two years earlier', 'Two fewer years of growth and contributions',
      (Q) => { shiftRetirement(Q, -2); });
    run('Retire two years later', 'Two more years of growth and contributions',
      (Q) => { shiftRetirement(Q, 2); });
    run('No monthly contributions', 'Impact of stopping all saving today', (Q) => {
      Q.partnerA.monthlyPension = 0; Q.partnerA.monthlyIsa = 0;
      Q.partnerB.monthlyPension = 0; Q.partnerB.monthlyIsa = 0;
    });
    run('Inflation at 4%', 'Spending and state pensions inflate faster; compared in today\'s money',
      (Q) => { Q.inflation = 0.04; });
    run('Market crash, minus 30% at retirement', 'Sequence of returns risk made concrete',
      null,
      (Q) => {
        const acc = accumulate(Q).atRetirement;
        return {
          ...acc,
          pensionA: acc.pensionA * 0.7, pensionB: acc.pensionB * 0.7,
          isaA: acc.isaA * 0.7, isaB: acc.isaB * 0.7,
        };
      });
    const holds = tests.filter(t => t.holds).length;
    const worst = tests.filter(t => !t.holds).sort((a, b) => (a.exhaustedAgeA || 999) - (b.exhaustedAgeA || 999))[0] || null;
    return { base, baseReal, baseHolds: base.exhaustedAgeA == null, tests,
      summary: { total: tests.length, holds, fails: tests.length - holds, worst } };
  }

  // ── What moves the needle: the levers, ranked ──────────────────────────
  // Decision support rather than forecasting: each candidate action is run
  // through the deterministic plan AND the same seeded Monte Carlo, so the
  // gain is measured in the two currencies that matter — how often the plan
  // holds, and what is left — never asserted.
  function levers(P, opts) {
    opts = opts || {};
    const paths = opts.paths || 200;
    const seed = P.mcSeed || 42;
    const horizonYear = planEndYear(P);
    const real = (Q, r) => r.endWealth / Math.pow(1 + Q.inflation, horizonYear - Q.startYear);
    const measure = (Q) => {
      const dd = drawdown(Q);
      let conf = null;
      try { conf = runMonteCarlo(Q, paths, seed).successProb; } catch (e) { conf = null; }
      return { conf, end: real(Q, dd), exhaustedAgeA: dd.exhaustedAgeA, tax: dd.lifetimeTaxReal != null ? dd.lifetimeTaxReal : dd.lifetimeTax };
    };
    const base = measure(P);
    const out = [];
    const cand = (id, label, detail, mutate, applicable) => {
      if (applicable === false) return;
      const Q = JSON.parse(JSON.stringify(P));
      mutate(Q);
      const m = measure(Q);
      out.push({ id, label, detail, patch: Q,
        conf: m.conf, dConf: m.conf != null && base.conf != null ? m.conf - base.conf : 0,
        end: m.end, dEnd: m.end - base.end, dTax: m.tax - base.tax, exhaustedAgeA: m.exhaustedAgeA });
    };
    const yearsToGo = P.retireYear - P.startYear;
    cand('later1', 'Stop work one year later', 'One more year of growth and saving, one fewer to fund.',
      (Q) => { shiftRetirement(Q, 1); });
    cand('spend3k', 'Spend £3,000 a year less', 'A little under £60 a week, for the whole retirement.',
      (Q) => { Q.targetNet = Math.max(10000, spendingAnnual(Q) - 3000); Q.spendingPlanOn = false; });
    cand('save250', 'Save £250 a month more until you stop', 'Into the pension, with growth on top.',
      (Q) => { Q.partnerA.monthlyPension += 250; }, yearsToGo >= 1);
    cand('parttime', 'Two years of part-time work after stopping, £10,000 a year', 'Taxed as earnings; bridges the early years so the pots keep growing.',
      (Q) => { Q.lifeEvents = [...(Q.lifeEvents || []),
        { year: Q.retireYear, label: 'Part-time work', amount: 10000, kind: 'earned', who: 'A' },
        { year: Q.retireYear + 1, label: 'Part-time work', amount: 10000, kind: 'earned', who: 'A' }]; });
    cand('ease75', 'Ease spending by 10% from 75', 'The go-go / slow-go pattern most retirements actually follow.',
      (Q) => { Q.phase1On = true; Q.phase1Age = 75; Q.phase1Cut = 0.10; }, !P.phase1On);
    cand('phased', 'Take tax-free cash a little each year', 'A quarter of each draw tax-free lowers every year’s tax.',
      (Q) => { Q.pclsMode = 'phased'; }, P.pclsMode !== 'phased');
    let best = null;
    try {
      const strat = compareStrategies(P);
      best = [...strat].sort((a, b) => a.lifetimeTax - b.lifetimeTax)[0];
    } catch (e) { best = null; }
    cand('order', best ? `Draw in the cheapest order: ${best.label}` : 'Cheapest withdrawal order', 'Same spending, less lifetime tax.',
      (Q) => { Q.strategy = best.id; }, !!best && best.id !== P.strategy);
    for (const key of ['partnerA', 'partnerB']) {
      const who = P[key];
      for (const t of (who.dbSchemes || [])) {
        if (!t || !(Number(t.pension) > 0)) continue;
        const b = trancheBenefits(P, who, t);
        if (b.early > 0 && b.npa <= P.horizonAge - 5) {
          cand('npa:' + t.id, `${who.name}: take the ${b.label} at ${b.npa}, not ${b.takeAge}`,
            `Avoids the ${Math.round((1 - b.factor) * 100)}% early-retirement reduction, for life.`,
            (Q) => { Q[key].dbSchemes = Q[key].dbSchemes.map(x => x.id === t.id ? { ...x, takeAge: b.npa } : x); });
        }
      }
    }
    out.sort((a, b) => (b.dConf - a.dConf) || (b.dEnd - a.dEnd));
    return { base, levers: out, paths };
  }

  // ── Is the structure worth it? ───────────────────────────────────────
  // Survival alone cannot answer this: a rule that trims spending scores as
  // a "success" precisely for cutting what you live on. So both plans are
  // judged on the spending they actually deliver, priced with a standard
  // risk-averse utility, and the legacy difference is reported alongside
  // rather than hidden inside one score.
  function assessStructure(P, opts) {
    opts = opts || {};
    const n = opts.paths || 500;
    const wantDrivers = opts.drivers !== false;
    const seed = P.mcSeed || 42;                 // same seed both sides: same markets
    const AR = archOf(P);
    const on = runMonteCarlo({ ...P, architecture: { ...AR, on: true } }, n, seed);
    const off = runMonteCarlo({ ...P, architecture: { ...AR, on: false } }, n, seed);

    const planTargetReal = P.targetNet;
    const ceGain = on.ceSpend - off.ceSpend;
    const ceGainPct = planTargetReal > 0 ? ceGain / planTargetReal : 0;
    const legacyDelta = on.legacyP50Real - off.legacyP50Real;

    const mag = Math.abs(ceGainPct);
    const verdict = ceGain <= 0 ? 'against' : mag >= 0.05 ? 'clear' : mag >= 0.015 ? 'modest' : 'marginal';

    // Which part of the structure did the work? Same seed, one piece removed.
    const piece = (patch) => runMonteCarlo({ ...P, architecture: { ...AR, on: true, ...patch } }, n, seed).ceSpend;
    const drivers = wantDrivers ? [
      { key: 'rules', label: 'Written spending rules', worth: on.ceSpend - piece({ rulesOn: false }) },
      { key: 'ladder', label: 'The gilt ladder', worth: on.ceSpend - piece({ ladderYears: 0 }) },
    ].sort((a, b) => b.worth - a.worth) : [];

    return {
      paths: n, riskAversion: on.riskAversion,
      on, off, ceGain, ceGainPct, legacyDelta, verdict, drivers,
      planTargetReal,
    };
  }

  // ── Architecture comparison: does the structure actually earn its keep? ─
  // Runs the same plan four ways so the UI never has to assert a benefit it
  // has not measured: no structure, structure, structure without the ladder,
  // structure without the written rules — plus the deterministic stress paths.
  function compareArchitecture(P, paths) {
    const n = paths || 400;
    const AR = archOf(P);
    const withArch = (patch) => ({ ...P, architecture: { ...AR, on: true, ...(patch || {}) } });
    const simple = { ...P, architecture: { ...AR, on: false } };

    const run = (Q, label) => {
      const dd = drawdown({ ...Q, growth: Q.growthBase });
      let mc = null;
      try { mc = runMonteCarlo(Q, n, Q.mcSeed || 42); } catch { mc = null; }
      return {
        label,
        endWealth: dd.endWealth,
        endWealthReal: dd.endWealth / inflFactor(Q, planEndYear(Q)),
        exhaustedAgeA: dd.exhaustedAgeA,
        lifetimeTaxReal: dd.lifetimeTaxReal,
        successProb: mc ? mc.successProb : null,
        worstSpendMult: mc ? mc.worstSpendMult : 1,
        medianSpendMult: mc ? mc.medianSpendMult : 1,
      };
    };

    const variants = [
      run(simple, 'No structure'),
      run(withArch(), 'Full architecture'),
      run(withArch({ ladderYears: 0 }), 'Without the ladder'),
      run(withArch({ rulesOn: false }), 'Without the rules'),
    ];

    // Deterministic bad-sequence tests, in today's money at the horizon.
    const stress = ['japan', 'gfc', 'stagflation'].map(key => {
      const a = drawdown({ ...withArch({ stressPath: key }), growth: P.growthBase });
      const b = drawdown({ ...simple, growth: P.growthBase, architecture: { ...AR, on: true, ladderYears: 0, rulesOn: false, stressPath: key } });
      const f = inflFactor(P, planEndYear(P));
      return {
        key,
        label: key === 'japan' ? 'Japan 1990 (lost decades)'
          : key === 'gfc' ? 'Global financial crisis 2008' : 'Stagflation 1972',
        withArch: { endReal: a.endWealth / f, exhaustedAgeA: a.exhaustedAgeA, spendMult: a.architecture.spendMultFinal },
        without: { endReal: b.endWealth / f, exhaustedAgeA: b.exhaustedAgeA },
      };
    });
    return { variants, stress };
  }

  // ── Sensitivity grid: withdrawal level x growth rate ─────────────────
  function sensitivityGrid(P, withdrawals, growths) {
    withdrawals = withdrawals || [30000, 40000, 50000, 60000, 70000, 80000, 100000];
    growths = growths || [0.04, 0.05, 0.06, 0.07, 0.10];
    const grid = [];
    for (const w of withdrawals) {
      const row = { withdrawal: w, cells: [] };
      for (const g of growths) {
        const Q = JSON.parse(JSON.stringify(P));
        Q.targetNet = w; Q.spendingPlanOn = false; Q.growth = g;
        Q.horizonAge = 100;
        const r = drawdown(Q);
        row.cells.push({
          growth: g,
          exhaustedAgeA: r.exhaustedAgeA,   // null means survives to 100
        });
      }
      grid.push(row);
    }
    return { withdrawals, growths, grid };
  }

  // ── Tornado sensitivity: which assumption moves wealth at horizon most ─
  function tornado(P) {
    const horizonYear = planEndYear(P);
    const real = (Q, r) => r.endWealth / Math.pow(1 + Q.inflation, horizonYear - Q.startYear);
    const base = real(P, drawdown(P));
    const bars = [];
    const probe = (label, up, down) => {
      const QU = JSON.parse(JSON.stringify(P)); up(QU);
      const QD = JSON.parse(JSON.stringify(P)); down(QD);
      bars.push({
        label,
        up: real(QU, drawdown(QU)) - base,
        down: real(QD, drawdown(QD)) - base,
      });
    };
    probe('Growth +1% / -1%',
      (Q) => { Q.growth += 0.01; }, (Q) => { Q.growth -= 0.01; });
    probe('Inflation -1% / +1%',
      (Q) => { Q.inflation = Math.max(0, Q.inflation - 0.01); },
      (Q) => { Q.inflation += 0.01; });
    probe('Spending -10% / +10%',
      (Q) => { Q.targetNet *= 0.9; Q.spending.forEach(s => s.monthly *= 0.9); },
      (Q) => { Q.targetNet *= 1.1; Q.spending.forEach(s => s.monthly *= 1.1); });
    probe('Retire 2 later / 2 earlier',
      (Q) => { shiftRetirement(Q, 2); }, (Q) => { shiftRetirement(Q, -2); });
    probe('Pots today +10% / -10%',
      (Q) => { Q.partnerA.pension *= 1.1; Q.partnerB.pension *= 1.1; Q.partnerA.isa *= 1.1; Q.partnerB.isa *= 1.1; },
      (Q) => { Q.partnerA.pension *= 0.9; Q.partnerB.pension *= 0.9; Q.partnerA.isa *= 0.9; Q.partnerB.isa *= 0.9; });
    probe('State pensions +10% / -10%',
      (Q) => { Q.partnerA.spAmount *= 1.1; Q.partnerB.spAmount *= 1.1; },
      (Q) => { Q.partnerA.spAmount *= 0.9; Q.partnerB.spAmount *= 0.9; });
    bars.sort((a, b) => Math.max(Math.abs(b.up), Math.abs(b.down)) - Math.max(Math.abs(a.up), Math.abs(a.down)));
    return { base, bars };
  }

  // ── Lifetime totals: exact aggregates for the provenance card ─────────
  function lifetimeTotals(P) {
    const dd = drawdown(P);
    const acc = dd.startPots;
    let spend = 0, tax = 0, grossDraws = 0, tfc = 0, guaranteed = 0, isaDraws = 0;
    for (const r of dd.rows) {
      spend += r.netIncome;
      tax += r.tax;
      grossDraws += r.grossA + r.grossB;
      tfc += r.tfcA + r.tfcB;
      guaranteed += r.guaranteed;
      isaDraws += r.isaDraw + r.cashDraw + (r.giaDraw || 0);
    }
    const startWealth = acc.pensionA + acc.pensionB + acc.isaA + acc.isaB + (acc.cash || 0) + (acc.gia || 0);
    // Growth earned during retirement, exact by conservation:
    // end = start + inflows(events invested) - outflows + growth
    let invested = 0;
    for (const ev of effectiveEvents(P)) {
      if (ev.year >= P.retireYear && ev.kind !== 'cost' && ev.invest) invested += eventNominal(P, ev);
    }
    const outflows = grossDraws + tfc + isaDraws;
    const growth = dd.endWealth - startWealth - invested + outflows;
    return {
      spend, tax, grossDraws, tfc, guaranteed, isaDraws,
      startWealth, endWealth: dd.endWealth, growthInRetirement: growth,
      taxPer100Drawn: grossDraws + tfc > 0 ? tax / (grossDraws + tfc) * 100 : 0,
    };
  }

  // ── Estate and IHT ────────────────────────────────────────────────────
  function estate(P, atYear) {
    const dd = drawdown(P);
    const year = atYear || (planEndYear(P));
    const row = dd.rows.find(r => r.year === year) || dd.rows[dd.rows.length - 1];
    const yearsOn = year - P.startYear;
    const house = P.house * Math.pow(1 + P.houseGrowth, yearsOn);
    const pensions = row ? row.potA + row.potB : 0;
    const isas = row ? row.isaA + row.isaB + row.cash + (row.gia || 0) : 0;
    const pensionsIn = P.iht.includePensions && year >= P.iht.pensionsInEstateFrom;
    const inScope = house + isas + (pensionsIn ? pensions : 0);
    // Residence nil-rate band tapers £1 per £2 of estate above £2m
    const persons = !isSingle(P) && P.iht.couple ? 2 : 1;
    const rnrbTaperStart = 2000000;
    // The residence band only exists with a home, and never exceeds its value.
    const rnrbFull = Math.min(P.iht.residenceNRB * persons, clamp0(house));
    const rnrb = clamp0(rnrbFull - clamp0(inScope - rnrbTaperStart) / 2);
    const nrb = P.iht.nilRateBand * persons + rnrb;
    const taxable = clamp0(inScope - nrb);
    const iht = taxable * P.iht.rate;
    return {
      year, house, pensions, isas,
      pensionsIn, inScope, nrb, rnrb, rnrbFull, taxable, iht,
      netToHeirs: inScope - iht + (pensionsIn ? 0 : pensions),
    };
  }

  // ── Mortality ────────────────────────────────────────────────────────
  // A Gompertz hazard, unisex, fitted to round out the ONS 2020 to 2022
  // tables with a modest improvement: about 0.9% at 65, 2.5% at 75, 7.5% at
  // 85, 21% at 95. Used only to weight the Monte Carlo by how likely the
  // household is still here, never to end the plan.
  const MORTALITY = { a: 9.8e-6, b: 0.105 };
  const hazardAt = (age) => Math.min(0.6, MORTALITY.a * Math.exp(MORTALITY.b * age));
  // Survival curve from a starting age: S[i] is the chance of being alive at
  // the start of year i. A partner with a chosen death age is deterministic;
  // an absent partner is never alive.
  function survivalCurve(who, startYear, nYears) {
    const S = new Array(nYears + 1).fill(0);
    if (who.absent) return S;
    const d = deathAgeOf(who);
    const a0 = startYear - who.birthYear;
    let h = 0;
    for (let i = 0; i <= nYears; i++) {
      if (d != null) S[i] = a0 + i <= d ? 1 : 0;
      else { S[i] = Math.exp(-h); h += hazardAt(a0 + i); }
    }
    return S;
  }
  // Household: at least one partner alive. Returns the chance the household
  // is still here at the start of each year, and the chance it ends in each.
  function householdSurvival(X) {
    const nYears = X.endYear - X.P.retireYear + 1;
    const SA = survivalCurve(X.A, X.P.retireYear, nYears);
    const SB = X.single ? new Array(nYears + 1).fill(0) : survivalCurve(X.B, X.P.retireYear, nYears);
    const H = SA.map((s, i) => 1 - (1 - s) * (1 - SB[i]));
    const endsIn = H.slice(0, nYears).map((h, i) => clamp0(h - H[i + 1]));
    let expected = 0;
    for (let i = 0; i < nYears; i++) expected += (i + 0.5) * endsIn[i];
    expected += nYears * H[nYears];
    return { alive: H, endsIn, beyond: H[nYears], expectedYears: expected };
  }

  // ── Monte Carlo on the whole plan ────────────────────────────────────
  // Every path runs the same year-by-year routine as the plan (runPath),
  // from today: returns are random through the saving years as well as the
  // spending years, so the pot at retirement is itself uncertain.
  function mulberry32(seed) {
    let s = seed >>> 0;
    return function () {
      s = (s + 0x6D2B79F5) | 0;
      let t = Math.imul(s ^ (s >>> 15), 1 | s);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // The arithmetic mean that makes the MEDIAN simulated path compound at
  // the lens rate: a normal return with standard deviation s compounds at
  // about s squared over two below its arithmetic mean.
  const mcMeanFor = (g, sd) => g + sd * sd / 2;

  function runMonteCarlo(P, nPaths, seed) {
    const X = prepare(P);
    P = X.P;
    nPaths = nPaths || P.mcPaths || 1000;
    const rand = mulberry32(seed == null ? (P.mcSeed || 42) : seed);
    const AR = X.AR, archOn = X.archOn, fee = X.fee;
    const g = num(P.growth, 0.05);
    const sd = Math.max(0, num(P.mcSd));
    const mcMean = mcMeanFor(g, sd);
    // The growth lens shifts the sleeves with it, so "Poor" markets mean
    // poorer simulated futures for the structure too.
    const lensShift = g - num(P.growthBase, g);
    const RATES = sleeveRates(AR, P, archOn ? lensShift : 0);
    const eqNomMean = (1 + AR.equityReal + (archOn ? lensShift : 0)) * (1 + P.inflation) - 1;
    const goldNomMean = (1 + AR.goldReal + (archOn ? lensShift : 0)) * (1 + P.inflation) - 1;
    const endYear = X.endYear;
    const nYears = endYear - P.retireYear + 1;
    const preYears = Math.max(0, P.retireYear - P.startYear);
    const stochasticPre = P.mcPreRetirement !== false && sd > 0 && preYears > 0;
    const acc0 = accumulate(P, g).atRetirement;

    const normalPair = () => {
      const u1 = Math.max(rand(), 1e-12), u2 = rand();
      const m = Math.sqrt(-2 * Math.log(u1));
      return [m * Math.cos(2 * Math.PI * u2), m * Math.sin(2 * Math.PI * u2)];
    };

    const solventAt = new Array(nYears).fill(0);
    const tracks = [], finals = [], trims = [], spendMults = [];
    const avgSpends = [], worstRatios = [], leanShares = [], potsAtRet = [];
    let okFull = 0, okRules = 0, utilSum = 0, utilN = 0;
    const H = householdSurvival(X);
    let lifeSuccess = 0;

    for (let p = 0; p < nPaths; p++) {
      let acc = acc0;
      if (stochasticPre) {
        const pre = new Array(preYears);
        for (let k = 0; k < preYears; k++) pre[k] = mcMean + sd * normalPair()[0];
        acc = accumulate(P, g, { returnAt: (y) => pre[y - P.startYear] }).atRetirement;
      }
      potsAtRet.push(acc.pensionA + acc.pensionB + acc.isaA + acc.isaB + (acc.cash || 0));
      const ret = () => {
        const [z, z2] = normalPair();
        const r = mcMean + sd * z - fee;
        if (!archOn) return { r, rGrowth: r, rGilt: RATES.gilt - fee };
        // Equity and gold drawn from the same pair of normals, so the
        // structure sees the same market as the plain plan; index-linked
        // gilts held to maturity are treated as known in real terms.
        const rEq = eqNomMean + AR.equitySd * z;
        const rGold = goldNomMean + AR.goldSd * z2;
        return { r, rGrowth: rEq * (1 - AR.goldPct) + rGold * AR.goldPct - fee, rGilt: RATES.gilt - fee };
      };
      const out = runPath(X, acc, ret, p < 60 ? 'track' : 'lite');
      const st = out.st;
      for (let i = 0; i < nYears; i++) if (st.solvent[i]) solventAt[i]++;
      if (st.okFull) okFull++;
      if (st.okRules) okRules++;
      else trims.push(1 - st.minCoverage);
      // Mortality-weighted: the plan succeeds if the household's last year
      // comes before the first year it falls short.
      lifeSuccess += st.failIndex == null ? 1 : 1 - H.alive[st.failIndex];
      utilSum += st.utilSum; utilN += st.utilN;
      avgSpends.push(st.years ? st.spend / st.years : 0);
      worstRatios.push(st.worstRatio);
      leanShares.push(st.years ? st.leanYears / st.years : 0);
      spendMults.push(out.architecture.on ? out.architecture.spendMultFinal : 1);
      finals.push(out.endWealth);
      if (out.track) tracks.push(out.track);
    }

    // Confidence age: first age of partner A where per-age solvency drops
    // below the threshold; if it never does, the horizon age itself.
    const threshold = 0.85;
    let confidenceAge = P.horizonAge;
    for (let i = 0; i < nYears; i++) {
      if (solventAt[i] / nPaths < threshold) {
        confidenceAge = P.retireYear + i - P.partnerA.birthYear;
        break;
      }
    }
    finals.sort((x, y) => x - y);
    const pctile = (q) => finals[Math.min(finals.length - 1, Math.floor(q * finals.length))];
    const pct10 = (arr, q) => {
      if (!arr.length) return 0;
      const a = arr.slice().sort((x, y) => x - y);
      return a[Math.min(a.length - 1, Math.floor((q == null ? 0.1 : q) * a.length))];
    };
    trims.sort((x, y) => x - y);
    const successProb = okFull / nPaths;
    const gamma = X.gamma;
    return {
      nPaths, mcMean, mcSd: sd,
      // Share of futures that paid the full planned spending every year.
      successProb,
      // Share that stayed solvent once the written rules had trimmed
      // spending (equal to successProb for a plan without rules).
      successProbWithCuts: okRules / nPaths,
      // Sampling error on successProb, one standard error.
      successSe: Math.sqrt(Math.max(0, successProb * (1 - successProb)) / nPaths),
      // Weighted by how likely the household is still here: the chance the
      // money outlives you, rather than the chance it reaches the horizon.
      successLifetime: lifeSuccess / nPaths,
      pAliveAtHorizon: H.beyond,
      expectedLastAge: P.retireYear + H.expectedYears - P.partnerA.birthYear,
      confidenceAge,
      threshold,
      perAgeSolvency: solventAt.map((c, i) => ({
        age: P.retireYear + i - P.partnerA.birthYear, p: c / nPaths,
      })),
      finalP10: pctile(0.10), finalP50: pctile(0.50), finalP90: pctile(0.90),
      potsAtRetirementP10: pct10(potsAtRet, 0.1), potsAtRetirementP50: pct10(potsAtRet, 0.5), potsAtRetirementP90: pct10(potsAtRet, 0.9),
      medianTrim: trims.length ? trims[Math.floor(trims.length / 2)] : 0,
      tracks,
      // How hard the written rules had to work, across all paths
      medianSpendMult: spendMults.length
        ? spendMults.slice().sort((x, y) => x - y)[Math.floor(spendMults.length / 2)] : 1,
      worstSpendMult: spendMults.length ? Math.min(...spendMults) : 1,

      // ── Outcome measured as spending delivered (today's money) ──
      // ceSpend is the certainty-equivalent: the level, guaranteed every year,
      // that would leave you as well off as this uncertain plan. It is the one
      // number that can honestly compare a plan that trims with a plan that
      // gambles, because it prices both the shortfalls and the trims.
      ceSpend: (() => {
        if (!utilN) return 0;
        const m = utilSum / utilN;
        return gamma === 1 ? Math.exp(m) : Math.pow(m * (1 - gamma), 1 / (1 - gamma));
      })(),
      riskAversion: gamma,
      spendP10: pct10(avgSpends), spendP50: pct10(avgSpends, 0.5), spendP90: pct10(avgSpends, 0.9),
      worstYearRatioP50: pct10(worstRatios, 0.5),
      worstYearRatioP10: pct10(worstRatios, 0.1),
      leanShareP50: pct10(leanShares, 0.5),
      legacyP10Real: pctile(0.10) / inflFactor(P, endYear),
      legacyP50Real: pctile(0.50) / inflFactor(P, endYear),
    };
  }

  // ── Risk presets ─────────────────────────────────────────────────────
  // Nominal gross return lenses, volatility and equity share for three
  // plain-English portfolios. Applying one sets the lens trio and the
  // simulation's spread together, so the two never disagree.
  const RISK_PRESETS = Object.freeze({
    cautious:    { label: 'Cautious',    detail: 'About 40% shares',  growthBear: 0.025, growthBase: 0.045, growthBull: 0.065, mcSd: 0.07, equityShare: 0.4 },
    balanced:    { label: 'Balanced',    detail: 'About 70% shares',  growthBear: 0.04,  growthBase: 0.07,  growthBull: 0.10,  mcSd: 0.12, equityShare: 0.7 },
    adventurous: { label: 'Adventurous', detail: 'All shares',        growthBear: 0.045, growthBase: 0.08,  growthBull: 0.11,  mcSd: 0.16, equityShare: 1.0 },
  });
  function applyRiskPreset(P, key) {
    const r = RISK_PRESETS[key];
    if (!r) return P;
    const Q = { ...P, riskPreset: key, growthBear: r.growthBear, growthBase: r.growthBase, growthBull: r.growthBull, mcSd: r.mcSd, equityShare: r.equityShare };
    if (P.growth === P.growthBase) Q.growth = r.growthBase;
    else if (P.growth === P.growthBear) Q.growth = r.growthBear;
    else if (P.growth === P.growthBull) Q.growth = r.growthBull;
    return Q;
  }

  // Move the stop-work year for the household and any per-partner year.
  function shiftRetirement(Q, dy) {
    Q.retireYear = Math.max(Q.startYear, Q.retireYear + dy);
    for (const k of ['partnerA', 'partnerB']) {
      if (Q[k] && num(Q[k].stopYear) > 0) Q[k].stopYear = Math.max(Q.retireYear, Q[k].stopYear + dy);
    }
  }

  // ── Validation, sanitising and migration ─────────────────────────────
  // validatePlan lists what is wrong in plain words; sanitisePlan returns a
  // plan the engine can always run (finite numbers, sane ranges, a horizon
  // after the stop year); migratePlan brings a saved plan up to the current
  // schema and drops anything the engine must own (tax constants).
  function validatePlan(P) {
    const issues = [];
    const err = (path, message) => issues.push({ path, message, level: 'error' });
    const warn = (path, message) => issues.push({ path, message, level: 'warn' });
    const yr = num(P.startYear, 2026);
    const single = isSingle(P);
    if (!(num(P.retireYear) >= yr)) err('retireYear', 'The year you stop work is in the past.');
    if (num(P.retireYear) > yr + 50) err('retireYear', 'Stopping work more than 50 years away is outside what the plan models.');
    const partner = (key, label) => {
      const w = P[key];
      if (!w || (key === 'partnerB' && single)) return;
      const by = num(w.birthYear);
      if (!(by >= 1920 && by <= yr - 16)) err(key + '.birthYear', label + ': birth year must be between 1920 and ' + (yr - 16) + '.');
      const ageAtStop = num(P.retireYear) - by;
      if (key === 'partnerA' && num(P.horizonAge) <= ageAtStop) err('horizonAge', 'Plan through to an age after you stop work (you would be ' + ageAtStop + ').');
      if (num(w.spAge) > 0 && (w.spAge < 60 || w.spAge > 75)) warn(key + '.spAge', label + ': State Pension age is normally ' + spaFor(by) + '.');
      const d = deathAgeOf(w);
      if (d != null && d <= yr - by) err(key + '.deathAge', label + ': the age to plan to must be in the future.');
      if (d != null && d > 110) warn(key + '.deathAge', label + ': an age over 110 is treated as the horizon.');
      if (num(w.stopYear) > 0 && w.stopYear < num(P.retireYear)) err(key + '.stopYear', label + ': cannot stop work before the household year.');
      if (num(w.pensionAccessAge) > 0 && w.pensionAccessAge < 50) warn(key + '.pensionAccessAge', label + ': a pension age under 50 is unusual (protected ages are 50 to 56).');
      for (const f of ['pension', 'isa', 'monthlyPension', 'monthlyIsa', 'db', 'spAmount', 'income', 'pclsTaken', 'crystallised']) {
        if (num(w[f]) < 0) err(key + '.' + f, label + ': a negative amount here is not valid.');
      }
      if (num(w.spAmount) > 25000) warn(key + '.spAmount', label + ': State Pension is above the full new rate (' + Math.round(TAX_DEFAULTS.statePensionFull || 12548) + ' a year).');
      if (num(w.monthlyPension) * 12 > 60000) warn(key + '.monthlyPension', label + ': annual pension saving over £60,000 exceeds the annual allowance.');
      if (ageAtStop < 55 && (num(w.pension) > 0 || num(w.monthlyPension) > 0) && !(num(w.pensionAccessAge) > 0))
        warn(key + '.birthYear', label + ' stops work at ' + ageAtStop + ' and cannot draw a pension until ' + nmpaFor(w) + '; the early years need ISA, cash or earnings.');
    };
    partner('partnerA', (P.partnerA && P.partnerA.name) || 'You');
    partner('partnerB', (P.partnerB && P.partnerB.name) || 'Partner');
    if (num(P.horizonAge) > 110) err('horizonAge', 'Plan to an age of 110 or less.');
    if (spendingAnnual(P) <= 0) warn('targetNet', 'Spending is zero; the plan holds trivially.');
    if (num(P.growth) < -0.1 || num(P.growth) > 0.2) err('growth', 'Growth must be between -10% and 20%.');
    if (num(P.inflation) < 0 || num(P.inflation) > 0.15) err('inflation', 'Inflation must be between 0% and 15%.');
    if (num(P.mcSd) < 0 || num(P.mcSd) > 0.5) err('mcSd', 'Volatility must be between 0% and 50%.');
    if (num(P.fee) < 0 || num(P.fee) > 0.05) err('fee', 'Charges must be between 0% and 5% a year.');
    if (num(P.house) < 0 || num(P.cash) < 0) err('house', 'Property and cash cannot be negative.');
    for (const ev of (P.lifeEvents || [])) {
      if (!ev) continue;
      if (num(ev.year) < yr) warn('lifeEvents', 'Life event "' + (ev.label || ev.kind) + '" is in the past and is ignored.');
      if (num(ev.amount) < 0) err('lifeEvents', 'Life event "' + (ev.label || ev.kind) + '" has a negative amount.');
    }
    return issues;
  }

  function sanitisePlan(P) {
    const D = freshStart();
    const Q = JSON.parse(JSON.stringify(P || {}));
    const clampN = (v, lo, hi, d) => Math.min(hi, Math.max(lo, num(v, d)));
    Q.startYear = Math.round(clampN(Q.startYear, 2000, 2100, D.startYear));
    Q.retireYear = Math.round(clampN(Q.retireYear, Q.startYear, Q.startYear + 50, Q.startYear + 1));
    Q.horizonAge = Math.round(clampN(Q.horizonAge, 50, 110, D.horizonAge));
    Q.household = Q.household === 'single' ? 'single' : 'couple';
    for (const k of ['partnerA', 'partnerB']) {
      const w = Q[k] = { ...D[k], ...(Q[k] || {}) };
      w.birthYear = Math.round(clampN(w.birthYear, 1920, Q.startYear - 16, D[k].birthYear));
      for (const f of ['pension', 'isa', 'monthlyPension', 'monthlyIsa', 'db', 'spAmount', 'income', 'pclsTaken', 'crystallised', 'dbTransferValue']) w[f] = clampN(w[f], 0, 1e9, 0);
      w.spAge = num(w.spAge) > 0 ? Math.round(clampN(w.spAge, 60, 75, spaFor(w.birthYear))) : 0;
      w.dbStartYear = Math.round(clampN(w.dbStartYear, Q.startYear, Q.startYear + 80, Q.retireYear));
      w.tfcRate = clampN(w.tfcRate, 0, 1, 0.25);
      w.deathAge = num(w.deathAge) > 0 ? Math.round(clampN(w.deathAge, Math.max(Q.startYear - w.birthYear + 1, 50), 110, 90)) : null;
      w.stopYear = num(w.stopYear) > 0 ? Math.round(clampN(w.stopYear, Q.retireYear, Q.startYear + 60, Q.retireYear)) : null;
      w.pensionAccessAge = num(w.pensionAccessAge) > 0 ? Math.round(clampN(w.pensionAccessAge, 50, 75, 55)) : null;
      w.contribGrossUp = !!w.contribGrossUp;
      w.dbSurvivorPct = clampN(w.dbSurvivorPct, 0, 1, 0.5);
      w.dbSchemes = Array.isArray(w.dbSchemes) ? w.dbSchemes.filter(t => t && typeof t === 'object') : [];
    }
    // The plan must run past the first stop year for partner A.
    const ageAtStop = Q.retireYear - Q.partnerA.birthYear;
    if (Q.horizonAge <= ageAtStop) Q.horizonAge = Math.min(110, ageAtStop + 1);
    for (const f of ['growth', 'growthBear', 'growthBase', 'growthBull']) Q[f] = clampN(Q[f], -0.1, 0.2, D[f]);
    Q.inflation = clampN(Q.inflation, 0, 0.15, D.inflation);
    Q.mcSd = clampN(Q.mcSd, 0, 0.5, D.mcSd);
    Q.mcMean = clampN(Q.mcMean, -0.1, 0.2, Q.growthBase);
    Q.mcPaths = Math.round(clampN(Q.mcPaths, 50, 5000, 1000));
    Q.mcSeed = Math.round(clampN(Q.mcSeed, 1, 2 ** 31, 42));
    Q.fee = clampN(Q.fee, 0, 0.05, D.fee);
    Q.equityShare = clampN(Q.equityShare, 0, 1, D.equityShare);
    Q.survivorSpend = clampN(Q.survivorSpend, 0.2, 1, 0.75);
    Q.house = clampN(Q.house, 0, 1e9, 0); Q.houseGrowth = clampN(Q.houseGrowth, -0.1, 0.2, 0.03);
    Q.cash = clampN(Q.cash, 0, 1e9, 0); Q.cashGrowth = clampN(Q.cashGrowth, -0.1, 0.2, 0);
    Q.targetNet = clampN(Q.targetNet, 0, 1e7, D.targetNet);
    Q.spendingPlanOn = !!Q.spendingPlanOn;
    Q.spending = Array.isArray(Q.spending) && Q.spending.length ? Q.spending.map(r => ({ ...r, monthly: clampN(r && r.monthly, 0, 1e6, 0) })) : defaultSpending();
    for (const n of ['1', '2']) {
      Q['phase' + n + 'Age'] = Math.round(clampN(Q['phase' + n + 'Age'], 50, 110, D['phase' + n + 'Age']));
      Q['phase' + n + 'Cut'] = clampN(Q['phase' + n + 'Cut'], 0, 0.9, D['phase' + n + 'Cut']);
      Q['phase' + n + 'On'] = !!Q['phase' + n + 'On'];
    }
    if (!['sippfirst', 'isafirst', 'pafirst'].includes(Q.strategy)) Q.strategy = 'sippfirst';
    if (!['none', 'upfront', 'phased'].includes(Q.pclsMode)) Q.pclsMode = D.pclsMode;
    Q.architecture = { ...D.architecture, ...(Q.architecture && typeof Q.architecture === 'object' ? Q.architecture : {}) };
    Q.inherit = { ...D.inherit, ...(Q.inherit && typeof Q.inherit === 'object' ? Q.inherit : {}) };
    Q.inherit.amount = clampN(Q.inherit.amount, 0, 1e9, 0); Q.inherit.year = Math.round(clampN(Q.inherit.year, Q.startYear, Q.startYear + 80, Q.startYear + 9));
    Q.lifeEvents = Array.isArray(Q.lifeEvents) ? Q.lifeEvents.filter(e => e && typeof e === 'object').map(e => ({ ...e, year: Math.round(clampN(e.year, Q.startYear, Q.startYear + 90, Q.startYear)), amount: clampN(e.amount, 0, 1e9, 0) })) : [];
    Q.iht = { ...D.iht, ...(Q.iht && typeof Q.iht === 'object' ? Q.iht : {}) };
    Q.tax = { ...TAX_DEFAULTS, region: Q.tax && Q.tax.region === 'scotland' ? 'scotland' : 'ruk',
      indexation: Q.tax && Q.tax.indexation === 'frozen' ? 'frozen' : 'cpi', indexFrom: 2031 };
    Q.schemaVersion = SCHEMA_VERSION;
    return Q;
  }

  function migratePlan(raw) {
    if (!raw || typeof raw !== 'object') return freshStart();
    const v = num(raw.schemaVersion, 1);
    const Q = { ...raw };
    if (v < 2) {
      // v1 plans: no household flag, tax constants persisted, no fee. A
      // partner B with nothing in it and a placeholder name was a single.
      const b = Q.partnerB || {};
      const emptyB = !num(b.pension) && !num(b.isa) && !num(b.monthlyPension) && !num(b.db) && !(Array.isArray(b.dbSchemes) && b.dbSchemes.length) && !num(b.spAmount);
      if (!Q.household) Q.household = emptyB && (b.name === 'Partner' || !b.name) ? 'single' : 'couple';
      if (Q.fee == null) Q.fee = 0;                 // an existing plan keeps its gross figures
      if (Q.equityShare == null) Q.equityShare = 1; // and its stress-test convention
    }
    return sanitisePlan(Q);
  }

  // ── Load-time assertions, logged by the app ──────────────────────────
  function runAssertions() {
    const T = TAX_DEFAULTS;
    const out = [];
    const check = (name, got, want, tol) => {
      out.push({ name, pass: Math.abs(got - want) <= (tol || 0.51), got: Math.round(got * 100) / 100, want });
    };
    check('Single person 57548 gross taxes 10451 (workbook parity)', taxOn(57548, T), 10451.2, 1);
    check('Single person 37548 gross taxes 4996 (workbook parity)', taxOn(37548, T), 4995.6, 1);
    // Scottish bands 2026/27: 57,548 gross → taxable 44,978 →
    // 3,967@19 + 12,989@20 + 14,136@21 + 13,886@42 = 12,152.21
    const S = { ...T, region: 'scotland' };
    check('Scotland 57548 gross taxes 12152', taxOn(57548, S), 12152.21, 1);
    check('Scotland 16537 gross taxes 754 (starter only)', taxOn(16537, S), 753.73, 1);
    check('Scotland marginal 42% above 43662', marginalRate(50000, S), 0.42, 0.005);
    check('Scotland region flag does not disturb rUK maths', taxOn(57548, { ...T, region: 'ruk' }), taxOn(57548, T), 0.001);
    check('PA intact at 100000', personalAllowanceFor(100000, T), 12570, 0.01);
    check('PA zero at 125140', personalAllowanceFor(125140, T), 0, 0.01);
    check('60% marginal inside taper', marginalRate(110000, T), 0.60, 0.005);
    // The allocator must use a free personal allowance before paying tax:
    // with only Carol having base income, a small draw must come from
    // Stuart's allowance at zero tax.
    const P = defaults();
    const dd = drawdown(P);
    // Already-accessed pensions: a fully used cash cap or fully crystallised
    // pots must remove ALL tax-free benefit (phased == take-none), and prior
    // PCLS must never increase it.
    const Pph = { ...defaults(), pclsMode: 'phased' };
    const taxNone = drawdown(defaults()).lifetimeTax;
    const taxCapUsed = drawdown({ ...Pph,
      partnerA: { ...Pph.partnerA, pclsTaken: T.pclsCap },
      partnerB: { ...Pph.partnerB, pclsTaken: T.pclsCap } }).lifetimeTax;
    check('Used-up cash cap: phased == take-none tax', taxCapUsed, taxNone, 1);
    // (new contributions are always uncrystallised, so stop them to isolate)
    const noContrib = (q) => ({ ...q, monthlyPension: 0 });
    const taxNoneNC = drawdown({ ...defaults(),
      partnerA: noContrib({ ...defaults().partnerA }),
      partnerB: noContrib({ ...defaults().partnerB }) }).lifetimeTax;
    const taxCrys = drawdown({ ...Pph,
      partnerA: noContrib({ ...Pph.partnerA, crystallised: 9e9 }),
      partnerB: noContrib({ ...Pph.partnerB, crystallised: 9e9 }) }).lifetimeTax;
    check('Fully crystallised pots (no new savings): phased == take-none tax', taxCrys, taxNoneNC, 1);
    const taxPhased = drawdown(Pph).lifetimeTax;
    const taxPartial = drawdown({ ...Pph,
      partnerA: { ...Pph.partnerA, pclsTaken: 165000, crystallised: 400000 } }).lifetimeTax;
    check('Prior PCLS + crystallisation raises lifetime tax vs untouched (order preserved)',
      (taxPhased <= taxPartial + 0.5 && taxPartial <= taxNone + 0.5) ? 0 : 1, 0, 0.1);
    // Protected / zero tax-free entitlements (blended rate)
    const small = () => { const q = defaults();
      q.partnerA = { ...q.partnerA, pension: 200000, monthlyPension: 0 };
      q.partnerB = { ...q.partnerB, pension: 150000, monthlyPension: 0, db: 0 };
      q.targetNet = 40000; return q; };
    const smPh = { ...small(), pclsMode: 'phased' };
    const tRate0 = drawdown({ ...smPh,
      partnerA: { ...smPh.partnerA, tfcRate: 0 },
      partnerB: { ...smPh.partnerB, tfcRate: 0 } }).lifetimeTax;
    check('Zero tax-free entitlement: phased == take-none tax', tRate0, drawdown(small()).lifetimeTax, 1);
    const t25 = drawdown(smPh).lifetimeTax;
    const t50 = drawdown({ ...smPh,
      partnerA: { ...smPh.partnerA, tfcRate: 0.5 },
      partnerB: { ...smPh.partnerB, tfcRate: 0.5 } }).lifetimeTax;
    check('Protected 50% entitlement cuts tax vs standard 25%', t50 < t25 - 1 ? 0 : 1, 0, 0.1);
    // ── Architecture: every claim the UI makes, measured ──────────────
    const AP = defaults();
    const arch = (patch) => ({ ...AP, architecture: { ...AP.architecture, on: true, ...(patch || {}) } });
    check('Architecture off leaves the projection untouched',
      drawdown({ ...AP, architecture: { ...AP.architecture, on: false } }).endWealth, dd.endWealth, 0.01);
    // The ladder is the sequence-of-returns defence: under a Japan-style start
    // it must beat the identical plan with no envelopes.
    // What a ladder actually buys is TIME through a bad start, not a bigger
    // final pot: under a Japan-style sequence the envelopes must push the
    // shortfall out by years. (It is insurance, and insurance has a cost —
    // the UI says so rather than claiming a free lunch.)
    const jpLadder = drawdown(arch({ stressPath: 'japan', rulesOn: false }));
    const jpNone = drawdown(arch({ stressPath: 'japan', rulesOn: false, ladderYears: 0 }));
    const exh = (r) => r.exhaustedAgeA == null ? 999 : r.exhaustedAgeA;
    check('Gilt ladder buys years through a Japan-style sequence',
      exh(jpLadder) > exh(jpNone) ? 0 : 1, 0, 0.1);
    // The written rules must never make a stressed plan fail sooner.
    const jpRules = drawdown(arch({ stressPath: 'japan', rulesOn: true }));
    check('Spending rules never shorten a stressed plan',
      (jpRules.exhaustedAgeA == null ? 999 : jpRules.exhaustedAgeA)
        >= (jpLadder.exhaustedAgeA == null ? 999 : jpLadder.exhaustedAgeA) ? 0 : 1, 0, 0.1);
    check('Spending rules cut below 1.0 in a Japan-style sequence',
      jpRules.architecture.spendMultFinal < 1 ? 0 : 1, 0, 0.1);
    // Annuity: pot converts into guaranteed taxable income for life.
    const ann = drawdown(arch({ annuityOn: true, annuityYear: AP.retireYear + 7, annuityAmount: 150000 }));
    const annRow = ann.rows.find(r => r.year === AP.retireYear + 8);
    check('Annuity purchase creates guaranteed income', annRow && annRow.annuity > 1000 ? 0 : 1, 0, 0.1);
    // Care and the house parachute.
    const care = drawdown(arch({ careOn: true, careFromAge: 84, careAnnual: 45000, careYears: 4 }));
    check('Care costs reduce wealth at the horizon',
      care.endWealth < drawdown(arch()).endWealth ? 0 : 1, 0, 0.1);
    const para = drawdown(arch({ stressPath: 'japan', parachuteOn: true, parachuteFrom: 75, parachuteBelow: 0.9 }));
    check('House parachute releases only once, and only when off track',
      para.architecture.parachuteYear != null
        && drawdown(arch({ parachuteOn: true, parachuteBelow: 0.05 })).architecture.parachuteYear == null ? 0 : 1, 0, 0.1);
    // The worth-it verdict must be built on delivered spending, not survival.
    const mcA = runMonteCarlo(arch(), 120, 3);
    check('Certainty-equivalent spending is a positive, sane figure',
      mcA.ceSpend > 1000 && mcA.ceSpend < AP.targetNet * 1.5 ? 0 : 1, 0, 0.1);
    check('A trimmed year counts as reduced spending, not as a success',
      mcA.worstYearRatioP10 < 1 ? 0 : 1, 0, 0.1);
    // More risk aversion can never raise the certainty equivalent of the same
    // uncertain plan (it is a penalty for dispersion, not a bonus).
    const ceLow = runMonteCarlo({ ...AP, architecture: { ...AP.architecture, on: true, riskAversion: 2 } }, 120, 3).ceSpend;
    const ceHigh = runMonteCarlo({ ...AP, architecture: { ...AP.architecture, on: true, riskAversion: 8 } }, 120, 3).ceSpend;
    check('Higher risk aversion never raises the certainty equivalent',
      ceHigh <= ceLow + 1 ? 0 : 1, 0, 0.1);
    const y0 = dd.rows[0];
    check('Year one: free allowance used before basic rate (tax below merged single-person)',
      y0.tax < taxOn(y0.guaranteed + y0.grossA + y0.grossB, T) ? 0 : 1, 0, 0.5);
    // ── Public-sector DB tranches ──
    {
      const base = { ...defaults(), partnerA: { ...defaults().partnerA, db: 0, dbSchemes: [] }, partnerB: { ...defaults().partnerB, db: 0 } };
      const A = base.partnerA;
      const atNpa = { ...A, dbSchemes: [{ id: 't1', scheme: 'nhs1995', pension: 12000, takeAge: 60 }] };
      const b = trancheBenefits(base, atNpa, atNpa.dbSchemes[0]);
      check('DB tranche at NPA pays the statement pension', b.pension, 12000, 0.01);
      check('NHS 1995 pays an automatic 3× lump sum', b.lump, 36000, 0.01);
      const early = trancheBenefits(base, atNpa, { ...atNpa.dbSchemes[0], takeAge: 55 });
      check('Five years early reduces the pension (≈21%)', early.pension / 12000, Math.pow(0.955, 5), 0.001);
      const care = trancheBenefits(base, { ...A, spAge: 67 }, { id: 't2', scheme: 'nhs2015', pension: 10000, takeAge: 60 });
      check('2015 scheme NPA follows State Pension age (67 → 7 years early)', care.early, 7, 0.01);
      const maxC = trancheBenefits(base, atNpa, { ...atNpa.dbSchemes[0], commutePct: 1 });
      const capital = 20 * maxC.pension + maxC.lump;
      check('Maximum commutation sits exactly at the 25% HMRC limit', maxC.lump / capital, 0.25, 0.0005);
      check('Commuting pension for cash at 12:1', (maxC.lump - 36000) / (12000 - maxC.pension), 12, 0.01);
      // Flows: income appears as dbA from the take year; the lump lands in cash that year.
      const Pq = { ...base, retireYear: 2030, partnerA: { ...atNpa, birthYear: 1970 } };   // take at 60 → 2030
      const ddq = drawdown(Pq);
      const r0 = ddq.rows[0];
      check('Tranche income flows into guaranteed income from the take year', r0.dbA / inflFactor(Pq, 2030), 12000, 1);
      check('Lump sum is booked in the take year', r0.dbLump / inflFactor(Pq, 2030), 36000, 1);
      // Taking it later means nothing before the take year.
      const Pl = { ...Pq, partnerA: { ...Pq.partnerA, dbSchemes: [{ id: 't1', scheme: 'nhs2015', pension: 12000, takeAge: 67 }] } };
      check('Nothing paid before the take year', drawdown(Pl).rows[0].dbA, 0, 0.01);
      // Simple company DB still works alongside, and the two add.
      const Pboth = { ...Pq, partnerA: { ...Pq.partnerA, db: 5000, dbStartYear: 2030, dbIndexed: true } };
      check('Company DB and scheme tranche add together', drawdown(Pboth).rows[0].dbA / inflFactor(Pq, 2030), 17000, 1);
      // A pre-retirement lump sum lands in cash during accumulation, once.
      const Ppre = { ...Pq, retireYear: 2034 };
      const accPre = accumulate(Ppre);
      check('Pre-retirement lump sum lands in cash once', (accPre.years.find(y => y.year === 2030) || {}).cash / inflFactor(Ppre, 2030), 36000, 1);
      check('…and is not booked again at retirement', drawdown(Ppre).rows[0].dbLump, 0, 0.01);
      // Still accruing: more service, more pension.
      const acc1 = trancheBenefits({ ...base, retireYear: 2030 }, { ...A, birthYear: 1970 }, { id: 't3', scheme: 'nhs2015', pension: 10000, takeAge: 67, accruing: true, salary: 54000 });
      check('Four more years at 1/54 of £54k adds ≈£4k plus revaluation', acc1.accrued > 14000 && acc1.accrued < 14900 ? 0 : 1, 0, 0.1);
    }
    // ── Couples are taxed as two individuals, never as one merged income ──
    {
      const P = defaults();
      const dd = drawdown(P);
      const r = dd.rows[2];
      const Ty = taxFor(P, r.year);
      const incA = r.spA + r.dbA + (r.annuity || 0) + r.grossA, incB = r.spB + r.dbB + r.grossB;
      check('Row tax = tax(A income) + tax(B income)', r.tax, taxOn(incA, Ty) + taxOn(incB, Ty), 0.5);
      check('…and is below the tax on the merged income (two allowances, two basic bands)',
        r.tax < taxOn(incA + incB, Ty) - 1 ? 0 : 1, 0, 0.1);
      // Hand-checked: A £30,000 taxable, B £17,548 taxable (SP £12,548 + DB £5,000), rUK 2026/27.
      check('Hand check A: (30,000 − 12,570) × 20% = 3,486', taxOn(30000, T), 3486, 0.01);
      check('Hand check B: (17,548 − 12,570) × 20% = 995.60', taxOn(17548, T), 995.6, 0.01);
    }
    // ── Stress tests and levers behave ──
    {
      const P = defaults();
      const st = stressTests(P);
      const gfc = st.tests.find(t => /2008/.test(t.label));
      check('2008-at-retirement leaves less than the base plan', gfc && gfc.delta < 0 ? 0 : 1, 0, 0.1);
      const flat = drawdown(P, { returnPath: new Array(40).fill(0) });
      const base = drawdown(P);
      check('A flat real-return path ends below the base plan', flat.endWealth < base.endWealth ? 0 : 1, 0, 0.1);
      const lv = levers(P, { paths: 60 });
      const later = lv.levers.find(l => l.id === 'later1');
      check('Stopping a year later never lowers wealth at the horizon', later && later.dEnd >= -1 ? 0 : 1, 0, 0.1);
      const spend = lv.levers.find(l => l.id === 'spend3k');
      check('Spending less never lowers confidence', spend && spend.dConf >= -1e-9 ? 0 : 1, 0, 0.1);
      check('Levers are ranked by confidence gain', lv.levers.every((l, i, a) => i === 0 || a[i - 1].dConf >= l.dConf - 1e-12) ? 0 : 1, 0, 0.1);
    }
    // ── The Monte Carlo IS the plan: at zero volatility every path equals the deterministic run ──
    {
      const parity = (name, P) => {
        const Q = { ...P, mcSd: 0, mcMean: P.growth, growthBase: P.growth, architecture: { ...(P.architecture || {}), on: false } };
        const dd = drawdown(Q);
        const mc = runMonteCarlo(Q, 2, 7);
        const rel = Math.abs(mc.finalP50 - dd.endWealth) / Math.max(1, Math.abs(dd.endWealth));
        check('MC parity (' + name + ') within 0.1%', rel < 0.001 ? 0 : rel, 0, 0.0005);
      };
      const D = defaults();
      parity('worked example', D);
      parity('phased tax-free cash', { ...D, pclsMode: 'phased' });
      parity('upfront tax-free cash', { ...D, pclsMode: 'upfront' });
      parity('ISA first', { ...D, strategy: 'isafirst' });
      parity('allowances first', { ...D, strategy: 'pafirst' });
      parity('scheme pension with lump sum', { ...D, partnerA: { ...D.partnerA, dbSchemes: [{ id: 'p', scheme: 'nhs1995', pension: 14000, takeAge: 60, commutePct: 1 }] } });
      parity('life events', { ...D, lifeEvents: [
        { year: D.retireYear + 2, label: 'Roof', amount: 20000, kind: 'cost' },
        { year: D.retireYear + 4, label: 'Windfall', amount: 40000, kind: 'income', invest: true },
        { year: D.retireYear, label: 'Part-time', amount: 10000, kind: 'earned', who: 'B' }] });
      parity('cash and spending plan', { ...D, cash: 50000, cashGrowth: 0.02, spendingPlanOn: true });
      // The lens moves the simulated mean with it.
      const bear = runMonteCarlo({ ...D, growth: D.growthBear }, 120, 3).successProb;
      const bull = runMonteCarlo({ ...D, growth: D.growthBull }, 120, 3).successProb;
      check('Poor lens gives lower confidence than Positive', bear < bull ? 0 : 1, 0, 0.1);
      // Tax levers now register in the simulation, not only the deterministic run.
      const lv = levers(D, { paths: 60 });
      const ph = lv.levers.find(l => l.id === 'phased');
      check('Phased tax-free cash lever reports its tax saving', ph && ph.dTax < -1000 ? 0 : 1, 0, 0.1);
    }
    // ── Lump sum allowance shared across scheme and personal pensions ──
    {
      const D = defaults();
      const big = { ...D, pclsMode: 'upfront', partnerA: { ...D.partnerA, birthYear: 1970, dbSchemes: [{ id: 'x', scheme: 'nhs1995', pension: 60000, takeAge: 60, commutePct: 1 }] } };
      const b = trancheBenefits(big, big.partnerA, big.partnerA.dbSchemes[0]);
      check('Large scheme lump exceeds the allowance on its own', b.lump > T.pclsCap ? 0 : 1, 0, 0.1);
      const dd = drawdown(big);
      const r0 = dd.rows[0];
      check('Excess scheme lump is taxed in the take year', r0.lumpTax > 1000 ? 0 : 1, 0, 0.1);
      check('No personal tax-free cash left once the scheme lump used the allowance', r0.tfcA, 0, 0.01);
      // RNRB needs a home and never exceeds its value
      const noHouse = estate({ ...D, house: 0 });
      check('No residence band without a home', noHouse.rnrb, 0, 0.01);
      const smallHouse = estate({ ...D, house: 100000, houseGrowth: 0 });
      check('Residence band capped at the home’s value', smallHouse.rnrbFull, 100000, 0.01);
    }
    // ── The plan runs to the younger partner's horizon; income is taxed; contributions stop at 75 ──
    {
      const D = defaults();
      const young = { ...D, partnerB: { ...D.partnerB, birthYear: 1980 } };
      check('Plan ends at the younger partner’s horizon', planEndYear(young), 1980 + D.horizonAge, 0.01);
      check('Drawdown rows reach that year', drawdown(young).rows[drawdown(young).rows.length - 1].year, 1980 + D.horizonAge, 0.01);
      const earned = { ...D, lifeEvents: [{ year: D.retireYear, label: 'pt', amount: 10000, kind: 'earned', who: 'A' }] };
      const r = drawdown(earned).rows[0];
      check('Part-time earnings are taxed to the earner', r.earnedA, 10000 * inflFactor(D, D.retireYear), 1);
      check('…and raise that year’s tax', r.tax > drawdown(D).rows[0].tax ? 0 : 1, 0, 0.1);
      const old = { ...D, retireYear: 2050, partnerA: { ...D.partnerA, birthYear: 1970, monthlyPension: 1000 } };
      const acc = accumulate(old);
      const at74 = acc.years.find(y => y.year === 2044).pensionA, at76 = acc.years.find(y => y.year === 2046).pensionA, at75 = acc.years.find(y => y.year === 2045).pensionA;
      check('Contributions stop at 75 (growth only after)', Math.abs((at76 / at75) - (1 + old.growth)) < 1e-9 && at75 / at74 > 1 + old.growth ? 0 : 1, 0, 0.1);
      const sp = { ...D, spendingPlanOn: true };
      const lv = levers(sp, { paths: 40 });
      check('Spend-less lever cuts the spending plan, not the stale target', lv.levers.find(l => l.id === 'spend3k').dConf >= -1e-9 ? 0 : 1, 0, 0.1);
      const edges = bandEdgesFor({ ...T, region: 'scotland' });
      check('Scottish allocation edges follow the 2026/27 bands', edges[1], 16537, 0.01);
    }
    // ── Forensic audit remediation (October 2026): every fix, measured ──
    {
      const D = defaults();
      const r0 = (dd) => dd.rows[0];
      // R1 Lump-sum tax is paid once: the take year shows no spurious shortfall.
      const big = { ...D, partnerA: { ...D.partnerA, birthYear: 1970, dbSchemes: [{ id: 'x', scheme: 'nhs1995', pension: 60000, takeAge: 60, commutePct: 1 }] } };
      const bl = r0(drawdown(big));
      check('Lump-sum tax is not deducted from net income twice (no shortfall in the take year)', bl.shortfall, 0, 1);
      check('…but the tax itself is still counted', bl.lumpTax > 1000 ? 0 : 1, 0, 0.1);
      // R2 Normal minimum pension age: no pension draws before 55 / 57.
      const young = { ...D, retireYear: 2028, cash: 0, partnerA: { ...D.partnerA, birthYear: 1975, isa: 0 }, partnerB: { ...D.partnerB, birthYear: 1975, isa: 0, db: 0 } };
      const dy = drawdown(young);
      check('No pension draw before normal minimum pension age (57 for a 1975 birth)', (dy.rows.find(r => r.grossA + r.grossB + r.tfcA + r.tfcB > 0) || {}).ageA, 57, 0.01);
      check('…and the gap years are reported as a shortfall, not hidden', dy.shortfallAgeA, 53, 0.01);
      check('NMPA is 55 for a 1970 birth and 57 for 1973', nmpaFor({ birthYear: 1970 }) + nmpaFor({ birthYear: 1973 }), 112, 0.01);
      check('State Pension age by birth year: 66 / 67 / 68', spaFor(1959) + spaFor(1965) + spaFor(1980), 201, 0.01);
      // R3 Survivor phase.
      const surv = { ...D, partnerB: { ...D.partnerB, deathAge: 80 } };
      const ds = drawdown(surv), after = ds.rows.find(r => r.ageB === 81), before = ds.rows.find(r => r.ageB === 80);
      check('After a death the deceased State Pension stops', after.spB, 0, 0.01);
      check('…the survivor receives half the company pension (flat, as entered)', after.dbA, 2500, 1);
      check('…spending falls to the survivor share (75%)', after.planTarget / (targetForYear(D, after.year)), 0.75, 0.001);
      check('…and the deceased pots pass to the survivor (nothing vanishes)', after.potB + after.isaB, 0, 0.01);
      check('Death before 75: inherited pension is drawn tax-free (lower lifetime tax than death at 80)',
        drawdown({ ...D, partnerA: { ...D.partnerA, deathAge: 70 } }).lifetimeTaxReal < drawdown({ ...D, partnerA: { ...D.partnerA, deathAge: 80 } }).lifetimeTaxReal ? 0 : 1, 0, 0.1);
      check('Plan ends when the last partner does', planEndYear({ ...D, partnerA: { ...D.partnerA, deathAge: 75 }, partnerB: { ...D.partnerB, deathAge: 72 } }), 2045, 0.01);
      // R4 Single-person plans: no phantom partner.
      const single = { ...D, household: 'single' };
      const dsg = drawdown(single);
      check('Single: plan runs to partner A horizon only', dsg.rows[dsg.rows.length - 1].year, D.partnerA.birthYear + D.horizonAge, 0.01);
      check('Single: no partner B income, pots or allowance', dsg.rows.reduce((s, r) => s + r.spB + r.dbB + r.grossB + r.potB + r.isaB, 0), 0, 0.01);
      check('Single: one nil-rate band', estate(single).nrb < estate(D).nrb ? 0 : 1, 0, 0.1);
      // R5 Tax thresholds index from April 2031; frozen is a choice.
      check('Personal allowance indexes with inflation from 2031', taxFor(D, 2040).personalAllowance, 12570 * Math.pow(1 + D.inflation, 10), 1);
      check('…and stays frozen until then', taxFor(D, 2030).personalAllowance, 12570, 0.01);
      check('Frozen thresholds give more lifetime tax than indexed', drawdown({ ...D, tax: { ...D.tax, indexation: 'frozen' } }).lifetimeTaxReal > drawdown(D).lifetimeTaxReal ? 0 : 1, 0, 0.1);
      check('A saved plan cannot carry old tax constants', taxFor({ ...D, tax: { personalAllowance: 11000, region: 'ruk' } }, 2026).personalAllowance, 12570, 0.01);
      // R6 Surplus guaranteed income is banked, never lost.
      const rich = { ...D, targetNet: 10000, partnerA: { ...D.partnerA, db: 40000, dbStartYear: 2030 } };
      check('Guaranteed income above the need is banked into cash', r0(drawdown(rich)).banked > 10000 ? 0 : 1, 0, 0.1);
      // R7 Monte Carlo centres on the lens rate and reports honestly.
      const mc = runMonteCarlo(D, 600, 42);
      check('MC median end wealth within 20% of the deterministic plan (sequence risk only)', Math.abs(mc.finalP50 / drawdown(D).endWealth - 1) < 0.2 ? 0 : 1, 0, 0.1);
      check('successProb has a standard error', mc.successSe > 0 && mc.successSe < 0.05 ? 0 : 1, 0, 0.1);
      check('Mortality-weighted success is at least the horizon success', mc.successLifetime >= mc.successProb - 1e-9 ? 0 : 1, 0, 0.1);
      check('Pre-retirement risk: pots at retirement spread P10 < P50 < P90', mc.potsAtRetirementP10 < mc.potsAtRetirementP50 && mc.potsAtRetirementP50 < mc.potsAtRetirementP90 ? 0 : 1, 0, 0.1);
      const archMc = runMonteCarlo({ ...D, architecture: { ...D.architecture, on: true } }, 200, 3);
      check('Structure overlay: success at full spending is below success after cuts', archMc.successProb <= archMc.successProbWithCuts ? 0 : 1, 0, 0.1);
      // R8 Lump sum allowance in payment order: a scheme lump first, upfront cash after.
      const up = drawdown({ ...big, pclsMode: 'upfront' });
      check('Scheme lump sum uses the allowance before upfront personal cash', r0(up).tfcA, 0, 0.01);
      // R9 Upfront cash above the ISA allowance sits invested, and feeds the ISA yearly.
      const upD = drawdown({ ...D, pclsMode: 'upfront' });
      check('Upfront cash above the ISA allowance is invested in a general account', r0(upD).gia > 100000 ? 0 : 1, 0, 0.1);
      check('…and moves into the ISAs over the years', upD.rows[2].gia < r0(upD).gia ? 0 : 1, 0, 0.1);
      // R10 A partner can stop work later; pay is taxed and contributions continue.
      const work = { ...D, partnerB: { ...D.partnerB, stopYear: 2034, income: 40000, monthlyPension: 500, contribGrossUp: true } };
      const w0 = r0(drawdown(work));
      check('Working partner: salary taxed in the first stop year', w0.salaryB, 40000 * inflFactor(D, D.retireYear), 1);
      check('Working partner: relief-at-source contribution grossed up (500 a month → 7,500 a year)', w0.contribB, 7500, 0.01);
      check('Working partner: no pension draw while still earning', w0.grossB, 0, 0.01);
      // R11 Charges come off every return.
      check('A 0.5% fee lowers wealth at the horizon', drawdown({ ...D, fee: 0.005 }).endWealth < drawdown(D).endWealth ? 0 : 1, 0, 0.1);
      check('Risk preset sets the lens trio and volatility together', applyRiskPreset(D, 'cautious').mcSd, RISK_PRESETS.cautious.mcSd, 0.001);
      // R12 Stress paths: real returns scaled by the equity share, and a crash-then-flat path.
      const st = stressTests(D);
      check('Crash-then-flat stress path is in the table', st.tests.some(t => /flat/.test(t.label)) ? 0 : 1, 0, 0.1);
      const half = drawdown({ ...D, equityShare: 0.5 }, { returnPath: STRESS_PATHS.gfc });
      const full = drawdown({ ...D, equityShare: 1 }, { returnPath: STRESS_PATHS.gfc });
      check('A lower equity share softens the 2008 path', half.endWealth !== full.endWealth ? 0 : 1, 0, 0.1);
      // R13 Validation and migration.
      check('Horizon before stop year is an error, not a crash', validatePlan({ ...D, horizonAge: 55 }).some(i => i.path === 'horizonAge' && i.level === 'error') ? 0 : 1, 0, 0.1);
      check('…and the engine still runs it', drawdown({ ...D, horizonAge: 55 }).rows.length >= 1 ? 0 : 1, 0, 0.1);
      check('sanitisePlan repairs a bad horizon', sanitisePlan({ ...D, horizonAge: 55 }).horizonAge, 61, 0.01);
      check('migratePlan drops persisted tax constants', migratePlan({ ...D, schemaVersion: undefined, tax: { personalAllowance: 11000 } }).tax.personalAllowance, 12570, 0.01);
      check('Fresh plans default to phased tax-free cash', freshStart().pclsMode === 'phased' ? 0 : 1, 0, 0.1);
      // Parity with the new features switched on.
      const parity2 = (name, P) => {
        const Q = { ...P, mcSd: 0, growthBase: P.growth, architecture: { ...(P.architecture || {}), on: false } };
        const dd = drawdown(Q), m = runMonteCarlo(Q, 2, 7);
        const rel = Math.abs(m.finalP50 - dd.endWealth) / Math.max(1, Math.abs(dd.endWealth));
        check('MC parity (' + name + ') within 0.1%', rel < 0.001 ? 0 : rel, 0, 0.0005);
      };
      parity2('survivor phase', surv);
      parity2('single person', single);
      parity2('working partner with gross-up', work);
      parity2('fee and indexed thresholds', { ...D, fee: 0.005 });
      parity2('minimum pension age gap', young);
    }
    return out;
  }

  return {
    defaults, freshStart, example, defaultSpending,
    taxOn, personalAllowanceFor, grossForNet, marginalRate,
    spendingAnnual, phaseFactor, targetForYear, effectiveEvents, eventNominal,
    accumulate, drawdown, compareStrategies,
    stressTests, sensitivityGrid, tornado, lifetimeTotals, estate,
    runMonteCarlo, runAssertions, compareArchitecture, assessStructure, archOf, fundedRatio,
    TAX_DEFAULTS,
    DB_SCHEMES, DB_SCHEMES_ASOF, trancheBenefits, trancheNpa, trancheMinAge, maxCommute, dbSchedule, hasAnyDb, compareDbTiming,
    levers, STRESS_PATHS, SCOT_BANDS, planEndYear, lumpAfterLsa, fundYear,
    taxFor, spaFor, nmpaFor, spAgeOf, isSingle, normalisePlan, validatePlan, sanitisePlan, migratePlan,
    RISK_PRESETS, applyRiskPreset, shiftRetirement, mcMeanFor, householdSurvival, prepare, SCHEMA_VERSION,
    TAX_YEAR,
  };
}

export const Engine = createEngine();
