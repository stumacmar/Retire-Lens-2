/**
 * RetireLens 4 engine.
 * Modelled directly on the Marshall Retirement Model workbook: same central
 * assumptions panel, same Bear/Base/Bull scenario framing, same nominal
 * figures with an inflation assumption, same income layering in drawdown.
 * Two deliberate improvements over the spreadsheet, both surfaced in the UI:
 *   1. Tax is computed per partner, using both personal allowances, instead
 *      of taxing the household as a single person.
 *   2. State pensions are treated as today's money and indexed from the
 *      start year, rather than starting flat in their first payment year.
 * All logic is pure and deterministic; the Monte Carlo takes a seed.
 * No em dashes anywhere. All figures nominal unless stated.
 */

export function createEngine() {

  // ── Tax constants (editable via assumptions) ─────────────────────────
  const TAX_DEFAULTS = {
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
      },

      growth: 0.07,             // the headline slider. Bear 4, Base 7, Bull 10
      growthBear: 0.04,
      growthBull: 0.10,
      inflation: 0.02,
      mcMean: 0.07,
      mcSd: 0.12,
      mcPaths: 1000,
      mcSeed: 42,

      // Property and chattels, tracked for net worth and estate only
      house: 750000,
      houseGrowth: 0.03,
      mortgage: 69000,
      mortgageMonthly: 1000,
      motorhome: 63000,
      motorhomeDepPerYear: 3000,
      cash: 0,

      // Income need
      targetNet: 60000,         // today's money, used when spending plan off
      spendingPlanOn: false,    // when true, expenditure builder drives target
      spending: defaultSpending(),
      // Age-phased reductions: from a chosen age, cut spending by a chosen %
      phase1Age: 75, phase1Cut: 0.10, phase1On: false,
      phase2Age: 85, phase2Cut: 0.20, phase2On: false,

      strategy: 'sippfirst',    // 'sippfirst' | 'isafirst' | 'blend'
      pclsMode: 'none',         // 'none' | 'upfront' | 'phased'

      lifeEvents: [
        // Example shape, list starts empty:
        // { year: 2032, label: 'New car', amount: 25000, kind: 'cost' }
        // { year: 2035, label: 'Inheritance', amount: 100000, kind: 'income', invest: true }
      ],

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

  function defaultSpending() {
    // Suite of monthly headings. Values default to a rough £5,000/month
    // split so the builder opens meaningfully; every cell is editable.
    return [
      { key: 'mortgage',   label: 'Mortgage or rent',            monthly: 1000 },
      { key: 'council',    label: 'Council tax',                 monthly: 250 },
      { key: 'utilities',  label: 'Utilities and energy',        monthly: 300 },
      { key: 'groceries',  label: 'Groceries',                   monthly: 650 },
      { key: 'transport',  label: 'Cars, fuel and travel',       monthly: 350 },
      { key: 'motorhome',  label: 'Motorhome running costs',     monthly: 250 },
      { key: 'insurance',  label: 'Insurance',                   monthly: 200 },
      { key: 'health',     label: 'Health and dental',           monthly: 150 },
      { key: 'phone',      label: 'Phone, broadband, subs',      monthly: 120 },
      { key: 'eatingout',  label: 'Eating out and takeaways',    monthly: 350 },
      { key: 'holidays',   label: 'Holidays',                    monthly: 600 },
      { key: 'leisure',    label: 'Hobbies and leisure',         monthly: 250 },
      { key: 'clothing',   label: 'Clothing',                    monthly: 130 },
      { key: 'gifts',      label: 'Gifts and family',            monthly: 250 },
      { key: 'misc',       label: 'Everything else',             monthly: 150 },
    ];
  }

  // ── Small helpers ─────────────────────────────────────────────────────
  const clamp0 = (x) => Math.max(0, x);
  const ageIn = (p, year) => year - p.birthYear;

  function spendingAnnual(P) {
    if (!P.spendingPlanOn) return P.targetNet;
    return P.spending.reduce((s, r) => s + (Number(r.monthly) || 0), 0) * 12;
  }

  function phaseFactor(P, ageA) {
    let f = 1;
    if (P.phase1On && ageA >= P.phase1Age) f *= (1 - P.phase1Cut);
    if (P.phase2On && ageA >= P.phase2Age) f *= (1 - P.phase2Cut);
    return f;
  }

  /** Net spending target for a calendar year, nominal. */
  function targetForYear(P, year) {
    const base = spendingAnnual(P);
    const infl = Math.pow(1 + P.inflation, year - P.startYear);
    return base * infl * phaseFactor(P, ageIn(P.partnerA, year));
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
    // Bands are measured in taxable income: basic to 37,700, higher to
    // 125,140, additional above. The taper alters the allowance, not the
    // band edges, which is what creates the 60 pence zone.
    const basicBand = T.higherThreshold - T.personalAllowance;      // 37700
    const higherBandTop = T.additionalThreshold;                    // 125140 taxable
    const inBasic = Math.min(taxable, basicBand);
    const inHigher = clamp0(Math.min(taxable, higherBandTop) - basicBand);
    const inAdditional = clamp0(taxable - higherBandTop);
    return inBasic * T.basicRate + inHigher * T.higherRate + inAdditional * T.additionalRate;
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

  // ── Accumulation: start year to retirement, year by year ─────────────
  // Mid-year convention on contributions. This reproduces the workbook's
  // future-value formulas to within about one percent and stays honest
  // when contributions change or life events land before retirement.
  function accumulate(P, growthOverride) {
    const g = growthOverride == null ? P.growth : growthOverride;
    const years = [];
    let a = { pension: P.partnerA.pension, isa: P.partnerA.isa };
    let b = { pension: P.partnerB.pension, isa: P.partnerB.isa };
    let cash = P.cash;
    let mort = P.mortgage;

    for (let y = P.startYear; y < P.retireYear; y++) {
      const contribHalf = 1 + g / 2;
      a.pension = a.pension * (1 + g) + P.partnerA.monthlyPension * 12 * contribHalf;
      a.isa = a.isa * (1 + g) + P.partnerA.monthlyIsa * 12 * contribHalf;
      b.pension = b.pension * (1 + g) + P.partnerB.monthlyPension * 12 * contribHalf;
      b.isa = b.isa * (1 + g) + P.partnerB.monthlyIsa * 12 * contribHalf;
      mort = clamp0(mort - P.mortgageMonthly * 12);
      // Pre-retirement life events
      for (const ev of P.lifeEvents) {
        if (ev.year === y) {
          const amt = Number(ev.amount) || 0;
          if (ev.kind === 'cost') {
            // Costs come from cash, then ISA A, then ISA B
            let rem = amt;
            const fromCash = Math.min(cash, rem); cash -= fromCash; rem -= fromCash;
            const fromA = Math.min(a.isa, rem); a.isa -= fromA; rem -= fromA;
            const fromB = Math.min(b.isa, rem); b.isa -= fromB; rem -= fromB;
          } else {
            if (ev.invest) a.isa += amt; else cash += amt;
          }
        }
      }
      years.push({
        year: y + 1,
        pensionA: a.pension, isaA: a.isa,
        pensionB: b.pension, isaB: b.isa,
        cash, mortgage: mort,
        house: P.house * Math.pow(1 + P.houseGrowth, y + 1 - P.startYear),
        motorhome: clamp0(P.motorhome - P.motorhomeDepPerYear * (y + 1 - P.startYear)),
      });
    }
    const last = years[years.length - 1] || {
      year: P.startYear, pensionA: a.pension, isaA: a.isa,
      pensionB: b.pension, isaB: b.isa, cash, mortgage: mort,
      house: P.house, motorhome: P.motorhome,
    };
    return { years, atRetirement: last };
  }

  // ── Drawdown: retirement to horizon, year by year ─────────────────────
  // Income layering exactly as the workbook: DB, then each state pension
  // as it activates, then pension drawdown for the shortfall, ISA for any
  // remainder. Strategy selects the order of taxable vs tax-free funding.
  function drawdown(P, opts) {
    opts = opts || {};
    const g = opts.growth == null ? P.growth : opts.growth;
    const T = P.tax;
    const acc = opts.startPots || accumulate(P, g).atRetirement;

    let potA = acc.pensionA, potB = acc.pensionB;
    let isaA = acc.isaA, isaB = acc.isaB;
    let cash = acc.cash || 0;
    let pclsUsedA = 0, pclsUsedB = 0;

    // PCLS upfront: crystallise everything at retirement, take 25% capped
    if (P.pclsMode === 'upfront') {
      const tfcA = Math.min(potA * 0.25, T.pclsCap);
      potA -= tfcA; isaA += 0; cash += tfcA; pclsUsedA = tfcA;
      const tfcB = Math.min(potB * 0.25, T.pclsCap);
      potB -= tfcB; cash += tfcB; pclsUsedB = tfcB;
    }

    const endYear = P.partnerA.birthYear + P.horizonAge;
    const rows = [];
    let lifetimeTax = 0, exhaustedYear = null;

    for (let year = P.retireYear; year <= endYear; year++) {
      const infl = Math.pow(1 + P.inflation, year - P.startYear);
      const ageA = ageIn(P.partnerA, year), ageB = ageIn(P.partnerB, year);

      // Guaranteed income per partner, nominal
      const dbA = (P.partnerA.db && year >= P.partnerA.dbStartYear)
        ? P.partnerA.db * (P.partnerA.dbIndexed ? infl : 1) : 0;
      const dbB = (P.partnerB.db && year >= P.partnerB.dbStartYear)
        ? P.partnerB.db * (P.partnerB.dbIndexed ? infl : 1) : 0;
      const spA = ageA >= P.partnerA.spAge ? P.partnerA.spAmount * infl : 0;
      const spB = ageB >= P.partnerB.spAge ? P.partnerB.spAmount * infl : 0;

      const baseA = dbA + spA;   // taxable base income per partner
      const baseB = dbB + spB;
      const taxOnBaseA = taxOn(baseA, T);
      const taxOnBaseB = taxOn(baseB, T);
      const guaranteedNet = baseA + baseB - taxOnBaseA - taxOnBaseB;

      // This year's net need
      let target = targetForYear(P, year);
      let eventCost = 0, eventIncome = 0, eventInvested = 0;
      const eventLabels = [];
      for (const ev of P.lifeEvents) {
        if (ev.year !== year || year < P.retireYear) continue;
        const amt = Number(ev.amount) || 0;
        eventLabels.push(ev.label || ev.kind);
        if (ev.kind === 'cost') eventCost += amt;
        else if (ev.invest) { eventInvested += amt; }
        else eventIncome += amt;
      }
      // Invested windfalls go into ISA A (largest tax-free wrapper available)
      isaA += eventInvested;

      let need = clamp0(target + eventCost - eventIncome - guaranteedNet);

      // Funding order by strategy
      let grossA = 0, grossB = 0, tfcA = 0, tfcB = 0, isaDraw = 0, cashDraw = 0;

      const drawIsa = (amt) => {
        let rem = amt;
        const c = Math.min(cash, rem); cash -= c; cashDraw += c; rem -= c;
        const fa = Math.min(isaA, rem); isaA -= fa; rem -= fa;
        const fb = Math.min(isaB, rem); isaB -= fb; rem -= fb;
        isaDraw += (amt - rem) - c;
        return amt - rem;
      };

      const drawPensionNet = (netWanted, caps) => {
        // Fill partner B's remaining allowance first (small pot, free tax),
        // then partner A. Phased PCLS: quarter of each draw tax-free until cap.
        // caps, when given, limit the net served per partner so a capped call
        // cannot push one partner past their basic rate band.
        let served = 0;
        const serve = (who) => {
          if (netWanted - served <= 0) return;
          const isA = who === 'A';
          let pot = isA ? potA : potB;
          if (pot <= 0.01) return;
          const base = (isA ? baseA : baseB) + (isA ? grossA : grossB);
          const pclsUsed = isA ? pclsUsedA : pclsUsedB;
          const pclsLeft = clamp0(T.pclsCap - pclsUsed);
          const phased = P.pclsMode === 'phased' && pclsLeft > 0;
          // Solve gross draw so net of tax covers the remainder
          let wantNet = netWanted - served;
          if (caps) wantNet = Math.min(wantNet, clamp0(caps[who]));
          if (wantNet <= 0) return;
          let gross;
          if (phased) {
            // 25% of the crystallised slice is tax-free
            let lo = 0, hi = Math.min(pot, wantNet * 2 + 100000);
            for (let i = 0; i < 50; i++) {
              const mid = (lo + hi) / 2;
              const tf = Math.min(mid * 0.25, pclsLeft);
              const taxable = mid - tf;
              const net = tf + taxable - (taxOn(base + taxable, T) - taxOn(base, T));
              if (net < wantNet) lo = mid; else hi = mid;
            }
            gross = Math.min((lo + hi) / 2, pot);
            const tf = Math.min(gross * 0.25, pclsLeft);
            if (isA) { pclsUsedA += tf; tfcA += tf; } else { pclsUsedB += tf; tfcB += tf; }
            const taxable = gross - tf;
            const net = tf + taxable - (taxOn(base + taxable, T) - taxOn(base, T));
            if (isA) { grossA += taxable; potA -= gross; } else { grossB += taxable; potB -= gross; }
            served += net;
          } else {
            gross = Math.min(grossForNet(wantNet, base, T), pot);
            const net = gross - (taxOn(base + gross, T) - taxOn(base, T));
            if (isA) { grossA += gross; potA -= gross; } else { grossB += gross; potB -= gross; }
            served += net;
          }
        };
        serve('B');
        serve('A');
        return served;
      };

      if (P.strategy === 'isafirst') {
        const fromIsa = drawIsa(need);
        const rem = need - fromIsa;
        if (rem > 0.01) drawPensionNet(rem);
      } else if (P.strategy === 'blend') {
        // Keep each partner at or below the basic rate band, ISA for excess
        const headroomA = clamp0(P.tax.higherThreshold - baseA);
        const headroomB = clamp0(P.tax.higherThreshold - baseB);
        const capNetA = headroomA - (taxOn(baseA + headroomA, T) - taxOn(baseA, T));
        const capNetB = headroomB - (taxOn(baseB + headroomB, T) - taxOn(baseB, T));
        const fromPension = drawPensionNet(Math.min(need, capNetA + capNetB), { A: capNetA, B: capNetB });
        const rem = need - fromPension;
        if (rem > 0.01) {
          const fromIsa = drawIsa(rem);
          if (rem - fromIsa > 0.01) drawPensionNet(rem - fromIsa);
        }
      } else {
        // sippfirst: pension up to the basic rate threshold, ISA for excess,
        // then pension again at higher rates only if the ISA runs dry.
        const headroomA = clamp0(P.tax.higherThreshold - baseA);
        const headroomB = clamp0(P.tax.higherThreshold - baseB);
        const capNetA = headroomA - (taxOn(baseA + headroomA, T) - taxOn(baseA, T));
        const capNetB = headroomB - (taxOn(baseB + headroomB, T) - taxOn(baseB, T));
        const basicNet = drawPensionNet(Math.min(need, capNetA + capNetB), { A: capNetA, B: capNetB });
        let rem = need - basicNet;
        if (rem > 0.01) {
          const fromIsa = drawIsa(rem);
          rem -= fromIsa;
          if (rem > 0.01) rem -= drawPensionNet(rem);
        }
      }

      const taxA = taxOn(baseA + grossA, T) - 0;
      const taxB = taxOn(baseB + grossB, T) - 0;
      const totalTax = taxA + taxB;
      lifetimeTax += totalTax;

      const netIncome = baseA + baseB + grossA + grossB + tfcA + tfcB
        - totalTax + isaDraw + cashDraw + eventIncome;
      const shortfall = clamp0(target + eventCost - netIncome);

      // Grow remaining pots
      potA *= (1 + g); potB *= (1 + g);
      isaA *= (1 + g); isaB *= (1 + g);

      const wealth = potA + potB + isaA + isaB + cash;
      if (exhaustedYear == null && wealth < 100 && shortfall > 1) exhaustedYear = year;

      rows.push({
        year, ageA, ageB,
        dbA, dbB, spA, spB,
        guaranteed: baseA + baseB,
        grossA, grossB, tfcA, tfcB,
        taxA, taxB, tax: totalTax,
        isaDraw, cashDraw,
        eventCost, eventIncome: eventIncome + eventInvested, eventLabels,
        target: target,
        netIncome, shortfall,
        potA, potB, isaA, isaB, cash, wealth,
        marginalA: marginalRate(baseA + grossA, T),
        marginalB: marginalRate(baseB + grossB, T),
      });
    }

    const last = rows[rows.length - 1];
    return {
      rows, lifetimeTax,
      exhaustedYear,
      exhaustedAgeA: exhaustedYear ? exhaustedYear - P.partnerA.birthYear : null,
      endWealth: last ? last.wealth : 0,
      endPots: last ? { potA: last.potA, potB: last.potB, isaA: last.isaA, isaB: last.isaB, cash: last.cash } : null,
      startPots: acc,
    };
  }

  // ── Strategy comparison (the Tax Optimisation tab) ────────────────────
  function compareStrategies(P) {
    const out = [];
    for (const s of [
      { id: 'sippfirst', label: 'Pension first to basic rate, ISA for excess' },
      { id: 'isafirst', label: 'ISA first, defer pensions' },
      { id: 'blend', label: 'Blend, both below higher rate' },
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

  // ── Stress tests (the workbook's scenarios, recomputed properly) ─────
  function stressTests(P) {
    const base = drawdown(P);
    const tests = [];
    const run = (label, mutate, note) => {
      const Q = JSON.parse(JSON.stringify(P));
      mutate(Q);
      const r = drawdown(Q, Q._crash ? { crashFirstYear: true } : undefined);
      tests.push({
        label, note,
        endWealth: r.endWealth,
        delta: r.endWealth - base.endWealth,
        exhaustedAgeA: r.exhaustedAgeA,
      });
    };
    run('Growth 2% below base', (Q) => { Q.growth = P.growth - 0.02; },
      'Sustained lower returns through both phases');
    run('Growth at bear rate', (Q) => { Q.growth = P.growthBear; },
      'The workbook bear scenario');
    run('Retire two years earlier', (Q) => { Q.retireYear = P.retireYear - 2; },
      'Two fewer years of growth and contributions');
    run('Retire two years later', (Q) => { Q.retireYear = P.retireYear + 2; },
      'Two more years of growth and contributions');
    run('No monthly contributions', (Q) => {
      Q.partnerA.monthlyPension = 0; Q.partnerA.monthlyIsa = 0;
      Q.partnerB.monthlyPension = 0; Q.partnerB.monthlyIsa = 0;
    }, 'Impact of stopping all saving today');
    run('Inflation at 4%', (Q) => { Q.inflation = 0.04; },
      'Spending and state pensions both inflate faster');
    run('Market crash, minus 30% at retirement', (Q) => {
      // Apply the crash to pots at retirement via a wrapped start
      const acc = accumulate(Q).atRetirement;
      Q._startPots = {
        ...acc,
        pensionA: acc.pensionA * 0.7, pensionB: acc.pensionB * 0.7,
        isaA: acc.isaA * 0.7, isaB: acc.isaB * 0.7,
      };
    }, 'Sequence of returns risk made concrete');
    // Recompute the crash entry with its custom pots
    const crashIdx = tests.length - 1;
    {
      const Q = JSON.parse(JSON.stringify(P));
      const acc = accumulate(Q).atRetirement;
      const shocked = {
        ...acc,
        pensionA: acc.pensionA * 0.7, pensionB: acc.pensionB * 0.7,
        isaA: acc.isaA * 0.7, isaB: acc.isaB * 0.7,
      };
      const r = drawdown(Q, { startPots: shocked });
      tests[crashIdx].endWealth = r.endWealth;
      tests[crashIdx].delta = r.endWealth - base.endWealth;
      tests[crashIdx].exhaustedAgeA = r.exhaustedAgeA;
    }
    return { base, tests };
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

  // ── Estate and IHT ────────────────────────────────────────────────────
  function estate(P, atYear) {
    const dd = drawdown(P);
    const year = atYear || (P.partnerA.birthYear + P.horizonAge);
    const row = dd.rows.find(r => r.year === year) || dd.rows[dd.rows.length - 1];
    const yearsOn = year - P.startYear;
    const house = P.house * Math.pow(1 + P.houseGrowth, yearsOn);
    const mortLeft = clamp0(P.mortgage - P.mortgageMonthly * 12 * yearsOn);
    const motorhome = clamp0(P.motorhome - P.motorhomeDepPerYear * yearsOn);
    const pensions = row ? row.potA + row.potB : 0;
    const isas = row ? row.isaA + row.isaB + row.cash : 0;
    const pensionsIn = P.iht.includePensions && year >= P.iht.pensionsInEstateFrom;
    const inScope = house - mortLeft + motorhome + isas + (pensionsIn ? pensions : 0);
    const nrb = (P.iht.nilRateBand + P.iht.residenceNRB) * (P.iht.couple ? 2 : 1);
    const taxable = clamp0(inScope - nrb);
    const iht = taxable * P.iht.rate;
    return {
      year, house, mortLeft, motorhome, pensions, isas,
      pensionsIn, inScope, nrb, taxable, iht,
      netToHeirs: inScope - iht + (pensionsIn ? 0 : pensions),
    };
  }

  // ── Monte Carlo on the drawdown phase ─────────────────────────────────
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
    const startWealthPension = acc.pensionA + acc.pensionB;
    const startWealthIsa = acc.isaA + acc.isaB + (acc.cash || 0);
    const endYear = P.partnerA.birthYear + P.horizonAge;
    const nYears = endYear - P.retireYear + 1;

    const solventAt = new Array(nYears).fill(0);
    const tracks = [];
    let successes = 0;
    const finals = [];
    const trims = [];

    for (let p = 0; p < nPaths; p++) {
      let pen = startWealthPension, isa = startWealthIsa;
      let ok = true, minCoverage = 1;
      const track = [];
      for (let i = 0; i < nYears; i++) {
        const year = P.retireYear + i;
        const infl = Math.pow(1 + P.inflation, year - P.startYear);
        const ageA = year - P.partnerA.birthYear;
        const ageB = year - P.partnerB.birthYear;
        const spA = ageA >= P.partnerA.spAge ? P.partnerA.spAmount * infl : 0;
        const spB = ageB >= P.partnerB.spAge ? P.partnerB.spAmount * infl : 0;
        const dbA = (P.partnerA.db && year >= P.partnerA.dbStartYear) ? P.partnerA.db * (P.partnerA.dbIndexed ? infl : 1) : 0;
        const dbB = (P.partnerB.db && year >= P.partnerB.dbStartYear) ? P.partnerB.db * (P.partnerB.dbIndexed ? infl : 1) : 0;
        const guaranteedGross = spA + spB + dbA + dbB;
        const guaranteedNet = guaranteedGross - taxOn(spA + dbA, T) - taxOn(spB + dbB, T);
        let eventNet = 0;
        for (const ev of P.lifeEvents) {
          if (ev.year === year) {
            const amt = Number(ev.amount) || 0;
            if (ev.kind === 'cost') eventNet -= amt;
            else if (ev.invest) isa += amt;
            else eventNet += amt;
          }
        }
        const target = targetForYear(P, year);
        let need = clamp0(target - guaranteedNet - eventNet);

        // Simple funding: ISA first for the amount above basic-rate net,
        // pension grossed up approximately at the blended rate
        const fromIsa = Math.min(isa, need * 0.25);
        isa -= fromIsa; need -= fromIsa;
        const gross = grossForNet(need, (spA + dbA), T);
        const available = Math.min(pen, gross);
        pen -= available;
        const served = available - (taxOn(spA + dbA + available, T) - taxOn(spA + dbA, T));
        let gap = clamp0(need - served);
        if (gap > 0.5) {
          const extraIsa = Math.min(isa, gap);
          isa -= extraIsa; gap -= extraIsa;
        }
        if (gap > 1) {
          ok = false;
          const covered = clamp0(target - gap) / Math.max(1, target);
          if (covered < minCoverage) minCoverage = covered;
        } else {
          solventAt[i]++;
        }
        // Correlated single-portfolio return, normal via Box-Muller
        const u1 = Math.max(rand(), 1e-12), u2 = rand();
        const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
        const r = P.mcMean + P.mcSd * z;
        pen = clamp0(pen * (1 + r));
        isa = clamp0(isa * (1 + r));
        if (p < 60) track.push(pen + isa);
      }
      if (ok) successes++;
      else trims.push(1 - minCoverage);
      finals.push(pen + isa);
      if (p < 60) tracks.push(track);
    }

    // Confidence age: first age where per-age solvency drops below threshold
    const threshold = 0.85;
    let confidenceAge = P.partnerA.birthYear + P.horizonAge;
    for (let i = 0; i < nYears; i++) {
      if (solventAt[i] / nPaths < threshold) {
        confidenceAge = P.retireYear + i - P.partnerA.birthYear;
        break;
      }
    }
    finals.sort((x, y) => x - y);
    const pct = (q) => finals[Math.min(finals.length - 1, Math.floor(q * finals.length))];
    trims.sort((x, y) => x - y);
    return {
      nPaths,
      successProb: successes / nPaths,
      confidenceAge,
      threshold,
      perAgeSolvency: solventAt.map((c, i) => ({
        age: P.retireYear + i - P.partnerA.birthYear, p: c / nPaths,
      })),
      finalP10: pct(0.10), finalP50: pct(0.50), finalP90: pct(0.90),
      medianTrim: trims.length ? trims[Math.floor(trims.length / 2)] : 0,
      tracks,
    };
  }

  // ── Load-time assertions, logged by the app ──────────────────────────
  function runAssertions() {
    const T = TAX_DEFAULTS;
    const out = [];
    const check = (name, got, want, tol) => {
      out.push({ name, pass: Math.abs(got - want) <= (tol || 0.51), got: Math.round(got * 100) / 100, want });
    };
    // Workbook Tax Optimisation r13: 40k draw + 17548 guaranteed = 57548
    // gross, tax 10451.2 as a single person
    check('Single person 57548 gross taxes 10451 (workbook parity)', taxOn(57548, T), 10451.2, 1);
    check('Single person 37548 gross taxes 4996 (workbook parity)', taxOn(37548, T), 4995.6, 1);
    check('PA intact at 100000', personalAllowanceFor(100000, T), 12570, 0.01);
    check('PA zero at 125140', personalAllowanceFor(125140, T), 0, 0.01);
    check('60% marginal inside taper', marginalRate(110000, T), 0.60, 0.005);
    return out;
  }

  return {
    defaults, defaultSpending,
    taxOn, personalAllowanceFor, grossForNet, marginalRate,
    spendingAnnual, phaseFactor, targetForYear,
    accumulate, drawdown, compareStrategies,
    stressTests, sensitivityGrid, estate,
    runMonteCarlo, runAssertions,
    TAX_DEFAULTS,
  };
}

export const Engine = createEngine();
