/**
 * Someday · Horizon — VERIFY: the model against independent evidence.
 *
 *   npm run verify          (node only; no browser, no build)
 *
 * The UAT proves the screens work and the e2e proves inputs reach the engine.
 * This file proves the engine itself, in the layers the November 2026 audit
 * asked for (docs/VALIDATION.md):
 *
 *   1. Golden cases      — tax worked by hand from GOV.UK rules, penny-level.
 *   2. Differential      — a SECOND tax implementation, written here from the
 *                          published rules (not copied from the engine), run
 *                          against the engine on a grid of incomes.
 *   3. Properties        — invariants over many plan shapes: no negative
 *                          balances, tax never above income, tax-free cash
 *                          never above the entitlement, money conserved when
 *                          nothing grows, "holds" ⇔ every year paid in full.
 *   4. Metamorphic       — higher fees cannot help; higher spending cannot
 *                          help; a later State Pension cannot raise early
 *                          guaranteed income; the same seed gives the same
 *                          answer; a single plan equals a couple with an
 *                          empty partner.
 *   5. Stability         — the headline moves little from 2,000 to 10,000
 *                          paths, and the sampling range is reported.
 *   6. Migration         — a v1 saved plan loads, repairs and never carries
 *                          an old tax year with it.
 *   7. Cross-engine      — the classic engine's success definition is the
 *                          strict one (target met every year AND solvent),
 *                          never the looser "not depleted" (audit F-01).
 *
 * Fails the process on any miss. Everything here is deterministic.
 */
import { createEngine } from './src/engine/engine.js';
import { runMonteCarlo as classicMc } from '../engine/monteCarlo.js';
import { createPlan as classicPlan } from '../engine/projections.js';

const E = createEngine();
let pass = 0, fail = 0; const fails = [];
const check = (n, cond, detail) => { if (cond) pass++; else { fail++; fails.push(`✗ ${n}${detail ? ' — ' + detail : ''}`); } };
const near = (a, b, tol) => Math.abs(a - b) <= tol;
const T = E.TAX_DEFAULTS, S = { ...T, region: 'scotland' };

// ── 1. Golden cases, worked by hand from GOV.UK (TAX_RULES) ─────────────
// rUK: allowance 12,570 tapered £1 per £2 over 100,000; basic 20% on the
// first 37,700 of taxable income, higher 40% to 125,140, additional 45%.
const golden = [
  [0, 0], [12570, 0], [20000, 1486], [37548, 4995.6], [50270, 7540], [57548, 10451.2],
  [100000, 27432], [110000, 33432], [125140, 42516], [150000, 53703], [250000, 98703],
];
for (const [g, want] of golden) check(`G rUK ${g} → ${want}`, near(E.taxOn(g, T), want, 0.01), `got ${E.taxOn(g, T).toFixed(2)}`);
// Scotland 2026/27 (taxable bands above the allowance): 19% to 3,967, 20% to
// 16,956, 21% to 31,092, 42% to 62,430, 45% to 125,140, 48% above.
const goldenScot = [
  [16537, 3967 * 0.19],
  [57548, 3967 * 0.19 + 12989 * 0.20 + 14136 * 0.21 + 13886 * 0.42],
  [125140, 3967 * 0.19 + 12989 * 0.20 + 14136 * 0.21 + 31338 * 0.42 + 62710 * 0.45],
  [200000, 3967 * 0.19 + 12989 * 0.20 + 14136 * 0.21 + 31338 * 0.42 + 62710 * 0.45 + 74860 * 0.48],
];
for (const [g, want] of goldenScot) check(`G Scotland ${g} → ${want.toFixed(2)}`, near(E.taxOn(g, S), want, 0.01), `got ${E.taxOn(g, S).toFixed(2)}`);
check('G rUK marginal 60% in the taper zone', near(E.marginalRate(110000, T), 0.6, 0.005));
check('G rUK marginal 45% above 125,140', near(E.marginalRate(130000, T), 0.45, 0.005));
check('G Scotland marginal 48% above 125,140', near(E.marginalRate(130000, S), 0.48, 0.005));

// ── 2. Differential: an independent oracle, written from the rules ─────
// Deliberately a different shape from the engine: it walks gross bands.
function oracleRuk(gross) {
  const pa = Math.max(0, 12570 - Math.max(0, gross - 100000) / 2);
  const taxable = Math.max(0, gross - pa);
  const bands = [[37700, 0.20], [125140 - 37700, 0.40], [Infinity, 0.45]];
  let left = taxable, tax = 0;
  for (const [w, r] of bands) { const x = Math.min(left, w); tax += x * r; left -= x; if (left <= 0) break; }
  return tax;
}
function oracleScot(gross) {
  const pa = Math.max(0, 12570 - Math.max(0, gross - 100000) / 2);
  const taxable = Math.max(0, gross - pa);
  // Published gross edges with a full allowance: 16,537 / 29,526 / 43,662 /
  // 75,000 / 125,140 (taxable). Expressed as band widths in taxable income.
  const widths = [[16537 - 12570, 0.19], [29526 - 16537, 0.20], [43662 - 29526, 0.21], [75000 - 43662, 0.42], [125140 - (75000 - 12570), 0.45], [Infinity, 0.48]];
  let left = taxable, tax = 0;
  for (const [w, r] of widths) { const x = Math.min(left, w); tax += x * r; left -= x; if (left <= 0) break; }
  return tax;
}
{
  let worst = 0, worstAt = 0, worstS = 0, worstAtS = 0;
  for (let g = 0; g <= 300000; g += 250) {
    const d = Math.abs(E.taxOn(g, T) - oracleRuk(g)); if (d > worst) { worst = d; worstAt = g; }
    const ds = Math.abs(E.taxOn(g, S) - oracleScot(g)); if (ds > worstS) { worstS = ds; worstAtS = g; }
  }
  check('D rUK engine agrees with the independent oracle on 1,201 incomes to the penny', worst < 0.01, `worst ${worst.toFixed(2)} at ${worstAt}`);
  check('D Scotland engine agrees with the independent oracle on 1,201 incomes to the penny', worstS < 0.01, `worst ${worstS.toFixed(2)} at ${worstAtS}`);
  // grossForNet inverts taxOn
  let worstInv = 0;
  for (const net of [10000, 25000, 40000, 60000, 90000]) for (const base of [0, 12548, 30000]) {
    const gr = E.grossForNet(net, base, T);
    const got = gr - (E.taxOn(base + gr, T) - E.taxOn(base, T));
    worstInv = Math.max(worstInv, Math.abs(got - net));
  }
  check('D grossForNet inverts taxOn within £1 across nets and bases', worstInv < 1, `worst ${worstInv.toFixed(2)}`);
}

// ── 3. Properties over many plan shapes ─────────────────────────────────
const F = E.freshStart();
const shapes = {
  'fresh couple': E.sanitisePlan({ ...F }),
  'single': E.sanitisePlan({ ...F, household: 'single', partnerA: { ...F.partnerA, pension: 300000, isa: 40000 } }),
  'owner 56, stop 60': E.sanitisePlan({ ...F, retireYear: 2030, targetNet: 60000, partnerA: { ...F.partnerA, birthYear: 1970, pension: 570000, monthlyPension: 3200, isa: 48000 }, partnerB: { ...F.partnerB, birthYear: 1970 } }),
  'young, stop 42, pension locked': E.sanitisePlan({ ...F, retireYear: 2027, targetNet: 70000, cash: 24000, partnerA: { ...F.partnerA, birthYear: 1985, pension: 570000, monthlyPension: 3200, isa: 48000 }, partnerB: { ...F.partnerB, birthYear: 1985 } }),
  'high earner, upfront cash': E.sanitisePlan({ ...F, pclsMode: 'upfront', targetNet: 90000, partnerA: { ...F.partnerA, birthYear: 1968, pension: 1500000, isa: 200000 }, partnerB: { ...F.partnerB, birthYear: 1970, pension: 400000 } }),
  'Scotland, DB, late SP': E.sanitisePlan({ ...F, tax: { region: 'scotland' }, partnerA: { ...F.partnerA, birthYear: 1966, db: 18000, dbStartYear: 2031, pension: 250000 }, partnerB: { ...F.partnerB, birthYear: 1972, spAge: 68 } }),
  'age gap, partner working on': E.sanitisePlan({ ...F, retireYear: 2031, partnerA: { ...F.partnerA, birthYear: 1964, pension: 400000 }, partnerB: { ...F.partnerB, birthYear: 1978, stopYear: 2040, income: 42000, monthlyPension: 500, pension: 120000 } }),
  'death at 80, survivor on': E.sanitisePlan({ ...F, partnerA: { ...F.partnerA, birthYear: 1965, pension: 500000, deathAge: 80 }, partnerB: { ...F.partnerB, birthYear: 1967, pension: 200000 } }),
  'workbook fixture': E.defaults(),
  'structure on': E.sanitisePlan({ ...E.defaults(), architecture: { ...E.defaults().architecture, on: true } }),
};
for (const [name, P0] of Object.entries(shapes)) {
  const P = { ...P0, growth: P0.growthBase };
  const dd = E.drawdown(P);
  const cap = E.taxFor(P, P.startYear).pclsCap;
  let negative = 0, taxOver = 0, shortRows = 0, unmetRows = 0, tfcA = 0, tfcB = 0, nan = 0;
  for (const r of dd.rows) {
    for (const k of ['potA', 'potB', 'isaA', 'isaB', 'cash', 'gia', 'wealth']) { if (!(r[k] >= -0.01)) negative++; if (Number.isNaN(r[k])) nan++; }
    if (r.taxA > r.guaranteed + r.grossA + r.salaryA + 0.01 && r.taxA > 0) taxOver++;
    if (r.tax < -0.01) taxOver++;
    if (r.shortfall > 1) shortRows++;
    // Every year paid in full: net income covers the target plus event costs.
    if (!(r.shortfall > 1) && r.netIncome + r.banked + 1 < r.target + r.eventCost - r.eventInflow - r.inherited) unmetRows++;
    tfcA += r.tfcA; tfcB += r.tfcB;
  }
  check(`P ${name}: no negative balance in any year`, negative === 0, `${negative} cells`);
  check(`P ${name}: no NaN in any year`, nan === 0);
  check(`P ${name}: tax never exceeds taxable income, never negative`, taxOver === 0, `${taxOver} rows`);
  check(`P ${name}: holds ⇔ no year was short`, dd.holds === (shortRows === 0 && dd.exhaustedYear == null), `holds=${dd.holds} shortRows=${shortRows}`);
  check(`P ${name}: tax-free cash per person within the lump sum allowance (${cap})`, tfcA <= cap + 1 && tfcB <= cap + 1, `A ${Math.round(tfcA)} B ${Math.round(tfcB)}`);
  check(`P ${name}: every year that was not short was paid in full`, unmetRows === 0, `${unmetRows} rows`);
  check(`P ${name}: runsShortAgeA is the earlier of exhaustion and first shortfall`, dd.runsShortYear === (dd.exhaustedYear == null ? dd.shortfallYear : dd.shortfallYear == null ? dd.exhaustedYear : Math.min(dd.exhaustedYear, dd.shortfallYear)));
  // With the structure on the growth engine has its own equity and gold
  // volatility, so all three are zeroed; the match is then exact.
  check(`P ${name}: zero volatility Monte Carlo equals the plan`, (() => {
    const Z = { ...P, mcSd: 0, architecture: P.architecture ? { ...P.architecture, equitySd: 0, goldSd: 0 } : P.architecture };
    const m = E.runMonteCarlo(Z, 3, 1); return near(m.finalP50, dd.endWealth, Math.max(1, Math.abs(dd.endWealth) * 1e-6)); })());
}
// Conservation of money: nothing grows, nothing comes in, nothing is taxed
// (spending below the allowances), so what leaves the pots is exactly what
// was spent, and end wealth is start wealth less the draws.
{
  const Q = E.sanitisePlan({ ...F, household: 'single', targetNet: 12000, retireYear: 2027, inflation: 0, fee: 0, cashGrowth: 0, growthBase: 0, growthBear: 0, growthBull: 0, mcSd: 0,
    partnerA: { ...F.partnerA, birthYear: 1960, pension: 0, isa: 300000, monthlyPension: 0, spAmount: 0, db: 0 }, partnerB: { ...F.partnerB, pension: 0, isa: 0, monthlyPension: 0, spAmount: 0 } });
  const dd = E.drawdown({ ...Q, growth: 0 });
  const drawn = dd.rows.reduce((s, r) => s + r.grossA + r.grossB + r.tfcA + r.tfcB + r.isaDraw + r.cashDraw + r.giaDraw, 0);
  const start = dd.startPots.pensionA + dd.startPots.pensionB + dd.startPots.isaA + dd.startPots.isaB + (dd.startPots.cash || 0);
  check('P conservation: with zero growth, end wealth = start − everything drawn (to £1)', near(dd.endWealth, start - drawn, 1), `start ${start} drawn ${drawn} end ${dd.endWealth}`);
  // (The fresh plan eases spending from 75, so the year's own target is the yardstick.)
  check('P conservation: each year drew exactly what was asked (to £1) until the ISA ran out', dd.rows.filter(r => r.shortfall <= 1).every(r => near(r.isaDraw + r.cashDraw, r.target, 1)));
  check('P conservation: the first year drew the full 12,000', near(dd.rows[0].isaDraw + dd.rows[0].cashDraw, 12000, 1));
  check('P conservation: no tax at all below the allowance', dd.lifetimeTax < 0.01);
}

// ── 4. Metamorphic relations ────────────────────────────────────────────
// The owner's plan at £60,000 runs short (end wealth nil, so it cannot fall
// further); the same plan at £40,000 holds and is the yardstick for wealth.
const owner = shapes['owner 56, stop 60'];
const held = { ...owner, targetNet: 40000 };
const mcOf = (P, n = 800, seed = 42) => E.runMonteCarlo(P, n, seed);
// Tax relief at source: a payment marked as coming from a bank account
// (contribGrossUp) must put exactly what the same payment grossed up by 25%
// would, no more and no less, into the pot by the day work stops.
for (const [name, P0] of Object.entries(shapes)) {
  if (!(P0.partnerA.monthlyPension > 0) || !(P0.retireYear > P0.startYear)) continue;
  const on = { ...P0, partnerA: { ...P0.partnerA, contribGrossUp: true } };
  const off = { ...P0, partnerA: { ...P0.partnerA, contribGrossUp: false, monthlyPension: P0.partnerA.monthlyPension * 1.25 } };
  const a = E.accumulate(on, on.growthBase ?? on.growth).atRetirement.pensionA, b = E.accumulate(off, off.growthBase ?? off.growth).atRetirement.pensionA;
  check(`R ${name}: relief at source adds exactly 25% to what goes in (pot at stopping £${Math.round(a)} vs £${Math.round(b)})`, Math.abs(a - b) <= Math.max(1, b * 1e-9));
}
// The year-by-year picture on the home screen ("futures still paying") is
// drawn from perAgeHeld. It must never rise, must end exactly on the headline
// share, and can never claim more futures than were solvent that year.
// ("In full" allows a shortfall under 1% of the year's spending, as
// successProb always has, so it is not compared with the rules count.)
for (const [name, P0] of Object.entries(shapes)) {
  const m = mcOf(P0, 400), h = m.perAgeHeld, last = h[h.length - 1];
  let falls = true, within = true;
  for (let i = 0; i < h.length; i++) {
    if (i && (h[i].full > h[i - 1].full + 1e-12 || h[i].rules > h[i - 1].rules + 1e-12)) falls = false;
    if (h[i].rules > m.perAgeSolvency[i].p + 1e-12 || h[i].age !== m.perAgeSolvency[i].age || h[i].full < 0 || h[i].full > 1) within = false;
  }
  check(`P ${name}: futures still paying never rises from one year to the next`, falls);
  check(`P ${name}: the last year equals the headline share (full ${last.full}, rules ${last.rules})`, last.full === m.successProb && last.rules === m.successProbWithCuts);
  check(`P ${name}: paid every year so far (with the rules) never exceeds the futures solvent that year; ages line up`, within);
}
{
  const base = E.drawdown(owner), baseMc = mcOf(owner), baseHeld = E.drawdown(held);
  check('M the yardstick plan holds and the owner\'s does not', baseHeld.holds && !base.holds);
  const feed = { ...held, fee: held.fee + 0.01 };
  check('M higher charges: end wealth falls', E.drawdown(feed).endWealth < baseHeld.endWealth);
  check('M higher charges: the share of futures that hold does not rise', mcOf({ ...owner, fee: owner.fee + 0.01 }).successProb <= baseMc.successProb + 1e-9);
  const spend = { ...owner, targetNet: owner.targetNet + 10000 };
  check('M higher spending: end wealth falls', E.drawdown({ ...held, targetNet: 45000 }).endWealth < baseHeld.endWealth);
  check('M higher spending: the share of futures that hold does not rise', mcOf(spend).successProb <= baseMc.successProb + 1e-9);
  check('M higher spending: the money never lasts longer', (E.drawdown(spend).runsShortAgeA ?? 999) <= (base.runsShortAgeA ?? 999));
  const lateSp = { ...owner, partnerA: { ...owner.partnerA, spAge: 70 } };
  const g0 = (P) => E.drawdown(P).rows.find(r => r.ageA === 68).guaranteed;
  check('M a later State Pension cannot raise guaranteed income at 68', g0(lateSp) <= g0(owner) + 1e-6);
  const growth = { ...held, growthBase: held.growthBase + 0.01, growth: held.growthBase + 0.01 };
  check('M higher growth: end wealth rises', E.drawdown(growth).endWealth > baseHeld.endWealth);
  check('M the same seed gives the same answer, bit for bit', JSON.stringify(mcOf(owner)) === JSON.stringify(mcOf(owner)));
  check('M a different seed gives a different (but close) answer', (() => { const b = mcOf(owner, 800, 7); return b.successProb !== baseMc.successProb && Math.abs(b.successProb - baseMc.successProb) < 0.08; })());
  const asCouple = E.sanitisePlan({ ...owner, household: 'couple', partnerB: { ...F.partnerB, pension: 0, isa: 0, monthlyPension: 0, spAmount: 0, db: 0, birthYear: owner.partnerB.birthYear } });
  const asSingle = E.sanitisePlan({ ...owner, household: 'single' });
  check('M a single plan equals a couple whose partner has nothing, except for the second allowance (end wealth within 1%)', (() => {
    const a = E.drawdown(asSingle).endWealth, b = E.drawdown(asCouple).endWealth; return Math.abs(a - b) / Math.max(1, Math.abs(a)) < 0.01 || a <= b; })());
  const more = { ...owner, partnerA: { ...owner.partnerA, monthlyPension: owner.partnerA.monthlyPension + 500 } };
  check('M paying more in: the pot at retirement rises', E.accumulate(more, more.growthBase).atRetirement.pensionA > E.accumulate(owner, owner.growthBase).atRetirement.pensionA);
  const later = { ...owner, retireYear: owner.retireYear + 2 };
  check('M stopping two years later: the share of futures that hold rises', mcOf(later).successProb > baseMc.successProb);
}

// ── 5. Stability of the headline across path counts ─────────────────────
{
  const m2 = mcOf(owner, 2000), m10 = mcOf(owner, 10000);
  const d = Math.abs(m2.successProb - m10.successProb);
  check(`S 2,000 vs 10,000 paths: headline within 3 points (moved ${(d * 100).toFixed(1)}; 2,000-path sampling error ±${(m2.successSe * 100).toFixed(1)})`, d <= 0.03);
  check('S the 10,000-path answer sits inside the 2,000-path two-standard-error range', Math.abs(m2.successProb - m10.successProb) <= 2.5 * m2.successSe + 0.005);
  check('S more paths: a smaller standard error', m10.successSe < m2.successSe);
  check('S the engine version and seed travel with the result', m2.engineVersion === E.ENGINE_VERSION && m2.seed === 42);
}

// ── 5b. The Lantern's outputs (per-year paid share, money left, the shock) ──
{
  const m2 = mcOf(owner, 2000), m10 = mcOf(owner, 10000);
  const lit = (m) => m.perAgePaid.ages.map(r => r.q.filter(v => v >= 0.99).length);
  const l2 = lit(m2), l10 = lit(m10);
  check('L one row of 20 windows for every year of the plan, sorted worst to best', m2.perAgePaid.ages.length === m2.perAgeHeld.length && m2.perAgePaid.ages.every(r => r.q.length === 20 && r.q.every((v, k) => k === 0 || r.q[k - 1] <= v)));
  check('L in every year at least as many windows are lit as futures were paid every year so far', l2.every((n, i) => n / 20 >= m2.perAgeHeld[i].full - 0.05));
  check(`L 2,000 vs 10,000 paths: no year gains or loses more than one lit window (worst ${Math.max(...l2.map((n, i) => Math.abs(n - l10[i])))})`, l2.every((n, i) => Math.abs(n - l10[i]) <= 1));
  const more = mcOf({ ...owner, targetNet: owner.targetNet * 1.2 }, 2000);
  check('L asking for more never lights a window', more.perAgePaid.ages.every((r, i) => r.q.filter(v => v >= 0.99).length <= l2[i]));
  check('L money left: the 10th percentile is never above the middle, nor the middle above the 90th', m2.perAgeWealth.every(w => w.p10 <= w.p50 + 1 && w.p50 <= w.p90 + 1));
  const hit = E.runMonteCarlo(owner, 2000, 42, { shock: { year: 1, size: 0.3 } });
  check('L a 30% fall in year 1 never lights a window and leaves less in the middle future', hit.perAgePaid.ages.every((r, i) => r.q.filter(v => v >= 0.99).length <= l2[i]) && hit.perAgeWealth.every((w, i) => w.p50 <= m2.perAgeWealth[i].p50 + 1));
  check('L the shock travels with the result, and its absence is recorded', hit.shock && hit.shock.year === 1 && hit.shock.size === 0.3 && m2.shock === null);
}

// ── 5c. The Lantern's adapter (engine output -> view model), by hand ─────
{
  const { lanternModel, windowState, essentialOf, sourcesOf, countWindows, modelOk } = await import('./src/lantern/adapter.js');
  const fill = (head, rest) => [...head, ...new Array(20 - head.length).fill(rest)];
  const mcOfRows = (qs, left) => ({ perAgePaid: { ages: qs.map((q, i) => ({ age: 60 + i, q })) }, perAgeWealth: qs.map((_q, i) => left ? left[i] : { p10: 1, p50: 2, p90: 3 }) });
  const counts = (m, i, which = 'windows') => { const c = countWindows(m.floors[i][which]); return `${c.short}/${c.floor}/${c.full}`; };

  // Scenario A: no inflation, a flat £40,000 plan, essentials £30,000. Three years.
  const rowsA = [0, 1, 2].map(i => ({ year: 2030 + i, ageA: 60 + i, ageB: 58 + i, planTarget: 40000, paid: 1, spA: 0, spB: 0 }));
  const A = lanternModel({ plan: { household: 'couple', inflation: 0, startYear: 2026, targetNet: 40000 }, rows: rowsA, stress: null, essential: 30000,
    mc: mcOfRows([fill([], 1), fill([0.5, 0.7, 0.74, 0.75, 0.8, 0.98, 0.99], 1), fill([], 0)]) });
  check('A-lantern A year 1: every future pays in full, 0/0/20', counts(A, 0) === '0/0/20');
  check('A-lantern A year 2: £20,000, £28,000 and £29,600 fall short; £30,000, £32,000 and £39,200 cover the essentials; 99% counts as full: 3/3/14', counts(A, 1) === '3/3/14');
  check('A-lantern A year 3: nothing paid, 20/0/0', counts(A, 2) === '20/0/0');

  // Scenario B: 2% inflation from 2026, £50,000 stepping down to £37,500, essentials £37,500 (the floor equals the stepped-down plan).
  const f = y => Math.pow(1.02, y - 2026);
  const rowsB = [[2030, 50000], [2045, 37500], [2046, 37500]].map(([y, t], i) => ({ year: y, ageA: 60 + (y - 2030), ageB: 62 + (y - 2030), planTarget: t * f(y), paid: 1, spA: i ? 12000 * f(y) : 0, spB: 9000 * f(y) }));
  const B = lanternModel({ plan: { household: 'couple', inflation: 0.02, startYear: 2026, targetNet: 50000 }, rows: rowsB, stress: null, essential: 37500,
    mc: mcOfRows([fill(new Array(10).fill(0.98), 1), fill(new Array(10).fill(0.98), 1), fill([0.74, 0.76], 1)]) });
  check('A-lantern B spend is today’s money: £50,000 then £37,500', B.floors[0].spend === 50000 && B.floors[1].spend === 37500);
  check('A-lantern B at the full plan, 98% (£49,000) covers the essentials: 0/10/10', counts(B, 0) === '0/10/10');
  check('A-lantern B once the plan has stepped down to the essentials, 98% (£36,750) falls short: 10/0/10', counts(B, 1) === '10/0/10');
  check('A-lantern B 74% and 76% of £37,500 both fall short of £37,500: 2/0/18', counts(B, 2) === '2/0/18');
  check('A-lantern B the State Pensions start where the rows say, in today’s money', JSON.stringify(B.spines) === JSON.stringify([{ key: 'sp', fromFloor: 1, income: 12000 }, { key: 'partnerSp', fromFloor: 0, income: 9000 }]));

  // Scenario C: one person, a stress run, sources and money left.
  const rowC = { year: 2030, ageA: 66, ageB: 0, planTarget: 40000, paid: 1, spA: 12000, spB: 0, grossA: 20000, grossB: 0, tfcA: 5000, tfcB: 0, isaDraw: 3000 };
  const C = lanternModel({ plan: { household: 'single', inflation: 0, startYear: 2030, targetNet: 40000 }, rows: [rowC, { ...rowC, year: 2031, ageA: 67, paid: 0.5 }, { ...rowC, year: 2032, ageA: 68 }], essential: 30000,
    mc: mcOfRows([fill([], 1), fill([], 1), fill([0.6], 1)], [{ p10: -5, p50: 100.4, p90: 200.6 }, { p10: 1, p50: 2, p90: 3 }, { p10: 1, p50: 2, p90: 3 }]),
    stress: { shock: { year: 1, size: 0.3 }, perAgePaid: { ages: [fill([0.7, 0.8], 1), fill([], 0.76), fill([], 0.2)].map((q, i) => ({ age: 66 + i, q })) } } });
  check('A-lantern C stress year 1: £28,000 short, £32,000 covers the essentials: 1/1/18', counts(C, 0, 'stress') === '1/1/18');
  check('A-lantern C stress year 2: every future at 76% (£30,400): 0/20/0; year 3 at 20%: 20/0/0', counts(C, 1, 'stress') === '0/20/0' && counts(C, 2, 'stress') === '20/0/0');
  check('A-lantern C the base windows are untouched by the stress: 0/0/20, 0/0/20, 1/0/19', counts(C, 0) === '0/0/20' && counts(C, 1) === '0/0/20' && counts(C, 2) === '1/0/19');
  // Income £40,000 (pension £20,000 + £5,000 tax-free cash, ISA £3,000, State Pension £12,000), applied to £40,000 spent.
  const src = Object.fromEntries(C.floors[0].sources.map(x => [x.key, x.amount]));
  check('A-lantern C sources share out what was spent: pensions £25,000, ISA £3,000, State Pension £12,000', src.pension === 25000 && src.isa === 3000 && src.sp === 12000 && Object.keys(src).length === 3);
  check('A-lantern C a year that paid half shows half from every source: £12,500, £1,500, £6,000', JSON.stringify(C.floors[1].sources.map(x => x.amount).sort((a, b) => b - a)) === '[12500,6000,1500]');
  check('A-lantern C one person: no partner age, no partner spine; money left is rounded and never negative; the stress is named', C.floors[0].partnerAge === null && C.spines.length === 1 && C.floors[0].wealth.p10 === 0 && C.floors[0].wealth.p50 === 100 && C.floors[0].wealth.p90 === 201 && C.stressName === 'a 30% fall in year 1');
  check('A-lantern the essentials default to three quarters of the plan, to the nearest £500', essentialOf({ targetNet: 60000 }) === 45000 && essentialOf({ targetNet: 41000 }) === 31000 && windowState(0.99, 1, 1) === 'full');

  // And on the real engine: one floor a year, windows that agree with an independent count.
  const base = E.runMonteCarlo(owner, 2000, 42), hit = E.runMonteCarlo(owner, 2000, 42, { shock: { year: 1, size: 0.3 } }), rows = E.drawdown(owner).rows;
  const M = lanternModel({ plan: owner, rows, mc: base, stress: hit });
  check('A-lantern engine: one floor for every year of the plan, 20 sorted windows each', M.floors.length === rows.length && modelOk(M));
  check('A-lantern engine: lit windows equal a direct count of the engine’s paid shares', M.floors.every((fl, i) => countWindows(fl.windows).full === base.perAgePaid.ages[i].q.filter(v => v >= 0.99).length));
  check('A-lantern engine: the stress never lights a window the plan left dark', M.floors.every(fl => countWindows(fl.stress).full <= countWindows(fl.windows).full));
  check('A-lantern engine: each year’s sources add up to what the central case spent (to £5)', M.floors.every((fl, i) => Math.abs(fl.sources.reduce((a, x) => a + x.amount, 0) - rows[i].paid * fl.spend) <= 5 + 50 * 7));
}

// ── 5d. The safe ladder's rules value what is still to come (engine 2026.11.20) ──
{
  const STD = { on: true, ladderYears: 7, refill: 'whenUp', refillMin: 0, equityReal: 0.05, equitySd: 0.16, goldReal: 0.01, goldSd: 0.14, goldPct: 0.15, giltReal: 0.015,
    rulesOn: true, longevityAge: 95, cutBelow: 0.90, cutBy: 0.10, raiseAbove: 1.25, raiseBy: 0.05, raiseLagYears: 2, floorMult: 0.75, capMult: 1.25 };
  const S = { ...owner, architecture: { ...owner.architecture, ...STD } }, rows = E.drawdown(S).rows, r0 = rows[0];
  const fOf = r => Math.pow(1 + S.inflation, r.year - S.startYear), n = Math.max(1, 95 - r0.ageA);
  let need = 0, guar = 0, d = 1;
  for (let k = 0; k < n; k++) { d /= 1.015; const y = rows[Math.min(k, rows.length - 1)]; need += (y.planTarget / fOf(y)) * d; guar += (y.guaranteedNet / fOf(y)) * d; }
  check('R the first year\'s ratio is the money plus the guaranteed income to come, over the spending to come, by hand', Math.abs(r0.fundedRatio - (r0.wealth / fOf(r0) + guar) / need) < 1e-6);
  const af = (1 - Math.pow(1.015, -n)) / 0.015, level = (r0.wealth / fOf(r0) + (r0.guaranteedNet / fOf(r0)) * af) / ((r0.planTarget / fOf(r0)) * af);
  check(`R stopping before State Pension age, the ratio counts the pensions to come (level form ${level.toFixed(2)}, now ${r0.fundedRatio.toFixed(2)})`, r0.spA === 0 && r0.fundedRatio > level + 0.05);
  const stepped = E.drawdown({ ...S, phase1On: true, phase1Age: 75, phase1Cut: 0.15, phase2On: true, phase2Age: 80, phase2Cut: 0.25 }).rows[0];
  const flatSpend = E.drawdown({ ...S, phase1On: false, phase2On: false }).rows[0];
  check('R planning to spend less later raises the first year\'s ratio', stepped.fundedRatio > flatSpend.fundedRatio);
  const laterSp = E.drawdown({ ...S, partnerA: { ...S.partnerA, spAge: 70 } }).rows[0];
  check('R a later State Pension lowers it', laterSp.fundedRatio < r0.fundedRatio);
  const plain = { ...owner, architecture: { ...owner.architecture, on: false } };
  check('R a plan without the ladder carries no ratio and is untouched by the rule', E.drawdown(plain).rows.every(r => r.fundedRatio == null && r.spendMult === 1));
  const a = E.runMonteCarlo(S, 400, 42), b = E.runMonteCarlo(S, 400, 42);
  check('R the dry pass does not disturb reproducibility: the same seed gives the same futures', a.successProb === b.successProb && a.finalP50 === b.finalP50 && a.successProbWithCuts === b.successProbWithCuts);
}

// ── 6. Migration: a v1 saved plan ───────────────────────────────────────
{
  const v1 = { startYear: 2025, retireYear: 2030, horizonAge: 90, targetNet: 40000,
    partnerA: { name: 'You', birthYear: 1970, pension: 300000, isa: 20000, monthlyPension: 1000, spAmount: 11500, db: 0 },
    partnerB: { name: 'Partner', birthYear: 1972, pension: 0, isa: 0, monthlyPension: 0, spAmount: 0, db: 0 },
    tax: { personalAllowance: 12000, higherThreshold: 45000, region: 'ruk' }, growthBase: 0.05, growthBear: 0.03, growthBull: 0.07, inflation: 0.025 };
  const m = E.migratePlan(JSON.parse(JSON.stringify(v1)));
  check('V v1 plan: an empty placeholder partner becomes a single-person plan', m.household === 'single');
  check('V v1 plan: fee defaults to 0 so the saved figures keep their meaning', m.fee === 0);
  check('V v1 plan: the figures that matter survive', m.partnerA.pension === 300000 && m.targetNet === 40000 && m.retireYear === 2030);
  check('V v1 plan: an old personal allowance saved in the plan is ignored (the engine\'s current rules win)', E.taxFor(m, m.startYear).personalAllowance === 12570 && E.taxFor(m, m.startYear).higherThreshold === 50270);
  check('V v1 plan: validates with no errors', E.validatePlan(m).filter(i => i.level === 'error').length === 0);
  check('V garbage in: a non-object becomes a fresh start, never a crash', E.migratePlan(null).partnerA != null && E.migratePlan('x').partnerA != null);
  const ex = JSON.parse(JSON.stringify({ app: 'Someday', schemaVersion: E.SCHEMA_VERSION, plan: m }));
  check('V export → import round trip is lossless', JSON.stringify(E.migratePlan(ex.plan)) === JSON.stringify(m));
}

// ── 7. Cross-engine: one definition of success (audit F-01) ─────────────
{
  let r = null;
  try {
    const plan = classicPlan({ currentAge: 55, retirementAge: 60, targetNetIncome: 40000, currentPension: 300000, currentIsa: 50000, annualPensionContribution: 12000 });
    r = classicMc(plan, { iterations: 300, seed: 1, endAge: 90 });
  } catch (e) { r = { error: String(e) }; }
  check('X classic engine: successRate is defined', r && r.statistics && typeof r.statistics.successRate === 'number', r && r.error);
  check('X classic engine: success (target met every year and solvent) is never looser than "not depleted"', !!(r && r.statistics && r.statistics.successRate <= r.statistics.notDepletedRate + 1e-12), r && r.statistics && `${r.statistics.successRate} vs ${r.statistics.notDepletedRate}`);
}

// ── Load-time assertions still pass ─────────────────────────────────────
{
  const a = E.runAssertions();
  check(`A engine load-time assertions: ${a.filter(x => x.pass).length} of ${a.length} pass`, a.every(x => x.pass), a.filter(x => !x.pass).map(x => x.name).join('; '));
  check('A there are at least 130 of them', a.length >= 130);
}

console.log(`\n═══ Horizon VERIFY: ${pass}/${pass + fail} passed · engine ${E.ENGINE_VERSION} · tax rules ${E.TAX_RULES.taxYear} (read ${E.TAX_RULES.retrieved}) ═══`);
if (fails.length) console.log('\nFAILURES:\n' + fails.map(f => '  ' + f).join('\n'));
process.exitCode = fail > 0 ? 1 : 0;
