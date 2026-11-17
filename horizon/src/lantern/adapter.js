/**
 * The Lantern's adapter: engine output in, view model out. Pure functions,
 * no engine maths, no DOM, no React; plain JavaScript so the node-only
 * verify suite can test it (types in adapter.d.ts).
 *
 *   engine (drawdown rows, runMonteCarlo) -> lanternModel() -> the scene
 */
export const WINDOWS = 20;

/** The engine's own line for "paid in full": a year at 99% of the plan or more. */
export const FULL = 0.99;

/** The window that marks the middle future (the more cautious of the two middle windows). */
export const MEDIAN_WINDOW = WINDOWS / 2 - 1;

/** Until it is set by hand: three quarters of the plan, to the nearest £500. */
export const essentialOf = (plan) => Math.round((0.75 * (Number(plan && plan.targetNet) || 0)) / 500) * 500;

/**
 * One window. `paid` is the share of that year's plan that future delivered,
 * `spend` the plan that year and `essential` the floor, both in today's money.
 * full: pays the plan. floor: pays the essentials but not the plan. short: neither.
 */
export function windowState(paid, spend, essential) {
  if (paid >= FULL) return 'full';
  return paid * spend >= essential - 0.5 ? 'floor' : 'short';
}

const n0 = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);

/** Where a year's money came from in the central case, before tax, nominal. */
const SOURCES = [
  ['pension', (r) => n0(r.grossA) + n0(r.grossB) + n0(r.tfcA) + n0(r.tfcB)],
  ['isa', (r) => n0(r.isaDraw)],
  ['cash', (r) => n0(r.cashDraw) + n0(r.giaDraw)],
  ['scheme', (r) => n0(r.dbA) + n0(r.dbB) + n0(r.annuity)],
  ['work', (r) => n0(r.salaryA) + n0(r.salaryB) + n0(r.earnedA) + n0(r.earnedB)],
  ['partnerSp', (r) => n0(r.spB)],
  ['sp', (r) => n0(r.spA)],
];

/**
 * The central case's spending that year, split by where the money came from.
 * Each source's share of the year's income is applied to what was actually
 * spent (`delivered`), so the parts add up to it and a shortfall shows as a gap.
 */
export function sourcesOf(row, delivered) {
  const raw = SOURCES.map(([key, f]) => ({ key, amount: Math.max(0, f(row)) })).filter((s) => s.amount > 0);
  const total = raw.reduce((a, s) => a + s.amount, 0);
  if (!(total > 0) || !(delivered > 0)) return [];
  return raw.map((s) => ({ key: s.key, amount: Math.round((s.amount / total) * delivered) })).filter((s) => s.amount >= 50);
}

/**
 * The view model. `rows` is `drawdown(plan).rows` (the central case), `mc`
 * `runMonteCarlo(plan, …)`, `stress` the same run with a shock (or null).
 * Everything is in today's money.
 */
export function lanternModel({ plan, rows, mc, stress, essential }) {
  const single = plan.household === 'single';
  const infl = n0(plan.inflation), start = n0(plan.startYear);
  const paid = (mc && mc.perAgePaid && mc.perAgePaid.ages) || [];
  const left = (mc && mc.perAgeWealth) || [];
  const hit = (stress && stress.perAgePaid && stress.perAgePaid.ages) || null;
  const n = Math.min(rows.length, paid.length, left.length);
  const ess = essential == null ? essentialOf(plan) : essential;
  const real = (i) => Math.pow(1 + infl, rows[i].year - start);

  const floors = [];
  for (let i = 0; i < n; i++) {
    const r = rows[i], f = real(i), spend = Math.round(n0(r.planTarget) / f);
    const windows = paid[i].q.map((v) => windowState(v, spend, ess));
    floors.push({
      age: r.ageA, partnerAge: single ? null : r.ageB, year: r.year, spend,
      windows,
      stress: hit && hit[i] ? hit[i].q.map((v) => windowState(v, spend, ess)) : windows,
      sources: sourcesOf(r, Math.max(0, n0(r.paid == null ? 1 : r.paid)) * spend),
      wealth: { p10: Math.max(0, Math.round(left[i].p10)), p50: Math.max(0, Math.round(left[i].p50)), p90: Math.max(0, Math.round(left[i].p90)) },
    });
  }

  const spines = [];
  const first = (pick) => { for (let i = 0; i < n; i++) if (pick(rows[i]) > 0) return { fromFloor: i, income: Math.round(pick(rows[i]) / real(i)) }; return null; };
  const own = first((r) => n0(r.spA)), partner = single ? null : first((r) => n0(r.spB));
  if (own) spines.push({ key: 'sp', ...own });
  if (partner) spines.push({ key: 'partnerSp', ...partner });

  const AR = plan.architecture || {};
  const sh = stress && stress.shock;
  return {
    floors, essential: ess,
    ladderFloors: AR.on ? Math.max(0, Math.min(n, Math.round(n0(AR.ladderYears)))) : 0,
    spines,
    stressName: sh ? `a ${Math.round(sh.size * 100)}% fall in year ${sh.year}` : null,
  };
}

/** How many of a floor's windows are in each state. */
export function countWindows(w) {
  const c = { full: 0, floor: 0, short: 0 };
  for (const s of w) c[s]++;
  return c;
}

/** True when every floor has exactly 20 windows, sorted worst to best. */
export function modelOk(m) {
  const rank = { short: 0, floor: 1, full: 2 };
  const sorted = (w) => w.length === WINDOWS && w.every((s, i) => i === 0 || rank[w[i - 1]] <= rank[s]);
  return m.floors.length > 0 && m.floors.every((f) => sorted(f.windows) && sorted(f.stress));
}
