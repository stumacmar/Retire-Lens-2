/**
 * RetireLens 3, engine.js
 * Pure calculation engine: UK tax 2026/27, withdrawal sequencing, Monte Carlo.
 * Self-contained factory. No imports. Runs in browser, Web Worker, and node.
 * All figures per the stated 2026/27 specification. No National Insurance is
 * applied to pension income, because NI is not charged on pension income.
 */

export function createEngine() {

  const CFG = {
    taxYear: '2026/27',
    personalAllowance: 12570,
    taperThreshold: 100000,
    lsaCap: 268275,
    isaAnnualAllowance: 20000,
    annualAllowance: 60000,
    mpaa: 10000,
    // Band limits are on TAXABLE income. Lower limits equal the stated gross
    // thresholds minus the standard personal allowance. The final limit is
    // 125140 taxable, because the personal allowance is zero at that income.
    bands: {
      EN: [
        { name: 'Basic 20%', rate: 0.20, to: 37700 },
        { name: 'Higher 40%', rate: 0.40, to: 125140 },
        { name: 'Additional 45%', rate: 0.45, to: Infinity }
      ],
      SC: [
        { name: 'Starter 19%', rate: 0.19, to: 3967 },
        { name: 'Basic 20%', rate: 0.20, to: 16956 },
        { name: 'Intermediate 21%', rate: 0.21, to: 31092 },
        { name: 'Higher 42%', rate: 0.42, to: 62430 },
        { name: 'Advanced 45%', rate: 0.45, to: 125140 },
        { name: 'Top 48%', rate: 0.48, to: Infinity }
      ]
    },
    // Gross income ceiling for the "fill basic" stage of sequencing.
    basicCeiling: { EN: 50270, SC: 43662 },
    trapLow: 100000,
    trapHigh: 125140
  };

  // ── Tax ──────────────────────────────────────────────────────────────

  function personalAllowanceFor(gross) {
    if (gross <= CFG.taperThreshold) return CFG.personalAllowance;
    return Math.max(0, CFG.personalAllowance - (gross - CFG.taperThreshold) / 2);
  }

  function taxOnly(gross, residence) {
    const res = residence === 'SC' ? 'SC' : 'EN';
    const pa = personalAllowanceFor(gross);
    let taxable = Math.max(0, gross - pa);
    let prev = 0, tax = 0;
    for (const b of CFG.bands[res]) {
      if (taxable <= 0) break;
      const width = b.to - prev;
      const amt = Math.min(taxable, width);
      tax += amt * b.rate;
      taxable -= amt;
      prev = b.to;
    }
    return tax;
  }

  /**
   * computeTax(partner, grossNonSavingsIncome, residence, year)
   * partner is accepted for signature compatibility and future per-partner
   * adjustments, the calculation itself depends only on gross and residence.
   */
  function computeTax(partner, gross, residence, year) {
    const res = residence === 'SC' ? 'SC' : 'EN';
    const pa = personalAllowanceFor(gross);
    let taxable = Math.max(0, gross - pa);
    let prev = 0, tax = 0;
    const bandBreakdown = [];
    for (const b of CFG.bands[res]) {
      if (taxable <= 0) break;
      const width = b.to - prev;
      const amt = Math.min(taxable, width);
      const t = amt * b.rate;
      if (amt > 0) bandBreakdown.push({ bandName: b.name, rate: b.rate, amountInBand: amt, taxInBand: t });
      tax += t;
      taxable -= amt;
      prev = b.to;
    }
    const marginalRate = taxOnly(gross + 1, res) - taxOnly(gross, res);
    const effectiveRate = gross > 0 ? tax / gross : 0;
    return { tax, marginalRate, effectiveRate, bandBreakdown, personalAllowance: pa, taxableIncome: Math.max(0, gross - pa) };
  }

  function netOf(gross, res) { return gross - taxOnly(gross, res); }

  // ── Partner and household state ─────────────────────────────────────

  function mkPartnerState(p) {
    return {
      uncryst: p.sipp || 0,
      cryst: 0,
      isa: p.isa || 0,
      lsaUsed: 0,
      flexiAccessed: false
    };
  }

  function lsaRemaining(ps) { return Math.max(0, CFG.lsaCap - ps.lsaUsed); }

  function guaranteedGross(p, year) {
    const age = p.age2026 + (year - 2026);
    let g = 0;
    if ((p.spAmount || 0) > 0 && age >= (p.spAge || 67)) g += p.spAmount;
    if ((p.dbAmount || 0) > 0 && p.dbStartYear != null && year >= p.dbStartYear) g += p.dbAmount;
    return g;
  }

  // Draw taxable T out of the uncrystallised pot UFPLS style.
  // Each withdrawal is 25% tax-free while LSA remains, then fully taxable.
  // Returns { taxable, taxfree } actually achieved after balance limits.
  function drawTaxableUFPLS(ps, taxableWanted) {
    let taxable = 0, taxfree = 0;
    if (taxableWanted <= 0) return { taxable, taxfree };
    const lsa = lsaRemaining(ps);
    // Portion with 25% tax-free intact: gross X gives 0.75X taxable, 0.25X free.
    const maxTfGross = lsa > 0 ? lsa / 0.25 : 0;
    const grossForWantWithTf = taxableWanted / 0.75;
    let g1 = Math.min(grossForWantWithTf, maxTfGross, ps.uncryst);
    if (g1 > 0) {
      const tf = g1 * 0.25;
      taxfree += tf;
      taxable += g1 * 0.75;
      ps.uncryst -= g1;
      ps.lsaUsed += tf;
      ps.flexiAccessed = true;
    }
    let stillWant = taxableWanted - taxable;
    if (stillWant > 0 && ps.uncryst > 0) {
      const g2 = Math.min(stillWant, ps.uncryst);
      taxable += g2;
      ps.uncryst -= g2;
      ps.flexiAccessed = true;
    }
    return { taxable, taxfree };
  }

  // Crystallise amount X: PCLS is 25% of X capped by LSA, remainder to drawdown.
  function crystallise(ps, X) {
    X = Math.min(X, ps.uncryst);
    if (X <= 0) return { pcls: 0, toDrawdown: 0, capped: false };
    const idealPcls = X * 0.25;
    const pcls = Math.min(idealPcls, lsaRemaining(ps));
    const capped = pcls < idealPcls - 1e-9;
    ps.uncryst -= X;
    ps.cryst += X - pcls;
    ps.lsaUsed += pcls;
    ps.flexiAccessed = true;
    return { pcls, toDrawdown: X - pcls, capped };
  }

  function drawTaxableCryst(ps, amt) {
    const a = Math.min(amt, ps.cryst);
    ps.cryst -= a;
    ps.flexiAccessed = true;
    return a;
  }

  // Net gained by adding taxable T on top of existing base income.
  function netGain(base, T, res) {
    return netOf(base + T, res) - netOf(base, res);
  }

  // Find taxable T such that netGain(base,T) + estimated UFPLS tax-free bonus
  // meets netWanted, bounded by grossCeiling and available taxable capacity.
  function solveTaxableForNet(base, netWanted, grossCeilingT, res, tfPerTaxable) {
    if (netWanted <= 0 || grossCeilingT <= 0) return 0;
    const total = (T) => netGain(base, T, res) + T * tfPerTaxable;
    let lo = 0, hi = grossCeilingT;
    if (total(hi) <= netWanted) return hi;
    for (let i = 0; i < 48; i++) {
      const mid = (lo + hi) / 2;
      if (total(mid) < netWanted) lo = mid; else hi = mid;
    }
    return hi;
  }

  // ── Yearly sequencing ────────────────────────────────────────────────
  // Meets a net need from wrappers per the named strategy, mutating state.
  // Returns detail for the year.

  // Greedy marginal-rate allocator. Each slice of taxable income goes to the
  // partner whose next pound costs the least tax right now. This fills both
  // personal allowances every year, then both basic bands, and only enters
  // the taper trap when a hard ceiling of Infinity is passed as last resort.
  // ceilingFor: 'pa' fills to each partner's personal allowance,
  // a number is an absolute gross ceiling, 'pretrap' stops at 100000,
  // 'any' has no ceiling.
  function greedyFill(need, partners, states, bases, ceilingMode, useUFPLS) {
    let taxfreeTotal = 0;
    const draws = [0, 0];
    const SLICE = 250;
    const ceilingOf = (i) => {
      if (ceilingMode === 'pa') return personalAllowanceFor(bases[i]);
      if (ceilingMode === 'pretrap') return CFG.trapLow;
      if (ceilingMode === 'any') return Infinity;
      return ceilingMode; // absolute number
    };
    const capacityOf = (ps) => useUFPLS ? ps.uncryst + ps.cryst : ps.cryst + ps.uncryst;
    // Draw taxable T from a partner state, mutating it, returns achieved parts.
    const takeFrom = (i, T) => {
      const ps = states[i];
      let got = { taxable: 0, taxfree: 0 };
      if (useUFPLS && ps.uncryst > 0) {
        got = drawTaxableUFPLS(ps, T);
        if (got.taxable < T - 1e-6 && ps.cryst > 0) {
          got.taxable += drawTaxableCryst(ps, T - got.taxable);
        }
      } else {
        got.taxable = drawTaxableCryst(ps, T);
        if (got.taxable < T - 1e-6 && ps.uncryst > 0) {
          const more = drawTaxableUFPLS(ps, T - got.taxable);
          got.taxable += more.taxable; got.taxfree += more.taxfree;
        }
      }
      return got;
    };
    let guard = 0;
    while (need > 0.01 && guard++ < 20000) {
      // Find the minimum marginal rate among partners with room and capacity.
      let minMarg = Infinity;
      const margs = [Infinity, Infinity];
      for (const i of [0, 1]) {
        const room = ceilingOf(i) - bases[i];
        if (room <= 0.01 || capacityOf(states[i]) <= 0.01) continue;
        margs[i] = taxOnly(bases[i] + 1, partners[i].residence) - taxOnly(bases[i], partners[i].residence);
        if (margs[i] < minMarg) minMarg = margs[i];
      }
      if (minMarg === Infinity) break;
      // All partners in the cheapest tier draw together, proportional to
      // remaining capacity. This keeps pot depletion synchronised, which
      // smooths each partner's income across years. Progressive tax is
      // convex, so smooth draws never pay more lifetime tax than lumpy ones.
      const tier = [0, 1].filter(i => Math.abs(margs[i] - minMarg) < 1e-9);
      const capSum = tier.reduce((s, i) => s + capacityOf(states[i]), 0);
      let progressed = false;
      for (const i of tier) {
        if (need <= 0.01) break;
        const ps = states[i], res = partners[i].residence;
        const room = ceilingOf(i) - bases[i];
        const share = capacityOf(ps) / capSum;
        const tfRatio = (useUFPLS && ps.uncryst > 0 && lsaRemaining(ps) > 0) ? (0.25 / 0.75) : 0;
        let T = Math.min(SLICE * share, room, capacityOf(ps));
        const sliceNet = netGain(bases[i], T, res) + T * tfRatio;
        if (sliceNet > need) {
          T = solveTaxableForNet(bases[i], need, Math.min(room, capacityOf(ps)), res, tfRatio);
        }
        if (T <= 0.005) continue;
        const got = takeFrom(i, T);
        if (got.taxable + got.taxfree <= 0.001) continue;
        const gained = netGain(bases[i], got.taxable, res) + got.taxfree;
        bases[i] += got.taxable;
        taxfreeTotal += got.taxfree;
        need -= gained;
        draws[i] += got.taxable + got.taxfree;
        progressed = true;
      }
      if (!progressed) break;
    }
    return { need: Math.max(0, need), taxfreeTotal, draws };
  }

  function drainIsaCash(need, states, hh) {
    let isaUsed = 0, cashUsed = 0;
    if (need > 0 && hh.cashBal > 0) {
      cashUsed = Math.min(need, hh.cashBal);
      hh.cashBal -= cashUsed;
      need -= cashUsed;
    }
    if (need > 0) {
      const totalIsa = states[0].isa + states[1].isa;
      if (totalIsa > 0) {
        const take = Math.min(need, totalIsa);
        const shareA = states[0].isa / totalIsa;
        const a = Math.min(states[0].isa, take * shareA);
        const b = Math.min(states[1].isa, take - a);
        states[0].isa -= a; states[1].isa -= b;
        isaUsed = a + b;
        need -= isaUsed;
      }
    }
    return { need: Math.max(0, need), isaUsed, cashUsed };
  }

  function simulateYear(strategyId, pclsCeiling, params, states, hh, year, warnings) {
    const [pA, pB] = [params.partnerA, params.partnerB];
    const partners = [pA, pB];
    const gA = guaranteedGross(pA, year);
    const gB = guaranteedGross(pB, year);
    const bases = [gA, gB];
    const retired = year >= Math.min(pA.retireYear, pB.retireYear);
    const target = retired ? params.household.targetNet : 0;

    // Pre-retirement contributions, capped at Annual Allowance, MPAA if accessed.
    [0, 1].forEach(i => {
      const p = partners[i];
      if (year < p.retireYear && (p.contrib || 0) > 0) {
        const cap = states[i].flexiAccessed ? CFG.mpaa : CFG.annualAllowance;
        if ((p.contrib || 0) > cap) warnings.add(i === 0 ? 'A contribution capped by allowance' : 'B contribution capped by allowance');
        states[i].uncryst += Math.min(p.contrib, cap);
      }
    });

    let netGuaranteed = netOf(gA, pA.residence) + netOf(gB, pB.residence);
    let need = Math.max(0, target - netGuaranteed);
    let taxfree = 0, isaUsed = 0, cashUsed = 0;
    const drawTotals = [0, 0];

    if (retired && need > 0) {
      if (strategyId === 'isabridge') {
        const d = drainIsaCash(need, states, hh);
        need = d.need; isaUsed += d.isaUsed; cashUsed += d.cashUsed;
        if (need > 0) {
          let r = greedyFill(need, partners, states, bases, 'pretrap', true);
          need = r.need; taxfree += r.taxfreeTotal;
          drawTotals[0] += r.draws[0]; drawTotals[1] += r.draws[1];
          if (need > 0) {
            r = greedyFill(need, partners, states, bases, 'any', true);
            need = r.need; taxfree += r.taxfreeTotal;
            drawTotals[0] += r.draws[0]; drawTotals[1] += r.draws[1];
          }
        }
      } else if (strategyId === 'pcls') {
        // Stage 1: taxable to fill each personal allowance, cheapest income.
        let r = greedyFill(need, partners, states, bases, 'pa', false);
        need = r.need; taxfree += r.taxfreeTotal;
        drawTotals[0] += r.draws[0]; drawTotals[1] += r.draws[1];
        // Stage 2: tax-free PCLS slices while LSA remains, larger pot first.
        const order = states[0].uncryst >= states[1].uncryst ? [0, 1] : [1, 0];
        for (const i of order) {
          if (need <= 1e-9) break;
          const ps = states[i];
          if (ps.uncryst <= 0 || lsaRemaining(ps) <= 0) continue;
          // Need pcls P, so crystallise X = 4P.
          const wantX = Math.min(need * 4, ps.uncryst);
          const c = crystallise(ps, wantX);
          if (c.capped) warnings.add('PCLS lifetime allowance cap reached for ' + (i === 0 ? 'Partner A' : 'Partner B'));
          taxfree += c.pcls;
          need -= c.pcls;
          drawTotals[i] += c.pcls;
        }
        // Stage 3: taxable drawdown up to the chosen gross ceiling.
        if (need > 0) {
          const ceil = pclsCeiling || CFG.basicCeiling.EN;
          const r3 = greedyFill(need, partners, states, bases, ceil, false);
          need = r3.need; taxfree += r3.taxfreeTotal;
          drawTotals[0] += r3.draws[0]; drawTotals[1] += r3.draws[1];
        }
        // Stage 4: ISA and cash.
        if (need > 0) {
          const d = drainIsaCash(need, states, hh);
          need = d.need; isaUsed += d.isaUsed; cashUsed += d.cashUsed;
        }
        // Stage 5: taxable beyond ceiling if still short, trap zone last.
        if (need > 0) {
          let r5 = greedyFill(need, partners, states, bases, 'pretrap', false);
          need = r5.need; taxfree += r5.taxfreeTotal;
          drawTotals[0] += r5.draws[0]; drawTotals[1] += r5.draws[1];
          if (need > 0) {
            r5 = greedyFill(need, partners, states, bases, 'any', false);
            need = r5.need; taxfree += r5.taxfreeTotal;
            drawTotals[0] += r5.draws[0]; drawTotals[1] += r5.draws[1];
          }
        }
      } else if (strategyId === 'naive') {
        // Proportional gross UFPLS draw across both SIPPs, no band awareness.
        const capA = states[0].uncryst + states[0].cryst;
        const capB = states[1].uncryst + states[1].cryst;
        const capTot = capA + capB;
        if (capTot > 0) {
          // Binary search total taxable T split proportionally.
          const shareA = capA / capTot;
          const tfR = (i) => (states[i].uncryst > 0 && lsaRemaining(states[i]) > 0) ? 0.25 / 0.75 : 0;
          const totalNet = (T) => {
            const Ta = T * shareA, Tb = T - Ta;
            return netGain(bases[0], Ta, pA.residence) + Ta * tfR(0)
                 + netGain(bases[1], Tb, pB.residence) + Tb * tfR(1);
          };
          let lo = 0, hi = capTot;
          if (totalNet(hi) > need) {
            for (let i = 0; i < 48; i++) {
              const mid = (lo + hi) / 2;
              if (totalNet(mid) < need) lo = mid; else hi = mid;
            }
          }
          const T = Math.min(hi, capTot);
          const Ta = Math.min(T * shareA, capA), Tb = Math.min(T - Ta, capB);
          const ga = drawTaxableUFPLS(states[0], Ta);
          let gaT = ga.taxable;
          if (gaT < Ta - 1e-6) gaT += drawTaxableCryst(states[0], Ta - gaT);
          const gb = drawTaxableUFPLS(states[1], Tb);
          let gbT = gb.taxable;
          if (gbT < Tb - 1e-6) gbT += drawTaxableCryst(states[1], Tb - gbT);
          const gained = netGain(bases[0], gaT, pA.residence) + ga.taxfree
                       + netGain(bases[1], gbT, pB.residence) + gb.taxfree;
          bases[0] += gaT; bases[1] += gbT;
          taxfree += ga.taxfree + gb.taxfree;
          need -= gained;
          drawTotals[0] += gaT + ga.taxfree; drawTotals[1] += gbT + gb.taxfree;
        }
        if (need > 0) {
          const d = drainIsaCash(need, states, hh);
          need = d.need; isaUsed += d.isaUsed; cashUsed += d.cashUsed;
        }
      } else {
        // bandfill, needs based: greedy fill of both personal allowances and
        // basic bands first, then ISA and cash, then above basic avoiding the
        // taper trap, trap zone only as last resort.
        const basicCeil = Math.max(CFG.basicCeiling[pA.residence], CFG.basicCeiling[pB.residence]);
        let r = greedyFill(need, partners, states, bases, basicCeil, true);
        need = r.need; taxfree += r.taxfreeTotal;
        drawTotals[0] += r.draws[0]; drawTotals[1] += r.draws[1];
        if (need > 0) {
          const d = drainIsaCash(need, states, hh);
          need = d.need; isaUsed += d.isaUsed; cashUsed += d.cashUsed;
        }
        if (need > 0) {
          let r2 = greedyFill(need, partners, states, bases, 'pretrap', true);
          need = r2.need; taxfree += r2.taxfreeTotal;
          drawTotals[0] += r2.draws[0]; drawTotals[1] += r2.draws[1];
          if (need > 0) {
            r2 = greedyFill(need, partners, states, bases, 'any', true);
            need = r2.need; taxfree += r2.taxfreeTotal;
            drawTotals[0] += r2.draws[0]; drawTotals[1] += r2.draws[1];
          }
        }
      }
    }

    // Band-Fill surplus recycling: when guaranteed income alone exceeds the
    // target, park the surplus into ISA, capped at the ISA annual allowance.
    if (retired && (strategyId === 'bandfill' || strategyId === '_bandfill_greedy') && netGuaranteed > target) {
      let surplus = netGuaranteed - target;
      for (const i of [0, 1]) {
        const room = CFG.isaAnnualAllowance;
        const put = Math.min(surplus / (i === 0 ? 2 : 1), room);
        states[i].isa += put;
        surplus -= put;
      }
      if (surplus > 0) hh.cashBal += surplus;
    }

    if (bases[0] > CFG.trapLow && bases[0] < CFG.trapHigh) warnings.add('Partner A entered the tapered allowance zone');
    if (bases[1] > CFG.trapLow && bases[1] < CFG.trapHigh) warnings.add('Partner B entered the tapered allowance zone');

    const taxA = taxOnly(bases[0], pA.residence);
    const taxB = taxOnly(bases[1], pB.residence);
    const netDelivered = (bases[0] - taxA) + (bases[1] - taxB) + taxfree + isaUsed + cashUsed;
    const shortfall = retired ? Math.max(0, target - netDelivered) : 0;

    return {
      year,
      ageA: pA.age2026 + (year - 2026),
      ageB: pB.age2026 + (year - 2026),
      guaranteed: gA + gB,
      grossA: bases[0], grossB: bases[1],
      taxA, taxB,
      taxfree, isaUsed, cashUsed,
      drawA: drawTotals[0], drawB: drawTotals[1],
      netDelivered: retired ? Math.min(netDelivered, Math.max(target, netDelivered)) : netDelivered,
      shortfall,
      retired
    };
  }

  // ── Full plan run ────────────────────────────────────────────────────

  function runPlan(params, strategyId, opts = {}) {
    // Band-Fill is an ensemble policy: the per-year greedy band filler is
    // optimal within a single year, but in narrow Scottish band ladders a
    // myopic greedy can drain the smaller pot early and lose that partner's
    // cheap bands for every later year. So Band-Fill runs both the greedy
    // and the proportional allocation and adopts whichever pays less
    // lifetime tax. It therefore never pays more than the naive draw.
    if (strategyId === 'bandfill' && !opts._noEnsemble) {
      // Memoise the return sequence so both candidate runs see identical
      // market paths, essential when the caller passes a stochastic returnFn.
      const cache = [];
      const baseFn = opts.returnFn || (() => ({
        rs: params.household.returns.sippMean,
        ri: params.household.returns.isaMean,
        rc: params.household.returns.cashMean
      }));
      const memoFn = (i) => (cache[i] = cache[i] || baseFn(i));
      const g = runPlan(params, '_bandfill_greedy', { ...opts, returnFn: memoFn, _noEnsemble: true });
      const n = runPlan(params, 'naive', { ...opts, returnFn: memoFn, _noEnsemble: true });
      const win = g.lifetimeTax <= n.lifetimeTax ? g : n;
      win.strategyId = 'bandfill';
      win.variant = g.lifetimeTax <= n.lifetimeTax ? 'greedy' : 'proportional';
      return win;
    }
    const pclsCeiling = opts.pclsCeiling || CFG.basicCeiling.EN;
    const returnFn = opts.returnFn || (() => ({
      rs: params.household.returns.sippMean,
      ri: params.household.returns.isaMean,
      rc: params.household.returns.cashMean
    }));
    const states = [mkPartnerState(params.partnerA), mkPartnerState(params.partnerB)];
    const hh = { cashBal: params.household.cash || 0 };
    const warnings = new Set();
    const rows = [];
    const startYear = params.household.startYear;
    const endYear = startYear + (params.household.planEndAgeA - params.partnerA.age2026);
    let lifetimeTax = 0, exhaustAge = null;

    for (let year = startYear; year <= endYear; year++) {
      const row = simulateYear(strategyId, pclsCeiling, params, states, hh, year, warnings);
      lifetimeTax += row.taxA + row.taxB;
      const wealth = states[0].uncryst + states[0].cryst + states[0].isa
                   + states[1].uncryst + states[1].cryst + states[1].isa + hh.cashBal;
      row.wealth = wealth;
      row.wealthA = states[0].uncryst + states[0].cryst + states[0].isa;
      row.wealthB = states[1].uncryst + states[1].cryst + states[1].isa;
      if (row.shortfall > 1 && exhaustAge === null && wealth < 1) exhaustAge = row.ageA;
      rows.push(row);
      // Growth at end of year, real terms.
      const r = returnFn(year - startYear);
      states.forEach(ps => {
        ps.uncryst *= (1 + r.rs);
        ps.cryst *= (1 + r.rs);
        ps.isa *= (1 + r.ri);
      });
      hh.cashBal *= (1 + r.rc);
    }

    const estate = rows.length ? rows[rows.length - 1].wealth : 0;
    return { rows, lifetimeTax, exhaustAge, estate, warnings: [...warnings], strategyId, pclsCeiling };
  }

  // ── Strategy frontier ────────────────────────────────────────────────

  function buildFrontier(params) {
    const points = [];
    const add = (id, label, opts) => {
      const r = runPlan(params, id, opts);
      points.push({ id, label, opts: opts || {}, tax: r.lifetimeTax, estate: r.estate, exhaustAge: r.exhaustAge });
    };
    add('bandfill', 'Band-Fill');
    add('isabridge', 'ISA-Bridge');
    add('naive', 'Naive proportional');
    for (const c of [20000, 30000, 43662, 50270, 60000, 75000, 100000]) {
      add('pcls', 'PCLS-Phased to ' + Math.round(c / 1000) + 'k', { pclsCeiling: c });
    }
    // Pareto set: minimise tax, maximise longevity and estate jointly.
    // A plan that never exhausts counts as exhausting at Infinity. Without the
    // longevity axis, any scenario where every strategy runs dry (estate 0 for
    // all) would collapse the frontier to a single cheapest point.
    const life = (p) => (p.exhaustAge == null ? Infinity : p.exhaustAge);
    const sorted = [...points].sort((a, b) => a.tax - b.tax);
    const frontier = [];
    for (const p of sorted) {
      const dominated = frontier.some(q =>
        q.estate >= p.estate - 0.01 && life(q) >= life(p));
      if (!dominated) frontier.push(p);
    }
    return { points, frontier };
  }

  // ── Monte Carlo ──────────────────────────────────────────────────────

  function mulberry32(seed) {
    let s = seed >>> 0;
    return function () {
      s = (s + 0x6D2B79F5) | 0;
      let t = Math.imul(s ^ (s >>> 15), 1 | s);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function runMonteCarlo(params, strategyId, pclsCeiling, nPaths, seed, threshold) {
    nPaths = nPaths || 1000;
    threshold = threshold || 0.85;
    const R = params.household.returns;
    const startYear = params.household.startYear;
    const nYears = params.household.planEndAgeA - params.partnerA.age2026 + 1;
    const solventAtAge = new Array(nYears).fill(0);
    const finalWealths = [];
    const wealthPercentileTracks = [];
    const trims = [];
    let successes = 0;
    const sampleTracks = [];

    for (let p = 0; p < nPaths; p++) {
      const rng = mulberry32((seed || 42) + p * 7919);
      const gauss = () => {
        let u = 0, v = 0;
        while (u === 0) u = rng();
        while (v === 0) v = rng();
        return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
      };
      const rho = R.corr != null ? R.corr : 0.8;
      const returnFn = () => {
        const z1 = gauss(), z2 = gauss();
        const rs = R.sippMean + R.sippVol * z1;
        const ri = R.isaMean + R.isaVol * (rho * z1 + Math.sqrt(1 - rho * rho) * z2);
        return { rs, ri, rc: R.cashMean };
      };
      const run = runPlan(params, strategyId, { pclsCeiling, returnFn });
      let solvent = true, totalShort = 0, retiredYears = 0, failYearIdx = null;
      run.rows.forEach((row, i) => {
        if (row.retired) retiredYears++;
        if (row.shortfall > 1) {
          if (solvent && failYearIdx === null) failYearIdx = i;
          solvent = false;
          totalShort += row.shortfall;
        }
        if (solvent) solventAtAge[i]++;
      });
      // Once failed, later ages are not solvent, already handled by flag.
      if (solvent) successes++;
      else {
        const remYears = run.rows.length - (failYearIdx || 0);
        const trim = remYears > 0 ? Math.min(1, totalShort / (remYears * params.household.targetNet)) : 0;
        trims.push(trim);
      }
      finalWealths.push(run.rows[run.rows.length - 1].wealth);
      if (p < 200) sampleTracks.push(run.rows.map(r => r.wealth));
      wealthPercentileTracks.push(run.rows.map(r => r.wealth));
    }

    const perAge = solventAtAge.map(c => c / nPaths);
    let confidenceAge = params.household.planEndAgeA;
    for (let i = 0; i < perAge.length; i++) {
      if (perAge[i] < threshold) { confidenceAge = params.partnerA.age2026 + i; break; }
    }
    // Percentile envelopes per year.
    const pct = (arr, q) => {
      const s = [...arr].sort((a, b) => a - b);
      const idx = Math.min(s.length - 1, Math.max(0, Math.floor(q * s.length)));
      return s[idx];
    };
    const envelopes = [];
    for (let i = 0; i < nYears; i++) {
      const col = wealthPercentileTracks.map(t => t[i]);
      envelopes.push({ ageA: params.partnerA.age2026 + i, p10: pct(col, 0.10), p50: pct(col, 0.50), p90: pct(col, 0.90) });
    }
    trims.sort((a, b) => a - b);
    const medianTrim = trims.length ? trims[Math.floor(trims.length / 2)] : 0;
    return {
      nPaths,
      successProb: successes / nPaths,
      perAgeSuccess: perAge.map((s, i) => ({ ageA: params.partnerA.age2026 + i, p: s })),
      confidenceAge,
      threshold,
      medianTrim,
      failCount: nPaths - successes,
      envelopes
    };
  }

  // ── Load-time assertions against known points ────────────────────────

  function runAssertions() {
    const out = [];
    const near = (a, b, tol) => Math.abs(a - b) <= (tol || 2);

    // England 120000: PA 2570 and 60% marginal on the top slice.
    const e120 = computeTax(null, 120000, 'EN', '2026/27');
    out.push({
      name: 'England 120000: personal allowance 2570',
      pass: near(e120.personalAllowance, 2570, 0.5),
      detail: 'computed PA ' + e120.personalAllowance.toFixed(2)
    });
    out.push({
      name: 'England 120000: marginal rate 60% in taper zone',
      pass: near(e120.marginalRate, 0.60, 0.005),
      detail: 'computed marginal ' + (e120.marginalRate * 100).toFixed(2) + '%'
    });

    // England 120000 total tax. Arithmetic from the stated bands:
    // taxable 117430, basic 37700 at 20% is 7540, remaining 79730 at 40% is 31892,
    // total 39432. The build specification said about 40432, which does not match
    // the stated bands, difference 1000, documented in CRITIQUE.md.
    out.push({
      name: 'England 120000: total tax 39432 (spec said about 40432, see CRITIQUE.md)',
      pass: near(e120.tax, 39432, 2),
      detail: 'computed tax ' + e120.tax.toFixed(2)
    });

    // Scotland 80000: 45% on the slice above 75000.
    const s80 = computeTax(null, 80000, 'SC', '2026/27');
    const adv = s80.bandBreakdown.find(b => b.bandName.indexOf('Advanced') === 0);
    out.push({
      name: 'Scotland 80000: 5000 taxed at 45% above the 75000 threshold',
      pass: !!adv && near(adv.amountInBand, 5000, 2) && near(adv.rate, 0.45, 0.0001),
      detail: adv ? ('advanced slice ' + adv.amountInBand.toFixed(2) + ' at ' + (adv.rate * 100) + '%') : 'advanced band not reached'
    });

    // England 52000: higher rate with correct split.
    const e52 = computeTax(null, 52000, 'EN', '2026/27');
    const basic = e52.bandBreakdown.find(b => b.bandName.indexOf('Basic') === 0);
    const higher = e52.bandBreakdown.find(b => b.bandName.indexOf('Higher') === 0);
    out.push({
      name: 'England 52000: 37700 basic plus 1730 higher, tax 8232, marginal 40%',
      pass: !!basic && !!higher && near(basic.amountInBand, 37700, 1) && near(higher.amountInBand, 1730, 1)
        && near(e52.tax, 8232, 2) && near(e52.marginalRate, 0.40, 0.005),
      detail: 'tax ' + e52.tax.toFixed(2) + ', marginal ' + (e52.marginalRate * 100).toFixed(1) + '%'
    });

    return out;
  }

  // ── Default persona ──────────────────────────────────────────────────

  function defaultParams() {
    return {
      partnerA: {
        name: 'Partner A', age2026: 56, retireYear: 2030, residence: 'EN',
        sipp: 570000, isa: 46000,
        spAmount: 12547, spAge: 67, dbAmount: 0, dbStartYear: null, contrib: 0
      },
      partnerB: {
        name: 'Partner B', age2026: 63, retireYear: 2030, residence: 'EN',
        sipp: 47000, isa: 45000,
        spAmount: 12547, spAge: 67, dbAmount: 3205, dbStartYear: 2030, contrib: 0
      },
      household: {
        cash: 10000, targetNet: 60000, startYear: 2026, planEndAgeA: 95,
        confidence: 0.85,
        returns: { sippMean: 0.03, sippVol: 0.15, isaMean: 0.03, isaVol: 0.12, corr: 0.8, cashMean: 0.0 }
      }
    };
  }

  return {
    CFG, computeTax, taxOnly, personalAllowanceFor, netOf,
    runPlan, buildFrontier, runMonteCarlo, runAssertions, defaultParams,
    mkPartnerState, guaranteedGross
  };
}

export const Engine = createEngine();
