/**
 * The Lantern's adapter: engine output in, view model out. Pure functions,
 * no engine maths, no DOM, no React; plain JavaScript so the node-only
 * verify suite can test it (types in adapter.d.ts).
 *
 *   engine (drawdown rows, runMonteCarlo) -> lanternModel() -> the scene
 */
/**
 * The engine reads each year's futures at 20 levels, worst first, each level
 * 5 of every 100 futures. The tower draws them as 10 windows a floor: a
 * window is two levels, 10 of every 100 futures, and a window with one level
 * lit is drawn half lit (owner, 20 November 2026: "Do 1 through to 4", after
 * three reviews: one count, "of 100", on the picture and in the words).
 */
export const LEVELS = 20;
export const WINDOWS = 10;

/** The engine's own line for "paid in full": a year at 99% of the plan or more. */
export const FULL = 0.99;

/**
 * One level. `paid` is the share of that year's plan that future delivered.
 * Two states only: full pays the plan, short pays less. (Until 20 November
 * 2026 there was a third, "less, but the essentials are covered", against a
 * line of three quarters of the plan that nobody had chosen.)
 */
export const windowState = (paid) => (paid >= FULL ? 'full' : 'short');

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
export function lanternModel({ plan, rows, mc, stress }) {
  const single = plan.household === 'single';
  const infl = n0(plan.inflation), start = n0(plan.startYear);
  const paid = (mc && mc.perAgePaid && mc.perAgePaid.ages) || [];
  const left = (mc && mc.perAgeWealth) || [];
  const hit = (stress && stress.perAgePaid && stress.perAgePaid.ages) || null;
  const n = Math.min(rows.length, paid.length, left.length);
  const real = (i) => Math.pow(1 + infl, rows[i].year - start);

  const floors = [];
  for (let i = 0; i < n; i++) {
    const r = rows[i], f = real(i), spend = Math.round(n0(r.planTarget) / f);
    const windows = paid[i].q.map(windowState);
    floors.push({
      age: r.ageA, partnerAge: single ? null : r.ageB, year: r.year, spend,
      windows,
      stress: hit && hit[i] ? hit[i].q.map(windowState) : windows,
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
    floors,
    ladderFloors: AR.on ? Math.max(0, Math.min(n, Math.round(n0(AR.ladderYears)))) : 0,
    spines,
    stressName: sh ? `a ${Math.round(sh.size * 100)}% fall in year ${sh.year}` : null,
  };
}

/** How many of a floor's 20 levels are in each state. */
export function countWindows(w) {
  const c = { full: 0, short: 0 };
  for (const s of w) c[s]++;
  return c;
}

/** Of 100 futures, how many pay that year's plan in full (to the nearest 5). */
export const of100 = (w) => countWindows(w).full * (100 / LEVELS);

/** True when every floor has exactly 20 levels, sorted worst to best. */
export function modelOk(m) {
  const rank = { short: 0, full: 1 };
  const sorted = (w) => w.length === LEVELS && w.every((s, i) => i === 0 || rank[w[i - 1]] <= rank[s]);
  return m.floors.length > 0 && m.floors.every((f) => sorted(f.windows) && sorted(f.stress));
}
