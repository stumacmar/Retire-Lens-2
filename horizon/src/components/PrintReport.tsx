import type { ReactNode } from 'react';
import { E } from '../lib/usePlan';
import type { Accum, Drawdown, MC } from '../engine/engine';
import { fmt, pct, deflate } from '../lib/format';

/**
 * The printable report — a fuller, adviser-ready document (not a one-pager).
 * Everything the on-screen app models, laid out for a client to read or hand to
 * an IFA: the answer, the holdings, the plan, the projections, the risk and tax
 * analysis, and — critically — every assumption and a plain-English methodology.
 *
 * Rendered hidden on screen (#print-summary { display:none }) and revealed only
 * for print via the @media print rules in index.css.
 */
export default function PrintReport({ plan, acc, dd, mc, estate }: {
  plan: any; acc: Accum; dd: Drawdown; mc: MC | null; estate: any;
}) {
  const A = plan.partnerA, B = plan.partnerB;
  const real = (v: number, year: number) => deflate(v, year, plan.startYear, plan.inflation);
  const ageNow = (p: any) => plan.startYear - p.birthYear;
  const ageAtRetire = plan.retireYear - A.birthYear;
  const horizonYear = A.birthYear + plan.horizonAge;
  const lasts = dd.exhaustedAgeA == null;
  const at = acc.atRetirement as any;
  const potsReal = real(at.pensionA + at.pensionB + at.isaA + at.isaB, plan.retireYear);
  const lifeTax = (dd as any).lifetimeTaxReal ?? dd.lifetimeTax;
  const netWorthToday = A.pension + B.pension + A.isa + B.isa + (plan.house || 0) + (plan.cash || 0);

  let strat: any[] = [];
  try { strat = (E as any).compareStrategies(plan); } catch { strat = []; }
  const bestTax = strat.length ? Math.min(...strat.map(s => s.lifetimeTax)) : 0;

  // Income sources over the whole retirement (today's money).
  let mSp = 0, mDb = 0, mPen = 0, mTfc = 0, mIsa = 0;
  for (const r of dd.rows as any[]) {
    const f = 1 / Math.pow(1 + plan.inflation, r.year - plan.startYear);
    mSp += ((r.spA || 0) + (r.spB || 0)) * f;
    mDb += ((r.dbA || 0) + (r.dbB || 0)) * f;
    mPen += Math.max(0, (r.grossA || 0) + (r.grossB || 0) - (r.taxA || 0) - (r.taxB || 0)) * f;
    mTfc += ((r.tfcA || 0) + (r.tfcB || 0)) * f;
    mIsa += ((r.isaDraw || 0) + (r.cashDraw || 0)) * f;
  }
  const mixTotal = Math.max(1, mSp + mDb + mPen + mTfc + mIsa);
  const mix = [
    ['State Pension', mSp], ['Defined-benefit pension', mDb],
    ['Personal pension (after tax)', mPen], ['Tax-free cash (PCLS)', mTfc],
    ['ISAs & cash', mIsa],
  ].filter(([, v]) => (v as number) / mixTotal > 0.005);

  const stratName: Record<string, string> = {
    sippfirst: 'Pensions first (to basic rate), ISAs for the excess',
    isafirst: 'ISAs first, defer pensions',
    pafirst: 'Pensions to free allowances only, then ISAs',
  };
  const pclsName: Record<string, string> = {
    none: 'Take none (leave tax-free cash invested)',
    phased: 'A little each year (phased)',
    upfront: 'All at once at retirement',
  };
  const printedOn = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });

  const Row = ({ k, v }: { k: string; v: ReactNode }) => (
    <div className="r-kv"><span>{k}</span><b>{v}</b></div>
  );
  const P = ({ p }: { p: any }) => (
    <>
      <Row k="Date of birth (year)" v={p.birthYear} />
      <Row k="Age today / at retirement" v={`${ageNow(p)} / ${plan.retireYear - p.birthYear}`} />
      <Row k="Personal pension (defined contribution)" v={fmt(p.pension)} />
      <Row k="Monthly pension contribution" v={`${fmt(p.monthlyPension)} (${fmt(p.monthlyPension * 12)}/yr)`} />
      <Row k="ISAs" v={fmt(p.isa)} />
      <Row k="Monthly ISA contribution" v={`${fmt(p.monthlyIsa)} (${fmt(p.monthlyIsa * 12)}/yr)`} />
      <Row k="Defined-benefit pension (a year)" v={p.db > 0 ? `${fmt(p.db)}, from ${p.dbStartYear}, ${p.dbIndexed ? 'rises with inflation' : 'level (no indexation)'}` : 'None'} />
      <Row k="State Pension" v={`${fmt(p.spAmount)}/yr from age ${p.spAge}`} />
    </>
  );

  return (
    <div id="print-summary">
      {/* ── Cover ─────────────────────────────────────────────── */}
      <header className="r-cover">
        <div className="r-brand">Someday · Retirement Planning Report</div>
        <h1>{A.name} &amp; {B.name}</h1>
        <p className="r-sub">Prepared privately on your own device · {printedOn}</p>
        <p className="r-answer">{lasts
          ? `On the central (Base) assumptions, you can spend about ${fmt(Math.round(plan.targetNet))} a year in today's money and your money is projected to last beyond age ${plan.horizonAge}.`
          : `On the central (Base) assumptions, spending ${fmt(Math.round(plan.targetNet))} a year in today's money, the money is projected to run short around age ${dd.exhaustedAgeA}.`}</p>
        <div className="r-grid">
          <div><b>{fmt(Math.round(plan.targetNet))}</b><span>Target income a year (today's money)</span></div>
          <div><b>{plan.retireYear} · age {ageAtRetire}</b><span>Planned retirement</span></div>
          <div><b>{plan.horizonAge}</b><span>Plan runs to age ({A.name})</span></div>
          <div><b>{fmt(Math.round(potsReal))}</b><span>Investable pots at retirement (today's money)</span></div>
          <div><b>{lasts ? `${plan.horizonAge}+` : `age ${dd.exhaustedAgeA}`}</b><span>Money projected to last to</span></div>
          <div><b>{mc ? pct(mc.successProb) : '—'}</b><span>Monte-Carlo success rate</span></div>
          <div><b>{fmt(Math.round(lifeTax))}</b><span>Lifetime income tax (today's money)</span></div>
          <div><b>{estate ? fmt(Math.round(real(estate.netToHeirs, estate.year))) : '—'}</b><span>Estate to family (today's money)</span></div>
        </div>
        <p className="r-note">This report is a modelling illustration, not financial advice. It shows one possible future
          on the assumptions listed in Section 6. Figures are in today's money (adjusted for inflation) unless stated.
          Your figures never leave your device.</p>
      </header>

      {/* ── 1. People & holdings ─────────────────────────────── */}
      <section className="r-page">
        <h2>1 · People &amp; holdings today</h2>
        <div className="r-two">
          <div className="r-card"><h3>{A.name}</h3><P p={A} /></div>
          <div className="r-card"><h3>{B.name}</h3><P p={B} /></div>
        </div>
        <h3 className="r-h3">Wider assets (for net worth &amp; estate)</h3>
        <div className="r-card">
          <Row k="Main residence (value today)" v={`${fmt(plan.house || 0)} (assumed growth ${pct(plan.houseGrowth || 0)}/yr)`} />
          <Row k="Cash / Premium Bonds" v={`${fmt(plan.cash || 0)} (assumed growth ${pct(plan.cashGrowth || 0)}/yr)`} />
          <Row k="Total net worth today" v={fmt(netWorthToday)} />
        </div>
      </section>

      {/* ── 2. Plan & strategy ───────────────────────────────── */}
      <section className="r-page">
        <h2>2 · The retirement plan</h2>
        <div className="r-card">
          <Row k="Target net income (today's money)" v={`${fmt(Math.round(plan.targetNet))} a year`} />
          <Row k="Retirement year / age" v={`${plan.retireYear} · age ${ageAtRetire} (${A.name})`} />
          <Row k="Plan horizon" v={`age ${plan.horizonAge} (${A.name}) — year ${horizonYear}`} />
          <Row k="Withdrawal order" v={stratName[plan.strategy] || plan.strategy} />
          <Row k="Tax-free cash (PCLS)" v={pclsName[plan.pclsMode] || plan.pclsMode} />
          <Row k="Income-tax region" v={plan.tax?.region === 'scotland' ? 'Scotland (Scottish bands)' : 'England, Wales & NI'} />
        </div>

        <h3 className="r-h3">Spending as you age (age-phased step-downs)</h3>
        <div className="r-card">
          <Row k={`Ease spending from age ${plan.phase1Age}`} v={plan.phase1On ? `spend ${pct(plan.phase1Cut)} less than the full plan` : 'Off'} />
          <Row k={`Deeper step-down from age ${plan.phase2Age}`} v={plan.phase2On ? `spend ${pct(plan.phase2Cut)} less than the full plan (total, measured from baseline — not compounded on the first)` : 'Off'} />
        </div>

        <h3 className="r-h3">Life events &amp; inheritance</h3>
        <div className="r-card">
          <Row k="Inheritance assumed" v={plan.inherit?.on ? `${fmt(plan.inherit.amount)} in ${plan.inherit.year}${plan.inherit.invest ? ', invested' : ''} (today's money)` : 'None assumed'} />
          {(plan.lifeEvents || []).length === 0 && <Row k="One-off costs / windfalls" v="None" />}
          {(plan.lifeEvents || []).map((e: any, i: number) => (
            <Row key={i} k={`${e.kind === 'cost' ? 'Cost' : 'Windfall'} — ${e.label}`} v={`${fmt(e.amount)} in ${e.year} (today's money)`} />
          ))}
        </div>
      </section>

      {/* ── 3. Projections ───────────────────────────────────── */}
      <section className="r-page">
        <h2>3 · Projection (central / Base scenario)</h2>
        <p className="r-lead">Pots at retirement ({plan.retireYear}), in today's money:
          {' '}{A.name} pension {fmt(Math.round(real(at.pensionA, plan.retireYear)))},
          {' '}{B.name} pension {fmt(Math.round(real(at.pensionB, plan.retireYear)))},
          {' '}ISAs {fmt(Math.round(real(at.isaA + at.isaB, plan.retireYear)))}.
          {' '}Total {fmt(Math.round(potsReal))}.</p>

        <h3 className="r-h3">Where the retirement income comes from</h3>
        <table className="r-tbl">
          <thead><tr><th>Source</th><th className="r-r">Over the plan (today's money)</th><th className="r-r">Share</th></tr></thead>
          <tbody>
            {mix.map(([n, v]) => (
              <tr key={n as string}><td>{n}</td><td className="r-r">{fmt(Math.round(v as number))}</td><td className="r-r">{Math.round((v as number) / mixTotal * 100)}%</td></tr>
            ))}
          </tbody>
        </table>

        <h3 className="r-h3">Year by year (today's money, Base scenario)</h3>
        <table className="r-tbl r-yby">
          <thead><tr>
            <th>Year · age</th><th className="r-r">Spend</th><th className="r-r">Guaranteed</th>
            <th className="r-r">From pots</th><th className="r-r">Tax</th><th className="r-r">Wealth left</th>
          </tr></thead>
          <tbody>
            {(dd.rows as any[]).map(r => {
              const f = 1 / Math.pow(1 + plan.inflation, r.year - plan.startYear);
              const guaranteed = (r.spA + r.spB + r.dbA + r.dbB) * f;
              const fromPots = (r.grossA + r.grossB + r.tfcA + r.tfcB + r.isaDraw + r.cashDraw) * f;
              return (
                <tr key={r.year}>
                  <td>{r.year} · {r.ageA}/{r.ageB}</td>
                  <td className="r-r">{fmt(Math.round(r.target * f))}</td>
                  <td className="r-r">{fmt(Math.round(guaranteed))}</td>
                  <td className="r-r">{fmt(Math.round(fromPots))}</td>
                  <td className="r-r">{fmt(Math.round(r.tax * f))}</td>
                  <td className="r-r">{fmt(Math.round(r.wealth * f))}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <p className="r-cap">Spend = net income needed. Guaranteed = State &amp; defined-benefit pensions. From pots =
          pension drawdown, tax-free cash and ISA withdrawals. Wealth left = pensions + ISAs + cash at year end.</p>
      </section>

      {/* ── 4. Risk & tax ────────────────────────────────────── */}
      <section className="r-page">
        <h2>4 · Risk &amp; tax analysis</h2>
        {mc && <>
          <h3 className="r-h3">Monte-Carlo stress test</h3>
          <div className="r-card">
            <Row k="Plans that hold across simulated markets" v={pct(mc.successProb)} />
            <Row k="Confidence stays high until age" v={`${mc.confidenceAge} (above ${pct(mc.threshold ?? 0.85, 0)} of runs solvent)`} />
            <Row k="Wealth left at age " v={`${plan.horizonAge} (today's money): unlucky (10th) ${fmt(Math.round(real(mc.finalP10, horizonYear)))} · typical (50th) ${fmt(Math.round(real(mc.finalP50, horizonYear)))} · lucky (90th) ${fmt(Math.round(real(mc.finalP90, horizonYear)))}`} />
            <Row k="Simulations" v={`${mc.nPaths} random return paths (normal, mean ${pct(plan.mcMean)}, volatility ${pct(plan.mcSd)})`} />
          </div>
        </>}

        {strat.length > 0 && <>
          <h3 className="r-h3">Withdrawal order &amp; lifetime tax</h3>
          <table className="r-tbl">
            <thead><tr><th>Strategy</th><th className="r-r">Lifetime income tax</th><th>Notes</th></tr></thead>
            <tbody>
              {strat.map(s => (
                <tr key={s.id}>
                  <td>{s.label}</td>
                  <td className="r-r">{fmt(Math.round(s.lifetimeTax))}</td>
                  <td>{s.id === plan.strategy ? 'Your choice' : ''}{Math.abs(s.lifetimeTax - bestTax) < 1 ? (s.id === plan.strategy ? ' · lowest' : 'Lowest lifetime tax') : ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="r-cap">Lifetime income tax is nominal, over the whole plan, and compares like for like — a guide to the
            most tax-efficient order to draw your pots, not a recommendation.</p>
        </>}

        {estate && <>
          <h3 className="r-h3">Estate &amp; inheritance tax (at age {plan.horizonAge})</h3>
          <div className="r-card">
            <Row k="Estate passing to family (today's money)" v={fmt(Math.round(real(estate.netToHeirs, estate.year)))} />
            <Row k="Inheritance tax (today's money)" v={fmt(Math.round(real(estate.iht, estate.year)))} />
            <Row k="Pensions counted in the estate" v={plan.iht.includePensions ? `Yes (from ${plan.iht.pensionsInEstateFrom}, per announced rules)` : 'No'} />
          </div>
        </>}
      </section>

      {/* ── 5. Assumptions & methodology ─────────────────────── */}
      <section className="r-page">
        <h2>5 · Assumptions &amp; methodology</h2>
        <p className="r-lead">Every figure in this report depends on the assumptions below. Change any of them in the app
          and the projection changes. Your adviser will want to sense-check these against your own circumstances.</p>

        <div className="r-two">
          <div className="r-card"><h3>Investment growth (nominal, a year)</h3>
            <Row k="Poor / cautious" v={pct(plan.growthBear)} />
            <Row k="Base / central" v={pct(plan.growthBase)} />
            <Row k="Positive / optimistic" v={pct(plan.growthBull)} />
            <Row k="Price inflation" v={pct(plan.inflation)} />
            <Row k="Cash growth" v={pct(plan.cashGrowth || 0)} />
            <Row k="Property growth" v={pct(plan.houseGrowth || 0)} />
          </div>
          <div className="r-card"><h3>Monte-Carlo model</h3>
            <Row k="Average return" v={pct(plan.mcMean)} />
            <Row k="Volatility (std. dev.)" v={pct(plan.mcSd)} />
            <Row k="Number of paths" v={mc?.nPaths ?? plan.mcPaths} />
            <Row k="Return distribution" v="Normal (Box–Muller)" />
            <Row k="Random seed (reproducible)" v={plan.mcSeed} />
          </div>
        </div>

        <div className="r-two">
          {plan.tax?.region === 'scotland' ? (
            <div className="r-card"><h3>Income tax (Scotland, 2025/26)</h3>
              <Row k="Personal allowance (UK-wide)" v={fmt(plan.tax.personalAllowance)} />
              <Row k="Starter 19% / Basic 20%" v="to £15,397 / to £27,491" />
              <Row k="Intermediate 21% / Higher 42%" v="to £43,662 / to £75,000" />
              <Row k="Advanced 45% / Top 48%" v="to £125,140 / above" />
              <Row k="Allowance taper starts at" v={`${fmt(plan.tax.taperStart)} (£1 lost per £2 over)`} />
              <Row k="Tax-free cash (PCLS) cap" v={fmt(plan.tax.pclsCap)} />
              <Row k="ISA annual allowance" v={fmt(plan.tax.isaAnnualAllowance)} />
            </div>
          ) : (
            <div className="r-card"><h3>Income tax (UK 2025/26, England/Wales/NI)</h3>
              <Row k="Personal allowance" v={fmt(plan.tax.personalAllowance)} />
              <Row k="Basic rate / higher rate / additional" v={`${pct(plan.tax.basicRate)} / ${pct(plan.tax.higherRate)} / ${pct(plan.tax.additionalRate)}`} />
              <Row k="Higher-rate threshold" v={fmt(plan.tax.higherThreshold)} />
              <Row k="Additional-rate threshold" v={fmt(plan.tax.additionalThreshold)} />
              <Row k="Allowance taper starts at" v={`${fmt(plan.tax.taperStart)} (£1 lost per £2 over)`} />
              <Row k="Tax-free cash (PCLS) cap" v={fmt(plan.tax.pclsCap)} />
              <Row k="ISA annual allowance" v={fmt(plan.tax.isaAnnualAllowance)} />
            </div>
          )}
          <div className="r-card"><h3>Inheritance tax</h3>
            <Row k="Nil-rate band" v={fmt(plan.iht.nilRateBand)} />
            <Row k="Residence nil-rate band" v={fmt(plan.iht.residenceNRB)} />
            <Row k="Rate" v={pct(plan.iht.rate)} />
            <Row k="Couple (transferable bands)" v={plan.iht.couple ? 'Yes' : 'No'} />
            <Row k="Pensions in estate from" v={plan.iht.includePensions ? plan.iht.pensionsInEstateFrom : 'Not included'} />
          </div>
        </div>

        <h3 className="r-h3">How the model works (method notes)</h3>
        <ul className="r-list">
          <li><b>Per-partner tax.</b> Income tax is worked out for each person on their own allowance and bands, and
            drawdown is allocated by marginal rate — so both personal allowances and both basic-rate bands are used
            before anyone pays higher rate.</li>
          <li><b>Today's money.</b> State pensions, target spending, life events and inheritance are entered in today's
            money and indexed to their year by the inflation assumption. Outputs are shown in today's money unless labelled.</li>
          <li><b>Contributions &amp; growth.</b> Monthly pension and ISA contributions are added through the accumulation
            years with mid-year growth; pots then grow at the scenario rate and are drawn down in retirement.</li>
          <li><b>Tax-free cash.</b> PCLS is a balance-sheet transfer, not income; capped at {fmt(plan.tax.pclsCap)}.
            If taken upfront it is assumed reinvested alongside ISAs.</li>
          <li><b>Guaranteed income first.</b> Each year, State and defined-benefit pensions are counted first; the
            shortfall to your target is met from pots in the chosen order.</li>
          <li><b>Defined-benefit pensions</b> are held level unless you mark them as rising with inflation.</li>
          <li><b>Longevity.</b> The plan runs to your chosen horizon age ({plan.horizonAge}); it does not model early death,
            care costs, or one partner outliving the other beyond the shared plan.</li>
        </ul>
      </section>

      {/* ── 6. Important information ──────────────────────────── */}
      <section className="r-page">
        <h2>6 · Important information</h2>
        <ul className="r-list">
          <li><b>Not financial advice.</b> Someday is a modelling tool to help you explore your own numbers. It is not
            regulated financial advice and does not account for your full circumstances. For decisions, consult an
            authorised financial adviser.</li>
          <li><b>One possible future.</b> Projections are illustrations, not promises. Real investment returns, inflation,
            tax rules and personal circumstances will differ, and past performance is not a guide to the future.</li>
          <li><b>Assumptions drive everything.</b> Small changes to growth, inflation or spending can materially change the
            outcome. Review the assumptions in Section 5 with your adviser.</li>
          <li><b>Tax rules.</b> Based on 2025/26 rates and thresholds for {plan.tax?.region === 'scotland'
            ? 'Scotland (Scottish income-tax bands)' : 'England, Wales & Northern Ireland'}, which are subject to change.
            The region can be switched in the app and everything recalculates.</li>
          <li><b>Privacy.</b> All figures were entered and computed on your own device. Nothing was uploaded or shared in
            producing this report.</li>
        </ul>
        <p className="r-foot">Prepared with Someday · {printedOn}. A modelling illustration for {A.name} &amp; {B.name}.
          Not financial advice.</p>
      </section>
    </div>
  );
}
