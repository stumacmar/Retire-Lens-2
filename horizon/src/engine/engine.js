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
      },

      growth: 0.07,             // the live slider rate
      growthBear: 0.04,
      growthBase: 0.07,         // the named Base scenario, chip target
      growthBull: 0.10,
      inflation: 0.02,
      mcMean: 0.07,
      mcSd: 0.12,
      mcPaths: 1000,
      mcSeed: 42,

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

      tax: { ...TAX_DEFAULTS },
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
    return { id: t.id, scheme: t.scheme || 'custom', label: t.label || s.label, family: s.family,
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
    return { tranches, incomeAt, lumpAt };
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
    const to = Math.max(b0.npa, Math.min(b0.npa + 3, P.horizonAge - 5));
    // Only ages still ahead of the member: the past is not an option.
    const from = Math.max(b0.minAge, P.startYear - who.birthYear);
    for (let age = from; age <= to; age++) {
      const q = { ...P, [whoKey]: { ...who, dbSchemes: who.dbSchemes.map((x, i) => i === idx ? { ...x, takeAge: age } : x) } };
      const b = trancheBenefits(q, q[whoKey], q[whoKey].dbSchemes[idx]);
      const dd = drawdown(q);
      const horizonYear = P.partnerA.birthYear + P.horizonAge;
      out.push({ age, year: who.birthYear + age, pension: b.pension, lump: b.lump, factor: b.factor,
        endWealthReal: dd.endWealth / inflFactor(P, horizonYear), exhaustedAgeA: dd.exhaustedAgeA,
        lifetimeTaxReal: dd.lifetimeTaxReal != null ? dd.lifetimeTaxReal : dd.lifetimeTax });
    }
    return { tranche: b0, options: out };
  }

  // ── Income tax, single person, England rUK bands ─────────────────────
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
      for (const b of SCOT_BANDS) {
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
      return [T.personalAllowance, 15397, 27491, 43662, 75000, T.taperStart, T.additionalThreshold];
    }
    return [T.personalAllowance, T.higherThreshold, T.taperStart, T.additionalThreshold];
  }

  /** Gross ceiling for "fill the cheap bands" strategies: the point where
   *  the marginal rate first exceeds ~21% (rUK 40% edge; Scottish 42% edge). */
  function basicCeilFor(T) {
    return T.region === 'scotland' ? 43662 : T.higherThreshold;
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

  // ── Accumulation: start year to retirement, year by year ─────────────
  // Mid-year convention on contributions. Reproduces the workbook's
  // future-value formulas to within about one percent, and stays honest
  // when contributions change or life events land before retirement.
  function accumulate(P, growthOverride) {
    const g = growthOverride == null ? P.growth : growthOverride;
    const years = [];
    const warnings = [];
    let a = { pension: P.partnerA.pension, isa: P.partnerA.isa,
              uncrys: clamp0(P.partnerA.pension - (P.partnerA.crystallised || 0)) };
    let b = { pension: P.partnerB.pension, isa: P.partnerB.isa,
              uncrys: clamp0(P.partnerB.pension - (P.partnerB.crystallised || 0)) };
    let cash = P.cash;
    const events = effectiveEvents(P);
    const DBA = dbSchedule(P, P.partnerA), DBB = dbSchedule(P, P.partnerB);

    for (let y = P.startYear; y < P.retireYear; y++) {
      const contribHalf = 1 + g / 2;
      // A DB lump sum taken before stopping work lands in cash, tax-free.
      // (From the stop-work year on, the drawdown loop books it instead.)
      if (y + 1 < P.retireYear) cash += DBA.lumpAt(y + 1) + DBB.lumpAt(y + 1);
      a.pension = a.pension * (1 + g) + P.partnerA.monthlyPension * 12 * contribHalf;
      a.uncrys = a.uncrys * (1 + g) + P.partnerA.monthlyPension * 12 * contribHalf;
      a.isa = a.isa * (1 + g) + P.partnerA.monthlyIsa * 12 * contribHalf;
      b.pension = b.pension * (1 + g) + P.partnerB.monthlyPension * 12 * contribHalf;
      b.uncrys = b.uncrys * (1 + g) + P.partnerB.monthlyPension * 12 * contribHalf;
      b.isa = b.isa * (1 + g) + P.partnerB.monthlyIsa * 12 * contribHalf;
      cash = cash * (1 + (P.cashGrowth || 0));   // cash earns its own fixed rate
      // Pre-retirement life events, today's money indexed to the year
      for (const ev of events) {
        if (ev.year !== y) continue;
        const amt = eventNominal(P, ev);
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
        cash,
        house: P.house * Math.pow(1 + P.houseGrowth, y + 1 - P.startYear),
      });
    }
    const last = years[years.length - 1] || {
      year: P.startYear, pensionA: a.pension, isaA: a.isa, uncrysA: a.uncrys,
      pensionB: b.pension, isaB: b.isa, uncrysB: b.uncrys, cash,
      house: P.house,
    };
    return { years, atRetirement: last, warnings };
  }

  // ── Drawdown: retirement to horizon, year by year ─────────────────────
  // Income layering as the workbook: DB, then each state pension as it
  // activates, then pension draws for the shortfall, ISA for any remainder.
  // Pension draws are allocated across the couple by marginal rate, so free
  // personal allowance is always used before anyone pays basic rate, and
  // both basic bands are used before anyone pays higher rate.
  function drawdown(P, opts) {
    opts = opts || {};
    const g = opts.growth == null ? P.growth : opts.growth;
    const T = P.tax;
    const acc = opts.startPots || accumulate(P, g).atRetirement;
    const events = effectiveEvents(P);

    let potA = acc.pensionA, potB = acc.pensionB;
    let isaA = acc.isaA, isaB = acc.isaB;
    let cash = acc.cash || 0;
    // Only the uncrystallised (never-accessed) part of a pot can still pay
    // tax-free cash, and the lifetime cap is reduced by anything already taken.
    let uncrysA = acc.uncrysA != null ? acc.uncrysA : potA;
    let uncrysB = acc.uncrysB != null ? acc.uncrysB : potB;
    let pclsUsedA = P.partnerA.pclsTaken || 0;
    let pclsUsedB = P.partnerB.pclsTaken || 0;
    const rateA = Math.min(1, Math.max(0, P.partnerA.tfcRate == null ? 0.25 : P.partnerA.tfcRate));
    const rateB = Math.min(1, Math.max(0, P.partnerB.tfcRate == null ? 0.25 : P.partnerB.tfcRate));

    // PCLS upfront: crystallise everything at retirement, take 25% capped.
    // Proceeds are treated as invested alongside the ISAs so they keep
    // compounding; any further tax on that wrapper is out of scope and
    // noted in the UI.
    if (P.pclsMode === 'upfront') {
      const tfcA0 = Math.min(uncrysA * rateA, clamp0(T.pclsCap - pclsUsedA));
      potA -= tfcA0; isaA += tfcA0; pclsUsedA += tfcA0; uncrysA = 0;
      const tfcB0 = Math.min(uncrysB * rateB, clamp0(T.pclsCap - pclsUsedB));
      potB -= tfcB0; isaB += tfcB0; pclsUsedB += tfcB0; uncrysB = 0;
    }

    const endYear = P.partnerA.birthYear + P.horizonAge;
    const rows = [];
    let lifetimeTax = 0, lifetimeTaxReal = 0, exhaustedYear = null;

    // ── Architecture overlay state (inert when architecture.on is false) ──
    const AR = archOf(P);
    const archOn = !!AR.on;
    const RATES = sleeveRates(AR, P, archOn ? (g - P.growthBase) : 0);
    const stress = STRESS_PATHS[AR.stressPath] || null;
    let sleeve = null;              // { ladder, growth } household sleeves
    let spendMult = 1, raiseStreak = 0;
    let annuityToday = 0, annuityBought = false;   // today's-money annuity income
    let parachuteUsed = false, parachuteYear = null;
    let lastRatio = null;
    const DBA = dbSchedule(P, P.partnerA), DBB = dbSchedule(P, P.partnerB);

    for (let year = P.retireYear; year <= endYear; year++) {
      const infl = inflFactor(P, year);
      const ageA = ageIn(P.partnerA, year), ageB = ageIn(P.partnerB, year);
      // Tax-free DB lump sums arriving this year go to cash before any draw.
      const dbLump = DBA.lumpAt(year) + DBB.lumpAt(year);
      if (dbLump > 0) cash += dbLump;
      // Household investable wealth before this year's draws (the sleeves
      // track the same money, split by asset rather than by wrapper).
      const investStart = potA + potB + isaA + isaB;

      // Planned annuity review: convert part of the pot into guaranteed,
      // taxable income for life. Bought at the start of the year.
      if (archOn && AR.annuityOn && !annuityBought && year >= AR.annuityYear) {
        const cost = Math.min(clamp0(AR.annuityAmount) * infl, potA);
        potA -= cost; uncrysA = clamp0(uncrysA - cost);
        annuityToday = (cost * AR.annuityRate) / infl;   // held in today's money
        annuityBought = true;
      }
      const annuityNom = annuityBought
        ? annuityToday * (AR.annuityIndexed ? infl : inflFactor(P, AR.annuityYear)) : 0;

      // Guaranteed income per partner, nominal (company DB + scheme tranches)
      const dbA = DBA.incomeAt(year);
      const dbB = DBB.incomeAt(year);
      const spA = ageA >= P.partnerA.spAge ? P.partnerA.spAmount * infl : 0;
      const spB = ageB >= P.partnerB.spAge ? P.partnerB.spAmount * infl : 0;

      const baseA = dbA + spA + annuityNom;   // taxable base income per partner
      const baseB = dbB + spB;
      const guaranteedNet = baseA + baseB - taxOn(baseA, T) - taxOn(baseB, T);

      // This year's net need. The mechanical rules scale it by a multiplier
      // that only ever moves on a funded-ratio trigger (see end of loop).
      const target = targetForYear(P, year) * spendMult;
      let eventCost = 0, eventIncome = 0, eventInvested = 0;
      const eventLabels = [];
      // Care: a late-life cost block, funded like any other spending.
      let careCost = 0;
      if (archOn && AR.careOn && ageA >= AR.careFromAge && ageA < AR.careFromAge + AR.careYears) {
        careCost = clamp0(AR.careAnnual) * infl;
        eventCost += careCost;
        eventLabels.push('care');
      }
      for (const ev of events) {
        if (ev.year !== year || year < P.retireYear) continue;
        const amt = eventNominal(P, ev);
        eventLabels.push(ev.label || ev.kind);
        if (ev.kind === 'cost') eventCost += amt;
        else if (ev.invest) eventInvested += amt;
        else eventIncome += amt;
      }
      // Invested windfalls join the ISA pot mid-year: half a year of growth
      // this year, full growth thereafter. Applied after this year's growth
      // step below via a carry.
      let need = clamp0(target + eventCost - eventIncome - guaranteedNet);

      // Funding
      let grossA = 0, grossB = 0, tfcA = 0, tfcB = 0, isaDraw = 0, cashDraw = 0;
      let isaDrawA = 0, isaDrawB = 0;

      const drawIsa = (amt) => {
        let rem = amt;
        const c = Math.min(cash, rem); cash -= c; cashDraw += c; rem -= c;
        const fa = Math.min(isaA, rem); isaA -= fa; rem -= fa; isaDrawA += fa;
        const fb = Math.min(isaB, rem); isaB -= fb; rem -= fb; isaDrawB += fb;
        isaDraw += (amt - rem) - c;
        return amt - rem;
      };

      // Serve `wantNet` of net income from one partner's pension, honouring
      // an optional gross ceiling. Returns net served.
      const serveFrom = (who, wantNet, grossCeil) => {
        const isA = who === 'A';
        const pot = isA ? potA : potB;
        if (pot <= 0.01 || wantNet <= 0.01) return 0;
        const base = (isA ? baseA : baseB) + (isA ? grossA : grossB);
        const uncrys = isA ? uncrysA : uncrysB;
        const rate = isA ? rateA : rateB;
        const pclsLeft = clamp0(T.pclsCap - (isA ? pclsUsedA : pclsUsedB));
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
          if (isA) { pclsUsedA += tf; tfcA += tf; grossA += taxable; potA -= gross; uncrysA = clamp0(uncrysA - gross); }
          else { pclsUsedB += tf; tfcB += tf; grossB += taxable; potB -= gross; uncrysB = clamp0(uncrysB - gross); }
          return net;
        }
        let gross = Math.min(grossForNet(wantNet, base, T), pot, ceil);
        const net = gross - (taxOn(base + gross, T) - taxOn(base, T));
        if (isA) { grossA += gross; potA -= gross; uncrysA = clamp0(uncrysA - gross); }
        else { grossB += gross; potB -= gross; uncrysB = clamp0(uncrysB - gross); }
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
          if (potA > 0.01) candidates.push({ who: 'A', m: marginalRate(gA, T), g: gA });
          if (potB > 0.01) candidates.push({ who: 'B', m: marginalRate(gB, T), g: gB });
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

      const taxA = taxOn(baseA + grossA, T);
      const taxB = taxOn(baseB + grossB, T);
      const totalTax = taxA + taxB;
      lifetimeTax += totalTax;
      lifetimeTaxReal += totalTax / infl;

      const netIncome = baseA + baseB + grossA + grossB + tfcA + tfcB
        - totalTax + isaDraw + cashDraw + eventIncome;
      const shortfall = clamp0(target + eventCost - netIncome);

      // Growth. Simple model: one rate. Architecture: the ladder funds the
      // year's draws and earns the gilt rate; only the growth engine takes
      // the market. The blended household return is then applied to each
      // wrapper, so tax accounting is untouched and totals reconcile.
      let gYear = g;
      let ladderNow = 0, engineNow = 0;
      // A named sequence of real returns replayed from the year work stops
      // (stress tests on a plain plan; the architecture has its own path).
      if (!archOn && opts.returnPath) {
        const yi = year - P.retireYear;
        if (yi < opts.returnPath.length) gYear = (1 + opts.returnPath[yi]) * (1 + P.inflation) - 1;
      }
      if (archOn) {
        const investAfter = potA + potB + isaA + isaB;
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
        const i = year - P.retireYear;
        const rGrowth = stress && i < stress.length
          ? (1 + stress[i]) * (1 + P.inflation) - 1
          : RATES.growth;
        const next = sleeveYear(sleeve, drawn, rGrowth, RATES.gilt, tgt, AR);
        sleeve = { ladder: next.ladder, growth: next.growth };
        ladderNow = next.ladder; engineNow = next.growth;
        gYear = investAfter > 1 ? (next.total / investAfter) - 1 : 0;
      }
      potA *= (1 + gYear); potB *= (1 + gYear);
      uncrysA *= (1 + gYear); uncrysB *= (1 + gYear);
      isaA *= (1 + gYear); isaB *= (1 + gYear);
      cash *= (1 + (P.cashGrowth || 0));   // cash grows at its own fixed rate
      if (eventInvested > 0) isaA += eventInvested * (1 + gYear / 2);

      let wealth = potA + potB + isaA + isaB + cash;

      // The written rules: measure the funded ratio, then act on it.
      let ratio = null, ruleMove = null;
      if (archOn && AR.rulesOn) {
        ratio = fundedRatio(AR, {
          wealthReal: wealth / infl,
          spendReal: target / infl,
          guaranteedNetReal: guaranteedNet / infl,
          ageA,
        });
        if (ratio < AR.cutBelow) {
          const next = Math.max(AR.floorMult, spendMult * (1 - AR.cutBy));
          if (next < spendMult - 1e-9) ruleMove = 'cut';
          spendMult = next; raiseStreak = 0;
        } else if (ratio > AR.raiseAbove) {
          // A lag on the upward "treat" rule, so one good year cannot raise it.
          raiseStreak++;
          if (raiseStreak >= AR.raiseLagYears) {
            const next = Math.min(AR.capMult, spendMult * (1 + AR.raiseBy));
            if (next > spendMult + 1e-9) ruleMove = 'raise';
            spendMult = next; raiseStreak = 0;
          }
        } else raiseStreak = 0;
        lastRatio = ratio;

        // The house is a parachute, not core funding: released once, late,
        // and only if the plan is genuinely off track.
        if (AR.parachuteOn && !parachuteUsed && ageA >= AR.parachuteFrom && ratio < AR.parachuteBelow) {
          const houseVal = (P.house || 0) * Math.pow(1 + (P.houseGrowth || 0), year - P.startYear);
          const release = clamp0(houseVal * AR.parachuteFraction);
          if (release > 0) {
            cash += release; wealth += release;
            parachuteUsed = true; parachuteYear = year;
            eventLabels.push('house released');
          }
        }
      }
      if (exhaustedYear == null && wealth < 100 && shortfall > 1) exhaustedYear = year;

      rows.push({
        year, ageA, ageB,
        dbA, dbB, spA, spB,
        guaranteed: baseA + baseB,
        grossA, grossB, tfcA, tfcB,
        taxA, taxB, tax: totalTax,
        isaDraw, isaDrawA, isaDrawB, cashDraw, dbLump,
        eventCost, eventInflow: eventIncome + eventInvested, eventLabels,
        target, netIncome, shortfall,
        potA, potB, isaA, isaB, cash, wealth,
        marginalA: marginalRate(baseA + grossA, T),
        marginalB: marginalRate(baseB + grossB, T),
        // Architecture (null / 0 when the overlay is off)
        fundedRatio: ratio, spendMult, ruleMove,
        ladder: ladderNow, engine: engineNow,
        careCost, annuity: annuityNom, blendedGrowth: gYear,
      });
    }

    const last = rows[rows.length - 1];
    return {
      rows, lifetimeTax, lifetimeTaxReal,
      exhaustedYear,
      exhaustedAgeA: exhaustedYear ? exhaustedYear - P.partnerA.birthYear : null,
      endWealth: last ? last.wealth : 0,
      endPots: last ? { potA: last.potA, potB: last.potB, isaA: last.isaA, isaB: last.isaB, cash: last.cash } : null,
      startPots: acc,
      architecture: archOn ? {
        on: true, spendMultFinal: spendMult, fundedRatioFinal: lastRatio,
        annuityIncomeToday: annuityToday, parachuteYear,
        ladderFinal: sleeve ? sleeve.ladder : 0, engineFinal: sleeve ? sleeve.growth : 0,
      } : { on: false },
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
        lifetimeTax: r.lifetimeTax,
        endWealth: r.endWealth,
        exhaustedAgeA: r.exhaustedAgeA,
      });
    }
    return out;
  }

  // ── Stress tests. Comparisons are in today's money so scenarios with
  //    different inflation assumptions stay comparable. ─────────────────
  function stressTests(P) {
    const horizonYear = P.partnerA.birthYear + P.horizonAge;
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
    run('Growth 2% below base', 'Sustained lower returns through both phases',
      (Q) => { Q.growth = P.growth - 0.02; });
    run('Growth at bear rate', 'The workbook bear scenario',
      (Q) => { Q.growth = P.growthBear; });
    run('Retire two years earlier', 'Two fewer years of growth and contributions',
      (Q) => { Q.retireYear = P.retireYear - 2; });
    run('Retire two years later', 'Two more years of growth and contributions',
      (Q) => { Q.retireYear = P.retireYear + 2; });
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
    const horizonYear = P.partnerA.birthYear + P.horizonAge;
    const real = (Q, r) => r.endWealth / Math.pow(1 + Q.inflation, horizonYear - Q.startYear);
    const measure = (Q) => {
      const dd = drawdown(Q);
      let conf = null;
      try { conf = runMonteCarlo(Q, paths, seed).successProb; } catch (e) { conf = null; }
      return { conf, end: real(Q, dd), exhaustedAgeA: dd.exhaustedAgeA };
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
        end: m.end, dEnd: m.end - base.end, exhaustedAgeA: m.exhaustedAgeA });
    };
    const yearsToGo = P.retireYear - P.startYear;
    cand('later1', 'Stop work one year later', 'One more year of growth and saving, one fewer to fund.',
      (Q) => { Q.retireYear += 1; });
    cand('spend3k', 'Spend £3,000 a year less', 'A little under £60 a week, for the whole retirement.',
      (Q) => { Q.targetNet = Math.max(10000, Q.targetNet - 3000); Q.spendingPlanOn = false; });
    cand('save250', 'Save £250 a month more until you stop', 'Into the pension, with growth on top.',
      (Q) => { Q.partnerA.monthlyPension += 250; }, yearsToGo >= 1);
    cand('parttime', 'Two years of part-time work after stopping, £10,000 a year', 'Bridges the early years so the pots can keep growing.',
      (Q) => { Q.lifeEvents = [...(Q.lifeEvents || []),
        { year: Q.retireYear, label: 'Part-time work', amount: 10000, kind: 'income', invest: false },
        { year: Q.retireYear + 1, label: 'Part-time work', amount: 10000, kind: 'income', invest: false }]; });
    cand('ease75', 'Ease spending by 10% from 75', 'The go-go / slow-go pattern most retirements actually follow.',
      (Q) => { Q.phase1On = true; Q.phase1Age = 75; Q.phase1Cut = 0.10; }, !P.phase1On);
    cand('phased', 'Take tax-free cash a little each year', 'A quarter of each draw tax-free lowers every year’s tax.',
      (Q) => { Q.pclsMode = 'phased'; }, P.pclsMode === 'none');
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
        endWealthReal: dd.endWealth / inflFactor(Q, Q.partnerA.birthYear + Q.horizonAge),
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
      const f = inflFactor(P, P.partnerA.birthYear + P.horizonAge);
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
    const horizonYear = P.partnerA.birthYear + P.horizonAge;
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
      (Q) => { Q.retireYear += 2; }, (Q) => { Q.retireYear -= 2; });
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
      isaDraws += r.isaDraw + r.cashDraw;
    }
    const startWealth = acc.pensionA + acc.pensionB + acc.isaA + acc.isaB + (acc.cash || 0);
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
    const year = atYear || (P.partnerA.birthYear + P.horizonAge);
    const row = dd.rows.find(r => r.year === year) || dd.rows[dd.rows.length - 1];
    const yearsOn = year - P.startYear;
    const house = P.house * Math.pow(1 + P.houseGrowth, yearsOn);
    const pensions = row ? row.potA + row.potB : 0;
    const isas = row ? row.isaA + row.isaB + row.cash : 0;
    const pensionsIn = P.iht.includePensions && year >= P.iht.pensionsInEstateFrom;
    const inScope = house + isas + (pensionsIn ? pensions : 0);
    // Residence nil-rate band tapers £1 per £2 of estate above £2m
    const persons = P.iht.couple ? 2 : 1;
    const rnrbTaperStart = 2000000;
    const rnrbFull = P.iht.residenceNRB * persons;
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

  // ── Monte Carlo on the drawdown phase ─────────────────────────────────
  // Mirrors the deterministic funding: per-partner pensions taxed on their
  // own bands, filled to the basic rate threshold, ISA pool for the excess,
  // events and inheritance indexed.
  function mulberry32(seed) {
    let s = seed >>> 0;
    return function () {
      s = (s + 0x6D2B79F5) | 0;
      let t = Math.imul(s ^ (s >>> 15), 1 | s);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function runMonteCarlo(P, nPaths, seed) {
    nPaths = nPaths || P.mcPaths || 1000;
    const rand = mulberry32(seed == null ? (P.mcSeed || 42) : seed);
    const T = P.tax;
    const acc = accumulate(P).atRetirement;
    const endYear = P.partnerA.birthYear + P.horizonAge;
    const nYears = endYear - P.retireYear + 1;
    const events = effectiveEvents(P);

    const solventAt = new Array(nYears).fill(0);
    const tracks = [];
    let successes = 0;
    const finals = [];
    const trims = [];

    // Architecture overlay: the ladder is what turns a bad sequence from a
    // failure into a dip, so it has to be modelled here, not just in the
    // deterministic run.
    const AR = archOf(P);
    const archOn = !!AR.on;
    const RATES = sleeveRates(AR, P, 0);
    const eqNomMean = (1 + AR.equityReal) * (1 + P.inflation) - 1;
    const goldNomMean = (1 + AR.goldReal) * (1 + P.inflation) - 1;
    const spendMults = [];
    const DBA = dbSchedule(P, P.partnerA), DBB = dbSchedule(P, P.partnerB);

    // Scoring the outcome that actually matters: the spending delivered.
    // Utility is standard CRRA, so a lean year hurts more than a plump year
    // helps — which is the whole reason anyone builds a structure.
    const gamma = Math.max(0, AR.riskAversion == null ? 4 : AR.riskAversion);
    const SPEND_FLOOR = 2000;      // keeps utility finite in a ruined year
    let utilSum = 0, utilN = 0;
    const avgSpends = [], worstRatios = [], leanShares = [];

    for (let p = 0; p < nPaths; p++) {
      let pathSpend = 0, pathYears = 0, pathWorstRatio = 1, pathLeanYears = 0;
      let potA = acc.pensionA, potB = acc.pensionB;
      let isa = acc.isaA + acc.isaB;
      let cash = acc.cash || 0;
      let ok = true, minCoverage = 1;
      const track = [];
      let sleeve = null, spendMult = 1, raiseStreak = 0;
      let annuityToday = 0, annuityBought = false, parachuteUsed = false;
      for (let i = 0; i < nYears; i++) {
        const year = P.retireYear + i;
        const infl = inflFactor(P, year);
        const ageA = year - P.partnerA.birthYear;
        const ageB = year - P.partnerB.birthYear;
        const spA = ageA >= P.partnerA.spAge ? P.partnerA.spAmount * infl : 0;
        const spB = ageB >= P.partnerB.spAge ? P.partnerB.spAmount * infl : 0;
        const dbA = DBA.incomeAt(year);
        const dbB = DBB.incomeAt(year);
        cash += DBA.lumpAt(year) + DBB.lumpAt(year);   // tax-free lump sums, as in drawdown
        const investStart = potA + potB + isa;
        if (archOn && AR.annuityOn && !annuityBought && year >= AR.annuityYear) {
          const cost = Math.min(clamp0(AR.annuityAmount) * infl, potA);
          potA -= cost;
          annuityToday = (cost * AR.annuityRate) / infl;
          annuityBought = true;
        }
        const annuityNom = annuityBought
          ? annuityToday * (AR.annuityIndexed ? infl : inflFactor(P, AR.annuityYear)) : 0;
        const baseA = spA + dbA + annuityNom, baseB = spB + dbB;
        const guaranteedNet = baseA + baseB - taxOn(baseA, T) - taxOn(baseB, T);

        let eventNet = 0;
        for (const ev of events) {
          if (ev.year !== year) continue;
          const amt = eventNominal(P, ev);
          if (ev.kind === 'cost') eventNet -= amt;
          else if (ev.invest) isa += amt;
          else eventNet += amt;
        }
        const planTarget = targetForYear(P, year);      // what the plan intends
        const target = planTarget * spendMult;          // what the rules allow
        if (archOn && AR.careOn && ageA >= AR.careFromAge && ageA < AR.careFromAge + AR.careYears) {
          eventNet -= clamp0(AR.careAnnual) * infl;
        }
        let need = clamp0(target - guaranteedNet - eventNet);

        // Pension draws to each partner's cheap bands, lower base first
        const draw = (base, pot, wantNet) => {
          if (pot <= 0.01 || wantNet <= 0.01) return { gross: 0, net: 0 };
          const ceil = clamp0(basicCeilFor(T) - base);
          const gross = Math.min(grossForNet(wantNet, base, T), pot, ceil);
          const net = gross - (taxOn(base + gross, T) - taxOn(base, T));
          return { gross, net };
        };
        // Allowance-first ordering: partner with lower base first
        const order = baseA <= baseB
          ? [['A', baseA], ['B', baseB]] : [['B', baseB], ['A', baseA]];
        // Cash (tax-free) first, mirroring the deterministic drawdown
        if (need > 0.5 && cash > 0) {
          const fromCash = Math.min(cash, need);
          cash -= fromCash; need -= fromCash;
        }
        for (const [who, base] of order) {
          if (need <= 0.5) break;
          const pot = who === 'A' ? potA : potB;
          const d = draw(base, pot, need);
          if (who === 'A') potA -= d.gross; else potB -= d.gross;
          need -= d.net;
        }
        if (need > 0.5) {
          const fromIsa = Math.min(isa, need);
          isa -= fromIsa; need -= fromIsa;
        }
        if (need > 0.5) {
          // Above basic rate as a last resort. Bases here are the original
          // guaranteed income; the basic band was already consumed above, so
          // gross up from the higher threshold.
          for (const [who, base] of order) {
            if (need <= 0.5) break;
            const pot = who === 'A' ? potA : potB;
            if (pot <= 0.01) continue;
            const from = Math.max(base, basicCeilFor(T));
            const gross = Math.min(grossForNet(need, from, T), pot);
            const net = gross - (taxOn(from + gross, T) - taxOn(from, T));
            if (who === 'A') potA -= gross; else potB -= gross;
            need -= net;
          }
        }
        // What this year actually paid for, in today's money. A year trimmed
        // by the rules counts as reduced spending, exactly like a year the
        // pots could not fund — otherwise a strategy that cuts spending
        // would score as a "success" for cutting it.
        const deliveredReal = clamp0(target - clamp0(need)) / infl;
        const planReal = planTarget / infl;
        pathSpend += deliveredReal;
        pathYears++;
        const ratio = planReal > 1 ? deliveredReal / planReal : 1;
        if (ratio < pathWorstRatio) pathWorstRatio = ratio;
        if (ratio < 0.99) pathLeanYears++;
        const c = Math.max(SPEND_FLOOR, deliveredReal);
        utilSum += gamma === 1 ? Math.log(c) : Math.pow(c, 1 - gamma) / (1 - gamma);
        utilN++;

        if (need > 1) {
          ok = false;
          const covered = clamp0(target - need) / Math.max(1, target);
          if (covered < minCoverage) minCoverage = covered;
        } else {
          solventAt[i]++;
        }
        // Random return, normal via Box-Muller, applied after draws as in
        // the deterministic engine
        const u1 = Math.max(rand(), 1e-12), u2 = rand();
        const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
        let r = P.mcMean + P.mcSd * z;

        if (archOn) {
          // Equity and gold drawn independently, so diversification earns its
          // place; index-linked gilts held to maturity are treated as known
          // in real terms — which is the whole argument for the envelopes.
          const u3 = Math.max(rand(), 1e-12), u4 = rand();
          const z2 = Math.sqrt(-2 * Math.log(u3)) * Math.cos(2 * Math.PI * u4);
          const rEq = eqNomMean + AR.equitySd * z;
          const rGold = goldNomMean + AR.goldSd * z2;
          const rGrowth = rEq * (1 - AR.goldPct) + rGold * AR.goldPct;
          const investAfter = potA + potB + isa;
          const drawn = clamp0(investStart - investAfter);
          const tgt = ladderTarget(AR, need > 0 ? target - guaranteedNet : clamp0(target - guaranteedNet), P.inflation);
          if (!sleeve) {
            const L = Math.min(investStart, tgt);
            sleeve = { ladder: L, growth: clamp0(investStart - L) };
          } else {
            const tot = sleeve.ladder + sleeve.growth;
            const k = tot > 1 ? investStart / tot : 1;
            sleeve = { ladder: sleeve.ladder * k, growth: sleeve.growth * k };
          }
          const next = sleeveYear(sleeve, drawn, rGrowth, RATES.gilt, tgt, AR);
          sleeve = { ladder: next.ladder, growth: next.growth };
          r = investAfter > 1 ? (next.total / investAfter) - 1 : 0;
        }

        potA = clamp0(potA * (1 + r));
        potB = clamp0(potB * (1 + r));
        isa = clamp0(isa * (1 + r));
        cash = clamp0(cash * (1 + (P.cashGrowth || 0)));   // fixed rate, not random

        if (archOn && AR.rulesOn) {
          const wealthNow = potA + potB + isa + cash;
          const ratio = fundedRatio(AR, {
            wealthReal: wealthNow / infl, spendReal: target / infl,
            guaranteedNetReal: guaranteedNet / infl, ageA,
          });
          if (ratio < AR.cutBelow) { spendMult = Math.max(AR.floorMult, spendMult * (1 - AR.cutBy)); raiseStreak = 0; }
          else if (ratio > AR.raiseAbove) {
            raiseStreak++;
            if (raiseStreak >= AR.raiseLagYears) { spendMult = Math.min(AR.capMult, spendMult * (1 + AR.raiseBy)); raiseStreak = 0; }
          } else raiseStreak = 0;
          if (AR.parachuteOn && !parachuteUsed && ageA >= AR.parachuteFrom && ratio < AR.parachuteBelow) {
            const houseVal = (P.house || 0) * Math.pow(1 + (P.houseGrowth || 0), year - P.startYear);
            cash += clamp0(houseVal * AR.parachuteFraction);
            parachuteUsed = true;
          }
        }
        if (p < 60) track.push(potA + potB + isa + cash);
      }
      spendMults.push(spendMult);
      avgSpends.push(pathYears ? pathSpend / pathYears : 0);
      worstRatios.push(pathWorstRatio);
      leanShares.push(pathYears ? pathLeanYears / pathYears : 0);
      if (ok) successes++;
      else trims.push(1 - minCoverage);
      finals.push(potA + potB + isa + cash);
      if (p < 60) tracks.push(track);
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
    return {
      nPaths,
      successProb: successes / nPaths,
      confidenceAge,
      threshold,
      perAgeSolvency: solventAt.map((c, i) => ({
        age: P.retireYear + i - P.partnerA.birthYear, p: c / nPaths,
      })),
      finalP10: pctile(0.10), finalP50: pctile(0.50), finalP90: pctile(0.90),
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
      const incA = r.spA + r.dbA + (r.annuity || 0) + r.grossA, incB = r.spB + r.dbB + r.grossB;
      check('Row tax = tax(A income) + tax(B income)', r.tax, taxOn(incA, T) + taxOn(incB, T), 0.5);
      check('…and is below the tax on the merged income (two allowances, two basic bands)',
        r.tax < taxOn(incA + incB, T) - 1 ? 0 : 1, 0, 0.1);
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
    levers, STRESS_PATHS,
  };
}

export const Engine = createEngine();
