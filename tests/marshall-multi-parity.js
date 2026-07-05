/**
 * Multi-scenario reconciliation: RetireLens 4 vs an INDEPENDENT re-implementation
 * of the Marshall workbook's maths, across many different inputs.
 *
 * For each scenario we compute the headline outcomes two completely separate
 * ways — the app's engine, and a from-scratch replica of the workbook formulas —
 * and check they agree. This is differential testing: if a change ever makes the
 * app drift from the workbook logic, a scenario here goes red.
 *
 * Run: npm run test:multiparity
 */

import { Engine } from '../v4/engine.js';

// ── Independent replica of the workbook maths (shares no code with the engine) ──

// Accumulation: annual compounding with a mid-year contribution (matches the
// workbook's "pot grows, you pay in through the year" approach).
function replicaPot(startPot, monthlyContrib, years, g) {
  let bal = startPot;
  const midYear = 1 + g / 2;
  for (let i = 0; i < years; i++) bal = bal * (1 + g) + (monthlyContrib * 12) * midYear;
  return bal;
}

// UK income tax (England/Wales/NI), workbook rates.
function replicaTax(gross) {
  const pa = gross <= 100000 ? 12570 : Math.max(0, 12570 - Math.floor((gross - 100000) / 2));
  const t = Math.max(0, gross - pa);
  let tax = Math.min(t, 37700) * 0.2;
  tax += Math.max(0, Math.min(t, 125140 - 12570) - 37700) * 0.4;
  tax += Math.max(0, t - (125140 - 12570)) * 0.45;
  return tax;
}

function replica(P) {
  const years = P.retireYear - P.startYear;
  const g = P.growth;
  const pensionAt = replicaPot(P.partnerA.pension, P.partnerA.monthlyPension, years, g)
                  + replicaPot(P.partnerB.pension, P.partnerB.monthlyPension, years, g);
  const isaAt = replicaPot(P.partnerA.isa, P.partnerA.monthlyIsa, years, g)
              + replicaPot(P.partnerB.isa, P.partnerB.monthlyIsa, years, g);
  // Year-1 target spending, today's money (workbook convention).
  const year1SpendTodays = P.targetNet;
  return { pensionAt, isaAt, year1SpendTodays };
}

// ── Scenarios: vary the inputs widely ──
const D = Engine.defaults();
const base = JSON.parse(JSON.stringify(D));
const scen = (label, patch) => ({ label, P: patch(JSON.parse(JSON.stringify(base))) });

const SCENARIOS = [
  scen('Marshall base (Stuart & Carol)', p => p),
  scen('Bigger pots, higher target', p => { p.partnerA.pension = 900000; p.partnerB.pension = 120000; p.targetNet = 80000; return p; }),
  scen('Smaller pots, modest target', p => { p.partnerA.pension = 180000; p.partnerB.pension = 20000; p.targetNet = 30000; return p; }),
  scen('Retire later (2035), lower growth', p => { p.retireYear = 2035; p.growth = 0.05; p.growthBase = 0.05; return p; }),
  scen('No defined-benefit pension', p => { p.partnerB.db = 0; return p; }),
  scen('Higher monthly investing', p => { p.partnerA.monthlyPension = 2000; p.partnerB.monthlyPension = 800; return p; }),
  scen('Bull growth 10%', p => { p.growth = 0.10; p.growthBase = 0.10; return p; }),
  scen('Bear growth 4%, bigger target', p => { p.growth = 0.04; p.growthBase = 0.04; p.targetNet = 55000; return p; }),
  scen('ISA-heavy household', p => { p.partnerA.isa = 200000; p.partnerB.isa = 150000; return p; }),
];

const f = n => '£' + Math.round(n).toLocaleString();
const pct = (a, b) => b === 0 ? 0 : ((a - b) / b) * 100;
const inflAt = (P, y) => Math.pow(1 + P.inflation, y - P.startYear);

console.log('═══════════════════════════════════════════════════════════════════════');
console.log('  MULTI-SCENARIO RECONCILIATION — RetireLens 4  vs  workbook maths (replica)');
console.log('═══════════════════════════════════════════════════════════════════════\n');

let fails = 0;
for (const s of SCENARIOS) {
  const P = s.P;
  const acc = Engine.accumulate(P).atRetirement;
  const dd = Engine.drawdown(P);
  const rep = replica(P);

  const appPot = acc.pensionA + acc.pensionB;
  const appIsa = acc.isaA + acc.isaB;
  const appYear1Spend = dd.rows[0].target / inflAt(P, dd.rows[0].year);

  const dPot = pct(appPot, rep.pensionAt);
  const dIsa = pct(appIsa, rep.isaAt);
  const dSpend = pct(appYear1Spend, rep.year1SpendTodays);

  const ok = Math.abs(dPot) < 0.5 && Math.abs(dIsa) < 0.5 && Math.abs(dSpend) < 0.5;
  if (!ok) fails++;

  console.log((ok ? '✓ ' : '⚠ ') + s.label);
  console.log(`    Pension at retirement   app ${f(appPot).padStart(11)}  replica ${f(rep.pensionAt).padStart(11)}  (${dPot >= 0 ? '+' : ''}${dPot.toFixed(2)}%)`);
  console.log(`    ISAs at retirement      app ${f(appIsa).padStart(11)}  replica ${f(rep.isaAt).padStart(11)}  (${dIsa >= 0 ? '+' : ''}${dIsa.toFixed(2)}%)`);
  console.log(`    Year-1 spend (today £)  app ${f(appYear1Spend).padStart(11)}  target  ${f(rep.year1SpendTodays).padStart(11)}  (${dSpend >= 0 ? '+' : ''}${dSpend.toFixed(2)}%)  · money ${dd.exhaustedYear ? 'runs out ' + dd.exhaustedYear : 'lasts'}`);
  console.log('');
}

console.log('───────────────────────────────────────────────────────────────────────');
console.log(fails === 0
  ? `  ✓ All ${SCENARIOS.length} scenarios reconcile: the app agrees with the workbook maths.`
  : `  ⚠ ${fails}/${SCENARIOS.length} scenarios disagree — investigate.`);
console.log('═══════════════════════════════════════════════════════════════════════');
if (fails > 0) process.exitCode = 1;
